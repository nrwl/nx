use crate::native::db::connection::NxDbConnection;
use crate::native::tasks::details::SCHEMA as TASK_DETAILS_SCHEMA;
use crate::native::tasks::running_tasks_service::SCHEMA as RUNNING_TASKS_SCHEMA;
use crate::native::tasks::task_history::SCHEMA as TASK_HISTORY_SCHEMA;
use rusqlite::vtab::array;
use rusqlite::{Connection, OpenFlags};
use std::fs::{File, remove_file, write};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use tracing::{debug, trace};

// Error reporting constants - static strings to avoid allocations in error paths
const REPORTING_INSTRUCTIONS_PERSISTENT: &str = "If the issue persists, please help us improve Nx by capturing logs and reporting this issue:\n\
      1. Run: NX_NATIVE_FILE_LOGGING=nx::native::db=trace nx <your-command>\n\
      2. Create an issue at https://github.com/nrwl/nx/issues/new/choose and include the .nx/workspace-data/nx.log file";

const REPORTING_INSTRUCTIONS_IMMEDIATE: &str = "Please help us improve Nx by capturing logs and reporting this issue:\n\
      1. Run: NX_NATIVE_FILE_LOGGING=nx::native::db=trace nx <your-command>\n\
      2. Create an issue at https://github.com/nrwl/nx/issues/new/choose and include the .nx/workspace-data/nx.log file";

/// Returns reporting instructions for error messages.
///
/// # Parameters
/// * `is_known_error` - When `true`, returns instructions with "If the issue persists" prefix
///   for errors with user-actionable guidance. When `false`, returns immediate reporting
///   instructions for unexpected errors.
fn reporting_instructions(is_known_error: bool) -> &'static str {
    if is_known_error {
        REPORTING_INSTRUCTIONS_PERSISTENT
    } else {
        REPORTING_INSTRUCTIONS_IMMEDIATE
    }
}

/// Returns appropriate reset instruction based on whether error has user-actionable guidance.
///
/// # Parameters
/// * `is_known_error` - When `true`, returns "Then try" for errors with guidance already provided.
///   When `false`, returns more explicit instruction for unexpected errors.
fn reset_instruction(is_known_error: bool) -> &'static str {
    if is_known_error {
        "Then try: nx reset"
    } else {
        "To try to fix this, run: nx reset"
    }
}

/// Creates a user-friendly error message for filesystem IO errors with specific guidance based on error type
fn create_io_error(operation: &str, path: &Path, error: std::io::Error) -> anyhow::Error {
    let specific_guidance = match error.kind() {
        ErrorKind::PermissionDenied => {
            format!(
                "Try:\n\
                - Verify you have read and write permissions for: {}\n\
                - Check that you own the file/directory or your user has access\n\
                - Ensure the filesystem is not mounted read-only\n\
                - If using Docker, ensure volume has correct permissions\n\
                - If running in a restricted environment, you may need administrator privileges",
                path.display()
            )
        }
        ErrorKind::StorageFull => "Try:\n\
            - Free up disk space on the drive containing the workspace\n\
            - Move the workspace to a drive with more available space\n\
            - Check for large files that can be removed"
            .to_string(),
        ErrorKind::AlreadyExists => {
            "This may indicate a previous Nx process did not clean up properly.\n\
            \n\
            Try:\n\
            - Ensure no other Nx processes are running\n\
            - Run nx reset to clean up stale files"
                .to_string()
        }
        _ => {
            return anyhow::anyhow!(
                "An unexpected error occurred while initializing the workspace data:\n\
                \n\
                {}\n\
                \n\
                {}\n\
                \n\
                {}",
                error,
                reporting_instructions(false),
                reset_instruction(false)
            );
        }
    };

    anyhow::anyhow!(
        "Unable to initialize workspace data while attempting to {}:\n\
        \n\
        {}\n\
        \n\
        {}\n\
        \n\
        {}\n\
        \n\
        {}",
        operation,
        error,
        specific_guidance,
        reporting_instructions(true),
        reset_instruction(true)
    )
}

/// Creates a user-friendly error message for database errors
fn create_db_error(operation: &str, error: anyhow::Error) -> anyhow::Error {
    anyhow::anyhow!(
        "An unexpected error occurred while attempting to {}:\n\
        \n\
        {}\n\
        \n\
        {}\n\
        \n\
        {}",
        operation,
        error,
        reporting_instructions(false),
        reset_instruction(false)
    )
}

pub(super) struct LockFile {
    file: File,
    path: PathBuf,
}

pub(super) fn unlock_file(lock_file: &LockFile) {
    if lock_file.path.exists() {
        fs4::fs_std::FileExt::unlock(&lock_file.file)
            .and_then(|_| remove_file(&lock_file.path))
            .ok();
    }
}

pub(super) fn create_lock_file(db_path: &Path) -> anyhow::Result<LockFile> {
    let lock_file_path = db_path.with_extension("lock");
    trace!("Creating lock file at {:?}", lock_file_path);
    let lock_file = File::create(&lock_file_path)
        .map_err(|e| create_io_error("create lock file", &lock_file_path, e))?;

    trace!("Getting lock on db lock file");
    fs4::fs_std::FileExt::lock_exclusive(&lock_file)
        .inspect(|_| trace!("Got lock on db lock file"))
        .map_err(|e| create_io_error("acquire exclusive lock", &lock_file_path, e))?;
    Ok(LockFile {
        file: lock_file,
        path: lock_file_path,
    })
}

pub(super) fn initialize_db(nx_version: String, db_path: &Path) -> anyhow::Result<NxDbConnection> {
    // Track if DB existed before we opened it for safety check on new DB creation
    let db_existed_before_open = db_path.exists();
    let mut database_recreated = false;

    loop {
        match open_database_connection(db_path) {
            Ok(mut c) => {
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
                    // No metadata table found - database needs initialization
                    // (either newly created or missing metadata from previous incomplete setup)
                    Err(s) if s.to_string().contains("metadata") => {
                        // Check if DB file existed before we opened it. If it did, it may be open
                        // by another process (e.g., daemon) and it's not safe to configure it.
                        if db_existed_before_open {
                            c.close()?;
                            return Err(anyhow::anyhow!(
                                "Database file exists but has no metadata table.\n\
                                This may indicate database corruption or incomplete initialization from a previous crash.\n\
                                \n\
                                To fix this issue:\n\
                                1. Run: nx reset\n\
                                2. Try your command again\n\
                                \n\
                                {}\n\
                                \n\
                                {}",
                                reporting_instructions(true),
                                reset_instruction(true)
                            ));
                        }

                        // Safe: DB didn't exist before, we just created it, no other process has it open
                        match configure_database(&c, db_path, database_recreated) {
                            Ok(_) => {
                                create_metadata_table(&mut c, &nx_version)?;
                                create_all_tables(&mut c)?;
                                c
                            }
                            Err(config_error) if !database_recreated => {
                                trace!("Failed to configure new database: {:?}", config_error);
                                c.close()?;
                                trace!("Removing new database files and retrying with fallback");
                                remove_all_database_files(db_path)?;
                                database_recreated = true;
                                continue;
                            }
                            Err(config_error) => return Err(config_error),
                        }
                    }
                    reason => {
                        trace!("Incompatible database because: {:?}", reason);
                        trace!("Disconnecting from existing incompatible database");
                        c.close()?;
                        trace!("Removing existing incompatible database");
                        remove_file(db_path)?;

                        trace!("Initializing a new database");
                        return initialize_db(nx_version, db_path);
                    }
                };

                return Ok(c);
            }
            Err(reason) => {
                trace!(
                    "Unable to connect to existing database because: {:?}",
                    reason
                );
                trace!("Removing existing incompatible database");
                remove_file(db_path)?;

                trace!("Initializing a new database");
                return initialize_db(nx_version, db_path);
            }
        }
    }
}

fn create_metadata_table(c: &mut NxDbConnection, nx_version: &str) -> anyhow::Result<()> {
    debug!("Creating table for metadata");
    c.transaction(|conn| {
        conn.execute(
            "CREATE TABLE metadata (
                key TEXT NOT NULL PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;
        trace!("Recording Nx Version: {}", nx_version);
        conn.execute(
            "INSERT INTO metadata (key, value) VALUES ('NX_VERSION', ?)",
            [nx_version],
        )?;
        Ok(())
    })?;

    Ok(())
}

fn create_all_tables(c: &mut NxDbConnection) -> anyhow::Result<()> {
    debug!("Creating all database tables");

    c.transaction(|conn| {
        // Order matters: tables with no FK dependencies first
        conn.execute_batch(TASK_DETAILS_SCHEMA)?;
        conn.execute_batch(RUNNING_TASKS_SCHEMA)?;

        // Tables with FK dependencies
        conn.execute_batch(TASK_HISTORY_SCHEMA)?;
        // TODO: cache_outputs table is created by NxCache with conditional FK constraint

        Ok(())
    })?;

    Ok(())
}

fn open_database_connection(db_path: &Path) -> anyhow::Result<NxDbConnection> {
    trace!("Opening database connection to {:?}", db_path);
    let conn = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_URI
            | OpenFlags::SQLITE_OPEN_FULL_MUTEX,
    )
    .map_err(|e| create_db_error("open database", e.into()))?;

    // Load array module for rarray() functionality - needed per connection
    trace!("Loading SQLite array module");
    array::load_module(&conn)
        .map_err(|e| create_db_error("load SQLite array extension", e.into()))?;

    Ok(NxDbConnection::new(conn))
}

fn configure_database(
    connection: &NxDbConnection,
    db_path: &Path,
    allow_wal_fallback: bool,
) -> anyhow::Result<()> {
    // Try to set journal mode with automatic fallback
    let journal_mode = set_journal_mode(connection, db_path, allow_wal_fallback)?;
    trace!("Database configured with {} journal mode", journal_mode);

    // Set other pragmas
    trace!("Configuring database pragmas");
    connection
        .pragma_update(None, "synchronous", "NORMAL")
        .map_err(|e| create_db_error("configure database synchronous mode", e.into()))?;

    connection
        .busy_handler(Some(|tries| tries <= 12))
        .map_err(|e| create_db_error("configure database busy handler", e.into()))?;

    Ok(())
}

fn set_journal_mode(
    connection: &NxDbConnection,
    db_path: &Path,
    allow_wal_fallback: bool,
) -> anyhow::Result<&'static str> {
    // Proactively skip WAL on known-incompatible environments
    if is_known_incompatible_environment() {
        debug!("Detected environment with known WAL incompatibilities");
        debug!("Using DELETE journal mode");
        connection
            .pragma_update(None, "journal_mode", "DELETE")
            .map_err(|e| {
                diagnose_filesystem_issue(
                    db_path,
                    e.into(),
                    "DELETE (required for this environment)",
                )
            })?;
        trace!("Successfully enabled DELETE journal mode");
        return Ok("DELETE");
    }

    // Try WAL mode (best performance)
    match connection.pragma_update(None, "journal_mode", "WAL") {
        Ok(_) => {
            trace!("Successfully enabled WAL journal mode");
            return Ok("WAL");
        }
        Err(wal_error) => {
            trace!("WAL mode failed: {:?}", wal_error);

            // If fallback is not allowed yet, WAL failure might be due to stale auxiliary files
            // Return error to trigger cleanup and retry
            if !allow_wal_fallback {
                trace!("WAL failed before cleanup");
                trace!("Will clean up database files and retry");
                return Err(anyhow::anyhow!(
                    "WAL mode failed - cleanup needed: {}",
                    wal_error
                ));
            }

            // After cleanup, WAL still not supported - fall back to DELETE mode
            debug!("WAL not supported on this system after cleanup");
        }
    }

    // Fallback to DELETE mode (universal compatibility)
    connection
        .pragma_update(None, "journal_mode", "DELETE")
        .map_err(|e| {
            diagnose_filesystem_issue(db_path, e.into(), "DELETE (fallback after WAL failed)")
        })?;

    trace!("Successfully enabled DELETE journal mode");
    Ok("DELETE")
}

fn is_known_incompatible_environment() -> bool {
    #[cfg(target_os = "linux")]
    {
        if is_wsl1() {
            debug!("WSL1 detected - will use DELETE journal mode");
            return true;
        }
    }
    false
}

#[cfg(target_os = "linux")]
fn is_wsl1() -> bool {
    use std::sync::OnceLock;
    static IS_WSL1: OnceLock<bool> = OnceLock::new();

    *IS_WSL1.get_or_init(|| {
        // WSL1 has "Microsoft" in /proc/version but not "WSL2"
        std::fs::read_to_string("/proc/version")
            .map(|contents| contents.contains("Microsoft") && !contents.contains("WSL2"))
            .unwrap_or(false)
    })
}

/// Creates an auxiliary database file path by appending a suffix to the database path.
/// Uses OsString operations to avoid UTF-8 conversion and handle all valid paths correctly.
fn auxiliary_path(db_path: &Path, suffix: &str) -> PathBuf {
    let mut path = db_path.as_os_str().to_os_string();
    path.push(suffix);
    PathBuf::from(path)
}

fn remove_all_database_files(db_path: &Path) -> anyhow::Result<()> {
    // Build list of all database-related files to remove
    let files_to_remove = [
        (db_path.to_path_buf(), "database file"),
        (auxiliary_path(db_path, "-wal"), "WAL file"),
        (auxiliary_path(db_path, "-shm"), "shared memory file"),
    ];

    // Remove all files with consistent error handling
    for (path, description) in files_to_remove {
        if path.exists() {
            match remove_file(&path) {
                Ok(_) => trace!("Removed {}: {:?}", description, path),
                Err(e) => trace!("Warning: failed to remove {}: {}", description, e),
            }
        }
    }

    Ok(())
}

/// Diagnose specific filesystem issues when setting journal mode fails
fn diagnose_filesystem_issue(
    db_path: &Path,
    original_error: anyhow::Error,
    context: &str,
) -> anyhow::Error {
    // Try to get the parent directory from the database path
    if let Some(parent_dir) = db_path.parent() {
        // Check if directory is writable by attempting to create a test file
        let test_file = parent_dir.join(".nx-write-test");
        match write(&test_file, b"test") {
            Ok(_) => {
                // Successfully wrote, clean up test file
                remove_file(&test_file).ok();

                // Directory is writable, so the issue is something else
                return anyhow::anyhow!(
                    "Unable to configure workspace database:\n\
                    \n\
                    Failed to set {} journal mode.\n\
                    \n\
                    {}\n\
                    \n\
                    The directory at {} exists and is writable, but SQLite cannot set the journal mode.\n\
                    This typically indicates:\n\
                    - The filesystem doesn't support SQLite's locking requirements (e.g., NFS, network drive)\n\
                    - The filesystem lacks support for required features\n\
                    - There are conflicting locks from another process\n\
                    \n\
                    Try:\n\
                    - Move your workspace to a local filesystem\n\
                    - Check for other processes accessing the cache directory\n\
                    \n\
                    {}\n\
                    \n\
                    {}",
                    context,
                    original_error,
                    parent_dir.display(),
                    reporting_instructions(true),
                    reset_instruction(true)
                );
            }
            Err(write_error) => {
                // Directory exists but is not writable
                return anyhow::anyhow!(
                    "Unable to configure workspace database:\n\
                    \n\
                    Failed to set {} journal mode.\n\
                    \n\
                    {}\n\
                    \n\
                    The directory at {} exists but has restricted permissions.\n\
                    SQLite successfully created the database file but cannot configure it due to filesystem restrictions.\n\
                    \n\
                    Try:\n\
                    - Verify you have read and write permissions for the cache directory\n\
                    - Check that you own the directory or your user has access\n\
                    - Ensure the filesystem is not mounted read-only\n\
                    - If using Docker, ensure volume has correct permissions\n\
                    - If running in a restricted environment, you may need administrator privileges\n\
                    \n\
                    {}\n\
                    \n\
                    {}\n\
                    \n\
                    Write error: {}",
                    context,
                    original_error,
                    parent_dir.display(),
                    reporting_instructions(true),
                    reset_instruction(true),
                    write_error
                );
            }
        }
    }

    // Fallback if we can't get the parent directory path
    anyhow::anyhow!(
        "Unable to configure workspace database:\n\
        \n\
        Failed to set {} journal mode.\n\
        \n\
        {}\n\
        \n\
        {}\n\
        \n\
        {}",
        context,
        original_error,
        reporting_instructions(false),
        reset_instruction(false)
    )
}

#[cfg(test)]
mod tests {
    use crate::native::logger::enable_logger;

    use super::*;

    #[test]
    fn initialize_db_creates_new_db() -> anyhow::Result<()> {
        let temp_dir = tempfile::tempdir()?;
        let db_path = temp_dir.path().join("test.db");

        let _ = initialize_db("1.0.0".to_string(), &db_path)?;

        let conn = Connection::open(&db_path)?;
        let version: String = conn.query_row(
            "SELECT value FROM metadata WHERE key='NX_VERSION'",
            [],
            |row| row.get(0),
        )?;

        assert_eq!(version, "1.0.0");
        Ok(())
    }

    #[test]
    fn initialize_db_reuses_compatible_db() -> anyhow::Result<()> {
        let temp_dir = tempfile::tempdir()?;
        let db_path = temp_dir.path().join("test.db");

        // Create initial db
        let _ = initialize_db("1.0.0".to_string(), &db_path)?;

        // Try to initialize again with same version
        let _ = initialize_db("1.0.0".to_string(), &db_path)?;

        let conn = Connection::open(&db_path)?;
        let version: String = conn.query_row(
            "SELECT value FROM metadata WHERE key='NX_VERSION'",
            [],
            |row| row.get(0),
        )?;

        assert_eq!(version, "1.0.0");
        Ok(())
    }

    #[test]
    fn initialize_db_recreates_incompatible_db() -> anyhow::Result<()> {
        enable_logger();
        let temp_dir = tempfile::tempdir()?;
        let db_path = temp_dir.path().join("test.db");
        //
        // Create initial db
        let _ = initialize_db("1.0.0".to_string(), &db_path)?;

        // Try to initialize with different version
        let conn = initialize_db("2.0.0".to_string(), &db_path)?;

        let version: Option<String> = conn.query_row(
            "SELECT value FROM metadata WHERE key='NX_VERSION'",
            [],
            |row| row.get(0),
        )?;

        assert_eq!(version.unwrap(), "2.0.0");
        Ok(())
    }
}
