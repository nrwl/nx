use anyhow::anyhow;
use hashbrown::HashMap;
use rkyv::{Archive, Deserialize, Infallible, Serialize};
use std::ops::{Deref, DerefMut};
use std::path::Path;

use tracing::trace;

const NX_FILES_ARCHIVE: &str = "nx_files";

fn nx_files_archive_name(nx_version: &str) -> String {
    format!("{}_{}.nxt", NX_FILES_ARCHIVE, nx_version)
}

#[derive(Archive, Serialize, Deserialize, PartialEq, Debug)]
#[archive(check_bytes)]
pub struct NxFileHashed(pub String, pub i64);

#[derive(Archive, Deserialize, Serialize, Debug, PartialEq)]
#[archive(check_bytes)]
pub struct NxFileHashes(HashMap<String, NxFileHashed>);

impl Deref for NxFileHashes {
    type Target = HashMap<String, NxFileHashed>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for NxFileHashes {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl FromIterator<(String, NxFileHashed)> for NxFileHashes {
    fn from_iter<T: IntoIterator<Item = (String, NxFileHashed)>>(iter: T) -> NxFileHashes {
        let mut map = HashMap::with_hasher(Default::default());
        map.extend(iter);
        NxFileHashes(map)
    }
}

pub fn read_files_archive<P: AsRef<Path>>(cache_dir: P, nx_version: &str) -> Option<NxFileHashes> {
    let now = std::time::Instant::now();
    let archive_path = cache_dir.as_ref().join(nx_files_archive_name(nx_version));
    if !archive_path.exists() {
        return None;
    }

    let bytes = std::fs::read(archive_path)
        .map_err(anyhow::Error::from)
        .and_then(|bytes| {
            // let archived = unsafe { rkyv::archived_root::<NxFilesArchive>(&bytes) };
            let archived = rkyv::check_archived_root::<NxFileHashes>(&bytes)
                .map_err(|_| anyhow!("invalid archive file"))?;
            <ArchivedNxFileHashes as Deserialize<NxFileHashes, Infallible>>::deserialize(
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

pub fn write_files_archive<P: AsRef<Path>>(cache_dir: P, files: NxFileHashes, nx_version: &str) {
    let now = std::time::Instant::now();
    let archive_name = nx_files_archive_name(nx_version);
    let archive_path = cache_dir.as_ref().join(&archive_name);
    let archive_path_temp =
        cache_dir
            .as_ref()
            .join(format!("{}.{}", &archive_name, std::process::id()));

    std::fs::create_dir_all(&cache_dir)
        .inspect_err(|e| {
            trace!("Error creating cache directory: {:?}", e);
        })
        .ok();

    let result = rkyv::to_bytes::<_, 2048>(&files)
        .map_err(anyhow::Error::from)
        .and_then(|encoded| {
            std::fs::write(&archive_path_temp, encoded).map_err(|e| {
                anyhow::anyhow!(
                    "Unable to write to {}: {:?}",
                    &archive_path_temp.display(),
                    e
                )
            })
        })
        .and_then(|_| {
            std::fs::rename(&archive_path_temp, &archive_path).map_err(|e| {
                anyhow::anyhow!(
                    "unable to move temp archive file to {}: {:?}",
                    &archive_path.display(),
                    e
                )
            })
        });

    match result {
        Ok(_) => {
            trace!("wrote archive in {:?}", now.elapsed());
        }
        Err(e) => {
            trace!("could not write files archive: {:?}", e);
        }
    }
}
