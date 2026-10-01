//! A snapshot set and its task entries, as Nx Cloud sends them and the store keeps them.

#[cfg(not(target_arch = "wasm32"))]
use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[cfg(not(target_arch = "wasm32"))]
use super::UltracacheConfigurationResolution;
#[cfg(not(target_arch = "wasm32"))]
use crate::native::utils::time::current_timestamp_millis;

/// One resolved set of entries, as imported for a requested commit.
#[cfg(not(target_arch = "wasm32"))]
pub struct ImportedSet {
    pub resolution: UltracacheConfigurationResolution,
    pub snapshots: BTreeMap<String, UltracacheTaskConfiguration>,
}

#[cfg(not(target_arch = "wasm32"))]
impl ImportedSet {
    /// Describes `snapshots` as the set fetched now for `requested_commit`.
    pub fn new(requested_commit: String, snapshots: BTreeMap<String, UltracacheTaskConfiguration>) -> Self {
        let resolution = UltracacheConfigurationResolution {
            requested_commit,
            fetched_at: current_timestamp_millis(),
            tasks: snapshots.len() as u32,
        };
        Self {
            resolution,
            snapshots,
        }
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UltracacheTaskConfiguration {
    pub commit: String,
    /// Workspace-relative globs the task read.
    pub inputs: Vec<String>,
}
