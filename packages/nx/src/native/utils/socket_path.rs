use sha2::{Digest, Sha256};
use std::env;
use std::fs;
use std::path::PathBuf;

const DAEMON_DIR_FOR_CURRENT_WORKSPACE: &str = "./nx/workspace-data/d";

fn socket_dir_name(workspace_root: &str, unique_name: Option<&'static str>) -> PathBuf {
    let mut hasher = Sha256::new();
    hasher.update(workspace_root.to_lowercase());
    if let Some(name) = unique_name {
        hasher.update(name)
    }
    let result = hasher.finalize();

    let result_hex = format!("{:x}", result);
    let unique = result_hex.chars().take(20).collect::<String>();

    let temp_dir = std::env::temp_dir();
    temp_dir.join(unique)
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
            Err(_) => PathBuf::from(DAEMON_DIR_FOR_CURRENT_WORKSPACE),
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
