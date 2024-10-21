use rusqlite::{Connection, Error, Params, Row, Statement};
use anyhow::Result;
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
            .map_err(|e| anyhow::anyhow!("DB execute: \"{}\", {:?}", sql, e))
    }

    pub fn execute_batch(&self, sql: &str) -> Result<()> {
        self.retry_on_busy(|conn| conn.execute_batch(sql))
            .map_err(|e| anyhow::anyhow!("DB execute batch: \"{}\", {:?}", sql, e))
    }

    pub fn prepare(&self, sql: &str) -> Result<Statement<'_>> {
        self.conn.prepare(sql)
            .map_err(|e| anyhow::anyhow!("DB prepare: \"{}\", {:?}", sql, e))
    }

    pub fn query_row<T, P, F>(&self, sql: &str, params: P, f: F) -> rusqlite::Result<T>
    where
        P: Params,
        F: FnOnce(&Row<'_>) -> rusqlite::Result<T>,
    {
        self.conn.query_row(sql, params, f)
            .inspect_err(|e| trace!("Db query: \"{}\", {:?}", sql, e))
    }

    pub fn close(self) -> rusqlite::Result<(), (Connection, Error)> {
        self.conn.close()
            .inspect_err(|e| trace!("Error in close: {:?}", e))
    }

    fn retry_on_busy<F, T>(&self,  operation: F) -> rusqlite::Result<T>
    where
        F: Fn(&Connection) -> rusqlite::Result<T>,
    {
        let start = Instant::now();
        let max_retries: u64 = 5;
        let retry_delay = Duration::from_millis(25);

        for  i in 0..max_retries {
            match operation(&self.conn) {
                Ok(result) => return Ok(result),
                Err(Error::SqliteFailure(err, _))
                    if err.code == rusqlite::ErrorCode::DatabaseBusy =>
                {
                    trace!("Database busy. Retrying{}", ".".repeat(i as usize));
                    if start.elapsed() >= Duration::from_millis(max_retries * retry_delay.as_millis() as u64) {
                        break;
                    }
                    thread::sleep(retry_delay);
                }
               err @ Err(_) => return err
            }
        }

        operation(&self.conn)
    }
}
