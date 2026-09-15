use std::collections::{BTreeMap, HashMap, HashSet};
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::sync::Arc;
#[cfg(not(target_arch = "wasm32"))]
use std::time::{Duration, Instant, SystemTime};

use crate::native::glob::glob_files::glob_files;
use crate::native::hasher::hash;
use crate::native::project_graph::utils::{ProjectRootMappings, find_project_for_path};
use crate::native::types::FileData;
#[cfg(not(target_arch = "wasm32"))]
use crate::native::utils::file_lock::FileLock;
use crate::native::utils::{Normalize, NxCondvar, NxMutex, gather_stamp, path::get_child_files};
#[cfg(not(target_arch = "wasm32"))]
use crate::native::watch::types::{EventType, WatchEvent};
#[cfg(not(target_arch = "wasm32"))]
use crate::native::watch::{
    FlushMode, WatchEventCallback, WatchSession, create_filter, default_watch_globs,
};
#[cfg(not(target_arch = "wasm32"))]
use crate::native::workspace::files_archive::archive_modified_at;
use crate::native::workspace::files_archive::{
    FilesArchive, NxFileHashes, read_files_archive, write_files_archive,
};
use crate::native::workspace::files_hashing::{full_files_hash, selective_files_hash};
use crate::native::workspace::types::{
    FileMap, NxWorkspaceFilesExternals, ProjectFiles, UpdatedWorkspaceFiles,
};
use crate::native::workspace::{types::NxWorkspaceFiles, workspace_files};
#[cfg(not(target_arch = "wasm32"))]
use napi::bindgen_prelude::AsyncTask;
use napi::bindgen_prelude::External;
#[cfg(not(target_arch = "wasm32"))]
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
#[cfg(not(target_arch = "wasm32"))]
use napi::{Env, Task};
use parking_lot::Mutex;
use rayon::prelude::*;
use tracing::{trace, warn};
use xxhash_rust::xxh3;

#[napi(object)]
#[derive(Default, Debug, Clone)]
pub struct WorkspaceContextOptions {
    /// Keep the files current from a watcher the context owns. Watching
    /// starts before the scan, so nothing written after construction is
    /// missed. Off by default; ignored on wasm, which has no watcher.
    pub watch: Option<bool>,
    /// Extra globs the watch applies on top of the hardcoded ignores. A
    /// leading `!` admits a hardcoded-ignored path into the event stream
    /// (never into the files), as the daemon does for its own process file.
    pub watch_globs: Option<Vec<String>>,
}

#[napi]
pub struct WorkspaceContext {
    pub workspace_root: String,
    workspace_root_path: PathBuf,
    /// Retained so a re-walk can re-gather through the same files archive the
    /// initial gather used, keeping the walk incremental.
    cache_dir: String,
    files: FileState,
    batches: Publisher<ChangeBatch>,
    #[cfg(not(target_arch = "wasm32"))]
    events: Publisher<Vec<WatchEvent>>,
    #[cfg(not(target_arch = "wasm32"))]
    watch: Mutex<Option<WatchSession>>,
}

/// Sorted by path, which is the order every reader hands out.
type Files = BTreeMap<PathBuf, String>;

const NX_FILES_LOCK: &str = "nx_files.lock";

#[cfg(not(target_arch = "wasm32"))]
const WALK_WAIT_VAR: &str = "NX_WORKSPACE_WALK_WAIT_MS";
#[cfg(not(target_arch = "wasm32"))]
const DEFAULT_WALK_WAIT: Duration = Duration::from_secs(60);
/// A wait this long is a wedge with a name on it, so anything above is capped.
#[cfg(not(target_arch = "wasm32"))]
const MAX_WALK_WAIT: Duration = Duration::from_secs(3600);

/// How long a process waits for another process's walk before walking itself.
/// The default is longer than any walk measured so far (27 s on a saturated CI
/// disk) and short enough that a stuck holder cannot pin every nx in the
/// checkout. A workspace whose walk legitimately takes longer raises it.
#[cfg(not(target_arch = "wasm32"))]
fn files_lock_wait() -> Duration {
    walk_wait_from(std::env::var(WALK_WAIT_VAR).ok().as_deref())
}

#[cfg(not(target_arch = "wasm32"))]
fn walk_wait_from(configured: Option<&str>) -> Duration {
    let Some(value) = configured else {
        return DEFAULT_WALK_WAIT;
    };
    match value.trim().parse::<u64>() {
        Ok(ms) if Duration::from_millis(ms) > MAX_WALK_WAIT => {
            trace!("{WALK_WAIT_VAR}={value:?} is above the cap, waiting {MAX_WALK_WAIT:?}");
            MAX_WALK_WAIT
        }
        Ok(ms) => Duration::from_millis(ms),
        Err(_) => {
            trace!(
                "{WALK_WAIT_VAR}={value:?} is not a non-negative whole number of milliseconds, waiting {DEFAULT_WALK_WAIT:?}"
            );
            DEFAULT_WALK_WAIT
        }
    }
}

/// Every files lock this process has started waiting on, one entry per wait.
/// Tests count entries for their own lock to know a waiter is really waiting
/// before they release the holder; keyed by path so parallel tests cannot
/// satisfy each other.
#[cfg(all(test, not(target_arch = "wasm32")))]
static WAITS_STARTED: std::sync::Mutex<Vec<PathBuf>> = std::sync::Mutex::new(Vec::new());

#[cfg(all(test, not(target_arch = "wasm32")))]
fn note_wait_started(lock_path: &Path) {
    WAITS_STARTED.lock().unwrap().push(lock_path.to_path_buf());
}

#[cfg(all(not(test), not(target_arch = "wasm32")))]
fn note_wait_started(_lock_path: &Path) {}

#[cfg(all(test, not(target_arch = "wasm32")))]
fn waits_started_on(lock_path: &Path) -> usize {
    WAITS_STARTED
        .lock()
        .unwrap()
        .iter()
        .filter(|p| p.as_path() == lock_path)
        .count()
}

/// Waits for the walk behind a context on a libuv thread, so JS can await the
/// files without holding its own thread while the walk runs.
#[cfg(not(target_arch = "wasm32"))]
pub struct FilesReady(FileState);

#[cfg(not(target_arch = "wasm32"))]
impl Task for FilesReady {
    type Output = ();
    type JsValue = ();

    fn compute(&mut self) -> napi::Result<()> {
        self.0.wait_ready();
        Ok(())
    }

    fn resolve(&mut self, _env: Env, _output: ()) -> napi::Result<()> {
        Ok(())
    }
}

/// Sorted first so the map is bulk-built from ordered input instead of
/// re-sorting one path at a time.
fn hashes_to_files(hashes: NxFileHashes) -> Files {
    let mut files: Vec<(PathBuf, String)> = hashes
        .into_iter()
        .map(|(path, hashed)| (PathBuf::from(path), hashed.0))
        .collect();
    files.par_sort();
    files.into_iter().collect()
}

fn archive_to_files(archive: FilesArchive) -> Files {
    let mut files: Vec<(PathBuf, String)> = archive
        .iter()
        .map(|(path, hash, _)| (PathBuf::from(path), hash.to_owned()))
        .collect();
    files.par_sort();
    files.into_iter().collect()
}

/// Produces this process's view of the workspace files while letting the
/// processes that share a workspace share one walk. The walk runs under
/// `nx_files.lock`; a process that arrives while another is walking waits and
/// loads the archive that walk writes, rather than walking too. A holder that
/// died before writing leaves an old archive behind, so a waiter only trusts an
/// archive written after it started waiting and otherwise walks itself.
///
/// `trust_archive` is for plugin workers: the host starts its walk before it
/// spawns them, so a worker may well be asked for files while that walk is
/// still running. The lock wait below covers that: once the lock is free the
/// host has written its archive, and that archive is what the worker loads
/// instead of walking. It still walks when there is no archive at all, or when
/// the wait runs out.
///
/// Neither wait is open-ended. A holder that outlasts `wait_for` (suspended,
/// on a filesystem that has stalled, or walking a workspace that takes longer
/// than that) costs the waiter the whole wait and then an unshared walk of its
/// own. Below the bound this is the shared walk; above it, it is slower than
/// walking straight away, which is why the bound can be raised.
#[cfg(not(target_arch = "wasm32"))]
fn acquire_files(
    workspace_root: &Path,
    cache_dir: &str,
    trust_archive: bool,
    wait_for: Duration,
) -> Files {
    let lock_path = Path::new(cache_dir).join(NX_FILES_LOCK);
    let mut lock = match FileLock::new(lock_path.to_string_lossy().to_string()) {
        Ok(lock) => lock,
        Err(e) => {
            trace!(
                "could not open {}, walking unshared: {e:?}",
                lock_path.display()
            );
            return gather_and_hash_files(workspace_root, cache_dir.to_owned());
        }
    };

    let deadline = Instant::now() + wait_for;
    let remaining = || deadline.saturating_duration_since(Instant::now());

    loop {
        if trust_archive {
            if lock.check().unwrap_or(false) {
                note_wait_started(&lock_path);
                match lock.wait_blocking(remaining()) {
                    Ok(true) => {}
                    Ok(false) => {
                        trace!(
                            "the walk holding the files lock outlasted the wait, walking unshared"
                        );
                        return gather_and_hash_files(workspace_root, cache_dir.to_owned());
                    }
                    Err(e) => {
                        trace!("could not wait on the files lock, walking unshared: {e:?}");
                        return gather_and_hash_files(workspace_root, cache_dir.to_owned());
                    }
                }
            }
            if let Some(archive) = read_files_archive(cache_dir) {
                trace!(
                    "loaded {} files from the archive without walking",
                    archive.len()
                );
                return archive_to_files(archive);
            }
        }

        match lock.try_lock() {
            Ok(true) => {
                let files = gather_and_hash_files(workspace_root, cache_dir.to_owned());
                let _ = lock.unlock();
                return files;
            }
            Ok(false) => {
                // Sampled before the wait, so an archive the holder writes while
                // this process waits counts as fresh. Sampled after, no waiter
                // would ever accept one and every waiter would walk.
                let waited_from = SystemTime::now();
                trace!("another process is walking the workspace, waiting for its archive");
                note_wait_started(&lock_path);
                match lock.wait_blocking(remaining()) {
                    Ok(true) => {}
                    Ok(false) => {
                        trace!(
                            "the walk holding the files lock outlasted the wait, walking unshared"
                        );
                        return gather_and_hash_files(workspace_root, cache_dir.to_owned());
                    }
                    Err(e) => {
                        trace!("could not wait on the files lock, walking unshared: {e:?}");
                        return gather_and_hash_files(workspace_root, cache_dir.to_owned());
                    }
                }
                let fresh =
                    archive_modified_at(cache_dir).is_some_and(|written| written >= waited_from);
                if let Some(archive) = fresh.then(|| read_files_archive(cache_dir)).flatten() {
                    trace!(
                        "loaded {} files from the archive another process wrote",
                        archive.len()
                    );
                    return archive_to_files(archive);
                }
                trace!("the other walk left no fresh archive, trying for the lock again");
                if remaining().is_zero() {
                    trace!("no time left to wait for another walk, walking unshared");
                    return gather_and_hash_files(workspace_root, cache_dir.to_owned());
                }
            }
            Err(e) => {
                trace!(
                    "could not take {}, walking unshared: {e:?}",
                    lock_path.display()
                );
                return gather_and_hash_files(workspace_root, cache_dir.to_owned());
            }
        }
    }
}

/// What one application of changes did to the files. `seq` is the context's
/// change sequence afterwards; it is unchanged, and the lists empty, when
/// nothing the batch reported was really different.
#[napi(object)]
#[derive(Default, Debug, Clone)]
pub struct ChangeBatch {
    pub seq: i64,
    pub created_files: Vec<FileData>,
    pub updated_files: Vec<FileData>,
    pub deleted_files: Vec<String>,
}

impl ChangeBatch {
    pub fn is_empty(&self) -> bool {
        self.created_files.is_empty()
            && self.updated_files.is_empty()
            && self.deleted_files.is_empty()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ChangeKind {
    Created,
    Updated,
    Deleted,
    /// The reporter lost events; only a re-walk can say what changed.
    Rescan,
}

/// One reported filesystem change, before the context has looked at the disk.
#[derive(Debug, Clone)]
pub(crate) struct Change {
    path: String,
    kind: ChangeKind,
}

impl Change {
    fn rescan() -> Self {
        Change {
            path: String::new(),
            kind: ChangeKind::Rescan,
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl From<WatchEvent> for Change {
    fn from(event: WatchEvent) -> Self {
        let kind = match event.r#type {
            EventType::create => ChangeKind::Created,
            EventType::update => ChangeKind::Updated,
            EventType::delete => ChangeKind::Deleted,
            EventType::rescan => ChangeKind::Rescan,
        };
        Change {
            path: event.path,
            kind,
        }
    }
}

/// What actually happened to one path, after the disk was consulted.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Outcome {
    Created(String),
    Updated(String),
    Deleted,
}

/// Keyed by path so a later outcome for the same path replaces an earlier one
/// when two applications are folded together.
type Outcomes = BTreeMap<String, Outcome>;

fn outcomes_to_batch(outcomes: Outcomes, seq: u64) -> ChangeBatch {
    let mut batch = ChangeBatch {
        seq: seq as i64,
        ..Default::default()
    };
    for (file, outcome) in outcomes {
        match outcome {
            Outcome::Created(hash) => batch.created_files.push(FileData { file, hash }),
            Outcome::Updated(hash) => batch.updated_files.push(FileData { file, hash }),
            Outcome::Deleted => batch.deleted_files.push(file),
        }
    }
    batch
}

fn diff_files(before: &Files, after: &Files) -> Outcomes {
    let mut outcomes = Outcomes::new();
    for (path, hash) in after {
        match before.get(path) {
            None => {
                outcomes.insert(path.to_normalized_string(), Outcome::Created(hash.clone()));
            }
            Some(previous) if previous != hash => {
                outcomes.insert(path.to_normalized_string(), Outcome::Updated(hash.clone()));
            }
            Some(_) => {}
        }
    }
    // Whatever the walk did not find is gone. Ground truth, not inference
    // from a prior event stream that is by definition incomplete here.
    for path in before.keys() {
        if !after.contains_key(path) {
            outcomes.insert(path.to_normalized_string(), Outcome::Deleted);
        }
    }
    outcomes
}

fn gather_and_hash_files(workspace_root: &Path, cache_dir: String) -> Files {
    let archived_files = read_files_archive(&cache_dir);

    trace!("Gathering files in {}", workspace_root.display());
    let now = std::time::Instant::now();
    // Taken before the walk, not after: an entry read at any point from here on
    // may be rewritten within its own mtime tick, so the next gather has to
    // re-hash it rather than trust the timestamp. See `selective_files_hash`.
    let gathered_at = gather_stamp();
    let file_hashes = if let Some(archived_files) = archived_files {
        selective_files_hash(workspace_root, &archived_files)
    } else {
        full_files_hash(workspace_root)
    }
    .with_gathered_at(gathered_at);

    write_files_archive(&cache_dir, &file_hashes);

    // Drain the map rather than clone it: the path and hash strings move into
    // the map, so the list is never held twice.
    let files = hashes_to_files(file_hashes);
    trace!("hashed and sorted files in {:?}", now.elapsed());

    files
}

/// Where the files behind a context are in their lifecycle.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Phase {
    /// A walk is producing the list. Readers wait; changes queue.
    Scanning,
    /// The list is current up to the last change applied.
    Ready,
}

/// Whether a reported write to a workspace-relative path belongs in the
/// files. A watching context has one: its watch admits more than the files
/// should hold, so the ignore rules apply here, at the one place a path enters
/// the files, rather than at the watch. Caller-supplied updates are held to
/// the same rule, so the files never diverge from what a walk would find. A
/// context without a watch has none and trusts its callers as before, since
/// building the rules means walking the workspace for ignore files.
type Policy = Arc<dyn Fn(&str) -> bool + Send + Sync>;

struct State {
    phase: Phase,
    policy: Option<Policy>,
    /// Kept through a re-walk so its result can be diffed against it.
    files: Files,
    /// Changes reported during a walk, applied on top of its result. A file
    /// the walk also saw is re-hashed, which lands on the same answer.
    queued: Vec<Change>,
    /// Bumped once per application that changed anything. A reader that
    /// remembers the value it last saw can tell whether the files moved.
    change_seq: u64,
}

/// Who is asking to apply changes, which decides what happens during a walk.
#[derive(Clone, Copy)]
enum WhenScanning {
    /// Queue for the walk to apply; the answer is empty for now.
    Queue,
    /// Wait for the walk, then apply. For callers that read the answer.
    Wait,
}

/// The files, shared with the walk thread and the watch pipeline. `None` when
/// the workspace root does not exist.
#[derive(Clone, Default)]
struct FileState(Option<Arc<(NxMutex<State>, NxCondvar)>>);

impl FileState {
    fn new(workspace_root: &Path, policy: Option<Policy>) -> Self {
        if !workspace_root.exists() {
            warn!(
                "workspace root does not exist: {}",
                workspace_root.display()
            );
            return FileState(None);
        }
        FileState(Some(Arc::new((
            NxMutex::new(State {
                phase: Phase::Scanning,
                policy,
                files: Files::new(),
                queued: Vec::new(),
                change_seq: 0,
            }),
            NxCondvar::new(),
        ))))
    }

    /// Runs the first walk off-thread. The state stays `Scanning` until it
    /// lands, so readers wait and reported changes queue behind it.
    #[cfg(not(target_arch = "wasm32"))]
    fn scan(&self, workspace_root: &Path, cache_dir: String, trust_archive: bool) {
        let Some(_) = &self.0 else {
            return;
        };
        let state = self.clone();
        let workspace_root = workspace_root.to_owned();
        std::thread::spawn(move || {
            let files = acquire_files(
                &workspace_root,
                &cache_dir,
                trust_archive,
                files_lock_wait(),
            );
            trace!(files_len = files.len(), "files retrieved");
            state.finish_walk(&workspace_root, files, true);
        });
    }

    #[cfg(target_arch = "wasm32")]
    fn scan(&self, workspace_root: &Path, cache_dir: String, trust_archive: bool) {
        let Some(_) = &self.0 else {
            return;
        };
        let files = match trust_archive
            .then(|| read_files_archive(&cache_dir))
            .flatten()
        {
            Some(archive) => archive_to_files(archive),
            None => gather_and_hash_files(workspace_root, cache_dir),
        };
        trace!("{} files retrieved", files.len());
        self.finish_walk(workspace_root, files, true);
    }

    /// Marks a walk in progress. False, doing nothing, when one already is.
    fn begin_walk(&self) -> bool {
        let Some(sync) = &self.0 else {
            return false;
        };
        let (lock, _) = sync.deref();
        let mut state = lock.lock().expect("Should be able to lock files");
        if state.phase == Phase::Scanning {
            return false;
        }
        state.phase = Phase::Scanning;
        true
    }

    /// Adopts a walk's result and reports what it changed: the diff against
    /// the list it replaces (none for the first walk), with the changes queued
    /// during the walk applied on top. Wakes every waiting reader.
    fn finish_walk(&self, workspace_root: &Path, fresh: Files, initial: bool) -> ChangeBatch {
        let Some(sync) = &self.0 else {
            return ChangeBatch::default();
        };
        let (lock, cvar) = sync.deref();
        let mut state = lock.lock().expect("Should be able to lock files");
        let mut outcomes = if initial {
            Outcomes::new()
        } else {
            diff_files(&state.files, &fresh)
        };
        state.files = fresh;
        // A queued rescan is satisfied by the walk that just landed.
        let queued: Vec<Change> = std::mem::take(&mut state.queued)
            .into_iter()
            .filter(|c| c.kind != ChangeKind::Rescan)
            .collect();
        outcomes.extend(apply(&mut state, workspace_root, queued));
        let batch = seal(&mut state, outcomes);
        state.phase = Phase::Ready;
        drop(state);
        cvar.notify_all();
        batch
    }

    fn wait_ready(&self) {
        let Some(sync) = &self.0 else {
            return;
        };
        let (lock, cvar) = sync.deref();
        let state = lock.lock().expect("Should be able to lock files");
        let _ready = cvar
            .wait(state, |s| s.phase == Phase::Scanning)
            .expect("Should be able to wait for files");
    }

    fn change_seq(&self) -> u64 {
        let Some(sync) = &self.0 else {
            return 0;
        };
        let (lock, _) = sync.deref();
        lock.lock()
            .expect("Should be able to lock files")
            .change_seq
    }

    /// Applies reported changes, consulting the disk for each, and says what
    /// really changed. A rescan re-walks instead, under `Scanning` so anything
    /// reported meanwhile queues rather than racing the walk.
    fn ingest(
        &self,
        workspace_root: &Path,
        cache_dir: &str,
        changes: Vec<Change>,
        when_scanning: WhenScanning,
    ) -> ChangeBatch {
        let Some(sync) = &self.0 else {
            trace!("there were no files because the workspace root did not exist");
            return ChangeBatch::default();
        };
        if changes.is_empty() {
            return ChangeBatch::default();
        }
        let (lock, cvar) = sync.deref();
        let mut state = lock.lock().expect("Should be able to lock files");
        match when_scanning {
            WhenScanning::Queue if state.phase == Phase::Scanning => {
                state.queued.extend(changes);
                return ChangeBatch::default();
            }
            WhenScanning::Queue => {}
            WhenScanning::Wait => {
                state = cvar
                    .wait(state, |s| s.phase == Phase::Scanning)
                    .expect("Should be able to wait for files");
            }
        }
        if changes.iter().any(|c| c.kind == ChangeKind::Rescan) {
            // Walk before locking: the walk is the slow part and readers should
            // not block on it any longer than the phase already makes them.
            state.phase = Phase::Scanning;
            drop(state);
            let fresh = gather_and_hash_files(workspace_root, cache_dir.to_owned());
            return self.finish_walk(workspace_root, fresh, false);
        }
        let outcomes = apply(&mut state, workspace_root, changes);
        seal(&mut state, outcomes)
    }

    fn get_files(&self) -> Vec<FileData> {
        let Some(sync) = &self.0 else {
            return vec![];
        };
        let (lock, cvar) = sync.deref();
        trace!("waiting for files to be available");
        let state = lock.lock().expect("Should be able to lock files");
        let state = cvar
            .wait(state, |s| s.phase == Phase::Scanning)
            .expect("Should be able to wait for files");
        let file_data = state
            .files
            .iter()
            .map(|(path, hash)| FileData {
                file: path.to_normalized_string(),
                hash: hash.clone(),
            })
            .collect();
        trace!("files are available");
        file_data
    }
}

/// Bumps the sequence when anything changed and turns the outcomes into the
/// batch a subscriber sees.
fn seal(state: &mut State, outcomes: Outcomes) -> ChangeBatch {
    if !outcomes.is_empty() {
        state.change_seq += 1;
    }
    outcomes_to_batch(outcomes, state.change_seq)
}

/// Applies changes to the list. Deletes first, so a path both deleted and
/// rewritten in one batch ends up present. A path reported deleted that the
/// list has no file for is taken as a directory and everything under it goes.
/// A reported write is re-read and re-hashed; one that cannot be read (a
/// directory, or a file gone again already) is skipped, and one whose bytes
/// did not change is not reported: restoring a cached task output rewrites a
/// file with identical content, and treating that as a change makes the
/// daemon recompute the project graph for nothing.
fn apply(state: &mut State, workspace_root: &Path, changes: Vec<Change>) -> Outcomes {
    let mut outcomes = Outcomes::new();

    for change in changes.iter().filter(|c| c.kind == ChangeKind::Deleted) {
        let key = PathBuf::from(&change.path);
        if state.files.remove(&key).is_some() {
            outcomes.insert(change.path.clone(), Outcome::Deleted);
            continue;
        }
        // Path order puts a directory's files right after it, so the scan
        // stops at the first path outside it.
        let under: Vec<PathBuf> = state
            .files
            .range(key.clone()..)
            .take_while(|(path, _)| path.starts_with(&key))
            .map(|(path, _)| path.clone())
            .collect();
        for path in under {
            state.files.remove(&path);
            outcomes.insert(path.to_normalized_string(), Outcome::Deleted);
        }
    }

    let policy = state.policy.clone();
    let hashed: Vec<(&Change, String)> = changes
        .par_iter()
        .filter(|c| matches!(c.kind, ChangeKind::Created | ChangeKind::Updated))
        .filter(|c| policy.as_ref().is_none_or(|admits| admits(&c.path)))
        .filter_map(|change| {
            let full_path = workspace_root.join(&change.path);
            let Ok(content) = std::fs::read(&full_path) else {
                trace!("could not read file: {full_path:?}");
                return None;
            };
            Some((change, hash(&content)))
        })
        .collect();

    for (change, new_hash) in hashed {
        let key = PathBuf::from(&change.path);
        if state
            .files
            .get(&key)
            .is_some_and(|existing| *existing == new_hash)
        {
            continue;
        }
        state.files.insert(key, new_hash.clone());
        let outcome = if change.kind == ChangeKind::Created {
            Outcome::Created(new_hash)
        } else {
            Outcome::Updated(new_hash)
        };
        outcomes.insert(change.path.clone(), outcome);
    }

    outcomes
}

/// Where what the context produces goes. The daemon subscribes once; until
/// then deliveries are dropped, and an error is held for the subscriber that
/// arrives.
pub(crate) type Sink<T> = Arc<dyn Fn(std::result::Result<T, String>) + Send + Sync + 'static>;

struct Publisher<T>(Arc<Mutex<PublisherState<T>>>);

impl<T> Clone for Publisher<T> {
    fn clone(&self) -> Self {
        Publisher(Arc::clone(&self.0))
    }
}

impl<T> Default for Publisher<T> {
    fn default() -> Self {
        Publisher(Arc::new(Mutex::new(PublisherState {
            sink: None,
            pending_error: None,
        })))
    }
}

struct PublisherState<T> {
    sink: Option<Sink<T>>,
    pending_error: Option<String>,
}

impl<T> Publisher<T> {
    fn publish(&self, result: std::result::Result<T, String>) {
        let mut state = self.0.lock();
        match (&state.sink, result) {
            (Some(sink), result) => {
                let sink = Arc::clone(sink);
                drop(state);
                sink(result);
            }
            (None, Err(message)) => state.pending_error = Some(message),
            (None, Ok(_)) => {}
        }
    }

    fn subscribe(&self, sink: Sink<T>) {
        let mut state = self.0.lock();
        let held = state.pending_error.take();
        state.sink = Some(Arc::clone(&sink));
        drop(state);
        if let Some(message) = held {
            sink(Err(message));
        }
    }

    fn clear(&self) {
        self.0.lock().sink = None;
    }
}

#[napi]
impl WorkspaceContext {
    #[napi(constructor)]
    pub fn new(
        workspace_root: String,
        cache_dir: String,
        options: Option<WorkspaceContextOptions>,
    ) -> napi::Result<Self> {
        trace!(?workspace_root);
        Self::build(
            workspace_root,
            cache_dir,
            options.unwrap_or_default(),
            false,
        )
    }

    /// Loads the files the last walk recorded instead of walking. For a
    /// process whose host already walked, such as a plugin worker.
    #[napi(factory)]
    pub fn from_archive(
        workspace_root: String,
        cache_dir: String,
        options: Option<WorkspaceContextOptions>,
    ) -> napi::Result<Self> {
        trace!(?workspace_root, "from archive");
        Self::build(workspace_root, cache_dir, options.unwrap_or_default(), true)
    }

    /// Watching starts before the scan, in this order, on purpose: a write
    /// landing after the watches are live is reported and applied on top of
    /// the scan, so there is no window in which it is invisible to both.
    fn build(
        workspace_root: String,
        cache_dir: String,
        options: WorkspaceContextOptions,
        trust_archive: bool,
    ) -> napi::Result<Self> {
        let workspace_root_path = PathBuf::from(&workspace_root);
        let batches = Publisher::default();
        #[cfg(not(target_arch = "wasm32"))]
        let events = Publisher::default();

        #[cfg(not(target_arch = "wasm32"))]
        let (files, watch) = if options.watch.unwrap_or(false) && workspace_root_path.exists() {
            let failed = |msg| napi::Error::new(napi::Status::GenericFailure, msg);
            let policy = Self::workspace_policy(&workspace_root_path).map_err(failed)?;
            let files = FileState::new(&workspace_root_path, Some(policy));
            let session = Self::start_watching(
                workspace_root.clone(),
                &workspace_root_path,
                &cache_dir,
                options.watch_globs.unwrap_or_default(),
                &files,
                &batches,
                &events,
            )
            .map_err(failed)?;
            (files, Some(session))
        } else {
            (FileState::new(&workspace_root_path, None), None)
        };
        #[cfg(target_arch = "wasm32")]
        let files = {
            let _ = options;
            FileState::new(&workspace_root_path, None)
        };

        files.scan(&workspace_root_path, cache_dir.clone(), trust_archive);

        Ok(WorkspaceContext {
            files,
            batches,
            #[cfg(not(target_arch = "wasm32"))]
            events,
            workspace_root,
            workspace_root_path,
            cache_dir,
            #[cfg(not(target_arch = "wasm32"))]
            watch: Mutex::new(watch),
        })
    }

    /// The ignore rules a walk applies, as a predicate on a workspace-relative
    /// file path. Built against the canonical root, which is what event paths
    /// are relative to.
    #[cfg(not(target_arch = "wasm32"))]
    fn workspace_policy(workspace_root_path: &Path) -> std::result::Result<Policy, String> {
        let origin = dunce::canonicalize(workspace_root_path)
            .unwrap_or_else(|_| workspace_root_path.to_path_buf());
        let filter = create_filter(&origin.to_string_lossy(), &default_watch_globs(), true)
            .map_err(|e| format!("failed to build the workspace ignore rules: {e}"))?;
        Ok(Arc::new(move |path: &str| {
            filter.admits(&origin.join(path), false)
        }))
    }

    #[cfg(not(target_arch = "wasm32"))]
    /// One watch serves both the files and the raw event stream, so it is
    /// gated only by the hardcoded ignores, the root `.nxignore` and the
    /// caller's globs: everything a walk would skip still reaches the stream,
    /// and the files apply the walk's rules themselves (see `Policy`).
    #[cfg(not(target_arch = "wasm32"))]
    fn start_watching(
        workspace_root: String,
        workspace_root_path: &Path,
        cache_dir: &str,
        extra_globs: Vec<String>,
        files: &FileState,
        batches: &Publisher<ChangeBatch>,
        events: &Publisher<Vec<WatchEvent>>,
    ) -> std::result::Result<WatchSession, String> {
        let files = files.clone();
        let batches = batches.clone();
        let events = events.clone();
        let root = workspace_root_path.to_owned();
        let cache_dir = cache_dir.to_owned();
        let callback: WatchEventCallback = Box::new(move |result| match result {
            Ok(delivered) => {
                events.publish(Ok(delivered.clone()));
                let changes = delivered.into_iter().map(Change::from).collect();
                let batch = files.ingest(&root, &cache_dir, changes, WhenScanning::Queue);
                if !batch.is_empty() {
                    batches.publish(Ok(batch));
                }
            }
            Err(message) => {
                events.publish(Err(message.clone()));
                batches.publish(Err(message));
            }
        });
        let mut globs = default_watch_globs();
        globs.extend(extra_globs);
        WatchSession::start(workspace_root, &globs, false, callback)
    }

    /// Pulls what the watch pipeline holds into the files. Returns the batch
    /// for the caller to publish or hand back; empty when not watching.
    #[cfg(not(target_arch = "wasm32"))]
    fn drain(&self, mode: FlushMode, when_scanning: WhenScanning) -> ChangeBatch {
        // Cloned out so the lock is not held through the pipeline round trip.
        let Some(session) = self.watch.lock().clone() else {
            return ChangeBatch::default();
        };
        let delivered = session.flush(mode);
        if delivered.is_empty() {
            return ChangeBatch::default();
        }
        self.events.publish(Ok(delivered.clone()));
        let changes = delivered.into_iter().map(Change::from).collect();
        self.files.ingest(
            &self.workspace_root_path,
            &self.cache_dir,
            changes,
            when_scanning,
        )
    }

    /// The files as of now: whatever the watcher has delivered is applied
    /// first, and a subscriber hears about it as it would any other batch.
    fn current_files(&self) -> Vec<FileData> {
        #[cfg(not(target_arch = "wasm32"))]
        {
            let batch = self.drain(FlushMode::Delivered, WhenScanning::Queue);
            if !batch.is_empty() {
                self.batches.publish(Ok(batch));
            }
        }
        self.files.get_files()
    }

    /// Subscribes to the batches the context applies: from its watcher, from
    /// a walk, and from reads that pulled changes in. Replaces any earlier
    /// subscriber. A batch `settle` or `incrementalUpdate` hands back to its
    /// caller is not repeated here.
    #[cfg(not(target_arch = "wasm32"))]
    #[napi]
    pub fn on_changes(
        &self,
        #[napi(ts_arg_type = "(err: string | null, batch: ChangeBatch) => void")]
        callback: ThreadsafeFunction<ChangeBatch>,
    ) {
        self.batches.subscribe(Arc::new(move |result| match result {
            Ok(batch) => {
                callback.call(Ok(batch), ThreadsafeFunctionCallMode::NonBlocking);
            }
            Err(message) => {
                callback.call(
                    Err(napi::Error::new(napi::Status::GenericFailure, message)),
                    ThreadsafeFunctionCallMode::NonBlocking,
                );
            }
        }));
    }

    /// Subscribes to every event the watch delivers, whether or not it
    /// concerns the files: writes under ignored directories included, and
    /// the `rescan` marker when the kernel dropped events. Replaces any
    /// earlier subscriber. Batches applied to the files are `onChanges`.
    #[cfg(not(target_arch = "wasm32"))]
    #[napi]
    pub fn on_watch_events(
        &self,
        #[napi(ts_arg_type = "(err: string | null, events: WatchEvent[]) => void")]
        callback: ThreadsafeFunction<Vec<WatchEvent>>,
    ) {
        self.events.subscribe(Arc::new(move |result| match result {
            Ok(events) => {
                callback.call(Ok(events), ThreadsafeFunctionCallMode::NonBlocking);
            }
            Err(message) => {
                callback.call(
                    Err(napi::Error::new(napi::Status::GenericFailure, message)),
                    ThreadsafeFunctionCallMode::NonBlocking,
                );
            }
        }));
    }

    /// Waits for the kernel→watcher hop to settle and applies everything it
    /// delivered, so a write made before the call is in the files. Blocks the
    /// caller for up to the settle cap, and through any walk in progress.
    /// Returns what it applied; that batch is the caller's to route, and
    /// subscribers do not see it.
    #[cfg(not(target_arch = "wasm32"))]
    #[napi]
    pub fn settle(&self) -> ChangeBatch {
        self.drain(FlushMode::Settled, WhenScanning::Wait)
    }

    /// Stops the watcher and forgets the subscriber. The files stay as they
    /// were; reads no longer pull anything in.
    #[cfg(not(target_arch = "wasm32"))]
    #[napi]
    pub fn stop_watching(&self) {
        *self.watch.lock() = None;
        self.batches.clear();
        self.events.clear();
    }

    /// Bumped once per applied batch that changed anything. Equal values
    /// mean equal files, so a consumer that remembers the value it computed
    /// from can skip recomputing.
    #[napi]
    pub fn change_seq(&self) -> i64 {
        self.files.change_seq() as i64
    }

    /// Walks the workspace again into this context, so it and the archive
    /// include writes made since the last walk. Does nothing while a walk is
    /// in progress. Await `ready()` before reading. What the walk finds
    /// changed goes to the subscriber.
    #[napi]
    pub fn refresh(&self) -> bool {
        if !self.files.begin_walk() {
            return false;
        }
        let files = self.files.clone();
        let publisher = self.batches.clone();
        let workspace_root = self.workspace_root_path.clone();
        let cache_dir = self.cache_dir.clone();
        let walk = move || {
            #[cfg(not(target_arch = "wasm32"))]
            let fresh = acquire_files(&workspace_root, &cache_dir, false, files_lock_wait());
            #[cfg(target_arch = "wasm32")]
            let fresh = gather_and_hash_files(&workspace_root, cache_dir);
            let batch = files.finish_walk(&workspace_root, fresh, false);
            trace!("files refreshed");
            if !batch.is_empty() {
                publisher.publish(Ok(batch));
            }
        };
        #[cfg(not(target_arch = "wasm32"))]
        std::thread::spawn(walk);
        #[cfg(target_arch = "wasm32")]
        walk();
        true
    }

    /// Resolves once the files behind this context exist. The readers below
    /// block the calling thread until they do; awaiting this first keeps a
    /// plugin host responsive while its workers are connecting.
    #[cfg(not(target_arch = "wasm32"))]
    #[napi(ts_return_type = "Promise<void>")]
    pub fn ready(&self) -> AsyncTask<FilesReady> {
        AsyncTask::new(FilesReady(self.files.clone()))
    }

    /// On wasm the files are gathered when the context is constructed.
    #[cfg(target_arch = "wasm32")]
    #[napi]
    pub fn ready(&self) {}

    #[napi]
    pub fn get_workspace_files(
        &self,
        project_root_map: HashMap<String, String>,
    ) -> anyhow::Result<NxWorkspaceFiles> {
        workspace_files::get_files(project_root_map, self.current_files())
            .map_err(anyhow::Error::from)
    }

    #[napi]
    pub fn glob(
        &self,
        globs: Vec<String>,
        exclude: Option<Vec<String>>,
    ) -> napi::Result<Vec<String>> {
        let file_data = self.current_files();
        let globbed_files = glob_files(&file_data, globs, exclude)?;
        Ok(globbed_files.map(|file| file.file.to_owned()).collect())
    }

    /// Performs multiple glob pattern matches against workspace files in parallel
    /// @returns An array of arrays, where each inner array contains the file paths
    /// that matched the corresponding glob pattern in the input. The outer array maintains the same order
    /// as the input globs.
    #[napi]
    pub fn multi_glob(
        &self,
        globs: Vec<String>,
        exclude: Option<Vec<String>>,
    ) -> napi::Result<Vec<Vec<String>>> {
        let file_data = self.current_files();

        globs
            .into_iter()
            .map(|glob| {
                let globbed_files = glob_files(&file_data, vec![glob], exclude.clone())?;
                Ok(globbed_files.map(|file| file.file.to_owned()).collect())
            })
            .collect()
    }

    #[napi]
    pub fn hash_files_matching_globs(
        &self,
        glob_groups: Vec<Vec<String>>,
    ) -> napi::Result<Vec<String>> {
        let files = &self.current_files();
        let hashes = glob_groups
            .into_iter()
            .map(|globs| {
                let globbed_files = glob_files(files, globs, None)?.collect::<Vec<_>>();
                let mut hasher = xxh3::Xxh3::new();
                for file in globbed_files {
                    hasher.update(file.file.as_bytes());
                    hasher.update(file.hash.as_bytes());
                }
                Ok(hasher.digest().to_string())
            })
            .collect::<napi::Result<Vec<_>>>()?;

        Ok(hashes)
    }

    #[napi]
    pub fn hash_files_matching_glob(
        &self,
        globs: Vec<String>,
        exclude: Option<Vec<String>>,
    ) -> napi::Result<String> {
        let files = &self.current_files();
        let globbed_files = glob_files(files, globs, exclude)?.collect::<Vec<_>>();

        let mut hasher = xxh3::Xxh3::new();
        for file in globbed_files {
            hasher.update(file.file.as_bytes());
            hasher.update(file.hash.as_bytes());
        }

        Ok(hasher.digest().to_string())
    }

    /// Applies changes a caller learned of on its own. Waits through a walk in
    /// progress so the answer reflects them. Returns the hash of every file
    /// whose content really changed; the batch is not repeated to subscribers.
    #[napi]
    pub fn incremental_update(
        &self,
        updated_files: Vec<String>,
        deleted_files: Vec<String>,
    ) -> HashMap<String, String> {
        let changes = deleted_files
            .into_iter()
            .map(|path| Change {
                path,
                kind: ChangeKind::Deleted,
            })
            .chain(updated_files.into_iter().map(|path| Change {
                path,
                kind: ChangeKind::Updated,
            }))
            .collect();
        let batch = self.files.ingest(
            &self.workspace_root_path,
            &self.cache_dir,
            changes,
            WhenScanning::Wait,
        );
        batch
            .created_files
            .into_iter()
            .chain(batch.updated_files)
            .map(|f| (f.file, f.hash))
            .collect()
    }

    #[napi]
    pub fn update_project_files(
        &self,
        #[napi(ts_arg_type = "Record<string, string>")] project_root_mappings: ProjectRootMappings,
        #[napi(ts_arg_type = "ExternalObject<Record<string, Array<FileData>>>")]
        project_files: &External<Arc<ProjectFiles>>,
        #[napi(ts_arg_type = "ExternalObject<Array<FileData>>")] global_files: &External<
            Arc<Vec<FileData>>,
        >,
        updated_files: HashMap<String, String>,
        deleted_files: Vec<String>,
    ) -> UpdatedWorkspaceFiles {
        trace!("updating project files");
        trace!("{project_root_mappings:?}");
        let deleted_files: Vec<&str> = deleted_files.iter().map(|s| s.as_str()).collect();
        let mut project_files_map: ProjectFiles = (***project_files).clone();
        let mut global_files = global_files
            .iter()
            .map(|f| (f.file.clone(), f.hash.clone()))
            .collect::<HashMap<_, _>>();

        trace!(
            "adding {} updated files to project files",
            updated_files.len()
        );

        let mut updated_projects = HashSet::<&str>::new();
        for updated_file in updated_files.into_iter() {
            let file = updated_file.0;
            let hash = updated_file.1;
            let project = find_project_for_path(&file, &project_root_mappings);
            if let Some(project_files) =
                project.and_then(|project| project_files_map.get_mut(project))
            {
                trace!("{file:?} was found in a project");
                if let Some(file) = project_files.iter_mut().find(|f| f.file == file) {
                    trace!("updating hash for file");
                    file.hash = hash;
                } else {
                    trace!("{file:?} was not part of a project, adding to project files");
                    project_files.push(FileData { file, hash });
                    updated_projects.insert(project.expect("Project already exists"));
                }
            } else {
                trace!("{file:?} was not found in any project, updating global files");
                global_files
                    .entry(file)
                    .and_modify(|e| e.clone_from(&hash))
                    .or_insert(hash);
            }
        }

        trace!(
            "removing {} deleted files from project files",
            deleted_files.len()
        );
        for deleted_file in deleted_files.into_iter() {
            if let Some(project_files) = find_project_for_path(deleted_file, &project_root_mappings)
                .and_then(|project| project_files_map.get_mut(project))
            {
                if let Some(pos) = project_files.iter().position(|f| f.file == deleted_file) {
                    trace!("removing file: {deleted_file:?} from project");
                    project_files.remove(pos);
                }
            }

            if global_files.contains_key(deleted_file) {
                trace!("removing {deleted_file:?} from global files");
                global_files.remove(deleted_file);
            }
        }

        // sort the updated projects after deletion
        // projects that have deleted files were not added to `updated_projects` set because deletion doesnt change the determinism
        // but if there were any files deleted from projects, the sort should be faster becaues there potentially could be less files to sort
        for updated_project in updated_projects {
            trace!(updated_project, "sorting updated project");
            if let Some(project_files) = project_files_map.get_mut(updated_project) {
                // if the project files are less than 500, then parallel sort has too much overhead to actually be faster
                if cfg!(target_arch = "wasm32") || project_files.len() < 500 {
                    project_files.sort();
                } else {
                    project_files.par_sort();
                }
            }
        }

        let non_project_files = global_files
            .into_iter()
            .map(|(file, hash)| FileData { file, hash })
            .collect::<Vec<_>>();

        UpdatedWorkspaceFiles {
            file_map: FileMap {
                project_file_map: project_files_map.clone(),
                non_project_files: non_project_files.clone(),
            },
            external_references: NxWorkspaceFilesExternals {
                project_files: External::new(Arc::new(project_files_map)),
                global_files: External::new(Arc::new(non_project_files)),
                all_workspace_files: External::new(Arc::new(self.current_files())),
            },
        }
    }

    #[napi]
    pub fn all_file_data(&self) -> Vec<FileData> {
        self.current_files()
    }

    /// Recover from dropped watch events: re-walk, and report what changed
    /// against the files this context was holding. The fresh files are
    /// adopted, so the caller only has to feed the returned changes through
    /// its normal recomputation path; subscribers do not see them.
    #[napi]
    pub fn rescan_and_diff(&self) -> ChangeBatch {
        self.files.ingest(
            &self.workspace_root_path,
            &self.cache_dir,
            vec![Change::rescan()],
            WhenScanning::Wait,
        )
    }

    #[napi]
    pub fn get_files_in_directory(&self, directory: String) -> Vec<String> {
        get_child_files(directory, self.current_files())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::workspace::files_archive::{NxFileHashed, archive_path};
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    fn files_from(entries: &[(&str, &str)]) -> Files {
        entries
            .iter()
            .map(|(path, hash)| (PathBuf::from(path), hash.to_string()))
            .collect()
    }

    #[test]
    fn diff_files_classifies_created_updated_unchanged_and_deleted() {
        let before = files_from(&[("a.ts", "1"), ("b.ts", "2"), ("c.ts", "3")]);
        let after = files_from(&[("b.ts", "2"), ("c.ts", "changed"), ("d.ts", "4")]);

        let diff = outcomes_to_batch(diff_files(&before, &after), 1);

        // Created carries its hash: the collector records one for every file.
        assert_eq!(
            diff.created_files
                .iter()
                .map(|f| (f.file.as_str(), f.hash.as_str()))
                .collect::<Vec<_>>(),
            vec![("d.ts", "4")]
        );
        // b.ts is unchanged and must not appear anywhere.
        assert_eq!(
            diff.updated_files
                .iter()
                .map(|f| (f.file.as_str(), f.hash.as_str()))
                .collect::<Vec<_>>(),
            vec![("c.ts", "changed")]
        );
        assert_eq!(diff.deleted_files, vec![String::from("a.ts")]);
    }

    fn workspace_with(names: &[&str]) -> TempDir {
        let temp = TempDir::new().unwrap();
        for name in names {
            temp.child(name).write_str(name).unwrap();
        }
        temp
    }

    fn as_string(dir: &TempDir) -> String {
        dir.path().to_string_lossy().to_string()
    }

    fn context(root: &TempDir, cache: &TempDir) -> WorkspaceContext {
        WorkspaceContext::new(as_string(root), as_string(cache), None).unwrap()
    }

    fn files_of(ctx: &WorkspaceContext) -> Vec<(String, String)> {
        ctx.all_file_data()
            .into_iter()
            .map(|f| (f.file, f.hash))
            .collect()
    }

    fn names_of(ctx: &WorkspaceContext) -> Vec<String> {
        files_of(ctx).into_iter().map(|(f, _)| f).collect()
    }

    #[test]
    fn an_empty_workspace_answers_every_read_instead_of_waiting_forever() {
        // The scan-finished signal used to be "the list is non-empty", so a
        // second read of an empty workspace waited for a scan that had
        // already finished. The phase says so explicitly.
        let temp = TempDir::new().unwrap();
        let cache = TempDir::new().unwrap();
        let ctx = context(&temp, &cache);
        let (done, on_done) = std::sync::mpsc::channel();
        let ctx = Arc::new(ctx);
        let reader = Arc::clone(&ctx);
        std::thread::spawn(move || {
            let first = reader.all_file_data();
            let second = reader.all_file_data();
            let third = reader.glob(vec!["**/*".into()], None).unwrap();
            let _ = done.send((first.len(), second.len(), third.len()));
        });
        assert_eq!(
            on_done
                .recv_timeout(Duration::from_secs(10))
                .expect("reads of an empty workspace must return"),
            (0, 0, 0)
        );
    }

    #[test]
    fn from_archive_loads_what_the_last_walk_recorded_without_walking() {
        let temp = workspace_with(&["a.ts", "src/b.ts"]);
        let cache = TempDir::new().unwrap();

        let walked = context(&temp, &cache);
        let recorded = files_of(&walked);

        // Change the disk without touching the archive. A walk would see both
        // changes; a load of the archive cannot.
        std::fs::remove_file(temp.child("a.ts").path()).unwrap();
        temp.child("c.ts").write_str("c").unwrap();

        let loaded =
            WorkspaceContext::from_archive(as_string(&temp), as_string(&cache), None).unwrap();
        assert_eq!(files_of(&loaded), recorded);
    }

    #[test]
    fn from_archive_walks_when_there_is_no_archive() {
        let temp = workspace_with(&["a.ts", "src/b.ts"]);
        let cache = TempDir::new().unwrap();

        let ctx =
            WorkspaceContext::from_archive(as_string(&temp), as_string(&cache), None).unwrap();
        assert_eq!(names_of(&ctx), vec!["a.ts", "src/b.ts"]);
    }

    #[test]
    fn a_rewrite_replaces_the_archive_by_rename_and_leaves_no_staging_file() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();

        context(&temp, &cache).all_file_data();
        let first = std::fs::metadata(archive_path(cache.path())).unwrap();
        context(&temp, &cache).all_file_data();
        let second = std::fs::metadata(archive_path(cache.path())).unwrap();

        // A rename gives the path a new file; truncating in place would keep
        // the old one, and a reader could see it half-written.
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            assert_ne!(first.ino(), second.ino());
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            assert_ne!(first.file_index(), second.file_index());
        }

        let mut entries: Vec<String> = std::fs::read_dir(cache.path())
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().to_string())
            .collect();
        entries.sort();
        assert_eq!(entries, vec!["nx_files.lock", "nx_files_v2.nxt"]);
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn hold_lock(cache: &TempDir) -> FileLock {
        let mut holder = FileLock::new(
            cache
                .path()
                .join(NX_FILES_LOCK)
                .to_string_lossy()
                .to_string(),
        )
        .unwrap();
        holder.lock().unwrap();
        holder
    }

    /// Starts a walk on another thread and returns once it is waiting on the
    /// lock, so the holder can be released knowing the waiter saw it held.
    #[cfg(not(target_arch = "wasm32"))]
    fn walk_in_another_thread(
        temp: &TempDir,
        cache: &TempDir,
    ) -> std::thread::JoinHandle<Vec<(String, String)>> {
        let lock_path = cache.path().join(NX_FILES_LOCK);
        let waits_before = waits_started_on(&lock_path);
        let root = as_string(temp);
        let cache_dir = as_string(cache);
        let handle = std::thread::spawn(move || {
            files_of(&WorkspaceContext::new(root, cache_dir, None).unwrap())
        });
        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        while waits_started_on(&lock_path) == waits_before {
            assert!(
                std::time::Instant::now() < deadline,
                "the walk never started waiting on the lock"
            );
            std::thread::sleep(Duration::from_millis(5));
        }
        handle
    }

    /// Runs `acquire_files` where a regression to an unbounded wait fails the
    /// test instead of hanging it.
    #[cfg(not(target_arch = "wasm32"))]
    fn acquire_within(
        ceiling: Duration,
        root: &TempDir,
        cache: &TempDir,
        trust_archive: bool,
        wait_for: Duration,
    ) -> Files {
        let (done, on_done) = std::sync::mpsc::channel();
        let root = root.path().to_path_buf();
        let cache_dir = as_string(cache);
        std::thread::spawn(move || {
            let _ = done.send(acquire_files(&root, &cache_dir, trust_archive, wait_for));
        });
        on_done
            .recv_timeout(ceiling)
            .expect("acquire_files did not return within the ceiling")
    }

    fn names_in(files: Files) -> Vec<String> {
        files
            .into_keys()
            .map(|f| f.to_string_lossy().to_string())
            .collect()
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn walk_wait_from_parses_caps_and_defaults() {
        // The docs tell users to set this exact name; nothing else ties the two.
        assert_eq!(WALK_WAIT_VAR, "NX_WORKSPACE_WALK_WAIT_MS");
        assert_eq!(walk_wait_from(None), Duration::from_secs(60));
        assert_eq!(walk_wait_from(Some("90000")), Duration::from_secs(90));
        assert_eq!(walk_wait_from(Some(" 0 ")), Duration::ZERO);
        assert_eq!(
            walk_wait_from(Some("99999999999")),
            Duration::from_secs(3600)
        );
        for malformed in ["", "90s", "1e5", "90_000", "1.5", "-1", "abc"] {
            assert_eq!(
                walk_wait_from(Some(malformed)),
                Duration::from_secs(60),
                "{malformed:?}"
            );
        }
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn a_waiter_gives_up_on_a_holder_that_never_releases_and_walks_itself() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();
        let _holder = hold_lock(&cache);

        let started = Instant::now();
        let files = acquire_within(
            Duration::from_secs(30),
            &temp,
            &cache,
            false,
            Duration::from_millis(200),
        );

        assert_eq!(names_in(files), vec!["a.ts"]);
        // It waited the timeout out and then walked around the holder, which
        // still holds; it did not take the lock itself.
        assert!(started.elapsed() >= Duration::from_millis(200));
        let lock_path = cache
            .path()
            .join(NX_FILES_LOCK)
            .to_string_lossy()
            .to_string();
        assert!(FileLock::new(lock_path).unwrap().locked);
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn a_trusting_waiter_walks_rather_than_load_an_archive_the_holder_may_be_replacing() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();
        write_files_archive(
            as_string(&cache),
            &[("stale.ts".to_string(), NxFileHashed("h".to_string(), 1))]
                .into_iter()
                .collect::<NxFileHashes>(),
        );
        let _holder = hold_lock(&cache);

        let files = acquire_within(
            Duration::from_secs(30),
            &temp,
            &cache,
            true,
            Duration::from_millis(200),
        );

        assert_eq!(names_in(files), vec!["a.ts"]);
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn a_walk_that_finds_the_lock_held_loads_the_archive_the_holder_writes() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();
        let mut holder = hold_lock(&cache);
        let waiter = walk_in_another_thread(&temp, &cache);

        // The holder finishes: it writes an archive that does not match the
        // disk, so a waiter that walked would produce something else.
        write_files_archive(
            as_string(&cache),
            &[(
                "from-the-other-process.ts".to_string(),
                NxFileHashed("h".to_string(), 1),
            )]
            .into_iter()
            .collect::<NxFileHashes>(),
        );
        // Stamped well after the waiter's clock read, whatever the
        // filesystem's timestamp resolution.
        std::fs::File::options()
            .write(true)
            .open(archive_path(cache.path()))
            .unwrap()
            .set_modified(SystemTime::now() + Duration::from_secs(5))
            .unwrap();
        holder.unlock().unwrap();

        assert_eq!(
            waiter.join().unwrap(),
            vec![("from-the-other-process.ts".to_string(), "h".to_string())]
        );
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn a_waiter_walks_itself_when_the_holder_left_only_a_stale_archive() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();

        // An archive from an earlier run, older than any wait that starts now.
        write_files_archive(
            as_string(&cache),
            &[("stale.ts".to_string(), NxFileHashed("h".to_string(), 1))]
                .into_iter()
                .collect::<NxFileHashes>(),
        );
        std::fs::File::options()
            .write(true)
            .open(archive_path(cache.path()))
            .unwrap()
            .set_modified(SystemTime::now() - Duration::from_secs(60))
            .unwrap();

        let mut holder = hold_lock(&cache);
        let waiter = walk_in_another_thread(&temp, &cache);
        // The holder dies without writing anything.
        holder.unlock().unwrap();

        let names: Vec<String> = waiter.join().unwrap().into_iter().map(|(f, _)| f).collect();
        assert_eq!(names, vec!["a.ts"]);
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn refresh_picks_up_writes_since_the_walk_and_rewrites_the_archive() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();
        let ctx = context(&temp, &cache);
        let before = files_of(&ctx);

        temp.child("a.ts").write_str("changed").unwrap();
        std::fs::File::options()
            .write(true)
            .open(temp.child("a.ts").path())
            .unwrap()
            .set_modified(SystemTime::now() + Duration::from_secs(5))
            .unwrap();
        temp.child("b.ts").write_str("b").unwrap();

        assert!(ctx.refresh());
        let after = files_of(&ctx);
        assert_eq!(
            after.iter().map(|(f, _)| f.as_str()).collect::<Vec<_>>(),
            vec!["a.ts", "b.ts"]
        );
        assert_ne!(after[0].1, before[0].1);
        // A plugin worker loading the archive now sees the same files.
        let loaded =
            WorkspaceContext::from_archive(as_string(&temp), as_string(&cache), None).unwrap();
        assert_eq!(files_of(&loaded), after);
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn refresh_leaves_a_walk_in_progress_alone() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();
        let lock_path = cache.path().join(NX_FILES_LOCK);
        let mut holder = hold_lock(&cache);
        let waits_before = waits_started_on(&lock_path);

        let ctx = context(&temp, &cache);
        let deadline = Instant::now() + Duration::from_secs(10);
        while waits_started_on(&lock_path) == waits_before {
            assert!(Instant::now() < deadline, "the walk never started");
            std::thread::sleep(Duration::from_millis(5));
        }

        assert!(!ctx.refresh());
        holder.unlock().unwrap();
        assert_eq!(files_of(&ctx).len(), 1);
    }

    /// Plugin createNodes pipelines (and therefore atomized target name
    /// insertion order) depend on the JS-visible `WorkspaceContext.glob`
    /// returning paths in sorted order. The files are kept in path order and
    /// the glob filter preserves it — but the guarantee is a public contract,
    /// so it's worth a smoke test that exercises the full path through
    /// `WorkspaceContext::new`.
    ///
    /// Files are written in non-alphabetic order so the test cannot pass
    /// just because file walking happens to be alphabetic on this OS.
    #[test]
    fn glob_should_return_sorted_results_regardless_of_creation_order() {
        let temp = TempDir::new().unwrap();
        // Deliberately non-alphabetic creation order across both depths so
        // any creation-time-vs-name ordering quirks would surface.
        for name in ["z.ts", "src/m.ts", "a.ts", "src/a.ts", "m.ts", "src/z.ts"] {
            temp.child(name).write_str("x").unwrap();
        }

        let cache = TempDir::new().unwrap();
        let ctx = context(&temp, &cache);

        let matched = ctx.glob(vec!["**/*.ts".into()], None).unwrap();
        let mut expected = matched.clone();
        expected.sort();
        assert_eq!(
            matched, expected,
            "glob results must be sorted regardless of file creation order"
        );

        // multi_glob applies the same guarantee per-pattern.
        let multi = ctx
            .multi_glob(vec!["**/*.ts".into(), "src/**/*.ts".into()], None)
            .unwrap();
        for (i, group) in multi.iter().enumerate() {
            let mut sorted = group.clone();
            sorted.sort();
            assert_eq!(
                group, &sorted,
                "multi_glob group {i} must be sorted regardless of file creation order"
            );
        }
    }

    /// Restoring a cached task output rewrites a file with identical bytes
    /// (new inode, same content). The watcher reports it as a change, but
    /// `incremental_update` must report only files whose content actually
    /// changed — otherwise the daemon recomputes the whole project graph for
    /// a no-op rewrite.
    #[test]
    fn incremental_update_reports_only_real_content_changes() {
        let temp = TempDir::new().unwrap();
        temp.child("a.txt").write_str("hello").unwrap();
        temp.child("b.txt").write_str("world").unwrap();

        let cache = TempDir::new().unwrap();
        let ctx = context(&temp, &cache);
        let seq_after_scan = ctx.change_seq();

        // Rewrite a.txt with identical content — a no-op rewrite.
        temp.child("a.txt").write_str("hello").unwrap();
        let no_op = ctx.incremental_update(vec!["a.txt".into()], vec![]);
        assert!(
            no_op.is_empty(),
            "rewriting a file with identical content must report no change; got {no_op:?}"
        );
        assert_eq!(
            ctx.change_seq(),
            seq_after_scan,
            "a no-op must not move the sequence"
        );

        // Genuinely change b.txt — must be reported.
        temp.child("b.txt").write_str("changed").unwrap();
        let changed = ctx.incremental_update(vec!["b.txt".into()], vec![]);
        assert_eq!(
            changed.keys().collect::<Vec<_>>(),
            vec![&"b.txt".to_string()],
            "a real content change must be reported; got {changed:?}"
        );
        assert_eq!(ctx.change_seq(), seq_after_scan + 1);

        // A brand-new file must be reported as a change.
        temp.child("c.txt").write_str("new").unwrap();
        let created = ctx.incremental_update(vec!["c.txt".into()], vec![]);
        assert!(
            created.contains_key("c.txt"),
            "a newly-created file must be reported; got {created:?}"
        );
    }

    #[test]
    fn deleting_a_directory_removes_every_file_under_it_and_names_each() {
        let temp = workspace_with(&[
            "libs/a/x.ts",
            "libs/a/y.ts",
            "libs/a-other/z.ts",
            "libs/b.ts",
        ]);
        let cache = TempDir::new().unwrap();
        let ctx = context(&temp, &cache);
        ctx.all_file_data();

        let batch = ctx.rescan_and_diff();
        assert!(batch.is_empty(), "nothing changed yet; got {batch:?}");

        std::fs::remove_dir_all(temp.child("libs/a").path()).unwrap();
        let changes = vec![Change {
            path: "libs/a".into(),
            kind: ChangeKind::Deleted,
        }];
        let batch = ctx.files.ingest(
            &ctx.workspace_root_path,
            &ctx.cache_dir,
            changes,
            WhenScanning::Wait,
        );

        // `libs/a-other` sorts between `libs/a` and `libs/a/x.ts` bytewise
        // but not by path component; it must survive.
        assert_eq!(batch.deleted_files, vec!["libs/a/x.ts", "libs/a/y.ts"]);
        assert_eq!(names_of(&ctx), vec!["libs/a-other/z.ts", "libs/b.ts"]);
    }

    #[test]
    fn a_batch_reported_during_a_walk_lands_on_top_of_it() {
        // The daemon starts watching, then scans. A write that lands while
        // the scan runs may or may not be in its result; applying the report
        // after the scan makes the answer right either way.
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();
        let mut holder = hold_lock(&cache);
        let lock_path = cache.path().join(NX_FILES_LOCK);
        let waits_before = waits_started_on(&lock_path);

        let ctx = context(&temp, &cache);
        let deadline = Instant::now() + Duration::from_secs(10);
        while waits_started_on(&lock_path) == waits_before {
            assert!(Instant::now() < deadline, "the walk never started");
            std::thread::sleep(Duration::from_millis(5));
        }

        temp.child("late.ts").write_str("late").unwrap();
        let queued = ctx.files.ingest(
            &ctx.workspace_root_path,
            &ctx.cache_dir,
            vec![Change {
                path: "late.ts".into(),
                kind: ChangeKind::Created,
            }],
            WhenScanning::Queue,
        );
        assert!(queued.is_empty(), "queued behind the walk, not applied yet");
        assert_eq!(ctx.change_seq(), 0);

        holder.unlock().unwrap();
        assert_eq!(names_of(&ctx), vec!["a.ts", "late.ts"]);
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn watching_context(root: &TempDir, cache: &TempDir) -> WorkspaceContext {
        // Canonical: FSEvents and canonicalize_event_paths report real paths,
        // and the pipeline strips its (canonical) origin from them.
        let root = dunce::canonicalize(root.path()).unwrap();
        WorkspaceContext::new(
            root.to_string_lossy().to_string(),
            as_string(cache),
            Some(WorkspaceContextOptions {
                watch: Some(true),
                watch_globs: None,
            }),
        )
        .unwrap()
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn wait_until(what: &str, mut condition: impl FnMut() -> bool) {
        let deadline = Instant::now() + Duration::from_secs(5);
        while !condition() {
            assert!(Instant::now() < deadline, "{what}");
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn a_watching_context_keeps_its_files_current_without_being_told() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();
        let ctx = watching_context(&temp, &cache);
        assert_eq!(names_of(&ctx), vec!["a.ts"]);
        let scanned = ctx.change_seq();

        temp.child("src/b.ts").write_str("b").unwrap();
        // A plain read pulls in what the watcher delivered; no flush, no
        // caller-supplied update.
        wait_until("the write never reached the files", || {
            names_of(&ctx) == vec!["a.ts", "src/b.ts"]
        });
        assert_eq!(ctx.change_seq(), scanned + 1);

        std::fs::remove_file(temp.child("a.ts").path()).unwrap();
        wait_until("the delete never reached the files", || {
            names_of(&ctx) == vec!["src/b.ts"]
        });
        assert_eq!(ctx.change_seq(), scanned + 2);
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn settle_answers_with_a_write_made_just_before_the_call() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();
        let ctx = watching_context(&temp, &cache);
        ctx.all_file_data();

        for i in 0..10 {
            temp.child("a.ts").write_str(&format!("v{i}")).unwrap();
            let batch = ctx.settle();
            // FSEvents may call a rewrite of a just-created file a create;
            // either way the batch names it and carries the new hash.
            let written: Vec<&FileData> = batch
                .created_files
                .iter()
                .chain(&batch.updated_files)
                .collect();
            assert_eq!(
                written.iter().map(|f| f.file.as_str()).collect::<Vec<_>>(),
                vec!["a.ts"],
                "iteration {i}: settle missed the write; got {batch:?}"
            );
            assert_eq!(files_of(&ctx)[0].1, written[0].hash);
        }
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn a_write_landing_right_after_construction_is_never_lost() {
        // Watch-before-scan, enforced in the constructor: the write below
        // lands while the scan may still be running. It is either in the
        // scan's result or queued behind it; never invisible to both.
        for _ in 0..5 {
            let temp = workspace_with(&["seed.ts"]);
            let cache = TempDir::new().unwrap();
            let ctx = watching_context(&temp, &cache);
            temp.child("boot.ts").write_str("x").unwrap();
            wait_until("a write right after construction went missing", || {
                names_of(&ctx).contains(&"boot.ts".to_string())
            });
        }
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn subscribers_hear_every_applied_batch_once_and_settle_batches_not_at_all() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();
        let ctx = watching_context(&temp, &cache);
        ctx.all_file_data();

        let heard: Arc<Mutex<Vec<ChangeBatch>>> = Arc::new(Mutex::new(Vec::new()));
        let sink_heard = Arc::clone(&heard);
        ctx.batches.subscribe(Arc::new(move |result| {
            sink_heard.lock().push(result.expect("no watcher error"));
        }));

        // Left to the idle flush: the subscriber hears it.
        temp.child("b.ts").write_str("b").unwrap();
        wait_until("the idle flush never reached the subscriber", || {
            heard
                .lock()
                .iter()
                .any(|b| b.created_files.iter().any(|f| f.file == "b.ts"))
        });
        let heard_so_far = heard.lock().len();

        // Handed back by settle: the caller routes it, so the subscriber
        // must not hear it again.
        temp.child("c.ts").write_str("c").unwrap();
        let batch = ctx.settle();
        assert!(batch.created_files.iter().any(|f| f.file == "c.ts"));
        std::thread::sleep(Duration::from_millis(300));
        assert_eq!(heard.lock().len(), heard_so_far);
        assert!(names_of(&ctx).contains(&"c.ts".to_string()));
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn a_gitignored_write_reaches_the_event_stream_but_never_the_files() {
        let temp = workspace_with(&["a.ts"]);
        temp.child(".gitignore").write_str("dist/\n").unwrap();
        let cache = TempDir::new().unwrap();
        let ctx = watching_context(&temp, &cache);
        ctx.all_file_data();
        let scanned = ctx.change_seq();

        let seen: Arc<Mutex<Vec<WatchEvent>>> = Arc::new(Mutex::new(Vec::new()));
        let sink_seen = Arc::clone(&seen);
        ctx.events.subscribe(Arc::new(move |result| {
            sink_seen.lock().extend(result.expect("no watcher error"));
        }));

        temp.child("dist/out.js").write_str("x").unwrap();
        wait_until(
            "the gitignored write never reached the event stream",
            || seen.lock().iter().any(|e| e.path == "dist/out.js"),
        );
        // Everything delivered so far has been through the files' rules.
        ctx.settle();
        assert!(!names_of(&ctx).contains(&"dist/out.js".to_string()));
        assert_eq!(ctx.change_seq(), scanned, "nothing the files hold changed");
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn a_caller_supplied_update_is_held_to_the_same_rule_as_the_watch() {
        let temp = workspace_with(&["a.ts"]);
        temp.child(".gitignore").write_str("dist/\n").unwrap();
        temp.child("dist/out.js").write_str("x").unwrap();
        let cache = TempDir::new().unwrap();

        let watching = watching_context(&temp, &cache);
        watching.all_file_data();
        assert!(
            watching
                .incremental_update(vec!["dist/out.js".into()], vec![])
                .is_empty(),
            "a watching context refuses what a walk would skip"
        );
        assert_eq!(names_of(&watching), vec![".gitignore", "a.ts"]);

        // A context without a watch has no rules of its own (building them
        // walks the workspace for ignore files) and trusts its caller.
        let plain = context(&temp, &TempDir::new().unwrap());
        assert!(
            plain
                .incremental_update(vec!["dist/out.js".into()], vec![])
                .contains_key("dist/out.js")
        );
    }

    // FSEvents and ReadDirectoryChangesW watch the whole tree, so the
    // hardcoded-ignored directory is covered without being registered. The
    // inotify backend registers directories through the ignore-aware walk and
    // never sees inside `.nx/workspace-data`; the daemon's process poll is the
    // backstop there, as it always was.
    #[test]
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    fn a_watch_glob_admits_a_hardcoded_ignored_path_into_the_stream_only() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();
        let root = dunce::canonicalize(temp.path()).unwrap();
        let ctx = WorkspaceContext::new(
            root.to_string_lossy().to_string(),
            as_string(&cache),
            Some(WorkspaceContextOptions {
                watch: Some(true),
                watch_globs: Some(vec!["!.nx/workspace-data/d/server-process.json".into()]),
            }),
        )
        .unwrap();
        ctx.all_file_data();

        let seen: Arc<Mutex<Vec<WatchEvent>>> = Arc::new(Mutex::new(Vec::new()));
        let sink_seen = Arc::clone(&seen);
        ctx.events.subscribe(Arc::new(move |result| {
            sink_seen.lock().extend(result.expect("no watcher error"));
        }));

        temp.child(".nx/workspace-data/d/server-process.json")
            .write_str("{}")
            .unwrap();
        temp.child(".nx/workspace-data/d/other.dat")
            .write_str("x")
            .unwrap();
        wait_until("the admitted process file never reached the stream", || {
            seen.lock()
                .iter()
                .any(|e| e.path == ".nx/workspace-data/d/server-process.json")
        });
        ctx.settle();
        assert!(
            !seen.lock().iter().any(|e| e.path.ends_with("other.dat")),
            "only the admitted path punches through the hardcoded veto"
        );
        assert_eq!(names_of(&ctx), vec!["a.ts"], "the stream is not the files");
    }
}
