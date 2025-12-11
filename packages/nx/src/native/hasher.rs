use std::path::Path;

use dashmap::DashMap;
use once_cell::sync::Lazy;
use tracing::trace;
use xxhash_rust::xxh3;

/// Global cache for file hashes to avoid re-reading and re-hashing the same files.
/// Key is the absolute file path, value is the computed hash.
/// This cache is thread-safe and persists across calls within the same daemon process.
static FILE_HASH_CACHE: Lazy<DashMap<String, String>> = Lazy::new(DashMap::new);

/// Clears the file hash cache. Useful for testing or when files may have changed.
#[allow(dead_code)]
pub fn clear_file_hash_cache() {
    FILE_HASH_CACHE.clear();
}

/// Returns the current size of the file hash cache.
#[allow(dead_code)]
pub fn file_hash_cache_size() -> usize {
    FILE_HASH_CACHE.len()
}

pub fn hash(content: &[u8]) -> String {
    xxh3::xxh3_64(content).to_string()
}

#[napi]
pub fn hash_array(input: Vec<Option<String>>) -> String {
    let joined = input
        .iter()
        .filter_map(|s| {
            if s.is_none() {
                trace!("Encountered None value in hash_array input: {:?}", input);
            }
            s.as_deref()
        })
        .collect::<Vec<_>>()
        .join(",");
    let content = joined.as_bytes();
    hash(content)
}

#[napi]
pub fn hash_file(file: String) -> Option<String> {
    hash_file_path(file)
}

/// Hashes a file, using a global cache to avoid redundant disk reads.
///
/// When multiple tasks reference the same file (common with shared libraries,
/// configuration files, or output files), this cache prevents reading and
/// hashing the same file multiple times.
#[inline]
pub fn hash_file_path<P: AsRef<Path>>(path: P) -> Option<String> {
    let path = path.as_ref();
    let path_str = path.to_string_lossy().to_string();

    // Check cache first
    if let Some(cached_hash) = FILE_HASH_CACHE.get(&path_str) {
        trace!("File hash cache HIT for {:?}", path);
        return Some(cached_hash.clone());
    }

    trace!("File hash cache MISS for {:?}, reading file", path);
    let Ok(content) = std::fs::read(path) else {
        trace!("Failed to read file: {:?}", path);
        return None;
    };

    trace!("Hashing {:?}", path);
    let hash = hash(&content);
    trace!("Hashed file {:?} - {:?}", path, hash);

    // Store in cache
    FILE_HASH_CACHE.insert(path_str, hash.clone());

    Some(hash)
}

#[cfg(test)]
mod tests {
    use crate::native::hasher::{hash_array, hash_file};
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    ///
    /// Setup a temporary directory to do testing in
    ///
    fn setup_fs() -> TempDir {
        let temp = TempDir::new().unwrap();
        temp.child("test.txt").write_str("content").unwrap();
        temp.child("foo.txt").write_str("content1").unwrap();
        temp.child("bar.txt").write_str("content2").unwrap();
        temp.child("baz")
            .child("qux.txt")
            .write_str("content@qux")
            .unwrap();
        temp.child("node_modules")
            .child("node-module-dep")
            .write_str("content")
            .unwrap();
        temp
    }

    #[test]
    fn it_hashes_a_file() {
        // handle non existent files
        let content = hash_file("".into());
        assert!(content.is_none());

        let temp_dir = setup_fs();

        let test_file_path = temp_dir.display().to_string() + "/test.txt";
        let content = hash_file(test_file_path);

        assert_eq!(content.unwrap(), "6193209363630369380");
    }

    #[test]
    fn it_hashes_an_array() {
        // Resilient to None values (e.g. null values passed from the JS side)
        let content = hash_array(vec![Some("foo".to_string()), None, Some("bar".to_string())]);
        assert_eq!(content, "10292076446133652019");
    }
}
