use std::path::Path;
use std::sync::{Arc, Weak};

use rayon::prelude::*;

use super::files_archive::NxFileHashes;
use crate::native::types::FileData;
use crate::native::utils::{command::create_command, get_metadata_key, get_mod_time};

/// Metadata from the same gather that produced the immutable FileData vector.
/// The keys follow its path order, using eight more bytes per workspace file.
pub(crate) struct RehashFileMap {
    pub(super) commit: String,
    gathered_at: i64,
    keys: Vec<u64>,
}

/// A reader and a file vector cross N-API as separate externals. Only the
/// vector exported alongside this reader contains the hashes we verified.
pub(crate) struct RehashSnapshot {
    map: Arc<RehashFileMap>,
    files: Weak<Vec<FileData>>,
}

impl RehashSnapshot {
    pub(super) fn new(map: Arc<RehashFileMap>, files: &Arc<Vec<FileData>>) -> Self {
        Self {
            map,
            files: Arc::downgrade(files),
        }
    }

    pub(crate) fn proof_for(&self, files: &Arc<Vec<FileData>>) -> Option<&RehashFileMap> {
        std::ptr::eq(self.files.as_ptr(), Arc::as_ptr(files)).then_some(&self.map)
    }
}

impl RehashFileMap {
    pub(super) fn new(commit: String, hashes: &NxFileHashes) -> Arc<Self> {
        let mut keys: Vec<_> = hashes
            .iter()
            .map(|(path, entry)| (Path::new(path), entry.1))
            .collect();
        keys.par_sort_unstable_by_key(|entry| entry.0);
        Arc::new(Self {
            commit,
            gathered_at: hashes.gathered_at(),
            keys: keys.into_iter().map(|(_, key)| key).collect(),
        })
    }

    pub(crate) fn still_matches(&self, index: usize, path: &Path) -> bool {
        std::fs::symlink_metadata(path).is_ok_and(|metadata| {
            metadata.is_file()
                && get_mod_time(&metadata) < self.gathered_at
                && self.keys.get(index) == Some(&get_metadata_key(&metadata))
        })
    }
}

/// Both sides of the gather must observe the same clean commit. Per-file
/// metadata is checked again at reuse, including files Git filters normalize.
pub(super) fn clean_commit(root: &Path) -> Option<String> {
    let git = |args: &[&str]| {
        create_command("git")
            .args(args)
            .current_dir(root)
            .output()
            .ok()
    };
    let head = git(&["rev-parse", "--verify", "HEAD^{commit}"])?;
    if !head.status.success() {
        return None;
    }
    let sha = std::str::from_utf8(&head.stdout).ok()?.trim();
    git(&["diff", "--quiet", "--no-ext-diff", sha, "--"])?
        .status
        .success()
        .then(|| sha.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::workspace::files_archive::NxFileHashed;

    #[test]
    fn a_snapshot_only_vouches_for_its_own_exported_vector() {
        let map = Arc::new(RehashFileMap {
            commit: "head".into(),
            gathered_at: 0,
            keys: vec![],
        });
        let files = Arc::new(Vec::new());
        let snapshot = RehashSnapshot::new(map, &files);
        assert!(snapshot.proof_for(&Arc::clone(&files)).is_some());
        assert!(snapshot.proof_for(&Arc::new(Vec::new())).is_none());
    }

    #[test]
    fn verifies_the_stamp_for_the_same_sorted_file_map_entry() {
        let dir = tempfile::tempdir().unwrap();
        let hashes = ["z", "a"]
            .map(|name| {
                let path = dir.path().join(name);
                std::fs::write(&path, name).unwrap();
                (
                    name.to_owned(),
                    NxFileHashed(String::new(), get_metadata_key(&path.metadata().unwrap())),
                )
            })
            .into_iter()
            .collect::<NxFileHashes>()
            .with_gathered_at(i64::MAX);
        let map = RehashFileMap::new("commit".to_owned(), &hashes);
        let a = dir.path().join("a");
        let z = dir.path().join("z");
        assert!(map.still_matches(0, &a));
        assert!(map.still_matches(1, &z));
        std::fs::write(&a, "changed").unwrap();
        assert!(!map.still_matches(0, &a));
        assert!(map.still_matches(1, &z));
    }

    #[test]
    fn a_batch_charges_shared_live_files_once_and_only_reuses_attested_sources() {
        use crate::native::hasher::hash;
        use crate::native::tasks::hashers::{RehashReadBudget, SettledGroups};
        use crate::native::tasks::types::HashInstruction;
        use crate::native::test_utils::hash_plans;
        use std::collections::HashMap;

        let dir = tempfile::tempdir().unwrap();
        // A shared multiple of the supported platforms' filesystem page sizes.
        const SIZE: usize = 128 * 1024;
        let files = ["output", "source"].map(|name| {
            let path = dir.path().join(name);
            let bytes = vec![name.as_bytes()[0]; SIZE];
            std::fs::write(&path, &bytes).unwrap();
            FileData {
                file: name.into(),
                hash: hash(&bytes),
            }
        });
        let hashes = files
            .iter()
            .map(|file| {
                let stamp = get_metadata_key(&dir.path().join(&file.file).metadata().unwrap());
                (file.file.clone(), NxFileHashed(file.hash.clone(), stamp))
            })
            .collect::<NxFileHashes>()
            .with_gathered_at(i64::MAX);
        let proof = RehashFileMap::new("head".into(), &hashes);
        let sources = HashInstruction::IgnoredFileSet {
            globs: vec!["source".into(), "output".into()].into(),
            project_roots: vec![],
            exact_extension_exclusions: false,
            from_ultracache: true,
        };
        let outputs = HashInstruction::TaskOutput("**/*".into(), vec!["output".into()]);
        let plans = hash_plans(&[
            ("producer", vec![sources.clone()]),
            ("consumer", vec![sources, outputs]),
        ]);
        let run = |trusted: bool, bytes: usize| -> anyhow::Result<Vec<String>> {
            let settled = SettledGroups::new(
                dir.path(),
                &plans,
                &vec![true; plans.pool.len()],
                &HashMap::new(),
                files.iter().enumerate().filter(|_| trusted),
                trusted.then_some(&*proof),
                &RehashReadBudget::new(Some(bytes as f64))?,
            )?;
            Ok(settled
                .groups
                .iter()
                .flatten()
                .map(|ids| settled.files.fold(ids))
                .collect())
        };
        let live = run(false, 2 * SIZE).unwrap();
        assert!(
            run(false, 2 * SIZE - 1)
                .unwrap_err()
                .to_string()
                .contains("NX_REHASH_MEMORY_BUDGET")
        );
        assert_eq!(run(true, SIZE).unwrap(), live);
        assert!(
            run(true, SIZE - 1)
                .unwrap_err()
                .to_string()
                .contains("NX_REHASH_MEMORY_BUDGET")
        );
    }
}
