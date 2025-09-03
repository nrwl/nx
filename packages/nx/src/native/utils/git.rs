use std::path::{Path, PathBuf};

/// Find the nearest git repository root by walking up the directory tree
pub fn find_git_root<P: AsRef<Path>>(start_path: P) -> Option<PathBuf> {
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

/// Iterator over parent .gitignore file paths based on git repository boundaries
///
/// # Behavior:
/// - If workspace is git root: yields nothing
/// - If workspace is nested in git repo: yields parents up to git root
/// - If no git repo found: yields nothing (conservative for watch, use `parent_gitignore_files_unbounded` for walker)
pub fn parent_gitignore_files<P: AsRef<Path>>(workspace_root: P) -> ParentGitignoreFiles {
    let workspace_root = workspace_root.as_ref().to_path_buf();
    let git_root = find_git_root(&workspace_root);

    ParentGitignoreFiles {
        current_path: workspace_root.parent().map(|p| p.to_path_buf()),
        git_root,
        workspace_root,
        unbounded: false,
    }
}

/// Iterator over parent .gitignore file paths with unbounded traversal when no git repo is found
///
/// # Behavior:
/// - If workspace is git root: yields nothing
/// - If workspace is nested in git repo: yields parents up to git root
/// - If no git repo found: yields all parents (for walker backwards compatibility)
pub fn parent_gitignore_files_unbounded<P: AsRef<Path>>(workspace_root: P) -> ParentGitignoreFiles {
    let workspace_root = workspace_root.as_ref().to_path_buf();
    let git_root = find_git_root(&workspace_root);

    ParentGitignoreFiles {
        current_path: workspace_root.parent().map(|p| p.to_path_buf()),
        git_root,
        workspace_root,
        unbounded: true,
    }
}

/// Iterator that yields .gitignore file paths from parent directories
pub struct ParentGitignoreFiles {
    current_path: Option<PathBuf>,
    git_root: Option<PathBuf>,
    workspace_root: PathBuf,
    unbounded: bool,
}

impl Iterator for ParentGitignoreFiles {
    type Item = PathBuf;

    fn next(&mut self) -> Option<Self::Item> {
        let current = self.current_path.as_ref()?;

        // Check our boundary conditions
        match &self.git_root {
            Some(git_root_path) if git_root_path == &self.workspace_root => {
                // The workspace IS the git root - don't traverse parents
                self.current_path = None;
                return None;
            }
            Some(git_root_path) => {
                // We're nested in a git repo - traverse up to git root
                let gitignore_path = current.join(".gitignore");

                // Move to next parent directory
                if current == git_root_path {
                    // We've reached the git root - stop after this iteration
                    self.current_path = None;
                } else {
                    self.current_path = current.parent().map(|p| p.to_path_buf());
                }

                Some(gitignore_path)
            }
            None => {
                // No git repository found
                if self.unbounded {
                    // Traverse all parents (walker backwards compatibility)
                    let gitignore_path = current.join(".gitignore");
                    self.current_path = current.parent().map(|p| p.to_path_buf());
                    Some(gitignore_path)
                } else {
                    // Be conservative and don't traverse (watch behavior)
                    self.current_path = None;
                    None
                }
            }
        }
    }
}
