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
    /// The half of an entry no other instruction in a plan hashes: the writes,
    /// which decide what the cache stores, and the producer map. The reads
    /// reach the hash as the file groups they become, `(path, content hash)`
    /// pairs and all, so hashing them here would only add churn — a read the
    /// plan drops because an external or always-on instruction already covers
    /// it, or one naming a file that does not exist, would move the key while
    /// changing nothing the task sees.
    ///
    /// Independent of the commit the entry was recorded at, and of every
    /// other entry in the set, so a task's key moves only with its own.
    pub fn digest(&self) -> String {
        #[derive(Serialize)]
        #[serde(rename_all = "camelCase")]
        struct Identity<'a> {
            task_outputs: Option<&'a BTreeMap<String, Vec<String>>>,
            outputs: &'a [String],
        }
        let canonical = serde_json::to_vec(&Identity {
            task_outputs: self.task_outputs.as_ref(),
            outputs: &self.outputs,
        })
        .expect("a snapshot entry serializes");
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

    fn with_outputs(outputs: &[&str]) -> TaskIoSnapshot {
        TaskIoSnapshot {
            outputs: outputs.iter().map(|s| s.to_string()).collect(),
            ..entry("c1", &["a.ts"])
        }
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
        assert_eq!(entry("c1", &["a.ts"]).digest().len(), 64);
    }

    #[test]
    fn digest_follows_the_producer_map() {
        let mut with_producer = entry("c1", &["dist/child/x.js"]);
        with_producer.task_outputs = Some(BTreeMap::from([(
            "child:build".to_string(),
            vec!["dist/child/x.js".to_string()],
        )]));
        assert_ne!(
            with_producer.digest(),
            entry("c1", &["dist/child/x.js"]).digest()
        );
    }
}
