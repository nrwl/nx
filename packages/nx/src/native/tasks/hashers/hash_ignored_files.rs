//! Hashes an `includeIgnored` fileset group: tracked files from the file
//! map, the rest through the context's index, folded in path order with the
//! declared paths that are missing.

use std::collections::HashMap;
use std::path::Path;

use anyhow::Result;
use rayon::prelude::*;
use xxhash_rust::xxh3;

use super::disk_expansion::{FilesExpansion, Source, expand_globs};
use crate::native::workspace::ignored_index::{IgnoredIndex, RunStage};

/// Folds `(path, content hash)` pairs in path order, like a fileset; a file
/// that is gone by the time it is read is left out. `known`
/// answers from the workspace file map, when the caller trusts it, so those
/// files are not read; everything else is the index's to answer or read.
/// `stage` decides whether a held hash may be served without a stat; see
/// `RunStage`.
pub(crate) fn hash_files(
    workspace_root: &Path,
    expansion: &FilesExpansion,
    known: impl Fn(&str) -> Option<String> + Sync,
    index: &IgnoredIndex,
    stage: RunStage,
) -> String {
    let hashes: Vec<Option<String>> = expansion
        .files
        .par_iter()
        .map(|file| known(file).or_else(|| index.hash_file(workspace_root, file, None, stage)))
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
pub fn expand_files_input(workspace_root: String, globs: Vec<String>) -> Result<Vec<String>> {
    let workspace_root = Path::new(&workspace_root);
    Ok(expand_globs(
        workspace_root,
        &globs,
        &Source::fileset_from_disk(workspace_root),
    )?
    .files)
}

#[cfg(test)]
mod tests {
    use super::super::disk_expansion::tests::{expand_files, globs, workspace};
    use super::*;
    use assert_fs::prelude::*;

    #[test]
    fn an_exact_path_changes_the_hash_when_the_file_appears_and_when_it_goes() {
        let temp = workspace();
        let index = IgnoredIndex::new(None);
        let input = globs(&["dist/gen/generated.d.ts"]);

        let before = expand_files(temp.path(), &input).unwrap();
        assert!(before.files.is_empty());
        let hash_before = hash_files(
            temp.path(),
            &before,
            |_| None,
            &index,
            RunStage::ATaskMayHaveWritten,
        );

        temp.child("dist/gen/generated.d.ts")
            .write_str("x")
            .unwrap();
        let after = expand_files(temp.path(), &input).unwrap();
        assert_eq!(after.files, vec!["dist/gen/generated.d.ts"]);
        let hash_after = hash_files(
            temp.path(),
            &after,
            |_| None,
            &index,
            RunStage::ATaskMayHaveWritten,
        );

        assert_ne!(hash_before, hash_after);

        std::fs::remove_file(temp.path().join("dist/gen/generated.d.ts")).unwrap();
        let gone = expand_files(temp.path(), &input).unwrap();
        assert_eq!(
            hash_files(
                temp.path(),
                &gone,
                |_| None,
                &index,
                RunStage::ATaskMayHaveWritten
            ),
            hash_before
        );
    }

    #[test]
    fn a_listed_file_that_is_gone_when_read_is_left_out() {
        let temp = workspace();
        let index = IgnoredIndex::new(None);
        let listed = expand_files(temp.path(), &globs(&["dist/gen/*.js"])).unwrap();
        let with_both = hash_files(
            temp.path(),
            &listed,
            |_| None,
            &index,
            RunStage::ATaskMayHaveWritten,
        );
        std::fs::remove_file(temp.path().join("dist/gen/a.js")).unwrap();
        let without = expand_files(temp.path(), &globs(&["dist/gen/*.js"])).unwrap();
        assert_ne!(
            hash_files(
                temp.path(),
                &listed,
                |_| None,
                &index,
                RunStage::ATaskMayHaveWritten
            ),
            with_both
        );
        assert_eq!(
            hash_files(
                temp.path(),
                &listed,
                |_| None,
                &index,
                RunStage::ATaskMayHaveWritten
            ),
            hash_files(
                temp.path(),
                &without,
                |_| None,
                &index,
                RunStage::ATaskMayHaveWritten
            )
        );
    }

    #[test]
    fn file_map_hash_wins_over_disk() {
        let temp = workspace();
        let index = IgnoredIndex::new(None);
        let expansion = expand_files(temp.path(), &globs(&["dist/gen/a.js"])).unwrap();

        let from_disk = hash_files(
            temp.path(),
            &expansion,
            |_| None,
            &index,
            RunStage::ATaskMayHaveWritten,
        );
        let from_map = hash_files(
            temp.path(),
            &expansion,
            |path| (path == "dist/gen/a.js").then(|| "known".to_string()),
            &index,
            RunStage::ATaskMayHaveWritten,
        );
        assert_ne!(from_disk, from_map);
    }
}
