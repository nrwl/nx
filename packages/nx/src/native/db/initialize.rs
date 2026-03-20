use crate::native::db::connection::NxDbConnection;
use crate::native::tasks::details::SCHEMA as TASK_DETAILS_SCHEMA;
use crate::native::tasks::running_tasks_service::SCHEMA as RUNNING_TASKS_SCHEMA;
use crate::native::tasks::task_history::SCHEMA as TASK_HISTORY_SCHEMA;
use std::fs::remove_file;
use std::path::Path;
use tracing::{debug, trace};

pub(super) fn initialize_db(nx_version: String, db_path: &Path) -> anyhow::Result<NxDbConnection> {
    trace!("Initializing libsql database at {:?}", db_path);

    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| anyhow::anyhow!("Failed to create tokio runtime: {:?}", e))?;

    let db = rt
        .block_on(libsql::Builder::new_local(db_path).build())
        .map_err(|e| anyhow::anyhow!("Failed to open database: {:?}", e))?;

    let conn = db
        .connect()
        .map_err(|e| anyhow::anyhow!("Failed to connect to database: {:?}", e))?;

    let c = NxDbConnection::new(rt, db, conn);

    // Check if the database already has the right version
    let db_version = c.query_row(
        "SELECT value FROM metadata WHERE key='NX_VERSION'",
        &[],
    );

    match db_version {
        Ok(Some(row)) => {
            let version = row.get_str(0)?;
            if version == nx_version {
                trace!("Database is compatible with Nx {}", nx_version);
                Ok(c)
            } else {
                trace!("Incompatible version {} (need {}), recreating", version, nx_version);
                c.close()?;
                remove_file(db_path)?;
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
            let _ = remove_file(db_path);
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
