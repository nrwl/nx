use std::sync::Arc;

use rayon::prelude::*;

use super::once_cache::OnceCache;
use crate::native::glob::build_glob_set;
use crate::native::glob::glob_files::glob_files;
use crate::native::hasher::hash;
use crate::native::types::FileData;
use anyhow::*;
use tracing::{debug, debug_span, trace, warn};

/// Compute-once cache for workspace fileset hashes. Holds only the hash, so
/// retaining it for the TaskHasher lifetime stays O(filesets), not O(files).
pub(crate) type WorkspaceFileSetCache = OnceCache<String>;

/// Compute-once cache for the matched file paths of a workspace fileset.
/// Only populated when task inputs are collected; callers keep it
/// per-invocation so the expanded paths are freed once that call returns.
pub(crate) type WorkspaceFilePathsCache = OnceCache<Vec<String>>;

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

/// Hashes workspace files without materializing the matched file list.
pub fn hash_workspace_files(
    workspace_file_sets: &[String],
    all_workspace_files: &[FileData],
) -> Result<String> {
    let globs = globs_from_workspace_globs(workspace_file_sets);

    if globs.is_empty() {
        return Ok(hash(b""));
    }

    let glob = build_glob_set(&globs)?;

    let mut hasher = xxhash_rust::xxh3::Xxh3::new();

    debug_span!("Hashing workspace fileset").in_scope(|| {
        for file in all_workspace_files
            .iter()
            .filter(|file| glob.is_match(&file.file))
        {
            debug!("Adding {:?} ({:?}) to hash", file.hash, file.file);
            hasher.update(file.file.as_bytes());
            hasher.update(file.hash.as_bytes());
        }
        let hashed_value = hasher.digest().to_string();
        debug!("Hash Value: {:?}", hashed_value);

        Ok(hashed_value)
    })
}

pub(crate) fn hash_workspace_files_cached(
    workspace_file_sets: &[String],
    all_workspace_files: &[FileData],
    cache: &WorkspaceFileSetCache,
) -> Result<Arc<String>> {
    cache.get_or_try_init(workspace_file_set_cache_key(workspace_file_sets), || {
        hash_workspace_files(workspace_file_sets, all_workspace_files)
    })
}

/// The matched file paths of a workspace fileset, in workspace-file order
/// (the same order hashing folds them).
pub fn collect_workspace_file_paths(
    workspace_file_sets: &[String],
    all_workspace_files: &[FileData],
) -> Result<Vec<String>> {
    let globs = globs_from_workspace_globs(workspace_file_sets);

    if globs.is_empty() {
        return Ok(vec![]);
    }

    let glob = build_glob_set(&globs)?;

    Ok(all_workspace_files
        .iter()
        .filter(|file| glob.is_match(&file.file))
        .map(|file| file.file.clone())
        .collect())
}

pub(crate) fn collect_workspace_file_paths_cached(
    workspace_file_sets: &[String],
    all_workspace_files: &[FileData],
    cache: &WorkspaceFilePathsCache,
) -> Result<Arc<Vec<String>>> {
    cache.get_or_try_init(workspace_file_set_cache_key(workspace_file_sets), || {
        collect_workspace_file_paths(workspace_file_sets, all_workspace_files)
    })
}

#[cfg(test)]
mod test {
    use crate::native::hasher::hash;

    use super::*;

    #[test]
    fn invalid_workspace_input_is_just_empty_hash() {
        let result = hash_workspace_files(&["packages/{package}".to_string()], &[]).unwrap();
        assert_eq!(result, hash(b""));
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
        let result = hash_workspace_files(
            &["{workspaceRoot}/.gitignore".to_string()],
            &[
                gitignore_file.clone(),
                nxignore_file.clone(),
                package_json_file.clone(),
                project_file.clone(),
            ],
        )
        .unwrap();
        assert_eq!(result, "15841935230129999746");
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
            let result = hash_workspace_files(
                &["{workspaceRoot}/**/*".to_string()],
                &[
                    gitignore_file.clone(),
                    nxignore_file.clone(),
                    package_json_file.clone(),
                    project_file.clone(),
                ],
            )
            .unwrap();
            assert_eq!(result, "13759877301064854697");
        }
    }

    #[test]
    fn should_collect_file_paths_in_workspace_file_order() {
        let all_workspace_files = vec![
            FileData {
                file: ".gitignore".into(),
                hash: "123".into(),
            },
            FileData {
                file: "package.json".into(),
                hash: "789".into(),
            },
            FileData {
                file: "packages/project/project.json".into(),
                hash: "abc".into(),
            },
        ];

        let paths = collect_workspace_file_paths(
            &["{workspaceRoot}/**/*.json".to_string()],
            &all_workspace_files,
        )
        .unwrap();
        assert_eq!(paths, vec!["package.json", "packages/project/project.json"]);

        let paths =
            collect_workspace_file_paths(&["packages/{package}".to_string()], &all_workspace_files)
                .unwrap();
        assert!(paths.is_empty());
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
            hash_workspace_files_cached(first_file_sets, &all_workspace_files, &cache).unwrap();
        let second =
            hash_workspace_files_cached(second_file_sets, &all_workspace_files, &cache).unwrap();

        assert_eq!(cache.len(), 1);
        assert!(Arc::ptr_eq(&first, &second));

        let paths_cache = WorkspaceFilePathsCache::new();
        let first = collect_workspace_file_paths_cached(
            first_file_sets,
            &all_workspace_files,
            &paths_cache,
        )
        .unwrap();
        let second = collect_workspace_file_paths_cached(
            second_file_sets,
            &all_workspace_files,
            &paths_cache,
        )
        .unwrap();

        assert_eq!(paths_cache.len(), 1);
        assert!(Arc::ptr_eq(&first, &second));
    }
}
