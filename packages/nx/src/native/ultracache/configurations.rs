use std::collections::HashMap;
use std::sync::Mutex;

#[cfg(not(target_arch = "wasm32"))]
use napi::{Env, bindgen_prelude::Object};

use super::UltracacheConfigurationResolution;
use super::set::SharedInputs;

/// One pinned version of a commit's configurations. Reads and caches only the
/// requested tasks, their distinct input lists, and the globs those lists use.
#[napi]
pub struct UltracacheConfigurations {
    resolution: UltracacheConfigurationResolution,
    #[cfg(not(target_arch = "wasm32"))]
    db: Option<super::store::UltracacheConfigurationStore>,
    #[cfg(not(target_arch = "wasm32"))]
    version: Option<i64>,
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
    ) -> Self {
        Self {
            resolution,
            db: Some(db),
            version,
            cache: Mutex::default(),
        }
    }

    #[cfg(all(test, not(target_arch = "wasm32")))]
    pub(super) fn cached_counts(&self) -> (usize, usize, usize) {
        let cache = self.cache.lock().unwrap();
        (cache.tasks.len(), cache.artifacts.len(), cache.globs.len())
    }
}

#[cfg(not(target_arch = "wasm32"))]
#[napi]
impl UltracacheConfigurations {
    /// An immutable, in-memory set for a single rehash. Shares input lists
    /// and glob strings across tasks and needs no temporary database.
    #[napi(factory)]
    pub fn from_entries(
        env: Env,
        requested_commit: String,
        #[napi(
            ts_arg_type = "Readonly<Record<string, { commit: string; inputs: readonly string[] }>>"
        )]
        configurations: Object<'_>,
    ) -> napi::Result<Self, String> {
        let set = super::store::compact_entries(&env, configurations)?;
        let mut artifacts = vec![SharedInputs::default(); set.inputs.len()];
        for (ids, artifact) in set.inputs {
            let mut inputs: Vec<_> = ids
                .iter()
                .map(|&id| set.globs[id as usize].clone())
                .collect();
            inputs.sort_unstable();
            artifacts[artifact as usize] = inputs.into();
        }
        let resolution = UltracacheConfigurationResolution {
            requested_commit,
            fetched_at: crate::native::utils::time::current_timestamp_millis(),
            tasks: set.tasks.len() as u32,
        };
        let tasks = set
            .tasks
            .into_iter()
            .map(|(task, id)| (task, Some(artifacts[id as usize].clone())))
            .collect();
        Ok(Self {
            resolution,
            db: None,
            version: None,
            cache: Mutex::new(EntryCache {
                tasks,
                ..Default::default()
            }),
        })
    }
}

#[napi]
impl UltracacheConfigurations {
    /// A transient handle has no stored version for cross-call plan reuse.
    #[napi(getter)]
    pub fn is_transient(&self) -> bool {
        #[cfg(not(target_arch = "wasm32"))]
        {
            self.db.is_none()
        }
        #[cfg(target_arch = "wasm32")]
        {
            false
        }
    }

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

    pub(crate) fn entries_for(
        &self,
        task_ids: &[&str],
    ) -> anyhow::Result<HashMap<String, SharedInputs>> {
        let cache = self.cache.lock().unwrap();
        #[cfg(not(target_arch = "wasm32"))]
        let mut cache = cache;
        #[cfg(not(target_arch = "wasm32"))]
        if let Some(db) = &self.db {
            let missing: Vec<&str> = task_ids
                .iter()
                .copied()
                .filter(|id| !cache.tasks.contains_key(*id))
                .collect();
            if !missing.is_empty() {
                db.read_entries(self.version, &self.resolution, &missing, &mut cache)?;
                for id in missing {
                    cache.tasks.entry(id.to_string()).or_insert(None);
                }
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
