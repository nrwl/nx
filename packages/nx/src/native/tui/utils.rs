use color_eyre::eyre::Result;
use tracing::error;

use crate::native::tui::components::tasks_list::{TaskItem, TaskStatus};
use crate::native::tui::tui::Tui;

// TODO: Finalize this and its dependencies(originally taken from components template)
pub fn initialize_panic_handler() -> Result<()> {
    let (panic_hook, eyre_hook) = color_eyre::config::HookBuilder::default()
        .panic_section(format!(
            "This is a bug. Please report it at {}",
            "https://github.com/nrwl/nx/issues"
        ))
        .capture_span_trace_by_default(false)
        .display_location_section(false)
        .display_env_section(false)
        .into_hooks();
    eyre_hook.install()?;
    std::panic::set_hook(Box::new(move |panic_info| {
        if let Ok(mut t) = Tui::new() {
            if let Err(r) = t.exit() {
                error!("Unable to exit Terminal: {:?}", r);
            }
        }

        #[cfg(not(debug_assertions))]
        {
            use human_panic::{handle_dump, print_msg, Metadata};
            let meta = Metadata {
                version: env!("CARGO_PKG_VERSION").into(),
                name: env!("CARGO_PKG_NAME").into(),
                authors: env!("CARGO_PKG_AUTHORS").replace(':', ", ").into(),
                homepage: env!("CARGO_PKG_HOMEPAGE").into(),
            };

            let file_path = handle_dump(&meta, panic_info);
            print_msg(file_path, &meta)
                .expect("human-panic: printing error message to console failed");
            eprintln!("{}", panic_hook.panic_report(panic_info));
        }
        let msg = format!("{}", panic_hook.panic_report(panic_info));
        log::error!("Error: {}", strip_ansi_escapes::strip_str(msg));

        #[cfg(debug_assertions)]
        {
            better_panic::Settings::auto()
                .most_recent_first(false)
                .lineno_suffix(true)
                .verbosity(better_panic::Verbosity::Full)
                .create_panic_handler()(panic_info);
        }

        std::process::exit(libc::EXIT_FAILURE);
    }));
    Ok(())
}

pub fn format_duration(duration_ms: u128) -> String {
    if duration_ms == 0 {
        "<1ms".to_string()
    } else if duration_ms < 1000 {
        format!("{}ms", duration_ms)
    } else {
        format!("{:.1}s", duration_ms as f64 / 1000.0)
    }
}

pub fn format_duration_since(start_ms: u128, end_ms: u128) -> String {
    format_duration(end_ms.saturating_sub(start_ms))
}

/// Sorts a list of TaskItems with a stable, total ordering.
///
/// The sort order is:
/// 1. InProgress tasks first
/// 2. Failure tasks second
/// 3. Other completed tasks third (sorted by end_time if available)
/// 4. NotStarted tasks last
///
/// Within each status category:
/// - For completed tasks: sort by end_time if available, then by name
/// - For other statuses: sort by name
pub fn sort_task_items(tasks: &mut [TaskItem]) {
    tasks.sort_by(|a, b| {
        // Map status to a numeric category for sorting
        let status_to_category = |status: &TaskStatus| -> u8 {
            match status {
                TaskStatus::InProgress => 0,
                TaskStatus::Failure => 1,
                TaskStatus::Success
                | TaskStatus::LocalCacheKeptExisting
                | TaskStatus::LocalCache
                | TaskStatus::RemoteCache
                | TaskStatus::Skipped => 2,
                TaskStatus::NotStarted => 3,
            }
        };

        let a_category = status_to_category(&a.status);
        let b_category = status_to_category(&b.status);

        // First compare by status category
        if a_category != b_category {
            return a_category.cmp(&b_category);
        }

        // For completed tasks, sort by end_time if available
        if a_category == 1 || a_category == 2 {
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
    fn create_task(name: &str, status: TaskStatus, end_time: Option<u128>) -> TaskItem {
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

        sort_task_items(&mut tasks);

        // Expected order: InProgress, Failure, Success, NotStarted
        assert_eq!(tasks[0].status, TaskStatus::InProgress);
        assert_eq!(tasks[1].status, TaskStatus::Failure);
        assert_eq!(tasks[2].status, TaskStatus::Success);
        assert_eq!(tasks[3].status, TaskStatus::NotStarted);
    }

    #[test]
    fn test_sort_completed_tasks_by_end_time() {
        let mut tasks = vec![
            create_task("task1", TaskStatus::Success, Some(300)),
            create_task("task2", TaskStatus::Success, Some(100)),
            create_task("task3", TaskStatus::Success, Some(200)),
        ];

        sort_task_items(&mut tasks);

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

        sort_task_items(&mut tasks);

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

        sort_task_items(&mut tasks);

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

        sort_task_items(&mut tasks);

        // Expected groups by status:
        // 1. InProgress: "u", "y" (alphabetical)
        // 2. Failure: "w" (with end_time), "t" (without end_time)
        // 3. Success: "x" (with end_time), "v" (without end_time)
        // 4. NotStarted: "s", "z" (alphabetical)

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

        sort_task_items(&mut tasks);

        // When end_times are the same, should sort by name
        assert_eq!(tasks[0].name, "a");
        assert_eq!(tasks[1].name, "b");
        assert_eq!(tasks[2].name, "c");
    }

    #[test]
    fn test_sort_empty_list() {
        let mut tasks: Vec<TaskItem> = vec![];

        // Should not panic on empty list
        sort_task_items(&mut tasks);

        assert!(tasks.is_empty());
    }

    #[test]
    fn test_sort_single_task() {
        let mut tasks = vec![create_task("task", TaskStatus::Success, Some(100))];

        // Should not change a single-element list
        sort_task_items(&mut tasks);

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

        // Sort should maintain original order for equal elements
        sort_task_items(&mut tasks);

        let sorted_names = tasks.iter().map(|t| t.name.clone()).collect::<Vec<_>>();
        assert_eq!(sorted_names, original_names);
    }

    #[test]
    fn test_sort_large_random_dataset() {
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

        // Sort should not panic with large random dataset
        sort_task_items(&mut tasks);

        // Verify the sort maintains the expected ordering rules
        for i in 1..tasks.len() {
            let a = &tasks[i - 1];
            let b = &tasks[i];

            // Map status to category for comparison
            let status_to_category = |status: &TaskStatus| -> u8 {
                match status {
                    TaskStatus::InProgress => 0,
                    TaskStatus::Failure => 1,
                    TaskStatus::Success
                    | TaskStatus::LocalCacheKeptExisting
                    | TaskStatus::LocalCache
                    | TaskStatus::RemoteCache
                    | TaskStatus::Skipped => 2,
                    TaskStatus::NotStarted => 3,
                }
            };

            let a_category = status_to_category(&a.status);
            let b_category = status_to_category(&b.status);

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
            if a_category == 1 || a_category == 2 {
                match (a.end_time, b.end_time) {
                    (Some(time_a), Some(time_b)) => {
                        if time_a > time_b {
                            panic!("Sort order violation: task with end_time {} should come before task with end_time {}", time_b, time_a);
                        } else if time_a < time_b {
                            continue;
                        }
                        // If end times are equal, fall through to name check
                    }
                    (Some(_), None) => continue, // Correct order
                    (None, Some(_)) => panic!("Sort order violation: task with end_time should come before task without end_time"),
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

    #[test]
    fn test_sort_edge_cases() {
        // Test with extreme end_time values
        let mut tasks = vec![
            create_task("a", TaskStatus::Success, Some(u128::MAX)),
            create_task("b", TaskStatus::Success, Some(0)),
            create_task("c", TaskStatus::Success, Some(u128::MAX / 2)),
        ];

        sort_task_items(&mut tasks);

        // Should sort by end_time: 0, MAX/2, MAX
        assert_eq!(tasks[0].name, "b");
        assert_eq!(tasks[1].name, "c");
        assert_eq!(tasks[2].name, "a");
    }
}
