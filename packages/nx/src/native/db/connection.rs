use rusqlite::{Connection, Error, Params, Result, Row, Statement};
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
            .inspect_err(|e| trace!("Error in execute: {:?}", e))
    }

    pub fn execute_batch(&self, sql: &str) -> Result<()> {
        self.retry_on_busy(|conn| conn.execute_batch(sql))
            .inspect_err(|e| trace!("Error in execute_batch: {:?}", e))
    }

    pub fn prepare(&self, sql: &str) -> Result<Statement<'_>> {
        self.conn.prepare(sql)
            .inspect_err(|e| trace!("Error in prepare: {:?}", e))
    }

    pub fn query_row<T, P, F>(&self, sql: &str, params: P, f: F) -> Result<T>
    where
        P: Params,
        F: FnOnce(&Row<'_>) -> Result<T>,
    {
        self.conn.query_row(sql, params, f)
            .inspect_err(|e| trace!("Error in query_row: {:?}", e))
    }

    pub fn close(self) -> Result<(), (Connection, Error)> {
        self.conn.close()
            .inspect_err(|e| trace!("Error in close: {:?}", e))
    }

    fn retry_on_busy<F, T>(&self,  operation: F) -> Result<T>
    where
        F: Fn(&Connection) -> Result<T>,
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
