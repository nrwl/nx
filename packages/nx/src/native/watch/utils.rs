use notify::Event;
use tracing::trace;

/// On Linux, canonicalize event paths to resolve symlinks.
/// Returns a new event with canonicalized paths, or the original event on other platforms.
pub(super) fn canonicalize_event_paths(event: &Event) -> Event {
    if cfg!(target_os = "linux") {
        let mut event = event.clone();
        for path in &mut event.paths {
            trace!("canonicalizing {:?}", path);
            if let Ok(real_path) = dunce::canonicalize(&path) {
                trace!("real path {:?}", real_path);
                *path = real_path;
            }
        }
        event
    } else {
        event.clone()
    }
}
