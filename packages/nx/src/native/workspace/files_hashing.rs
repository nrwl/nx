use std::cmp;
use std::path::Path;
use std::thread::available_parallelism;

use rayon::prelude::*;
use tracing::trace;

use crate::native::hasher::hash_file_path;
use crate::native::walker::{nx_walker, NxFile};
use crate::native::workspace::files_archive::{NxFileHashed, NxFileHashes};

pub fn full_files_hash(workspace_root: &Path) -> NxFileHashes {
    let files = nx_walker(workspace_root).collect::<Vec<_>>();
    trace!("Found {} files", files.len());
    hash_files(files).into_iter().collect()
}

pub fn selective_files_hash(
    workspace_root: &Path,
    mut archived_files: NxFileHashes,
) -> NxFileHashes {
    let files = nx_walker(workspace_root).collect::<Vec<_>>();
    let mut archived = vec![];
    let mut not_archived = vec![];
    let now = std::time::Instant::now();

    for file in files {
        if let Some(archived_file) = archived_files.remove(&file.normalized_path) {
            if archived_file.1 == file.mod_time {
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
        trace!("hashing workspace files in {} chunks of {}", num_parallelism, chunks);
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
    use assert_fs::prelude::*;
    use assert_fs::TempDir;

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
