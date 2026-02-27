use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::hash_map::Entry;
use std::path::MAIN_SEPARATOR;
use std::sync::Arc;

#[cfg(not(target_os = "macos"))]
use crate::native::glob::{NxGlobSet, build_glob_set};
use crate::native::walker::HARDCODED_IGNORE_PATTERNS;
#[cfg(not(target_os = "macos"))]
use crate::native::walker::create_walker;
use crate::native::watch::types::{
    EventType, WatchEvent, WatchEventInternal, transform_event_to_watch_events,
};
use crate::native::watch::watch_filterer;
use napi::Env;
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use parking_lot::Mutex;
use rayon::prelude::*;
#[cfg(not(target_os = "macos"))]
use std::path::Path;
use std::path::PathBuf;
use tracing::trace;
use tracing_subscriber::EnvFilter;
use watchexec::WatchedPath;
use watchexec::Watchexec;
#[cfg(not(target_os = "macos"))]
use watchexec_events::FileType;
#[cfg(not(target_os = "macos"))]
use watchexec_events::filekind::{CreateKind, FileEventKind};
use watchexec_events::{Event, Priority, Tag};
use watchexec_signals::Signal;

/// Build the hardcoded ignore GlobSet used to check if new directories should be watched.
#[cfg(not(target_os = "macos"))]
fn build_ignore_glob_set() -> Arc<NxGlobSet> {
    build_glob_set(HARDCODED_IGNORE_PATTERNS).expect("These static ignores always build")
}

/// Extract new, non-ignored directory paths from creation events.
///
/// Pure function — does not mutate shared state. The caller is responsible
/// for deduplicating against the existing watched path set.
#[cfg(not(target_os = "macos"))]
fn extract_new_directories(events: &[Event], ignore_globs: &NxGlobSet) -> Vec<PathBuf> {
    events
        .iter()
        .filter(|event| {
            // On Linux/Windows: only keep directory creation events.
            // Linux emits CreateKind::Folder, Windows emits CreateKind::Any.
            // On macOS: FSEvents doesn't always provide FileEventKind tags,
            // so we accept all events and rely on the is_dir check below.
            #[cfg(not(target_os = "macos"))]
            {
                event.tags.iter().any(|tag| {
                    matches!(
                        tag,
                        Tag::FileEventKind(FileEventKind::Create(CreateKind::Folder))
                            | Tag::FileEventKind(FileEventKind::Create(CreateKind::Any))
                    )
                })
            }
            #[cfg(target_os = "macos")]
            {
                let _ = event;
                true
            }
        })
        .flat_map(|event| event.paths())
        .filter(|(path, file_type)| {
            let is_dir = file_type.map_or(false, |ft| matches!(ft, FileType::Dir)) || path.is_dir();
            is_dir && !ignore_globs.is_match(path)
        })
        .map(|(path, _)| path.to_path_buf())
        .collect()
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

#[napi]
pub struct Watcher {
    pub origin: String,
    watch_exec: Arc<Watchexec>,
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
        ]);

        if let Some(additional_globs) = additional_globs {
            globs.extend(additional_globs);
        }

        let origin = if cfg!(windows) {
            origin.replace('/', "\\")
        } else {
            origin
        };

        // Create Watchexec with a no-op action handler initially.
        // The real handler is set in watch() via config.on_action().
        let watch_exec = Watchexec::default();

        Watcher {
            origin,
            watch_exec: Arc::new(watch_exec),
            additional_globs: globs,
            use_ignore: use_ignore.unwrap_or(true),
        }
    }

    #[napi]
    pub fn watch(
        &mut self,
        env: Env,
        #[napi(ts_arg_type = "(err: string | null, events: WatchEvent[]) => void")]
        callback_tsfn: ThreadsafeFunction<Vec<WatchEvent>>,
    ) -> Result<()> {
        _ = tracing_subscriber::fmt()
            .with_env_filter(EnvFilter::from_env("NX_NATIVE_LOGGING"))
            .try_init();

        // Shared state for dynamic directory registration.
        // When a new non-ignored directory is created, we add it to the watch set
        // so future file changes inside it are detected.
        let watched_path_set: Arc<Mutex<HashSet<PathBuf>>> = Arc::new(Mutex::new(HashSet::new()));

        // On Linux/Windows, we need ignore patterns and extra clones for dynamic
        // directory registration. On macOS, FSEvents handles this natively.
        #[cfg(not(target_os = "macos"))]
        let ignore_globs: Arc<NxGlobSet> = build_ignore_glob_set();

        let origin = self.origin.clone();
        #[cfg(not(target_os = "macos"))]
        let watch_exec_for_action = self.watch_exec.clone();
        #[cfg(not(target_os = "macos"))]
        let watched_path_set_for_action = watched_path_set.clone();
        #[cfg(not(target_os = "macos"))]
        let ignore_globs_for_action = ignore_globs.clone();
        self.watch_exec.config.on_action(move |mut action| {
            let signals: Vec<Signal> = action.signals().collect();

            if signals.contains(&Signal::Terminate) {
                trace!("terminate - ending watch");
                action.quit();
                return action;
            }

            if signals.contains(&Signal::Interrupt) {
                trace!("interrupt - ending watch");
                action.quit();
                return action;
            }

            // On macOS, FSEvents watches the entire tree recursively from the root,
            // so we don't need to dynamically register new directories.
            #[cfg(not(target_os = "macos"))]
            {
                // Check for new directory creation events and dynamically register watches.
                // Without this, non-recursive watches would miss changes in newly created dirs.
                let new_directories =
                    extract_new_directories(&action.events, &ignore_globs_for_action);

                if !new_directories.is_empty() {
                    let mut path_set = watched_path_set_for_action.lock();
                    path_set.extend(new_directories);
                    trace!(
                        count = path_set.len(),
                        "updating pathset with new directories"
                    );
                    watch_exec_for_action
                        .config
                        .pathset(path_set.iter().map(|p| WatchedPath::non_recursive(p)));
                }
            }

            let mut origin_path = origin.clone();
            if !origin_path.ends_with(MAIN_SEPARATOR) {
                origin_path.push(MAIN_SEPARATOR);
            }
            trace!(?origin_path);

            trace!(
                event_count = action.events.len(),
                "on_action received events"
            );

            let events = action
                .events
                .par_iter()
                .filter_map(|ev| {
                    trace!(?ev, "raw event");
                    let result = transform_event_to_watch_events(ev, &origin_path);
                    trace!(?result, "transform result");
                    result.ok()
                })
                .flatten()
                .collect::<Vec<WatchEventInternal>>();

            let mut group_events: HashMap<String, WatchEventInternal> = HashMap::new();
            for g in events.into_iter() {
                let path = g.path.display().to_string();

                // Delete > Create > Modify
                match group_events.entry(path) {
                    // Delete should override anything
                    Entry::Occupied(mut e) if matches!(g.r#type, EventType::delete) => {
                        e.insert(g);
                    }
                    // Create should override update
                    Entry::Occupied(mut e)
                        if matches!(g.r#type, EventType::create)
                            && matches!(e.get().r#type, EventType::update) =>
                    {
                        e.insert(g);
                    }
                    Entry::Occupied(_) => {}
                    // If its empty, insert
                    Entry::Vacant(e) => {
                        e.insert(g);
                    }
                }
            }
            trace!(
                event_count = group_events.len(),
                "sending events to callback"
            );
            for (path, ev) in group_events.iter() {
                trace!(?path, r#type = ?ev.r#type, "callback event");
            }

            let watch_events: Vec<WatchEvent> = group_events.values().map(|e| e.into()).collect();
            trace!(?watch_events, "sending to node");

            callback_tsfn.call(Ok(watch_events), ThreadsafeFunctionCallMode::NonBlocking);

            action
        });

        let origin = self.origin.clone();
        let additional_globs = self.additional_globs.clone();
        let use_ignore = self.use_ignore;
        let watch_exec = self.watch_exec.clone();
        let start = async move {
            trace!("configuring watch exec");

            // On macOS, FSEvents handles recursive watching natively from a single
            // root path. No need to enumerate individual directories — this avoids
            // kqueue (used for non-recursive watches) which silently fails at scale
            // due to vnode table pressure. See #34522.
            #[cfg(target_os = "macos")]
            {
                let mut path_set = HashSet::new();
                path_set.insert(PathBuf::from(&origin));
                trace!(
                    count = path_set.len(),
                    "macOS: watching root recursively via FSEvents"
                );
                watch_exec
                    .config
                    .pathset(path_set.iter().map(|p| WatchedPath::recursive(p)));
                *watched_path_set.lock() = path_set;
            }
            // On Linux/Windows, enumerate non-ignored directories and watch each one
            // non-recursively. This prevents inotify watches on node_modules and other
            // ignored trees (fixing #33781).
            #[cfg(not(target_os = "macos"))]
            {
                let path_set = enumerate_watch_paths(&origin, use_ignore);
                trace!(count = path_set.len(), "setting watched paths");
                watch_exec
                    .config
                    .pathset(path_set.iter().map(|p| WatchedPath::non_recursive(p)));
                *watched_path_set.lock() = path_set;
            }

            watch_exec.config.filterer(watch_filterer::create_filter(
                &origin,
                &additional_globs,
                use_ignore,
            )?);
            trace!("starting watch exec");
            watch_exec.main().await.map_err(anyhow::Error::from)?.ok();
            Ok(())
        };

        env.spawn_future(start)?;
        trace!("started watch exec");
        Ok(())
    }

    #[napi]
    pub async fn stop(&self) -> Result<()> {
        trace!("stopping the watch process");
        let watch_exec = self.watch_exec.clone();
        watch_exec
            .send_event(
                Event {
                    tags: vec![Tag::Signal(Signal::Terminate)],
                    metadata: HashMap::new(),
                },
                Priority::Urgent,
            )
            .await
            .map_err(anyhow::Error::from)?;

        Ok(())
    }
}
