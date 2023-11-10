use crate::native::glob::build_glob_set;
use crate::native::utils::path::Normalize;
use std::collections::HashMap;

use crate::native::workspace::errors::{InternalWorkspaceErrors, WorkspaceErrors};
use rayon::prelude::*;
use std::path::PathBuf;

/// Get workspace config files based on provided globs
pub(super) fn glob_files(
    globs: Vec<String>,
    files: Option<&[(PathBuf, String)]>,
) -> napi::Result<Vec<String>, WorkspaceErrors> {
    let Some(files) = files else {
        return Ok(Default::default());
    };

    let globs =
        build_glob_set(&globs).map_err(|err| InternalWorkspaceErrors::Generic(err.to_string()))?;
    Ok(files
        .par_iter()
        .map(|file| file.0.to_normalized_string())
        .filter(|path| globs.is_match(path))
        .collect())
}

/// Get workspace config files based on provided globs
pub(super) fn get_project_configurations<ConfigurationParser>(
    globs: Vec<String>,
    files: Option<&[(PathBuf, String)]>,
    parse_configurations: ConfigurationParser,
) -> napi::Result<HashMap<String, String>>
where
    ConfigurationParser: Fn(Vec<String>) -> napi::Result<HashMap<String, String>>,
{
    let config_paths = glob_files(globs, files).map_err(anyhow::Error::from)?;

    parse_configurations(config_paths)
}
