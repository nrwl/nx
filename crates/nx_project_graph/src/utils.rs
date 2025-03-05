mod find_project_for_path;
pub use find_project_for_path::*;
mod find_matching_projects;
pub use find_matching_projects::*;

use nx_core::types::project_graph::Project;
use std::collections::HashMap;

pub type ProjectRootMappings = HashMap<String, String>;
pub fn create_project_root_mappings(nodes: &HashMap<String, Project>) -> ProjectRootMappings {
    let mut project_root_mappings = HashMap::new();
    for (project_name, node) in nodes {
        project_root_mappings.insert(node.root.clone(), normalize_project_root(project_name));
    }
    project_root_mappings
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
