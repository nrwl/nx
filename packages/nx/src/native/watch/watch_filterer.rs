use ignore::Match;
use ignore::gitignore::{Gitignore, GitignoreBuilder};
use notify::EventKind;
use notify::event::{CreateKind, ModifyKind, RemoveKind};
use std::path::PathBuf;
use tracing::trace;

use crate::native::watch::git_utils::get_gitignore_files;
use crate::native::watch::types::{RawWatchEvent, meta_is_dir};
use crate::native::watch::utils::get_nx_ignore;

#[derive(Debug)]
pub struct WatchFilterer {
    origin: PathBuf,
    nx_ignore: Option<Gitignore>,
    /// Per-directory gitignore instances, sorted deepest-first (most path components first).
    /// Each entry is (directory the .gitignore applies in, compiled Gitignore).
    git_ignores: Vec<(PathBuf, Gitignore)>,
    /// Roots of linked worktrees, seeded when the watcher booted and topped up
    /// from the event stream by [`WatchFilterer::track_worktree`]. Matched as
    /// path prefixes rather than compiled into the synthetic gitignore above,
    /// so a worktree directory containing gitignore metacharacters can't
    /// produce a bad pattern - or fail the watcher's construction outright.
    worktrees: Vec<PathBuf>,
}

impl WatchFilterer {
    /// Start blocking everything under `root`. The boot-time list only covers
    /// worktrees that already existed, and agent tooling runs
    /// `git worktree add` against a running daemon - on macOS, where the root
    /// is watched recursively, this is the only thing that keeps the new
    /// checkout's events out until a restart.
    pub fn track_worktree(&mut self, root: &std::path::Path) {
        let root = dunce::simplified(root);

        // Blocking the origin would silence the watcher permanently, and a
        // path we can't place under the origin is not ours to block.
        if !root.starts_with(&self.origin) || root == self.origin {
            return;
        }

        if !self.worktrees.iter().any(|known| known == root) {
            self.worktrees.push(root.to_path_buf());
        }
    }

    fn filter_path(&self, path: &std::path::Path, is_dir: bool) -> bool {
        let path = dunce::simplified(path);

        if self
            .worktrees
            .iter()
            .any(|worktree| path.starts_with(worktree))
        {
            trace!(?path, "inside a linked worktree - blocked");
            return false;
        }

        // .nxignore takes precedence over .gitignore. Only consult it for
        // paths under the origin — gitignore-style matchers are scoped to
        // the directory the ignore file lives in, so external symlink
        // targets shouldn't be matched against workspace rules.
        let nx_match = if let Some(ig) = &self.nx_ignore
            && path.starts_with(&self.origin)
        {
            ig.matched_path_or_any_parents(path, is_dir)
        } else {
            Match::None
        };

        match nx_match {
            Match::Whitelist(_) => {
                trace!(?path, "nxignore whitelist match, ignoring gitignore");
                return true;
            }
            Match::Ignore(_) => {
                trace!(?path, "nxignore ignore match, ignoring gitignore");
                return false;
            }
            Match::None => {}
        }

        // Check gitignores deepest-first; first non-None match wins.
        let git_match = self
            .git_ignores
            .iter()
            .filter(|(dir, _)| path.starts_with(dir))
            .map(|(_, ig)| ig.matched_path_or_any_parents(path, is_dir))
            .find(|m| !matches!(m, Match::None));

        match git_match {
            Some(Match::Ignore(_)) => {
                trace!(?path, "gitignore match - blocked");
                false
            }
            Some(Match::Whitelist(_)) => {
                trace!(?path, "gitignore whitelist match - allowed");
                true
            }
            _ => true,
        }
    }

    /// Check whether a watch event should be passed through.
    pub fn check_event(&self, event: &RawWatchEvent) -> bool {
        trace!(event = ?event.event, "checking if event is valid");

        // Check event kind — only allow file-relevant event types.
        match event.kind() {
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
        for (path, metadata) in event.paths() {
            // Reject paths ending with ~ (editor backup files)
            if path.display().to_string().ends_with('~') {
                trace!(?path, "path ends with ~ - rejected");
                return false;
            }

            if !self.filter_path(path, meta_is_dir(metadata)) {
                return false;
            }
        }

        trace!(event = ?event.event, "event passed all checks");
        true
    }
}

pub(super) fn create_filter(
    origin: &str,
    additional_globs: &[String],
    worktrees: &[PathBuf],
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
        worktrees: worktrees
            .iter()
            .map(|worktree| dunce::simplified(worktree).to_path_buf())
            .collect(),
    })
}

#[cfg(test)]
mod test {
    use std::path::{Path, PathBuf};

    use assert_fs::TempDir;

    use super::*;

    fn filterer(origin: &Path, worktrees: &[PathBuf]) -> WatchFilterer {
        create_filter(origin.to_str().unwrap(), &[], worktrees, false).expect("filter builds")
    }

    fn temp_origin(temp: &TempDir) -> PathBuf {
        temp.path()
            .canonicalize()
            .unwrap_or_else(|_| temp.path().to_path_buf())
    }

    #[test]
    fn blocks_everything_under_a_worktree_seeded_at_boot() {
        // The only defence on macOS, where the root is watched recursively and
        // the walker's prune never gets a say.
        let temp = TempDir::new().unwrap();
        let origin = temp_origin(&temp);
        let worktree = origin.join(".claude/worktrees/wt");

        let filterer = filterer(&origin, std::slice::from_ref(&worktree));

        assert!(!filterer.filter_path(&worktree, true));
        assert!(!filterer.filter_path(&worktree.join("libs/proj/src/app.ts"), false));
        assert!(filterer.filter_path(&origin.join("libs/proj/src/app.ts"), false));
    }

    #[test]
    fn matches_whole_path_components_only() {
        // A prefix comparison on strings would swallow `wt-other` too.
        let temp = TempDir::new().unwrap();
        let origin = temp_origin(&temp);
        let worktree = origin.join("nested/wt");

        let filterer = filterer(&origin, std::slice::from_ref(&worktree));

        assert!(!filterer.filter_path(&worktree.join("app.ts"), false));
        assert!(filterer.filter_path(&origin.join("nested/wt-other/app.ts"), false));
    }

    #[test]
    fn track_worktree_blocks_one_that_appears_after_boot() {
        let temp = TempDir::new().unwrap();
        let origin = temp_origin(&temp);
        let worktree = origin.join(".claude/worktrees/wt");
        let inside = worktree.join("app.ts");

        let mut filterer = filterer(&origin, &[]);
        assert!(filterer.filter_path(&inside, false));

        filterer.track_worktree(&worktree);

        assert!(!filterer.filter_path(&inside, false));
    }

    #[test]
    fn track_worktree_refuses_the_origin() {
        // Blocking the origin would silence the watcher for the whole session.
        let temp = TempDir::new().unwrap();
        let origin = temp_origin(&temp);

        let mut filterer = filterer(&origin, &[]);
        filterer.track_worktree(&origin);

        assert!(filterer.worktrees.is_empty());
        assert!(filterer.filter_path(&origin.join("nx.json"), false));
    }

    #[test]
    fn track_worktree_refuses_paths_outside_the_origin() {
        // `git worktree add ../elsewhere` is ordinary. Its events are not ours
        // to block, and containment is what keeps them out.
        let temp = TempDir::new().unwrap();
        let elsewhere = TempDir::new().unwrap();
        let origin = temp_origin(&temp);
        let outside = temp_origin(&elsewhere).join("wt");

        let mut filterer = filterer(&origin, &[]);
        filterer.track_worktree(&outside);

        assert!(filterer.worktrees.is_empty());
    }

    #[test]
    fn track_worktree_does_not_accumulate_duplicates() {
        // Called from the event stream and from every backfill, so the same
        // root arrives repeatedly.
        let temp = TempDir::new().unwrap();
        let origin = temp_origin(&temp);
        let worktree = origin.join("nested/wt");

        let mut filterer = filterer(&origin, &[]);
        filterer.track_worktree(&worktree);
        filterer.track_worktree(&worktree);

        assert_eq!(filterer.worktrees.len(), 1);
    }
}
