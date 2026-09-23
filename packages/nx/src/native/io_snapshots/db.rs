use std::rc::Rc;
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result};
use rusqlite::params;
use rusqlite::types::Value;

use super::IoSnapshotResolution;
use super::bundle::{Bundle, TaskIoSnapshot};
use crate::native::db::connection::NxDbConnection;

pub type Db = Arc<Mutex<NxDbConnection>>;

/// One row per commit for the resolution, one row per task for its entry, so
/// a run reads the tasks it plans instead of the workspace's whole set.
const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS io_snapshot_bundles (
    commit_sha TEXT PRIMARY KEY NOT NULL,
    fetched_at INTEGER NOT NULL,
    resolution TEXT NOT NULL
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
    pub fn new(db: Db) -> Self {
        Self(db)
    }

    /// Replaces whatever was stored for the bundle's commit and keeps only the
    /// newest `retain` commits by fetch time, this one included. One transaction,
    /// so a reader sees the previous set or the new one, never a gap.
    pub fn write(&self, bundle: &Bundle, retain: usize) -> Result<()> {
        let resolution =
            serde_json::to_string(&bundle.resolution).context("serializing the resolution")?;
        let entries: Vec<(&String, String)> = bundle
            .snapshots
            .iter()
            .map(|(task_id, entry)| Ok((task_id, serde_json::to_string(entry)?)))
            .collect::<Result<_>>()
            .context("serializing snapshot entries")?;
        let commit = &bundle.resolution.requested_commit;
        let fetched_at = bundle.resolution.fetched_at;
        let mut db = self.0.lock().unwrap();
        db.execute_batch(SCHEMA)?;
        db.transaction(|conn| {
            conn.execute(
                "DELETE FROM io_snapshot_tasks WHERE commit_sha = ?1",
                params![commit],
            )?;
            conn.execute(
                "INSERT OR REPLACE INTO io_snapshot_bundles (commit_sha, fetched_at, resolution) \
                 VALUES (?1, ?2, ?3)",
                params![commit, fetched_at, resolution],
            )?;
            let mut insert = conn.prepare(
                "INSERT INTO io_snapshot_tasks (commit_sha, task_id, entry) VALUES (?1, ?2, ?3)",
            )?;
            for (task_id, entry) in &entries {
                insert.execute(params![commit, task_id, entry])?;
            }
            let stale: Vec<String> = conn
                .prepare(
                    "SELECT commit_sha FROM io_snapshot_bundles \
                     ORDER BY fetched_at DESC, commit_sha LIMIT -1 OFFSET ?1",
                )?
                .query_map(params![retain.max(1) as i64], |row| row.get(0))?
                .collect::<rusqlite::Result<_>>()?;
            for old in stale {
                conn.execute(
                    "DELETE FROM io_snapshot_tasks WHERE commit_sha = ?1",
                    params![old],
                )?;
                conn.execute(
                    "DELETE FROM io_snapshot_bundles WHERE commit_sha = ?1",
                    params![old],
                )?;
            }
            Ok(())
        })
    }

    pub fn read_resolution(&self, commit: &str) -> Result<Option<IoSnapshotResolution>> {
        let row: Option<String> = match self.0.lock().unwrap().query_row(
            "SELECT resolution FROM io_snapshot_bundles WHERE commit_sha = ?1",
            params![commit],
            |row| row.get(0),
        ) {
            Ok(row) => row,
            Err(err) if absent_table(&err) => None,
            Err(err) => return Err(err),
        };
        row.map(|json| serde_json::from_str(&json).context("parsing a stored resolution"))
            .transpose()
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
        let rows: Vec<(String, String)> = match self.0.lock().unwrap().query_map(
            "SELECT task_id, entry FROM io_snapshot_tasks \
             WHERE commit_sha = ?1 AND task_id IN rarray(?2)",
            (commit, ids),
            |row| Ok((row.get(0)?, row.get(1)?)),
        ) {
            Ok(rows) => rows,
            Err(err) if absent_table(&err) => return Ok(Vec::new()),
            Err(err) => return Err(err),
        };
        rows.into_iter()
            .map(|(task_id, json)| {
                let entry = serde_json::from_str(&json)
                    .with_context(|| format!("parsing the stored snapshot of {task_id}"))?;
                Ok((task_id, entry))
            })
            .collect()
    }
}

/// A query against a table no import has created yet reads as empty. Named
/// exactly, so a missing `rarray` ("no such table function") still errors.
fn absent_table(err: &anyhow::Error) -> bool {
    let message = err.to_string();
    ["io_snapshot_bundles", "io_snapshot_tasks"]
        .iter()
        .any(|table| message.contains(&format!("no such table: {table}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::db::initialize::initialize_db;
    use std::collections::BTreeMap;

    fn temp_db() -> (tempfile::TempDir, SnapshotDb) {
        let dir = tempfile::tempdir().unwrap();
        let conn = initialize_db(&dir.path().join("test.db")).unwrap();
        (dir, SnapshotDb::new(Arc::new(Mutex::new(conn))))
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
        let mut bundle = Bundle::new(commit.into(), vec![commit.into()], "test".into(), snapshots);
        bundle.resolution.fetched_at = fetched_at;
        bundle
    }

    #[test]
    fn reads_only_the_requested_tasks_and_prunes_old_commits() {
        let (_dir, db) = temp_db();
        assert!(db.read_resolution("c1").unwrap().is_none());
        assert!(db.read_entries("c1", &["a:build"]).unwrap().is_empty());

        db.write(&bundle("c1", 1, &["a:build", "b:build", "c:build"]), 2)
            .unwrap();
        db.write(&bundle("c2", 2, &["a:build"]), 2).unwrap();
        db.write(&bundle("c3", 3, &["a:build"]), 2).unwrap();

        let entries = db.read_entries("c3", &["a:build", "zzz:build"]).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].0, "a:build");
        assert_eq!(
            entries[0].1.inputs,
            vec!["b.ts".to_string(), "libs/a:build/a.ts".into()]
        );
        assert_eq!(db.read_resolution("c3").unwrap().unwrap().tasks, 1);
        // Only the newest two commits survive.
        assert!(db.read_resolution("c1").unwrap().is_none());
        assert!(db.read_entries("c1", &["a:build"]).unwrap().is_empty());
        assert!(db.read_resolution("c2").unwrap().is_some());
    }

    #[test]
    fn rewriting_a_commit_replaces_its_entries() {
        let (_dir, db) = temp_db();
        db.write(&bundle("c1", 1, &["a:build", "b:build"]), 5)
            .unwrap();
        db.write(&bundle("c1", 2, &["a:build"]), 5).unwrap();
        assert!(db.read_entries("c1", &["b:build"]).unwrap().is_empty());
        assert_eq!(db.read_entries("c1", &["a:build"]).unwrap().len(), 1);
    }

    // The check names both tables so a missing `rarray` ("no such table
    // function") errors rather than reading as an empty set.
    #[test]
    fn only_a_missing_snapshot_table_reads_as_empty() {
        assert!(absent_table(&anyhow::anyhow!(
            "DB query error: no such table: io_snapshot_tasks"
        )));
        assert!(absent_table(&anyhow::anyhow!(
            "no such table: io_snapshot_bundles"
        )));
        assert!(!absent_table(&anyhow::anyhow!(
            "no such table function: rarray"
        )));
        assert!(!absent_table(&anyhow::anyhow!(
            "no such table: task_history"
        )));
    }

    #[test]
    fn reads_no_ids_and_one_id() {
        let (_dir, db) = temp_db();
        db.write(&bundle("c1", 1, &["a:build", "b:build"]), 5)
            .unwrap();
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
        db.write(&bundle("c1", 1, &refs), 5).unwrap();
        assert_eq!(db.read_entries("c1", &refs).unwrap().len(), 40_000);
    }
}
