use crate::native::db::connection::NxDbConnection;
use crate::native::tasks::details::SCHEMA as TASK_DETAILS_SCHEMA;
use crate::native::tasks::running_tasks_service::SCHEMA as RUNNING_TASKS_SCHEMA;
use crate::native::tasks::task_history::SCHEMA as TASK_HISTORY_SCHEMA;
use std::path::Path;
use tracing::{debug, trace};

/// Bump this ONLY when the database schema changes.
/// The value is appended to the DB filename (e.g. `nx-v2.db`), so a bump
/// means "open a different file" rather than "migrate in place".
pub const DB_VERSION: &str = "2";

pub(crate) fn initialize_db(db_path: &Path) -> anyhow::Result<NxDbConnection> {
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

    // Retries internally with exponential backoff when another process holds
    // the write lock; pairs with WAL mode for multi-process access.
    conn.busy_timeout(std::time::Duration::from_secs(12))
        .map_err(|e| anyhow::anyhow!("Failed to set busy timeout: {:?}", e))?;

    let c = NxDbConnection::new(rt, db, conn);

    c.query_row("PRAGMA journal_mode = 'wal'", &[])?;
    c.execute("PRAGMA synchronous = NORMAL", &[])?;
    trace!("WAL journal mode enabled");

    create_all_tables(&c)?;
    Ok(c)
}

fn create_all_tables(c: &NxDbConnection) -> anyhow::Result<()> {
    debug!("Creating all database tables");
    c.begin_transaction()?;
    // Order matters: tables with no FK dependencies first
    c.execute_batch(TASK_DETAILS_SCHEMA)?;
    c.execute_batch(RUNNING_TASKS_SCHEMA)?;
    c.execute_batch("CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT)")?;
    // Tables with FK dependencies
    c.execute_batch(TASK_HISTORY_SCHEMA)?;
    c.commit_transaction()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn has_table(conn: &NxDbConnection, table_name: &str) -> bool {
        conn.query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1",
            &[table_name.into()],
        )
        .unwrap()
        .is_some()
    }

    #[test]
    fn initialize_db_creates_new_db() -> anyhow::Result<()> {
        let temp_dir = tempfile::tempdir()?;
        let db_path = temp_dir.path().join("test.db");

        let conn = initialize_db(&db_path)?;

        assert!(has_table(&conn, "task_details"));
        assert!(has_table(&conn, "metadata"));
        Ok(())
    }

    #[test]
    fn initialize_db_reuses_existing_db() -> anyhow::Result<()> {
        let temp_dir = tempfile::tempdir()?;
        let db_path = temp_dir.path().join("test.db");

        let _ = initialize_db(&db_path)?;
        let conn = initialize_db(&db_path)?;

        assert!(has_table(&conn, "task_details"));
        Ok(())
    }

    #[test]
    fn initialize_db_concurrent_connections() -> anyhow::Result<()> {
        let temp_dir = tempfile::tempdir()?;
        let db_path = temp_dir.path().join("test.db");

        // Both connections must succeed — used to fail with
        // "Locking error: Failed locking file. File is locked by another process"
        let conn1 = initialize_db(&db_path)?;
        let conn2 = initialize_db(&db_path)?;

        conn1.execute(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES ('test1', 'from_conn1')",
            &[],
        )?;
        conn2.execute(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES ('test2', 'from_conn2')",
            &[],
        )?;

        let r = conn1
            .query_row("SELECT value FROM metadata WHERE key='test2'", &[])?
            .expect("conn1 should see conn2's write");
        assert_eq!(r.get_str(0)?, "from_conn2");

        Ok(())
    }
}
