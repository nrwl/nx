use anyhow::Result;

use rusqlite::{Connection, DatabaseName, Error, OptionalExtension, Params, Row, Statement, ToSql};
use std::thread;
use std::time::Duration;
use tracing::trace;

#[derive(Default)]
pub struct NxDbConnection {
    pub conn: Option<Connection>,
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

impl NxDbConnection {
    pub fn new(connection: Connection) -> Self {
        Self {
            conn: Some(connection),
        }
    }

    pub fn execute<P: Params + Clone>(&self, sql: &str, params: P) -> Result<usize> {
        if let Some(conn) = &self.conn {
            retry_db_operation_when_busy!(conn.execute(sql, params.clone()))
                .map_err(|e| anyhow::anyhow!("DB execute error: \"{}\", {:?}", sql, e))
        } else {
            anyhow::bail!("No database connection available")
        }
    }

    pub fn execute_batch(&self, sql: &str) -> Result<()> {
        if let Some(conn) = &self.conn {
            retry_db_operation_when_busy!(conn.execute_batch(sql))
                .map_err(|e| anyhow::anyhow!("DB execute batch error: \"{}\", {:?}", sql, e))
        } else {
            anyhow::bail!("No database connection available")
        }
    }

    pub fn prepare(&self, sql: &str) -> Result<Statement> {
        if let Some(conn) = &self.conn {
            retry_db_operation_when_busy!(conn.prepare(sql))
                .map_err(|e| anyhow::anyhow!("DB prepare error: \"{}\", {:?}", sql, e))
        } else {
            anyhow::bail!("No database connection available")
        }
    }

    pub fn transaction<T>(
        &mut self,
        transaction_operation: impl Fn(&Connection) -> rusqlite::Result<T>,
    ) -> Result<T> {
        if let Some(conn) = self.conn.as_mut() {
            let transaction = retry_db_operation_when_busy!(conn.transaction())
                .map_err(|e| anyhow::anyhow!("DB transaction error: {:?}", e))?;

            let result = transaction_operation(&transaction)
                .map_err(|e| anyhow::anyhow!("DB transaction operation error: {:?}", e))?;

            transaction
                .commit()
                .map_err(|e| anyhow::anyhow!("DB transaction commit error: {:?}", e))?;

            Ok(result)
        } else {
            anyhow::bail!("No database connection available")
        }
    }

    pub fn query_row<T, P, F>(&self, sql: &str, params: P, f: F) -> Result<Option<T>>
    where
        P: Params + Clone,
        F: FnOnce(&Row<'_>) -> rusqlite::Result<T> + Clone,
    {
        if let Some(conn) = &self.conn {
            retry_db_operation_when_busy!(conn.query_row(sql, params.clone(), f.clone()).optional())
                .map_err(|e| anyhow::anyhow!("DB query error: \"{}\", {:?}", sql, e))
        } else {
            anyhow::bail!("No database connection available")
        }
    }

    pub fn close(self) -> Result<()> {
        trace!("Closing database connection");
        if let Some(conn) = self.conn {
            conn.close()
                .map_err(|(_, err)| anyhow::anyhow!("Unable to close connection: {:?}", err))
        } else {
            anyhow::bail!("No database connection available")
        }
    }

    pub fn pragma_update<V>(
        &self,
        schema_name: Option<DatabaseName<'_>>,
        pragma_name: &str,
        pragma_value: V,
    ) -> Result<()>
    where
        V: ToSql + Clone,
    {
        if let Some(conn) = &self.conn {
            retry_db_operation_when_busy!(conn.pragma_update(
                schema_name,
                pragma_name,
                pragma_value.clone()
            ))
            .map_err(|e| anyhow::anyhow!("DB pragma update error: {:?}", e))
        } else {
            anyhow::bail!("No database connection available")
        }
    }

    pub fn busy_handler(&self, callback: Option<fn(i32) -> bool>) -> Result<()> {
        if let Some(conn) = &self.conn {
            retry_db_operation_when_busy!(conn.busy_handler(callback))
                .map_err(|e| anyhow::anyhow!("DB busy handler error: {:?}", e))
        } else {
            anyhow::bail!("No database connection available")
        }
    }
}
