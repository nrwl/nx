use ignore::{WalkBuilder, WalkState};
use std::fmt::Debug;
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};

use anyhow::{Context, Result};
use parking_lot::Mutex;

use crate::native::glob::{NxGlobSet, build_glob_set};

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

    let mut base_ignores: Vec<String> = HARDCODED_IGNORE_PATTERNS
        .iter()
        .map(|s| (*s).to_string())
        .collect();

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

/// Files vite and vitest write and remove while they load a config. The
/// watch never reports them, so a walk that feeds a hash skips them too.
pub(crate) const TRANSIENT_FILE_GLOBS: &[&str] = &[
    "vitest.config.ts.timestamp*.mjs",
    "vite.config.ts.timestamp*.mjs",
    "vitest.config.mts.timestamp*.mjs",
    "vite.config.mts.timestamp*.mjs",
];

/// Directories the walker and the watcher never enter.
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
    create_walker_vetoing(directory, use_ignores, None)
}

/// `create_walker` with `extra` vetoed on top of the hardcoded ignores. The
/// ignore crate keeps one filter predicate, so a caller that needs more has
/// to have them composed here rather than add its own.
pub(crate) fn create_walker_vetoing<P>(
    directory: P,
    use_ignores: bool,
    extra: Option<Arc<NxGlobSet>>,
) -> WalkBuilder
where
    P: AsRef<Path>,
{
    let directory: PathBuf = directory.as_ref().into();

    let ignore_glob_set =
        build_glob_set(HARDCODED_IGNORE_PATTERNS).expect("These static ignores always build");

    let mut walker = WalkBuilder::new(&directory);
    walker.require_git(false);
    walker.hidden(false);

    // `.ignore` is a ripgrep convention the ignore crate enables by default.
    // Nx never chose it, and the watcher does not read it, so honouring it here
    // would drop files the watcher still admits.
    walker.ignore(false);

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
    walker.filter_entry(move |entry| {
        let path = entry.path().to_string_lossy();
        !ignore_glob_set.is_match(path.as_ref())
            && extra
                .as_ref()
                .is_none_or(|set| !set.is_match(path.as_ref()))
    });
    walker
}

// ---------------------------------------------------------------------------
// Reading a directory's files, for the hashers and for the ignored index.
// Both need the same thing: every file under a directory, workspace-relative,
// with the stamp that says whether a remembered hash still stands.
// ---------------------------------------------------------------------------

/// The transient files the watch never reports. The hardcoded directories
/// come from `create_walker`, which vetoes them for every walk.
fn transient_skips() -> Result<Arc<NxGlobSet>> {
    static SKIPS: OnceLock<Option<Arc<NxGlobSet>>> = OnceLock::new();
    SKIPS
        .get_or_init(|| {
            let patterns: Vec<String> = TRANSIENT_FILE_GLOBS
                .iter()
                .map(|g| format!("**/{g}"))
                .collect();
            build_glob_set(&patterns).ok()
        })
        .clone()
        .context("the transient-file globs always build")
}

/// Files under `start`, workspace-relative, with the stamp read on the way
/// for anything the context does not vouch for. The walker skips what it
/// skips for every walk, but never the root it is given, so a glob rooted at
/// `node_modules` reads it. Linked directories are not entered; with
/// `canonical_root`, a linked file counts only when its target is inside it.
pub(crate) fn walk_files(
    start: &Path,
    workspace_root: &Path,
    canonical_root: Option<&Path>,
    accept: &(dyn Fn(&str) -> bool + Sync),
) -> Result<Vec<String>> {
    let relative_of = |path: &Path| -> Option<String> {
        Some(
            path.strip_prefix(workspace_root)
                .ok()?
                .to_string_lossy()
                .replace('\\', "/"),
        )
    };
    let visit = |path: &Path, file_type: std::fs::FileType| -> Option<String> {
        let relative = relative_of(path)?;
        if file_type.is_symlink() {
            // Read where a linked file points, but never enter a linked
            // directory, and with a root to hold to, never leave it.
            let target = std::fs::metadata(path).ok()?;
            if target.is_dir() || !accept(&relative) {
                return None;
            }
            if let Some(root) = canonical_root
                && !dunce::canonicalize(path).is_ok_and(|t| t.starts_with(root))
            {
                return None;
            }
            return Some(relative);
        }
        if !file_type.is_file() || !accept(&relative) {
            return None;
        }
        Some(relative)
    };

    let found = Mutex::new(Vec::new());
    create_walker_vetoing(start, false, Some(transient_skips()?))
        .follow_links(false)
        .build_parallel()
        .run(|| {
            Box::new(|entry| {
                if let Ok(entry) = entry
                    && let Some(file_type) = entry.file_type()
                    && let Some(one) = visit(entry.path(), file_type)
                {
                    found.lock().push(one);
                }
                WalkState::Continue
            })
        });
    Ok(found.into_inner())
}

/// Every file under `dir` with its stamp, for an index seeding a prefix: the
/// walk an expansion runs, confined to the workspace. Empty when `dir` does
/// not exist yet; `None` when it resolves outside the workspace.
/// The files under `dir` that `accept` admits, workspace-relative, read from
/// disk. The one implementation of "what does this directory hold"; the
/// ignored index caches on top of it, and everything else calls it directly.
/// With `confine`, a `dir` resolving outside the workspace is `None` and a
/// linked file leading out is skipped; a declared output is read wherever it
/// points. `None` also when `dir` cannot be read at all.
pub(crate) fn files_under(
    workspace_root: &Path,
    dir: &str,
    confine: bool,
    accept: &(dyn Fn(&str) -> bool + Sync),
) -> Option<Vec<String>> {
    let start = workspace_root.join(dir);
    let resolved = dunce::canonicalize(&start).ok()?;
    let canonical_root = if confine {
        let root = dunce::canonicalize(workspace_root).ok()?;
        if !resolved.starts_with(&root) {
            return None;
        }
        Some(root)
    } else {
        None
    };
    if !resolved.is_dir() {
        return Some(Vec::new());
    }
    walk_files(&start, workspace_root, canonical_root.as_deref(), accept).ok()
}

/// Every file under `dir`, for the index adopting it as a listing. A
/// directory that does not exist yet is empty rather than missing, so
/// tracking one before its task writes it is not an error.
pub(crate) fn seed_walk(workspace_root: &Path, dir: &str) -> Option<Vec<String>> {
    if std::fs::symlink_metadata(workspace_root.join(dir)).is_err() {
        return Some(Vec::new());
    }
    files_under(workspace_root, dir, true, &|_| true)
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

    // `.ignore` is a ripgrep convention the ignore crate turns on by default.
    // Nx never chose it and the watch filterer does not read it, so the walk
    // must not either.
    #[test]
    fn does_not_honour_dot_ignore() {
        let temp_dir = setup_fs();
        temp_dir.child(".ignore").write_str("foo.txt\n").unwrap();

        let files: Vec<_> = nx_walker(temp_dir.path(), true)
            .map(|f| f.normalized_path)
            .collect();

        assert!(
            files.iter().any(|f| f == "foo.txt"),
            "a .ignore entry should not exclude foo.txt, got: {:?}",
            files
        );
    }

    // The reference semantics the watch filterer's rank-before-depth sort
    // mirrors: the ignore crate keeps the deepest match per class and then
    // prefers the higher class, so a .nxignore wins over a .gitignore that
    // sits deeper.
    #[test]
    fn nxignore_outranks_a_deeper_gitignore_negation() {
        let temp_dir = setup_fs();
        temp_dir
            .child("pkg/.nxignore")
            .write_str("keep.tmp\n")
            .unwrap();
        temp_dir
            .child("pkg/deep/.gitignore")
            .write_str("!keep.tmp\n")
            .unwrap();
        temp_dir
            .child("pkg/deep/keep.tmp")
            .write_str("data")
            .unwrap();

        let files: Vec<_> = nx_walker(temp_dir.path(), true)
            .map(|f| f.normalized_path)
            .collect();

        assert!(
            !files.iter().any(|f| f == "pkg/deep/keep.tmp"),
            "the shallower .nxignore should outrank the deeper .gitignore negation, got: {:?}",
            files
        );
    }
}
