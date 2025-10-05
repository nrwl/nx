use std::env;
use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
const NX_CONFIG_DIR_NAME: &str = ".nx";

#[cfg(not(target_os = "windows"))]
const NX_CONFIG_DIR_NAME: &str = "nx";

/// Get the base configuration directory path.
///
/// - **Windows**: `%USERPROFILE%`
/// - **Unix**: `$XDG_CONFIG_HOME` or `$HOME/.config`
fn get_home_dir(home_dir: impl AsRef<Path>) -> PathBuf {
    if cfg!(target_os = "windows") {
        home_dir.as_ref().to_path_buf()
    } else {
        match env::var("XDG_CONFIG_HOME") {
            Ok(xdg_home) => PathBuf::from(xdg_home),
            Err(_) => home_dir.as_ref().join(".config"),
        }
    }
}

/// Get the user configuration directory for Nx.
///
/// - **Windows**: `%USERPROFILE%\.nx`
/// - **Unix**: `$XDG_CONFIG_HOME/nx` or `$HOME/.config/nx`
pub(crate) fn get_user_config_dir(home_dir: impl AsRef<Path>) -> PathBuf {
    get_home_dir(home_dir).join(NX_CONFIG_DIR_NAME)
}
