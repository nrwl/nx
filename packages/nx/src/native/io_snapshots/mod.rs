pub(crate) mod bundle;
pub(crate) mod store;

use std::collections::{BTreeMap, HashMap};
use std::sync::{Arc, Mutex};

use napi::bindgen_prelude::External;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::native::utils::time::current_timestamp_millis;

const DEFAULT_RETAIN: u32 = 5;

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
    /// The set's `updatedAt` as Nx Cloud reported it; sent back as
    /// `knownUpdatedAt` so an unchanged set costs no payload.
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

/// The snapshot set for one commit, plus what resolving it reported. Handed
/// to the hash planner as-is. Entries are read from the workspace database
/// per task as they are asked for, and remembered for the handle's lifetime,
/// so a run costs the tasks it plans rather than the workspace's whole set.
/// `resolution` is `None` when every task hashes natively (status `skipped`).
#[napi]
pub struct IoSnapshots {
    status: String,
    reason: Option<String>,
    message: Option<String>,
    resolution: Option<IoSnapshotResolution>,
    db: Option<store::Db>,
    entries: Mutex<HashMap<String, Option<Arc<bundle::TaskIoSnapshot>>>>,
}

#[napi]
impl IoSnapshots {
    /// `fetched` | `cached` | `skipped`
    #[napi(getter)]
    pub fn status(&self) -> String {
        self.status.clone()
    }

    /// Why the fetch was skipped, `stale-offline` when a stale set was
    /// reused, or `no-bundle` / `invalid-bundle` from `loadIoSnapshots`.
    #[napi(getter)]
    pub fn reason(&self) -> Option<String> {
        self.reason.clone()
    }

    #[napi(getter)]
    pub fn message(&self) -> Option<String> {
        self.message.clone()
    }

    /// The commit whose stored set this is, when one was resolved.
    #[napi(getter)]
    pub fn commit(&self) -> Option<String> {
        self.resolution
            .as_ref()
            .map(|resolution| resolution.requested_commit.clone())
    }

    #[napi(getter)]
    pub fn resolution(&self) -> Option<IoSnapshotResolution> {
        self.resolution.clone()
    }

    pub(crate) fn resolution_ref(&self) -> Option<&IoSnapshotResolution> {
        self.resolution.as_ref()
    }

    /// The stored entries among `task_ids`; an id without one is absent.
    /// Reads each id from the database once per handle.
    pub(crate) fn entries_for(
        &self,
        task_ids: &[&str],
    ) -> anyhow::Result<HashMap<String, Arc<bundle::TaskIoSnapshot>>> {
        let (Some(resolution), Some(db)) = (&self.resolution, &self.db) else {
            return Ok(HashMap::new());
        };
        let mut entries = self.entries.lock().unwrap();
        let missing: Vec<&str> = task_ids
            .iter()
            .copied()
            .filter(|id| !entries.contains_key(*id))
            .collect();
        if !missing.is_empty() {
            let read = store::read_entries(db, &resolution.requested_commit, &missing)?;
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

    pub(crate) fn skipped(reason: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            status: "skipped".into(),
            reason: Some(reason.into()),
            message: Some(message.into()),
            resolution: None,
            db: None,
            entries: Mutex::new(HashMap::new()),
        }
    }

    fn resolved(
        status: &str,
        reason: Option<String>,
        message: Option<String>,
        resolution: IoSnapshotResolution,
        db: store::Db,
        entries: HashMap<String, Option<Arc<bundle::TaskIoSnapshot>>>,
    ) -> Self {
        Self {
            status: status.into(),
            reason,
            message,
            resolution: Some(resolution),
            db: Some(db),
            entries: Mutex::new(entries),
        }
    }
}

/// A result that hashes every task natively, for the cases JS decides
/// (no git HEAD, no Nx Cloud client, a read that failed with nothing cached).
#[napi]
pub fn skipped_io_snapshots(reason: String, message: String) -> IoSnapshots {
    IoSnapshots::skipped(reason, message)
}

/// The stored set for `commit`, without touching the network: `nx show`,
/// `nx graph` and the daemon load the commit the run resolved. `reason` and
/// `message` annotate a deliberate reuse, such as `stale-offline`.
#[napi]
pub fn load_io_snapshots(
    #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db: &External<store::Db>,
    commit: String,
    reason: Option<String>,
    message: Option<String>,
) -> IoSnapshots {
    match store::read_resolution(db, &commit) {
        Ok(Some(resolution)) => IoSnapshots::resolved(
            "cached",
            reason,
            message,
            resolution,
            Arc::clone(db),
            HashMap::new(),
        ),
        Ok(None) => IoSnapshots::skipped(
            "no-bundle",
            format!("no I/O snapshot set is stored for {commit}"),
        ),
        Err(err) => IoSnapshots::skipped("invalid-bundle", err.to_string()),
    }
}

/// The resolution stored for `commit`, without reading any entries: enough
/// to decide whether to ask Nx Cloud at all and what `knownUpdatedAt` to send.
#[napi]
pub fn read_io_snapshot_resolution(
    #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db: &External<store::Db>,
    commit: String,
) -> Option<IoSnapshotResolution> {
    store::read_resolution(db, &commit).ok().flatten()
}

/// Stores the snapshot set the Nx Cloud client read for `requested_commit`
/// and returns it as this run's set. Never fails the caller: a payload nx
/// cannot read or a database it cannot write is reported as `skipped`.
#[napi]
pub fn import_io_snapshots(
    #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db: &External<store::Db>,
    options: IoSnapshotImportOptions,
) -> IoSnapshots {
    let mut snapshots: BTreeMap<String, bundle::TaskIoSnapshot> =
        match serde_json::from_str(&options.snapshots_json) {
            Ok(snapshots) => snapshots,
            Err(err) => {
                return IoSnapshots::skipped(
                    "invalid-response",
                    format!("Nx Cloud returned I/O snapshots nx cannot read: {err}"),
                );
            }
        };
    store::normalize(&mut snapshots);
    let mut source_commits: Vec<String> = snapshots.values().map(|s| s.commit.clone()).collect();
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
    if let Err(err) = store::write(
        db,
        &bundle,
        options.retain.unwrap_or(DEFAULT_RETAIN) as usize,
    ) {
        return IoSnapshots::skipped("write-failed", err.to_string());
    }
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
        .map(|(id, entry)| (id, Some(Arc::new(entry))))
        .collect();
    IoSnapshots::resolved("fetched", None, None, resolution, Arc::clone(db), entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::db::initialize::initialize_db;

    fn temp_db() -> (tempfile::TempDir, External<store::Db>) {
        let dir = tempfile::tempdir().unwrap();
        let conn = initialize_db(&dir.path().join("test.db")).unwrap();
        (dir, External::new(Arc::new(Mutex::new(conn))))
    }

    fn import(db: &External<store::Db>, json: &str) -> IoSnapshots {
        import_io_snapshots(
            db,
            IoSnapshotImportOptions {
                requested_commit: "head".into(),
                commits: vec!["head".into(), "parent".into()],
                snapshots_json: json.into(),
                updated_at: Some(42),
                client_version: Some("nx/test".into()),
                retain: None,
            },
        )
    }

    #[test]
    fn imports_a_payload_and_loads_it_back_per_task() {
        let (_dir, db) = temp_db();
        let json = r#"{
          "web:build": { "commit": "parent", "inputs": ["apps/web/src/**/*.ts", "apps/web/src/**/*.ts"], "outputs": ["dist/apps/web/**"] },
          "ui:test": { "commit": "head", "inputs": ["libs/ui/**/*.ts"], "outputs": [] }
        }"#;
        let imported = import(&db, json);
        assert_eq!(imported.status(), "fetched");
        let resolution = imported.resolution().unwrap();
        assert_eq!(resolution.tasks, 2);
        assert_eq!(resolution.source_commits, vec!["head", "parent"]);
        assert_eq!(resolution.updated_at, Some(42));
        assert_eq!(resolution.commits, vec!["head", "parent"]);
        assert_eq!(imported.commit().as_deref(), Some("head"));

        let header = read_io_snapshot_resolution(&db, "head".into()).unwrap();
        assert_eq!(header.digest, resolution.digest);

        let loaded = load_io_snapshots(&db, "head".into(), Some("stale-offline".into()), None);
        assert_eq!(loaded.status(), "cached");
        assert_eq!(loaded.reason().as_deref(), Some("stale-offline"));
        assert_eq!(loaded.resolution().unwrap().digest, resolution.digest);
        // Read per task, normalized on import: duplicates collapsed.
        let entries = loaded.entries_for(&["web:build", "gone:build"]).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(
            entries["web:build"].inputs,
            bundle::TaskInputs::Flat(vec!["apps/web/src/**/*.ts".into()])
        );
        // A second ask for the same ids does not go back to the database.
        assert_eq!(loaded.entries.lock().unwrap().len(), 2);
        assert_eq!(
            loaded.entries_for(&["web:build", "ui:test"]).unwrap().len(),
            2
        );
    }

    #[test]
    fn reports_a_payload_it_cannot_read() {
        let (_dir, db) = temp_db();
        let skipped = import(&db, "{ not json");
        assert_eq!(skipped.status(), "skipped");
        assert_eq!(skipped.reason().as_deref(), Some("invalid-response"));
        assert!(skipped.commit().is_none());
        assert!(
            load_io_snapshots(&db, "head".into(), None, None)
                .reason()
                .is_some_and(|r| r == "no-bundle")
        );
    }
}
