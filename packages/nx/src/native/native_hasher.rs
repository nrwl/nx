#![allow(unused)]

use crossbeam_channel::unbounded;
use ignore::WalkBuilder;
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
    let mut walker = WalkBuilder::new(&workspace_root);
    let workspace_root = Path::new(&workspace_root);
    walker.add_ignore(workspace_root.join(".nxignore"));

    let git_folder = workspace_root.join(".git");
    // We should make sure to always ignore node_modules
    let node_folder = workspace_root.join("node_modules");
    walker.filter_entry(move |entry| {
        !(entry.path().starts_with(&git_folder) || entry.path().starts_with(&node_folder))
    });

    // dot files are hidden by default. We want to make sure we include those here
    walker.hidden(false);

    let (sender, reciever) = unbounded::<(String, Vec<u8>)>();

    let receiver_thread = thread::spawn(move || {
        let mut collection: HashMap<String, String> = HashMap::new();
        for (path, content) in reciever {
            collection.insert(path, xxh3::xxh3_64(&content).to_string());
        }
        collection
    });

    let cpus = available_parallelism().map_or(2, |n| n.get()) - 1;

    walker.threads(cpus).build_parallel().run(|| {
        let tx = sender.clone();
        let workspace_root = workspace_root.clone();
        Box::new(move |entry| {
            use ignore::WalkState::*;

            #[rustfmt::skip]
            let Ok(dir_entry) = entry else {
              return Continue;
            };

            let Ok(content) = std::fs::read(dir_entry.path()) else {
                return Continue;
            };

            let Ok(file_path) = dir_entry.path().strip_prefix(&workspace_root) else {
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
    fn handles_nx_ignore() {
        let temp_dir = setup_fs();

        // add nxignore file with baz/
        temp_dir.child(".nxignore").write_str("baz/").unwrap();

        let content = hash_files(temp_dir.display().to_string());
        assert_eq!(
            content,
            HashMap::from([
                ("foo.txt".into(), "8455857314690418558".into()),
                ("test.txt".into(), "6193209363630369380".into()),
                ("bar.txt".into(), "1707056588989152788".into()),
                (".nxignore".into(), "5786346484289078730".into())
            ])
        );
    }
}
