use std::fs::read_to_string;
use std::path::{Path, PathBuf};

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
/// Only a linked worktree's metadata directory carries `commondir`. Anywhere
/// else (the main repository's own `.git`, a submodule's `.git/modules/<..>`)
/// its absence is git's way of saying this *is* the common directory, which
/// is what the fallback returns. Call this only for a git dir already known
/// to belong to a worktree ([`is_linked_worktree_root`]), or that fallback
/// answers a different question than the caller asked.
pub fn common_git_dir(git_dir: &Path) -> PathBuf {
    read_path_file(&git_dir.join("commondir"), git_dir).unwrap_or_else(|| git_dir.to_path_buf())
}

/// Whether `path` is the root of a git linked worktree.
///
/// A worktree and a submodule both replace `.git` with a gitfile, so the
/// gitfile alone can't separate them - what does is that git writes
/// `commondir` into a worktree's metadata directory and never into a
/// submodule's. The path a gitfile points *at* is not a reliable
/// discriminator: a submodule at `packages/worktrees/foo` is registered under
/// `.git/modules/packages/worktrees/foo`, whose parent segment is
/// `worktrees` too.
///
/// A dangling worktree - one whose main clone has been moved or deleted,
/// which the absolute path in the gitfile does nothing to survive - answers
/// `false`, because the metadata directory it names isn't there to hold a
/// `commondir`.
///
/// Costs one read plus one stat, so it suits deciding about a single
/// directory (a watch event) rather than scanning a whole workspace; use
/// [`nested_linked_worktrees`] for that.
pub fn is_linked_worktree_root<P: AsRef<Path>>(path: P) -> bool {
    let path = path.as_ref();
    let Some(git_dir) = read_gitfile(&path.join(".git"), path) else {
        return false;
    };

    git_dir.join("commondir").is_file()
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

    let Some(git_dir) = find_git_root(workspace_root)
        .as_deref()
        .and_then(resolve_git_dir)
    else {
        return Vec::new();
    };

    let Ok(entries) = common_git_dir(&git_dir).join("worktrees").read_dir() else {
        return Vec::new();
    };

    // `gitdir` files hold canonical paths, while the walk root may reach the
    // same directory through a symlink or a relative path - canonicalize both
    // sides so the prefix comparison lines up.
    let canonical_root = canonicalize_or_own(workspace_root);

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
    use std::path::Path;

    /// Registers `worktree_root` as a linked worktree of `repo`, byte-for-byte
    /// the way `git worktree add` does: an absolute path in each of the two
    /// gitfiles, and a relative `commondir` pointing back at the main `.git`.
    pub fn register_worktree(repo: &Path, name: &str, worktree_root: &Path) {
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
        // `commondir` is how a worktree finds the repository it belongs to,
        // and the marker that separates it from a submodule.
        write(metadata_dir.join("commondir"), "../..\n").unwrap();
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

    use super::test_support::{register_submodule, register_worktree};
    use super::*;

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
