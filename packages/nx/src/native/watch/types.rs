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
        let path = value.path.display().to_string();

        #[cfg(windows)]
        let path = path.replace('\\', "/");

        WatchEvent {
            path,
            r#type: value.r#type,
        }
    }
}

/// `path` is stored relative to the watcher origin so it can be hashed,
/// merged, and surfaced to JS without re-stripping a prefix each time.
#[derive(Debug, Clone)]
pub(super) struct WatchEventInternal {
    pub path: PathBuf,
    pub r#type: EventType,
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

    // Only treat a stat-fail as delete when notify actually says the file
    // was removed. A transient stat failure during an atomic rename (the
    // file briefly doesn't exist between unlink and rename) would
    // otherwise misclassify a Modify/Create event as Delete — which then
    // makes updateFilesInContext remove the still-existing file from the
    // workspace context, silently dropping projects from the project
    // graph. For non-Remove kinds, fall through to the platform-specific
    // handling which derives the type from event_kind without re-statting.
    if !meta_exists(metadata) && matches!(event_kind, EventKind::Remove(_)) {
        return Ok(vec![WatchEventInternal {
            path: relative_to_origin(path_ref, origin),
            r#type: EventType::delete,
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
            // FSEvents on macOS coalesces operations and doesn't always
            // emit `EventKind::Remove(_)` for an `rm` (so the cross-
            // platform early-return that catches Linux removals can
            // miss them here). When stat fails we infer the file is
            // gone — risking a false Delete during a transient
            // atomic-rename window, but matching the behavior the
            // pre-fix watcher had on macOS so real removals classify
            // correctly.
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
            path: relative_to_origin(path_ref, origin),
            r#type: event_type,
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
                    path: relative_to_origin(&path, origin),
                    r#type: EventType::create,
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
        // notify-rs emits a coalesced rename event with both old and new
        // paths in addition to the per-side From/To events. Skip it: the
        // From/To pair already classifies correctly, and treating the
        // coalesced event as a generic Modify would override the From's
        // Delete on the source path with an erroneous Update.
        EventKind::Modify(ModifyKind::Name(RenameMode::Both | RenameMode::Any)) => {
            return Vec::new();
        }
        EventKind::Modify(_) => EventType::update,
        _ => EventType::update,
    };

    vec![WatchEventInternal {
        path: relative_to_origin(path_ref, origin),
        r#type: event_type,
    }]
}

/// Strip the watcher origin prefix from an event path. Falls back to the
/// original path if it doesn't live under origin (shouldn't happen — the
/// filterer rejects those — but we don't want a panic if it does).
fn relative_to_origin(path: &Path, origin: &str) -> PathBuf {
    path.strip_prefix(origin)
        .map(Path::to_path_buf)
        .unwrap_or_else(|_| path.to_path_buf())
}
