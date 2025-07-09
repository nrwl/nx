use std::collections::HashMap;

use crate::native::tasks::types::{Task, TaskGraph};

/// Recursively counts all dependencies for a given task.
/// Returns the total count of direct dependencies, continuous dependencies,
/// and all transitive dependencies.
pub fn count_all_dependencies(task_id: &str, task_graph: &TaskGraph) -> usize {
    fn count_all_dependencies_internal(
        task_id: &str,
        task_graph: &TaskGraph,
        visited: &mut std::collections::HashSet<String>,
    ) -> usize {
        if visited.contains(task_id) {
            return 0;
        }
        visited.insert(task_id.to_string());

        let direct_deps = task_graph
            .dependencies
            .get(task_id)
            .map(|deps| deps.len())
            .unwrap_or(0);
        let continuous_deps = task_graph
            .continuous_dependencies
            .get(task_id)
            .map(|deps| deps.len())
            .unwrap_or(0);
        let transitive_deps = task_graph
            .dependencies
            .get(task_id)
            .map(|deps| {
                deps.iter()
                    .map(|dep| count_all_dependencies_internal(dep, task_graph, visited))
                    .sum::<usize>()
            })
            .unwrap_or(0);
        let transitive_continuous_deps = task_graph
            .continuous_dependencies
            .get(task_id)
            .map(|deps| {
                deps.iter()
                    .map(|dep| count_all_dependencies_internal(dep, task_graph, visited))
                    .sum::<usize>()
            })
            .unwrap_or(0);

        direct_deps + continuous_deps + transitive_deps + transitive_continuous_deps
    }

    let mut visited = std::collections::HashSet::new();
    count_all_dependencies_internal(task_id, task_graph, &mut visited)
}

/// Collects all dependencies for a given task with their dependency levels.
/// Returns a tuple of (all_dependencies, dependency_levels).
pub fn collect_all_dependencies_with_levels(
    task_id: &str,
    task_graph: &TaskGraph,
) -> (Vec<String>, HashMap<String, usize>) {
    fn collect_all_dependencies_with_levels_internal(
        task_id: &str,
        task_graph: &TaskGraph,
        all_dependencies: &mut Vec<String>,
        dependency_levels: &mut HashMap<String, usize>,
        visited: &mut std::collections::HashSet<String>,
        current_level: usize,
    ) {
        if visited.contains(task_id) {
            return; // Avoid infinite loops
        }
        visited.insert(task_id.to_string());

        // Collect regular dependencies
        if let Some(direct_deps) = task_graph.dependencies.get(task_id) {
            for dep_id in direct_deps {
                if !all_dependencies.contains(dep_id) {
                    all_dependencies.push(dep_id.clone());
                    dependency_levels.insert(dep_id.clone(), current_level);
                }
                // Recursively collect dependencies of this dependency
                collect_all_dependencies_with_levels_internal(
                    dep_id,
                    task_graph,
                    all_dependencies,
                    dependency_levels,
                    visited,
                    current_level + 1,
                );
            }
        }

        // Collect continuous dependencies
        if let Some(continuous_deps) = task_graph.continuous_dependencies.get(task_id) {
            for dep_id in continuous_deps {
                if !all_dependencies.contains(dep_id) {
                    all_dependencies.push(dep_id.clone());
                    dependency_levels.insert(dep_id.clone(), current_level);
                }
                // Recursively collect dependencies of this dependency
                collect_all_dependencies_with_levels_internal(
                    dep_id,
                    task_graph,
                    all_dependencies,
                    dependency_levels,
                    visited,
                    current_level + 1,
                );
            }
        }
    }

    let mut all_dependencies = Vec::new();
    let mut dependency_levels = HashMap::new();
    let mut visited = std::collections::HashSet::new();

    collect_all_dependencies_with_levels_internal(
        task_id,
        task_graph,
        &mut all_dependencies,
        &mut dependency_levels,
        &mut visited,
        1,
    );

    (all_dependencies, dependency_levels)
}

/// Helper function to get task information from TaskGraph efficiently.
/// Returns None if the task is not found.
pub fn get_task_by_id<'a>(task_graph: &'a TaskGraph, task_id: &str) -> Option<&'a Task> {
    task_graph.tasks.get(task_id)
}

/// Helper function to check if a task is continuous.
/// Returns false if the task is not found or continuous is None.
pub fn is_task_continuous(task_graph: &TaskGraph, task_id: &str) -> bool {
    task_graph
        .tasks
        .get(task_id)
        .map(|task| task.continuous.unwrap_or(false))
        .unwrap_or(false)
}

/// Helper function to get all task IDs from the TaskGraph.
pub fn get_all_task_ids(task_graph: &TaskGraph) -> Vec<String> {
    task_graph.tasks.keys().cloned().collect()
}

/// Helper function to get task count from TaskGraph.
pub fn get_task_count(task_graph: &TaskGraph) -> usize {
    task_graph.tasks.len()
}

/// Helper function to get task status efficiently using a lookup function.
/// This avoids the O(n) search through TasksList.
pub fn get_dependency_statuses<F>(
    dependencies: &[String],
    status_lookup: F,
) -> HashMap<String, crate::native::tui::components::tasks_list::TaskStatus>
where
    F: Fn(&str) -> Option<crate::native::tui::components::tasks_list::TaskStatus>,
{
    dependencies
        .iter()
        .map(|dep_id| {
            let status = status_lookup(dep_id)
                .unwrap_or(crate::native::tui::components::tasks_list::TaskStatus::NotStarted);
            (dep_id.clone(), status)
        })
        .collect()
}
