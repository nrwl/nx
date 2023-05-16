use crate::native::watch::get_ignore_files::get_ignore_files;
use crate::native::watch::watch_filterer::WatchFilterer;

use ignore_files::IgnoreFilter;
use itertools::Itertools;
use napi::threadsafe_function::{ThreadSafeCallContext, ThreadsafeFunctionCallMode};
use napi::{Env, JsFunction, JsObject, Ref};
use std::convert::Infallible;
use std::sync::Arc;

use tracing::trace;
use tracing_subscriber::EnvFilter;

use watchexec::action::{Action, Outcome};
use watchexec::config::{InitConfig, RuntimeConfig};
use watchexec::event::Tag;
use watchexec::Watchexec;
use watchexec_events::filekind::{FileEventKind, ModifyKind};
use watchexec_events::{Event, Keyboard};
use watchexec_filterer_ignore::IgnoreFilterer;
use watchexec_signals::Signal;

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
        let callback_ref = env.create_reference(callback).unwrap();
        Watcher {
            origin,
            callback: callback_ref,
        }
    }

    #[napi]
    pub fn start(&self, env: Env) -> napi::Result<JsObject> {
        tracing_subscriber::fmt()
            .with_env_filter(EnvFilter::from_env("NX_NATIVE_LOG"))
            .init();

        let callback_tsfn = env.create_threadsafe_function(
            &env.get_reference_value(&self.callback)?,
            0,
            |ctx: ThreadSafeCallContext<Vec<WatchEvent>>| {
                let mut watch_events: Vec<JsObject> = vec![];
                trace!(?ctx.value, "Sending values into node");
                for value in ctx.value {
                    let mut obj = ctx.env.create_object()?;
                    obj.set("path", value.path)?;
                    obj.set("event_type", value.event_type)?;

                    watch_events.push(obj);
                }

                Ok(vec![watch_events])
            },
        )?;

        let origin = self.origin.clone();
        let start = async move {
            let config = InitConfig::default();

            let ignore_files = get_ignore_files(&origin);

            let mut filter = IgnoreFilter::new(&origin, &ignore_files)
                .await
                .map_err(anyhow::Error::from)?;

            filter
                .add_globs(&[".git"], Some(&origin.clone().into()))
                .map_err(anyhow::Error::from)?;

            let mut runtime = RuntimeConfig::default();
            runtime.filterer(Arc::new(WatchFilterer {
                inner: IgnoreFilterer(filter),
            }));

            // TODO(cammisuli): optimize this so that we only watch root folders that are not ignored (ie, all root paths except node_modules, .git, etc)
            runtime.pathset([&origin]);

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

                let watch_events: Vec<WatchEvent> = action
                    .events
                    .iter()
                    .map(WatchEvent::from)
                    .rev()
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

        env.execute_tokio_future(start, |env, _| env.get_undefined())
    }

    pub fn stop(&mut self, env: Env) -> napi::Result<()> {
        self.callback.unref(env)?;

        // TODO send terminate signal

        Ok(())
    }
}

#[napi(object)]
#[derive(Debug, Clone)]
pub struct WatchEvent {
    pub path: String,
    #[napi(ts_type = "'create' | 'delete' | 'update'")]
    pub event_type: String,
}
impl From<&Event> for WatchEvent {
    fn from(value: &Event) -> Self {
        let path = value
            .paths()
            .next()
            .expect("there should always be a path")
            .0
            .display()
            .to_string();

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
            FileEventKind::Modify(ModifyKind::Name(_)) => "update",
            FileEventKind::Modify(ModifyKind::Data(_)) => "update",
            FileEventKind::Create(_) => "create",
            FileEventKind::Remove(_) => "delete",
            _ => "update",
        };

        WatchEvent {
            path,
            event_type: event_type.into(),
        }
    }
}
