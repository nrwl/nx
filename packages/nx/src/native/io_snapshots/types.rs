use serde::{Deserialize, Serialize};

/// What was resolved for a commit; stored beside its entries.
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IoSnapshotResolution {
    pub requested_commit: String,
    /// The commits entries were recorded at, newest first.
    pub source_commits: Vec<String>,
    pub fetched_at: i64,
    pub tasks: u32,
}

/// The snapshot set the Nx Cloud client read for HEAD, as JS hands it over.
#[napi(object)]
pub struct IoSnapshotImportOptions {
    pub requested_commit: String,
    /// The commits the client asked about, newest first.
    pub commits: Vec<String>,
    /// `Record<taskId, { commit, inputs, outputs }>` as JSON.
    pub snapshots_json: String,
}
