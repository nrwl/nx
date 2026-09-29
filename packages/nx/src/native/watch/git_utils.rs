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

    let mut ignore_files = collect_workspace_ignore_files(&root_path);

    if let Some(gitignore_paths) = parent_gitignore_files(&root_path) {
        ignore_files.extend(gitignore_paths);
    }

    trace!(?ignore_files, "Final ignore files list");
    ignore_files
}
