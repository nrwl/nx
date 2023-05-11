use ignore::WalkBuilder;
use ignore_files::{IgnoreFile, IgnoreFilter};
use itertools::Itertools;
use napi::threadsafe_function::{ThreadSafeCallContext, ThreadsafeFunctionCallMode};
use napi::{Env, JsFunction, JsObject, JsString, Ref};
use std::convert::Infallible;
use std::path::PathBuf;
use std::sync::Arc;
use watchexec::action::{Action, Outcome};
use watchexec::config::{InitConfig, RuntimeConfig};
use watchexec::error::RuntimeError;
use watchexec::event::Tag;
use watchexec::filter::Filterer;
use watchexec::Watchexec;
use watchexec_events::filekind::{FileEventKind, ModifyKind};
use watchexec_events::{Event, FileType, Keyboard, Priority, Source};
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
        #[napi(ts_arg_type = "(err: string | null, paths: string[]) => void")] callback: JsFunction,
    ) -> Watcher {
        let callback_ref = env.create_reference(callback).unwrap();
        Watcher {
            origin,
            callback: callback_ref,
        }
    }

    #[napi]
    pub fn start(&self, env: Env) -> napi::Result<JsObject> {
        tracing_subscriber::fmt::init();

        let callback_tsfn = env.create_threadsafe_function(
            &env.get_reference_value(&self.callback)?,
            0,
            |ctx: ThreadSafeCallContext<Vec<String>>| {
                ctx.value
                    .iter()
                    .map(|v| ctx.env.create_string(v))
                    .collect::<Result<Vec<JsString>, napi::Error>>()
                    .map(|v| vec![v])
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

                let paths: Vec<String> = action
                    .events
                    .iter()
                    .flat_map(Event::paths)
                    .map(|(path, _)| path.display().to_string())
                    .unique()
                    .collect();

                callback_tsfn.call(Ok(paths), ThreadsafeFunctionCallMode::Blocking);

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

#[derive(Debug)]
struct WatchFilterer {
    inner: IgnoreFilterer,
}
/// Used to filter out events that that come from watchexec
impl Filterer for WatchFilterer {
    fn check_event(&self, event: &Event, priority: Priority) -> Result<bool, RuntimeError> {
        //
        // Tags will be a Vec that contains multiple types of information for a given event
        // We are only interested if:
        // 1) A `FileEventKind` is modified, created, removed, or renamed
        // 2) A Path that is a FileType::File
        // 3) Deleted files do not have a FileType::File (because they're deleted..), check if a path is valid
        // 4) Only FileSystem sources are valid
        // If there's a tag that doesnt confine to this criteria, we `return` early, otherwise we `continue`.
        for tag in &event.tags {
            match tag {
                Tag::FileEventKind(file_event) => match file_event {
                    FileEventKind::Modify(ModifyKind::Name(_)) => continue,
                    FileEventKind::Modify(ModifyKind::Data(_)) => continue,
                    FileEventKind::Create(_) => continue,
                    FileEventKind::Remove(_) => continue,
                    _ => return Ok(false),
                },
                Tag::Path {
                    file_type: Some(FileType::File),
                    ..
                } => continue,
                Tag::Path {
                    path,
                    file_type: _file_type,
                } if !path.display().to_string().ends_with('~') => continue,
                Tag::Source(Source::Filesystem) => continue,
                _ => return Ok(false),
            }
        }

        if !self.inner.check_event(event, priority)? {
            return Ok(false);
        }

        Ok(true)
    }
}

fn get_ignore_files<T: AsRef<str>>(root: T) -> Vec<IgnoreFile> {
    let root = root.as_ref();

    let mut walker = WalkBuilder::new(root);
    walker.hidden(false);

    walker
        .build()
        .flatten()
        .filter(|result| {
            result.path().ends_with(".nxignore") || result.path().ends_with(".gitignore")
        })
        .map(|result| {
            let path: PathBuf = result.path().into();
            let parent: PathBuf = path.parent().unwrap_or(&path).into();
            IgnoreFile {
                path,
                applies_in: Some(parent),
                applies_to: None,
            }
        })
        .collect()
}
