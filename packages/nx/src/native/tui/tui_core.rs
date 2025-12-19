//! Shared core functionality for TUI implementations
//!
//! `TuiCore` provides common functionality that is shared between the full-screen
//! `App` and the inline `InlineApp`. This follows the composition over inheritance
//! pattern - both apps embed a `TuiCore` and delegate common operations to it.
//!
//! # Architecture
//!
//! The TUI uses a layered architecture:
//! 1. **TuiState** - Lowest level, holds all state (callbacks, timings, PTYs, etc.)
//! 2. **TuiCore** - Middle layer, orchestrates complex operations involving state
//! 3. **TuiApp trait** - Top layer, provides uniform interface with mode-specific hooks
//!
//! # What TuiCore Handles
//!
//! - Task lifecycle (start, update status, end) with timing
//! - Quit management (schedule, cancel, immediate)
//! - Action dispatch
//! - Quit decision logic (auto-exit, countdown)
//!
//! # What TuiApp Trait Defaults Handle
//!
//! Simple state operations are handled by trait default implementations that
//! access TuiState directly via `state().lock()`:
//! - Callback registration (done, forced shutdown)
//! - Configuration (console messenger, estimated timings)
//! - PTY registration (with mode-specific hooks)
//!
//! This reduces TuiCore's responsibility and eliminates unnecessary delegation.

use parking_lot::Mutex;
use std::sync::Arc;
use tokio::sync::mpsc::UnboundedSender;

use crate::native::tasks::types::{Task, TaskResult};

use super::action::Action;
use super::components::tasks_list::TaskStatus;
use super::tui_state::TuiState;

/// Shared core functionality for TUI implementations
///
/// This struct contains the common state and operations that both full-screen
/// and inline TUI modes need. By extracting this into a separate struct, we:
///
/// 1. Avoid code duplication between App and InlineApp
/// 2. Ensure consistent behavior for core operations
/// 3. Make it easier to add new TUI modes in the future
///
/// # Usage
///
/// Both `App` and `InlineApp` embed a `TuiCore` and delegate common operations:
///
/// ```ignore
/// struct App {
///     core: TuiCore,
///     // app-specific fields...
/// }
///
/// impl App {
///     fn update_task_status(&mut self, task_id: String, status: TaskStatus) {
///         self.core.update_task_status(task_id, status);
///     }
/// }
/// ```
pub struct TuiCore {
    /// Shared state (can be transferred between modes)
    state: Arc<Mutex<TuiState>>,

    /// Action channel sender for dispatching actions
    action_tx: Option<UnboundedSender<Action>>,
}

impl TuiCore {
    /// Create a new TuiCore with the given shared state
    pub fn new(state: Arc<Mutex<TuiState>>) -> Self {
        Self {
            state,
            action_tx: None,
        }
    }

    /// Get a reference to the shared state
    pub fn state(&self) -> &Arc<Mutex<TuiState>> {
        &self.state
    }

    /// Register the action channel sender
    pub fn register_action_handler(&mut self, tx: UnboundedSender<Action>) {
        self.action_tx = Some(tx);
    }

    /// Dispatch an action if the action channel is registered
    pub fn dispatch_action(&self, action: Action) {
        if let Some(tx) = &self.action_tx {
            tx.send(action).ok();
        }
    }

    // === Task Lifecycle Methods ===

    /// Start tasks - records start times and updates status to InProgress
    pub fn start_tasks(&self, tasks: &[Task]) {
        let mut state = self.state.lock();
        for task in tasks {
            state.record_task_start(task.id.clone());
            state.update_task_status(task.id.clone(), TaskStatus::InProgress);
        }
    }

    /// Update task status with automatic timing recording
    pub fn update_task_status(&self, task_id: String, status: TaskStatus) {
        let mut state = self.state.lock();

        // Record start time when task transitions to InProgress
        if status == TaskStatus::InProgress && state.get_task_timing(&task_id).0.is_none() {
            state.record_task_start(task_id.clone());
        }

        state.update_task_status(task_id, status);
    }

    /// End tasks - records end times and updates status based on result
    pub fn end_tasks(&self, task_results: &[TaskResult]) {
        let mut state = self.state.lock();
        for result in task_results {
            state.record_task_end(result.task.id.clone());
            let status = if result.code == 0 {
                TaskStatus::Success
            } else {
                TaskStatus::Failure
            };
            state.update_task_status(result.task.id.clone(), status);
        }
    }

    /// End command - notifies console messenger if connected
    pub fn end_command(&self) {
        let state = self.state.lock();
        state
            .get_console_messenger()
            .as_ref()
            .and_then(|c| c.end_running_tasks());
    }

    // === Quit Management ===

    /// Quit immediately
    pub fn quit_immediately(&self) {
        self.state.lock().quit_immediately();
    }

    /// Schedule quit after delay
    pub fn schedule_quit(&self, delay: std::time::Duration) {
        self.state.lock().schedule_quit(delay);
    }

    /// Cancel scheduled quit
    pub fn cancel_quit(&self) {
        self.state.lock().cancel_quit();
    }

    /// Set forced shutdown flag
    pub fn set_forced_shutdown(&self, forced: bool) {
        self.state.lock().set_forced_shutdown(forced);
    }

    /// Mark that user has interacted with the TUI
    pub fn mark_user_interacted(&self) {
        self.state.lock().mark_user_interacted();
    }

    // === Task Status Queries ===

    /// Check if all tasks are in a completed state
    ///
    /// Returns true if every task has reached a terminal state (success, failure,
    /// skipped, cache hit, or stopped). This is used for determining quit behavior.
    pub fn are_all_tasks_completed(&self) -> bool {
        let state = self.state.lock();
        state.get_task_status_map().values().all(|status| {
            matches!(
                status,
                TaskStatus::Success
                    | TaskStatus::Failure
                    | TaskStatus::Skipped
                    | TaskStatus::LocalCache
                    | TaskStatus::LocalCacheKeptExisting
                    | TaskStatus::RemoteCache
                    | TaskStatus::Stopped // Consider stopped continuous tasks as completed
            )
        })
    }

    /// Get names of tasks that have failed
    pub fn get_failed_task_names(&self) -> Vec<String> {
        self.state.lock().get_failed_task_names()
    }

    /// Get task count from task graph
    pub fn get_task_count(&self) -> usize {
        use crate::native::tui::graph_utils::get_task_count;
        let state = self.state.lock();
        get_task_count(state.task_graph())
    }

    // === Quit Decision Logic ===

    /// Handle 'q' key quit request
    ///
    /// Returns `QuitDecision` indicating what action to take:
    /// - `QuitImmediately` if all tasks are completed
    /// - `StartCountdown` if tasks are still running
    ///
    /// Both cases set forced_shutdown flag.
    pub fn handle_quit_request(&self) -> QuitDecision {
        self.set_forced_shutdown(true);

        if self.are_all_tasks_completed() {
            self.quit_immediately();
            QuitDecision::QuitImmediately
        } else {
            QuitDecision::StartCountdown
        }
    }

    /// Handle Ctrl+C forced quit
    ///
    /// Notifies console messenger, sets forced shutdown, and quits immediately.
    pub fn handle_ctrl_c(&self) {
        self.end_command();
        self.set_forced_shutdown(true);
        self.quit_immediately();
    }

    /// Get countdown duration from config, or None if auto-exit is disabled
    pub fn get_countdown_duration(&self) -> Option<u64> {
        self.state
            .lock()
            .tui_config()
            .auto_exit
            .countdown_seconds()
            .map(|d| d as u64)
    }

    /// Determine what to do when command ends (auto-exit logic)
    ///
    /// Returns `AutoExitDecision` based on:
    /// - Whether user has interacted
    /// - Whether auto-exit is enabled in config
    /// - Number of failed tasks
    /// - Total task count
    pub fn get_auto_exit_decision(&self) -> AutoExitDecision {
        let state = self.state.lock();
        let user_has_interacted = state.has_user_interacted();
        let should_exit_automatically = state.tui_config().auto_exit.should_exit_automatically();
        let task_count = {
            use crate::native::tui::graph_utils::get_task_count;
            get_task_count(state.task_graph())
        };
        drop(state);

        // User interacted or auto-exit disabled - don't exit
        if user_has_interacted || !should_exit_automatically {
            return AutoExitDecision::Stay;
        }

        let failed_task_names = self.get_failed_task_names();

        // Multiple failures - don't auto-exit (let user inspect)
        if failed_task_names.len() > 1 {
            return AutoExitDecision::StayWithFailures(failed_task_names);
        }

        // Single task - exit immediately, multiple tasks - show countdown
        if task_count > 1 {
            AutoExitDecision::ShowCountdown
        } else {
            AutoExitDecision::ExitImmediately
        }
    }
}

/// Decision for handling quit request (q key)
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum QuitDecision {
    /// All tasks completed, quit immediately
    QuitImmediately,
    /// Tasks still running, show countdown first
    StartCountdown,
}

/// Decision for auto-exit behavior when command ends
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AutoExitDecision {
    /// Stay in TUI (user interacted or auto-exit disabled)
    Stay,
    /// Stay but with multiple failures (may want to show them)
    StayWithFailures(Vec<String>),
    /// Show countdown before exiting
    ShowCountdown,
    /// Exit immediately (single task completed)
    ExitImmediately,
}
