use serde::{Deserialize, Serialize};

/// What was resolved for a commit; stored beside its entries.
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UltracacheConfigurationResolution {
    pub requested_commit: String,
    pub fetched_at: i64,
    pub tasks: u32,
}

/// The Ultracache configurations the Nx Cloud client read for HEAD, as JS hands them over.
#[napi(object)]
pub struct UltracacheConfigurationImportOptions {
    pub requested_commit: String,
    /// `Record<taskId, { commit, inputs, outputs }>` as JSON.
    pub configurations_json: String,
}
