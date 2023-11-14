use std::sync::Arc;

use ignore_files::IgnoreFilter;
use tracing::trace;
use watchexec::config::RuntimeConfig;
use watchexec_filterer_ignore::IgnoreFilterer;

use crate::native::watch::utils::{get_ignore_files, get_nx_ignore};
use crate::native::watch::watch_filterer::WatchFilterer;

pub(super) async fn create_runtime(
    origin: &str,
    additional_globs: &[&str],
    use_ignore: bool,
) -> napi::Result<RuntimeConfig> {
    let ignore_files = get_ignore_files(use_ignore, origin);
    let nx_ignore_file = get_nx_ignore(origin);

    trace!(
        ?use_ignore,
        ?additional_globs,
        ?ignore_files,
        "Using these ignore files for the watcher"
    );
    let mut filter = if let Some(ignore_files) = ignore_files {
        IgnoreFilter::new(origin, &ignore_files)
            .await
            .map_err(anyhow::Error::from)?
    } else {
        IgnoreFilter::empty(origin)
    };

    filter
        .add_globs(additional_globs, Some(&origin.into()))
        .map_err(anyhow::Error::from)?;

    // always add the .nxignore file after all other ignores are loaded so that it has the highest priority
    if let Some(nx_ignore_file) = nx_ignore_file {
        filter
            .add_file(&nx_ignore_file)
            .await
            .map_err(anyhow::Error::from)?;
    }

    let mut runtime = RuntimeConfig::default();
    runtime.filterer(Arc::new(WatchFilterer {
        inner: IgnoreFilterer(filter),
    }));

    // let watch_directories = get_watch_directories(origin);
    // trace!(directories = ?watch_directories, "watching");
    runtime.pathset([&origin]);
    Ok(runtime)
}
