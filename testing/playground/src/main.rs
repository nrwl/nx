use ignore::{Walk, WalkBuilder};
use std::convert::Infallible;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use ignore_files::{IgnoreFile, IgnoreFilter};
use itertools::Itertools;
use tracing::event;
use watchexec::action::{Action, Outcome};
use watchexec::config::{InitConfig, RuntimeConfig};
use watchexec::error::RuntimeError;
use watchexec::event::FileType;
use watchexec::filter::Filterer;
use watchexec::handler::PrintDebug;
use watchexec::Watchexec;
use watchexec_events::filekind::{FileEventKind, ModifyKind};
use watchexec_events::{Event, Keyboard, Priority, Source, Tag};
use watchexec_filterer_ignore::IgnoreFilterer;
use watchexec_signals::Signal;

const RUNTIME: &str = "/Users/jon/Dev/nx";

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut config = InitConfig::default();

    let ignore_files = get_ignore_files(RUNTIME);
    let mut filter = IgnoreFilter::new(RUNTIME, &ignore_files).await?;
    filter.add_globs(&[".git"], Some(&RUNTIME.into()))?;

    let mut runtime = RuntimeConfig::default();
    runtime.filterer(Arc::new(WatchFilterer {
        inner: IgnoreFilterer(filter),
    }));
    runtime.action_throttle(Duration::from_secs(1));
    runtime.pathset([RUNTIME]);

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

    let watch_exec = Watchexec::new(config, runtime)?;
    watch_exec.main().await?.ok();

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
