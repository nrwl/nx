use crate::native::logger::enable_logger;

use parking_lot::lock_api::MutexGuard;
use parking_lot::{Condvar, Mutex, RawMutex};
use rayon::prelude::*;
use std::ops::Deref;
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use tracing::{trace, warn};
use xxhash_rust::xxh3;

use crate::native::walker::nx_walker;
use crate::native::workspace::errors::WorkspaceErrors;
use crate::native::workspace::workspace_files::NxWorkspaceFiles;
use crate::native::workspace::{config_files, workspace_files};

use crate::native::workspace::types::ConfigurationParserResult;

#[napi]
pub struct WorkspaceContext {
    pub workspace_root: String,
    background_thread: BackgroundThread,
}

type Files = Vec<(PathBuf, String)>;
struct BackgroundThread(Option<Arc<(Mutex<Files>, Condvar)>>);

impl BackgroundThread {
    fn gather_files(workspace_root: &str) -> Self {
        let workspace_root: PathBuf = workspace_root.into();
        if !workspace_root.exists() {
            warn!(
                "workspace root does not exist: {}",
                workspace_root.display()
            );
            return BackgroundThread(None);
        }

        let files_lock = Arc::new((Mutex::new(Vec::new()), Condvar::new()));
        let files_lock_clone = Arc::clone(&files_lock);

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

        BackgroundThread(Some(files_lock))
    }

    pub fn get_files(&self) -> Option<MutexGuard<'_, RawMutex, Files>> {
        let Some(files_sync) = &self.0 else {
            trace!("there were no files because the workspace root did not exist");
            return None
        };

        let (files_lock, cvar) = &files_sync.deref();
        let mut files = files_lock.lock();
        let files_len = files.len();
        if files_len == 0 {
            trace!("waiting for files");
            cvar.wait(&mut files);
        }

        trace!("files are available");
        Some(files)
    }
}

#[napi]
impl WorkspaceContext {
    #[napi(constructor)]
    pub fn new(workspace_root: String) -> Self {
        enable_logger();

        trace!(?workspace_root);

        WorkspaceContext {
            background_thread: BackgroundThread::gather_files(&workspace_root),
            workspace_root,
        }
    }

    #[napi]
    pub fn get_workspace_files<ConfigurationParser>(
        &self,
        globs: Vec<String>,
        parse_configurations: ConfigurationParser,
    ) -> napi::Result<NxWorkspaceFiles, WorkspaceErrors>
    where
        ConfigurationParser: Fn(Vec<String>) -> napi::Result<ConfigurationParserResult>,
    {
        workspace_files::get_files(
            globs,
            parse_configurations,
            self.background_thread
                .get_files()
                .as_deref()
                .map(|files| files.as_slice()),
        )
    }

    #[napi]
    pub fn get_project_configuration_files(
        &self,
        globs: Vec<String>,
    ) -> napi::Result<Vec<String>, WorkspaceErrors> {
        config_files::get_project_configuration_files(
            globs,
            self.background_thread
                .get_files()
                .as_deref()
                .map(|files| files.as_slice()),
        )
    }

    #[napi]
    pub fn get_project_configurations<ConfigurationParser>(
        &self,
        globs: Vec<String>,
        parse_configurations: ConfigurationParser,
    ) -> napi::Result<ConfigurationParserResult>
    where
        ConfigurationParser: Fn(Vec<String>) -> napi::Result<ConfigurationParserResult>,
    {
        config_files::get_project_configurations(
            globs,
            self.background_thread
                .get_files()
                .as_deref()
                .map(|files| files.as_slice()),
            parse_configurations,
        )
    }
}
