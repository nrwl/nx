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
    /// Whether to mirror the walker's ignore-file handling. When false the
    /// walker applies no filtering, so `fs_ignores` stays empty and the
    /// legacy path-level `.nxignore` check applies instead.
    use_ignore: bool,
    /// The root .nxignore, consulted path-first only when `use_ignore` is
    /// false (the daemon's outputs watcher). With `use_ignore` on, .nxignore
    /// files are part of `fs_ignores` and follow walker semantics.
    nx_ignore: Option<Gitignore>,
    /// Filesystem ignore matchers in the same source order WalkBuilder
    /// resolves them: .nxignore files, then .ignore files, then workspace
    /// .gitignore files (each group deepest-first), then parent .gitignore
    /// files. Used for both the descent decision and the file decision.
    fs_ignores: Vec<(PathBuf, Gitignore)>,
    /// Caller-supplied globs plus the always-on patterns, as one matcher
    /// rooted at origin. Kept separate from `fs_ignores`: the walker never
    /// sees these globs, and their negations must keep re-including files
    /// under ignored parents (e.g. the daemon's
    /// `!.nx/workspace-data/d/server-process.json` takeover glob, whose
    /// negation line outranks the hardcoded `**/.nx/workspace-data` line
    /// within the same matcher). With `use_ignore` on, applied to every
    /// path the ignore files don't exclude, whitelisted ones included: the
    /// walker's own hardcoded patterns apply unconditionally in
    /// `filter_entry`, so an ignore-file whitelist must not bypass this
    /// matcher either. In the legacy mode a root `.nxignore` match still
    /// decides path-first.
    additional_globs: Option<Gitignore>,
}

/// The first matcher with an opinion on this path wins, mirroring the
/// walker's per-source resolution. Each entry is checked against the path
/// alone (no parent walking); the caller feeds ancestor directories
/// separately for the descent decision. Matchers vote only on paths strictly
/// inside their directory: the walker loads a directory's own ignore files
/// after deciding to descend into it, so they cannot influence that
/// decision, and a file is only ever matched by ignore files at or above its
/// parent. Returns Some(true) for Ignore, Some(false) for Whitelist.
fn first_opinion(entries: &[&(PathBuf, Gitignore)], path: &Path, is_dir: bool) -> Option<bool> {
    for (ig_dir, ig) in entries {
        if path == *ig_dir || !path.starts_with(ig_dir) {
            continue;
        }
        match ig.matched(path, is_dir) {
            Match::Whitelist(_) => return Some(false),
            Match::Ignore(_) => return Some(true),
            Match::None => {}
        }
    }
    None
}

impl WatchFilterer {
    fn filter_path(&self, path: &Path, is_dir: bool) -> bool {
        let path = dunce::simplified(path);
        let under_origin = path.starts_with(&self.origin);

        if self.use_ignore {
            // Mirror the walker's two decisions. Descent: check every
            // ancestor directory from the origin down and stop at the first
            // ignored one. This enforces git's rule that a file cannot be
            // re-included (e.g. by an .nxignore negation) when a parent
            // directory is excluded. File: the same ranked matchers decide
            // the path itself. Only an Ignore ends the check here: a
            // whitelisted file is one the walker includes, and those still
            // go through the additional globs below.
            if under_origin && !self.fs_ignores.is_empty() {
                // Select the matchers that can apply anywhere along this path
                // once, so the loops don't rescan every matcher per level.
                let applicable: Vec<&(PathBuf, Gitignore)> = self
                    .fs_ignores
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
                        if first_opinion(&applicable, dir, true) == Some(true) {
                            trace!(?path, ?dir, "ignored parent directory - blocked");
                            return false;
                        }
                    }

                    // Ignore files themselves skip the file-level decision:
                    // the walker reads a directory's ignore files even when
                    // their own paths match an ignore rule, and the daemon
                    // restarts on their events to rebuild this filter (see
                    // daemon/server/watcher.ts), so suppressing them would
                    // leave the daemon holding stale rules. The descent
                    // check above still applies: the walker never reads
                    // ignore files inside pruned directories, so those edits
                    // cannot change the walk. Directories named like ignore
                    // files are not ignore files; the walker prunes them
                    // normally.
                    let is_control_file = !is_dir
                        && matches!(
                            path.file_name().and_then(|f| f.to_str()),
                            Some(".gitignore" | ".ignore" | ".nxignore")
                        );
                    if !is_control_file && first_opinion(&applicable, path, is_dir) == Some(true) {
                        trace!(?path, "ignore file match - blocked");
                        return false;
                    }
                }
            }
        } else if let Some(ig) = &self.nx_ignore
            && under_origin
        {
            // Legacy mode: the walker applies no filtering, so there are no
            // walker decisions to mirror. The root .nxignore applies
            // path-first, negation included. Only consult it for paths under
            // the origin: gitignore-style matchers are scoped to the
            // directory the ignore file lives in, so external symlink
            // targets shouldn't be matched against workspace rules.
            match ig.matched_path_or_any_parents(path, is_dir) {
                Match::Whitelist(_) => {
                    trace!(?path, "nxignore whitelist match - allowed");
                    return true;
                }
                Match::Ignore(_) => {
                    trace!(?path, "nxignore ignore match - blocked");
                    return false;
                }
                Match::None => {}
            }
        }

        if let Some(ig) = &self.additional_globs
            && under_origin
        {
            match ig.matched_path_or_any_parents(path, is_dir) {
                Match::Ignore(_) => {
                    trace!(?path, "additional glob match - blocked");
                    return false;
                }
                Match::Whitelist(_) => {
                    trace!(?path, "additional glob whitelist match - allowed");
                    return true;
                }
                Match::None => {}
            }
        }

        true
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

    // (source rank, dir, matcher); rank follows WalkBuilder's resolution
    // order: 0 = .nxignore (custom), 1 = .ignore, 2 = .gitignore,
    // 3 = parent .gitignore (explicit ignores, consulted last).
    let mut fs_ignores: Vec<(u8, PathBuf, Gitignore)> = Vec::new();

    if let Some(files) = &ignore_files {
        for path in &files.nxignores {
            let (dir, gitignore) = compile(path);
            fs_ignores.push((0, dir, gitignore));
        }
        // WalkBuilder probes the literal lowercase name in each directory,
        // so on a case-insensitive filesystem the walker reads a case-variant
        // root .nxignore (e.g. .NXIGNORE) that the name-based collection
        // misses. Compile the probed root path when the collection did not
        // already cover it.
        if let Some(path) = &nx_ignore_path
            && !files.nxignores.contains(path)
        {
            let (dir, gitignore) = compile(path);
            fs_ignores.push((0, dir, gitignore));
        }
        for path in &files.dot_ignores {
            let (dir, gitignore) = compile(path);
            fs_ignores.push((1, dir, gitignore));
        }
        for path in &files.gitignores {
            let (dir, gitignore) = compile(path);
            fs_ignores.push((2, dir, gitignore));
        }
        // The walker registers parent .gitignore files via `add_ignore`,
        // which compiles them rooted at the process CWD and consults them
        // last, for every entry, farthest directory first. Mirror that
        // (same process, same CWD; the list arrives nearest-first, so
        // reverse it).
        if let Ok(cwd) = std::env::current_dir() {
            for path in files.parent_gitignores.iter().rev() {
                let mut builder = GitignoreBuilder::new(&cwd);
                builder.add(path);
                if let Ok(gitignore) = builder.build() {
                    fs_ignores.push((3, PathBuf::from(origin), gitignore));
                }
            }
        }
    }

    // Build additional globs as one matcher rooted at origin. Line order
    // matters: caller globs come after the always-on patterns, so a caller
    // negation can re-include a path the hardcoded lines ignore.
    let additional_globs = if !additional_globs.is_empty() {
        let mut builder = GitignoreBuilder::new(origin);
        for glob in additional_globs {
            builder.add_line(None, glob)?;
        }
        Some(builder.build()?)
    } else {
        None
    };

    // The root .nxignore for the legacy (use_ignore = false) mode; with
    // use_ignore on it is already part of fs_ignores.
    let nx_ignore = if use_ignore {
        None
    } else if let Some(nxignore_path) = &nx_ignore_path {
        let (_, gitignore) = compile(nxignore_path);
        Some(gitignore)
    } else {
        None
    };

    // Source rank first, then deepest-first within each source.
    fs_ignores.sort_by(|(a_rank, a_dir, _), (b_rank, b_dir, _)| {
        a_rank.cmp(b_rank).then_with(|| {
            let a_depth = a_dir.components().count();
            let b_depth = b_dir.components().count();
            b_depth.cmp(&a_depth)
        })
    });

    Ok(WatchFilterer {
        origin: PathBuf::from(origin),
        use_ignore,
        nx_ignore,
        additional_globs,
        fs_ignores: fs_ignores
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
    fn nxignore_whitelist_reincludes_nested_gitignored_file() {
        // Mirrors the long-standing watcher.spec.ts fixture: an .nxignore
        // negation wins over a nested .gitignore because the walker consults
        // the custom ignore source before .gitignore files, and an
        // unanchored .nxignore pattern matches at any depth.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".gitignore"), ".env.local\n").unwrap();
        fs::write(origin.join(".nxignore"), "!.env.*\nboo.txt\n").unwrap();
        fs::create_dir_all(origin.join("inner")).unwrap();
        fs::write(origin.join("inner/.gitignore"), ".env.inner\n").unwrap();

        let f = filterer(&origin);
        assert!(f.filter_path(&origin.join(".env.local"), false));
        assert!(f.filter_path(&origin.join("inner/.env.inner"), false));
        assert!(!f.filter_path(&origin.join("inner/boo.txt"), false));
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
    fn root_dot_ignore_file_pattern_filters() {
        // The walker reads .ignore files, so a direct-file pattern there
        // excludes the file from the cold walk and the watcher must drop it.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".ignore"), "*.tmp\n").unwrap();

        let f = filterer(&origin);
        assert!(!f.filter_path(&origin.join("scratch.tmp"), false));
        assert!(f.filter_path(&origin.join("src/index.ts"), false));
    }

    #[test]
    fn nested_nxignore_file_pattern_filters() {
        // The walker loads .nxignore in every directory it descends into, so
        // a direct-file pattern in a nested .nxignore excludes files under
        // that directory.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::create_dir_all(origin.join("packages/a")).unwrap();
        fs::write(origin.join("packages/a/.nxignore"), "local.txt\n").unwrap();

        let f = filterer(&origin);
        assert!(!f.filter_path(&origin.join("packages/a/local.txt"), false));
        assert!(f.filter_path(&origin.join("packages/b/local.txt"), false));
    }

    #[test]
    fn nested_dot_ignore_file_pattern_filters() {
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::create_dir_all(origin.join("packages/a")).unwrap();
        fs::write(origin.join("packages/a/.ignore"), "*.snap\n").unwrap();

        let f = filterer(&origin);
        assert!(!f.filter_path(&origin.join("packages/a/tests/a.snap"), false));
        assert!(f.filter_path(&origin.join("packages/b/tests/b.snap"), false));
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
    fn additional_globs_filter_walker_included_files() {
        // Additional globs are a watcher-level filter on top of the walker's
        // visibility: a file the ignore files leave alone (even under a
        // whitelisted directory) is still dropped when a glob matches it.
        // The daemon relies on this to suppress vite/vitest timestamp files.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".gitignore"), "!dist/\n").unwrap();

        let f = create_filter(origin.to_str().unwrap(), &["dist/**".to_string()], true).unwrap();
        assert!(!f.filter_path(&origin.join("dist/file.txt"), false));
    }

    #[test]
    fn additional_globs_apply_even_to_whitelisted_files() {
        // An ignore-file whitelist means the walker includes the file; it
        // does not bypass the additional globs, just as the walker's own
        // hardcoded patterns apply unconditionally in filter_entry.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".gitignore"), "!keep.txt\n").unwrap();

        let f = create_filter(origin.to_str().unwrap(), &["*.txt".to_string()], true).unwrap();
        assert!(!f.filter_path(&origin.join("keep.txt"), false));
        assert!(f.filter_path(&origin.join("keep.md"), false));
    }

    #[test]
    fn broad_dot_ignore_whitelist_cannot_admit_suppressed_files() {
        // A blanket whitelist in an .ignore file must not defeat the
        // watcher's always-on suppression (vite/vitest timestamp files,
        // hardcoded directories).
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".ignore"), "!*\n").unwrap();

        let f = create_filter(
            origin.to_str().unwrap(),
            &[
                "**/node_modules".to_string(),
                "vite.config.ts.timestamp*.mjs".to_string(),
            ],
            true,
        )
        .unwrap();
        assert!(!f.filter_path(&origin.join("vite.config.ts.timestamp-123.mjs"), false));
        assert!(!f.filter_path(&origin.join("node_modules/keep.js"), false));
        assert!(f.filter_path(&origin.join("src/index.ts"), false));
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
    fn case_variant_root_nxignore_applies_on_case_insensitive_fs() {
        // WalkBuilder probes the literal lowercase name in each directory,
        // so on a case-insensitive filesystem the walker reads a root
        // .NXIGNORE and the watcher must apply it too.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".NXIGNORE"), "*.log\n").unwrap();
        if !origin.join(".nxignore").exists() {
            // Case-sensitive filesystem: the walker does not read .NXIGNORE.
            return;
        }

        let f = filterer(&origin);
        assert!(!f.filter_path(&origin.join("debug.log"), false));
        assert!(f.filter_path(&origin.join("src/index.ts"), false));
    }

    #[test]
    fn dot_ignore_cannot_suppress_gitignore_events() {
        // The walker reads a .gitignore even when an .ignore pattern matches
        // its path, and the daemon restarts on .gitignore events to rebuild
        // this filter: dropping the event would leave the daemon holding
        // stale rules.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".ignore"), ".gitignore\n").unwrap();
        fs::create_dir_all(origin.join("packages/a")).unwrap();
        fs::write(origin.join("packages/a/.gitignore"), "generated/\n").unwrap();

        let f = filterer(&origin);
        assert!(f.filter_path(&origin.join(".gitignore"), false));
        assert!(f.filter_path(&origin.join("packages/a/.gitignore"), false));
    }

    #[test]
    fn nested_nxignore_cannot_suppress_gitignore_events() {
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::create_dir_all(origin.join("packages/a")).unwrap();
        fs::write(origin.join("packages/a/.nxignore"), ".gitignore\n").unwrap();
        fs::write(origin.join("packages/a/.gitignore"), "generated/\n").unwrap();

        let f = filterer(&origin);
        assert!(f.filter_path(&origin.join("packages/a/.gitignore"), false));
    }

    #[test]
    fn self_ignored_control_file_events_still_delivered() {
        // A .gitignore listing .ignore suppresses the .ignore file itself,
        // but the walker still reads its patterns, so edits to it must reach
        // the daemon's restart trigger.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".gitignore"), ".ignore\n").unwrap();
        fs::write(origin.join(".ignore"), "*.log\n").unwrap();

        let f = filterer(&origin);
        assert!(f.filter_path(&origin.join(".ignore"), false));
    }

    #[test]
    fn control_directory_named_like_ignore_file_stays_suppressed() {
        // A directory named .gitignore is not an ignore file: the walker
        // prunes it like any other directory, and admitting it would let the
        // watcher backfill children the cold walk never returns.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".ignore"), ".gitignore/\n").unwrap();

        let f = filterer(&origin);
        assert!(!f.filter_path(&origin.join(".gitignore"), true));
    }

    #[test]
    fn control_file_under_pruned_dir_stays_suppressed() {
        // The walker never reads ignore files inside a pruned directory, so
        // their edits cannot change the walk and need no restart.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".gitignore"), "dist/\n").unwrap();

        let f = filterer(&origin);
        assert!(!f.filter_path(&origin.join("dist/.gitignore"), false));
    }

    #[test]
    fn control_file_events_still_respect_additional_globs() {
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();

        let f = create_filter(
            origin.to_str().unwrap(),
            &["**/node_modules".to_string()],
            true,
        )
        .unwrap();
        assert!(!f.filter_path(&origin.join("node_modules/.gitignore"), false));
    }

    #[test]
    fn suppressed_dot_ignore_still_contributes_patterns() {
        // An .ignore file matched by a .gitignore rule is excluded from the
        // walk results, but the walker still applies its patterns, so the
        // watcher must too.
        let dir = tempdir().unwrap();
        let origin = dir.path().canonicalize().unwrap();
        fs::write(origin.join(".gitignore"), ".ignore\n").unwrap();
        fs::write(origin.join(".ignore"), "*.log\n").unwrap();

        let f = filterer(&origin);
        assert!(!f.filter_path(&origin.join("debug.log"), false));
        assert!(f.filter_path(&origin.join("src/index.ts"), false));
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
