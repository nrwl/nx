use crate::native::hasher::hash;
use crate::native::tasks::types::CwdMode;
use std::path::Path;

pub fn hash_cwd(workspace_root: &Path, cwd: &Path, mode: CwdMode) -> String {
    let path_to_hash = match mode {
        CwdMode::Absolute => cwd.to_string_lossy().into_owned(),
        CwdMode::Relative => cwd
            .strip_prefix(workspace_root)
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|_| cwd.to_string_lossy().into_owned()),
    };
    hash(path_to_hash.as_bytes())
}

#[cfg(test)]
mod test {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn should_hash_absolute_cwd() {
        let workspace_root = PathBuf::from("/home/user/workspace");
        let cwd = PathBuf::from("/home/user/workspace/packages/my-app");

        let hash_result = hash_cwd(&workspace_root, &cwd, CwdMode::Absolute);

        // Hash of the full absolute path
        assert_eq!(hash_result, hash(b"/home/user/workspace/packages/my-app"));
    }

    #[test]
    fn should_hash_relative_cwd() {
        let workspace_root = PathBuf::from("/home/user/workspace");
        let cwd = PathBuf::from("/home/user/workspace/packages/my-app");

        let hash_result = hash_cwd(&workspace_root, &cwd, CwdMode::Relative);

        // Hash of the relative path from workspace root
        assert_eq!(hash_result, hash(b"packages/my-app"));
    }

    #[test]
    fn should_fallback_to_absolute_when_cwd_not_under_workspace() {
        let workspace_root = PathBuf::from("/home/user/workspace");
        let cwd = PathBuf::from("/other/path/somewhere");

        let hash_result = hash_cwd(&workspace_root, &cwd, CwdMode::Relative);

        // Falls back to absolute path when strip_prefix fails
        assert_eq!(hash_result, hash(b"/other/path/somewhere"));
    }

    #[test]
    fn should_hash_workspace_root_as_empty_relative() {
        let workspace_root = PathBuf::from("/home/user/workspace");
        let cwd = PathBuf::from("/home/user/workspace");

        let hash_result = hash_cwd(&workspace_root, &cwd, CwdMode::Relative);

        // When cwd is workspace root, relative path is empty
        assert_eq!(hash_result, hash(b""));
    }
}
