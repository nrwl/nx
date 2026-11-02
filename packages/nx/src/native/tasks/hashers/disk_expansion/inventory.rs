use std::sync::{Arc, OnceLock};

use dashmap::DashMap;

use crate::native::walker::PathPredicate;

/// Directory discovery shared by the distinct filesets in one hash call.
/// Keep the unfiltered listing: each fileset applies its own positive globs,
/// negations and project scope. Drop this with the batch so the next call
/// discovers newly generated or deleted files, even without a watcher.
#[derive(Default)]
pub(crate) struct DirectoryInventory {
    directories: DashMap<String, Arc<OnceLock<Option<Vec<String>>>>>,
}

impl DirectoryInventory {
    pub(crate) fn files_under(
        &self,
        dir: &str,
        accept: PathPredicate,
        read: impl FnOnce() -> Option<Vec<String>>,
    ) -> Option<Vec<String>> {
        // Release the map lock before walking. OnceLock also prevents concurrent
        // filesets from starting independent walks of the same directory.
        let listing = Arc::clone(self.directories.entry(dir.to_string()).or_default().value());
        listing
            .get_or_init(read)
            .as_ref()
            .map(|files| files.iter().filter(|path| accept(path)).cloned().collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::hashers::disk_expansion::{
        Source, expand_globs,
        tests::{globs, workspace},
    };
    use crate::native::tasks::hashers::hash_files;
    use crate::native::walker::read_directory;
    use crate::native::workspace::ignored_index::{IgnoredIndex, RunStage};
    use assert_fs::prelude::*;
    use rayon::prelude::*;
    use std::path::Path;
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn compare(
        root: &Path,
        groups: &[Vec<String>],
        roots: &[String],
        index: &IgnoredIndex,
    ) -> Vec<(String, Vec<String>)> {
        let inventory = DirectoryInventory::default();
        let reads = AtomicUsize::new(0);
        let source = Source::fileset(&|_| false, |dir, accept, _skip| {
            inventory.files_under(dir, accept, || {
                reads.fetch_add(1, Ordering::Relaxed);
                index.files_under(root, dir, false, &|_| true, &[])
            })
        });
        let result: Vec<_> = groups
            .par_iter()
            .map(|group| {
                let before =
                    expand_globs(root, group, roots, &Source::fileset_from_disk(root)).unwrap();
                let after = expand_globs(root, group, roots, &source).unwrap();
                assert_eq!(before.files, after.files);
                let hash = |expansion| {
                    hash_files(
                        root,
                        expansion,
                        |_| None,
                        index,
                        RunStage::ATaskMayHaveWritten,
                    )
                };
                assert_eq!(hash(&before), hash(&after));
                (hash(&after), after.files)
            })
            .collect();
        assert_eq!(reads.load(Ordering::Relaxed), inventory.directories.len());
        result
    }

    #[test]
    fn shared_inventory_keeps_per_group_patterns_scopes_and_hashes() {
        let temp = workspace();
        temp.child(".gitignore").write_str("dist/\n").unwrap();
        temp.child(".nxignore").write_str("dist/other/\n").unwrap();
        let groups = [
            globs(&["dist/**", "!dist/gen/nested/**"]),
            globs(&["dist/**", "!dist/other/**"]),
            globs(&["dist/gen/**", "!dist/gen/**/*.map"]),
            globs(&["dist/gen/nested/**", "dist/other/**"]),
            globs(&["dist/gen", "!dist/gen/a.js"]),
            globs(&["node_modules/**", "dist/absent/**"]),
            globs(&["**/*.js", "!**/other/**"]),
            globs(&["{dist/gen,dist/other}/**/*.js"]),
        ];
        let index = IgnoredIndex::new(None);
        let results = compare(temp.path(), &groups, &[], &index);
        assert!(results[0].1.contains(&"dist/other/c.js".to_string()));
        assert!(results[1].1.contains(&"dist/gen/nested/b.js".to_string()));
        let scoped = compare(
            temp.path(),
            &groups,
            &globs(&["dist", "dist/gen/nested"]),
            &index,
        );
        assert!(!scoped[1].1.contains(&"dist/gen/nested/b.js".to_string()));
    }

    #[test]
    fn concurrent_requests_discover_each_root_once() {
        let temp = workspace();
        let inventory = DirectoryInventory::default();
        let reads = AtomicUsize::new(0);
        (0..100).into_par_iter().for_each(|i| {
            let dir = if i % 2 == 0 { "dist/gen" } else { "dist/other" };
            let files = inventory
                .files_under(dir, &|p| p.ends_with(".js"), || {
                    reads.fetch_add(1, Ordering::Relaxed);
                    read_directory(temp.path(), dir, &|_| true, &[])
                })
                .unwrap();
            assert_eq!(files.len(), if i % 2 == 0 { 2 } else { 1 });
        });
        assert_eq!(reads.load(Ordering::Relaxed), 2);
    }

    #[test]
    fn new_batches_discover_creates_deletes_and_same_size_rewrites() {
        let temp = workspace();
        let index = IgnoredIndex::new(None);
        let groups = [globs(&["dist/gen/**"]), globs(&["dist/gen/**/*.js"])];
        let before = compare(temp.path(), &groups, &[], &index);
        temp.child("dist/gen/a.js").write_str("z").unwrap();
        let modified = compare(temp.path(), &groups, &[], &index);
        assert_eq!(before[0].1, modified[0].1);
        assert_ne!(before[0].0, modified[0].0);
        temp.child("dist/gen/new.js").write_str("new").unwrap();
        std::fs::remove_file(temp.path().join("dist/gen/nested/b.js")).unwrap();
        let changed = compare(temp.path(), &groups, &[], &index);
        assert!(changed[1].1.contains(&"dist/gen/new.js".to_string()));
        assert!(!changed[1].1.contains(&"dist/gen/nested/b.js".to_string()));
        assert_ne!(modified[1].0, changed[1].0);
    }

    #[cfg(unix)]
    #[test]
    fn shared_inventory_keeps_link_and_missing_directory_semantics() {
        let temp = workspace();
        let outside = assert_fs::TempDir::new().unwrap();
        outside.child("file.js").write_str("outside").unwrap();
        std::os::unix::fs::symlink(outside.path(), temp.path().join("dist/link")).unwrap();
        std::os::unix::fs::symlink(
            outside.path().join("file.js"),
            temp.path().join("dist/file.js"),
        )
        .unwrap();
        std::os::unix::fs::symlink(
            outside.path().join("absent"),
            temp.path().join("dist/broken"),
        )
        .unwrap();
        let groups = [
            globs(&["dist/**"]),
            globs(&["dist/**", "!dist/gen/**"]),
            globs(&["dist/link/**"]),
            globs(&["dist/link", "dist/broken", "dist/missing/**"]),
        ];
        compare(temp.path(), &groups, &[], &IgnoredIndex::new(None));
        let inventory = DirectoryInventory::default();
        assert_eq!(
            inventory.files_under("absent", &|_| true, || read_directory(
                temp.path(),
                "absent",
                &|_| true,
                &[]
            )),
            None
        );
    }
}
