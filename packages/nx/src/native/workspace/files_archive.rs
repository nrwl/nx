use anyhow::anyhow;
use hashbrown::HashMap;
use rkyv::{Archive, Deserialize, Infallible, Serialize};
use std::ops::{Deref, DerefMut};
use std::path::Path;

use tracing::trace;

const NX_FILES_ARCHIVE: &str = "nx_files.nxt";

#[derive(Archive, Serialize, Deserialize, PartialEq, Debug)]
#[archive(check_bytes)]
pub struct NxFileHashed(pub String, pub i64);

#[derive(Archive, Deserialize, Serialize, Debug, PartialEq)]
#[archive(check_bytes)]
pub struct NxFilesArchive(HashMap<String, NxFileHashed>);

impl Deref for NxFilesArchive {
    type Target = HashMap<String, NxFileHashed>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for NxFilesArchive {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl FromIterator<(String, NxFileHashed)> for NxFilesArchive {
    fn from_iter<T: IntoIterator<Item = (String, NxFileHashed)>>(iter: T) -> NxFilesArchive {
        let mut map = HashMap::with_hasher(Default::default());
        map.extend(iter);
        NxFilesArchive(map)
    }
}

pub fn read_files_archive<P: AsRef<Path>>(cache_dir: P) -> Option<NxFilesArchive> {
    let now = std::time::Instant::now();
    let archive_path = cache_dir.as_ref().join(NX_FILES_ARCHIVE);
    if !archive_path.exists() {
        return None;
    }

    let bytes = std::fs::read(archive_path)
        .map_err(anyhow::Error::from)
        .and_then(|bytes| {
            // let archived = unsafe { rkyv::archived_root::<NxFilesArchive>(&bytes) };
            let archived = rkyv::check_archived_root::<NxFilesArchive>(&bytes)
                .map_err(|_| anyhow!("invalid archive file"))?;
            <ArchivedNxFilesArchive as Deserialize<NxFilesArchive, Infallible>>::deserialize(
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

pub fn write_files_archive<P: AsRef<Path>>(cache_dir: P, files: NxFilesArchive) {
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
