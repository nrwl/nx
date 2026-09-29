use ignore::WalkState;
use parking_lot::Mutex;
use std::path::{Path, PathBuf};
use tracing::trace;

use crate::native::utils::git::parent_gitignore_files;
use crate::native::walker::create_walker;

/// Every `.gitignore` and `.nxignore` under `root`, as absolute paths. Only the
/// hardcoded directories are pruned: no ignore rule applies, so an ignore file
/// inside an ignored or hidden directory is found too.
fn collect_workspace_ignore_files(root: &Path) -> Vec<PathBuf> {
    let found = Mutex::new(Vec::new());
    create_walker(root, false).build_parallel().run(|| {
        let found = &found;
        Box::new(move |entry| {
            if let Ok(entry) = entry
                && matches!(entry.file_name().to_str(), Some(".gitignore" | ".nxignore"))
            {
                found.lock().push(entry.into_path());
            }
            WalkState::Continue
        })
    });
    found.into_inner()
}

pub(in crate::native) fn get_ignore_files<T: AsRef<str>>(root: T) -> Vec<PathBuf> {
    let root_path = PathBuf::from(root.as_ref());
    let found = collect_workspace_ignore_files(&root_path);
    with_parent_ignore_files(&root_path, found)
}

/// `found`, the ignore files inside `root`, plus the `.gitignore` files above
/// it that still apply.
pub(crate) fn with_parent_ignore_files(root: &Path, mut found: Vec<PathBuf>) -> Vec<PathBuf> {
    if let Some(gitignore_paths) = parent_gitignore_files(root) {
        found.extend(gitignore_paths);
    }

    trace!(ignore_files = ?found, "Final ignore files list");
    found
}
