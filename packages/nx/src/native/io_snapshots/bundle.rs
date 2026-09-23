//! A task's I/O snapshot entry, as Nx Cloud sends it and the store keeps it.

#[cfg(not(target_arch = "wasm32"))]
use std::collections::{BTreeMap, HashSet};

use serde::{Deserialize, Serialize};
use xxhash_rust::xxh3::Xxh3;

#[cfg(not(target_arch = "wasm32"))]
use super::IoSnapshotResolution;
#[cfg(not(target_arch = "wasm32"))]
use crate::native::utils::time::current_timestamp_millis;

/// One resolved set of entries, as imported for a requested commit.
#[cfg(not(target_arch = "wasm32"))]
pub struct Bundle {
    pub resolution: IoSnapshotResolution,
    pub snapshots: BTreeMap<String, TaskIoSnapshot>,
}

#[cfg(not(target_arch = "wasm32"))]
impl Bundle {
    /// Normalizes `snapshots` and describes them as the set fetched now for
    /// `requested_commit`.
    pub fn new(
        requested_commit: String,
        commits: Vec<String>,
        client_version: String,
        mut snapshots: BTreeMap<String, TaskIoSnapshot>,
    ) -> Self {
        for entry in snapshots.values_mut() {
            sort_unique(&mut entry.inputs);
            sort_unique(&mut entry.outputs);
        }
        let recorded: HashSet<&str> = snapshots
            .values()
            .map(|entry| entry.commit.as_str())
            .collect();
        // `commits` is newest first; keep that order for the ones entries used.
        let source_commits = commits
            .iter()
            .filter(|commit| recorded.contains(commit.as_str()))
            .cloned()
            .collect();
        let resolution = IoSnapshotResolution {
            requested_commit,
            commits,
            source_commits,
            digest: set_digest(&snapshots),
            fetched_at: current_timestamp_millis(),
            client_version,
            tasks: snapshots.len() as u32,
        };
        Self {
            resolution,
            snapshots,
        }
    }
}

/// Identity of a set's content, independent of the commit it was requested for.
#[cfg(not(target_arch = "wasm32"))]
fn set_digest(snapshots: &BTreeMap<String, TaskIoSnapshot>) -> String {
    let mut hasher = Xxh3::new();
    for (task_id, entry) in snapshots {
        hash_value(&mut hasher, task_id);
        hash_value(&mut hasher, &entry.commit);
        hash_list(&mut hasher, &entry.inputs);
        hash_list(&mut hasher, &entry.outputs);
    }
    hasher.digest().to_string()
}

#[cfg(not(target_arch = "wasm32"))]
fn sort_unique(values: &mut Vec<String>) {
    values.sort();
    values.dedup();
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TaskIoSnapshot {
    pub commit: String,
    /// Workspace-relative globs the task read.
    pub inputs: Vec<String>,
    pub outputs: Vec<String>,
}

impl TaskIoSnapshot {
    /// Hashes only the writes: reads are hashed as their file groups, and the
    /// commit and other entries stay out, so a task's key moves only with its
    /// own entry.
    pub fn digest(&self) -> String {
        let mut hasher = Xxh3::new();
        hash_list(&mut hasher, &self.outputs);
        hasher.digest().to_string()
    }
}

/// Feeds one value then a NUL, which no path, task id or commit contains, so
/// adjacent values cannot run together.
fn hash_value(hasher: &mut Xxh3, value: &str) {
    hasher.update(value.as_bytes());
    hasher.update(&[0]);
}

/// Feeds each value, then a 0x01 so one list cannot run into the next.
fn hash_list(hasher: &mut Xxh3, values: &[String]) {
    for value in values {
        hash_value(hasher, value);
    }
    hasher.update(&[1]);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(commit: &str, inputs: &[&str]) -> TaskIoSnapshot {
        TaskIoSnapshot {
            commit: commit.into(),
            inputs: inputs.iter().map(|s| s.to_string()).collect(),
            outputs: vec![],
        }
    }

    fn with_outputs(outputs: &[&str]) -> TaskIoSnapshot {
        TaskIoSnapshot {
            outputs: outputs.iter().map(|s| s.to_string()).collect(),
            ..entry("c1", &["a.ts"])
        }
    }

    #[test]
    fn source_commits_keep_the_newest_first_order() {
        let snapshots = BTreeMap::from([
            ("a:build".to_string(), entry("alpha", &[])),
            ("b:build".to_string(), entry("zeta", &[])),
            ("c:build".to_string(), entry("zeta", &[])),
        ]);
        let bundle = Bundle::new(
            "head".into(),
            vec!["head".into(), "zeta".into(), "alpha".into()],
            "nx/test".into(),
            snapshots,
        );
        assert_eq!(bundle.resolution.source_commits, vec!["zeta", "alpha"]);
    }

    #[test]
    fn digest_keeps_values_apart() {
        assert_ne!(
            with_outputs(&["a", "bc"]).digest(),
            with_outputs(&["ab", "c"]).digest()
        );
    }

    #[test]
    fn digest_follows_the_writes_and_not_the_commit_or_the_reads() {
        assert_eq!(
            entry("c1", &["a.ts"]).digest(),
            entry("c2", &["a.ts"]).digest()
        );
        // The reads are hashed as the file groups they become.
        assert_eq!(
            entry("c1", &["a.ts"]).digest(),
            entry("c1", &["b.ts"]).digest()
        );
        assert_ne!(
            with_outputs(&["dist/a.js"]).digest(),
            with_outputs(&["dist/b.js"]).digest()
        );
        assert_ne!(
            with_outputs(&[]).digest(),
            with_outputs(&["dist/a.js"]).digest()
        );
    }
}
