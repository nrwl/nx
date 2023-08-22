use crate::native::logger::enable_logger;
use rayon::prelude::*;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;
use std::thread::JoinHandle;
use tracing::trace;
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

struct BackgroundThread {
    files: Arc<Mutex<Vec<(PathBuf, String)>>>,
    _handle: JoinHandle<()>,
}
impl BackgroundThread {
    fn process(workspace_root: &str) -> Self {
        let files = Arc::new(Mutex::new(Vec::new()));

        let files_moved = Arc::clone(&files);
        let workspace_root = workspace_root.to_string();
        let handle = thread::spawn(move || {
            let mut workspace_files = files_moved.lock().expect("should get a lock on the mutex");
            let files = nx_walker(workspace_root, |rec| {
                let mut file_hashes: Vec<(PathBuf, String)> = vec![];
                for (path, content) in rec {
                    file_hashes.push((path, xxh3::xxh3_64(&content).to_string()));
                }
                file_hashes
            });

            workspace_files.extend(files);
            workspace_files.par_sort();
        });

        BackgroundThread {
            files,
            // add the thread handle to this struct so that we dont drop the thread until this struct is dropped
            _handle: handle,
        }
    }

    pub fn get_files(&self) -> MutexGuard<'_, Vec<(PathBuf, String)>> {
        self.files.lock().unwrap()
    }
}

#[napi]
impl WorkspaceContext {
    #[napi(constructor)]
    pub fn new(workspace_root: String) -> Self {
        enable_logger();

        trace!("{workspace_root:?}");

        WorkspaceContext {
            background_thread: BackgroundThread::process(&workspace_root),
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
        let file_data = self.background_thread.get_files();
        workspace_files::get_files(globs, parse_configurations, &file_data)
    }

    #[napi]
    pub fn get_project_configuration_files(
        &self,
        globs: Vec<String>,
    ) -> napi::Result<Vec<String>, WorkspaceErrors> {
        let file_data = self.background_thread.get_files();
        config_files::get_project_configuration_files(globs, &file_data)
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
        let file_data = self.background_thread.get_files();
        config_files::get_project_configurations(globs, &file_data, parse_configurations)
    }
}
