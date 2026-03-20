pub mod connection;
mod initialize;

use crate::native::logger::enable_logger;
use crate::native::machine_id::get_machine_id;
use crate::native::{db::connection::NxDbConnection, hasher::hash};
use napi::bindgen_prelude::External;
use std::fs::{create_dir_all, read_dir, remove_file};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::{mem, process};
use tracing::{trace, trace_span};

#[napi]
pub fn connect_to_nx_db(
    cache_dir: String,
    db_name: Option<String>,
) -> anyhow::Result<External<Arc<Mutex<NxDbConnection>>>> {
    enable_logger();
    let cache_dir_buf = PathBuf::from(cache_dir);
    let mut db_file_name = db_name.unwrap_or_else(get_machine_id);

    if db_file_name.is_empty() {
        trace!("Invalid db file name, using fallback name");
        db_file_name = hash(b"machine");
    }

    let db_path = cache_dir_buf.join(format!("{}-v{}.db", db_file_name, initialize::DB_VERSION));
    create_dir_all(&cache_dir_buf)?;

    trace_span!("process", id = process::id()).in_scope(|| {
        trace!("Creating connection to {:?}", db_path);
        let lock_file = initialize::create_lock_file(&db_path)?;

        let c = initialize::initialize_db(&db_path)
            .inspect_err(|_| initialize::unlock_file(&lock_file))?;

        initialize::unlock_file(&lock_file);

        // Clean up DB files from older schema versions
        cleanup_stale_db_files(&cache_dir_buf, &db_file_name);

        Ok(External::new(Arc::new(Mutex::new(c))))
    })
}

/// Remove DB files belonging to old schema versions that haven't been
/// accessed in over 7 days. This avoids deleting a DB that another
/// Nx version (in a different worktree) is still actively using.
fn cleanup_stale_db_files(cache_dir: &Path, db_name: &str) {
    use std::time::{Duration, SystemTime};

    const STALE_THRESHOLD: Duration = Duration::from_secs(7 * 24 * 60 * 60); // 7 days

    let current_suffix = format!("-v{}.db", initialize::DB_VERSION);

    let entries = match read_dir(cache_dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    let now = SystemTime::now();

    for entry in entries.flatten() {
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();

        // Only look at files that start with our db_name
        if !name.starts_with(db_name) {
            continue;
        }

        // Skip the current version's files
        let after_name = &name[db_name.len()..];
        if after_name.starts_with(&current_suffix) {
            continue;
        }

        // Match stale patterns: "{db_name}.db*" or "{db_name}-v{other}.db*"
        let is_old_unversioned = after_name.starts_with(".db");
        let is_old_versioned = after_name.starts_with("-v") && after_name.contains(".db");

        if !is_old_unversioned && !is_old_versioned {
            continue;
        }

        // Only delete if the file hasn't been modified in over 7 days
        let dominated = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|modified| now.duration_since(modified).ok())
            .is_some_and(|age| age > STALE_THRESHOLD);

        if dominated {
            let path = entry.path();
            trace!("Removing stale DB file (>7 days old): {:?}", path);
            remove_file(&path).ok();
        }
    }
}

#[napi]
pub fn close_db_connection(
    #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] connection: &mut External<
        Arc<Mutex<NxDbConnection>>,
    >,
) -> anyhow::Result<()> {
    let conn = mem::take(&mut *connection.lock().unwrap());
    conn.close()
}

/// If `workspace_root` is inside a git worktree, returns the main repo root.
/// Returns `None` when already in the main repo (or not in a git repo at all).
#[napi]
pub fn get_main_worktree_root(workspace_root: String) -> anyhow::Result<Option<String>> {
    let git_path = Path::new(&workspace_root).join(".git");

    // If .git is a directory (not a file), this is the main repo — not a worktree
    if !git_path.is_file() {
        return Ok(None);
    }

    // In a worktree, .git is a file pointing to the main repo's .git dir.
    // Use git to find the common dir shared across all worktrees.
    let output = std::process::Command::new("git")
        .args(["rev-parse", "--git-common-dir"])
        .current_dir(&workspace_root)
        .output()?;

    if !output.status.success() {
        return Ok(None);
    }

    let git_common_dir = String::from_utf8(output.stdout)?.trim().to_string();
    let abs_path = if Path::new(&git_common_dir).is_absolute() {
        PathBuf::from(&git_common_dir)
    } else {
        PathBuf::from(&workspace_root).join(&git_common_dir)
    };

    // The common dir is the .git directory — its parent is the repo root
    let main_root = abs_path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Cannot determine main repo root"))?;

    Ok(Some(main_root.to_string_lossy().to_string()))
}
