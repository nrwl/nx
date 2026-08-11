use ignore::WalkBuilder;
use std::collections::HashSet;
use std::fmt::Debug;
use std::path::{Path, PathBuf};

use crate::native::glob::build_glob_set;

#[cfg(not(target_arch = "wasm32"))]
use crate::native::logger::enable_logger;
use crate::native::utils::{
    Normalize, get_mod_time,
    git::{nested_linked_worktrees, parent_gitignore_files},
};
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

    let mut base_ignores: Vec<String> = HARDCODED_IGNORE_PATTERNS
        .iter()
        .map(|s| (*s).to_string())
        .collect();

    if let Some(additional_ignores) = ignores {
        base_ignores.extend(additional_ignores.iter().map(|s| format!("**/{}", s)));
    };

    let ignore_glob_set = build_glob_set(&base_ignores).expect("Should be valid globs");

    // Same prune as `create_walker`, for the same reason: a linked worktree is
    // a full second checkout, and walking it multiplies the file set for no
    // gain. It matters more here than it looks. The daemon expands a
    // directory-creation event by walking the new directory
    // (`transform_event_to_watch_events`) and backfills a newly watched
    // directory the same way, so without this a `git worktree add` inside the
    // workspace reports every file of the new checkout as created.
    let walk_root = base_dir.clone();
    let worktrees: HashSet<PathBuf> = nested_linked_worktrees(&base_dir).into_iter().collect();

    // Use WalkDir instead of ignore::WalkBuilder because it's faster
    WalkDir::new(&base_dir)
        .into_iter()
        .filter_entry(move |entry| {
            let path = entry.path().to_string_lossy();
            if ignore_glob_set.is_match(path.as_ref()) {
                return false;
            }

            if worktrees.is_empty() {
                return true;
            }

            // `filter_entry` prunes the entry's whole subtree, so matching the
            // worktree root is enough to keep the checkout out.
            entry
                .path()
                .strip_prefix(&walk_root)
                .map(|relative| !worktrees.contains(relative))
                .unwrap_or(true)
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

        if !is_hashable_file(&metadata.file_type()) {
            return None;
        }

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

            if !is_hashable_file(&metadata.file_type()) {
                trace!(path = ?dir_entry.path(), "skipping non-regular file");
                return Continue;
            }

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

/// Returns true when the entry should be hashed as a workspace file.
/// Excludes anything that is not a regular file or a symlink (e.g. named
/// pipes/FIFOs, sockets, block/char devices) because `std::fs::read` can
/// block indefinitely on such paths (FIFOs wait for a writer).
fn is_hashable_file(file_type: &std::fs::FileType) -> bool {
    file_type.is_file() || file_type.is_symlink()
}

/// Hardcoded ignore patterns used by both the walker and the watcher.
/// These are directories that should never be walked or watched.
pub(crate) const HARDCODED_IGNORE_PATTERNS: &[&str] = &[
    "**/node_modules",
    "**/.git",
    "**/.nx/cache",
    "**/.nx/workspace-data",
    "**/.yarn/cache",
];

/// The same list, for JavaScript callers that walk a tree rather than the
/// filesystem - `visitNotIgnoredFiles` - so both sides apply one baseline
/// instead of maintaining a second copy that drifts.
///
/// The patterns are gitignore-shaped, so they read the same to the `ignore`
/// crate here and the `ignore` npm package there.
#[napi]
pub fn get_hardcoded_ignore_patterns() -> Vec<String> {
    HARDCODED_IGNORE_PATTERNS
        .iter()
        .map(|pattern| pattern.to_string())
        .collect()
}

pub(crate) fn create_walker<P>(directory: P, use_ignores: bool) -> WalkBuilder
where
    P: AsRef<Path>,
{
    let directory: PathBuf = directory.as_ref().into();

    let ignore_glob_set =
        build_glob_set(HARDCODED_IGNORE_PATTERNS).expect("These static ignores always build");

    let mut walker = WalkBuilder::new(&directory);
    walker.require_git(false);
    walker.hidden(false);

    // Linked worktrees are full checkouts of the workspace nested inside it.
    // Walking one multiplies the file set for no gain. This applies whatever
    // `use_ignores` says: the daemon's output watcher walks the workspace
    // root with `use_ignores: false` (`watchOutputFiles` in
    // daemon/server/watcher.ts) and takes a non-recursive inotify descriptor
    // per directory the walk yields, where exhausting the limit is fatal.
    // Resolution costs a handful of syscalls and nothing per entry when the
    // repository has no worktrees.
    let worktrees: HashSet<PathBuf> = nested_linked_worktrees(&directory).into_iter().collect();

    if use_ignores {
        // Handle parent .gitignore files based on git repository boundaries
        if let Some(gitignore_paths) = parent_gitignore_files(&directory) {
            // Workspace is git root or nested in git repo - use manual parent traversal
            walker.parents(false);
            for gitignore_path in gitignore_paths {
                walker.add_ignore(gitignore_path);
            }
        } else {
            // No git repo found - use automatic parent traversal for backwards compatibility
            walker.parents(true);
        }

        walker.add_custom_ignore_filename(".nxignore");
    } else {
        // Don't filter out ignored files
        walker.standard_filters(false);
    }

    // We should make sure to always ignore node_modules and the .git folder
    let walk_root = directory.clone();
    walker.filter_entry(move |entry| {
        let path = entry.path().to_string_lossy();
        if ignore_glob_set.is_match(path.as_ref()) {
            return false;
        }

        if worktrees.is_empty() {
            return true;
        }

        // Entry paths are built from the walk root, so stripping it back off
        // yields the same relative form the worktree roots were stored in.
        entry
            .path()
            .strip_prefix(&walk_root)
            .map(|relative| !worktrees.contains(relative))
            .unwrap_or(true)
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

    /// A workspace with two linked worktrees and one submodule nested in it.
    fn setup_worktree_fs() -> TempDir {
        use crate::native::utils::git::test_support::{register_submodule, register_worktree};

        let temp_dir = TempDir::new().unwrap();
        temp_dir
            .child(".git/HEAD")
            .write_str("ref: refs/heads/main")
            .unwrap();
        temp_dir.child("test.txt").write_str("content").unwrap();

        // Agent tooling nests worktrees under `.claude/worktrees`, but a
        // worktree is just as valid anywhere else - both have to be pruned.
        for (name, path) in [("wt1", ".claude/worktrees/wt1"), ("wt2", "other/wt2")] {
            register_worktree(temp_dir.path(), name, &temp_dir.path().join(path));
            temp_dir.child(path).child("app.ts").write_str("x").unwrap();
        }

        // A submodule uses the very same gitfile mechanism, but its contents
        // are real workspace files that must keep being scanned.
        register_submodule(temp_dir.path(), "libs/sub");
        temp_dir.child("libs/sub/lib.ts").write_str("x").unwrap();

        temp_dir
    }

    #[test]
    fn it_skips_linked_worktrees_but_keeps_submodules() {
        let temp_dir = setup_worktree_fs();

        let mut files = nx_walker(&temp_dir, true)
            .map(|f| f.normalized_path)
            .collect::<Vec<_>>();
        files.sort();

        assert_eq!(
            files,
            vec!["libs/sub/lib.ts".to_string(), "test.txt".to_string()]
        );
    }

    #[test]
    fn nx_walker_sync_skips_linked_worktrees() {
        // The daemon expands a directory-creation event, and backfills a newly
        // watched directory, by walking it with `nx_walker_sync`. Both run over
        // whatever `git worktree add` just wrote, so a walk that descends into
        // a checkout reports every file in it as created.
        let temp_dir = setup_worktree_fs();

        let mut files = nx_walker_sync(temp_dir.path(), None)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .filter(|p| p.ends_with(".ts"))
            .collect::<Vec<_>>();
        files.sort();

        assert_eq!(files, vec!["libs/sub/lib.ts".to_string()]);
    }

    #[test]
    fn it_skips_linked_worktrees_without_ignores() {
        // `watchOutputFiles` builds its watcher over the workspace root with
        // ignores off, and every directory the walk yields costs an inotify
        // descriptor. Gating the prune on `use_ignores` handed a worktree's
        // whole checkout back to it.
        let temp_dir = setup_worktree_fs();

        let mut files = nx_walker(&temp_dir, false)
            .map(|f| f.normalized_path)
            .collect::<Vec<_>>();
        files.sort();

        assert!(
            !files.iter().any(|f| f.contains("wt1") || f.contains("wt2")),
            "worktree contents must be pruned with ignores off too; got {files:?}"
        );
        assert!(
            files.iter().any(|f| f == "libs/sub/lib.ts"),
            "submodule contents must still be walked; got {files:?}"
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

    // FIFOs only exist on unix-like systems. This is the primary hazard the
    // `is_hashable_file` filter has to guard against: opening a FIFO and
    // calling `std::fs::read` on it blocks the reader indefinitely waiting
    // for a writer.
    #[cfg(all(unix, not(target_arch = "wasm32")))]
    #[test]
    fn skips_named_pipes() {
        use nix::sys::stat::Mode;
        use nix::unistd::mkfifo;

        let temp_dir = setup_fs();
        let fifo_path = temp_dir.path().join("a-named-pipe");
        mkfifo(&fifo_path, Mode::S_IRUSR | Mode::S_IWUSR).expect("mkfifo");

        let mut files: Vec<_> = nx_walker(temp_dir.path(), true)
            .map(|f| f.normalized_path)
            .collect();
        files.sort();

        assert!(
            !files.iter().any(|f| f == "a-named-pipe"),
            "FIFO should be skipped, got: {:?}",
            files
        );
    }

    // Unix sockets are another non-regular file type the walker should
    // skip. Reading from one wouldn't block the way a FIFO does, but the
    // contents aren't meaningful for hashing either.
    #[cfg(all(unix, not(target_arch = "wasm32")))]
    #[test]
    fn skips_unix_sockets() {
        use std::os::unix::net::UnixListener;

        let temp_dir = setup_fs();
        let socket_path = temp_dir.path().join("a-unix-socket");
        let _listener = UnixListener::bind(&socket_path).expect("bind unix socket");

        let mut files: Vec<_> = nx_walker(temp_dir.path(), true)
            .map(|f| f.normalized_path)
            .collect();
        files.sort();

        assert!(
            !files.iter().any(|f| f == "a-unix-socket"),
            "unix socket should be skipped, got: {:?}",
            files
        );
    }
}
