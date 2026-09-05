use crate::native::cache::expand_outputs::get_files_for_outputs;
use crate::native::glob::build_glob_set;
use crate::native::hasher::hash_file;
use anyhow::*;
use dashmap::DashMap;
use rayon::prelude::*;
use std::path::Path;
use tracing::trace;
use xxhash_rust::xxh3;

/// Result of hashing task output files, including the matched file paths
pub struct TaskOutputHashResult {
    pub hash: String,
    pub files: Vec<String>,
}

/// Cache entry for task output hashing - stores both hash and files
pub struct CachedTaskOutput {
    pub hash: String,
    pub files: Vec<String>,
}

/// Resolves task output files by expanding output paths and filtering by glob pattern.
/// This is the file-resolution portion without any hashing, for use by the inspector.
pub fn resolve_task_output_files(
    workspace_root: &str,
    glob: &str,
    outputs: &[String],
) -> Result<Vec<String>> {
    let output_files = get_files_for_outputs(Path::new(workspace_root), outputs.to_vec())?;
    let glob_set = build_glob_set(&[glob])?;
    Ok(output_files
        .into_iter()
        .filter(|f| glob_set.is_match(f))
        .collect())
}

pub fn hash_task_output(
    workspace_root: &str,
    glob: &str,
    outputs: &[String],
    cache: &DashMap<String, CachedTaskOutput>,
) -> Result<TaskOutputHashResult> {
    // Create cache key from glob pattern and outputs
    let cache_key = format!("{}|{}", glob, outputs.join("|"));

    // Check cache first
    if let Some(cached) = cache.get(&cache_key) {
        trace!("TaskOutput cache HIT for {}", cache_key);
        return Ok(TaskOutputHashResult {
            hash: cached.hash.clone(),
            files: cached.files.clone(),
        });
    }

    trace!("TaskOutput cache MISS for {}", cache_key);
    let now = std::time::Instant::now();
    let output_files = get_files_for_outputs(Path::new(workspace_root), outputs.to_vec())?;
    trace!("get_files_for_outputs: {:?}", now.elapsed());
    let glob = build_glob_set(&[glob])?;

    // Collect and sort file entries for deterministic hashing
    let mut file_entries: Vec<_> = output_files
        .into_par_iter()
        .filter(|file| glob.is_match(file))
        .filter_map(|file| {
            hash_file(
                Path::new(workspace_root)
                    .join(&file)
                    .to_str()
                    .expect("path contains invalid utf-8")
                    .to_owned(),
            )
            .map(|hash| (file, hash))
        })
        .collect();

    file_entries.sort();

    // Hash file names and content hashes incrementally
    let mut hasher = xxh3::Xxh3::new();
    let mut files = Vec::with_capacity(file_entries.len());
    for (file, hash) in file_entries {
        trace!("Adding {:?} ({:?}) to hash", hash, file);
        hasher.update(file.as_bytes());
        hasher.update(hash.as_bytes());
        files.push(file);
    }

    let result_hash = hasher.digest().to_string();

    // Store in cache for future use
    cache.insert(
        cache_key,
        CachedTaskOutput {
            hash: result_hash.clone(),
            files: files.clone(),
        },
    );

    Ok(TaskOutputHashResult {
        hash: result_hash,
        files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    #[test]
    fn should_hash_scoped_output_files() {
        let temp = TempDir::new().unwrap();
        let declaration = temp.child("packages/@acme/producer/dist/index.d.ts");
        declaration
            .write_str("export declare const value: 1;\n")
            .unwrap();
        let outputs = vec!["packages/@acme/producer/dist/**/*.d.ts".to_string()];

        let first = hash_task_output(
            temp.path().to_str().unwrap(),
            "**/*.d.ts",
            &outputs,
            &DashMap::new(),
        )
        .unwrap();

        declaration
            .write_str("export declare const value: 2;\n")
            .unwrap();
        let second = hash_task_output(
            temp.path().to_str().unwrap(),
            "**/*.d.ts",
            &outputs,
            &DashMap::new(),
        )
        .unwrap();

        assert_eq!(first.files, ["packages/@acme/producer/dist/index.d.ts"]);
        assert_eq!(first.files, second.files);
        assert_ne!(first.hash, second.hash);
    }
}
