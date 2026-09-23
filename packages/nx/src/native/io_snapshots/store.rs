use std::collections::{BTreeMap, HashMap};
use std::rc::Rc;
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result};
use napi::bindgen_prelude::External;
use rusqlite::params;
use rusqlite::types::Value;
use tracing::debug;

use super::set::{ImportedSet, TaskIoSnapshot};
use super::{IoSnapshotImportOptions, IoSnapshotResolution, IoSnapshots};
use crate::native::db::connection::NxDbConnection;
use crate::native::utils::time::current_timestamp_millis;

/// The workspace database's snapshot sets. Each import is its own version,
/// keyed by commit and fetch time, so a run that pinned one keeps reading it
/// while a newer one is imported. Failures throw with a `code` JS maps to a
/// skip reason: `STORE_UNAVAILABLE`, `INVALID_RESPONSE` or `WRITE_FAILED`.
#[napi]
#[derive(Clone)]
pub struct IoSnapshotStore {
    db: Db,
}

#[napi]
impl IoSnapshotStore {
    #[napi(constructor)]
    pub fn new(
        #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db: &External<Db>,
    ) -> napi::Result<Self, String> {
        // Created here because `create_all_tables` only runs for a new database file.
        db.lock()
            .unwrap()
            .execute_batch(SCHEMA)
            .map_err(|err| napi::Error::new("STORE_UNAVAILABLE".to_string(), err.to_string()))?;
        Ok(Self { db: Arc::clone(db) })
    }

    /// Stores the set the Nx Cloud client read for `requested_commit` as a new
    /// version, and returns it with every entry in hand.
    #[napi(js_name = "import")]
    pub fn import_set(
        &self,
        options: IoSnapshotImportOptions,
    ) -> napi::Result<IoSnapshots, String> {
        let snapshots: BTreeMap<String, TaskIoSnapshot> =
            serde_json::from_str(&options.snapshots_json).map_err(|err| {
                napi::Error::new(
                    "INVALID_RESPONSE".to_string(),
                    format!("Nx Cloud returned I/O snapshots nx cannot read: {err}"),
                )
            })?;
        let set = ImportedSet::new(options.requested_commit, snapshots);
        self.write(&set)
            .map_err(|err| napi::Error::new("WRITE_FAILED".to_string(), err.to_string()))?;
        let ImportedSet {
            resolution,
            snapshots,
        } = set;
        // The importing process keeps what it just parsed; nothing to re-read.
        let entries = snapshots
            .into_iter()
            .map(|(id, entry)| (id, Some(Arc::new(entry))))
            .collect();
        Ok(IoSnapshots::new(resolution, self.clone(), entries))
    }

    /// The newest stored set for `commit`, without touching the network;
    /// `null` when none is stored, its row cannot be read, or it was fetched
    /// more than `max_age_ms` ago. Reads only the version's summary row.
    #[napi]
    pub fn get(&self, commit: String, max_age_ms: Option<i64>) -> Option<IoSnapshots> {
        let resolution = readable(&commit, self.read_resolution(&commit, None))?;
        if max_age_ms.is_some_and(|max| current_timestamp_millis() - resolution.fetched_at > max) {
            return None;
        }
        Some(IoSnapshots::new(resolution, self.clone(), HashMap::new()))
    }

    /// Exactly the version of `commit` fetched at `fetched_at`; `null` once it
    /// has been pruned or its row cannot be read.
    #[napi]
    pub fn get_version(&self, commit: String, fetched_at: i64) -> Option<IoSnapshots> {
        let resolution = readable(&commit, self.read_resolution(&commit, Some(fetched_at)))?;
        Some(IoSnapshots::new(resolution, self.clone(), HashMap::new()))
    }
}

/// An unreadable row reads as nothing stored.
fn readable(
    commit: &str,
    read: Result<Option<IoSnapshotResolution>>,
) -> Option<IoSnapshotResolution> {
    read.unwrap_or_else(|err| {
        debug!("io snapshots: the stored set for {commit} is unreadable: {err}");
        None
    })
}

pub type Db = Arc<Mutex<NxDbConnection>>;

/// Commits whose sets are kept; older ones are pruned on each write.
const RETAINED_COMMITS: i64 = 5;
/// Versions kept per commit: the newest, and the one a run that started
/// before it may still be reading.
const RETAINED_VERSIONS: i64 = 2;

/// One row per version for the set, one row per task for its entry, so a run
/// reads the tasks it plans instead of the workspace's whole set.
const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS io_snapshot_versions (
    commit_sha TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    tasks INTEGER NOT NULL,
    PRIMARY KEY (commit_sha, fetched_at)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS io_snapshot_entries (
    commit_sha TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    task_id TEXT NOT NULL,
    entry TEXT NOT NULL,
    PRIMARY KEY (commit_sha, fetched_at, task_id)
) WITHOUT ROWID;
";

/// The SQL behind the store; not exposed to JS.
impl IoSnapshotStore {
    /// Adds the set as a version of its commit and prunes to the newest
    /// commits and versions. One transaction, so a reader sees the previous
    /// set or the new one, never a gap.
    pub(super) fn write(&self, set: &ImportedSet) -> Result<()> {
        let entries: Vec<(&String, String)> = set
            .snapshots
            .iter()
            .map(|(task_id, entry)| Ok((task_id, serde_json::to_string(entry)?)))
            .collect::<Result<_>>()
            .context("serializing snapshot entries")?;
        let resolution = &set.resolution;
        let commit = &resolution.requested_commit;
        let fetched_at = resolution.fetched_at;
        self.db.lock().unwrap().transaction(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO io_snapshot_versions (commit_sha, fetched_at, tasks) \
                 VALUES (?1, ?2, ?3)",
                params![commit, fetched_at, resolution.tasks],
            )?;
            // Never the version just written, whatever the clock did.
            conn.execute(
                "DELETE FROM io_snapshot_versions WHERE NOT (commit_sha = ?1 AND fetched_at = ?2) \
                 AND (commit_sha NOT IN (SELECT commit_sha FROM io_snapshot_versions \
                      GROUP BY commit_sha ORDER BY MAX(fetched_at) DESC, commit_sha LIMIT ?3) \
                   OR fetched_at < (SELECT newer.fetched_at FROM io_snapshot_versions newer \
                      WHERE newer.commit_sha = io_snapshot_versions.commit_sha \
                      ORDER BY newer.fetched_at DESC LIMIT 1 OFFSET ?4 - 1))",
                params![commit, fetched_at, RETAINED_COMMITS, RETAINED_VERSIONS],
            )?;
            // A version rewritten at the same instant, and pruned versions.
            conn.execute(
                "DELETE FROM io_snapshot_entries WHERE (commit_sha = ?1 AND fetched_at = ?2) \
                 OR (commit_sha, fetched_at) NOT IN \
                    (SELECT commit_sha, fetched_at FROM io_snapshot_versions)",
                params![commit, fetched_at],
            )?;
            let mut insert = conn.prepare(
                "INSERT INTO io_snapshot_entries (commit_sha, fetched_at, task_id, entry) \
                 VALUES (?1, ?2, ?3, ?4)",
            )?;
            for (task_id, entry) in &entries {
                insert.execute(params![commit, fetched_at, task_id, entry])?;
            }
            Ok(())
        })
    }

    /// `commit`'s version fetched at `fetched_at`, or its newest without one.
    pub(super) fn read_resolution(
        &self,
        commit: &str,
        fetched_at: Option<i64>,
    ) -> Result<Option<IoSnapshotResolution>> {
        self.db.lock().unwrap().query_row(
            "SELECT fetched_at, tasks FROM io_snapshot_versions \
             WHERE commit_sha = ?1 AND (?2 IS NULL OR fetched_at = ?2) \
             ORDER BY fetched_at DESC LIMIT 1",
            params![commit, fetched_at],
            |row| {
                Ok(IoSnapshotResolution {
                    requested_commit: commit.to_string(),
                    fetched_at: row.get(0)?,
                    tasks: row.get(1)?,
                })
            },
        )
    }

    /// The stored entries among `task_ids` for one version of `commit`; an id
    /// with no entry is simply absent from the result.
    pub(super) fn read_entries(
        &self,
        commit: &str,
        fetched_at: i64,
        task_ids: &[&str],
    ) -> Result<Vec<(String, TaskIoSnapshot)>> {
        let ids = Rc::new(
            task_ids
                .iter()
                .map(|id| Value::from(id.to_string()))
                .collect::<Vec<Value>>(),
        );
        let rows: Vec<(String, String)> = self.db.lock().unwrap().query_map(
            "SELECT task_id, entry FROM io_snapshot_entries \
             WHERE commit_sha = ?1 AND fetched_at = ?2 AND task_id IN rarray(?3)",
            (commit, fetched_at, ids),
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        rows.into_iter()
            .map(|(task_id, json)| {
                let entry = serde_json::from_str(&json)
                    .with_context(|| format!("parsing the stored snapshot of {task_id}"))?;
                Ok((task_id, entry))
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::db::initialize::initialize_db;

    fn temp_store() -> (tempfile::TempDir, IoSnapshotStore) {
        let dir = tempfile::tempdir().unwrap();
        let conn = initialize_db(&dir.path().join("test.db")).unwrap();
        let db = External::new(Arc::new(Mutex::new(conn)));
        (dir, IoSnapshotStore::new(&db).unwrap())
    }

    fn import(store: &IoSnapshotStore, json: &str) -> napi::Result<IoSnapshots, String> {
        store.import_set(IoSnapshotImportOptions {
            requested_commit: "head".into(),
            snapshots_json: json.into(),
        })
    }

    #[test]
    fn imports_a_payload_and_gets_it_back_per_task() {
        let (_dir, store) = temp_store();
        let json = r#"{
          "web:build": { "commit": "parent", "inputs": ["apps/web/src/**/*.ts"], "outputs": ["dist/web/b", "dist/web/a", "dist/web/b"] },
          "ui:test": { "commit": "head", "inputs": ["libs/ui/**/*.ts"], "outputs": [] }
        }"#;
        let imported = import(&store, json).unwrap();
        let resolution = imported.resolution();
        assert_eq!(resolution.tasks, 2);
        assert_eq!(imported.commit(), "head");

        let stored = store.get("head".into(), None).unwrap();
        assert_eq!(stored.resolution().fetched_at, resolution.fetched_at);
        // Read per task; outputs are sorted and deduped on import for the digest.
        let entries = stored.entries_for(&["web:build", "gone:build"]).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(
            entries["web:build"].outputs,
            vec!["dist/web/a".to_string(), "dist/web/b".into()]
        );
        // A second ask does not go back to the database: rewrite the version
        // without the entry and the handle still answers from memory.
        let fetched_at = stored.resolution().fetched_at;
        store
            .write(&ImportedSet {
                resolution: stored.resolution(),
                snapshots: BTreeMap::new(),
            })
            .unwrap();
        assert!(
            store
                .read_entries("head", fetched_at, &["web:build"])
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
        let minute = 60 * 1000;
        let fetched_at = current_timestamp_millis() - 61 * minute;
        store.write(&imported("head", fetched_at, &[])).unwrap();
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

    // Unknown fields are ignored so Nx Cloud can add some; an `inputs` shape
    // nx does not model is refused rather than half-read.
    #[test]
    fn ignores_unknown_fields_and_rejects_structured_inputs() {
        let (_dir, store) = temp_store();
        let extra =
            r#"{ "a:build": { "commit": "head", "inputs": [], "outputs": [], "recordedAt": 1 } }"#;
        assert!(import(&store, extra).is_ok());
        let structured = r#"{ "a:build": { "commit": "head", "inputs": { "projects": {}, "workspace": [] }, "outputs": [] } }"#;
        assert_eq!(
            import(&store, structured).err().unwrap().status,
            "INVALID_RESPONSE"
        );
    }

    #[test]
    fn treats_an_unreadable_row_as_nothing_stored() {
        let (_dir, store) = temp_store();
        import(&store, "{}").unwrap();
        store
            .db
            .lock()
            .unwrap()
            .execute("UPDATE io_snapshot_versions SET tasks = 'not a number'", [])
            .unwrap();
        assert!(store.get("head".into(), None).is_none());
    }

    fn resolution_of(db: &IoSnapshotStore, commit: &str) -> Option<IoSnapshotResolution> {
        db.read_resolution(commit, None).unwrap()
    }

    fn imported(commit: &str, fetched_at: i64, tasks: &[&str]) -> ImportedSet {
        let snapshots: BTreeMap<String, TaskIoSnapshot> = tasks
            .iter()
            .map(|id| {
                (
                    id.to_string(),
                    TaskIoSnapshot {
                        commit: commit.into(),
                        inputs: vec![format!("libs/{id}/a.ts"), "b.ts".into()],
                        outputs: vec![],
                    },
                )
            })
            .collect();
        let mut set = ImportedSet::new(commit.into(), snapshots);
        set.resolution.fetched_at = fetched_at;
        set
    }

    #[test]
    fn reads_only_the_requested_tasks_and_prunes_old_commits() {
        let (_dir, db) = temp_store();
        assert!(resolution_of(&db, "c0").is_none());
        assert!(db.read_entries("c0", 0, &["a:build"]).unwrap().is_empty());

        db.write(&imported("c0", 0, &["a:build", "b:build", "c:build"]))
            .unwrap();
        for i in 1..=5 {
            db.write(&imported(&format!("c{i}"), i, &["a:build"]))
                .unwrap();
        }

        let entries = db.read_entries("c5", 5, &["a:build", "zzz:build"]).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].0, "a:build");
        assert_eq!(
            entries[0].1.inputs,
            vec!["libs/a:build/a.ts".to_string(), "b.ts".into()]
        );
        assert_eq!(resolution_of(&db, "c5").unwrap().tasks, 1);
        // Only the newest five commits survive, with their entries.
        assert!(resolution_of(&db, "c0").is_none());
        assert!(db.read_entries("c0", 0, &["a:build"]).unwrap().is_empty());
        assert!(resolution_of(&db, "c1").is_some());
    }

    // A clock that stepped back must not prune the set being written.
    #[test]
    fn never_prunes_the_set_it_writes() {
        let (_dir, db) = temp_store();
        for i in 10..15 {
            db.write(&imported(&format!("c{i}"), i, &["a:build"]))
                .unwrap();
        }
        db.write(&imported("old", 1, &["a:build"])).unwrap();
        assert!(resolution_of(&db, "old").is_some());
        assert_eq!(db.read_entries("old", 1, &["a:build"]).unwrap().len(), 1);
        // Nor an older version of a commit, written after a newer one.
        db.write(&imported("c14", 3, &["a:build"])).unwrap();
        db.write(&imported("c14", 2, &["a:build"])).unwrap();
        assert_eq!(db.read_entries("c14", 2, &["a:build"]).unwrap().len(), 1);
    }

    #[test]
    fn a_reimport_adds_a_version_and_a_pinned_handle_keeps_reading_its_own() {
        let (_dir, store) = temp_store();
        store
            .write(&imported("c1", 1, &["a:build", "b:build"]))
            .unwrap();
        let pinned = store.get("c1".into(), None).unwrap();
        store.write(&imported("c1", 2, &["a:build"])).unwrap();

        // `get` serves the newest version; `get_version` the one asked for.
        assert_eq!(
            store
                .get("c1".into(), None)
                .unwrap()
                .resolution()
                .fetched_at,
            2
        );
        let old = store.get_version("c1".into(), 1).unwrap();
        assert_eq!(old.resolution().tasks, 2);
        // The handle loaded before the re-import still reads its version's entries.
        assert_eq!(
            pinned.entries_for(&["a:build", "b:build"]).unwrap().len(),
            2
        );
        assert_eq!(
            store
                .get("c1".into(), None)
                .unwrap()
                .entries_for(&["a:build", "b:build"])
                .unwrap()
                .len(),
            1
        );
        assert!(store.get_version("c1".into(), 7).is_none());
    }

    #[test]
    fn keeps_the_newest_two_versions_of_a_commit() {
        let (_dir, db) = temp_store();
        for fetched_at in 1..=3 {
            db.write(&imported("c1", fetched_at, &["a:build"])).unwrap();
        }
        assert!(db.read_resolution("c1", Some(1)).unwrap().is_none());
        assert!(db.read_entries("c1", 1, &["a:build"]).unwrap().is_empty());
        for fetched_at in [2, 3] {
            assert!(
                db.read_resolution("c1", Some(fetched_at))
                    .unwrap()
                    .is_some()
            );
            assert_eq!(
                db.read_entries("c1", fetched_at, &["a:build"])
                    .unwrap()
                    .len(),
                1
            );
        }
    }

    #[test]
    fn rewriting_a_version_replaces_its_entries() {
        let (_dir, db) = temp_store();
        db.write(&imported("c1", 1, &["a:build", "b:build"]))
            .unwrap();
        db.write(&imported("c1", 1, &["a:build"])).unwrap();
        assert!(db.read_entries("c1", 1, &["b:build"]).unwrap().is_empty());
        assert_eq!(db.read_entries("c1", 1, &["a:build"]).unwrap().len(), 1);
    }

    #[test]
    fn reads_no_ids_and_one_id() {
        let (_dir, db) = temp_store();
        db.write(&imported("c1", 1, &["a:build", "b:build"]))
            .unwrap();
        assert!(db.read_entries("c1", 1, &[]).unwrap().is_empty());
        let one = db.read_entries("c1", 1, &["b:build"]).unwrap();
        assert_eq!(one.len(), 1);
        assert_eq!(one[0].0, "b:build");
    }

    #[test]
    fn reads_more_ids_than_sqlite_allows_parameters_in_one_query() {
        let (_dir, db) = temp_store();
        let ids: Vec<String> = (0..40_000).map(|i| format!("p{i}:build")).collect();
        let refs: Vec<&str> = ids.iter().map(String::as_str).collect();
        db.write(&imported("c1", 1, &refs)).unwrap();
        assert_eq!(db.read_entries("c1", 1, &refs).unwrap().len(), 40_000);
    }
}
