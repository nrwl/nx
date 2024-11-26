use std::sync::Arc;

use anyhow::*;
use dashmap::DashMap;
use tracing::{trace, warn};

use crate::native::types::FileData;
use crate::native::{glob::build_glob_set, hasher::hash};

pub fn hash_workspace_files(
    workspace_file_sets: &[String],
    all_workspace_files: &[FileData],
    cache: Arc<DashMap<String, String>>,
) -> Result<String> {
    let globs: Vec<String> = workspace_file_sets
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
        .collect();

    if globs.is_empty() {
        return Ok(hash(b""));
    }

    let cache_key = globs.join(",");
    if let Some(cache_results) = cache.get(&cache_key) {
        return Ok(cache_results.clone());
    }

    let glob = build_glob_set(&globs)?;

    let mut hasher = xxhash_rust::xxh3::Xxh3::new();
    let mut hashes: Vec<String> = Vec::new();
    for file in all_workspace_files
        .iter()
        .filter(|file| glob.is_match(&file.file))
    {
        trace!("{:?} was found with glob {:?}", file.file, globs);
        hashes.push(file.hash.clone());
        hashes.push(file.file.clone());
    }
    hasher.update(hashes.join(",").as_bytes());
    let hashed_value = hasher.digest().to_string();

    cache.insert(cache_key.to_string(), hashed_value.clone());
    Ok(hashed_value)
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
        assert_eq!(result, hash([
            gitignore_file.hash,
            gitignore_file.file
        ].join(",").as_bytes()));
    }
}
