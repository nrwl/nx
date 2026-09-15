//! What a walk records about the files it saw, and the stamp an expansion
//! reads so hashing does not stat again.

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::UNIX_EPOCH;

use xxhash_rust::xxh3;

/// Hashed in place of the content of a declared exact path that does not
/// exist: absence is an observation, so the key flips when the file appears.
pub(crate) const MISSING_FILE_HASH: &str = "missing";

/// What one walk of a prefix saw, and what it passed over.
#[derive(Default)]
pub(crate) struct WalkView {
    /// Key of every file the walk saw under its prefix, matched or not.
    pub(crate) seen: HashSet<u64>,
    /// Directories under the prefix the walk did not enter, workspace-relative:
    /// the hardcoded skips and symlinked directories.
    pub(crate) skipped: HashSet<String>,
}

/// What one walk covered: the prefix (workspace-relative, empty for the
/// root) and what it saw there.
#[derive(Clone)]
pub(crate) struct WalkRecord {
    pub(crate) workspace_root: PathBuf,
    pub(crate) prefix: String,
    pub(crate) view: Arc<WalkView>,
}

/// A walk records what it saw as keys, not paths: 8 bytes per file.
pub(crate) fn path_key(relative: &str) -> u64 {
    xxh3::xxh3_64(relative.as_bytes())
}

/// The `(mtime, size)` a file showed when expansion looked at it.
pub type FileStamp = (u128, u64);

pub(crate) fn stamp_of(metadata: &std::fs::Metadata) -> FileStamp {
    let mtime = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    (mtime, metadata.len())
}
