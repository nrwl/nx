use hashbrown::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::native::tui::components::tasks_list::{TaskItem, TaskStatus};

pub fn format_duration(duration_ms: i64) -> String {
    #[cfg(test)]
    {
        if duration_ms < 1000 {
            // In tests, return a deterministic value to avoid timing flakiness in snapshots
            return "<1ms".to_string();
        }
    }

    if duration_ms == 0 {
        "<1ms".to_string()
    } else if duration_ms < 1000 {
        format!("{}ms", duration_ms)
    } else {
        format!("{:.1}s", duration_ms as f64 / 1000.0)
    }
}

pub fn format_duration_since(start_ms: i64, end_ms: i64) -> String {
    format_duration(end_ms.saturating_sub(start_ms))
}

/// Returns the current time in milliseconds since Unix epoch
pub fn get_current_time_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

/// Formats the duration from a start time to the current time
pub fn format_live_duration(start_ms: i64) -> String {
    let current_ms = get_current_time_ms();
    format_duration(current_ms.saturating_sub(start_ms))
}

/// Ensures that all newlines in the output are properly handled by converting
/// lone \n to \r\n sequences. This mimics terminal driver behavior.
pub fn normalize_newlines(input: &[u8]) -> Vec<u8> {
    let mut output = Vec::with_capacity(input.len());
    let mut i = 0;
    while i < input.len() {
        if input[i] == b'\n' {
            // If this \n isn't preceded by \r, add the \r
            if i == 0 || input[i - 1] != b'\r' {
                output.push(b'\r');
            }
        }
        output.push(input[i]);
        i += 1;
    }
    output
}

/// Sorts a list of TaskItems with a stable, total ordering.
///
/// The sort order is:
/// 1. InProgress tasks first
/// 2. Highlighted tasks second (tasks whose names appear in the highlighted_names list)
/// 3. Failure tasks third
/// 4. Other completed tasks fourth (sorted by end_time if available)
/// 5. NotStarted tasks last
///
/// Within each status category:
/// - For completed tasks: sort by end_time if available, then by name
/// - For other statuses: sort by name
pub fn sort_task_items(tasks: &mut [TaskItem], highlighted_names: &HashSet<String>) {
    tasks.sort_by(|a, b| {
        // Map status to a numeric category for sorting
        let status_to_category = |status: &TaskStatus, name: &str| -> u8 {
            if highlighted_names.contains(&name.to_string()) {
                return 1; // Highlighted tasks come second
            }

            match status {
                TaskStatus::InProgress | TaskStatus::Shared => 0,
                TaskStatus::Failure => 2,
                TaskStatus::Success
                | TaskStatus::LocalCacheKeptExisting
                | TaskStatus::LocalCache
                | TaskStatus::RemoteCache
                | TaskStatus::Skipped
                | TaskStatus::Stopped => 3,
                TaskStatus::NotStarted => 4,
            }
        };

        let a_category = status_to_category(&a.status, &a.name);
        let b_category = status_to_category(&b.status, &b.name);

        // First compare by status category
        if a_category != b_category {
            return a_category.cmp(&b_category);
        }

        // For completed tasks, sort by end_time if available
        if a_category == 2 || a_category == 3 {
            // Failure or Success categories
            match (a.end_time, b.end_time) {
                (Some(time_a), Some(time_b)) => {
                    let time_cmp = time_a.cmp(&time_b);
                    if time_cmp != std::cmp::Ordering::Equal {
                        return time_cmp;
                    }
                }
                (Some(_), None) => return std::cmp::Ordering::Less,
                (None, Some(_)) => return std::cmp::Ordering::Greater,
                (None, None) => {}
            }
        }

        // For all other cases or as a tiebreaker, sort by name
        a.name.cmp(&b.name)
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    // Helper function to create a TaskItem for testing
    fn create_task(name: &str, status: TaskStatus, end_time: Option<i64>) -> TaskItem {
        let mut task = TaskItem::new(name.to_string(), false);
        task.status = status;
        task.end_time = end_time;
        task
    }

    #[test]
    fn test_sort_by_status_category() {
        let mut tasks = vec![
            create_task("task1", TaskStatus::NotStarted, None),
            create_task("task2", TaskStatus::InProgress, None),
            create_task("task3", TaskStatus::Success, Some(100)),
            create_task("task4", TaskStatus::Failure, Some(200)),
        ];

        sort_task_items(&mut tasks, &HashSet::new());

        // Expected order: InProgress, Failure, Success, NotStarted
        assert_eq!(tasks[0].status, TaskStatus::InProgress);
        assert_eq!(tasks[1].status, TaskStatus::Failure);
        assert_eq!(tasks[2].status, TaskStatus::Success);
        assert_eq!(tasks[3].status, TaskStatus::NotStarted);
    }

    #[test]
    fn test_highlighted_tasks() {
        let mut tasks = vec![
            create_task("task1", TaskStatus::NotStarted, None),
            create_task("task2", TaskStatus::InProgress, None),
            create_task("task3", TaskStatus::Success, Some(100)),
            create_task("task4", TaskStatus::Failure, Some(200)),
            create_task("highlighted1", TaskStatus::NotStarted, None),
            create_task("highlighted2", TaskStatus::Success, Some(300)),
        ];

        // Highlight two tasks, one that is NotStarted and one that is Success
        let highlighted = HashSet::from(["highlighted1".to_string(), "highlighted2".to_string()]);
        sort_task_items(&mut tasks, &highlighted);

        // Expected order: InProgress (task2), Highlighted (highlighted1, highlighted2),
        // Failure (task4), Success (task3), NotStarted (task1)
        assert_eq!(tasks[0].name, "task2"); // InProgress
        assert!(tasks[1].name == "highlighted1" || tasks[1].name == "highlighted2");
        assert!(tasks[2].name == "highlighted1" || tasks[2].name == "highlighted2");
        assert_eq!(tasks[3].name, "task4"); // Failure
        assert_eq!(tasks[4].name, "task3"); // Success
        assert_eq!(tasks[5].name, "task1"); // NotStarted
    }

    #[test]
    fn test_sort_completed_tasks_by_end_time() {
        let mut tasks = vec![
            create_task("task1", TaskStatus::Success, Some(300)),
            create_task("task2", TaskStatus::Success, Some(100)),
            create_task("task3", TaskStatus::Success, Some(200)),
        ];

        let empty_highlighted: HashSet<String> = HashSet::new();
        sort_task_items(&mut tasks, &empty_highlighted);

        // Should be sorted by end_time: 100, 200, 300
        assert_eq!(tasks[0].name, "task2");
        assert_eq!(tasks[1].name, "task3");
        assert_eq!(tasks[2].name, "task1");
    }

    #[test]
    fn test_sort_with_missing_end_times() {
        let mut tasks = vec![
            create_task("task1", TaskStatus::Success, None),
            create_task("task2", TaskStatus::Success, Some(100)),
            create_task("task3", TaskStatus::Success, None),
        ];

        let empty_highlighted: HashSet<String> = HashSet::new();
        sort_task_items(&mut tasks, &empty_highlighted);

        // Tasks with end_time come before those without
        assert_eq!(tasks[0].name, "task2");
        // Then alphabetical for those without end_time
        assert_eq!(tasks[1].name, "task1");
        assert_eq!(tasks[2].name, "task3");
    }

    #[test]
    fn test_sort_same_status_no_end_time_by_name() {
        let mut tasks = vec![
            create_task("c", TaskStatus::NotStarted, None),
            create_task("a", TaskStatus::NotStarted, None),
            create_task("b", TaskStatus::NotStarted, None),
        ];

        let empty_highlighted: HashSet<String> = HashSet::new();
        sort_task_items(&mut tasks, &empty_highlighted);

        // Should be sorted alphabetically: a, b, c
        assert_eq!(tasks[0].name, "a");
        assert_eq!(tasks[1].name, "b");
        assert_eq!(tasks[2].name, "c");
    }

    #[test]
    fn test_sort_mixed_statuses_and_end_times() {
        let mut tasks = vec![
            create_task("z", TaskStatus::NotStarted, None),
            create_task("y", TaskStatus::InProgress, None),
            create_task("x", TaskStatus::Success, Some(300)),
            create_task("w", TaskStatus::Failure, Some(200)),
            create_task("v", TaskStatus::Success, None),
            create_task("u", TaskStatus::InProgress, None),
            create_task("t", TaskStatus::Failure, None),
            create_task("s", TaskStatus::NotStarted, None),
        ];

        let empty_highlighted: HashSet<String> = HashSet::new();
        sort_task_items(&mut tasks, &empty_highlighted);

        // Check the order within each status group
        let names: Vec<&str> = tasks.iter().map(|t| &t.name[..]).collect();

        // First group: InProgress
        assert_eq!(tasks[0].status, TaskStatus::InProgress);
        assert_eq!(tasks[1].status, TaskStatus::InProgress);
        assert!(names[0..2].contains(&"u"));
        assert!(names[0..2].contains(&"y"));
        assert_eq!(names[0], "u"); // Alphabetical within group

        // Second group: Failure
        assert_eq!(tasks[2].status, TaskStatus::Failure);
        assert_eq!(tasks[3].status, TaskStatus::Failure);
        assert_eq!(names[2], "w"); // With end_time comes first
        assert_eq!(names[3], "t"); // Without end_time comes second

        // Third group: Success
        assert_eq!(tasks[4].status, TaskStatus::Success);
        assert_eq!(tasks[5].status, TaskStatus::Success);
        assert_eq!(names[4], "x"); // With end_time comes first
        assert_eq!(names[5], "v"); // Without end_time comes second

        // Fourth group: NotStarted
        assert_eq!(tasks[6].status, TaskStatus::NotStarted);
        assert_eq!(tasks[7].status, TaskStatus::NotStarted);
        assert_eq!(names[6], "s"); // Alphabetical within group
        assert_eq!(names[7], "z");
    }

    #[test]
    fn test_sort_with_same_end_times() {
        let mut tasks = vec![
            create_task("c", TaskStatus::Success, Some(100)),
            create_task("a", TaskStatus::Success, Some(100)),
            create_task("b", TaskStatus::Success, Some(100)),
        ];

        let empty_highlighted: HashSet<String> = HashSet::new();
        sort_task_items(&mut tasks, &empty_highlighted);

        // When end_times are the same, should sort by name
        assert_eq!(tasks[0].name, "a");
        assert_eq!(tasks[1].name, "b");
        assert_eq!(tasks[2].name, "c");
    }

    #[test]
    fn test_sort_empty_list() {
        let mut tasks: Vec<TaskItem> = vec![];

        let empty_highlighted: HashSet<String> = HashSet::new();
        // Should not panic on empty list
        sort_task_items(&mut tasks, &empty_highlighted);

        assert!(tasks.is_empty());
    }

    #[test]
    fn test_sort_single_task() {
        let mut tasks = vec![create_task("task", TaskStatus::Success, Some(100))];

        let empty_highlighted: HashSet<String> = HashSet::new();
        // Should not change a single-element list
        sort_task_items(&mut tasks, &empty_highlighted);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].name, "task");
    }

    #[test]
    fn test_sort_stability_for_equal_elements() {
        // Create tasks with identical properties
        let mut tasks = vec![
            create_task("task1", TaskStatus::Success, Some(100)),
            create_task("task1", TaskStatus::Success, Some(100)),
        ];

        // Mark the original positions
        let original_names = tasks.iter().map(|t| t.name.clone()).collect::<Vec<_>>();

        let empty_highlighted: HashSet<String> = HashSet::new();
        // Sort should maintain original order for equal elements
        sort_task_items(&mut tasks, &empty_highlighted);

        let sorted_names = tasks.iter().map(|t| t.name.clone()).collect::<Vec<_>>();
        assert_eq!(sorted_names, original_names);
    }

    #[test]
    fn test_sort_edge_cases() {
        // Test with extreme end_time values
        let mut tasks = vec![
            create_task("a", TaskStatus::Success, Some(i64::MAX)),
            create_task("b", TaskStatus::Success, Some(0)),
            create_task("c", TaskStatus::Success, Some(i64::MAX / 2)),
        ];

        let empty_highlighted: HashSet<String> = HashSet::new();
        sort_task_items(&mut tasks, &empty_highlighted);

        // Should sort by end_time: 0, MAX/2, MAX
        assert_eq!(tasks[0].name, "b");
        assert_eq!(tasks[1].name, "c");
        assert_eq!(tasks[2].name, "a");
    }

    #[test]
    fn test_highlighted_tasks_empty_list() {
        let mut tasks = vec![
            create_task("task1", TaskStatus::NotStarted, None),
            create_task("task2", TaskStatus::InProgress, None),
            create_task("task3", TaskStatus::Success, Some(100)),
            create_task("task4", TaskStatus::Failure, Some(200)),
        ];

        // Empty highlighted list should not affect sorting
        let empty_highlighted: HashSet<String> = HashSet::new();
        sort_task_items(&mut tasks, &empty_highlighted);

        // Expected order: InProgress, Failure, Success, NotStarted
        assert_eq!(tasks[0].name, "task2"); // InProgress
        assert_eq!(tasks[1].name, "task4"); // Failure
        assert_eq!(tasks[2].name, "task3"); // Success
        assert_eq!(tasks[3].name, "task1"); // NotStarted
    }

    #[test]
    fn test_large_random_dataset() {
        use rand::rngs::StdRng;
        use rand::{Rng, SeedableRng};

        // Use a fixed seed for reproducibility
        let mut rng = StdRng::seed_from_u64(42);

        // Generate a large dataset with random properties
        let statuses = [
            TaskStatus::InProgress,
            TaskStatus::Failure,
            TaskStatus::Success,
            TaskStatus::NotStarted,
        ];

        let mut tasks: Vec<TaskItem> = (0..1000)
            .map(|i| {
                let name = format!("task{}", i);
                let status = statuses[rng.random_range(0..statuses.len())];
                let end_time = if rng.random_bool(0.7) {
                    Some(rng.random_range(100..10000))
                } else {
                    None
                };

                create_task(&name, status, end_time)
            })
            .collect();

        let empty_highlighted: HashSet<String> = HashSet::new();
        // Sort should not panic with large random dataset
        sort_task_items(&mut tasks, &empty_highlighted);

        // Verify the sort maintains the expected ordering rules
        for i in 1..tasks.len() {
            let a = &tasks[i - 1];
            let b = &tasks[i];

            // Map status to category for comparison
            let status_to_category = |status: &TaskStatus, name: &str| -> u8 {
                // In this test we're using an empty highlighted list
                match status {
                    TaskStatus::InProgress | TaskStatus::Shared => 0,
                    TaskStatus::Failure => 2,
                    TaskStatus::Success
                    | TaskStatus::LocalCacheKeptExisting
                    | TaskStatus::LocalCache
                    | TaskStatus::RemoteCache
                    | TaskStatus::Stopped
                    | TaskStatus::Skipped => 3,
                    TaskStatus::NotStarted => 4,
                }
            };

            let a_category = status_to_category(&a.status, &a.name);
            let b_category = status_to_category(&b.status, &b.name);

            if a_category < b_category {
                // If a's category is less than b's, that's correct
                continue;
            } else if a_category > b_category {
                // If a's category is greater than b's, that's an error
                panic!(
                    "Sort order violation: {:?} should come before {:?}",
                    b.name, a.name
                );
            }

            // Same category, check end_time for completed tasks
            if a_category == 2 || a_category == 3 {
                match (a.end_time, b.end_time) {
                    (Some(time_a), Some(time_b)) => {
                        if time_a > time_b {
                            panic!(
                                "Sort order violation: task with end_time {} should come before task with end_time {}",
                                time_b, time_a
                            );
                        } else if time_a < time_b {
                            continue;
                        }
                        // If end times are equal, fall through to name check
                    }
                    (Some(_), None) => continue, // Correct order
                    (None, Some(_)) => panic!(
                        "Sort order violation: task with end_time should come before task without end_time"
                    ),
                    (None, None) => {} // Fall through to name check
                }
            }

            // If we get here, we're comparing names within the same category
            // and with the same end_time status
            if a.name > b.name {
                panic!(
                    "Sort order violation: task named {} should come before task named {}",
                    b.name, a.name
                );
            }
        }
    }
}
