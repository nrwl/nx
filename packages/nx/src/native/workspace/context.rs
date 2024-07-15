use napi::bindgen_prelude::External;
use std::collections::HashMap;

use crate::native::hasher::hash;
use crate::native::utils::{path::get_child_files, Normalize, NxMutex, NxCondvar};
use rayon::prelude::*;
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;

use crate::native::logger::enable_logger;
use crate::native::project_graph::utils::{find_project_for_path, ProjectRootMappings};
use crate::native::types::FileData;
use tracing::{trace, warn};

use crate::native::workspace::files_archive::{read_files_archive, write_files_archive};
use crate::native::workspace::files_hashing::{full_files_hash, selective_files_hash};
use crate::native::workspace::types::{
    FileMap, NxWorkspaceFilesExternals, ProjectFiles, UpdatedWorkspaceFiles,
};
use crate::native::workspace::{config_files, types::NxWorkspaceFiles, workspace_files};

#[napi]
pub struct WorkspaceContext {
    pub workspace_root: String,
    workspace_root_path: PathBuf,
    files_worker: FilesWorker,
}

type Files = Vec<(PathBuf, String)>;

fn gather_and_hash_files(workspace_root: &Path, cache_dir: String) -> Vec<(PathBuf, String)>{
    let archived_files = read_files_archive(&cache_dir);

    trace!("Gathering files in {}", workspace_root.display());
    let now = std::time::Instant::now();
    let file_hashes = if let Some(archived_files) = archived_files {
        selective_files_hash(&workspace_root, archived_files)
    } else {
        full_files_hash(&workspace_root)
    };

    let mut files = file_hashes
        .iter()
        .map(|(path, file_hashed)| (PathBuf::from(path), file_hashed.0.to_owned()))
        .collect::<Vec<_>>();
    files.par_sort();
    trace!("hashed and sorted files in {:?}", now.elapsed());

    write_files_archive(&cache_dir, file_hashes);

    files
}

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

        thread::spawn(move || {
            let (lock, cvar) = &*files_lock_clone;
            trace!("Initially locking files");
            let mut workspace_files = lock.lock().expect("Should be the first time locking files");

            let files = gather_and_hash_files(&workspace_root, cache_dir);

            *workspace_files = files;
            let files_len = workspace_files.len();
            trace!(?files_len, "files retrieved");

            drop(workspace_files);
            cvar.notify_all();
        });

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
            let mut files = cvar.wait(files, |guard| guard.len() == 0).expect("Should be able to wait for files");

            #[cfg(not(target_arch = "wasm32"))]
            let files = cvar.wait(files, |guard| guard.len() == 0).expect("Should be able to wait for files");

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
        let mut files = files_lock.lock().expect("Should always be able to update files");
        let mut map: HashMap<PathBuf, String> = files.drain(..).collect();

        for deleted_path in deleted_files_and_directories {
            // If the path is a file, this removes it.
            let removal = map.remove(&PathBuf::from(deleted_path));
            if removal.is_none() {
                // If the path is a directory, this retains only files not in the directory.
                map.retain(|path, _| {
                    let owned_deleted_path = deleted_path.to_owned();
                    !path.starts_with(owned_deleted_path + "/")
                });

            };
        }

        let updated_files_hashes: HashMap<String, String> = updated_files
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

        for (file, hash) in &updated_files_hashes {
            map.entry(file.into())
                .and_modify(|e| *e = hash.clone())
                .or_insert(hash.clone());
        }

        *files = map.into_iter().collect();
        files.par_sort();

        updated_files_hashes
    }
}

#[napi]
impl WorkspaceContext {
    #[napi(constructor)]
    pub fn new(workspace_root: String, cache_dir: String) -> Self {
        enable_logger();

        trace!(?workspace_root);

        let workspace_root_path = PathBuf::from(&workspace_root);

        WorkspaceContext {
            files_worker: FilesWorker::gather_files(&workspace_root_path, cache_dir),
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
        let globbed_files = config_files::glob_files(&file_data, globs, exclude)?;
        Ok(globbed_files.map(|file| file.file.to_owned()).collect())
    }

    #[napi]
    pub fn hash_files_matching_glob(
        &self,
        globs: Vec<String>,
        exclude: Option<Vec<String>>,
    ) -> napi::Result<String> {
        let files = &self.all_file_data();
        let globbed_files = config_files::glob_files(files, globs, exclude)?;
        Ok(hash(
            &globbed_files
                .map(|file| file.hash.as_bytes())
                .collect::<Vec<_>>()
                .concat(),
        ))
    }

    #[napi]
    pub fn incremental_update(
        &self,
        updated_files: Vec<&str>,
        deleted_files: Vec<&str>,
    ) -> HashMap<String, String> {
        self.files_worker
            .update_files(&self.workspace_root_path, updated_files, deleted_files)
    }

    #[napi]
    pub fn update_project_files(
        &self,
        project_root_mappings: ProjectRootMappings,
        project_files: External<ProjectFiles>,
        global_files: External<Vec<FileData>>,
        updated_files: HashMap<String, String>,
        deleted_files: Vec<&str>,
    ) -> UpdatedWorkspaceFiles {
        trace!("updating project files");
        trace!("{project_root_mappings:?}");
        let mut project_files_map = project_files.clone();
        let mut global_files = global_files
            .iter()
            .map(|f| (f.file.clone(), f.hash.clone()))
            .collect::<HashMap<_, _>>();

        trace!(
            "adding {} updated files to project files",
            updated_files.len()
        );
        for updated_file in updated_files.into_iter() {
            let file = updated_file.0;
            let hash = updated_file.1;
            if let Some(project_files) = find_project_for_path(&file, &project_root_mappings)
                .and_then(|project| project_files_map.get_mut(project))
            {
                trace!("{file:?} was found in a project");
                if let Some(file) = project_files.iter_mut().find(|f| f.file == file) {
                    trace!("updating hash for file");
                    file.hash = hash;
                } else {
                    trace!("{file:?} was not part of a project, adding to project files");
                    project_files.push(FileData { file, hash });
                }
            } else {
                trace!("{file:?} was not found in any project, updating global files");
                global_files
                    .entry(file)
                    .and_modify(|e| *e = hash.clone())
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
                project_files: External::new(project_files_map),
                global_files: External::new(non_project_files),
                all_workspace_files: External::new(self.all_file_data()),
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
