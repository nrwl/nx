use ignore_files::IgnoreFile;
use std::path::{Path, PathBuf};
use tracing::trace;

use crate::native::utils::git::parent_gitignore_files;

/// Collect .gitignore files using a simple approach that reuses walker logic
fn collect_workspace_gitignores<P: AsRef<Path>>(root: P) -> Vec<IgnoreFile> {
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
