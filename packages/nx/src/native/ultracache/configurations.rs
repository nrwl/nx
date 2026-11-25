use std::collections::HashMap;
use std::sync::Mutex;

use super::UltracacheConfigurationResolution;
use super::set::SharedInputs;

/// One pinned version of a commit's configurations. Reads and caches only the
/// requested tasks, their distinct input lists, and the globs those lists use.
#[napi]
pub struct UltracacheConfigurations {
    resolution: UltracacheConfigurationResolution,
    #[cfg(not(target_arch = "wasm32"))]
    db: super::store::UltracacheConfigurationStore,
    #[cfg(not(target_arch = "wasm32"))]
    version: Option<i64>,
    /// Nx Cloud asked for each task's project folder state to be hashed
    /// beside its configuration. Stored with the version, so every process
    /// that reopens it hashes the same way.
    hash_project_folder_state: bool,
    cache: Mutex<EntryCache>,
}

#[derive(Default)]
pub(super) struct EntryCache {
    pub tasks: HashMap<String, Option<SharedInputs>>,
    #[cfg(not(target_arch = "wasm32"))]
    pub artifacts: HashMap<u32, SharedInputs>,
    #[cfg(not(target_arch = "wasm32"))]
    pub globs: HashMap<u32, std::sync::Arc<str>>,
    #[cfg(not(target_arch = "wasm32"))]
    pub legacy_globs: std::collections::HashSet<std::sync::Arc<str>>,
}

impl UltracacheConfigurations {
    #[cfg(not(target_arch = "wasm32"))]
    pub(super) fn new(
        resolution: UltracacheConfigurationResolution,
        db: super::store::UltracacheConfigurationStore,
        version: Option<i64>,
        hash_project_folder_state: bool,
    ) -> Self {
        Self {
            resolution,
            db,
            version,
            hash_project_folder_state,
            cache: Mutex::default(),
        }
    }

    #[cfg(all(test, not(target_arch = "wasm32")))]
    pub(crate) fn with_project_folder_state(mut self, on: bool) -> Self {
        self.hash_project_folder_state = on;
        self
    }

    #[cfg(all(test, not(target_arch = "wasm32")))]
    pub(super) fn cached_counts(&self) -> (usize, usize, usize) {
        let cache = self.cache.lock().unwrap();
        (cache.tasks.len(), cache.artifacts.len(), cache.globs.len())
    }
}

#[napi]
impl UltracacheConfigurations {
    #[napi(getter)]
    pub fn commit(&self) -> String {
        self.resolution.requested_commit.clone()
    }

    #[napi(getter)]
    pub fn resolution(&self) -> UltracacheConfigurationResolution {
        self.resolution.clone()
    }

    pub(crate) fn resolution_ref(&self) -> &UltracacheConfigurationResolution {
        &self.resolution
    }

    pub(crate) fn hashes_project_folder_state(&self) -> bool {
        self.hash_project_folder_state
    }

    pub(crate) fn entries_for(
        &self,
        task_ids: &[&str],
    ) -> anyhow::Result<HashMap<String, SharedInputs>> {
        let mut cache = self.cache.lock().unwrap();
        let missing: Vec<&str> = task_ids
            .iter()
            .copied()
            .filter(|id| !cache.tasks.contains_key(*id))
            .collect();
        if !missing.is_empty() {
            #[cfg(not(target_arch = "wasm32"))]
            self.db
                .read_entries(self.version, &self.resolution, &missing, &mut cache)?;
            for id in missing {
                cache.tasks.entry(id.to_string()).or_insert(None);
            }
        }
        Ok(task_ids
            .iter()
            .filter_map(|id| {
                cache
                    .tasks
                    .get(*id)?
                    .as_ref()
                    .map(|inputs| ((*id).to_string(), inputs.clone()))
            })
            .collect())
    }
}
