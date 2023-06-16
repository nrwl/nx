use std::collections::HashMap;
use std::convert::Infallible;
use std::path::MAIN_SEPARATOR;
use std::sync::Arc;

use crate::native::watch::types::{WatchEvent, WatchEventInternal};
use itertools::Itertools;
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{
    ThreadSafeCallContext, ThreadsafeFunction, ThreadsafeFunctionCallMode,
};
use napi::{Env, JsFunction, JsObject};
use rayon::prelude::*;
use tracing::trace;
use tracing_subscriber::EnvFilter;
use watchexec::action::{Action, Outcome};
use watchexec::config::{InitConfig, RuntimeConfig};
use watchexec::event::Tag;
use watchexec::Watchexec;
use watchexec_events::{Event, Keyboard, Priority};
use watchexec_signals::Signal;

use crate::native::watch::watch_config;

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
    /// If `useIgnore` is set to false, no ignores will be used, even when `additionalGlobs` is set
    #[napi(constructor)]
    pub fn new(
        origin: String,
        additional_globs: Option<Vec<String>>,
        use_ignore: Option<bool>,
    ) -> Result<Watcher> {
        let watch_exec = Watchexec::new(InitConfig::default(), RuntimeConfig::default())
            .map_err(anyhow::Error::from)?;

        let mut globs = additional_globs.unwrap_or_default();

        // always ignore the .git  and node_modules folder
        globs.push(".git/".into());
        globs.push("node_modules/".into());

        Ok(Watcher {
            origin,
            watch_exec,
            additional_globs: globs,
            use_ignore: use_ignore.unwrap_or(true),
        })
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

        let mut callback_tsfn: ThreadsafeFunction<HashMap<String, Vec<WatchEventInternal>>> =
            callback.create_threadsafe_function(
                0,
                |ctx: ThreadSafeCallContext<HashMap<String, Vec<WatchEventInternal>>>| {
                    let mut watch_events: Vec<WatchEvent> = vec![];
                    trace!(?ctx.value, "Base collection that will be sent");

                    for (_, value) in ctx.value {
                        let event = value
                            .first()
                            .expect("should always have at least 1 element")
                            .to_owned();

                        watch_events.push(event.into());
                    }

                    trace!(?watch_events, "sending to node");

                    Ok(vec![watch_events])
                },
            )?;

        callback_tsfn.unref(&env)?;

        let origin = self.origin.clone();
        let watch_exec = self.watch_exec.clone();
        let additional_globs = self.additional_globs.clone();
        let use_ignore = self.use_ignore.clone();
        let start = async move {
            let mut runtime = watch_config::create_runtime(
                &origin,
                &additional_globs
                    .iter()
                    .map(String::as_ref)
                    .collect::<Vec<_>>(),
                use_ignore,
            )
            .await?;

            runtime.on_action(move |action: Action| {
                let ok_future = async { Ok::<(), Infallible>(()) };
                let signals: Vec<Signal> = action.events.iter().flat_map(Event::signals).collect();

                if signals.contains(&Signal::Terminate) {
                    trace!("terminate - ending watch");
                    action.outcome(Outcome::both(Outcome::Stop, Outcome::Exit));
                    return ok_future;
                }

                if signals.contains(&Signal::Interrupt) {
                    trace!("interrupt - ending watch");
                    action.outcome(Outcome::both(Outcome::Stop, Outcome::Exit));
                    return ok_future;
                }

                let is_keyboard_eof = action
                    .events
                    .iter()
                    .any(|e| e.tags.contains(&Tag::Keyboard(Keyboard::Eof)));

                if is_keyboard_eof {
                    trace!("ending watch");
                    action.outcome(Outcome::both(Outcome::Stop, Outcome::Exit));
                    return ok_future;
                }

                let mut origin_path = origin.clone();
                if !origin_path.ends_with(MAIN_SEPARATOR) {
                    origin_path.push(MAIN_SEPARATOR);
                }
                trace!(?origin_path);

                let events = action
                    .events
                    .par_iter()
                    .map(|ev| {
                        let mut watch_event: WatchEventInternal = ev.into();
                        watch_event.origin = Some(origin_path.clone());
                        watch_event
                    })
                    .collect::<Vec<WatchEventInternal>>();

                let group_events = events
                    .into_iter()
                    .into_group_map_by(|g| g.path.display().to_string());

                callback_tsfn.call(Ok(group_events), ThreadsafeFunctionCallMode::NonBlocking);

                action.outcome(Outcome::Start);
                ok_future
            });

            trace!("configuring watch exec");
            watch_exec
                .reconfigure(runtime)
                .map_err(anyhow::Error::from)?;

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
