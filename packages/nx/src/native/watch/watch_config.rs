use crate::native::watch::utils::get_ignore_files;
use crate::native::watch::watch_filterer::WatchFilterer;
use ignore_files::IgnoreFilter;
use std::sync::Arc;
use std::time::Duration;
use tracing::trace;
use watchexec::config::RuntimeConfig;
use watchexec_filterer_ignore::IgnoreFilterer;

pub(super) async fn create_runtime(
    origin: &str,
    additional_globs: &[&str],
) -> napi::Result<RuntimeConfig> {
    let ignore_files = get_ignore_files(origin);
    trace!(?ignore_files, "Using these ignore files for the watcher");
    let mut filter = IgnoreFilter::new(origin, &ignore_files)
        .await
        .map_err(anyhow::Error::from)?;

    filter
        .add_globs(&additional_globs, Some(&origin.into()))
        .map_err(anyhow::Error::from)?;

    let mut runtime = RuntimeConfig::default();
    runtime.filterer(Arc::new(WatchFilterer {
        inner: IgnoreFilterer(filter),
    }));
    runtime.action_throttle(Duration::from_millis(500));
    runtime.keyboard_emit_eof(true);

    // let watch_directories = get_watch_directories(origin);
    // trace!(directories = ?watch_directories, "watching");
    runtime.pathset([&origin]);
    Ok(runtime)
}
