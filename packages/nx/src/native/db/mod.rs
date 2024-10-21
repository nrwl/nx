pub mod connection;

use rusqlite::OpenFlags;
use std::fs::{create_dir_all, remove_file, File};
use std::path::{Path, PathBuf};
use fs4::fs_std::FileExt;
use crate::native::db::connection::NxDbConnection;
use crate::native::machine_id::get_machine_id;
use napi::bindgen_prelude::External;
use rusqlite::Connection;
use tracing::{debug, trace};

#[napi]
pub fn connect_to_nx_db(
    cache_dir: String,
    nx_version: String,
    db_name: Option<String>,
) -> anyhow::Result<External<NxDbConnection>> {
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

fn create_connection(db_path: &PathBuf) -> anyhow::Result<NxDbConnection> {
    debug!("Creating connection to {:?}", db_path);
    let lock_file = create_lock_file(db_path)?;

    match open_database_connection(db_path) {
        Ok(connection) => {
            configure_database(&connection).inspect_err(|_| {
                unlock_file(lock_file);
            })?;
            Ok(connection)
        }
        err @ Err(_) => {
            unlock_file(lock_file);
            err
        }
    }
}

fn create_lock_file(db_path: &Path) -> anyhow::Result<File> {
    let lock_file_path = db_path.with_extension("lock");
    let lock_file = File::create(&lock_file_path)
        .map_err(|e| anyhow::anyhow!("Unable to create db lock file: {:?}", e))?;

    lock_file
        .lock_exclusive()
        .map_err(|e| anyhow::anyhow!("Unable to lock the db lock file: {:?}", e))?;
    Ok(lock_file)
}

fn open_database_connection(db_path: &PathBuf) -> anyhow::Result<NxDbConnection> {
    let conn = if cfg!(target_family = "unix") && ci_info::is_ci() {
        trace!("Opening connection with unix-dotfile"); 
        Connection::open_with_flags_and_vfs(
            db_path,
            OpenFlags::SQLITE_OPEN_READ_WRITE
                | OpenFlags::SQLITE_OPEN_CREATE
                | OpenFlags::SQLITE_OPEN_URI
                | OpenFlags::SQLITE_OPEN_FULL_MUTEX,
            "unix-dotfile"
        )
    } else {
        Connection::open_with_flags(
            db_path,
            OpenFlags::SQLITE_OPEN_READ_WRITE
                | OpenFlags::SQLITE_OPEN_CREATE
                | OpenFlags::SQLITE_OPEN_URI
                | OpenFlags::SQLITE_OPEN_FULL_MUTEX,
        )
    };

    conn.map_err(|e| anyhow::anyhow!("Error creating connection {:?}", e))
    .map(NxDbConnection::new)
}

fn configure_database(connection: &NxDbConnection) -> anyhow::Result<()> {
    connection
        .conn
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| anyhow::anyhow!("Unable to set journal_mode: {:?}", e))?;
    connection
        .conn
        .pragma_update(None, "synchronous", "NORMAL")
        .map_err(|e| anyhow::anyhow!("Unable to set synchronous: {:?}", e))?;
    connection
        .conn
        .busy_handler(Some(|tries| tries < 6))
        .map_err(|e| anyhow::anyhow!("Unable to set busy handler: {:?}", e))?;
    Ok(())
}

fn unlock_file(lock_file: File) {
    lock_file.unlock().expect("Failed to unlock the database");
}
