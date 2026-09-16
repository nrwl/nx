//! The files under the directories the hasher registers, whether tracked or
//! not, with their content hashes. A watching context keeps the members
//! current from its events (see `WorkspaceContext`); a walk seeds a prefix
//! and is the fallback wherever the watch does not reach. With no watch, a
//! prefix is walked again every time it is registered, once per up-front
//! batch, so the listing is what a walk at that moment would say.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use dashmap::DashMap;
use parking_lot::RwLock;
use tracing::trace;

use crate::native::hasher::hash_file_path;
use crate::native::tasks::hashers::{FileStamp, seed_walk, stamp_of};

/// Whether the watch delivers events for a workspace-relative path (a
/// directory when the flag is set).
pub(crate) type Reaches = Arc<dyn Fn(&str, bool) -> bool + Send + Sync>;

/// What the watch behind an index reaches.
pub(crate) struct Watch {
    pub(crate) reaches: Reaches,
    /// The root `.nxignore` rules. The watch drops what they match and a walk
    /// does not, so no prefix they could match under is indexed.
    pub(crate) nxignore: Vec<String>,
}

impl Watch {
    /// Whether the watch could miss events somewhere under `prefix`.
    fn may_miss_under(&self, prefix: &str) -> bool {
        !(self.reaches)(prefix, true) || nxignore_may_match_under(&self.nxignore, prefix)
    }
}

/// Whether a gitignore-style rule could match `prefix` or a path under it. A
/// rule with no slash before its end matches at any depth; an anchored one
/// only where its literal leading directories meet `prefix`.
fn nxignore_may_match_under(rules: &[String], prefix: &str) -> bool {
    rules.iter().any(|line| {
        let rule = line.trim();
        if rule.is_empty() || rule.starts_with('#') || rule.starts_with('!') {
            return false;
        }
        let rule = rule.trim_end_matches('/');
        if !rule.contains('/') {
            return true;
        }
        let rule = rule.trim_start_matches('/');
        let literal: Vec<&str> = rule
            .split('/')
            .take_while(|segment| !segment.contains(['*', '?', '[', '{']))
            .collect();
        let literal = literal.join("/");
        under(&literal, prefix) || under(prefix, &literal)
    })
}

pub struct IgnoredIndex {
    /// Directories whose files are listed, workspace-relative. One inside
    /// another is covered by the outer.
    prefixes: RwLock<BTreeSet<String>>,
    /// Directories whose file hashes are kept but whose files are not listed:
    /// declared outputs, which are always walked after the task that writes
    /// them has run.
    kept: RwLock<BTreeSet<String>>,
    /// Every file under a listed prefix, sorted, workspace-relative.
    members: RwLock<BTreeSet<String>>,
    /// Content by path, under a listed or kept prefix, or anywhere when
    /// nothing watches.
    contents: DashMap<String, Content>,
    watch: Option<Watch>,
    canonical_root: OnceLock<Option<PathBuf>>,
    /// Bumped by every change the watch reports under a prefix, so a seed or
    /// a read can tell whether something moved while it ran.
    generation: AtomicU64,
}

/// A file's hash and the (mtime, size) it was read at. A `trusted` entry
/// answers without a stat: it is set only when a caller that has applied
/// every delivered event read the file with no event arriving meanwhile, and
/// cleared by any event for the path. An untrusted entry is stat'ed and
/// revalidated by the stamp, with git's racy rule (an entry made in the same
/// second as the file's mtime could hide a same-size rewrite, so it is never
/// served by stamp until a later second remakes it; on a filesystem with 2 s
/// mtimes, FAT and exFAT, a rewrite in the next second still slips through,
/// as it does for git). A symlinked file is never trusted: the watch reports
/// changes to its target, not to the link.
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

/// Whether `set` holds `path` or one of its ancestors: one lookup per level.
fn holds(set: &BTreeSet<String>, path: &str) -> bool {
    if set.is_empty() {
        return false;
    }
    let mut current = path;
    loop {
        if set.contains(current) {
            return true;
        }
        match current.rfind('/') {
            Some(i) => current = &current[..i],
            None => return false,
        }
    }
}

impl IgnoredIndex {
    /// An index a watch keeps current, or one with no watch behind it.
    pub(crate) fn new(watch: Option<Watch>) -> Self {
        Self {
            prefixes: RwLock::new(BTreeSet::new()),
            kept: RwLock::new(BTreeSet::new()),
            members: RwLock::new(BTreeSet::new()),
            contents: DashMap::new(),
            watch,
            canonical_root: OnceLock::new(),
            generation: AtomicU64::new(0),
        }
    }

    /// Whether a listed prefix holds `path`.
    pub(crate) fn covers(&self, path: &str) -> bool {
        holds(&self.prefixes.read(), path)
    }

    /// Whether content under `path` is kept.
    fn keeps(&self, path: &str) -> bool {
        self.covers(path) || holds(&self.kept.read(), path)
    }

    fn canonical_root(&self, workspace_root: &Path) -> Option<&Path> {
        self.canonical_root
            .get_or_init(|| dunce::canonicalize(workspace_root).ok())
            .as_deref()
    }

    /// Why `prefix` cannot be kept current from events, if it cannot.
    fn refusal(&self, prefix: &str) -> Option<&'static str> {
        if prefix.is_empty() {
            return Some("it is the whole workspace");
        }
        match &self.watch {
            Some(watch) if watch.may_miss_under(prefix) => {
                Some("the watch does not report everything under it")
            }
            _ => None,
        }
    }

    /// Registers `prefix` and lists its files from a walk of
    /// `workspace_root`. Refused, leaving the caller to walk, for the whole
    /// workspace, where the watch could miss a change (a hardcoded ignore, a
    /// root `.nxignore` rule), or when it resolves outside the workspace.
    /// Under a watch, registering a covered prefix is a no-op; without one it
    /// is walked again.
    pub(crate) fn register(&self, workspace_root: &Path, prefix: &str) -> bool {
        let prefix = prefix.trim_matches('/');
        if let Some(reason) = self.refusal(prefix) {
            trace!("not indexing {prefix:?}: {reason}");
            return false;
        }
        if self.watch.is_some() && self.covers(prefix) {
            return true;
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
            if !holds(&prefixes, prefix) {
                // Anything now covered by the wider prefix is re-listed by the walk.
                prefixes.retain(|p| !under(p, prefix));
                prefixes.insert(prefix.to_string());
            }
            self.replace_under(&mut members, prefix, seeded);
            trace!("indexed {prefix:?}");
            return true;
        }
        trace!("not indexing {prefix:?}: it kept changing while walked");
        false
    }

    /// Keeps the file hashes under `prefix` without listing its files, for a
    /// directory that is always walked. Refused where `register` would be.
    pub(crate) fn keep(&self, prefix: &str) -> bool {
        let prefix = prefix.trim_matches('/');
        if let Some(reason) = self.refusal(prefix) {
            trace!("not keeping hashes under {prefix:?}: {reason}");
            return false;
        }
        if !self.keeps(prefix) {
            self.kept.write().insert(prefix.to_string());
        }
        true
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

    /// A reported write or creation. Under a listed prefix a file becomes a
    /// member and a directory is re-listed from a walk, since its files may
    /// have arrived without events of their own. A path that is gone, a
    /// linked directory, or a linked file whose target is outside the
    /// workspace is not a member, as a walk would not list it. Any kept hash
    /// for the path stops being trusted.
    pub(crate) fn note_written(&self, workspace_root: &Path, path: &str) {
        if !self.keeps(path) {
            return;
        }
        self.generation.fetch_add(1, Ordering::AcqRel);
        trace!("written under an indexed directory: {path}");
        if let Some(mut content) = self.contents.get_mut(path) {
            content.trusted = false;
        }
        let listed = self.covers(path);
        let full_path = workspace_root.join(path);
        let Ok(link) = std::fs::symlink_metadata(&full_path) else {
            self.forget(path);
            return;
        };
        if link.is_dir() {
            if listed && let Some(seeded) = seed_walk(workspace_root, path) {
                self.replace_under(&mut self.members.write(), path, seeded);
            }
            return;
        }
        if link.file_type().is_symlink() {
            let inside = std::fs::metadata(&full_path).is_ok_and(|target| !target.is_dir())
                && self.canonical_root(workspace_root).is_some_and(|root| {
                    dunce::canonicalize(&full_path).is_ok_and(|t| t.starts_with(root))
                });
            if !inside {
                self.forget(path);
                return;
            }
        }
        if listed {
            self.members.write().insert(path.to_string());
        }
    }

    /// A reported deletion of a file, or of a directory and all under it.
    #[cfg(test)]
    pub(crate) fn note_deleted(&self, path: &str) {
        self.note_deleted_all(std::slice::from_ref(&path));
    }

    /// Reported deletions applied together. A kept but unlisted directory
    /// has no members to range over, so its hashes can only be found by a
    /// pass over them all; one batch pays for that pass once however many
    /// such directories it carries.
    pub(crate) fn note_deleted_all(&self, paths: &[&str]) {
        let kept: Vec<&str> = paths
            .iter()
            .copied()
            .filter(|path| self.keeps(path))
            .collect();
        if kept.is_empty() {
            return;
        }
        self.generation.fetch_add(1, Ordering::AcqRel);
        let mut sweep: Vec<&str> = Vec::new();
        for path in kept {
            trace!("deleted under an indexed directory: {path}");
            if !self.remove(path) {
                sweep.push(path);
            }
        }
        if !sweep.is_empty() {
            self.contents
                .retain(|p, _| !sweep.iter().any(|dir| under(p, dir)));
            // A swept prefix leaves its table behind; the pass is already
            // linear, so give the capacity back with it.
            self.contents.shrink_to_fit();
        }
    }

    /// The watch lost events: every listed prefix is walked again, and the
    /// hashes kept under unlisted ones are forgotten.
    pub(crate) fn reseed(&self, workspace_root: &Path) {
        self.generation.fetch_add(1, Ordering::AcqRel);
        let prefixes: Vec<String> = self.prefixes.read().iter().cloned().collect();
        for prefix in prefixes {
            if let Some(seeded) = seed_walk(workspace_root, &prefix) {
                self.replace_under(&mut self.members.write(), &prefix, seeded);
            }
        }
        let kept: Vec<String> = self.kept.read().iter().cloned().collect();
        if !kept.is_empty() {
            self.contents
                .retain(|path, _| !kept.iter().any(|dir| under(path, dir)) || self.covers(path));
        }
        for mut content in self.contents.iter_mut() {
            content.trusted = false;
        }
    }

    /// `remove`, sweeping the kept hashes when nothing was listed under
    /// `path` — a directory kept without being listed has no members to
    /// range over.
    fn forget(&self, path: &str) {
        if !self.remove(path) {
            self.contents.retain(|p, _| !under(p, path));
        }
    }

    /// Forgets `path` and anything listed under it. False when neither a
    /// member nor a hash was found, so the caller must sweep the hashes for
    /// a kept but unlisted directory.
    fn remove(&self, path: &str) -> bool {
        let mut members = self.members.write();
        let gone: Vec<String> = members
            .range(path.to_string()..)
            .take_while(|p| under(p, path))
            .cloned()
            .collect();
        for p in &gone {
            members.remove(p);
            self.contents.remove(p);
        }
        drop(members);
        self.contents.remove(path).is_some() || !gone.is_empty()
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
    /// otherwise read from disk and remembered where hashes are kept. `trust`
    /// says the caller has applied every delivered watch event: only then may
    /// a trusted entry answer without a stat, or a read become trusted. A
    /// stamp the caller took earlier predates this call, so it never makes
    /// an entry trusted. `None` when the file cannot be read, such as one
    /// deleted after it was listed.
    pub(crate) fn hash_file(
        &self,
        workspace_root: &Path,
        path: &str,
        stamp: Option<FileStamp>,
        trust: bool,
    ) -> Option<String> {
        if trust
            && stamp.is_none()
            && let Some(hash) = self.trusted_hash(path)
        {
            return Some(hash);
        }
        let generation = self.generation.load(Ordering::Acquire);
        let full_path = workspace_root.join(path);
        let may_trust = trust
            && stamp.is_none()
            && self.watch.is_some()
            && self.covers(path)
            && std::fs::symlink_metadata(&full_path).is_ok_and(|m| !m.file_type().is_symlink());
        let stamp = stamp.or_else(|| std::fs::metadata(&full_path).ok().map(|m| stamp_of(&m)));
        let keep = self.watch.is_none() || self.keeps(path);
        let unmoved = || self.generation.load(Ordering::Acquire) == generation;
        if let Some(stamp) = stamp
            && let Some(mut content) = self.contents.get_mut(path)
            && content.stamp == stamp
            && !content.racy()
        {
            trace!("content hash held for {path}");
            content.trusted = may_trust && unmoved();
            return Some(content.hash.clone());
        }
        // Taken before the read: a same-size write between the read and a
        // later stamp is then inside the entry's own second, and racy.
        let made_at = now_secs();
        trace!("reading {path}");
        let hash = hash_file_path(&full_path)?;
        if let Some(stamp) = stamp
            && keep
        {
            self.contents.insert(
                path.to_string(),
                Content {
                    stamp,
                    hash: hash.clone(),
                    made_at,
                    trusted: may_trust && unmoved(),
                },
            );
        }
        Some(hash)
    }

    #[cfg(test)]
    pub(crate) fn remembered(&self, path: &str) -> bool {
        self.contents.contains_key(path)
    }
}

/// Brings an index up to date before a listing: applies what its watch has
/// delivered and waits out a walk in progress. Supplied by the context that
/// owns the watch.
pub(crate) type CatchUp = Arc<dyn Fn() + Send + Sync>;

/// The hasher's handle on an index: lists only after catching up with the
/// watch behind it.
#[napi]
pub struct IgnoredIndexReader {
    index: Arc<IgnoredIndex>,
    catch_up: CatchUp,
}

impl IgnoredIndexReader {
    pub(crate) fn new(index: Arc<IgnoredIndex>, catch_up: CatchUp) -> Self {
        Self { index, catch_up }
    }

    /// A reader over an index nothing watches, for a hasher built without a
    /// context.
    pub(crate) fn unwatched() -> Self {
        Self::new(Arc::new(IgnoredIndex::new(None)), Arc::new(|| {}))
    }

    pub(crate) fn index(&self) -> &IgnoredIndex {
        &self.index
    }

    /// See `IgnoredIndex::register`.
    pub(crate) fn register(&self, workspace_root: &Path, prefix: &str) -> bool {
        self.index.register(workspace_root, prefix)
    }

    /// See `IgnoredIndex::keep`.
    pub(crate) fn keep(&self, prefix: &str) -> bool {
        self.index.keep(prefix)
    }

    /// The files under `dir` once the index has caught up, or `None` when no
    /// registered directory covers it.
    pub(crate) fn list(&self, dir: &str) -> Option<Vec<String>> {
        if !self.index.covers(dir) {
            return None;
        }
        (self.catch_up)();
        self.index.list(dir)
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
        watched_with_nxignore(&[])
    }

    fn watched_with_nxignore(rules: &[&str]) -> IgnoredIndex {
        IgnoredIndex::new(Some(Watch {
            reaches: Arc::new(|path: &str, _| !path.starts_with("node_modules")),
            nxignore: rules.iter().map(|r| r.to_string()).collect(),
        }))
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
        let first = index.hash_file(temp.path(), "dist/gen/a.js", None, true);
        assert_eq!(
            index.trusted_hash("dist/gen/a.js").as_deref(),
            first.as_deref()
        );
        // A write with no event behind it is invisible to a trusting caller:
        // that is the contract. One that cannot vouch for the watch checks
        // the stamp and sees it.
        temp.child("dist/gen/a.js").write_str("rewritten").unwrap();
        assert_eq!(
            index.hash_file(temp.path(), "dist/gen/a.js", None, true),
            first
        );
        assert_ne!(
            index.hash_file(temp.path(), "dist/gen/a.js", None, false),
            first
        );
        // An event drops the trust; the next read makes the entry again.
        index.note_written(temp.path(), "dist/gen/a.js");
        assert!(index.trusted_hash("dist/gen/a.js").is_none());
        let second = index.hash_file(temp.path(), "dist/gen/a.js", None, true);
        assert_ne!(first, second);
        assert!(index.trusted_hash("dist/gen/a.js").is_some());
    }

    // A declared output root is kept without being listed, so a walk never
    // vouched for what is under it and a held hash cannot be served blind.
    #[test]
    fn a_file_kept_without_being_listed_is_never_trusted() {
        let temp = workspace();
        let index = watched();
        assert!(index.keep("dist"));
        age(&temp.path().join("dist/gen/a.js"));

        assert!(
            index
                .hash_file(temp.path(), "dist/gen/a.js", None, true)
                .is_some()
        );
        assert!(
            index.trusted_hash("dist/gen/a.js").is_none(),
            "kept is not listed, so the hash is remembered but not trusted"
        );
    }

    // Under a kept prefix there are no members to range over, so a directory
    // reported written after it went holds its hashes only through the sweep.
    #[test]
    fn a_kept_directory_reported_written_after_it_went_forgets_its_hashes() {
        let temp = workspace();
        let index = watched();
        assert!(index.keep("dist"));
        let file = temp.path().join("dist/gen/a.js");
        age(&file);
        let stamp = stamp_of(&std::fs::metadata(&file).unwrap());
        let hash = index.hash_file(temp.path(), "dist/gen/a.js", None, false);
        assert!(hash.is_some());

        std::fs::remove_dir_all(temp.path().join("dist/gen")).unwrap();
        assert_eq!(
            index.hash_file(temp.path(), "dist/gen/a.js", Some(stamp), false),
            hash,
            "the held hash answers while the index still has it"
        );

        index.note_written(temp.path(), "dist/gen");
        assert!(
            index
                .hash_file(temp.path(), "dist/gen/a.js", Some(stamp), false)
                .is_none(),
            "swept, so the read falls through to a disk that has nothing"
        );
    }

    #[test]
    fn an_untrusted_entry_is_served_by_stamp_but_not_inside_its_own_second() {
        let temp = workspace();
        let index = watched();
        index.register(temp.path(), "dist");
        let file = temp.path().join("dist/gen/a.js");
        age(&file);
        let first = index.hash_file(temp.path(), "dist/gen/a.js", None, true);
        index.note_written(temp.path(), "dist/gen/a.js");
        // Untouched on disk: the stamp matches, no read, trusted again.
        assert_eq!(
            index.hash_file(temp.path(), "dist/gen/a.js", None, true),
            first
        );
        assert!(index.trusted_hash("dist/gen/a.js").is_some());

        // Written and hashed inside one second, then rewritten to the same
        // size with the same mtime: never served by stamp.
        // Ahead of the clock, so the second cannot roll over first.
        let now = SystemTime::now() + std::time::Duration::from_secs(2);
        temp.child("dist/gen/a.js").write_str("r").unwrap();
        set_modified(&file, now);
        index.note_written(temp.path(), "dist/gen/a.js");
        let racy = index.hash_file(temp.path(), "dist/gen/a.js", None, true);
        temp.child("dist/gen/a.js").write_str("s").unwrap();
        set_modified(&file, now);
        index.note_written(temp.path(), "dist/gen/a.js");
        assert_ne!(
            racy,
            index.hash_file(temp.path(), "dist/gen/a.js", None, true)
        );
    }

    #[test]
    fn content_outside_every_prefix_is_kept_only_when_nothing_watches() {
        let temp = workspace();
        let index = watched();
        index.register(temp.path(), "dist");
        index.hash_file(temp.path(), "src/index.ts", None, true);
        assert!(!index.remembered("src/index.ts"));
        assert!(index.trusted_hash("src/index.ts").is_none());
        let unwatched = IgnoredIndex::new(None);
        unwatched.hash_file(temp.path(), "src/index.ts", None, true);
        assert!(unwatched.remembered("src/index.ts"));
        // Never trusted blind without a watch: the stamp is checked each time.
        assert!(unwatched.trusted_hash("src/index.ts").is_none());
    }

    #[test]
    fn a_missing_file_has_no_hash_and_is_not_remembered() {
        let temp = workspace();
        let index = watched();
        index.register(temp.path(), "dist");
        assert_eq!(
            index.hash_file(temp.path(), "dist/gen/absent.js", None, true),
            None
        );
        assert!(!index.remembered("dist/gen/absent.js"));
    }

    #[test]
    fn a_prefix_a_root_nxignore_rule_could_hide_under_is_refused() {
        let temp = workspace();
        // Anchored under the prefix, above it, and unanchored: all could hide
        // a file under dist/gen from the watch.
        for rule in ["dist/gen/nested", "/dist", "*.log", "**/cache"] {
            assert!(
                !watched_with_nxignore(&[rule]).register(temp.path(), "dist/gen"),
                "{rule} should refuse dist/gen"
            );
        }
        // Elsewhere, negated, or a comment: nothing under dist/gen is hidden.
        let index = watched_with_nxignore(&["src/generated", "!dist/gen", "# dist"]);
        assert!(index.register(temp.path(), "dist/gen"));
    }

    #[test]
    fn the_whole_workspace_is_never_indexed() {
        let temp = workspace();
        assert!(!watched().register(temp.path(), ""));
        assert!(!IgnoredIndex::new(None).register(temp.path(), "/"));
    }

    #[cfg(unix)]
    #[test]
    fn a_linked_member_is_never_trusted() {
        let temp = workspace();
        temp.child("shared/real.js").write_str("one").unwrap();
        std::os::unix::fs::symlink(
            temp.path().join("shared/real.js"),
            temp.path().join("dist/gen/link.js"),
        )
        .unwrap();
        let index = watched();
        assert!(index.register(temp.path(), "dist"));
        assert!(
            index
                .list("dist")
                .unwrap()
                .contains(&"dist/gen/link.js".to_string())
        );
        age(&temp.path().join("shared/real.js"));
        let first = index.hash_file(temp.path(), "dist/gen/link.js", None, true);
        assert!(index.trusted_hash("dist/gen/link.js").is_none());
        // The watch reports the target, which is outside the prefix; the
        // link is re-checked by its stamp and sees the change.
        temp.child("shared/real.js").write_str("two!").unwrap();
        assert_ne!(
            first,
            index.hash_file(temp.path(), "dist/gen/link.js", None, true)
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_linked_file_or_directory_leading_outside_is_not_a_member() {
        let temp = workspace();
        let elsewhere = TempDir::new().unwrap();
        elsewhere.child("secret/id_rsa").write_str("key").unwrap();
        let index = watched();
        assert!(index.register(temp.path(), "dist"));
        std::os::unix::fs::symlink(
            elsewhere.path().join("secret/id_rsa"),
            temp.path().join("dist/id_rsa"),
        )
        .unwrap();
        index.note_written(temp.path(), "dist/id_rsa");
        std::os::unix::fs::symlink(
            elsewhere.path().join("secret"),
            temp.path().join("dist/lnk"),
        )
        .unwrap();
        index.note_written(temp.path(), "dist/lnk");
        let listed = index.list("dist").unwrap();
        assert!(
            !listed
                .iter()
                .any(|p| p.contains("id_rsa") || p.contains("lnk"))
        );
    }

    #[test]
    fn a_stamp_from_before_an_event_never_makes_an_entry_trusted() {
        let temp = workspace();
        let index = watched();
        index.register(temp.path(), "dist");
        let file = temp.path().join("dist/gen/a.js");
        age(&file);
        let old = stamp_of(&std::fs::metadata(&file).unwrap());
        index.hash_file(temp.path(), "dist/gen/a.js", None, true);
        temp.child("dist/gen/a.js").write_str("rewritten").unwrap();
        age(&file);
        index.note_written(temp.path(), "dist/gen/a.js");
        // A walker's stamp from before the write matches the old entry: it
        // may answer, but it must not re-arm the trust.
        index.hash_file(temp.path(), "dist/gen/a.js", Some(old), false);
        index.hash_file(temp.path(), "dist/gen/a.js", Some(old), true);
        assert!(index.trusted_hash("dist/gen/a.js").is_none());
        let fresh = index.hash_file(temp.path(), "dist/gen/a.js", None, true);
        assert_eq!(fresh, index.trusted_hash("dist/gen/a.js"));
    }

    #[test]
    fn kept_output_hashes_are_forgotten_with_their_files() {
        let temp = workspace();
        let index = watched();
        assert!(index.keep("dist/other"));
        assert!(index.list("dist/other").is_none());
        index.hash_file(temp.path(), "dist/other/c.js", None, false);
        assert!(index.remembered("dist/other/c.js"));
        assert!(index.trusted_hash("dist/other/c.js").is_none());
        std::fs::remove_dir_all(temp.path().join("dist/other")).unwrap();
        index.note_deleted("dist/other");
        assert!(!index.remembered("dist/other/c.js"));
        // Outside every listed or kept prefix, a watching index keeps nothing.
        index.hash_file(temp.path(), "src/index.ts", None, false);
        assert!(!index.remembered("src/index.ts"));
    }

    #[test]
    fn without_a_watch_registering_again_walks_again() {
        let temp = workspace();
        let index = IgnoredIndex::new(None);
        assert!(index.register(temp.path(), "dist"));
        temp.child("dist/gen/late.js").write_str("late").unwrap();
        assert!(
            !index
                .list("dist")
                .unwrap()
                .contains(&"dist/gen/late.js".to_string())
        );
        assert!(index.register(temp.path(), "dist/gen"));
        assert!(
            index
                .list("dist")
                .unwrap()
                .contains(&"dist/gen/late.js".to_string())
        );
    }

    #[test]
    fn coverage_is_by_ancestor() {
        let mut set = BTreeSet::new();
        set.insert("dist/apps".to_string());
        assert!(holds(&set, "dist/apps"));
        assert!(holds(&set, "dist/apps/web/index.js"));
        assert!(!holds(&set, "dist/apps-other/index.js"));
        assert!(!holds(&set, "dist"));
    }
}
