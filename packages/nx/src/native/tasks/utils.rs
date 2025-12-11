use crate::native::project_graph::types::ProjectGraph;
use dashmap::DashMap;
use hashbrown::HashSet;
use once_cell::sync::Lazy;
use std::sync::Arc;

/// Cache for dependency lookups to avoid recomputing transitive dependencies.
/// Key format: "{node_name}:{exclude_external}" -> list of dependency names
/// Uses Arc<Vec<String>> to allow cheap cloning of cached results.
static DEPENDENCY_CACHE: Lazy<DashMap<String, Arc<Vec<String>>>> = Lazy::new(DashMap::new);

/// Clears the dependency cache. Useful for testing or when the project graph changes.
#[allow(dead_code)]
pub fn clear_dependency_cache() {
    DEPENDENCY_CACHE.clear();
}

pub(super) fn find_all_project_node_dependencies<'a>(
    parent_node_name: &str,
    project_graph: &'a ProjectGraph,
    exclude_external_dependencies: bool,
) -> Vec<&'a String> {
    // Create cache key
    let cache_key = format!("{}:{}", parent_node_name, exclude_external_dependencies);

    // Check cache first
    if let Some(cached) = DEPENDENCY_CACHE.get(&cache_key) {
        // Convert cached String references back to references into project_graph
        // This is safe because the cached names match keys in project_graph
        return cached
            .iter()
            .filter_map(|name| {
                // Find the reference in either dependencies or external_nodes
                project_graph
                    .dependencies
                    .get_key_value(name)
                    .map(|(k, _)| k)
                    .or_else(|| {
                        project_graph
                            .external_nodes
                            .get_key_value(name)
                            .map(|(k, _)| k)
                    })
            })
            .collect();
    }

    // Compute dependencies
    let mut dependent_node_names = HashSet::new();
    collect_dependent_project_node_names(
        project_graph,
        parent_node_name,
        &mut dependent_node_names,
        exclude_external_dependencies,
    );

    // Convert to owned strings for caching
    let owned_names: Vec<String> = dependent_node_names.iter().map(|s| (*s).clone()).collect();

    // Store in cache
    DEPENDENCY_CACHE.insert(cache_key, Arc::new(owned_names));

    // Return borrowed references
    dependent_node_names.into_iter().collect()
}

fn collect_dependent_project_node_names<'a>(
    project_graph: &'a ProjectGraph,
    parent_node_name: &str,
    dependent_node_names: &mut HashSet<&'a String>,
    exclude_external_dependencies: bool,
) {
    let Some(dependencies) = project_graph.dependencies.get(parent_node_name) else {
        return;
    };

    for dependency in dependencies {
        // skip dependencies already added (avoid circular dependencies)
        if dependent_node_names.contains(dependency) {
            continue;
        }

        if exclude_external_dependencies && project_graph.external_nodes.contains_key(dependency) {
            continue;
        }

        dependent_node_names.insert(dependency);
        collect_dependent_project_node_names(
            project_graph,
            dependency,
            dependent_node_names,
            exclude_external_dependencies,
        );
    }
}
