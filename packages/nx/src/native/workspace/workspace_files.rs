use std::collections::HashMap;
use std::path::{Path, PathBuf};

use napi::bindgen_prelude::External;
use rayon::prelude::*;
use tracing::trace;

use crate::native::types::FileData;
use crate::native::workspace::types::{FileLocation, NxWorkspaceFiles, NxWorkspaceFilesExternals};

pub(super) fn get_files(
    project_root_map: HashMap<String, String>,
    files: Vec<FileData>,
) -> napi::Result<NxWorkspaceFiles> {
    if files.is_empty() {
        return Ok(Default::default());
    };

    let root_map = transform_root_map(project_root_map);

    trace!(?root_map);

    let file_locations = files
        .par_iter()
        .cloned()
        .map(|file_data| {
            let file_path = PathBuf::from(&file_data.file);
            let mut parent = file_path.parent().unwrap_or_else(|| Path::new("."));

            while root_map.get(parent).is_none() && parent != Path::new(".") {
                parent = parent.parent().unwrap_or_else(|| Path::new("."));
            }

            match root_map.get(parent) {
                Some(project_name) => (FileLocation::Project(project_name.into()), file_data),
                None => (FileLocation::Global, file_data),
            }
        })
        .collect::<Vec<(FileLocation, FileData)>>();

    let mut project_file_map: HashMap<String, Vec<FileData>> = HashMap::with_capacity(
        file_locations
            .iter()
            .filter(|&f| f.0 != FileLocation::Global)
            .count(),
    );
    let mut global_files: Vec<FileData> = Vec::with_capacity(
        file_locations
            .iter()
            .filter(|&f| f.0 == FileLocation::Global)
            .count(),
    );
    for (file_location, file_data) in file_locations {
        match file_location {
            FileLocation::Global => global_files.push(file_data),
            FileLocation::Project(project_name) => match project_file_map.get_mut(&project_name) {
                None => {
                    project_file_map.insert(project_name.clone(), vec![file_data]);
                }
                Some(project_files) => project_files.push(file_data),
            },
        }
    }

    global_files.par_sort();
    for (_, project_files) in project_file_map.iter_mut() {
        project_files.par_sort();
    }

    let project_files_external = External::new(project_file_map.clone());
    let global_files_external = External::new(global_files.clone());
    let all_workspace_files = External::new(files);
    Ok(NxWorkspaceFiles {
        project_file_map,
        global_files,
        external_references: Some(NxWorkspaceFilesExternals {
            project_files: project_files_external,
            global_files: global_files_external,
            all_workspace_files,
        }),
    })
}

fn transform_root_map(root_map: HashMap<String, String>) -> hashbrown::HashMap<PathBuf, String> {
    root_map
        .into_iter()
        .map(|(project_root, project_name)| (PathBuf::from(project_root), project_name))
        .collect()
}
