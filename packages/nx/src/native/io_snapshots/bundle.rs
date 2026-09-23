//! A task's I/O snapshot entry, as Nx Cloud sends it and the store keeps it.

use serde::{Deserialize, Serialize};

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
        let canonical = serde_json::to_vec(&self.outputs).expect("a list of strings serializes");
        crate::native::hasher::hash(&canonical)
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
