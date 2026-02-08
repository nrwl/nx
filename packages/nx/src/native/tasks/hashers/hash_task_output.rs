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
    let output_files = get_files_for_outputs(workspace_root.to_string(), outputs.to_vec())?;
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
