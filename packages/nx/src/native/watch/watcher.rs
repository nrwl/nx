use std::collections::HashMap;
use std::convert::Infallible;
use std::path::{PathBuf, MAIN_SEPARATOR};
use std::sync::Arc;

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
use watchexec_events::filekind::{FileEventKind, ModifyKind};
use watchexec_events::{Event, Keyboard, Priority};
use watchexec_signals::Signal;

use crate::native::watch::watch_config;

#[napi]
pub struct Watcher {
    pub origin: String,
    watch_exec: Arc<Watchexec>,
}

#[napi]
impl Watcher {
    #[napi(constructor)]
    pub fn new(origin: String) -> Result<Watcher> {
        let watch_exec = Watchexec::new(InitConfig::default(), RuntimeConfig::default())
            .map_err(anyhow::Error::from)?;

        Ok(Watcher { origin, watch_exec })
    }

    #[napi]
    pub fn watch(
        &mut self,
        env: Env,
        #[napi(ts_arg_type = "(err: string | null, paths: WatchEvent[]) => void")]
        callback: JsFunction,
    ) -> Result<()> {
        tracing_subscriber::fmt()
            .with_env_filter(EnvFilter::from_env("NX_VERBOSE_LOGGING"))
            .init();

        let mut callback_tsfn: ThreadsafeFunction<HashMap<String, Vec<WatchEvent>>> = callback
            .create_threadsafe_function(
                0,
                |ctx: ThreadSafeCallContext<HashMap<String, Vec<WatchEvent>>>| {
                    let mut watch_events: Vec<WatchEvent> = vec![];
                    trace!(?ctx.value, "Base collection that will be sent");
                    for (_, value) in ctx.value {
                        let event = value
                            .first()
                            .expect("should always have at least 1 element")
                            .to_owned();
                        watch_events.push(event);
                    }

                    trace!(?watch_events, "sending to node");

                    Ok(vec![watch_events])
                },
            )?;

        callback_tsfn.unref(&env)?;

        let origin = self.origin.clone();
        let watch_exec = self.watch_exec.clone();
        let start = async move {
            let mut runtime = watch_config::create_runtime(&origin).await?;

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
                        let mut watch_event: WatchEvent = ev.into();

                        if matches!(watch_event.r#type, EventType::delete) {
                            let path = PathBuf::from(&watch_event.path);
                            if path.exists() {
                                trace!(?watch_event.path, "incorrectly marked as deleted, changing to update");
                                watch_event.r#type = EventType::update;
                            }
                        }

                        watch_event.path = watch_event
                            .path
                            .strip_prefix(&origin_path.clone())
                            .unwrap_or(&watch_event.path)
                            .into();

                        #[cfg(windows)]
                        {
                            watch_event.path = watch_event.path.replace('\\', "/");
                        }

                        watch_event
                    })
                    .collect::<Vec<WatchEvent>>();

                let group_events = events.into_iter().into_group_map_by(|g| g.path.clone());

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
                        tags: vec![Tag::Signal(Signal::Interrupt)],
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

#[napi(string_enum)]
#[derive(Debug)]
pub enum EventType {
    #[allow(non_camel_case_types)]
    create,
    #[allow(non_camel_case_types)]
    delete,
    #[allow(non_camel_case_types)]
    update,
}

#[derive(Debug, Clone)]
#[napi(object)]
pub struct WatchEvent {
    pub path: String,
    pub r#type: EventType,
}

impl From<&Event> for WatchEvent {
    fn from(value: &Event) -> Self {
        let path = value.paths().next().expect("there should always be a path");

        let event_kind = value
            .tags
            .iter()
            .find_map(|t| match t {
                Tag::FileEventKind(event_kind) => Some(event_kind),
                _ => None,
            })
            .expect("there should always be a file event kind");

        let event_type = if matches!(path.1, None) {
            EventType::delete
        } else {
            match &event_kind {
                FileEventKind::Modify(ModifyKind::Name(_)) => EventType::create,
                FileEventKind::Modify(ModifyKind::Data(_)) => EventType::update,
                FileEventKind::Create(_) => EventType::create,
                FileEventKind::Remove(_) => EventType::delete,
                _ => EventType::update,
            }
        };

        trace!(?path, ?event_kind, ?event_type, "event kind -> event type");

        WatchEvent {
            path: path.0.display().to_string(),
            r#type: event_type,
        }
    }
}
