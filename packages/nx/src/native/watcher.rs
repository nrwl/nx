use ignore::WalkBuilder;
use ignore_files::{IgnoreFile, IgnoreFilter};
use itertools::Itertools;
use std::convert::Infallible;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
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
async fn watcher(origin: String) -> napi::Result<()> {
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

    runtime.on_action(move |action: Action| async {
        let signals: Vec<Signal> = action.events.iter().flat_map(Event::signals).collect();

        if signals.contains(&Signal::Terminate) {
            action.outcome(Outcome::both(Outcome::Stop, Outcome::Exit));
            return Ok(());
        }

        if signals.contains(&Signal::Interrupt) {
            action.outcome(Outcome::both(Outcome::Stop, Outcome::Exit));
            return Ok(());
        }

        let is_keyboard_eof = action
            .events
            .iter()
            .any(|e| e.tags.contains(&Tag::Keyboard(Keyboard::Eof)));

        if is_keyboard_eof {
            action.outcome(Outcome::both(Outcome::Stop, Outcome::Exit));
            return Ok(());
        }

        let paths: Vec<&Path> = action
            .events
            .iter()
            .flat_map(Event::paths)
            .map(|(path, _)| path)
            .unique()
            .collect();

        println!("event paths: {:?}", paths);

        action.outcome(Outcome::wait(Outcome::Start));
        Ok::<(), Infallible>(())
    });

    let watch_exec = Watchexec::new(config, runtime).map_err(anyhow::Error::from)?;
    watch_exec.main().await.map_err(anyhow::Error::from)?.ok();

    Ok(())
}

#[derive(Debug)]
struct WatchFilterer {
    inner: IgnoreFilterer,
}
impl Filterer for WatchFilterer {
    fn check_event(&self, event: &Event, priority: Priority) -> Result<bool, RuntimeError> {
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
            let parent: PathBuf = path.parent().unwrap_or_else(|| &path).into();
            IgnoreFile {
                path,
                applies_in: Some(parent),
                applies_to: None,
            }
        })
        .collect()
}
