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
    /// `Record<taskId, { commit, inputs, collectStats? }>` as JSON. `collectStats`
    /// is the policy actually used by the recording daemon. A legacy entry
    /// without it is compatible only with a task whose policy is `false`.
    pub configurations_json: String,
}
