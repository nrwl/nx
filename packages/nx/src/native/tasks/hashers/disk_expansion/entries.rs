//! A group's entries, each split at its literal prefix. The prefix is the
//! literal directory an expansion starts from; only the remainder is a glob.

use std::sync::{Arc, LazyLock};

use anyhow::{Result, bail};
use dashmap::DashMap;

use crate::native::glob::{
    NxGlobSet, build_converted_glob_set, build_glob_set, converted_globs, fileset_patterns,
    normalize_glob, partition_glob, partition_unsigned,
};

/// What an entry names at and below its root.
pub(crate) enum Below {
    /// The root, if it is a file, or everything under it.
    Tree,
    /// The root itself and nothing under it.
    Exact,
    /// Paths under the root whose remainder matches.
    Pattern(Arc<NxGlobSet>),
}

impl Below {
    pub(super) fn is_pattern(&self) -> bool {
        matches!(self, Below::Pattern(_))
    }

    /// Whether `path` is named, with `root` split off it. A pattern never
    /// names the root itself.
    fn names(&self, root: &str, path: &str) -> bool {
        let Some(rest) = rest_below(root, path) else {
            return false;
        };
        match self {
            Below::Tree => true,
            Below::Exact => rest.is_empty(),
            Below::Pattern(set) => !rest.is_empty() && set.is_match(rest),
        }
    }
}

/// The part of `path` below `root`: all of it when `root` is empty, empty
/// when `path` is `root` itself, `None` when `path` is elsewhere.
fn rest_below<'p>(root: &str, path: &'p str) -> Option<&'p str> {
    if root.is_empty() {
        return Some(path);
    }
    let rest = path.strip_prefix(root)?;
    if rest.is_empty() {
        Some(rest)
    } else {
        rest.strip_prefix('/')
    }
}

/// Splits an `includeIgnored` or output glob at its literal prefix. A glob
/// literal to its end names a file or a directory's whole contents.
fn split(glob: &str) -> Result<(String, Below)> {
    let (root, remainder) = partition_glob(glob);
    let below = match remainder {
        Some(rest) => Below::Pattern(build_glob_set(&[rest])?),
        None => Below::Tree,
    };
    Ok((root, below))
}

/// Splits a glob already in the matching engine's syntax, see
/// `converted_globs`, into its root and the pattern after it. It reads as
/// the engine reads it: a trailing `/` means everything under, a glob
/// literal to its end (no pattern) names that path alone, and its negation
/// marker is already stripped, so a leading `!` is part of a name.
fn split_converted(glob: &str) -> (String, Option<String>) {
    match glob.ends_with('/') {
        true => partition_unsigned(&format!("{glob}**")),
        false => partition_unsigned(glob),
    }
}

/// Converted globs as one entry per root: the patterns under a root share a
/// glob set, so a path is matched once per root rather than once per glob.
fn group_by_root(globs: Vec<(String, Option<String>)>) -> Result<Vec<(String, Below)>> {
    let mut entries: Vec<(String, Below)> = Vec::new();
    let mut patterns: Vec<(String, Vec<String>)> = Vec::new();
    for (root, rest) in globs {
        match rest {
            None => entries.push((root, Below::Exact)),
            Some(rest) => match patterns.iter_mut().find(|(r, _)| *r == root) {
                Some((_, rests)) => rests.push(rest),
                None => patterns.push((root, vec![rest])),
            },
        }
    }
    for (root, rests) in patterns {
        entries.push((root, Below::Pattern(build_converted_glob_set(&rests)?)));
    }
    Ok(entries)
}

/// A positive entry: the directory it is read from and what it names there.
pub(crate) struct Positive {
    pub(super) root: String,
    pub(super) below: Below,
}

impl Positive {
    /// Split at its literal prefix, see `partition_glob`.
    pub(crate) fn parse(glob: &str) -> Result<Self> {
        let (root, below) = split(&normalize_glob(glob))?;
        Ok(Self { root, below })
    }

    /// `path` as written, whatever characters it has: a file, or a directory
    /// and everything under it.
    pub(crate) fn exact(path: &str) -> Self {
        Self {
            root: path.to_string(),
            below: Below::Tree,
        }
    }

    pub(crate) fn matches(&self, path: &str) -> bool {
        self.below.names(&self.root, path)
    }
}

/// A `!` entry split at its literal prefix. The prefix is compared as text;
/// only the remainder is a glob.
pub(crate) struct Negation {
    root: String,
    below: Below,
}

impl Negation {
    pub(crate) fn parse(glob: &str) -> Result<Self> {
        let normalized = normalize_glob(glob);
        let body = normalized.strip_prefix('!').unwrap_or(&normalized);
        let (root, below) = split(body)?;
        if root.is_empty() && !below.is_pattern() {
            bail!("The fileset \"{glob}\" names nothing to exclude.");
        }
        Ok(Self { root, below })
    }

    /// Excludes `path` as written: a file, or a directory and everything under it.
    pub(crate) fn exact(path: &str) -> Self {
        Self {
            root: path.to_string(),
            below: Below::Tree,
        }
    }

    pub(super) fn excludes(&self, path: &str) -> bool {
        self.below.names(&self.root, path)
    }
}

/// A regular fileset as entries. Each glob is converted the way one glob set
/// over the whole fileset would compile it, then each converted glob joins
/// the entry for its root: a negation, or the part of an extglob that
/// negates, excludes across the whole fileset, and a brace group stays a
/// pattern even when its alternatives are literal. A path with no pattern names
/// that file or everything under it, see `fileset_patterns`.
pub(crate) struct FileSet {
    pub(super) positives: Vec<Positive>,
    pub(super) negations: Vec<Negation>,
}

/// Parsed filesets, kept for the process like `build_glob_set`'s glob sets:
/// converting a fileset's extglobs costs more than matching it.
static FILESET_CACHE: LazyLock<DashMap<String, Arc<FileSet>>> = LazyLock::new(DashMap::new);

impl FileSet {
    /// A fileset with no positive entry names every file not excluded.
    pub(crate) fn parse(globs: &[String]) -> Result<Arc<Self>> {
        let mut sorted: Vec<&str> = globs.iter().map(String::as_str).collect();
        sorted.sort_unstable();
        let key = format!("{}\0{}", sorted.len(), sorted.join("\0"));
        if let Some(cached) = FILESET_CACHE.get(&key) {
            return Ok(Arc::clone(cached.value()));
        }
        let fileset = Arc::new(Self::parse_uncached(globs)?);
        FILESET_CACHE.insert(key, Arc::clone(&fileset));
        Ok(fileset)
    }

    fn parse_uncached(globs: &[String]) -> Result<Self> {
        let mut included = Vec::new();
        let mut excluded = Vec::new();
        for glob in fileset_patterns(globs) {
            for converted in converted_globs(&glob)? {
                match converted.strip_prefix('!') {
                    Some(body) => excluded.push(split_converted(body)),
                    None => included.push(split_converted(&converted)),
                }
            }
        }
        let mut positives: Vec<Positive> = group_by_root(included)?
            .into_iter()
            .map(|(root, below)| Positive { root, below })
            .collect();
        let negations: Vec<Negation> = group_by_root(excluded)?
            .into_iter()
            .map(|(root, below)| Negation { root, below })
            .collect();
        if positives.is_empty() {
            // The empty root is the workspace root.
            positives.push(Positive::exact(""));
        }
        Ok(Self {
            positives,
            negations,
        })
    }

    pub(crate) fn matches(&self, path: &str) -> bool {
        self.positives.iter().any(|entry| entry.matches(path))
            && !self.negations.iter().any(|entry| entry.excludes(path))
    }
}
