use jsonc_parser::ParseOptions;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use rayon::prelude::*;
use tracing::trace;
use xxhash_rust::xxh3;

use crate::native::logger::enable_logger;
use crate::native::types::FileData;
use crate::native::utils::glob::build_glob_set;
use crate::native::utils::path::Normalize;
use crate::native::walker::nx_walker;
use crate::native::workspace::errors::{InternalWorkspaceErrors, WorkspaceErrors};
use crate::native::workspace::get_config_files::insert_config_file_into_map;
use crate::native::workspace::types::{FileLocation, ProjectConfiguration};

#[napi(object)]
pub struct NxWorkspaceFiles {
    pub project_file_map: HashMap<String, Vec<FileData>>,
    pub global_files: Vec<FileData>,
    pub config_files: Vec<String>,
}

#[napi]
/// Throws exceptions
pub fn get_workspace_files_native(
    workspace_root: String,
    globs: Vec<String>,
) -> napi::Result<NxWorkspaceFiles, WorkspaceErrors> {
    enable_logger();

    trace!("{workspace_root}, {globs:?}");

    let (projects, mut file_data) = get_file_data(&workspace_root, globs)
        .map_err(|err| napi::Error::new(WorkspaceErrors::Generic, err.to_string()))?;

    let root_map = create_root_map(&projects)?;

    trace!(?root_map);

    // Files need to be sorted each time because when we do hashArray in the TaskHasher.js, the order of the files should be deterministic
    file_data.par_sort();

    let file_locations = file_data
        .into_par_iter()
        .map(|file_data| {
            let file_path = Path::new(&file_data.file);
            let mut parent = file_path.parent().unwrap_or_else(|| Path::new(""));

            while root_map.get(parent).is_none() && parent != Path::new("") {
                parent = parent.parent().unwrap_or_else(|| Path::new(""));
            }

            match root_map.get(parent) {
                Some(project_name) => (FileLocation::Project(project_name.clone()), file_data),
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
                    project_file_map.insert(project_name, vec![file_data]);
                }
                Some(project_files) => project_files.push(file_data),
            },
        }
    }

    Ok(NxWorkspaceFiles {
        project_file_map,
        global_files,
        config_files: projects
            .keys()
            .map(|path| path.to_normalized_string())
            .collect(),
    })
}

fn create_root_map(
    projects: &HashMap<PathBuf, Vec<u8>>,
) -> Result<hashbrown::HashMap<&Path, String>, InternalWorkspaceErrors> {
    projects
        .par_iter()
        .map(|(path, content)| {
            let file_name = path
                .file_name()
                .expect("path should always have a filename");
            return if file_name == "project.json" || file_name == "package.json" {
                // use serde_json to do the initial parse, if that fails fall back to jsonc_parser.
                // If all those fail, expose the error from jsonc_parser
                let project_configuration: ProjectConfiguration =
                    read_project_configuration(content, path)?;

                let Some(parent_path) = path.parent() else {
                   return Err(InternalWorkspaceErrors::Generic {
                        msg: format!("{path:?} has no parent"),
                    })
                };

                let name: String = if let Some(name) = project_configuration.name {
                    Ok(name)
                } else {
                    parent_path
                        .file_name()
                        .unwrap_or_default()
                        .to_os_string()
                        .into_string()
                        .map_err(|os_string| InternalWorkspaceErrors::Generic {
                            msg: format!("Cannot turn {os_string:?} into String"),
                        })
                }?;
                Ok((parent_path, name))
            } else if let Some(parent_path) = path.parent() {
                Ok((
                    parent_path,
                    parent_path
                        .file_name()
                        .unwrap_or_default()
                        .to_os_string()
                        .into_string()
                        .map_err(|os_string| InternalWorkspaceErrors::Generic {
                            msg: format!("Cannot turn {os_string:?} into String"),
                        })?,
                ))
            } else {
                Err(InternalWorkspaceErrors::Generic {
                    msg: format!("{path:?} has no parent"),
                })
            };
        })
        .collect()
}

fn read_project_configuration(
    content: &[u8],
    path: &Path,
) -> Result<ProjectConfiguration, InternalWorkspaceErrors> {
    serde_json::from_slice(content).or_else(|_| {
        let content_str = std::str::from_utf8(content).expect("content should be valid utf8");
        let parser_value =
            jsonc_parser::parse_to_serde_value(content_str, &ParseOptions::default()).map_err(
                |_| InternalWorkspaceErrors::ParseError {
                    file: PathBuf::from(path),
                },
            )?;
        serde_json::from_value(parser_value.into()).map_err(|_| InternalWorkspaceErrors::Generic {
            msg: format!("Failed to parse {path:?}"),
        })
    })
}

type WorkspaceData = (HashMap<PathBuf, Vec<u8>>, Vec<FileData>);
fn get_file_data(workspace_root: &str, globs: Vec<String>) -> anyhow::Result<WorkspaceData> {
    let globs = build_glob_set(globs)?;
    let (projects, file_data) = nx_walker(workspace_root, move |rec| {
        let mut projects: HashMap<PathBuf, (PathBuf, Vec<u8>)> = HashMap::new();
        let mut file_hashes: Vec<FileData> = vec![];
        for (path, content) in rec {
            file_hashes.push(FileData {
                file: path.to_normalized_string(),
                hash: xxh3::xxh3_64(&content).to_string(),
            });
            insert_config_file_into_map((path, content), &mut projects, &globs)
        }
        (projects, file_hashes)
    });
    Ok((projects.into_values().collect(), file_data))
}
