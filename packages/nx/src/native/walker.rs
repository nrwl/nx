use std::path::{Path, PathBuf};
use std::thread;
use std::thread::available_parallelism;

use crossbeam_channel::{unbounded, Receiver};
use ignore::WalkBuilder;

use crate::native::utils::glob::build_glob_set;

use walkdir::WalkDir;

/// Walks the directory in a single thread and does not ignore any files
/// Should only be used for small directories, and not traversing the whole workspace
pub fn nx_walker_sync<'a, P>(directory: P) -> impl Iterator<Item = PathBuf>
where
    P: AsRef<Path> + 'a,
{
    let base_dir: PathBuf = directory.as_ref().into();

    let ignore_glob_set = build_glob_set(vec![
        String::from("**/node_modules"),
        String::from("**/.git"),
    ])
    .expect("These static ignores always build");

    // Use WalkDir instead of ignore::WalkBuilder because it's faster
    WalkDir::new(&base_dir)
        .into_iter()
        .filter_entry(move |entry| {
            let path = entry.path().to_string_lossy();
            !ignore_glob_set.is_match(path.as_ref())
        })
        .filter_map(move |entry| {
            entry
                .ok()
                .and_then(|e| e.path().strip_prefix(&base_dir).ok().map(|p| p.to_owned()))
        })
}

/// Walk the directory and ignore files from .gitignore and .nxignore
pub fn nx_walker<P, Fn, Re>(directory: P, f: Fn) -> Re
where
    P: AsRef<Path>,
    Fn: FnOnce(Receiver<(PathBuf, Vec<u8>)>) -> Re + Send + 'static,
    Re: Send + 'static,
{
    let directory = directory.as_ref();
    let nx_ignore = directory.join(".nxignore");

    let ignore_glob_set = build_glob_set(vec![
        String::from("**/node_modules"),
        String::from("**/.git"),
    ])
    .expect("These static ignores always build");

    let mut walker = WalkBuilder::new(directory);
    walker.hidden(false);
    walker.add_custom_ignore_filename(&nx_ignore);

    // We should make sure to always ignore node_modules and the .git folder
    walker.filter_entry(move |entry| {
        let path = entry.path().to_string_lossy();
        !ignore_glob_set.is_match(path.as_ref())
    });

    let cpus = available_parallelism().map_or(2, |n| n.get()) - 1;

    let (sender, receiver) = unbounded::<(PathBuf, Vec<u8>)>();

    let receiver_thread = thread::spawn(|| f(receiver));

    walker.threads(cpus).build_parallel().run(|| {
        let tx = sender.clone();
        Box::new(move |entry| {
            use ignore::WalkState::*;

            let Ok(dir_entry) = entry else {
                return Continue;
            };

            let Ok(content) = std::fs::read(dir_entry.path()) else {
                return Continue;
            };

            let Ok(file_path) = dir_entry.path().strip_prefix(directory) else {
                return Continue;
            };

            tx.send((file_path.into(), content)).ok();

            Continue
        })
    });

    drop(sender);
    receiver_thread.join().unwrap()
}

#[cfg(test)]
mod test {
    use std::collections::HashMap;
    use std::{assert_eq, vec};

    use assert_fs::prelude::*;
    use assert_fs::TempDir;

    use crate::native::utils::path::Normalize;

    use super::*;

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
    fn it_walks_a_directory() {
        // handle empty workspaces
        let content = nx_walker("/does/not/exist", |rec| {
            let mut paths = vec![];
            for (path, _) in rec {
                paths.push(path);
            }
            paths
        });
        assert!(content.is_empty());

        let temp_dir = setup_fs();

        let content = nx_walker(temp_dir, |rec| {
            let mut paths = HashMap::new();
            for (path, content) in rec {
                paths.insert(path, content);
            }
            paths
        });
        assert_eq!(
            content,
            HashMap::from([
                (PathBuf::from("baz/qux.txt"), "content@qux".into()),
                (PathBuf::from("foo.txt"), "content1".into()),
                (PathBuf::from("test.txt"), "content".into()),
                (PathBuf::from("bar.txt"), "content2".into()),
            ])
        );
    }

    #[test]
    fn handles_nx_ignore() {
        let temp_dir = setup_fs();

        temp_dir
            .child("nested")
            .child("child.txt")
            .write_str("data")
            .unwrap();
        temp_dir
            .child("nested")
            .child("child-two")
            .child("grand_child.txt")
            .write_str("data")
            .unwrap();

        // add nxignore file
        temp_dir
            .child(".nxignore")
            .write_str(
                r"baz/
nested/child.txt
nested/child-two/
    ",
            )
            .unwrap();

        let mut file_names = nx_walker(temp_dir, |rec| {
            let mut file_names = vec![];
            for (path, _) in rec {
                file_names.push(path.to_normalized_string());
            }
            file_names
        });

        file_names.sort();

        assert_eq!(
            file_names,
            vec!(".nxignore", "bar.txt", "foo.txt", "test.txt")
        );
    }
}
