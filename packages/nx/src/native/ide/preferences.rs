use crate::native::config::dir::get_user_config_dir;
use crate::native::utils::json::{JsonResult, read_json_file};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tracing::debug;

const NX_CONSOLE_PREFERENCES_FILE_NAME: &str = "ide.json";

#[napi]
#[derive(Debug, Serialize, Deserialize)]
pub struct NxConsolePreferences {
    auto_install_console: Option<bool>,
    #[serde(skip)]
    path: PathBuf,
}

#[napi]
impl NxConsolePreferences {
    #[napi(constructor)]
    pub fn new(home_dir: String) -> Self {
        let home_dir = PathBuf::from(home_dir);
        let config_dir = get_user_config_dir(home_dir);
        Self {
            auto_install_console: None,
            path: config_dir.join(NX_CONSOLE_PREFERENCES_FILE_NAME),
        }
    }

    #[napi]
    pub fn get_auto_install_preference(&mut self) -> Option<bool> {
        if let Ok(prefs) = self.load() {
            prefs.auto_install_console
        } else {
            None
        }
    }

    #[napi]
    pub fn set_auto_install_preference(&mut self, auto_install: bool) {
        self.auto_install_console = Some(auto_install);
        if let Err(err) = self.save() {
            debug!("Failed to save console preferences: {}", err);
        } else {
            debug!("Console preferences saved successfully.");
        }
    }

    fn save(&self) -> anyhow::Result<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(self)?;

        fs::write(&self.path, content)?;
        Ok(())
    }

    fn load(&self) -> JsonResult<NxConsolePreferences> {
        let mut prefs: NxConsolePreferences = read_json_file(&self.path)?;

        // Set the path field since it's skipped during deserialization
        prefs.path = self.path.clone();

        debug!("Loaded console preferences: {:?}", prefs);
        Ok(prefs)
    }
}
