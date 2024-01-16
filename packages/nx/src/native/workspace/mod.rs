use crate::native::types::FileData;
use crate::native::workspace::types::NxWorkspaceFilesExternals;
use napi::bindgen_prelude::External;
use std::collections::HashMap;

pub mod config_files;
pub mod context;
mod errors;
mod files_archive;
mod files_hashing;
pub mod types;
pub mod workspace_files;

#[napi]
// should only be used in tests to transfer the file map from the JS world to the Rust world
pub fn __test_only_transfer_file_map(
    project_files: HashMap<String, Vec<FileData>>,
    non_project_files: Vec<FileData>,
) -> NxWorkspaceFilesExternals {
    let all_workspace_files = project_files
        .iter()
        .flat_map(|(_, files)| files.clone())
        .chain(non_project_files.clone())
        .collect::<Vec<FileData>>();
    NxWorkspaceFilesExternals {
        project_files: External::new(project_files),
        global_files: External::new(non_project_files),
        all_workspace_files: External::new(all_workspace_files),
    }
}
