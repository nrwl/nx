//! On-disk bundle data model; wasm-safe (no network).

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

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
/// globs. The earlier structured form is still accepted for one release; the
/// TS bundle reader flattens it against the project graph.
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
