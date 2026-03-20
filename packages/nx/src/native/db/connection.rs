use anyhow::Result;
use tracing::trace;

// =============================================================================
// DbValue / DbRow — parameter and result types
// =============================================================================

/// A parameter value for queries.
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

impl From<i64> for DbValue {
    fn from(v: i64) -> Self {
        DbValue::Integer(v)
    }
}

impl From<f64> for DbValue {
    fn from(v: f64) -> Self {
        DbValue::Real(v)
    }
}

fn to_libsql_params(params: &[DbValue]) -> Vec<libsql::Value> {
    params
        .iter()
        .map(|v| match v {
            DbValue::Text(s) => libsql::Value::Text(s.clone()),
            DbValue::Integer(i) => libsql::Value::Integer(*i),
            DbValue::Real(f) => libsql::Value::Real(*f),
            DbValue::Null => libsql::Value::Null,
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

/// Extract a DbValue from a libsql row column.
fn value_from_row(row: &libsql::Row, idx: i32) -> DbValue {
    match row.get_value(idx) {
        Ok(libsql::Value::Integer(i)) => DbValue::Integer(i),
        Ok(libsql::Value::Real(f)) => DbValue::Real(f),
        Ok(libsql::Value::Text(s)) => DbValue::Text(s),
        Ok(libsql::Value::Null) => DbValue::Null,
        Ok(libsql::Value::Blob(_)) => DbValue::Null, // blobs not supported in DbValue
        Err(_) => DbValue::Null,
    }
}

// =============================================================================
// NxDbConnection — wraps libsql::Connection (MVCC, no file locks needed)
// =============================================================================

pub struct NxDbConnection {
    rt: Option<tokio::runtime::Runtime>,
    conn: Option<libsql::Connection>,
    /// Keep the Database alive — Connection may reference it internally.
    _db: Option<libsql::Database>,
}

impl Default for NxDbConnection {
    fn default() -> Self {
        Self {
            rt: None,
            conn: None,
            _db: None,
        }
    }
}

impl NxDbConnection {
    pub fn new(
        rt: tokio::runtime::Runtime,
        db: libsql::Database,
        conn: libsql::Connection,
    ) -> Self {
        Self {
            rt: Some(rt),
            conn: Some(conn),
            _db: Some(db),
        }
    }

    /// Get the runtime, or bail.
    fn rt(&self) -> Result<&tokio::runtime::Runtime> {
        self.rt.as_ref().ok_or_else(|| anyhow::anyhow!("No database runtime available"))
    }

    /// Get the connection, or bail.
    fn conn(&self) -> Result<&libsql::Connection> {
        self.conn.as_ref().ok_or_else(|| anyhow::anyhow!("No database connection available"))
    }

    // =========================================================================
    // execute
    // =========================================================================

    pub fn execute(&self, sql: &str, params: &[DbValue]) -> Result<usize> {
        let rt = self.rt()?;
        let conn = self.conn()?;
        let libsql_params = to_libsql_params(params);
        let n = rt
            .block_on(conn.execute(sql, libsql_params))
            .map_err(|e| anyhow::anyhow!("DB execute error: \"{}\", {:?}", sql, e))?;
        Ok(n as usize)
    }

    // =========================================================================
    // execute_batch
    // =========================================================================

    pub fn execute_batch(&self, sql: &str) -> Result<()> {
        let rt = self.rt()?;
        let conn = self.conn()?;
        rt.block_on(conn.execute_batch(sql))
            .map(|_| ())
            .map_err(|e| anyhow::anyhow!("DB execute batch error: \"{}\", {:?}", sql, e))
    }

    // =========================================================================
    // query_rows — returns eagerly-collected Vec<DbRow>
    // =========================================================================

    pub fn query_rows(&self, sql: &str, params: &[DbValue]) -> Result<Vec<DbRow>> {
        let rt = self.rt()?;
        let conn = self.conn()?;
        let libsql_params = to_libsql_params(params);
        let mut rows = rt
            .block_on(conn.query(sql, libsql_params))
            .map_err(|e| anyhow::anyhow!("DB query_rows error: \"{}\", {:?}", sql, e))?;

        let col_count = rows.column_count() as usize;
        let mut result = Vec::new();
        loop {
            match rt.block_on(rows.next()) {
                Ok(Some(row)) => {
                    let mut values = Vec::with_capacity(col_count);
                    for i in 0..col_count {
                        values.push(value_from_row(&row, i as i32));
                    }
                    result.push(DbRow { values });
                }
                Ok(None) => break,
                Err(e) => return Err(anyhow::anyhow!("Row read error: {:?}", e)),
            }
        }
        Ok(result)
    }

    // =========================================================================
    // query_row — returns at most one DbRow
    // =========================================================================

    pub fn query_row(&self, sql: &str, params: &[DbValue]) -> Result<Option<DbRow>> {
        let rows = self.query_rows(sql, params)?;
        Ok(rows.into_iter().next())
    }

    // =========================================================================
    // begin / commit / rollback — MVCC transaction control
    // =========================================================================

    /// Begin a transaction.
    // NOTE: `BEGIN CONCURRENT` (MVCC) requires engine-level enablement in libsql.
    // Investigate libsql Builder options or compile flags to enable it.
    pub fn begin_transaction(&self) -> Result<()> {
        self.execute("BEGIN", &[])?;
        Ok(())
    }

    pub fn commit_transaction(&self) -> Result<()> {
        self.execute("COMMIT", &[])?;
        Ok(())
    }

    pub fn rollback_transaction(&self) -> Result<()> {
        self.execute("ROLLBACK", &[])?;
        Ok(())
    }

    // =========================================================================
    // close
    // =========================================================================

    pub fn close(self) -> Result<()> {
        trace!("Closing database connection");
        // libsql connections are closed on drop
        drop(self.conn);
        drop(self._db);
        drop(self.rt);
        Ok(())
    }
}
