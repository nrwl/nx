//! On-disk bundle data model; wasm-safe (no network).

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Legacy (§2a) pre-classified reads: `projects` globs are project-relative,
/// `workspace` holds reads outside any project root, `task_outputs` maps a
/// producer task id to the paths read from its observed writes.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StructuredInputs {
    #[serde(default)]
    pub projects: BTreeMap<String, Vec<String>>,
    #[serde(default)]
    pub workspace: Vec<String>,
    #[serde(default)]
    pub task_outputs: BTreeMap<String, Vec<String>>,
}

/// Flat is the shape (NXC-4847 §2b): the server's collapsed workspace-relative
/// globs. The earlier structured form is still accepted; `resolve` flattens it
/// against the project roots. TODO(v24): drop the structured form.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(untagged)]
pub enum TaskInputs {
    Flat(Vec<String>),
    Structured(StructuredInputs),
}

impl Default for TaskInputs {
    fn default() -> Self {
        TaskInputs::Flat(Vec::new())
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TaskIoSnapshot {
    pub commit: String,
    pub inputs: TaskInputs,
    /// producer task id → observed paths inside that task's outputs; the paths
    /// are also in `inputs`, this only schedules the task after its producers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_outputs: Option<BTreeMap<String, Vec<String>>>,
    pub outputs: Vec<String>,
}

impl TaskIoSnapshot {
    /// Identity of what this task observed, independent of the commit the
    /// entry was recorded at and of every other entry in the set, so a task's
    /// hash key moves only when its own observations do.
    pub fn digest(&self) -> String {
        let identity = TaskIoSnapshot {
            commit: String::new(),
            ..self.clone()
        };
        let canonical = serde_json::to_vec(&identity).expect("a snapshot entry serializes");
        hex::encode(Sha256::digest(canonical))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(commit: &str, inputs: &[&str]) -> TaskIoSnapshot {
        TaskIoSnapshot {
            commit: commit.into(),
            inputs: TaskInputs::Flat(inputs.iter().map(|s| s.to_string()).collect()),
            task_outputs: None,
            outputs: vec![],
        }
    }

    #[test]
    fn digest_follows_the_observations_and_not_the_commit() {
        assert_eq!(
            entry("c1", &["a.ts"]).digest(),
            entry("c2", &["a.ts"]).digest()
        );
        assert_ne!(
            entry("c1", &["a.ts"]).digest(),
            entry("c1", &["b.ts"]).digest()
        );
        assert_eq!(entry("c1", &["a.ts"]).digest().len(), 64);
    }
}
