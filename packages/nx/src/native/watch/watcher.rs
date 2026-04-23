use std::collections::HashMap;
use std::collections::HashSet;
use std::path::MAIN_SEPARATOR;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::RecvTimeoutError;
use std::time::{Duration, Instant};

#[cfg(not(target_os = "macos"))]
use crate::native::glob::{NxGlobSet, build_glob_set};
use crate::native::walker::HARDCODED_IGNORE_PATTERNS;
#[cfg(not(target_os = "macos"))]
use crate::native::walker::create_walker;
use crate::native::watch::types::{
    EventType, WatchEvent, WatchEventInternal, transform_event_to_watch_events,
};
use crate::native::watch::watch_filterer;
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use notify::{RecursiveMode, Watcher as NotifyWatcher};
use parking_lot::Mutex;
#[cfg(not(target_os = "macos"))]
use std::path::Path;
use std::path::PathBuf;
use tracing::trace;
use tracing_subscriber::EnvFilter;

/// Trailing-edge debounce window. The processing thread flushes accumulated
/// events after this much silence on the event channel. Resets on every event
/// so a burst of writes with gaps shorter than this coalesces into one flush.
const IDLE_WINDOW: Duration = Duration::from_millis(100);

/// Starvation cap. If events keep arriving faster than `IDLE_WINDOW`, the
/// debounce would never fire. This is the hardest the flush can be deferred
/// from the start of a burst, after which we flush anyway.
const MAX_WAIT: Duration = Duration::from_millis(500);

/// How often the processing thread wakes up while idle, so that a pending
/// `stop_flag` is observed promptly. The watcher's tx is owned by this thread,
/// so `rx.recv()` would never unblock on its own.
const SHUTDOWN_POLL: Duration = Duration::from_secs(1);

/// Build the hardcoded ignore GlobSet used to check if new directories should be watched.
#[cfg(not(target_os = "macos"))]
fn build_ignore_glob_set() -> Arc<NxGlobSet> {
    build_glob_set(HARDCODED_IGNORE_PATTERNS).expect("These static ignores always build")
}

/// Return the new, non-ignored directory paths from a single notify event,
/// if it is a directory-creation event. Used on Linux/Windows to register
/// watches synchronously when a directory appears.
#[cfg(not(target_os = "macos"))]
fn new_directories_from_event(event: &notify::Event, ignore_globs: &NxGlobSet) -> Vec<PathBuf> {
    use notify::EventKind;
    use notify::event::CreateKind;

    if !matches!(
        event.kind,
        EventKind::Create(CreateKind::Folder) | EventKind::Create(CreateKind::Any)
    ) {
        return Vec::new();
    }

    event
        .paths
        .iter()
        .filter(|path| path.is_dir() && !ignore_globs.is_match(path))
        .cloned()
        .collect()
}

/// Register each path with the watcher under a single lock acquisition.
/// Non-recursive mode; failure is logged but not propagated since a single
/// failing path shouldn't prevent others from being watched.
#[cfg(not(target_os = "macos"))]
fn register_watches<I, P>(watcher: &Arc<Mutex<notify::RecommendedWatcher>>, paths: I)
where
    I: IntoIterator<Item = P>,
    P: AsRef<Path>,
{
    let mut w = watcher.lock();
    for path in paths {
        let path = path.as_ref();
        if let Err(e) = w.watch(path, RecursiveMode::NonRecursive) {
            tracing::warn!(?e, ?path, "failed to watch directory");
        }
    }
}

/// Walk newly created directories to collect files that were written before
/// inotify started watching them. Returns nested subdirectories encountered
/// so the caller can register watches for them. Collected files are merged
/// into the accumulator and emitted on the next flush.
#[cfg(not(target_os = "macos"))]
fn walk_new_dirs_into_accumulator(
    dirs: &[PathBuf],
    origin: &str,
    accumulator: &mut HashMap<PathBuf, WatchEventInternal>,
) -> HashSet<PathBuf> {
    use crate::native::walker::nx_walker_sync;

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

    nested_dirs
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

/// Merge one event into the accumulator, keeping the stronger-priority event
/// for any given path. Priority is Delete > Create > Update.
fn merge_event(
    accumulator: &mut HashMap<PathBuf, WatchEventInternal>,
    incoming: WatchEventInternal,
) {
    if let Some(existing) = accumulator.get_mut(&incoming.path) {
        let replace = match (existing.r#type, incoming.r#type) {
            // Delete always wins.
            (_, EventType::delete) => true,
            // Create wins over Update (file that looked updated was really created).
            (EventType::update, EventType::create) => true,
            _ => false,
        };
        if replace {
            *existing = incoming;
        }
    } else {
        accumulator.insert(incoming.path.clone(), incoming);
    }
}

type NotifyResult = std::result::Result<notify::Event, notify::Error>;

#[napi]
pub struct Watcher {
    pub origin: String,
    stop_flag: Arc<AtomicBool>,
    additional_globs: Vec<String>,
    use_ignore: bool,
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
            stop_flag: Arc::new(AtomicBool::new(false)),
            additional_globs: globs,
            use_ignore: use_ignore.unwrap_or(true),
        }
    }

    #[napi]
    pub fn watch(
        &mut self,
        #[napi(ts_arg_type = "(err: string | null, events: WatchEvent[]) => void")]
        callback_tsfn: ThreadsafeFunction<Vec<WatchEvent>>,
    ) -> Result<()> {
        _ = tracing_subscriber::fmt()
            .with_env_filter(EnvFilter::from_env("NX_NATIVE_LOGGING"))
            .try_init();

        let origin = self.origin.clone();
        let additional_globs = self.additional_globs.clone();
        let use_ignore = self.use_ignore;
        let stop_flag = self.stop_flag.clone();

        // Create the filterer for path-based ignore matching.
        let filterer = watch_filterer::create_filter(&origin, &additional_globs, use_ignore)
            .map_err(|e| {
                Error::new(
                    Status::GenericFailure,
                    format!("Failed to create watch filter: {e}"),
                )
            })?;
        let filterer = Arc::new(filterer);

        // Channel for notify to send events to our processing thread.
        let (tx, rx) = std::sync::mpsc::channel::<NotifyResult>();

        // Create the notify watcher. Events are sent through the channel.
        let mut watcher = notify::recommended_watcher(tx).map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to create file watcher: {e}"),
            )
        })?;

        // Register initial watch paths.
        #[cfg(target_os = "macos")]
        {
            // macOS: FSEvents handles recursive watching natively.
            // No need to enumerate individual directories.
            trace!("macOS: watching root recursively via FSEvents");
            if let Err(e) = watcher.watch(std::path::Path::new(&origin), RecursiveMode::Recursive) {
                tracing::error!(?e, "failed to watch root directory");
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            // Linux/Windows: enumerate non-ignored directories and watch each one
            // non-recursively to avoid inotify watches on node_modules etc.
            let path_set = enumerate_watch_paths(&origin, use_ignore);
            trace!(count = path_set.len(), "registering initial watch paths");
            for path in &path_set {
                if let Err(e) = watcher.watch(path, RecursiveMode::NonRecursive) {
                    tracing::warn!(?e, ?path, "failed to watch path");
                }
            }
        }

        let watcher = Arc::new(Mutex::new(watcher));

        // Spawn the event processing thread.
        let watcher_for_thread = watcher.clone();
        std::thread::spawn(move || {
            trace!("event processing thread started");

            #[cfg(not(target_os = "macos"))]
            let ignore_globs = build_ignore_glob_set();

            let mut origin_path = origin.clone();
            if !origin_path.ends_with(MAIN_SEPARATOR) {
                origin_path.push(MAIN_SEPARATOR);
            }

            // Accumulator: events received since the last flush, merged by path.
            // `burst_start` is the timestamp of the first event in the current
            // burst; `flush_deadline` is the next wake-up (min of the idle
            // deadline and the max-wait cap). Both reset together on flush.
            let mut accumulator: HashMap<PathBuf, WatchEventInternal> = HashMap::new();
            let mut burst_start: Option<Instant> = None;
            let mut flush_deadline: Option<Instant> = None;

            loop {
                if stop_flag.load(Ordering::Relaxed) {
                    trace!("stop flag set, exiting processing thread");
                    break;
                }

                // When a burst is in flight, wait until its flush deadline.
                // When idle, poll briefly so stop_flag is observed promptly —
                // blocking forever on rx.recv() would prevent shutdown since
                // the watcher (and its tx) is owned by this thread.
                let wait = match flush_deadline {
                    Some(d) => d.saturating_duration_since(Instant::now()),
                    None => SHUTDOWN_POLL,
                };

                match rx.recv_timeout(wait) {
                    Ok(Ok(event)) => {
                        trace!(?event, "raw event");

                        // Filter through gitignore/nxignore.
                        if !filterer.check_event(&event) {
                            continue;
                        }

                        // On Linux/Windows, register watches for newly-created
                        // directories *synchronously* before doing anything else.
                        // The watch() call must return before any files land in
                        // the new directory, otherwise inotify misses them and
                        // the re-walk below would be racing a moving target.
                        #[cfg(not(target_os = "macos"))]
                        {
                            let new_dirs = new_directories_from_event(&event, &ignore_globs);
                            if !new_dirs.is_empty() {
                                trace!(
                                    count = new_dirs.len(),
                                    "registering new directory watches synchronously"
                                );
                                register_watches(&watcher_for_thread, &new_dirs);
                                // Walk now that inotify is watching. Files found
                                // here were written before our watch() call; any
                                // nested subdirs discovered are registered next.
                                let nested = walk_new_dirs_into_accumulator(
                                    &new_dirs,
                                    &origin,
                                    &mut accumulator,
                                );
                                register_watches(&watcher_for_thread, &nested);
                            }
                        }

                        // Transform and merge into the accumulator.
                        match transform_event_to_watch_events(&event, &origin_path) {
                            Ok(events) => {
                                for e in events {
                                    merge_event(&mut accumulator, e);
                                }
                            }
                            Err(e) => {
                                tracing::warn!(?e, "event transform failed");
                            }
                        }

                        // Stamp burst_start on the burst's first event; then push
                        // flush_deadline forward, but never past the max-wait cap.
                        let now = Instant::now();
                        let bs = *burst_start.get_or_insert(now);
                        flush_deadline = Some((now + IDLE_WINDOW).min(bs + MAX_WAIT));
                    }
                    Ok(Err(notify_err)) => {
                        tracing::warn!("notify error: {:?}", notify_err);
                    }
                    Err(RecvTimeoutError::Timeout) => {
                        // Either the idle window elapsed or the max-wait cap
                        // hit — flush whatever we accumulated and reset.
                        if !accumulator.is_empty() {
                            let watch_events: Vec<WatchEvent> =
                                accumulator.values().map(|e| e.into()).collect();
                            trace!(count = watch_events.len(), "flushing accumulated events");
                            callback_tsfn
                                .call(Ok(watch_events), ThreadsafeFunctionCallMode::NonBlocking);
                            accumulator.clear();
                        }
                        burst_start = None;
                        flush_deadline = None;
                    }
                    Err(RecvTimeoutError::Disconnected) => {
                        trace!("notify channel disconnected, exiting");
                        break;
                    }
                }
            }

            trace!("event processing thread exited");
        });

        trace!("watcher started");
        Ok(())
    }

    #[napi]
    pub async fn stop(&self) -> Result<()> {
        trace!("stopping the watch process");
        self.stop_flag.store(true, Ordering::Release);
        Ok(())
    }
}
