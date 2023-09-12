use crate::native::utils::path::Normalize;
use crate::native::walker::nx_walker;
use std::collections::HashMap;
use xxhash_rust::xxh3;

#[napi]
pub fn hash_array(input: Vec<String>) -> String {
    let joined = input.join(",");
    let content = joined.as_bytes();
    xxh3::xxh3_64(content).to_string()
}

#[napi]
pub fn hash_file(file: String) -> Option<String> {
    let Ok(content) = std::fs::read(file) else {
        return None;
    };

    Some(xxh3::xxh3_64(&content).to_string())
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

        assert_eq!(content.unwrap(), "6193209363630369380");
    }
}
