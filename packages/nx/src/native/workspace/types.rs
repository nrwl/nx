use crate::native::types::FileData;
use napi::bindgen_prelude::*;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Eq, PartialEq)]
pub enum FileLocation {
    Global,
    Project(String),
}

pub type ProjectFiles = HashMap<String, Vec<FileData>>;

#[napi(object, object_from_js = false)]
#[derive(Default)]
pub struct NxWorkspaceFiles {
    pub project_file_map: ProjectFiles,
    pub global_files: Vec<FileData>,
    pub external_references: Option<NxWorkspaceFilesExternals>,
}

/// Return-only struct (Rust → JS). `object_from_js = false` skips generating
/// `FromNapiValue` since `External<T>` only supports `FromNapiRef` in napi v3.
#[napi(object, object_from_js = false)]
pub struct NxWorkspaceFilesExternals {
    pub project_files: External<Arc<ProjectFiles>>,
    pub global_files: External<Arc<Vec<FileData>>>,
    pub all_workspace_files: External<Arc<Vec<FileData>>>,
}

#[napi(object, object_from_js = false)]
pub struct UpdatedWorkspaceFiles {
    pub file_map: FileMap,
    pub external_references: NxWorkspaceFilesExternals,
}

#[napi(object)]
pub struct FileMap {
    pub project_file_map: ProjectFiles,
    pub non_project_files: Vec<FileData>,
}
