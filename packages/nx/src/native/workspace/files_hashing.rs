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

/// Selectively hashes workspace files, reusing cached hashes for unchanged files.
///
/// This function has been optimized to:
/// 1. Parallelize the cache lookup phase (checking if files are in archive)
/// 2. Pre-allocate vectors based on expected sizes
/// 3. Minimize HashMap mutations during the hot path
pub fn selective_files_hash(workspace_root: &Path, archived_files: NxFileHashes) -> NxFileHashes {
    let files = nx_walker(workspace_root, true).collect::<Vec<_>>();
    let now = std::time::Instant::now();

    // Phase 1: Parallel lookup to determine which files need hashing
    // Returns (index, is_cached, cached_data) for each file
    // Using par_iter() allows concurrent HashMap lookups which are thread-safe for reads
    let cache_status: Vec<(usize, bool, Option<NxFileHashed>)> = files
        .par_iter()
        .enumerate()
        .map(|(idx, file)| -> (usize, bool, Option<NxFileHashed>) {
            if let Some(archived_file) = archived_files.get(&file.normalized_path) {
                if archived_file.1 == file.mod_time {
                    // File is cached and unchanged - create a new NxFileHashed with same data
                    // NxFileHashed doesn't implement Clone, so we construct it manually
                    let cached = NxFileHashed(archived_file.0.clone(), archived_file.1);
                    return (idx, true, Some(cached));
                }
            }
            // File needs to be hashed (not in cache or modified)
            (idx, false, None)
        })
        .collect();

    // Count cached vs not cached for pre-allocation
    let cached_count = cache_status.iter().filter(|(_, cached, _)| *cached).count();
    let not_cached_count = files.len() - cached_count;

    let mut archived: Vec<(String, NxFileHashed)> = Vec::with_capacity(cached_count);
    let mut not_archived: Vec<NxFile> = Vec::with_capacity(not_cached_count);

    // Phase 2: Sequential distribution (O(n) single pass)
    // Convert to allow ownership transfer
    let mut files_vec: Vec<Option<NxFile>> = files.into_iter().map(Some).collect();

    for (idx, is_cached, cached_data) in cache_status {
        let file = files_vec[idx]
            .take()
            .expect("Each file should only be processed once");

        if is_cached {
            archived.push((file.normalized_path, cached_data.unwrap()));
        } else {
            not_archived.push(file);
        }
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
        .collect::<NxFileHashes>();

        let hashed_files = super::selective_files_hash(temp.path(), archived_files);
        let mut hashed_files = hashed_files
            .iter()
            .map(|(path, _)| path.as_str())
            .collect::<Vec<_>>();
        hashed_files.sort();
        assert_eq!(
            hashed_files,
            vec![
                "bar.txt",
                "baz/new.txt",
                "foo.txt",
                "modified.txt",
                "test.txt"
            ]
        )
    }
}
