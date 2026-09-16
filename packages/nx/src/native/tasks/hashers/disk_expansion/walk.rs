//! Reading the disk: what a walk never enters, the walk itself, and the
//! stamp it reads on the way.

use std::path::Path;
use std::sync::Arc;

use anyhow::Result;
use rayon::prelude::*;
use walkdir::WalkDir;

use super::expansion::Found;
use crate::native::glob::{NxGlobSet, build_glob_set};
use crate::native::walker::{HARDCODED_IGNORE_PATTERNS, TRANSIENT_FILE_GLOBS};

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

/// What a walk never enters or lists: the hardcoded directories, and the
/// transient files the watch never reports.
pub(super) fn walk_skips() -> Result<Arc<NxGlobSet>> {
    let patterns: Vec<String> = HARDCODED_IGNORE_PATTERNS
        .iter()
        .map(|p| (*p).to_string())
        .chain(TRANSIENT_FILE_GLOBS.iter().map(|g| format!("**/{g}")))
        .collect();
    build_glob_set(&patterns)
}

/// Files under `start`, workspace-relative, with the stamp read on the way
/// for anything the context does not vouch for. Top-level subdirectories walk
/// in parallel. `start` itself is never skipped; its descendants are subject
/// to the hardcoded ignores, so `node_modules/foo/**` works. Linked
/// directories are not entered; with `canonical_root`, a linked file counts
/// only when its target is inside it.
pub(super) fn walk_files(
    start: &Path,
    workspace_root: &Path,
    canonical_root: Option<&Path>,
    skip: &NxGlobSet,
    accept: &(dyn Fn(&str) -> bool + Sync),
    known: &(dyn Fn(&str) -> bool + Sync),
) -> Vec<Found> {
    let relative_of = |path: &Path| -> Option<String> {
        Some(
            path.strip_prefix(workspace_root)
                .ok()?
                .to_string_lossy()
                .replace('\\', "/"),
        )
    };
    let Ok(entries) = std::fs::read_dir(start) else {
        return Vec::new();
    };
    let mut leaves = Vec::new();
    let mut dirs = Vec::new();
    for entry in entries.flatten() {
        match entry.file_type() {
            Ok(file_type) if file_type.is_dir() => dirs.push(entry.path()),
            Ok(file_type) => leaves.push((entry.path(), file_type)),
            Err(_) => {}
        }
    }
    let visit = |path: &Path, file_type: std::fs::FileType| -> Option<Found> {
        let relative = relative_of(path)?;
        if file_type.is_symlink() {
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
    let mut found: Vec<Found> = leaves
        .iter()
        .filter(|(path, _)| !skip.is_match(path))
        .filter_map(|(path, file_type)| visit(path, *file_type))
        .collect();
    let nested: Vec<Vec<Found>> = dirs
        .par_iter()
        .map(|dir| {
            if skip.is_match(dir) {
                return Vec::new();
            }
            WalkDir::new(dir)
                .follow_links(false)
                .into_iter()
                .filter_entry(|entry| !skip.is_match(entry.path()))
                .flatten()
                .filter_map(|entry| visit(entry.path(), entry.file_type()))
                .collect()
        })
        .collect();
    for group in nested {
        found.extend(group);
    }
    found
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
    let skip = walk_skips().ok()?;
    let walked = walk_files(
        &start,
        workspace_root,
        Some(&canonical_root),
        &skip,
        &|_| true,
        &|_| false,
    );
    Some(
        walked
            .into_iter()
            .map(|found| (found.path, found.stamp.unwrap_or_default()))
            .collect(),
    )
}
