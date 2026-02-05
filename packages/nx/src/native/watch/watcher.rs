use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::hash_map::Entry;
use std::path::MAIN_SEPARATOR;
use std::sync::Arc;

use crate::native::glob::{NxGlobSet, build_glob_set};
use crate::native::utils::git::parent_gitignore_files;
use crate::native::watch::types::{
    EventType, WatchEvent, WatchEventInternal, transform_event_to_watch_events,
};
use crate::native::watch::watch_filterer;
use ignore::WalkBuilder;
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{
    ThreadSafeCallContext, ThreadsafeFunction, ThreadsafeFunctionCallMode,
};
use napi::{Env, JsFunction, JsObject};
use parking_lot::Mutex;
use rayon::prelude::*;
use std::path::{Path, PathBuf};
use tracing::trace;
use tracing_subscriber::EnvFilter;
use watchexec::WatchedPath;
use watchexec::Watchexec;
use watchexec_events::filekind::{CreateKind, FileEventKind};
use watchexec_events::{Event, FileType, Priority, Tag};
use watchexec_signals::Signal;

/// Build a WalkBuilder that enumerates non-ignored directories in the workspace.
/// Reuses the same ignore patterns as `walker.rs::create_walker()`:
/// - Hardcoded ignores: node_modules, .git, .nx/cache, .nx/workspace-data, .yarn/cache
/// - .gitignore respect (with parent gitignore traversal)
/// - .nxignore support
fn create_watch_walker<P: AsRef<Path>>(directory: P, use_ignores: bool) -> WalkBuilder {
    let directory: PathBuf = directory.as_ref().into();

    let ignore_glob_set = build_glob_set(&[
        "**/node_modules",
        "**/.git",
        "**/.nx/cache",
        "**/.nx/workspace-data",
        "**/.yarn/cache",
    ])
    .expect("These static ignores always build");

    let mut walker = WalkBuilder::new(&directory);
    walker.require_git(false);
    walker.hidden(false);

    if use_ignores {
        if let Some(gitignore_paths) = parent_gitignore_files(&directory) {
            walker.parents(false);
            for gitignore_path in gitignore_paths {
                walker.add_ignore(gitignore_path);
            }
        } else {
            walker.parents(true);
        }

        walker.add_custom_ignore_filename(".nxignore");
    }

    walker.filter_entry(move |entry| {
        let path = entry.path().to_string_lossy();
        !ignore_glob_set.is_match(path.as_ref())
    });
    walker
}

/// Build the hardcoded ignore GlobSet used to check if new directories should be watched.
fn build_ignore_glob_set() -> NxGlobSet {
    build_glob_set(&[
        "**/node_modules",
        "**/.git",
        "**/.nx/cache",
        "**/.nx/workspace-data",
        "**/.yarn/cache",
    ])
    .expect("These static ignores always build")
}

/// Check if a path should be ignored based on the hardcoded ignore patterns.
fn is_ignored_path(path: &Path, ignore_globs: &NxGlobSet) -> bool {
    ignore_globs.is_match(path)
}

/// Enumerate all non-ignored directories to watch individually (non-recursively).
/// This avoids registering inotify watches on node_modules and other ignored trees.
/// Returns both the watch paths and a set of their PathBufs for efficient lookup.
fn enumerate_watch_paths<P: AsRef<Path>>(
    directory: P,
    use_ignores: bool,
) -> (Vec<WatchedPath>, HashSet<PathBuf>) {
    let walker = create_watch_walker(&directory, use_ignores);
    let mut watched_paths: Vec<WatchedPath> = Vec::new();
    let mut path_set: HashSet<PathBuf> = HashSet::new();

    for entry in walker.build() {
        if let Ok(entry) = entry {
            if entry.file_type().map_or(false, |ft| ft.is_dir()) {
                let p = entry.into_path();
                watched_paths.push(WatchedPath::non_recursive(&p));
                path_set.insert(p);
            }
        }
    }

    // Always include the root directory itself
    let root = directory.as_ref().to_path_buf();
    if !path_set.contains(&root) {
        watched_paths.push(WatchedPath::non_recursive(&root));
        path_set.insert(root);
    }

    trace!(count = watched_paths.len(), "enumerated watch paths");
    (watched_paths, path_set)
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
    /// Will always ignore the following directories:
    /// * .git/
    /// * node_modules/
    /// * .nx/
    #[napi(constructor)]
    pub fn new(
        origin: String,
        additional_globs: Option<Vec<String>>,
        use_ignore: Option<bool>,
    ) -> Watcher {
        // always have these globs come before the additional globs
        let mut globs = vec![
            ".git/".into(),
            "node_modules/".into(),
            ".nx/".into(),
            "vitest.config.ts.timestamp*.mjs".into(),
            "vite.config.ts.timestamp*.mjs".into(),
            ".yarn/cache/".into(),
        ];
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
        callback: JsFunction,
    ) -> Result<()> {
        _ = tracing_subscriber::fmt()
            .with_env_filter(EnvFilter::from_env("NX_NATIVE_LOGGING"))
            .try_init();

        let mut callback_tsfn: ThreadsafeFunction<HashMap<String, WatchEventInternal>> = callback
            .create_threadsafe_function(
            0,
            |ctx: ThreadSafeCallContext<HashMap<String, WatchEventInternal>>| {
                let mut watch_events: Vec<WatchEvent> = vec![];
                trace!(?ctx.value, "Base collection that will be sent");

                for event in ctx.value.values() {
                    watch_events.push(event.into());
                }

                trace!(?watch_events, "sending to node");

                Ok(vec![watch_events])
            },
        )?;

        callback_tsfn.unref(&env)?;

        // Shared state for dynamic directory registration.
        // When a new non-ignored directory is created, we add it to the watch set
        // so future file changes inside it are detected.
        let watched_path_set: Arc<Mutex<HashSet<PathBuf>>> = Arc::new(Mutex::new(HashSet::new()));
        let ignore_globs: Arc<NxGlobSet> = Arc::new(build_ignore_glob_set());

        let origin = self.origin.clone();
        let watch_exec_for_action = self.watch_exec.clone();
        let watched_path_set_for_action = watched_path_set.clone();
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

            // Check for new directory creation events and dynamically register watches.
            // Without this, non-recursive watches would miss changes in newly created dirs.
            let mut new_dirs_added = false;
            for event in action.events.iter() {
                let is_folder_create = event.tags.iter().any(|tag| {
                    matches!(
                        tag,
                        Tag::FileEventKind(FileEventKind::Create(CreateKind::Folder))
                    )
                });

                if is_folder_create {
                    for (path, file_type) in event.paths() {
                        if file_type.map_or(false, |ft| matches!(ft, FileType::Dir))
                            && !is_ignored_path(path, &ignore_globs_for_action)
                        {
                            let mut path_set = watched_path_set_for_action.lock();
                            if path_set.insert(path.to_path_buf()) {
                                trace!(?path, "dynamically registering new directory watch");
                                new_dirs_added = true;
                            }
                        }
                    }
                }
            }

            // Update the watchexec pathset if new directories were added
            if new_dirs_added {
                let path_set = watched_path_set_for_action.lock();
                let new_pathset: Vec<WatchedPath> = path_set
                    .iter()
                    .map(|p| WatchedPath::non_recursive(p))
                    .collect();
                trace!(
                    count = new_pathset.len(),
                    "updating pathset with new directories"
                );
                watch_exec_for_action.config.pathset(new_pathset);
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
            for ev in action.events.iter() {
                trace!(?ev, "raw event");
            }

            let events = action
                .events
                .par_iter()
                .filter_map(|ev| {
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

            callback_tsfn.call(Ok(group_events), ThreadsafeFunctionCallMode::NonBlocking);

            action
        });

        let origin = self.origin.clone();
        let additional_globs = self.additional_globs.clone();
        let use_ignore = self.use_ignore;
        let watch_exec = self.watch_exec.clone();
        let start = async move {
            trace!("configuring watch exec");

            // Enumerate non-ignored directories and watch each one non-recursively.
            // This prevents inotify watches on node_modules and other ignored trees.
            let (watched_paths, path_set) = enumerate_watch_paths(&origin, use_ignore);
            trace!(count = watched_paths.len(), "setting watched paths");

            // Store the initial path set so the on_action handler can append to it
            *watched_path_set.lock() = path_set;

            watch_exec.config.pathset(watched_paths);

            watch_exec.config.filterer(
                watch_filterer::create_filter(&origin, &additional_globs, use_ignore).await?,
            );
            trace!("starting watch exec");
            watch_exec.main().await.map_err(anyhow::Error::from)?.ok();
            Ok(())
        };

        env.spawn_future(start)?;
        trace!("started watch exec");
        Ok(())
    }

    #[napi(ts_return_type = "Promise<void>")]
    pub fn stop(&mut self, env: Env) -> Result<JsObject> {
        trace!("stopping the watch process");
        let watch_exec = self.watch_exec.clone();
        let send_terminate = async move {
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
        };

        env.spawn_future(send_terminate)
    }
}
