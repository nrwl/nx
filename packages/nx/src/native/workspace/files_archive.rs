use anyhow::anyhow;
use hashbrown::HashMap;
use rkyv::{AlignedVec, Archive, Deserialize, Serialize};
use std::io::Write;
use std::ops::{Deref, DerefMut};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

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

/// The archive as written, validated once and read in place. Lookups and
/// iteration borrow straight from the bytes, so loading an archive never
/// materializes the hash map it was serialized from.
pub struct FilesArchive {
    bytes: AlignedVec,
}

impl FilesArchive {
    /// Serializes an owned map into an in-memory archive, for tests.
    #[cfg(test)]
    pub fn from_hashes(files: &NxFileHashes) -> Option<Self> {
        rkyv::to_bytes::<_, 2048>(files)
            .ok()
            .map(|bytes| FilesArchive { bytes })
    }

    fn archived(&self) -> &ArchivedNxFileHashes {
        // The bytes were validated by `check_archived_root` in
        // `read_files_archive`, the only constructor outside tests. The
        // `#[cfg(test)]` `from_hashes` skips validation because its bytes come
        // straight from `to_bytes`, so they are valid by construction.
        unsafe { rkyv::archived_root::<NxFileHashes>(&self.bytes) }
    }

    pub fn len(&self) -> usize {
        self.archived().0.len()
    }

    /// The recorded hash and modification time for a workspace-relative path.
    pub fn get(&self, path: &str) -> Option<(&str, i64)> {
        self.archived()
            .0
            .get(path)
            .map(|hashed| (hashed.0.as_str(), hashed.1))
    }

    /// Every entry as (path, hash, modification time).
    pub fn iter(&self) -> impl Iterator<Item = (&str, &str, i64)> {
        self.archived()
            .0
            .iter()
            .map(|(path, hashed)| (path.as_str(), hashed.0.as_str(), hashed.1))
    }
}

pub fn read_files_archive<P: AsRef<Path>>(cache_dir: P) -> Option<FilesArchive> {
    let now = std::time::Instant::now();
    let archive_path = archive_path(cache_dir);
    if !archive_path.exists() {
        return None;
    }

    let result = std::fs::File::open(&archive_path)
        .map_err(anyhow::Error::from)
        .and_then(|mut file| {
            let mut bytes = AlignedVec::new();
            bytes.extend_from_reader(&mut file)?;
            rkyv::check_archived_root::<NxFileHashes>(&bytes)
                .map_err(|_| anyhow!("invalid archive file"))?;
            Ok(FilesArchive { bytes })
        });

    match result {
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

/// A staging file older than this was left by a writer that died between
/// writing and renaming; a live write takes milliseconds.
const STAGING_ORPHAN_AGE: Duration = Duration::from_secs(600);

/// Removes staging files that no live writer can still own.
fn sweep_orphaned_staging_files(cache_dir: &Path) {
    let Ok(entries) = std::fs::read_dir(cache_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if !name.starts_with(NX_FILES_ARCHIVE) || !name.ends_with(".tmp") {
            continue;
        }
        let orphaned = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|written| SystemTime::now().duration_since(written).ok())
            .is_some_and(|age| age > STAGING_ORPHAN_AGE);
        if orphaned {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

pub fn write_files_archive<P: AsRef<Path>>(cache_dir: P, files: &NxFileHashes) {
    let now = std::time::Instant::now();
    let archive_path = archive_path(&cache_dir);
    sweep_orphaned_staging_files(cache_dir.as_ref());
    // Written beside the archive and renamed into place, so a process that
    // trusts the archive can never read a partial one. The name carries a
    // random part because pids repeat across containers sharing a checkout,
    // and `create_new` refuses to follow anything already at that path.
    let staging_path = archive_path.with_extension(format!(
        "nxt.{}.{:016x}.tmp",
        std::process::id(),
        rand::random::<u64>()
    ));
    let result = rkyv::to_bytes::<_, 2048>(files)
        .map_err(anyhow::Error::from)
        .and_then(|encoded| {
            let mut staging = std::fs::File::options()
                .write(true)
                .create_new(true)
                .open(&staging_path)?;
            staging.write_all(&encoded)?;
            drop(staging);
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

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    fn one_file() -> NxFileHashes {
        [("a.ts".to_string(), NxFileHashed("h".to_string(), 1))]
            .into_iter()
            .collect()
    }

    fn names_in(dir: &Path) -> Vec<String> {
        let mut names: Vec<String> = std::fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().to_string())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn a_write_sweeps_orphaned_staging_files_and_keeps_live_ones() {
        let cache = TempDir::new().unwrap();
        let orphan = cache.child("nx_files.nxt.1.deadbeef.tmp");
        orphan.write_str("x").unwrap();
        std::fs::File::options()
            .write(true)
            .open(orphan.path())
            .unwrap()
            .set_modified(SystemTime::now() - STAGING_ORPHAN_AGE * 2)
            .unwrap();
        let live = cache.child("nx_files.nxt.2.cafebabe.tmp");
        live.write_str("x").unwrap();

        write_files_archive(cache.path(), &one_file());

        assert_eq!(
            names_in(cache.path()),
            vec!["nx_files.nxt", "nx_files.nxt.2.cafebabe.tmp"]
        );
    }

    #[test]
    fn the_staging_file_is_never_reused_across_writes() {
        let cache = TempDir::new().unwrap();
        write_files_archive(cache.path(), &one_file());
        write_files_archive(cache.path(), &one_file());
        assert_eq!(names_in(cache.path()), vec!["nx_files.nxt"]);
        assert_eq!(read_files_archive(cache.path()).unwrap().len(), 1);
    }
}
