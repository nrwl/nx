use ignore_files::IgnoreFile;
use std::path::{Path, PathBuf};
use tracing::trace;

/// Find the nearest git repository root by walking up the directory tree
pub fn find_git_root<P: AsRef<Path>>(start_path: P) -> Option<PathBuf> {
    let mut current_path = start_path.as_ref();

    loop {
        if current_path.join(".git").exists() {
            return Some(current_path.to_path_buf());
        }

        match current_path.parent() {
            Some(parent) => current_path = parent,
            None => return None,
        }
    }
}

/// Get parent .gitignore file paths based on git repository boundaries
///
/// # Behavior:
/// - If workspace is git root: returns Some([]) (empty vec - use manual mode with no parents)
/// - If workspace is nested in git repo: returns Some(parents up to git root)
/// - If no git repo found: returns None (use walker.parents(true) for backwards compatibility)
pub fn parent_gitignore_files<P: AsRef<Path>>(workspace_root: P) -> Option<Vec<PathBuf>> {
    let workspace_root = workspace_root.as_ref();
    let git_root_path = find_git_root(&workspace_root)?;

    if git_root_path == workspace_root {
        // The workspace IS the git root - don't use parent gitignores
        return Some(Vec::new());
    }

    let mut result = Vec::new();
    let mut current_path = workspace_root.parent();

    while let Some(path) = current_path {
        let gitignore_path = path.join(".gitignore");
        if gitignore_path.exists() {
            result.push(gitignore_path);
        }

        // Stop when we reach the git root (after processing it)
        if path == git_root_path {
            break;
        }
        current_path = path.parent();
    }

    Some(result)
}

/// Collect .gitignore files using a simple approach that reuses walker logic
pub fn collect_workspace_gitignores<P: AsRef<Path>>(root: P) -> Vec<IgnoreFile> {
    use crate::native::walker::nx_walker_sync;

    // Use our own walker to find .gitignore files, filtering out node_modules
    let gitignore_filters = vec!["node_modules".to_string()];

    let root_path = root.as_ref();

    nx_walker_sync(&root, Some(&gitignore_filters))
        .filter_map(|relative_path| {
            // Only process .gitignore files
            if relative_path.file_name()?.to_str()? == ".gitignore" {
                let absolute_path = root_path.join(&relative_path);
                let parent = absolute_path
                    .parent()
                    .unwrap_or(&absolute_path)
                    .to_path_buf();
                Some(IgnoreFile {
                    path: absolute_path,
                    applies_in: Some(parent),
                    applies_to: None,
                })
            } else {
                None
            }
        })
        .collect()
}

pub(in crate::native) fn get_gitignore_files<T: AsRef<str>>(root: T) -> Vec<IgnoreFile> {
    let root_path = PathBuf::from(root.as_ref());

    // Start with workspace .gitignore files
    let mut ignore_files = collect_workspace_gitignores(&root_path);

    // Add parent .gitignore files using shared logic
    if let Some(gitignore_paths) = parent_gitignore_files(&root_path) {
        ignore_files.extend(gitignore_paths.into_iter().map(|gitignore_path| {
            let applies_in = gitignore_path
                .parent()
                .expect(".gitignore file should have a parent directory")
                .to_path_buf();
            IgnoreFile {
                path: gitignore_path,
                applies_in: Some(applies_in),
                applies_to: None,
            }
        }));
    }

    trace!(?ignore_files, "Final ignore files list");
    ignore_files
}
