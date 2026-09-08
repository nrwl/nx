use std::path::{Path, PathBuf};
use tracing::trace;

use crate::native::utils::git::parent_gitignore_files;

/// Collect .gitignore files using a simple approach that reuses walker logic
fn collect_workspace_gitignores<P: AsRef<Path>>(root: P) -> Vec<PathBuf> {
    collect_workspace_ignore_files(root, &[".gitignore"])
}

/// Collect ignore files with any of `names` anywhere in the workspace
/// (node_modules pruned), returning absolute paths. `create_walker` honours
/// `.ignore` and nested `.nxignore` in addition to `.gitignore`; the watch
/// filterer discovers the same set so it no longer misses a directory the walk
/// excludes. (Exact cross-source precedence at one directory is approximated,
/// not identical to the ignore crate — see WatchFilterer::git_ignores.)
pub(in crate::native) fn collect_workspace_ignore_files<P: AsRef<Path>>(
    root: P,
    names: &[&str],
) -> Vec<PathBuf> {
    use crate::native::walker::nx_walker_sync;

    let filters = vec!["node_modules".to_string()];
    let root_path = root.as_ref();

    nx_walker_sync(&root, Some(&filters))
        .filter_map(|relative_path| {
            let name = relative_path.file_name()?.to_str()?;
            names
                .contains(&name)
                .then(|| root_path.join(&relative_path))
        })
        .collect()
}

pub(in crate::native) fn get_gitignore_files<T: AsRef<str>>(root: T) -> Vec<PathBuf> {
    let root_path = PathBuf::from(root.as_ref());

    // Start with workspace .gitignore files
    let mut ignore_files = collect_workspace_gitignores(&root_path);

    // Add parent .gitignore files using shared logic
    if let Some(gitignore_paths) = parent_gitignore_files(&root_path) {
        ignore_files.extend(gitignore_paths);
    }

    trace!(?ignore_files, "Final ignore files list");
    ignore_files
}
