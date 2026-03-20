pub mod connection;
mod initialize;

use crate::native::logger::enable_logger;
use crate::native::machine_id::get_machine_id;
use crate::native::{db::connection::NxDbConnection, hasher::hash};
use napi::bindgen_prelude::External;
use std::fs::create_dir_all;
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
    create_dir_all(cache_dir_buf)?;

    trace_span!("process", id = process::id()).in_scope(|| {
        trace!("Creating connection to {:?}", db_path);
        let lock_file = initialize::create_lock_file(&db_path)?;

        let c = initialize::initialize_db(&db_path)
            .inspect_err(|_| initialize::unlock_file(&lock_file))?;

        initialize::unlock_file(&lock_file);

        Ok(External::new(Arc::new(Mutex::new(c))))
    })
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
