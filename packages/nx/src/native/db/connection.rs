use anyhow::Result;
use rusqlite::{Connection, Error, OptionalExtension, Params, Row, Statement};
use std::thread;
use std::time::{Duration, Instant};
use tracing::trace;

pub struct NxDbConnection {
    pub conn: Connection,
}

impl NxDbConnection {
    pub fn new(connection: Connection) -> Self {
        Self { conn: connection }
    }

    pub fn execute<P: Params + Clone>(&self, sql: &str, params: P) -> Result<usize> {
        self.retry_on_busy(|conn| conn.execute(sql, params.clone()))
            .map_err(|e| anyhow::anyhow!("DB execute error: \"{}\", {:?}", sql, e))
    }

    pub fn execute_batch(&self, sql: &str) -> Result<()> {
        self.retry_on_busy(|conn| conn.execute_batch(sql))
            .map_err(|e| anyhow::anyhow!("DB execute batch error: \"{}\", {:?}", sql, e))
    }

    pub fn prepare(&self, sql: &str) -> Result<Statement> {
        self.retry_on_busy(|conn| conn.prepare(sql))
            .map_err(|e| anyhow::anyhow!("DB prepare error: \"{}\", {:?}", sql, e))
    }

    pub fn query_row<T, P, F>(&self, sql: &str, params: P, f: F) -> Result<Option<T>>
    where
        P: Params + Clone,
        F: FnOnce(&Row<'_>) -> rusqlite::Result<T> + Clone,
    {
        self.retry_on_busy(|conn| conn.query_row(sql, params.clone(), f.clone()).optional())
            .map_err(|e| anyhow::anyhow!("DB query error: \"{}\", {:?}", sql, e))
    }

    pub fn close(self) -> rusqlite::Result<(), (Connection, Error)> {
        self.conn
            .close()
            .inspect_err(|e| trace!("Error in close: {:?}", e))
    }

    #[allow(clippy::needless_lifetimes)]
    fn retry_on_busy<'a, F, T>(&'a self, operation: F) -> rusqlite::Result<T>
    where
        F: Fn(&'a Connection) -> rusqlite::Result<T>,
    {
        let start = Instant::now();
        let max_retries: u64 = 5;
        let retry_delay = Duration::from_millis(25);

        for i in 0..max_retries {
            match operation(&self.conn) {
                Ok(result) => return Ok(result),
                Err(Error::SqliteFailure(err, _))
                    if err.code == rusqlite::ErrorCode::DatabaseBusy =>
                {
                    trace!("Database busy. Retrying{}", ".".repeat(i as usize));
                    if start.elapsed()
                        >= Duration::from_millis(max_retries * retry_delay.as_millis() as u64)
                    {
                        break;
                    }
                    thread::sleep(retry_delay);
                }
                err @ Err(_) => return err,
            }
        }

        operation(&self.conn)
    }
}
