use std::collections::{HashMap, HashSet};
use std::mem;
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::sync::Arc;
#[cfg(not(target_arch = "wasm32"))]
use std::time::{Duration, Instant, SystemTime};

use crate::native::glob::glob_files::{glob_files, glob_paths, glob_ranges};
use crate::native::glob::prefix::candidate_ranges;
use crate::native::hasher::hash;
use crate::native::project_graph::utils::{ProjectRootMappings, find_project_for_path};
use crate::native::types::FileData;
#[cfg(not(target_arch = "wasm32"))]
use crate::native::utils::file_lock::FileLock;
use crate::native::utils::{Normalize, NxCondvar, NxMutex, gather_stamp, path::get_child_files};
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
use napi::{Env, Task};
use rayon::prelude::*;
use tracing::{trace, warn};
use xxhash_rust::xxh3;

#[napi]
pub struct WorkspaceContext {
    pub workspace_root: String,
    workspace_root_path: PathBuf,
    /// Retained so `rescan_and_diff` can re-gather through the same files
    /// archive the initial gather used, keeping the walk incremental.
    cache_dir: String,
    files_worker: FilesWorker,
}

type Files = Vec<(PathBuf, String)>;

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
pub struct FilesReady(Option<Arc<(NxMutex<Files>, NxCondvar)>>);

#[cfg(not(target_arch = "wasm32"))]
impl Task for FilesReady {
    type Output = ();
    type JsValue = ();

    fn compute(&mut self) -> napi::Result<()> {
        if let Some(files_sync) = &self.0 {
            let (files_lock, cvar) = files_sync.deref();
            let files = files_lock
                .lock()
                .map_err(|e| napi::Error::from_reason(e.to_string()))?;
            let _files = cvar
                .wait(files, |guard| guard.is_empty())
                .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        }
        Ok(())
    }

    fn resolve(&mut self, _env: Env, _output: ()) -> napi::Result<()> {
        Ok(())
    }
}

fn hashes_to_files(hashes: NxFileHashes) -> Files {
    let mut files: Files = hashes
        .into_iter()
        .map(|(path, hashed)| (PathBuf::from(path), hashed.0))
        .collect();
    files.par_sort();
    files
}

fn archive_to_files(archive: FilesArchive) -> Files {
    let mut files: Files = archive
        .iter()
        .map(|(path, hash, _)| (PathBuf::from(path), hash.to_owned()))
        .collect();
    files.par_sort();
    files
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

/// What a rescan re-walk found had changed while the watcher was not being told.
#[napi(object)]
#[derive(Default)]
pub struct RescanDiff {
    pub created_files: Vec<FileData>,
    pub updated_files: Vec<FileData>,
    pub deleted_files: Vec<String>,
}

fn diff_files(before: &Files, after: &Files) -> RescanDiff {
    // Keyed lookup with `remove`, so "absent" and "present with an odd value"
    // stay distinguishable — a map keyed on the hash could not tell them apart,
    // and a path mistaken for absent would be reported created AND deleted.
    let mut previous: HashMap<&PathBuf, &String> =
        before.iter().map(|(path, hash)| (path, hash)).collect();
    let mut created_files = Vec::new();
    let mut updated_files = Vec::new();

    for (path, hash) in after {
        let file = FileData {
            file: path.to_normalized_string(),
            hash: hash.clone(),
        };
        match previous.remove(path) {
            None => created_files.push(file),
            Some(previous_hash) if previous_hash != hash => updated_files.push(file),
            Some(_) => {}
        }
    }

    RescanDiff {
        // Whatever the walk did not find is gone. Ground truth, not inference
        // from a prior event stream that is by definition incomplete here.
        deleted_files: previous.keys().map(|p| p.to_normalized_string()).collect(),
        created_files,
        updated_files,
    }
}

fn gather_and_hash_files(workspace_root: &Path, cache_dir: String) -> Vec<(PathBuf, String)> {
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
    // the vec, so the list is never held twice.
    let files = hashes_to_files(file_hashes);
    trace!("hashed and sorted files in {:?}", now.elapsed());

    files
}

#[derive(Default)]
struct FilesWorker(Option<Arc<(NxMutex<Files>, NxCondvar)>>);
impl FilesWorker {
    #[cfg(not(target_arch = "wasm32"))]
    fn gather_files(workspace_root: &Path, cache_dir: String) -> Self {
        if !workspace_root.exists() {
            warn!(
                "workspace root does not exist: {}",
                workspace_root.display()
            );
            return FilesWorker(None);
        }

        let files_lock = Arc::new((NxMutex::new(Vec::new()), NxCondvar::new()));
        let files_lock_clone = Arc::clone(&files_lock);
        let workspace_root = workspace_root.to_owned();

        std::thread::spawn(move || {
            let (lock, cvar) = &*files_lock_clone;
            trace!("Initially locking files");
            let mut workspace_files = lock.lock().expect("Should be the first time locking files");

            let files = acquire_files(&workspace_root, &cache_dir, false, files_lock_wait());

            *workspace_files = files;
            let files_len = workspace_files.len();
            trace!(?files_len, "files retrieved");

            drop(workspace_files);
            cvar.notify_all();
        });

        FilesWorker(Some(files_lock))
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn from_archive(workspace_root: &Path, cache_dir: String) -> Self {
        if !workspace_root.exists() {
            warn!(
                "workspace root does not exist: {}",
                workspace_root.display()
            );
            return FilesWorker(None);
        }

        let files_lock = Arc::new((NxMutex::new(Vec::new()), NxCondvar::new()));
        let files_lock_clone = Arc::clone(&files_lock);
        let workspace_root = workspace_root.to_owned();

        std::thread::spawn(move || {
            let (lock, cvar) = &*files_lock_clone;
            let mut workspace_files = lock.lock().expect("Should be the first time locking files");

            let files = acquire_files(&workspace_root, &cache_dir, true, files_lock_wait());

            *workspace_files = files;
            let files_len = workspace_files.len();
            trace!(?files_len, "files retrieved");

            drop(workspace_files);
            cvar.notify_all();
        });

        FilesWorker(Some(files_lock))
    }

    #[cfg(target_arch = "wasm32")]
    fn from_archive(workspace_root: &Path, cache_dir: String) -> Self {
        if !workspace_root.exists() {
            warn!(
                "workspace root does not exist: {}",
                workspace_root.display()
            );
            return FilesWorker(None);
        }

        let files = match read_files_archive(&cache_dir) {
            Some(archive) => archive_to_files(archive),
            None => gather_and_hash_files(workspace_root, cache_dir),
        };

        let files_lock = Arc::new((NxMutex::new(files), NxCondvar::new()));

        FilesWorker(Some(files_lock))
    }

    #[cfg(target_arch = "wasm32")]
    fn gather_files(workspace_root: &Path, cache_dir: String) -> Self {
        if !workspace_root.exists() {
            warn!(
                "workspace root does not exist: {}",
                workspace_root.display()
            );
            return FilesWorker(None);
        }

        let workspace_root = workspace_root.to_owned();

        let files = gather_and_hash_files(&workspace_root, cache_dir);

        trace!("{} files retrieved", files.len());

        let files_lock = Arc::new((NxMutex::new(files), NxCondvar::new()));

        FilesWorker(Some(files_lock))
    }

    /// Walks again into the same list, rewriting the archive. Returns false,
    /// doing nothing, when a walk is already in progress.
    #[cfg(not(target_arch = "wasm32"))]
    fn refresh(&self, workspace_root: &Path, cache_dir: String) -> bool {
        let Some(files_sync) = &self.0 else {
            return false;
        };
        let (files_lock, _) = files_sync.deref();
        // The first walk holds the lock throughout, and a refresh leaves the
        // list empty while it walks, so either means a walk is in progress.
        let Some(mut files) = files_lock.try_lock() else {
            return false;
        };
        if files.is_empty() {
            return false;
        }
        // Readers wait while the list is empty, so none sees the old one.
        *files = Vec::new();
        drop(files);

        let files_sync = Arc::clone(files_sync);
        let workspace_root = workspace_root.to_owned();
        std::thread::spawn(move || {
            let files = acquire_files(&workspace_root, &cache_dir, false, files_lock_wait());
            let (lock, cvar) = &*files_sync;
            let mut workspace_files = lock.lock().expect("Should be able to lock files");
            *workspace_files = files;
            trace!(files_len = workspace_files.len(), "files refreshed");
            drop(workspace_files);
            cvar.notify_all();
        });
        true
    }

    #[cfg(target_arch = "wasm32")]
    fn refresh(&self, workspace_root: &Path, cache_dir: String) -> bool {
        let Some(files_sync) = &self.0 else {
            return false;
        };
        let files = gather_and_hash_files(workspace_root, cache_dir);
        let (files_lock, _) = files_sync.deref();
        *files_lock.lock().expect("Should be able to lock files") = files;
        true
    }

    fn with_files<T>(&self, read: impl FnOnce(&[(PathBuf, String)]) -> T) -> T {
        if let Some(files_sync) = &self.0 {
            let (files_lock, cvar) = files_sync.deref();
            trace!("waiting for files to be available");
            let files = files_lock.lock().expect("Should be able to lock files");
            let files = cvar
                .wait(files, |guard| guard.is_empty())
                .expect("Should be able to wait for files");
            // Keep the snapshot stable until this read completes. Refreshes and
            // incremental updates must not mutate paths borrowed by a query.
            read(&files)
        } else {
            read(&[])
        }
    }

    fn get_files(&self) -> Vec<FileData> {
        self.with_files(owned_file_data)
    }

    /// Re-walk the workspace, diff it against the map we are holding, then adopt
    /// the fresh map. Used to recover after the kernel dropped watch events, so
    /// the per-path stream cannot be trusted complete.
    fn rescan_and_diff(&self, workspace_root: &Path, cache_dir: String) -> RescanDiff {
        let Some(files_sync) = &self.0 else {
            return RescanDiff::default();
        };

        // Walk before locking. The walk is the slow part and readers should not
        // block on it. Nothing can interleave in practice — `rescanAndDiff` is a
        // synchronous napi call on the daemon's single JS thread, so no
        // `incremental_update` runs during it. Note the downstream asymmetry if
        // that ever changes: an over-reported create/update is collapsed by
        // re-hashing, but an over-reported delete is taken at face value.
        let fresh = gather_and_hash_files(workspace_root, cache_dir);

        let (files_lock, cvar) = files_sync.deref();
        let files = files_lock.lock().expect("Should be able to lock files");
        let mut files = cvar
            .wait(files, |guard| guard.len() == 0)
            .expect("Should be able to wait for files");

        let diff = diff_files(&files, &fresh);
        *files = fresh;
        diff
    }

    pub fn update_files(
        &self,
        workspace_root_path: &Path,
        updated_files: Vec<&str>,
        deleted_files_and_directories: Vec<&str>,
    ) -> HashMap<String, String> {
        let Some(files_sync) = &self.0 else {
            trace!("there were no files because the workspace root did not exist");
            return HashMap::new();
        };

        let (files_lock, cvar) = &files_sync.deref();
        let files = files_lock
            .lock()
            .expect("Should always be able to update files");
        // Draining an empty list mid-refresh would publish only these updates.
        let mut files = cvar
            .wait(files, |guard| guard.is_empty())
            .expect("Should be able to wait for files");
        let mut map: HashMap<PathBuf, String> = files.drain(..).collect();

        for deleted_path in deleted_files_and_directories {
            // If the path is a file, this removes it.
            let removal = map.remove(&PathBuf::from(deleted_path));
            if removal.is_none() {
                // If the path is a directory, this retains only files not in the directory.
                let prefix = Path::new(deleted_path);
                map.retain(|path, _| !path.starts_with(prefix));
            };
        }

        let new_hashes: HashMap<String, String> = updated_files
            .par_iter()
            .filter_map(|path| {
                let full_path = workspace_root_path.join(path);
                let Ok(content) = std::fs::read(&full_path) else {
                    trace!("could not read file: {full_path:?}");
                    return None;
                };
                Some((path.to_string(), hash(&content)))
            })
            .collect();

        // Report only files whose content actually changed (new files, or
        // files whose hash differs from what we already had). Restoring a
        // cached task output rewrites a file with identical bytes (new inode,
        // same content) and the watcher reports it as a change — but treating
        // that as a real change makes the daemon recompute the project graph
        // for nothing.
        let mut changed_files_hashes: HashMap<String, String> = HashMap::new();
        for (file, new_hash) in new_hashes {
            match map.get(Path::new(&file)) {
                Some(existing) if *existing == new_hash => {
                    // Unchanged content — leave the map as-is, do not report.
                }
                _ => {
                    map.insert(PathBuf::from(&file), new_hash.clone());
                    changed_files_hashes.insert(file, new_hash);
                }
            }
        }

        *files = map.into_iter().collect();
        files.par_sort();

        changed_files_hashes
    }
}

#[napi]
impl WorkspaceContext {
    #[napi(constructor)]
    pub fn new(workspace_root: String, cache_dir: String) -> Self {
        trace!(?workspace_root);

        let workspace_root_path = PathBuf::from(&workspace_root);

        WorkspaceContext {
            files_worker: FilesWorker::gather_files(&workspace_root_path, cache_dir.clone()),
            workspace_root,
            workspace_root_path,
            cache_dir,
        }
    }

    /// Loads the files the last walk recorded instead of walking. For a
    /// process whose host already walked, such as a plugin worker.
    #[napi(factory)]
    pub fn from_archive(workspace_root: String, cache_dir: String) -> Self {
        trace!(?workspace_root, "from archive");

        let workspace_root_path = PathBuf::from(&workspace_root);

        WorkspaceContext {
            files_worker: FilesWorker::from_archive(&workspace_root_path, cache_dir.clone()),
            workspace_root,
            workspace_root_path,
            cache_dir,
        }
    }

    /// Walks the workspace again into this context, so it and the archive
    /// include writes made since the last walk. Does nothing while a walk is
    /// in progress. Await `ready()` before reading.
    #[napi]
    pub fn refresh(&self) -> bool {
        self.files_worker
            .refresh(&self.workspace_root_path, self.cache_dir.clone())
    }

    /// Resolves once the files behind this context exist. The readers below
    /// block the calling thread until they do; awaiting this first keeps a
    /// plugin host responsive while its workers are connecting.
    #[cfg(not(target_arch = "wasm32"))]
    #[napi(ts_return_type = "Promise<void>")]
    pub fn ready(&self) -> AsyncTask<FilesReady> {
        AsyncTask::new(FilesReady(self.files_worker.0.clone()))
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
        workspace_files::get_files(project_root_map, self.all_file_data())
            .map_err(anyhow::Error::from)
    }

    #[napi]
    pub fn glob(
        &self,
        globs: Vec<String>,
        exclude: Option<Vec<String>>,
    ) -> napi::Result<Vec<String>> {
        self.files_worker
            .with_files(|files| match candidate_ranges(files, &globs) {
                Some(ranges) => {
                    glob_ranges(files, ranges, globs, exclude, |(path, _)| path.into_owned())
                }
                None => Ok(glob_paths(files.par_iter(), globs, exclude)?
                    .map(|(path, _)| path.into_owned())
                    .collect()),
            })
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
        self.files_worker.with_files(|files| {
            let ranges: Vec<_> = globs
                .iter()
                .map(|glob| candidate_ranges(files, std::slice::from_ref(glob)))
                .collect();
            // Unrestricted patterns share one owned normalized view, as before.
            // Literal-root queries can avoid scanning that entire view.
            let all_files = ranges
                .iter()
                .any(Option::is_none)
                .then(|| owned_file_data(files));
            globs
                .into_iter()
                .zip(ranges)
                .map(|(glob, ranges)| match ranges {
                    Some(ranges) => {
                        glob_ranges(files, ranges, vec![glob], exclude.clone(), |(path, _)| {
                            path.into_owned()
                        })
                    }
                    None => {
                        Ok(
                            glob_files(all_files.as_ref().unwrap(), vec![glob], exclude.clone())?
                                .map(|file| file.file.to_owned())
                                .collect(),
                        )
                    }
                })
                .collect()
        })
    }

    #[napi]
    pub fn hash_files_matching_globs(
        &self,
        glob_groups: Vec<Vec<String>>,
    ) -> napi::Result<Vec<String>> {
        self.files_worker.with_files(|files| {
            let ranges: Vec<_> = glob_groups
                .iter()
                .map(|globs| candidate_ranges(files, globs))
                .collect();
            let all_files = ranges
                .iter()
                .any(Option::is_none)
                .then(|| owned_file_data(files));
            glob_groups
                .into_iter()
                .zip(ranges)
                .map(|(globs, ranges)| match ranges {
                    Some(ranges) => Ok(hash_paths(glob_ranges(
                        files,
                        ranges,
                        globs,
                        None,
                        std::convert::identity,
                    )?)),
                    None => Ok(hash_paths(
                        glob_files(all_files.as_ref().unwrap(), globs, None)?
                            .collect::<Vec<_>>()
                            .into_iter()
                            .map(|file| (file.file.as_str(), file.hash.as_str())),
                    )),
                })
                .collect()
        })
    }

    #[napi]
    pub fn hash_files_matching_glob(
        &self,
        globs: Vec<String>,
        exclude: Option<Vec<String>>,
    ) -> napi::Result<String> {
        self.files_worker.with_files(|files| {
            let matched = match candidate_ranges(files, &globs) {
                Some(ranges) => glob_ranges(files, ranges, globs, exclude, std::convert::identity)?,
                None => glob_paths(files.par_iter(), globs, exclude)?.collect::<Vec<_>>(),
            };
            Ok(hash_paths(matched))
        })
    }

    #[napi]
    pub fn incremental_update(
        &self,
        updated_files: Vec<String>,
        deleted_files: Vec<String>,
    ) -> HashMap<String, String> {
        let updated: Vec<&str> = updated_files.iter().map(|s| s.as_str()).collect();
        let deleted: Vec<&str> = deleted_files.iter().map(|s| s.as_str()).collect();
        self.files_worker
            .update_files(&self.workspace_root_path, updated, deleted)
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
                all_workspace_files: External::new(Arc::new(self.all_file_data())),
            },
        }
    }

    #[napi]
    pub fn all_file_data(&self) -> Vec<FileData> {
        self.files_worker.get_files()
    }

    /// Recover from dropped watch events: re-walk, and report what changed
    /// against the map this context was holding. The fresh map is adopted, so
    /// the caller only has to feed the returned changes through its normal
    /// recomputation path.
    #[napi]
    pub fn rescan_and_diff(&self) -> RescanDiff {
        self.files_worker
            .rescan_and_diff(&self.workspace_root_path, self.cache_dir.clone())
    }

    #[napi]
    pub fn get_files_in_directory(&self, directory: String) -> Vec<String> {
        get_child_files(directory, self.files_worker.get_files())
    }
}

fn owned_file_data(files: &[(PathBuf, String)]) -> Vec<FileData> {
    files
        .iter()
        .map(|(path, hash)| FileData {
            file: path.to_normalized_string(),
            hash: hash.clone(),
        })
        .collect()
}

fn hash_paths<'a, P: AsRef<str>>(matches: impl IntoIterator<Item = (P, &'a str)>) -> String {
    let mut hasher = xxh3::Xxh3::new();
    // Hash the same normalized path/hash bytes in the same order as before.
    // Do not combine parallel partial hashes: that would change task hashes.
    for (path, hash) in matches {
        hasher.update(path.as_ref().as_bytes());
        hasher.update(hash.as_bytes());
    }
    hasher.digest().to_string()
}

impl Drop for WorkspaceContext {
    fn drop(&mut self) {
        let fw = mem::take(&mut self.files_worker);
        drop(fw);
    }
}

#[cfg(test)]
mod tests {

    #[test]
    fn diff_files_classifies_created_updated_unchanged_and_deleted() {
        use super::diff_files;
        use std::path::PathBuf;

        let before = vec![
            (PathBuf::from("a.ts"), String::from("1")),
            (PathBuf::from("b.ts"), String::from("2")),
            (PathBuf::from("c.ts"), String::from("3")),
        ];
        let after = vec![
            (PathBuf::from("b.ts"), String::from("2")),
            (PathBuf::from("c.ts"), String::from("changed")),
            (PathBuf::from("d.ts"), String::from("4")),
        ];

        let diff = diff_files(&before, &after);

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
    use super::*;
    use crate::native::workspace::files_archive::{NxFileHashed, archive_path};
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

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

    fn files_of(ctx: &WorkspaceContext) -> Vec<(String, String)> {
        ctx.all_file_data()
            .into_iter()
            .map(|f| (f.file, f.hash))
            .collect()
    }

    #[test]
    fn from_archive_loads_what_the_last_walk_recorded_without_walking() {
        let temp = workspace_with(&["a.ts", "src/b.ts"]);
        let cache = TempDir::new().unwrap();

        let walked = WorkspaceContext::new(as_string(&temp), as_string(&cache));
        let recorded = files_of(&walked);

        // Change the disk without touching the archive. A walk would see both
        // changes; a load of the archive cannot.
        std::fs::remove_file(temp.child("a.ts").path()).unwrap();
        temp.child("c.ts").write_str("c").unwrap();

        let loaded = WorkspaceContext::from_archive(as_string(&temp), as_string(&cache));
        assert_eq!(files_of(&loaded), recorded);
    }

    #[test]
    fn from_archive_walks_when_there_is_no_archive() {
        let temp = workspace_with(&["a.ts", "src/b.ts"]);
        let cache = TempDir::new().unwrap();

        let ctx = WorkspaceContext::from_archive(as_string(&temp), as_string(&cache));
        let names: Vec<String> = files_of(&ctx).into_iter().map(|(f, _)| f).collect();
        assert_eq!(names, vec!["a.ts", "src/b.ts"]);
    }

    #[test]
    fn a_rewrite_replaces_the_archive_by_rename_and_leaves_no_staging_file() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();

        WorkspaceContext::new(as_string(&temp), as_string(&cache)).all_file_data();
        let first = std::fs::metadata(archive_path(cache.path())).unwrap();
        WorkspaceContext::new(as_string(&temp), as_string(&cache)).all_file_data();
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
        let handle = std::thread::spawn(move || files_of(&WorkspaceContext::new(root, cache_dir)));
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

        let names: Vec<String> = files
            .into_iter()
            .map(|(f, _)| f.to_string_lossy().to_string())
            .collect();
        assert_eq!(names, vec!["a.ts"]);
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

        let names: Vec<String> = files
            .into_iter()
            .map(|(f, _)| f.to_string_lossy().to_string())
            .collect();
        assert_eq!(names, vec!["a.ts"]);
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
        let ctx = WorkspaceContext::new(as_string(&temp), as_string(&cache));
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
        let loaded = WorkspaceContext::from_archive(as_string(&temp), as_string(&cache));
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

        let ctx = WorkspaceContext::new(as_string(&temp), as_string(&cache));
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
    /// returning paths in sorted order. Internally that's `par_sort` after
    /// hashing + a Rayon `par_iter().filter()` (order-preserving) — but the
    /// guarantee is a public contract, so it's worth a smoke test that
    /// exercises the full path through `WorkspaceContext::new`.
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
        let ctx = WorkspaceContext::new(
            temp.path().to_string_lossy().to_string(),
            cache.path().to_string_lossy().to_string(),
        );

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

    #[test]
    fn glob_hash_queries_match_the_original_snapshot_before_and_after_updates() {
        use crate::native::glob::glob_files::glob_files;
        fn verify(ctx: &WorkspaceContext) {
            let files = ctx.all_file_data();
            let groups: Vec<Vec<String>> = [
                vec![],
                vec!["**/*"],
                vec!["src/**/*"],
                vec!["**/*.ts", "!**/*.spec.ts"],
                vec!["package.json", "src/**/*.ts"],
                vec!["missing/**/*"],
            ]
            .into_iter()
            .map(|g| g.into_iter().map(str::to_string).collect())
            .collect();
            let mut expected_hashes = Vec::new();
            for globs in &groups {
                for exclude in [None, Some(vec!["**/*.spec.ts".to_string()])] {
                    let matches: Vec<_> = glob_files(&files, globs.clone(), exclude.clone())
                        .unwrap()
                        .collect();
                    let mut hasher = xxh3::Xxh3::new();
                    for file in &matches {
                        hasher.update(file.file.as_bytes());
                        hasher.update(file.hash.as_bytes());
                    }
                    let expected = hasher.digest().to_string();
                    assert_eq!(
                        ctx.hash_files_matching_glob(globs.clone(), exclude.clone())
                            .unwrap(),
                        expected
                    );
                    assert_eq!(
                        ctx.glob(globs.clone(), exclude.clone()).unwrap(),
                        matches.iter().map(|f| f.file.clone()).collect::<Vec<_>>()
                    );
                    if exclude.is_none() {
                        expected_hashes.push(expected);
                    }
                }
            }
            assert_eq!(
                ctx.hash_files_matching_globs(groups).unwrap(),
                expected_hashes
            );
            let patterns = vec!["**/*.ts".to_string(), "src/**/*".to_string()];
            let expected: Vec<_> = patterns
                .iter()
                .map(|glob| ctx.glob(vec![glob.clone()], None).unwrap())
                .collect();
            assert_eq!(ctx.multi_glob(patterns, None).unwrap(), expected);
            let narrow: Vec<String> = [
                "src/**/*",
                "src/nested/**/*",
                "package.json",
                "missing/**/*",
            ]
            .into_iter()
            .map(str::to_owned)
            .collect();
            let expected: Vec<Vec<String>> = narrow
                .iter()
                .map(|glob| {
                    glob_files(&files, vec![glob.clone()], None)
                        .unwrap()
                        .map(|file| file.file.clone())
                        .collect()
                })
                .collect();
            assert_eq!(ctx.multi_glob(narrow.clone(), None).unwrap(), expected);
            let groups: Vec<Vec<String>> = narrow
                .iter()
                .map(|glob| vec![glob.clone(), "package.json".into()])
                .collect();
            let hashes: Vec<String> = groups
                .iter()
                .map(|globs| {
                    let matched: Vec<_> =
                        glob_files(&files, globs.clone(), None).unwrap().collect();
                    let mut hasher = xxh3::Xxh3::new();
                    for file in matched {
                        hasher.update(file.file.as_bytes());
                        hasher.update(file.hash.as_bytes());
                    }
                    hasher.digest().to_string()
                })
                .collect();
            assert_eq!(ctx.hash_files_matching_globs(groups).unwrap(), hashes);
            assert!(
                ctx.glob(vec!["missing/**/*".into()], Some(vec!["[".into()]))
                    .is_err()
            );
            assert!(
                ctx.hash_files_matching_globs(vec![vec!["[".into()]])
                    .is_err()
            );
            assert!(ctx.multi_glob(vec![], None).unwrap().is_empty());
            assert!(ctx.hash_files_matching_globs(vec![]).unwrap().is_empty());
        }
        let temp = workspace_with(&[
            "src/a.ts",
            "src/a.spec.ts",
            "src/nested/b.ts",
            "package.json",
            "東京/é.ts",
        ]);
        let cache = TempDir::new().unwrap();
        let ctx = WorkspaceContext::new(as_string(&temp), as_string(&cache));
        verify(&ctx);
        temp.child("src/a.ts").write_str("changed").unwrap();
        temp.child("src/new.ts").write_str("new").unwrap();
        std::fs::remove_file(temp.child("src/a.spec.ts").path()).unwrap();
        ctx.incremental_update(
            vec!["src/a.ts".into(), "src/new.ts".into()],
            vec!["src/a.spec.ts".into()],
        );
        verify(&ctx);
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
        let ctx = WorkspaceContext::new(
            temp.path().to_string_lossy().to_string(),
            cache.path().to_string_lossy().to_string(),
        );
        // Force the initial file gather + hash to complete before updating.
        ctx.all_file_data();

        // Rewrite a.txt with identical content — a no-op rewrite.
        temp.child("a.txt").write_str("hello").unwrap();
        let no_op = ctx.incremental_update(vec!["a.txt".into()], vec![]);
        assert!(
            no_op.is_empty(),
            "rewriting a file with identical content must report no change; got {no_op:?}"
        );

        // Genuinely change b.txt — must be reported.
        temp.child("b.txt").write_str("changed").unwrap();
        let changed = ctx.incremental_update(vec!["b.txt".into()], vec![]);
        assert_eq!(
            changed.keys().collect::<Vec<_>>(),
            vec![&"b.txt".to_string()],
            "a real content change must be reported; got {changed:?}"
        );

        // A brand-new file must be reported as a change.
        temp.child("c.txt").write_str("new").unwrap();
        let created = ctx.incremental_update(vec!["c.txt".into()], vec![]);
        assert!(
            created.contains_key("c.txt"),
            "a newly-created file must be reported; got {created:?}"
        );
    }
}
