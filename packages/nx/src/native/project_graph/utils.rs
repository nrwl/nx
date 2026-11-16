use crate::native::project_graph::types::Project;
use std::collections::HashMap;

mod find_project_for_path;
pub use find_project_for_path::*;

pub type ProjectRootMappings = HashMap<String, String>;

/// Normalized project root -> project name, as `createProjectRootMappings` in
/// `project-graph/utils/find-project-for-path.ts` builds it.
pub fn create_project_root_mappings(nodes: &HashMap<String, Project>) -> ProjectRootMappings {
    nodes
        .iter()
        .map(|(project_name, node)| (normalize_project_root(&node.root), project_name.clone()))
        .collect()
}

pub fn normalize_project_root(root: &str) -> String {
    let root = if root.is_empty() {
        ".".to_string()
    } else {
        root.to_owned()
    };
    if root.ends_with('/') {
        root.strip_suffix('/')
            .expect("'/' already checked to exist")
            .to_string()
    } else {
        root.to_owned()
    }
}
