use std::collections::{BTreeMap, HashMap};

use crate::native::io_snapshots::bundle::TaskInputs;
use crate::native::io_snapshots::{IoSnapshotResolution, IoSnapshots};
use crate::native::project_graph::types::ProjectGraph;
use crate::native::tasks::hashers::validate_files_globs;
use crate::native::tasks::types::TaskGraph;

/// A task the hash planner hashes from its snapshot: observed reads as
/// workspace-relative globs (negations included), and the producer tasks
/// whose outputs it read — those only order it after them.
#[derive(Clone, Debug)]
pub(crate) struct SnapshotTask {
    pub files: Vec<String>,
    pub task_outputs: BTreeMap<String, Vec<String>>,
    pub digest: String,
}

/// Why a task (or the whole run) hashes natively. `reason` strings are the
/// contract `nx show`, `nx graph`, and the run summary render.
#[napi(object)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct IoSnapshotDiagnostic {
    pub reason: String,
    pub task_id: Option<String>,
    pub project: Option<String>,
    pub glob: Option<String>,
    pub producer: Option<String>,
    pub file: Option<String>,
    pub message: Option<String>,
}

impl IoSnapshotDiagnostic {
    fn task(reason: &str, task_id: &str) -> Self {
        Self {
            reason: reason.into(),
            task_id: Some(task_id.into()),
            project: None,
            glob: None,
            producer: None,
            file: None,
            message: None,
        }
    }
}

#[napi(object)]
#[derive(Clone, Debug)]
pub struct IoSnapshotReport {
    /// Task ids hashed from their snapshot.
    pub used: Vec<String>,
    pub diagnostics: Vec<IoSnapshotDiagnostic>,
    pub resolution: Option<IoSnapshotResolution>,
}

pub(crate) struct Resolved {
    pub tasks: HashMap<String, SnapshotTask>,
    pub diagnostics: Vec<IoSnapshotDiagnostic>,
    pub resolution: Option<IoSnapshotResolution>,
}

impl Resolved {
    pub(crate) fn report(&self) -> IoSnapshotReport {
        let mut used: Vec<String> = self.tasks.keys().cloned().collect();
        used.sort();
        IoSnapshotReport {
            used,
            diagnostics: self.diagnostics.clone(),
            resolution: self.resolution.clone(),
        }
    }
}

/// Decides, per task in the graph, whether its bundle entry can be hashed:
/// the target has not opted out, no custom hasher, an entry exists, every
/// producer it read from is in this task graph, and no glob would walk the
/// whole workspace. A bundle-level failure yields one diagnostic and no tasks.
pub(crate) fn resolve(
    snapshots: &IoSnapshots,
    task_graph: &TaskGraph,
    project_graph: &ProjectGraph,
    custom_hasher_task_ids: &[String],
) -> Resolved {
    let Some(bundle) = snapshots.bundle.as_ref() else {
        return Resolved {
            tasks: HashMap::new(),
            diagnostics: vec![IoSnapshotDiagnostic {
                reason: snapshots
                    .reason()
                    .unwrap_or_else(|| "no-bundle".to_string()),
                task_id: None,
                project: None,
                glob: None,
                producer: None,
                file: snapshots.file(),
                message: snapshots.message(),
            }],
            resolution: None,
        };
    };

    let mut tasks = HashMap::new();
    let mut diagnostics = Vec::new();
    let mut task_ids: Vec<&String> = task_graph.tasks.keys().collect();
    task_ids.sort();

    for task_id in task_ids {
        let task = &task_graph.tasks[task_id];
        let opted_out = project_graph
            .nodes
            .get(&task.target.project)
            .and_then(|node| node.targets.get(&task.target.target))
            .is_some_and(|target| target.io_snapshots == Some(false));
        if opted_out {
            diagnostics.push(IoSnapshotDiagnostic::task("disabled", task_id));
            continue;
        }
        if custom_hasher_task_ids.iter().any(|id| id == task_id) {
            diagnostics.push(IoSnapshotDiagnostic::task("custom-hasher", task_id));
            continue;
        }
        let Some(entry) = bundle.snapshots.get(task_id) else {
            diagnostics.push(IoSnapshotDiagnostic::task("missing", task_id));
            continue;
        };

        let mut files: Vec<String> = Vec::new();
        let task_outputs: BTreeMap<String, Vec<String>> = match &entry.inputs {
            TaskInputs::Flat(globs) => {
                files.extend(globs.iter().cloned());
                entry.task_outputs.clone().unwrap_or_default()
            }
            TaskInputs::Structured(legacy) => {
                // Pre-§2b bundles bucket reads by project with project-relative globs.
                for (project, globs) in &legacy.projects {
                    let Some(node) = project_graph.nodes.get(project) else {
                        let mut diagnostic = IoSnapshotDiagnostic::task("unknown-project", task_id);
                        diagnostic.project = Some(project.clone());
                        diagnostics.push(diagnostic);
                        continue;
                    };
                    let prefix = if node.root == "." {
                        String::new()
                    } else {
                        format!("{}/", node.root)
                    };
                    files.extend(globs.iter().map(|glob| match glob.strip_prefix('!') {
                        Some(rest) => format!("!{prefix}{rest}"),
                        None => format!("{prefix}{glob}"),
                    }));
                }
                files.extend(legacy.workspace.iter().cloned());
                if legacy.task_outputs.is_empty() {
                    entry.task_outputs.clone().unwrap_or_default()
                } else {
                    legacy.task_outputs.clone()
                }
            }
        };

        let mut dangling = None;
        for (producer, paths) in &task_outputs {
            if !task_graph.tasks.contains_key(producer) {
                dangling = Some(producer.clone());
                break;
            }
            // Output reads hash from disk like any other read; the producer
            // entry only orders this task after them.
            files.extend(paths.iter().cloned());
        }
        if let Some(producer) = dangling {
            let mut diagnostic = IoSnapshotDiagnostic::task("producer-not-in-graph", task_id);
            diagnostic.producer = Some(producer);
            diagnostics.push(diagnostic);
            continue;
        }

        files.sort();
        files.dedup();
        if let Some(glob) = files
            .iter()
            .filter(|g| !g.starts_with('!'))
            .find(|g| validate_files_globs(std::slice::from_ref(*g)).is_err())
        {
            let mut diagnostic = IoSnapshotDiagnostic::task("root-anchored-glob", task_id);
            diagnostic.glob = Some(glob.clone());
            diagnostics.push(diagnostic);
            continue;
        }

        tasks.insert(
            task_id.clone(),
            SnapshotTask {
                files,
                task_outputs,
                digest: bundle.resolution.digest.clone(),
            },
        );
    }

    Resolved {
        tasks,
        diagnostics,
        resolution: Some(bundle.resolution.clone()),
    }
}

/// Tasks whose snapshot read another task's outputs: they hash after their
/// producers ran, because those files only exist then. Needs no project graph,
/// so the client can call it before the first hashing wave on the daemon path.
#[napi]
pub fn io_snapshot_deferred_task_ids(
    snapshots: &IoSnapshots,
    task_graph: TaskGraph,
) -> Vec<String> {
    let Some(bundle) = snapshots.bundle.as_ref() else {
        return vec![];
    };
    let mut deferred: Vec<String> = task_graph
        .tasks
        .keys()
        .filter(|task_id| {
            bundle.snapshots.get(*task_id).is_some_and(|entry| {
                let producers: Vec<&String> = match &entry.inputs {
                    TaskInputs::Structured(legacy) if !legacy.task_outputs.is_empty() => {
                        legacy.task_outputs.keys().collect()
                    }
                    _ => entry
                        .task_outputs
                        .as_ref()
                        .map(|outputs| outputs.keys().collect())
                        .unwrap_or_default(),
                };
                !producers.is_empty()
                    && producers
                        .iter()
                        .all(|producer| task_graph.tasks.contains_key(*producer))
            })
        })
        .cloned()
        .collect();
    deferred.sort();
    deferred
}
