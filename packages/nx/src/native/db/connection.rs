use anyhow::Result;

use rusqlite::{Connection, DatabaseName, Error, OptionalExtension, Params, Row, Statement, ToSql};
use std::thread;
use std::time::Duration;
use tracing::trace;

pub struct NxDbConnection {
    pub conn: Connection,
}

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
            for i in 0..MAX_RETRIES {
                match $operation {
                    r @ Ok(_) => break 'retry r,
                    Err(Error::SqliteFailure(err, _))
                        if err.code == rusqlite::ErrorCode::DatabaseBusy =>
                    {
                        trace!("Database busy. Retrying{}", ".".repeat(i as usize));
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

impl NxDbConnection {
    pub fn new(connection: Connection) -> Self {
        Self { conn: connection }
    }

    pub fn execute<P: Params + Clone>(&self, sql: &str, params: P) -> Result<usize> {
        retry_db_operation_when_busy!(self.conn.execute(sql, params.clone()))
            .map_err(|e| anyhow::anyhow!("DB execute error: \"{}\", {:?}", sql, e))
    }

    pub fn execute_batch(&self, sql: &str) -> Result<()> {
        retry_db_operation_when_busy!(self.conn.execute_batch(sql))
            .map_err(|e| anyhow::anyhow!("DB execute batch error: \"{}\", {:?}", sql, e))
    }

    pub fn prepare(&self, sql: &str) -> Result<Statement> {
        retry_db_operation_when_busy!(self.conn.prepare(sql))
            .map_err(|e| anyhow::anyhow!("DB prepare error: \"{}\", {:?}", sql, e))
    }

    pub fn transaction<T>(
        &mut self,
        transaction_operation: impl Fn(&Connection) -> rusqlite::Result<T>,
    ) -> Result<T> {
        let transaction = retry_db_operation_when_busy!(self.conn.transaction())
            .map_err(|e| anyhow::anyhow!("DB transaction error: {:?}", e))?;

        let result = transaction_operation(&transaction)
            .map_err(|e| anyhow::anyhow!("DB transaction operation error: {:?}", e))?;

        transaction
            .commit()
            .map_err(|e| anyhow::anyhow!("DB transaction commit error: {:?}", e))?;

        Ok(result)
    }

    pub fn query_row<T, P, F>(&self, sql: &str, params: P, f: F) -> Result<Option<T>>
    where
        P: Params + Clone,
        F: FnOnce(&Row<'_>) -> rusqlite::Result<T> + Clone,
    {
        retry_db_operation_when_busy!(self
            .conn
            .query_row(sql, params.clone(), f.clone())
            .optional())
        .map_err(|e| anyhow::anyhow!("DB query error: \"{}\", {:?}", sql, e))
    }

    pub fn close(self) -> rusqlite::Result<(), (Connection, Error)> {
        self.conn
            .close()
            .inspect_err(|e| trace!("Error in close: {:?}", e))
    }

    pub fn pragma_update<V>(
        &self,
        schema_name: Option<DatabaseName<'_>>,
        pragma_name: &str,
        pragma_value: V,
    ) -> rusqlite::Result<()>
    where
        V: ToSql + Clone,
    {
        retry_db_operation_when_busy!(self.conn.pragma_update(
            schema_name,
            pragma_name,
            pragma_value.clone()
        ))
    }

    pub fn busy_handler(&self, callback: Option<fn(i32) -> bool>) -> Result<()> {
        retry_db_operation_when_busy!(self.conn.busy_handler(callback))
            .map_err(|e| anyhow::anyhow!("DB busy handler error: {:?}", e))
    }
}
