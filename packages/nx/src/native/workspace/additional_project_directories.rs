use std::path::PathBuf;

use crate::native::glob::glob_files::glob_files;
use crate::native::types::FileData;
use crate::native::utils::path::join_paths;
use crate::native::walker::{NxFile, nx_walker};
use rayon::prelude::*;
use xxhash_rust::xxh3;

pub fn get_files_in_additional_project_directories(
    workspace_root: String,
    additional_project_directories: Vec<String>,
) -> Vec<Vec<NxFile>> {
    let root_path = PathBuf::from(&workspace_root);
    additional_project_directories
        .into_par_iter()
        .map(|additional_project_directory| {
            let joined_path = join_paths(&root_path, &additional_project_directory);
            let full_path = joined_path.to_string_lossy().to_string();
            nx_walker(&full_path, true).collect()
        })
        .collect()
}

#[napi]
pub fn multi_glob_in_additional_project_directories(
    workspace_root: String,
    additional_project_directories: Vec<String>,
    globs: Vec<String>,
    exclude: Option<Vec<String>>,
) -> napi::Result<Vec<Vec<String>>> {
    let files =
        get_files_in_additional_project_directories(workspace_root, additional_project_directories);

    globs
        .iter()
        .map(|glob| -> napi::Result<Vec<String>> {
            let mut result = Vec::new();
            for dir_files in &files {
                let file_data: Vec<FileData> = dir_files
                    .iter()
                    .map(|f| FileData {
                        file: f.full_path.clone(),
                        hash: String::new(),
                    })
                    .collect();
                let globbed_files: Vec<String> =
                    glob_files(&file_data, vec![glob.clone()], exclude.clone())?
                        .map(|f| f.file.to_owned())
                        .collect();
                result.extend(globbed_files);
            }
            Ok(result)
        })
        .collect()
}

#[napi]
pub fn multi_hash_glob_in_additional_project_directories(
    workspace_root: String,
    additional_project_directories: Vec<String>,
    glob_groups: Vec<Vec<String>>,
) -> napi::Result<Vec<String>> {
    let files =
        get_files_in_additional_project_directories(workspace_root, additional_project_directories);

    glob_groups
        .iter()
        .map(|glob_group| -> napi::Result<String> {
            let mut hasher = xxh3::Xxh3::new();
            for dir_files in &files {
                let file_data: Vec<FileData> = dir_files
                    .iter()
                    .map(|f| FileData {
                        file: f.full_path.clone(),
                        hash: String::new(),
                    })
                    .collect();

                let globbed_files: Vec<_> =
                    glob_files(&file_data, glob_group.clone(), None)?.collect();
                for file in globbed_files {
                    hasher.update(file.file.as_bytes());
                    hasher.update(file.hash.as_bytes());
                }
            }

            Ok(hasher.digest().to_string())
        })
        .collect()
}
