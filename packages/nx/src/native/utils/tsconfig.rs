use std::path::Path;

use anyhow::*;
use tsconfig::TsConfig;

pub fn parse_ts_config(raw_ts_config: Option<&str>) -> Result<TsConfig> {
    if let Some(raw_ts_config) = raw_ts_config {
        TsConfig::parse_str(raw_ts_config).map_err(anyhow::Error::from)
    } else {
        Ok(TsConfig {
            exclude: None,
            extends: None,
            files: None,
            include: None,
            references: None,
            type_acquisition: None,
            compiler_options: None,
        })
    }
}

pub fn read_ts_config<P: AsRef<Path>>(workspace_root: P) -> Option<String> {
    let ts_config_path = get_root_ts_config_path(workspace_root);

    if let Some(ts_config_path) = ts_config_path {
        std::fs::read_to_string(ts_config_path).ok()
    } else {
        None
    }
}

pub fn get_root_ts_config_path<P: AsRef<Path>>(workspace_root: P) -> Option<String> {
    let filenames = ["tsconfig.base.json", "tsconfig.json"];

    for filename in filenames {
        let ts_config_path = workspace_root.as_ref().join(filename);
        if ts_config_path.exists() {
            return ts_config_path.to_str().map(String::from);
        }
    }

    None
}
