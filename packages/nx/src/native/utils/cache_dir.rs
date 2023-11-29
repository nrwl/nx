use crate::native::utils::path::normalize_os_path;
use crate::native::utils::read_nx_json;
use std::path::{Path, PathBuf};

pub fn cache_directory<P: AsRef<Path>>(root: P) -> PathBuf {
    let cache_dir = std::env::var("NX_CACHE_DIRECTORY")
        .ok()
        .map(|env_dir| root.as_ref().join(env_dir))
        .or_else(|| read_cache_directory_property(&root))
        .unwrap_or_else(|| default_cache_directory(&root));
    normalize_os_path(&cache_dir)
}

fn read_cache_directory_property<P: AsRef<Path>>(root: P) -> Option<PathBuf> {
    let nx_json = read_nx_json(&root)?;

    let cache_dir = nx_json.cache_directory.as_deref().or_else(|| {
        nx_json
            .task_runner_options
            .as_ref()
            .and_then(|task_runner_options| task_runner_options.get("default"))
            .and_then(|default_object| default_object.get("options"))
            .and_then(|options_object| options_object.get("cacheDirectory"))
            .and_then(|cache_dir| cache_dir.as_str())
    });

    cache_dir.map(|cache_dir| root.as_ref().join(cache_dir))
}

fn default_cache_directory<P: AsRef<Path>>(root: P) -> PathBuf {
    let lerna_json = root.as_ref().join("lerna.json");
    let nx_json = root.as_ref().join("nx.json");

    if lerna_json.exists() && !nx_json.exists() {
        root.as_ref().join("node_modules/.cache/nx/")
    } else {
        root.as_ref().join(".nx/cache/")
    }
}
