use hashbrown::HashMap;
use std::path::{Path, PathBuf};
use tracing::{debug, trace};

use crate::native::glob::{build_glob_set, contains_glob_pattern, glob_transform::partition_glob};
use crate::native::logger::enable_logger;
use crate::native::utils::Normalize;
use crate::native::walker::{nx_walker, nx_walker_sync};

#[napi]
pub fn expand_outputs(directory: String, entries: Vec<String>) -> anyhow::Result<Vec<String>> {
    _expand_outputs(directory, entries)
}

/// Expands the given entries into a list of existing directories and files.
/// This is used for copying outputs to and from the cache
pub fn _expand_outputs<P>(directory: P, entries: Vec<String>) -> anyhow::Result<Vec<String>>
where
    P: AsRef<Path>,
{
    let directory: PathBuf = directory.as_ref().into();
    trace!(
        "Expanding {} output entries in directory: {:?}",
        entries.len(),
        &directory
    );

    let has_glob_pattern = entries.iter().any(|entry| contains_glob_pattern(entry));

    if !has_glob_pattern {
        trace!("No glob patterns found, checking if entries exist");
        let mut existing_count = 0;
        let existing_directories = entries
            .into_iter()
            .filter(|entry| {
                let path = directory.join(entry);
                let exists = path.exists();
                if exists {
                    existing_count += 1;
                    trace!("Found existing entry: {}", entry);
                } else {
                    trace!("Entry does not exist: {}", entry);
                }
                exists
            })
            .collect::<Vec<_>>();
        debug!(
            "Expanded outputs: found {} existing entries out of {} total",
            existing_count,
            existing_directories.len()
        );
        return Ok(existing_directories);
    }

    let (regular_globs, negated_globs): (Vec<_>, Vec<_>) = entries
        .into_iter()
        .partition(|entry| !entry.starts_with('!'));

    let negated_globs = negated_globs
        .into_iter()
        .map(|s| s[1..].to_string())
        .collect::<Vec<_>>();

    let regular_globs = regular_globs
        .into_iter()
        .map(|s| {
            if !s.ends_with('/') {
                let path = directory.join(&s);
                if path.is_dir() {
                    return format!("{}/", s);
                }
            }
            s
        })
        .collect::<Vec<_>>();

    trace!(?negated_globs, ?regular_globs, "Expanding globs");
    trace!(
        "Building glob set for {} regular globs",
        regular_globs.len()
    );

    let glob_set = build_glob_set(&regular_globs)?;
    trace!("Successfully built glob set");

    trace!(
        "Walking directory with {} negated globs",
        negated_globs.len()
    );
    let found_paths = nx_walker_sync(&directory, Some(&negated_globs))
        .filter_map(|path| {
            if glob_set.is_match(&path) {
                trace!("Glob match found: {}", path.to_normalized_string());
                Some(path.to_normalized_string())
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    debug!(
        "Expanded outputs: found {} paths matching glob patterns",
        found_paths.len()
    );
    Ok(found_paths)
}

fn partition_globs_into_map(globs: Vec<String>) -> anyhow::Result<HashMap<String, Vec<String>>> {
    globs
        .iter()
        .map(|glob| partition_glob(glob))
        // Right now we have an iterator where each item is (root: String, patterns: String[]).
        // We want a singular root, with the patterns mapped to it.
        .fold(
            Ok(HashMap::<String, Vec<String>>::new()),
            |map_result, parsed_glob| {
                let mut map = map_result?;
                let (root, patterns) = parsed_glob?;
                let entry = map.entry(root).or_insert(vec![]);
                entry.extend(patterns);
                Ok(map)
            },
        )
}

#[napi]
/// Expands the given outputs into a list of existing files.
/// This is used when hashing outputs
pub fn get_files_for_outputs(
    directory: String,
    entries: Vec<String>,
) -> anyhow::Result<Vec<String>> {
    enable_logger();

    let directory: PathBuf = directory.into();

    let mut globs: Vec<String> = vec![];
    let mut files: Vec<String> = vec![];
    let mut directories: Vec<String> = vec![];
    for entry in entries.into_iter() {
        let path = directory.join(&entry);

        if !path.exists() {
            if contains_glob_pattern(&entry) {
                globs.push(entry);
            }
        } else if path.is_dir() {
            directories.push(entry);
        } else {
            files.push(entry);
        }
    }

    if !globs.is_empty() {
        let partitioned_globs = partition_globs_into_map(globs)?;
        for (root, patterns) in partitioned_globs {
            let root_path = directory.join(&root);
            let glob_set = build_glob_set(&patterns)?;
            trace!("walking directory: {:?}", root_path);

            let found_paths: Vec<String> = nx_walker(&root_path, false)
                .filter_map(|file| {
                    if glob_set.is_match(&file.normalized_path) {
                        Some(
                            // root_path contains full directory,
                            // root is only the leading dirs from glob
                            PathBuf::from(&root)
                                .join(&file.normalized_path)
                                .to_normalized_string(),
                        )
                    } else {
                        None
                    }
                })
                .collect();

            files.extend(found_paths);
        }
    }

    if !directories.is_empty() {
        for dir in directories {
            let dir = PathBuf::from(dir);
            let dir_path = directory.join(&dir);
            let files_in_dir = nx_walker(&dir_path, false).filter_map(|e| {
                let path = dir_path.join(&e.normalized_path);

                if path.is_file() {
                    Some(dir.join(e.normalized_path).to_normalized_string())
                } else {
                    None
                }
            });
            files.extend(files_in_dir);
        }
    }

    files.sort();

    Ok(files)
}

#[cfg(test)]
mod test {
    use super::*;
    use assert_fs::TempDir;
    use assert_fs::prelude::*;
    use std::{assert_eq, vec};

    fn setup_fs() -> TempDir {
        let temp = TempDir::new().unwrap();
        temp.child("test.txt").touch().unwrap();
        temp.child("foo.txt").touch().unwrap();
        temp.child("bar.txt").touch().unwrap();
        temp.child("baz").child("qux.txt").touch().unwrap();
        temp.child("nested")
            .child("deeply")
            .child("nx.darwin-arm64.node")
            .touch()
            .unwrap();
        temp.child("folder").child("nested-folder").touch().unwrap();
        temp.child("packages")
            .child("nx")
            .child("src")
            .child("native")
            .child("nx.darwin-arm64.node")
            .touch()
            .unwrap();
        temp.child("multi").child("file.js").touch().unwrap();
        temp.child("multi").child("src.ts").touch().unwrap();
        temp.child("multi").child("file.map").touch().unwrap();
        temp.child("multi").child("file.txt").touch().unwrap();
        temp.child("apps/web/.next/cache")
            .child("contents")
            .touch()
            .unwrap();
        temp.child("apps/web/.next/static")
            .child("contents")
            .touch()
            .unwrap();
        temp.child("apps/web/.next/content-file").touch().unwrap();
        temp
    }
    #[test]
    fn should_expand_outputs() {
        let temp = setup_fs();
        let entries = vec![
            "packages/nx/src/native/*.node".to_string(),
            "folder/nested-folder".to_string(),
            "test.txt".to_string(),
        ];
        let mut result = expand_outputs(temp.display().to_string(), entries).unwrap();
        result.sort();
        assert_eq!(
            result,
            vec![
                "folder/nested-folder",
                "packages/nx/src/native/nx.darwin-arm64.node",
                "test.txt"
            ]
        );
    }

    #[test]
    fn should_handle_multiple_extensions() {
        let temp = setup_fs();
        let entries = vec!["multi/*.{js,map,ts}".to_string()];
        let mut result = expand_outputs(temp.display().to_string(), entries).unwrap();
        result.sort();
        assert_eq!(
            result,
            vec!["multi/file.js", "multi/file.map", "multi/src.ts"]
        );
    }

    #[test]
    fn should_handle_multiple_outputs_with_negation() {
        let temp = setup_fs();
        let entries = vec![
            "apps/web/.next".to_string(),
            "!apps/web/.next/cache".to_string(),
        ];
        let mut result = expand_outputs(temp.display().to_string(), entries).unwrap();
        result.sort();
        assert_eq!(
            result,
            vec![
                "apps/web/.next/content-file",
                "apps/web/.next/static",
                "apps/web/.next/static/contents"
            ]
        );
    }

    #[test]
    fn should_get_files_for_outputs_with_glob() {
        let temp = setup_fs();
        let entries = vec![
            "packages/nx/src/native/*.node".to_string(),
            "folder/nested-folder".to_string(),
            "test.txt".to_string(),
        ];
        let mut result = get_files_for_outputs(temp.display().to_string(), entries).unwrap();
        result.sort();
        assert_eq!(
            result,
            vec![
                "folder/nested-folder",
                "packages/nx/src/native/nx.darwin-arm64.node",
                "test.txt"
            ]
        );
    }

    #[test]
    #[cfg(unix)]
    fn should_expand_outputs_with_symlinks_and_globs() {
        // Reproduces https://github.com/nrwl/nx/issues/34013
        // When outputs include both glob patterns (*.json) and directory patterns
        // that contain symlinks, the expanded outputs may cause EEXIST errors
        // during cache operations.
        use std::os::unix::fs::symlink;

        let temp = TempDir::new().unwrap();

        // Create .next directory with JSON files
        temp.child(".next/build-manifest.json")
            .write_str("{}")
            .unwrap();
        temp.child(".next/routes-manifest.json")
            .write_str("{}")
            .unwrap();

        // Create .next/standalone with files
        temp.child(".next/standalone/server.js")
            .write_str("server")
            .unwrap();
        temp.child(".next/standalone/real-pkg/index.js")
            .write_str("pkg")
            .unwrap();

        // Create a symlink inside standalone (simulating pnpm/bun linker)
        symlink(
            temp.join(".next/standalone/real-pkg/index.js"),
            temp.join(".next/standalone/linked-entry.js"),
        )
        .unwrap();

        // Create .next/server
        temp.child(".next/server/app.js").write_str("app").unwrap();

        let entries = vec![
            ".next/*.json".to_string(),
            ".next/standalone".to_string(),
            ".next/server".to_string(),
        ];
        let mut result = expand_outputs(temp.display().to_string(), entries).unwrap();
        result.sort();

        // Verify that the symlink is included in expanded outputs
        assert!(
            result.contains(&".next/standalone/linked-entry.js".to_string()),
            "Symlink should be in expanded outputs"
        );
    }

    #[test]
    #[cfg(unix)]
    fn should_handle_cache_put_and_restore_with_symlinks() {
        // Full reproduction of issue #34013 including the cache put and restore cycle
        use crate::native::cache::file_ops::_copy;
        use std::os::unix::fs::symlink;

        enable_logger();

        let workspace = TempDir::new().unwrap();
        let cache = TempDir::new().unwrap();

        // Create workspace structure simulating Next.js standalone build
        workspace
            .child("app/.next/build-manifest.json")
            .write_str("{}")
            .unwrap();
        workspace
            .child("app/.next/routes-manifest.json")
            .write_str("{}")
            .unwrap();
        workspace
            .child("app/.next/standalone/server.js")
            .write_str("server")
            .unwrap();
        workspace
            .child("app/.next/standalone/real-pkg/index.js")
            .write_str("pkg")
            .unwrap();

        // Create symlink (simulating pnpm/bun linker)
        symlink(
            workspace.join("app/.next/standalone/real-pkg/index.js"),
            workspace.join("app/.next/standalone/linked-entry.js"),
        )
        .unwrap();

        workspace
            .child("app/.next/server/app.js")
            .write_str("app")
            .unwrap();

        let outputs = vec![
            "app/.next/*.json".to_string(),
            "app/.next/standalone".to_string(),
            "app/.next/server".to_string(),
        ];

        // === SIMULATE CACHE PUT ===
        let cache_hash_dir = cache.child("hash123");
        cache_hash_dir.create_dir_all().unwrap();

        let expanded = _expand_outputs(workspace.path(), outputs.clone()).unwrap();

        // Copy each expanded output to cache (mimicking cache.rs put())
        for output in expanded.iter() {
            let src = workspace.join(output);
            if src.exists() {
                let dest = cache_hash_dir.join(output);
                let result = _copy(&src, &dest);
                assert!(
                    result.is_ok(),
                    "PUT: Failed to copy {}: {:?}",
                    output,
                    result.err()
                );
            }
        }

        // === SIMULATE CACHE RESTORE ===
        // (This is what copy_files_from_cache does)

        // Step 1: Expand outputs from cache directory
        let restore_expanded = _expand_outputs(cache_hash_dir.path(), outputs.clone()).unwrap();

        // Step 2: Remove expanded outputs from workspace
        let items_to_remove: Vec<_> = restore_expanded.iter().map(|p| workspace.join(p)).collect();
        fs_extra::remove_items(&items_to_remove).unwrap();

        // Step 3: Copy entire cache hash dir to workspace (this is where EEXIST occurs)
        let restore_result = _copy(cache_hash_dir.path(), workspace.path());
        assert!(
            restore_result.is_ok(),
            "RESTORE: Failed to copy from cache to workspace: {:?}",
            restore_result.err()
        );

        // Verify files were restored correctly
        assert!(workspace.child("app/.next/build-manifest.json").exists());
        assert!(workspace.child("app/.next/standalone/server.js").exists());
        assert!(
            workspace
                .child("app/.next/standalone/linked-entry.js")
                .exists()
        );
        assert!(workspace.child("app/.next/server/app.js").exists());
    }

    #[test]
    fn should_get_files_for_outputs_when_gitignore_hides_files() {
        let temp = TempDir::new().unwrap();
        temp.child("out/.gitignore").write_str("*").unwrap();
        temp.child("out/visible.txt").write_str("content").unwrap();

        let entries = vec!["out".to_string()];
        let mut result = get_files_for_outputs(temp.display().to_string(), entries).unwrap();
        result.sort();

        assert!(result.contains(&"out/visible.txt".to_string()));
        assert!(result.contains(&"out/.gitignore".to_string()));
    }

    #[test]
    #[ignore]
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    fn should_not_leak_threads() {
        use std::process::Command;
        use std::thread;

        fn get_thread_count() -> usize {
            let pid = std::process::id();
            let pid_str = pid.to_string();

            // Use ps command to get thread count (works on Linux and macOS)
            #[cfg(target_os = "linux")]
            let ps_args = vec!["-o", "nlwp=", "-p", &pid_str];

            #[cfg(target_os = "macos")]
            let ps_args = vec!["-M", "-p", &pid_str];

            if let Ok(output) = Command::new("ps").args(&ps_args).output() {
                if let Ok(output_str) = String::from_utf8(output.stdout) {
                    #[cfg(target_os = "linux")]
                    {
                        // On Linux, nlwp gives us the thread count directly
                        if let Ok(count) = output_str.trim().parse::<usize>() {
                            return count;
                        }
                    }

                    #[cfg(target_os = "macos")]
                    {
                        // On macOS, count lines (excluding header) to get thread count
                        let thread_count = output_str.lines().count().saturating_sub(1);
                        if thread_count > 0 {
                            return thread_count;
                        }
                    }
                }
            }

            // Fallback to available parallelism if ps command fails
            thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(1)
        }

        enable_logger();

        let initial_count = get_thread_count();

        // Run multiple operations to test for thread leaks
        for _ in 0..5 {
            let temp = setup_fs();
            let entries = vec![
                "packages/nx/src/native/*.node".to_string(),
                "multi/*.{js,map,ts}".to_string(),
                "test.txt".to_string(),
            ];

            // Test both functions
            let _result1 = expand_outputs(temp.display().to_string(), entries.clone());
            let _result2 = get_files_for_outputs(temp.display().to_string(), entries);

            drop(temp);
        }

        // Allow brief time for any cleanup
        thread::sleep(std::time::Duration::from_millis(100));

        let final_count = get_thread_count();

        // After fixing nx_walker, thread count should remain stable
        // Allow minimal variance for system threads
        assert_eq!(
            final_count, initial_count,
            "Thread count changed from {} to {}, indicating a thread leak",
            initial_count, final_count
        );
    }
}
