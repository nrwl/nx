mod git_utils;
pub(crate) mod types;
mod utils;
mod watch_filterer;
mod watcher;

pub(crate) use watcher::{FlushMode, WatchEventCallback, WatchSession, default_watch_globs};
