use rayon::prelude::*;
use std::sync::Arc;

use crate::native::glob::build_glob_set;
use crate::native::glob::glob_files::glob_files;
use crate::native::hasher::hash;
use crate::native::types::FileData;
use anyhow::*;
use dashmap::DashMap;
use tracing::{debug, debug_span, trace, warn};

use crate::native::utils::BufferedHasher;

fn globs_from_workspace_inputs(workspace_file_sets: &[String]) -> Vec<String> {
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
    let globs = globs_from_workspace_inputs(workspace_file_sets);
    glob_files(all_workspace_files, globs, None)
}

pub fn hash_workspace_files(
    workspace_file_sets: &[String],
    all_workspace_files: &[FileData],
    cache: Arc<DashMap<String, String>>,
) -> Result<String> {
    let globs = globs_from_workspace_inputs(workspace_file_sets);

    if globs.is_empty() {
        return Ok(hash(b""));
    }

    let cache_key = globs.join(",");
    if let Some(cache_results) = cache.get(&cache_key) {
        return Ok(cache_results.clone());
    }

    let glob = build_glob_set(&globs)?;

    debug_span!("Hashing workspace fileset", cache_key).in_scope(|| {
        let mut hasher = BufferedHasher::with_default_capacity();

        for file in all_workspace_files
            .iter()
            .filter(|file| glob.is_match(&file.file))
        {
            debug!("Adding {:?} ({:?}) to hash", file.hash, file.file);
            hasher.update_multiple(&[file.file.as_bytes(), file.hash.as_bytes()]);
        }

        let hashed_value = hasher.digest();
        debug!("Hash Value: {:?}", hashed_value);

        cache.insert(cache_key.to_string(), hashed_value.clone());
        Ok(hashed_value)
    })
}

#[cfg(test)]
mod test {
    use crate::native::hasher::hash;

    use super::*;
    use dashmap::DashMap;
    use std::sync::Arc;

    #[test]
    fn invalid_workspace_input_is_just_empty_hash() {
        let result = hash_workspace_files(
            &["packages/{package}".to_string()],
            &[],
            Arc::new(DashMap::new()),
        )
        .unwrap();
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
            Arc::new(DashMap::new()),
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
        for i in 0..1000 {
            let result = hash_workspace_files(
                &["{workspaceRoot}/**/*".to_string()],
                &[
                    gitignore_file.clone(),
                    nxignore_file.clone(),
                    package_json_file.clone(),
                    project_file.clone(),
                ],
                Arc::new(DashMap::new()),
            )
            .unwrap();
            assert_eq!(result, "13759877301064854697");
        }
    }
}
