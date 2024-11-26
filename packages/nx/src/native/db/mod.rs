use rusqlite::OpenFlags;
use std::fs::{create_dir_all, remove_file};
use std::path::PathBuf;

use crate::native::machine_id::get_machine_id;
use napi::bindgen_prelude::External;
use rusqlite::Connection;
use tracing::debug;

#[napi]
pub fn connect_to_nx_db(
    cache_dir: String,
    nx_version: String,
    db_name: Option<String>,
) -> anyhow::Result<External<Connection>> {
    let cache_dir_buf = PathBuf::from(cache_dir);
    let db_path = cache_dir_buf.join(format!("{}.db", db_name.unwrap_or_else(get_machine_id)));
    create_dir_all(cache_dir_buf)?;

    let c = create_connection(&db_path)?;

    debug!(
        "Checking if current existing database is compatible with Nx {}",
        nx_version
    );
    let db_version = c.query_row(
        "SELECT value FROM metadata WHERE key='NX_VERSION'",
        [],
        |row| {
            let r: String = row.get(0)?;
            Ok(r)
        },
    );

    let c = match db_version {
        Ok(version) if version == nx_version => c,
        _ => {
            debug!("Disconnecting from existing incompatible database");
            c.close().map_err(|(_, error)| anyhow::Error::from(error))?;
            debug!("Removing existing incompatible database");
            remove_file(&db_path)?;

            debug!("Creating a new connection to a new database");
            create_connection(&db_path)?
        }
    };

    debug!("Creating table for metadata");
    c.execute(
        "CREATE TABLE IF NOT EXISTS metadata (
            key TEXT NOT NULL PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    debug!("Recording Nx Version: {}", nx_version);
    c.execute(
        "INSERT OR REPLACE INTO metadata (key, value) VALUES ('NX_VERSION', ?)",
        [nx_version],
    )?;

    Ok(External::new(c))
}

fn create_connection(db_path: &PathBuf) -> anyhow::Result<Connection> {
    debug!("Creating connection to {:?}", db_path);
    let c = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_URI
            | OpenFlags::SQLITE_OPEN_FULL_MUTEX,
    )
    .map_err(anyhow::Error::from)?;

    // This allows writes at the same time as reads
    c.pragma_update(None, "journal_mode", "WAL")?;

    // This makes things less synchronous than default
    c.pragma_update(None, "synchronous", "NORMAL")?;

    Ok(c)
}
