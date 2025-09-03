use ignore_files::IgnoreFile;
use std::path::Path;
use std::{fs, path::PathBuf};
use tracing::trace;
use watchexec_events::{Event, Tag};
use crate::native::utils::git::find_git_root;

/// Collect .gitignore files using a simple approach that reuses walker logic
fn collect_workspace_gitignores<P: AsRef<Path>>(root: P) -> Vec<IgnoreFile> {
    use crate::native::walker::nx_walker_sync;
    
    // Use our own walker to find .gitignore files, filtering out node_modules
    let gitignore_filters = vec!["node_modules".to_string()];
    
    nx_walker_sync(&root, Some(&gitignore_filters))
        .filter_map(|path| {
            // Only process .gitignore files
            if path.file_name()?.to_str()? == ".gitignore" {
                let parent = path.parent().unwrap_or(&path).to_path_buf();
                Some(IgnoreFile {
                    path,
                    applies_in: Some(parent),
                    applies_to: None,
                })
            } else {
                None
            }
        })
        .collect()
}

/// Add .gitignore files from parent directories up to the git root
fn add_parent_gitignores(
    ignore_files: &mut Vec<IgnoreFile>,
    root_path: &Path,
    git_root: &Path,
) {
    let mut current_path = root_path.parent();
    
    while let Some(path) = current_path {
        let gitignore_path = path.join(".gitignore");
        if gitignore_path.exists() {
            ignore_files.push(IgnoreFile {
                path: gitignore_path,
                applies_in: Some(path.to_path_buf()),
                applies_to: None,
            });
        }

        // Stop when we reach the git root
        if path == git_root {
            break;
        }
        
        current_path = path.parent();
    }
}

pub(super) fn get_gitignore_files<T: AsRef<str>>(
    use_ignore: bool,
    root: T,
) -> Option<Vec<IgnoreFile>> {
    if !use_ignore {
        return None;
    }

    let root_path = PathBuf::from(root.as_ref());
    
    // Start with workspace .gitignore files
    let mut ignore_files = collect_workspace_gitignores(&root_path);

    // Add parent .gitignore files only if we're nested within a git repo
    if let Some(git_root_path) = find_git_root(&root_path).filter(|p| p != &root_path) {
        trace!(?git_root_path, "Adding parent gitignores up to git root");
        add_parent_gitignores(&mut ignore_files, &root_path, &git_root_path);
    }

    trace!(?ignore_files, "Final ignore files list");
    Some(ignore_files)
}

pub(super) fn get_nx_ignore<P: AsRef<Path>>(origin: P) -> Option<IgnoreFile> {
    let nx_ignore_path = PathBuf::from(origin.as_ref()).join(".nxignore");
    if nx_ignore_path.exists() {
        Some(IgnoreFile {
            path: nx_ignore_path,
            applies_in: Some(origin.as_ref().into()),
            applies_to: None,
        })
    } else {
        None
    }
}

pub(super) fn transform_event(watch_event: &Event) -> Option<Event> {
    if cfg!(target_os = "linux") {
        let tags = watch_event
            .tags
            .clone()
            .into_iter()
            .map(|tag| match tag {
                Tag::Path { path, file_type } => {
                    trace!("canonicalizing {:?}", path);
                    let real_path = fs::canonicalize(&path).unwrap_or(path);
                    trace!("real path {:?}", real_path);
                    Tag::Path {
                        path: real_path,
                        file_type,
                    }
                }
                _ => tag,
            })
            .collect();

        Some(Event {
            tags,
            metadata: watch_event.metadata.clone(),
        })
    } else {
        None
    }
}
