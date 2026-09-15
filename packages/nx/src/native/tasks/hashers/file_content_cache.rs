//! Content hashes of files read from disk, kept for as long as the files
//! exist. A walk reports what it saw under its prefix; `reconcile` drops
//! what the latest walks missed. Every lookup revalidates by (mtime, size),
//! so the cache can only ever save a read, never change a hash.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::UNIX_EPOCH;

use dashmap::DashMap;
use tracing::trace;
use xxhash_rust::xxh3;

use super::disk_expansion::FilesExpansion;
use crate::native::hasher::hash_file_path;

/// Hashed in place of the content of a declared exact path that does not
/// exist: absence is an observation, so the key flips when the file appears.
pub(crate) const MISSING_FILE_HASH: &str = "missing";

/// Content hashes keyed by absolute path, revalidated by (mtime, size).
/// Validated per lookup, so it outlives hashers and project graphs; the
/// daemon keeps one for its whole life through `shared_file_content_cache`.
pub(crate) struct FileContentCache {
    entries: DashMap<PathBuf, CachedFileContent>,
    /// Walks since the last `reconcile`, by workspace root and then prefix,
    /// the latest per prefix.
    walks: Mutex<HashMap<PathBuf, HashMap<String, Arc<WalkView>>>>,
}

impl FileContentCache {
    pub(crate) fn new() -> Self {
        Self {
            entries: DashMap::new(),
            walks: Mutex::new(HashMap::new()),
        }
    }

    /// Remembers what an expansion's walks saw and forgets the exact paths it
    /// found missing. Every hash of the expansion calls this; a repeat is a
    /// no-op.
    pub(crate) fn note(&self, workspace_root: &Path, expansion: &FilesExpansion) {
        if !expansion.walks.is_empty() {
            let mut walks = self.walks.lock().unwrap_or_else(|e| e.into_inner());
            for walk in &expansion.walks {
                walks
                    .entry(walk.workspace_root.clone())
                    .or_default()
                    .insert(walk.prefix.clone(), Arc::clone(&walk.view));
            }
        }
        for file in &expansion.missing {
            self.entries.remove(&workspace_root.join(file));
        }
    }

    /// Call between hashing calls, once per run. Drops every entry that the
    /// latest walk of the deepest walked prefix above it did not see. A walk
    /// does not judge what sits under a directory it did not enter (a
    /// hardcoded skip, a symlinked directory): only a deeper walk reads
    /// there. Entries with no walk above them, such as exact paths, are left
    /// alone; `note` forgets an exact path once it is missing. Cost: one pass
    /// over the map, a few lookups per entry, no disk.
    pub(crate) fn reconcile(&self) {
        let walks = std::mem::take(&mut *self.walks.lock().unwrap_or_else(|e| e.into_inner()));
        if walks.is_empty() {
            return;
        }
        self.entries.retain(|path, _| {
            for (root, prefixes) in &walks {
                let Ok(relative) = path.strip_prefix(root) else {
                    continue;
                };
                let relative = relative.to_string_lossy().replace('\\', "/");
                let Some(view) = deepest_walk(prefixes, &relative) else {
                    continue;
                };
                return view.leaves_alone(&relative) || view.seen.contains(&path_key(&relative));
            }
            true
        });
    }

    fn get(&self, path: &Path, (mtime, size): FileStamp) -> Option<String> {
        self.entries
            .get(path)
            .filter(|cached| cached.mtime == mtime && cached.size == size)
            .map(|cached| cached.hash.clone())
    }

    fn insert(&self, path: PathBuf, content: CachedFileContent) {
        self.entries.insert(path, content);
    }

    #[cfg(test)]
    fn len(&self) -> usize {
        self.entries.len()
    }

    #[cfg(test)]
    fn contains(&self, path: &Path) -> bool {
        self.entries.contains_key(path)
    }
}

/// The recorded walk of the deepest prefix above `relative`, if any. The
/// root walk's prefix is the empty string.
fn deepest_walk<'a>(
    prefixes: &'a HashMap<String, Arc<WalkView>>,
    relative: &str,
) -> Option<&'a WalkView> {
    let mut dir = parent_dir(relative);
    loop {
        if let Some(view) = prefixes.get(dir) {
            return Some(view);
        }
        if dir.is_empty() {
            return None;
        }
        dir = parent_dir(dir);
    }
}

fn parent_dir(path: &str) -> &str {
    path.rsplit_once('/').map_or("", |(dir, _)| dir)
}

/// What one walk of a prefix saw, and what it passed over.
#[derive(Default)]
pub(crate) struct WalkView {
    /// Key of every file the walk saw under its prefix, matched or not.
    pub(crate) seen: HashSet<u64>,
    /// Directories under the prefix the walk did not enter, workspace-relative:
    /// the hardcoded skips and symlinked directories.
    pub(crate) skipped: HashSet<String>,
}

impl WalkView {
    /// Whether `relative` sits under a directory this walk did not enter.
    fn leaves_alone(&self, relative: &str) -> bool {
        if self.skipped.is_empty() {
            return false;
        }
        let mut dir = parent_dir(relative);
        loop {
            if self.skipped.contains(dir) {
                return true;
            }
            if dir.is_empty() {
                return false;
            }
            dir = parent_dir(dir);
        }
    }
}

/// What one walk covered: the prefix (workspace-relative, empty for the
/// root) and the view that decides which entries under it still stand for a
/// file.
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

/// The process-wide cache. Absolute keys keep separate workspaces apart when
/// one process hashes several (tests do).
pub(crate) fn shared_file_content_cache() -> &'static FileContentCache {
    static CACHE: std::sync::OnceLock<FileContentCache> = std::sync::OnceLock::new();
    CACHE.get_or_init(FileContentCache::new)
}

/// Revalidated by (mtime, size) only: on a filesystem with coarse mtime a
/// same-size rewrite inside one tick is a stale hit (the racy-index problem).
pub(crate) struct CachedFileContent {
    mtime: u128,
    size: u64,
    hash: String,
}

impl CachedFileContent {
    fn new((mtime, size): FileStamp, hash: String) -> Self {
        Self { mtime, size, hash }
    }
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

pub(crate) fn hash_file_cached(
    workspace_root: &Path,
    file: &str,
    stamp: Option<FileStamp>,
    cache: &FileContentCache,
) -> String {
    let path = workspace_root.join(file);
    let stamp = stamp.or_else(|| std::fs::metadata(&path).ok().map(|m| stamp_of(&m)));
    if let Some(hash) = stamp.and_then(|stamp| cache.get(&path, stamp)) {
        trace!("files content cache HIT for {file}");
        return hash;
    }
    let hash = hash_file_path(&path).unwrap_or_else(|| MISSING_FILE_HASH.to_string());
    if let Some(stamp) = stamp {
        cache.insert(path, CachedFileContent::new(stamp, hash.clone()));
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::super::disk_expansion::tests::{globs, workspace};
    use super::super::disk_expansion::{expand_files, expand_files_with};
    use super::super::hash_ignored_files::hash_files;
    use super::*;
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    #[test]
    fn content_cache_revalidates_by_mtime_and_size() {
        let temp = workspace();
        let cache = FileContentCache::new();
        let group = globs(&["dist/gen/a.js"]);
        let expand = || expand_files(temp.path(), &group).unwrap();

        let first = hash_files(temp.path(), &expand(), |_| None, &cache);
        assert_eq!(cache.len(), 1);

        // Same size, forced newer mtime: must re-read, not trust the cache.
        std::thread::sleep(std::time::Duration::from_millis(20));
        temp.child("dist/gen/a.js").write_str("z").unwrap();
        let file = temp.path().join("dist/gen/a.js");
        let now = std::fs::File::open(&file).unwrap();
        now.set_modified(std::time::SystemTime::now()).unwrap();
        let second = hash_files(temp.path(), &expand(), |_| None, &cache);
        assert_ne!(first, second);

        // Same size with the cached mtime restored: the documented stale hit,
        // which also proves the second call went through the cache.
        let cached_at = std::fs::metadata(&file).unwrap().modified().unwrap();
        temp.child("dist/gen/a.js").write_str("q").unwrap();
        std::fs::File::open(&file)
            .unwrap()
            .set_modified(cached_at)
            .unwrap();
        let third = hash_files(temp.path(), &expand(), |_| None, &cache);
        assert_eq!(second, third);
    }

    #[test]
    fn walked_files_carry_their_stamp_unless_the_context_knows_them() {
        let temp = workspace();
        let expansion = expand_files_with(temp.path(), &globs(&["dist/gen/**/*.js"]), &|path| {
            path == "dist/gen/a.js"
        })
        .unwrap();
        assert_eq!(
            expansion.files,
            vec!["dist/gen/a.js", "dist/gen/nested/b.js"]
        );
        assert!(expansion.stamps[0].is_none());
        assert!(expansion.stamps[1].is_some());
        let cache = FileContentCache::new();
        let hashed = hash_files(
            temp.path(),
            &expansion,
            |path| (path == "dist/gen/a.js").then(|| "known".to_string()),
            &cache,
        );
        assert!(!hashed.is_empty());
        // Only the walked, unknown file was read and cached.
        assert_eq!(cache.len(), 1);
    }

    #[test]
    fn hashing_reuses_the_stamp_the_expansion_recorded() {
        let temp = workspace();
        let cache = FileContentCache::new();
        let expansion = expand_files(temp.path(), &globs(&["dist/gen/a.js"])).unwrap();
        let first = hash_files(temp.path(), &expansion, |_| None, &cache);

        // A different size after expansion: a fresh stat would miss the
        // cache, but the recorded stamp still matches the cached entry.
        temp.child("dist/gen/a.js").write_str("longer").unwrap();
        let same_expansion = hash_files(temp.path(), &expansion, |_| None, &cache);
        assert_eq!(first, same_expansion);
        let re_expanded = expand_files(temp.path(), &globs(&["dist/gen/a.js"])).unwrap();
        assert_ne!(
            first,
            hash_files(temp.path(), &re_expanded, |_| None, &cache)
        );
    }

    fn hash_group(temp: &TempDir, cache: &FileContentCache, list: &[&str]) -> String {
        let expansion = expand_files(temp.path(), &globs(list)).unwrap();
        hash_files(temp.path(), &expansion, |_| None, cache)
    }

    #[test]
    fn content_cache_forgets_a_file_the_next_walk_no_longer_sees() {
        let temp = workspace();
        let cache = FileContentCache::new();
        hash_group(&temp, &cache, &["dist/gen/**/*.js"]);
        assert_eq!(cache.len(), 2);
        // A build renames its output: the old name is dead once a walk of
        // the prefix fails to see it, and the next run drops it.
        std::fs::rename(
            temp.path().join("dist/gen/nested/b.js"),
            temp.path().join("dist/gen/nested/b2.js"),
        )
        .unwrap();
        hash_group(&temp, &cache, &["dist/gen/**/*.js"]);
        assert_eq!(cache.len(), 3);
        cache.reconcile();
        assert_eq!(cache.len(), 2);
        assert!(!cache.contains(&temp.path().join("dist/gen/nested/b.js")));
        assert!(cache.contains(&temp.path().join("dist/gen/nested/b2.js")));
        // Nothing recorded since: a second reconcile changes nothing.
        cache.reconcile();
        assert_eq!(cache.len(), 2);
    }

    #[test]
    fn content_cache_keeps_a_file_a_walk_saw_but_did_not_match() {
        let temp = workspace();
        let cache = FileContentCache::new();
        hash_group(&temp, &cache, &["dist/gen/**/*.map"]);
        hash_group(&temp, &cache, &["dist/gen/**/*.js"]);
        assert_eq!(cache.len(), 3);
        // The `.js` walk saw the `.map` file even though its pattern skipped it.
        cache.reconcile();
        assert_eq!(cache.len(), 3);
    }

    #[test]
    fn content_cache_forgets_everything_under_a_removed_directory() {
        let temp = workspace();
        let cache = FileContentCache::new();
        hash_group(&temp, &cache, &["dist/other/**"]);
        hash_group(&temp, &cache, &["dist/gen/**/*.js"]);
        assert_eq!(cache.len(), 3);
        std::fs::remove_dir_all(temp.path().join("dist/other")).unwrap();
        hash_group(&temp, &cache, &["dist/other/**"]);
        cache.reconcile();
        assert_eq!(cache.len(), 2);
        assert!(!cache.contains(&temp.path().join("dist/other/c.js")));
    }

    #[test]
    fn content_cache_forgets_a_missing_exact_path_at_once() {
        let temp = workspace();
        let cache = FileContentCache::new();
        hash_group(&temp, &cache, &["dist/gen/a.js"]);
        assert_eq!(cache.len(), 1);
        std::fs::remove_file(temp.path().join("dist/gen/a.js")).unwrap();
        hash_group(&temp, &cache, &["dist/gen/a.js"]);
        assert_eq!(cache.len(), 0);
    }

    #[test]
    fn a_parent_walk_does_not_judge_what_it_skipped() {
        let temp = workspace();
        let cache = FileContentCache::new();
        // The root walk never enters node_modules; a deeper glob reads it.
        hash_group(&temp, &cache, &["node_modules/foo/**"]);
        hash_group(&temp, &cache, &["**/*.js"]);
        cache.reconcile();
        assert!(cache.contains(&temp.path().join("node_modules/foo/package.json")));
        // Even when only the root walk ran since.
        hash_group(&temp, &cache, &["**/*.js"]);
        cache.reconcile();
        assert!(cache.contains(&temp.path().join("node_modules/foo/package.json")));
    }

    #[cfg(unix)]
    #[test]
    fn a_parent_walk_does_not_judge_what_sits_behind_a_symlinked_directory() {
        let temp = workspace();
        let cache = FileContentCache::new();
        temp.child("libs/a/x.ts").write_str("x").unwrap();
        std::os::unix::fs::symlink(
            temp.path().join("dist/other"),
            temp.path().join("libs/a/linked"),
        )
        .unwrap();
        hash_group(&temp, &cache, &["libs/a/linked/**"]);
        hash_group(&temp, &cache, &["libs/a/*.ts"]);
        assert_eq!(cache.len(), 2);
        cache.reconcile();
        assert!(cache.contains(&temp.path().join("libs/a/linked/c.js")));
        hash_group(&temp, &cache, &["libs/a/*.ts"]);
        cache.reconcile();
        assert!(cache.contains(&temp.path().join("libs/a/linked/c.js")));
    }

    #[test]
    fn the_deepest_walk_above_an_entry_decides() {
        let temp = workspace();
        let cache = FileContentCache::new();
        hash_group(&temp, &cache, &["dist/**"]);
        std::fs::remove_file(temp.path().join("dist/gen/nested/b.js")).unwrap();
        // The later, deeper walk is the one that counts for `dist/gen`.
        hash_group(&temp, &cache, &["dist/gen/**"]);
        cache.reconcile();
        assert!(!cache.contains(&temp.path().join("dist/gen/nested/b.js")));
        assert!(cache.contains(&temp.path().join("dist/gen/a.js")));
        assert!(cache.contains(&temp.path().join("dist/other/c.js")));

        // A file the deeper walk did not see is dropped even when a later,
        // shallower walk saw it: the deepest walk decides, not the latest.
        hash_group(&temp, &cache, &["dist/gen/**"]);
        temp.child("dist/gen/new.js").write_str("n").unwrap();
        hash_group(&temp, &cache, &["dist/**"]);
        assert!(cache.contains(&temp.path().join("dist/gen/new.js")));
        cache.reconcile();
        assert!(!cache.contains(&temp.path().join("dist/gen/new.js")));
    }

    #[test]
    fn a_walk_of_one_prefix_leaves_other_prefixes_alone() {
        let temp = workspace();
        let cache = FileContentCache::new();
        hash_group(&temp, &cache, &["dist/other/**"]);
        hash_group(&temp, &cache, &["dist/gen/**/*.js"]);
        std::fs::remove_file(temp.path().join("dist/other/c.js")).unwrap();
        // Only `dist/gen` was walked since, so `dist/other`'s entry is not judged.
        hash_group(&temp, &cache, &["dist/gen/**/*.js"]);
        cache.reconcile();
        assert_eq!(cache.len(), 3);
        hash_group(&temp, &cache, &["dist/other/**"]);
        cache.reconcile();
        assert_eq!(cache.len(), 2);
    }
}
