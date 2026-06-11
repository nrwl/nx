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

/// Filters `files` to those selected by a `dependentTasksOutputFiles` glob.
///
/// This is the single place the `dependentTasksOutputFiles` glob is applied to a
/// set of paths. It is shared by `resolve_task_output_files` (which feeds it a
/// dependency's on-disk output files) and the hash-plan inspector's static
/// dependent-output check (which feeds it candidate paths that may not exist on
/// disk yet), so the glob-matching lives in exactly one place.
pub fn filter_output_files_by_glob(
    dependent_tasks_output_files: &str,
    files: impl IntoIterator<Item = String>,
) -> Result<Vec<String>> {
    let glob_set = build_glob_set(&[dependent_tasks_output_files])?;
    Ok(files
        .into_iter()
        .filter(|file| glob_set.is_match(file))
        .collect())
}

/// Resolves task output files by expanding output paths and filtering by glob pattern.
/// This is the file-resolution portion without any hashing, for use by the inspector.
pub fn resolve_task_output_files(
    workspace_root: &str,
    glob: &str,
    outputs: &[String],
) -> Result<Vec<String>> {
    let output_files = get_files_for_outputs(Path::new(workspace_root), outputs.to_vec())?;
    filter_output_files_by_glob(glob, output_files)
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
