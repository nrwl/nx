use std::collections::HashMap;
use std::sync::Arc;

use anyhow::*;
use tracing::{trace, trace_span};

use super::once_cache::OnceCache;
use crate::native::glob::build_glob_set;
use crate::native::types::FileData;

/// Compute-once cache for project fileset hashes. Holds only the hash, so
/// retaining it for the TaskHasher lifetime stays O(projects), not O(files).
pub(crate) type ProjectFileSetCache = OnceCache<String>;

/// Compute-once cache for the matched file *indices* of a project fileset,
/// into that project's `project_file_map` vec. Persistable: 4 bytes/file and
/// references the immutable FileData snapshot, so it never goes stale (the
/// same guarantee `ProjectFileSetCache` relies on). Paths are expanded from it
/// per call and freed once handed to the input subscriber.
pub(crate) type ProjectFileIndicesCache = OnceCache<Vec<u32>>;

fn project_file_set_cache_key(project_name: &str, file_sets: &[String]) -> String {
    let mut sorted_file_sets: Vec<&str> = file_sets.iter().map(String::as_str).collect();
    sorted_file_sets.sort();

    format!(
        "{project_name}\0{}\0{}",
        sorted_file_sets.len(),
        sorted_file_sets.join("\0")
    )
}

/// Hashes project files without materializing the matched file list.
/// Token resolution ({projectRoot}, {projectName}) is handled upstream by the HashPlanner,
/// so file_sets are expected to contain already-resolved paths.
pub fn hash_project_files(
    project_name: &str,
    file_sets: &[String],
    project_file_map: &HashMap<String, Vec<FileData>>,
) -> Result<String> {
    let _span = trace_span!("hash_project_files", project_name).entered();
    let collected_files = collect_project_files(project_name, file_sets, project_file_map)?;
    trace!("collected_files: {:?}", collected_files.len());

    let mut hasher = xxhash_rust::xxh3::Xxh3::new();

    for file in collected_files {
        hasher.update(file.hash.as_bytes());
        hasher.update(file.file.as_bytes());
    }

    Ok(hasher.digest().to_string())
}

pub(crate) fn hash_project_files_cached(
    project_name: &str,
    file_sets: &[String],
    project_file_map: &HashMap<String, Vec<FileData>>,
    cache: &ProjectFileSetCache,
) -> Result<Arc<String>> {
    cache.get_or_try_init(project_file_set_cache_key(project_name, file_sets), || {
        hash_project_files(project_name, file_sets, project_file_map)
    })
}

/// The matched file paths of a project fileset, in project-file-map order
/// (the same order hashing folds them).
pub fn collect_project_file_paths(
    project_name: &str,
    file_sets: &[String],
    project_file_map: &HashMap<String, Vec<FileData>>,
) -> Result<Vec<String>> {
    Ok(
        collect_project_files(project_name, file_sets, project_file_map)?
            .into_iter()
            .map(|file| file.file.clone())
            .collect(),
    )
}

/// The matched file indices of a project fileset, into `project_file_map[project_name]`,
/// in the same project-file-map order `collect_project_file_paths` yields.
fn collect_project_file_indices(
    project_name: &str,
    file_sets: &[String],
    project_file_map: &HashMap<String, Vec<FileData>>,
) -> Result<Vec<u32>> {
    let glob_set = build_glob_set(file_sets)?;
    project_file_map.get(project_name).map_or_else(
        || Err(anyhow!("project {} not found", project_name)),
        |files| {
            Ok(files
                .iter()
                .enumerate()
                .filter(|(_, file)| glob_set.is_match(&file.file))
                .map(|(i, _)| i as u32)
                .collect())
        },
    )
}

fn collect_project_file_indices_cached(
    project_name: &str,
    file_sets: &[String],
    project_file_map: &HashMap<String, Vec<FileData>>,
    cache: &ProjectFileIndicesCache,
) -> Result<Arc<Vec<u32>>> {
    cache.get_or_try_init(project_file_set_cache_key(project_name, file_sets), || {
        collect_project_file_indices(project_name, file_sets, project_file_map)
    })
}

/// Expands the cached matched-file indices into owned paths. Only the compact
/// indices persist in `cache`; the returned paths are transient and freed by
/// the caller once handed to the input subscriber.
pub(crate) fn collect_project_file_paths_cached(
    project_name: &str,
    file_sets: &[String],
    project_file_map: &HashMap<String, Vec<FileData>>,
    cache: &ProjectFileIndicesCache,
) -> Result<Vec<String>> {
    let indices =
        collect_project_file_indices_cached(project_name, file_sets, project_file_map, cache)?;
    let files = project_file_map
        .get(project_name)
        .ok_or_else(|| anyhow!("project {} not found", project_name))?;
    Ok(indices
        .iter()
        .map(|&i| files[i as usize].file.clone())
        .collect())
}

/// base function that should be testable (to make sure that we're getting the proper files back)
pub fn collect_project_files<'a>(
    project_name: &str,
    file_sets: &[String],
    project_file_map: &'a HashMap<String, Vec<FileData>>,
) -> Result<Vec<&'a FileData>> {
    let now = std::time::Instant::now();
    let glob_set = build_glob_set(file_sets)?;
    trace!("build_glob_set for {:?}", now.elapsed());

    project_file_map.get(project_name).map_or_else(
        || Err(anyhow!("project {} not found", project_name)),
        |files| {
            trace!("files: {:?}", files.len());
            let now = std::time::Instant::now();
            let hashes = files
                .iter()
                .filter(|file| glob_set.is_match(&file.file))
                .collect::<Vec<_>>();
            trace!("hash_files for {}: {:?}", project_name, now.elapsed());
            Ok(hashes)
        },
    )
}
#[cfg(test)]
mod tests {
    use crate::native::hasher::hash;

    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_collect_files() {
        let proj_name = "test_project";
        // Tokens are pre-resolved by the HashPlanner before reaching these functions
        let file_sets = &[
            "!test/root/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)".to_string(),
            "test/root/**/*".to_string(),
        ];
        let mut file_map = HashMap::new();
        let tsfile_1 = FileData {
            file: "test/root/test1.ts".into(),
            hash: Default::default(),
        };
        let testfile_1 = FileData {
            file: "test/root/test.spec.ts".into(),
            hash: Default::default(),
        };
        let tsfile_2 = FileData {
            file: "test/root/src/module/test3.ts".into(),
            hash: Default::default(),
        };
        let testfile_2 = FileData {
            file: "test/root/test.spec.tsx.snap".into(),
            hash: Default::default(),
        };
        file_map.insert(
            String::from(proj_name),
            vec![
                tsfile_1.clone(),
                testfile_1.clone(),
                tsfile_2.clone(),
                testfile_2.clone(),
            ],
        );

        let result = collect_project_files(proj_name, file_sets, &file_map).unwrap();

        assert_eq!(result, vec![&tsfile_1, &tsfile_2]);

        let result =
            collect_project_files(proj_name, &["!test/root/**/*.spec.ts".into()], &file_map)
                .unwrap();
        assert_eq!(
            result,
            vec![
                &tsfile_1,
                &tsfile_2,
                /* testfile_2 is included because it ends with spectsx.snap */ &testfile_2
            ]
        );
    }

    #[test]
    fn should_hash_deterministically() {
        let proj_name = "test_project";
        let file_sets = &[
            "!test/root/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)".to_string(),
            "test/root/**/*".to_string(),
        ];
        let mut file_map = HashMap::new();
        let file_data1 = FileData {
            file: "test/root/test1.ts".into(),
            hash: "file_data1".into(),
        };
        let file_data2 = FileData {
            file: "test/root/test.spec.ts".into(),
            hash: "file_data2".into(),
        };
        let file_data3 = FileData {
            file: "test/root/test3.ts".into(),
            hash: "file_data3".into(),
        };
        let file_data4 = FileData {
            file: "test/root/test.spec.tsx.snap".into(),
            hash: "file_data4".into(),
        };
        file_map.insert(
            String::from(proj_name),
            vec![
                file_data1.clone(),
                file_data2.clone(),
                file_data3.clone(),
                file_data4.clone(),
            ],
        );
        let result = hash_project_files(proj_name, file_sets, &file_map).unwrap();
        assert_eq!(
            result,
            hash(
                &[
                    file_data1.hash.as_bytes(),
                    file_data1.file.as_bytes(),
                    file_data3.hash.as_bytes(),
                    file_data3.file.as_bytes()
                ]
                .concat()
            )
        );
    }

    #[test]
    fn should_hash_projects_with_root_as_dot() {
        let proj_name = "test_project";
        // Having "." as the project root means a standalone project.
        // The HashPlanner strips "{projectRoot}/" entirely for these projects,
        // so file_sets arrive here with bare glob patterns.
        let file_sets = &[
            "!**/?(*.)+(spec|test).[jt]s?(x)?(.snap)".to_string(),
            "**/*".to_string(),
        ];
        let mut file_map = HashMap::new();
        let file_data1 = FileData {
            file: "test/root/test1.ts".into(),
            hash: "file_data1".into(),
        };
        let file_data2 = FileData {
            file: "test/root/test.spec.ts".into(),
            hash: "file_data2".into(),
        };
        let file_data3 = FileData {
            file: "test/root/test3.ts".into(),
            hash: "file_data3".into(),
        };
        let file_data4 = FileData {
            file: "test/root/test.spec.tsx.snap".into(),
            hash: "file_data4".into(),
        };
        file_map.insert(
            String::from(proj_name),
            vec![
                file_data1.clone(),
                file_data2.clone(),
                file_data3.clone(),
                file_data4.clone(),
            ],
        );
        let result = hash_project_files(proj_name, file_sets, &file_map).unwrap();
        assert_eq!(
            result,
            hash(
                &[
                    file_data1.hash.as_bytes(),
                    file_data1.file.as_bytes(),
                    file_data3.hash.as_bytes(),
                    file_data3.file.as_bytes(),
                ]
                .concat()
            )
        );
    }

    #[test]
    fn should_collect_file_paths_in_file_map_order() {
        let proj_name = "test_project";
        let file_sets = &["!test/root/**/*.spec.ts".to_string()];
        let mut file_map = HashMap::new();
        file_map.insert(
            String::from(proj_name),
            vec![
                FileData {
                    file: "test/root/test1.ts".into(),
                    hash: "file_data1".into(),
                },
                FileData {
                    file: "test/root/test.spec.ts".into(),
                    hash: "file_data2".into(),
                },
                FileData {
                    file: "test/root/test3.ts".into(),
                    hash: "file_data3".into(),
                },
            ],
        );

        let paths = collect_project_file_paths(proj_name, file_sets, &file_map).unwrap();
        assert_eq!(paths, vec!["test/root/test1.ts", "test/root/test3.ts"]);
    }

    #[test]
    fn indices_expand_to_the_same_paths_as_direct_collection() {
        let proj_name = "test_project";
        let file_sets = &["!test/root/**/*.spec.ts".to_string()];
        let mut file_map = HashMap::new();
        file_map.insert(
            String::from(proj_name),
            vec![
                FileData {
                    file: "test/root/test1.ts".into(),
                    hash: "file_data1".into(),
                },
                FileData {
                    file: "test/root/test.spec.ts".into(),
                    hash: "file_data2".into(),
                },
                FileData {
                    file: "test/root/test3.ts".into(),
                    hash: "file_data3".into(),
                },
            ],
        );

        let indices = collect_project_file_indices(proj_name, file_sets, &file_map).unwrap();
        // Positions of the non-spec files within the project vec.
        assert_eq!(indices, vec![0, 2]);

        let files = &file_map[proj_name];
        let expanded: Vec<String> = indices
            .iter()
            .map(|&i| files[i as usize].file.clone())
            .collect();
        let direct = collect_project_file_paths(proj_name, file_sets, &file_map).unwrap();
        assert_eq!(expanded, direct);
    }

    #[test]
    fn should_cache_by_project_and_fileset_combo_regardless_of_order() {
        let proj_name = "test_project";
        let first_file_sets = &[
            "test/root/**/*".to_string(),
            "!test/root/**/*.spec.ts".to_string(),
        ];
        let second_file_sets = &[
            "!test/root/**/*.spec.ts".to_string(),
            "test/root/**/*".to_string(),
        ];
        let mut file_map = HashMap::new();
        file_map.insert(
            String::from(proj_name),
            vec![
                FileData {
                    file: "test/root/test1.ts".into(),
                    hash: "file_data1".into(),
                },
                FileData {
                    file: "test/root/test.spec.ts".into(),
                    hash: "file_data2".into(),
                },
            ],
        );

        let cache = ProjectFileSetCache::new();
        let first =
            hash_project_files_cached(proj_name, first_file_sets, &file_map, &cache).unwrap();
        let second =
            hash_project_files_cached(proj_name, second_file_sets, &file_map, &cache).unwrap();

        assert_eq!(cache.len(), 1);
        assert!(Arc::ptr_eq(&first, &second));

        let indices_cache = ProjectFileIndicesCache::new();
        let first = collect_project_file_indices_cached(
            proj_name,
            first_file_sets,
            &file_map,
            &indices_cache,
        )
        .unwrap();
        let second = collect_project_file_indices_cached(
            proj_name,
            second_file_sets,
            &file_map,
            &indices_cache,
        )
        .unwrap();

        assert_eq!(indices_cache.len(), 1);
        assert!(Arc::ptr_eq(&first, &second));

        // Paths expand identically regardless of which fileset ordering asks for them.
        let paths_first = collect_project_file_paths_cached(
            proj_name,
            first_file_sets,
            &file_map,
            &indices_cache,
        )
        .unwrap();
        let paths_second = collect_project_file_paths_cached(
            proj_name,
            second_file_sets,
            &file_map,
            &indices_cache,
        )
        .unwrap();
        assert_eq!(paths_first, paths_second);
    }
}
