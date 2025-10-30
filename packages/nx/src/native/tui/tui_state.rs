use hashbrown::HashSet;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::native::tasks::types::{Task, TaskGraph};
use crate::native::ide::nx_console::messaging::NxConsoleMessageConnection;

use super::components::tasks_list::TaskStatus;
use super::config::TuiConfig;
use super::lifecycle::RunMode;
use super::pty::PtyInstance;

/// Shared state that can be transferred between TUI modes
/// This is the "source of truth" for task execution state
///
/// Note: This struct is NOT Clone. Access only via Arc<Mutex<TuiState>>
pub struct TuiState {
    // === Core Task Data ===
    tasks: Vec<Task>,
    task_status_map: HashMap<String, TaskStatus>,
    task_graph: TaskGraph,
    initiating_tasks: HashSet<String>,

    // === PTY Management ===
    pty_instances: HashMap<String, Arc<PtyInstance>>,

    // === Task Timing ===
    task_start_times: HashMap<String, Instant>,
    task_end_times: HashMap<String, Instant>,
    estimated_task_timings: HashMap<String, i64>,

    // === Configuration ===
    run_mode: RunMode,
    tui_config: TuiConfig,
    pinned_tasks: Vec<String>,
    title_text: String,

    // === Callbacks ===
    done_callback: Option<ThreadsafeFunction<(), ErrorStrategy::Fatal>>,
    forced_shutdown_callback: Option<ThreadsafeFunction<(), ErrorStrategy::Fatal>>,

    // === Console Messaging ===
    console_messenger: Option<NxConsoleMessageConnection>,

    // === Quit State ===
    quit_at: Option<Instant>,
    is_forced_shutdown: bool,
    user_has_interacted: bool,
}

impl TuiState {
    /// Create a new TuiState with the given tasks and configuration
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        tasks: Vec<Task>,
        initiating_tasks: HashSet<String>,
        run_mode: RunMode,
        pinned_tasks: Vec<String>,
        tui_config: TuiConfig,
        title_text: String,
        task_graph: TaskGraph,
        estimated_task_timings: HashMap<String, i64>,
    ) -> Self {
        // Initialize task status map with NotStarted for all tasks
        let mut task_status_map = HashMap::new();
        for task in &tasks {
            task_status_map.insert(task.id.clone(), TaskStatus::NotStarted);
        }

        Self {
            tasks,
            task_status_map,
            task_graph,
            initiating_tasks,
            pty_instances: HashMap::new(),
            task_start_times: HashMap::new(),
            task_end_times: HashMap::new(),
            estimated_task_timings,
            run_mode,
            tui_config,
            pinned_tasks,
            title_text,
            done_callback: None,
            forced_shutdown_callback: None,
            console_messenger: None,
            quit_at: None,
            is_forced_shutdown: false,
            user_has_interacted: false,
        }
    }

    // === Task Status Methods ===

    /// Update the status of a task
    pub fn update_task_status(&mut self, task_id: String, status: TaskStatus) {
        self.task_status_map.insert(task_id, status);
    }

    /// Get the status of a task
    pub fn get_task_status(&self, task_id: &str) -> Option<TaskStatus> {
        self.task_status_map.get(task_id).copied()
    }

    /// Get a reference to the entire task status map
    pub fn get_task_status_map(&self) -> &HashMap<String, TaskStatus> {
        &self.task_status_map
    }

    // === PTY Management Methods ===

    /// Register a PTY instance for a task
    pub fn register_pty_instance(&mut self, task_id: String, pty: Arc<PtyInstance>) {
        self.pty_instances.insert(task_id, pty);
    }

    /// Get a PTY instance for a task
    pub fn get_pty_instance(&self, task_id: &str) -> Option<Arc<PtyInstance>> {
        self.pty_instances.get(task_id).cloned()
    }

    /// Get a reference to all PTY instances
    pub fn get_pty_instances(&self) -> &HashMap<String, Arc<PtyInstance>> {
        &self.pty_instances
    }

    // === Task Timing Methods ===

    /// Record the start time of a task
    pub fn record_task_start(&mut self, task_id: String) {
        self.task_start_times.insert(task_id, Instant::now());
    }

    /// Record the end time of a task
    pub fn record_task_end(&mut self, task_id: String) {
        self.task_end_times.insert(task_id, Instant::now());
    }

    /// Get the start and end times of a task
    pub fn get_task_timing(&self, task_id: &str) -> (Option<Instant>, Option<Instant>) {
        (
            self.task_start_times.get(task_id).copied(),
            self.task_end_times.get(task_id).copied(),
        )
    }

    /// Set estimated task timings
    pub fn set_estimated_task_timings(&mut self, timings: HashMap<String, i64>) {
        self.estimated_task_timings = timings;
    }

    /// Get estimated task timings
    pub fn estimated_task_timings(&self) -> &HashMap<String, i64> {
        &self.estimated_task_timings
    }

    // === Quit Management Methods ===

    /// Check if the application should quit
    pub fn should_quit(&self) -> bool {
        if let Some(quit_at) = self.quit_at {
            Instant::now() >= quit_at
        } else {
            false
        }
    }

    /// Schedule a quit after a delay
    /// If called multiple times, the last call wins
    pub fn schedule_quit(&mut self, delay: Duration) {
        self.quit_at = Some(Instant::now() + delay);
    }

    /// Quit immediately (sets quit time to now)
    pub fn quit_immediately(&mut self) {
        self.quit_at = Some(Instant::now());
    }

    /// Cancel a scheduled quit
    pub fn cancel_quit(&mut self) {
        self.quit_at = None;
    }

    // === Callback Methods ===

    /// Set the done callback
    pub fn set_done_callback(&mut self, callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>) {
        self.done_callback = Some(callback);
    }

    /// Set the forced shutdown callback
    pub fn set_forced_shutdown_callback(
        &mut self,
        callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) {
        self.forced_shutdown_callback = Some(callback);
    }

    /// Call the done callback if it exists
    /// Can be called multiple times safely
    pub fn call_done_callback(&self) {
        if let Some(callback) = &self.done_callback {
            callback.call((), ThreadsafeFunctionCallMode::Blocking);
        }
    }

    /// Call the forced shutdown callback if it exists
    pub fn call_forced_shutdown_callback(&self) {
        if let Some(callback) = &self.forced_shutdown_callback {
            callback.call((), ThreadsafeFunctionCallMode::Blocking);
        }
    }

    // === Console Messenger Methods ===

    /// Set the console messenger
    pub fn set_console_messenger(&mut self, messenger: NxConsoleMessageConnection) {
        self.console_messenger = Some(messenger);
    }

    /// Get a reference to the console messenger
    pub fn get_console_messenger(&self) -> Option<&NxConsoleMessageConnection> {
        self.console_messenger.as_ref()
    }

    // === Read-Only Accessors ===

    /// Get a reference to all tasks
    pub fn tasks(&self) -> &Vec<Task> {
        &self.tasks
    }

    /// Get a reference to the task graph
    pub fn task_graph(&self) -> &TaskGraph {
        &self.task_graph
    }

    /// Get the run mode
    pub fn run_mode(&self) -> RunMode {
        self.run_mode
    }

    /// Get a reference to the TUI config
    pub fn tui_config(&self) -> &TuiConfig {
        &self.tui_config
    }

    /// Get a reference to pinned tasks
    pub fn pinned_tasks(&self) -> &Vec<String> {
        &self.pinned_tasks
    }

    /// Get the title text
    pub fn title_text(&self) -> &str {
        &self.title_text
    }

    /// Get a reference to initiating tasks
    pub fn initiating_tasks(&self) -> &HashSet<String> {
        &self.initiating_tasks
    }

    // === User Interaction Methods ===

    /// Mark that the user has interacted with the TUI
    pub fn mark_user_interacted(&mut self) {
        self.user_has_interacted = true;
    }

    /// Check if the user has interacted with the TUI
    pub fn has_user_interacted(&self) -> bool {
        self.user_has_interacted
    }

    // === Forced Shutdown Methods ===

    /// Set the forced shutdown flag
    pub fn set_forced_shutdown(&mut self, forced: bool) {
        self.is_forced_shutdown = forced;
    }

    /// Check if this is a forced shutdown
    pub fn is_forced_shutdown(&self) -> bool {
        self.is_forced_shutdown
    }
}

// Compile-time verification that TuiState is Send
// This ensures it can be safely shared across thread boundaries via Arc<Mutex<>>
static_assertions::assert_impl_all!(TuiState: Send);

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::TaskTarget;
    use crate::native::tui::config;

    fn create_test_task(id: &str) -> Task {
        Task {
            id: id.to_string(),
            target: TaskTarget {
                project: id.to_string(),
                target: "build".to_string(),
                configuration: None,
            },
            outputs: vec![],
            project_root: Some(format!("/tmp/{}", id)),
            start_time: None,
            end_time: None,
            continuous: None,
        }
    }

    fn create_test_state() -> TuiState {
        let tasks = vec![create_test_task("app1"), create_test_task("app2")];
        let initiating_tasks = HashSet::from([String::from("app1")]);
        let task_graph = TaskGraph {
            tasks: HashMap::new(),
            dependencies: HashMap::new(),
            continuous_dependencies: HashMap::new(),
            roots: vec![],
        };

        let cli_args = config::TuiCliArgs {
            targets: vec![],
            tui_auto_exit: None,
        };

        TuiState::new(
            tasks,
            initiating_tasks,
            RunMode::RunMany,
            vec![],
            config::TuiConfig::new(None, &cli_args),
            String::from("Test"),
            task_graph,
            HashMap::new(),
        )
    }

    // === Task Status Tests ===

    #[test]
    fn test_task_status_updates() {
        let mut state = create_test_state();

        // Initial status should be NotStarted
        assert_eq!(state.get_task_status("app1"), Some(TaskStatus::NotStarted));

        // Update status
        state.update_task_status(String::from("app1"), TaskStatus::InProgress);

        // Verify status updated
        assert_eq!(state.get_task_status("app1"), Some(TaskStatus::InProgress));
    }

    #[test]
    fn test_task_status_nonexistent() {
        let state = create_test_state();
        assert_eq!(state.get_task_status("nonexistent"), None);
    }

    #[test]
    fn test_get_task_status_map() {
        let mut state = create_test_state();
        state.update_task_status(String::from("app1"), TaskStatus::Success);
        state.update_task_status(String::from("app2"), TaskStatus::InProgress);

        let map = state.get_task_status_map();
        assert_eq!(map.get("app1"), Some(&TaskStatus::Success));
        assert_eq!(map.get("app2"), Some(&TaskStatus::InProgress));
    }

    // === PTY Management Tests ===

    #[test]
    fn test_pty_registration() {
        let mut state = create_test_state();

        // Create mock PTY instance
        let pty = Arc::new(PtyInstance::non_interactive_with_dimensions(24, 80));

        // Register PTY
        state.register_pty_instance(String::from("app1"), pty.clone());

        // Verify PTY is retrievable
        let retrieved = state.get_pty_instance("app1");
        assert!(retrieved.is_some());
        assert!(Arc::ptr_eq(&pty, &retrieved.unwrap()));
    }

    #[test]
    fn test_pty_instance_nonexistent() {
        let state = create_test_state();
        assert!(state.get_pty_instance("nonexistent").is_none());
    }

    #[test]
    fn test_multiple_pty_registrations() {
        let mut state = create_test_state();

        let pty1 = Arc::new(PtyInstance::non_interactive_with_dimensions(24, 80));
        let pty2 = Arc::new(PtyInstance::non_interactive_with_dimensions(30, 120));

        state.register_pty_instance(String::from("app1"), pty1.clone());
        state.register_pty_instance(String::from("app2"), pty2.clone());

        let instances = state.get_pty_instances();
        assert_eq!(instances.len(), 2);
        assert!(instances.contains_key("app1"));
        assert!(instances.contains_key("app2"));
    }

    // === Quit Management Tests ===

    #[test]
    fn test_schedule_quit_not_reached() {
        let mut state = create_test_state();

        // Schedule quit in 1 second
        state.schedule_quit(Duration::from_secs(1));

        // Should not quit immediately
        assert!(!state.should_quit());
    }

    #[test]
    fn test_schedule_quit_reached() {
        let mut state = create_test_state();

        // Schedule quit in 10ms
        state.schedule_quit(Duration::from_millis(10));

        // Wait for timeout
        std::thread::sleep(Duration::from_millis(50));

        // Should quit now
        assert!(state.should_quit());
    }

    #[test]
    fn test_quit_immediately() {
        let mut state = create_test_state();

        // Quit immediately
        state.quit_immediately();

        // Should quit right away
        assert!(state.should_quit());
    }

    #[test]
    fn test_cancel_quit() {
        let mut state = create_test_state();

        // Schedule quit
        state.schedule_quit(Duration::from_millis(10));

        // Cancel before timeout
        state.cancel_quit();

        // Wait past original timeout
        std::thread::sleep(Duration::from_millis(50));

        // Should NOT quit (was cancelled)
        assert!(!state.should_quit());
    }

    #[test]
    fn test_schedule_quit_overwrite() {
        let mut state = create_test_state();

        // Schedule quit in 1 second
        state.schedule_quit(Duration::from_secs(1));

        // Immediately overwrite with shorter delay
        state.schedule_quit(Duration::from_millis(10));

        // Wait for short delay
        std::thread::sleep(Duration::from_millis(50));

        // Should quit (last schedule wins)
        assert!(state.should_quit());
    }

    // === Task Timing Tests ===

    #[test]
    fn test_task_timing() {
        let mut state = create_test_state();

        // Record start
        let before_start = Instant::now();
        state.record_task_start(String::from("app1"));
        let after_start = Instant::now();

        // Small delay
        std::thread::sleep(Duration::from_millis(10));

        // Record end
        let before_end = Instant::now();
        state.record_task_end(String::from("app1"));
        let after_end = Instant::now();

        // Verify timings
        let (start, end) = state.get_task_timing("app1");
        assert!(start.is_some());
        assert!(end.is_some());

        let start = start.unwrap();
        let end = end.unwrap();

        // Verify start is in expected range
        assert!(start >= before_start && start <= after_start);

        // Verify end is in expected range
        assert!(end >= before_end && end <= after_end);

        // Verify end is after start
        assert!(end > start);
    }

    #[test]
    fn test_task_timing_nonexistent() {
        let state = create_test_state();
        let (start, end) = state.get_task_timing("nonexistent");
        assert!(start.is_none());
        assert!(end.is_none());
    }

    // === Callback Tests ===

    #[test]
    fn test_call_done_callback_none() {
        let state = create_test_state();

        // Should not panic when callback is None
        state.call_done_callback();
    }

    #[test]
    fn test_call_forced_shutdown_callback_none() {
        let state = create_test_state();

        // Should not panic when callback is None
        state.call_forced_shutdown_callback();
    }

    // === User Interaction Tests ===

    #[test]
    fn test_user_interaction_tracking() {
        let mut state = create_test_state();

        // Initially false
        assert!(!state.has_user_interacted());

        // Mark as interacted
        state.mark_user_interacted();

        // Now true
        assert!(state.has_user_interacted());
    }

    // === Forced Shutdown Tests ===

    #[test]
    fn test_forced_shutdown_tracking() {
        let mut state = create_test_state();

        // Initially false
        assert!(!state.is_forced_shutdown());

        // Set forced shutdown
        state.set_forced_shutdown(true);

        // Now true
        assert!(state.is_forced_shutdown());

        // Can unset
        state.set_forced_shutdown(false);
        assert!(!state.is_forced_shutdown());
    }

    // === Read-Only Accessor Tests ===

    #[test]
    fn test_read_only_accessors() {
        let state = create_test_state();

        // Verify all accessors work
        assert_eq!(state.tasks().len(), 2);
        // run_mode() accessor works (value checked during construction)
        let _ = state.run_mode();
        assert!(state.pinned_tasks().is_empty());
        assert_eq!(state.title_text(), "Test");
        assert_eq!(state.initiating_tasks().len(), 1);
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use crate::native::tasks::types::TaskTarget;
    use crate::native::tui::config;

    #[test]
    fn test_shared_state_across_threads() {
        use std::sync::{Arc, Mutex};

        let state = Arc::new(Mutex::new(create_test_state()));

        let state_clone = state.clone();
        let handle = std::thread::spawn(move || {
            let mut s = state_clone.lock().unwrap();
            s.update_task_status(String::from("app1"), TaskStatus::Success);
        });

        handle.join().unwrap();

        // Verify change is visible
        let s = state.lock().unwrap();
        assert_eq!(s.get_task_status("app1"), Some(TaskStatus::Success));
    }

    #[test]
    fn test_cheap_arc_clone() {
        use std::sync::{Arc, Mutex};

        let state = Arc::new(Mutex::new(create_test_state()));

        // Clone should be cheap (just incrementing ref count)
        let clone1 = state.clone();
        let clone2 = state.clone();

        // All should point to same data
        assert!(Arc::ptr_eq(&state, &clone1));
        assert!(Arc::ptr_eq(&state, &clone2));
    }

    fn create_test_state() -> TuiState {
        let tasks = vec![
            create_test_task("app1"),
            create_test_task("app2"),
        ];
        let initiating_tasks = HashSet::from([String::from("app1")]);
        let task_graph = TaskGraph {
            tasks: HashMap::new(),
            dependencies: HashMap::new(),
            continuous_dependencies: HashMap::new(),
            roots: vec![],
        };

        let cli_args = config::TuiCliArgs {
            targets: vec![],
            tui_auto_exit: None,
        };

        TuiState::new(
            tasks,
            initiating_tasks,
            RunMode::RunMany,
            vec![],
            config::TuiConfig::new(None, &cli_args),
            String::from("Test"),
            task_graph,
            HashMap::new(),
        )
    }

    fn create_test_task(id: &str) -> Task {
        Task {
            id: id.to_string(),
            target: TaskTarget {
                project: id.to_string(),
                target: "build".to_string(),
                configuration: None,
            },
            outputs: vec![],
            project_root: Some(format!("/tmp/{}", id)),
            start_time: None,
            end_time: None,
            continuous: None,
        }
    }
}
