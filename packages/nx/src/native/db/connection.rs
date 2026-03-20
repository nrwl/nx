use anyhow::Result;

use rusqlite::{Connection, DatabaseName, Error, OptionalExtension, Params, Row, ToSql};
use std::thread;
use std::time::Duration;
use tracing::trace;

// =============================================================================
// DbValue / DbRow — backend-agnostic data types for query_rows()
// =============================================================================

/// A backend-agnostic parameter value for queries.
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

impl rusqlite::types::ToSql for DbValue {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
        match self {
            DbValue::Text(s) => s.to_sql(),
            DbValue::Integer(i) => i.to_sql(),
            DbValue::Real(f) => f.to_sql(),
            DbValue::Null => rusqlite::types::Null.to_sql(),
        }
    }
}

/// A backend-agnostic row of query results (eagerly collected).
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
            // SQLite often returns integers for AVG() etc, coerce to f64
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

// =============================================================================
// DbBackend enum — dispatches to either rusqlite or libsql (turso)
// =============================================================================

pub(crate) enum DbBackend {
    Rusqlite(Connection),
    #[cfg(feature = "turso-backend")]
    Turso {
        rt: tokio::runtime::Runtime,
        conn: libsql::Connection,
        /// Keep the Database alive — Connection borrows from it internally.
        _db: libsql::Database,
    },
}

// =============================================================================
// NxDbConnection
// =============================================================================

const MAX_RETRIES: u32 = 20;
const RETRY_DELAY: u64 = 25;

/// macro for handling the db when its busy
/// This is a macro instead of a function because some database operations need to take a &mut Connection, while returning a reference
/// This causes some quite complex lifetime issues that are quite hard to solve
///
/// Using a macro inlines the retry operation where it was called, and the lifetime issues are avoided
macro_rules! retry_db_operation_when_busy {
    ($operation:expr) => {{
        let connection = 'retry: {
            for i in 1..MAX_RETRIES {
                match $operation {
                    r @ Ok(_) => break 'retry r,
                    Err(Error::SqliteFailure(err, _))
                        if err.code == rusqlite::ErrorCode::DatabaseBusy =>
                    {
                        trace!("Database busy. Retrying {} of {}", i, MAX_RETRIES);
                        let sleep = Duration::from_millis(RETRY_DELAY * 2_u64.pow(i));
                        let max_sleep = Duration::from_secs(12);
                        if (sleep >= max_sleep) {
                            thread::sleep(max_sleep);
                        } else {
                            thread::sleep(sleep);
                        }
                    }
                    err => break 'retry err,
                };
            }
            break 'retry Err(Error::SqliteFailure(
                rusqlite::ffi::Error {
                    code: rusqlite::ErrorCode::DatabaseBusy,
                    extended_code: 0,
                },
                Some("Database busy. Retried maximum number of times.".to_string()),
            ));
        };

        connection
    }};
}

pub struct NxDbConnection {
    backend: Option<DbBackend>,
}

impl Default for NxDbConnection {
    fn default() -> Self {
        Self { backend: None }
    }
}

impl NxDbConnection {
    /// Create from a rusqlite connection (existing path).
    pub fn new(connection: Connection) -> Self {
        Self {
            backend: Some(DbBackend::Rusqlite(connection)),
        }
    }

    /// Create from a turso/libsql connection.
    #[cfg(feature = "turso-backend")]
    pub fn new_turso(db: libsql::Database, conn: libsql::Connection) -> Self {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("Failed to create tokio runtime for turso backend");
        Self {
            backend: Some(DbBackend::Turso { rt, conn, _db: db }),
        }
    }

    // =========================================================================
    // execute
    // =========================================================================

    pub fn execute<P: Params + Clone>(&self, sql: &str, params: P) -> Result<usize> {
        match self.backend.as_ref() {
            Some(DbBackend::Rusqlite(conn)) => {
                retry_db_operation_when_busy!(conn.execute(sql, params.clone()))
                    .map_err(|e| anyhow::anyhow!("DB execute error: \"{}\", {:?}", sql, e))
            }
            #[cfg(feature = "turso-backend")]
            Some(DbBackend::Turso { rt, conn, .. }) => {
                // libsql execute returns u64, convert to usize
                let n = rt
                    .block_on(conn.execute(sql, ()))
                    .map_err(|e| anyhow::anyhow!("DB execute error: \"{}\", {:?}", sql, e))?;
                Ok(n as usize)
            }
            None => anyhow::bail!("No database connection available"),
        }
    }

    /// Execute with DbValue params — works identically across both backends.
    pub fn execute_with_values(&self, sql: &str, params: &[DbValue]) -> Result<usize> {
        match self.backend.as_ref() {
            Some(DbBackend::Rusqlite(conn)) => {
                let param_refs: Vec<&dyn ToSql> =
                    params.iter().map(|v| v as &dyn ToSql).collect();
                retry_db_operation_when_busy!(conn.execute(sql, param_refs.as_slice()))
                    .map_err(|e| anyhow::anyhow!("DB execute error: \"{}\", {:?}", sql, e))
            }
            #[cfg(feature = "turso-backend")]
            Some(DbBackend::Turso { rt, conn, .. }) => {
                let libsql_params = db_values_to_libsql_params(params);
                let n = rt
                    .block_on(conn.execute(sql, libsql_params))
                    .map_err(|e| anyhow::anyhow!("DB execute error: \"{}\", {:?}", sql, e))?;
                Ok(n as usize)
            }
            None => anyhow::bail!("No database connection available"),
        }
    }

    // =========================================================================
    // execute_batch
    // =========================================================================

    pub fn execute_batch(&self, sql: &str) -> Result<()> {
        match self.backend.as_ref() {
            Some(DbBackend::Rusqlite(conn)) => {
                retry_db_operation_when_busy!(conn.execute_batch(sql))
                    .map_err(|e| anyhow::anyhow!("DB execute batch error: \"{}\", {:?}", sql, e))
            }
            #[cfg(feature = "turso-backend")]
            Some(DbBackend::Turso { rt, conn, .. }) => {
                rt.block_on(conn.execute_batch(sql))
                    .map(|_| ())
                    .map_err(|e| anyhow::anyhow!("DB execute batch error: \"{}\", {:?}", sql, e))
            }
            None => anyhow::bail!("No database connection available"),
        }
    }

    // =========================================================================
    // prepare  (rusqlite-only — returns rusqlite::Statement)
    // Callers should migrate to query_rows() for backend-agnostic access.
    // =========================================================================

    pub fn prepare(&self, sql: &str) -> Result<rusqlite::Statement> {
        match self.backend.as_ref() {
            Some(DbBackend::Rusqlite(conn)) => {
                retry_db_operation_when_busy!(conn.prepare(sql))
                    .map_err(|e| anyhow::anyhow!("DB prepare error: \"{}\", {:?}", sql, e))
            }
            #[cfg(feature = "turso-backend")]
            Some(DbBackend::Turso { .. }) => {
                anyhow::bail!(
                    "prepare() is not supported with turso backend — use query_rows() instead"
                )
            }
            None => anyhow::bail!("No database connection available"),
        }
    }

    // =========================================================================
    // query_rows — backend-agnostic, returns eagerly-collected Vec<DbRow>
    // =========================================================================

    /// Execute a query and collect all rows into `Vec<DbRow>`.
    ///
    /// Column count is auto-detected from the first row. All values are
    /// eagerly read as Text, Integer, Real, or Null.
    pub fn query_rows(&self, sql: &str, params: &[DbValue]) -> Result<Vec<DbRow>> {
        match self.backend.as_ref() {
            Some(DbBackend::Rusqlite(conn)) => {
                let param_refs: Vec<&dyn ToSql> =
                    params.iter().map(|v| v as &dyn ToSql).collect();
                let mut stmt =
                    retry_db_operation_when_busy!(conn.prepare(sql)).map_err(|e| {
                        anyhow::anyhow!("DB query_rows prepare error: \"{}\", {:?}", sql, e)
                    })?;
                let col_count = stmt.column_count();
                let rows = retry_db_operation_when_busy!(
                    stmt.query_map(param_refs.as_slice(), |row| {
                        let mut values = Vec::with_capacity(col_count);
                        for i in 0..col_count {
                            let val = rusqlite_value_from_row(row, i);
                            values.push(val);
                        }
                        Ok(DbRow { values })
                    })
                )
                .map_err(|e| {
                    anyhow::anyhow!("DB query_rows error: \"{}\", {:?}", sql, e)
                })?;
                rows.map(|r| r.map_err(|e| anyhow::anyhow!("Row read error: {:?}", e)))
                    .collect()
            }
            #[cfg(feature = "turso-backend")]
            Some(DbBackend::Turso { rt, conn, .. }) => {
                let libsql_params = db_values_to_libsql_params(params);
                let mut rows = rt
                    .block_on(conn.query(sql, libsql_params))
                    .map_err(|e| {
                        anyhow::anyhow!("DB query_rows error: \"{}\", {:?}", sql, e)
                    })?;
                let mut result = Vec::new();
                loop {
                    match rt.block_on(rows.next()) {
                        Ok(Some(row)) => {
                            let col_count = rows.column_count() as usize;
                            let mut values = Vec::with_capacity(col_count);
                            for i in 0..col_count {
                                let val = libsql_value_from_row(&row, i as i32);
                                values.push(val);
                            }
                            result.push(DbRow { values });
                        }
                        Ok(None) => break,
                        Err(e) => {
                            return Err(anyhow::anyhow!("Row read error: {:?}", e));
                        }
                    }
                }
                Ok(result)
            }
            None => anyhow::bail!("No database connection available"),
        }
    }

    // =========================================================================
    // transaction (rusqlite-style with &Connection callback)
    // =========================================================================

    pub fn transaction<T>(
        &mut self,
        transaction_operation: impl Fn(&Connection) -> rusqlite::Result<T>,
    ) -> Result<T> {
        match self.backend.as_mut() {
            Some(DbBackend::Rusqlite(conn)) => {
                retry_db_operation_when_busy!(conn.transaction().and_then(|tx| {
                    let result = transaction_operation(&tx)?;
                    tx.commit()?;
                    Ok(result)
                }))
                .map_err(|e| anyhow::anyhow!("DB transaction error: {:?}", e))
            }
            #[cfg(feature = "turso-backend")]
            Some(DbBackend::Turso { .. }) => {
                anyhow::bail!(
                    "transaction() with rusqlite callback is not supported on turso backend — use begin_transaction/commit_transaction instead"
                )
            }
            None => anyhow::bail!("No database connection available"),
        }
    }

    // =========================================================================
    // begin / commit / rollback — backend-agnostic transaction control
    // =========================================================================

    /// Begin a transaction. For turso, uses `BEGIN CONCURRENT` (MVCC).
    pub fn begin_transaction(&self) -> Result<()> {
        match self.backend.as_ref() {
            Some(DbBackend::Rusqlite(conn)) => {
                retry_db_operation_when_busy!(conn.execute_batch("BEGIN"))
                    .map_err(|e| anyhow::anyhow!("DB begin transaction error: {:?}", e))
            }
            #[cfg(feature = "turso-backend")]
            Some(DbBackend::Turso { rt, conn, .. }) => {
                rt.block_on(conn.execute("BEGIN CONCURRENT", ()))
                    .map_err(|e| anyhow::anyhow!("DB begin transaction error: {:?}", e))?;
                Ok(())
            }
            None => anyhow::bail!("No database connection available"),
        }
    }

    pub fn commit_transaction(&self) -> Result<()> {
        match self.backend.as_ref() {
            Some(DbBackend::Rusqlite(conn)) => {
                retry_db_operation_when_busy!(conn.execute_batch("COMMIT"))
                    .map_err(|e| anyhow::anyhow!("DB commit error: {:?}", e))
            }
            #[cfg(feature = "turso-backend")]
            Some(DbBackend::Turso { rt, conn, .. }) => {
                rt.block_on(conn.execute("COMMIT", ()))
                    .map_err(|e| anyhow::anyhow!("DB commit error: {:?}", e))?;
                Ok(())
            }
            None => anyhow::bail!("No database connection available"),
        }
    }

    pub fn rollback_transaction(&self) -> Result<()> {
        match self.backend.as_ref() {
            Some(DbBackend::Rusqlite(conn)) => {
                retry_db_operation_when_busy!(conn.execute_batch("ROLLBACK"))
                    .map_err(|e| anyhow::anyhow!("DB rollback error: {:?}", e))
            }
            #[cfg(feature = "turso-backend")]
            Some(DbBackend::Turso { rt, conn, .. }) => {
                rt.block_on(conn.execute("ROLLBACK", ()))
                    .map_err(|e| anyhow::anyhow!("DB rollback error: {:?}", e))?;
                Ok(())
            }
            None => anyhow::bail!("No database connection available"),
        }
    }

    // =========================================================================
    // query_row
    // =========================================================================

    pub fn query_row<T, P, F>(&self, sql: &str, params: P, f: F) -> Result<Option<T>>
    where
        P: Params + Clone,
        F: FnOnce(&Row<'_>) -> rusqlite::Result<T> + Clone,
    {
        match self.backend.as_ref() {
            Some(DbBackend::Rusqlite(conn)) => {
                retry_db_operation_when_busy!(
                    conn.query_row(sql, params.clone(), f.clone()).optional()
                )
                .map_err(|e| anyhow::anyhow!("DB query error: \"{}\", {:?}", sql, e))
            }
            #[cfg(feature = "turso-backend")]
            Some(DbBackend::Turso { .. }) => {
                // query_row() with rusqlite Row mapper can't work on turso — callers
                // should use query_row_values() or query_rows() instead.
                anyhow::bail!(
                    "query_row() with rusqlite Row mapper is not supported on turso backend — use query_row_values() instead"
                )
            }
            None => anyhow::bail!("No database connection available"),
        }
    }

    /// Backend-agnostic query_row — returns at most one DbRow.
    pub fn query_row_values(&self, sql: &str, params: &[DbValue]) -> Result<Option<DbRow>> {
        let rows = self.query_rows(sql, params)?;
        Ok(rows.into_iter().next())
    }

    // =========================================================================
    // close
    // =========================================================================

    pub fn close(self) -> Result<()> {
        trace!("Closing database connection");
        match self.backend {
            Some(DbBackend::Rusqlite(conn)) => conn
                .close()
                .map_err(|(_, err)| anyhow::anyhow!("Unable to close connection: {:?}", err)),
            #[cfg(feature = "turso-backend")]
            Some(DbBackend::Turso { .. }) => {
                // libsql connections are closed on drop
                Ok(())
            }
            None => anyhow::bail!("No database connection available"),
        }
    }

    // =========================================================================
    // pragma_update
    // =========================================================================

    pub fn pragma_update<V>(
        &self,
        schema_name: Option<DatabaseName<'_>>,
        pragma_name: &str,
        pragma_value: V,
    ) -> Result<()>
    where
        V: ToSql + Clone,
    {
        match self.backend.as_ref() {
            Some(DbBackend::Rusqlite(conn)) => {
                retry_db_operation_when_busy!(conn.pragma_update(
                    schema_name,
                    pragma_name,
                    pragma_value.clone()
                ))
                .map_err(|e| anyhow::anyhow!("DB pragma update error: {:?}", e))
            }
            #[cfg(feature = "turso-backend")]
            Some(DbBackend::Turso { .. }) => {
                // Turso/libsql handles pragmas internally — no-op for now.
                // WAL/journal mode and busy handler are irrelevant with MVCC.
                trace!(
                    "Turso backend: pragma {} — skipped (handled by MVCC engine)",
                    pragma_name
                );
                Ok(())
            }
            None => anyhow::bail!("No database connection available"),
        }
    }

    // =========================================================================
    // busy_handler
    // =========================================================================

    pub fn busy_handler(&self, callback: Option<fn(i32) -> bool>) -> Result<()> {
        match self.backend.as_ref() {
            Some(DbBackend::Rusqlite(conn)) => {
                retry_db_operation_when_busy!(conn.busy_handler(callback))
                    .map_err(|e| anyhow::anyhow!("DB busy handler error: {:?}", e))
            }
            #[cfg(feature = "turso-backend")]
            Some(DbBackend::Turso { .. }) => {
                // MVCC eliminates SQLITE_BUSY — no-op for turso
                trace!("Turso backend: busy_handler is a no-op (MVCC handles concurrency)");
                Ok(())
            }
            None => anyhow::bail!("No database connection available"),
        }
    }

    // =========================================================================
    // Backend query helper
    // =========================================================================

    /// Returns true if this connection uses the turso backend.
    #[allow(dead_code)]
    pub fn is_turso(&self) -> bool {
        #[cfg(feature = "turso-backend")]
        if let Some(DbBackend::Turso { .. }) = &self.backend {
            return true;
        }
        false
    }
}

// =============================================================================
// Helper functions
// =============================================================================

/// Extract a DbValue from a rusqlite row column.
fn rusqlite_value_from_row(row: &Row<'_>, idx: usize) -> DbValue {
    // Try types in order: integer, real, text, null
    if let Ok(v) = row.get::<_, i64>(idx) {
        return DbValue::Integer(v);
    }
    if let Ok(v) = row.get::<_, f64>(idx) {
        return DbValue::Real(v);
    }
    if let Ok(v) = row.get::<_, String>(idx) {
        return DbValue::Text(v);
    }
    DbValue::Null
}

/// Convert DbValue slice to libsql params.
#[cfg(feature = "turso-backend")]
fn db_values_to_libsql_params(params: &[DbValue]) -> Vec<libsql::Value> {
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

/// Extract a DbValue from a libsql row column.
#[cfg(feature = "turso-backend")]
fn libsql_value_from_row(row: &libsql::Row, idx: i32) -> DbValue {
    // Try types in order: integer, real, text, null
    if let Ok(v) = row.get::<i64>(idx) {
        return DbValue::Integer(v);
    }
    if let Ok(v) = row.get::<f64>(idx) {
        return DbValue::Real(v);
    }
    if let Ok(v) = row.get::<String>(idx) {
        return DbValue::Text(v);
    }
    DbValue::Null
}
