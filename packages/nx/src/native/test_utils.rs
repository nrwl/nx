//! Builders for native unit tests.

use std::collections::HashMap;
use std::sync::Arc;

use crate::native::project_graph::types::{Project, ProjectGraph};
use crate::native::tasks::types::{
    HashInstruction, HashPlans, InstructionPool, Task, TaskGraph, TaskGraphEdge, TaskTarget,
    TaskUltracacheSettings,
};

pub(crate) fn project(root: &str) -> Project {
    Project {
        root: root.into(),
        ..Default::default()
    }
}

pub(crate) fn graph(projects: Vec<(&str, Project)>) -> ProjectGraph {
    ProjectGraph {
        nodes: projects
            .into_iter()
            .map(|(name, p)| (name.to_string(), p))
            .collect(),
        dependencies: HashMap::new(),
        external_nodes: HashMap::new(),
    }
}

/// Projects from `(name, root)` pairs, with nothing but their roots.
pub(crate) fn graph_of_roots(roots: &[(&str, &str)]) -> ProjectGraph {
    graph(
        roots
            .iter()
            .map(|&(name, root)| (name, project(root)))
            .collect(),
    )
}

pub(crate) fn files(paths: &[&str]) -> Vec<String> {
    paths.iter().map(|p| p.to_string()).collect()
}

pub(crate) fn strings(v: &[&str]) -> Vec<String> {
    v.iter().map(|s| s.to_string()).collect()
}

pub(crate) fn edges_to(ids: &[&str]) -> Vec<TaskGraphEdge> {
    ids.iter()
        .map(|id| TaskGraphEdge {
            id: id.to_string(),
            wait_for: None,
            inputs: None,
        })
        .collect()
}

/// Plans for each task, interned into one shared pool.
pub(crate) fn hash_plans(entries: &[(&str, Vec<HashInstruction>)]) -> HashPlans {
    let pool = Arc::new(InstructionPool::new());
    HashPlans {
        plans: entries
            .iter()
            .map(|(task, instructions)| {
                let ids = instructions.iter().map(|i| pool.intern(i.clone()));
                (
                    task.to_string(),
                    crate::native::tasks::plan::Plan::from_ids(ids, &pool),
                )
            })
            .collect(),
        pool,
        deferred: Default::default(),
    }
}

/// The graph with every target setting `ultracache.includeUnstableFiles: true`.
pub(crate) fn including_unstable_files(graph: TaskGraph) -> TaskGraph {
    with_include_unstable_files(graph, true)
}

/// The graph with every target setting `ultracache.includeUnstableFiles: false`.
pub(crate) fn excluding_unstable_files(graph: TaskGraph) -> TaskGraph {
    with_include_unstable_files(graph, false)
}

fn with_include_unstable_files(mut graph: TaskGraph, include: bool) -> TaskGraph {
    for task in graph.tasks.values_mut() {
        task.ultracache = Some(TaskUltracacheSettings {
            include_unstable_files: Some(include),
            ..Default::default()
        });
    }
    graph
}

/// Tasks `project:target` with their outputs, and their `dependsOn` edges.
pub(crate) fn task_graph(tasks: &[(&str, &[&str])], deps: &[(&str, &[&str])]) -> TaskGraph {
    TaskGraph {
        tasks: tasks
            .iter()
            .map(|(id, outputs)| {
                (
                    id.to_string(),
                    Task {
                        id: id.to_string(),
                        target: TaskTarget {
                            project: id.split(':').next().unwrap().to_string(),
                            target: id.split(':').nth(1).unwrap_or_default().to_string(),
                            ..Default::default()
                        },
                        outputs: strings(outputs),
                        ..Default::default()
                    },
                )
            })
            .collect(),
        dependencies: deps
            .iter()
            .map(|(id, d)| (id.to_string(), edges_to(d)))
            .collect(),
        continuous_dependencies: HashMap::new(),
        roots: vec![],
    }
}

/// A configuration set holding `entries` (task id to observed reads), imported into
/// a temporary database the returned directory owns.
#[cfg(not(target_arch = "wasm32"))]
pub(crate) fn ultracache_configurations(
    entries: &[(&str, &[&str])],
) -> (
    tempfile::TempDir,
    crate::native::ultracache::UltracacheConfigurations,
) {
    ultracache_configurations_imported(entries, UltracacheImport::Json(None))
}

/// Which store entry point a test imports its configurations through, and the
/// `hashProjectFolderState` it passes.
#[cfg(not(target_arch = "wasm32"))]
pub(crate) enum UltracacheImport {
    /// `UltracacheConfigurationStore.import`, as the Nx Cloud client's rehash does.
    Json(Option<bool>),
    /// `importFiles`, with the switch as a manifest field (omitted for `None`).
    Files(Option<bool>),
}

#[cfg(not(target_arch = "wasm32"))]
pub(crate) fn ultracache_configurations_imported(
    entries: &[(&str, &[&str])],
    import: UltracacheImport,
) -> (
    tempfile::TempDir,
    crate::native::ultracache::UltracacheConfigurations,
) {
    use crate::native::ultracache::{
        UltracacheConfigurationImportOptions, UltracacheConfigurationStore,
    };
    use napi::bindgen_prelude::External;
    use sha2::{Digest, Sha256};
    use std::sync::Mutex;

    let dir = tempfile::tempdir().unwrap();
    let db = crate::native::db::initialize::initialize_db(&dir.path().join("test.db")).unwrap();
    let store =
        UltracacheConfigurationStore::new(&External::new(Arc::new(Mutex::new(db)))).unwrap();
    let commit = "c".repeat(40);
    let configurations = match import {
        UltracacheImport::Json(hash_project_folder_state) => {
            let json = serde_json::Value::Object(
                entries
                    .iter()
                    .map(|(id, inputs)| {
                        (
                            id.to_string(),
                            serde_json::json!({ "commit": commit, "inputs": inputs, "outputs": [] }),
                        )
                    })
                    .collect(),
            );
            store
                .import_set(UltracacheConfigurationImportOptions {
                    requested_commit: commit,
                    configurations_json: json.to_string(),
                    hash_project_folder_state,
                })
                .unwrap()
        }
        UltracacheImport::Files(hash_project_folder_state) => {
            let mut manifest = serde_json::json!({
                "enabled": true, "updatedAt": 1, "tasks": {}, "artifacts": {}
            });
            if let Some(on) = hash_project_folder_state {
                manifest["hashProjectFolderState"] = serde_json::json!(on);
            }
            for (id, inputs) in entries {
                let bytes =
                    serde_json::to_vec(&serde_json::json!({ "inputs": inputs, "outputs": [] }))
                        .unwrap();
                let sha = format!("{:x}", Sha256::digest(&bytes));
                std::fs::write(dir.path().join(format!("{sha}.json")), &bytes).unwrap();
                manifest["tasks"][*id] =
                    serde_json::json!({ "commit": commit, "project": "p", "artifactId": sha });
                manifest["artifacts"][&sha] = serde_json::json!({ "sizeBytes": bytes.len() });
            }
            let path = dir.path().join("manifest.json");
            std::fs::write(&path, serde_json::to_vec(&manifest).unwrap()).unwrap();
            store
                .import_files(
                    commit,
                    path.to_string_lossy().into_owned(),
                    dir.path().to_string_lossy().into_owned(),
                )
                .unwrap()
        }
    };
    (dir, configurations)
}
