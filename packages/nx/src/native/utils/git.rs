use std::path::{Path, PathBuf};

use crate::native::utils::command::create_command;

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

/// Runs `git` in `root` and returns stdout on success.
pub fn git_stdout(root: &Path, args: &[&str]) -> Option<String> {
    let output = create_command("git")
        .args(args)
        .current_dir(root)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8(output.stdout).ok()
}

pub fn head_sha(root: &Path) -> Option<String> {
    let sha = git_stdout(root, &["rev-parse", "HEAD"])?.trim().to_string();
    is_sha(&sha).then_some(sha)
}

/// HEAD followed by its first-parent ancestors, newest first — the order the
/// Nx Cloud read endpoint expects. Shallow clones simply return less history.
pub fn first_parent_ancestry(root: &Path, max_commits: u32) -> Vec<String> {
    let max = max_commits.max(1).to_string();
    git_stdout(
        root,
        &["rev-list", "--first-parent", "--max-count", &max, "HEAD"],
    )
    .map(|out| {
        out.lines()
            .map(str::trim)
            .filter(|line| is_sha(line))
            .map(str::to_string)
            .collect()
    })
    .unwrap_or_default()
}

fn is_sha(value: &str) -> bool {
    (value.len() == 40 || value.len() == 64) && value.bytes().all(|b| b.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::TempDir;

    fn git(dir: &Path, args: &[&str]) {
        let output = create_command("git")
            .args(args)
            .current_dir(dir)
            .env("GIT_AUTHOR_NAME", "t")
            .env("GIT_AUTHOR_EMAIL", "t@t")
            .env("GIT_COMMITTER_NAME", "t")
            .env("GIT_COMMITTER_EMAIL", "t@t")
            .output()
            .expect("failed to run git");
        assert!(
            output.status.success(),
            "git {args:?} failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    fn commit(dir: &Path, msg: &str) {
        git(dir, &["commit", "--allow-empty", "-q", "-m", msg]);
    }

    #[test]
    fn lists_first_parent_ancestry_newest_first() {
        let temp = TempDir::new().unwrap();
        git(&temp, &["init", "-q"]);
        commit(&temp, "one");
        commit(&temp, "two");
        commit(&temp, "three");

        let head = head_sha(&temp).unwrap();
        let ancestry = first_parent_ancestry(&temp, 10);
        assert_eq!(ancestry.len(), 3);
        assert_eq!(ancestry[0], head);

        assert_eq!(first_parent_ancestry(&temp, 2).len(), 2);
    }

    #[test]
    fn non_repository_yields_nothing() {
        let temp = TempDir::new().unwrap();
        assert_eq!(head_sha(&temp), None);
        assert!(first_parent_ancestry(&temp, 10).is_empty());
    }
}
