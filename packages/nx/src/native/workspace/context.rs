use crate::native::logger::enable_logger;
use rayon::prelude::*;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
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
    workspace_files: Arc<Mutex<Vec<(PathBuf, String)>>>,
}

#[napi]
impl WorkspaceContext {
    #[napi(constructor)]
    pub fn new(workspace_root: String) -> Self {
        enable_logger();
        let workspace_files = Arc::new(Mutex::new(Vec::new()));

        let workspace_files_moved = Arc::clone(&workspace_files);
        let workspace_root_moved = workspace_root.clone();
        // start walking the workspace in the background
        thread::spawn(move || {
            let mut workspace_files = workspace_files_moved.lock().unwrap();
            let files = nx_walker(workspace_root_moved, |rec| {
                let mut file_hashes: Vec<(PathBuf, String)> = vec![];
                for (path, content) in rec {
                    file_hashes.push((path, xxh3::xxh3_64(&content).to_string()));
                }
                file_hashes
            });

            workspace_files.extend(files);
            workspace_files.par_sort();
        });

        trace!("{workspace_root:?}");

        WorkspaceContext {
            workspace_root,
            workspace_files,
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
        let file_data = self.workspace_files.lock().unwrap();
        workspace_files::get_files(globs, parse_configurations, &file_data)
    }

    #[napi]
    pub fn get_project_configuration_files(
        &self,
        globs: Vec<String>,
    ) -> napi::Result<Vec<String>, WorkspaceErrors> {
        let file_data = self.workspace_files.lock().unwrap();
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
        let file_data = self.workspace_files.lock().unwrap();
        config_files::get_project_configurations(globs, &file_data, parse_configurations)
    }
}
