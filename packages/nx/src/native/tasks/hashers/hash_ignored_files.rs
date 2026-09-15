//! Hashes an `includeIgnored` fileset group: tracked files from the file
//! map, the rest through the content cache, folded in path order with the
//! declared paths that are missing.

use std::collections::HashMap;
use std::path::Path;

use anyhow::Result;
use rayon::prelude::*;
use xxhash_rust::xxh3;

use super::disk_expansion::{FilesExpansion, expand_files};
use super::file_content_cache::{FileContentCache, MISSING_FILE_HASH, hash_file_cached};

/// Folds `(path, content hash)` pairs in path order, like a fileset. `known`
/// answers from the workspace file map so tracked files never touch the disk.
pub(crate) fn hash_files(
    workspace_root: &Path,
    expansion: &FilesExpansion,
    known: impl Fn(&str) -> Option<String> + Sync,
    cache: &FileContentCache,
) -> String {
    cache.note(workspace_root, expansion);
    let hashes: Vec<String> = expansion
        .files
        .par_iter()
        .zip(expansion.stamps.par_iter())
        .map(|(file, stamp)| {
            known(file).unwrap_or_else(|| hash_file_cached(workspace_root, file, *stamp, cache))
        })
        .collect();

    let mut hasher = xxh3::Xxh3::new();
    for (file, hash) in expansion.files.iter().zip(&hashes) {
        hasher.update(file.as_bytes());
        hasher.update(hash.as_bytes());
    }
    for file in &expansion.missing {
        hasher.update(file.as_bytes());
        hasher.update(MISSING_FILE_HASH.as_bytes());
    }
    hasher.digest().to_string()
}

/// Index of the workspace file map by path, built once per hasher on first use.
pub(crate) fn index_file_map(files: &[crate::native::types::FileData]) -> HashMap<String, u32> {
    files
        .iter()
        .enumerate()
        .map(|(i, f)| (f.file.clone(), i as u32))
        .collect()
}

#[napi]
/// The files an `includeIgnored` fileset group matches on disk, sorted, then
/// the declared exact paths that are missing (they still take part in the hash).
pub fn expand_files_input(workspace_root: String, globs: Vec<String>) -> Result<Vec<String>> {
    let expansion = expand_files(Path::new(&workspace_root), &globs)?;
    Ok(expansion
        .files
        .into_iter()
        .chain(expansion.missing)
        .collect())
}

#[cfg(test)]
mod tests {
    use super::super::disk_expansion::tests::{globs, workspace};
    use super::*;
    use assert_fs::prelude::*;

    #[test]
    fn missing_exact_path_is_recorded_and_changes_the_hash_when_it_appears() {
        let temp = workspace();
        let cache = FileContentCache::new();
        let input = globs(&["dist/gen/generated.d.ts"]);

        let before = expand_files(temp.path(), &input).unwrap();
        assert!(before.files.is_empty());
        assert_eq!(before.missing, vec!["dist/gen/generated.d.ts"]);
        let hash_before = hash_files(temp.path(), &before, |_| None, &cache);

        temp.child("dist/gen/generated.d.ts")
            .write_str("x")
            .unwrap();
        let after = expand_files(temp.path(), &input).unwrap();
        assert_eq!(after.files, vec!["dist/gen/generated.d.ts"]);
        let hash_after = hash_files(temp.path(), &after, |_| None, &cache);

        assert_ne!(hash_before, hash_after);
    }

    #[test]
    fn file_map_hash_wins_over_disk() {
        let temp = workspace();
        let cache = FileContentCache::new();
        let expansion = expand_files(temp.path(), &globs(&["dist/gen/a.js"])).unwrap();

        let from_disk = hash_files(temp.path(), &expansion, |_| None, &cache);
        let from_map = hash_files(
            temp.path(),
            &expansion,
            |path| (path == "dist/gen/a.js").then(|| "known".to_string()),
            &cache,
        );
        assert_ne!(from_disk, from_map);
    }
}
