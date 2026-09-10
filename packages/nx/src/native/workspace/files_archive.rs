use anyhow::anyhow;
use hashbrown::HashMap;
use rkyv::{Archive, Deserialize, Infallible, Serialize};
use std::ops::{Deref, DerefMut};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use tracing::trace;

const NX_FILES_ARCHIVE: &str = "nx_files.nxt";

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

impl IntoIterator for NxFileHashes {
    type Item = (String, NxFileHashed);
    type IntoIter = hashbrown::hash_map::IntoIter<String, NxFileHashed>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}

impl FromIterator<(String, NxFileHashed)> for NxFileHashes {
    fn from_iter<T: IntoIterator<Item = (String, NxFileHashed)>>(iter: T) -> NxFileHashes {
        let mut map = HashMap::with_hasher(Default::default());
        map.extend(iter);
        NxFileHashes(map)
    }
}

pub fn archive_path<P: AsRef<Path>>(cache_dir: P) -> PathBuf {
    cache_dir.as_ref().join(NX_FILES_ARCHIVE)
}

/// When the archive on disk was last written, or `None` when there is none.
pub fn archive_modified_at<P: AsRef<Path>>(cache_dir: P) -> Option<SystemTime> {
    std::fs::metadata(archive_path(cache_dir))
        .and_then(|m| m.modified())
        .ok()
}

pub fn read_files_archive<P: AsRef<Path>>(cache_dir: P) -> Option<NxFileHashes> {
    let now = std::time::Instant::now();
    let archive_path = archive_path(cache_dir);
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

pub fn write_files_archive<P: AsRef<Path>>(cache_dir: P, files: &NxFileHashes) {
    let now = std::time::Instant::now();
    let archive_path = archive_path(cache_dir);
    // Written beside the archive and renamed into place, so a process that
    // trusts the archive can never read a partial one.
    let staging_path = archive_path.with_extension(format!("nxt.{}.tmp", std::process::id()));
    let result = rkyv::to_bytes::<_, 2048>(files)
        .map_err(anyhow::Error::from)
        .and_then(|encoded| {
            std::fs::write(&staging_path, encoded)?;
            std::fs::rename(&staging_path, &archive_path)?;
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
