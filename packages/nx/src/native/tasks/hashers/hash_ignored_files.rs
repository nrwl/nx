//! Hashes an `includeIgnored` fileset group: tracked files from the file
//! map, the rest through the context's index, folded in path order with the
//! declared paths that are missing.

use std::collections::HashMap;
use std::path::Path;

use anyhow::Result;
use rayon::prelude::*;
use xxhash_rust::xxh3;

use super::disk_expansion::{FilesExpansion, expand_files_with_skips, skip_dirs_under};
use crate::native::workspace::ignored_index::IgnoredIndex;

/// Folds `(path, content hash)` pairs in path order, like a fileset; a file
/// that is gone by the time it is read is left out. `known`
/// answers from the workspace file map, when the caller trusts it, so those
/// files are not read; everything else is the index's to answer or read.
/// `trust_index` is `IgnoredIndex::hash_file`'s `trust`.
pub(crate) fn hash_files(
    workspace_root: &Path,
    expansion: &FilesExpansion,
    known: impl Fn(&str) -> Option<String> + Sync,
    index: &IgnoredIndex,
    trust_index: bool,
) -> String {
    let hashes: Vec<Option<String>> = expansion
        .files
        .par_iter()
        .zip(expansion.stamps.par_iter())
        .map(|(file, stamp)| {
            known(file).or_else(|| index.hash_file(workspace_root, file, *stamp, trust_index))
        })
        .collect();

    let mut hasher = xxh3::Xxh3::new();
    for (file, hash) in expansion.files.iter().zip(&hashes) {
        if let Some(hash) = hash {
            hasher.update(file.as_bytes());
            hasher.update(hash.as_bytes());
        }
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
/// The files an `includeIgnored` fileset group matches on disk, sorted.
pub fn expand_files_input(
    workspace_root: String,
    globs: Vec<String>,
    skipped_directories: Option<Vec<String>>,
) -> Result<Vec<String>> {
    let root = Path::new(&workspace_root);
    let skip_dirs = skip_dirs_under(root, &skipped_directories.unwrap_or_default());
    Ok(expand_files_with_skips(root, &globs, &|_| false, &skip_dirs)?.files)
}

#[cfg(test)]
mod tests {
    use super::super::disk_expansion::expand_files;
    use super::super::disk_expansion::tests::{globs, workspace};
    use super::*;
    use assert_fs::prelude::*;

    #[test]
    fn an_exact_path_changes_the_hash_when_the_file_appears_and_when_it_goes() {
        let temp = workspace();
        let index = IgnoredIndex::new(None);
        let input = globs(&["dist/gen/generated.d.ts"]);

        let before = expand_files(temp.path(), &input).unwrap();
        assert!(before.files.is_empty());
        let hash_before = hash_files(temp.path(), &before, |_| None, &index, false);

        temp.child("dist/gen/generated.d.ts")
            .write_str("x")
            .unwrap();
        let after = expand_files(temp.path(), &input).unwrap();
        assert_eq!(after.files, vec!["dist/gen/generated.d.ts"]);
        let hash_after = hash_files(temp.path(), &after, |_| None, &index, false);

        assert_ne!(hash_before, hash_after);

        std::fs::remove_file(temp.path().join("dist/gen/generated.d.ts")).unwrap();
        let gone = expand_files(temp.path(), &input).unwrap();
        assert_eq!(
            hash_files(temp.path(), &gone, |_| None, &index, false),
            hash_before
        );
    }

    #[test]
    fn a_listed_file_that_is_gone_when_read_is_left_out() {
        let temp = workspace();
        let index = IgnoredIndex::new(None);
        let listed = expand_files(temp.path(), &globs(&["dist/gen/*.js"])).unwrap();
        let with_both = hash_files(temp.path(), &listed, |_| None, &index, false);
        std::fs::remove_file(temp.path().join("dist/gen/a.js")).unwrap();
        let without = expand_files(temp.path(), &globs(&["dist/gen/*.js"])).unwrap();
        assert_ne!(
            hash_files(temp.path(), &listed, |_| None, &index, false),
            with_both
        );
        assert_eq!(
            hash_files(temp.path(), &listed, |_| None, &index, false),
            hash_files(temp.path(), &without, |_| None, &index, false)
        );
    }

    #[test]
    fn file_map_hash_wins_over_disk() {
        let temp = workspace();
        let index = IgnoredIndex::new(None);
        let expansion = expand_files(temp.path(), &globs(&["dist/gen/a.js"])).unwrap();

        let from_disk = hash_files(temp.path(), &expansion, |_| None, &index, false);
        let from_map = hash_files(
            temp.path(),
            &expansion,
            |path| (path == "dist/gen/a.js").then(|| "known".to_string()),
            &index,
            false,
        );
        assert_ne!(from_disk, from_map);
    }
}
