use crate::native::tasks::types::HashInstruction;
use crate::native::tasks::types::{Task, TaskGraph};
use rayon::prelude::*;
use std::collections::{HashSet, VecDeque};
use tracing::{debug, trace};

/// Collects all dependent tasks using BFS traversal
/// Note: Only processes regular dependencies, not continuous_dependencies.
/// Continuous tasks (like watch/serve) don't produce outputs that need to be hashed.
fn collect_task_dependencies<'a>(
    task_graph: &'a TaskGraph,
    initial_task_id: &str,
    transitive: bool,
) -> Vec<&'a Task> {
    let mut result = Vec::new();
    let mut visited = HashSet::new();
    let mut queue = VecDeque::from([initial_task_id]);

    while let Some(task_id) = queue.pop_front() {
        // Get dependencies for this task
        let Some(deps) = task_graph.dependencies.get(task_id) else {
            continue;
        };

        for dep in deps {
            let dep_str = dep.as_str();

            // Skip if already seen
            if !visited.insert(dep_str) {
                continue;
            }

            // Look up the task once and store the reference
            if let Some(task) = task_graph.tasks.get(dep_str) {
                result.push(task);

                // Add to queue if we want transitive dependencies
                if transitive {
                    queue.push_back(dep_str);
                }
            }
        }
    }

    result
}

/// Converts tasks to HashInstructions for tasks with outputs
fn process_tasks_outputs(
    tasks: Vec<&Task>,
    dependent_tasks_output_files: &str,
) -> Vec<HashInstruction> {
    tasks
        .into_par_iter()
        .filter_map(|task| {
            if !task.outputs.is_empty() {
                Some(HashInstruction::TaskOutput(
                    dependent_tasks_output_files.to_string(),
                    task.outputs.clone(),
                ))
            } else {
                None
            }
        })
        .collect()
}

pub(super) fn get_dep_output(
    task: &Task,
    task_graph: &TaskGraph,
    dependent_tasks_output_files: &str,
    transitive: bool,
) -> anyhow::Result<Vec<HashInstruction>> {
    let function_start = std::time::Instant::now();

    trace!(
        "Starting get_dep_output for task {} (transitive: {})",
        task.id, transitive
    );

    // Collect all task dependencies using BFS
    let tasks_to_process = collect_task_dependencies(task_graph, &task.id, transitive);
    let collect_duration = function_start.elapsed();

    if tasks_to_process.is_empty() {
        trace!("No dependencies found for task {}", task.id);
        return Ok(vec![]);
    }

    let task_count = tasks_to_process.len();

    trace!(
        "Collected {} tasks to process (including transitive) in {:?}",
        task_count, collect_duration
    );

    // Process all tasks in parallel to extract outputs
    let parallel_start = std::time::Instant::now();
    let inputs = process_tasks_outputs(tasks_to_process, dependent_tasks_output_files);
    let parallel_duration = parallel_start.elapsed();

    let total_duration = function_start.elapsed();

    debug!(
        "get_dep_output for task {} COMPLETED in {:?} - generated {} instructions from {} tasks (transitive: {}, collect: {:?}, parallel: {:?})",
        task.id,
        total_duration,
        inputs.len(),
        task_count,
        transitive,
        collect_duration,
        parallel_duration
    );

    Ok(inputs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    pub(super) fn create_test_task(id: &str, outputs: Vec<String>) -> Task {
        Task {
            id: id.to_string(),
            target: crate::native::tasks::types::TaskTarget {
                project: "test".to_string(),
                target: "build".to_string(),
                configuration: None,
            },
            outputs,
            project_root: Some("test".to_string()),
            start_time: None,
            end_time: None,
            continuous: None,
        }
    }

    #[test]
    fn test_collect_direct_dependencies() {
        let mut tasks = HashMap::new();
        tasks.insert("task1".to_string(), create_test_task("task1", vec![]));
        tasks.insert("task2".to_string(), create_test_task("task2", vec![]));
        tasks.insert("task3".to_string(), create_test_task("task3", vec![]));

        let mut dependencies = HashMap::new();
        dependencies.insert(
            "task1".to_string(),
            vec!["task2".to_string(), "task3".to_string()],
        );

        let task_graph = TaskGraph {
            roots: vec![],
            tasks,
            dependencies,
            continuous_dependencies: HashMap::new(),
        };

        let result = collect_task_dependencies(&task_graph, "task1", false);

        assert_eq!(result.len(), 2);
        let ids: Vec<&str> = result.iter().map(|t| t.id.as_str()).collect();
        assert!(ids.contains(&"task2"));
        assert!(ids.contains(&"task3"));
    }

    #[test]
    fn test_collect_transitive_dependencies() {
        let mut tasks = HashMap::new();
        tasks.insert("task1".to_string(), create_test_task("task1", vec![]));
        tasks.insert("task2".to_string(), create_test_task("task2", vec![]));
        tasks.insert("task3".to_string(), create_test_task("task3", vec![]));

        let mut dependencies = HashMap::new();
        dependencies.insert("task1".to_string(), vec!["task2".to_string()]);
        dependencies.insert("task2".to_string(), vec!["task3".to_string()]);

        let task_graph = TaskGraph {
            roots: vec![],
            tasks,
            dependencies,
            continuous_dependencies: HashMap::new(),
        };

        let result = collect_task_dependencies(&task_graph, "task1", true);

        assert_eq!(result.len(), 2);
        let ids: Vec<&str> = result.iter().map(|t| t.id.as_str()).collect();
        assert!(ids.contains(&"task2"));
        assert!(ids.contains(&"task3"));
    }

    #[test]
    fn test_deduplicates_diamond_dependencies() {
        // Diamond pattern: task1 -> task2 -> task4
        //                   task1 -> task3 -> task4
        let mut tasks = HashMap::new();
        tasks.insert("task1".to_string(), create_test_task("task1", vec![]));
        tasks.insert("task2".to_string(), create_test_task("task2", vec![]));
        tasks.insert("task3".to_string(), create_test_task("task3", vec![]));
        tasks.insert("task4".to_string(), create_test_task("task4", vec![]));

        let mut dependencies = HashMap::new();
        dependencies.insert(
            "task1".to_string(),
            vec!["task2".to_string(), "task3".to_string()],
        );
        dependencies.insert("task2".to_string(), vec!["task4".to_string()]);
        dependencies.insert("task3".to_string(), vec!["task4".to_string()]);

        let task_graph = TaskGraph {
            roots: vec![],
            tasks,
            dependencies,
            continuous_dependencies: HashMap::new(),
        };

        let result = collect_task_dependencies(&task_graph, "task1", true);

        // Should only contain task2, task3, task4 once (not task4 twice)
        assert_eq!(result.len(), 3);
        let ids: Vec<&str> = result.iter().map(|t| t.id.as_str()).collect();
        assert!(ids.contains(&"task2"));
        assert!(ids.contains(&"task3"));
        assert!(ids.contains(&"task4"));
    }

    #[test]
    fn test_process_tasks_outputs() {
        let task1 = create_test_task("task1", vec!["dist/out1".to_string()]);
        let task2 = create_test_task("task2", vec![]);
        let task3 = create_test_task("task3", vec!["dist/out3".to_string()]);

        let tasks = vec![&task1, &task2, &task3];
        let result = process_tasks_outputs(tasks, "**/*.js");

        // Should only include tasks with outputs
        let expected = vec![
            HashInstruction::TaskOutput("**/*.js".to_string(), vec!["dist/out1".to_string()]),
            HashInstruction::TaskOutput("**/*.js".to_string(), vec!["dist/out3".to_string()]),
        ];
        assert_eq!(result, expected);
    }

    fn create_diamond_graph(depth: usize) -> TaskGraph {
        let mut tasks = HashMap::new();
        let mut dependencies = HashMap::new();

        tasks.insert("root".to_string(), tests::create_test_task("root", vec![]));

        // Create diamond pattern repeated at each level
        for level in 0..depth {
            let left = format!("left{}", level);
            let right = format!("right{}", level);
            let bottom = format!("bottom{}", level);

            tasks.insert(
                left.clone(),
                tests::create_test_task(&left, vec![format!("dist/left{}", level)]),
            );
            tasks.insert(
                right.clone(),
                tests::create_test_task(&right, vec![format!("dist/right{}", level)]),
            );
            tasks.insert(
                bottom.clone(),
                tests::create_test_task(&bottom, vec![format!("dist/bottom{}", level)]),
            );

            if level == 0 {
                dependencies.insert("root".to_string(), vec![left.clone(), right.clone()]);
            } else {
                let prev_bottom = format!("bottom{}", level - 1);
                dependencies.insert(prev_bottom, vec![left.clone(), right.clone()]);
            }

            dependencies.insert(left, vec![bottom.clone()]);
            dependencies.insert(right, vec![bottom]);
        }

        TaskGraph {
            roots: vec!["root".to_string()],
            tasks,
            dependencies,
            continuous_dependencies: HashMap::new(),
        }
    }

    #[test]
    fn test_performance_large_graph() {
        // This test verifies that deduplication works and the function is fast
        // on a large diamond graph (depth 30 = 90 tasks with many duplicate paths)
        let graph = create_diamond_graph(30);
        let root_task = &graph.tasks["root"];

        let start = std::time::Instant::now();
        let result = get_dep_output(root_task, &graph, "**/*.js", true).unwrap();
        let elapsed = start.elapsed();

        // Verify we got results
        assert!(!result.is_empty());

        // Without deduplication, this would take exponential time
        // With deduplication and parallelization, should be very fast
        assert!(
            elapsed.as_millis() < 10,
            "Performance regression: expected <10ms, got {:?}",
            elapsed
        );
    }
}
