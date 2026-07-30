use crate::native::utils::git::{common_git_dir, is_linked_worktree_root, read_gitfile};
use dashmap::DashMap;
use std::path::Path;
use std::sync::LazyLock;

/// Keyed by workspace root: a process can resolve more than one, and the
/// answer is only stable per root.
static MAIN_WORKTREE_ROOT: LazyLock<DashMap<String, Option<String>>> = LazyLock::new(DashMap::new);

/// If `workspace_root` is inside a git worktree, returns the main repo root.
/// Returns `None` when already in the main repo (or not in a git repo at all).
#[napi]
pub fn get_main_worktree_root(workspace_root: String) -> anyhow::Result<Option<String>> {
    if let Some(cached) = MAIN_WORKTREE_ROOT.get(&workspace_root) {
        return Ok(cached.clone());
    }

    let resolved = resolve_main_worktree_root(&workspace_root);
    MAIN_WORKTREE_ROOT.insert(workspace_root, resolved.clone());
    Ok(resolved)
}

fn resolve_main_worktree_root(workspace_root: &str) -> Option<String> {
    let root = Path::new(workspace_root);

    // Only a linked worktree shares a repository with a main root. A
    // submodule also replaces `.git` with a gitfile, but it is an
    // independent repository - its cache belongs to itself.
    if !is_linked_worktree_root(root) {
        return None;
    }

    // The gitfile points at `<main>/.git/worktrees/<name>`, whose `commondir`
    // points back at `<main>/.git`.
    let git_dir = read_gitfile(&root.join(".git"), root)?;
    let common_dir = common_git_dir(&git_dir);

    // Resolve symlinks and ".." segments so the path is clean and
    // comparable across worktrees (e.g., in reset's equality check)
    let common_dir = common_dir.canonicalize().unwrap_or(common_dir);

    // The common dir is the .git directory — its parent is the repo root
    Some(common_dir.parent()?.to_string_lossy().to_string())
}

#[cfg(test)]
mod test {
    use std::fs::{create_dir_all, remove_dir_all};

    use assert_fs::TempDir;

    use crate::native::utils::git::test_support::{register_submodule, register_worktree};

    use super::*;

    #[test]
    fn main_repo_has_no_main_worktree_root() {
        let temp = TempDir::new().unwrap();
        create_dir_all(temp.path().join(".git")).unwrap();

        assert_eq!(
            resolve_main_worktree_root(temp.path().to_str().unwrap()),
            None
        );
    }

    #[test]
    fn resolves_the_repo_root_from_inside_a_worktree() {
        let temp = TempDir::new().unwrap();
        let repo = temp.path().join("repo");
        create_dir_all(repo.join(".git")).unwrap();
        let worktree = repo.join("other/wt");
        register_worktree(&repo, "wt", &worktree);

        let resolved = resolve_main_worktree_root(worktree.to_str().unwrap()).unwrap();

        assert_eq!(
            Path::new(&resolved),
            repo.canonicalize().unwrap_or(repo.clone())
        );
    }

    #[test]
    fn a_submodule_is_not_a_worktree() {
        let temp = TempDir::new().unwrap();
        create_dir_all(temp.path().join(".git")).unwrap();
        register_submodule(temp.path(), "libs/sub");

        // A submodule is its own repository - colocating its cache under the
        // superproject's `.git/modules` would be wrong.
        assert_eq!(
            resolve_main_worktree_root(temp.path().join("libs/sub").to_str().unwrap()),
            None
        );
    }

    #[test]
    fn a_submodule_under_a_worktrees_path_is_not_a_worktree() {
        // `.git/modules/packages/worktrees/foo` has `worktrees` as its parent
        // segment, exactly like a real worktree's metadata directory. Reading
        // it as one would put this submodule workspace's cache and SQLite
        // database inside the superproject's git directory.
        let temp = TempDir::new().unwrap();
        create_dir_all(temp.path().join(".git")).unwrap();
        register_submodule(temp.path(), "packages/worktrees/foo");

        assert_eq!(
            resolve_main_worktree_root(
                temp.path().join("packages/worktrees/foo").to_str().unwrap()
            ),
            None
        );
    }

    #[test]
    fn a_dangling_worktree_has_no_main_root() {
        // `git worktree add` records an absolute path, so moving or deleting
        // the main clone dangles every worktree it created. Guessing a root
        // here lands Nx's cache and workspace-data under
        // `<main>/.git/worktrees/.nx` - a path `git worktree prune` (and so
        // `git gc`) deletes, taking the database with it.
        let temp = TempDir::new().unwrap();
        let repo = temp.path().join("repo");
        create_dir_all(repo.join(".git")).unwrap();
        let worktree = repo.join("other/wt");
        register_worktree(&repo, "wt", &worktree);

        remove_dir_all(repo.join(".git")).unwrap();

        assert_eq!(resolve_main_worktree_root(worktree.to_str().unwrap()), None);
    }

    #[test]
    fn caches_per_workspace_root() {
        let temp = TempDir::new().unwrap();
        let repo = temp.path().join("repo");
        create_dir_all(repo.join(".git")).unwrap();
        let worktree = repo.join("wt");
        register_worktree(&repo, "wt", &worktree);

        // The main repo answers None while the worktree answers the repo
        // root; a cache shared across roots would return one for both.
        let from_main = get_main_worktree_root(repo.to_str().unwrap().to_string()).unwrap();
        let from_worktree = get_main_worktree_root(worktree.to_str().unwrap().to_string()).unwrap();

        assert_eq!(from_main, None);
        assert!(from_worktree.is_some());
        assert_eq!(
            get_main_worktree_root(repo.to_str().unwrap().to_string()).unwrap(),
            None
        );
    }
}
