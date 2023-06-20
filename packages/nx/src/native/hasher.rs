use crate::native::types::FileData;
use crate::native::utils::glob::build_glob_set;
use crate::native::utils::path::Normalize;
use crate::native::walker::nx_walker;
use rayon::prelude::*;
use std::collections::HashMap;
use xxhash_rust::xxh3;

#[napi]
pub fn hash_array(input: Vec<String>) -> String {
    let joined = input.join(",");
    let content = joined.as_bytes();
    xxh3::xxh3_64(content).to_string()
}

#[napi]
pub fn hash_file(file: String) -> Option<FileData> {
    let Ok(content) = std::fs::read(&file) else {
        return None;
    };

    let hash = xxh3::xxh3_64(&content).to_string();

    Some(FileData { hash, file })
}

#[napi]
pub fn hash_files(workspace_root: String) -> HashMap<String, String> {
    nx_walker(workspace_root, |rec| {
        let mut collection: HashMap<String, String> = HashMap::new();
        for (path, content) in rec {
            collection.insert(
                path.to_normalized_string(),
                xxh3::xxh3_64(&content).to_string(),
            );
        }
        collection
    })
}

#[napi]
fn hash_files_matching_globs(
    directory: String,
    glob_patterns: Vec<String>,
) -> anyhow::Result<Option<String>> {
    let glob_set = build_glob_set(glob_patterns)?;

    let mut hashes = nx_walker(directory, move |receiver| {
        let mut collection: Vec<FileData> = Vec::new();
        for (path, content) in receiver {
            if glob_set.is_match(&path) {
                collection.push(FileData {
                    file: path.to_normalized_string(),
                    hash: xxh3::xxh3_64(&content).to_string(),
                });
            }
        }
        collection
    });

    if hashes.is_empty() {
        return Ok(None);
    }

    // Sort the file data so that its in deterministically ordered by file path
    hashes.par_sort();

    let sorted_file_hashes: Vec<String> =
        hashes.into_iter().map(|file_data| file_data.hash).collect();
    Ok(Some(hash_array(sorted_file_hashes)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::prelude::*;
    use assert_fs::TempDir;

    ///
    /// Setup a temporary directory to do testing in
    ///
    fn setup_fs() -> TempDir {
        let temp = TempDir::new().unwrap();
        temp.child("test.txt").write_str("content").unwrap();
        temp.child("foo.txt").write_str("content1").unwrap();
        temp.child("bar.txt").write_str("content2").unwrap();
        temp.child("baz")
            .child("qux.txt")
            .write_str("content@qux")
            .unwrap();
        temp.child("node_modules")
            .child("node-module-dep")
            .write_str("content")
            .unwrap();
        temp
    }

    #[test]
    fn it_hashes_a_file() {
        // handle non existent files
        let content = hash_file("".into());
        assert!(content.is_none());

        let temp_dir = setup_fs();

        let test_file_path = temp_dir.display().to_string() + "/test.txt";
        let content = hash_file(test_file_path);

        assert_eq!(content.unwrap().hash, "6193209363630369380");
    }

    #[test]
    fn it_hashes_files_matching_globs() -> anyhow::Result<()> {
        // handle empty workspaces
        let content =
            hash_files_matching_globs("/does/not/exist".into(), Vec::from([String::from("**/*")]))?;
        assert!(content.is_none());

        let temp_dir = setup_fs();

        let content = hash_files_matching_globs(
            temp_dir.display().to_string(),
            Vec::from([String::from("fo*.txt")]),
        )?;
        // println!("{:?}", content);
        assert_eq!(content.unwrap(), String::from("12742692716897613184"),);

        Ok(())
    }
}
