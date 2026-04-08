use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::hash_map::Entry;
use std::path::MAIN_SEPARATOR;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

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

/// Build the hardcoded ignore GlobSet used to check if new directories should be watched.
#[cfg(not(target_os = "macos"))]
fn build_ignore_glob_set() -> Arc<NxGlobSet> {
    build_glob_set(HARDCODED_IGNORE_PATTERNS).expect("These static ignores always build")
}

/// Extract new, non-ignored directory paths from notify events.
#[cfg(not(target_os = "macos"))]
fn extract_new_directories(events: &[notify::Event], ignore_globs: &NxGlobSet) -> Vec<PathBuf> {
    use notify::EventKind;
    use notify::event::CreateKind;

    events
        .iter()
        .filter(|event| {
            matches!(
                event.kind,
                EventKind::Create(CreateKind::Folder) | EventKind::Create(CreateKind::Any)
            )
        })
        .flat_map(|event| &event.paths)
        .filter(|path| path.is_dir() && !ignore_globs.is_match(path))
        .cloned()
        .collect()
}

/// Re-walk newly created directories to collect files that were written
/// before inotify was watching. Since we register watches synchronously
/// via notify, the gap is very small, but files can still slip through
/// between the mkdir event and our watch() call.
///
/// Deduplicates against events already seen (via `recent_events`)
/// so that files caught by both inotify and the re-walk are only reported once.
///
/// Also discovers nested subdirectories and registers them with the watcher.
#[cfg(not(target_os = "macos"))]
fn collect_files_in_new_dirs(
    dirs: &[PathBuf],
    origin: &str,
    watcher: &Arc<Mutex<notify::RecommendedWatcher>>,
    recent_events: &[WatchEventInternal],
) -> Vec<WatchEventInternal> {
    use crate::native::walker::nx_walker_sync;

    let already_reported: HashSet<&PathBuf> = recent_events.iter().map(|e| &e.path).collect();
    let mut seen_dirs: HashSet<PathBuf> = HashSet::new();
    let mut results = Vec::new();

    for dir in dirs {
        for rel_path in nx_walker_sync(dir, None) {
            let full_path = dir.join(&rel_path);
            if full_path.is_dir() {
                seen_dirs.insert(full_path);
            } else if full_path.is_file() && !already_reported.contains(&full_path) {
                trace!(?full_path, "re-walk found file in new directory");
                results.push(WatchEventInternal {
                    path: full_path,
                    r#type: EventType::create,
                    origin: origin.to_owned(),
                });
            }
        }
    }

    // Register nested subdirectories so inotify watches them going forward.
    if !seen_dirs.is_empty() {
        let mut w = watcher.lock();
        for dir in &seen_dirs {
            if let Err(e) = w.watch(dir, RecursiveMode::NonRecursive) {
                trace!(?e, ?dir, "failed to watch nested directory");
            }
        }
    }

    results
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

type NotifyResult = std::result::Result<notify::Event, notify::Error>;

/// Collect a batch of events from the channel, waiting up to `timeout` for the
/// first event, then debouncing for `debounce` to let related events accumulate
/// before returning the batch.
fn collect_batch(
    rx: &std::sync::mpsc::Receiver<NotifyResult>,
    timeout: Duration,
    debounce: Duration,
) -> Vec<notify::Event> {
    let mut batch = Vec::new();

    // Block until the first event or timeout
    match rx.recv_timeout(timeout) {
        Ok(Ok(event)) => batch.push(event),
        Ok(Err(e)) => {
            trace!("notify error: {:?}", e);
            return batch;
        }
        Err(_) => return batch, // timeout or disconnected
    }

    // Debounce: wait for related events to accumulate (e.g. rapid file writes).
    // Without this, each event would be processed individually, causing duplicate
    // callback invocations for what should be a single batch.
    std::thread::sleep(debounce);

    // Drain all events that arrived during the debounce window
    while let Ok(result) = rx.try_recv() {
        if let Ok(event) = result {
            batch.push(event);
        }
    }

    batch
}

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
        let (tx, rx) = std::sync::mpsc::channel();

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
                    trace!(?e, ?path, "failed to watch path");
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

            // Track recently emitted events for dedup with re-walk results.
            #[cfg(not(target_os = "macos"))]
            let mut recent_events: Vec<WatchEventInternal> = Vec::new();

            loop {
                if stop_flag.load(Ordering::Relaxed) {
                    trace!("stop flag set, exiting processing thread");
                    break;
                }

                let batch =
                    collect_batch(&rx, Duration::from_millis(100), Duration::from_millis(200));
                if batch.is_empty() {
                    continue;
                }

                trace!(event_count = batch.len(), "received event batch");

                // Filter events through gitignore/nxignore.
                let filtered: Vec<notify::Event> = batch
                    .into_iter()
                    .filter(|ev| filterer.check_event(ev))
                    .collect();

                if filtered.is_empty() {
                    continue;
                }

                // On Linux/Windows: check for new directory creation and register
                // watches synchronously — no gap between registration and watching.
                #[cfg(not(target_os = "macos"))]
                {
                    let new_dirs = extract_new_directories(&filtered, &ignore_globs);
                    if !new_dirs.is_empty() {
                        trace!(count = new_dirs.len(), "registering new directory watches");

                        // Register watches SYNCHRONOUSLY. When watch() returns,
                        // inotify is guaranteed to be active on the directory.
                        {
                            let mut w = watcher_for_thread.lock();
                            for dir in &new_dirs {
                                if let Err(e) = w.watch(dir, RecursiveMode::NonRecursive) {
                                    trace!(?e, ?dir, "failed to watch new directory");
                                }
                            }
                        }

                        // Re-walk immediately. Since watch() is synchronous, inotify is
                        // already watching. Any files found were written before inotify
                        // registered — this is the only gap we need to cover.
                        let rewalk_files = collect_files_in_new_dirs(
                            &new_dirs,
                            &origin,
                            &watcher_for_thread,
                            &recent_events,
                        );
                        if !rewalk_files.is_empty() {
                            trace!(count = rewalk_files.len(), "re-walk found unreported files");
                            let watch_events: Vec<WatchEvent> =
                                rewalk_files.iter().map(|e| e.into()).collect();
                            callback_tsfn
                                .call(Ok(watch_events), ThreadsafeFunctionCallMode::NonBlocking);
                        }
                    }
                }

                // Transform notify events into our internal format.
                let mut origin_path = origin.clone();
                if !origin_path.ends_with(MAIN_SEPARATOR) {
                    origin_path.push(MAIN_SEPARATOR);
                }

                let events: Vec<WatchEventInternal> = filtered
                    .iter()
                    .filter_map(|ev| {
                        trace!(?ev, "raw event");
                        let result = transform_event_to_watch_events(ev, &origin_path);
                        trace!(?result, "transform result");
                        result.ok()
                    })
                    .flatten()
                    .collect();

                // Group events: Delete > Create > Modify (dedup within batch).
                let mut group_events: HashMap<String, WatchEventInternal> = HashMap::new();
                for g in events.into_iter() {
                    let path = g.path.display().to_string();
                    match group_events.entry(path) {
                        Entry::Occupied(mut e) if matches!(g.r#type, EventType::delete) => {
                            e.insert(g);
                        }
                        Entry::Occupied(mut e)
                            if matches!(g.r#type, EventType::create)
                                && matches!(e.get().r#type, EventType::update) =>
                        {
                            e.insert(g);
                        }
                        Entry::Occupied(_) => {}
                        Entry::Vacant(e) => {
                            e.insert(g);
                        }
                    }
                }

                if group_events.is_empty() {
                    continue;
                }

                trace!(
                    event_count = group_events.len(),
                    "sending events to callback"
                );

                // Record for dedup against future re-walk results.
                #[cfg(not(target_os = "macos"))]
                {
                    recent_events.extend(group_events.values().cloned());
                    // Keep recent_events bounded — only need events from the last few batches.
                    if recent_events.len() > 1000 {
                        recent_events.drain(..recent_events.len() - 500);
                    }
                }

                let watch_events: Vec<WatchEvent> =
                    group_events.values().map(|e| e.into()).collect();
                trace!(?watch_events, "sending to node");

                callback_tsfn.call(Ok(watch_events), ThreadsafeFunctionCallMode::NonBlocking);
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
