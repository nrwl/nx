use ignore_files::IgnoreFile;
use std::path::Path;
use std::{fs, path::PathBuf};
use tracing::trace;
use watchexec_events::{Event, Tag};

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
