use std::collections::HashMap;

use crate::native::tasks::types::TaskGraph;
use crate::native::tui::components::tasks_list::TaskStatus;

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

/// Helper function to check if a task is continuous.
/// Returns false if the task is not found or continuous is None.
pub fn is_task_continuous(task_graph: &TaskGraph, task_id: &str) -> bool {
    task_graph
        .tasks
        .get(task_id)
        .map(|task| task.continuous.unwrap_or(false))
        .unwrap_or(false)
}

/// Helper function to get task count from TaskGraph.
pub fn get_task_count(task_graph: &TaskGraph) -> usize {
    task_graph.tasks.len()
}

/// Gets all dependencies that have failed for a given task.
/// Returns a vector of task names that are dependencies and have failed.
pub fn get_failed_dependencies(
    task_id: &str,
    task_graph: &TaskGraph,
    status_map: &HashMap<String, TaskStatus>,
) -> Vec<String> {
    let (all_dependencies, _) = collect_all_dependencies_with_levels(task_id, task_graph);

    all_dependencies
        .into_iter()
        .filter(|dep| status_map.get(dep) == Some(&TaskStatus::Failure))
        .collect()
}

/// Analyzes the dependency chain to find root cause failures.
/// Returns a vector of (task_name, affected_count) tuples showing which failures
/// caused the most downstream impacts.
pub fn get_dependency_chain_failures(
    task_id: &str,
    task_graph: &TaskGraph,
    status_map: &HashMap<String, TaskStatus>,
) -> Vec<(String, usize)> {
    let failed_deps = get_failed_dependencies(task_id, task_graph, status_map);
    let mut root_causes = Vec::new();

    for failed_task in failed_deps {
        // Count how many tasks in the current task's dependency tree are affected by this failure
        let affected_count =
            count_affected_by_failure(&failed_task, task_id, task_graph, status_map);
        if affected_count > 0 {
            root_causes.push((failed_task, affected_count));
        }
    }

    // Sort by affected count (descending) to show most impactful failures first
    root_causes.sort_by(|a, b| b.1.cmp(&a.1));
    root_causes
}

/// Helper function to count how many tasks are affected by a specific failure.
/// This looks at all dependencies of the target task and counts how many are
/// affected (either directly failed or skipped due to) the specific failed task.
fn count_affected_by_failure(
    failed_task: &str,
    target_task: &str,
    task_graph: &TaskGraph,
    status_map: &HashMap<String, TaskStatus>,
) -> usize {
    let (all_dependencies, _) = collect_all_dependencies_with_levels(target_task, task_graph);

    // Count dependencies that are either:
    // 1. The failed task itself
    // 2. Skipped or failed tasks that depend on the failed task
    all_dependencies
        .iter()
        .filter(|dep| {
            if *dep == failed_task {
                return true;
            }

            // Check if this dependency is affected by the failed task
            let dep_status = status_map.get(*dep).unwrap_or(&TaskStatus::NotStarted);
            if matches!(dep_status, TaskStatus::Skipped | TaskStatus::Failure) {
                // Check if the failed_task is a dependency of this dep
                let (dep_dependencies, _) = collect_all_dependencies_with_levels(dep, task_graph);
                dep_dependencies.contains(&failed_task.to_string())
            } else {
                false
            }
        })
        .count()
}
