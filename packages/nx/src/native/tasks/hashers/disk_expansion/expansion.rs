//! Turning parsed entries into the files they name: what an expansion may
//! lean on instead of the disk, the loop that resolves each entry, and the
//! disk step it falls back to. The traversal itself is `create_walker`'s;
//! what is here is the per-entry decision and the stamp it reads.

use std::path::Path;
use std::sync::{Arc, OnceLock};

use anyhow::{Context, Result, bail};
use dashmap::DashMap;
use ignore::WalkState;
use parking_lot::Mutex;

use super::entries::{Negation, Positive};
use crate::native::glob::{
    NxGlobSet, build_glob_set, expand_literal_braces, literal_prefix, normalize_glob,
};
use crate::native::walker::{TRANSIENT_FILE_GLOBS, create_walker_vetoing};

/// Expansion per `files:{project}:[...]` instruction, scoped to one `hash_plans`
/// call: a group is listed or walked afresh for the next one.
pub(crate) type FilesExpansionCache = DashMap<String, Arc<FilesExpansion>>;

/// How far an entry may reach out of the workspace.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum Reach {
    /// A fileset: a path that resolves outside the workspace is an error, and
    /// a linked file is read only when its target is inside.
    InsideWorkspace,
    /// A declared output: read wherever it points.
    WhereverItPoints,
}

/// Where the files under a directory come from when not from a walk. Asked
/// with a workspace-relative directory (empty for the root); `Some` is its
/// files, sorted and workspace-relative, from an index the caller keeps
/// current; `None` walks the disk.
pub(crate) type Members<'a> = &'a (dyn Fn(&str) -> Option<Vec<String>> + Sync);

/// For a caller with no index: every directory is walked.
pub(crate) const NO_INDEX: Members<'static> = &|_| None;

/// For a caller with no workspace context: every path is checked on disk.
pub(crate) const NOTHING_KNOWN: &(dyn Fn(&str) -> bool + Sync) = &|_| false;

/// What an expansion may lean on instead of the disk, and how far it may
/// reach. The two callers differ only here.
pub(crate) struct Source<'a> {
    /// Whether the workspace context already tracks a path. A path it
    /// vouches for needs no stat.
    known: &'a (dyn Fn(&str) -> bool + Sync),
    /// An index that can list a directory in place of a walk.
    members: Members<'a>,
    reach: Reach,
}

impl<'a> Source<'a> {
    /// An `includeIgnored` fileset. It is hashed alongside tracked files, so
    /// the context can vouch for a path, and it may not read outside the
    /// workspace.
    pub(crate) fn fileset(known: &'a (dyn Fn(&str) -> bool + Sync), members: Members<'a>) -> Self {
        Self {
            known,
            members,
            reach: Reach::InsideWorkspace,
        }
    }

    /// A dependency's declared outputs. They were written by a task that has
    /// run, so the file map predates them and nothing is taken as known, and
    /// they are read wherever they point.
    pub(crate) fn declared_outputs() -> Self {
        Self {
            known: NOTHING_KNOWN,
            members: NO_INDEX,
            reach: Reach::WhereverItPoints,
        }
    }
}

/// A matched file and the stamp read for it. `None` when nothing stat'ed it:
/// the workspace context vouched for the path, or an index listed it.
pub(crate) struct Found {
    pub path: String,
    pub stamp: Option<FileStamp>,
}

pub struct FilesExpansion {
    /// Existing files matched by the group, sorted, workspace-relative.
    pub files: Vec<String>,
    /// Aligned with `files`: the stamp read while expanding, so hashing does
    /// not stat again, or `None` when the workspace context vouched for the
    /// file, or an index listed it, and the disk was never consulted.
    pub stamps: Vec<Option<FileStamp>>,
}

/// Expands an `includeIgnored` fileset group. `known` says whether the
/// workspace context tracks a path: an exact path it knows is a member
/// without touching the disk, and a walked file it knows needs no stamp.
/// Every positive glob is resolved from its literal prefix, then the
/// negations filter the result. Walks skip the same directories the workspace
/// walker never enters, but an exact path or a prefix inside one of them is
/// read as-is. Nothing outside the workspace is read, symlinks included.
pub fn expand_files_with(
    workspace_root: &Path,
    globs: &[String],
    known: &(dyn Fn(&str) -> bool + Sync),
) -> Result<FilesExpansion> {
    let (positives, negations) = parse_group(globs)?;
    expand_entries(
        workspace_root,
        &positives,
        &negations,
        &Source::fileset(known, NO_INDEX),
    )
}

/// A group's entries split at their literal prefixes, positives then negations.
pub(super) fn parse_group(globs: &[String]) -> Result<(Vec<Positive>, Vec<Negation>)> {
    let negations: Vec<Negation> = globs
        .iter()
        .filter(|g| g.starts_with('!'))
        .flat_map(|g| expand_literal_braces(g))
        .map(|g| Negation::parse(&g))
        .collect::<Result<_>>()?;
    let positives: Vec<Positive> = globs
        .iter()
        .filter(|g| !g.starts_with('!'))
        .flat_map(|g| expand_literal_braces(&normalize_glob(g)))
        .map(|g| Positive::parse(&g))
        .collect::<Result<_>>()?;
    Ok((positives, negations))
}

/// `expand_files_with` for entries the caller has already split. `source`
/// says which of the two callers this is: a fileset, which may lean on the
/// workspace context and an index and may not read outside the workspace, or
/// declared outputs, which are read wherever they point. A directory the
/// source can list is taken from the list; any other is walked.
pub(crate) fn expand_entries(
    workspace_root: &Path,
    positives: &[Positive],
    negations: &[Negation],
    source: &Source,
) -> Result<FilesExpansion> {
    let Source {
        known,
        members,
        reach,
    } = source;
    let canonical_root = if *reach == Reach::InsideWorkspace {
        Some(dunce::canonicalize(workspace_root).with_context(|| {
            format!(
                "Cannot resolve the workspace root {}",
                workspace_root.display()
            )
        })?)
    } else {
        None
    };

    let mut found: Vec<Found> = Vec::new();
    for entry in positives {
        let root = &entry.root;
        let remainder = entry.remainder.as_deref();
        let has_pattern = remainder.is_some();
        if !has_pattern && known(root) {
            found.push(Found {
                path: root.clone(),
                stamp: None,
            });
            continue;
        }
        let start = workspace_root.join(root);
        let Ok(metadata) = std::fs::metadata(&start) else {
            continue;
        };
        if let Some(canonical_root) = &canonical_root {
            // After symlink resolution, not just lexically.
            let resolved = dunce::canonicalize(&start).with_context(|| {
                format!(
                    "Cannot resolve the includeIgnored fileset \"{}\"",
                    entry.text
                )
            })?;
            if !resolved.starts_with(canonical_root) {
                bail!(
                    "The includeIgnored fileset \"{}\" resolves outside the workspace.",
                    entry.text
                );
            }
        }
        if metadata.is_file() {
            if !has_pattern {
                found.push(Found {
                    path: root.clone(),
                    stamp: Some(stamp_of(&metadata)),
                });
            }
            continue;
        }
        // A fileset names files, so a glob that lands on a directory selects
        // nothing; `{projectRoot}/generated/**/*` is how to ask for what is
        // under it. A declared output names a path, and a directory output
        // has always meant everything under it.
        if !has_pattern && !entry.declared_path {
            continue;
        }
        // With a pattern, only the remainder after the prefix is matched.
        // Excluded files are dropped before they are stat'ed.
        let excluded = |path: &str| negations.iter().any(|n| n.excludes(path));
        let accept: Box<dyn Fn(&str) -> bool + Sync> = if let Some(pattern) = remainder {
            // An empty root is the workspace root: the whole path is matched.
            let prefix_len = if root.is_empty() { 0 } else { root.len() + 1 };
            let set = build_glob_set(&[pattern])?;
            Box::new(move |path: &str| {
                path.len() > prefix_len && set.is_match(&path[prefix_len..]) && !excluded(path)
            })
        } else {
            Box::new(move |path: &str| !excluded(path))
        };
        if let Some(listed) = members(root) {
            // Listed files carry no stamp: the index that listed them is
            // asked for their content, or they are stat'ed when hashed.
            found.extend(
                listed
                    .into_iter()
                    .filter(|path| accept(path))
                    .map(|path| Found { path, stamp: None }),
            );
            continue;
        }
        found.extend(walk_files(
            &start,
            workspace_root,
            canonical_root.as_deref(),
            &*accept,
            known,
        )?);
    }

    // `accept` already filtered what the walk produced; this catches the
    // entries taken without it, an exact file and anything an index listed.
    found.retain(|found| !negations.iter().any(|n| n.excludes(&found.path)));
    found.sort_unstable_by(|a, b| a.path.cmp(&b.path));
    found.dedup_by(|a, b| a.path == b.path);
    let (files, stamps) = found
        .into_iter()
        .map(|found| (found.path, found.stamp))
        .unzip();
    Ok(FilesExpansion { files, stamps })
}

/// `expand_files_with` without a workspace context: every path is checked on
/// disk.
pub fn expand_files(workspace_root: &Path, globs: &[String]) -> Result<FilesExpansion> {
    expand_files_with(workspace_root, globs, NOTHING_KNOWN)
}

pub(crate) fn expand_files_cached(
    workspace_root: &Path,
    key: &str,
    globs: &[String],
    cache: &FilesExpansionCache,
    known: &(dyn Fn(&str) -> bool + Sync),
    members: Members,
) -> Result<Arc<FilesExpansion>> {
    expand_cached(key, cache, || {
        let (positives, negations) = parse_group(globs)?;
        expand_entries(
            workspace_root,
            &positives,
            &negations,
            &Source::fileset(known, members),
        )
    })
}

pub(crate) fn expand_cached(
    key: &str,
    cache: &FilesExpansionCache,
    expand: impl FnOnce() -> Result<FilesExpansion>,
) -> Result<Arc<FilesExpansion>> {
    if let Some(cached) = cache.get(key) {
        return Ok(Arc::clone(&cached));
    }
    let expansion = Arc::new(expand()?);
    cache.insert(key.to_string(), Arc::clone(&expansion));
    Ok(expansion)
}

/// Rejects a glob that would read outside the workspace or exclude nothing.
/// A glob with no leading directory (`**/*`, `*.gen`) is allowed: it walks
/// from the workspace root, which is slow but not wrong.
pub(crate) fn validate_files_glob(glob: &str) -> Result<()> {
    if let Some(body) = glob.strip_prefix('!') {
        let body = normalize_glob(body);
        if body.is_empty() {
            bail!("The includeIgnored fileset \"{glob}\" names nothing to exclude.");
        }
        for expanded in expand_literal_braces(&body) {
            literal_prefix(&expanded)?;
        }
        return Ok(());
    }
    for expanded in expand_literal_braces(&normalize_glob(glob)) {
        literal_prefix(&expanded)?;
    }
    Ok(())
}

/// `validate_files_glob` for every entry of a project's group, plus the one
/// rule that needs the whole group: it must not only exclude.
pub(crate) fn validate_files_globs(project: &str, globs: &[String]) -> Result<()> {
    if !globs.is_empty() && globs.iter().all(|glob| glob.starts_with('!')) {
        bail!(
            "The includeIgnored fileset \"{}\" applied to \"{project}\" is a negation with no positive includeIgnored fileset to filter. A negation only filters the positive includeIgnored filesets of the same project; a fileset with `dependencies: true` is hashed on its own for each dependency, so a negation there has nothing to filter.",
            globs[0]
        );
    }
    globs.iter().try_for_each(|glob| validate_files_glob(glob))
}

/// The `(mtime, size)` a file showed when expansion looked at it.
pub type FileStamp = (u128, u64);

pub(crate) fn stamp_of(metadata: &std::fs::Metadata) -> FileStamp {
    let mtime = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    (mtime, metadata.len())
}

/// The transient files the watch never reports. The hardcoded directories
/// come from `create_walker`, which vetoes them for every walk.
fn transient_skips() -> Result<Arc<NxGlobSet>> {
    static SKIPS: OnceLock<Option<Arc<NxGlobSet>>> = OnceLock::new();
    SKIPS
        .get_or_init(|| {
            let patterns: Vec<String> = TRANSIENT_FILE_GLOBS
                .iter()
                .map(|g| format!("**/{g}"))
                .collect();
            build_glob_set(&patterns).ok()
        })
        .clone()
        .context("the transient-file globs always build")
}

/// Files under `start`, workspace-relative, with the stamp read on the way
/// for anything the context does not vouch for. The walker skips what it
/// skips for every walk, but never the root it is given, so a glob rooted at
/// `node_modules` reads it. Linked directories are not entered; with
/// `canonical_root`, a linked file counts only when its target is inside it.
fn walk_files(
    start: &Path,
    workspace_root: &Path,
    canonical_root: Option<&Path>,
    accept: &(dyn Fn(&str) -> bool + Sync),
    known: &(dyn Fn(&str) -> bool + Sync),
) -> Result<Vec<Found>> {
    let relative_of = |path: &Path| -> Option<String> {
        Some(
            path.strip_prefix(workspace_root)
                .ok()?
                .to_string_lossy()
                .replace('\\', "/"),
        )
    };
    let visit = |path: &Path, file_type: std::fs::FileType| -> Option<Found> {
        let relative = relative_of(path)?;
        if file_type.is_symlink() {
            // Read where a linked file points, but never enter a linked
            // directory, and with a root to hold to, never leave it.
            let target = std::fs::metadata(path).ok()?;
            if target.is_dir() || !accept(&relative) {
                return None;
            }
            if let Some(root) = canonical_root
                && !dunce::canonicalize(path).is_ok_and(|t| t.starts_with(root))
            {
                return None;
            }
            let stamp = (!known(&relative)).then(|| stamp_of(&target));
            return Some(Found {
                path: relative,
                stamp,
            });
        }
        if !file_type.is_file() || !accept(&relative) {
            return None;
        }
        if known(&relative) {
            return Some(Found {
                path: relative,
                stamp: None,
            });
        }
        let metadata = std::fs::metadata(path).ok()?;
        Some(Found {
            path: relative,
            stamp: Some(stamp_of(&metadata)),
        })
    };

    let found = Mutex::new(Vec::new());
    create_walker_vetoing(start, false, Some(transient_skips()?))
        .follow_links(false)
        .build_parallel()
        .run(|| {
            Box::new(|entry| {
                if let Ok(entry) = entry
                    && let Some(file_type) = entry.file_type()
                    && let Some(one) = visit(entry.path(), file_type)
                {
                    found.lock().push(one);
                }
                WalkState::Continue
            })
        });
    Ok(found.into_inner())
}

/// Every file under `dir` with its stamp, for an index seeding a prefix: the
/// walk an expansion runs, confined to the workspace. Empty when `dir` does
/// not exist yet; `None` when it resolves outside the workspace.
pub(crate) fn seed_walk(workspace_root: &Path, dir: &str) -> Option<Vec<(String, FileStamp)>> {
    let start = workspace_root.join(dir);
    if std::fs::symlink_metadata(&start).is_err() {
        return Some(Vec::new());
    }
    let canonical_root = dunce::canonicalize(workspace_root).ok()?;
    let resolved = dunce::canonicalize(&start).ok()?;
    if !resolved.starts_with(&canonical_root) {
        return None;
    }
    if !resolved.is_dir() {
        return Some(Vec::new());
    }
    let walked = walk_files(
        &start,
        workspace_root,
        Some(&canonical_root),
        &|_| true,
        &|_| false,
    )
    .ok()?;
    Some(
        walked
            .into_iter()
            .map(|found| (found.path, found.stamp.unwrap_or_default()))
            .collect(),
    )
}
