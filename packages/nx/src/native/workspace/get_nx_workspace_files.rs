use napi::JsObject;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use rayon::prelude::*;
use tracing::trace;
use xxhash_rust::xxh3;

use crate::native::logger::enable_logger;
use crate::native::types::FileData;
use crate::native::utils::glob::build_glob_set;
use crate::native::utils::path::Normalize;
use crate::native::walker::nx_walker;
use crate::native::workspace::errors::WorkspaceErrors;
use crate::native::workspace::types::{ConfigurationParserResult, FileLocation};

#[napi(object)]
pub struct NxWorkspaceFiles {
    pub project_file_map: HashMap<String, Vec<FileData>>,
    pub global_files: Vec<FileData>,
    pub project_configurations: HashMap<String, JsObject>,
    pub external_nodes: HashMap<String, JsObject>,
}

#[napi]
pub fn get_workspace_files_native<ConfigurationParser>(
    workspace_root: String,
    globs: Vec<String>,
    parse_configurations: ConfigurationParser,
) -> napi::Result<NxWorkspaceFiles, WorkspaceErrors>
where
    ConfigurationParser: Fn(Vec<String>) -> napi::Result<ConfigurationParserResult>,
{
    enable_logger();

    trace!("{workspace_root}, {globs:?}");

    let (projects, mut file_data) = get_file_data(&workspace_root, globs)
        .map_err(|err| napi::Error::new(WorkspaceErrors::Generic, err.to_string()))?;

    let projects_vec: Vec<String> = projects.iter().map(|p| p.to_normalized_string()).collect();

    let parsed_graph_nodes = parse_configurations(projects_vec)
        .map_err(|e| napi::Error::new(WorkspaceErrors::ParseError, e.to_string()))?;

    let root_map = create_root_map(&parsed_graph_nodes.project_nodes);

    trace!(?root_map);

    // Files need to be sorted each time because when we do hashArray in the TaskHasher.js, the order of the files should be deterministic
    file_data.par_sort();

    let file_locations = file_data
        .into_par_iter()
        .map(|file_data| {
            let file_path = Path::new(&file_data.file);
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

    Ok(NxWorkspaceFiles {
        project_file_map,
        global_files,
        external_nodes: parsed_graph_nodes.external_nodes,
        project_configurations: parsed_graph_nodes.project_nodes,
    })
}

fn create_root_map(
    project_configurations: &HashMap<String, JsObject>,
) -> hashbrown::HashMap<PathBuf, String> {
    project_configurations
        .iter()
        .map(|(project_name, project_configuration)| {
            let root: String = project_configuration.get("root").unwrap().unwrap();
            (PathBuf::from(root), project_name.clone())
        })
        .collect()
}

type WorkspaceData = (HashSet<PathBuf>, Vec<FileData>);
fn get_file_data(workspace_root: &str, globs: Vec<String>) -> anyhow::Result<WorkspaceData> {
    let globs = build_glob_set(&globs)?;
    let (projects, file_data) = nx_walker(workspace_root, move |rec| {
        let mut projects: HashSet<PathBuf> = HashSet::new();
        let mut file_hashes: Vec<FileData> = vec![];
        for (path, content) in rec {
            file_hashes.push(FileData {
                file: path.to_normalized_string(),
                hash: xxh3::xxh3_64(&content).to_string(),
            });
            if globs.is_match(&path) {
                projects.insert(path);
            }
        }
        (projects, file_hashes)
    });
    Ok((projects, file_data))
}
