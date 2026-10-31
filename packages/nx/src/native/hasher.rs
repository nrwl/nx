use std::path::Path;

use tracing::trace;
use xxhash_rust::xxh3;

pub fn hash(content: &[u8]) -> String {
    xxh3::xxh3_64(content).to_string()
}

#[napi]
pub fn hash_array(input: Vec<Option<String>>) -> String {
    let joined = input
        .iter()
        .filter_map(|s| {
            if s.is_none() {
                trace!("Encountered None value in hash_array input: {:?}", input);
            }
            s.as_deref()
        })
        .collect::<Vec<_>>()
        .join(",");
    let content = joined.as_bytes();
    hash(content)
}

#[napi]
pub fn hash_file(file: String) -> Option<String> {
    hash_file_path(file)
}

#[inline]
pub fn hash_file_path<P: AsRef<Path>>(path: P) -> Option<String> {
    let path = path.as_ref();
    trace!("Reading {:?} to hash", path);
    let Ok(content) = std::fs::read(path) else {
        trace!("Failed to read file: {:?}", path);
        return None;
    };
    trace!("Hashing {:?}", path);
    let hash = hash_file_contents(path, &content);
    trace!("Hashed file {:?} - {:?}", path, hash);

    Some(hash)
}

fn hash_file_contents(path: &Path, content: &[u8]) -> String {
    if is_executable(path) {
        // `chmod` does not change the bytes. The extra byte keeps an
        // executable file from sharing the content-only hash.
        let mut hasher = xxh3::Xxh3::new();
        hasher.update(content);
        hasher.update(&[1]);
        return hasher.digest().to_string();
    }
    hash(content)
}

/// Any execute bit, the same test git uses for `100755`. Always false off unix.
fn is_executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::metadata(path).is_ok_and(|meta| meta.permissions().mode() & 0o111 != 0)
    }
    #[cfg(not(unix))]
    {
        let _ = path;
        false
    }
}

#[cfg(test)]
mod tests {
    use crate::native::hasher::{hash_array, hash_file};
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

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

    #[cfg(unix)]
    #[test]
    fn the_executable_bit_changes_the_file_hash() {
        use std::os::unix::fs::PermissionsExt;

        use crate::native::hasher::hash;

        let temp = TempDir::new().unwrap();
        let file = temp.child("tool.sh");
        let bytes = "#!/bin/sh\n";
        file.write_str(bytes).unwrap();
        let path = file.path();

        let mut perms = std::fs::metadata(path).unwrap().permissions();
        perms.set_mode(perms.mode() & !0o111);
        std::fs::set_permissions(path, perms.clone()).unwrap();
        let plain = hash_file(path.display().to_string()).unwrap();
        assert_eq!(plain, hash(bytes.as_bytes()));

        perms.set_mode(perms.mode() | 0o111);
        std::fs::set_permissions(path, perms.clone()).unwrap();
        let executable = hash_file(path.display().to_string()).unwrap();
        assert_ne!(plain, executable);

        perms.set_mode(perms.mode() & !0o111);
        std::fs::set_permissions(path, perms).unwrap();
        assert_eq!(hash_file(path.display().to_string()).unwrap(), plain);
    }

    #[test]
    fn it_hashes_an_array() {
        // Resilient to None values (e.g. null values passed from the JS side)
        let content = hash_array(vec![Some("foo".to_string()), None, Some("bar".to_string())]);
        assert_eq!(content, "10292076446133652019");
    }
}
