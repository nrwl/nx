use anyhow::{Context, Result};
use std::cell::Cell;
use std::num::NonZero;
use std::sync::Arc;
use std::time::Duration;
use tracing::trace;
use turso_core::{Connection, Database, LimboError, NonNan, Numeric, Statement, Value};

#[derive(Clone, Debug)]
pub enum DbValue {
    Text(String),
    Integer(i64),
    Real(f64),
    Null,
}

impl From<String> for DbValue {
    fn from(s: String) -> Self {
        DbValue::Text(s)
    }
}

impl From<&str> for DbValue {
    fn from(s: &str) -> Self {
        DbValue::Text(s.to_string())
    }
}

impl From<bool> for DbValue {
    fn from(v: bool) -> Self {
        DbValue::Integer(v as i64)
    }
}

fn to_turso_value(v: &DbValue) -> Value {
    match v {
        DbValue::Text(s) => Value::from_text(s.clone()),
        DbValue::Integer(i) => Value::Numeric(Numeric::Integer(*i)),
        DbValue::Real(f) => {
            NonNan::new(*f).map_or(Value::Null, |f| Value::Numeric(Numeric::Float(f)))
        }
        DbValue::Null => Value::Null,
    }
}

fn from_turso_value(v: &Value) -> DbValue {
    match v {
        Value::Numeric(Numeric::Integer(i)) => DbValue::Integer(*i),
        Value::Numeric(Numeric::Float(f)) => DbValue::Real(f64::from(*f)),
        Value::Text(t) => DbValue::Text(t.as_str().to_string()),
        Value::Null | Value::Blob(_) => DbValue::Null,
    }
}

/// A row of query results (eagerly collected, fully owned).
#[derive(Clone, Debug)]
pub struct DbRow {
    values: Vec<DbValue>,
}

impl DbRow {
    pub fn get_str(&self, idx: usize) -> Result<String> {
        match self.values.get(idx) {
            Some(DbValue::Text(s)) => Ok(s.clone()),
            Some(other) => anyhow::bail!("Column {} is not text: {:?}", idx, other),
            None => anyhow::bail!("Column index {} out of range", idx),
        }
    }

    pub fn get_i64(&self, idx: usize) -> Result<i64> {
        match self.values.get(idx) {
            Some(DbValue::Integer(i)) => Ok(*i),
            Some(other) => anyhow::bail!("Column {} is not integer: {:?}", idx, other),
            None => anyhow::bail!("Column index {} out of range", idx),
        }
    }

    pub fn get_f64(&self, idx: usize) -> Result<f64> {
        match self.values.get(idx) {
            Some(DbValue::Real(f)) => Ok(*f),
            Some(DbValue::Integer(i)) => Ok(*i as f64),
            Some(other) => anyhow::bail!("Column {} is not real: {:?}", idx, other),
            None => anyhow::bail!("Column index {} out of range", idx),
        }
    }

    pub fn get_optional_str(&self, idx: usize) -> Result<Option<String>> {
        match self.values.get(idx) {
            Some(DbValue::Text(s)) => Ok(Some(s.clone())),
            Some(DbValue::Null) => Ok(None),
            Some(other) => anyhow::bail!("Column {} is not text/null: {:?}", idx, other),
            None => anyhow::bail!("Column index {} out of range", idx),
        }
    }
}

/// SQLite's default busy-handler schedule; turso_core reports busy without waiting.
const BUSY_DELAYS_MS: [u64; 12] = [1, 2, 5, 10, 15, 20, 25, 25, 25, 50, 50, 100];
const BUSY_TIMEOUT: Duration = Duration::from_secs(12);

/// Another process changed the schema; re-reading it makes the retry succeed.
const MAX_SCHEMA_RETRIES: usize = 3;

fn limbo_error(e: &anyhow::Error) -> Option<&LimboError> {
    e.downcast_ref::<LimboError>()
}

#[derive(Default)]
pub struct NxDbConnection {
    conn: Option<Arc<Connection>>,
    /// Keep the Database alive — Connection may reference it internally.
    _db: Option<Arc<Database>>,
    /// Inside a transaction only the whole transaction may be retried, not one statement.
    in_transaction: Cell<bool>,
}

impl NxDbConnection {
    pub fn new(db: Arc<Database>, conn: Arc<Connection>) -> Self {
        Self {
            conn: Some(conn),
            _db: Some(db),
            in_transaction: Cell::new(false),
        }
    }

    fn conn(&self) -> Result<&Arc<Connection>> {
        self.conn
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No database connection available"))
    }

    /// Runs `op` until it stops reporting busy or `BUSY_TIMEOUT` has been spent sleeping.
    fn retry_while_busy<T>(&self, mut op: impl FnMut() -> Result<T>) -> Result<T> {
        let mut waited = Duration::ZERO;
        let mut busy_attempts = 0;
        let mut schema_retries = 0;
        loop {
            match op() {
                Err(e)
                    if matches!(limbo_error(&e), Some(LimboError::SchemaUpdated))
                        && schema_retries < MAX_SCHEMA_RETRIES =>
                {
                    schema_retries += 1;
                    trace!("Database schema changed, reparsing and retrying");
                    self.conn()?.maybe_reparse_schema()?;
                }
                Err(e)
                    if matches!(
                        limbo_error(&e),
                        Some(LimboError::Busy | LimboError::BusySnapshot)
                    ) && waited < BUSY_TIMEOUT =>
                {
                    let index = busy_attempts.min(BUSY_DELAYS_MS.len() - 1);
                    let delay = Duration::from_millis(BUSY_DELAYS_MS[index]);
                    trace!("Database busy, retrying in {:?}", delay);
                    std::thread::sleep(delay);
                    waited += delay;
                    busy_attempts += 1;
                }
                result => return result,
            }
        }
    }

    fn retrying<T>(&self, mut op: impl FnMut() -> Result<T>) -> Result<T> {
        if self.in_transaction.get() {
            op()
        } else {
            self.retry_while_busy(op)
        }
    }

    fn prepare(&self, sql: &str, params: &[DbValue]) -> Result<Statement> {
        let mut stmt = self.conn()?.prepare(sql)?;
        for (i, param) in params.iter().enumerate() {
            let index = NonZero::new(i + 1).expect("index starts at 1");
            stmt.bind_at(index, to_turso_value(param))?;
        }
        Ok(stmt)
    }

    pub fn execute(&self, sql: &str, params: &[DbValue]) -> Result<usize> {
        self.retrying(|| {
            let mut stmt = self.prepare(sql, params)?;
            stmt.run_ignore_rows()?;
            Ok(stmt.n_change() as usize)
        })
        .with_context(|| format!("DB execute error: \"{sql}\""))
    }

    pub fn execute_batch(&self, sql: &str) -> Result<()> {
        let conn = self.conn()?;
        self.retrying(|| Ok(conn.execute(sql)?))
            .with_context(|| format!("DB execute batch error: \"{sql}\""))
    }

    pub fn query_rows(&self, sql: &str, params: &[DbValue]) -> Result<Vec<DbRow>> {
        self.retrying(|| {
            let rows = self.prepare(sql, params)?.run_collect_rows()?;
            Ok(rows
                .iter()
                .map(|row| DbRow {
                    values: row.iter().map(from_turso_value).collect(),
                })
                .collect())
        })
        .with_context(|| format!("DB query error: \"{sql}\""))
    }

    pub fn query_row(&self, sql: &str, params: &[DbValue]) -> Result<Option<DbRow>> {
        let rows = self.query_rows(sql, params)?;
        Ok(rows.into_iter().next())
    }

    /// Takes the write lock up front, so a busy or schema-changed error can only mean
    /// "retry the whole transaction", which this does. `operation` may run more than once.
    pub fn transaction<T>(&self, mut operation: impl FnMut(&Self) -> Result<T>) -> Result<T> {
        self.retry_while_busy(|| {
            self.in_transaction.set(true);
            if let Err(e) = self.execute("BEGIN IMMEDIATE", &[]) {
                self.in_transaction.set(false);
                return Err(e);
            }
            let result = operation(self).and_then(|value| {
                self.execute("COMMIT", &[])?;
                Ok(value)
            });
            self.in_transaction.set(false);
            if result.is_err() {
                if let Err(rollback_err) = self.execute("ROLLBACK", &[]) {
                    trace!("Rollback failed: {:?}", rollback_err);
                }
            }
            result
        })
    }

    pub fn close(self) -> Result<()> {
        trace!("Closing database connection");
        // Drop alone skips turso's shutdown checkpoint, including the WAL truncate.
        if let Some(conn) = &self.conn {
            conn.close()?;
        }
        Ok(())
    }
}
