use std::cmp;
use std::thread::available_parallelism;

use rayon::prelude::*;
use tracing::trace;

use crate::native::hasher::hash_file_path;
use crate::native::walker::NxFile;
use crate::native::workspace::files_archive::{FilesArchive, NxFileHashed, NxFileHashes};

pub fn full_files_hash(files: Vec<NxFile>) -> NxFileHashes {
    trace!("Found {} files", files.len());
    hash_files(files).into_iter().collect()
}

pub fn selective_files_hash(files: Vec<NxFile>, archived_files: &FilesArchive) -> NxFileHashes {
    let mut archived = vec![];
    let mut not_archived = vec![];
    let now = std::time::Instant::now();
    // Entries read during the previous gather cannot be trusted on an mtime
    // match alone. get_mod_time reports whole seconds on unix (st_mtime/mtime(),
    // regardless of filesystem — the sub-second field is discarded) and the
    // ~15.6ms system tick on Windows, so a rewrite inside that window leaves the
    // timestamp identical and the archived hash silently stale. Re-hash those;
    // they are a handful of files touched during the gather window, not the
    // workspace. A symlink's own mtime and its target's are compared apart:
    // both have to match, and both have to predate the gather.
    let gathered_at = archived_files.gathered_at();

    for file in files {
        if let Some((hash, mod_time, target_mod_time)) = archived_files.get(&file.normalized_path) {
            if mod_time == file.mod_time
                && target_mod_time == file.target_mod_time
                && mod_time < gathered_at
                && target_mod_time < gathered_at
            {
                archived.push((
                    file.normalized_path,
                    NxFileHashed(hash.to_owned(), mod_time, target_mod_time),
                ));
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
                hash_file_path(&file.full_path).map(|hash| {
                    (
                        file.normalized_path,
                        NxFileHashed(hash, file.mod_time, file.target_mod_time),
                    )
                })
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
                            NxFileHashed(hash, file.mod_time, file.target_mod_time),
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
    use crate::native::walker::nx_walker;
    use crate::native::workspace::files_archive::{FilesArchive, NxFileHashed, NxFileHashes};

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
                    0,
                ),
            ),
            (
                String::from("foo.txt"),
                NxFileHashed(
                    String::from("hash2"),
                    get_mod_time(&temp.child("foo.txt").metadata().unwrap()),
                    0,
                ),
            ),
            (
                String::from("bar.txt"),
                NxFileHashed(
                    String::from("hash3"),
                    get_mod_time(&temp.child("bar.txt").metadata().unwrap()),
                    0,
                ),
            ),
            // this file was modified, so the mod time in the archive should be less than whats on the fs to simulate a write
            (
                String::from("modified.txt"),
                NxFileHashed(
                    String::from("hash4"),
                    get_mod_time(&temp.child("modified.txt").metadata().unwrap()) - 10,
                    0,
                ),
            ),
            // this file is does not exist on the fs, aka it was deleted
            (
                String::from("baz/qux.txt"),
                NxFileHashed(String::from("hash5"), 0, 0),
            ),
        ]
        .into_iter()
        .collect::<NxFileHashes>()
        // Stamped past every file's mtime so the unmodified entries are eligible
        // for reuse; without a stamp an archive is treated as entirely
        // untrustworthy. See `should_rehash_entries_read_during_the_gather_window`.
        .with_gathered_at(get_mod_time(&temp.child("test.txt").metadata().unwrap()) + 1);

        let archived_files = FilesArchive::from_hashes(&archived_files).unwrap();
        let hashed_files =
            super::selective_files_hash(nx_walker(temp.path(), true).collect(), &archived_files);
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
            NxFileHashed(String::from("stale-hash"), mod_time, 0),
        )]
        .into_iter()
        .collect::<NxFileHashes>()
        .with_gathered_at(mod_time);
        let archived = FilesArchive::from_hashes(&archived).unwrap();

        let hashed = super::selective_files_hash(nx_walker(temp.path(), true).collect(), &archived);
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
            NxFileHashed(String::from("archived-hash"), mod_time, 0),
        )]
        .into_iter()
        .collect::<NxFileHashes>()
        .with_gathered_at(mod_time + 1);
        let archived = FilesArchive::from_hashes(&archived).unwrap();

        let hashed = super::selective_files_hash(nx_walker(temp.path(), true).collect(), &archived);
        assert_eq!(
            hashed.get("settled.txt").unwrap().0,
            "archived-hash",
            "an entry settled before the gather should still be reused"
        );
    }

    #[cfg(unix)]
    #[test]
    fn should_rehash_a_symlink_when_its_target_is_edited() {
        // Editing the file a symlink points at has to miss the archive. The
        // link's own mtime does not move, which is what used to replay the
        // stored hash until `.nx/workspace-data` was cleared.
        use std::time::{Duration, UNIX_EPOCH};

        use crate::native::hasher::hash;

        let temp = TempDir::new().unwrap();
        temp.child("target.txt").write_str("one").unwrap();
        std::os::unix::fs::symlink("target.txt", temp.path().join("link.txt")).unwrap();

        let hashed = super::full_files_hash(nx_walker(temp.path(), true).collect());
        let entry = hashed.get("link.txt").expect("link.txt");
        // Past both stamps. The target can be newer than the link, and either
        // one at or after the gather refuses reuse.
        let stamp = entry.1.max(entry.2);
        let archived = FilesArchive::from_hashes(&hashed.with_gathered_at(stamp + 1)).unwrap();

        let unchanged =
            super::selective_files_hash(nx_walker(temp.path(), true).collect(), &archived);
        assert_eq!(
            unchanged.get("link.txt").unwrap().0,
            hash(b"one"),
            "an unchanged symlink target should still be reused"
        );

        temp.child("target.txt").write_str("two").unwrap();
        // get_mod_time reports whole seconds, so a rewrite in the original
        // second does not move the stamp. Put the target in a later second.
        std::fs::OpenOptions::new()
            .write(true)
            .open(temp.child("target.txt").path())
            .unwrap()
            .set_modified(UNIX_EPOCH + Duration::from_secs((stamp + 10) as u64))
            .unwrap();

        let edited = super::selective_files_hash(nx_walker(temp.path(), true).collect(), &archived);
        assert_eq!(
            edited.get("link.txt").unwrap().0,
            hash(b"two"),
            "editing a symlink target must re-hash the link"
        );
    }

    #[cfg(unix)]
    #[test]
    fn should_rehash_a_staged_symlink_replacement_that_shares_its_target_mtime() {
        // link mtime 10, staged replacement 11, both targets 12, gather at 13.
        // The later of each pair is 12 before and after the rename, so one
        // stamp would reuse the archived hash.
        use std::os::unix::fs::symlink;

        use crate::native::hasher::hash;

        fn stamp(path: &std::path::Path, secs: i64) {
            use nix::fcntl::AT_FDCWD;
            use nix::sys::stat::{UtimensatFlags, utimensat};
            use nix::sys::time::TimeSpec;

            let spec = TimeSpec::new(secs, 0);
            utimensat(
                AT_FDCWD,
                path,
                &spec,
                &spec,
                UtimensatFlags::NoFollowSymlink,
            )
            .unwrap();
        }

        fn link_times(root: &std::path::Path) -> (i64, i64) {
            let link = nx_walker(root, true)
                .find(|file| file.normalized_path == "link.txt")
                .expect("link.txt");
            (link.mod_time, link.target_mod_time)
        }

        fn archived(link_time: i64, target_time: i64, gathered_at: i64) -> FilesArchive {
            let hashes = vec![(
                String::from("link.txt"),
                NxFileHashed(String::from("sentinel"), link_time, target_time),
            )]
            .into_iter()
            .collect::<NxFileHashes>()
            .with_gathered_at(gathered_at);
            FilesArchive::from_hashes(&hashes).unwrap()
        }

        let temp = TempDir::new().unwrap();
        let previous = temp.child("previous.txt");
        previous.write_str("one").unwrap();
        stamp(previous.path(), 12);
        let link = temp.path().join("link.txt");
        symlink("previous.txt", &link).unwrap();
        stamp(&link, 10);

        assert_eq!(link_times(temp.path()), (10, 12));
        let reusable = archived(10, 12, 13);
        let unchanged =
            super::selective_files_hash(nx_walker(temp.path(), true).collect(), &reusable);
        assert_eq!(
            unchanged.get("link.txt").unwrap().0,
            "sentinel",
            "an unchanged symlink should still be reused"
        );

        // Target mtime equals the gather stamp, so it does not predate it.
        // The link mtime alone would still be eligible.
        let during_gather = archived(10, 12, 12);
        let guarded =
            super::selective_files_hash(nx_walker(temp.path(), true).collect(), &during_gather);
        assert_eq!(
            guarded.get("link.txt").unwrap().0,
            hash(b"one"),
            "a target mtime that does not predate the gather must be re-hashed"
        );

        let replacement = temp.child("replacement.txt");
        replacement.write_str("two").unwrap();
        stamp(replacement.path(), 12);
        let staged = temp.path().join("link.txt.next");
        symlink("replacement.txt", &staged).unwrap();
        stamp(&staged, 11);
        std::fs::rename(&staged, &link).unwrap();

        assert_eq!(link_times(temp.path()), (11, 12));
        let replaced =
            super::selective_files_hash(nx_walker(temp.path(), true).collect(), &reusable);
        assert_eq!(
            replaced.get("link.txt").unwrap().0,
            hash(b"two"),
            "a staged symlink replacement must be re-hashed"
        );
    }
}
