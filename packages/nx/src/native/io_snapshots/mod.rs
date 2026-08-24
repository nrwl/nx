mod client;
mod credentials;
mod store;

use std::path::Path;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tracing::trace;

use crate::native::utils::git;
use crate::native::utils::time::current_timestamp_millis;
use client::Credentials;

const DEFAULT_MAX_COMMITS: u32 = 50;
const DEFAULT_TIMEOUT_MS: u32 = 10_000;
const DEFAULT_MAX_AGE_MS: i64 = 60 * 60 * 1000;
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

#[napi(object)]
#[derive(Clone, Debug, Default)]
pub struct IoSnapshotFetchResult {
    /// `fetched` | `cached` | `skipped`
    pub status: String,
    /// Why the fetch was skipped, or `stale-offline` when a stale bundle was reused.
    pub reason: Option<String>,
    pub message: Option<String>,
    /// Directory holding `snapshots.json` when status is not `skipped`.
    pub directory: Option<String>,
    pub resolution: Option<IoSnapshotResolution>,
}

#[derive(Debug)]
pub(crate) struct FetchFailure {
    reason: &'static str,
    message: String,
}

impl FetchFailure {
    pub(crate) fn new(reason: &'static str, message: impl Into<String>) -> Self {
        Self {
            reason,
            message: message.into(),
        }
    }
}

fn skipped(reason: &'static str, message: impl Into<String>) -> IoSnapshotFetchResult {
    IoSnapshotFetchResult {
        status: "skipped".into(),
        reason: Some(reason.into()),
        message: Some(message.into()),
        ..Default::default()
    }
}

/// Resolves the I/O snapshot bundle for the workspace's current HEAD, serving
/// it from the on-disk cache when fresh and fetching from Nx Cloud otherwise.
/// Never fails the caller: every problem is reported as a `skipped` result.
#[napi]
pub async fn fetch_io_snapshots(options: IoSnapshotFetchOptions) -> IoSnapshotFetchResult {
    let workspace_root = Path::new(&options.workspace_root);
    let cache_directory = Path::new(&options.cache_directory);

    let Some(head) = git::head_sha(workspace_root) else {
        return skipped("not-a-git-repo", "Could not resolve HEAD");
    };

    let now = current_timestamp_millis();
    let max_age = options.max_age_ms.unwrap_or(DEFAULT_MAX_AGE_MS);
    let cached = store::read_resolution(cache_directory, &head);
    if let Some(resolution) = &cached {
        if max_age > 0 && now - resolution.fetched_at <= max_age {
            trace!("io snapshots for {head} served from cache");
            return IoSnapshotFetchResult {
                status: "cached".into(),
                directory: Some(
                    store::bundle_dir(cache_directory, &head)
                        .to_string_lossy()
                        .into_owned(),
                ),
                resolution: Some(resolution.clone()),
                ..Default::default()
            };
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
        return skipped(
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
                if let Some(resolution) = cached {
                    trace!(
                        "io snapshot fetch failed ({}); reusing stale bundle",
                        failure.reason
                    );
                    return IoSnapshotFetchResult {
                        status: "cached".into(),
                        reason: Some("stale-offline".into()),
                        message: Some(failure.message),
                        directory: Some(
                            store::bundle_dir(cache_directory, &head)
                                .to_string_lossy()
                                .into_owned(),
                        ),
                        resolution: Some(resolution),
                    };
                }
                return skipped(failure.reason, failure.message);
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
        Err(err) => return skipped("write-failed", err.to_string()),
    };
    store::prune(
        cache_directory,
        options.retain.unwrap_or(DEFAULT_RETAIN) as usize,
        &head,
    );

    IoSnapshotFetchResult {
        status: "fetched".into(),
        directory: Some(directory.to_string_lossy().into_owned()),
        resolution: Some(resolution),
        ..Default::default()
    }
}
