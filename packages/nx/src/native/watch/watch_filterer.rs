use ignore::Match;
use ignore::gitignore::{Gitignore, GitignoreBuilder};
use notify::EventKind;
use notify::event::{CreateKind, ModifyKind, RemoveKind};
use std::path::PathBuf;
use tracing::trace;

use crate::native::watch::git_utils::get_gitignore_files;
use crate::native::watch::utils::{canonicalize_event_paths, get_nx_ignore};

#[derive(Debug)]
pub struct WatchFilterer {
    origin: PathBuf,
    nx_ignore: Option<Gitignore>,
    /// Per-directory gitignore instances, sorted deepest-first (most path components first).
    /// Each entry is (directory the .gitignore applies in, compiled Gitignore).
    git_ignores: Vec<(PathBuf, Gitignore)>,
}

impl WatchFilterer {
    fn filter_path(&self, path: &std::path::Path, is_dir: bool) -> bool {
        let path = dunce::simplified(path);
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
            return true;
        // If the nxignore file contains this file as an ignore,
        // then there's no point in checking the gitignore file
        } else if matches!(nx_ignore_match_type, Match::Ignore(_)) {
            trace!(?path, "nxignore ignore match, ignoring gitignore");
            return false;
        }

        // Check gitignores deepest-first; first match wins
        let git_match = self
            .git_ignores
            .iter()
            .filter(|(dir, _)| path.starts_with(dir))
            .find_map(
                |(_, gitignore)| match gitignore.matched_path_or_any_parents(path, is_dir) {
                    Match::None => None,
                    m => Some(m),
                },
            );

        match git_match {
            Some(Match::Ignore(_)) => {
                trace!(?path, "gitignore match - blocked");
                false
            }
            Some(Match::Whitelist(_)) => {
                trace!(?path, "gitignore whitelist match - allowed");
                true
            }
            _ => {
                // No gitignore matched — allow through
                true
            }
        }
    }

    /// Check whether a notify event should be passed through.
    pub fn check_event(&self, event: &notify::Event) -> bool {
        let event = canonicalize_event_paths(event);
        trace!(?event, "checking if event is valid");

        // Check event kind — only allow file-relevant event types.
        match &event.kind {
            EventKind::Modify(ModifyKind::Name(_)) => {}
            EventKind::Modify(ModifyKind::Data(_)) => {}
            EventKind::Create(CreateKind::File) => {}
            EventKind::Remove(RemoveKind::File) => {}

            #[cfg(target_os = "linux")]
            EventKind::Create(CreateKind::Folder)
            | EventKind::Create(CreateKind::Any)
            | EventKind::Remove(RemoveKind::Any)
            | EventKind::Modify(ModifyKind::Any) => {}

            #[cfg(target_os = "macos")]
            EventKind::Create(CreateKind::Folder) | EventKind::Modify(ModifyKind::Metadata(_)) => {}

            #[cfg(windows)]
            EventKind::Modify(ModifyKind::Any)
            | EventKind::Create(CreateKind::Any)
            | EventKind::Remove(RemoveKind::Any) => {}

            other => {
                trace!(?other, "event kind rejected");
                return false;
            }
        }

        // Check each path against ignore rules.
        for path in &event.paths {
            let is_dir = path.is_dir();

            // Reject paths ending with ~ (editor backup files)
            if path.display().to_string().ends_with('~') {
                trace!(?path, "path ends with ~ - rejected");
                return false;
            }

            if !self.filter_path(path, is_dir) {
                return false;
            }
        }

        trace!(?event, "event passed all checks");
        true
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
