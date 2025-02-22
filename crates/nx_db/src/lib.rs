pub mod connection;
mod initialize;
pub mod napi;

use std::fs::create_dir_all;
use std::path::PathBuf;
use std::{mem, process};
use tracing::{trace, trace_span};

use connection::NxDbConnection;

/// Connect to the Nx database
pub fn open_db_connection(
    cache_dir: String,
    nx_version: String,
    db_name: Option<String>,
    machine_id: String,
) -> anyhow::Result<NxDbConnection> {
    let cache_dir_buf = PathBuf::from(cache_dir);
    let mut db_file_name = db_name.unwrap_or(machine_id);

    if db_file_name.is_empty() {
        trace!("Invalid db file name, using fallback name");
        db_file_name = "machine".to_string();
    }

    let db_path = cache_dir_buf.join(format!("{}.db", db_file_name));
    create_dir_all(cache_dir_buf)?;

    trace_span!("process", id = process::id()).in_scope(|| {
        trace!("Creating connection to {:?}", db_path);
        let lock_file = initialize::create_lock_file(&db_path)?;

        let c = initialize::initialize_db(nx_version, &db_path)
            .inspect_err(|_| initialize::unlock_file(&lock_file))?;

        initialize::unlock_file(&lock_file);

        Ok(c)
    })
}

/// Close the database connection
pub fn close_db_connection(mut connection: NxDbConnection) -> anyhow::Result<()> {
    let conn = mem::take(&mut connection);
    conn.close()
}
