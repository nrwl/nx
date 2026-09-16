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
    FlushMode, WatchEventCallback, WatchSession, create_filter, default_watch_ignores,
};
#[cfg(not(target_arch = "wasm32"))]
use crate::native::workspace::files_archive::archive_modified_at;
use crate::native::workspace::files_archive::{
    FilesArchive, NxFileHashes, read_files_archive, write_files_archive,
};
use crate::native::workspace::files_hashing::{full_files_hash, selective_files_hash};
use crate::native::workspace::ignored_index::{IgnoredIndex, IgnoredIndexReader};
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
    /// Paths the watch reports even though a hardcoded ignore covers them,
    /// as the daemon does for its own process file. They reach the event
    /// stream only, never the files: the workspace ignore rules still decide
    /// what enters those.
    pub always_watch: Option<Vec<String>>,
}

#[napi]
pub struct WorkspaceContext {
    pub workspace_root: String,
    workspace_root_path: PathBuf,
    /// Retained so a re-walk can re-gather through the same files archive the
    /// initial gather used, keeping the walk incremental.
    cache_dir: String,
    files: FileState,
    /// The directories the hasher reads from disk, kept current by the watch.
    ignored: Arc<IgnoredIndex>,
    batches: Publisher<PendingChanges>,
    #[cfg(not(target_arch = "wasm32"))]
    events: Publisher<Vec<WatchEvent>>,
    /// Shared with the readers the context hands out, so they drain the same
    /// watch and stop hearing it once the context stops watching.
    #[cfg(not(target_arch = "wasm32"))]
    watch: Arc<Mutex<Option<WatchSession>>>,
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
/// nothing the batch reported was really different. A path can reach a
/// consumer in more than one batch (see `settle`): the one with the higher
/// `seq` holds its later state.
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
    /// Told of every change under a registered directory, see `apply`.
    ignored: Arc<IgnoredIndex>,
    /// Kept through a re-walk so its result can be diffed against it.
    files: Files,
    /// Changes reported during a walk, applied on top of its result. A file
    /// the walk also saw is re-hashed, which lands on the same answer.
    queued: Vec<Change>,
    /// Changes the watch delivered while the files were ready, not applied
    /// yet. The watch thread only records them; whoever applies changes next
    /// takes these first, in order.
    delivered: Vec<Change>,
    /// Bumped once per application that changed anything. A reader that
    /// remembers the value it last saw can tell whether the files moved.
    change_seq: u64,
    /// Every outcome sealed since the last `settle`, latest per path. Kept
    /// only by a watching context, whose batches reach its consumer
    /// asynchronously and so can arrive after `settle` has answered.
    pending: Outcomes,
    track_pending: bool,
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
    fn new(workspace_root: &Path, policy: Option<Policy>, ignored: Arc<IgnoredIndex>) -> Self {
        if !workspace_root.exists() {
            warn!(
                "workspace root does not exist: {}",
                workspace_root.display()
            );
            return FileState(None);
        }
        let track_pending = policy.is_some();
        FileState(Some(Arc::new((
            NxMutex::new(State {
                phase: Phase::Scanning,
                policy,
                ignored,
                files: Files::new(),
                queued: Vec::new(),
                delivered: Vec::new(),
                change_seq: 0,
                pending: Outcomes::new(),
                track_pending,
            }),
            NxCondvar::new(),
        ))))
    }

    /// Runs the first walk off-thread. The state stays `Scanning` until it
    /// lands, so readers wait and reported changes queue behind it.
    #[cfg(not(target_arch = "wasm32"))]
    fn scan(
        &self,
        workspace_root: &Path,
        cache_dir: String,
        trust_archive: bool,
        batches: Publisher<PendingChanges>,
    ) {
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
            // Changes the watch reported during the walk land in this batch.
            let batch = state.finish_walk(&workspace_root, &cache_dir, files, true);
            if !batch.is_empty() {
                batches.publish(Ok(PendingChanges::new(&state, &workspace_root, &cache_dir)));
            }
        });
    }

    #[cfg(target_arch = "wasm32")]
    fn scan(
        &self,
        workspace_root: &Path,
        cache_dir: String,
        trust_archive: bool,
        _batches: Publisher<PendingChanges>,
    ) {
        let Some(_) = &self.0 else {
            return;
        };
        let files = match trust_archive
            .then(|| read_files_archive(&cache_dir))
            .flatten()
        {
            Some(archive) => archive_to_files(archive),
            None => gather_and_hash_files(workspace_root, cache_dir.clone()),
        };
        trace!("{} files retrieved", files.len());
        self.finish_walk(workspace_root, &cache_dir, files, true);
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
    /// during the walk applied on top. A rescan queued during the walk walks
    /// again: the events it stands for may have been lost after the walk
    /// passed their directories. Wakes every waiting reader once current.
    fn finish_walk(
        &self,
        workspace_root: &Path,
        cache_dir: &str,
        mut fresh: Files,
        mut initial: bool,
    ) -> ChangeBatch {
        let Some(sync) = &self.0 else {
            return ChangeBatch::default();
        };
        let (lock, cvar) = sync.deref();
        let mut outcomes = Outcomes::new();
        loop {
            if !initial {
                // The watch lost events, or a refresh was asked for: the index
                // can no longer trust what it heard either. Readers wait for
                // Ready and changes queue meanwhile, so it re-walks unlocked.
                let ignored =
                    Arc::clone(&lock.lock().expect("Should be able to lock files").ignored);
                ignored.reseed(workspace_root);
            }
            let mut state = lock.lock().expect("Should be able to lock files");
            if !initial {
                outcomes.extend(diff_files(&state.files, &fresh));
            }
            state.files = fresh;
            if state.queued.iter().any(|c| c.kind == ChangeKind::Rescan) {
                state.queued.retain(|c| c.kind != ChangeKind::Rescan);
                drop(state);
                initial = false;
                fresh = gather_and_hash_files(workspace_root, cache_dir.to_owned());
                continue;
            }
            let queued = std::mem::take(&mut state.queued);
            outcomes.extend(apply(&mut state, workspace_root, queued));
            let batch = seal(&mut state, outcomes);
            state.phase = Phase::Ready;
            drop(state);
            cvar.notify_all();
            return batch;
        }
    }

    /// Records changes the watch delivered, without touching the disk: during
    /// a walk they queue behind it, otherwise they wait for the next apply.
    /// True when the subscriber should be woken to apply them. Every delivery
    /// wakes it, so a wake-up that never runs strands nothing; one that finds
    /// the changes already applied by a read applies nothing.
    fn deliver(&self, changes: Vec<Change>) -> bool {
        let Some(sync) = &self.0 else {
            return false;
        };
        let (lock, _) = sync.deref();
        let mut state = lock.lock().expect("Should be able to lock files");
        if state.phase == Phase::Scanning {
            state.queued.extend(changes);
            return false;
        }
        state.delivered.extend(changes);
        true
    }

    /// `take_pending` without waiting out a walk: during one it takes
    /// nothing, and the walk wakes the subscriber when it lands.
    fn take_pending_now(&self) -> ChangeBatch {
        let Some(sync) = &self.0 else {
            return ChangeBatch::default();
        };
        let (lock, _) = sync.deref();
        let mut state = lock.lock().expect("Should be able to lock files");
        if state.phase == Phase::Scanning {
            return ChangeBatch::default();
        }
        let pending = std::mem::take(&mut state.pending);
        outcomes_to_batch(pending, state.change_seq)
    }

    /// Everything sealed since the last call, one outcome per path (its
    /// latest), under the `seq` of the newest batch it includes. Waits out a
    /// walk in progress. Empty for a context that does not watch.
    fn take_pending(&self) -> ChangeBatch {
        let Some(sync) = &self.0 else {
            return ChangeBatch::default();
        };
        let (lock, cvar) = sync.deref();
        let state = lock.lock().expect("Should be able to lock files");
        let mut state = cvar
            .wait(state, |s| s.phase == Phase::Scanning)
            .expect("Should be able to wait for files");
        let pending = std::mem::take(&mut state.pending);
        outcomes_to_batch(pending, state.change_seq)
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
        let (lock, cvar) = sync.deref();
        let mut state = lock.lock().expect("Should be able to lock files");
        if changes.is_empty() && state.delivered.is_empty() {
            return ChangeBatch::default();
        }
        match when_scanning {
            WhenScanning::Queue if state.phase == Phase::Scanning => {
                let delivered = std::mem::take(&mut state.delivered);
                state.queued.extend(delivered);
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
        // What the watch delivered came before anything the caller brings.
        let changes = {
            let mut all = std::mem::take(&mut state.delivered);
            all.extend(changes);
            all
        };
        if changes.is_empty() {
            return ChangeBatch::default();
        }
        if changes.iter().any(|c| c.kind == ChangeKind::Rescan) {
            // Walk before locking: the walk is the slow part and readers should
            // not block on it any longer than the phase already makes them.
            state.phase = Phase::Scanning;
            drop(state);
            let fresh = gather_and_hash_files(workspace_root, cache_dir.to_owned());
            return self.finish_walk(workspace_root, cache_dir, fresh, false);
        }
        let outcomes = apply(&mut state, workspace_root, changes);
        seal(&mut state, outcomes)
    }

    /// The subset of `paths` the files hold, in the order given. One lookup
    /// each, so a batch never copies the map.
    fn holds(&self, paths: Vec<String>) -> Vec<String> {
        let Some(sync) = &self.0 else {
            return vec![];
        };
        let (lock, cvar) = sync.deref();
        let state = lock.lock().expect("Should be able to lock files");
        let state = cvar
            .wait(state, |s| s.phase == Phase::Scanning)
            .expect("Should be able to wait for files");
        paths
            .into_iter()
            .filter(|path| state.files.contains_key(Path::new(path)))
            .collect()
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
        if state.track_pending {
            for (path, outcome) in &outcomes {
                state.pending.insert(path.clone(), outcome.clone());
            }
        }
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

    // The index hears every change under its directories, whatever the
    // policy says: it holds the files a walk finds there, tracked or not.
    let deleted: Vec<&str> = changes
        .iter()
        .filter(|c| c.kind == ChangeKind::Deleted)
        .map(|c| c.path.as_str())
        .collect();
    state.ignored.note_deleted_all(&deleted);
    for change in &changes {
        if matches!(change.kind, ChangeKind::Created | ChangeKind::Updated) {
            state.ignored.note_written(workspace_root, &change.path);
        }
    }

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
        // Created means new to the files, whatever the reporter called it:
        // watchers and callers cannot always tell a creation from an update.
        let outcome = if state.files.insert(key, new_hash.clone()).is_none() {
            Outcome::Created(new_hash)
        } else {
            Outcome::Updated(new_hash)
        };
        outcomes.insert(change.path.clone(), outcome);
    }

    outcomes
}

/// Pulls what the watch pipeline holds into the files, after anything it
/// already delivered. Returns the batch for the caller to publish or hand
/// back; empty when nothing was pending.
#[cfg(not(target_arch = "wasm32"))]
fn drain_watch(
    files: &FileState,
    watch: &Mutex<Option<WatchSession>>,
    events: &Publisher<Vec<WatchEvent>>,
    workspace_root: &Path,
    cache_dir: &str,
    mode: FlushMode,
    when_scanning: WhenScanning,
) -> ChangeBatch {
    // Cloned out so the lock is not held through the pipeline round trip.
    let session = watch.lock().clone();
    let flushed = session
        .map(|session| session.flush(mode))
        .unwrap_or_default();
    if !flushed.is_empty() {
        events.publish(Ok(flushed.clone()));
    }
    let changes = flushed.into_iter().map(Change::from).collect();
    files.ingest(workspace_root, cache_dir, changes, when_scanning)
}

/// Word for the change subscriber that the context has changes it has not
/// handed out: delivered by the watch and not yet applied, or applied by a
/// walk or a read and not yet taken. Converting it for JavaScript applies
/// what the watch delivered and takes everything applied since the last take,
/// on the JS thread, so every change reaches the daemon exactly once and in
/// order, and the watch thread never reads or hashes files.
#[derive(Clone)]
pub struct PendingChanges {
    files: FileState,
    workspace_root: PathBuf,
    cache_dir: String,
}

impl PendingChanges {
    fn new(files: &FileState, workspace_root: &Path, cache_dir: &str) -> Self {
        Self {
            files: files.clone(),
            workspace_root: workspace_root.to_path_buf(),
            cache_dir: cache_dir.to_string(),
        }
    }

    fn take(self) -> ChangeBatch {
        self.files.ingest(
            &self.workspace_root,
            &self.cache_dir,
            Vec::new(),
            WhenScanning::Queue,
        );
        self.files.take_pending_now()
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl napi::bindgen_prelude::ToNapiValue for PendingChanges {
    unsafe fn to_napi_value(
        env: napi::sys::napi_env,
        pending: Self,
    ) -> napi::Result<napi::sys::napi_value> {
        // A panic must reach the subscriber as an error, not unwind into Node.
        let batch = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| pending.take()))
            .map_err(|_| {
                napi::Error::new(
                    napi::Status::GenericFailure,
                    "failed to apply the changes the watch delivered",
                )
            })?;
        unsafe { ChangeBatch::to_napi_value(env, batch) }
    }
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
        let (files, ignored, watch) = if options.watch.unwrap_or(false)
            && workspace_root_path.exists()
        {
            let failed = |msg| napi::Error::new(napi::Status::GenericFailure, msg);
            let policy = Self::workspace_policy(&workspace_root_path).map_err(failed)?;
            // A watch glob set is a list of ignores, so admitting a path is
            // a negation in it.
            let extra_globs: Vec<String> = options
                .always_watch
                .unwrap_or_default()
                .iter()
                .map(|path| format!("!{path}"))
                .collect();
            let ignored = Arc::new(IgnoredIndex::new(Some(
                Self::index_watch(&workspace_root_path, &extra_globs).map_err(failed)?,
            )));
            let files = FileState::new(&workspace_root_path, Some(policy), Arc::clone(&ignored));
            let session = Self::start_watching(
                workspace_root.clone(),
                &workspace_root_path,
                &cache_dir,
                extra_globs,
                &files,
                &batches,
                &events,
            )
            .map_err(failed)?;
            (files, ignored, Some(session))
        } else {
            let ignored = Arc::new(IgnoredIndex::new(None));
            (
                FileState::new(&workspace_root_path, None, Arc::clone(&ignored)),
                ignored,
                None,
            )
        };
        #[cfg(target_arch = "wasm32")]
        let (files, ignored) = {
            let _ = options;
            let ignored = Arc::new(IgnoredIndex::new(None));
            (
                FileState::new(&workspace_root_path, None, Arc::clone(&ignored)),
                ignored,
            )
        };

        files.scan(
            &workspace_root_path,
            cache_dir.clone(),
            trust_archive,
            batches.clone(),
        );

        Ok(WorkspaceContext {
            files,
            ignored,
            batches,
            #[cfg(not(target_arch = "wasm32"))]
            events,
            workspace_root,
            workspace_root_path,
            cache_dir,
            #[cfg(not(target_arch = "wasm32"))]
            watch: Arc::new(Mutex::new(watch)),
        })
    }

    /// The ignore rules a walk applies, as a predicate on a workspace-relative
    /// file path. Built against the canonical root, which is what event paths
    /// are relative to.
    #[cfg(not(target_arch = "wasm32"))]
    fn workspace_policy(workspace_root_path: &Path) -> std::result::Result<Policy, String> {
        let origin = dunce::canonicalize(workspace_root_path)
            .unwrap_or_else(|_| workspace_root_path.to_path_buf());
        let filter = create_filter(&origin.to_string_lossy(), &default_watch_ignores(), true)
            .map_err(|e| format!("failed to build the workspace ignore rules: {e}"))?;
        Ok(Arc::new(move |path: &str| {
            filter.admits(&origin.join(path), false)
        }))
    }

    /// What the watch delivers, as a predicate on a workspace-relative path:
    /// the same gate the session runs with, so the index registers only
    /// directories whose events it will hear.
    #[cfg(not(target_arch = "wasm32"))]
    fn index_watch(
        workspace_root_path: &Path,
        extra_globs: &[String],
    ) -> std::result::Result<crate::native::workspace::ignored_index::Watch, String> {
        let origin = dunce::canonicalize(workspace_root_path)
            .unwrap_or_else(|_| workspace_root_path.to_path_buf());
        let mut globs = default_watch_ignores();
        globs.extend(extra_globs.iter().cloned());
        let filter = create_filter(&origin.to_string_lossy(), &globs, false)
            .map_err(|e| format!("failed to build the watch gate: {e}"))?;
        Ok(crate::native::workspace::ignored_index::Watch {
            // Only ever asked about a prefix, which is a directory.
            delivers_under: Arc::new(move |path: &str| filter.admits(&origin.join(path), true)),
        })
    }

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
        batches: &Publisher<PendingChanges>,
        events: &Publisher<Vec<WatchEvent>>,
    ) -> std::result::Result<WatchSession, String> {
        let files = files.clone();
        let batches = batches.clone();
        let events = events.clone();
        let root = workspace_root_path.to_owned();
        let cache_dir = cache_dir.to_owned();
        let pending = PendingChanges::new(&files, &root, &cache_dir);
        let callback: WatchEventCallback = Box::new(move |result| match result {
            Ok(delivered) => {
                events.publish(Ok(delivered.clone()));
                let changes = delivered.into_iter().map(Change::from).collect();
                if files.deliver(changes) {
                    batches.publish(Ok(pending.clone()));
                }
            }
            Err(message) => {
                events.publish(Err(message.clone()));
                batches.publish(Err(message));
            }
        });
        let mut globs = default_watch_ignores();
        globs.extend(extra_globs);
        WatchSession::start(workspace_root, &globs, false, callback)
    }

    /// Pulls what the watch pipeline holds into the files. Returns the batch
    /// for the caller to publish or hand back; empty when not watching.
    #[cfg(not(target_arch = "wasm32"))]
    fn drain(&self, mode: FlushMode, when_scanning: WhenScanning) -> ChangeBatch {
        drain_watch(
            &self.files,
            &self.watch,
            &self.events,
            &self.workspace_root_path,
            &self.cache_dir,
            mode,
            when_scanning,
        )
    }

    /// A handle on the index that reads it as the context reads its files:
    /// what the watch has delivered is applied first and a walk in progress
    /// is waited out, so a listing never predates a reported write or misses
    /// a rescan's re-listing.
    fn reader(&self) -> IgnoredIndexReader {
        let files = self.files.clone();
        #[cfg(not(target_arch = "wasm32"))]
        let (batches, events, watch, root, cache_dir) = (
            self.batches.clone(),
            self.events.clone(),
            Arc::clone(&self.watch),
            self.workspace_root_path.clone(),
            self.cache_dir.clone(),
        );
        IgnoredIndexReader::new(
            Arc::clone(&self.ignored),
            Arc::new(move || {
                #[cfg(not(target_arch = "wasm32"))]
                {
                    let batch = drain_watch(
                        &files,
                        &watch,
                        &events,
                        &root,
                        &cache_dir,
                        FlushMode::Delivered,
                        WhenScanning::Wait,
                    );
                    if !batch.is_empty() {
                        batches.publish(Ok(PendingChanges::new(&files, &root, &cache_dir)));
                    }
                }
                files.wait_ready();
            }),
        )
    }

    fn pending_changes(&self) -> PendingChanges {
        PendingChanges::new(&self.files, &self.workspace_root_path, &self.cache_dir)
    }

    /// The files as of now: whatever the watcher has delivered is applied
    /// first, and a subscriber hears about it as it would any other batch.
    fn current_files(&self) -> Vec<FileData> {
        #[cfg(not(target_arch = "wasm32"))]
        {
            let batch = self.drain(FlushMode::Delivered, WhenScanning::Queue);
            if !batch.is_empty() {
                self.batches.publish(Ok(self.pending_changes()));
            }
        }
        self.files.get_files()
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
            let fresh = gather_and_hash_files(&workspace_root, cache_dir.clone());
            let batch = files.finish_walk(&workspace_root, &cache_dir, fresh, false);
            trace!("files refreshed");
            if !batch.is_empty() {
                publisher.publish(Ok(PendingChanges::new(&files, &workspace_root, &cache_dir)));
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
        workspace_files::get_files(
            project_root_map,
            self.current_files(),
            Arc::new(self.reader()),
        )
        .map_err(anyhow::Error::from)
    }

    #[cfg(test)]
    fn ignored_index(&self) -> Arc<IgnoredIndex> {
        Arc::clone(&self.ignored)
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
    /// progress so the answer reflects them. Returns what really changed; the
    /// batch is not published to subscribers.
    #[napi]
    pub fn incremental_update(
        &self,
        updated_files: Vec<String>,
        deleted_files: Vec<String>,
    ) -> ChangeBatch {
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
        self.files.ingest(
            &self.workspace_root_path,
            &self.cache_dir,
            changes,
            WhenScanning::Wait,
        )
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
                ignored_index: External::new(Arc::new(self.reader())),
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

    /// The subset of `paths` the file map holds: what the watch tracks, with
    /// the ignore rules applied. A path it does not hold is gitignored, gone,
    /// or not yet reported. Applies what the watch delivered first, as every
    /// other read of the files does, so a write already reported counts.
    #[napi]
    pub fn tracked_files(&self, paths: Vec<String>) -> Vec<String> {
        #[cfg(not(target_arch = "wasm32"))]
        {
            let batch = self.drain(FlushMode::Delivered, WhenScanning::Queue);
            if !batch.is_empty() {
                self.batches.publish(Ok(self.pending_changes()));
            }
        }
        self.files.holds(paths)
    }

    #[napi]
    pub fn get_files_in_directory(&self, directory: String) -> Vec<String> {
        get_child_files(directory, self.current_files())
    }
}

/// The watch-only half of the API, in its own block: napi registers every
/// method an impl block declares, so these cannot sit behind a per-method cfg.
#[cfg(not(target_arch = "wasm32"))]
#[napi]
impl WorkspaceContext {
    /// Subscribes to the context's changes: the callback is called whenever
    /// something was applied or delivered, with everything not yet taken by
    /// it or by `settle`. Replaces any earlier subscriber.
    #[napi]
    pub fn on_changes(
        &self,
        // napi calls the callback with one argument on failure, a JsError,
        // so a watch error arrives as (Error, undefined).
        #[napi(ts_arg_type = "(err: Error | null, batch: ChangeBatch | null) => void")]
        callback: ThreadsafeFunction<PendingChanges>,
    ) {
        self.batches.subscribe(Arc::new(move |result| match result {
            Ok(delivery) => {
                callback.call(Ok(delivery), ThreadsafeFunctionCallMode::NonBlocking);
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
    #[napi]
    pub fn on_watch_events(
        &self,
        // See `on_changes`: a failure arrives as (Error, undefined).
        #[napi(ts_arg_type = "(err: Error | null, events: WatchEvent[] | null) => void")]
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

    /// Applies everything the watch has delivered, waiting out the kernel hop,
    /// then takes every change applied and not yet taken, one entry per path
    /// at its latest state. The change subscriber takes from the same place,
    /// so no change is handed out twice.
    #[napi]
    pub fn settle(&self) -> ChangeBatch {
        self.drain(FlushMode::Settled, WhenScanning::Wait);
        self.files.take_pending()
    }

    /// Takes every change applied and not yet taken, without waiting for the
    /// watch: for a caller that just applied changes itself, through
    /// `incrementalUpdate` or `rescanAndDiff`.
    #[napi]
    pub fn take_applied_changes(&self) -> ChangeBatch {
        self.files.take_pending()
    }

    /// Stops the watcher and forgets the subscribers. The files stay as they
    /// were; reads no longer pull anything in.
    #[napi]
    pub fn stop_watching(&self) {
        *self.watch.lock() = None;
        self.batches.clear();
        self.events.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::workspace::files_archive::{NxFileHashed, archive_path};
    use crate::native::workspace::ignored_index::RunStage;
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
            changed
                .updated_files
                .iter()
                .map(|f| f.file.as_str())
                .collect::<Vec<_>>(),
            vec!["b.txt"],
            "a real content change must be reported; got {changed:?}"
        );
        assert_eq!(ctx.change_seq(), seq_after_scan + 1);

        // A brand-new file is reported as created, though the caller said
        // updated: created means new to the files.
        temp.child("c.txt").write_str("new").unwrap();
        let created = ctx.incremental_update(vec!["c.txt".into()], vec![]);
        assert!(
            created.created_files.iter().any(|f| f.file == "c.txt"),
            "a newly-created file must be reported as created; got {created:?}"
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
                always_watch: None,
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
    fn every_applied_change_is_handed_out_once_between_the_subscriber_and_settle() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();
        let ctx = watching_context(&temp, &cache);
        ctx.all_file_data();

        let heard: Arc<Mutex<Vec<ChangeBatch>>> = Arc::new(Mutex::new(Vec::new()));
        let sink_heard = Arc::clone(&heard);
        ctx.batches.subscribe(Arc::new(move |result| {
            let batch = result.expect("no watcher error").take();
            if !batch.is_empty() {
                sink_heard.lock().push(batch);
            }
        }));
        let handed_out = |heard: &[ChangeBatch], settled: &[ChangeBatch], file: &str| {
            heard
                .iter()
                .chain(settled)
                .flat_map(|b| b.created_files.iter().chain(&b.updated_files))
                .filter(|f| f.file == file)
                .count()
        };

        // Left to the watch: the subscriber takes it.
        temp.child("b.ts").write_str("b").unwrap();
        wait_until("the watch never reached the subscriber", || {
            handed_out(&heard.lock(), &[], "b.ts") == 1
        });

        // Taken by settle, or by the subscriber if its wake-up ran first;
        // never both.
        temp.child("c.ts").write_str("c").unwrap();
        let settled = vec![ctx.settle()];
        std::thread::sleep(Duration::from_millis(300));
        let heard = heard.lock();
        assert_eq!(handed_out(&heard, &settled, "b.ts"), 1);
        assert_eq!(handed_out(&heard, &settled, "c.ts"), 1);
        assert!(names_of(&ctx).contains(&"c.ts".to_string()));
        // Nothing is left to take.
        assert!(ctx.take_applied_changes().is_empty());
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn a_registered_directory_follows_the_watch() {
        let temp = workspace_with(&["a.ts"]);
        temp.child(".gitignore").write_str("dist/\n").unwrap();
        let cache = TempDir::new().unwrap();
        let ctx = watching_context(&temp, &cache);
        ctx.all_file_data();
        let root = dunce::canonicalize(temp.path()).unwrap();
        let index = ctx.ignored_index();

        // Registered before the directory exists: events fill it in.
        assert!(index.track(temp.path(), "dist"));
        assert_eq!(index.list(&root, "dist").unwrap(), Vec::<String>::new());
        temp.child("dist/out.js").write_str("x").unwrap();
        ctx.settle();
        assert_eq!(index.list(&root, "dist").unwrap(), vec!["dist/out.js"]);
        assert!(!names_of(&ctx).contains(&"dist/out.js".to_string()));

        // A hash is trusted until the watch reports the file again.
        let first = index.hash_file(&root, "dist/out.js", None, RunStage::NothingRan);
        assert!(index.trusted_hash("dist/out.js").is_some());
        temp.child("dist/out.js").write_str("xx").unwrap();
        ctx.settle();
        assert!(index.trusted_hash("dist/out.js").is_none());
        assert_ne!(
            first,
            index.hash_file(&root, "dist/out.js", None, RunStage::NothingRan)
        );

        // Tracked files under a registered directory are listed too, and
        // still reach the files.
        assert!(index.track(temp.path(), "src"));
        temp.child("src/b.ts").write_str("b").unwrap();
        ctx.settle();
        assert_eq!(index.list(&root, "src").unwrap(), vec!["src/b.ts"]);
        assert!(names_of(&ctx).contains(&"src/b.ts".to_string()));

        // Deletes of a file and of a directory.
        temp.child("dist/sub/x.js").write_str("x").unwrap();
        ctx.settle();
        assert_eq!(
            index.list(&root, "dist").unwrap(),
            vec!["dist/out.js", "dist/sub/x.js"]
        );
        std::fs::remove_file(temp.child("dist/out.js").path()).unwrap();
        std::fs::remove_dir_all(temp.child("dist/sub").path()).unwrap();
        ctx.settle();
        assert_eq!(index.list(&root, "dist").unwrap(), Vec::<String>::new());

        // The watch never reaches a hardcoded ignore, so it is not indexed.
        assert!(!index.track(temp.path(), "node_modules/dep"));
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn a_directory_moved_under_a_registered_directory_is_relisted() {
        let temp = workspace_with(&["a.ts"]);
        temp.child(".gitignore").write_str("dist/\n").unwrap();
        temp.child("dist/sub/x.js").write_str("x").unwrap();
        let cache = TempDir::new().unwrap();
        let ctx = watching_context(&temp, &cache);
        ctx.all_file_data();
        let root = dunce::canonicalize(temp.path()).unwrap();
        let index = ctx.ignored_index();
        assert!(index.track(temp.path(), "dist"));
        assert_eq!(index.list(&root, "dist").unwrap(), vec!["dist/sub/x.js"]);

        std::fs::rename(
            temp.child("dist/sub").path(),
            temp.child("dist/sub2").path(),
        )
        .unwrap();
        ctx.settle();
        assert_eq!(index.list(&root, "dist").unwrap(), vec!["dist/sub2/x.js"]);

        // Tracked files move with their directory in the files too: the old
        // path leaves as a delete of the directory, the new one arrives
        // through its files.
        temp.child("src/sub/t.ts").write_str("t").unwrap();
        ctx.settle();
        assert!(names_of(&ctx).contains(&"src/sub/t.ts".to_string()));
        std::fs::rename(temp.child("src/sub").path(), temp.child("src/sub2").path()).unwrap();
        ctx.settle();
        let names = names_of(&ctx);
        assert!(names.contains(&"src/sub2/t.ts".to_string()));
        assert!(!names.contains(&"src/sub/t.ts".to_string()));
    }

    // The e2e sequence that failed on CI: a directory under a registered
    // directory is moved away, moved back, then deleted outright.
    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn a_directory_deleted_after_a_round_trip_move_leaves_the_listing() {
        let temp = workspace_with(&["a.ts"]);
        temp.child(".gitignore").write_str("dist/\n").unwrap();
        temp.child("dist/a.json").write_str("a").unwrap();
        temp.child("dist/sub/b.json").write_str("b").unwrap();
        temp.child("dist/sub/c.json").write_str("c").unwrap();
        let cache = TempDir::new().unwrap();
        let ctx = watching_context(&temp, &cache);
        ctx.all_file_data();
        let root = dunce::canonicalize(temp.path()).unwrap();
        let index = ctx.ignored_index();
        assert!(index.track(temp.path(), "dist"));

        std::fs::remove_file(temp.child("dist/a.json").path()).unwrap();
        ctx.settle();
        assert_eq!(
            index.list(&root, "dist").unwrap(),
            vec!["dist/sub/b.json", "dist/sub/c.json"],
            "after the file delete"
        );

        std::fs::rename(
            temp.child("dist/sub").path(),
            temp.child("dist/moved").path(),
        )
        .unwrap();
        ctx.settle();
        assert_eq!(
            index.list(&root, "dist").unwrap(),
            vec!["dist/moved/b.json", "dist/moved/c.json"],
            "after the move away"
        );

        std::fs::rename(
            temp.child("dist/moved").path(),
            temp.child("dist/sub").path(),
        )
        .unwrap();
        ctx.settle();
        assert_eq!(
            index.list(&root, "dist").unwrap(),
            vec!["dist/sub/b.json", "dist/sub/c.json"],
            "after the move back"
        );

        std::fs::remove_dir_all(temp.child("dist/sub").path()).unwrap();
        ctx.settle();
        assert_eq!(
            index.list(&root, "dist").unwrap(),
            Vec::<String>::new(),
            "after the directory delete"
        );
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn a_listing_sees_a_write_nobody_settled() {
        let temp = workspace_with(&["a.ts"]);
        temp.child(".gitignore").write_str("dist/\n").unwrap();
        let cache = TempDir::new().unwrap();
        let ctx = watching_context(&temp, &cache);
        ctx.all_file_data();
        let root = dunce::canonicalize(temp.path()).unwrap();
        let reader = ctx.reader();
        assert!(reader.track(&root, "dist"));

        // No settle: a listing applies what the watch has delivered itself,
        // so the write shows up within the kernel's hop, not the idle flush.
        temp.child("dist/out.js").write_str("x").unwrap();
        wait_until("a listing never saw the write", || {
            reader.files_under(&root, "dist", true, &|_| true).unwrap() == vec!["dist/out.js"]
        });
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn a_listing_waits_for_a_walk_in_progress_to_relist() {
        let temp = workspace_with(&["a.ts"]);
        temp.child("dist/a.js").write_str("a").unwrap();
        let cache = TempDir::new().unwrap();
        let ctx = context(&temp, &cache);
        files_of(&ctx);
        let root = temp.path().to_path_buf();
        let reader = ctx.reader();
        assert!(reader.track(&root, "dist"));

        // Nothing watches, so only the walk can find this file.
        temp.child("dist/b.js").write_str("b").unwrap();
        let lock_path = cache.path().join(NX_FILES_LOCK);
        let mut holder = hold_lock(&cache);
        let waits_before = waits_started_on(&lock_path);
        assert!(ctx.refresh());
        let deadline = Instant::now() + Duration::from_secs(10);
        while waits_started_on(&lock_path) == waits_before {
            assert!(Instant::now() < deadline, "the walk never started");
            std::thread::sleep(Duration::from_millis(5));
        }

        let (tx, rx) = std::sync::mpsc::channel();
        let listing = std::thread::spawn(move || {
            tx.send(reader.files_under(&root, "dist", true, &|_| true).unwrap())
                .unwrap();
        });
        assert!(
            rx.recv_timeout(Duration::from_millis(300)).is_err(),
            "the listing answered while the walk was still running"
        );
        holder.unlock().unwrap();
        assert_eq!(
            rx.recv_timeout(Duration::from_secs(10)).unwrap(),
            vec!["dist/a.js", "dist/b.js"]
        );
        listing.join().unwrap();
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    /// A root `.nxignore` rule no longer gates the event stream, so a
    /// directory under one is indexed like any other. The walk reads
    /// `.nxignore`d files, and now the watch reports their changes too, so
    /// the listing can be kept current.
    fn a_directory_with_a_root_nxignore_rule_under_it_is_indexed() {
        let temp = workspace_with(&["a.ts"]);
        temp.child(".gitignore").write_str("dist/\n").unwrap();
        temp.child(".nxignore").write_str("dist/gen\n").unwrap();
        temp.child("dist/gen/x.js").write_str("x").unwrap();
        let cache = TempDir::new().unwrap();
        let ctx = watching_context(&temp, &cache);
        ctx.all_file_data();
        let root = dunce::canonicalize(temp.path()).unwrap();
        let reader = ctx.reader();
        assert!(reader.track(&root, "dist"));
        assert_eq!(
            reader.files_under(&root, "dist", true, &|_| true).unwrap(),
            vec!["dist/gen/x.js"]
        );
        // The file map still applies the rule: it is an input, not a source.
        assert!(!names_of(&ctx).contains(&"dist/gen/x.js".to_string()));
        assert!(reader.track(&root, "src"));
    }

    #[test]
    #[cfg(unix)]
    fn a_linked_directory_moved_in_reports_nothing_from_outside() {
        let temp = workspace_with(&["a.ts"]);
        let elsewhere = TempDir::new().unwrap();
        elsewhere.child("secret/id_rsa").write_str("key").unwrap();
        let staging = TempDir::new().unwrap();
        std::os::unix::fs::symlink(elsewhere.path().join("secret"), staging.path().join("lnk"))
            .unwrap();
        let cache = TempDir::new().unwrap();
        let ctx = watching_context(&temp, &cache);
        ctx.all_file_data();
        std::fs::create_dir_all(temp.path().join("src")).unwrap();
        std::fs::rename(staging.path().join("lnk"), temp.path().join("src/lnk")).unwrap();
        // A write after the move, so the settle below has seen the move's events.
        temp.child("src/after.ts").write_str("after").unwrap();
        wait_until("the later write never arrived", || {
            ctx.settle();
            names_of(&ctx).contains(&"src/after.ts".to_string())
        });
        assert!(!names_of(&ctx).iter().any(|n| n.contains("id_rsa")));
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn a_rescan_relists_the_registered_directories() {
        let temp = workspace_with(&["a.ts"]);
        temp.child(".gitignore").write_str("dist/\n").unwrap();
        temp.child("dist/a.js").write_str("a").unwrap();
        let cache = TempDir::new().unwrap();
        let ctx = watching_context(&temp, &cache);
        ctx.all_file_data();
        let root = dunce::canonicalize(temp.path()).unwrap();
        let index = ctx.ignored_index();
        assert!(index.track(temp.path(), "dist"));
        assert_eq!(index.list(&root, "dist").unwrap(), vec!["dist/a.js"]);
        // Put the index in the wrong: a member dropped while the file stays.
        index.note_deleted("dist/a.js");
        assert_eq!(index.list(&root, "dist").unwrap(), Vec::<String>::new());
        ctx.rescan_and_diff();
        assert_eq!(index.list(&root, "dist").unwrap(), vec!["dist/a.js"]);
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn the_watch_thread_records_changes_and_a_read_applies_them() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();
        let ctx = watching_context(&temp, &cache);
        ctx.all_file_data();
        let seen: Arc<Mutex<Vec<WatchEvent>>> = Arc::new(Mutex::new(Vec::new()));
        let sink_seen = Arc::clone(&seen);
        ctx.events.subscribe(Arc::new(move |result| {
            sink_seen.lock().extend(result.expect("no watcher error"));
        }));
        let scanned = ctx.change_seq();

        temp.child("b.ts").write_str("b").unwrap();
        wait_until("the write never reached the watch", || {
            seen.lock().iter().any(|e| e.path == "b.ts")
        });
        // Delivered, with nobody subscribed to changes and nobody reading:
        // recorded, not applied.
        let (lock, _) = ctx.files.0.as_ref().unwrap().deref();
        {
            let state = lock.lock().unwrap();
            assert!(state.delivered.iter().any(|c| c.path == "b.ts"));
            assert!(!state.files.contains_key(Path::new("b.ts")));
        }
        assert_eq!(ctx.change_seq(), scanned);
        // The next read applies it.
        assert!(names_of(&ctx).contains(&"b.ts".to_string()));
        assert!(lock.lock().unwrap().delivered.is_empty());
    }

    #[test]
    fn delivered_changes_apply_in_the_order_they_happened() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();
        let ctx = context(&temp, &cache);
        files_of(&ctx);
        let root = temp.path().to_path_buf();
        // a.ts was deleted and written again; the watch delivered both before
        // anyone applied them, then a reader brings a later update of its own.
        std::fs::write(temp.path().join("a.ts"), "again").unwrap();
        ctx.files.deliver(vec![
            Change {
                path: "a.ts".into(),
                kind: ChangeKind::Deleted,
            },
            Change {
                path: "a.ts".into(),
                kind: ChangeKind::Created,
            },
        ]);
        let batch = ctx
            .files
            .ingest(&root, &as_string(&cache), Vec::new(), WhenScanning::Wait);
        assert_eq!(batch.updated_files.len() + batch.created_files.len(), 1);
        assert_eq!(names_of(&ctx), vec!["a.ts"]);
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
                .created_files
                .iter()
                .any(|f| f.file == "dist/out.js")
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
                always_watch: Some(vec![".nx/workspace-data/d/server-process.json".into()]),
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

    #[test]
    fn tracked_files_answers_from_the_files_and_nothing_else() {
        let temp = workspace_with(&["a.ts", "src/b.ts"]);
        temp.child(".gitignore").write_str("dist/\n").unwrap();
        temp.child("dist/out.js").write_str("x").unwrap();
        let cache = TempDir::new().unwrap();
        let ctx = watching_context(&temp, &cache);
        ctx.all_file_data();

        assert_eq!(
            ctx.tracked_files(vec![
                "a.ts".into(),
                "dist/out.js".into(),
                "src/b.ts".into(),
                "never.ts".into(),
            ]),
            vec!["a.ts".to_string(), "src/b.ts".to_string()],
            "gitignored and absent paths are not tracked"
        );

        // A write the watch reports becomes tracked; a delete stops being so.
        temp.child("src/c.ts").write_str("c").unwrap();
        wait_until("the new file never reached the files", || {
            !ctx.tracked_files(vec!["src/c.ts".into()]).is_empty()
        });
        std::fs::remove_file(temp.child("src/b.ts").path()).unwrap();
        wait_until("the delete never reached the files", || {
            ctx.tracked_files(vec!["src/b.ts".into()]).is_empty()
        });
    }

    #[test]
    fn a_rescan_queued_during_a_walk_walks_again() {
        // An overflow during a walk can drop events for directories the walk
        // had already passed, so the walk that lands cannot stand in for it.
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();
        let ctx = context(&temp, &cache);
        let walked: Files = ctx
            .all_file_data()
            .into_iter()
            .map(|f| (PathBuf::from(f.file), f.hash))
            .collect();

        assert!(ctx.files.begin_walk());
        temp.child("b.ts").write_str("b").unwrap();
        ctx.files
            .0
            .as_ref()
            .unwrap()
            .0
            .lock()
            .unwrap()
            .queued
            .push(Change::rescan());

        let batch = ctx
            .files
            .finish_walk(&ctx.workspace_root_path, &ctx.cache_dir, walked, false);

        assert_eq!(names_of(&ctx), vec!["a.ts", "b.ts"]);
        assert!(
            batch.created_files.iter().any(|f| f.file == "b.ts"),
            "{batch:?}"
        );
    }
}
