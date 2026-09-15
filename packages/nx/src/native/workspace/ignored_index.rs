//! The files under the directories the hasher registers, whether tracked or
//! not, with their content hashes. A watching context keeps the members
//! current from its events (see `WorkspaceContext`); a walk seeds a prefix
//! and is the fallback wherever the watch does not reach. Nothing watches in
//! a plain CLI process, so there the seed stands for the run, which is what a
//! walk at the same moment would have said.

use std::collections::BTreeSet;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use dashmap::DashMap;
use parking_lot::RwLock;
use tracing::trace;

use crate::native::hasher::hash_file_path;
use crate::native::tasks::hashers::{FileStamp, MISSING_FILE_HASH, seed_walk, stamp_of};

/// Whether the watch delivers events for a workspace-relative path (a
/// directory when the flag is set). A prefix it drops cannot be kept current.
pub(crate) type Gate = Arc<dyn Fn(&str, bool) -> bool + Send + Sync>;

#[napi]
pub struct IgnoredIndex {
    /// Registered directories, workspace-relative, `""` for the root. One
    /// inside another is covered by the outer.
    prefixes: RwLock<BTreeSet<String>>,
    /// Every file under a registered prefix, sorted, workspace-relative.
    members: RwLock<BTreeSet<String>>,
    /// Content by path: members, and when nothing watches, anything hashed.
    contents: DashMap<String, Content>,
    /// Present when a watch keeps the members current.
    gate: Option<Gate>,
    /// Bumped by every change the watch reports under a prefix, so a seed
    /// can tell whether the members moved while it walked.
    generation: AtomicU64,
}

/// A file's hash and the (mtime, size) it was read at. `trusted` is set once
/// hashed under a watch and cleared by any event for the path: a trusted
/// entry answers without a stat, an untrusted one is stat'ed and revalidated
/// by the stamp, with git's racy rule (an entry made in the same second as
/// the file's mtime could hide a same-size rewrite, so it is never served
/// by stamp until a later second remakes it; on a filesystem with 2 s
/// mtimes, FAT and exFAT, a rewrite in the next second still slips
/// through, as it does for git).
struct Content {
    stamp: FileStamp,
    hash: String,
    /// Whole seconds since the epoch when the entry was made.
    made_at: u64,
    trusted: bool,
}

impl Content {
    fn racy(&self) -> bool {
        (self.stamp.0 / 1_000_000_000) as u64 >= self.made_at
    }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Whether `path` is `dir` or sits under it. The root (`""`) holds everything.
fn under(path: &str, dir: &str) -> bool {
    dir.is_empty()
        || path == dir
        || (path.len() > dir.len() && path.starts_with(dir) && path.as_bytes()[dir.len()] == b'/')
}

impl IgnoredIndex {
    /// An index a watch keeps current (`gate` says what it reaches), or one
    /// with no watch behind it, whose members stay as seeded.
    pub(crate) fn new(gate: Option<Gate>) -> Self {
        Self {
            prefixes: RwLock::new(BTreeSet::new()),
            members: RwLock::new(BTreeSet::new()),
            contents: DashMap::new(),
            gate,
            generation: AtomicU64::new(0),
        }
    }

    /// Whether a registered prefix holds `path`.
    pub(crate) fn covers(&self, path: &str) -> bool {
        self.prefixes.read().iter().any(|p| under(path, p))
    }

    /// Registers `prefix` and seeds its members from a walk of
    /// `workspace_root`. Refused, leaving the caller to walk, when the watch
    /// would not deliver events for it (a hardcoded ignore, the root
    /// `.nxignore`) or when it resolves outside the workspace. Registering a
    /// covered prefix is a no-op.
    pub(crate) fn register(&self, workspace_root: &Path, prefix: &str) -> bool {
        let prefix = prefix.trim_matches('/');
        if self.covers(prefix) {
            return true;
        }
        if let Some(gate) = &self.gate
            && !gate(prefix, true)
        {
            trace!("not indexing {prefix:?}: the watch does not reach it");
            return false;
        }
        for _ in 0..3 {
            let generation = self.generation.load(Ordering::Acquire);
            let Some(seeded) = seed_walk(workspace_root, prefix) else {
                trace!("not indexing {prefix:?}: it resolves outside the workspace");
                return false;
            };
            let mut members = self.members.write();
            if self.generation.load(Ordering::Acquire) != generation {
                // The watch moved a file under it while the walk ran; walk again.
                continue;
            }
            let mut prefixes = self.prefixes.write();
            // Anything now covered by the wider prefix is re-listed by the walk.
            prefixes.retain(|p| !under(p, prefix));
            prefixes.insert(prefix.to_string());
            self.replace_under(&mut members, prefix, seeded);
            trace!("indexed {prefix:?}");
            return true;
        }
        trace!("not indexing {prefix:?}: it kept changing while walked");
        false
    }

    /// The files under `dir`, sorted, when a registered prefix covers it.
    pub(crate) fn list(&self, dir: &str) -> Option<Vec<String>> {
        if !self.covers(dir) {
            return None;
        }
        let members = self.members.read();
        Some(
            members
                .range(dir.to_string()..)
                .take_while(|path| under(path, dir))
                .cloned()
                .collect(),
        )
    }

    /// A reported write or creation. A file under a registered prefix
    /// becomes a member with its hash no longer trusted; a directory is
    /// re-listed from a walk, since its files may have arrived without
    /// events of their own; a path that is gone is dropped.
    pub(crate) fn note_written(&self, workspace_root: &Path, path: &str) {
        if !self.covers(path) {
            return;
        }
        self.generation.fetch_add(1, Ordering::AcqRel);
        match std::fs::metadata(workspace_root.join(path)) {
            Ok(metadata) if metadata.is_dir() => {
                if let Some(seeded) = seed_walk(workspace_root, path) {
                    self.replace_under(&mut self.members.write(), path, seeded);
                }
            }
            Ok(_) => {
                self.members.write().insert(path.to_string());
                if let Some(mut content) = self.contents.get_mut(path) {
                    content.trusted = false;
                }
            }
            Err(_) => self.remove(path),
        }
    }

    /// A reported deletion of a file, or of a directory and all under it.
    pub(crate) fn note_deleted(&self, path: &str) {
        if !self.covers(path) {
            return;
        }
        self.generation.fetch_add(1, Ordering::AcqRel);
        self.remove(path);
    }

    /// The watch lost events: every registered prefix is re-listed from a walk.
    pub(crate) fn reseed(&self, workspace_root: &Path) {
        let prefixes: Vec<String> = self.prefixes.read().iter().cloned().collect();
        for prefix in prefixes {
            self.generation.fetch_add(1, Ordering::AcqRel);
            if let Some(seeded) = seed_walk(workspace_root, &prefix) {
                self.replace_under(&mut self.members.write(), &prefix, seeded);
            }
        }
    }

    fn remove(&self, path: &str) {
        let mut members = self.members.write();
        if members.remove(path) {
            self.contents.remove(path);
            return;
        }
        let gone: Vec<String> = members
            .range(path.to_string()..)
            .take_while(|p| under(p, path))
            .cloned()
            .collect();
        for p in gone {
            members.remove(&p);
            self.contents.remove(&p);
        }
    }

    /// Makes `seeded` the members under `dir`, forgetting the content of
    /// what is no longer there. A file the seed saw again is left as it
    /// was: its stamp still decides whether the hash stands.
    fn replace_under(
        &self,
        members: &mut BTreeSet<String>,
        dir: &str,
        seeded: Vec<(String, FileStamp)>,
    ) {
        let before: Vec<String> = members
            .range(dir.to_string()..)
            .take_while(|p| under(p, dir))
            .cloned()
            .collect();
        let fresh: BTreeSet<String> = seeded.into_iter().map(|(path, _)| path).collect();
        for path in &before {
            if !fresh.contains(path) {
                members.remove(path);
                self.contents.remove(path);
            }
        }
        members.extend(fresh);
    }

    /// The hash a trusted entry holds, with no look at the disk.
    pub(crate) fn trusted_hash(&self, path: &str) -> Option<String> {
        self.contents
            .get(path)
            .filter(|c| c.trusted)
            .map(|c| c.hash.clone())
    }

    /// The content hash of `path`, from the entry when its stamp still
    /// matches (`stamp` is the one expansion read, or the file is stat'ed),
    /// otherwise read from disk and remembered. A path no watch keeps is
    /// remembered only when nothing watches at all.
    pub(crate) fn hash_file(
        &self,
        workspace_root: &Path,
        path: &str,
        stamp: Option<FileStamp>,
    ) -> String {
        if let Some(hash) = self.trusted_hash(path) {
            return hash;
        }
        let full_path = workspace_root.join(path);
        let stamp = stamp.or_else(|| std::fs::metadata(&full_path).ok().map(|m| stamp_of(&m)));
        let keep = self.gate.is_none() || self.covers(path);
        if let Some(stamp) = stamp
            && let Some(mut content) = self.contents.get_mut(path)
            && content.stamp == stamp
            && !content.racy()
        {
            trace!("content hash held for {path}");
            content.trusted = keep && self.gate.is_some();
            return content.hash.clone();
        }
        // Taken before the read: a same-size write between the read and a
        // later stamp is then inside the entry's own second, and racy.
        let made_at = now_secs();
        let hash = hash_file_path(&full_path).unwrap_or_else(|| MISSING_FILE_HASH.to_string());
        if let Some(stamp) = stamp
            && keep
        {
            self.contents.insert(
                path.to_string(),
                Content {
                    stamp,
                    hash: hash.clone(),
                    made_at,
                    trusted: self.gate.is_some(),
                },
            );
        }
        hash
    }

    #[cfg(test)]
    pub(crate) fn remembered(&self, path: &str) -> bool {
        self.contents.contains_key(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    fn workspace() -> TempDir {
        let temp = TempDir::new().unwrap();
        for file in [
            "dist/gen/a.js",
            "dist/gen/nested/b.js",
            "dist/other/c.js",
            "src/index.ts",
        ] {
            temp.child(file).write_str(file).unwrap();
        }
        temp
    }

    fn watched() -> IgnoredIndex {
        IgnoredIndex::new(Some(Arc::new(|path: &str, _| {
            !path.starts_with("node_modules")
        })))
    }

    fn set_modified(file: &Path, time: SystemTime) {
        std::fs::File::open(file)
            .unwrap()
            .set_modified(time)
            .unwrap();
    }

    fn age(file: &Path) {
        set_modified(file, SystemTime::now() - std::time::Duration::from_secs(10));
    }

    #[test]
    fn a_registered_prefix_lists_what_a_walk_finds_and_nothing_else_is_listed() {
        let temp = workspace();
        let index = watched();
        assert!(index.register(temp.path(), "dist/gen"));
        assert_eq!(
            index.list("dist/gen").unwrap(),
            vec!["dist/gen/a.js", "dist/gen/nested/b.js"]
        );
        assert_eq!(
            index.list("dist/gen/nested").unwrap(),
            vec!["dist/gen/nested/b.js"]
        );
        assert!(index.list("dist/other").is_none());
        assert!(index.list("dist").is_none());
        assert!(index.list("").is_none());
    }

    #[test]
    fn a_wider_prefix_takes_over_a_narrower_one() {
        let temp = workspace();
        let index = watched();
        assert!(index.register(temp.path(), "dist/gen"));
        assert!(index.register(temp.path(), "dist"));
        assert!(index.register(temp.path(), "dist/other"));
        assert_eq!(index.prefixes.read().len(), 1);
        assert_eq!(
            index.list("dist").unwrap(),
            vec!["dist/gen/a.js", "dist/gen/nested/b.js", "dist/other/c.js"]
        );
    }

    #[test]
    fn a_prefix_the_watch_does_not_reach_is_refused() {
        let temp = workspace();
        temp.child("node_modules/dep/index.js")
            .write_str("x")
            .unwrap();
        let index = watched();
        assert!(!index.register(temp.path(), "node_modules/dep"));
        assert!(index.list("node_modules/dep").is_none());
        // Without a watch there is no gate: the seed stands for the run.
        let unwatched = IgnoredIndex::new(None);
        assert!(unwatched.register(temp.path(), "node_modules/dep"));
        assert_eq!(
            unwatched.list("node_modules/dep").unwrap(),
            vec!["node_modules/dep/index.js"]
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_prefix_that_resolves_outside_the_workspace_is_refused() {
        let temp = workspace();
        let elsewhere = TempDir::new().unwrap();
        elsewhere.child("out/x.js").write_str("x").unwrap();
        std::os::unix::fs::symlink(elsewhere.path().join("out"), temp.path().join("linked"))
            .unwrap();
        assert!(!watched().register(temp.path(), "linked"));
    }

    #[test]
    fn events_keep_the_members_current() {
        let temp = workspace();
        let index = watched();
        index.register(temp.path(), "dist");
        temp.child("dist/gen/new.js").write_str("new").unwrap();
        index.note_written(temp.path(), "dist/gen/new.js");
        std::fs::remove_file(temp.path().join("dist/gen/a.js")).unwrap();
        index.note_deleted("dist/gen/a.js");
        assert_eq!(
            index.list("dist/gen").unwrap(),
            vec!["dist/gen/nested/b.js", "dist/gen/new.js"]
        );
        // A directory reported gone takes everything under it.
        std::fs::remove_dir_all(temp.path().join("dist/gen/nested")).unwrap();
        index.note_deleted("dist/gen/nested");
        assert_eq!(index.list("dist/gen").unwrap(), vec!["dist/gen/new.js"]);
        // A directory reported written is re-listed, for files that arrived
        // without events of their own.
        temp.child("dist/moved/x.js").write_str("x").unwrap();
        temp.child("dist/moved/y.js").write_str("y").unwrap();
        index.note_written(temp.path(), "dist/moved");
        assert_eq!(
            index.list("dist/moved").unwrap(),
            vec!["dist/moved/x.js", "dist/moved/y.js"]
        );
        // Outside every prefix, events are not the index's business.
        index.note_written(temp.path(), "src/other.ts");
        assert!(index.list("src").is_none());
    }

    #[test]
    fn a_reseed_lists_what_the_disk_holds_now() {
        let temp = workspace();
        let index = watched();
        index.register(temp.path(), "dist");
        temp.child("dist/gen/quiet.js").write_str("q").unwrap();
        std::fs::remove_file(temp.path().join("dist/other/c.js")).unwrap();
        assert!(
            !index
                .list("dist")
                .unwrap()
                .contains(&"dist/gen/quiet.js".to_string())
        );
        index.reseed(temp.path());
        assert_eq!(
            index.list("dist").unwrap(),
            vec!["dist/gen/a.js", "dist/gen/nested/b.js", "dist/gen/quiet.js"]
        );
    }

    #[test]
    fn a_hash_is_trusted_until_an_event_names_the_file() {
        let temp = workspace();
        let index = watched();
        index.register(temp.path(), "dist");
        let file = temp.path().join("dist/gen/a.js");
        age(&file);
        let first = index.hash_file(temp.path(), "dist/gen/a.js", None);
        assert_eq!(
            index.trusted_hash("dist/gen/a.js").as_deref(),
            Some(first.as_str())
        );
        // A write with no event behind it is invisible: that is the contract.
        temp.child("dist/gen/a.js").write_str("rewritten").unwrap();
        assert_eq!(index.hash_file(temp.path(), "dist/gen/a.js", None), first);
        // The event drops the trust; the stamp then says the file changed.
        index.note_written(temp.path(), "dist/gen/a.js");
        assert!(index.trusted_hash("dist/gen/a.js").is_none());
        let second = index.hash_file(temp.path(), "dist/gen/a.js", None);
        assert_ne!(first, second);
        assert!(index.trusted_hash("dist/gen/a.js").is_some());
    }

    #[test]
    fn an_untrusted_entry_is_served_by_stamp_but_not_inside_its_own_second() {
        let temp = workspace();
        let index = watched();
        index.register(temp.path(), "dist");
        let file = temp.path().join("dist/gen/a.js");
        age(&file);
        let first = index.hash_file(temp.path(), "dist/gen/a.js", None);
        index.note_written(temp.path(), "dist/gen/a.js");
        // Untouched on disk: the stamp matches, no read, trusted again.
        assert_eq!(index.hash_file(temp.path(), "dist/gen/a.js", None), first);
        assert!(index.trusted_hash("dist/gen/a.js").is_some());

        // Written and hashed inside one second, then rewritten to the same
        // size with the same mtime: never served by stamp.
        let now = SystemTime::now();
        temp.child("dist/gen/a.js").write_str("r").unwrap();
        set_modified(&file, now);
        index.note_written(temp.path(), "dist/gen/a.js");
        let racy = index.hash_file(temp.path(), "dist/gen/a.js", None);
        temp.child("dist/gen/a.js").write_str("s").unwrap();
        set_modified(&file, now);
        index.note_written(temp.path(), "dist/gen/a.js");
        assert_ne!(racy, index.hash_file(temp.path(), "dist/gen/a.js", None));
    }

    #[test]
    fn content_outside_every_prefix_is_kept_only_when_nothing_watches() {
        let temp = workspace();
        let index = watched();
        index.register(temp.path(), "dist");
        index.hash_file(temp.path(), "src/index.ts", None);
        assert!(!index.remembered("src/index.ts"));
        assert!(index.trusted_hash("src/index.ts").is_none());
        let unwatched = IgnoredIndex::new(None);
        unwatched.hash_file(temp.path(), "src/index.ts", None);
        assert!(unwatched.remembered("src/index.ts"));
        // Never trusted blind without a watch: the stamp is checked each time.
        assert!(unwatched.trusted_hash("src/index.ts").is_none());
    }

    #[test]
    fn a_missing_file_hashes_as_missing_and_is_not_remembered() {
        let temp = workspace();
        let index = watched();
        index.register(temp.path(), "dist");
        assert_eq!(
            index.hash_file(temp.path(), "dist/gen/absent.js", None),
            MISSING_FILE_HASH
        );
        assert!(!index.remembered("dist/gen/absent.js"));
    }
}
