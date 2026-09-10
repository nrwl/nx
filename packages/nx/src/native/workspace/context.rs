use std::collections::{HashMap, HashSet};
use std::mem;
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::sync::Arc;
#[cfg(not(target_arch = "wasm32"))]
use std::time::SystemTime;

use crate::native::glob::glob_files::glob_files;
use crate::native::hasher::hash;
use crate::native::project_graph::utils::{ProjectRootMappings, find_project_for_path};
use crate::native::types::FileData;
#[cfg(not(target_arch = "wasm32"))]
use crate::native::utils::file_lock::FileLock;
use crate::native::utils::{Normalize, NxCondvar, NxMutex, path::get_child_files};
#[cfg(not(target_arch = "wasm32"))]
use crate::native::workspace::files_archive::archive_modified_at;
use crate::native::workspace::files_archive::{
    NxFileHashes, read_files_archive, write_files_archive,
};
use crate::native::workspace::files_hashing::{full_files_hash, selective_files_hash};
use crate::native::workspace::types::{
    FileMap, NxWorkspaceFilesExternals, ProjectFiles, UpdatedWorkspaceFiles,
};
use crate::native::workspace::{types::NxWorkspaceFiles, workspace_files};
use napi::bindgen_prelude::External;
use rayon::prelude::*;
use tracing::{trace, warn};
use xxhash_rust::xxh3;

#[napi]
pub struct WorkspaceContext {
    pub workspace_root: String,
    workspace_root_path: PathBuf,
    files_worker: FilesWorker,
}

type Files = Vec<(PathBuf, String)>;

const NX_FILES_LOCK: &str = "nx_files.lock";

fn archive_to_files(archive: NxFileHashes) -> Files {
    let mut files: Files = archive
        .into_iter()
        .map(|(path, hashed)| (PathBuf::from(path), hashed.0))
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
/// `trust_archive` is for plugin workers: their host has finished walking
/// before it asks them for anything, so any archive present is current and the
/// walk is skipped outright. It still walks when there is no archive at all.
#[cfg(not(target_arch = "wasm32"))]
fn acquire_files(workspace_root: &Path, cache_dir: &str, trust_archive: bool) -> Files {
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

    loop {
        if trust_archive {
            if lock.check().unwrap_or(false) {
                let _ = lock.wait_blocking();
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
                let waited_from = SystemTime::now();
                trace!("another process is walking the workspace, waiting for its archive");
                if lock.wait_blocking().is_err() {
                    return gather_and_hash_files(workspace_root, cache_dir.to_owned());
                }
                if archive_modified_at(cache_dir).is_some_and(|written| written >= waited_from) {
                    if let Some(archive) = read_files_archive(cache_dir) {
                        trace!(
                            "loaded {} files from the archive another process wrote",
                            archive.len()
                        );
                        return archive_to_files(archive);
                    }
                }
                trace!("the other walk left no fresh archive, walking");
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

fn gather_and_hash_files(workspace_root: &Path, cache_dir: String) -> Vec<(PathBuf, String)> {
    let archived_files = read_files_archive(&cache_dir);

    trace!("Gathering files in {}", workspace_root.display());
    let now = std::time::Instant::now();
    let file_hashes = if let Some(archived_files) = archived_files {
        selective_files_hash(workspace_root, archived_files)
    } else {
        full_files_hash(workspace_root)
    };

    write_files_archive(&cache_dir, &file_hashes);

    // Drain the map rather than clone it: the path and hash strings move into
    // the vec, so the list is never held twice.
    let files = archive_to_files(file_hashes);
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

            let files = acquire_files(&workspace_root, &cache_dir, false);

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

            let files = acquire_files(&workspace_root, &cache_dir, true);

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

    fn get_files(&self) -> Vec<FileData> {
        if let Some(files_sync) = &self.0 {
            let (files_lock, cvar) = files_sync.deref();

            trace!("waiting for files to be available");
            let files = files_lock.lock().expect("Should be able to lock files");

            #[cfg(target_arch = "wasm32")]
            let files = cvar
                .wait(files, |guard| guard.len() == 0)
                .expect("Should be able to wait for files");

            #[cfg(not(target_arch = "wasm32"))]
            let files = cvar
                .wait(files, |guard| guard.len() == 0)
                .expect("Should be able to wait for files");

            let file_data = files
                .iter()
                .map(|(path, hash)| FileData {
                    file: path.to_normalized_string(),
                    hash: hash.clone(),
                })
                .collect();

            drop(files);

            trace!("files are available");
            file_data
        } else {
            vec![]
        }
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

        let (files_lock, _) = &files_sync.deref();
        let mut files = files_lock
            .lock()
            .expect("Should always be able to update files");
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
        }
    }

    /// Loads the files the last walk recorded instead of walking. For a
    /// process whose host already walked, such as a plugin worker.
    #[napi(factory)]
    pub fn from_archive(workspace_root: String, cache_dir: String) -> Self {
        trace!(?workspace_root, "from archive");

        let workspace_root_path = PathBuf::from(&workspace_root);

        WorkspaceContext {
            files_worker: FilesWorker::from_archive(&workspace_root_path, cache_dir),
            workspace_root,
            workspace_root_path,
        }
    }

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
        let file_data = self.all_file_data();
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
        let file_data = self.all_file_data();

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
        let files = &self.all_file_data();
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
        let files = &self.all_file_data();
        let globbed_files = glob_files(files, globs, exclude)?.collect::<Vec<_>>();

        let mut hasher = xxh3::Xxh3::new();
        for file in globbed_files {
            hasher.update(file.file.as_bytes());
            hasher.update(file.hash.as_bytes());
        }

        Ok(hasher.digest().to_string())
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

    #[napi]
    pub fn get_files_in_directory(&self, directory: String) -> Vec<String> {
        get_child_files(directory, self.files_worker.get_files())
    }
}

impl Drop for WorkspaceContext {
    fn drop(&mut self) {
        let fw = mem::take(&mut self.files_worker);
        drop(fw);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::workspace::files_archive::{NxFileHashed, archive_path};
    use assert_fs::TempDir;
    use assert_fs::prelude::*;
    use std::time::Duration;

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
    fn the_archive_is_renamed_into_place_leaving_no_staging_file() {
        let temp = workspace_with(&["a.ts"]);
        let cache = TempDir::new().unwrap();

        WorkspaceContext::new(as_string(&temp), as_string(&cache)).all_file_data();

        let mut entries: Vec<String> = std::fs::read_dir(cache.path())
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().to_string())
            .collect();
        entries.sort();
        assert_eq!(entries, vec!["nx_files.lock", "nx_files.nxt"]);
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

    #[cfg(not(target_arch = "wasm32"))]
    fn walk_in_another_thread(
        temp: &TempDir,
        cache: &TempDir,
    ) -> std::thread::JoinHandle<Vec<(String, String)>> {
        let root = as_string(temp);
        let cache_dir = as_string(cache);
        let handle = std::thread::spawn(move || files_of(&WorkspaceContext::new(root, cache_dir)));
        // Give the walker time to find the lock held and start waiting.
        std::thread::sleep(Duration::from_millis(300));
        handle
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
