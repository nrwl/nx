use dashmap::DashMap;
use std::fs::read_to_string;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use std::time::SystemTime;

/// Prefix of a "gitfile" - the plain file git writes in place of a `.git`
/// directory for linked worktrees and submodules.
const GITDIR_PREFIX: &str = "gitdir:";

/// Find the nearest git repository root by walking up the directory tree
fn find_git_root<P: AsRef<Path>>(start_path: P) -> Option<PathBuf> {
    let mut current_path = start_path.as_ref();

    loop {
        if current_path.join(".git").exists() {
            return Some(current_path.to_path_buf());
        }

        match current_path.parent() {
            Some(parent) => current_path = parent,
            None => return None,
        }
    }
}

/// Get parent .gitignore file paths based on git repository boundaries
///
/// # Behavior:
/// - If workspace is git root: returns Some([]) (empty vec - use manual mode with no parents)
/// - If workspace is nested in git repo: returns Some(parents up to git root)
/// - If no git repo found: returns None (use walker.parents(true) for backwards compatibility)
pub fn parent_gitignore_files<P: AsRef<Path>>(workspace_root: P) -> Option<Vec<PathBuf>> {
    let workspace_root = workspace_root.as_ref();
    let git_root_path = find_git_root(&workspace_root)?;

    if git_root_path == workspace_root {
        // The workspace IS the git root - don't use parent gitignores
        return Some(Vec::new());
    }

    let mut result = Vec::new();
    let mut current_path = workspace_root.parent();

    while let Some(path) = current_path {
        let gitignore_path = path.join(".gitignore");
        if gitignore_path.exists() {
            result.push(gitignore_path);
        }

        // Stop when we reach the git root (after processing it)
        if path == git_root_path {
            break;
        }
        current_path = path.parent();
    }

    Some(result)
}

fn canonicalize_or_own(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

/// Resolve a path git recorded in its metadata against `base`. Submodules
/// always write a relative path; worktrees write an absolute one unless
/// created with `--relative-paths` (git 2.48+).
fn resolve_recorded_path(raw: &str, base: &Path) -> Option<PathBuf> {
    if raw.is_empty() {
        return None;
    }

    let target = Path::new(raw);
    Some(if target.is_absolute() {
        target.to_path_buf()
    } else {
        canonicalize_or_own(&base.join(target))
    })
}

/// Read a file holding a bare path, such as `<git-dir>/worktrees/<name>/gitdir`.
fn read_path_file(file: &Path, base: &Path) -> Option<PathBuf> {
    resolve_recorded_path(read_to_string(file).ok()?.trim(), base)
}

/// Read a gitfile - the `gitdir: <path>` form git writes in place of a `.git`
/// directory. Only the working tree side carries the prefix; the metadata
/// side records a bare path.
pub fn read_gitfile(gitfile: &Path, base: &Path) -> Option<PathBuf> {
    let contents = read_to_string(gitfile).ok()?;
    resolve_recorded_path(contents.trim().strip_prefix(GITDIR_PREFIX)?.trim(), base)
}

/// Resolve the git directory for a repository root. Usually `<root>/.git`,
/// but a linked worktree or submodule has a gitfile there instead.
fn resolve_git_dir(git_root: &Path) -> Option<PathBuf> {
    let dot_git = git_root.join(".git");

    if dot_git.metadata().ok()?.is_dir() {
        return Some(dot_git);
    }

    read_gitfile(&dot_git, git_root)
}

/// The git directory shared by every worktree of a repository. Walking from
/// inside a linked worktree lands on `<main>/.git/worktrees/<name>`, whose
/// `commondir` points back at the main `.git`.
///
/// `None` means `git_dir` carries no `commondir`. For the main repository's
/// own `.git` or a submodule's `.git/modules/<..>` that is git's way of
/// saying this *is* the common directory; for a worktree it means git has
/// not finished registering it yet. Only the caller can tell those apart, so
/// neither is answered here.
pub fn common_git_dir(git_dir: &Path) -> Option<PathBuf> {
    read_path_file(&git_dir.join("commondir"), git_dir)
}

/// Whether `path` is the root of a git linked worktree.
///
/// A worktree and a submodule both replace `.git` with a gitfile, so the
/// gitfile alone can't separate them - what does is the `gitdir` file git
/// writes into a worktree's metadata directory, pointing back at the
/// checkout. A submodule's `.git/modules/<..>` holds no such file; it records
/// its checkout in `config` as `core.worktree`. The path a gitfile points
/// *at* is not a reliable discriminator either: a submodule at
/// `packages/worktrees/foo` is registered under
/// `.git/modules/packages/worktrees/foo`, whose parent segment is `worktrees`
/// too.
///
/// `commondir` separates the two just as well. `gitdir` is preferred only
/// because `git worktree add` writes it first, so this answers `true` for
/// every state a half-registered worktree passes through rather than all but
/// the first ~66us of it. No caller is known to observe that window - the
/// watcher reaches here from an event already queued and dequeued - so treat
/// this as ordering hygiene, not a fix for a race anyone has measured.
///
/// A dangling worktree - one whose main clone has been moved or deleted,
/// which the absolute path in the gitfile does nothing to survive - answers
/// `false`, because the metadata directory it names isn't there to hold a
/// `gitdir`.
///
/// Costs one read plus one stat, so it suits deciding about a single
/// directory (a watch event) rather than scanning a whole workspace; use
/// [`nested_linked_worktrees`] for that.
pub fn is_linked_worktree_root<P: AsRef<Path>>(path: P) -> bool {
    let path = path.as_ref();
    let Some(git_dir) = read_gitfile(&path.join(".git"), path) else {
        return false;
    };

    git_dir.join("gitdir").is_file()
}

/// Roots of git's linked worktrees (`git worktree add`) that live inside
/// `workspace_root`, relative to it.
///
/// Git records every linked worktree under `<git-dir>/worktrees/<name>`, so
/// reading that directory costs one `read_dir` plus a tiny file per worktree,
/// with no per-directory probing of the workspace and no subprocess.
/// Worktrees outside `workspace_root` are dropped: the walker never reaches
/// them.
///
/// Submodules are deliberately not included. They use the same gitfile
/// mechanism but are registered under `<git-dir>/modules/`, and their
/// contents are real workspace files that Nx should keep scanning.
pub fn nested_linked_worktrees<P: AsRef<Path>>(workspace_root: P) -> Vec<PathBuf> {
    let workspace_root = workspace_root.as_ref();

    // Revalidating costs one `stat` of the registry git already tracks. Every
    // other step - the walk up to the git root, the `commondir` read, the
    // `read_dir` - is skipped, which is the whole point: those are what made
    // this measurable on walks that can never contain a worktree.
    if let Some(cached) = NESTED_WORKTREES.get(workspace_root) {
        if modified_at(&cached.registry) == cached.signature {
            return cached.roots.clone();
        }
    }

    // `gitdir` files hold canonical paths, while the walk root may reach the
    // same directory through a symlink or a relative path - canonicalize both
    // sides so the prefix comparison lines up.
    let canonical_root = canonicalize_or_own(workspace_root);
    // Where a `read_dir` would look, and the path whose mtime decides whether
    // a cached answer is still good. Absent when the root is in no repository
    // at all, in which case `.git` appearing is the thing to watch for.
    let registry = registry_dir(workspace_root).unwrap_or_else(|| canonical_root.join(".git"));
    let signature = modified_at(&registry);

    let roots = read_nested_linked_worktrees(&registry, &canonical_root);
    NESTED_WORKTREES.insert(
        workspace_root.to_path_buf(),
        CachedWorktrees {
            registry,
            signature,
            roots: roots.clone(),
        },
    );
    roots
}

/// `<git-dir>/worktrees` for `workspace_root`, wherever git keeps it.
fn registry_dir(workspace_root: &Path) -> Option<PathBuf> {
    let git_dir = find_git_root(workspace_root)
        .as_deref()
        .and_then(resolve_git_dir)?;
    // No `commondir` means `git_dir` is already the common directory - the
    // ordinary case of running from the main repository rather than a
    // worktree of it.
    let common_dir = common_git_dir(&git_dir).unwrap_or(git_dir);
    Some(common_dir.join("worktrees"))
}

fn modified_at(path: &Path) -> Option<SystemTime> {
    std::fs::metadata(path).ok()?.modified().ok()
}

struct CachedWorktrees {
    registry: PathBuf,
    signature: Option<SystemTime>,
    roots: Vec<PathBuf>,
}

/// Answers for one workspace root, revalidated on every call.
///
/// Resolving from scratch is a walk up to the git root, a `commondir` read
/// and a `read_dir` - measured at ~7us, and paid on every walk including the
/// task-output walks in `expand_outputs`, which can never contain a worktree.
/// Git touches `<git-dir>/worktrees` whenever one is added or removed, so one
/// `stat` of that directory stands in for all of it. A worktree created while
/// the daemon is running is still picked up on the next walk, which is the
/// property resolving per walk was for.
static NESTED_WORKTREES: LazyLock<DashMap<PathBuf, CachedWorktrees>> = LazyLock::new(DashMap::new);

fn read_nested_linked_worktrees(registry: &Path, canonical_root: &Path) -> Vec<PathBuf> {
    let Ok(entries) = registry.read_dir() else {
        return Vec::new();
    };

    entries
        .filter_map(|entry| {
            let metadata_dir = entry.ok()?.path();
            // Points at the worktree's own `.git` gitfile, so its parent is
            // the worktree root.
            let gitfile = read_path_file(&metadata_dir.join("gitdir"), &metadata_dir)?;
            // A registration outlives a worktree deleted by hand, so only
            // prune while the gitfile is actually there. Otherwise an
            // ordinary directory later created at the same path - before
            // anyone ran `git worktree prune` - would vanish from the graph.
            if !gitfile.is_file() {
                return None;
            }

            let worktree_root = canonicalize_or_own(gitfile.parent()?);

            let relative = worktree_root.strip_prefix(&canonical_root).ok()?;
            // An empty path means the workspace root *is* the worktree -
            // running Nx from inside one is ordinary. The watcher joins these
            // onto its origin and blocks every path under them, so an empty
            // entry would silence the watcher permanently. (The walker is
            // unharmed on its own: `ignore` never applies `filter_entry` to
            // the walk root.)
            (!relative.as_os_str().is_empty()).then(|| relative.to_path_buf())
        })
        .collect()
}

/// Fixtures shared by every test module that needs a repository laid out the
/// way git lays one out. Kept in one place because the layout is exactly what
/// the production code reads: a fixture that omits `commondir` or `gitdir`
/// silently stops exercising the real discriminators.
#[cfg(test)]
pub(crate) mod test_support {
    use std::fs::{create_dir_all, write};
    use std::path::{Path, PathBuf};

    /// Registers `worktree_root` as a linked worktree of `repo`, byte-for-byte
    /// the way `git worktree add` does: an absolute path in each of the two
    /// gitfiles, and a relative `commondir` pointing back at the main `.git`.
    pub fn register_worktree(repo: &Path, name: &str, worktree_root: &Path) {
        let metadata_dir = register_worktree_mid_write(repo, name, worktree_root);
        // `commondir` is how a worktree finds the repository it belongs to.
        write(metadata_dir.join("commondir"), "../..\n").unwrap();
    }

    /// The state `git worktree add` leaves behind between writing the
    /// checkout's gitfile and writing `commondir`, returning the metadata
    /// directory. The watcher sees a worktree in exactly this state: it acts
    /// on the gitfile's creation event, and git writes `commondir` after it.
    ///
    /// Ordering verified against git 2.44 by mtime - `gitdir`, then the
    /// checkout's `.git`, then `commondir`.
    pub fn register_worktree_mid_write(repo: &Path, name: &str, worktree_root: &Path) -> PathBuf {
        let metadata_dir = repo.join(".git").join("worktrees").join(name);
        create_dir_all(&metadata_dir).unwrap();
        create_dir_all(worktree_root).unwrap();
        write(
            metadata_dir.join("gitdir"),
            format!("{}\n", worktree_root.join(".git").display()),
        )
        .unwrap();
        write(
            worktree_root.join(".git"),
            format!("gitdir: {}\n", metadata_dir.display()),
        )
        .unwrap();
        metadata_dir
    }

    /// Registers `submodule_path` (relative to `repo`) as a submodule, the way
    /// `git submodule add` does: a *relative* gitfile pointing into
    /// `<git-dir>/modules/<submodule-path>`, and no `commondir`.
    pub fn register_submodule(repo: &Path, submodule_path: &str) {
        let git_dir = repo.join(".git").join("modules").join(submodule_path);
        create_dir_all(&git_dir).unwrap();
        let submodule_root = repo.join(submodule_path);
        create_dir_all(&submodule_root).unwrap();

        let up = "../".repeat(Path::new(submodule_path).components().count());
        write(
            submodule_root.join(".git"),
            format!("gitdir: {up}.git/modules/{submodule_path}\n"),
        )
        .unwrap();
    }
}

#[cfg(test)]
mod test {
    use std::fs::{create_dir_all, remove_dir_all, write};

    use assert_fs::TempDir;

    use super::test_support::{register_submodule, register_worktree, register_worktree_mid_write};
    use super::*;

    #[test]
    fn a_worktree_is_a_worktree_before_git_writes_commondir() {
        // Regression: the discriminator used to be `commondir`, which
        // `git worktree add` writes *after* the checkout's gitfile. The
        // watcher acts on that gitfile's creation event, so it asked while
        // `commondir` was still missing and let the whole new checkout
        // through - the exact workflow the prune exists for. Timing decided
        // it, so CI failed on Linux (fast inotify) and passed on macOS.
        let temp = TempDir::new().unwrap();
        create_dir_all(temp.path().join(".git")).unwrap();

        let worktree = temp.path().join("wt");
        let metadata_dir = register_worktree_mid_write(temp.path(), "wt", &worktree);
        assert!(!metadata_dir.join("commondir").exists());

        assert!(is_linked_worktree_root(&worktree));
    }

    #[test]
    fn identifies_linked_worktree_roots() {
        let temp = TempDir::new().unwrap();
        create_dir_all(temp.path().join(".git")).unwrap();

        let worktree = temp.path().join("wt");
        register_worktree(temp.path(), "wt", &worktree);
        assert!(is_linked_worktree_root(&worktree));

        // A submodule's gitfile is identical in shape - only the directory it
        // points at differs, and only by what git writes inside it.
        register_submodule(temp.path(), "libs/sub");
        assert!(!is_linked_worktree_root(temp.path().join("libs/sub")));

        assert!(!is_linked_worktree_root(temp.path().join("libs")));
    }

    #[test]
    fn a_submodule_under_a_worktrees_path_is_not_a_worktree() {
        // Git registers a submodule at `<git-dir>/modules/<its path>`, so a
        // submodule anywhere below a directory named `worktrees` resolves to
        // `.git/modules/packages/worktrees/foo` - whose parent segment is
        // `worktrees`. Misreading that as a worktree drops a real project's
        // files from the watcher.
        let temp = TempDir::new().unwrap();
        create_dir_all(temp.path().join(".git")).unwrap();
        register_submodule(temp.path(), "packages/worktrees/foo");

        assert!(!is_linked_worktree_root(
            temp.path().join("packages/worktrees/foo")
        ));
    }

    #[test]
    fn a_dangling_worktree_is_not_a_worktree_root() {
        // `git worktree add` writes an *absolute* path into the worktree's
        // gitfile, so moving or deleting the main clone leaves the worktree
        // pointing at nothing. Answering `true` here would send callers on to
        // resolve a repository root out of a directory that isn't there.
        let temp = TempDir::new().unwrap();
        let repo = temp.path().join("repo");
        create_dir_all(repo.join(".git")).unwrap();
        let worktree = repo.join("other/wt");
        register_worktree(&repo, "wt", &worktree);
        assert!(is_linked_worktree_root(&worktree));

        remove_dir_all(repo.join(".git")).unwrap();

        assert!(!is_linked_worktree_root(&worktree));
    }

    #[test]
    fn sees_a_worktree_created_after_an_earlier_answer_was_cached() {
        // The per-walk resolution existed so a worktree added while the daemon
        // runs is picked up on the next graph construction. The cache keeps
        // that by revalidating against the registry's mtime.
        let temp = TempDir::new().unwrap();
        create_dir_all(temp.path().join(".git")).unwrap();

        assert!(nested_linked_worktrees(temp.path()).is_empty());

        register_worktree(temp.path(), "wt", &temp.path().join("nested/wt"));

        assert_eq!(
            nested_linked_worktrees(temp.path()),
            vec![PathBuf::from("nested/wt")]
        );
    }

    #[test]
    fn sees_a_second_worktree_added_after_the_first() {
        let temp = TempDir::new().unwrap();
        create_dir_all(temp.path().join(".git")).unwrap();
        register_worktree(temp.path(), "one", &temp.path().join("wt1"));

        assert_eq!(nested_linked_worktrees(temp.path()).len(), 1);

        register_worktree(temp.path(), "two", &temp.path().join("wt2"));

        let mut found = nested_linked_worktrees(temp.path());
        found.sort();
        assert_eq!(
            found,
            vec![PathBuf::from("wt1"), PathBuf::from("wt2")],
            "a worktree added after a cached answer must still be seen"
        );
    }

    #[test]
    fn returns_nothing_without_a_git_repo() {
        let temp = TempDir::new().unwrap();
        assert!(nested_linked_worktrees(temp.path()).is_empty());
    }

    #[test]
    fn returns_nothing_when_the_repo_has_no_worktrees() {
        let temp = TempDir::new().unwrap();
        create_dir_all(temp.path().join(".git")).unwrap();
        assert!(nested_linked_worktrees(temp.path()).is_empty());
    }

    #[test]
    fn drops_worktrees_outside_the_workspace() {
        let temp = TempDir::new().unwrap();
        let workspace = temp.path().join("workspace");
        create_dir_all(workspace.join(".git")).unwrap();

        register_worktree(&workspace, "inside", &workspace.join("nested/wt"));
        // `git worktree add ../elsewhere` - registered, but the walker never
        // reaches it, so it must not turn into a bogus relative path.
        register_worktree(&workspace, "outside", &temp.path().join("elsewhere"));

        // `read_dir` order is not defined, so compare as a set.
        let mut found = nested_linked_worktrees(&workspace);
        found.sort();
        assert_eq!(found, vec![PathBuf::from("nested/wt")]);
    }

    #[test]
    fn ignores_a_stale_worktree_registration() {
        let temp = TempDir::new().unwrap();
        create_dir_all(temp.path().join(".git")).unwrap();
        register_worktree(temp.path(), "gone", &temp.path().join("wt"));
        // Worktree deleted by hand, before `git worktree prune` ran.
        remove_dir_all(temp.path().join("wt")).unwrap();

        assert!(nested_linked_worktrees(temp.path()).is_empty());

        // The registration still names `wt`. Recreated as ordinary source, it
        // has to stay scannable - pruning it would drop projects silently.
        create_dir_all(temp.path().join("wt")).unwrap();
        write(temp.path().join("wt").join("lib.ts"), "x").unwrap();

        assert!(nested_linked_worktrees(temp.path()).is_empty());
    }
}
