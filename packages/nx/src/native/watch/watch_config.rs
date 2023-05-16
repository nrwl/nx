use crate::native::watch::utils::{get_ignore_files, get_watch_directories};
use crate::native::watch::watch_filterer::WatchFilterer;
use ignore_files::IgnoreFilter;
use std::sync::Arc;
use tracing::trace;
use watchexec::config::{InitConfig, RuntimeConfig};
use watchexec_filterer_ignore::IgnoreFilterer;

pub(super) async fn create_config(origin: &str) -> napi::Result<(InitConfig, RuntimeConfig)> {
    let config = InitConfig::default();

    let ignore_files = get_ignore_files(origin);
    trace!(?ignore_files, "Using these ignore files for the watcher");
    let mut filter = IgnoreFilter::new(origin, &ignore_files)
        .await
        .map_err(anyhow::Error::from)?;

    filter
        .add_globs(&[".git"], Some(&origin.into()))
        .map_err(anyhow::Error::from)?;

    let mut runtime = RuntimeConfig::default();
    runtime.filterer(Arc::new(WatchFilterer {
        inner: IgnoreFilterer(filter),
    }));

    let watch_directories = get_watch_directories(origin);
    trace!(directories = ?watch_directories, "watching");
    runtime.pathset(watch_directories);
    Ok((config, runtime))
}
