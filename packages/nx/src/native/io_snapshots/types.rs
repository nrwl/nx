use serde::{Deserialize, Serialize};

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
    /// The set's `updatedAt` as Nx Cloud reported it.
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
