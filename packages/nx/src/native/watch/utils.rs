use std::fs;
use std::path::{Path, PathBuf};
use tracing::trace;

pub(super) fn get_nx_ignore<P: AsRef<Path>>(origin: P) -> Option<PathBuf> {
    let nx_ignore_path = PathBuf::from(origin.as_ref()).join(".nxignore");
    if nx_ignore_path.exists() {
        Some(nx_ignore_path)
    } else {
        None
    }
}

/// On Linux, canonicalize event paths to resolve symlinks.
/// Returns a new event with canonicalized paths, or the original event on other platforms.
pub(super) fn canonicalize_event_paths(event: &notify::Event) -> notify::Event {
    if cfg!(target_os = "linux") {
        let mut event = event.clone();
        for path in &mut event.paths {
            trace!("canonicalizing {:?}", path);
            if let Ok(real_path) = fs::canonicalize(&path) {
                trace!("real path {:?}", real_path);
                *path = real_path;
            }
        }
        event
    } else {
        event.clone()
    }
}
