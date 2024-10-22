use std::fs::{remove_file, File};
use std::path::{Path, PathBuf};
use tracing::{debug, trace};
use rusqlite::{Connection, OpenFlags};
use fs4::fs_std::FileExt;
use crate::native::db::connection::NxDbConnection;

pub(super) struct LockFile {
    file: File,
    path: PathBuf,
}

pub(super) fn unlock_file(lock_file: &LockFile) {
    if lock_file.path.exists() {
        lock_file
            .file
            .unlock()
            .and_then(|_| remove_file(&lock_file.path))
            .ok();
    }
}

pub(super) fn create_lock_file(db_path: &Path) -> anyhow::Result<LockFile> {
    let lock_file_path = db_path.with_extension("lock");
    let lock_file = File::create(&lock_file_path)
        .map_err(|e| anyhow::anyhow!("Unable to create db lock file: {:?}", e))?;

    trace!("Getting lock on db lock file");
    lock_file
        .lock_exclusive()
        .inspect(|_| trace!("Got lock on db lock file"))
        .map_err(|e| anyhow::anyhow!("Unable to lock the db lock file: {:?}", e))?;
    Ok(LockFile {
        file: lock_file,
        path: lock_file_path,
    })
}

pub(super) fn initialize_db(nx_version: String, db_path: &PathBuf) -> anyhow::Result<NxDbConnection> {
    let c = create_connection(db_path)?;

    trace!(
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
        Ok(Some(version)) if version == nx_version => {
            trace!("Database is compatible with Nx {}", nx_version);
            c
        }
        // If there is no version, it means that this database is new
        Ok(None) => {
            trace!("Recording Nx Version: {}", nx_version);
            c.execute(
                "INSERT OR REPLACE INTO metadata (key, value) VALUES ('NX_VERSION', ?)",
                [nx_version],
            )?;
            c
        }
        _ => {
            trace!("Disconnecting from existing incompatible database");
            c.close().map_err(|(_, error)| anyhow::Error::from(error))?;
            trace!("Removing existing incompatible database");
            remove_file(db_path)?;

            trace!("Creating a new connection to a new database");
            create_connection(db_path)?
        }
    };

    Ok(c)
}

fn create_connection(db_path: &PathBuf) -> anyhow::Result<NxDbConnection> {
    match open_database_connection(db_path) {
        Ok(connection) => {
            configure_database(&connection)?;
            create_metadata_table(&connection)?;
            Ok(connection)
        }
        err @ Err(_) => err,
    }
}

fn create_metadata_table(c: &NxDbConnection) -> anyhow::Result<()> {
    debug!("Creating table for metadata if it does not exist");
    c.execute(
        "CREATE TABLE IF NOT EXISTS metadata (
            key TEXT NOT NULL PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;
    Ok(())
}

fn open_database_connection(db_path: &PathBuf) -> anyhow::Result<NxDbConnection> {
    let conn = if cfg!(target_family = "unix") && ci_info::is_ci() {
        trace!("Opening connection with unix-dotfile");
        Connection::open_with_flags_and_vfs(
            db_path,
            OpenFlags::SQLITE_OPEN_READ_WRITE
                | OpenFlags::SQLITE_OPEN_CREATE
                | OpenFlags::SQLITE_OPEN_URI
                | OpenFlags::SQLITE_OPEN_NO_MUTEX,
            "unix-dotfile",
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
