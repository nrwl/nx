use crate::native::utils::glob::build_glob_set;
use crate::native::utils::path::Normalize;
use crate::native::walker::nx_walker;
use globset::GlobSet;

use napi::JsObject;
use std::collections::hash_map::Entry;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[napi]
/// Get workspace config files based on provided globs
pub fn get_project_configurations<ConfigurationParser>(
    workspace_root: String,
    globs: Vec<String>,

    parse_configurations: ConfigurationParser,
) -> napi::Result<HashMap<String, JsObject>>
where
    ConfigurationParser: Fn(Vec<String>) -> napi::Result<HashMap<String, JsObject>>,
{
    let globs = build_glob_set(globs)?;
    let config_paths: Vec<String> = nx_walker(workspace_root, move |rec| {
        let mut config_paths: HashMap<PathBuf, PathBuf> = HashMap::new();
        for (path, _) in rec {
            insert_config_file_into_map(path, &mut config_paths, &globs);
        }

        config_paths
            .into_values()
            .map(|p| p.to_normalized_string())
            .collect()
    });

    parse_configurations(config_paths)
}

pub fn insert_config_file_into_map(
    path: PathBuf,
    config_paths: &mut HashMap<PathBuf, PathBuf>,
    globs: &GlobSet,
) {
    if globs.is_match(&path) {
        let parent = path.parent().unwrap_or_else(|| Path::new("")).to_path_buf();

        let file_name = path
            .file_name()
            .expect("Config paths always have file names");
        if file_name == "project.json" {
            config_paths.insert(parent, path);
        } else if file_name == "package.json" {
            match config_paths.entry(parent) {
                Entry::Occupied(mut o) => {
                    if o.get()
                        .file_name()
                        .expect("Config paths always have file names")
                        != "project.json"
                    {
                        o.insert(path);
                    }
                }
                Entry::Vacant(v) => {
                    v.insert(path);
                }
            }
        } else {
            config_paths.entry(parent).or_insert(path);
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use std::collections::HashMap;
    use std::path::PathBuf;

    #[test]
    fn should_insert_config_files_properly() {
        let mut config_paths: HashMap<PathBuf, PathBuf> = HashMap::new();
        let globs = build_glob_set(vec!["**/*".into()]).unwrap();

        insert_config_file_into_map(PathBuf::from("project.json"), &mut config_paths, &globs);
        insert_config_file_into_map(PathBuf::from("package.json"), &mut config_paths, &globs);
        insert_config_file_into_map(
            PathBuf::from("lib1/project.json"),
            &mut config_paths,
            &globs,
        );
        insert_config_file_into_map(
            PathBuf::from("lib2/package.json"),
            &mut config_paths,
            &globs,
        );

        let config_files: Vec<PathBuf> = config_paths.into_values().collect();

        assert!(config_files.contains(&PathBuf::from("project.json")));
        assert!(config_files.contains(&PathBuf::from("lib1/project.json")));
        assert!(config_files.contains(&PathBuf::from("lib2/package.json")));

        assert!(!config_files.contains(&PathBuf::from("package.json")));
    }
}
