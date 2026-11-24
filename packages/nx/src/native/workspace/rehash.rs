use std::path::Path;
use std::sync::Arc;

use rayon::prelude::*;

use super::files_archive::NxFileHashes;
use crate::native::utils::{command::create_command, get_metadata_key, get_mod_time};

/// Metadata from the same gather that produced the immutable FileData vector.
/// The keys follow its path order, using eight more bytes per workspace file.
pub(crate) struct RehashFileMap {
    pub(super) commit: String,
    gathered_at: i64,
    keys: Vec<u64>,
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
}
