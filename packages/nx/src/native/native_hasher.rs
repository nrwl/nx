#![allow(unused)]

use crossbeam_channel::unbounded;
use ignore::WalkBuilder;
use std::collections::HashMap;
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
    let workspace_root = workspace_root + "/";
    walker.add_ignore(workspace_root.clone() + ".nxignore");

    let git_folder = workspace_root.clone() + ".git";
    // We should make sure to always ignore node_modules
    let node_folder = workspace_root.clone() + "node_modules";
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

            let file_path = dir_entry.path().display().to_string();
            let Some(file_path) = file_path.strip_prefix(&workspace_root) else {
                return Continue;
            };

            tx.send((file_path.to_string(), content)).ok();

            Continue
        })
    });

    drop(sender);
    receiver_thread.join().unwrap()
}
