use ignore::Match;
use ignore::gitignore::{Gitignore, GitignoreBuilder, gitconfig_excludes_path};
use notify::EventKind;
use notify::event::{CreateKind, ModifyKind, RemoveKind};
use std::path::PathBuf;
use tracing::trace;

use crate::native::walker::HARDCODED_IGNORE_PATTERNS;
use crate::native::watch::git_utils::{collect_workspace_ignore_files, get_gitignore_files};
use crate::native::watch::types::RawWatchEvent;
use crate::native::watch::utils::get_nx_ignore;

#[derive(Debug)]
pub struct WatchFilterer {
    origin: PathBuf,
    /// Per-directory ignore matchers, consulted first-match-wins. Each entry is
    /// (directory the matcher applies in, class rank, compiled matcher), sorted
    /// by rank then depth so the higher class wins at any depth and the deepest
    /// file wins within a class: .nxignore > .gitignore > .git-exclude/global.
    /// That is how the ignore crate resolves a path, so the watcher and
    /// `create_walker` agree. The root `.nxignore` is an ordinary entry at the
    /// .nxignore rank, so a nested one beats it.
    git_ignores: Vec<(PathBuf, u8, Gitignore)>,
    /// node_modules/.git/.nx/cache/.nx/workspace-data/.yarn/cache. A hard veto
    /// that no user .gitignore or .nxignore negation can beat, mirroring
    /// `create_walker`'s filter_entry so the watcher and the walk agree.
    hardcoded: Gitignore,
    /// nx's own watch-scoping globs (create_filter's `additional_globs`, e.g. the
    /// outputs watcher's `!.nx/workspace-data/.../server-process.json`). An
    /// internal opt-in, so it outranks even the hardcoded veto — the veto only
    /// stops USER ignore files un-ignoring hardcoded paths, not nx's own scoping.
    additional_globs: Option<Gitignore>,
}

impl WatchFilterer {
    fn filter_path(&self, path: &std::path::Path, is_dir: bool) -> bool {
        let path = dunce::simplified(path);

        // A path outside the workspace is not subject to its ignore rules, and
        // the origin-rooted matchers panic on one (matched_path_or_any_parents
        // asserts the path is under the root). canonicalize_event_paths can
        // produce one on Linux by resolving a watched symlink out of the tree.
        // Reject it rather than admit it — admitting emits an out-of-workspace
        // path into the file map and nx watch, and still panics the transform's
        // Create branch when a root .nxignore is present.
        if !path.starts_with(&self.origin) {
            return false;
        }

        // nx's own watch globs are an internal opt-in and take precedence over
        // everything, the hardcoded veto included: the outputs watcher's
        // `!.nx/workspace-data/.../server-process.json` must punch through the
        // .nx/workspace-data veto, or the outputs watcher loses its prompt
        // shutdown signal (server.ts's 20ms poll still terminates the daemon).
        // The veto is only there to stop USER ignore files un-ignoring
        // hardcoded paths.
        if let Some(globs) = &self.additional_globs {
            match globs.matched_path_or_any_parents(path, is_dir) {
                Match::Whitelist(_) => return true,
                Match::Ignore(_) => return false,
                Match::None => {}
            }
        }

        // The brought-in USER ignore files decide keep/drop, then the hardcoded
        // patterns veto unconditionally — applied last so a .gitignore whitelist
        // (a zero-install `!.yarn/cache`) cannot un-ignore them, matching
        // create_walker's filter_entry.
        self.brought_in_allows(path, is_dir)
            && !matches!(
                self.hardcoded.matched_path_or_any_parents(path, is_dir),
                Match::Ignore(_)
            )
    }

    fn brought_in_allows(&self, path: &std::path::Path, is_dir: bool) -> bool {
        // Ranked highest class first, deepest file first within a class; the
        // first non-None match wins. Each matcher is only consulted for paths
        // under its own directory — gitignore-style matchers are scoped to
        // where the ignore file lives.
        let git_match = self
            .git_ignores
            .iter()
            .filter(|(dir, _, _)| path.starts_with(dir))
            .map(|(_, _, ig)| ig.matched_path_or_any_parents(path, is_dir))
            .find(|m| !matches!(m, Match::None));

        match git_match {
            Some(Match::Ignore(_)) => {
                trace!(?path, "ignore file match - blocked");
                false
            }
            Some(Match::Whitelist(_)) => {
                trace!(?path, "ignore file whitelist match - allowed");
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

        // Check each path against ignore rules. is_dir_at answers from the
        // event kind when it can, so a filtered event with a precise kind is
        // rejected without ever statting it.
        for (index, path) in event.event.paths.iter().enumerate() {
            // Reject paths ending with ~ (editor backup files)
            if path.display().to_string().ends_with('~') {
                trace!(?path, "path ends with ~ - rejected");
                return false;
            }

            if !self.filter_path(path, event.is_dir_at(index)) {
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
    // `origin` is expected canonical and in dunce form (no Windows `\\?\`
    // verbatim prefix): WatchPipeline::new canonicalizes it with
    // dunce::canonicalize and hands the same string here and to origin_path.
    // filter_path rejects any path not under origin and dunce::simplifies event
    // paths, so a `\\?\` origin would reject every event. The disallowed_methods
    // clippy lint keeps lib code on dunce, but `lint-native` runs clippy without
    // --all-targets, so cfg(test) is unlinted — tests must hold this by hand.
    let ignore_files = use_ignore.then(|| get_gitignore_files(origin));

    trace!(
        ?use_ignore,
        ?additional_globs,
        ?ignore_files,
        "Using these ignore files for the watcher"
    );

    let mut git_ignores: Vec<(PathBuf, u8, Gitignore)> = Vec::new();

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
            git_ignores.push((dir, 1, gitignore));
        }
    }

    // Nested `.nxignore` — create_walker honours it, so a directory it excludes
    // must not reach the watcher (it would be inserted into the file map and
    // then reported deleted on the next rescan, since the rescan walk drops it).
    // The root `.nxignore` is added below, outside the `use_ignore` gate, so it
    // is skipped here rather than added twice.
    if use_ignore {
        let root_nxignore = PathBuf::from(origin).join(".nxignore");
        for path in collect_workspace_ignore_files(origin, &[".nxignore"]) {
            if path == root_nxignore {
                continue;
            }
            let (gitignore, err) = Gitignore::new(&path);
            if let Some(err) = err {
                trace!(
                    ?err,
                    ?path,
                    "error parsing ignore file, using partial result"
                );
            }
            let dir = path.parent().unwrap_or(&path).to_path_buf();
            git_ignores.push((dir, 2, gitignore));
        }

        // `.git/info/exclude` and the global core.excludesFile: the canonical
        // homes for local, uncommittable exclusions (scratch, secrets). Both
        // are gitignore-format and apply workspace-wide, so they are rooted at
        // origin (not at their own parent dir, which would break the prefix
        // strip in matched_path_or_any_parents) and take the lowest rank, below
        // any per-directory rule.
        let mut workspace_wide = GitignoreBuilder::new(origin);
        let git_exclude = PathBuf::from(origin)
            .join(".git")
            .join("info")
            .join("exclude");
        if git_exclude.is_file()
            && let Some(err) = workspace_wide.add(&git_exclude)
        {
            trace!(?err, ?git_exclude, "error parsing .git/info/exclude");
        }
        if let Some(global_excludes) = gitconfig_excludes_path()
            && global_excludes.is_file()
            && let Some(err) = workspace_wide.add(&global_excludes)
        {
            trace!(?err, ?global_excludes, "error parsing global gitignore");
        }
        git_ignores.push((PathBuf::from(origin), 0, workspace_wide.build()?));
    }

    // nx's own watch-scoping globs, kept OUT of git_ignores and the hardcoded
    // veto: they are an internal opt-in that must win. The outputs watcher passes
    // `!.nx/workspace-data/.../server-process.json` to punch through the
    // .nx/workspace-data hardcoded ignore so it keeps its prompt shutdown signal.
    let additional_globs = if additional_globs.is_empty() {
        None
    } else {
        let mut builder = GitignoreBuilder::new(origin);
        for glob in additional_globs {
            builder.add_line(None, glob)?;
        }
        Some(builder.build()?)
    };

    // The root `.nxignore` applies whether or not `use_ignore` is set — it is
    // nx's own opt-out, not a git source. It joins git_ignores at the .nxignore
    // rank rather than above everything, so a nested .nxignore beats it the way
    // it does in the walk.
    if let Some(nxignore_path) = get_nx_ignore(origin) {
        let (gitignore, err) = Gitignore::new(&nxignore_path);
        if let Some(err) = err {
            trace!(
                ?err,
                ?nxignore_path,
                "error parsing nxignore, using partial result"
            );
        }
        git_ignores.push((PathBuf::from(origin), 2, gitignore));
    }

    // Rank before depth, matching how the ignore crate combines classes: it
    // keeps the deepest match per class and then prefers the higher class, so a
    // nested .nxignore beats a .gitignore at ANY depth. Sorting depth first
    // would let a deeper .gitignore negation un-ignore it.
    git_ignores.sort_by(|(a, ra, _), (b, rb, _)| {
        let a_depth = a.components().count();
        let b_depth = b.components().count();
        rb.cmp(ra).then(b_depth.cmp(&a_depth))
    });

    // The hardcoded ignores are enforced unconditionally, independent of
    // `use_ignore` and of the brought-in files, exactly as `create_walker`
    // applies them.
    let mut hardcoded_builder = GitignoreBuilder::new(origin);
    for pattern in HARDCODED_IGNORE_PATTERNS {
        hardcoded_builder.add_line(None, pattern)?;
    }
    let hardcoded = hardcoded_builder.build()?;

    Ok(WatchFilterer {
        origin: PathBuf::from(origin),
        git_ignores,
        hardcoded,
        additional_globs,
    })
}
