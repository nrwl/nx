use std::path::Path;
use std::thread;
use std::thread::available_parallelism;

use crossbeam_channel::{unbounded, Receiver};
use ignore::WalkBuilder;

pub fn nx_workspace_walker<P, Fn, Re>(workspace_root: P, f: Fn) -> Re
where
    P: AsRef<Path>,
    Fn: FnOnce(Receiver<(String, Vec<u8>)>) -> Re + Send + 'static,
    Re: Send + 'static,
{
    let workspace_root = workspace_root.as_ref();
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

    let cpus = available_parallelism().map_or(2, |n| n.get()) - 1;

    let (sender, receiver) = unbounded::<(String, Vec<u8>)>();

    let receiver_thread = thread::spawn(|| f(receiver));

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

#[cfg(test)]
mod test {
    use super::*;
    use assert_fs::prelude::*;
    use assert_fs::TempDir;
    use std::collections::HashMap;

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
        let content = nx_workspace_walker("/does/not/exist", |rec| {
            let mut paths = vec![];
            for (path, _) in rec {
                paths.push(path);
            }
            paths
        });
        assert!(content.is_empty());

        let temp_dir = setup_fs();

        let content = nx_workspace_walker(temp_dir, |rec| {
            let mut paths = HashMap::new();
            for (path, content) in rec {
                paths.insert(path, content);
            }
            paths
        });
        assert_eq!(
            content,
            HashMap::from([
                ("baz/qux.txt".into(), "content@qux".into()),
                ("foo.txt".into(), "content1".into()),
                ("test.txt".into(), "content".into()),
                ("bar.txt".into(), "content2".into()),
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

        let mut file_names = nx_workspace_walker(temp_dir, |rec| {
            let mut file_names = vec![];
            for (path, _) in rec {
                file_names.push(path);
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
