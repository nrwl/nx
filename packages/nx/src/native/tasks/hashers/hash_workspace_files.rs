use rayon::prelude::*;

use crate::native::glob::build_glob_set;
use crate::native::glob::glob_files::glob_files;
use crate::native::hasher::hash;
use crate::native::types::FileData;
use anyhow::*;
use tracing::{debug, debug_span, trace, warn};

/// Result of hashing workspace files, including the matched file paths
pub struct WorkspaceFilesHashResult {
    pub hash: String,
    pub files: Vec<String>,
}

/// Expands workspace file set patterns by stripping `{workspaceRoot}/` prefix.
/// Handles negation patterns (e.g., `!{workspaceRoot}/...`).
pub fn expand_workspace_globs(workspace_file_sets: &[String]) -> Vec<String> {
    workspace_file_sets
        .iter()
        .inspect(|&x| trace!("Workspace file set: {}", x))
        .filter_map(|x| {
            let is_negative = x.starts_with("!");
            let x = if is_negative { &x[1..] } else { x };
            let fileset: Option<&str> = x.strip_prefix("{workspaceRoot}/");
            if let Some(fileset) = fileset {
                if is_negative {
                    Some(format!("!{}", fileset))
                } else {
                    Some(fileset.to_string())
                }
            } else {
                warn!(
                    "{x} does not start with {}. This will throw an error in Nx 20.",
                    "{workspaceRoot}/"
                );
                None
            }
        })
        .collect()
}

pub fn get_workspace_files<'a, 'b>(
    workspace_file_sets: &'a [String],
    all_workspace_files: &'b [FileData],
) -> napi::Result<impl ParallelIterator<Item = &'b FileData>> {
    let globs = expand_workspace_globs(workspace_file_sets);
    glob_files(all_workspace_files, globs, None)
}

/// Hash workspace files and return both the hash and the list of matched file paths.
pub fn hash_workspace_files_with_inputs(
    workspace_file_sets: &[String],
    all_workspace_files: &[FileData],
) -> Result<WorkspaceFilesHashResult> {
    let globs = expand_workspace_globs(workspace_file_sets);

    if globs.is_empty() {
        return Ok(WorkspaceFilesHashResult {
            hash: hash(b""),
            files: vec![],
        });
    }

    let glob = build_glob_set(&globs)?;

    let mut hasher = xxhash_rust::xxh3::Xxh3::new();
    let mut files = Vec::new();

    debug_span!("Hashing workspace fileset with inputs").in_scope(|| {
        for file in all_workspace_files
            .iter()
            .filter(|file| glob.is_match(&file.file))
        {
            debug!("Adding {:?} ({:?}) to hash", file.hash, file.file);
            hasher.update(file.file.clone().as_bytes());
            hasher.update(file.hash.clone().as_bytes());
            files.push(file.file.clone());
        }
        let hashed_value = hasher.digest().to_string();
        debug!("Hash Value: {:?}", hashed_value);

        Ok(WorkspaceFilesHashResult {
            hash: hashed_value,
            files,
        })
    })
}

#[cfg(test)]
mod test {
    use crate::native::hasher::hash;

    use super::*;

    #[test]
    fn invalid_workspace_input_is_just_empty_hash() {
        let result =
            hash_workspace_files_with_inputs(&["packages/{package}".to_string()], &[]).unwrap();
        assert_eq!(result.hash, hash(b""));
    }

    #[test]
    fn test_hash_workspace_files() {
        let gitignore_file = FileData {
            file: ".gitignore".into(),
            hash: "123".into(),
        };
        let nxignore_file = FileData {
            file: ".nxignore".into(),
            hash: "456".into(),
        };
        let package_json_file = FileData {
            file: "package.json".into(),
            hash: "789".into(),
        };
        let project_file = FileData {
            file: "packages/project/project.json".into(),
            hash: "abc".into(),
        };
        let result = hash_workspace_files_with_inputs(
            &["{workspaceRoot}/.gitignore".to_string()],
            &[
                gitignore_file.clone(),
                nxignore_file.clone(),
                package_json_file.clone(),
                project_file.clone(),
            ],
        )
        .unwrap();
        assert_eq!(result.hash, "15841935230129999746");
    }

    #[test]
    fn test_hash_workspace_files_is_deterministic() {
        let gitignore_file = FileData {
            file: ".gitignore".into(),
            hash: "123".into(),
        };
        let nxignore_file = FileData {
            file: ".nxignore".into(),
            hash: "456".into(),
        };
        let package_json_file = FileData {
            file: "package.json".into(),
            hash: "789".into(),
        };
        let project_file = FileData {
            file: "packages/project/project.json".into(),
            hash: "abc".into(),
        };
        for _ in 0..1000 {
            let result = hash_workspace_files_with_inputs(
                &["{workspaceRoot}/**/*".to_string()],
                &[
                    gitignore_file.clone(),
                    nxignore_file.clone(),
                    package_json_file.clone(),
                    project_file.clone(),
                ],
            )
            .unwrap();
            assert_eq!(result.hash, "13759877301064854697");
        }
    }
}
