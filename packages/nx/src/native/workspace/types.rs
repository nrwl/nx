use crate::native::types::FileData;
use napi::bindgen_prelude::External;
use std::collections::HashMap;

#[derive(Debug, Eq, PartialEq)]
pub enum FileLocation {
    Global,
    Project(String),
}

pub type ProjectFiles = HashMap<String, Vec<FileData>>;

#[napi(object)]
#[derive(Default)]
pub struct NxWorkspaceFiles {
    pub project_file_map: ProjectFiles,
    pub global_files: Vec<FileData>,
    pub external_references: Option<NxWorkspaceFilesExternals>,
}

#[napi(object)]
pub struct NxWorkspaceFilesExternals {
    pub project_files: External<ProjectFiles>,
    pub global_files: External<Vec<FileData>>,
    pub all_workspace_files: External<Vec<FileData>>,
}

#[napi(object)]
pub struct UpdatedWorkspaceFiles {
    pub file_map: FileMap,
    pub external_references: NxWorkspaceFilesExternals,
}

#[napi(object)]
pub struct FileMap {
    pub project_file_map: ProjectFiles,
    pub non_project_files: Vec<FileData>,
}
