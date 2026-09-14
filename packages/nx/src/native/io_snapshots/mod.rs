pub(crate) mod bundle;
pub(crate) mod store;

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::native::utils::time::current_timestamp_millis;

const DEFAULT_RETAIN: u32 = 5;

/// What was resolved for a commit; persisted alongside the bundle.
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
    /// Shared cache root for snapshot bundles (`<cacheDir>/io-snapshots`).
    pub cache_directory: String,
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

/// The imported or loaded bundle for one commit, plus what resolving it
/// reported. Handed to the hash planner as-is; `bundle` is `None` when the
/// task hashes natively (status `skipped`, or a load failure).
#[napi]
pub struct IoSnapshots {
    pub(crate) bundle: Option<Arc<store::Bundle>>,
    status: String,
    reason: Option<String>,
    message: Option<String>,
    file: Option<String>,
    directory: Option<String>,
}

#[napi]
impl IoSnapshots {
    /// `fetched` | `cached` | `skipped`
    #[napi(getter)]
    pub fn status(&self) -> String {
        self.status.clone()
    }

    /// Why the fetch was skipped, `stale-offline` when a stale bundle was
    /// reused, or `no-bundle` / `invalid-bundle` from `loadIoSnapshots`.
    #[napi(getter)]
    pub fn reason(&self) -> Option<String> {
        self.reason.clone()
    }

    #[napi(getter)]
    pub fn message(&self) -> Option<String> {
        self.message.clone()
    }

    /// The bundle file a load failure refers to.
    #[napi(getter)]
    pub fn file(&self) -> Option<String> {
        self.file.clone()
    }

    /// Directory holding `snapshots.json` when a bundle was resolved.
    #[napi(getter)]
    pub fn directory(&self) -> Option<String> {
        self.directory.clone()
    }

    #[napi(getter)]
    pub fn resolution(&self) -> Option<IoSnapshotResolution> {
        self.bundle.as_ref().map(|b| b.resolution.clone())
    }

    pub(crate) fn skipped(reason: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            bundle: None,
            status: "skipped".into(),
            reason: Some(reason.into()),
            message: Some(message.into()),
            file: None,
            directory: None,
        }
    }

    fn resolved(
        status: &str,
        reason: Option<String>,
        message: Option<String>,
        directory: &Path,
        bundle: Arc<store::Bundle>,
    ) -> Self {
        Self {
            bundle: Some(bundle),
            status: status.into(),
            reason,
            message,
            file: None,
            directory: Some(directory.to_string_lossy().into_owned()),
        }
    }
}

/// A result that hashes every task natively, for the cases JS decides
/// (no git HEAD, no Nx Cloud client, a read that failed with nothing cached).
#[napi]
pub fn skipped_io_snapshots(reason: String, message: String) -> IoSnapshots {
    IoSnapshots::skipped(reason, message)
}

/// Reads an already-fetched bundle directory without touching the network:
/// `nx show`/`nx graph` and the daemon load the directory the client resolved.
/// `reason`/`message` annotate a deliberate reuse, such as `stale-offline`.
#[napi]
pub fn load_io_snapshots(
    directory: String,
    reason: Option<String>,
    message: Option<String>,
) -> IoSnapshots {
    let dir = Path::new(&directory);
    match store::read_bundle(dir) {
        Ok(bundle) => IoSnapshots::resolved("cached", reason, message, dir, bundle),
        Err(err) => IoSnapshots {
            bundle: None,
            status: "skipped".into(),
            reason: Some(err.reason.into()),
            message: Some(err.message),
            file: Some(err.file),
            directory: None,
        },
    }
}

/// The resolution header of the cached bundle for `commit`, without parsing
/// the snapshots: enough to decide whether to ask Nx Cloud at all and what
/// `knownUpdatedAt` to send.
#[napi]
pub fn read_io_snapshot_resolution(
    cache_directory: String,
    commit: String,
) -> Option<IoSnapshotResolution> {
    store::read_resolution(Path::new(&cache_directory), &commit)
}

/// Stores the snapshot set the Nx Cloud client read for `requested_commit`
/// and returns it as this run's bundle. Never fails the caller: a payload nx
/// cannot read or a cache it cannot write is reported as a `skipped` result.
#[napi]
pub fn import_io_snapshots(options: IoSnapshotImportOptions) -> IoSnapshots {
    let cache_directory = Path::new(&options.cache_directory);
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
        version: store::BUNDLE_VERSION,
        resolution: resolution.clone(),
        snapshots,
    };
    let directory = match store::write(cache_directory, &bundle) {
        Ok(dir) => dir,
        Err(err) => return IoSnapshots::skipped("write-failed", err.to_string()),
    };
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
    store::prune(
        cache_directory,
        options.retain.unwrap_or(DEFAULT_RETAIN) as usize,
        &resolution.requested_commit,
    );

    IoSnapshots::resolved("fetched", None, None, &directory, Arc::new(bundle))
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::TempDir;

    fn import(cache: &Path, json: &str) -> IoSnapshots {
        import_io_snapshots(IoSnapshotImportOptions {
            cache_directory: cache.to_string_lossy().into_owned(),
            requested_commit: "head".into(),
            commits: vec!["head".into(), "parent".into()],
            snapshots_json: json.into(),
            updated_at: Some(42),
            client_version: Some("nx/test".into()),
            retain: None,
        })
    }

    #[test]
    fn imports_a_payload_and_loads_it_back() {
        let temp = TempDir::new().unwrap();
        let json = r#"{
          "web:build": { "commit": "parent", "inputs": ["apps/web/src/**/*.ts", "apps/web/src/**/*.ts"], "outputs": ["dist/apps/web/**"] },
          "ui:test": { "commit": "head", "inputs": ["libs/ui/**/*.ts"], "outputs": [] }
        }"#;
        let imported = import(&temp, json);
        assert_eq!(imported.status(), "fetched");
        let resolution = imported.resolution().unwrap();
        assert_eq!(resolution.tasks, 2);
        assert_eq!(resolution.source_commits, vec!["head", "parent"]);
        assert_eq!(resolution.updated_at, Some(42));
        assert_eq!(resolution.commits, vec!["head", "parent"]);

        let header =
            read_io_snapshot_resolution(temp.to_string_lossy().into_owned(), "head".into())
                .unwrap();
        assert_eq!(header.digest, resolution.digest);

        let loaded = load_io_snapshots(
            imported.directory().unwrap(),
            Some("stale-offline".into()),
            None,
        );
        assert_eq!(loaded.status(), "cached");
        assert_eq!(loaded.reason().as_deref(), Some("stale-offline"));
        assert_eq!(loaded.resolution().unwrap().digest, resolution.digest);
        // Normalized on import: duplicates collapsed.
        let bundle = loaded.bundle.as_ref().unwrap();
        assert_eq!(
            bundle.snapshots["web:build"].inputs,
            bundle::TaskInputs::Flat(vec!["apps/web/src/**/*.ts".into()])
        );
    }

    #[test]
    fn reports_a_payload_it_cannot_read() {
        let temp = TempDir::new().unwrap();
        let skipped = import(&temp, "{ not json");
        assert_eq!(skipped.status(), "skipped");
        assert_eq!(skipped.reason().as_deref(), Some("invalid-response"));
        assert!(
            load_io_snapshots(temp.join("head").to_string_lossy().into_owned(), None, None)
                .reason()
                .is_some_and(|r| r == "no-bundle")
        );
    }
}
