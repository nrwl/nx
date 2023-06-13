use jsonc_parser::ParseOptions;
use std::collections::HashMap;
use std::ffi::OsStr;
use std::path::Path;

use rayon::prelude::*;
use tracing::trace;
use xxhash_rust::xxh3;

use crate::native::logger::enable_logger;
use crate::native::parallel_walker::nx_walker;
use crate::native::types::FileData;
use crate::native::utils::glob::build_glob_set;
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
) -> anyhow::Result<NxWorkspaceFiles> {
    enable_logger();

    trace!("{workspace_root}, {globs:?}");

    let (projects, mut file_data) = get_file_data(&workspace_root, globs)?;

    let root_map = create_root_map(&projects)?;

    trace!(?root_map);

    // Files need to be sorted each time because when we do hashArray in the TaskHasher.js, the order of the files should be deterministic
    file_data.sort();

    let file_locations = file_data
        .par_iter()
        .map(|file_data| {
            let file_path = Path::new(&file_data.file);
            trace!(?file_path);
            let mut parent = file_path.parent().unwrap_or_else(|| Path::new(""));
            trace!(?parent);
            while root_map.get(parent).is_none() {
                parent = parent.parent().unwrap_or_else(|| Path::new(""));

                if parent == Path::new("") {
                    return (FileLocation::Global, file_data);
                }
            }

            let project_name = root_map.get(parent).unwrap();

            (FileLocation::Project(project_name.to_owned()), file_data)
        })
        .collect::<Vec<(FileLocation, &FileData)>>();

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
            FileLocation::Global => global_files.push(file_data.clone()),
            FileLocation::Project(project_name) => match project_file_map.get_mut(&project_name) {
                None => {
                    project_file_map.insert(project_name, vec![file_data.clone()]);
                }
                Some(project_files) => project_files.push(file_data.clone()),
            },
        }
    }

    Ok(NxWorkspaceFiles {
        project_file_map,
        global_files,
        config_files: projects.into_iter().map(|(path, _)| path).collect(),
    })
}

fn create_root_map(projects: &Vec<(String, Vec<u8>)>) -> anyhow::Result<HashMap<&Path, String>> {
    projects
        .par_iter()
        .map(|(path, content)| {
            let path = Path::new(path);
            let file_name = path
                .file_name()
                .expect("path should always have a filename");
            return if file_name == "project.json" || file_name == "package.json" {
                // get the project name from the json file
                let project_configuration: ProjectConfiguration =
                // match on serde_json::from_slice to see if the first pass is good. 
                    match serde_json::from_slice(content) {
                        Ok(config) => Ok(config),
                        // if serde_json::from_slice fails, use the jsonc_parser to run it again
                        // This will have a more lenient parser that will accept comments and trailing commas
                        Err(_) => {
                            let content_str =
                                std::str::from_utf8(content).expect("content should be valid utf8");
                            let parser_value = jsonc_parser::parse_to_serde_value(
                                content_str,
                                &ParseOptions::default(),
                            )
                            .map_err(|err| anyhow::anyhow!("Unable to parse {path:?}: {err}"))?;
                            serde_json::from_value(parser_value.into())
                        }
                    }?;

                let Some(parent_path) = path.parent() else {
                    anyhow::bail!("{path:?} does not have a parent")
                };
                let Some(name)  = project_configuration.name else {
                    anyhow::bail!("{path:?} does not have a name")
                };
                Ok((parent_path, name))
            } else {
                let name = path.parent().and_then(|p| {
                    p.file_name()
                        .unwrap_or_else(|| OsStr::new(""))
                        .to_os_string()
                        .into_string()
                        .ok()
                });
                let Some(parent_path) = path.parent() else {
                    anyhow::bail!("{path:?} does not have a parent")
                };
                let Some(name)  = name else {
                    anyhow::bail!("{path:?} does not have a name")
                };
                Ok((parent_path, name))
            };
        })
        .collect()
}

type WorkspaceData = (Vec<(String, Vec<u8>)>, Vec<FileData>);
fn get_file_data(workspace_root: &String, globs: Vec<String>) -> anyhow::Result<WorkspaceData> {
    let globs = build_glob_set(globs)?;
    let (projects, file_data) = nx_walker(&workspace_root, move |rec| {
        let mut projects: Vec<(String, Vec<u8>)> = vec![];
        let mut file_hashes: Vec<FileData> = vec![];
        for (path, content) in rec {
            file_hashes.push(FileData {
                file: path.clone(),
                hash: xxh3::xxh3_64(&content).to_string(),
            });
            if globs.is_match(&path) {
                projects.push((path, content));
            }
        }
        (projects, file_hashes)
    });
    Ok((projects, file_data))
}
