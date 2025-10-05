use std::env;
use std::fs;
use std::path::PathBuf;

use crate::native::hasher::hash;

const DAEMON_DIR_FOR_CURRENT_WORKSPACE: &str = "./nx/workspace-data/d";

fn socket_dir_name(workspace_root: &str, unique_name: Option<&'static str>) -> PathBuf {
    let mut hashing_string = workspace_root.to_lowercase();
    if let Some(name) = unique_name {
        hashing_string.push(',');
        hashing_string.push_str(name);
    }
    let result = hash(hashing_string.as_bytes());
    let temp_dir = std::env::temp_dir();
    temp_dir.join(result)
}

fn get_socket_dir(workspace_root: &str, unique_name: Option<&'static str>) -> PathBuf {
    let dir_path = env::var("NX_SOCKET_DIR")
        .or_else(|_| env::var("NX_DAEMON_SOCKET_DIR"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| socket_dir_name(workspace_root, unique_name));

    let path = if cfg!(target_os = "windows") {
        dir_path
    } else {
        match fs::create_dir_all(&dir_path) {
            Ok(_) => dir_path,
            Err(_) => PathBuf::from(workspace_root).join(DAEMON_DIR_FOR_CURRENT_WORKSPACE),
        }
    };

    if cfg!(target_os = "windows") {
        let path_str = path.to_string_lossy();
        PathBuf::from(format!(r"\\.\pipe\nx\{}", path_str))
    } else {
        path
    }
}

pub fn get_full_os_socket_path(workspace_root: &str) -> PathBuf {
    get_socket_dir(workspace_root, None)
}

pub fn get_full_nx_console_socket_path(workspace_root: &str) -> PathBuf {
    get_socket_dir(workspace_root, Some("nx-console")).join("nx-console.sock")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_socket_dir_name_basic() {
        let root = "/tmp/test_workspace";
        let dir = socket_dir_name(root, None);
        let expected = std::env::temp_dir().join("17684150229889955837");
        assert_eq!(dir, expected);
        assert!(dir.is_absolute());
    }

    #[test]
    fn test_socket_dir_name_with_unique_name() {
        let root = "/tmp/test_workspace";
        let dir = socket_dir_name(root, Some("unique"));
        let expected = std::env::temp_dir().join("10757852796479033769");
        assert_eq!(dir, expected);
        assert!(dir.is_absolute());
    }

    #[test]
    fn test_get_socket_dir_env_var() {
        let root = "/tmp/test_workspace";
        let temp_dir = std::env::temp_dir().join("nx_test_socket_dir");
        unsafe { env::set_var("NX_SOCKET_DIR", &temp_dir) };
        let dir = get_socket_dir(root, None);
        assert_eq!(dir.to_string_lossy(), temp_dir.to_string_lossy());
        unsafe { env::remove_var("NX_SOCKET_DIR") };
    }

    #[test]
    fn test_get_full_os_socket_path() {
        let root = std::env::temp_dir().join("test_workspace");
        let path = get_full_os_socket_path(root.to_str().unwrap());
        assert!(path.is_absolute() || path.starts_with("./nx/workspace-data/d"));
    }

    #[test]
    fn test_get_full_nx_console_socket_path() {
        let root = std::env::temp_dir().join("test_workspace");
        let path = get_full_nx_console_socket_path(root.to_str().unwrap());
        assert!(path.to_string_lossy().contains("nx-console.sock"));
    }
}
