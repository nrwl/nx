use std::collections::HashMap;
use std::ffi::OsStr;
use std::os::unix::ffi::OsStrExt;
use std::path::Path;

use globset::{Glob, GlobSetBuilder};
use rayon::prelude::*;
use tracing::{info, trace};
use xxhash_rust::xxh3;

use crate::native::logger::enable_logger;
use crate::native::parallel_walker::nx_workspace_walker;
use crate::native::types::FileData;
use crate::native::workspace::types::{FileLocation, ProjectConfiguration};

#[napi(object)]
pub struct NxWorkspaceFiles {
    pub project_file_map: HashMap<String, Vec<FileData>>,
    pub global_files: Vec<FileData>,
    pub config_files: Vec<String>,
}

#[napi]
pub fn get_workspace_files_native(
    workspace_root: String,
    globs: Vec<String>,
) -> anyhow::Result<NxWorkspaceFiles> {
    enable_logger();

    trace!("{workspace_root}, {globs:?}");

    let (projects, mut file_data) = get_file_data(&workspace_root, globs)?;

    let root_map = create_root_map(&projects);

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

            (FileLocation::Project(*project_name), file_data)
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
            FileLocation::Project(project_name) => match project_file_map.get_mut(project_name) {
                None => {
                    project_file_map.insert(project_name.to_string(), vec![file_data.clone()]);
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

fn create_root_map(projects: &Vec<(String, Vec<u8>)>) -> HashMap<&Path, &str> {
    projects
        .par_iter()
        .filter_map(|(path, content)| {
            let path = Path::new(path);
            let file_name = path
                .file_name()
                .expect("path should always have a filename");
            return if file_name == "project.json" || file_name == "package.json" {
                let Ok(mut project_configuration) = serde_json::from_slice::<ProjectConfiguration>(content) else {
                    info!("Cannot create configuration from {path:?}");
                    return None
                };

                project_configuration.root = path.parent();

                Some(project_configuration)
            } else {
                let name = path.parent().and_then(|p| {
                    let bytes = p.file_name().unwrap_or_else(|| OsStr::new("")).as_bytes();
                    std::str::from_utf8(bytes).ok()
                });

                Some(ProjectConfiguration {
                    name,
                    root: path.parent()
                })
            }
        })
        .map(|config| {
            (config.root.expect("should have a root"), config.name.expect("should have a name"))
        })
        .collect()
}

type WorkspaceData = (Vec<(String, Vec<u8>)>, Vec<FileData>);
fn get_file_data(workspace_root: &String, globs: Vec<String>) -> anyhow::Result<WorkspaceData> {
    let mut glob_builder = GlobSetBuilder::new();
    for glob in globs {
        glob_builder.add(Glob::new(&glob).map_err(anyhow::Error::from)?);
    }
    let set = glob_builder.build().map_err(anyhow::Error::from)?;

    let (projects, file_data) = nx_workspace_walker(&workspace_root, move |rec| {
        let mut projects: Vec<(String, Vec<u8>)> = vec![];
        let mut file_hashes: Vec<FileData> = vec![];
        for (path, content) in rec {
            file_hashes.push(FileData {
                file: path.clone(),
                hash: xxh3::xxh3_64(&content).to_string(),
            });
            if set.is_match(&path) {
                projects.push((path, content));
            }
        }
        (projects, file_hashes)
    });
    Ok((projects, file_data))
}
