pub(crate) mod bundle;
#[cfg(not(target_arch = "wasm32"))]
mod client;
#[cfg(not(target_arch = "wasm32"))]
mod credentials;
pub(crate) mod store;

use std::path::Path;
use std::sync::Arc;
#[cfg(not(target_arch = "wasm32"))]
use std::time::Duration;

use serde::{Deserialize, Serialize};
#[cfg(not(target_arch = "wasm32"))]
use tracing::trace;

#[cfg(not(target_arch = "wasm32"))]
use crate::native::utils::git;
#[cfg(not(target_arch = "wasm32"))]
use crate::native::utils::time::current_timestamp_millis;
#[cfg(not(target_arch = "wasm32"))]
use client::Credentials;

#[cfg(not(target_arch = "wasm32"))]
const DEFAULT_MAX_COMMITS: u32 = 50;
#[cfg(not(target_arch = "wasm32"))]
const DEFAULT_TIMEOUT_MS: u32 = 10_000;
#[cfg(not(target_arch = "wasm32"))]
const DEFAULT_MAX_AGE_MS: i64 = 60 * 60 * 1000;
#[cfg(not(target_arch = "wasm32"))]
const DEFAULT_RETAIN: u32 = 5;

#[napi(object)]
#[derive(Clone, Debug, Default)]
pub struct IoSnapshotFetchOptions {
    pub workspace_root: String,
    /// Shared cache root for snapshot bundles (`<cacheDir>/io-snapshots`).
    pub cache_directory: String,
    pub api_url: String,
    pub access_token: Option<String>,
    pub nx_cloud_id: Option<String>,
    pub client_version: Option<String>,
    pub max_commits: Option<u32>,
    pub timeout_ms: Option<u32>,
    /// Age after which a cached bundle for the same commit is refetched. 0 always refetches.
    pub max_age_ms: Option<i64>,
    pub retain: Option<u32>,
}

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
    pub client_version: String,
    pub tasks: u32,
}

/// The fetched or loaded bundle for one commit, plus what resolving it
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

    pub(crate) fn skipped(reason: &'static str, message: impl Into<String>) -> Self {
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
        reason: Option<&'static str>,
        message: Option<String>,
        directory: &Path,
        bundle: Arc<store::Bundle>,
    ) -> Self {
        Self {
            bundle: Some(bundle),
            status: status.into(),
            reason: reason.map(Into::into),
            message,
            file: None,
            directory: Some(directory.to_string_lossy().into_owned()),
        }
    }
}

/// Reads an already-fetched bundle directory without touching the network:
/// `nx show`/`nx graph` and the daemon load the directory the client resolved.
#[napi]
pub fn load_io_snapshots(directory: String) -> IoSnapshots {
    let dir = Path::new(&directory);
    match store::read_bundle(dir) {
        Ok(bundle) => IoSnapshots::resolved("cached", None, None, dir, bundle),
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

#[cfg(not(target_arch = "wasm32"))]
#[derive(Debug)]
pub(crate) struct FetchFailure {
    reason: &'static str,
    message: String,
}

#[cfg(not(target_arch = "wasm32"))]
impl FetchFailure {
    pub(crate) fn new(reason: &'static str, message: impl Into<String>) -> Self {
        Self {
            reason,
            message: message.into(),
        }
    }
}

/// Resolves the I/O snapshot bundle for the workspace's current HEAD, serving
/// it from the on-disk cache when fresh and fetching from Nx Cloud otherwise.
/// Never fails the caller: every problem is reported as a `skipped` result.
#[cfg(not(target_arch = "wasm32"))]
#[napi]
pub async fn fetch_io_snapshots(options: IoSnapshotFetchOptions) -> IoSnapshots {
    let workspace_root = Path::new(&options.workspace_root);
    let cache_directory = Path::new(&options.cache_directory);

    let Some(head) = git::head_sha(workspace_root) else {
        return IoSnapshots::skipped("not-a-git-repo", "Could not resolve HEAD");
    };

    let now = current_timestamp_millis();
    let max_age = options.max_age_ms.unwrap_or(DEFAULT_MAX_AGE_MS);
    let cached = store::read_resolution(cache_directory, &head);
    let bundle_dir = store::bundle_dir(cache_directory, &head);
    if let Some(resolution) = &cached {
        if max_age > 0 && now - resolution.fetched_at <= max_age {
            if let Ok(bundle) = store::read_bundle(&bundle_dir) {
                trace!("io snapshots for {head} served from cache");
                return IoSnapshots::resolved("cached", None, None, &bundle_dir, bundle);
            }
        }
    }

    let client_version = options
        .client_version
        .clone()
        .unwrap_or_else(|| "nx".to_string());
    let credentials = Credentials {
        access_token: options.access_token.clone().filter(|s| !s.is_empty()),
        nx_cloud_id: options.nx_cloud_id.clone().filter(|s| !s.is_empty()),
        personal_access_token: credentials::personal_access_token(&options.api_url),
        client_version: client_version.clone(),
    };
    if credentials.is_empty() {
        return IoSnapshots::skipped(
            "no-credentials",
            "No Nx Cloud access token, Nx Cloud ID, or personal access token found",
        );
    }

    let mut commits = git::first_parent_ancestry(
        workspace_root,
        options.max_commits.unwrap_or(DEFAULT_MAX_COMMITS),
    );
    if commits.is_empty() {
        commits.push(head.clone());
    }

    let timeout = Duration::from_millis(options.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS) as u64);
    let mut snapshots =
        match client::read_snapshots(&options.api_url, &commits, &credentials, timeout).await {
            Ok(snapshots) => snapshots,
            Err(failure) => {
                if cached.is_some() {
                    if let Ok(bundle) = store::read_bundle(&bundle_dir) {
                        trace!(
                            "io snapshot fetch failed ({}); reusing stale bundle",
                            failure.reason
                        );
                        return IoSnapshots::resolved(
                            "cached",
                            Some("stale-offline"),
                            Some(failure.message),
                            &bundle_dir,
                            bundle,
                        );
                    }
                }
                return IoSnapshots::skipped(failure.reason, failure.message);
            }
        };

    store::normalize(&mut snapshots);
    let mut source_commits: Vec<String> = snapshots.values().map(|s| s.commit.clone()).collect();
    source_commits.sort();
    source_commits.dedup();
    let resolution = IoSnapshotResolution {
        requested_commit: head.clone(),
        commits,
        source_commits,
        digest: store::digest(&snapshots),
        fetched_at: now,
        client_version,
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
    store::prune(
        cache_directory,
        options.retain.unwrap_or(DEFAULT_RETAIN) as usize,
        &head,
    );

    IoSnapshots::resolved("fetched", None, None, &directory, Arc::new(bundle))
}
