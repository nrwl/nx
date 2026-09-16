//! A group's entries, each split at its literal prefix. The prefix is the
//! literal directory an expansion starts from; only the remainder is a glob.

use std::sync::Arc;

use anyhow::{Result, bail};

use crate::native::glob::{NxGlobSet, build_glob_set, normalize_glob, target_directory};

/// A positive entry: the directory it is read from and the pattern after it,
/// if any. Without a pattern it names an exact file, or a directory and
/// everything under it.
pub(crate) struct Positive {
    pub(super) text: String,
    pub(super) root: String,
    pub(super) remainder: Option<String>,
}

impl Positive {
    /// Split at its literal prefix, see `target_directory`.
    pub(crate) fn parse(glob: &str) -> Result<Self> {
        let (root, remainder) = target_directory(glob);
        Ok(Self {
            text: glob.to_string(),
            root,
            remainder: remainder.map(str::to_string),
        })
    }

    /// `path` as written, whatever characters it has.
    pub(crate) fn exact(path: &str) -> Self {
        Self {
            text: path.to_string(),
            root: path.to_string(),
            remainder: None,
        }
    }
}

/// A `!` entry split at its literal prefix. The prefix is compared as text;
/// only the remainder is a glob. Without a remainder it names an exact file,
/// or a directory whose whole contents are excluded.
pub(crate) struct Negation {
    root: String,
    remainder: Option<Arc<NxGlobSet>>,
}

impl Negation {
    pub(crate) fn parse(glob: &str) -> Result<Self> {
        let normalized = normalize_glob(glob);
        let body = normalized.strip_prefix('!').unwrap_or(&normalized);
        let (root, remainder) = target_directory(body);
        if root.is_empty() && remainder.is_none() {
            bail!("The includeIgnored fileset \"{glob}\" names nothing to exclude.");
        }
        let remainder = remainder.map(|rest| build_glob_set(&[rest])).transpose()?;
        Ok(Self { root, remainder })
    }

    /// Excludes `path` as written: a file, or a directory and everything under it.
    pub(crate) fn exact(path: &str) -> Self {
        Self {
            root: path.to_string(),
            remainder: None,
        }
    }

    pub(super) fn excludes(&self, path: &str) -> bool {
        let rest = if self.root.is_empty() {
            Some(path)
        } else {
            path.strip_prefix(self.root.as_str()).and_then(|rest| {
                if rest.is_empty() {
                    Some(rest)
                } else {
                    rest.strip_prefix('/')
                }
            })
        };
        match (&self.remainder, rest) {
            (_, None) => false,
            (None, Some(_)) => true,
            (Some(set), Some(rest)) => set.is_match(rest),
        }
    }
}
