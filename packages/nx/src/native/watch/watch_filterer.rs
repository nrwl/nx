use ignore::Match;
use tracing::trace;
use watchexec::error::RuntimeError;
use watchexec::filter::Filterer;
use watchexec_events::filekind::{CreateKind, FileEventKind, ModifyKind, RemoveKind};

use ignore_files::IgnoreFilter;
use watchexec_events::{Event, FileType, Priority, Source, Tag};
use watchexec_filterer_ignore::IgnoreFilterer;

use crate::native::watch::utils::{get_ignore_files, get_nx_ignore, transform_event};

#[derive(Debug)]
pub struct WatchFilterer {
    pub nx_ignore: Option<IgnoreFilter>,
    pub git_ignore: IgnoreFilterer,
}

impl WatchFilterer {
    fn filter_event(&self, event: &Event, priority: Priority) -> bool {
        let mut pass = true;
        for (path, file_type) in event.paths() {
            let path = dunce::simplified(path);
            let is_dir = file_type.map_or(false, |t| matches!(t, FileType::Dir));
            let nx_ignore_match_type = if let Some(nx_ignore) = &self.nx_ignore {
                nx_ignore.match_path(path, is_dir)
            } else {
                Match::None
            };

            // if the nxignore file contains this file as a whitelist,
            // we do not want gitignore to filter it out, so it will always pass as true
            if matches!(nx_ignore_match_type, Match::Whitelist(_)) {
                trace!(?path, "nxignore whitelist match, ignoring gitignore");
                pass &= true;
            // If the nxignore file contains this file as an ignore,
            // then there's no point in checking the gitignore file
            } else if matches!(nx_ignore_match_type, Match::Ignore(_)) {
                trace!(?path, "nxignore ignore match, ignoring gitignore");
                pass &= false;
            } else {
                pass &= self
                    .git_ignore
                    .check_event(event, priority)
                    .expect("git ignore check never errors")
            }
        }

        pass
    }
}

/// Used to filter out events that that come from watchexec
impl Filterer for WatchFilterer {
    fn check_event(&self, watch_event: &Event, priority: Priority) -> Result<bool, RuntimeError> {
        let transformed = transform_event(watch_event);
        let event = transformed.as_ref().unwrap_or(watch_event);

        trace!(?event, "checking if event is valid");
        if !self.filter_event(event, priority) {
            return Ok(false);
        }

        // Tags will be a Vec that contains multiple types of information for a given event
        // We are only interested if:
        // 1) A `FileEventKind` is modified, created, removed, or renamed
        // 2) A Path that is a FileType::File
        // 3) Deleted files do not have a FileType::File (because they're deleted..), check if a path is valid
        // 4) Only FileSystem sources are valid
        // If there's a tag that doesnt confine to this criteria, we `return` early, otherwise we `continue`.
        for tag in &event.tags {
            match tag {
                // Tag::Source(Source::Keyboard) => continue,
                // Tag::Keyboard(Keyboard::Eof) => continue,
                Tag::FileEventKind(file_event) => match file_event {
                    FileEventKind::Modify(ModifyKind::Name(_)) => continue,
                    FileEventKind::Modify(ModifyKind::Data(_)) => continue,
                    FileEventKind::Create(CreateKind::File) => continue,
                    FileEventKind::Remove(RemoveKind::File) => continue,

                    #[cfg(target_os = "linux")]
                    FileEventKind::Create(CreateKind::Folder) => continue,

                    #[cfg(windows)]
                    FileEventKind::Modify(ModifyKind::Any) => continue,
                    #[cfg(windows)]
                    FileEventKind::Create(CreateKind::Any) => continue,
                    #[cfg(windows)]
                    FileEventKind::Remove(RemoveKind::Any) => continue,

                    _ => return Ok(false),
                },
                // Deleted files do not have a file_type + we don't want directory changes + we dont want files that end with `~`
                Tag::Path {
                    path,
                    file_type: Some(FileType::File) | None,
                } if !path.display().to_string().ends_with('~') => continue,

                #[cfg(target_os = "linux")]
                Tag::Path {
                    path: _,
                    file_type: Some(FileType::Dir),
                } => continue,

                Tag::Source(Source::Filesystem) => continue,
                _ => return Ok(false),
            }
        }

        trace!(?event, "event passed all checks");

        Ok(true)
    }
}

pub(super) async fn create_filter(
    origin: &str,
    additional_globs: &[String],
    use_ignore: bool,
) -> anyhow::Result<WatchFilterer> {
    let ignore_files = get_ignore_files(use_ignore, origin);
    let nx_ignore_file = get_nx_ignore(origin);

    trace!(
        ?use_ignore,
        ?additional_globs,
        ?ignore_files,
        "Using these ignore files for the watcher"
    );
    let mut git_ignore = if let Some(ignore_files) = ignore_files {
        IgnoreFilter::new(origin, &ignore_files)
            .await
            .map_err(anyhow::Error::from)?
    } else {
        IgnoreFilter::empty(origin)
    };

    git_ignore
        .add_globs(
            &additional_globs
                .iter()
                .map(String::as_ref)
                .collect::<Vec<_>>(),
            Some(&origin.into()),
        )
        .map_err(anyhow::Error::from)?;

    let nx_ignore = if let Some(nx_ignore_file) = nx_ignore_file {
        Some(
            IgnoreFilter::new(origin, &[nx_ignore_file])
                .await
                .map_err(anyhow::Error::from)?,
        )
    } else {
        None
    };

    Ok(WatchFilterer {
        git_ignore: IgnoreFilterer(git_ignore),
        nx_ignore,
    })
}
