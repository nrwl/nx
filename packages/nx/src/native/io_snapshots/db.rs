use std::rc::Rc;
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result};
use rusqlite::params;
use rusqlite::types::Value;

use super::IoSnapshotResolution;
use super::bundle::{Bundle, TaskIoSnapshot};
use crate::native::db::connection::NxDbConnection;

pub type Db = Arc<Mutex<NxDbConnection>>;

/// Commits whose sets are kept; older ones are pruned on each write.
const RETAINED_COMMITS: i64 = 5;

/// One row per commit for the set, one row per task for its entry, so a run
/// reads the tasks it plans instead of the workspace's whole set.
const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS io_snapshot_sets (
    commit_sha TEXT PRIMARY KEY NOT NULL,
    fetched_at INTEGER NOT NULL,
    tasks INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS io_snapshot_tasks (
    commit_sha TEXT NOT NULL,
    task_id TEXT NOT NULL,
    entry TEXT NOT NULL,
    PRIMARY KEY (commit_sha, task_id)
) WITHOUT ROWID;
";

/// The snapshot tables in the workspace database.
#[derive(Clone)]
pub struct SnapshotDb(pub(super) Db);

impl SnapshotDb {
    /// Created here because `create_all_tables` only runs for a new database file.
    pub fn new(db: Db) -> Result<Self> {
        db.lock().unwrap().execute_batch(SCHEMA)?;
        Ok(Self(db))
    }

    /// Replaces whatever was stored for the bundle's commit and prunes all but
    /// the newest sets. One transaction, so a reader sees the previous set or
    /// the new one, never a gap.
    pub fn write(&self, bundle: &Bundle) -> Result<()> {
        let entries: Vec<(&String, String)> = bundle
            .snapshots
            .iter()
            .map(|(task_id, entry)| Ok((task_id, serde_json::to_string(entry)?)))
            .collect::<Result<_>>()
            .context("serializing snapshot entries")?;
        let resolution = &bundle.resolution;
        let commit = &resolution.requested_commit;
        self.0.lock().unwrap().transaction(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO io_snapshot_sets (commit_sha, fetched_at, tasks) \
                 VALUES (?1, ?2, ?3)",
                params![commit, resolution.fetched_at, resolution.tasks],
            )?;
            conn.execute(
                "DELETE FROM io_snapshot_sets WHERE commit_sha NOT IN \
                 (SELECT commit_sha FROM io_snapshot_sets \
                  ORDER BY fetched_at DESC, commit_sha LIMIT ?1)",
                params![RETAINED_COMMITS],
            )?;
            // This commit's previous entries, and those of pruned sets.
            conn.execute(
                "DELETE FROM io_snapshot_tasks WHERE commit_sha = ?1 \
                 OR commit_sha NOT IN (SELECT commit_sha FROM io_snapshot_sets)",
                params![commit],
            )?;
            let mut insert = conn.prepare(
                "INSERT INTO io_snapshot_tasks (commit_sha, task_id, entry) VALUES (?1, ?2, ?3)",
            )?;
            for (task_id, entry) in &entries {
                insert.execute(params![commit, task_id, entry])?;
            }
            Ok(())
        })
    }

    pub fn read_resolution(&self, commit: &str) -> Result<Option<IoSnapshotResolution>> {
        self.0.lock().unwrap().query_row(
            "SELECT fetched_at, tasks FROM io_snapshot_sets WHERE commit_sha = ?1",
            params![commit],
            |row| {
                Ok(IoSnapshotResolution {
                    requested_commit: commit.to_string(),
                    fetched_at: row.get(0)?,
                    tasks: row.get(1)?,
                })
            },
        )
    }

    /// The stored entries among `task_ids` for `commit`; an id with no entry is
    /// simply absent from the result.
    pub fn read_entries(
        &self,
        commit: &str,
        task_ids: &[&str],
    ) -> Result<Vec<(String, TaskIoSnapshot)>> {
        let ids = Rc::new(
            task_ids
                .iter()
                .map(|id| Value::from(id.to_string()))
                .collect::<Vec<Value>>(),
        );
        let rows: Vec<(String, String)> = self.0.lock().unwrap().query_map(
            "SELECT task_id, entry FROM io_snapshot_tasks \
             WHERE commit_sha = ?1 AND task_id IN rarray(?2)",
            (commit, ids),
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
    use std::collections::BTreeMap;

    fn temp_db() -> (tempfile::TempDir, SnapshotDb) {
        let dir = tempfile::tempdir().unwrap();
        let conn = initialize_db(&dir.path().join("test.db")).unwrap();
        (dir, SnapshotDb::new(Arc::new(Mutex::new(conn))).unwrap())
    }

    fn bundle(commit: &str, fetched_at: i64, tasks: &[&str]) -> Bundle {
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
        let mut bundle = Bundle::new(commit.into(), snapshots);
        bundle.resolution.fetched_at = fetched_at;
        bundle
    }

    #[test]
    fn reads_only_the_requested_tasks_and_prunes_old_commits() {
        let (_dir, db) = temp_db();
        assert!(db.read_resolution("c0").unwrap().is_none());
        assert!(db.read_entries("c0", &["a:build"]).unwrap().is_empty());

        db.write(&bundle("c0", 0, &["a:build", "b:build", "c:build"]))
            .unwrap();
        for i in 1..=5 {
            db.write(&bundle(&format!("c{i}"), i, &["a:build"]))
                .unwrap();
        }

        let entries = db.read_entries("c5", &["a:build", "zzz:build"]).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].0, "a:build");
        assert_eq!(
            entries[0].1.inputs,
            vec!["libs/a:build/a.ts".to_string(), "b.ts".into()]
        );
        assert_eq!(db.read_resolution("c5").unwrap().unwrap().tasks, 1);
        // Only the newest five commits survive, with their entries.
        assert!(db.read_resolution("c0").unwrap().is_none());
        assert!(db.read_entries("c0", &["a:build"]).unwrap().is_empty());
        assert!(db.read_resolution("c1").unwrap().is_some());
    }

    #[test]
    fn rewriting_a_commit_replaces_its_entries() {
        let (_dir, db) = temp_db();
        db.write(&bundle("c1", 1, &["a:build", "b:build"])).unwrap();
        db.write(&bundle("c1", 2, &["a:build"])).unwrap();
        assert!(db.read_entries("c1", &["b:build"]).unwrap().is_empty());
        assert_eq!(db.read_entries("c1", &["a:build"]).unwrap().len(), 1);
    }

    #[test]
    fn reads_no_ids_and_one_id() {
        let (_dir, db) = temp_db();
        db.write(&bundle("c1", 1, &["a:build", "b:build"])).unwrap();
        assert!(db.read_entries("c1", &[]).unwrap().is_empty());
        let one = db.read_entries("c1", &["b:build"]).unwrap();
        assert_eq!(one.len(), 1);
        assert_eq!(one[0].0, "b:build");
    }

    #[test]
    fn reads_more_ids_than_sqlite_allows_parameters_in_one_query() {
        let (_dir, db) = temp_db();
        let ids: Vec<String> = (0..40_000).map(|i| format!("p{i}:build")).collect();
        let refs: Vec<&str> = ids.iter().map(String::as_str).collect();
        db.write(&bundle("c1", 1, &refs)).unwrap();
        assert_eq!(db.read_entries("c1", &refs).unwrap().len(), 40_000);
    }
}
