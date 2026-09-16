//! Turning parsed entries into the files they name: what an expansion may
//! lean on instead of the disk, the loop that resolves each entry, and the
//! disk step it falls back to. The traversal itself is `create_walker`'s;
//! what is here is the per-entry decision and the stamp it reads.

use std::path::Path;
use std::sync::Arc;

use anyhow::{Result, bail};
use dashmap::DashMap;

use super::entries::{Negation, Positive};
use crate::native::glob::{build_glob_set, expand_literal_braces, normalize_glob};
use crate::native::walker::{PathPredicate, files_under};

/// Expansion per `files:{project}:[...]` instruction, scoped to one `hash_plans`
/// call: a group is listed or walked afresh for the next one.
pub(crate) type FilesExpansionCache = DashMap<String, Arc<FilesExpansion>>;

/// Something that can say what a directory holds. The ignored index answers
/// from a listing it keeps or from the disk; the walker always reads the
/// disk. The expansion never reads a directory itself, it asks one of these.
pub(crate) trait DirectoryFiles: Sync {
    /// The files under `dir` that `accept` admits, workspace-relative.
    /// `None` when the directory cannot be read at all. `accept` is passed
    /// so the answer can be filtered while it is gathered, not afterwards.
    fn files_under(&self, dir: &str, accept: PathPredicate) -> Option<Vec<String>>;
}

impl DirectoryFiles for &dyn DirectoryFiles {
    fn files_under(&self, dir: &str, accept: PathPredicate) -> Option<Vec<String>> {
        (**self).files_under(dir, accept)
    }
}

/// Reads the disk every time, for a caller with no index behind it.
pub(crate) struct DiskFiles<'a> {
    pub workspace_root: &'a Path,
}

impl DirectoryFiles for DiskFiles<'_> {
    fn files_under(&self, dir: &str, accept: PathPredicate) -> Option<Vec<String>> {
        files_under(self.workspace_root, dir, accept)
    }
}

/// So a caller can pass a closure where a named type would be ceremony.
impl<F> DirectoryFiles for F
where
    F: Fn(&str, PathPredicate) -> Option<Vec<String>> + Sync,
{
    fn files_under(&self, dir: &str, accept: PathPredicate) -> Option<Vec<String>> {
        self(dir, accept)
    }
}

/// For a caller with no workspace context: every path is checked on disk.
pub(crate) const NOTHING_KNOWN: PathPredicate<'static> = &|_| false;

/// What an expansion may lean on instead of the disk. The two callers differ
/// only here. Either way a path is read wherever it points: a `dist` linked
/// into a build cache holds the files a task wrote.
pub(crate) struct Source<'a> {
    /// Whether the workspace context already tracks a path. A path it
    /// vouches for needs no stat.
    known: PathPredicate<'a>,
    /// What a directory holds, see `DirectoryFiles`.
    files_under: Box<dyn DirectoryFiles + 'a>,
}

impl<'a> Source<'a> {
    /// An `includeIgnored` fileset. It is hashed alongside tracked files, so
    /// the context can vouch for a path.
    pub(crate) fn fileset(known: PathPredicate<'a>, files_under: &'a dyn DirectoryFiles) -> Self {
        Self {
            known,
            files_under: Box::new(files_under),
        }
    }

    /// A fileset read straight from disk, with no index to ask.
    pub(crate) fn fileset_reading_disk(known: PathPredicate<'a>, workspace_root: &'a Path) -> Self {
        Self {
            known,
            files_under: Box::new(DiskFiles { workspace_root }),
        }
    }

    /// The same, for a caller with no workspace context either.
    pub(crate) fn fileset_from_disk(workspace_root: &'a Path) -> Self {
        Self::fileset_reading_disk(NOTHING_KNOWN, workspace_root)
    }

    /// A dependency's declared outputs. They were written by a task that has
    /// run, so the file map predates them and nothing is taken as known.
    pub(crate) fn declared_outputs(workspace_root: &'a Path) -> Self {
        Self {
            known: NOTHING_KNOWN,
            files_under: Box::new(DiskFiles { workspace_root }),
        }
    }
}

pub struct FilesExpansion {
    /// Existing files matched by the group, sorted, workspace-relative.
    pub files: Vec<String>,
}

/// Expands a group of globs into the files it names. `source` says what the
/// expansion may lean on instead of the disk, see `expand_entries`. Every
/// positive glob is resolved from its literal prefix, then the negations
/// filter the result.
pub(crate) fn expand_globs(
    workspace_root: &Path,
    globs: &[String],
    source: &Source,
) -> Result<FilesExpansion> {
    let (positives, negations) = parse_group(globs)?;
    expand_entries(workspace_root, &positives, &negations, source)
}

/// A group's entries split at their literal prefixes, positives then negations.
pub(super) fn parse_group(globs: &[String]) -> Result<(Vec<Positive>, Vec<Negation>)> {
    let (negated, plain): (Vec<&String>, Vec<&String>) =
        globs.iter().partition(|g| g.starts_with('!'));
    let negations = negated
        .into_iter()
        .flat_map(|g| expand_literal_braces(g))
        .map(|g| Negation::parse(&g))
        .collect::<Result<_>>()?;
    let positives = plain
        .into_iter()
        .flat_map(|g| expand_literal_braces(&normalize_glob(g)))
        .map(|g| Positive::parse(&g))
        .collect::<Result<_>>()?;
    Ok((positives, negations))
}

/// Resolves already-split entries into the files they name. `source` says
/// which of the two callers this is: a fileset, which may lean on the
/// workspace context and an index and may not read outside the workspace, or
/// declared outputs, which are read wherever they point. A path the source
/// vouches for needs no stat, a walked file it knows needs no stamp, and a
/// directory it can list is taken from the list; any other is walked. Walks
/// skip the same directories the workspace walker never enters, but an exact
/// path or a prefix inside one of them is read as-is.
pub(crate) fn expand_entries(
    workspace_root: &Path,
    positives: &[Positive],
    negations: &[Negation],
    source: &Source,
) -> Result<FilesExpansion> {
    let Source { known, files_under } = source;

    let mut found: Vec<String> = Vec::new();
    for entry in positives {
        let root = &entry.root;
        let remainder = entry.remainder.as_deref();
        let has_pattern = remainder.is_some();
        if !has_pattern && known(root) {
            found.push(root.clone());
            continue;
        }
        let start = workspace_root.join(root);
        let Ok(metadata) = std::fs::metadata(&start) else {
            continue;
        };
        if metadata.is_file() {
            if !has_pattern {
                found.push(root.clone());
            }
            continue;
        }
        // A directory named by its exact path means everything under it, the
        // same in a fileset as in a declared output; with a pattern, only the
        // remainder after the prefix is matched.
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
        if let Some(under) = files_under.files_under(root, &*accept) {
            // Filtered again: a source is asked to apply `accept` so it can
            // skip work, not trusted to have done it.
            found.extend(under.into_iter().filter(|path| accept(path)));
        }
    }

    // `accept` already filtered what the walk produced; this catches the
    // entries taken without it, an exact file and anything an index listed.
    found.retain(|path| !negations.iter().any(|n| n.excludes(path)));
    found.sort_unstable();
    found.dedup();
    Ok(FilesExpansion { files: found })
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
/// What a fileset glob may not say. `target_directory` answers only where
/// literal text stops; these are this feature's rules, with its wording.
fn validate_shape(glob: &str) -> Result<()> {
    if Path::new(glob).is_absolute() || glob.starts_with('/') {
        bail!(
            "The includeIgnored fileset \"{glob}\" is an absolute path; globs are workspace-relative."
        );
    }
    for segment in glob.split('/') {
        if segment == ".." {
            bail!("The includeIgnored fileset \"{glob}\" points outside the workspace.");
        }
        if segment == "." {
            bail!(
                "The includeIgnored fileset \"{glob}\" has a `.` segment; write it relative to the workspace root without `./`."
            );
        }
    }
    Ok(())
}

/// A glob with no leading directory (`**/*`, `*.gen`) is allowed: it walks
/// from the workspace root, which is slow but not wrong.
pub(crate) fn validate_files_glob(glob: &str) -> Result<()> {
    if let Some(body) = glob.strip_prefix('!') {
        let body = normalize_glob(body);
        if body.is_empty() {
            bail!("The includeIgnored fileset \"{glob}\" names nothing to exclude.");
        }
        for expanded in expand_literal_braces(&body) {
            validate_shape(&expanded)?;
        }
        return Ok(());
    }
    for expanded in expand_literal_braces(&normalize_glob(glob)) {
        validate_shape(&expanded)?;
    }
    Ok(())
}

/// `validate_files_glob` for every entry of a project's group, plus the one
/// rule that needs the whole group: it must not only exclude.
pub(crate) fn validate_files_globs(project: &str, globs: &[String]) -> Result<()> {
    if !globs.is_empty() && globs.iter().all(|glob| glob.starts_with('!')) {
        bail!(
            "The includeIgnored fileset \"{}\" applied to \"{project}\" is a negation with no positive includeIgnored fileset to filter. A negation only filters the positive includeIgnored filesets resolved with it: the project's own, or the `dependencies: true` group it is propagated to each dependency with.",
            globs[0]
        );
    }
    globs.iter().try_for_each(|glob| validate_files_glob(glob))
}
