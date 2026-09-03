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
pub struct NxFileHashes {
    files: HashMap<String, NxFileHashed>,
    /// The value `gather_stamp()` returned when the gather that wrote this
    /// archive began. An entry whose mtime is at or after it was read while the
    /// workspace could still change within the same mtime tick, so its hash may
    /// already be stale and must not be reused. See `selective_files_hash`.
    gathered_at: i64,
}

impl NxFileHashes {
    pub fn gathered_at(&self) -> i64 {
        self.gathered_at
    }

    pub fn with_gathered_at(mut self, gathered_at: i64) -> Self {
        self.gathered_at = gathered_at;
        self
    }
}

impl Deref for NxFileHashes {
    type Target = HashMap<String, NxFileHashed>;

    fn deref(&self) -> &Self::Target {
        &self.files
    }
}

impl DerefMut for NxFileHashes {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.files
    }
}

impl FromIterator<(String, NxFileHashed)> for NxFileHashes {
    fn from_iter<T: IntoIterator<Item = (String, NxFileHashed)>>(iter: T) -> NxFileHashes {
        let mut map = HashMap::with_hasher(Default::default());
        map.extend(iter);
        // 0 makes every entry ambiguous until a gather stamps it, so a hash is
        // never reused on the strength of an unset timestamp.
        NxFileHashes {
            files: map,
            gathered_at: 0,
        }
    }
}

pub fn read_files_archive<P: AsRef<Path>>(cache_dir: P) -> Option<NxFileHashes> {
    let now = std::time::Instant::now();
    let archive_path = cache_dir.as_ref().join(NX_FILES_ARCHIVE);
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

pub fn write_files_archive<P: AsRef<Path>>(cache_dir: P, files: NxFileHashes) {
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
