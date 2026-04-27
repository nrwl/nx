use std::fs::{self, Metadata};
use std::io;
use std::path::{Path, PathBuf};

use notify::event::{CreateKind, ModifyKind, RenameMode};
use notify::{Event, EventKind};
use tracing::trace;

use crate::native::watch::utils::canonicalize_event_paths;

/// A notify event enriched with a per-path metadata stat. The metadata is
/// computed once when the event arrives and reused everywhere downstream
/// (filter, new-directory detection, transform) instead of re-statting.
pub(super) struct RawWatchEvent {
    pub event: Event,
    /// Parallel to `event.paths` — one stat result per path.
    pub metadata: Vec<io::Result<Metadata>>,
}

impl RawWatchEvent {
    pub fn new(event: Event) -> Self {
        let event = canonicalize_event_paths(&event);
        let metadata = event.paths.iter().map(fs::metadata).collect();
        Self { event, metadata }
    }

    pub fn paths(&self) -> impl Iterator<Item = (&Path, &io::Result<Metadata>)> {
        self.event
            .paths
            .iter()
            .zip(self.metadata.iter())
            .map(|(p, m)| (p.as_path(), m))
    }

    pub fn first(&self) -> Option<(&Path, &io::Result<Metadata>)> {
        self.paths().next()
    }

    pub fn kind(&self) -> &EventKind {
        &self.event.kind
    }
}

pub(super) fn meta_is_dir(metadata: &io::Result<Metadata>) -> bool {
    metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false)
}

pub(super) fn meta_exists(metadata: &io::Result<Metadata>) -> bool {
    metadata.is_ok()
}

#[napi(string_enum)]
#[derive(Debug, Clone, Copy)]
pub enum EventType {
    #[allow(non_camel_case_types)]
    delete,
    #[allow(non_camel_case_types)]
    update,
    #[allow(non_camel_case_types)]
    create,
}

#[derive(Debug, Clone)]
#[napi(object)]
pub struct WatchEvent {
    pub path: String,
    pub r#type: EventType,
}

impl From<&WatchEventInternal> for WatchEvent {
    fn from(value: &WatchEventInternal) -> Self {
        let path = value
            .path
            .strip_prefix(&value.origin)
            .unwrap_or(&value.path)
            .display()
            .to_string();

        #[cfg(windows)]
        let path = path.replace('\\', "/");

        WatchEvent {
            path,
            r#type: value.r#type,
        }
    }
}

#[derive(Debug, Clone)]
pub(super) struct WatchEventInternal {
    pub path: PathBuf,
    pub r#type: EventType,
    pub origin: String,
}

pub(super) fn transform_event_to_watch_events(
    value: &RawWatchEvent,
    origin: &str,
) -> anyhow::Result<Vec<WatchEventInternal>> {
    let Some((path_ref, metadata)) = value.first() else {
        let error_msg = "unable to get path from the event";
        trace!(event = ?value.event, error_msg);
        anyhow::bail!(error_msg)
    };

    let event_kind = value.kind();

    if !meta_exists(metadata) {
        // Treat any non-existent path as a delete (covers both explicit
        // Remove events and create-then-delete races).
        return Ok(vec![WatchEventInternal {
            path: path_ref.to_path_buf(),
            r#type: EventType::delete,
            origin: origin.to_owned(),
        }]);
    }

    #[cfg(target_os = "macos")]
    {
        use std::os::macos::fs::MetadataExt;

        // Skip directory events
        if meta_is_dir(metadata) {
            return Ok(vec![]);
        }

        let event_type = match metadata {
            Err(_) => EventType::delete,
            Ok(t) => {
                let modified_time = t.st_mtime();
                let birth_time = t.st_birthtime();

                // if a file is created and updated near the same time, we always get a create event
                // so we need to check the timestamps to see if it was created or updated
                if modified_time == birth_time {
                    EventType::create
                } else {
                    EventType::update
                }
            }
        };

        Ok(vec![WatchEventInternal {
            path: path_ref.to_path_buf(),
            r#type: event_type,
            origin: origin.to_owned(),
        }])
    }

    #[cfg(target_os = "windows")]
    {
        // Skip directory events
        if meta_is_dir(metadata) {
            return Ok(vec![]);
        }
        Ok(create_watch_event_internal(origin, event_kind, path_ref))
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        use crate::native::walker::nx_walker_sync;
        use ignore::Match;
        use ignore::gitignore::GitignoreBuilder;

        if matches!(event_kind, EventKind::Create(CreateKind::Folder)) {
            let mut result = vec![];

            let mut gitignore_builder = GitignoreBuilder::new(origin);
            let origin_path: &Path = origin.as_ref();
            gitignore_builder.add(origin_path.join(".nxignore"));
            let ignore = gitignore_builder.build()?;

            for path in nx_walker_sync(path_ref, None) {
                let path = path_ref.join(path);
                let is_dir = path.is_dir();
                if is_dir
                    || matches!(
                        ignore.matched_path_or_any_parents(&path, is_dir),
                        Match::Ignore(_)
                    )
                {
                    continue;
                }

                result.push(WatchEventInternal {
                    path,
                    r#type: EventType::create,
                    origin: origin.to_owned(),
                });
            }

            Ok(result)
        } else {
            Ok(create_watch_event_internal(origin, event_kind, path_ref))
        }
    }
}

#[allow(dead_code)]
// this is used in linux and windows blocks, and will show as "dead code" in macos
fn create_watch_event_internal(
    origin: &str,
    event_kind: &EventKind,
    path_ref: &Path,
) -> Vec<WatchEventInternal> {
    let event_type = match event_kind {
        EventKind::Create(CreateKind::File) => EventType::create,
        // Windows reports CreateKind::Any for file creation via ReadDirectoryChangesW
        EventKind::Create(CreateKind::Any) => EventType::create,
        EventKind::Modify(ModifyKind::Name(RenameMode::To)) => EventType::create,
        EventKind::Modify(ModifyKind::Name(RenameMode::From)) => EventType::delete,
        EventKind::Modify(_) => EventType::update,
        _ => EventType::update,
    };

    vec![WatchEventInternal {
        path: path_ref.into(),
        r#type: event_type,
        origin: origin.to_owned(),
    }]
}
