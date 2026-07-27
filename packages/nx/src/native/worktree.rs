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
    // comparable across worktrees (e.g., in reset's equality check).
    // dunce, not std: std returns a `\\?\` verbatim path on Windows, which
    // Node's module resolution walks past the drive root on (nx#35637).
    let common_dir = dunce::canonicalize(&common_dir).unwrap_or(common_dir);

    // The common dir is the .git directory — its parent is the repo root
    Some(common_dir.parent()?.to_string_lossy().to_string())
}

#[cfg(test)]
mod test {
    use std::fs::{create_dir_all, write};
    use std::path::PathBuf;

    use assert_fs::TempDir;

    use super::*;
    use crate::native::utils::command::create_command;

    fn git(dir: &Path, args: &[&str]) {
        let output = create_command("git")
            .args(args)
            .current_dir(dir)
            .output()
            .expect("failed to run git");
        assert!(
            output.status.success(),
            "git {args:?} failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    fn init_repo(path: &Path) {
        std::fs::create_dir_all(path).unwrap();
        git(path, &["init", "-b", "main"]);
        git(
            path,
            &[
                "-c",
                "user.email=test@example.com",
                "-c",
                "user.name=Test",
                "commit",
                "--allow-empty",
                "-m",
                "init",
            ],
        );
    }

    /// Builds `<repo>/.git` plus a linked worktree at `worktree_root`, the
    /// way `git worktree add` lays it out.
    fn add_worktree(repo: &Path, name: &str, worktree_root: &Path) {
        let metadata_dir = repo.join(".git").join("worktrees").join(name);
        create_dir_all(&metadata_dir).unwrap();
        create_dir_all(worktree_root).unwrap();
        write(
            worktree_root.join(".git"),
            format!("gitdir: {}\n", metadata_dir.display()),
        )
        .unwrap();
        write(
            metadata_dir.join("gitdir"),
            format!("{}\n", worktree_root.join(".git").display()),
        )
        .unwrap();
        // `commondir` is how a worktree finds the repository it belongs to.
        write(metadata_dir.join("commondir"), "../..\n").unwrap();
    }

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
        add_worktree(&repo, "wt", &worktree);

        let resolved = resolve_main_worktree_root(worktree.to_str().unwrap()).unwrap();

        assert_eq!(
            Path::new(&resolved),
            repo.canonicalize().unwrap_or(repo.clone())
        );
    }

    #[test]
    fn a_submodule_is_not_a_worktree() {
        let temp = TempDir::new().unwrap();
        create_dir_all(temp.path().join(".git/modules/libs/sub")).unwrap();
        let submodule = temp.path().join("libs/sub");
        create_dir_all(&submodule).unwrap();
        write(
            submodule.join(".git"),
            "gitdir: ../../.git/modules/libs/sub\n",
        )
        .unwrap();

        // A submodule is its own repository - colocating its cache under the
        // superproject's `.git/modules` would be wrong.
        assert_eq!(
            resolve_main_worktree_root(submodule.to_str().unwrap()),
            None
        );
    }

    #[test]
    fn caches_per_workspace_root() {
        let temp = TempDir::new().unwrap();
        let repo = temp.path().join("repo");
        create_dir_all(repo.join(".git")).unwrap();
        let worktree = repo.join("wt");
        add_worktree(&repo, "wt", &worktree);

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

    #[test]
    fn returns_none_when_not_in_a_worktree() {
        let tmp = TempDir::new().unwrap();
        let main = tmp.path().join("main");
        init_repo(&main);

        assert_eq!(resolve_main_worktree_root(main.to_str().unwrap()), None);
    }

    #[test]
    fn resolves_main_repo_root_from_a_worktree() {
        let tmp = TempDir::new().unwrap();
        let main = tmp.path().join("main");
        init_repo(&main);

        let worktree = tmp.path().join("wt");
        git(&main, &["worktree", "add", worktree.to_str().unwrap()]);

        let resolved = resolve_main_worktree_root(worktree.to_str().unwrap())
            .expect("a linked worktree should resolve to the main repo root");

        assert_eq!(
            PathBuf::from(&resolved),
            dunce::canonicalize(&main).unwrap()
        );
        // A `\\?\` prefix here reaches cacheDir, and Node's module resolution
        // walks past the drive root on such paths (nx#35637)
        assert!(
            !resolved.starts_with(r"\\?\"),
            "expected a plain path, got verbatim: {resolved}"
        );
    }
}
