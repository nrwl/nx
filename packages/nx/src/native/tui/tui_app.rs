use color_eyre::eyre::Result;
use napi::bindgen_prelude::External;
use parking_lot::Mutex;
use ratatui::layout::Size;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc::UnboundedSender;

use crate::native::ide::nx_console::messaging::NxConsoleMessageConnection;
use crate::native::{
    pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc},
    tasks::types::{Task, TaskResult},
};

use super::action::Action;
use super::components::tasks_list::TaskStatus;
use super::lifecycle::{BatchStatus, TuiMode};
use super::pty::PtyInstance;
use super::tui;
use super::tui_core::TuiCore;
use super::tui_state::TuiState;
#[cfg(not(test))]
use super::tui_state::{DoneCallback, ForcedShutdownCallback};
use super::utils::write_output_to_pty;
use crate::native::utils::time::current_timestamp_millis;

/// Batch task group information
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BatchInfo {
    pub executor_name: String,
    pub task_ids: Vec<String>,
}

/// Common trait for both full-screen and inline TUI implementations
///
/// This allows lifecycle.rs to handle both modes uniformly through a common interface.
/// Both `App` (full-screen) and `InlineApp` (inline) will implement this trait.
///
/// # Thread Safety
///
/// Implementations of this trait must be `Send` to work in async contexts.
///
/// # Shared State
///
/// Both implementations should use `Arc<Mutex<TuiState>>` for shared state,
/// allowing state to be transferred between modes during mode switching.
pub trait TuiApp: Send {
    // === Core Access ===
    //
    // These accessor methods enable default implementations that delegate to TuiCore.
    // Implementors must provide these to get the default behavior.

    /// Get immutable reference to the TuiCore
    ///
    /// This enables default implementations for methods that only read from core.
    fn core(&self) -> &TuiCore;

    /// Get mutable reference to the TuiCore
    ///
    /// This enables default implementations for methods that need to modify core.
    fn core_mut(&mut self) -> &mut TuiCore;

    /// Get reference to the shared state Arc
    ///
    /// This enables default implementations to access state directly
    /// without going through TuiCore, reducing indirection for simple operations.
    fn state(&self) -> &Arc<Mutex<TuiState>> {
        self.core().state()
    }

    // === Event Handling ===

    /// Handle a terminal event (keyboard, mouse, resize, etc.)
    ///
    /// Returns `Ok(true)` if the event was handled, `Ok(false)` if it should be ignored.
    ///
    /// # Arguments
    ///
    /// * `event` - The terminal event to handle
    /// * `action_tx` - Channel for sending actions to the event loop
    fn handle_event(
        &mut self,
        event: tui::Event,
        action_tx: &UnboundedSender<Action>,
    ) -> Result<bool>;

    /// Handle an action from the action channel
    ///
    /// # Arguments
    ///
    /// * `tui` - The TUI instance for rendering
    /// * `action` - The action to handle
    /// * `action_tx` - Channel for sending additional actions
    fn handle_action(
        &mut self,
        tui: &mut tui::Tui,
        action: Action,
        action_tx: &UnboundedSender<Action>,
    );

    // === Action Channel ===

    /// Register the action channel sender with this app
    ///
    /// Default implementation delegates to TuiCore.
    fn register_action_handler(&mut self, tx: UnboundedSender<Action>) -> Result<()> {
        self.core_mut().register_action_handler(tx);
        Ok(())
    }

    // === Mode Identification ===

    /// Get the TUI mode for this app (FullScreen or Inline)
    ///
    /// This is used to identify which mode is currently active.
    fn get_tui_mode(&self) -> TuiMode;

    // === Initialization ===

    /// Initialize the app with the given terminal area size
    ///
    /// Called once when the app is first created, before the event loop starts.
    ///
    /// # Arguments
    ///
    /// * `area` - The initial terminal size
    fn init(&mut self, area: Size) -> Result<()>;

    // === Task Lifecycle ===
    //
    // Task lifecycle uses hooks for mode-specific behavior:
    // - `on_tasks_started()` - called after tasks are recorded in TuiCore
    // - `on_tasks_ended()` - called after task results are recorded

    /// Called when a command starts (before any tasks run)
    ///
    /// Default implementation notifies console messenger if connected.
    ///
    /// # Arguments
    ///
    /// * `thread_count` - Number of threads available for task execution
    fn start_command(&mut self, _thread_count: Option<u32>) {
        // Default: notify console messenger if connected
        let state = self.core().state().lock();
        if let Some(messenger) = state.get_console_messenger() {
            messenger.start_running_tasks();
        }
    }

    /// Hook called after tasks are started
    ///
    /// Override to perform mode-specific post-start logic:
    /// - Full-screen: dispatch StartTasks action
    /// - Inline: auto-select first task
    ///
    /// Default implementation does nothing.
    fn on_tasks_started(&mut self, _tasks: &[Task]) {
        // Default: no-op
    }

    /// Hook called after tasks are ended
    ///
    /// Override to perform mode-specific post-end logic:
    /// - Full-screen: dispatch EndTasks action, debounce resize
    ///
    /// Default implementation does nothing.
    fn on_tasks_ended(&mut self, _task_results: &[TaskResult]) {
        // Default: no-op
    }

    /// Called when tasks begin execution
    ///
    /// Default implementation records timing in TuiCore and calls hook.
    ///
    /// # Arguments
    ///
    /// * `tasks` - List of tasks that will be executed
    fn start_tasks(&mut self, tasks: Vec<Task>) {
        self.core().start_tasks(&tasks);
        self.on_tasks_started(&tasks);
    }

    /// Update the status of a specific task
    ///
    /// Default implementation delegates to TuiCore.
    ///
    /// # Arguments
    ///
    /// * `task_id` - The task identifier
    /// * `status` - The new status for the task
    fn update_task_status(&mut self, task_id: String, status: TaskStatus) {
        self.core().update_task_status(task_id, status);
    }

    /// Called when tasks finish execution
    ///
    /// Default implementation records timing in TuiCore and calls hook.
    ///
    /// # Arguments
    ///
    /// * `task_results` - Results of all completed tasks
    fn end_tasks(&mut self, task_results: Vec<TaskResult>) {
        self.core().end_tasks(&task_results);
        self.on_tasks_ended(&task_results);
    }

    /// Called when the entire command finishes
    ///
    /// Default implementation delegates to TuiCore and dispatches EndCommand action.
    fn end_command(&mut self) {
        self.core().end_command();
        self.core().dispatch_action(Action::EndCommand);
    }

    // === PTY Registration ===
    //
    // PTY registration uses the Template Method pattern:
    // - `calculate_pty_dimensions()` is mode-specific (required)
    // - `on_pty_registered()` is an optional hook for post-registration logic
    // - Registration methods have default implementations using these hooks

    /// Calculate PTY dimensions for this mode
    ///
    /// This is mode-specific because:
    /// - Full-screen mode: calculates based on terminal pane split
    /// - Inline mode: calculates for minimal UI overhead
    ///
    /// Returns (rows, cols) for the PTY.
    /// Dimensions should be the size of the terminal pane where the PTY will be displayed.
    fn calculate_pty_dimensions(&self) -> (u16, u16);

    /// Hook called after a PTY is registered
    ///
    /// Override this to perform mode-specific post-registration logic:
    /// - Full-screen: debounce PTY resize, update status
    /// - Inline: initialize scrollback tracking
    ///
    /// Default implementation does nothing.
    fn on_pty_registered(&mut self, _task_id: &str) {
        // Default: no-op
    }

    /// Register a running interactive task with its PTY parser and writer
    ///
    /// Default implementation creates a PTY, registers it, and calls the hook.
    /// Interactive PTYs are NOT resized because they handle dimensions through
    /// the parser/writer. Override if mode-specific resizing is needed.
    ///
    /// # Arguments
    ///
    /// * `task_id` - The task identifier
    /// * `parser_and_writer` - External reference to PTY parser and writer
    fn register_running_interactive_task(
        &mut self,
        task_id: String,
        parser_and_writer: External<(ParserArc, WriterArc)>,
    ) {
        // Interactive PTYs don't need dimension calculation - they use parser/writer dimensions
        let pty =
            PtyInstance::interactive(parser_and_writer.0.clone(), parser_and_writer.1.clone());

        let pty = Arc::new(pty);
        self.state()
            .lock()
            .register_pty_instance(task_id.clone(), pty);

        // Call mode-specific hook
        self.on_pty_registered(&task_id);
    }

    /// Register a running non-interactive task
    ///
    /// Default implementation creates a PTY with mode-specific dimensions,
    /// registers it, and calls the hook.
    ///
    /// # Arguments
    ///
    /// * `task_id` - The task identifier
    fn register_running_non_interactive_task(&mut self, task_id: String) {
        let (rows, cols) = self.calculate_pty_dimensions();
        let pty = PtyInstance::non_interactive_with_dimensions(rows, cols);

        let pty = Arc::new(pty);
        self.state()
            .lock()
            .register_pty_instance(task_id.clone(), pty);

        // Call mode-specific hook
        self.on_pty_registered(&task_id);
    }

    /// Print terminal output for a specific task
    ///
    /// This method is called after tasks complete. If a PTY already exists,
    /// it means the task ran interactively and the PTY already has all output.
    /// Only tasks that didn't run in a pseudo-terminal need a new PTY.
    ///
    /// # Arguments
    ///
    /// * `task_id` - The task identifier
    /// * `output` - The output string to print
    fn print_task_terminal_output(&mut self, task_id: String, output: String) {
        // Check if a PTY instance already exists for this task
        // If so, it already has all the output from the task execution
        if self.state().lock().get_pty_instance(&task_id).is_some() {
            return;
        }

        // Tasks not run within a pseudo-terminal need a new pty instance
        let (rows, cols) = self.calculate_pty_dimensions();
        let pty = PtyInstance::non_interactive_with_dimensions(rows, cols);

        // Add ANSI escape sequence to hide cursor at the end of output,
        // it would be confusing to have it visible when a task is a cache hit
        let output_with_hidden_cursor = format!("{}\x1b[?25l", output);
        write_output_to_pty(&pty, &output_with_hidden_cursor);

        // Register the PTY instance in shared state
        let pty = Arc::new(pty);
        self.state()
            .lock()
            .register_pty_instance(task_id.clone(), pty);

        // Call mode-specific hook
        self.on_pty_registered(&task_id);
    }

    /// Append output to a task's output buffer
    ///
    /// Default implementation delegates to print_task_terminal_output.
    ///
    /// # Arguments
    ///
    /// * `task_id` - The task identifier
    /// * `output` - The output string to append
    fn append_task_output(&mut self, task_id: String, output: String) {
        self.print_task_terminal_output(task_id, output);
    }

    // === Callback Management ===
    //
    // These methods are only available in non-test builds because they use
    // NAPI ThreadsafeFunction which requires Node.js runtime symbols.

    /// Set the callback to be invoked when all tasks are complete
    ///
    /// Default implementation stores the callback directly in TuiState.
    ///
    /// # Arguments
    ///
    /// * `callback` - The threadsafe callback function
    #[cfg(not(test))]
    fn set_done_callback(&mut self, callback: DoneCallback) {
        self.state().lock().set_done_callback(callback);
    }

    /// Set the callback to be invoked on forced shutdown
    ///
    /// Default implementation stores the callback directly in TuiState.
    ///
    /// # Arguments
    ///
    /// * `callback` - The threadsafe callback function
    #[cfg(not(test))]
    fn set_forced_shutdown_callback(&mut self, callback: ForcedShutdownCallback) {
        self.state().lock().set_forced_shutdown_callback(callback);
    }

    /// Call the done callback (if set)
    ///
    /// Default implementation calls the callback directly from TuiState.
    fn call_done_callback(&self) {
        self.state().lock().call_done_callback();
    }

    // === Misc ===

    /// Set a message from Nx Cloud to display
    ///
    /// Default implementation stores the message directly in TuiState.
    /// Mode-specific implementations can override to also dispatch actions for UI updates.
    ///
    /// # Arguments
    ///
    /// * `message` - Optional cloud message to display
    fn set_cloud_message(&mut self, message: Option<String>) {
        self.state().lock().set_cloud_message(message);
    }

    fn get_cloud_message(&self) -> Option<String> {
        self.state()
            .lock()
            .get_cloud_message()
            .map(|s| s.to_string())
    }

    /// Set the console messenger for IDE integration
    ///
    /// Default implementation stores the messenger directly in TuiState.
    ///
    /// # Arguments
    ///
    /// * `messenger` - The console messenger connection
    fn set_console_messenger(&mut self, messenger: NxConsoleMessageConnection) {
        self.state().lock().set_console_messenger(messenger);
    }

    /// Set estimated timings for tasks (used for progress indication)
    ///
    /// Default implementation stores timings directly in TuiState.
    ///
    /// # Arguments
    ///
    /// * `timings` - Map of task IDs to estimated duration in milliseconds
    fn set_estimated_task_timings(&mut self, timings: HashMap<String, i64>) {
        self.state().lock().set_estimated_task_timings(timings);
    }

    // === Quit Check ===

    /// Check if the app should quit
    ///
    /// Default implementation checks the quit state directly in TuiState.
    ///
    /// Returns `true` if the app should exit the event loop.
    fn should_quit(&self) -> bool {
        self.state().lock().should_quit()
    }

    /// Get the currently selected/focused item ID (task or batch, for mode switching)
    ///
    /// No default implementation - this is mode-specific.
    ///
    /// Returns the ID of the item that should be displayed when switching to inline mode.
    /// For full-screen mode, this is the selected item from the task list (task or batch).
    /// For inline mode, this is the item currently being displayed.
    fn get_selected_item_id(&self) -> Option<String>;

    /// Get the item (task or batch) currently focused in a terminal pane (for mode switching)
    ///
    /// Default implementation returns None (no panes in inline mode).
    /// Full-screen mode overrides this to return the item in the focused pane.
    ///
    /// This is used when switching to inline mode to preserve which output was being viewed.
    fn get_focused_pane_item_id(&self) -> Option<String> {
        None
    }

    /// Check if the currently selected/focused item can be interactive
    ///
    /// A task can be interactive if:
    /// 1. It exists (selected or focused)
    /// 2. It is currently in progress
    /// 3. Its PTY has a writer (was created as an interactive task)
    ///
    /// Note: Batch groups are never interactive - they are read-only output displays.
    ///
    /// Default implementation checks the selected item from `get_selected_item_id()`.
    fn can_be_interactive(&self) -> bool {
        let item_id = self.get_selected_item_id();

        if let Some(item_id) = item_id {
            let state = self.state().lock();
            // Check if task is in progress and has an interactive PTY
            // Batch groups return None for task status, so they'll fail this check
            let is_in_progress = state.get_task_status(&item_id) == Some(TaskStatus::InProgress);
            let has_writer = state
                .get_pty_instance(&item_id)
                .map(|pty| pty.can_be_interactive())
                .unwrap_or(false);
            is_in_progress && has_writer
        } else {
            false
        }
    }

    /// Save UI state before switching to inline mode
    ///
    /// Default implementation is a no-op.
    /// Full-screen mode overrides this to save pane_tasks, focus, spacebar_mode.
    fn save_ui_state_for_mode_switch(&self) {
        // Default: no-op for inline mode
    }

    /// Get the shared state Arc (for mode switching)
    ///
    /// Default implementation clones the Arc directly from the state accessor.
    ///
    /// Returns a clone of the Arc<Mutex<TuiState>>, which is cheap (just increments ref count).
    fn get_shared_state(&self) -> Arc<Mutex<TuiState>> {
        self.state().clone()
    }

    // === Batch Methods ===
    // Default implementations capture batch output via TuiState.
    // Full-screen mode provides hooks for UI updates.

    /// Register a running batch - captures PTY for output and saves metadata
    ///
    /// Default implementation handles core registration:
    /// - Validates inputs
    /// - Checks for duplicate registration
    /// - Creates PTY and registers in TuiState
    /// - Saves batch metadata for mode switching
    /// - Calls on_batch_registered hook for mode-specific behavior
    fn register_running_batch(&mut self, batch_id: String, batch_info: BatchInfo) {
        if batch_id.is_empty() || batch_info.task_ids.is_empty() {
            return;
        }

        // Check if batch is already registered (PTY exists in shared state)
        if self.state().lock().get_pty_instance(&batch_id).is_some() {
            return;
        }

        let start_time = current_timestamp_millis();

        // Register PTY so output is captured regardless of mode
        let pty = PtyInstance::non_interactive();

        {
            let mut state = self.state().lock();
            state.register_pty_instance(batch_id.clone(), Arc::new(pty));
            // New batches always start collapsed
            state.save_batch_metadata(batch_id.clone(), batch_info.clone(), start_time, false);
        }

        // Hook for mode-specific behavior
        self.on_batch_registered(&batch_id, &batch_info, start_time);
    }

    /// Hook called after batch is registered
    ///
    /// Default: no-op. Override for mode-specific behavior (UI updates, etc.)
    fn on_batch_registered(&mut self, _batch_id: &str, _batch_info: &BatchInfo, _start_time: i64) {
        // Default: no-op for inline mode
    }

    /// Append output to a batch's PTY
    fn append_batch_output(&mut self, batch_id: String, output: String) {
        let state = self.state().lock();
        if let Some(pty) = state.get_pty_instance(&batch_id) {
            pty.process_output(output.as_bytes());
        }
    }

    /// Set batch status (completion) - default is no-op
    ///
    /// Full-screen mode overrides to handle batch completion and ungrouping.
    fn set_batch_status(&mut self, _batch_id: String, _status: BatchStatus) {
        // Default: no-op for inline mode (no batch UI)
    }
}
