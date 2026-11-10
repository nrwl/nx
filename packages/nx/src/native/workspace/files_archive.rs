use anyhow::anyhow;
use hashbrown::HashMap;
use rkyv::{AlignedVec, Archive, Deserialize, Serialize};
use std::io::Write;
use std::ops::{Deref, DerefMut};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

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

impl IntoIterator for NxFileHashes {
    type Item = (String, NxFileHashed);
    type IntoIter = hashbrown::hash_map::IntoIter<String, NxFileHashed>;

    fn into_iter(self) -> Self::IntoIter {
        self.files.into_iter()
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
        self.archived().files.len()
    }

    /// The recorded hash and modification time for a workspace-relative path.
    pub fn get(&self, path: &str) -> Option<(&str, i64)> {
        self.archived()
            .files
            .get(path)
            .map(|hashed| (hashed.0.as_str(), hashed.1))
    }

    /// The stamp the gather that wrote this archive began at. See
    /// `NxFileHashes::gathered_at` and `selective_files_hash`.
    pub fn gathered_at(&self) -> i64 {
        self.archived().gathered_at
    }

    /// Every entry as (path, hash, modification time).
    pub fn iter(&self) -> impl Iterator<Item = (&str, &str, i64)> {
        self.archived()
            .files
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
        if !orphaned {
            continue;
        }
        if let Err(e) = std::fs::remove_file(entry.path()) {
            trace!(
                "could not remove the orphaned staging file {}: {e:?}",
                entry.path().display()
            );
        }
    }
}

/// Where a write stages its bytes before the rename. The random part keeps
/// two writers apart even when their pids collide, as they can across
/// containers sharing one checkout.
fn staging_path(archive_path: &Path) -> PathBuf {
    archive_path.with_extension(format!(
        "nxt.{}.{:016x}.tmp",
        std::process::id(),
        rand::random::<u64>()
    ))
}

/// Encodes `files` into `staging_path`, then renames it over `archive_path`.
/// The staging file is opened with `create_new`, so anything already at that
/// path, planted or left behind, is refused rather than written through.
/// `staging_path` stays a parameter, though the caller always derives it from
/// `archive_path`, because that refusal can only be tested through a path the
/// test chose.
fn write_files_archive_at(
    archive_path: &Path,
    staging_path: &Path,
    files: &NxFileHashes,
) -> anyhow::Result<()> {
    let encoded = rkyv::to_bytes::<_, 2048>(files)?;
    let mut staging = std::fs::File::options()
        .write(true)
        .create_new(true)
        .open(staging_path)?;
    staging.write_all(&encoded)?;
    drop(staging);
    std::fs::rename(staging_path, archive_path)?;
    Ok(())
}

pub fn write_files_archive<P: AsRef<Path>>(cache_dir: P, files: &NxFileHashes) {
    let now = std::time::Instant::now();
    let archive_path = archive_path(&cache_dir);
    sweep_orphaned_staging_files(cache_dir.as_ref());
    // Written beside the archive and renamed into place, so a process that
    // trusts the archive can never read a partial one.
    match write_files_archive_at(&archive_path, &staging_path(&archive_path), files) {
        Ok(()) => trace!("write archive in {:?}", now.elapsed()),
        Err(e) => trace!("could not write files archive: {:?}", e),
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
        let orphan = cache.child("nx_files_v2.nxt.1.deadbeef.tmp");
        orphan.write_str("x").unwrap();
        std::fs::File::options()
            .write(true)
            .open(orphan.path())
            .unwrap()
            .set_modified(SystemTime::now() - STAGING_ORPHAN_AGE * 2)
            .unwrap();
        let live = cache.child("nx_files_v2.nxt.2.cafebabe.tmp");
        live.write_str("x").unwrap();
        // Old neighbours that are not staging files stay, whatever their age.
        for name in ["other.tmp", "nx_files_v2.nxt.bak"] {
            let neighbour = cache.child(name);
            neighbour.write_str("x").unwrap();
            std::fs::File::options()
                .write(true)
                .open(neighbour.path())
                .unwrap()
                .set_modified(SystemTime::now() - STAGING_ORPHAN_AGE * 2)
                .unwrap();
        }

        write_files_archive(cache.path(), &one_file());

        assert_eq!(
            names_in(cache.path()),
            vec![
                "nx_files_v2.nxt",
                "nx_files_v2.nxt.2.cafebabe.tmp",
                "nx_files_v2.nxt.bak",
                "other.tmp"
            ]
        );
    }

    #[test]
    fn a_second_write_replaces_the_archive_and_leaves_no_staging_file() {
        let cache = TempDir::new().unwrap();
        write_files_archive(cache.path(), &one_file());
        let two_files: NxFileHashes = [
            ("a.ts".to_string(), NxFileHashed("h".to_string(), 1)),
            ("b.ts".to_string(), NxFileHashed("i".to_string(), 2)),
        ]
        .into_iter()
        .collect();
        write_files_archive(cache.path(), &two_files);
        assert_eq!(names_in(cache.path()), vec!["nx_files_v2.nxt"]);
        assert_eq!(read_files_archive(cache.path()).unwrap().len(), 2);
    }

    #[test]
    fn staging_paths_differ_between_writes_of_one_process() {
        let archive = Path::new("/cache/nx_files_v2.nxt");
        let first = staging_path(archive);
        let second = staging_path(archive);
        assert_ne!(first, second);
        for path in [&first, &second] {
            let name = path.file_name().unwrap().to_string_lossy();
            assert!(
                name.starts_with("nx_files_v2.nxt.") && name.ends_with(".tmp"),
                "{name}"
            );
            assert_eq!(path.parent(), archive.parent());
        }
    }

    #[test]
    fn a_write_refuses_a_staging_path_something_already_occupies() {
        let cache = TempDir::new().unwrap();
        let archive = archive_path(cache.path());
        let planted = cache.child("nx_files_v2.nxt.7.0000000000000001.tmp");
        planted.write_str("planted").unwrap();

        let err = write_files_archive_at(&archive, planted.path(), &one_file()).unwrap_err();

        assert_eq!(
            err.downcast_ref::<std::io::Error>().map(|e| e.kind()),
            Some(std::io::ErrorKind::AlreadyExists)
        );
        assert_eq!(std::fs::read_to_string(planted.path()).unwrap(), "planted");
        assert!(!archive.exists());
    }

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

        write_files_archive(dir.path(), &hashes);
        let read = read_files_archive(dir.path()).expect("current-format archive should read back");
        assert_eq!(read.gathered_at(), 9999);
        assert_eq!(read.get("a.ts").expect("entry").0, "hash-a");
    }
}
