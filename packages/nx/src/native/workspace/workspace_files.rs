use std::collections::HashMap;
use std::path::{Path, PathBuf};

use rayon::prelude::*;
use tracing::trace;

use crate::native::types::FileData;
use crate::native::utils::path::Normalize;
use crate::native::workspace::config_files;
use crate::native::workspace::errors::{InternalWorkspaceErrors, WorkspaceErrors};
use crate::native::workspace::types::FileLocation;

#[napi(object)]
#[derive(Default)]
pub struct NxWorkspaceFiles {
    pub project_file_map: HashMap<String, Vec<FileData>>,
    pub global_files: Vec<FileData>,
}

pub(super) fn get_files<ConfigurationParser>(
    globs: Vec<String>,
    parse_configurations: ConfigurationParser,
    file_data: Option<&[(PathBuf, String)]>,
) -> napi::Result<NxWorkspaceFiles, WorkspaceErrors>
where
    ConfigurationParser: Fn(Vec<String>) -> napi::Result<HashMap<String, String>>,
{
    let Some(file_data) = file_data else {
        return Ok(Default::default());
    };

    trace!("{globs:?}");
    let root_map = transform_root_map(
        config_files::get_project_configurations(globs, Some(file_data), parse_configurations)
            .map_err(|e| InternalWorkspaceErrors::ParseError(e.to_string()))?,
    );

    trace!(?root_map);

    let file_locations = file_data
        .into_par_iter()
        .map(|(file_path, hash)| {
            let mut parent = file_path.parent().unwrap_or_else(|| Path::new("."));

            while root_map.get(parent).is_none() && parent != Path::new(".") {
                parent = parent.parent().unwrap_or_else(|| Path::new("."));
            }

            let file_data = FileData {
                file: file_path.to_normalized_string(),
                hash: hash.clone(),
            };

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

    Ok(NxWorkspaceFiles {
        project_file_map,
        global_files,
    })
}

fn transform_root_map(root_map: HashMap<String, String>) -> hashbrown::HashMap<PathBuf, String> {
    root_map
        .into_iter()
        .map(|(project_root, project_name)| (PathBuf::from(project_root), project_name))
        .collect()
}
