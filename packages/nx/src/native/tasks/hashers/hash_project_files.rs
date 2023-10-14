use std::collections::HashMap;

use crate::native::hasher::hash;
use anyhow::*;
use rayon::prelude::*;
use tracing::trace;

use crate::native::glob::build_glob_set;
use crate::native::types::FileData;

pub fn hash_project_files(
    project_name: &str,
    project_root: &str,
    file_sets: &str,
    project_file_map: &HashMap<String, Vec<FileData>>,
) -> Result<String> {
    let collected_files = collect_files(project_name, project_root, file_sets, project_file_map)?;
    Ok(hash(
        &collected_files
            .par_iter()
            .map(|file| file.hash.as_bytes())
            .collect::<Vec<_>>()
            .concat(),
    ))
}

/// base function that should be testable (to make sure that we're getting the proper files back)
fn collect_files<'a>(
    project_name: &str,
    project_root: &str,
    file_sets: &str,
    project_file_map: &'a HashMap<String, Vec<FileData>>,
) -> Result<Vec<&'a FileData>> {
    let globs = file_sets
        .split(',')
        .map(|f| f.replace("{projectRoot}", project_root))
        .collect::<Vec<_>>();
    let now = std::time::Instant::now();
    let glob_set = build_glob_set(&globs)?;
    trace!("build_glob_set for {}: {:?}", project_name, now.elapsed());

    project_file_map.get(project_name).map_or_else(
        || Err(anyhow!("project {} not found", project_name)),
        |files| {
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
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_collect_files() {
        let proj_name = "test_project";
        let proj_root = "test/root";
        let file_sets = "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap),{projectRoot}/**/*";
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

        let result = collect_files(proj_name, proj_root, file_sets, &file_map).unwrap();

        assert_eq!(result, vec![&tsfile_1, &tsfile_2]);
    }

    #[test]
    fn should_hash_deterministically() {
        let proj_name = "test_project";
        let proj_root = "test/root";
        let file_sets = "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap),{projectRoot}/**/*";
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
            hash(&[file_data1.hash.as_bytes(), file_data3.hash.as_bytes()].concat())
        );
    }
}
