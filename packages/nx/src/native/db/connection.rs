use anyhow::Result;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;

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

fn to_turso_params(params: &[DbValue]) -> Vec<turso::Value> {
    params
        .iter()
        .map(|v| match v {
            DbValue::Text(s) => turso::Value::Text(s.clone()),
            DbValue::Integer(i) => turso::Value::Integer(*i),
            DbValue::Real(f) => turso::Value::Real(*f),
            DbValue::Null => turso::Value::Null,
        })
        .collect()
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

fn value_from_row(row: &turso::Row, idx: usize) -> DbValue {
    match row.get_value(idx) {
        Ok(turso::Value::Integer(i)) => DbValue::Integer(i),
        Ok(turso::Value::Real(f)) => DbValue::Real(f),
        Ok(turso::Value::Text(s)) => DbValue::Text(s),
        Ok(turso::Value::Null) => DbValue::Null,
        Ok(turso::Value::Blob(_)) => DbValue::Null,
        Err(_) => DbValue::Null,
    }
}

/// SQLite's default busy-handler schedule. turso's own busy wait re-polls without
/// sleeping, so it burns a core; we wait here instead.
const BUSY_DELAYS_MS: [u64; 12] = [1, 2, 5, 10, 15, 20, 25, 25, 25, 50, 50, 100];
const BUSY_TIMEOUT: Duration = Duration::from_secs(12);

fn is_busy(e: &anyhow::Error) -> bool {
    matches!(
        e.downcast_ref::<turso::Error>(),
        Some(turso::Error::Busy(_) | turso::Error::BusySnapshot(_))
    )
}

/// Runs `op` until it stops reporting busy or `BUSY_TIMEOUT` has been spent sleeping.
fn retry_while_busy<T>(mut op: impl FnMut() -> Result<T>) -> Result<T> {
    let mut waited = Duration::ZERO;
    for attempt in 0.. {
        match op() {
            Err(e) if is_busy(&e) && waited < BUSY_TIMEOUT => {
                let delay =
                    Duration::from_millis(BUSY_DELAYS_MS[attempt.min(BUSY_DELAYS_MS.len() - 1)]);
                trace!("Database busy, retrying in {:?}", delay);
                std::thread::sleep(delay);
                waited += delay;
            }
            result => return result,
        }
    }
    unreachable!()
}

#[derive(Default)]
pub struct NxDbConnection {
    rt: Option<tokio::runtime::Runtime>,
    conn: Option<turso::Connection>,
    /// Keep the Database alive — Connection may reference it internally.
    _db: Option<turso::Database>,
    /// Inside a transaction only the whole transaction may be retried, not one statement.
    in_transaction: Cell<bool>,
}

impl NxDbConnection {
    pub fn new(rt: tokio::runtime::Runtime, db: turso::Database, conn: turso::Connection) -> Self {
        Self {
            rt: Some(rt),
            conn: Some(conn),
            _db: Some(db),
            in_transaction: Cell::new(false),
        }
    }

    fn rt(&self) -> Result<&tokio::runtime::Runtime> {
        self.rt
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No database runtime available"))
    }

    fn conn(&self) -> Result<&turso::Connection> {
        self.conn
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No database connection available"))
    }

    fn retrying<T>(&self, mut op: impl FnMut() -> Result<T>) -> Result<T> {
        if self.in_transaction.get() {
            op()
        } else {
            retry_while_busy(op)
        }
    }

    pub fn execute(&self, sql: &str, params: &[DbValue]) -> Result<usize> {
        let rt = self.rt()?;
        let conn = self.conn()?;
        self.retrying(|| {
            let n = rt
                .block_on(conn.execute(sql, to_turso_params(params)))
                .map_err(|e| {
                    anyhow::Error::new(e).context(format!("DB execute error: \"{sql}\""))
                })?;
            Ok(n as usize)
        })
    }

    pub fn execute_batch(&self, sql: &str) -> Result<()> {
        let rt = self.rt()?;
        let conn = self.conn()?;
        self.retrying(|| {
            rt.block_on(conn.execute_batch(sql))
                .map(|_| ())
                .map_err(|e| {
                    anyhow::Error::new(e).context(format!("DB execute batch error: \"{sql}\""))
                })
        })
    }

    pub fn query_rows(&self, sql: &str, params: &[DbValue]) -> Result<Vec<DbRow>> {
        let rt = self.rt()?;
        let conn = self.conn()?;
        self.retrying(|| {
            let mut rows = rt
                .block_on(conn.query(sql, to_turso_params(params)))
                .map_err(|e| anyhow::Error::new(e).context(format!("DB query error: \"{sql}\"")))?;

            let col_count = rows.column_count() as usize;
            let mut result = Vec::new();
            while let Some(row) = rt.block_on(rows.next()).map_err(|e| {
                anyhow::Error::new(e).context(format!("DB row read error: \"{sql}\""))
            })? {
                let values = (0..col_count).map(|i| value_from_row(&row, i)).collect();
                result.push(DbRow { values });
            }
            Ok(result)
        })
    }

    pub fn query_row(&self, sql: &str, params: &[DbValue]) -> Result<Option<DbRow>> {
        let rows = self.query_rows(sql, params)?;
        Ok(rows.into_iter().next())
    }

    /// Takes the write lock up front, so a busy error can only mean "retry the whole
    /// transaction", which this does. `operation` may therefore run more than once.
    pub fn transaction<T>(&self, mut operation: impl FnMut(&Self) -> Result<T>) -> Result<T> {
        retry_while_busy(|| {
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
        // turso connections are closed on drop
        drop(self.conn);
        drop(self._db);
        drop(self.rt);
        Ok(())
    }
}
