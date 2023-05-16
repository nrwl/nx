use std::convert::Infallible;
use std::path::{PathBuf, MAIN_SEPARATOR};

use itertools::Itertools;
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadSafeCallContext, ThreadsafeFunctionCallMode};
use napi::{Env, JsFunction, JsObject, Ref};
use tracing::trace;
use tracing_subscriber::EnvFilter;
use watchexec::action::{Action, Outcome};
use watchexec::event::Tag;
use watchexec::Watchexec;
use watchexec_events::filekind::{FileEventKind, ModifyKind};
use watchexec_events::{Event, Keyboard};
use watchexec_signals::Signal;

use crate::native::watch::watch_config;

#[napi]
pub struct Watcher {
    pub origin: String,
    callback: Ref<()>,
}

#[napi]
impl Watcher {
    #[napi(constructor)]
    pub fn new(
        env: Env,
        origin: String,
        #[napi(ts_arg_type = "(err: string | null, paths: WatchEvent[]) => void")]
        callback: JsFunction,
    ) -> Watcher {
        let callback_ref = env
            .create_reference(callback)
            .expect("node env references must be available");
        Watcher {
            origin,
            callback: callback_ref,
        }
    }

    #[napi]
    pub fn start(&self, env: Env) -> Result<()> {
        tracing_subscriber::fmt()
            .with_env_filter(EnvFilter::from_env("NX_NATIVE_LOG"))
            .init();

        let callback_tsfn = env.create_threadsafe_function(
            &env.get_reference_value(&self.callback)?,
            0,
            |ctx: ThreadSafeCallContext<Vec<WatchEventInternal>>| {
                let mut watch_events: Vec<JsObject> = vec![];
                trace!(?ctx.value, "Sending values into node");
                for value in ctx.value {
                    let mut obj = ctx.env.create_object()?;
                    obj.set("path", value.path.display().to_string())?;
                    obj.set("type", value.event_type)?;

                    watch_events.push(obj);
                }

                Ok(vec![watch_events])
            },
        )?;

        let origin = self.origin.clone();
        let start = async move {
            let (config, mut runtime) = watch_config::create_config(&origin).await?;

            runtime.on_action(move |action: Action| {
                let ok_future = async { Ok::<(), Infallible>(()) };
                let signals: Vec<Signal> = action.events.iter().flat_map(Event::signals).collect();

                if signals.contains(&Signal::Terminate) {
                    action.outcome(Outcome::both(Outcome::Stop, Outcome::Exit));
                    return ok_future;
                }

                if signals.contains(&Signal::Interrupt) {
                    action.outcome(Outcome::both(Outcome::Stop, Outcome::Exit));
                    return ok_future;
                }

                let is_keyboard_eof = action
                    .events
                    .iter()
                    .any(|e| e.tags.contains(&Tag::Keyboard(Keyboard::Eof)));

                if is_keyboard_eof {
                    action.outcome(Outcome::both(Outcome::Stop, Outcome::Exit));
                    return ok_future;
                }

                let mut origin_path = origin.clone();
                if !origin_path.ends_with(MAIN_SEPARATOR) {
                    origin_path.push(MAIN_SEPARATOR);
                }
                trace!(?origin_path);

                let watch_events: Vec<WatchEventInternal> = action
                    .events
                    .iter()
                    .map(|ev| {
                        let mut watch_event: WatchEventInternal = ev.into();

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
                    .unique_by(|e| e.path.clone())
                    .collect();

                callback_tsfn.call(Ok(watch_events), ThreadsafeFunctionCallMode::Blocking);

                action.outcome(Outcome::wait(Outcome::Start));
                ok_future
            });

            let watch_exec = Watchexec::new(config, runtime).map_err(anyhow::Error::from)?;
            watch_exec.main().await.map_err(anyhow::Error::from)?.ok();

            Ok(())
        };

        env.execute_tokio_future(start, |env, _| env.get_undefined())?;

        Ok(())
    }

    pub fn stop(&mut self, env: Env) -> Result<()> {
        self.callback.unref(env)?;

        // TODO send terminate signal

        Ok(())
    }
}

#[napi(object)]
pub struct WatchEvent {
    pub path: String,
    pub r#type: EventType,
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
struct WatchEventInternal {
    pub path: PathBuf,
    pub event_type: EventType,
}
impl From<&Event> for WatchEventInternal {
    fn from(value: &Event) -> Self {
        let path = value.paths().next().expect("there should always be a path");

        let event_kind = value
            .tags
            .iter()
            .filter_map(|t| match t {
                Tag::FileEventKind(event_kind) => Some(event_kind),
                _ => None,
            })
            .next()
            .expect("there should always be a file event kind");

        let event_type = match &event_kind {
            FileEventKind::Modify(ModifyKind::Name(_)) => {
                if matches!(path.1, Some(_)) {
                    EventType::create
                } else {
                    EventType::delete
                }
            }
            FileEventKind::Modify(ModifyKind::Data(_)) => EventType::update,
            FileEventKind::Create(_) => EventType::create,
            FileEventKind::Remove(_) => EventType::delete,
            _ => EventType::update,
        };

        WatchEventInternal {
            path: path.0.into(),
            event_type,
        }
    }
}
