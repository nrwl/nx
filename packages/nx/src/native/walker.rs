use ignore::{WalkBuilder, Match};
use ignore::gitignore::GitignoreBuilder;
use std::fmt::Debug;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::native::glob::build_glob_set;

#[cfg(not(target_arch = "wasm32"))]
use crate::native::logger::enable_logger;
use crate::native::utils::{Normalize, get_mod_time, git::parent_gitignore_files};
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

    // Build custom gitignore matchers for parent directories
    let parent_gitignore_matchers: Option<Arc<Vec<_>>> = if use_ignores {
        if let Some(gitignore_paths) = parent_gitignore_files(&directory) {
            // Workspace is git root or nested in git repo - build custom matchers
            walker.parents(false);

            // Create a GitignoreBuilder for each parent gitignore
            let mut matchers = Vec::new();
            for gitignore_path in gitignore_paths {
                if let Some(parent_dir) = gitignore_path.parent() {
                    let mut builder = GitignoreBuilder::new(parent_dir);
                    if builder.add(&gitignore_path).is_none() {
                        if let Ok(gitignore) = builder.build() {
                            matchers.push(gitignore);
                        }
                    }
                }
            }
            Some(Arc::new(matchers))
        } else {
            // No git repo found - use automatic parent traversal for backwards compatibility
            walker.parents(true);
            None
        }
    } else {
        None
    };

    if use_ignores {
        walker.add_custom_ignore_filename(".nxignore");
    }

    // Apply both static ignores and parent gitignore patterns
    walker.filter_entry(move |entry| {
        let path = entry.path();

        // Apply static ignores
        if ignore_glob_set.is_match(path.to_string_lossy().as_ref()) {
            return false;
        }

        // Apply parent gitignore patterns with proper directory context
        if let Some(ref matchers) = parent_gitignore_matchers {
            let is_dir = entry.file_type().map_or(false, |ft| ft.is_dir());
            for gitignore in matchers.iter() {
                match gitignore.matched_path_or_any_parents(path, is_dir) {
                    Match::Ignore(_) => return false,
                    _ => continue,
                }
            }
        }

        true
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

    #[test]
    fn parent_gitignore_patterns_respect_directory_context() {
        let temp_dir = assert_fs::TempDir::new().unwrap();

        // Parent gitignore with "dist/" pattern (should only apply to parent/dist/)
        temp_dir
            .child(".gitignore")
            .write_str("dist/\nbuild/\n")
            .unwrap();

        // Create parent/dist/ (should be ignored by parent .gitignore)
        temp_dir
            .child("dist/parent-file.txt")
            .write_str("test")
            .unwrap();

        // Git repo in nested directory
        temp_dir.child("workspace/.git").touch().unwrap();

        // Workspace gitignore (empty - doesn't ignore dist/)
        temp_dir
            .child("workspace/.gitignore")
            .write_str("")
            .unwrap();

        // Create workspace/dist/ (should NOT be ignored - parent pattern shouldn't apply here)
        temp_dir
            .child("workspace/dist/bundle.js")
            .write_str("code")
            .unwrap();

        temp_dir
            .child("workspace/dist/app.css")
            .write_str("code")
            .unwrap();

        // Create workspace/build/ (should NOT be ignored)
        temp_dir
            .child("workspace/build/output.js")
            .write_str("code")
            .unwrap();

        temp_dir
            .child("workspace/src/index.js")
            .write_str("code")
            .unwrap();

        let workspace_path = temp_dir.path().join("workspace");
        let mut files: Vec<_> = nx_walker(&workspace_path, true)
            .map(|f| f.normalized_path)
            .collect();
        files.sort();

        // Should include dist/ and build/ files because parent gitignore patterns
        // are now correctly scoped to the parent directory
        assert_eq!(
            files,
            vec![
                "build/output.js".to_string(),
                "dist/app.css".to_string(),
                "dist/bundle.js".to_string(),
                "src/index.js".to_string()
            ]
        );
    }

    #[test]
    fn nested_parent_gitignores_apply_correctly() {
        let temp_dir = assert_fs::TempDir::new().unwrap();

        // Root .gitignore ignoring "temp/"
        temp_dir
            .child(".gitignore")
            .write_str("temp/\n")
            .unwrap();

        // Middle level .gitignore ignoring "logs/"
        temp_dir
            .child("project/.gitignore")
            .write_str("logs/\n")
            .unwrap();

        // Git repo in deeply nested directory
        temp_dir.child("project/workspace/.git").touch().unwrap();

        // Create files in workspace
        temp_dir
            .child("project/workspace/temp/data.txt")
            .write_str("data")
            .unwrap();

        temp_dir
            .child("project/workspace/logs/app.log")
            .write_str("log")
            .unwrap();

        temp_dir
            .child("project/workspace/src/main.js")
            .write_str("code")
            .unwrap();

        let workspace_path = temp_dir.path().join("project/workspace");
        let mut files: Vec<_> = nx_walker(&workspace_path, true)
            .map(|f| f.normalized_path)
            .collect();
        files.sort();

        // Both temp/ and logs/ should be included because parent gitignores
        // are scoped to their respective directories
        assert_eq!(
            files,
            vec![
                "logs/app.log".to_string(),
                "src/main.js".to_string(),
                "temp/data.txt".to_string()
            ]
        );
    }
}
