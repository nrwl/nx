use hashbrown::{HashMap as HashbrownHashMap, HashSet};
#[cfg(not(test))]
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::native::ide::nx_console::messaging::NxConsoleMessageConnection;
use crate::native::tasks::types::{Task, TaskGraph};
use crate::native::utils::time::current_timestamp_millis;

// Re-export for backward compatibility with places that use TuiState timing

use super::components::task_selection_manager::SelectionEntry;
use super::components::tasks_list::TaskStatus;
use super::config::TuiConfig;
use super::lifecycle::{BatchInfo, BatchStatus, RunMode};
use super::pty::PtyInstance;

// In test mode, use a stub type instead of the real NAPI ThreadsafeFunction.
// This is necessary because ThreadsafeFunction requires NAPI symbols that are
// only available when running in Node.js, not in standalone Rust test binaries.
#[cfg(test)]
pub type DoneCallback = ();
#[cfg(test)]
pub type ForcedShutdownCallback = ();

#[cfg(not(test))]
pub type DoneCallback = ThreadsafeFunction<(), ErrorStrategy::Fatal>;
#[cfg(not(test))]
pub type ForcedShutdownCallback = ThreadsafeFunction<(), ErrorStrategy::Fatal>;

/// Batch metadata stored for mode switching persistence
#[derive(Debug, Clone)]
pub struct StoredBatchState {
    pub info: BatchInfo,
    pub start_time: i64,
    pub is_completed: bool,
    pub final_status: Option<BatchStatus>,
    pub display_name: Option<String>,
    pub completion_time: Option<i64>,
    pub is_expanded: bool,
}

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

    // === Task Timing (all in milliseconds since epoch) ===
    task_start_times: HashMap<String, i64>,
    task_end_times: HashMap<String, i64>,
    estimated_task_timings: HashMap<String, i64>,

    // === Configuration ===
    run_mode: RunMode,
    tui_config: TuiConfig,
    pinned_tasks: Vec<String>,
    title_text: String,

    // === Callbacks ===
    // In test mode these are () which is zero-sized and has no Drop impl
    done_callback: Option<DoneCallback>,
    forced_shutdown_callback: Option<ForcedShutdownCallback>,

    // === Console Messaging ===
    console_messenger: Option<NxConsoleMessageConnection>,

    // === Quit State ===
    quit_at: Option<Instant>,
    is_forced_shutdown: bool,
    user_has_interacted: bool,

    // === Cloud Message ===
    cloud_message: Option<String>,

    // === UI State (for mode switching persistence) ===
    /// Tasks assigned to terminal panes [pane0, pane1]
    ui_pane_tasks: [Option<SelectionEntry>; 2],
    /// Whether spacebar (follow) mode is active
    ui_spacebar_mode: bool,
    /// Index of focused pane (None = task list, Some(0) = pane 0, Some(1) = pane 1)
    ui_focused_pane: Option<usize>,
    /// Currently selected item in the task list (task or batch group)
    ui_selected_item: Option<SelectionEntry>,
    /// max_parallel value from start_command, needed to restore TasksList parallel section
    ui_max_parallel: Option<u32>,

    // === Batch Metadata (for mode switching persistence) ===
    batch_metadata: HashMap<String, StoredBatchState>,

    // === Filter State (for mode switching persistence) ===
    /// Filter text from TasksList (always persisted when restored)
    ui_filter_text: String,

    dimensions: Option<(u16, u16)>,
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
        dimensions: Option<(u16, u16)>,
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
            cloud_message: None,
            ui_pane_tasks: [None, None],
            ui_spacebar_mode: false,
            ui_focused_pane: None,
            ui_selected_item: None,
            batch_metadata: HashMap::new(),
            ui_max_parallel: None,
            ui_filter_text: String::new(),
            dimensions,
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

    /// Get the task ID of the first currently running task (if any)
    ///
    /// This is useful for inline mode which shows output for the current running task.
    /// In multi-task scenarios, this returns an arbitrary running task.
    pub fn get_current_running_task(&self) -> Option<String> {
        self.task_status_map
            .iter()
            .find(|(_, status)| **status == TaskStatus::InProgress)
            .map(|(id, _)| id.clone())
    }

    /// Get the ID of the first currently running item (task or batch)
    ///
    /// Checks running tasks first, then running batches.
    /// Returns the ID as a String that can represent either type.
    pub fn get_current_running_item(&self) -> Option<String> {
        // First check for running tasks
        if let Some(task_id) = self
            .task_status_map
            .iter()
            .find(|(_, status)| **status == TaskStatus::InProgress)
            .map(|(id, _)| id.clone())
        {
            return Some(task_id);
        }
        // Then check for running batches
        self.batch_metadata
            .iter()
            .find(|(_, batch)| !batch.is_completed)
            .map(|(id, _)| id.clone())
    }

    /// Get count of completed tasks (any terminal state)
    ///
    /// Counts tasks with status: Success, Failure, Skipped, LocalCache,
    /// LocalCacheKeptExisting, RemoteCache
    pub fn get_completed_task_count(&self) -> usize {
        self.task_status_map
            .values()
            .filter(|status| {
                matches!(
                    status,
                    TaskStatus::Success
                        | TaskStatus::Failure
                        | TaskStatus::Skipped
                        | TaskStatus::LocalCache
                        | TaskStatus::LocalCacheKeptExisting
                        | TaskStatus::RemoteCache
                )
            })
            .count()
    }

    /// Get names of tasks that failed
    pub fn get_failed_task_names(&self) -> Vec<String> {
        self.task_status_map
            .iter()
            .filter(|(_, status)| **status == TaskStatus::Failure)
            .map(|(id, _)| id.clone())
            .collect()
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

    /// Get a mutable reference to all PTY instances
    /// Used for resizing PTYs when switching modes
    pub fn get_pty_instances_mut(&mut self) -> &mut HashMap<String, Arc<PtyInstance>> {
        &mut self.pty_instances
    }

    // === Task Timing Methods ===

    /// Record the start time of a task (in milliseconds since epoch)
    pub fn record_task_start(&mut self, task_id: String) {
        self.task_start_times
            .insert(task_id, current_timestamp_millis());
    }

    /// Record the end time of a task (in milliseconds since epoch)
    pub fn record_task_end(&mut self, task_id: String) {
        self.task_end_times
            .insert(task_id, current_timestamp_millis());
    }

    /// Get the start and end times of a task (in milliseconds since epoch)
    pub fn get_task_timing(&self, task_id: &str) -> (Option<i64>, Option<i64>) {
        (
            self.task_start_times.get(task_id).copied(),
            self.task_end_times.get(task_id).copied(),
        )
    }

    /// Get all task start times (for mode switching sync)
    pub fn get_task_start_times(&self) -> &HashMap<String, i64> {
        &self.task_start_times
    }

    /// Get all task end times (for mode switching sync)
    pub fn get_task_end_times(&self) -> &HashMap<String, i64> {
        &self.task_end_times
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
    //
    // These methods are only available in non-test builds because they require
    // NAPI symbols that are provided by Node.js at runtime.

    /// Set the done callback
    #[cfg(not(test))]
    pub fn set_done_callback(&mut self, callback: DoneCallback) {
        self.done_callback = Some(callback);
    }

    /// Set the forced shutdown callback
    #[cfg(not(test))]
    pub fn set_forced_shutdown_callback(&mut self, callback: ForcedShutdownCallback) {
        self.forced_shutdown_callback = Some(callback);
    }

    /// Call the done callback if it exists
    /// Can be called multiple times safely
    /// If is_forced_shutdown is true, also calls the forced_shutdown_callback first
    #[cfg(not(test))]
    pub fn call_done_callback(&self) {
        // Call forced shutdown callback first if this was a forced shutdown
        if self.is_forced_shutdown {
            if let Some(callback) = &self.forced_shutdown_callback {
                callback.call((), ThreadsafeFunctionCallMode::Blocking);
            }
        }
        // Then call the regular done callback
        if let Some(callback) = &self.done_callback {
            callback.call((), ThreadsafeFunctionCallMode::Blocking);
        }
    }

    /// Call the forced shutdown callback if it exists (standalone, without done callback)
    #[cfg(not(test))]
    pub fn call_forced_shutdown_callback(&self) {
        if let Some(callback) = &self.forced_shutdown_callback {
            callback.call((), ThreadsafeFunctionCallMode::Blocking);
        }
    }

    // Test-mode stubs for callback methods
    #[cfg(test)]
    pub fn call_done_callback(&self) {
        // No-op in test mode
    }

    #[cfg(test)]
    pub fn call_forced_shutdown_callback(&self) {
        // No-op in test mode
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

    // === Cloud Message Methods ===

    /// Set the cloud message to display
    pub fn set_cloud_message(&mut self, message: Option<String>) {
        self.cloud_message = message;
    }

    /// Get the cloud message (if any)
    pub fn get_cloud_message(&self) -> Option<&str> {
        self.cloud_message.as_deref()
    }

    // === UI State Methods (for mode switching persistence) ===

    /// Save the UI state from full-screen mode for later restoration
    pub fn save_ui_state(
        &mut self,
        pane_tasks: [Option<SelectionEntry>; 2],
        spacebar_mode: bool,
        focused_pane: Option<usize>,
        selected_item: Option<SelectionEntry>,
        batch_expansion_states: HashbrownHashMap<String, bool>,
        filter_text: String,
    ) {
        self.ui_pane_tasks = pane_tasks;
        self.ui_spacebar_mode = spacebar_mode;
        self.ui_focused_pane = focused_pane;
        self.ui_selected_item = selected_item;
        self.ui_filter_text = filter_text;

        // Update batch expansion states in metadata
        for (batch_id, is_expanded) in batch_expansion_states {
            if let Some(batch) = self.batch_metadata.get_mut(&batch_id) {
                batch.is_expanded = is_expanded;
            }
        }
    }

    /// Get the saved pane tasks
    pub fn get_ui_pane_tasks(&self) -> &[Option<SelectionEntry>; 2] {
        &self.ui_pane_tasks
    }

    /// Get whether spacebar mode was active
    pub fn get_ui_spacebar_mode(&self) -> bool {
        self.ui_spacebar_mode
    }

    /// Get the focused pane index (None = task list)
    pub fn get_ui_focused_pane(&self) -> Option<usize> {
        self.ui_focused_pane
    }

    /// Get the saved selected item from the task list (task or batch group)
    pub fn get_ui_selected_item(&self) -> Option<&SelectionEntry> {
        self.ui_selected_item.as_ref()
    }

    /// Get the item ID (task or batch) that should be shown in inline mode
    /// Priority: focused pane item > first pane item > selected item
    pub fn get_focused_item_id(&self) -> Option<String> {
        // If we have a focused pane, use that pane's item
        if let Some(pane_idx) = self.ui_focused_pane {
            if let Some(selection) = &self.ui_pane_tasks[pane_idx] {
                return Some(selection.id().to_string());
            }
        }
        // Otherwise try the first pane
        if let Some(selection) = &self.ui_pane_tasks[0] {
            return Some(selection.id().to_string());
        }
        // No pane items available
        None
    }

    // === Batch Metadata Methods (for mode switching persistence) ===

    /// Store batch metadata for mode switching
    pub fn save_batch_metadata(
        &mut self,
        batch_id: String,
        info: BatchInfo,
        start_time: i64,
        is_expanded: bool,
    ) {
        self.batch_metadata.insert(
            batch_id,
            StoredBatchState {
                info,
                start_time,
                is_completed: false,
                final_status: None,
                display_name: None,
                completion_time: None,
                is_expanded,
            },
        );
    }

    /// Update batch as completed
    pub fn complete_batch_metadata(
        &mut self,
        batch_id: &str,
        final_status: BatchStatus,
        display_name: String,
        completion_time: i64,
    ) {
        if let Some(batch) = self.batch_metadata.get_mut(batch_id) {
            batch.is_completed = true;
            batch.final_status = Some(final_status);
            batch.display_name = Some(display_name);
            batch.completion_time = Some(completion_time);
        }
    }

    /// Remove batch metadata (when batch is unpinned or fully cleaned up)
    pub fn remove_batch_metadata(&mut self, batch_id: &str) {
        self.batch_metadata.remove(batch_id);
    }

    /// Get all batch metadata for restoration
    pub fn get_batch_metadata(&self) -> &HashMap<String, StoredBatchState> {
        &self.batch_metadata
    }

    // === Max Parallel Methods (for mode switching persistence) ===

    /// Save max_parallel value for mode switching restoration
    pub fn save_max_parallel(&mut self, max_parallel: Option<u32>) {
        self.ui_max_parallel = max_parallel;
    }

    /// Get saved max_parallel value for mode switching restoration
    pub fn get_max_parallel(&self) -> Option<u32> {
        self.ui_max_parallel
    }

    /// Get saved filter text for mode switching restoration
    pub fn get_filter_text(&self) -> &str {
        &self.ui_filter_text
    }

    pub fn get_dimensions(&self) -> Option<(u16, u16)> {
        self.dimensions
    }

    pub fn set_dimensions(&mut self, dimensions: (u16, u16)) {
        self.dimensions = Some(dimensions);
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
            config::TuiConfig::new(None, None, &cli_args),
            String::from("Test"),
            task_graph,
            HashMap::new(),
            None,
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
        use crate::native::utils::time::current_timestamp_millis;

        let mut state = create_test_state();

        // Record start
        let before_start = current_timestamp_millis();
        state.record_task_start(String::from("app1"));
        let after_start = current_timestamp_millis();

        // Small delay
        std::thread::sleep(Duration::from_millis(10));

        // Record end
        let before_end = current_timestamp_millis();
        state.record_task_end(String::from("app1"));
        let after_end = current_timestamp_millis();

        // Verify timings
        let (start, end) = state.get_task_timing("app1");
        assert!(start.is_some());
        assert!(end.is_some());

        let start = start.unwrap();
        let end = end.unwrap();

        // Verify start is in expected range (millis)
        assert!(start >= before_start && start <= after_start);

        // Verify end is in expected range (millis)
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

    #[test]
    fn test_get_task_start_and_end_times() {
        let mut state = create_test_state();

        state.record_task_start(String::from("app1"));
        state.record_task_end(String::from("app1"));

        let start_times = state.get_task_start_times();
        let end_times = state.get_task_end_times();

        assert!(start_times.contains_key("app1"));
        assert!(end_times.contains_key("app1"));
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
        use parking_lot::Mutex;
        use std::sync::Arc;

        let state = Arc::new(Mutex::new(create_test_state()));

        let state_clone = state.clone();
        let handle = std::thread::spawn(move || {
            let mut s = state_clone.lock();
            s.update_task_status(String::from("app1"), TaskStatus::Success);
        });

        handle.join().unwrap();

        // Verify change is visible
        let s = state.lock();
        assert_eq!(s.get_task_status("app1"), Some(TaskStatus::Success));
    }

    #[test]
    fn test_cheap_arc_clone() {
        use parking_lot::Mutex;
        use std::sync::Arc;

        let state = Arc::new(Mutex::new(create_test_state()));

        // Clone should be cheap (just incrementing ref count)
        let clone1 = state.clone();
        let clone2 = state.clone();

        // All should point to same data
        assert!(Arc::ptr_eq(&state, &clone1));
        assert!(Arc::ptr_eq(&state, &clone2));
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
            config::TuiConfig::new(None, None, &cli_args),
            String::from("Test"),
            task_graph,
            HashMap::new(),
            None,
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
