use ignore::WalkBuilder;
use std::fmt::Debug;
use std::path::{Path, PathBuf};

use crate::native::glob::build_glob_set;

#[cfg(not(target_arch = "wasm32"))]
use crate::native::logger::enable_logger;
use crate::native::utils::{Normalize, get_mod_time, git::find_git_root};
use walkdir::WalkDir;

#[derive(PartialEq, Debug, Ord, PartialOrd, Eq, Clone)]
pub struct NxFile {
    pub full_path: String,
    pub normalized_path: String,
    pub mod_time: i64,
}

/// Walks the directory in a single thread and does not ignore any files
/// Should only be used for small directories, and not traversing the whole workspace
///
/// The `ignores` argument is used to filter entries. This is important to make sure that any ignore globs are applied on the `filter_entry` function
pub fn nx_walker_sync<'a, P>(
    directory: P,
    ignores: Option<&[String]>,
) -> impl Iterator<Item = PathBuf>
where
    P: AsRef<Path> + 'a,
{
    let base_dir: PathBuf = directory.as_ref().into();

    let mut base_ignores: Vec<String> = vec![
        "**/node_modules".into(),
        "**/.git".into(),
        "**/.nx/cache".into(),
        "**/.nx/workspace-data".into(),
        "**/.yarn/cache".into(),
    ];

    if let Some(additional_ignores) = ignores {
        base_ignores.extend(additional_ignores.iter().map(|s| format!("**/{}", s)));
    };

    let ignore_glob_set = build_glob_set(&base_ignores).expect("Should be valid globs");

    // Use WalkDir instead of ignore::WalkBuilder because it's faster
    WalkDir::new(&base_dir)
        .into_iter()
        .filter_entry(move |entry| {
            let path = entry.path().to_string_lossy();
            !ignore_glob_set.is_match(path.as_ref())
        })
        .filter_map(move |entry| {
            entry.ok().and_then(|e| {
                e.path()
                    .strip_prefix(&base_dir)
                    .ok()
                    .filter(|p| !p.to_string_lossy().is_empty())
                    .map(|p| p.to_owned())
            })
        })
}

/// Walk the directory and ignore files from .gitignore and .nxignore
#[cfg(target_arch = "wasm32")]
pub fn nx_walker<P>(directory: P, use_ignores: bool) -> impl Iterator<Item = NxFile>
where
    P: AsRef<Path>,
{
    let directory: PathBuf = directory.as_ref().into();
    let walker = create_walker(&directory, use_ignores);

    let entries = walker.build();

    entries.filter_map(move |entry| {
        let Ok(dir_entry) = entry else {
            return None;
        };

        if dir_entry.file_type().is_some_and(|d| d.is_dir()) {
            return None;
        }

        let Ok(file_path) = dir_entry.path().strip_prefix(&directory) else {
            return None;
        };

        let Ok(metadata) = dir_entry.metadata() else {
            return None;
        };

        Some(NxFile {
            full_path: String::from(dir_entry.path().to_string_lossy()),
            normalized_path: file_path.to_normalized_string(),
            mod_time: get_mod_time(&metadata),
        })
    })
}

/// Walk the directory and ignore files from .gitignore and .nxignore
#[cfg(not(target_arch = "wasm32"))]
pub fn nx_walker<P>(directory: P, use_ignores: bool) -> impl Iterator<Item = NxFile>
where
    P: AsRef<Path>,
{
    use std::thread;
    use std::thread::available_parallelism;

    use crossbeam_channel::unbounded;
    use tracing::trace;
    enable_logger();

    let directory = directory.as_ref();
    let mut walker = create_walker(directory, use_ignores);

    let cpus = available_parallelism().map_or(2, |n| n.get()) - 1;

    let (sender, receiver) = unbounded();

    trace!(?directory, "walking");

    let now = std::time::Instant::now();
    walker.threads(cpus).build_parallel().run(|| {
        let tx = sender.clone();
        Box::new(move |entry| {
            use ignore::WalkState::*;

            let Ok(dir_entry) = entry else {
                return Continue;
            };

            if dir_entry.file_type().is_some_and(|d| d.is_dir()) {
                return Continue;
            };

            let Ok(file_path) = dir_entry.path().strip_prefix(directory) else {
                return Continue;
            };

            let Ok(metadata) = dir_entry.metadata() else {
                return Continue;
            };

            tx.send(NxFile {
                full_path: String::from(dir_entry.path().to_string_lossy()),
                normalized_path: file_path.to_normalized_string(),
                mod_time: get_mod_time(&metadata),
            })
            .ok();

            Continue
        })
    });
    trace!("walked in {:?}", now.elapsed());

    let receiver_thread = thread::spawn(move || receiver.into_iter());
    drop(sender);
    receiver_thread.join().unwrap()
}


fn create_walker<P>(directory: P, use_ignores: bool) -> WalkBuilder
where
    P: AsRef<Path>,
{
    let directory: PathBuf = directory.as_ref().into();

    let ignore_glob_set = build_glob_set(&[
        "**/node_modules",
        "**/.git",
        "**/.nx/cache",
        "**/.nx/workspace-data",
        "**/.yarn/cache",
    ])
    .expect("These static ignores always build");

    let mut walker = WalkBuilder::new(&directory);
    walker.require_git(false);
    walker.hidden(false);

    if use_ignores {
        // Find the nearest git root to determine ignore file behavior
        let git_root = find_git_root(&directory);

        match git_root {
            Some(git_root_path) if git_root_path == directory => {
                // The workspace IS the git root - don't use parent gitignores
                walker.parents(false);
            }
            Some(git_root_path) => {
                // The workspace is nested within a git repo - disable automatic parents
                // and manually add ignore files only up to the git root
                walker.parents(false);

                // Manually add .gitignore files from parent directories up to the git root
                let mut current_path = directory.parent();
                while let Some(path) = current_path {
                    let gitignore_path = path.join(".gitignore");
                    if gitignore_path.exists() {
                        walker.add_ignore(gitignore_path);
                    }

                    // Stop when we reach the git root (after processing it)
                    if path == git_root_path {
                        break;
                    }
                    current_path = path.parent();
                }
            }
            None => {
                // No git repository found - use all parent ignores (backwards compatibility)
                walker.parents(true);
            }
        }

        walker.add_custom_ignore_filename(".nxignore");
    }

    // We should make sure to always ignore node_modules and the .git folder
    walker.filter_entry(move |entry| {
        let path = entry.path().to_string_lossy();
        !ignore_glob_set.is_match(path.as_ref())
    });
    walker
}

#[cfg(test)]
mod test {
    use std::{assert_eq, vec};

    use assert_fs::TempDir;
    use assert_fs::prelude::*;

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
        let content = nx_walker("/does/not/exist", true).collect::<Vec<_>>();
        assert!(content.is_empty());

        let temp_dir = setup_fs();

        let mut content = nx_walker(&temp_dir, true).collect::<Vec<_>>();
        content.sort();
        let content = content
            .into_iter()
            .map(|f| (f.full_path.into(), f.normalized_path.into()))
            .collect::<Vec<_>>();
        assert_eq!(
            content,
            vec![
                (temp_dir.join("bar.txt"), PathBuf::from("bar.txt")),
                (temp_dir.join("baz/qux.txt"), PathBuf::from("baz/qux.txt")),
                (temp_dir.join("foo.txt"), PathBuf::from("foo.txt")),
                (temp_dir.join("test.txt"), PathBuf::from("test.txt")),
            ]
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
        temp_dir
            .child("v1")
            .child("packages")
            .child("pkg-a")
            .child("pkg-a.txt")
            .write_str("data")
            .unwrap();
        temp_dir
            .child("v1")
            .child("packages")
            .child("pkg-b")
            .child("pkg-b.txt")
            .write_str("data")
            .unwrap();
        temp_dir
            .child("packages")
            .child("pkg-c")
            .child("pkg-c.txt")
            .write_str("data")
            .unwrap();

        // add nxignore file
        temp_dir
            .child(".nxignore")
            .write_str(
                r"baz/
nested/child.txt
nested/child-two/

# this should only ignore root level packages, not nested
/packages
    ",
            )
            .unwrap();

        let mut file_names = nx_walker(temp_dir, true)
            .map(
                |NxFile {
                     normalized_path: relative_path,
                     ..
                 }| relative_path,
            )
            .collect::<Vec<_>>();

        file_names.sort();

        assert_eq!(
            file_names,
            vec!(
                ".nxignore",
                "bar.txt",
                "foo.txt",
                "test.txt",
                "v1/packages/pkg-a/pkg-a.txt",
                "v1/packages/pkg-b/pkg-b.txt"
            )
        );
    }

    #[test]
    fn ignores_parent_gitignore_when_workspace_is_git_root() {
        let parent_temp = assert_fs::TempDir::new().unwrap();
        parent_temp.child(".gitignore").write_str("*").unwrap();
        parent_temp.child("workspace/.git").touch().unwrap();
        parent_temp
            .child("workspace/file1.txt")
            .write_str("test")
            .unwrap();
        parent_temp
            .child("workspace/project.json")
            .write_str("test")
            .unwrap();

        let workspace_path = parent_temp.path().join("workspace");
        let mut files: Vec<_> = nx_walker(&workspace_path, true)
            .map(|f| f.normalized_path)
            .collect();
        files.sort();

        assert_eq!(
            files,
            vec!["file1.txt".to_string(), "project.json".to_string()]
        );
    }

    #[test]
    fn respects_gitignore_within_git_repo_but_not_above() {
        let temp_dir = assert_fs::TempDir::new().unwrap();

        // Create a .gitignore file above the git repository (should be ignored)
        temp_dir
            .child(".gitignore")
            .write_str("ignored_by_parent.txt")
            .unwrap();

        // Create the git repository root
        temp_dir.child("repo/.git").touch().unwrap();

        // Create a .gitignore file within the git repository (should be respected)
        temp_dir
            .child("repo/.gitignore")
            .write_str("ignored_by_repo.txt")
            .unwrap();

        // Create test files
        temp_dir
            .child("repo/workspace/file1.txt")
            .write_str("test")
            .unwrap();
        temp_dir
            .child("repo/workspace/project.json")
            .write_str("test")
            .unwrap();
        temp_dir
            .child("repo/workspace/ignored_by_parent.txt")
            .write_str("test")
            .unwrap();
        temp_dir
            .child("repo/workspace/ignored_by_repo.txt")
            .write_str("test")
            .unwrap();

        let workspace_path = temp_dir.path().join("repo/workspace");
        let mut files: Vec<_> = nx_walker(&workspace_path, true)
            .map(|f| f.normalized_path)
            .collect();
        files.sort();

        // Should include ignored_by_parent.txt (parent .gitignore is ignored)
        // Should exclude ignored_by_repo.txt (repo .gitignore is respected)
        assert_eq!(
            files,
            vec![
                "file1.txt".to_string(),
                "ignored_by_parent.txt".to_string(),
                "project.json".to_string()
            ]
        );
    }

    #[test]
    fn respects_parent_gitignore_when_no_git_repo_found() {
        let parent_temp = assert_fs::TempDir::new().unwrap();
        parent_temp.child(".gitignore").write_str("*").unwrap();
        parent_temp
            .child("workspace/file1.txt")
            .write_str("test")
            .unwrap();
        parent_temp
            .child("workspace/project.json")
            .write_str("test")
            .unwrap();

        let workspace_path = parent_temp.path().join("workspace");
        let mut files: Vec<_> = nx_walker(&workspace_path, true)
            .map(|f| f.normalized_path)
            .collect();
        files.sort();

        // All files should be ignored by parent .gitignore since no git repo was found
        assert!(files.is_empty());
    }
}
