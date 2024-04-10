use std::cmp;
use std::ops::{Deref, DerefMut};
use std::path::Path;
use std::thread::available_parallelism;

use anyhow::anyhow;
use hashbrown::HashMap;
use rayon::iter::ParallelIterator;
use rayon::prelude::ParallelSlice;
use rkyv::{Archive, Deserialize, Infallible, Serialize};
use tracing::trace;

use crate::native::hasher::hash_file_path;
use crate::native::walker::{nx_walker, NxFile};

const NX_FILES_ARCHIVE: &str = "nx_files.nxt";

#[derive(Archive, Serialize, Deserialize, PartialEq, Debug)]
#[archive(check_bytes)]
pub struct NxFileArchiveData {
    pub hash: String,
    pub mod_time: i64,
    pub file_size: i64,
}

#[derive(Archive, Deserialize, Serialize, Debug, PartialEq)]
#[archive(check_bytes)]
pub struct NxFileArchive(HashMap<String, NxFileArchiveData>);

impl Deref for NxFileArchive {
    type Target = HashMap<String, NxFileArchiveData>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for NxFileArchive {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl FromIterator<(String, NxFileArchiveData)> for NxFileArchive {
    fn from_iter<T: IntoIterator<Item = (String, NxFileArchiveData)>>(iter: T) -> NxFileArchive {
        let mut map = HashMap::with_hasher(Default::default());
        map.extend(iter);
        NxFileArchive(map)
    }
}

pub fn read_files_archive<P: AsRef<Path>>(cache_dir: P) -> Option<NxFileArchive> {
    let now = std::time::Instant::now();
    let archive_path = cache_dir.as_ref().join(NX_FILES_ARCHIVE);
    if !archive_path.exists() {
        return None;
    }

    let bytes = std::fs::read(archive_path)
        .map_err(anyhow::Error::from)
        .and_then(|bytes| {
            // let archived = unsafe { rkyv::archived_root::<NxFilesArchive>(&bytes) };
            let archived = rkyv::check_archived_root::<NxFileArchive>(&bytes)
                .map_err(|_| anyhow!("invalid archive file"))?;
            <ArchivedNxFileArchive as Deserialize<NxFileArchive, Infallible>>::deserialize(
                archived,
                &mut rkyv::Infallible,
            )
            .map_err(anyhow::Error::from)
        });

    match bytes {
        Ok(archive) => {
            trace!("read archive in {:?}", now.elapsed());
            Some(archive)
        }
        Err(e) => {
            trace!("could not read files archive: {:?}", e);
            None
        }
    }
}

pub fn write_files_archive<P: AsRef<Path>>(cache_dir: P, files: NxFileArchive) {
    let now = std::time::Instant::now();
    let archive_path = cache_dir.as_ref().join(NX_FILES_ARCHIVE);
    let result = rkyv::to_bytes::<_, 2048>(&files)
        .map_err(anyhow::Error::from)
        .and_then(|encoded| {
            std::fs::write(archive_path, encoded)?;
            Ok(())
        });

    match result {
        Ok(_) => {
            trace!("write archive in {:?}", now.elapsed());
        }
        Err(e) => {
            trace!("could not write files archive: {:?}", e);
        }
    }
}

pub fn create_file_archive(workspace_root: &Path) -> NxFileArchive {
    let files = nx_walker(workspace_root).collect::<Vec<_>>();
    create_file_archive_data(files).into_iter().collect()
}

pub fn update_file_archive(
    workspace_root: &Path,
    mut archived_files: NxFileArchive,
) -> NxFileArchive {
    let files = nx_walker(workspace_root).collect::<Vec<_>>();
    let mut archived = vec![];
    let mut not_archived = vec![];
    let now = std::time::Instant::now();

    for file in files {
        if let Some(archived_file) = archived_files.remove(&file.normalized_path) {
            if archived_file.mod_time == file.mod_time {
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
        .chain(create_file_archive_data(not_archived))
        .collect()
}

fn create_file_archive_data(files: Vec<NxFile>) -> Vec<(String, NxFileArchiveData)> {
    let num_parallelism = cmp::max(available_parallelism().map_or(2, |n| n.get()) / 3, 2);
    let chunks = files.len() / num_parallelism;

    let now = std::time::Instant::now();
    let files = if chunks < num_parallelism {
        files
            .into_iter()
            .filter_map(|file| {
                hash_file_path(&file.full_path).map(|hash| {
                    (
                        file.normalized_path,
                        NxFileArchiveData {
                            hash,
                            mod_time: file.mod_time,
                            file_size: file.file_size as i64,
                        },
                    )
                })
            })
            .collect::<Vec<_>>()
    } else {
        files
            .par_chunks(chunks)
            .flat_map_iter(|chunks| {
                chunks.iter().filter_map(|file| {
                    hash_file_path(&file.full_path).map(|hash| {
                        (
                            file.normalized_path.clone(),
                            NxFileArchiveData {
                                hash,
                                mod_time: file.mod_time,
                                file_size: file.file_size as i64,
                            },
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
    use crate::native::workspace::files_archive::{NxFileArchive, NxFileArchiveData};

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
    fn test_update_file_archive() {
        let temp = setup_fs();
        let archived_files = vec![
            (
                String::from("test.txt"),
                NxFileArchiveData {
                    hash: String::from("hash1"),
                    mod_time: get_mod_time(&temp.child("test.txt").metadata().unwrap()),
                    file_size: 0,
                },
            ),
            (
                String::from("foo.txt"),
                NxFileArchiveData {
                    hash: String::from("hash2"),
                    mod_time: get_mod_time(&temp.child("foo.txt").metadata().unwrap()),
                    file_size: 0,
                },
            ),
            (
                String::from("bar.txt"),
                NxFileArchiveData {
                    hash: String::from("hash3"),
                    mod_time: get_mod_time(&temp.child("bar.txt").metadata().unwrap()),
                    file_size: 0,
                },
            ),
            // this file was modified, so the mod time in the archive should be less than whats on the fs to simulate a write
            (
                String::from("modified.txt"),
                NxFileArchiveData {
                    hash: String::from("hash4"),
                    mod_time: get_mod_time(&temp.child("modified.txt").metadata().unwrap()) - 10,
                    file_size: 0,
                },
            ),
            // this file does not exist on the fs, aka it was deleted
            (
                String::from("baz/qux.txt"),
                NxFileArchiveData {
                    hash: String::from("hash5"),
                    mod_time: 0,
                    file_size: 0,
                },
            ),
        ]
        .into_iter()
        .collect::<NxFileArchive>();

        let hashed_files = super::update_file_archive(temp.path(), archived_files);
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
