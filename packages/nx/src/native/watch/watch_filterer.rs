use ignore::Match;
use ignore::gitignore::{Gitignore, GitignoreBuilder};
use notify::EventKind;
use notify::event::{CreateKind, ModifyKind, RemoveKind};
use std::path::{Path, PathBuf};
use tracing::trace;

use crate::native::watch::git_utils::get_ignore_files;
use crate::native::watch::types::{RawWatchEvent, meta_is_dir};
use crate::native::watch::utils::get_nx_ignore;

#[derive(Debug)]
pub struct WatchFilterer {
    origin: PathBuf,
    /// The root .nxignore, consulted first in the path-level decision.
    nx_ignore: Option<Gitignore>,
    /// Path-level matchers: per-directory .gitignore instances plus the
    /// synthetic matcher built from caller-supplied globs, sorted
    /// deepest-first (most path components first); first non-None match wins.
    git_ignores: Vec<(PathBuf, Gitignore)>,
    /// Matchers deciding whether the walker would descend into an ancestor
    /// directory, in the same source order WalkBuilder resolves them:
    /// .nxignore files, then .ignore files, then .gitignore files (each
    /// group deepest-first), then parent .gitignore files. Caller-supplied
    /// globs are excluded: the walker never sees them, and their negations
    /// must keep re-including files under ignored parents (e.g. the daemon's
    /// `!.nx/workspace-data/d/server-process.json`).
    ancestor_ignores: Vec<(PathBuf, Gitignore)>,
}

/// Whether the walker would prune this directory and not descend into it:
/// the first matcher with an opinion says Ignore. Each entry is checked
/// against the directory alone (no parent walking); the caller feeds every
/// ancestor level separately, mirroring the walker's descent. Only matchers
/// from proper ancestors of the directory vote: the walker loads a
/// directory's own ignore files after deciding to descend into it, so they
/// cannot influence that decision.
fn ancestor_ignored(entries: &[&(PathBuf, Gitignore)], dir: &Path) -> bool {
    for (ig_dir, ig) in entries {
        if dir == ig_dir || !dir.starts_with(ig_dir) {
            continue;
        }
        match ig.matched(dir, true) {
            Match::Whitelist(_) => return false,
            Match::Ignore(_) => return true,
            Match::None => {}
        }
    }
    false
}

impl WatchFilterer {
    fn filter_path(&self, path: &Path, is_dir: bool) -> bool {
        let path = dunce::simplified(path);
        let under_origin = path.starts_with(&self.origin);

        // Mirror the walker's descent: check every ancestor directory from
        // the origin down and stop at the first ignored one. This enforces
        // git's rule that a file cannot be re-included (e.g. by an .nxignore
        // negation) when a parent directory is excluded. The walker prunes
        // such a directory and never produces its files, so the watcher must
        // not deliver events for them either.
        if under_origin && !self.ancestor_ignores.is_empty() {
            // Select the matchers that can apply anywhere along this path
            // once, so the loop doesn't rescan every matcher per level.
            let applicable: Vec<&(PathBuf, Gitignore)> = self
                .ancestor_ignores
                .iter()
                .filter(|(dir, _)| path.starts_with(dir))
                .collect();

            if !applicable.is_empty() {
                let ancestors: Vec<&Path> = path
                    .ancestors()
                    .skip(1)
                    .take_while(|a| *a != self.origin && a.starts_with(&self.origin))
                    .collect();
                for dir in ancestors.iter().rev() {
                    if ancestor_ignored(&applicable, dir) {
                        trace!(?path, ?dir, "ignored parent directory - blocked");
                        return false;
                    }
                }
            }
        }

        // Path-level decision, unchanged by the descent check above.
        // .nxignore takes precedence over .gitignore. Only consult it for
        // paths under the origin: gitignore-style matchers are scoped to
        // the directory the ignore file lives in, so external symlink
        // targets shouldn't be matched against workspace rules.
        let nx_match = if let Some(ig) = &self.nx_ignore
            && under_origin
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
    use_ignore: bool,
) -> anyhow::Result<WatchFilterer> {
    let ignore_files = use_ignore.then(|| get_ignore_files(origin));
    let nx_ignore_path = get_nx_ignore(origin);

    trace!(
        ?use_ignore,
        ?additional_globs,
        "Using these ignore files for the watcher"
    );

    let compile = |path: &PathBuf| -> (PathBuf, Gitignore) {
        let (gitignore, err) = Gitignore::new(path);
        if let Some(err) = err {
            trace!(
                ?err,
                ?path,
                "error parsing ignore file, using partial result"
            );
        }
        let dir = path.parent().unwrap_or(path).to_path_buf();
        (dir, gitignore)
    };

    let mut git_ignores: Vec<(PathBuf, Gitignore)> = Vec::new();
    // (source rank, dir, matcher); rank follows WalkBuilder's resolution
    // order: 0 = .nxignore (custom), 1 = .ignore, 2 = .gitignore,
    // 3 = parent .gitignore (explicit ignores, consulted last).
    let mut ancestor_ignores: Vec<(u8, PathBuf, Gitignore)> = Vec::new();

    if let Some(files) = &ignore_files {
        for path in &files.gitignores {
            let (dir, gitignore) = compile(path);
            git_ignores.push((dir.clone(), gitignore.clone()));
            ancestor_ignores.push((2, dir, gitignore));
        }
        // The walker registers parent .gitignore files via `add_ignore`,
        // which compiles them rooted at the process CWD and consults them
        // last, for every entry, farthest directory first. Mirror that in
        // the descent check (same process, same CWD; the list arrives
        // nearest-first, so reverse it); the path-level chain keeps the
        // parent-rooted matcher it always had.
        for path in &files.parent_gitignores {
            let (dir, gitignore) = compile(path);
            git_ignores.push((dir, gitignore));
        }
        if let Ok(cwd) = std::env::current_dir() {
            for path in files.parent_gitignores.iter().rev() {
                let mut builder = GitignoreBuilder::new(&cwd);
                builder.add(path);
                if let Ok(gitignore) = builder.build() {
                    ancestor_ignores.push((3, PathBuf::from(origin), gitignore));
                }
            }
        }
        for path in &files.dot_ignores {
            let (dir, gitignore) = compile(path);
            ancestor_ignores.push((1, dir, gitignore));
        }
        for path in &files.nxignores {
            let (dir, gitignore) = compile(path);
            ancestor_ignores.push((0, dir, gitignore));
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

    // Build .nxignore. When use_ignore is false the walker applies no
    // filtering at all, so there is no descent to mirror and the ancestor
    // chain stays empty; the path-level .nxignore check still applies.
    let nx_ignore = if let Some(nxignore_path) = &nx_ignore_path {
        let (_, gitignore) = compile(nxignore_path);
        Some(gitignore)
    } else {
        None
    };

    // Sort deepest-first (most path components first) so deeper gitignores take priority
    git_ignores.sort_by(|(a, _), (b, _)| {
        let a_depth = a.components().count();
        let b_depth = b.components().count();
        b_depth.cmp(&a_depth)
    });

    // Source rank first, then deepest-first within each source.
    ancestor_ignores.sort_by(|(a_rank, a_dir, _), (b_rank, b_dir, _)| {
        a_rank.cmp(b_rank).then_with(|| {
            let a_depth = a_dir.components().count();
            let b_depth = b_dir.components().count();
            b_depth.cmp(&a_depth)
        })
    });

    Ok(WatchFilterer {
        origin: PathBuf::from(origin),
        git_ignores,
        nx_ignore,
        ancestor_ignores: ancestor_ignores
            .into_iter()
            .map(|(_, dir, ig)| (dir, ig))
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn filterer(origin: &Path) -> WatchFilterer {
        create_filter(origin.to_str().unwrap(), &[], true).unwrap()
    }

    #[test]
    fn nxignore_negation_does_not_reinclude_under_ignored_dir() {
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".gitignore"), "dist/\n.env*\n").unwrap();
        fs::write(origin.join(".nxignore"), "!.env.e2e\n").unwrap();

        let f = filterer(&origin);
        // git's rule: a file cannot be re-included when a parent directory is
        // excluded. The walker prunes dist/ and never sees these paths, so the
        // watcher must drop them too.
        assert!(!f.filter_path(&origin.join("dist/.env.e2e"), false));
        assert!(!f.filter_path(&origin.join("packages/a/dist/.env.e2e"), false));
    }

    #[test]
    fn nxignore_negation_reincludes_at_root() {
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".gitignore"), ".env*\n").unwrap();
        fs::write(origin.join(".nxignore"), "!.env.e2e\n").unwrap();

        let f = filterer(&origin);
        assert!(f.filter_path(&origin.join(".env.e2e"), false));
        assert!(!f.filter_path(&origin.join(".env.local"), false));
    }

    #[test]
    fn nxignore_whitelisted_dir_allows_descent() {
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".gitignore"), "dist/\n").unwrap();
        fs::write(origin.join(".nxignore"), "!dist/\n").unwrap();

        let f = filterer(&origin);
        assert!(f.filter_path(&origin.join("dist/foo.txt"), false));
    }

    #[test]
    fn gitignored_paths_are_filtered() {
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".gitignore"), "dist/\n*.log\n").unwrap();

        let f = filterer(&origin);
        assert!(!f.filter_path(&origin.join("dist/main.js"), false));
        assert!(!f.filter_path(&origin.join("dist/nested/main.js"), false));
        assert!(!f.filter_path(&origin.join("debug.log"), false));
        assert!(f.filter_path(&origin.join("src/index.ts"), false));
    }

    #[test]
    fn additional_glob_negation_reincludes_under_ignored_dir() {
        // The daemon's outputs watcher relies on this: it passes
        // `!.nx/workspace-data/d/server-process.json` as an additional glob
        // so a replaced daemon notices the takeover, while the hardcoded
        // globs ignore `**/.nx/workspace-data`. Caller-supplied globs are
        // not fs ignore files (the walker never sees them), so the negation
        // must keep re-including the file despite the ignored parent.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();

        let f = create_filter(
            origin.to_str().unwrap(),
            &[
                "**/.nx/workspace-data".to_string(),
                "!.nx/workspace-data/d/server-process.json".to_string(),
            ],
            false,
        )
        .unwrap();
        assert!(f.filter_path(
            &origin.join(".nx/workspace-data/d/server-process.json"),
            false
        ));
        assert!(!f.filter_path(&origin.join(".nx/workspace-data/d/other.json"), false));
    }

    #[test]
    fn gitignore_parent_whitelist_beats_additional_globs() {
        // The path-level decision is first-non-None across matchers,
        // deepest-first, with parent-derived whitelists participating: a
        // .gitignore whitelisting dist/ wins over a caller glob ignoring its
        // contents, exactly as before the ancestor descent check existed.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".gitignore"), "!dist/\n").unwrap();

        let f = create_filter(origin.to_str().unwrap(), &["dist/**".to_string()], true).unwrap();
        assert!(f.filter_path(&origin.join("dist/file.txt"), false));
    }

    #[test]
    fn dot_ignore_whitelisted_dir_cancels_gitignore_prune() {
        // .ignore files participate in the walker's descent decision with
        // higher precedence than .gitignore: a whitelist there keeps the
        // walker descending, so the watcher must not prune on the
        // .gitignore alone.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".gitignore"), "dist/\n").unwrap();
        fs::write(origin.join(".ignore"), "!dist/\n").unwrap();
        fs::write(origin.join(".nxignore"), "!dist/keep.txt\n").unwrap();

        let f = filterer(&origin);
        assert!(f.filter_path(&origin.join("dist/keep.txt"), false));
    }

    #[test]
    fn dot_ignored_dir_contents_are_filtered() {
        // The walker prunes a directory ignored by an .ignore file, so the
        // watcher must not deliver events from it either.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".ignore"), "dist/\n").unwrap();

        let f = filterer(&origin);
        assert!(!f.filter_path(&origin.join("dist/main.js"), false));
        assert!(f.filter_path(&origin.join("src/index.ts"), false));
    }

    #[test]
    fn nested_nxignore_whitelist_cancels_root_nxignore_prune() {
        // The walker loads .nxignore in every directory it descends into,
        // deepest-first: a nested whitelist masks the root's Ignore at that
        // level, so the walker descends and the watcher must not prune.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(
            origin.join(".nxignore"),
            "sub/blocked/\n!sub/blocked/keep.txt\n",
        )
        .unwrap();
        fs::create_dir_all(origin.join("sub")).unwrap();
        fs::write(origin.join("sub/.nxignore"), "!blocked/\n").unwrap();

        let f = filterer(&origin);
        assert!(f.filter_path(&origin.join("sub/blocked/keep.txt"), false));
    }

    #[test]
    fn ignore_file_inside_pruned_dir_cannot_cancel_its_own_prune() {
        // The walker loads a directory's ignore files only after deciding to
        // descend into it, so an .ignore inside dist/ cannot rescue dist/
        // from being pruned.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".gitignore"), "dist/\n").unwrap();
        fs::write(origin.join(".nxignore"), "!dist/keep.txt\n").unwrap();
        fs::create_dir_all(origin.join("dist")).unwrap();
        fs::write(origin.join("dist/.ignore"), "!*\n").unwrap();

        let f = filterer(&origin);
        assert!(!f.filter_path(&origin.join("dist/keep.txt"), false));
    }

    #[test]
    fn no_descent_check_without_use_ignore() {
        // With use_ignore off the walker applies no filtering, so there is
        // no descent to mirror: the path-level decision alone applies, and
        // there the .nxignore negation wins path-first. The daemon's outputs
        // watcher runs in this mode.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".nxignore"), "dist/\n!dist/keep.txt\n").unwrap();

        let f = create_filter(origin.to_str().unwrap(), &[], false).unwrap();
        assert!(f.filter_path(&origin.join("dist/keep.txt"), false));
        assert!(!f.filter_path(&origin.join("dist/other.txt"), false));
    }

    #[test]
    fn parent_gitignore_prunes_like_the_walker() {
        // The walker registers parent .gitignore files via `add_ignore`,
        // which roots patterns at the process CWD: an unanchored pattern
        // still matches by basename anywhere and prunes, while an anchored
        // one anchors to the CWD (not the parent directory) and therefore
        // does not match the workspace's directories.
        let parent = tempdir().unwrap();
        let parent_path = parent.path().canonicalize().unwrap();
        fs::create_dir_all(parent_path.join(".git")).unwrap();
        fs::write(parent_path.join(".gitignore"), "foo/\n/workspace/bar/\n").unwrap();
        let origin = parent_path.join("workspace");
        fs::create_dir_all(&origin).unwrap();
        fs::write(origin.join(".nxignore"), "!foo/keep.txt\n!bar/keep.txt\n").unwrap();

        let f = filterer(&origin);
        assert!(!f.filter_path(&origin.join("foo/keep.txt"), false));
        assert!(f.filter_path(&origin.join("bar/keep.txt"), false));
    }

    #[test]
    fn farther_parent_gitignore_whitelist_wins_over_nearer_ignore() {
        // The walker consults explicit (parent) ignore files
        // farthest-directory-first, so a whitelist in the git root beats an
        // ignore in a nearer parent and the walker still descends.
        let root = tempdir().unwrap();
        let root_path = root.path().canonicalize().unwrap();
        fs::create_dir_all(root_path.join(".git")).unwrap();
        fs::write(root_path.join(".gitignore"), "!foo/\n").unwrap();
        fs::create_dir_all(root_path.join("near")).unwrap();
        fs::write(root_path.join("near/.gitignore"), "foo/\n").unwrap();
        let origin = root_path.join("near/workspace");
        fs::create_dir_all(&origin).unwrap();
        fs::write(origin.join(".nxignore"), "!foo/keep.txt\n").unwrap();

        let f = filterer(&origin);
        assert!(f.filter_path(&origin.join("foo/keep.txt"), false));
    }

    #[test]
    fn nested_gitignore_applies_within_its_dir() {
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::create_dir_all(origin.join("packages/a")).unwrap();
        fs::write(origin.join("packages/a/.gitignore"), "generated/\n").unwrap();

        let f = filterer(&origin);
        assert!(!f.filter_path(&origin.join("packages/a/generated/out.ts"), false));
        assert!(f.filter_path(&origin.join("packages/b/generated/out.ts"), false));
    }
}
