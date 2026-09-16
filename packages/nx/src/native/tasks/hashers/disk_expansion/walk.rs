//! What the expansion does with the disk: it drives the workspace walker
//! and decides, per entry, whether the file counts and what it is worth
//! remembering. The traversal itself is `create_walker`'s.

use std::path::Path;
use std::sync::{Arc, OnceLock};

use anyhow::{Context, Result};
use ignore::WalkState;
use parking_lot::Mutex;

use super::expansion::Found;
use crate::native::glob::{NxGlobSet, build_glob_set};
use crate::native::walker::{TRANSIENT_FILE_GLOBS, create_walker_vetoing};

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
pub(super) fn walk_files(
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
