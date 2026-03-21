use crate::native::db::connection::NxDbConnection;
use crate::native::tasks::details::SCHEMA as TASK_DETAILS_SCHEMA;
use crate::native::tasks::running_tasks_service::SCHEMA as RUNNING_TASKS_SCHEMA;
use crate::native::tasks::task_history::SCHEMA as TASK_HISTORY_SCHEMA;
use std::ffi::OsString;
use std::fs::remove_file;
use std::path::{Path, PathBuf};
use tracing::{debug, trace};

pub(super) fn initialize_db(nx_version: String, db_path: &Path) -> anyhow::Result<NxDbConnection> {
    trace!("Initializing turso database at {:?}", db_path);

    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| anyhow::anyhow!("Failed to create tokio runtime: {:?}", e))?;

    let db = rt
        .block_on(turso::Builder::new_local(&db_path.to_string_lossy()).build())
        .map_err(|e| anyhow::anyhow!("Failed to open database: {:?}", e))?;

    let conn = db
        .connect()
        .map_err(|e| anyhow::anyhow!("Failed to connect to database: {:?}", e))?;

    // Set busy timeout — retries internally with exponential backoff (1ms, 2ms, ... up to 100ms)
    // when another process holds the write lock
    conn.busy_timeout(std::time::Duration::from_secs(12))
        .map_err(|e| anyhow::anyhow!("Failed to set busy timeout: {:?}", e))?;

    let c = NxDbConnection::new(rt, db, conn);

    // Enable WAL mode for multi-process read/write access
    c.query_row("PRAGMA journal_mode = 'wal'", &[])?;
    c.execute("PRAGMA synchronous = NORMAL", &[])?;
    trace!("WAL journal mode enabled");

    // Check if the database already has the right version
    let db_version = c.query_row("SELECT value FROM metadata WHERE key='NX_VERSION'", &[]);

    match db_version {
        Ok(Some(row)) => {
            let version = row.get_str(0)?;
            if version == nx_version {
                trace!("Database is compatible with Nx {}", nx_version);
                Ok(c)
            } else {
                trace!(
                    "Incompatible version {} (need {}), recreating",
                    version, nx_version
                );
                c.close()?;
                remove_database_files(db_path)?;
                initialize_db(nx_version, db_path)
            }
        }
        // No metadata table — fresh database, create schema
        Err(s) if s.to_string().contains("metadata") => {
            trace!("Creating metadata and schema tables");
            create_metadata_table(&c, &nx_version)?;
            create_all_tables(&c)?;
            Ok(c)
        }
        Ok(None) => {
            // Metadata table exists but no NX_VERSION row — recreate
            trace!("Missing NX_VERSION in metadata, recreating");
            c.close()?;
            remove_file(db_path)?;
            initialize_db(nx_version, db_path)
        }
        Err(e) => {
            trace!("Database error: {:?}, recreating", e);
            c.close()?;
            remove_database_files(db_path)?;
            initialize_db(nx_version, db_path)
        }
    }
}

fn create_metadata_table(c: &NxDbConnection, nx_version: &str) -> anyhow::Result<()> {
    debug!("Creating metadata table");
    c.begin_transaction()?;
    c.execute(
        "CREATE TABLE metadata (
            key TEXT NOT NULL PRIMARY KEY,
            value TEXT NOT NULL
        )",
        &[],
    )?;
    trace!("Recording Nx Version: {}", nx_version);
    c.execute(
        "INSERT INTO metadata (key, value) VALUES ('NX_VERSION', ?1)",
        &[nx_version.into()],
    )?;
    c.commit_transaction()?;
    Ok(())
}

fn create_all_tables(c: &NxDbConnection) -> anyhow::Result<()> {
    debug!("Creating all database tables");
    c.begin_transaction()?;
    // Order matters: tables with no FK dependencies first
    c.execute_batch(TASK_DETAILS_SCHEMA)?;
    c.execute_batch(RUNNING_TASKS_SCHEMA)?;
    // Tables with FK dependencies
    c.execute_batch(TASK_HISTORY_SCHEMA)?;
    c.commit_transaction()?;
    Ok(())
}

/// Remove the database file and all associated files (WAL, SHM, MVCC logs).
fn remove_database_files(db_path: &Path) -> anyhow::Result<()> {
    let _ = remove_file(db_path);
    // Clean up all auxiliary files by globbing for files with same prefix
    let db_name = db_path.as_os_str().to_os_string();
    if let Some(parent) = db_path.parent() {
        if let Ok(entries) = std::fs::read_dir(parent) {
            for entry in entries.flatten() {
                let name = entry.path().as_os_str().to_os_string();
                if name.len() > db_name.len()
                    && name
                        .to_string_lossy()
                        .starts_with(&db_name.to_string_lossy().as_ref())
                {
                    trace!("Removing auxiliary file: {:?}", entry.path());
                    let _ = remove_file(entry.path());
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initialize_db_creates_new_db() -> anyhow::Result<()> {
        let temp_dir = tempfile::tempdir()?;
        let db_path = temp_dir.path().join("test.db");

        let conn = initialize_db("1.0.0".to_string(), &db_path)?;

        let row = conn
            .query_row("SELECT value FROM metadata WHERE key='NX_VERSION'", &[])?
            .expect("should have NX_VERSION row");
        assert_eq!(row.get_str(0)?, "1.0.0");
        Ok(())
    }

    #[test]
    fn initialize_db_reuses_compatible_db() -> anyhow::Result<()> {
        let temp_dir = tempfile::tempdir()?;
        let db_path = temp_dir.path().join("test.db");

        let _ = initialize_db("1.0.0".to_string(), &db_path)?;
        let conn = initialize_db("1.0.0".to_string(), &db_path)?;

        let row = conn
            .query_row("SELECT value FROM metadata WHERE key='NX_VERSION'", &[])?
            .expect("should have NX_VERSION row");
        assert_eq!(row.get_str(0)?, "1.0.0");
        Ok(())
    }

    #[test]
    fn initialize_db_concurrent_connections() -> anyhow::Result<()> {
        let temp_dir = tempfile::tempdir()?;
        let db_path = temp_dir.path().join("test.db");

        // Open first connection
        let conn1 = initialize_db("1.0.0".to_string(), &db_path)?;

        // Open second connection to the same DB — this used to fail with
        // "Locking error: Failed locking file. File is locked by another process"
        let conn2 = initialize_db("1.0.0".to_string(), &db_path)?;

        // Both connections should be able to read
        let row1 = conn1
            .query_row("SELECT value FROM metadata WHERE key='NX_VERSION'", &[])?
            .expect("conn1 should read NX_VERSION");
        let row2 = conn2
            .query_row("SELECT value FROM metadata WHERE key='NX_VERSION'", &[])?
            .expect("conn2 should read NX_VERSION");

        assert_eq!(row1.get_str(0)?, "1.0.0");
        assert_eq!(row2.get_str(0)?, "1.0.0");

        // Both connections should be able to write
        conn1.execute(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES ('test1', 'from_conn1')",
            &[],
        )?;
        conn2.execute(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES ('test2', 'from_conn2')",
            &[],
        )?;

        // Verify writes are visible
        let r = conn1
            .query_row("SELECT value FROM metadata WHERE key='test2'", &[])?
            .expect("conn1 should see conn2's write");
        assert_eq!(r.get_str(0)?, "from_conn2");

        Ok(())
    }

    #[test]
    fn initialize_db_recreates_incompatible_db() -> anyhow::Result<()> {
        let temp_dir = tempfile::tempdir()?;
        let db_path = temp_dir.path().join("test.db");

        let _ = initialize_db("1.0.0".to_string(), &db_path)?;
        let conn = initialize_db("2.0.0".to_string(), &db_path)?;

        let row = conn
            .query_row("SELECT value FROM metadata WHERE key='NX_VERSION'", &[])?
            .expect("should have NX_VERSION row");
        assert_eq!(row.get_str(0)?, "2.0.0");
        Ok(())
    }
}
