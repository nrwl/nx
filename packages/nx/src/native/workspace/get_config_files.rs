use crate::native::utils::glob::build_glob_set;
use crate::native::utils::path::Normalize;
use crate::native::walker::nx_walker;
use crate::native::workspace::types::ConfigurationParserResult;

use std::path::PathBuf;

#[napi]
/// Get workspace config files based on provided globs
pub fn get_project_configuration_files(
    workspace_root: String,
    globs: Vec<String>,
) -> napi::Result<Vec<String>> {
    let globs = build_glob_set(&globs)?;
    let config_paths: Vec<String> = nx_walker(workspace_root, move |rec| {
        let mut config_paths: Vec<PathBuf> = Vec::new();
        for (path, _) in rec {
            if globs.is_match(&path) {
                config_paths.push(path);
            }
        }

        config_paths
            .into_iter()
            .map(|p| p.to_normalized_string())
            .collect()
    });

    Ok(config_paths)
}

#[napi]
/// Get workspace config files based on provided globs
pub fn get_project_configurations<ConfigurationParser>(
    workspace_root: String,
    globs: Vec<String>,
    parse_configurations: ConfigurationParser,
) -> napi::Result<ConfigurationParserResult>
where
    ConfigurationParser: Fn(Vec<String>) -> napi::Result<ConfigurationParserResult>,
{
    let config_paths: Vec<String> = get_project_configuration_files(workspace_root, globs).unwrap();

    parse_configurations(config_paths)
}

#[cfg(test)]
mod test {}
