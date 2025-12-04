use color_eyre::eyre::Result;
use napi::bindgen_prelude::External;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
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
use super::lifecycle::TuiMode;
use super::tui;
use super::tui_core::TuiCore;
use super::tui_state::TuiState;

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

    /// Called when tasks begin execution
    ///
    /// Default implementation delegates to TuiCore for timing/status updates.
    ///
    /// # Arguments
    ///
    /// * `tasks` - List of tasks that will be executed
    fn start_tasks(&mut self, tasks: Vec<Task>) {
        self.core().start_tasks(&tasks);
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
    /// Default implementation delegates to TuiCore for timing/status updates.
    ///
    /// # Arguments
    ///
    /// * `task_results` - Results of all completed tasks
    fn end_tasks(&mut self, task_results: Vec<TaskResult>) {
        self.core().end_tasks(&task_results);
    }

    /// Called when the entire command finishes
    ///
    /// Default implementation delegates to TuiCore and dispatches EndCommand action.
    fn end_command(&mut self) {
        self.core().end_command();
        self.core().dispatch_action(Action::EndCommand);
    }

    // === PTY Registration ===

    /// Register a running interactive task with its PTY parser and writer
    ///
    /// # Arguments
    ///
    /// * `task_id` - The task identifier
    /// * `parser_and_writer` - External reference to PTY parser and writer
    fn register_running_interactive_task(
        &mut self,
        task_id: String,
        parser_and_writer: External<(ParserArc, WriterArc)>,
    );

    /// Register a running non-interactive task
    ///
    /// # Arguments
    ///
    /// * `task_id` - The task identifier
    fn register_running_non_interactive_task(&mut self, task_id: String);

    /// Print terminal output for a specific task
    ///
    /// # Arguments
    ///
    /// * `task_id` - The task identifier
    /// * `output` - The output string to print
    fn print_task_terminal_output(&mut self, task_id: String, output: String);

    /// Append output to a task's output buffer
    ///
    /// # Arguments
    ///
    /// * `task_id` - The task identifier
    /// * `output` - The output string to append
    fn append_task_output(&mut self, task_id: String, output: String);

    // === Callback Management ===

    /// Set the callback to be invoked when all tasks are complete
    ///
    /// Default implementation delegates to TuiCore.
    ///
    /// # Arguments
    ///
    /// * `callback` - The threadsafe callback function
    fn set_done_callback(&mut self, callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>) {
        self.core().set_done_callback(callback);
    }

    /// Set the callback to be invoked on forced shutdown
    ///
    /// Default implementation delegates to TuiCore.
    ///
    /// # Arguments
    ///
    /// * `callback` - The threadsafe callback function
    fn set_forced_shutdown_callback(
        &mut self,
        callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) {
        self.core().set_forced_shutdown_callback(callback);
    }

    /// Call the done callback (if set)
    ///
    /// Default implementation delegates to TuiCore.
    fn call_done_callback(&self) {
        self.core().call_done_callback();
    }

    // === Misc ===

    /// Set a message from Nx Cloud to display
    ///
    /// Default implementation stores the message in TuiCore/TuiState.
    /// Mode-specific implementations can override to also dispatch actions for UI updates.
    ///
    /// # Arguments
    ///
    /// * `message` - Optional cloud message to display
    fn set_cloud_message(&mut self, message: Option<String>) {
        self.core().set_cloud_message(message);
    }

    /// Set the console messenger for IDE integration
    ///
    /// Default implementation delegates to TuiCore.
    ///
    /// # Arguments
    ///
    /// * `messenger` - The console messenger connection
    fn set_console_messenger(&mut self, messenger: NxConsoleMessageConnection) {
        self.core().set_console_messenger(messenger);
    }

    /// Set estimated timings for tasks (used for progress indication)
    ///
    /// Default implementation delegates to TuiCore.
    ///
    /// # Arguments
    ///
    /// * `timings` - Map of task IDs to estimated duration in milliseconds
    fn set_estimated_task_timings(&mut self, timings: HashMap<String, i64>) {
        self.core().set_estimated_task_timings(timings);
    }

    // === Quit Check ===

    /// Check if the app should quit
    ///
    /// Default implementation delegates to TuiCore.
    ///
    /// Returns `true` if the app should exit the event loop.
    fn should_quit(&self) -> bool {
        self.core().should_quit()
    }

    /// Get the currently selected/focused task name (for mode switching)
    ///
    /// No default implementation - this is mode-specific.
    ///
    /// Returns the name of the task that should be displayed when switching to inline mode.
    /// For full-screen mode, this is the selected task from the task list.
    /// For inline mode, this is the task currently being displayed.
    fn get_selected_task_name(&self) -> Option<String>;

    /// Get the shared state Arc (for mode switching)
    ///
    /// Default implementation delegates to TuiCore.
    ///
    /// Returns a clone of the Arc<Mutex<TuiState>>, which is cheap (just increments ref count).
    fn get_shared_state(&self) -> Arc<Mutex<TuiState>> {
        self.core().get_shared_state()
    }
}
