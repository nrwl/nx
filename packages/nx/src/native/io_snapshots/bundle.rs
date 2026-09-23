//! A task's I/O snapshot entry, as Nx Cloud sends it and the store keeps it.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// Older per-project form: `projects` globs are relative to each project's root.
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

/// Workspace-relative globs; `Structured` is the older per-project form.
/// TODO(v24): drop `Structured`.
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
    /// producer task id → paths read from its outputs; orders the task after
    /// them and withholds it if one is missing.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_outputs: Option<BTreeMap<String, Vec<String>>>,
    pub outputs: Vec<String>,
}

impl TaskIoSnapshot {
    /// Hashes only the writes and producer map: reads are hashed as their file
    /// groups, and the commit and other entries stay out, so a task's key moves
    /// only with its own entry.
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
        crate::native::hasher::hash(&canonical)
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
