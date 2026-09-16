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
use tracing::{debug, trace};

use crate::native::hasher::hash_file_path;
use crate::native::walker::{PathPredicate, files_under, seed_walk};

/// Whether the watch delivers events for a workspace-relative directory.
pub(crate) type DeliversUnder = Arc<dyn Fn(&str) -> bool + Send + Sync>;

/// What the watch behind an index reports, so the index knows which
/// directories it can keep current and which it must refuse.
pub(crate) struct Watch {
    pub(crate) delivers_under: DeliversUnder,
}

impl Watch {
    /// Whether the watch could miss events somewhere under `prefix`.
    fn may_miss_under(&self, prefix: &str) -> bool {
        !(self.delivers_under)(prefix)
    }
}

pub struct IgnoredIndex {
    /// Directories being kept, workspace-relative: their file hashes are
    /// remembered, and their files listed if anything asks. One inside
    /// another is absorbed by the outer.
    tracked: RwLock<BTreeSet<String>>,
    /// The tracked directories that have been walked. Only under one of these
    /// is there a listing to answer from, or a hash that may be served
    /// without a stat. A declared output is tracked and never listed, since
    /// nothing asks one for its files.
    listed: RwLock<BTreeSet<String>>,
    /// Every file under a listed directory, sorted, workspace-relative.
    members: RwLock<BTreeSet<String>>,
    /// Content by path, under a tracked directory, or anywhere when nothing
    /// watches.
    contents: DashMap<String, Content>,
    watch: Option<Watch>,
    /// So the whole-workspace warning is said once, not once per group.
    announced_whole_workspace: std::sync::atomic::AtomicBool,
    canonical_root: OnceLock<Option<PathBuf>>,
    /// Bumped by every change the watch reports under a prefix, so a seed or
    /// a read can tell whether something moved while it ran.
    generation: AtomicU64,
    /// Test seam: makes every walk fail to settle, which is otherwise only
    /// reachable by racing the disk against the walk.
    #[cfg(test)]
    never_settles: std::sync::atomic::AtomicBool,
}

/// A file's hash and the (mtime, size) it was read at. A `trusted` entry
/// answers without a stat: it is set only when a caller that has applied
/// every delivered event read the file with no event arriving meanwhile, and
/// cleared by any event for the path. An untrusted entry is stat'ed and
/// revalidated by the stamp, unless the stamp is too fresh to prove anything
/// (an entry made in the same second as the file's mtime could hide a
/// same-size rewrite, so it is never served by stamp until a later second
/// remakes it; on a filesystem with 2 s mtimes, FAT and exFAT, a rewrite in
/// the next second still slips through, as it does for git, which solves the
/// same problem the same way). A symlinked file is never trusted: the watch reports
/// changes to its target, not to the link.
struct Content {
    stamp: FileStamp,
    hash: String,
    /// Whole seconds since the epoch when the entry was made.
    made_at: u64,
    trusted: bool,
}

impl Content {
    /// Whether the stamp is too fresh to prove the file is unchanged: it was
    /// modified in the second this entry was made, or later, and mtimes are
    /// only whole seconds on many filesystems, so a same-size rewrite inside
    /// that second would leave the stamp looking untouched.
    fn stamp_too_fresh(&self) -> bool {
        (self.stamp.0 / 1_000_000_000) as u64 >= self.made_at
    }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// The `(mtime, size)` a file showed when the index last read it. What
/// says whether a hash it holds still stands.
pub(crate) type FileStamp = (u128, u64);

pub(crate) fn stamp_of(metadata: &std::fs::Metadata) -> FileStamp {
    let mtime = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    (mtime, metadata.len())
}

/// Where a hashing call sits in a run. Before anything executes, the file map
/// and the index are current, so a hash either holds may be taken without
/// touching the disk. Once a task has run it may have written files the watch
/// has not reported yet, and only the disk can settle it.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum RunStage {
    NothingRan,
    ATaskMayHaveWritten,
}

impl RunStage {
    pub(crate) fn nothing_ran(self) -> bool {
        self == RunStage::NothingRan
    }
}

/// Whether `path` is `dir` or sits under it. The root (`""`) holds everything.
fn under(path: &str, dir: &str) -> bool {
    dir.is_empty()
        || path == dir
        || (path.len() > dir.len() && path.starts_with(dir) && path.as_bytes()[dir.len()] == b'/')
}

/// Whether `set` holds `path` or one of its ancestors: one lookup per level.
/// `Path::ancestors` ends a relative path at `""`, which is the workspace
/// root and an ancestor of everything, so the root needs no case of its own.
fn holds(set: &BTreeSet<String>, path: &str) -> bool {
    !set.is_empty()
        && Path::new(path)
            .ancestors()
            .any(|ancestor| ancestor.to_str().is_some_and(|level| set.contains(level)))
}

impl IgnoredIndex {
    /// An index a watch keeps current, or one with no watch behind it.
    pub(crate) fn new(watch: Option<Watch>) -> Self {
        Self {
            tracked: RwLock::new(BTreeSet::new()),
            listed: RwLock::new(BTreeSet::new()),
            members: RwLock::new(BTreeSet::new()),
            contents: DashMap::new(),
            watch,
            announced_whole_workspace: std::sync::atomic::AtomicBool::new(false),
            canonical_root: OnceLock::new(),
            generation: AtomicU64::new(0),
            #[cfg(test)]
            never_settles: std::sync::atomic::AtomicBool::new(false),
        }
    }

    /// Whether a directory that has been walked holds `path`. Only then is
    /// there a listing to answer from, or a hash safe to serve blind.
    pub(crate) fn is_listed(&self, path: &str) -> bool {
        holds(&self.listed.read(), path)
    }

    /// Whether a tracked directory holds `path`, so its hash is worth keeping.
    /// A tracked directory is not necessarily walked: nothing walks one until
    /// a listing is asked for.
    pub(crate) fn is_tracked(&self, path: &str) -> bool {
        holds(&self.tracked.read(), path)
    }

    fn canonical_root(&self, workspace_root: &Path) -> Option<&Path> {
        self.canonical_root
            .get_or_init(|| dunce::canonicalize(workspace_root).ok())
            .as_deref()
    }

    /// Whether `dir` resolves outside the workspace. Resolved, not walked: a
    /// path that will not resolve is treated as inside on purpose, which is
    /// what lets an output root be kept before its task has written it.
    fn leaves_the_workspace(&self, workspace_root: &Path, dir: &str) -> bool {
        dunce::canonicalize(workspace_root.join(dir)).is_ok_and(|resolved| {
            !self
                .canonical_root(workspace_root)
                .is_some_and(|root| resolved.starts_with(root))
        })
    }

    /// Starts keeping what is under `dir`: its file hashes always, and its
    /// listing if anyone asks for one. No directory is walked here. False,
    /// leaving the caller to walk instead, where the watch could miss a change
    /// (a hardcoded ignore) or `dir` resolves outside the workspace. Both cost
    /// only speed: the directory is read every run rather than remembered.
    ///
    /// An empty `dir` is the whole workspace, which a glob with no literal
    /// prefix asks for. It is kept like any other, and says so once at debug
    /// level: a listing of it walks everything, where a named directory walks
    /// only itself.
    pub(crate) fn track(&self, workspace_root: &Path, dir: &str) -> bool {
        let dir = dir.trim_matches('/');
        let refused = match &self.watch {
            Some(watch) if watch.may_miss_under(dir) => {
                Some("the watch does not report everything under it")
            }
            _ if self.leaves_the_workspace(workspace_root, dir) => {
                Some("it resolves outside the workspace")
            }
            _ => None,
        };
        if let Some(reason) = refused {
            trace!("not tracking {dir:?}: {reason}");
            return false;
        }
        if dir.is_empty() && !self.announced_whole_workspace.swap(true, Ordering::AcqRel) {
            debug!(
                "An includeIgnored fileset names no directory to read from, so it is read \
                 from the workspace root: its first listing walks the whole workspace and \
                 then holds every file in it. Give the fileset a directory, such as \
                 {{projectRoot}}/dist/**, to walk and hold only that."
            );
        }
        // Asked after the refusals, never before: a tracked ancestor must not
        // adopt a directory that would have been refused on its own, such as
        // one whose own path leads out of the workspace.
        if self.is_tracked(dir) {
            return true;
        }
        {
            let mut tracked = self.tracked.write();
            tracked.retain(|d| !under(d, dir));
            tracked.insert(dir.to_string());
        }
        true
    }

    /// Walks `dir` and adopts the result as its listing, so later reads answer
    /// from it and watch events keep it current. False when the walk could not
    /// settle: the disk kept moving, or `dir` resolves outside the workspace.
    fn walk_into_listing(&self, workspace_root: &Path, dir: &str) -> bool {
        for _ in 0..3 {
            #[cfg(test)]
            if self.never_settles.load(Ordering::Acquire) {
                // Fail every attempt, so the give-up path is reached the way
                // a disk that keeps moving reaches it.
                continue;
            }
            if self.leaves_the_workspace(workspace_root, dir) {
                trace!("not listing {dir:?}: it resolves outside the workspace");
                return false;
            }
            let generation = self.generation.load(Ordering::Acquire);
            let Some(seeded) = seed_walk(workspace_root, dir) else {
                trace!("not listing {dir:?}: it could not be read");
                return false;
            };
            let mut members = self.members.write();
            if self.generation.load(Ordering::Acquire) != generation {
                // The watch moved a file under it while the walk ran; walk again.
                continue;
            }
            let mut listed = self.listed.write();
            if !holds(&listed, dir) {
                // Anything now covered by the wider prefix is re-listed by the walk.
                listed.retain(|d| !under(d, dir));
                listed.insert(dir.to_string());
            }
            self.replace_under(&mut members, dir, seeded);
            trace!("listed {dir:?}");
            return true;
        }
        trace!("not listing {dir:?}: it kept changing while walked");
        false
    }

    /// The files under `dir`, sorted, when a tracked directory holds it. The
    /// first ask walks; after that the watch keeps the answer current. `None`
    /// when nothing tracks `dir`, or the walk could not settle.
    pub(crate) fn list(&self, workspace_root: &Path, dir: &str) -> Option<Vec<String>> {
        if !self.is_tracked(dir) {
            return None;
        }
        // Without a watch nothing keeps a listing current, so every ask walks.
        if (self.watch.is_none() || !self.is_listed(dir))
            && !self.walk_into_listing(workspace_root, dir)
        {
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

    /// The files under `dir` that `accept` admits, workspace-relative and in
    /// no particular order. The one way anything asks what a directory holds.
    /// With
    /// `cached`, a tracked directory answers from its listing, walking the
    /// first time and keeping it current from events after. Otherwise, and
    /// for a directory nothing tracks, the disk is read and not remembered.
    /// `None` only when `dir` cannot be read at all.
    pub(crate) fn files_under(
        &self,
        workspace_root: &Path,
        dir: &str,
        cached: bool,
        accept: PathPredicate,
    ) -> Option<Vec<String>> {
        if cached && self.is_tracked(dir) {
            // A listing that cannot settle, because the disk kept moving
            // under the walk, must not read as an empty directory: fall
            // through and read it the way an untracked one is read.
            if let Some(listed) = self.list(workspace_root, dir) {
                return Some(listed.into_iter().filter(|path| accept(path)).collect());
            }
            trace!("no listing for {dir:?}; reading it from disk instead");
        }
        files_under(workspace_root, dir, accept)
    }

    /// A reported write or creation. Under a listed prefix a file becomes a
    /// member and a directory is re-listed from a walk, since its files may
    /// have arrived without events of their own. A path that is gone, a
    /// linked directory, or a linked file whose target is outside the
    /// workspace is not a member, as a walk would not list it. Any kept hash
    /// for the path stops being trusted.
    pub(crate) fn note_written(&self, workspace_root: &Path, path: &str) {
        if !self.is_tracked(path) {
            return;
        }
        self.generation.fetch_add(1, Ordering::AcqRel);
        trace!("written under an indexed directory: {path}");
        if let Some(mut content) = self.contents.get_mut(path) {
            content.trusted = false;
        }
        let listed = self.is_listed(path);
        let full_path = workspace_root.join(path);
        let Ok(link) = std::fs::symlink_metadata(&full_path) else {
            self.forget(path);
            return;
        };
        if link.is_dir() {
            // Re-walk the directory the event names, never the workspace: a
            // root event would re-walk everything on every report.
            if listed
                && !path.is_empty()
                && let Some(seeded) = seed_walk(workspace_root, path)
            {
                self.replace_under(&mut self.members.write(), path, seeded);
            }
            return;
        }
        // A linked directory is no more a member than a walk enters one; a
        // linked file is, wherever it points. Never trusted either way, see
        // `trusted_hash`.
        if link.file_type().is_symlink()
            && !std::fs::metadata(&full_path).is_ok_and(|target| !target.is_dir())
        {
            self.forget(path);
            return;
        }
        if listed {
            self.members.write().insert(path.to_string());
        }
    }

    /// Reported deletions applied together. A kept but unlisted directory
    /// has no members to range over, so its hashes can only be found by a
    /// pass over them all; one batch pays for that pass once however many
    /// such directories it carries.
    pub(crate) fn note_deleted_all(&self, paths: &[&str]) {
        let kept: Vec<&str> = paths
            .iter()
            .copied()
            .filter(|path| self.is_tracked(path))
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
        let listed: Vec<String> = self.listed.read().iter().cloned().collect();
        for prefix in listed {
            if let Some(seeded) = seed_walk(workspace_root, &prefix) {
                self.replace_under(&mut self.members.write(), &prefix, seeded);
            }
        }
        let tracked: Vec<String> = self.tracked.read().iter().cloned().collect();
        if !tracked.is_empty() {
            // A tracked directory nobody listed has no walk to correct it, so
            // its hashes go rather than stand on events that may be missing.
            self.contents.retain(|path, _| {
                !tracked.iter().any(|dir| under(path, dir)) || self.is_listed(path)
            });
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
    fn replace_under(&self, members: &mut BTreeSet<String>, dir: &str, seeded: Vec<String>) {
        let before: Vec<String> = members
            .range(dir.to_string()..)
            .take_while(|p| under(p, dir))
            .cloned()
            .collect();
        let fresh: BTreeSet<String> = seeded.into_iter().collect();
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
    /// otherwise read from disk and remembered where hashes are kept. `stage`
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
        stage: RunStage,
    ) -> Option<String> {
        if stage.nothing_ran()
            && stamp.is_none()
            && let Some(hash) = self.trusted_hash(path)
        {
            return Some(hash);
        }
        let generation = self.generation.load(Ordering::Acquire);
        let full_path = workspace_root.join(path);
        // `is_listed` asks whether an ANCESTOR was walked; `members` is what
        // that walk actually listed. A path the walk left out on purpose — a
        // linked directory's contents, a hardcoded ignore, a transient skip —
        // has a listed ancestor and no event will ever name it, so only
        // membership may be trusted.
        let may_trust = stage.nothing_ran()
            && stamp.is_none()
            && self.watch.is_some()
            && self.is_listed(path)
            && self.members.read().contains(path)
            && std::fs::symlink_metadata(&full_path).is_ok_and(|m| !m.file_type().is_symlink());
        let stamp = stamp.or_else(|| std::fs::metadata(&full_path).ok().map(|m| stamp_of(&m)));
        let keep = self.watch.is_none() || self.is_tracked(path);
        let unmoved = || self.generation.load(Ordering::Acquire) == generation;
        if let Some(stamp) = stamp
            && let Some(mut content) = self.contents.get_mut(path)
            && content.stamp == stamp
            && !content.stamp_too_fresh()
        {
            trace!("content hash held for {path}");
            content.trusted = may_trust && unmoved();
            return Some(content.hash.clone());
        }
        // Taken before the read: a same-size write between the read and a
        // later stamp is then inside the entry's own second, and too fresh.
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

    /// See `IgnoredIndex::track`.
    pub(crate) fn track(&self, workspace_root: &Path, dir: &str) -> bool {
        self.index.track(workspace_root, dir)
    }

    /// The files under `dir` that `accept` admits, once the index has applied
    /// what the watch delivered, so an answer never predates a reported write.
    /// See `IgnoredIndex::files_under`.
    pub(crate) fn files_under(
        &self,
        workspace_root: &Path,
        dir: &str,
        cached: bool,
        accept: PathPredicate,
    ) -> Option<Vec<String>> {
        (self.catch_up)();
        self.index.files_under(workspace_root, dir, cached, accept)
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
        watched_with(Arc::new(|path: &str| !path.starts_with("node_modules")))
    }

    fn watched_with(delivers_under: DeliversUnder) -> IgnoredIndex {
        IgnoredIndex::new(Some(Watch { delivers_under }))
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
        assert!(index.track(temp.path(), "dist/gen"));
        assert_eq!(
            index.list(temp.path(), "dist/gen").unwrap(),
            vec!["dist/gen/a.js", "dist/gen/nested/b.js"]
        );
        assert_eq!(
            index.list(temp.path(), "dist/gen/nested").unwrap(),
            vec!["dist/gen/nested/b.js"]
        );
        assert!(index.list(temp.path(), "dist/other").is_none());
        assert!(index.list(temp.path(), "dist").is_none());
        assert!(index.list(temp.path(), "").is_none());
    }

    #[test]
    fn a_wider_prefix_takes_over_a_narrower_one() {
        let temp = workspace();
        let index = watched();
        assert!(index.track(temp.path(), "dist/gen"));
        assert!(index.track(temp.path(), "dist"));
        assert!(index.track(temp.path(), "dist/other"));
        assert_eq!(index.tracked.read().len(), 1);
        assert_eq!(
            index.list(temp.path(), "dist").unwrap(),
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
        assert!(!index.track(temp.path(), "node_modules/dep"));
        assert!(index.list(temp.path(), "node_modules/dep").is_none());
        // Without a watch there is no gate: the seed stands for the run.
        let unwatched = IgnoredIndex::new(None);
        assert!(unwatched.track(temp.path(), "node_modules/dep"));
        assert_eq!(
            unwatched.list(temp.path(), "node_modules/dep").unwrap(),
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
        assert!(!watched().track(temp.path(), "linked"));
    }

    #[test]
    fn events_keep_the_members_current() {
        let temp = workspace();
        let index = watched();
        index.track(temp.path(), "dist");
        temp.child("dist/gen/new.js").write_str("new").unwrap();
        index.note_written(temp.path(), "dist/gen/new.js");
        std::fs::remove_file(temp.path().join("dist/gen/a.js")).unwrap();
        index.note_deleted_all(&["dist/gen/a.js"]);
        assert_eq!(
            index.list(temp.path(), "dist/gen").unwrap(),
            vec!["dist/gen/nested/b.js", "dist/gen/new.js"]
        );
        // A directory reported gone takes everything under it.
        std::fs::remove_dir_all(temp.path().join("dist/gen/nested")).unwrap();
        index.note_deleted_all(&["dist/gen/nested"]);
        assert_eq!(
            index.list(temp.path(), "dist/gen").unwrap(),
            vec!["dist/gen/new.js"]
        );
        // A directory reported written is re-listed, for files that arrived
        // without events of their own.
        temp.child("dist/moved/x.js").write_str("x").unwrap();
        temp.child("dist/moved/y.js").write_str("y").unwrap();
        index.note_written(temp.path(), "dist/moved");
        assert_eq!(
            index.list(temp.path(), "dist/moved").unwrap(),
            vec!["dist/moved/x.js", "dist/moved/y.js"]
        );
        // Outside every prefix, events are not the index's business.
        index.note_written(temp.path(), "src/other.ts");
        assert!(index.list(temp.path(), "src").is_none());
    }

    // A walk that cannot settle used to leave the caller with nothing, which
    // reads as an empty directory and hashes as if the files were gone.
    #[test]
    fn a_listing_that_cannot_settle_still_reads_the_disk() {
        let temp = workspace();
        let index = watched();
        assert!(index.track(temp.path(), "dist"));
        index
            .never_settles
            .store(true, std::sync::atomic::Ordering::Release);

        assert!(index.list(temp.path(), "dist").is_none());
        assert_eq!(
            {
                let mut found = index
                    .files_under(temp.path(), "dist", true, &|path| path.ends_with(".js"))
                    .unwrap();
                found.sort();
                found
            },
            {
                let mut expected = vec!["dist/other/c.js", "dist/gen/a.js", "dist/gen/nested/b.js"];
                expected.sort();
                expected
            },
            "the files are read whether or not a listing settled"
        );
    }

    #[test]
    fn a_reseed_lists_what_the_disk_holds_now() {
        let temp = workspace();
        let index = watched();
        index.track(temp.path(), "dist");
        // Listed first, so the writes below land behind a listing that exists.
        index.list(temp.path(), "dist").unwrap();
        temp.child("dist/gen/quiet.js").write_str("q").unwrap();
        std::fs::remove_file(temp.path().join("dist/other/c.js")).unwrap();
        assert!(
            !index
                .list(temp.path(), "dist")
                .unwrap()
                .contains(&"dist/gen/quiet.js".to_string())
        );
        index.reseed(temp.path());
        assert_eq!(
            index.list(temp.path(), "dist").unwrap(),
            vec!["dist/gen/a.js", "dist/gen/nested/b.js", "dist/gen/quiet.js"]
        );
    }

    #[test]
    fn a_hash_is_trusted_until_an_event_names_the_file() {
        let temp = workspace();
        let index = watched();
        index.track(temp.path(), "dist");
        // A hash is trusted only under a listing, and the expansion asks for
        // one before it hashes anything.
        index.list(temp.path(), "dist").unwrap();
        let file = temp.path().join("dist/gen/a.js");
        age(&file);
        let first = index.hash_file(temp.path(), "dist/gen/a.js", None, RunStage::NothingRan);
        assert_eq!(
            index.trusted_hash("dist/gen/a.js").as_deref(),
            first.as_deref()
        );
        // A write with no event behind it is invisible to a trusting caller:
        // that is the contract. One that cannot vouch for the watch checks
        // the stamp and sees it.
        temp.child("dist/gen/a.js").write_str("rewritten").unwrap();
        assert_eq!(
            index.hash_file(temp.path(), "dist/gen/a.js", None, RunStage::NothingRan),
            first
        );
        assert_ne!(
            index.hash_file(
                temp.path(),
                "dist/gen/a.js",
                None,
                RunStage::ATaskMayHaveWritten
            ),
            first
        );
        // An event drops the trust; the next read makes the entry again.
        index.note_written(temp.path(), "dist/gen/a.js");
        assert!(index.trusted_hash("dist/gen/a.js").is_none());
        let second = index.hash_file(temp.path(), "dist/gen/a.js", None, RunStage::NothingRan);
        assert_ne!(first, second);
        assert!(index.trusted_hash("dist/gen/a.js").is_some());
    }

    // A declared output root is kept without being listed, so a walk never
    // vouched for what is under it and a held hash cannot be served blind.
    #[test]
    fn a_file_kept_without_being_listed_is_never_trusted() {
        let temp = workspace();
        let index = watched();
        assert!(index.track(temp.path(), "dist"));
        age(&temp.path().join("dist/gen/a.js"));

        assert!(
            index
                .hash_file(temp.path(), "dist/gen/a.js", None, RunStage::NothingRan)
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
        assert!(index.track(temp.path(), "dist"));
        let file = temp.path().join("dist/gen/a.js");
        age(&file);
        let stamp = stamp_of(&std::fs::metadata(&file).unwrap());
        let hash = index.hash_file(
            temp.path(),
            "dist/gen/a.js",
            None,
            RunStage::ATaskMayHaveWritten,
        );
        assert!(hash.is_some());

        std::fs::remove_dir_all(temp.path().join("dist/gen")).unwrap();
        assert_eq!(
            index.hash_file(
                temp.path(),
                "dist/gen/a.js",
                Some(stamp),
                RunStage::ATaskMayHaveWritten
            ),
            hash,
            "the held hash answers while the index still has it"
        );

        index.note_written(temp.path(), "dist/gen");
        assert!(
            index
                .hash_file(
                    temp.path(),
                    "dist/gen/a.js",
                    Some(stamp),
                    RunStage::ATaskMayHaveWritten
                )
                .is_none(),
            "swept, so the read falls through to a disk that has nothing"
        );
    }

    #[test]
    fn an_untrusted_entry_is_served_by_stamp_but_not_inside_its_own_second() {
        let temp = workspace();
        let index = watched();
        index.track(temp.path(), "dist");
        // A hash is trusted only under a listing, and the expansion asks for
        // one before it hashes anything.
        index.list(temp.path(), "dist").unwrap();
        let file = temp.path().join("dist/gen/a.js");
        age(&file);
        let first = index.hash_file(temp.path(), "dist/gen/a.js", None, RunStage::NothingRan);
        index.note_written(temp.path(), "dist/gen/a.js");
        // Untouched on disk: the stamp matches, no read, trusted again.
        assert_eq!(
            index.hash_file(temp.path(), "dist/gen/a.js", None, RunStage::NothingRan),
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
        let too_fresh = index.hash_file(temp.path(), "dist/gen/a.js", None, RunStage::NothingRan);
        temp.child("dist/gen/a.js").write_str("s").unwrap();
        set_modified(&file, now);
        index.note_written(temp.path(), "dist/gen/a.js");
        assert_ne!(
            too_fresh,
            index.hash_file(temp.path(), "dist/gen/a.js", None, RunStage::NothingRan)
        );
    }

    #[test]
    fn content_outside_every_prefix_is_kept_only_when_nothing_watches() {
        let temp = workspace();
        let index = watched();
        index.track(temp.path(), "dist");
        index.hash_file(temp.path(), "src/index.ts", None, RunStage::NothingRan);
        assert!(!index.remembered("src/index.ts"));
        assert!(index.trusted_hash("src/index.ts").is_none());
        let unwatched = IgnoredIndex::new(None);
        unwatched.hash_file(temp.path(), "src/index.ts", None, RunStage::NothingRan);
        assert!(unwatched.remembered("src/index.ts"));
        // Never trusted blind without a watch: the stamp is checked each time.
        assert!(unwatched.trusted_hash("src/index.ts").is_none());
    }

    #[test]
    fn a_missing_file_has_no_hash_and_is_not_remembered() {
        let temp = workspace();
        let index = watched();
        index.track(temp.path(), "dist");
        assert_eq!(
            index.hash_file(
                temp.path(),
                "dist/gen/absent.js",
                None,
                RunStage::NothingRan
            ),
            None
        );
        assert!(!index.remembered("dist/gen/absent.js"));
    }

    /// A directory the watch does not report on cannot be kept current, so it
    /// is walked every run instead of indexed. The root `.nxignore` no longer
    /// gates the stream, so it is not one of these.
    #[test]
    fn a_prefix_the_watch_does_not_report_on_is_refused() {
        let temp = workspace();
        let index = watched_with(Arc::new(|path: &str| !path.starts_with("dist/gen")));
        assert!(!index.track(temp.path(), "dist/gen"));
        assert!(index.track(temp.path(), "dist/other"));
    }

    /// A glob with no literal prefix reads from the workspace root, and is
    /// kept like any other directory. It absorbs every other tracked prefix,
    /// since everything is under it.
    #[test]
    fn the_whole_workspace_is_indexed_and_absorbs_the_rest() {
        let temp = workspace();
        let index = watched();
        assert!(index.track(temp.path(), "dist/gen"));
        assert!(index.track(temp.path(), ""));
        assert!(index.is_tracked("dist/gen"));
        assert!(index.is_tracked("src/index.ts"));
        assert_eq!(
            index.list(temp.path(), "").unwrap(),
            vec![
                "dist/gen/a.js",
                "dist/gen/nested/b.js",
                "dist/other/c.js",
                "src/index.ts"
            ]
        );
        // `/` is the same directory spelled differently.
        assert!(IgnoredIndex::new(None).track(temp.path(), "/"));
    }

    /// A listed ancestor is not membership. A file under a linked-out
    /// directory has a listed ancestor, was never listed by the walk, and no
    /// watch event can ever name it — so trusting it would serve a hash that
    /// nothing can clear.
    #[cfg(unix)]
    #[test]
    fn a_file_the_walk_left_out_is_not_trusted_for_having_a_listed_ancestor() {
        let temp = workspace();
        let elsewhere = TempDir::new().unwrap();
        elsewhere.child("shared/out.js").write_str("one").unwrap();
        std::os::unix::fs::symlink(
            elsewhere.path().join("shared"),
            temp.path().join("dist/cache"),
        )
        .unwrap();
        let index = watched();
        assert!(index.track(temp.path(), "dist"));
        assert!(index.list(temp.path(), "dist").is_some());

        let path = "dist/cache/out.js";
        assert!(index.is_listed(path), "an ancestor is listed");
        assert!(
            !index.members.read().contains(path),
            "the walk never listed it"
        );

        let first = index.hash_file(temp.path(), path, None, RunStage::NothingRan);
        assert!(index.trusted_hash(path).is_none());
        elsewhere.child("shared/out.js").write_str("two!").unwrap();
        assert_ne!(
            first,
            index.hash_file(temp.path(), path, None, RunStage::NothingRan)
        );
    }

    /// A tracked ancestor must not adopt a directory that would be refused on
    /// its own. Reached through `dist`, a `dist/cache` linked out of the
    /// workspace would otherwise be walked into, its outside files listed, and
    /// their hashes served without a stat that no watch event can ever clear.
    #[cfg(unix)]
    #[test]
    fn a_tracked_ancestor_does_not_adopt_a_directory_leading_outside() {
        let temp = workspace();
        let elsewhere = TempDir::new().unwrap();
        elsewhere.child("shared/out.js").write_str("one").unwrap();
        std::os::unix::fs::symlink(
            elsewhere.path().join("shared"),
            temp.path().join("dist/cache"),
        )
        .unwrap();
        let index = watched();

        assert!(index.track(temp.path(), "dist"));
        assert!(!index.track(temp.path(), "dist/cache"));
        assert!(index.list(temp.path(), "dist/cache").is_none());
        index.hash_file(temp.path(), "dist/cache/out.js", None, RunStage::NothingRan);
        assert!(index.trusted_hash("dist/cache/out.js").is_none());
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
        assert!(index.track(temp.path(), "dist"));
        assert!(
            index
                .list(temp.path(), "dist")
                .unwrap()
                .contains(&"dist/gen/link.js".to_string())
        );
        age(&temp.path().join("shared/real.js"));
        let first = index.hash_file(temp.path(), "dist/gen/link.js", None, RunStage::NothingRan);
        assert!(index.trusted_hash("dist/gen/link.js").is_none());
        // The watch reports the target, which is outside the prefix; the
        // link is re-checked by its stamp and sees the change.
        temp.child("shared/real.js").write_str("two!").unwrap();
        assert_ne!(
            first,
            index.hash_file(temp.path(), "dist/gen/link.js", None, RunStage::NothingRan)
        );
    }

    /// The listing must hold what a walk of the same directory would, or the
    /// two roads disagree: a linked file is a member wherever it points, a
    /// linked directory is not one.
    #[cfg(unix)]
    #[test]
    fn a_linked_file_leading_outside_is_a_member_but_a_linked_directory_is_not() {
        let temp = workspace();
        let elsewhere = TempDir::new().unwrap();
        elsewhere.child("built/out.js").write_str("out").unwrap();
        let index = watched();
        assert!(index.track(temp.path(), "dist"));
        std::os::unix::fs::symlink(
            elsewhere.path().join("built/out.js"),
            temp.path().join("dist/linked.js"),
        )
        .unwrap();
        index.note_written(temp.path(), "dist/linked.js");
        std::os::unix::fs::symlink(elsewhere.path().join("built"), temp.path().join("dist/lnk"))
            .unwrap();
        index.note_written(temp.path(), "dist/lnk");

        let listed = index.list(temp.path(), "dist").unwrap();
        assert!(listed.contains(&"dist/linked.js".to_string()), "{listed:?}");
        assert!(!listed.iter().any(|p| p.contains("lnk")), "{listed:?}");
        // Outside the watch, so it is re-stamped rather than served blind.
        assert!(index.trusted_hash("dist/linked.js").is_none());
    }

    #[test]
    fn a_stamp_from_before_an_event_never_makes_an_entry_trusted() {
        let temp = workspace();
        let index = watched();
        index.track(temp.path(), "dist");
        // A hash is trusted only under a listing, and the expansion asks for
        // one before it hashes anything.
        index.list(temp.path(), "dist").unwrap();
        let file = temp.path().join("dist/gen/a.js");
        age(&file);
        let old = stamp_of(&std::fs::metadata(&file).unwrap());
        index.hash_file(temp.path(), "dist/gen/a.js", None, RunStage::NothingRan);
        temp.child("dist/gen/a.js").write_str("rewritten").unwrap();
        age(&file);
        index.note_written(temp.path(), "dist/gen/a.js");
        // A walker's stamp from before the write matches the old entry: it
        // may answer, but it must not re-arm the trust.
        index.hash_file(
            temp.path(),
            "dist/gen/a.js",
            Some(old),
            RunStage::ATaskMayHaveWritten,
        );
        index.hash_file(
            temp.path(),
            "dist/gen/a.js",
            Some(old),
            RunStage::NothingRan,
        );
        assert!(index.trusted_hash("dist/gen/a.js").is_none());
        let fresh = index.hash_file(temp.path(), "dist/gen/a.js", None, RunStage::NothingRan);
        assert_eq!(fresh, index.trusted_hash("dist/gen/a.js"));
    }

    #[test]
    fn tracked_hashes_are_forgotten_with_their_files() {
        let temp = workspace();
        let index = watched();
        assert!(index.track(temp.path(), "dist/other"));
        // Tracked but never listed, as a declared output is: its hashes are
        // kept, and nothing is trusted, because no walk vouched for it.
        assert!(!index.is_listed("dist/other/c.js"));
        index.hash_file(
            temp.path(),
            "dist/other/c.js",
            None,
            RunStage::ATaskMayHaveWritten,
        );
        assert!(index.remembered("dist/other/c.js"));
        assert!(index.trusted_hash("dist/other/c.js").is_none());
        std::fs::remove_dir_all(temp.path().join("dist/other")).unwrap();
        index.note_deleted_all(&["dist/other"]);
        assert!(!index.remembered("dist/other/c.js"));
        // Outside every listed or kept prefix, a watching index keeps nothing.
        index.hash_file(
            temp.path(),
            "src/index.ts",
            None,
            RunStage::ATaskMayHaveWritten,
        );
        assert!(!index.remembered("src/index.ts"));
    }

    #[test]
    fn without_a_watch_every_listing_walks_again() {
        let temp = workspace();
        let index = IgnoredIndex::new(None);
        assert!(index.track(temp.path(), "dist"));
        index.list(temp.path(), "dist").unwrap();
        temp.child("dist/gen/late.js").write_str("late").unwrap();
        assert!(
            index
                .list(temp.path(), "dist")
                .unwrap()
                .contains(&"dist/gen/late.js".to_string()),
            "nothing keeps a listing current, so every ask walks"
        );
        // A narrower directory is absorbed rather than listed on its own.
        assert!(index.track(temp.path(), "dist/gen"));
        assert_eq!(index.tracked.read().len(), 1);
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
