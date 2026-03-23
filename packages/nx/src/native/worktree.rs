use std::path::{Path, PathBuf};

/// If `workspace_root` is inside a git worktree, returns the main repo root.
/// Returns `None` when already in the main repo (or not in a git repo at all).
#[napi]
pub fn get_main_worktree_root(workspace_root: String) -> anyhow::Result<Option<String>> {
    let git_path = Path::new(&workspace_root).join(".git");

    // If .git is a directory (not a file), this is the main repo — not a worktree
    if !git_path.is_file() {
        return Ok(None);
    }

    // In a worktree, .git is a file pointing to the main repo's .git dir.
    // Use git to find the common dir shared across all worktrees.
    let output = std::process::Command::new("git")
        .args(["rev-parse", "--git-common-dir"])
        .current_dir(&workspace_root)
        .output()?;

    if !output.status.success() {
        return Ok(None);
    }

    let git_common_dir = String::from_utf8(output.stdout)?.trim().to_string();
    let abs_path = if Path::new(&git_common_dir).is_absolute() {
        PathBuf::from(&git_common_dir)
    } else {
        PathBuf::from(&workspace_root).join(&git_common_dir)
    };

    // Resolve symlinks and ".." segments so the path is clean and
    // comparable across worktrees (e.g., in reset's equality check)
    let abs_path = abs_path.canonicalize().unwrap_or(abs_path);

    // The common dir is the .git directory — its parent is the repo root
    let main_root = abs_path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Cannot determine main repo root"))?;

    Ok(Some(main_root.to_string_lossy().to_string()))
}
