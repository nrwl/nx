use std::collections::HashMap;

use crate::native::project_graph::types::{Project, ProjectGraph};

pub(super) fn project(root: &str) -> Project {
    Project {
        root: root.into(),
        ..Default::default()
    }
}

pub(super) fn graph(projects: Vec<(&str, Project)>) -> ProjectGraph {
    ProjectGraph {
        nodes: projects
            .into_iter()
            .map(|(name, p)| (name.to_string(), p))
            .collect(),
        dependencies: HashMap::new(),
        external_nodes: HashMap::new(),
    }
}

pub(super) fn files(paths: &[&str]) -> Vec<String> {
    paths.iter().map(|p| p.to_string()).collect()
}
