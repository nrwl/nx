pub(crate) mod bundle;
#[cfg(not(target_arch = "wasm32"))]
pub(crate) mod store;

#[cfg(not(target_arch = "wasm32"))]
use std::collections::BTreeMap;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[cfg(not(target_arch = "wasm32"))]
use napi::bindgen_prelude::External;
use serde::{Deserialize, Serialize};
#[cfg(not(target_arch = "wasm32"))]
use tracing::debug;

#[cfg(not(target_arch = "wasm32"))]
use crate::native::utils::time::current_timestamp_millis;

#[cfg(not(target_arch = "wasm32"))]
const DEFAULT_RETAIN: u32 = 5;

/// The workspace database the entries live in. The wasm build has no
/// database, so it has no store and never holds a set.
#[cfg(not(target_arch = "wasm32"))]
type Db = store::Db;
#[cfg(target_arch = "wasm32")]
type Db = ();

/// What was resolved for a commit; stored beside its entries.
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IoSnapshotResolution {
    pub requested_commit: String,
    pub commits: Vec<String>,
    pub source_commits: Vec<String>,
    pub digest: String,
    pub fetched_at: i64,
    /// The set's `updatedAt` as Nx Cloud reported it.
    #[serde(default)]
    pub updated_at: Option<i64>,
    pub client_version: String,
    pub tasks: u32,
}

/// The snapshot set the Nx Cloud client read for HEAD, as JS hands it over.
#[napi(object)]
pub struct IoSnapshotImportOptions {
    pub requested_commit: String,
    /// The commits the client asked about, newest first.
    pub commits: Vec<String>,
    /// `Record<taskId, { commit, inputs, outputs }>` as JSON. `inputs` is an
    /// untagged shape (flat globs or the older per-project buckets) that serde
    /// reads directly; a typed napi object would have to model both.
    pub snapshots_json: String,
    pub updated_at: Option<i64>,
    pub client_version: Option<String>,
    pub retain: Option<u32>,
}

/// One task's stored entry with its own digest, computed once when read.
pub(crate) struct StoredEntry {
    pub entry: bundle::TaskIoSnapshot,
    pub digest: String,
}

impl StoredEntry {
    fn new(entry: bundle::TaskIoSnapshot) -> Self {
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
            let read = store::read_entries(&self.db, &self.resolution.requested_commit, &missing)?;
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

/// The workspace database's snapshot sets, one per commit. A failed import
/// throws with a `code` JS maps to a skip reason: `INVALID_RESPONSE` or
/// `WRITE_FAILED`.
#[cfg(not(target_arch = "wasm32"))]
#[napi]
pub struct IoSnapshotStore {
    db: Db,
}

#[cfg(not(target_arch = "wasm32"))]
#[napi]
impl IoSnapshotStore {
    #[napi(constructor)]
    pub fn new(
        #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db: &External<store::Db>,
    ) -> Self {
        Self { db: Arc::clone(db) }
    }

    /// Stores the set the Nx Cloud client read for `requested_commit`,
    /// replacing what the commit had, and returns it with every entry in hand.
    #[napi(js_name = "import")]
    pub fn import_set(
        &self,
        options: IoSnapshotImportOptions,
    ) -> napi::Result<IoSnapshots, String> {
        let mut snapshots: BTreeMap<String, bundle::TaskIoSnapshot> =
            serde_json::from_str(&options.snapshots_json).map_err(|err| {
                napi::Error::new(
                    "INVALID_RESPONSE".to_string(),
                    format!("Nx Cloud returned I/O snapshots nx cannot read: {err}"),
                )
            })?;
        store::normalize(&mut snapshots);
        let mut source_commits: Vec<String> =
            snapshots.values().map(|s| s.commit.clone()).collect();
        source_commits.sort();
        source_commits.dedup();
        let resolution = IoSnapshotResolution {
            requested_commit: options.requested_commit.clone(),
            commits: options.commits,
            source_commits,
            digest: store::digest(&snapshots),
            fetched_at: current_timestamp_millis(),
            updated_at: options.updated_at,
            client_version: options.client_version.unwrap_or_else(|| "nx".to_string()),
            tasks: snapshots.len() as u32,
        };
        let bundle = store::Bundle {
            resolution: resolution.clone(),
            snapshots,
        };
        store::write(
            &self.db,
            &bundle,
            options.retain.unwrap_or(DEFAULT_RETAIN) as usize,
        )
        .map_err(|err| napi::Error::new("WRITE_FAILED".to_string(), err.to_string()))?;
        if resolution.tasks == 0 {
            debug!(
                "io snapshots: Nx Cloud has no snapshots for any of the {} commit(s) ending at {}; every task falls back to its declared inputs",
                resolution.commits.len(),
                resolution.requested_commit
            );
        } else {
            debug!(
                "io snapshots: imported {} task(s) from {} commit(s), digest {}",
                resolution.tasks,
                resolution.source_commits.len(),
                resolution.digest
            );
        }
        // The importing process keeps what it just parsed; nothing to re-read.
        let entries = bundle
            .snapshots
            .into_iter()
            .map(|(id, entry)| (id, Some(Arc::new(StoredEntry::new(entry)))))
            .collect();
        Ok(IoSnapshots {
            resolution,
            db: Arc::clone(&self.db),
            entries: Mutex::new(entries),
        })
    }

    /// The stored set for `commit`, without touching the network; `null`
    /// when none is stored, its row cannot be read, or it was fetched more
    /// than `max_age_ms` ago. Reads only the commit's summary row.
    #[napi]
    pub fn get(&self, commit: String, max_age_ms: Option<i64>) -> Option<IoSnapshots> {
        let resolution = match store::read_resolution(&self.db, &commit) {
            Ok(resolution) => resolution?,
            Err(err) => {
                debug!("io snapshots: the stored set for {commit} is unreadable: {err}");
                return None;
            }
        };
        if max_age_ms.is_some_and(|max| current_timestamp_millis() - resolution.fetched_at > max) {
            return None;
        }
        Some(IoSnapshots {
            resolution,
            db: Arc::clone(&self.db),
            entries: Mutex::new(HashMap::new()),
        })
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    use super::*;
    use crate::native::db::initialize::initialize_db;

    fn temp_store() -> (tempfile::TempDir, IoSnapshotStore) {
        let dir = tempfile::tempdir().unwrap();
        let conn = initialize_db(&dir.path().join("test.db")).unwrap();
        let db = External::new(Arc::new(Mutex::new(conn)));
        (dir, IoSnapshotStore::new(&db))
    }

    fn import(store: &IoSnapshotStore, json: &str) -> napi::Result<IoSnapshots, String> {
        store.import_set(IoSnapshotImportOptions {
            requested_commit: "head".into(),
            commits: vec!["head".into(), "parent".into()],
            snapshots_json: json.into(),
            updated_at: Some(42),
            client_version: Some("nx/test".into()),
            retain: None,
        })
    }

    #[test]
    fn imports_a_payload_and_gets_it_back_per_task() {
        let (_dir, store) = temp_store();
        let json = r#"{
          "web:build": { "commit": "parent", "inputs": ["apps/web/src/**/*.ts", "apps/web/src/**/*.ts"], "outputs": ["dist/apps/web/**"] },
          "ui:test": { "commit": "head", "inputs": ["libs/ui/**/*.ts"], "outputs": [] }
        }"#;
        let imported = import(&store, json).unwrap();
        let resolution = imported.resolution();
        assert_eq!(resolution.tasks, 2);
        assert_eq!(resolution.source_commits, vec!["head", "parent"]);
        assert_eq!(resolution.updated_at, Some(42));
        assert_eq!(resolution.commits, vec!["head", "parent"]);
        assert_eq!(imported.commit(), "head");

        let stored = store.get("head".into(), None).unwrap();
        assert_eq!(stored.resolution().digest, resolution.digest);
        // Read per task, normalized on import: duplicates collapsed.
        let entries = stored.entries_for(&["web:build", "gone:build"]).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(
            entries["web:build"].entry.inputs,
            bundle::TaskInputs::Flat(vec!["apps/web/src/**/*.ts".into()])
        );
        assert_eq!(
            entries["web:build"].digest,
            entries["web:build"].entry.digest()
        );
        // A second ask does not go back to the database: rewrite the commit
        // without the entry and the handle still answers from memory.
        store::write(
            &store.db,
            &store::Bundle {
                resolution: stored.resolution(),
                snapshots: BTreeMap::new(),
            },
            5,
        )
        .unwrap();
        assert!(
            store::read_entries(&store.db, "head", &["web:build"])
                .unwrap()
                .is_empty()
        );
        assert_eq!(
            stored.entries_for(&["web:build", "ui:test"]).unwrap().len(),
            1
        );
        assert_eq!(stored.entries_for(&["web:build"]).unwrap().len(), 1);
    }

    #[test]
    fn leaves_out_a_set_older_than_the_age_asked_for() {
        let (_dir, store) = temp_store();
        let mut resolution = import(&store, "{}").unwrap().resolution();
        let minute = 60 * 1000;
        resolution.fetched_at -= 61 * minute;
        store::write(
            &store.db,
            &store::Bundle {
                resolution,
                snapshots: BTreeMap::new(),
            },
            5,
        )
        .unwrap();
        assert!(store.get("head".into(), Some(60 * minute)).is_none());
        assert!(store.get("head".into(), Some(62 * minute)).is_some());
        assert!(store.get("head".into(), None).is_some());
    }

    #[test]
    fn rejects_a_payload_it_cannot_read_and_stores_nothing() {
        let (_dir, store) = temp_store();
        let err = import(&store, "{ not json").err().unwrap();
        assert_eq!(err.status, "INVALID_RESPONSE");
        assert!(store.get("head".into(), None).is_none());
    }

    #[test]
    fn treats_an_unreadable_row_as_nothing_stored() {
        let (_dir, store) = temp_store();
        import(&store, "{}").unwrap();
        store
            .db
            .lock()
            .unwrap()
            .execute("UPDATE io_snapshot_bundles SET resolution = 'not json'", [])
            .unwrap();
        assert!(store.get("head".into(), None).is_none());
    }
}
