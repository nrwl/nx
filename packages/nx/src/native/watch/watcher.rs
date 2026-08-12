use std::collections::{HashMap, HashSet};
use std::path::{MAIN_SEPARATOR, Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};

use crossbeam_channel::{Receiver, Sender, bounded, select, unbounded};
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use notify::{RecursiveMode, Watcher as NotifyWatcher};
use parking_lot::Mutex;
use tracing::{debug, trace};

#[cfg(not(target_os = "macos"))]
use crate::native::glob::{NxGlobSet, build_glob_set};
use crate::native::utils::git::{is_linked_worktree_root, nested_linked_worktrees};
use crate::native::walker::HARDCODED_IGNORE_PATTERNS;
#[cfg(not(target_os = "macos"))]
use crate::native::walker::create_walker;
use crate::native::watch::types::{
    EventType, RawWatchEvent, WatchEvent, WatchEventInternal, transform_event_to_watch_events,
};
use crate::native::watch::watch_filterer;

/// now − mtime in ms; `-1` if mtime is unreadable. Surfaces upstream
/// delivery delay (kernel → inotify → notify worker → notify_rx).
#[inline]
fn event_age_ms(metadata: &std::io::Result<std::fs::Metadata>) -> i128 {
    metadata
        .as_ref()
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|mtime| SystemTime::now().duration_since(mtime).ok())
        .map(|d| d.as_millis() as i128)
        .unwrap_or(-1)
}

/// Trailing-edge debounce: emit accumulated events after this much silence.
const IDLE_WINDOW: Duration = Duration::from_millis(100);
/// Starvation cap from the start of a burst — flush even if events keep
/// arriving faster than IDLE_WINDOW.
const MAX_WAIT: Duration = Duration::from_millis(500);
/// Grace for the kernel→notify hop before the first event arrives; short so an
/// idle force-flush adds no latency. macOS FSEvents lags more than inotify.
#[cfg(target_os = "macos")]
const FORCE_FLUSH_GRACE: Duration = Duration::from_millis(50);
#[cfg(not(target_os = "macos"))]
const FORCE_FLUSH_GRACE: Duration = Duration::from_millis(10);
/// Silence window that ends a trickling burst once collection is underway.
/// Larger than FORCE_FLUSH_GRACE so inter-event gaps under load aren't mistaken
/// for the burst ending; only paid while events keep arriving.
const FORCE_FLUSH_QUIET: Duration = Duration::from_millis(50);
/// Overall cap, kept under the 500ms reply timeout in `force_flush_pending` so
/// a late reply isn't read as "no changes".
const FORCE_FLUSH_MAX: Duration = Duration::from_millis(250);

#[cfg(not(target_os = "macos"))]
fn build_ignore_glob_set() -> Arc<NxGlobSet> {
    build_glob_set(HARDCODED_IGNORE_PATTERNS).expect("These static ignores always build")
}

/// Returns Err on `MaxFilesWatch` — the inotify limit is fatal since
/// every subsequent registration would fail too. Other errors are
/// warn-logged and skipped.
#[cfg(not(target_os = "macos"))]
fn register_watches<I, P>(
    watcher: &mut notify::RecommendedWatcher,
    paths: I,
) -> std::result::Result<(), notify::Error>
where
    I: IntoIterator<Item = P>,
    P: AsRef<Path>,
{
    for path in paths {
        let path = path.as_ref();
        if let Err(e) = watcher.watch(path, RecursiveMode::NonRecursive) {
            if matches!(e.kind, notify::ErrorKind::MaxFilesWatch) {
                return Err(e);
            }
            tracing::warn!(?e, ?path, "failed to watch directory");
        }
    }
    Ok(())
}

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
    path_set.insert(directory.as_ref().to_path_buf());
    path_set
}

type NotifyResult = std::result::Result<notify::Event, notify::Error>;

pub(crate) type WatchEventCallback =
    Box<dyn Fn(std::result::Result<Vec<WatchEvent>, String>) + Send + Sync + 'static>;

type ForceFlushReply = Sender<Vec<WatchEvent>>;

/// Session config + loop state. Built on the calling thread, then run
/// by the flush thread.
struct WatchPipeline {
    filterer: watch_filterer::WatchFilterer,
    notify_rx: Receiver<NotifyResult>,
    watcher: notify::RecommendedWatcher,
    /// `origin` with a trailing path separator.
    origin_path: String,
    #[cfg(not(target_os = "macos"))]
    ignore_globs: Arc<NxGlobSet>,

    accumulator: HashMap<PathBuf, WatchEventInternal>,
    burst_start: Option<Instant>,
    flush_deadline: Option<Instant>,
}

impl WatchPipeline {
    fn new(
        origin: String,
        additional_globs: &[String],
        use_ignore: bool,
    ) -> std::result::Result<Self, String> {
        // Linked worktrees are full checkouts nested in the workspace. The
        // walker prunes them from the initial registration, but the filterer
        // needs them too: macOS watches the root recursively, so pruning the
        // walk alone would not keep their events out. This is only the
        // starting set - `track_new_worktrees` adds any created later.
        let worktrees: Vec<PathBuf> = nested_linked_worktrees(&origin)
            .into_iter()
            .map(|relative| Path::new(&origin).join(relative))
            .collect();

        let filterer =
            watch_filterer::create_filter(&origin, additional_globs, &worktrees, use_ignore)
                .map_err(|e| format!("failed to create watch filter: {e}"))?;

        let (notify_tx, notify_rx) = unbounded::<NotifyResult>();
        let mut watcher = notify::recommended_watcher(move |event| {
            let _ = notify_tx.send(event);
        })
        .map_err(|e| format!("failed to create file watcher: {e}"))?;

        #[cfg(target_os = "macos")]
        if let Err(e) = watcher.watch(Path::new(&origin), RecursiveMode::Recursive) {
            tracing::error!(?e, "failed to watch root directory");
        }
        #[cfg(not(target_os = "macos"))]
        register_watches(&mut watcher, enumerate_watch_paths(&origin, use_ignore))
            .map_err(|e| format!("failed to register initial watches: {e}"))?;

        let mut origin_path = origin.clone();
        if !origin_path.ends_with(MAIN_SEPARATOR) {
            origin_path.push(MAIN_SEPARATOR);
        }

        Ok(WatchPipeline {
            filterer,
            notify_rx,
            watcher,
            origin_path,
            #[cfg(not(target_os = "macos"))]
            ignore_globs: build_ignore_glob_set(),
            accumulator: HashMap::new(),
            burst_start: None,
            flush_deadline: None,
        })
    }

    /// Delete wins over earlier states; Create wins over earlier
    /// Update/Delete; Update wins only over Delete. `git checkout`'s
    /// unlink+create needs (Delete, Create) → Create — otherwise the
    /// workspace context drops the still-existing file.
    fn merge_event(&mut self, incoming: WatchEventInternal) {
        if let Some(existing) = self.accumulator.get_mut(&incoming.path) {
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
            self.accumulator.insert(incoming.path.clone(), incoming);
        }
    }

    fn snapshot_events(&self) -> Vec<WatchEvent> {
        self.accumulator.values().map(|e| e.into()).collect()
    }

    fn reset_burst(&mut self) {
        self.accumulator.clear();
        self.burst_start = None;
        self.flush_deadline = None;
    }

    /// Teach the filterer about a worktree created since it booted.
    ///
    /// `git worktree add` writes the checkout's `.git` gitfile before it
    /// populates the tree, so catching that one event keeps the rest of the
    /// checkout out. Runs on every platform: on macOS the recursive watch on
    /// the root means the filterer is the *only* thing standing between a new
    /// worktree and the daemon, and `new_directories_from_event` below - which
    /// covers the Linux/Windows per-directory registration - is not compiled
    /// there.
    ///
    /// Two filters run before [`is_linked_worktree_root`], and both exist to
    /// keep this from feeding itself. It runs ahead of the filterer - it has
    /// to, or the gitfile would be discarded as a `.git` path before it was
    /// read - so nothing else stops a `.git` event here, and answering one by
    /// opening a `.git` publishes another. That is a closed loop: the
    /// workspace's own `.git` produced ~2M events per run, starving every real
    /// change behind them.
    ///
    /// Only a *file* can be a gitfile, and the event already carries the stat
    /// (`fs::metadata` publishes nothing, unlike a read), so the main
    /// repository's `.git` directory is skipped without touching the disk.
    /// Only a *create* can be the moment a worktree appears, which keeps the
    /// modify and access events on a worktree's own gitfile - the same loop,
    /// one directory over - from reopening it.
    fn track_new_worktrees(&mut self, event: &RawWatchEvent) {
        use crate::native::watch::types::meta_is_dir;
        use notify::EventKind;

        if !matches!(event.kind(), EventKind::Create(_)) {
            return;
        }

        let new_worktrees: Vec<PathBuf> = event
            .paths()
            .filter(|(path, metadata)| {
                !meta_is_dir(metadata) && path.file_name().is_some_and(|name| name == ".git")
            })
            .filter_map(|(path, _)| path.parent())
            .filter(|root| is_linked_worktree_root(root))
            .map(Path::to_path_buf)
            .collect();

        for root in new_worktrees {
            debug!(?root, "linked worktree appeared - blocking its events");
            self.filterer.track_worktree(&root);
        }
    }

    #[cfg(not(target_os = "macos"))]
    fn new_directories_from_event(&self, event: &RawWatchEvent) -> Vec<PathBuf> {
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
            .filter(|(path, metadata)| meta_is_dir(metadata) && !self.ignore_globs.is_match(path))
            .map(|(path, _)| path.to_path_buf())
            // Registering a worktree root would take a descriptor per
            // directory in it and backfill the checkout file by file.
            // `track_new_worktrees` handles the case where the directory
            // arrives before its gitfile: everything under it is filtered out
            // before reaching here, so nothing deeper gets registered.
            .filter(|path| !is_linked_worktree_root(path))
            .collect()
    }

    /// Roots of the linked worktrees nested in the workspace, absolute.
    ///
    /// Read from git's registry rather than accumulated from the event
    /// stream. `track_new_worktrees` only learns of a worktree from its
    /// `.git` gitfile's creation event, and on Linux and Windows that event
    /// is never generated: the checkout is created and its gitfile written
    /// before the directory has a watch, so there is nothing to notice. The
    /// registry is state, so it cannot be missed the same way.
    #[cfg(not(target_os = "macos"))]
    fn resolve_worktrees(&self) -> Vec<PathBuf> {
        let origin = Path::new(self.origin_path.trim_end_matches(MAIN_SEPARATOR));
        nested_linked_worktrees(origin)
            .into_iter()
            .map(|relative| origin.join(relative))
            .collect()
    }

    /// Synchronously register watches for new directories, walk them to
    /// backfill files written before the watch was active, and recurse
    /// into any nested subdirectories. Returns Err on `MaxFilesWatch`.
    #[cfg(not(target_os = "macos"))]
    fn register_and_backfill_new_dirs(
        &mut self,
        dirs: &[PathBuf],
    ) -> std::result::Result<(), notify::Error> {
        use crate::native::walker::nx_walker_sync;

        debug!(?dirs, "registering watches for new directories");
        register_watches(&mut self.watcher, dirs)?;

        // `nx_walker_sync` keeps the worktrees themselves out of the walk
        // below; telling the filterer about them is the other half. A watch
        // registered before the checkout existed still delivers events from
        // inside it, and the gitfile `track_new_worktrees` relies on is
        // written before any watch on that directory exists, so its creation
        // event is never generated here. Git's registry is state rather than
        // a notification, so it cannot be missed the same way.
        for root in self.resolve_worktrees() {
            debug!(
                ?root,
                "linked worktree found while backfilling - blocking it"
            );
            self.filterer.track_worktree(&root);
        }

        let mut nested_dirs: HashSet<PathBuf> = HashSet::new();
        let mut backfilled_paths: Vec<PathBuf> = Vec::new();
        for dir in dirs {
            for rel_path in nx_walker_sync(dir, None) {
                let full_path = dir.join(&rel_path);
                if full_path.is_dir() {
                    nested_dirs.insert(full_path);
                } else if full_path.is_file() {
                    let path = full_path
                        .strip_prefix(&self.origin_path)
                        .map(Path::to_path_buf)
                        .unwrap_or(full_path.clone());
                    backfilled_paths.push(path.clone());
                    self.merge_event(WatchEventInternal {
                        path,
                        r#type: EventType::create,
                    });
                }
            }
        }

        trace!(
            files = ?backfilled_paths,
            nested = ?nested_dirs,
            "backfilled {} files, {} nested dirs",
            backfilled_paths.len(),
            nested_dirs.len()
        );

        register_watches(&mut self.watcher, &nested_dirs)
    }

    /// Returns Err if the loop should exit and surface the message via
    /// the JS callback (e.g. inotify watch-limit reached).
    fn ingest_event(&mut self, event: NotifyResult) -> std::result::Result<(), String> {
        let event = match event {
            Ok(e) => e,
            Err(err) => {
                tracing::warn!("notify error: {:?}", err);
                return Ok(());
            }
        };

        let raw = RawWatchEvent::new(event);

        // Before the filter, so the gitfile of a worktree created just now
        // registers it rather than being discarded as a `.git` path.
        self.track_new_worktrees(&raw);

        if !self.filterer.check_event(&raw) {
            return Ok(());
        }

        // Trace only events that survive the filter — Access reads and
        // other floods are dropped above, so we don't pollute the log
        // with their misleading age_ms (mtime there is the prior write,
        // not the event).
        for (path, metadata) in raw.paths() {
            trace!(
                ?path,
                kind = ?raw.kind(),
                age_ms = event_age_ms(metadata),
                "ingest"
            );
        }

        #[cfg(not(target_os = "macos"))]
        {
            let new_dirs = self.new_directories_from_event(&raw);
            if !new_dirs.is_empty() {
                self.register_and_backfill_new_dirs(&new_dirs)
                    // Error message contains "inotify_add_watch" so the
                    // daemon-side fallback at project-graph.ts:432 fires.
                    .map_err(|e| {
                        format!("inotify_add_watch failed registering new directory watch: {e}")
                    })?;
            }
        }

        match transform_event_to_watch_events(&raw, &self.origin_path) {
            Ok(events) => {
                for e in events {
                    self.merge_event(e);
                }
            }
            Err(e) => tracing::warn!(?e, "event transform failed"),
        }

        let now = Instant::now();
        let bs = *self.burst_start.get_or_insert(now);
        self.flush_deadline = Some((now + IDLE_WINDOW).min(bs + MAX_WAIT));
        Ok(())
    }

    /// Drives the pipeline until force_flush_rx disconnects.
    fn run(mut self, force_flush_rx: Receiver<ForceFlushReply>, callback: WatchEventCallback) {
        loop {
            let idle_wait = self
                .flush_deadline
                .map(|d| d.saturating_duration_since(Instant::now()))
                .unwrap_or_else(|| Duration::from_secs(60 * 60));

            select! {
                recv(self.notify_rx) -> res => match res {
                    Ok(event) => {
                        if let Err(msg) = self.ingest_event(event) {
                            callback(Err(msg));
                            break;
                        }
                    }
                    Err(_) => {
                        callback(Err("watcher channel disconnected".to_string()));
                        break;
                    }
                },
                recv(force_flush_rx) -> res => match res {
                    Ok(reply) => {
                        // Collect concurrent ForceFlush replies so they all
                        // get the same snapshot; drain pending notify events
                        // first so the snapshot reflects everything submitted.
                        let mut replies = vec![reply];
                        while let Ok(extra) = force_flush_rx.try_recv() {
                            replies.push(extra);
                        }
                        let mut fatal: Option<String> = None;

                        let handler_started_at = Instant::now();

                        // Collect until delivery goes quiet. An idle channel
                        // returns after one short grace; once a burst is in
                        // progress each event restarts the longer
                        // FORCE_FLUSH_QUIET window so a trickle isn't cut
                        // mid-stream. Bounded by FORCE_FLUSH_MAX.
                        let deadline = handler_started_at + FORCE_FLUSH_MAX;
                        let mut burst_in_progress = !self.accumulator.is_empty();
                        while fatal.is_none() {
                            let now = Instant::now();
                            if now >= deadline {
                                break;
                            }
                            let window = if burst_in_progress {
                                FORCE_FLUSH_QUIET
                            } else {
                                FORCE_FLUSH_GRACE
                            };
                            let wait = window.min(deadline - now);
                            match self.notify_rx.recv_timeout(wait) {
                                Ok(event) => {
                                    burst_in_progress = true;
                                    if let Err(msg) = self.ingest_event(event) {
                                        fatal = Some(msg);
                                    }
                                }
                                Err(crossbeam_channel::RecvTimeoutError::Timeout) => break,
                                Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                                    fatal = Some("watcher channel disconnected".to_string());
                                }
                            }
                        }
                        let watch_events = self.snapshot_events();
                        debug!(
                            count = watch_events.len(),
                            replies = replies.len(),
                            elapsed = ?handler_started_at.elapsed(),
                            "force-flush END"
                        );
                        for e in &watch_events {
                            debug!("  [{:?}] {}", e.r#type, e.path);
                        }
                        let mut any_delivered = false;
                        for r in replies {
                            match r.send(watch_events.clone()) {
                                Ok(()) => any_delivered = true,
                                Err(e) => tracing::warn!(?e, "force-flush reply failed"),
                            }
                        }
                        if any_delivered {
                            self.reset_burst();
                        }
                        if let Some(msg) = fatal {
                            callback(Err(msg));
                            break;
                        }
                    }
                    Err(_) => break, // struct dropped or stop() called
                },
                default(idle_wait) => {
                    if !self.accumulator.is_empty() {
                        let events = self.snapshot_events();
                        debug!(count = events.len(), "idle-window emitting events");
                        for e in &events {
                            debug!("  [{:?}] {}", e.r#type, e.path);
                        }
                        callback(Ok(events));
                    }
                    self.reset_burst();
                }
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
    /// Always applies HARDCODED_IGNORE_PATTERNS plus watcher-specific
    /// patterns (vite/vitest timestamp files), regardless of `use_ignore`.
    #[napi(constructor)]
    pub fn new(
        origin: String,
        additional_globs: Option<Vec<String>>,
        use_ignore: Option<bool>,
    ) -> Watcher {
        let mut globs: Vec<String> = HARDCODED_IGNORE_PATTERNS
            .iter()
            .map(|p| (*p).to_string())
            .collect();

        // Vite/Vitest write timestamp files that we don't want to watch.
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
        // Adapt the napi ThreadsafeFunction to the generic callback the
        // loop uses, so the loop is testable without a JS runtime.
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

        let pipeline =
            WatchPipeline::new(self.origin.clone(), &self.additional_globs, self.use_ignore)
                .map_err(|msg| Error::new(Status::GenericFailure, msg))?;

        let (force_flush_tx, force_flush_rx) = unbounded::<ForceFlushReply>();
        *self.force_flush_tx.lock() = Some(force_flush_tx);

        std::thread::spawn(move || pipeline.run(force_flush_rx, callback));

        debug!(origin = %self.origin, "watching started");
        Ok(())
    }

    #[napi]
    pub async fn stop(&self) -> Result<()> {
        *self.force_flush_tx.lock() = None;
        debug!(origin = %self.origin, "watching stopped");
        Ok(())
    }

    /// Synchronously drains the accumulator. Used by the daemon before
    /// serving a cached project graph so events buffered inside the
    /// IDLE_WINDOW debounce don't go missing. Returns an empty vec if
    /// the watcher hasn't started, the loop has exited, or no events
    /// are buffered.
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
        reply_rx
            .recv_timeout(Duration::from_millis(500))
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::utils::git::test_support::register_worktree;
    use crate::native::watch::types::EventType;
    use std::fs;
    use std::sync::Mutex;
    use std::time::Duration;
    use tempfile::tempdir;

    // Tests drive the public Watcher API end-to-end with real fs ops
    // through `watch_inner` (the non-napi inner of `watch`). The
    // callback appends every emitted batch into a shared Vec.

    type Captured = Arc<Mutex<Vec<WatchEvent>>>;

    fn start_watcher(dir: &Path) -> (Watcher, Captured) {
        // Canonicalize: on macOS `/tmp` symlinks to `/private/tmp`, so
        // events arrive with the canonical prefix while origin would
        // not. The filterer's `path.starts_with(origin)` check needs
        // them to agree.
        let canonical = dir.canonicalize().expect("canonicalize tempdir");
        let mut w = Watcher::new(
            canonical.to_str().expect("utf-8 path").to_string(),
            None,
            Some(false), // disable gitignore so the platform's tmp tree can't influence the test
        );
        let captured: Captured = Arc::new(Mutex::new(Vec::new()));
        let captured_for_cb = captured.clone();
        let callback: WatchEventCallback = Box::new(move |res| {
            if let Ok(events) = res {
                captured_for_cb.lock().unwrap().extend(events);
            }
        });
        w.watch_inner(callback).expect("start watch");
        // Drop any startup events FSEvents leaks from before the watch began.
        std::thread::sleep(Duration::from_millis(300));
        captured.lock().unwrap().clear();
        (w, captured)
    }

    /// Wait past one IDLE_WINDOW so the loop emits, then return what
    /// the callback collected.
    fn collect(captured: &Captured) -> Vec<WatchEvent> {
        std::thread::sleep(Duration::from_millis(250));
        captured.lock().unwrap().clone()
    }

    fn find_event<'a>(events: &'a [WatchEvent], name: &str) -> Option<&'a WatchEvent> {
        events.iter().find(|e| e.path.ends_with(name))
    }

    #[test]
    fn git_style_unlink_then_write_yields_create() {
        // Regression: `git checkout` does unlink+create on tracked
        // files. Pre-fix the accumulator's "Delete always wins" rule
        // dropped the Create and updateFilesInContext removed the
        // still-existing file from the workspace context.
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
        // Vim-style save: write to a sibling tmp file, then rename it
        // over the target. inotify on the target sees IN_MOVED_TO,
        // which we classify as Create.
        let dir = tempdir().expect("tempdir");
        let target = dir.path().join("foo.txt");
        let staging = dir.path().join("foo.txt.swp");
        fs::write(&target, "v1").expect("initial write");

        let (_watcher, captured) = start_watcher(dir.path());

        fs::write(&staging, "v2-via-rename").expect("staging write");
        fs::rename(&staging, &target).expect("atomic rename");

        let events = collect(&captured);
        // Exact match so the staging file's event can't satisfy us.
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
        // Regression: pre-fix the loop dropped "extra" ForceFlush
        // replies, so concurrent callers blocked on the 500 ms
        // recv_timeout. Now every queued reply gets the same snapshot.
        let dir = tempdir().expect("tempdir");
        let (watcher, _captured) = start_watcher(dir.path());
        let watcher = Arc::new(watcher);

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
        assert!(
            elapsed < Duration::from_millis(250),
            "concurrent force_flush_pending took {elapsed:?} — likely caller(s) hit the 500ms timeout"
        );
    }

    #[test]
    fn multi_file_burst_all_appear_in_one_flush() {
        let dir = tempdir().expect("tempdir");
        let a = dir.path().join("a.txt");
        let b = dir.path().join("b.txt");
        let c = dir.path().join("c.txt");

        let (_watcher, captured) = start_watcher(dir.path());

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
    fn force_flush_pending_captures_in_flight_writes() {
        // Write + immediate flush, hammered to surface the race.
        let dir = tempdir().expect("tempdir");
        let target = dir.path().join("nx.json");
        fs::write(&target, "v1").expect("initial write");

        let (watcher, _captured) = start_watcher(dir.path());

        for i in 0..20 {
            fs::write(&target, format!("v{i}")).expect("rewrite");
            let events = watcher.force_flush_pending();
            assert!(
                events.iter().any(|e| e.path == "nx.json"),
                "iteration {i}: missed nx.json event — got {events:?}"
            );
        }
    }

    #[test]
    fn write_immediately_after_watch_registration_is_captured() {
        // The daemon starts watching before scanning the workspace; that
        // only closes the boot blind window if a write landing right after
        // watch() returns is never missed. No settling sleep on purpose —
        // start_watcher() is not used because it sleeps after registration.
        let dir = tempdir().expect("tempdir");
        let canonical = dir.path().canonicalize().expect("canonicalize tempdir");
        let mut watcher = Watcher::new(
            canonical.to_str().expect("utf-8 path").to_string(),
            None,
            Some(false),
        );
        let captured: Captured = Arc::new(Mutex::new(Vec::new()));
        let captured_for_cb = captured.clone();
        let callback: WatchEventCallback = Box::new(move |res| {
            if let Ok(events) = res {
                captured_for_cb.lock().unwrap().extend(events);
            }
        });
        watcher.watch_inner(callback).expect("start watch");

        fs::write(canonical.join("boot.txt"), "x").expect("write");

        let deadline = Instant::now() + Duration::from_secs(2);
        loop {
            let flushed = watcher.force_flush_pending();
            let seen = flushed.iter().any(|e| e.path == "boot.txt")
                || captured
                    .lock()
                    .unwrap()
                    .iter()
                    .any(|e| e.path == "boot.txt");
            if seen {
                break;
            }
            assert!(
                Instant::now() < deadline,
                "write immediately after watch registration was never reported"
            );
            std::thread::sleep(Duration::from_millis(50));
        }
    }

    #[test]
    fn force_flush_pending_captures_trickling_burst() {
        // Regression: force-flush used to drain only already-arrived events,
        // cutting a burst delivered with gaps mid-stream and serving a stale
        // graph. Writes are spaced 20ms apart — past the 10ms Linux grace but
        // under FORCE_FLUSH_QUIET — so the last write must still be captured.
        let dir = tempdir().expect("tempdir");
        let (watcher, _captured) = start_watcher(dir.path());
        let dir_path = dir.path().to_path_buf();

        let writer = std::thread::spawn(move || {
            for i in 0..5 {
                fs::write(dir_path.join(format!("t{i}.txt")), "x").expect("write");
                std::thread::sleep(Duration::from_millis(20));
            }
        });

        // Flush while writes are still trickling in.
        std::thread::sleep(Duration::from_millis(5));
        let events = watcher.force_flush_pending();
        writer.join().unwrap();

        assert!(
            events.iter().any(|e| e.path == "t4.txt"),
            "flush cut the burst mid-stream; expected trailing write t4.txt — got {events:?}"
        );
    }

    #[test]
    fn rename_yields_delete_for_old_and_create_for_new() {
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
    fn linked_worktree_paths_never_reach_callback() {
        // The walker keeps a worktree's directories out of the initial
        // registration, but macOS watches the root recursively - the filterer
        // has to block them on its own.
        let dir = tempdir().expect("tempdir");
        let root = dir.path().canonicalize().expect("canonicalize");

        let worktree = root.join("other/wt");
        register_worktree(&root, "wt", &worktree);
        fs::write(worktree.join("seed.txt"), "x").expect("seed write");

        let (_watcher, captured) = start_watcher(&root);

        fs::write(worktree.join("touched.txt"), "y").expect("worktree write");
        // Un-ignored write proves the watcher is alive.
        fs::write(root.join("alive.txt"), "z").expect("alive write");

        let events = collect(&captured);
        assert!(
            events.iter().any(|e| e.path == "alive.txt"),
            "expected an event for alive.txt; got {events:?}"
        );

        let leaked: Vec<_> = events.iter().filter(|e| e.path.contains("wt/")).collect();
        assert!(
            leaked.is_empty(),
            "expected no events inside the worktree; got {leaked:?}"
        );
    }

    #[test]
    fn a_worktree_created_after_boot_is_blocked() {
        // The motivating workflow: agent tooling runs `git worktree add`
        // against a daemon that is already watching. The boot-time snapshot
        // can't know about it, and on macOS the root is watched recursively,
        // so without picking it up from the event stream the whole checkout
        // floods the pipeline until the daemon restarts.
        let dir = tempdir().expect("tempdir");
        let root = dir.path().canonicalize().expect("canonicalize");
        fs::create_dir_all(root.join(".git")).expect("mkdir .git");

        let (_watcher, captured) = start_watcher(&root);

        let worktree = root.join(".claude/worktrees/wt");
        register_worktree(&root, "wt", &worktree);
        // Let the gitfile's event land before the checkout is populated,
        // the way `git worktree add` orders it.
        std::thread::sleep(Duration::from_millis(300));

        fs::write(worktree.join("app.ts"), "x").expect("worktree write");
        // Un-ignored write proves the watcher is alive.
        fs::write(root.join("alive.txt"), "z").expect("alive write");

        let events = collect(&captured);
        assert!(
            events.iter().any(|e| e.path == "alive.txt"),
            "expected an event for alive.txt; got {events:?}"
        );

        let leaked: Vec<_> = events
            .iter()
            .filter(|e| e.path.contains("worktrees/wt/"))
            .collect();
        assert!(
            leaked.is_empty(),
            "expected no events inside a worktree created after boot; got {leaked:?}"
        );
    }

    #[test]
    fn a_populated_worktree_created_after_boot_is_not_backfilled() {
        // The checkout is populated immediately after its gitfile, the way
        // `git worktree add` does it, rather than after a settle. That lands
        // the files before any watch on the worktree exists, so they arrive
        // through the backfill walk instead of the event stream - which
        // prunes only the hardcoded ignores and would otherwise report every
        // file in the checkout as created, and take an inotify descriptor for
        // every directory in it.
        let dir = tempdir().expect("tempdir");
        let root = dir.path().canonicalize().expect("canonicalize");
        fs::create_dir_all(root.join(".git")).expect("mkdir .git");

        let (_watcher, captured) = start_watcher(&root);

        let worktree = root.join(".claude/worktrees/wt");
        register_worktree(&root, "wt", &worktree);
        fs::create_dir_all(worktree.join("packages/app/src")).expect("mkdir checkout");
        for file in ["package.json", "packages/app/src/main.ts"] {
            fs::write(worktree.join(file), "x").expect("populate checkout");
        }
        // Un-ignored write proves the watcher is alive.
        fs::write(root.join("alive.txt"), "z").expect("alive write");

        let events = collect(&captured);
        assert!(
            events.iter().any(|e| e.path == "alive.txt"),
            "expected an event for alive.txt; got {events:?}"
        );

        let leaked: Vec<_> = events
            .iter()
            .filter(|e| e.path.contains("worktrees/wt/"))
            .collect();
        assert!(
            leaked.is_empty(),
            "expected no events from a worktree populated after boot; got {leaked:?}"
        );
    }

    #[test]
    fn hardcoded_ignored_paths_never_reach_callback() {
        // Guards against the filterer regressing — node_modules,
        // .git, .nx/cache, .nx/workspace-data, .yarn/cache must never
        // surface events.
        let dir = tempdir().expect("tempdir");

        // Create dirs before the watcher starts.
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
        // Un-ignored write proves the watcher is alive.
        fs::write(dir.path().join("alive.txt"), "z").expect("alive write");

        let events = collect(&captured);
        assert!(
            events.iter().any(|e| e.path == "alive.txt"),
            "expected an event for alive.txt; got {events:?}"
        );

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
