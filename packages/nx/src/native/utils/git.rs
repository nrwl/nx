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
fn read_gitfile(gitfile: &Path, base: &Path) -> Option<PathBuf> {
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
fn common_git_dir(git_dir: &Path) -> PathBuf {
    let Ok(contents) = read_to_string(git_dir.join("commondir")) else {
        return git_dir.to_path_buf();
    };

    let target = Path::new(contents.trim());
    if target.is_absolute() {
        target.to_path_buf()
    } else {
        canonicalize_or_own(&git_dir.join(target))
    }
}

/// Roots of git's linked worktrees (`git worktree add`) that live inside
/// `workspace_root`, relative to it.
///
/// Git records every linked worktree under `<git-dir>/worktrees/<name>`, so
/// reading that directory costs one `read_dir` plus a tiny file per worktree
/// - no per-directory probing of the workspace, and no subprocess. Worktrees
/// outside `workspace_root` are dropped: the walker never reaches them.
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
            // An empty path means the workspace root *is* the worktree.
            // Pruning that would discard the whole walk.
            (!relative.as_os_str().is_empty()).then(|| relative.to_path_buf())
        })
        .collect()
}

#[cfg(test)]
mod test {
    use std::fs::{create_dir_all, write};

    use assert_fs::TempDir;

    use super::*;

    fn register_worktree(repo: &Path, name: &str, worktree_root: &Path) {
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

        assert_eq!(
            nested_linked_worktrees(&workspace),
            vec![PathBuf::from("nested/wt")]
        );
    }

    #[test]
    fn ignores_a_stale_worktree_registration() {
        let temp = TempDir::new().unwrap();
        create_dir_all(temp.path().join(".git")).unwrap();
        register_worktree(temp.path(), "gone", &temp.path().join("wt"));
        // Worktree deleted by hand, before `git worktree prune` ran.
        std::fs::remove_dir_all(temp.path().join("wt")).unwrap();

        assert!(nested_linked_worktrees(temp.path()).is_empty());

        // The registration still names `wt`. Recreated as ordinary source, it
        // has to stay scannable - pruning it would drop projects silently.
        create_dir_all(temp.path().join("wt")).unwrap();
        write(temp.path().join("wt").join("lib.ts"), "x").unwrap();

        assert!(nested_linked_worktrees(temp.path()).is_empty());
    }
}
