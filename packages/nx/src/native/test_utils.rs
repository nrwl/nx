//! Builders for native unit tests.

use std::collections::HashMap;

use crate::native::project_graph::types::{Project, ProjectGraph};

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
