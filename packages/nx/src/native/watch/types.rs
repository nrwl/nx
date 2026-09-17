use std::cell::OnceCell;
use std::collections::HashMap;
use std::fs::{self, Metadata};
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};

use notify::event::{CreateKind, ModifyKind, RemoveKind, RenameMode};
use notify::{Event, EventKind};
use parking_lot::RwLock;
use tracing::trace;

use crate::native::watch::utils::canonicalize_event_paths;

/// A notify event with a per-path stat computed on demand. A stat is a
/// syscall (on Windows a `CreateFileW` + `GetFileInformationByHandle`), and
/// most events never need it: the event kind already says file-vs-directory,
/// and filtered events are discarded before any consumer looks. So the stat
/// is deferred to first access and skipped whenever the kind answers first.
pub(super) struct RawWatchEvent {
    pub event: Event,
    /// Parallel to `event.paths` — a lazily-populated stat per path.
    metadata: Vec<OnceCell<io::Result<Metadata>>>,
}

impl RawWatchEvent {
    pub fn new(event: Event) -> Self {
        let event = canonicalize_event_paths(&event);
        let metadata = event.paths.iter().map(|_| OnceCell::new()).collect();
        Self { event, metadata }
    }

    fn metadata_at(&self, index: usize) -> &io::Result<Metadata> {
        self.metadata[index].get_or_init(|| fs::metadata(&self.event.paths[index]))
    }

    /// Whether the path at `index` is a directory, answered from the event
    /// kind when notify reports it definitively and only otherwise by a stat.
    pub(super) fn is_dir_at(&self, index: usize) -> bool {
        match is_dir_from_kind(&self.event.kind) {
            Some(is_dir) => is_dir,
            None => meta_is_dir(self.metadata_at(index)),
        }
    }

    /// Whether the path at `index` exists. Always a stat — the kind cannot
    /// confirm a removal against the atomic-rename race, which is its one use.
    pub(super) fn exists_at(&self, index: usize) -> bool {
        meta_exists(self.metadata_at(index))
    }

    /// Iterate `(path, stat)`, forcing the lazy stat for each path. Used by
    /// consumers that genuinely need metadata (macOS classification, the
    /// trace log). Kind-answerable questions should use `is_dir_at` instead.
    pub fn paths(&self) -> impl Iterator<Item = (&Path, &io::Result<Metadata>)> + '_ {
        (0..self.event.paths.len())
            .map(move |i| (self.event.paths[i].as_path(), self.metadata_at(i)))
    }

    pub fn first_path(&self) -> Option<&Path> {
        self.event.paths.first().map(PathBuf::as_path)
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

/// `Some` only when notify states file-vs-directory definitively. `None` for
/// ambiguous kinds (`Any`, renames), which must fall back to a stat — a wrong
/// guess would send a directory path to JS or skip a real file.
pub(super) fn is_dir_from_kind(kind: &EventKind) -> Option<bool> {
    match kind {
        EventKind::Create(CreateKind::File) => Some(false),
        EventKind::Create(CreateKind::Folder) => Some(true),
        EventKind::Remove(RemoveKind::File) => Some(false),
        EventKind::Remove(RemoveKind::Folder) => Some(true),
        // inotify and ReadDirectoryChangesW raise Data only for files. FSEvents
        // does not distinguish, so macOS classifies from the stat instead.
        #[cfg(not(target_os = "macos"))]
        EventKind::Modify(ModifyKind::Data(_)) => Some(false),
        _ => None,
    }
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
    /// The kernel dropped events (e.g. an inotify queue overflow); per-path
    /// events cannot be trusted complete and consumers must re-walk.
    #[allow(non_camel_case_types)]
    rescan,
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
    let Some(path_ref) = value.first_path() else {
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
    // graph. The kind check is first so the confirming stat runs only on
    // Remove events, never on a create/write storm.
    if matches!(event_kind, EventKind::Remove(_)) && !value.exists_at(0) {
        return Ok(vec![WatchEventInternal {
            path: relative_to_origin(path_ref, origin),
            r#type: EventType::delete,
        }]);
    }

    #[cfg(target_os = "macos")]
    {
        use std::time::Duration;

        // FSEvents kinds are unreliable, so macOS classifies from the stat:
        // this is the one branch that genuinely needs metadata per event.
        let metadata = value.metadata_at(0);

        // A directory created or renamed into place carries files that had
        // no events of their own, so they are reported from a walk, as a new
        // folder is on Linux. Any other directory event is noise.
        if meta_is_dir(metadata) {
            return if matches!(
                event_kind,
                EventKind::Modify(ModifyKind::Metadata(_)) | EventKind::Access(_)
            ) {
                Ok(vec![])
            } else {
                folder_events(path_ref, origin)
            };
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
                // FSEvents reports Create for in-place updates of recently-active
                // paths; we disambiguate via inode timestamps. `fs::write` is
                // O_CREAT (stamps birthtime) + a separate write (stamps mtime)
                // ~100µs later, so strict ns equality mis-Updates fresh writes
                // and whole-second equality mis-Creates same-second updates.
                // Tolerance covers kernel jitter; bursts within IDLE_WINDOW
                // (100ms) coalesce and the (Create, Update) → Create merge rule
                // makes the per-event label immaterial inside that window.
                const FRESH_WRITE_TOLERANCE: Duration = Duration::from_millis(50);
                let delta = t
                    .modified()
                    .ok()
                    .zip(t.created().ok())
                    .and_then(|(m, b)| m.duration_since(b).ok());
                match delta {
                    Some(d) if d > FRESH_WRITE_TOLERANCE => EventType::update,
                    _ => EventType::create,
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
        // is_dir_at reads the kind first, so a definitive Create(File) skips
        // the stat; the ambiguous Modify(Any) that Windows delivers for a
        // write still stats. notify's Windows backend already stat'd to
        // classify the create, so the saved stat is a de-dup here — the
        // clean elimination lands on Linux. A directory created or renamed
        // into place is reported through its files, as on Linux.
        if value.is_dir_at(0) {
            return if matches!(
                event_kind,
                EventKind::Create(_) | EventKind::Modify(ModifyKind::Name(_))
            ) {
                folder_events(path_ref, origin)
            } else {
                Ok(vec![])
            };
        }
        Ok(create_watch_event_internal(origin, event_kind, path_ref))
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        // A directory moved into place arrives as a rename, not a creation,
        // and inotify reports nothing for the files inside it.
        let moved_in_dir = matches!(
            event_kind,
            EventKind::Modify(ModifyKind::Name(RenameMode::To))
        ) && fs::symlink_metadata(path_ref).is_ok_and(|m| m.is_dir());
        if matches!(event_kind, EventKind::Create(CreateKind::Folder)) || moved_in_dir {
            folder_events(path_ref, origin)
        } else {
            Ok(create_watch_event_internal(origin, event_kind, path_ref))
        }
    }
}

/// The ignore rules `folder_events` applies, built once per workspace root.
/// The root `.nxignore` is read at first use; a change to it restarts the
/// daemon, so the rules never go stale under it.
struct FolderEventRules {
    nxignore: ignore::gitignore::Gitignore,
    hardcoded: std::sync::Arc<crate::native::glob::NxGlobSet>,
}

fn folder_event_rules(origin: &str) -> anyhow::Result<Arc<FolderEventRules>> {
    use crate::native::glob::build_glob_set;
    use crate::native::walker::HARDCODED_IGNORE_PATTERNS;
    use ignore::gitignore::GitignoreBuilder;

    static RULES: OnceLock<RwLock<HashMap<String, Arc<FolderEventRules>>>> = OnceLock::new();
    let cache = RULES.get_or_init(Default::default);
    if let Some(rules) = cache.read().get(origin) {
        return Ok(Arc::clone(rules));
    }

    let mut builder = GitignoreBuilder::new(origin);
    let origin_path: &Path = origin.as_ref();
    builder.add(origin_path.join(".nxignore"));
    let rules = Arc::new(FolderEventRules {
        nxignore: builder.build()?,
        hardcoded: build_glob_set(HARDCODED_IGNORE_PATTERNS)?,
    });
    cache.write().insert(origin.to_string(), Arc::clone(&rules));
    Ok(rules)
}

/// A `create` for every file under a directory that appeared whole, so
/// files that had no events of their own are still reported. The root
/// `.nxignore` and the hardcoded ignores apply, as they do to the watch.
/// Links are not followed, the directory itself included: a linked directory
/// moved into the workspace would otherwise report files outside it.
fn folder_events(path_ref: &Path, origin: &str) -> anyhow::Result<Vec<WatchEventInternal>> {
    use ignore::Match;
    use walkdir::WalkDir;

    if fs::symlink_metadata(path_ref).map_or(true, |m| !m.is_dir()) {
        return Ok(vec![]);
    }

    // A checkout creates directories in bursts, and this runs on the watch
    // thread: rereading .nxignore and recompiling the globs per event would
    // hold up delivery.
    let rules = folder_event_rules(origin)?;
    let ignore = &rules.nxignore;
    let hardcoded = &rules.hardcoded;

    let result = WalkDir::new(path_ref)
        .follow_links(false)
        .follow_root_links(false)
        .into_iter()
        .filter_entry(|entry| !hardcoded.is_match(entry.path()))
        .flatten()
        .filter(|entry| !entry.file_type().is_dir())
        .filter(|entry| {
            !matches!(
                ignore.matched_path_or_any_parents(entry.path(), false),
                Match::Ignore(_)
            )
        })
        .map(|entry| WatchEventInternal {
            path: relative_to_origin(entry.path(), origin),
            r#type: EventType::create,
        })
        .collect();

    Ok(result)
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
