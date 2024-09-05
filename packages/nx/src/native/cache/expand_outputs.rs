use hashbrown::HashMap;
use std::path::{Path, PathBuf};
use tracing::trace;

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

    let has_glob_pattern = entries.iter().any(|entry| contains_glob_pattern(entry));

    if !has_glob_pattern {
        trace!("No glob patterns found, checking if entries exist");
        let existing_directories = entries
            .into_iter()
            .filter(|entry| {
                let path = directory.join(entry);
                path.exists()
            })
            .collect();
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

    let glob_set = build_glob_set(&regular_globs)?;
    let found_paths = nx_walker_sync(directory, Some(&negated_globs))
        .filter_map(|path| {
            if glob_set.is_match(&path) {
                Some(path.to_normalized_string())
            } else {
                None
            }
        })
        .collect();

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
    use assert_fs::prelude::*;
    use assert_fs::TempDir;
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
}
