use std::path::Path;
use tracing::trace;
use xxhash_rust::xxh3;

/// Hash raw bytes using xxHash
pub fn hash(content: &[u8]) -> String {
    xxh3::xxh3_64(content).to_string()
}

/// Hash an array of strings by joining them with commas and hashing the result
pub fn hash_array(input: Vec<String>) -> String {
    let joined = input.join(",");
    let content = joined.as_bytes();
    hash(content)
}

/// Hash a file's contents given its path as a string
pub fn hash_file(file: String) -> Option<String> {
    hash_file_path(file)
}

/// Hash a file's contents given its path
pub fn hash_file_path<P: AsRef<Path>>(path: P) -> Option<String> {
    let path = path.as_ref();
    trace!("Reading {:?} to hash", path);
    let Ok(content) = std::fs::read(path) else {
        trace!("Failed to read file: {:?}", path);
        return None;
    };
    trace!("Hashing {:?}", path);
    let hash = hash(&content);
    trace!("Hashed file {:?} - {:?}", path, hash);

    Some(hash)
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
    fn test_hash() {
        assert_eq!(hash(b"hello world"), "15296390279056496779");
    }

    #[test]
    fn test_hash_array() {
        let input = vec!["hello".to_string(), "world".to_string()];
        assert_eq!(hash_array(input), "2040998404227468622");
    }

    #[test]
    fn test_hash_file() {
        // Test non-existent file
        assert!(hash_file("".into()).is_none());

        // Test existing file
        let temp_dir = setup_fs();
        let test_file_path = temp_dir.display().to_string() + "/test.txt";
        let content = hash_file(test_file_path);
        assert_eq!(content.unwrap(), "6193209363630369380");
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
