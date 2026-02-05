use std::collections::HashMap;
use std::collections::hash_map::Entry;
use std::path::{MAIN_SEPARATOR, PathBuf};
use std::sync::{Arc, Weak};

use crate::native::watch::types::{
    EventType, WatchEvent, WatchEventInternal, transform_event_to_watch_events,
};
use crate::native::watch::watch_filterer;
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{
    ThreadSafeCallContext, ThreadsafeFunction, ThreadsafeFunctionCallMode,
};
use napi::{Env, JsFunction, JsObject};
use rayon::prelude::*;
use tracing::trace;
use tracing_subscriber::EnvFilter;
use watchexec::WatchedPath;
use watchexec::Watchexec;
use watchexec_events::filekind::{CreateKind, FileEventKind};
use watchexec_events::{Event, FileType, Priority, Tag};
use watchexec_signals::Signal;

/// Walk the directory tree starting at `origin`, respecting ignore rules,
/// and return all non-ignored directories. Used to set up non-recursive
/// watches so we avoid registering watches for ignored directories like
/// node_modules (which can have 50k+ subdirectories).
fn walk_directories(origin: &str, additional_globs: &[String], use_ignore: bool) -> Vec<PathBuf> {
    use crate::native::utils::git::parent_gitignore_files;
    use globset::{Glob, GlobSetBuilder};
    use ignore::WalkBuilder;

    let mut builder = GlobSetBuilder::new();
    for glob_str in additional_globs {
        let pattern = format!("**/{}", glob_str.trim_end_matches('/'));
        if let Ok(glob) = Glob::new(&pattern) {
            builder.add(glob);
        }
    }
    let ignore_glob_set = builder.build().expect("ignore globs should always build");

    let mut walker = WalkBuilder::new(origin);
    walker.require_git(false);
    walker.hidden(false);

    if use_ignore {
        if let Some(gitignore_paths) = parent_gitignore_files(origin) {
            walker.parents(false);
            for path in gitignore_paths {
                walker.add_ignore(path);
            }
        } else {
            walker.parents(true);
        }
        walker.add_custom_ignore_filename(".nxignore");
    }

    walker
        .filter_entry(move |entry| !ignore_glob_set.is_match(entry.path()))
        .build()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map_or(false, |ft| ft.is_dir()))
        .map(|e| e.into_path())
        .collect()
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

        Watcher {
            origin: if cfg!(windows) {
                origin.replace('/', "\\")
            } else {
                origin
            },
            watch_exec: Arc::new(Watchexec::default()),
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

        // Capture additional state for dynamic directory watching.
        // When using non-recursive watches, newly created directories
        // need to be detected and added to the watch set.
        let watch_exec_weak = Arc::downgrade(&self.watch_exec);
        let origin_for_walk = self.origin.clone();
        let globs_for_action = self.additional_globs.clone();
        let use_ignore_for_action = self.use_ignore;

        let origin = self.origin.clone();
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

            // With non-recursive watches, detect new directory creation
            // and re-walk the workspace to update the watched path set.
            {
                let has_dir_create = action.events.iter().any(|event| {
                    event.tags.iter().any(|t| {
                        matches!(
                            t,
                            Tag::FileEventKind(FileEventKind::Create(CreateKind::Folder))
                        )
                    })
                });
                if has_dir_create {
                    if let Some(we) = watch_exec_weak.upgrade() {
                        let dirs = walk_directories(
                            &origin_for_walk,
                            &globs_for_action,
                            use_ignore_for_action,
                        );
                        trace!(
                            count = dirs.len(),
                            "re-walking directories after new directory creation"
                        );
                        let paths: Vec<WatchedPath> =
                            dirs.into_iter().map(WatchedPath::non_recursive).collect();
                        we.config.pathset(paths);
                    }
                }
            }

            let mut origin_path = origin.clone();
            if !origin_path.ends_with(MAIN_SEPARATOR) {
                origin_path.push(MAIN_SEPARATOR);
            }
            trace!(?origin_path);

            let events = action
                .events
                .par_iter()
                .filter_map(|ev| transform_event_to_watch_events(ev, &origin_path).ok())
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
            callback_tsfn.call(Ok(group_events), ThreadsafeFunctionCallMode::NonBlocking);

            action
        });

        let origin = self.origin.clone();
        let additional_globs = self.additional_globs.clone();
        let use_ignore = self.use_ignore;
        let watch_exec = self.watch_exec.clone();
        let start = async move {
            trace!("configuring watch exec");

            // Use non-recursive watches to avoid registering watches for
            // ignored directories. We walk the directory tree ourselves
            // (respecting .gitignore, .nxignore, and configured globs)
            // and register a non-recursive watch for each non-ignored directory.
            let dirs = walk_directories(&origin, &additional_globs, use_ignore);
            trace!(
                count = dirs.len(),
                "setting up non-recursive watches for directories"
            );
            let paths: Vec<WatchedPath> =
                dirs.into_iter().map(WatchedPath::non_recursive).collect();
            watch_exec.config.pathset(paths);

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
