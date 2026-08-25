use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use std::time::UNIX_EPOCH;

use anyhow::{Result, bail};
use dashmap::DashMap;
use rayon::prelude::*;
use tracing::trace;
use walkdir::WalkDir;
use xxhash_rust::xxh3;

use crate::native::glob::build_glob_set;
use crate::native::glob::glob_transform::partition_glob;
use crate::native::hasher::hash_file_path;
use crate::native::walker::HARDCODED_IGNORE_PATTERNS;

/// Hashed in place of the content of a declared exact path that does not
/// exist: absence is an observation, so the key flips when the file appears.
const MISSING_FILE_HASH: &str = "missing";

/// Expansion per `files:[...]` instruction, scoped to one `hash_plans` call:
/// nothing watches gitignored directories, so a longer-lived memo goes stale.
pub(crate) type FilesExpansionCache = DashMap<String, Arc<FilesExpansion>>;

/// Content hashes keyed by workspace-relative path, revalidated by
/// (mtime, size). Safe to keep for the TaskHasher lifetime.
pub(crate) type FileContentCache = DashMap<String, CachedFileContent>;

pub(crate) struct CachedFileContent {
    mtime: u128,
    size: u64,
    hash: String,
}

pub struct FilesExpansion {
    /// Existing files matched by the group, sorted, workspace-relative.
    pub files: Vec<String>,
    /// Declared exact paths that do not exist on disk.
    pub missing: Vec<String>,
}

/// Rejects globs with no literal leading directory (`**/*`, `*.gen`): a walk
/// from the workspace root is never what was meant.
pub(crate) fn validate_files_globs(globs: &[String]) -> Result<()> {
    for glob in globs.iter().filter(|g| !g.starts_with('!')) {
        let (root, _) = partition_glob(glob)?;
        if root.is_empty() {
            bail!(
                "The `files` input \"{glob}\" has no leading directory, so it would walk the whole workspace. Start it with the directory that holds the files."
            );
        }
    }
    Ok(())
}

/// Expands a `files` group against the disk: every positive glob is walked
/// from its literal prefix, then the whole group (negations included) filters
/// the candidates. Walks skip the same directories the workspace walker never
/// enters, but an exact path or a prefix inside one of them is read as-is.
pub fn expand_files(workspace_root: &Path, globs: &[String]) -> Result<FilesExpansion> {
    let skip = build_glob_set(HARDCODED_IGNORE_PATTERNS)?;
    let mut effective: Vec<String> = globs
        .iter()
        .filter(|g| g.starts_with('!'))
        .cloned()
        .collect();
    let mut files: Vec<String> = Vec::new();
    let mut missing: Vec<String> = Vec::new();

    for glob in globs.iter().filter(|g| !g.starts_with('!')) {
        let (root, patterns) = partition_glob(glob)?;
        if root.is_empty() {
            bail!("The `files` input \"{glob}\" has no leading directory.");
        }
        let start = workspace_root.join(&root);
        let Ok(metadata) = std::fs::metadata(&start) else {
            if patterns.is_empty() {
                missing.push(root);
            }
            continue;
        };
        // The prefix is caller-supplied (a snapshot bundle, or config); confine
        // it to the workspace after symlink resolution, not just lexically.
        let canonical_root = workspace_root.canonicalize()?;
        if !start.canonicalize()?.starts_with(&canonical_root) {
            bail!("The `files` input \"{glob}\" resolves outside the workspace.");
        }
        if metadata.is_file() {
            files.push(root);
            effective.push(glob.clone());
            continue;
        }
        // A directory declared by its exact path means everything under it.
        effective.push(if patterns.is_empty() {
            format!("{root}/**")
        } else {
            glob.clone()
        });
        let walker = WalkDir::new(&start)
            .follow_links(false)
            .into_iter()
            .filter_entry(|entry| entry.depth() == 0 || !skip.is_match(entry.path()));
        for entry in walker.flatten() {
            let file_type = entry.file_type();
            let is_file = file_type.is_file()
                || (file_type.is_symlink()
                    && std::fs::metadata(entry.path()).is_ok_and(|m| m.is_file())
                    // A link pointing out of the workspace is not workspace content.
                    && entry
                        .path()
                        .canonicalize()
                        .is_ok_and(|target| target.starts_with(&canonical_root)));
            if !is_file {
                continue;
            }
            if let Ok(relative) = entry.path().strip_prefix(workspace_root) {
                files.push(relative.to_string_lossy().replace('\\', "/"));
            }
        }
    }

    let glob_set = build_glob_set(&effective)?;
    files.sort_unstable();
    files.dedup();
    files.retain(|file| glob_set.is_match(file));
    missing.sort_unstable();
    missing.dedup();
    missing.retain(|file| glob_set.is_match(file));
    Ok(FilesExpansion { files, missing })
}

pub(crate) fn expand_files_cached(
    workspace_root: &Path,
    key: &str,
    globs: &[String],
    cache: &FilesExpansionCache,
) -> Result<Arc<FilesExpansion>> {
    if let Some(cached) = cache.get(key) {
        return Ok(Arc::clone(&cached));
    }
    let expansion = Arc::new(expand_files(workspace_root, globs)?);
    cache.insert(key.to_string(), Arc::clone(&expansion));
    Ok(expansion)
}

/// Folds `(path, content hash)` pairs in path order, like a fileset. `known`
/// answers from the workspace file map so tracked files never touch the disk.
pub(crate) fn hash_files(
    workspace_root: &Path,
    expansion: &FilesExpansion,
    known: impl Fn(&str) -> Option<String> + Sync,
    cache: &FileContentCache,
) -> String {
    let hashes: Vec<String> = expansion
        .files
        .par_iter()
        .map(|file| known(file).unwrap_or_else(|| hash_file_cached(workspace_root, file, cache)))
        .collect();

    let mut hasher = xxh3::Xxh3::new();
    for (file, hash) in expansion.files.iter().zip(&hashes) {
        hasher.update(file.as_bytes());
        hasher.update(hash.as_bytes());
    }
    for file in &expansion.missing {
        hasher.update(file.as_bytes());
        hasher.update(MISSING_FILE_HASH.as_bytes());
    }
    hasher.digest().to_string()
}

fn hash_file_cached(workspace_root: &Path, file: &str, cache: &FileContentCache) -> String {
    let path = workspace_root.join(file);
    let stamp = std::fs::metadata(&path).ok().map(|m| {
        let mtime = m
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        (mtime, m.len())
    });
    if let Some((mtime, size)) = stamp {
        let hit = cache
            .get(file)
            .filter(|cached| cached.mtime == mtime && cached.size == size)
            .map(|cached| cached.hash.clone());
        if let Some(hash) = hit {
            trace!("files content cache HIT for {file}");
            return hash;
        }
    }
    let hash = hash_file_path(&path).unwrap_or_else(|| MISSING_FILE_HASH.to_string());
    if let Some((mtime, size)) = stamp {
        cache.insert(
            file.to_string(),
            CachedFileContent {
                mtime,
                size,
                hash: hash.clone(),
            },
        );
    }
    hash
}

/// Index of the workspace file map by path, built once per hasher on first use.
pub(crate) fn index_file_map(files: &[crate::native::types::FileData]) -> HashMap<String, u32> {
    files
        .iter()
        .enumerate()
        .map(|(i, f)| (f.file.clone(), i as u32))
        .collect()
}

#[napi]
/// The existing files a `{ files: [...] }` input group matches on disk, sorted.
pub fn expand_files_input(workspace_root: String, globs: Vec<String>) -> Result<Vec<String>> {
    Ok(expand_files(Path::new(&workspace_root), &globs)?.files)
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    fn workspace() -> TempDir {
        let temp = TempDir::new().unwrap();
        temp.child("dist/gen/a.js").write_str("a").unwrap();
        temp.child("dist/gen/a.js.map").write_str("map").unwrap();
        temp.child("dist/gen/nested/b.js").write_str("b").unwrap();
        temp.child("dist/other/c.js").write_str("c").unwrap();
        temp.child("dist/gen/node_modules/dep/index.js")
            .write_str("dep")
            .unwrap();
        temp.child("node_modules/foo/package.json")
            .write_str("{}")
            .unwrap();
        temp
    }

    fn globs(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn refuses_a_prefix_that_leaves_the_workspace() {
        let temp = workspace();
        let outside = temp.path().parent().unwrap().join("outside-secret.txt");
        std::fs::write(&outside, "secret").unwrap();
        let err = match expand_files(temp.path(), &globs(&["../outside-secret.txt"])) {
            Err(err) => err,
            Ok(_) => panic!("a prefix outside the workspace must be refused"),
        };
        assert!(err.to_string().contains("outside the workspace"), "{err}");
        assert!(expand_files(temp.path(), &globs(&["../**"])).is_err());
        std::fs::remove_file(outside).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn skips_symlinks_whose_target_leaves_the_workspace() {
        let temp = workspace();
        let outside = temp.path().parent().unwrap().join("outside-linked.js");
        std::fs::write(&outside, "secret").unwrap();
        std::os::unix::fs::symlink(&outside, temp.path().join("dist/gen/escape.js")).unwrap();
        std::os::unix::fs::symlink(
            temp.path().join("dist/other/c.js"),
            temp.path().join("dist/gen/inside.js"),
        )
        .unwrap();
        let expansion = expand_files(temp.path(), &globs(&["dist/gen/*.js"])).unwrap();
        assert_eq!(expansion.files, vec!["dist/gen/a.js", "dist/gen/inside.js"]);
        // An exact path that is itself a link out of the workspace is refused.
        assert!(expand_files(temp.path(), &globs(&["dist/gen/escape.js"])).is_err());
        std::fs::remove_file(outside).unwrap();
    }

    #[test]
    fn expands_from_the_literal_prefix_and_applies_negations() {
        let temp = workspace();
        let expansion = expand_files(
            temp.path(),
            &globs(&["dist/gen/**/*.js", "!dist/gen/**/*.map"]),
        )
        .unwrap();
        assert_eq!(
            expansion.files,
            vec!["dist/gen/a.js", "dist/gen/nested/b.js"]
        );
        assert!(expansion.missing.is_empty());
    }

    #[test]
    fn walks_skip_hardcoded_ignores_but_exact_paths_inside_them_are_read() {
        let temp = workspace();
        let walked = expand_files(temp.path(), &globs(&["dist/**"])).unwrap();
        assert!(
            !walked.files.iter().any(|f| f.contains("node_modules")),
            "{:?}",
            walked.files
        );

        let exact = expand_files(temp.path(), &globs(&["node_modules/foo/package.json"])).unwrap();
        assert_eq!(exact.files, vec!["node_modules/foo/package.json"]);

        let prefixed = expand_files(temp.path(), &globs(&["node_modules/foo/**"])).unwrap();
        assert_eq!(prefixed.files, vec!["node_modules/foo/package.json"]);
    }

    #[test]
    fn exact_directory_means_everything_under_it() {
        let temp = workspace();
        let expansion = expand_files(temp.path(), &globs(&["dist/other"])).unwrap();
        assert_eq!(expansion.files, vec!["dist/other/c.js"]);
    }

    #[test]
    fn missing_exact_path_is_recorded_and_changes_the_hash_when_it_appears() {
        let temp = workspace();
        let cache = FileContentCache::new();
        let input = globs(&["dist/gen/generated.d.ts"]);

        let before = expand_files(temp.path(), &input).unwrap();
        assert!(before.files.is_empty());
        assert_eq!(before.missing, vec!["dist/gen/generated.d.ts"]);
        let hash_before = hash_files(temp.path(), &before, |_| None, &cache);

        temp.child("dist/gen/generated.d.ts")
            .write_str("x")
            .unwrap();
        let after = expand_files(temp.path(), &input).unwrap();
        assert_eq!(after.files, vec!["dist/gen/generated.d.ts"]);
        let hash_after = hash_files(temp.path(), &after, |_| None, &cache);

        assert_ne!(hash_before, hash_after);
    }

    #[test]
    fn content_cache_revalidates_by_mtime_and_size() {
        let temp = workspace();
        let cache = FileContentCache::new();
        let expansion = expand_files(temp.path(), &globs(&["dist/gen/a.js"])).unwrap();

        let first = hash_files(temp.path(), &expansion, |_| None, &cache);
        assert_eq!(cache.len(), 1);

        // Same size, forced newer mtime: must re-read, not trust the cache.
        std::thread::sleep(std::time::Duration::from_millis(20));
        temp.child("dist/gen/a.js").write_str("z").unwrap();
        let file = temp.path().join("dist/gen/a.js");
        let now = std::fs::File::open(&file).unwrap();
        now.set_modified(std::time::SystemTime::now()).unwrap();
        let second = hash_files(temp.path(), &expansion, |_| None, &cache);
        assert_ne!(first, second);

        // Untouched: cache hit yields the same hash.
        let third = hash_files(temp.path(), &expansion, |_| None, &cache);
        assert_eq!(second, third);
    }

    #[test]
    fn file_map_hash_wins_over_disk() {
        let temp = workspace();
        let cache = FileContentCache::new();
        let expansion = expand_files(temp.path(), &globs(&["dist/gen/a.js"])).unwrap();

        let from_disk = hash_files(temp.path(), &expansion, |_| None, &cache);
        let from_map = hash_files(
            temp.path(),
            &expansion,
            |path| (path == "dist/gen/a.js").then(|| "known".to_string()),
            &cache,
        );
        assert_ne!(from_disk, from_map);
    }

    #[test]
    fn rejects_globs_without_a_leading_directory() {
        assert!(validate_files_globs(&globs(&["**/*.gen"])).is_err());
        assert!(validate_files_globs(&globs(&["*.gen"])).is_err());
        assert!(validate_files_globs(&globs(&["dist/**/*.gen", "!**/*.map"])).is_ok());
        assert!(validate_files_globs(&globs(&["dist/gen/a.js"])).is_ok());
    }
}
