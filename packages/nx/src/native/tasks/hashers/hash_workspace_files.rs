use std::sync::Arc;

use dashmap::DashMap;
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

pub(crate) type WorkspaceFileSetCache = DashMap<String, Arc<WorkspaceFilesHashResult>>;

fn workspace_file_set_cache_key(workspace_file_sets: &[String]) -> String {
    let mut sorted_file_sets: Vec<&str> = workspace_file_sets.iter().map(String::as_str).collect();
    sorted_file_sets.sort();

    format!(
        "{}\0{}",
        sorted_file_sets.len(),
        sorted_file_sets.join("\0")
    )
}

/// Expands workspace file set patterns by stripping `{workspaceRoot}/` prefix.
/// Handles negation patterns (e.g., `!{workspaceRoot}/...`).
pub fn globs_from_workspace_globs(workspace_file_sets: &[String]) -> Vec<String> {
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
    let globs = globs_from_workspace_globs(workspace_file_sets);
    glob_files(all_workspace_files, globs, None)
}

/// Hash workspace files and return both the hash and the list of matched file paths.
pub fn hash_workspace_files_with_inputs(
    workspace_file_sets: &[String],
    all_workspace_files: &[FileData],
) -> Result<WorkspaceFilesHashResult> {
    let globs = globs_from_workspace_globs(workspace_file_sets);

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
            hasher.update(file.file.as_bytes());
            hasher.update(file.hash.as_bytes());
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

pub(crate) fn hash_workspace_files_with_inputs_cached(
    workspace_file_sets: &[String],
    all_workspace_files: &[FileData],
    cache: &WorkspaceFileSetCache,
) -> Result<Arc<WorkspaceFilesHashResult>> {
    let cache_key = workspace_file_set_cache_key(workspace_file_sets);
    if let Some(entry) = cache.get(&cache_key) {
        return Ok(Arc::clone(entry.value()));
    }

    // Misses hold the shard write lock while computing, which also blocks other
    // keys on the same shard. Acceptable here: this map only ever holds a
    // handful of workspace fileset combos, each computed once.
    let entry = cache.entry(cache_key).or_try_insert_with(|| {
        hash_workspace_files_with_inputs(workspace_file_sets, all_workspace_files).map(Arc::new)
    })?;
    Ok(Arc::clone(entry.value()))
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

    #[test]
    fn should_cache_by_fileset_combo_regardless_of_order() {
        let first_file_sets = &[
            "{workspaceRoot}/**/*".to_string(),
            "!{workspaceRoot}/**/*.spec.ts".to_string(),
        ];
        let second_file_sets = &[
            "!{workspaceRoot}/**/*.spec.ts".to_string(),
            "{workspaceRoot}/**/*".to_string(),
        ];
        let all_workspace_files = vec![
            FileData {
                file: "test1.ts".into(),
                hash: "file_data1".into(),
            },
            FileData {
                file: "test.spec.ts".into(),
                hash: "file_data2".into(),
            },
        ];

        let cache = WorkspaceFileSetCache::new();
        let first =
            hash_workspace_files_with_inputs_cached(first_file_sets, &all_workspace_files, &cache)
                .unwrap();
        let second =
            hash_workspace_files_with_inputs_cached(second_file_sets, &all_workspace_files, &cache)
                .unwrap();

        assert_eq!(cache.len(), 1);
        assert!(Arc::ptr_eq(&first, &second));
    }
}
