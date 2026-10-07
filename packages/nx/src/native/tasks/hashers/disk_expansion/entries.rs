//! A group's entries, each split at its literal prefix. The prefix is the
//! literal directory an expansion starts from; only the remainder is a glob.

use std::sync::Arc;

use anyhow::{Result, bail};

use super::expansion::parse_group;
use crate::native::glob::{
    NxGlobSet, build_glob_set, literal_segment, normalize_glob, partition_glob,
};

/// The part of `path` below `root`: all of it when `root` is empty, empty
/// when `path` is `root` itself, `None` when `path` is elsewhere.
fn below<'p>(root: &str, path: &'p str) -> Option<&'p str> {
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

/// A positive entry: the directory it is read from and the pattern after it,
/// if any. Without a pattern it names an exact file, or a directory and
/// everything under it.
pub(crate) struct Positive {
    pub(super) root: String,
    pub(super) remainder: Option<Arc<NxGlobSet>>,
}

impl Positive {
    /// Split at its literal prefix, see `partition_glob`.
    pub(crate) fn parse(glob: &str) -> Result<Self> {
        let (root, remainder) = partition_glob(&normalize_glob(glob));
        let remainder = remainder.map(|rest| build_glob_set(&[rest])).transpose()?;
        Ok(Self { root, remainder })
    }

    /// `path` as written, whatever characters it has.
    pub(crate) fn exact(path: &str) -> Self {
        Self {
            root: path.to_string(),
            remainder: None,
        }
    }

    /// Whether this entry names `path`. A pattern matches only below the
    /// root, never the root itself.
    pub(crate) fn matches(&self, path: &str) -> bool {
        match (&self.remainder, below(&self.root, path)) {
            (_, None) => false,
            (None, Some(_)) => true,
            (Some(set), Some(rest)) => !rest.is_empty() && set.is_match(rest),
        }
    }
}

/// A `!` entry split at its literal prefix. The prefix is compared as text;
/// only the remainder is a glob. Without a remainder it names an exact file,
/// or a directory whose whole contents are excluded.
pub(crate) struct Negation {
    root: String,
    remainder: Option<Arc<NxGlobSet>>,
    /// Excludes `root` and everything under it.
    whole: bool,
    /// Only learned `*.extension` exclusions compare the complete suffix category.
    category: Option<String>,
}

impl Negation {
    pub(crate) fn parse(glob: &str) -> Result<Self> {
        Self::parse_with_categories(glob, false)
    }

    pub(crate) fn parse_with_categories(glob: &str, ultracache: bool) -> Result<Self> {
        let normalized = normalize_glob(glob);
        let body = normalized.strip_prefix('!').unwrap_or(&normalized);
        let category = ultracache
            .then(|| extension_wildcard_category(body))
            .flatten();
        let (root, remainder) = partition_glob(body);
        if root.is_empty() && remainder.is_none() {
            bail!("The fileset \"{glob}\" names nothing to exclude.");
        }
        // `**` and `**/*` match every path below, dotfiles included.
        let whole = matches!(remainder.as_deref(), None | Some("**") | Some("**/*"));
        let remainder = remainder.map(|rest| build_glob_set(&[rest])).transpose()?;
        Ok(Self {
            root,
            remainder,
            whole,
            category,
        })
    }

    /// Excludes `path` as written: a file, or a directory and everything under it.
    pub(crate) fn exact(path: &str) -> Self {
        Self {
            root: path.to_string(),
            remainder: None,
            whole: true,
            category: None,
        }
    }

    /// The directory this excludes entirely, so a walk need not enter it.
    pub(crate) fn whole_directory(&self) -> Option<&str> {
        (self.whole && !self.root.is_empty()).then_some(self.root.as_str())
    }

    pub(crate) fn has_suffix_category(&self) -> bool {
        self.category.is_some()
    }

    pub(crate) fn excludes(&self, path: &str) -> bool {
        if self
            .category
            .as_deref()
            .is_some_and(|category| suffix_category(path) != category)
        {
            return false;
        }
        match (&self.remainder, below(&self.root, path)) {
            (_, None) => false,
            (None, Some(_)) => true,
            (Some(set), Some(rest)) => set.is_match(rest),
        }
    }
}

/// The last two suffix components, ignoring a leading dot in the basename.
fn suffix_category(path: &str) -> &str {
    let name = path.rsplit('/').next().unwrap_or(path);
    let name = name.strip_prefix('.').unwrap_or(name);
    let mut dots = name.rmatch_indices('.');
    match dots.next() {
        Some((last, _)) => &name[dots.next().map_or(last, |(previous, _)| previous)..],
        None => "",
    }
}

/// Brace alternatives have already expanded. Other glob shapes keep their semantics.
fn extension_wildcard_category(glob: &str) -> Option<String> {
    let name = glob.rsplit('/').next()?;
    // Decode literal escapes with the same parser that distinguishes real glob syntax.
    let suffix = literal_segment(name.strip_prefix("*.")?)?;
    if suffix.is_empty() {
        return None;
    }
    Some(suffix_category(&format!("*.{suffix}")).to_string())
}

/// A regular fileset, read against the file map rather than the disk.
/// Entries are independent, so their order never matters.
pub(crate) struct FileSet {
    pub(super) positives: Vec<Positive>,
    pub(super) negations: Vec<Negation>,
}

impl FileSet {
    /// A fileset of only negations names every file but those they exclude.
    /// An empty entry names nothing.
    pub(crate) fn parse(globs: &[String]) -> Result<Self> {
        let only_negations = globs.iter().all(|glob| glob.starts_with('!'));
        let named: Vec<String> = globs
            .iter()
            .filter(|glob| !glob.trim_start_matches('!').is_empty())
            .cloned()
            .collect();
        let (mut positives, negations) = parse_group(&named)?;
        if only_negations {
            // The empty root is the workspace root, so this is every file.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ultracache_extension_categories_accept_literal_bangs_but_not_extglobs() {
        assert_eq!(
            extension_wildcard_category("*.t!s").as_deref(),
            Some(".t!s")
        );
        assert_eq!(extension_wildcard_category("*.!(ts)"), None);
    }

    #[test]
    fn ultracache_suffix_categories_use_the_last_two_components() {
        for (name, category) in [
            ("cat.ts", ".ts"),
            ("cat.spec.ts", ".spec.ts"),
            ("cat.one.two.spec.ts", ".spec.ts"),
            ("cat.d.ts", ".d.ts"),
            ("cat.impl.ts", ".impl.ts"),
            (".env", ""),
            (".hidden.ts", ".ts"),
            ("some.dir/cat.ts", ".ts"),
        ] {
            assert_eq!(suffix_category(name), category, "{name}");
        }
    }
}
