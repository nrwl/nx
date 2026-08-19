use std::path::{Path, PathBuf};
use tracing::trace;

use crate::native::utils::git::parent_gitignore_files;

/// Ignore files discovered in the workspace, one Vec per source, matching
/// the sources the walker's `WalkBuilder` reads (custom .nxignore files,
/// .ignore files, .gitignore files).
pub(in crate::native) struct IgnoreFiles {
    /// .gitignore files inside the workspace.
    pub gitignores: Vec<PathBuf>,
    /// .gitignore files from directories above the workspace. Kept separate:
    /// the walker registers these via `add_ignore`, which roots patterns at
    /// the process CWD and consults them last, so they need different
    /// compilation and ordering than workspace .gitignore files.
    pub parent_gitignores: Vec<PathBuf>,
    pub dot_ignores: Vec<PathBuf>,
    pub nxignores: Vec<PathBuf>,
}

/// Collect ignore files using a simple approach that reuses walker logic
fn collect_workspace_ignore_files<P: AsRef<Path>>(
    root: P,
) -> (Vec<PathBuf>, Vec<PathBuf>, Vec<PathBuf>) {
    use crate::native::walker::nx_walker_sync;

    // Use our own walker to find ignore files, filtering out node_modules
    let ignore_filters = vec!["node_modules".to_string()];

    let root_path = root.as_ref();

    let mut gitignores = Vec::new();
    let mut dot_ignores = Vec::new();
    let mut nxignores = Vec::new();

    for relative_path in nx_walker_sync(&root, Some(&ignore_filters)) {
        let Some(file_name) = relative_path.file_name().and_then(|f| f.to_str()) else {
            continue;
        };
        match file_name {
            ".gitignore" => gitignores.push(root_path.join(&relative_path)),
            ".ignore" => dot_ignores.push(root_path.join(&relative_path)),
            ".nxignore" => nxignores.push(root_path.join(&relative_path)),
            _ => {}
        }
    }

    (gitignores, dot_ignores, nxignores)
}

pub(in crate::native) fn get_ignore_files<T: AsRef<str>>(root: T) -> IgnoreFiles {
    let root_path = PathBuf::from(root.as_ref());

    let (gitignores, dot_ignores, nxignores) = collect_workspace_ignore_files(&root_path);

    // Add parent .gitignore files using shared logic
    let parent_gitignores = parent_gitignore_files(&root_path).unwrap_or_default();

    trace!(
        ?gitignores,
        ?parent_gitignores,
        ?dot_ignores,
        ?nxignores,
        "Final ignore files list"
    );
    IgnoreFiles {
        gitignores,
        parent_gitignores,
        dot_ignores,
        nxignores,
    }
}
