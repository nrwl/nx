use std::path::PathBuf;

use crate::native::utils::glob::build_glob_set;
use crate::native::utils::path::Normalize;
use crate::native::walker::nx_walker_sync;

#[napi]
/// Expands the given entries into a list of existing files.
/// First checks if the entry exists, if not, it will glob the working directory to find the file.
pub fn expand_outputs(directory: String, entries: Vec<String>) -> anyhow::Result<Vec<String>> {
    let directory: PathBuf = directory.into();

    let (existing_paths, not_found): (Vec<_>, Vec<_>) = entries.into_iter().partition(|entry| {
        let path = directory.join(entry);
        path.exists()
    });

    if not_found.is_empty() {
        return Ok(existing_paths);
    }

    let glob_set = build_glob_set(not_found)?;
    let found_paths = nx_walker_sync(directory)
        .filter_map(|path| {
            if glob_set.is_match(&path) {
                Some(path.to_normalized_string())
            } else {
                None
            }
        })
        .chain(existing_paths);

    Ok(found_paths.collect())
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
}
