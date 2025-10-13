use crate::native::db::connection::NxDbConnection;
use rusqlite::vtab::array;
use rusqlite::{Connection, OpenFlags};
use std::fs::{File, remove_file, write};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use tracing::{debug, trace};

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

/// Creates a user-friendly error message for filesystem IO errors with specific guidance based on error type
fn create_io_error(operation: &str, path: &Path, error: std::io::Error) -> anyhow::Error {
    let error_kind_msg = match error.kind() {
        ErrorKind::PermissionDenied => "Permission denied",
        ErrorKind::NotFound => "Directory not found",
        ErrorKind::StorageFull => "Disk full",
        ErrorKind::AlreadyExists => "File already exists",
        _ => "Filesystem error",
    };

    let specific_guidance = match error.kind() {
        ErrorKind::PermissionDenied => {
            format!(
                "Possible solutions:\n\
                - Verify you have read and write permissions for: {}\n\
                - Check that you own the file/directory or your user has access\n\
                - Ensure the filesystem is not mounted read-only\n\
                - If using Docker, ensure volume has correct permissions\n\
                - If running in a restricted environment, you may need administrator privileges",
                path.display()
            )
        }
        ErrorKind::NotFound => {
            if let Some(parent) = path.parent() {
                format!(
                    "The parent directory does not exist: {}\n\
                    \n\
                    This is unexpected as Nx should have created it.\n\
                    \n\
                    Possible solutions:\n\
                    - Verify the workspace directory exists\n\
                    - Check that the path is not on a removed or unmounted drive",
                    parent.display()
                )
            } else {
                "The specified path does not exist or is inaccessible.\n\
                \n\
                Possible solutions:\n\
                - Verify the workspace directory exists\n\
                - Check that the path is not on a removed or unmounted drive"
                    .to_string()
            }
        }
        ErrorKind::StorageFull => {
            "Possible solutions:\n\
            - Free up disk space on the drive containing the workspace\n\
            - Move the workspace to a drive with more available space\n\
            - Check for large files that can be removed"
                .to_string()
        }
        ErrorKind::AlreadyExists => {
            "This may indicate a previous Nx process did not clean up properly.\n\
            \n\
            Possible solutions:\n\
            - Ensure no other Nx processes are running\n\
            - Run nx reset to clean up stale files"
                .to_string()
        }
        _ => {
            "This could be due to filesystem limitations, insufficient permissions, or disk space issues.\n\
            \n\
            Try:\n\
            - Check available disk space\n\
            - Verify file and directory permissions"
                .to_string()
        }
    };

    anyhow::anyhow!(
        "Unable to initialize workspace data. Cannot {} at {}. {}.\n\
        \n\
        {}\n\
        \n\
        If nothing else works: Run nx reset and try again\n\
        \n\
        If the issue persists, please report it with detailed logs:\n\
        1. Run: NX_NATIVE_LOGGING=nx::native::db=trace nx <your-command>\n\
        2. Report at: https://github.com/nrwl/nx/issues/new/choose\n\
        \n\
        Technical error: {}",
        operation,
        path.display(),
        error_kind_msg,
        specific_guidance,
        error
    )
}

/// Creates a user-friendly error message for database errors
fn create_db_error(operation: &str, db_path: &Path, error: anyhow::Error) -> anyhow::Error {
    anyhow::anyhow!(
        "Unable to initialize workspace data. {}.\n\
        \n\
        Database file: {}\n\
        \n\
        This could be due to database corruption, filesystem issues, or insufficient permissions.\n\
        \n\
        Try:\n\
        - Check available disk space\n\
        - Verify file and directory permissions\n\
        - Ensure the filesystem supports SQLite databases\n\
        - If nothing else works: Run nx reset and try again\n\
        \n\
        If the issue persists, please report it with detailed logs:\n\
        1. Run: NX_NATIVE_LOGGING=nx::native::db=trace nx <your-command>\n\
        2. Report at: https://github.com/nrwl/nx/issues/new/choose\n\
        \n\
        Technical error: {}",
        operation,
        db_path.display(),
        error
    )
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
    let mut cleaned_up_stale_files = false;

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

                match db_version {
                    Ok(Some(version)) if version == nx_version => {
                        trace!("Database is compatible with Nx {}", nx_version);

                        // Check current journal mode to handle appropriately
                        let current_mode = query_journal_mode(&c);

                        match current_mode.as_deref() {
                            Some(mode) if mode.eq_ignore_ascii_case("DELETE") => {
                                trace!("Database already configured with DELETE journal mode");
                                trace!("Attempting to upgrade to WAL for better performance");

                                // Opportunistically try to upgrade to WAL
                                c.pragma_update(None, "journal_mode", "WAL").ok();

                                // Check what mode we actually ended up in
                                let final_mode = query_journal_mode(&c);

                                match final_mode.as_deref() {
                                    Some(m) if m.eq_ignore_ascii_case("WAL") => {
                                        trace!("Successfully upgraded to WAL journal mode!");
                                    }
                                    _ => {
                                        trace!(
                                            "Still in DELETE mode (WAL not supported in this environment)"
                                        );
                                        // Clean up any orphaned WAL files if any since we're staying in DELETE mode
                                        remove_wal_files(db_path);
                                    }
                                }

                                // Set busy handler (connection-level, must be set every time)
                                set_busy_handler(&c, db_path)?;

                                return Ok(c);
                            }
                            Some(mode) if mode.eq_ignore_ascii_case("WAL") => {
                                trace!("Database already configured with WAL journal mode");
                                trace!("Verifying WAL mode still works");

                                // Verify WAL mode works
                                match c.pragma_update(None, "journal_mode", "WAL") {
                                    Ok(_) => {
                                        trace!("WAL mode verified working");

                                        // Set busy handler (connection-level)
                                        set_busy_handler(&c, db_path)?;

                                        return Ok(c);
                                    }
                                    Err(wal_error) => {
                                        trace!("WAL mode failed: {:?}", wal_error);

                                        if !cleaned_up_stale_files {
                                            // First failure - likely stale auxiliary files
                                            trace!("Removing stale WAL files and retrying");

                                            // Close connection before cleanup
                                            close_connection_for_cleanup(c)?;

                                            // Remove only auxiliary files (preserves cache in main .db)
                                            remove_wal_files(db_path);

                                            cleaned_up_stale_files = true;
                                            continue; // Retry
                                        }

                                        // Still failing after cleanup - fallback to DELETE mode
                                        debug!(
                                            "WAL mode failed after cleanup, falling back to DELETE mode"
                                        );
                                        debug!(
                                            "This is normal for network drives or certain filesystems"
                                        );

                                        c.pragma_update(None, "journal_mode", "DELETE").map_err(
                                            |e| {
                                                create_db_error(
                                                    "Cannot set DELETE journal mode",
                                                    db_path,
                                                    e.into(),
                                                )
                                            },
                                        )?;

                                        set_busy_handler(&c, db_path)?;

                                        return Ok(c);
                                    }
                                }
                            }
                            _ => {
                                // Unknown mode or query failed - use full configuration
                                trace!(
                                    "Unknown journal mode or query failed, configuring database"
                                );
                                match configure_database(&c, db_path, cleaned_up_stale_files) {
                                    Ok(_) => return Ok(c),
                                    Err(config_error) if !cleaned_up_stale_files => {
                                        trace!("Failed to configure database: {:?}", config_error);
                                        trace!("Cleaning up database files and retrying");

                                        // Close connection before cleanup
                                        close_connection_for_cleanup(c)?;

                                        // Clean up ALL database files including auxiliary files
                                        remove_all_database_files(db_path)?;

                                        // Retry
                                        cleaned_up_stale_files = true;
                                        continue;
                                    }
                                    Err(config_error) => return Err(config_error),
                                }
                            }
                        }
                    }
                    // If there is no metadata, it means that this database is new
                    Err(s) if s.to_string().contains("metadata") => {
                        match configure_database(&c, db_path, cleaned_up_stale_files) {
                            Ok(_) => {
                                create_metadata_table(&mut c, &nx_version)?;
                                return Ok(c);
                            }
                            Err(config_error) if !cleaned_up_stale_files => {
                                trace!("Failed to configure new database: {:?}", config_error);
                                close_connection_for_cleanup(c)?;
                                remove_all_database_files(db_path)?;
                                cleaned_up_stale_files = true;
                                continue;
                            }
                            Err(config_error) => return Err(config_error),
                        }
                    }
                    reason => {
                        trace!("Incompatible database because: {:?}", reason);
                        trace!("Disconnecting from existing incompatible database");
                        close_connection_for_cleanup(c)?;
                        trace!("Removing existing incompatible database");
                        remove_all_database_files(db_path)?;

                        trace!("Initializing a new database");
                        // Incompatible database is expected behavior (version upgrade), not a failure
                        // We've cleaned up the old database, so mark flag for journal mode fallback
                        cleaned_up_stale_files = true;
                        continue;
                    }
                }
            }
            Err(reason) => {
                trace!(
                    "Unable to connect to existing database because: {:?}",
                    reason
                );
                if !cleaned_up_stale_files {
                    trace!("Removing existing incompatible database");
                    remove_all_database_files(db_path)?;

                    trace!("Initializing a new database");
                    cleaned_up_stale_files = true;
                    continue;
                } else {
                    return Err(reason);
                }
            }
        }
    }
}

/// Removes WAL auxiliary files (.db-wal and .db-shm) if they exist.
/// This is safe to call and will not fail - errors are logged but ignored.
fn remove_wal_files(db_path: &Path) {
    let wal_path = PathBuf::from(format!("{}-wal", db_path.display()));
    let shm_path = PathBuf::from(format!("{}-shm", db_path.display()));

    for (path, description) in [(wal_path, "WAL file"), (shm_path, "shared memory file")] {
        if path.exists() {
            match remove_file(&path) {
                Ok(_) => trace!("Removed {}: {:?}", description, path),
                Err(e) => trace!("Warning: failed to remove {}: {}", description, e),
            }
        }
    }
}

/// Queries the current journal mode of the database.
/// Returns None if the query fails or returns no result.
fn query_journal_mode(connection: &NxDbConnection) -> Option<String> {
    connection
        .query_row("PRAGMA journal_mode", [], |row| row.get(0))
        .ok()
        .flatten()
}

/// Sets the busy handler for the database connection.
/// The busy handler determines how SQLite handles locked databases during concurrent access.
fn set_busy_handler(connection: &NxDbConnection, db_path: &Path) -> anyhow::Result<()> {
    connection
        .busy_handler(Some(|tries| tries <= 12))
        .map_err(|e| create_db_error("Cannot configure database busy handler", db_path, e.into()))
}

fn remove_all_database_files(db_path: &Path) -> anyhow::Result<()> {
    // Remove main database file
    match remove_file(db_path) {
        Ok(_) => trace!("Removed database file: {:?}", db_path),
        Err(e) if e.kind() == ErrorKind::NotFound => {
            // File doesn't exist, which is fine
        }
        Err(e) => {
            trace!("Warning: failed to remove database file: {}", e);
            // Continue cleanup even if main file fails
        }
    }

    // Remove auxiliary files
    remove_wal_files(db_path);

    Ok(())
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

fn open_database_connection(db_path: &Path) -> anyhow::Result<NxDbConnection> {
    trace!("Opening database connection to {:?}", db_path);
    let conn = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_CREATE
            | OpenFlags::SQLITE_OPEN_URI
            | OpenFlags::SQLITE_OPEN_FULL_MUTEX,
    )
    .map_err(|e| create_db_error("Cannot open database", db_path, e.into()))?;

    // Load array module for rarray() functionality - needed per connection
    trace!("Loading SQLite array module");
    array::load_module(&conn)
        .map_err(|e| create_db_error("Cannot load SQLite array extension", db_path, e.into()))?;

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
        .map_err(|e| {
            create_db_error(
                "Cannot configure database synchronous mode",
                db_path,
                e.into(),
            )
        })?;

    connection
        .busy_handler(Some(|tries| tries <= 12))
        .map_err(|e| {
            create_db_error("Cannot configure database busy handler", db_path, e.into())
        })?;

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
        debug!("Using DELETE journal mode for compatibility");
        connection
            .pragma_update(None, "journal_mode", "DELETE")
            .map_err(|e| diagnose_filesystem_issue(db_path, e))?;
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
                trace!("WAL failed before cleanup - may be stale auxiliary files");
                trace!("Will clean up database files and retry");
                return Err(anyhow::anyhow!(
                    "WAL mode failed - cleanup needed: {}",
                    wal_error
                ));
            }

            // After cleanup, WAL still not supported - fall back to DELETE mode
            debug!("WAL not supported on this system after cleanup");
            debug!("This is normal for WSL1, network drives, or certain filesystems");
        }
    }

    // Fallback to DELETE mode (universal compatibility)
    connection
        .pragma_update(None, "journal_mode", "DELETE")
        .map_err(|e| diagnose_filesystem_issue(db_path, e))?;

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
    if let Ok(contents) = std::fs::read_to_string("/proc/version") {
        // WSL1 has "Microsoft" in /proc/version but not "WSL2"
        return contents.contains("Microsoft") && !contents.contains("WSL2");
    }
    false
}

/// Helper function to close a database connection during cleanup
fn close_connection_for_cleanup(connection: NxDbConnection) -> anyhow::Result<()> {
    connection.close().map_err(|e| {
        anyhow::anyhow!(
            "Failed to close database connection during cleanup: {:?}",
            e
        )
    })
}

/// Diagnose specific filesystem issues when DELETE mode fails
fn diagnose_filesystem_issue(db_path: &Path, original_error: anyhow::Error) -> anyhow::Error {
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
                    "Unable to initialize workspace data.\n\
                    \n\
                    The directory exists and is writable, but SQLite cannot initialize.\n\
                    \n\
                    This may indicate:\n\
                    - The directory is on a network drive or NFS mount\n\
                    - The filesystem doesn't support required features\n\
                    - There are conflicting locks from another process\n\
                    \n\
                    Location: {}\n\
                    \n\
                    Possible solutions:\n\
                    - Move your workspace to a local filesystem\n\
                    - Check for other processes accessing cache directory at {}\n\
                    - If nothing else works: Run nx reset and try again\n\
                    \n\
                    If the issue persists, please report it with detailed logs:\n\
                    1. Run: NX_NATIVE_LOGGING=nx::native::db=trace nx <your-command>\n\
                    2. Report at: https://github.com/nrwl/nx/issues/new/choose\n\
                    \n\
                    Original error: {}",
                    parent_dir.display(),
                    parent_dir.display(),
                    original_error
                );
            }
            Err(write_error) => {
                // Directory exists but is not writable
                return anyhow::anyhow!(
                    "Unable to initialize workspace data.\n\
                    \n\
                    Permission denied: Cannot write to directory\n\
                    \n\
                    Location: {}\n\
                    \n\
                    The directory exists but Nx cannot write to it.\n\
                    \n\
                    Possible solutions:\n\
                    - Verify you have read and write permissions for: {}\n\
                    - Check that you own the directory or your user has access\n\
                    - Ensure the filesystem is not mounted read-only\n\
                    - If using Docker, ensure volume has correct permissions\n\
                    - If running in a restricted environment, you may need administrator privileges\n\
                    \n\
                    Permission error: {}\n\
                    Original error: {}",
                    parent_dir.display(),
                    parent_dir.display(),
                    write_error,
                    original_error
                );
            }
        }
    }

    // Fallback if we can't get the parent directory path
    anyhow::anyhow!(
        "Unable to initialize workspace data.\n\
        \n\
        This may indicate:\n\
        - File permissions issues in the workspace directory\n\
        - The workspace directory is on a network drive or shared filesystem\n\
        - Filesystem limitations\n\
        \n\
        Possible solutions:\n\
        - Ensure the workspace is on a local filesystem\n\
        - Check file permissions on the cache directory\n\
        - If nothing else works: Run nx reset and try again\n\
        \n\
        If the issue persists, please report it with detailed logs:\n\
        1. Run: NX_NATIVE_LOGGING=nx::native::db=trace nx <your-command>\n\
        2. Report at: https://github.com/nrwl/nx/issues/new/choose\n\
        \n\
        Error: {}",
        original_error
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
