use crate::native::utils::git::parent_gitignore_files;
use ignore_files::IgnoreFile;
use std::path::Path;
use std::{fs, path::PathBuf};
use tracing::trace;
use watchexec_events::{Event, Tag};

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
