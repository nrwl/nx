use crate::native::utils::command::create_command;
use dashmap::DashMap;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// Keyed by `workspace_root`, because the entry point takes one: a cache that
/// ignores its own argument answers for whichever root asked first.
///
/// Only tests resolve more than one root in a process today. Every production
/// caller passes the single `workspaceRoot`, so this is not the shape of a live
/// bug — it is what stops the parameter from being a lie.
static MAIN_WORKTREE_ROOTS: OnceLock<DashMap<String, Option<String>>> = OnceLock::new();

/// If `workspace_root` is inside a git worktree, returns the main repo root.
/// Returns `None` when already in the main repo (or not in a git repo at all).
#[napi]
pub fn get_main_worktree_root(workspace_root: String) -> anyhow::Result<Option<String>> {
    let cache = MAIN_WORKTREE_ROOTS.get_or_init(DashMap::new);
    if let Some(cached) = cache.get(&workspace_root) {
        return Ok(cached.clone());
    }

    let resolved = resolve_main_worktree_root(&workspace_root).unwrap_or(None);
    cache.insert(workspace_root, resolved.clone());
    Ok(resolved)
}

fn resolve_main_worktree_root(workspace_root: &str) -> anyhow::Result<Option<String>> {
    let git_path = Path::new(workspace_root).join(".git");

    // If .git is a directory (not a file), this is the main repo — not a worktree
    if !git_path.is_file() {
        return Ok(None);
    }

    // In a worktree, .git is a file pointing to the main repo's .git dir.
    // Use git to find the common dir shared across all worktrees.
    let output = create_command("git")
        .args(["rev-parse", "--git-common-dir"])
        .current_dir(workspace_root)
        .output()?;

    if !output.status.success() {
        return Ok(None);
    }

    let git_common_dir = String::from_utf8(output.stdout)?.trim().to_string();
    let abs_path = if Path::new(&git_common_dir).is_absolute() {
        PathBuf::from(&git_common_dir)
    } else {
        PathBuf::from(workspace_root).join(&git_common_dir)
    };

    // Resolve symlinks and ".." segments so the path is clean and
    // comparable across worktrees (e.g., in reset's equality check).
    // dunce, not std: std returns a `\\?\` verbatim path on Windows, which
    // Node's module resolution walks past the drive root on (nx#35637).
    let abs_path = dunce::canonicalize(&abs_path).unwrap_or(abs_path);

    // The common dir is the .git directory — its parent is the repo root
    let main_root = abs_path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Cannot determine main repo root"))?;

    Ok(Some(main_root.to_string_lossy().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

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

    #[test]
    fn returns_none_when_not_in_a_worktree() {
        let tmp = TempDir::new().unwrap();
        let main = tmp.path().join("main");
        init_repo(&main);

        assert_eq!(
            resolve_main_worktree_root(main.to_str().unwrap()).unwrap(),
            None
        );
    }

    #[test]
    fn resolves_main_repo_root_from_a_worktree() {
        let tmp = TempDir::new().unwrap();
        let main = tmp.path().join("main");
        init_repo(&main);

        let worktree = tmp.path().join("wt");
        git(&main, &["worktree", "add", worktree.to_str().unwrap()]);

        let resolved = resolve_main_worktree_root(worktree.to_str().unwrap())
            .unwrap()
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

    // The cache is process-global, so an unkeyed one hands the first caller's
    // answer to every later root. Exercised through the public entry point:
    // the tests above call `resolve_main_worktree_root` and so never touch it.
    #[test]
    fn caches_each_workspace_root_separately() {
        let tmp = TempDir::new().unwrap();
        let main = tmp.path().join("main");
        init_repo(&main);

        let worktree = tmp.path().join("wt");
        git(&main, &["worktree", "add", worktree.to_str().unwrap()]);

        // Main repo first, so a stale `None` would be what the worktree sees.
        assert_eq!(
            get_main_worktree_root(main.to_str().unwrap().to_string()).unwrap(),
            None
        );

        let from_worktree = get_main_worktree_root(worktree.to_str().unwrap().to_string())
            .unwrap()
            .expect("a linked worktree should resolve to the main repo root");
        assert_eq!(
            PathBuf::from(&from_worktree),
            dunce::canonicalize(&main).unwrap()
        );

        // Repeat both to pin that the entries did not overwrite one another.
        assert_eq!(
            get_main_worktree_root(main.to_str().unwrap().to_string()).unwrap(),
            None
        );
        assert_eq!(
            get_main_worktree_root(worktree.to_str().unwrap().to_string()).unwrap(),
            Some(from_worktree.clone())
        );

        // Now prove the second read came from the cache rather than being
        // recomputed: remove the `.git` file the resolver keys on, so a
        // recomputation could only answer `None`.
        std::fs::remove_file(worktree.join(".git")).unwrap();
        assert_eq!(
            resolve_main_worktree_root(worktree.to_str().unwrap()).unwrap(),
            None,
            "sanity: without .git the resolver cannot find the main root"
        );
        assert_eq!(
            get_main_worktree_root(worktree.to_str().unwrap().to_string()).unwrap(),
            Some(from_worktree),
            "the cached entry should survive the repo going away"
        );
    }
}
