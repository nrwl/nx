use crate::native::parallel_walker::nx_walker;
use crate::native::utils::glob::build_glob_set;

#[napi]
/// Get workspace config files based on provided globs
pub fn get_config_files(workspace_root: String, globs: Vec<String>) -> anyhow::Result<Vec<String>> {
    let globs = build_glob_set(globs)?;
    Ok(nx_walker(workspace_root, move |rec| {
        let mut config_paths: Vec<String> = vec![];
        for (path, _) in rec {
            if globs.is_match(&path) {
                config_paths.push(path.to_owned());
            }
        }
        config_paths
    }))
}
