use ignore::Match;
use ignore::gitignore::{Gitignore, GitignoreBuilder};
use std::path::PathBuf;
use tracing::trace;
use watchexec::error::RuntimeError;
use watchexec::filter::Filterer;
use watchexec_events::filekind::{CreateKind, FileEventKind, ModifyKind, RemoveKind};

use crate::native::watch::git_utils::get_gitignore_files;
use crate::native::watch::utils::{get_nx_ignore, transform_event};
use watchexec_events::{Event, FileType, Priority, Source, Tag};

#[derive(Debug)]
pub struct WatchFilterer {
    origin: PathBuf,
    nx_ignore: Option<Gitignore>,
    /// Per-directory gitignore instances, sorted deepest-first (most path components first).
    /// Each entry is (directory the .gitignore applies in, compiled Gitignore).
    git_ignores: Vec<(PathBuf, Gitignore)>,
}

impl WatchFilterer {
    fn filter_event(&self, event: &Event) -> bool {
        let mut pass = true;
        for (path, file_type) in event.paths() {
            let path = dunce::simplified(path);
            let is_dir = file_type.is_some_and(|t| matches!(t, FileType::Dir));
            let nx_ignore_match_type = if let Some(nx_ignore) = &self.nx_ignore {
                if path.starts_with(&self.origin) {
                    nx_ignore.matched_path_or_any_parents(path, is_dir)
                } else {
                    Match::None
                }
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
                // Check gitignores deepest-first; first match wins
                let git_match = self
                    .git_ignores
                    .iter()
                    .filter(|(dir, _)| path.starts_with(dir))
                    .find_map(|(_, gitignore)| {
                        match gitignore.matched_path_or_any_parents(path, is_dir) {
                            Match::None => None,
                            m => Some(m),
                        }
                    });

                match git_match {
                    Some(Match::Ignore(_)) => {
                        trace!(?path, "gitignore match - blocked");
                        pass &= false;
                    }
                    Some(Match::Whitelist(_)) => {
                        trace!(?path, "gitignore whitelist match - allowed");
                        pass &= true;
                    }
                    _ => {
                        // No gitignore matched — allow through
                        pass &= true;
                    }
                }
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
        if !self.filter_event(event) {
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
                    FileEventKind::Create(CreateKind::Folder)
                    | FileEventKind::Create(CreateKind::Any)
                    | FileEventKind::Remove(RemoveKind::Any)
                    | FileEventKind::Modify(ModifyKind::Any) => continue,

                    #[cfg(target_os = "macos")]
                    FileEventKind::Create(CreateKind::Folder)
                    | FileEventKind::Modify(ModifyKind::Metadata(_)) => continue,

                    #[cfg(windows)]
                    FileEventKind::Modify(ModifyKind::Any)
                    | FileEventKind::Create(CreateKind::Any)
                    | FileEventKind::Remove(RemoveKind::Any) => continue,

                    _ => return Ok(false),
                },
                // Deleted files do not have a file_type + we don't want directory changes + we dont want files that end with `~`
                Tag::Path {
                    path,
                    file_type: Some(FileType::File) | None,
                } if !path.display().to_string().ends_with('~') => continue,

                // Allow directory events through on Linux, Windows, and macOS so that the
                // action handler can dynamically register watches for new directories.
                #[cfg(any(target_os = "linux", target_os = "macos", windows))]
                Tag::Path {
                    path: _,
                    file_type: Some(FileType::Dir),
                } => continue,

                Tag::Source(Source::Filesystem) => continue,
                _ => {
                    trace!(?tag, "tag rejected event");
                    return Ok(false);
                }
            }
        }

        trace!(?event, "event passed all checks");

        Ok(true)
    }
}

pub(super) fn create_filter(
    origin: &str,
    additional_globs: &[String],
    use_ignore: bool,
) -> anyhow::Result<WatchFilterer> {
    let ignore_files = use_ignore.then(|| get_gitignore_files(origin));
    let nx_ignore_path = get_nx_ignore(origin);

    trace!(
        ?use_ignore,
        ?additional_globs,
        ?ignore_files,
        "Using these ignore files for the watcher"
    );

    let mut git_ignores: Vec<(PathBuf, Gitignore)> = Vec::new();

    // Build per-directory Gitignore instances from .gitignore files
    if let Some(paths) = ignore_files {
        for gitignore_path in paths {
            let (gitignore, err) = Gitignore::new(&gitignore_path);
            if let Some(err) = err {
                trace!(
                    ?err,
                    ?gitignore_path,
                    "error parsing gitignore, using partial result"
                );
            }
            let dir = gitignore_path
                .parent()
                .unwrap_or(&gitignore_path)
                .to_path_buf();
            git_ignores.push((dir, gitignore));
        }
    }

    // Build additional globs as a synthetic gitignore rooted at origin
    if !additional_globs.is_empty() {
        let mut builder = GitignoreBuilder::new(origin);
        for glob in additional_globs {
            builder.add_line(None, glob)?;
        }
        let gitignore = builder.build()?;
        git_ignores.push((PathBuf::from(origin), gitignore));
    }

    // Sort deepest-first (most path components first) so deeper gitignores take priority
    git_ignores.sort_by(|(a, _), (b, _)| {
        let a_depth = a.components().count();
        let b_depth = b.components().count();
        b_depth.cmp(&a_depth)
    });

    // Build .nxignore
    let nx_ignore = if let Some(nxignore_path) = nx_ignore_path {
        let (gitignore, err) = Gitignore::new(&nxignore_path);
        if let Some(err) = err {
            trace!(
                ?err,
                ?nxignore_path,
                "error parsing nxignore, using partial result"
            );
        }
        Some(gitignore)
    } else {
        None
    };

    Ok(WatchFilterer {
        origin: PathBuf::from(origin),
        git_ignores,
        nx_ignore,
    })
}
