#![allow(unused)]

use anyhow::anyhow;
use crossbeam_channel::unbounded;
use globset::{Glob, GlobSetBuilder};
use ignore::WalkBuilder;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::path::Path;
use std::thread::{self, available_parallelism};
use xxhash_rust::xxh3;

type FileHashes = HashMap<String, String>;

#[napi(object)]
pub struct FileData {
    pub file: String,
    pub hash: String,
}

impl Eq for FileData {}

impl PartialEq<Self> for FileData {
    fn eq(&self, other: &Self) -> bool {
        self.file.eq(&other.file)
    }
}

impl PartialOrd<Self> for FileData {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        self.file.partial_cmp(&other.file)
    }
}

impl Ord for FileData {
    fn cmp(&self, other: &Self) -> Ordering {
        self.file.cmp(&other.file)
    }
}

#[napi]
fn hash_array(input: Vec<String>) -> String {
    let joined = input.join(",");
    let content = joined.as_bytes();
    xxh3::xxh3_64(content).to_string()
}

#[napi]
fn hash_file(file: String) -> Option<FileData> {
    let Ok(content) = std::fs::read(&file) else {
        return None;
    };

    let hash = xxh3::xxh3_64(&content).to_string();

    Some(FileData { hash, file })
}

#[napi]
fn hash_files(workspace_root: String) -> HashMap<String, String> {
    let workspace_root = Path::new(&workspace_root);
    let nx_ignore = workspace_root.join(".nxignore");
    let git_folder = workspace_root.join(".git");
    let node_folder = workspace_root.join("node_modules");

    let mut walker = WalkBuilder::new(workspace_root);
    walker.hidden(false);
    walker.add_custom_ignore_filename(&nx_ignore);

    // We should make sure to always ignore node_modules and the .git folder
    walker.filter_entry(move |entry| {
        !(entry.path().starts_with(&git_folder) || entry.path().starts_with(&node_folder))
    });

    let (sender, receiver) = unbounded::<(String, Vec<u8>)>();

    let receiver_thread = thread::spawn(move || {
        let mut collection: HashMap<String, String> = HashMap::new();
        for (path, content) in receiver {
            collection.insert(path, xxh3::xxh3_64(&content).to_string());
        }
        collection
    });

    let cpus = available_parallelism().map_or(2, |n| n.get()) - 1;

    walker.threads(cpus).build_parallel().run(|| {
        let tx = sender.clone();
        Box::new(move |entry| {
            use ignore::WalkState::*;

            #[rustfmt::skip]
                let Ok(dir_entry) = entry else {
                return Continue;
            };

            let Ok(content) = std::fs::read(dir_entry.path()) else {
                return Continue;
            };

            let Ok(file_path) = dir_entry.path().strip_prefix(workspace_root) else {
                return Continue;
            };

            let Some(file_path) = file_path.to_str() else {
                return Continue;
            };

            // convert back-slashes in Windows paths, since the js expects only forward-slash path separators
            #[cfg(target_os = "windows")]
            let file_path = file_path.replace('\\', "/");

            tx.send((file_path.to_string(), content)).ok();

            Continue
        })
    });

    drop(sender);
    receiver_thread.join().unwrap()
}

#[napi]
fn hash_files_matching_globs(
    directory: String,
    glob_patterns: Vec<String>,
) -> anyhow::Result<Option<String>> {
    let mut globset_builder = GlobSetBuilder::new();

    for pattern in glob_patterns {
        globset_builder.add(Glob::new(&pattern).map_err(|_| anyhow!("Invalid Glob {pattern}"))?);
    }
    let globset = globset_builder
        .build()
        .map_err(|_| anyhow!("Error building globset builder"))?;

    let cpus = available_parallelism().map_or(2, |n| n.get()) - 1;

    let mut walker = WalkBuilder::new(&directory);
    walker.hidden(false);

    let (sender, receiver) = unbounded::<(String, Vec<u8>)>();

    let receiver_thread = thread::spawn(move || {
        let mut collection: Vec<FileData> = Vec::new();
        for (path, content) in receiver {
            if globset.is_match(&path) {
                collection.push(FileData {
                    file: path,
                    hash: xxh3::xxh3_64(&content).to_string(),
                });
            }
        }
        collection
    });

    walker.threads(cpus).build_parallel().run(|| {
        let tx = sender.clone();
        let directory = directory.clone();
        Box::new(move |entry| {
            use ignore::WalkState::*;

            #[rustfmt::skip]
                let Ok(dir_entry) = entry else {
                return Continue;
            };

            let Ok(content) = std::fs::read(dir_entry.path()) else {
                return Continue;
            };

            let Ok(file_path) = dir_entry.path().strip_prefix(&directory) else {
                return Continue;
            };

            let Some(file_path) = file_path.to_str() else {
                return Continue;
            };

            // convert back-slashes in Windows paths, since the js expects only forward-slash path separators
            #[cfg(target_os = "windows")]
            let file_path = file_path.replace('\\', "/");

            tx.send((file_path.to_string(), content)).ok();

            Continue
        })
    });
    drop(sender);

    let mut hashes = receiver_thread.join().unwrap();
    if hashes.is_empty() {
        return Ok(None);
    }

    // Sort the file data so that its in deterministically ordered by file path
    hashes.sort();

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
    fn it_hashes_a_directory() {
        // handle empty workspaces
        let content = hash_files("/does/not/exist".into());
        assert!(content.is_empty());

        let temp_dir = setup_fs();

        let content = hash_files(temp_dir.display().to_string());
        // println!("{:?}", content);
        assert_eq!(
            content,
            HashMap::from([
                ("baz/qux.txt".into(), "8039819779822413286".into()),
                ("foo.txt".into(), "8455857314690418558".into()),
                ("test.txt".into(), "6193209363630369380".into()),
                ("bar.txt".into(), "1707056588989152788".into()),
            ])
        );
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

    #[test]
    fn handles_nx_ignore() {
        let temp_dir = setup_fs();

        temp_dir
            .child("nested")
            .child("child.txt")
            .write_str("data");
        temp_dir
            .child("nested")
            .child("child-two")
            .child("grand_child.txt")
            .write_str("data");

        // add nxignore file with baz/
        temp_dir
            .child(".nxignore")
            .write_str(
                r"baz/
nested/child.txt
nested/child-two/
",
            )
            .unwrap();

        let content = hash_files(temp_dir.display().to_string());
        let mut file_names = content.iter().map(|c| c.0).collect::<Vec<_>>();
        file_names.sort();
        assert_eq!(
            file_names,
            vec!(".nxignore", "bar.txt", "foo.txt", "test.txt")
        );
    }
}
