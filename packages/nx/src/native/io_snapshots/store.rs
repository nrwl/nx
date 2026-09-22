use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;

use napi::bindgen_prelude::External;
use tracing::debug;

use super::bundle;
use super::db::{self, Db};
use super::{IoSnapshotImportOptions, IoSnapshotResolution, IoSnapshots, StoredEntry};
use crate::native::utils::time::current_timestamp_millis;

const DEFAULT_RETAIN: u32 = 5;

/// The workspace database's snapshot sets, one per commit. A failed import
/// throws with a `code` JS maps to a skip reason: `INVALID_RESPONSE` or
/// `WRITE_FAILED`.
#[napi]
pub struct IoSnapshotStore {
    db: Db,
}

#[napi]
impl IoSnapshotStore {
    #[napi(constructor)]
    pub fn new(#[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db: &External<Db>) -> Self {
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
        db::normalize(&mut snapshots);
        let mut source_commits: Vec<String> =
            snapshots.values().map(|s| s.commit.clone()).collect();
        source_commits.sort();
        source_commits.dedup();
        let resolution = IoSnapshotResolution {
            requested_commit: options.requested_commit.clone(),
            commits: options.commits,
            source_commits,
            digest: db::digest(&snapshots),
            fetched_at: current_timestamp_millis(),
            updated_at: options.updated_at,
            client_version: options.client_version.unwrap_or_else(|| "nx".to_string()),
            tasks: snapshots.len() as u32,
        };
        let bundle = db::Bundle {
            resolution: resolution.clone(),
            snapshots,
        };
        db::write(
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
        Ok(IoSnapshots::new(resolution, Arc::clone(&self.db), entries))
    }

    /// The stored set for `commit`, without touching the network; `null`
    /// when none is stored, its row cannot be read, or it was fetched more
    /// than `max_age_ms` ago. Reads only the commit's summary row.
    #[napi]
    pub fn get(&self, commit: String, max_age_ms: Option<i64>) -> Option<IoSnapshots> {
        let resolution = match db::read_resolution(&self.db, &commit) {
            Ok(resolution) => resolution?,
            Err(err) => {
                debug!("io snapshots: the stored set for {commit} is unreadable: {err}");
                return None;
            }
        };
        if max_age_ms.is_some_and(|max| current_timestamp_millis() - resolution.fetched_at > max) {
            return None;
        }
        Some(IoSnapshots::new(
            resolution,
            Arc::clone(&self.db),
            HashMap::new(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::db::initialize::initialize_db;
    use crate::native::io_snapshots::bundle;
    use std::sync::Mutex;

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
        db::write(
            &store.db,
            &db::Bundle {
                resolution: stored.resolution(),
                snapshots: BTreeMap::new(),
            },
            5,
        )
        .unwrap();
        assert!(
            db::read_entries(&store.db, "head", &["web:build"])
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
        db::write(
            &store.db,
            &db::Bundle {
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
