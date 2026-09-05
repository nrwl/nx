use anyhow::anyhow;
use hashbrown::HashMap;
use rkyv::{Archive, Deserialize, Infallible, Serialize};
use std::ops::{Deref, DerefMut};
use std::path::Path;

use tracing::trace;

// v2 carries `gathered_at`. The filename is the format key: rkyv's layout check
// does reject a v1 buffer, but relying on that makes the break implicit and
// leaves "what if it validated anyway?" to be argued rather than answered.
const NX_FILES_ARCHIVE: &str = "nx_files_v2.nxt";

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

#[cfg(test)]
mod tests {
    use super::*;
    use rkyv::Archive as RkyvArchive;

    /// The shape `NxFileHashes` had before it carried `gathered_at`.
    #[derive(RkyvArchive, Serialize)]
    #[archive(check_bytes)]
    struct LegacyNxFileHashes(HashMap<String, NxFileHashed>);

    #[test]
    fn an_archive_in_the_pre_gathered_at_format_is_rejected_not_misread() {
        // Adding `gathered_at` changed the archived layout. If a stale archive
        // could be read as the new shape, every hash in it would be trusted
        // against a garbage timestamp — silently wrong hashes for the whole
        // workspace. It must fail the check and force a full re-hash instead.
        let dir = tempfile::tempdir().expect("tempdir");
        let mut legacy = HashMap::with_hasher(Default::default());
        legacy.insert(
            String::from("a.ts"),
            NxFileHashed(String::from("hash-a"), 1234),
        );
        let bytes = rkyv::to_bytes::<_, 2048>(&LegacyNxFileHashes(legacy)).expect("serialize");
        std::fs::write(dir.path().join(NX_FILES_ARCHIVE), &bytes).expect("write legacy archive");

        assert!(
            read_files_archive(dir.path()).is_none(),
            "a pre-gathered_at archive must be rejected, not deserialized as the new shape"
        );
    }

    #[test]
    fn a_current_format_archive_round_trips_with_its_stamp() {
        let dir = tempfile::tempdir().expect("tempdir");
        let hashes: NxFileHashes = vec![(
            String::from("a.ts"),
            NxFileHashed(String::from("hash-a"), 1234),
        )]
        .into_iter()
        .collect::<NxFileHashes>()
        .with_gathered_at(9999);

        write_files_archive(dir.path(), hashes);
        let read = read_files_archive(dir.path()).expect("current-format archive should read back");
        assert_eq!(read.gathered_at(), 9999);
        assert_eq!(read.get("a.ts").expect("entry").0, "hash-a");
    }
}
