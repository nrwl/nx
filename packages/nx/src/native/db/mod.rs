pub mod connection;
mod initialize;

use crate::native::logger::enable_logger;
use crate::native::machine_id::get_machine_id;
use crate::native::{db::connection::NxDbConnection, hasher::hash};
use napi::bindgen_prelude::External;
use std::fs::create_dir_all;
use std::path::PathBuf;
use std::{mem, process};
use tracing::{trace, trace_span};

#[napi]
pub fn connect_to_nx_db(
    cache_dir: String,
    nx_version: String,
    db_name: Option<String>,
) -> anyhow::Result<External<NxDbConnection>> {
    enable_logger();
    let cache_dir_buf = PathBuf::from(cache_dir);
    let mut db_file_name = db_name.unwrap_or_else(get_machine_id);

    if db_file_name.is_empty() {
        trace!("Invalid db file name, using fallback name");
        db_file_name = hash(b"machine");
    }

    let db_path = cache_dir_buf.join(format!("{}.db", db_file_name));
    create_dir_all(cache_dir_buf)?;

    trace_span!("process", id = process::id()).in_scope(|| {
        trace!("Creating connection to {:?}", db_path);
        let lock_file = initialize::create_lock_file(&db_path)?;

        let c = initialize::initialize_db(nx_version, &db_path)
            .inspect_err(|_| initialize::unlock_file(&lock_file))?;

        initialize::unlock_file(&lock_file);

        Ok(External::new(c))
    })
}

#[napi]
pub fn close_db_connection(mut connection: External<NxDbConnection>) -> anyhow::Result<()> {
    let conn = mem::take(connection.as_mut());
    conn.close()
}
