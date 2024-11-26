use std::collections::hash_map::Entry;
use std::collections::HashMap;
use std::path::MAIN_SEPARATOR;
use std::sync::Arc;

use crate::native::watch::types::{
    transform_event_to_watch_events, EventType, WatchEvent, WatchEventInternal,
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
use watchexec::Watchexec;
use watchexec_events::{Event, Priority, Tag};
use watchexec_signals::Signal;

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
            watch_exec.config.pathset([&origin.as_str()]);
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
