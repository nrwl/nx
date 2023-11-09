use crate::native::logger::enable_logger;
use std::collections::HashMap;

use crate::native::types::FileData;
use crate::native::utils::path::Normalize;
use napi::bindgen_prelude::*;
use parking_lot::lock_api::MutexGuard;
use parking_lot::{Condvar, Mutex, RawMutex};
use rayon::prelude::*;
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;
use tracing::{trace, warn};
use xxhash_rust::xxh3;

use crate::native::walker::nx_walker;
use crate::native::workspace::errors::WorkspaceErrors;
use crate::native::workspace::workspace_files::NxWorkspaceFiles;
use crate::native::workspace::{config_files, workspace_files};

#[napi]
pub struct WorkspaceContext {
    pub workspace_root: String,
    workspace_root_path: PathBuf,
    files_worker: FilesWorker,
}

type Files = Vec<(PathBuf, String)>;
struct FilesWorker(Option<Arc<(Mutex<Files>, Condvar)>>);

impl FilesWorker {
    fn gather_files(workspace_root: &Path) -> Self {
        if !workspace_root.exists() {
            warn!(
                "workspace root does not exist: {}",
                workspace_root.display()
            );
            return FilesWorker(None);
        }

        let files_lock = Arc::new((Mutex::new(Vec::new()), Condvar::new()));
        let files_lock_clone = Arc::clone(&files_lock);
        let workspace_root = workspace_root.to_owned();

        thread::spawn(move || {
            trace!("locking files");
            let (lock, cvar) = &*files_lock_clone;
            let mut workspace_files = lock.lock();
            let files = nx_walker(workspace_root, |rec| {
                let mut file_hashes: Vec<(PathBuf, String)> = vec![];
                for (path, content) in rec {
                    file_hashes.push((path, xxh3::xxh3_64(&content).to_string()));
                }
                file_hashes
            });

            workspace_files.extend(files);
            workspace_files.par_sort();
            let files_len = workspace_files.len();
            trace!(?files_len, "files retrieved");

            cvar.notify_all();
        });

        FilesWorker(Some(files_lock))
    }

    pub fn get_files(&self) -> Option<Vec<(PathBuf, String)>> {
        let Some(files_sync) = &self.0 else {
            trace!("there were no files because the workspace root did not exist");
            return None;
        };

        let (files_lock, cvar) = &files_sync.deref();
        trace!("locking files");
        let mut files = files_lock.lock();
        let files_len = files.len();
        if files_len == 0 {
            trace!("waiting for files");
            cvar.wait(&mut files);
        }

        let cloned_files = files.clone();
        drop(files);

        trace!("files are available");
        Some(cloned_files)
    }

    pub fn update_files(
        &self,
        workspace_root_path: &Path,
        updated_files: Vec<&str>,
        deleted_files: Vec<&str>,
    ) -> HashMap<String, String> {
        let Some(files_sync) = &self.0 else {
            trace!("there were no files because the workspace root did not exist");
            return HashMap::new();
        };

        let (files_lock, _) = &files_sync.deref();
        let mut files = files_lock.lock();
        let mut map: HashMap<PathBuf, String> = files.drain(..).collect();

        for deleted_file in deleted_files {
            map.remove(&PathBuf::from(deleted_file));
        }

        let updated_files_hashes: HashMap<String, String> = updated_files
            .par_iter()
            .filter_map(|path| {
                let full_path = workspace_root_path.join(path);
                let Ok(content) = std::fs::read(full_path) else {
                    trace!("could not read file: ?full_path");
                    return None;
                };
                Some((path.to_string(), xxh3::xxh3_64(&content).to_string()))
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
    pub fn new(workspace_root: String) -> Self {
        enable_logger();

        trace!(?workspace_root);

        let workspace_root_path = PathBuf::from(&workspace_root);

        WorkspaceContext {
            files_worker: FilesWorker::gather_files(&workspace_root_path),
            workspace_root,
            workspace_root_path,
        }
    }

    #[napi]
    pub fn get_workspace_files<ConfigurationParser>(
        &self,
        env: Env,
        globs: Vec<String>,
        parse_configurations: ConfigurationParser,
    ) -> anyhow::Result<Option<Object>>
    where
        ConfigurationParser: Fn(Vec<String>) -> napi::Result<Promise<HashMap<String, String>>>,
    {
        workspace_files::get_files(
            env,
            globs,
            parse_configurations,
            self.files_worker.get_files().as_deref(),
        )
        .map_err(anyhow::Error::from)
    }

    #[napi]
    pub fn glob(&self, globs: Vec<String>) -> napi::Result<Vec<String>, WorkspaceErrors> {
        config_files::glob_files(globs, self.files_worker.get_files().as_deref())
    }

    #[napi]
    pub fn get_project_configurations<ConfigurationParser>(
        &self,
        env: Env,
        globs: Vec<String>,
        parse_configurations: ConfigurationParser,
    ) -> napi::Result<Object>
    where
        ConfigurationParser: Fn(Vec<String>) -> napi::Result<Promise<HashMap<String, String>>>,
    {
        let promise = config_files::get_project_configurations(
            globs,
            self.files_worker.get_files().as_deref(),
            parse_configurations,
        )?;
        env.spawn_future(async move {
            let result = promise.await?;
            Ok(result)
        })
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
    pub fn all_file_data(&self) -> Vec<FileData> {
        self.files_worker
            .get_files()
            .map_or_else(Vec::new, |files| {
                files
                    .iter()
                    .map(|(path, content)| FileData {
                        file: path.to_normalized_string(),
                        hash: content.clone(),
                    })
                    .collect()
            })
    }
}
