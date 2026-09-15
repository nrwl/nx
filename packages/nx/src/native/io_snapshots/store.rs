use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result};
use rusqlite::{ToSql, params};
use sha2::{Digest, Sha256};

use super::IoSnapshotResolution;
use super::bundle::{TaskInputs, TaskIoSnapshot};
use crate::native::db::connection::NxDbConnection;

pub type Db = Arc<Mutex<NxDbConnection>>;

/// One resolved snapshot set, as imported for a requested commit.
pub struct Bundle {
    pub resolution: IoSnapshotResolution,
    pub snapshots: BTreeMap<String, TaskIoSnapshot>,
}

/// One row per commit for the resolution, one row per task for its entry, so
/// a run reads the tasks it plans instead of the workspace's whole set.
const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS io_snapshot_bundles (
    commit_sha TEXT PRIMARY KEY NOT NULL,
    digest TEXT NOT NULL,
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

/// Entries per `IN (...)` list; SQLite's default parameter limit is 999.
const READ_CHUNK: usize = 500;

/// Deterministic identity of the snapshot content, independent of which
/// commit it was requested for.
pub fn digest(snapshots: &BTreeMap<String, TaskIoSnapshot>) -> String {
    let canonical = serde_json::to_vec(snapshots).expect("BTreeMap of strings serializes");
    hex::encode(Sha256::digest(canonical))
}

pub fn normalize(snapshots: &mut BTreeMap<String, TaskIoSnapshot>) {
    for snapshot in snapshots.values_mut() {
        match &mut snapshot.inputs {
            TaskInputs::Flat(globs) => sort_unique(globs),
            TaskInputs::Structured(inputs) => {
                inputs.projects.values_mut().for_each(sort_unique);
                sort_unique(&mut inputs.workspace);
                inputs.task_outputs.values_mut().for_each(sort_unique);
            }
        }
        if let Some(task_outputs) = &mut snapshot.task_outputs {
            task_outputs.values_mut().for_each(sort_unique);
        }
        sort_unique(&mut snapshot.outputs);
    }
}

fn sort_unique(values: &mut Vec<String>) {
    values.sort();
    values.dedup();
}

/// Replaces whatever was stored for the bundle's commit and keeps only the
/// newest `retain` commits by fetch time, this one included. One transaction,
/// so a reader sees the previous set or the new one, never a gap.
pub fn write(db: &Db, bundle: &Bundle, retain: usize) -> Result<()> {
    let resolution =
        serde_json::to_string(&bundle.resolution).context("serializing the resolution")?;
    let entries: Vec<(&String, String)> = bundle
        .snapshots
        .iter()
        .map(|(task_id, entry)| Ok((task_id, serde_json::to_string(entry)?)))
        .collect::<Result<_>>()
        .context("serializing snapshot entries")?;
    let commit = &bundle.resolution.requested_commit;
    let digest = &bundle.resolution.digest;
    let fetched_at = bundle.resolution.fetched_at;
    let mut db = db.lock().unwrap();
    db.execute_batch(SCHEMA)?;
    db.transaction(|conn| {
        conn.execute(
            "DELETE FROM io_snapshot_tasks WHERE commit_sha = ?1",
            params![commit],
        )?;
        conn.execute(
            "INSERT OR REPLACE INTO io_snapshot_bundles (commit_sha, digest, fetched_at, resolution) \
             VALUES (?1, ?2, ?3, ?4)",
            params![commit, digest, fetched_at, resolution],
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

/// A query against a table no import has created yet reads as empty.
fn absent_table(err: &anyhow::Error) -> bool {
    err.to_string().contains("no such table")
}

pub fn read_resolution(db: &Db, commit: &str) -> Result<Option<IoSnapshotResolution>> {
    let row: Option<String> = match db.lock().unwrap().query_row(
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
    db: &Db,
    commit: &str,
    task_ids: &[&str],
) -> Result<Vec<(String, TaskIoSnapshot)>> {
    let mut entries = Vec::new();
    let db = db.lock().unwrap();
    for chunk in task_ids.chunks(READ_CHUNK) {
        let placeholders = (0..chunk.len())
            .map(|i| format!("?{}", i + 2))
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "SELECT task_id, entry FROM io_snapshot_tasks \
             WHERE commit_sha = ?1 AND task_id IN ({placeholders})"
        );
        let mut args: Vec<&dyn ToSql> = Vec::with_capacity(chunk.len() + 1);
        args.push(&commit);
        args.extend(chunk.iter().map(|id| id as &dyn ToSql));
        let rows: Vec<(String, String)> =
            match db.query_map(&sql, args.as_slice(), |row| Ok((row.get(0)?, row.get(1)?))) {
                Ok(rows) => rows,
                Err(err) if absent_table(&err) => return Ok(entries),
                Err(err) => return Err(err),
            };
        for (task_id, json) in rows {
            let entry = serde_json::from_str(&json)
                .with_context(|| format!("parsing the stored snapshot of {task_id}"))?;
            entries.push((task_id, entry));
        }
    }
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::db::initialize::initialize_db;

    fn temp_db() -> (tempfile::TempDir, Db) {
        let dir = tempfile::tempdir().unwrap();
        let conn = initialize_db(&dir.path().join("test.db")).unwrap();
        (dir, Arc::new(Mutex::new(conn)))
    }

    fn bundle(commit: &str, fetched_at: i64, tasks: &[&str]) -> Bundle {
        let snapshots: BTreeMap<String, TaskIoSnapshot> = tasks
            .iter()
            .map(|id| {
                (
                    id.to_string(),
                    TaskIoSnapshot {
                        commit: commit.into(),
                        inputs: TaskInputs::Flat(vec![format!("libs/{id}/a.ts"), "b.ts".into()]),
                        task_outputs: None,
                        outputs: vec![],
                    },
                )
            })
            .collect();
        Bundle {
            resolution: IoSnapshotResolution {
                requested_commit: commit.into(),
                commits: vec![commit.into()],
                source_commits: vec![commit.into()],
                digest: digest(&snapshots),
                fetched_at,
                updated_at: None,
                client_version: "test".into(),
                tasks: snapshots.len() as u32,
            },
            snapshots,
        }
    }

    #[test]
    fn reads_only_the_requested_tasks_and_prunes_old_commits() {
        let (_dir, db) = temp_db();
        assert!(read_resolution(&db, "c1").unwrap().is_none());
        assert!(read_entries(&db, "c1", &["a:build"]).unwrap().is_empty());

        write(&db, &bundle("c1", 1, &["a:build", "b:build", "c:build"]), 2).unwrap();
        write(&db, &bundle("c2", 2, &["a:build"]), 2).unwrap();
        write(&db, &bundle("c3", 3, &["a:build"]), 2).unwrap();

        let entries = read_entries(&db, "c3", &["a:build", "zzz:build"]).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].0, "a:build");
        assert_eq!(
            entries[0].1.inputs,
            TaskInputs::Flat(vec!["libs/a:build/a.ts".into(), "b.ts".into()])
        );
        assert_eq!(read_resolution(&db, "c3").unwrap().unwrap().tasks, 1);
        // Only the newest two commits survive.
        assert!(read_resolution(&db, "c1").unwrap().is_none());
        assert!(read_entries(&db, "c1", &["a:build"]).unwrap().is_empty());
        assert!(read_resolution(&db, "c2").unwrap().is_some());
    }

    #[test]
    fn rewriting_a_commit_replaces_its_entries() {
        let (_dir, db) = temp_db();
        write(&db, &bundle("c1", 1, &["a:build", "b:build"]), 5).unwrap();
        write(&db, &bundle("c1", 2, &["a:build"]), 5).unwrap();
        assert!(read_entries(&db, "c1", &["b:build"]).unwrap().is_empty());
        assert_eq!(read_entries(&db, "c1", &["a:build"]).unwrap().len(), 1);
    }

    #[test]
    fn reads_in_chunks_beyond_the_parameter_limit() {
        let (_dir, db) = temp_db();
        let ids: Vec<String> = (0..1200).map(|i| format!("p{i}:build")).collect();
        let refs: Vec<&str> = ids.iter().map(String::as_str).collect();
        write(&db, &bundle("c1", 1, &refs), 5).unwrap();
        assert_eq!(read_entries(&db, "c1", &refs).unwrap().len(), 1200);
    }
}
