use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use super::IoSnapshotResolution;
use super::bundle;
#[cfg(not(target_arch = "wasm32"))]
use super::db;

/// The workspace database the entries live in. The wasm build has no
/// database, so it has no store and never holds a set.
#[cfg(not(target_arch = "wasm32"))]
type Db = db::Db;
#[cfg(target_arch = "wasm32")]
type Db = ();

/// One task's stored entry with its own digest, computed once when read.
pub(crate) struct StoredEntry {
    pub entry: bundle::TaskIoSnapshot,
    pub digest: String,
}

impl StoredEntry {
    pub(super) fn new(entry: bundle::TaskIoSnapshot) -> Self {
        let digest = entry.digest();
        Self { entry, digest }
    }
}

/// One commit's stored snapshot set. Handed to the hash planner as-is.
/// Entries are read from the workspace database per task as they are asked
/// for, and remembered for the handle's lifetime, so a run costs the tasks it
/// plans rather than the workspace's whole set.
#[napi]
#[cfg_attr(target_arch = "wasm32", allow(dead_code))]
pub struct IoSnapshots {
    resolution: IoSnapshotResolution,
    db: Db,
    entries: Mutex<HashMap<String, Option<Arc<StoredEntry>>>>,
}

impl IoSnapshots {
    pub(super) fn new(
        resolution: IoSnapshotResolution,
        db: Db,
        entries: HashMap<String, Option<Arc<StoredEntry>>>,
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
    ) -> anyhow::Result<HashMap<String, Arc<StoredEntry>>> {
        let mut entries = self.entries.lock().unwrap();
        let missing: Vec<&str> = task_ids
            .iter()
            .copied()
            .filter(|id| !entries.contains_key(*id))
            .collect();
        if !missing.is_empty() {
            #[cfg(not(target_arch = "wasm32"))]
            let read = db::read_entries(&self.db, &self.resolution.requested_commit, &missing)?;
            #[cfg(target_arch = "wasm32")]
            let read: Vec<(String, bundle::TaskIoSnapshot)> = Vec::new();
            for id in &missing {
                entries.insert((*id).to_string(), None);
            }
            for (id, entry) in read {
                entries.insert(id, Some(Arc::new(StoredEntry::new(entry))));
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
