use std::collections::HashMap;
use std::path::{Path, PathBuf};

use napi::bindgen_prelude::External;
use rayon::prelude::*;
use tracing::trace;

use crate::native::types::FileData;
use crate::native::workspace::types::{NxWorkspaceFiles, NxWorkspaceFilesExternals};

/// Categorizes workspace files into project-specific and global files.
///
/// This function has been optimized to:
/// 1. Avoid cloning FileData during parallel iteration (use indices instead)
/// 2. Reduce memory allocations by computing file locations without cloning
pub(super) fn get_files(
    project_root_map: HashMap<String, String>,
    files: Vec<FileData>,
) -> napi::Result<NxWorkspaceFiles> {
    if files.is_empty() {
        return Ok(Default::default());
    };

    let root_map = transform_root_map(project_root_map);

    trace!(?root_map);

    // Compute file locations in parallel using indices to avoid cloning FileData
    // This returns (index, Option<project_name>) where None means global file
    let file_locations: Vec<(usize, Option<String>)> = files
        .par_iter()
        .enumerate()
        .map(|(idx, file_data)| {
            let file_path = PathBuf::from(&file_data.file);
            let mut parent = file_path.parent().unwrap_or_else(|| Path::new("."));

            while root_map.get(parent).is_none() && parent != Path::new(".") {
                parent = parent.parent().unwrap_or_else(|| Path::new("."));
            }

            match root_map.get(parent) {
                Some(project_name) => (idx, Some(project_name.clone())),
                None => (idx, None),
            }
        })
        .collect();

    // Count files per category for pre-allocation
    let global_count = file_locations.iter().filter(|(_, p)| p.is_none()).count();
    let project_count = file_locations.len() - global_count;

    let mut project_file_map: HashMap<String, Vec<FileData>> =
        HashMap::with_capacity(project_count);
    let mut global_files: Vec<FileData> = Vec::with_capacity(global_count);

    // Convert files Vec to allow moving elements out
    let mut files_vec: Vec<Option<FileData>> = files.into_iter().map(Some).collect();

    // Distribute files to their locations (single pass, no cloning)
    for (idx, project_name) in file_locations {
        // Take ownership of the FileData (this is O(1), not a clone)
        let file_data = files_vec[idx]
            .take()
            .expect("Each file should only be processed once");

        match project_name {
            None => global_files.push(file_data),
            Some(name) => {
                project_file_map
                    .entry(name)
                    .or_insert_with(Vec::new)
                    .push(file_data);
            }
        }
    }

    // Sort files for deterministic output
    global_files.par_sort();
    for project_files in project_file_map.values_mut() {
        project_files.par_sort();
    }

    // Create External references - these need owned copies for NAPI
    let project_files_external = External::new(project_file_map.clone());
    let global_files_external = External::new(global_files.clone());

    // Reconstruct all_workspace_files from the categorized files
    let mut all_files: Vec<FileData> = global_files
        .iter()
        .cloned()
        .chain(project_file_map.values().flat_map(|v| v.iter().cloned()))
        .collect();
    all_files.par_sort();
    let all_workspace_files = External::new(all_files);

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
