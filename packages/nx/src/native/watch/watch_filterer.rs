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
    nx_ignore: Option<Gitignore>,
    /// Per-directory ignore matchers, consulted first-match-wins. Each entry is
    /// (directory the matcher applies in, class rank, compiled matcher), sorted
    /// deepest-first then by rank so within a directory a more specific source
    /// wins: nested .nxignore > .ignore > .gitignore > .git-exclude/global. Full
    /// class-above-depth parity with the ignore crate is a tracked follow-up.
    git_ignores: Vec<(PathBuf, u8, Gitignore)>,
    /// node_modules/.git/.nx/cache/.yarn/cache. A hard veto that no .gitignore
    /// or .nxignore negation can beat, mirroring `create_walker`'s filter_entry
    /// so the watcher and the walk agree on what is ignored.
    hardcoded: Gitignore,
}

impl WatchFilterer {
    fn filter_path(&self, path: &std::path::Path, is_dir: bool) -> bool {
        let path = dunce::simplified(path);

        // The brought-in ignore files decide keep/drop, then the hardcoded
        // patterns veto unconditionally — applied last so a .gitignore
        // whitelist (e.g. a zero-install `!.yarn/cache`) cannot un-ignore
        // them. `create_walker` enforces the same set as an unbeatable
        // filter_entry; if the two disagreed, files the walker excludes but
        // the watcher admits would be reported deleted on every rescan.
        //
        // The origin guard matches the .nxignore/gitignore sites: the matcher
        // is rooted at origin and matched_path_or_any_parents panics on a path
        // outside its root, which a symlink resolved out of the workspace can
        // produce on Linux.
        self.brought_in_allows(path, is_dir)
            && !(path.starts_with(&self.origin)
                && matches!(
                    self.hardcoded.matched_path_or_any_parents(path, is_dir),
                    Match::Ignore(_)
                ))
    }

    fn brought_in_allows(&self, path: &std::path::Path, is_dir: bool) -> bool {
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
            .filter(|(dir, _, _)| path.starts_with(dir))
            .map(|(_, _, ig)| ig.matched_path_or_any_parents(path, is_dir))
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
    let ignore_files = use_ignore.then(|| get_gitignore_files(origin));
    let nx_ignore_path = get_nx_ignore(origin);

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

    // `.ignore` and nested `.nxignore` — create_walker honours both, so a
    // directory they exclude must not reach the watcher (it would be inserted
    // into the file map and then reported deleted on the next rescan, since the
    // rescan walk drops it). The root `.nxignore` keeps its dedicated
    // highest-precedence slot below, so it is skipped here.
    if use_ignore {
        let root_nxignore = PathBuf::from(origin).join(".nxignore");
        for path in collect_workspace_ignore_files(origin, &[".ignore", ".nxignore"]) {
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
            let rank = if path.file_name().and_then(|n| n.to_str()) == Some(".nxignore") {
                3
            } else {
                2
            };
            git_ignores.push((dir, rank, gitignore));
        }

        // `.git/info/exclude` and the global core.excludesFile: the canonical
        // homes for local, uncommittable exclusions (scratch, secrets). Both
        // are gitignore-format and apply workspace-wide, so they are rooted at
        // origin (not at their own parent dir, which would break the prefix
        // strip in matched_path_or_any_parents) and sit at the shallowest
        // depth, below any per-directory rule.
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

    // Build additional globs as a synthetic gitignore rooted at origin
    if !additional_globs.is_empty() {
        let mut builder = GitignoreBuilder::new(origin);
        for glob in additional_globs {
            builder.add_line(None, glob)?;
        }
        let gitignore = builder.build()?;
        git_ignores.push((PathBuf::from(origin), 0, gitignore));
    }

    // Sort deepest-first (most path components first) so deeper gitignores take priority
    git_ignores.sort_by(|(a, ra, _), (b, rb, _)| {
        let a_depth = a.components().count();
        let b_depth = b.components().count();
        b_depth.cmp(&a_depth).then(rb.cmp(ra))
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
        nx_ignore,
        hardcoded,
    })
}
