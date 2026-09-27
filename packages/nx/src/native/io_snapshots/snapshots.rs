use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use super::IoSnapshotResolution;
use super::set;
#[cfg(not(target_arch = "wasm32"))]
use super::store;

/// The store the entries are read from. The wasm build has no database, so it
/// has no store and never holds a set.
#[cfg(not(target_arch = "wasm32"))]
type Db = store::IoSnapshotStore;
#[cfg(target_arch = "wasm32")]
type Db = ();

/// One stored version of a commit's snapshot set. Handed to the hash planner as-is.
/// A fresh import holds every entry; a handle reopened from storage reads
/// them per task as they are asked for and remembers them, so it costs the
/// tasks it plans rather than the workspace's whole set.
#[napi]
#[cfg_attr(target_arch = "wasm32", allow(dead_code))]
pub struct IoSnapshots {
    resolution: IoSnapshotResolution,
    db: Db,
    entries: Mutex<HashMap<String, Option<Arc<set::TaskIoSnapshot>>>>,
}

impl IoSnapshots {
    #[cfg(not(target_arch = "wasm32"))]
    pub(super) fn new(
        resolution: IoSnapshotResolution,
        db: Db,
        entries: HashMap<String, Option<Arc<set::TaskIoSnapshot>>>,
    ) -> Self {
        Self {
            resolution,
            db,
            entries: Mutex::new(entries),
        }
    }
}

#[napi]
impl IoSnapshots {
    #[napi(getter)]
    pub fn commit(&self) -> String {
        self.resolution.requested_commit.clone()
    }

    #[napi(getter)]
    pub fn resolution(&self) -> IoSnapshotResolution {
        self.resolution.clone()
    }

    pub(crate) fn resolution_ref(&self) -> &IoSnapshotResolution {
        &self.resolution
    }

    /// The stored entries among `task_ids`; an id without one is absent.
    /// Reads each id from the database once per handle.
    pub(crate) fn entries_for(
        &self,
        task_ids: &[&str],
    ) -> anyhow::Result<HashMap<String, Arc<set::TaskIoSnapshot>>> {
        let mut entries = self.entries.lock().unwrap();
        let missing: Vec<&str> = task_ids
            .iter()
            .copied()
            .filter(|id| !entries.contains_key(*id))
            .collect();
        if !missing.is_empty() {
            #[cfg(not(target_arch = "wasm32"))]
            let read = self.db.read_entries(
                &self.resolution.requested_commit,
                self.resolution.fetched_at,
                &missing,
            )?;
            #[cfg(target_arch = "wasm32")]
            let read: Vec<(String, set::TaskIoSnapshot)> = Vec::new();
            for id in &missing {
                entries.insert((*id).to_string(), None);
            }
            for (id, entry) in read {
                entries.insert(id, Some(Arc::new(entry)));
            }
        }
        Ok(task_ids
            .iter()
            .filter_map(|id| {
                entries
                    .get(*id)
                    .and_then(|entry| entry.as_ref())
                    .map(|entry| ((*id).to_string(), Arc::clone(entry)))
            })
            .collect())
    }
}
