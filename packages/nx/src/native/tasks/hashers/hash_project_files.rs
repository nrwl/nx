use std::collections::{HashMap, HashSet};

use anyhow::*;
use tracing::{trace, trace_span};

use crate::native::glob::build_glob_set;
use crate::native::hasher::hash_file_path;
use crate::native::types::FileData;

pub fn hash_project_files(
    project_name: &str,
    project_root: &str,
    file_sets: &[String],
    project_file_map: &HashMap<String, Vec<FileData>>,
) -> Result<String> {
    let _span = trace_span!("hash_project_files", project_name).entered();
    let collected_files =
        collect_project_files(project_name, project_root, file_sets, project_file_map)?;
    trace!("collected_files: {:?}", collected_files.len());

    // Hash files from the project file map
    let mut hasher = xxhash_rust::xxh3::Xxh3::new();
    let mut hashed_files: HashSet<String> = HashSet::new();
    for file in collected_files {
        hasher.update(file.hash.as_bytes());
        hasher.update(file.file.as_bytes());
        hashed_files.insert(file.file.clone());
    }

    // Check for git-ignored files that match the input patterns
    // These files won't be in project_file_map but should still be hashed
    hash_missing_files(&mut hasher, &mut hashed_files, project_root, file_sets)?;

    Ok(hasher.digest().to_string())
}

/// Hashes files that exist on the filesystem but are not in the file map (e.g., git-ignored files)
fn hash_missing_files(
    hasher: &mut xxhash_rust::xxh3::Xxh3,
    hashed_files: &mut HashSet<String>,
    project_root: &str,
    file_sets: &[String],
) -> Result<()> {
    use crate::native::walker::nx_walker_sync;
    use std::path::Path;

    let globs = file_sets
        .iter()
        .map(|f| {
            if project_root == "." {
                f.replace("{projectRoot}/", "")
            } else {
                f.replace("{projectRoot}", project_root)
            }
        })
        .collect::<Vec<_>>();

    let glob_set = build_glob_set(&globs)?;

    // Walk the project directory to find files that match the patterns
    // but weren't in the file map (because they were git-ignored)
    let project_path = if project_root == "." {
        Path::new(".")
    } else {
        Path::new(project_root)
    };

    for relative_file_path in nx_walker_sync(project_path, None) {
        // Build the full path for matching and hashing
        let full_path = if project_root == "." {
            relative_file_path.to_string_lossy().to_string()
        } else {
            format!("{}/{}", project_root, relative_file_path.to_string_lossy())
        };

        // Skip if we've already hashed this file
        if hashed_files.contains(&full_path) {
            continue;
        }

        // Check if the file matches the glob patterns
        if !glob_set.is_match(&full_path) {
            continue;
        }

        // Hash this git-ignored file
        let absolute_path = project_path.join(&relative_file_path);
        if let Some(hash) = hash_file_path(&absolute_path) {
            trace!("Hashing git-ignored file: {}", full_path);
            hasher.update(hash.as_bytes());
            hasher.update(full_path.as_bytes());
            hashed_files.insert(full_path);
        }
    }

    Ok(())
}

/// base function that should be testable (to make sure that we're getting the proper files back)
pub fn collect_project_files<'a>(
    project_name: &str,
    project_root: &str,
    file_sets: &[String],
    project_file_map: &'a HashMap<String, Vec<FileData>>,
) -> Result<Vec<&'a FileData>> {
    let globs = file_sets
        .iter()
        .map(|f| {
            if project_root == "." {
                f.replace("{projectRoot}/", "")
            } else {
                f.replace("{projectRoot}", project_root)
            }
        })
        .collect::<Vec<_>>();
    let now = std::time::Instant::now();
    let glob_set = build_glob_set(&globs)?;
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
        let proj_root = "test/root";
        let file_sets = &[
            "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)".to_string(),
            "{projectRoot}/**/*".to_string(),
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

        let result = collect_project_files(proj_name, proj_root, file_sets, &file_map).unwrap();

        assert_eq!(result, vec![&tsfile_1, &tsfile_2]);

        let result = collect_project_files(
            proj_name,
            proj_root,
            &["!{projectRoot}/**/*.spec.ts".into()],
            &file_map,
        )
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
        let proj_root = "test/root";
        let file_sets = &[
            "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)".to_string(),
            "{projectRoot}/**/*".to_string(),
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
        let hash_result = hash_project_files(proj_name, proj_root, file_sets, &file_map).unwrap();
        assert_eq!(
            hash_result,
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
        // having "." as the project root means that this would be a standalone project
        let proj_root = ".";
        let file_sets = &[
            "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)".to_string(),
            "{projectRoot}/**/*".to_string(),
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
        let hash_result = hash_project_files(proj_name, proj_root, file_sets, &file_map).unwrap();
        assert_eq!(
            hash_result,
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
    fn should_hash_git_ignored_files_when_explicitly_specified() {
        use assert_fs::TempDir;
        use assert_fs::prelude::*;
        use std::env;

        let temp = TempDir::new().unwrap();
        let proj_name = "test_project";
        let proj_root = temp.path().to_str().unwrap();

        // Create a project directory structure
        temp.child("file1.ts").write_str("content1").unwrap();
        temp.child(".env").write_str("SECRET=value").unwrap();

        // Create a .gitignore file that ignores .env
        temp.child(".gitignore").write_str(".env\n").unwrap();

        // Only file1.ts should be in the file map (since .env is git-ignored)
        let mut file_map = HashMap::new();
        let file_data1 = FileData {
            file: format!("{}/file1.ts", proj_root),
            hash: hash(&b"content1"[..]),
        };
        file_map.insert(
            String::from(proj_name),
            vec![file_data1.clone()],
        );

        // File sets explicitly include the git-ignored .env file
        let file_sets = &[
            format!("{}/.env", proj_root),
            format!("{}/**/*.ts", proj_root),
        ];

        // Change to the temp directory for the test
        let original_dir = env::current_dir().unwrap();
        env::set_current_dir(&temp).unwrap();

        // Hash without git-ignored files
        let hash_without_gitignored = hash_project_files(proj_name, proj_root, &[format!("{}/**/*.ts", proj_root)], &file_map).unwrap();

        // Hash with git-ignored files
        let hash_with_gitignored = hash_project_files(proj_name, proj_root, file_sets, &file_map).unwrap();

        // Restore the original directory
        env::set_current_dir(original_dir).unwrap();

        // The two hashes should be different because .env should be included in the second hash
        assert_ne!(hash_without_gitignored, hash_with_gitignored, "Hash should change when git-ignored .env file is explicitly specified as an input");
    }
}
