//! A snapshot set and its task entries, as Nx Cloud sends them and the store keeps them.

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
    /// `requested_commit`, searched across `commits` (newest first).
    pub fn new(
        requested_commit: String,
        commits: &[String],
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
            source_commits,
            fetched_at: current_timestamp_millis(),
            tasks: snapshots.len() as u32,
        };
        Self {
            resolution,
            snapshots,
        }
    }
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
        for output in &self.outputs {
            hasher.update(output.as_bytes());
            // No path contains NUL, so adjacent outputs cannot run together.
            hasher.update(&[0]);
        }
        hasher.digest().to_string()
    }
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
            &["head".into(), "zeta".into(), "alpha".into()],
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
