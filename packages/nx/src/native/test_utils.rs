//! Builders for native unit tests.

use std::collections::HashMap;
use std::sync::Arc;

use crate::native::project_graph::types::{Project, ProjectGraph};
use crate::native::tasks::types::{
    HashInstruction, HashPlans, InstructionPool, Task, TaskGraph, TaskTarget,
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

/// Plans for each task, interned into one shared pool.
pub(crate) fn hash_plans(entries: &[(&str, Vec<HashInstruction>)]) -> HashPlans {
    let pool = Arc::new(InstructionPool::new());
    HashPlans {
        plans: entries
            .iter()
            .map(|(task, instructions)| {
                let ids = instructions
                    .iter()
                    .map(|i| pool.intern(i.clone()))
                    .collect();
                (task.to_string(), ids)
            })
            .collect(),
        pool,
        deferred: Default::default(),
    }
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
            .map(|(id, d)| (id.to_string(), strings(d)))
            .collect(),
        continuous_dependencies: HashMap::new(),
        roots: vec![],
    }
}
