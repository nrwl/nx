use std::cmp;
use std::path::Path;
use std::thread::available_parallelism;

use rayon::prelude::*;
use tracing::trace;

use crate::native::hasher::hash_file_path;
use crate::native::walker::{NxFile, nx_walker};
use crate::native::workspace::files_archive::{NxFileHashed, NxFileHashes};

pub fn full_files_hash(workspace_root: &Path) -> NxFileHashes {
    let files = nx_walker(workspace_root, true).collect::<Vec<_>>();
    trace!("Found {} files", files.len());
    hash_files(files).into_iter().collect()
}

pub fn selective_files_hash(
    workspace_root: &Path,
    mut archived_files: NxFileHashes,
) -> NxFileHashes {
    let files = nx_walker(workspace_root, true).collect::<Vec<_>>();
    let mut archived = vec![];
    let mut not_archived = vec![];
    let now = std::time::Instant::now();
    // Entries read during the previous gather cannot be trusted on an mtime
    // match alone: where mtime is whole-second (every platform but Windows), a
    // rewrite landing in the same second as the read leaves the timestamp
    // identical and the archived hash silently stale. Re-hash those; they are a
    // handful of files touched during the gather window, not the workspace.
    let gathered_at = archived_files.gathered_at();

    for file in files {
        if let Some(archived_file) = archived_files.remove(&file.normalized_path) {
            if archived_file.1 == file.mod_time && file.mod_time < gathered_at {
                archived.push((file.normalized_path, archived_file));
                continue;
            }
        }
        not_archived.push(file);
    }
    trace!("filtered archive files in {:?}", now.elapsed());

    if not_archived.is_empty() {
        trace!("no additional files to hash");
        return archived.into_iter().collect();
    }

    archived
        .into_iter()
        .chain(hash_files(not_archived))
        .collect()
}

fn hash_files(files: Vec<NxFile>) -> Vec<(String, NxFileHashed)> {
    let num_parallelism = cmp::max(available_parallelism().map_or(2, |n| n.get()) / 3, 2);
    let chunks = files.len() / num_parallelism;

    let now = std::time::Instant::now();
    let files = if cfg!(target_arch = "wasm32") || chunks < num_parallelism {
        trace!("hashing workspace files in parallel");
        files
            .into_par_iter()
            .filter_map(|file| {
                hash_file_path(&file.full_path)
                    .map(|hash| (file.normalized_path, NxFileHashed(hash, file.mod_time)))
            })
            .collect::<Vec<_>>()
    } else {
        trace!(
            "hashing workspace files in {} chunks of {}",
            num_parallelism, chunks
        );
        files
            .par_chunks(chunks)
            .flat_map_iter(|chunks| {
                chunks.iter().filter_map(|file| {
                    hash_file_path(&file.full_path).map(|hash| {
                        (
                            file.normalized_path.clone(),
                            NxFileHashed(hash, file.mod_time),
                        )
                    })
                })
            })
            .collect::<Vec<_>>()
    };

    trace!("hashed workspace files in {:?}", now.elapsed());
    files
}

#[cfg(test)]
mod tests {
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    use crate::native::utils::get_mod_time;
    use crate::native::workspace::files_archive::{NxFileHashed, NxFileHashes};

    fn setup_fs() -> TempDir {
        let temp = TempDir::new().unwrap();
        temp.child("test.txt").write_str("content").unwrap();
        temp.child("modified.txt").write_str("content").unwrap();
        temp.child("foo.txt").write_str("content1").unwrap();
        temp.child("bar.txt").write_str("content2").unwrap();
        temp.child("baz")
            .child("new.txt")
            .write_str("content@qux")
            .unwrap();

        temp
    }

    #[test]
    fn should_selectively_hash_workspace() {
        let temp = setup_fs();
        let archived_files = vec![
            (
                String::from("test.txt"),
                NxFileHashed(
                    String::from("hash1"),
                    get_mod_time(&temp.child("test.txt").metadata().unwrap()),
                ),
            ),
            (
                String::from("foo.txt"),
                NxFileHashed(
                    String::from("hash2"),
                    get_mod_time(&temp.child("foo.txt").metadata().unwrap()),
                ),
            ),
            (
                String::from("bar.txt"),
                NxFileHashed(
                    String::from("hash3"),
                    get_mod_time(&temp.child("bar.txt").metadata().unwrap()),
                ),
            ),
            // this file was modified, so the mod time in the archive should be less than whats on the fs to simulate a write
            (
                String::from("modified.txt"),
                NxFileHashed(
                    String::from("hash4"),
                    get_mod_time(&temp.child("modified.txt").metadata().unwrap()) - 10,
                ),
            ),
            // this file is does not exist on the fs, aka it was deleted
            (
                String::from("baz/qux.txt"),
                NxFileHashed(String::from("hash5"), 0),
            ),
        ]
        .into_iter()
        .collect::<NxFileHashes>()
        // Stamped past every file's mtime so the unmodified entries are eligible
        // for reuse; without a stamp an archive is treated as entirely
        // untrustworthy. See `should_rehash_entries_read_during_the_gather_window`.
        .with_gathered_at(get_mod_time(&temp.child("test.txt").metadata().unwrap()) + 1);

        let hashed_files = super::selective_files_hash(temp.path(), archived_files);
        let mut paths = hashed_files
            .iter()
            .map(|(path, _)| path.as_str())
            .collect::<Vec<_>>();
        paths.sort();
        assert_eq!(
            paths,
            vec![
                "bar.txt",
                "baz/new.txt",
                "foo.txt",
                "modified.txt",
                "test.txt"
            ]
        );

        // Assert the hashes, not just the paths. `selective_files_hash` returns
        // every walked file whether it was reused or re-hashed, so a path-set
        // assertion passes identically either way and cannot fail for the
        // selectivity this test is named after.
        let hash_of = |name: &str| hashed_files.get(name).expect(name).0.clone();
        assert_eq!(hash_of("test.txt"), "hash1", "unmodified: reused");
        assert_eq!(hash_of("foo.txt"), "hash2", "unmodified: reused");
        assert_eq!(hash_of("bar.txt"), "hash3", "unmodified: reused");
        assert_ne!(
            hash_of("modified.txt"),
            "hash4",
            "mtime moved past the archive entry: must be re-hashed"
        );
    }

    #[test]
    fn should_rehash_entries_read_during_the_gather_window() {
        // An entry whose mtime is at or after the gather's own stamp was read
        // while the workspace could still change inside that same mtime tick, so
        // a matching timestamp does not prove the content matches. Reusing the
        // archived hash here is how a rewrite goes missing permanently.
        let temp = TempDir::new().unwrap();
        temp.child("same-tick.txt").write_str("rewritten").unwrap();
        let mod_time = get_mod_time(&temp.child("same-tick.txt").metadata().unwrap());

        let archived = vec![(
            String::from("same-tick.txt"),
            NxFileHashed(String::from("stale-hash"), mod_time),
        )]
        .into_iter()
        .collect::<NxFileHashes>()
        .with_gathered_at(mod_time);

        let hashed = super::selective_files_hash(temp.path(), archived);
        assert_ne!(
            hashed.get("same-tick.txt").unwrap().0,
            "stale-hash",
            "an entry read during the gather window must be re-hashed, not reused"
        );
    }

    #[test]
    fn should_still_reuse_entries_settled_before_the_gather() {
        // The optimization has to survive the fix: an entry that stopped changing
        // before the gather began cannot have been rewritten inside the read's
        // tick, so it is reused without the file being touched. If this breaks,
        // every rescan degrades into a full re-hash of the workspace.
        let temp = TempDir::new().unwrap();
        temp.child("settled.txt").write_str("rewritten").unwrap();
        let mod_time = get_mod_time(&temp.child("settled.txt").metadata().unwrap());

        let archived = vec![(
            String::from("settled.txt"),
            NxFileHashed(String::from("archived-hash"), mod_time),
        )]
        .into_iter()
        .collect::<NxFileHashes>()
        .with_gathered_at(mod_time + 1);

        let hashed = super::selective_files_hash(temp.path(), archived);
        assert_eq!(
            hashed.get("settled.txt").unwrap().0,
            "archived-hash",
            "an entry settled before the gather should still be reused"
        );
    }
}
