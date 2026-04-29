use std::collections::{HashMap, HashSet};
use std::path::{MAIN_SEPARATOR, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use crossbeam_channel::{Receiver, Sender, bounded, select, unbounded};
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use notify::{RecursiveMode, Watcher as NotifyWatcher};
use parking_lot::Mutex;
use tracing::trace;

#[cfg(not(target_os = "macos"))]
use std::path::Path;

#[cfg(not(target_os = "macos"))]
use crate::native::glob::{NxGlobSet, build_glob_set};
use crate::native::walker::HARDCODED_IGNORE_PATTERNS;
#[cfg(not(target_os = "macos"))]
use crate::native::walker::create_walker;
use crate::native::watch::types::{
    EventType, RawWatchEvent, WatchEvent, WatchEventInternal, transform_event_to_watch_events,
};
use crate::native::watch::watch_filterer;

/// Trailing-edge debounce window. The flush loop emits accumulated events
/// after this much silence on the notify channel. Resets on every event
/// so a burst of writes with gaps shorter than this coalesces into one flush.
const IDLE_WINDOW: Duration = Duration::from_millis(100);

/// Starvation cap. If events keep arriving faster than `IDLE_WINDOW`, the
/// debounce would never fire. This is the hardest the flush can be deferred
/// from the start of a burst, after which we flush anyway.
const MAX_WAIT: Duration = Duration::from_millis(500);

/// Build the hardcoded ignore GlobSet used to check if new directories should be watched.
#[cfg(not(target_os = "macos"))]
fn build_ignore_glob_set() -> Arc<NxGlobSet> {
    build_glob_set(HARDCODED_IGNORE_PATTERNS).expect("These static ignores always build")
}

/// Return the new, non-ignored directory paths from a single notify event,
/// if it is a directory-creation event. Used on Linux/Windows to register
/// watches synchronously when a directory appears.
#[cfg(not(target_os = "macos"))]
fn new_directories_from_event(event: &RawWatchEvent, ignore_globs: &NxGlobSet) -> Vec<PathBuf> {
    use crate::native::watch::types::meta_is_dir;
    use notify::{EventKind, event::CreateKind};

    if !matches!(
        event.kind(),
        EventKind::Create(CreateKind::Folder) | EventKind::Create(CreateKind::Any)
    ) {
        return Vec::new();
    }

    event
        .paths()
        .filter(|(path, metadata)| meta_is_dir(metadata) && !ignore_globs.is_match(path))
        .map(|(path, _)| path.to_path_buf())
        .collect()
}

/// Register each path with the watcher under a single lock acquisition.
/// Non-recursive mode; failure is logged but not propagated since a single
/// failing path shouldn't prevent others from being watched.
#[cfg(not(target_os = "macos"))]
fn register_watches<I, P>(watcher: &mut notify::RecommendedWatcher, paths: I)
where
    I: IntoIterator<Item = P>,
    P: AsRef<Path>,
{
    for path in paths {
        let path = path.as_ref();
        if let Err(e) = watcher.watch(path, RecursiveMode::NonRecursive) {
            tracing::warn!(?e, ?path, "failed to watch directory");
        }
    }
}

/// Register watches for newly created directories, walk them to backfill
/// files written before our watch became active, and register watches for
/// any nested subdirectories encountered. The walk's create events are
/// merged into the accumulator so they emit on the next flush.
#[cfg(not(target_os = "macos"))]
fn register_and_backfill_new_dirs(
    watcher: &mut notify::RecommendedWatcher,
    dirs: &[PathBuf],
    origin: &str,
    accumulator: &mut HashMap<PathBuf, WatchEventInternal>,
) {
    use crate::native::walker::nx_walker_sync;

    register_watches(watcher, dirs);

    let mut nested_dirs: HashSet<PathBuf> = HashSet::new();
    for dir in dirs {
        for rel_path in nx_walker_sync(dir, None) {
            let full_path = dir.join(&rel_path);
            if full_path.is_dir() {
                nested_dirs.insert(full_path);
            } else if full_path.is_file() {
                merge_event(
                    accumulator,
                    WatchEventInternal {
                        path: full_path,
                        r#type: EventType::create,
                        origin: origin.to_owned(),
                    },
                );
            }
        }
    }

    register_watches(watcher, &nested_dirs);
}

/// Enumerate all non-ignored directories to watch individually (non-recursively).
/// This avoids registering inotify watches on node_modules and other ignored trees.
#[cfg(not(target_os = "macos"))]
fn enumerate_watch_paths<P: AsRef<Path>>(directory: P, use_ignores: bool) -> HashSet<PathBuf> {
    let walker = create_walker(&directory, use_ignores);
    let mut path_set: HashSet<PathBuf> = HashSet::new();

    for entry in walker.build() {
        if let Ok(entry) = entry {
            if entry.file_type().map_or(false, |ft| ft.is_dir()) {
                path_set.insert(entry.into_path());
            }
        }
    }

    // Always include the root directory itself
    path_set.insert(directory.as_ref().to_path_buf());

    trace!(count = path_set.len(), "enumerated watch paths");
    path_set
}

/// Merge an event into the accumulator, keeping the most informative
/// classification for the file's final state. Delete wins over earlier
/// states; Create wins over earlier Update/Delete; Update wins only over
/// Delete (a file that came back). `git checkout`'s unlink+create needs
/// (Delete, Create) → Create — otherwise the workspace context drops the
/// still-existing file.
fn merge_event(
    accumulator: &mut HashMap<PathBuf, WatchEventInternal>,
    incoming: WatchEventInternal,
) {
    if let Some(existing) = accumulator.get_mut(&incoming.path) {
        let replace = match (existing.r#type, incoming.r#type) {
            (_, EventType::delete) => true,
            (_, EventType::create) => true,
            (EventType::delete, EventType::update) => true,
            _ => false,
        };
        if replace {
            *existing = incoming;
        }
    } else {
        accumulator.insert(incoming.path.clone(), incoming);
    }
}

/// Build the napi-facing event list from the accumulator without mutating
/// it. Pair with `reset_burst` after the events are successfully delivered.
fn snapshot_events(accumulator: &HashMap<PathBuf, WatchEventInternal>) -> Vec<WatchEvent> {
    accumulator.values().map(|e| e.into()).collect()
}

/// Clear the accumulator and burst tracking after a successful flush.
fn reset_burst(
    accumulator: &mut HashMap<PathBuf, WatchEventInternal>,
    burst_start: &mut Option<Instant>,
    flush_deadline: &mut Option<Instant>,
) {
    accumulator.clear();
    *burst_start = None;
    *flush_deadline = None;
}

/// Per-event pipeline: filter → new-directory backfill → transform →
/// merge → bump the flush deadline.
fn ingest_event(
    event: NotifyResult,
    accumulator: &mut HashMap<PathBuf, WatchEventInternal>,
    burst_start: &mut Option<Instant>,
    flush_deadline: &mut Option<Instant>,
    filterer: &watch_filterer::WatchFilterer,
    origin: &str,
    origin_path: &str,
    #[cfg(not(target_os = "macos"))] ignore_globs: &NxGlobSet,
    #[cfg(not(target_os = "macos"))] watcher: &mut notify::RecommendedWatcher,
) {
    let event = match event {
        Ok(e) => e,
        Err(err) => {
            tracing::warn!("notify error: {:?}", err);
            return;
        }
    };

    // Canonicalize and stat each path once; reuse across filter,
    // new-directory detection, and transform.
    let raw = RawWatchEvent::new(event);

    if !filterer.check_event(&raw) {
        return;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let new_dirs = new_directories_from_event(&raw, ignore_globs);
        if !new_dirs.is_empty() {
            register_and_backfill_new_dirs(watcher, &new_dirs, origin, accumulator);
        }
    }

    match transform_event_to_watch_events(&raw, origin_path) {
        Ok(events) => {
            for e in events {
                merge_event(accumulator, e);
            }
        }
        Err(e) => tracing::warn!(?e, "event transform failed"),
    }

    let now = Instant::now();
    let bs = *burst_start.get_or_insert(now);
    *flush_deadline = Some((now + IDLE_WINDOW).min(bs + MAX_WAIT));
}

type NotifyResult = std::result::Result<notify::Event, notify::Error>;

/// Generic event callback invoked from the flush loop. The napi `watch`
/// entry point wraps a `ThreadsafeFunction` in one of these so the loop
/// is testable without a JS runtime.
pub(crate) type WatchEventCallback =
    Box<dyn Fn(std::result::Result<Vec<WatchEvent>, String>) + Send + Sync + 'static>;

/// Reply channel for a single force-flush request. The flush loop sends
/// the snapshot back to the caller so `force_flush_pending` returns
/// synchronously.
type ForceFlushReply = Sender<Vec<WatchEvent>>;

/// Everything the flush loop needs once the watcher is live: built once
/// at startup by `WatchPipeline::new`, consumed by `run_flush_loop`.
struct WatchPipeline {
    filterer: watch_filterer::WatchFilterer,
    notify_rx: Receiver<NotifyResult>,
    /// Owns the notify_tx (via the closure passed to recommended_watcher).
    /// Mutated on Linux/Windows when a new directory event triggers
    /// synchronous registration.
    watcher: notify::RecommendedWatcher,
    origin: String,
    /// `origin` with a trailing path separator.
    origin_path: String,
    #[cfg(not(target_os = "macos"))]
    ignore_globs: Arc<NxGlobSet>,
}

impl WatchPipeline {
    fn new(
        origin: String,
        additional_globs: &[String],
        use_ignore: bool,
    ) -> std::result::Result<Self, String> {
        let filterer = watch_filterer::create_filter(&origin, additional_globs, use_ignore)
            .map_err(|e| format!("failed to create watch filter: {e}"))?;

        // notify_rx never leaves this struct. The watcher captures notify_tx
        // via the closure (notify-rs blanket-impls EventHandler for FnMut).
        let (notify_tx, notify_rx) = unbounded::<NotifyResult>();
        let mut watcher = notify::recommended_watcher(move |event| {
            let _ = notify_tx.send(event);
        })
        .map_err(|e| format!("failed to create file watcher: {e}"))?;

        #[cfg(target_os = "macos")]
        if let Err(e) = watcher.watch(std::path::Path::new(&origin), RecursiveMode::Recursive) {
            tracing::error!(?e, "failed to watch root directory");
        }
        #[cfg(not(target_os = "macos"))]
        for path in enumerate_watch_paths(&origin, use_ignore) {
            // Watch each non-ignored dir non-recursively so inotify never
            // covers node_modules etc.
            if let Err(e) = watcher.watch(&path, RecursiveMode::NonRecursive) {
                tracing::warn!(?e, ?path, "failed to watch path");
            }
        }

        let mut origin_path = origin.clone();
        if !origin_path.ends_with(MAIN_SEPARATOR) {
            origin_path.push(MAIN_SEPARATOR);
        }

        Ok(WatchPipeline {
            filterer,
            notify_rx,
            watcher,
            origin,
            origin_path,
            #[cfg(not(target_os = "macos"))]
            ignore_globs: build_ignore_glob_set(),
        })
    }
}

/// Drives the pipeline: reads notify events and force-flush requests
/// until force_flush_rx disconnects (the shutdown signal).
fn run_flush_loop(
    pipeline: WatchPipeline,
    force_flush_rx: Receiver<ForceFlushReply>,
    callback: WatchEventCallback,
) {
    let WatchPipeline {
        filterer,
        notify_rx,
        mut watcher,
        origin,
        origin_path,
        #[cfg(not(target_os = "macos"))]
        ignore_globs,
    } = pipeline;

    let mut accumulator: HashMap<PathBuf, WatchEventInternal> = HashMap::new();
    let mut burst_start: Option<Instant> = None;
    let mut flush_deadline: Option<Instant> = None;

    loop {
        let idle_wait = flush_deadline
            .map(|d| d.saturating_duration_since(Instant::now()))
            .unwrap_or_else(|| Duration::from_secs(60 * 60));

        select! {
            recv(notify_rx) -> res => match res {
                Ok(event) => ingest_event(
                    event,
                    &mut accumulator,
                    &mut burst_start,
                    &mut flush_deadline,
                    &filterer,
                    &origin,
                    &origin_path,
                    #[cfg(not(target_os = "macos"))] &ignore_globs,
                    #[cfg(not(target_os = "macos"))] &mut watcher,
                ),
                Err(_) => {
                    // Notify channel closed (watcher panicked / stopped).
                    callback(Err("watcher channel disconnected".to_string()));
                    break;
                }
            },
            recv(force_flush_rx) -> res => match res {
                Ok(reply) => {
                    // Drain any queued notify events so the snapshot reflects
                    // everything submitted up to this request, and collect any
                    // other queued ForceFlush replies so concurrent callers
                    // share the same answer.
                    let mut replies = vec![reply];
                    while let Ok(extra) = force_flush_rx.try_recv() {
                        replies.push(extra);
                    }
                    while let Ok(event) = notify_rx.try_recv() {
                        ingest_event(
                            event,
                            &mut accumulator,
                            &mut burst_start,
                            &mut flush_deadline,
                            &filterer,
                            &origin,
                            &origin_path,
                            #[cfg(not(target_os = "macos"))] &ignore_globs,
                            #[cfg(not(target_os = "macos"))] &mut watcher,
                        );
                    }
                    let watch_events = snapshot_events(&accumulator);
                    trace!(
                        count = watch_events.len(),
                        replies = replies.len(),
                        "force-flushing events"
                    );
                    let mut any_delivered = false;
                    for r in replies {
                        match r.send(watch_events.clone()) {
                            Ok(()) => any_delivered = true,
                            Err(e) => tracing::warn!(?e, "force-flush reply failed; caller gave up"),
                        }
                    }
                    if any_delivered {
                        reset_burst(&mut accumulator, &mut burst_start, &mut flush_deadline);
                    } else {
                        tracing::warn!(
                            "all force-flush replies failed; events retained in accumulator"
                        );
                    }
                }
                // Force-flush channel closed → struct dropped or stop()
                // called → shutdown.
                Err(_) => break,
            },
            default(idle_wait) => {
                if !accumulator.is_empty() {
                    callback(Ok(snapshot_events(&accumulator)));
                }
                reset_burst(&mut accumulator, &mut burst_start, &mut flush_deadline);
            }
        }
    }
}

#[napi]
pub struct Watcher {
    pub origin: String,
    additional_globs: Vec<String>,
    use_ignore: bool,
    /// `Mutex<Option>` so `stop()` can drop the sender via `&self`.
    /// When dropped, the flush loop's force_flush_rx reports
    /// `Disconnected` on its next select and the loop exits.
    force_flush_tx: Mutex<Option<Sender<ForceFlushReply>>>,
}

#[napi]
impl Watcher {
    /// Creates a new Watcher instance.
    /// Will always ignore directories from HARDCODED_IGNORE_PATTERNS plus
    /// watcher-specific patterns like vite/vitest timestamp files.
    #[napi(constructor)]
    pub fn new(
        origin: String,
        additional_globs: Option<Vec<String>>,
        use_ignore: Option<bool>,
    ) -> Watcher {
        // Start with hardcoded ignore patterns (same as walker.rs)
        let mut globs: Vec<String> = HARDCODED_IGNORE_PATTERNS
            .iter()
            .map(|p| (*p).to_string())
            .collect();

        // Add watcher-specific patterns (temporary files from build tools)
        globs.extend([
            "vitest.config.ts.timestamp*.mjs".into(),
            "vite.config.ts.timestamp*.mjs".into(),
            "vitest.config.mts.timestamp*.mjs".into(),
            "vite.config.mts.timestamp*.mjs".into(),
        ]);

        if let Some(additional_globs) = additional_globs {
            globs.extend(additional_globs);
        }

        let origin = if cfg!(windows) {
            origin.replace('/', "\\")
        } else {
            origin
        };

        Watcher {
            origin,
            additional_globs: globs,
            use_ignore: use_ignore.unwrap_or(true),
            force_flush_tx: Mutex::new(None),
        }
    }

    #[napi]
    pub fn watch(
        &mut self,
        #[napi(ts_arg_type = "(err: string | null, events: WatchEvent[]) => void")]
        callback_tsfn: ThreadsafeFunction<Vec<WatchEvent>>,
    ) -> Result<()> {
        // Bridge the napi ThreadsafeFunction into the generic callback the
        // inner watch loop expects, so the loop has no compile-time
        // dependency on napi types and can be exercised from Rust tests.
        let callback: WatchEventCallback = Box::new(move |res| match res {
            Ok(events) => {
                callback_tsfn.call(Ok(events), ThreadsafeFunctionCallMode::NonBlocking);
            }
            Err(msg) => {
                callback_tsfn.call(
                    Err(Error::new(Status::GenericFailure, msg)),
                    ThreadsafeFunctionCallMode::NonBlocking,
                );
            }
        });
        self.watch_inner(callback)
    }

    pub(crate) fn watch_inner(&mut self, callback: WatchEventCallback) -> Result<()> {
        crate::native::logger::enable_logger();

        // Build the pipeline synchronously on the calling thread so any
        // startup error surfaces directly via the Result return —
        // initial OS watches are guaranteed to be live by the time this
        // method returns successfully.
        let pipeline =
            WatchPipeline::new(self.origin.clone(), &self.additional_globs, self.use_ignore)
                .map_err(|msg| Error::new(Status::GenericFailure, msg))?;

        let (force_flush_tx, force_flush_rx) = unbounded::<ForceFlushReply>();
        *self.force_flush_tx.lock() = Some(force_flush_tx);

        std::thread::spawn(move || {
            run_flush_loop(pipeline, force_flush_rx, callback);
        });

        Ok(())
    }

    #[napi]
    pub async fn stop(&self) -> Result<()> {
        // Drop the sender → loop's force_flush_rx disconnects → loop exits.
        *self.force_flush_tx.lock() = None;
        Ok(())
    }

    /// Synchronously drain any events the watcher has accumulated and
    /// return them. Used by the daemon before serving a cached project
    /// graph so it can absorb everything the watcher has seen since the
    /// last flush — closing the IDLE_WINDOW debounce race where the
    /// daemon would otherwise serve a stale graph.
    ///
    /// Returns an empty vec if the watcher hasn't started yet, the
    /// flush loop has exited, or no events are buffered.
    #[napi]
    pub fn force_flush_pending(&self) -> Vec<WatchEvent> {
        let tx = match self.force_flush_tx.lock().clone() {
            Some(tx) => tx,
            None => return Vec::new(),
        };
        let (reply_tx, reply_rx) = bounded::<Vec<WatchEvent>>(1);
        if tx.send(reply_tx).is_err() {
            return Vec::new();
        }
        // Bound the wait so a wedged flush loop can't hang the daemon.
        // The round-trip is normally sub-millisecond.
        reply_rx
            .recv_timeout(Duration::from_millis(500))
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::watch::types::EventType;
    use std::fs;
    use std::sync::Mutex;
    use std::time::Duration;
    use tempfile::tempdir;

    // All tests below drive the public Watcher API end-to-end:
    //   inotify -> notify-rs -> ProcMsg channel -> EventIngestor
    //   (filter + transform + merge) -> accumulator -> idle-window
    //   flush -> callback
    //
    // We use `watch_inner` (a non-napi wrapper around the same loop the
    // napi `watch` entry point uses) so tests don't need a JS runtime.
    // The callback appends every emitted batch to a shared Vec, which
    // each test inspects after waiting for the IDLE_WINDOW debounce.

    /// Shared collector for events surfaced by the watcher callback.
    type Captured = Arc<Mutex<Vec<WatchEvent>>>;

    /// Spin up a real `Watcher` on `dir` with a callback that stores
    /// every emitted batch into `captured`. Returns the watcher (kept
    /// alive for the test's lifetime) and the shared collector.
    fn start_watcher(dir: &std::path::Path) -> (Watcher, Captured) {
        // Canonicalize: on macOS `/tmp` is a symlink to `/private/tmp`,
        // so `tempdir()` hands back `/tmp/.tmpXXX` while events arrive
        // canonicalized as `/private/tmp/.tmpXXX`. The filterer uses
        // `path.starts_with(origin)` to scope the synthetic gitignore
        // built from the hardcoded ignore patterns, and that check
        // would fail on macOS unless origin is also canonicalized —
        // so events under `node_modules` etc. would slip past the
        // filter. Canonicalizing here keeps both sides aligned.
        let canonical = dir.canonicalize().expect("canonicalize tempdir");
        let mut w = Watcher::new(
            canonical.to_str().expect("utf-8 path").to_string(),
            None,
            // Disable gitignore filtering so the test isn't sensitive to
            // any patterns that might be inherited from the platform's
            // tmp tree.
            Some(false),
        );
        let captured: Captured = Arc::new(Mutex::new(Vec::new()));
        let captured_for_cb = captured.clone();
        let callback: WatchEventCallback = Box::new(move |res| {
            if let Ok(events) = res {
                captured_for_cb.lock().unwrap().extend(events);
            }
        });
        w.watch_inner(callback).expect("start watch");
        // Wait for the processing thread to register inotify watches.
        // Without this the first fs op can fire before the watch is in
        // place and we'd miss the event.
        std::thread::sleep(Duration::from_millis(150));
        (w, captured)
    }

    /// Sleep long enough for IDLE_WINDOW (100ms) to elapse plus a small
    /// margin for the inotify -> channel hop, then return whatever the
    /// callback collected so far.
    fn collect(captured: &Captured) -> Vec<WatchEvent> {
        std::thread::sleep(Duration::from_millis(250));
        captured.lock().unwrap().clone()
    }

    fn find_event<'a>(events: &'a [WatchEvent], name: &str) -> Option<&'a WatchEvent> {
        events.iter().find(|e| e.path.ends_with(name))
    }

    #[test]
    fn git_style_unlink_then_write_yields_create() {
        // Regression: `git checkout` does unlink + create on some
        // tracked files. Pre-fix, the accumulator merged Delete + Create
        // and kept Delete because "Delete always wins". Downstream
        // updateFilesInContext then removed the (still-existing) file
        // from the workspace context — silently dropping the project
        // from the project graph. With the (Delete, Create) → Create
        // rule the file shows up as a fresh Create, which downstream
        // treats correctly as "exists".
        let dir = tempdir().expect("tempdir");
        let target = dir.path().join("foo.txt");
        fs::write(&target, "v1").expect("initial write");

        let (_watcher, captured) = start_watcher(dir.path());

        fs::remove_file(&target).expect("rm");
        fs::write(&target, "v2").expect("recreate");

        let events = collect(&captured);
        let evt = find_event(&events, "foo.txt")
            .unwrap_or_else(|| panic!("expected event for foo.txt; got {events:?}"));
        assert!(
            matches!(evt.r#type, EventType::create),
            "unlink+create (git-style update) should yield Create; got {:?}",
            evt.r#type
        );
    }

    #[test]
    fn vim_style_atomic_rename_yields_create() {
        // Vim and many editors save atomically: write content to a
        // temp file in the same directory, then rename it over the
        // target. inotify on the target sees IN_MOVED_TO, which
        // notify-rs translates to Modify(Name(RenameMode::To)) →
        // EventType::create. We assert that classification survives:
        // an atomic rename over an existing file should land as
        // Create, not Delete (which would erroneously remove the file
        // from the workspace context's index).
        let dir = tempdir().expect("tempdir");
        let target = dir.path().join("foo.txt");
        let staging = dir.path().join("foo.txt.swp");
        fs::write(&target, "v1").expect("initial write");

        let (_watcher, captured) = start_watcher(dir.path());

        // Atomic update: write to a sibling tmp, then rename over.
        fs::write(&staging, "v2-via-rename").expect("staging write");
        fs::rename(&staging, &target).expect("atomic rename");

        let events = collect(&captured);
        // Match on exact name to avoid the staging file ("foo.txt.swp")
        // accidentally satisfying an ends_with("foo.txt") check.
        let evt = events
            .iter()
            .find(|e| e.path == "foo.txt")
            .unwrap_or_else(|| panic!("expected event for foo.txt; got {events:?}"));
        assert!(
            matches!(evt.r#type, EventType::create),
            "atomic rename over existing file should yield Create; got {:?}",
            evt.r#type
        );
    }

    #[test]
    fn plain_update_yields_update() {
        // A normal in-place write to an existing file fires IN_MODIFY,
        // which classifies as EventType::update. The accumulator
        // should reflect that — not Create (file is not new) and not
        // Delete (file is not gone).
        let dir = tempdir().expect("tempdir");
        let target = dir.path().join("foo.txt");
        fs::write(&target, "v1").expect("initial write");

        let (_watcher, captured) = start_watcher(dir.path());

        fs::write(&target, "v2-updated").expect("update");

        let events = collect(&captured);
        let evt = find_event(&events, "foo.txt")
            .unwrap_or_else(|| panic!("expected event for foo.txt; got {events:?}"));
        assert!(
            matches!(evt.r#type, EventType::update),
            "in-place update should classify as Update; got {:?}",
            evt.r#type
        );
    }

    #[test]
    fn rm_yields_delete() {
        // Sanity: a real `rm` still produces a Delete after the fix.
        let dir = tempdir().expect("tempdir");
        let target = dir.path().join("foo.txt");
        fs::write(&target, "v1").expect("initial write");

        let (_watcher, captured) = start_watcher(dir.path());

        fs::remove_file(&target).expect("rm");

        let events = collect(&captured);
        let evt = find_event(&events, "foo.txt")
            .unwrap_or_else(|| panic!("expected event for foo.txt; got {events:?}"));
        assert!(
            matches!(evt.r#type, EventType::delete),
            "rm should classify as Delete; got {:?}",
            evt.r#type
        );
    }

    #[test]
    fn create_then_rm_yields_delete() {
        // Sanity: a transient file (created then removed) leaves Delete
        // in the accumulator since the file is gone. Without this, we'd
        // be falsely reporting a phantom file as still present.
        let dir = tempdir().expect("tempdir");
        let target = dir.path().join("ephemeral.txt");

        let (_watcher, captured) = start_watcher(dir.path());

        fs::write(&target, "hi").expect("create");
        fs::remove_file(&target).expect("rm");

        let events = collect(&captured);
        let evt = find_event(&events, "ephemeral.txt")
            .unwrap_or_else(|| panic!("expected event for ephemeral.txt; got {events:?}"));
        assert!(
            matches!(evt.r#type, EventType::delete),
            "create+rm should classify as Delete; got {:?}",
            evt.r#type
        );
    }

    #[test]
    fn fresh_create_yields_create() {
        // A brand-new file should land in the accumulator as Create.
        // On Linux fs::write fires both IN_CREATE and IN_MODIFY; the
        // merge logic's (Create, Update) → keep Create rule preserves
        // the more informative classification (file is new, not just
        // updated).
        let dir = tempdir().expect("tempdir");
        let target = dir.path().join("new.txt");

        let (_watcher, captured) = start_watcher(dir.path());

        fs::write(&target, "new").expect("create");

        let events = collect(&captured);
        let evt = find_event(&events, "new.txt")
            .unwrap_or_else(|| panic!("expected event for new.txt; got {events:?}"));
        assert!(
            matches!(evt.r#type, EventType::create),
            "fresh write should classify as Create; got {:?}",
            evt.r#type
        );
    }

    #[test]
    fn concurrent_force_flush_pending_callers_do_not_time_out() {
        // Regression: the processing thread used to drop "extra"
        // ForceFlush requests it found while draining the channel, so
        // any caller whose request landed in that drained batch would
        // wait the full 500ms recv_timeout before returning an empty
        // Vec. Multiple concurrent CLIs hitting the daemon would each
        // see that latency hit. The fix collects every queued reply
        // channel and sends the same snapshot to all of them, so every
        // caller returns immediately.
        let dir = tempdir().expect("tempdir");
        let (watcher, _captured) = start_watcher(dir.path());
        let watcher = Arc::new(watcher);

        // Fire several concurrent force_flush_pending calls. Pre-fix,
        // 1 would return immediately and the rest would each wait 500ms
        // for a reply that never arrived, yielding an empty Vec. Post-
        // fix, all of them collect into the same drained snapshot.
        let start = std::time::Instant::now();
        let mut handles = Vec::new();
        for _ in 0..8 {
            let w = watcher.clone();
            handles.push(std::thread::spawn(move || w.force_flush_pending()));
        }
        let results: Vec<Vec<WatchEvent>> =
            handles.into_iter().map(|h| h.join().unwrap()).collect();
        let elapsed = start.elapsed();

        assert_eq!(results.len(), 8);

        // Pre-fix this would be ~500ms because 7 of 8 callers timed
        // out. Post-fix every caller is answered as soon as the
        // processing thread services the first ForceFlush, which is
        // sub-millisecond. Allow generous slack for slow CI boxes but
        // well under the 500ms timeout.
        assert!(
            elapsed < Duration::from_millis(250),
            "concurrent force_flush_pending took {elapsed:?}, suggesting some callers \
             hit the 500ms recv_timeout — i.e. their ForceFlush reply was dropped"
        );
    }

    #[test]
    fn multi_file_burst_all_appear_in_one_flush() {
        // A burst of writes within IDLE_WINDOW should coalesce into a
        // single callback invocation containing every distinct path.
        // Verifies that the accumulator handles multiple keys correctly
        // and that the idle-window debounce doesn't split related
        // events across batches.
        let dir = tempdir().expect("tempdir");
        let a = dir.path().join("a.txt");
        let b = dir.path().join("b.txt");
        let c = dir.path().join("c.txt");

        let (_watcher, captured) = start_watcher(dir.path());

        // Three writes back-to-back, well within IDLE_WINDOW (100ms).
        fs::write(&a, "a").expect("write a");
        fs::write(&b, "b").expect("write b");
        fs::write(&c, "c").expect("write c");

        let events = collect(&captured);
        for name in ["a.txt", "b.txt", "c.txt"] {
            let evt = events
                .iter()
                .find(|e| e.path == name)
                .unwrap_or_else(|| panic!("expected event for {name}; got {events:?}"));
            assert!(
                matches!(evt.r#type, EventType::create),
                "{name} should classify as Create; got {:?}",
                evt.r#type
            );
        }
    }

    #[test]
    fn rename_yields_delete_for_old_and_create_for_new() {
        // Cross-name rename: the old path is gone, the new path is
        // freshly present. inotify fires IN_MOVED_FROM (old) and
        // IN_MOVED_TO (new); notify-rs maps these to
        // Modify(Name(RenameMode::From|To)) which our classification
        // turns into Delete and Create respectively.
        let dir = tempdir().expect("tempdir");
        let old = dir.path().join("old.txt");
        let new = dir.path().join("new.txt");
        fs::write(&old, "v1").expect("initial write");

        let (_watcher, captured) = start_watcher(dir.path());

        fs::rename(&old, &new).expect("rename");

        let events = collect(&captured);

        let old_evt = events
            .iter()
            .find(|e| e.path == "old.txt")
            .unwrap_or_else(|| panic!("expected event for old.txt; got {events:?}"));
        assert!(
            matches!(old_evt.r#type, EventType::delete),
            "rename source should classify as Delete; got {:?}",
            old_evt.r#type
        );

        let new_evt = events
            .iter()
            .find(|e| e.path == "new.txt")
            .unwrap_or_else(|| panic!("expected event for new.txt; got {events:?}"));
        assert!(
            matches!(new_evt.r#type, EventType::create),
            "rename destination should classify as Create; got {:?}",
            new_evt.r#type
        );
    }

    #[test]
    fn hardcoded_ignored_paths_never_reach_callback() {
        // Sanity guard against the filterer regressing: events under
        // the always-ignored paths (node_modules, .git, .nx/cache,
        // .nx/workspace-data, .yarn/cache) must never reach the
        // callback. If they did, every Nx workspace would be flooded
        // with event spam and the daemon would melt down.
        let dir = tempdir().expect("tempdir");

        // Create the ignored-path files BEFORE starting the watcher,
        // so the dirs themselves exist when watches register.
        for ignored in [
            "node_modules",
            ".git",
            ".nx/cache",
            ".nx/workspace-data",
            ".yarn/cache",
        ] {
            let d = dir.path().join(ignored);
            fs::create_dir_all(&d).expect("mkdir ignored");
            fs::write(d.join("seed.txt"), "x").expect("seed write");
        }

        let (_watcher, captured) = start_watcher(dir.path());

        // Touch a file in each ignored dir, plus one outside to prove
        // the watcher is alive.
        for ignored in [
            "node_modules",
            ".git",
            ".nx/cache",
            ".nx/workspace-data",
            ".yarn/cache",
        ] {
            fs::write(dir.path().join(ignored).join("touched.txt"), "y")
                .unwrap_or_else(|e| panic!("failed write in {ignored}: {e}"));
        }
        fs::write(dir.path().join("alive.txt"), "z").expect("alive write");

        let events = collect(&captured);

        // The watcher must have surfaced the un-ignored write.
        assert!(
            events.iter().any(|e| e.path == "alive.txt"),
            "expected an event for alive.txt; got {events:?}"
        );

        // None of the ignored prefixes should appear in any event path.
        for ignored in [
            "node_modules/",
            ".git/",
            ".nx/cache/",
            ".nx/workspace-data/",
            ".yarn/cache/",
        ] {
            let leaked: Vec<_> = events.iter().filter(|e| e.path.contains(ignored)).collect();
            assert!(
                leaked.is_empty(),
                "expected no events under {ignored}; got {leaked:?}"
            );
        }
    }
}
