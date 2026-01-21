use color_eyre::eyre::Result;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use napi::bindgen_prelude::External;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use parking_lot::Mutex;
use ratatui::layout::{Alignment, Rect, Size};
use ratatui::style::Modifier;
use ratatui::style::Style;
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use std::collections::HashMap;
use std::io;
use std::io::Write;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::sync::mpsc::UnboundedSender;
use tracing::{debug, trace};
use tui_logger::{LevelFilter, TuiLoggerSmartWidget, TuiWidgetEvent, TuiWidgetState};

use crate::native::tui::escape_sequences::EscapeSequence;
use crate::native::tui::tui::Tui;
use crate::native::{
    pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc},
    tasks::types::{Task, TaskResult},
};

use super::action::Action;
use super::components::Component;
use super::components::countdown_popup::CountdownPopup;
use super::components::dependency_view::{DependencyView, DependencyViewState};
use super::components::help_popup::HelpPopup;
use super::components::hint_popup::HintPopup;
use super::components::layout_manager::{
    LayoutAreas, LayoutManager, PaneArrangement, TaskListVisibility,
};
use super::components::task_selection_manager::{SelectionMode, TaskSelectionManager};
use super::components::tasks_list::{TaskStatus, TasksList};
use super::components::terminal_pane::{TerminalPane, TerminalPaneData, TerminalPaneState};
use super::graph_utils::{get_task_count, is_task_continuous};
use super::lifecycle::{RunMode, TuiMode};
use super::pty::PtyInstance;
use super::theme::THEME;
use super::tui;
use super::utils::{normalize_newlines, write_output_to_pty};
use crate::native::ide::nx_console::messaging::NxConsoleMessageConnection;
use crate::native::tui::graph_utils::get_failed_dependencies;
use crate::native::tui::tui_core::{AutoExitDecision, QuitDecision, TuiCore};
use crate::native::tui::tui_state::TuiState;
use crate::native::utils::time::current_timestamp_millis;

/// Duration before status messages in terminal panes are automatically cleared
const STATUS_MESSAGE_DURATION: std::time::Duration = std::time::Duration::from_secs(3);

pub struct App {
    // === Shared Core ===
    /// Shared core functionality (state management, callbacks, etc.)
    core: TuiCore,

    // === Full-Screen UI State ===
    pub components: Vec<Box<dyn Component>>,
    focus: Focus,
    previous_focus: Focus,
    layout_manager: LayoutManager,
    // Cached frame area used for layout calculations, only updated on terminal resize
    frame_area: Option<Rect>,
    // Cached result of layout manager's calculate_layout, only updated when necessary (e.g. terminal resize, task list visibility change etc)
    layout_areas: Option<LayoutAreas>,
    terminal_pane_data: [TerminalPaneData; 2],
    dependency_view_states: [Option<DependencyViewState>; 2],
    spacebar_mode: bool,
    pane_tasks: [Option<String>; 2], // Tasks assigned to panes 1 and 2 (0-indexed)
    resize_debounce_timer: Option<u128>, // Timer for debouncing resize events
    selection_manager: Arc<Mutex<TaskSelectionManager>>,
    debug_mode: bool,
    debug_state: TuiWidgetState,
    /// Flag to indicate this App was restored from a mode switch and should skip init pane setup
    restored_from_mode_switch: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Focus {
    TaskList,
    MultipleOutput(usize),
    HelpPopup,
    CountdownPopup,
    HintPopup,
}

impl App {
    /// Create a new App with existing shared state (for mode switching)
    ///
    /// This constructor is used when switching from inline mode to full-screen mode,
    /// allowing state to be preserved during the transition.
    pub fn with_state(state: Arc<Mutex<TuiState>>, _tui_mode: TuiMode) -> Result<Self> {
        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(5)));

        // Get data from shared state to initialize UI components
        let (
            tasks,
            initiating_tasks,
            run_mode,
            _,
            title_text,
            task_count,
            task_status_map,
            task_start_times,
            task_end_times,
            // UI state for restoration
            saved_pane_tasks,
            saved_spacebar_mode,
            saved_focused_pane,
            saved_selected_task,
        ) = {
            let state_lock = state.lock();
            (
                state_lock.tasks().clone(),
                state_lock.initiating_tasks().clone(),
                state_lock.run_mode(),
                state_lock.pinned_tasks().clone(),
                state_lock.title_text().to_string(),
                get_task_count(state_lock.task_graph()),
                state_lock.get_task_status_map().clone(),
                state_lock.get_task_start_times().clone(),
                state_lock.get_task_end_times().clone(),
                // Get saved UI state
                state_lock.get_ui_pane_tasks().clone(),
                state_lock.get_ui_spacebar_mode(),
                state_lock.get_ui_focused_pane(),
                state_lock.get_ui_selected_task().cloned(),
            )
        };

        // Determine initial focus based on saved state
        let initial_focus = match saved_focused_pane {
            Some(pane_idx) if saved_pane_tasks[pane_idx].is_some() => {
                Focus::MultipleOutput(pane_idx)
            }
            _ if saved_pane_tasks[0].is_some() || saved_pane_tasks[1].is_some() => Focus::TaskList,
            _ => Focus::TaskList,
        };

        let mut tasks_list = TasksList::new(
            tasks.clone(),
            initiating_tasks,
            run_mode,
            initial_focus,
            title_text,
            selection_manager.clone(),
        );

        // Sync task status from shared state (important for mode switching)
        // TasksList::new creates TaskItems with NotStarted status, but we need
        // to restore the actual status from TuiState
        for (task_id, status) in task_status_map {
            tasks_list.update_task_status(task_id.clone(), status);

            // Also sync timing data for this task
            let start_time = task_start_times.get(&task_id).copied();
            let end_time = task_end_times.get(&task_id).copied();
            if start_time.is_some() || end_time.is_some() {
                tasks_list.set_task_timing(task_id, start_time, end_time);
            }
        }

        let help_popup = HelpPopup::new();
        let countdown_popup = CountdownPopup::new();
        let hint_popup = HintPopup::new();

        let components: Vec<Box<dyn Component>> = vec![
            Box::new(tasks_list),
            Box::new(help_popup),
            Box::new(countdown_popup),
            Box::new(hint_popup),
        ];

        let main_terminal_pane_data = TerminalPaneData::new();

        // Create layout manager and configure based on saved state
        let mut layout_manager = LayoutManager::new_with_run_mode(task_count, run_mode);

        // Restore pane arrangement based on saved pane tasks
        let has_pane0 = saved_pane_tasks[0].is_some();
        let has_pane1 = saved_pane_tasks[1].is_some();
        if has_pane0 && has_pane1 {
            layout_manager.set_pane_arrangement(PaneArrangement::Double);
        } else if has_pane0 || has_pane1 || saved_spacebar_mode {
            layout_manager.set_pane_arrangement(PaneArrangement::Single);
        }

        // Restore selection in selection_manager
        if let Some(ref selected) = saved_selected_task {
            selection_manager.lock().select_task(selected.clone());
        }

        // Check if we're restoring from a mode switch (has saved UI state)
        let has_restored_state = saved_pane_tasks[0].is_some()
            || saved_pane_tasks[1].is_some()
            || saved_spacebar_mode
            || saved_selected_task.is_some();

        tracing::trace!(
            "App::with_state - restored panes: [{:?}, {:?}], focus: {:?}, spacebar: {}, selected: {:?}",
            saved_pane_tasks[0],
            saved_pane_tasks[1],
            initial_focus,
            saved_spacebar_mode,
            saved_selected_task
        );

        Ok(Self {
            core: TuiCore::new(state),
            components,
            focus: initial_focus,
            previous_focus: Focus::TaskList,
            layout_manager,
            frame_area: None,
            layout_areas: None,
            terminal_pane_data: [main_terminal_pane_data, TerminalPaneData::new()],
            dependency_view_states: [None, None],
            spacebar_mode: saved_spacebar_mode,
            pane_tasks: saved_pane_tasks,
            resize_debounce_timer: None,
            selection_manager,
            debug_mode: false,
            debug_state: TuiWidgetState::default().set_default_display_level(LevelFilter::Debug),
            restored_from_mode_switch: has_restored_state,
        })
    }

    /// Get the shared state Arc (for mode switching)
    pub fn get_state(&self) -> Arc<Mutex<TuiState>> {
        self.core.state().clone()
    }

    pub fn register_action_handler(&mut self, tx: UnboundedSender<Action>) -> Result<()> {
        self.core.register_action_handler(tx);
        Ok(())
    }

    pub fn init(&mut self, _area: Size) -> Result<()> {
        // If we're restoring from a mode switch, skip the pinned tasks initialization
        // because we've already restored the pane state from TuiState
        if self.restored_from_mode_switch {
            debug!("App::init - Skipping pinned task setup, restored from mode switch");
            return Ok(());
        }

        // Iterate over the pinned tasks and assign them to the terminal panes (up to the maximum of 2), focusing the first one as well
        let (pinned_tasks, run_mode, task_count) = {
            let state = self.core.state().lock();
            (
                state.pinned_tasks().clone(),
                state.run_mode(),
                get_task_count(state.task_graph()),
            )
        };

        for (idx, task) in pinned_tasks.iter().enumerate() {
            if idx < 2 {
                self.selection_manager.lock().select_task(task.clone());

                if pinned_tasks.len() == 1 && idx == 0 {
                    self.display_and_focus_current_task_in_terminal_pane(match run_mode {
                        RunMode::RunMany => true,
                        RunMode::RunOne if task_count == 1 => false,
                        RunMode::RunOne => true,
                    });
                } else {
                    self.assign_current_task_to_pane(idx);
                }
            }
        }
        Ok(())
    }

    pub fn start_command(&mut self, thread_count: Option<u32>) {
        self.dispatch_action(Action::StartCommand(thread_count));
    }

    pub fn start_tasks(&mut self, tasks: Vec<Task>) {
        // Use TuiCore to record timing and update status
        // This ensures task_start_times are recorded properly
        self.core.start_tasks(&tasks);
        self.dispatch_action(Action::StartTasks(tasks));
    }

    pub fn update_task_status(&mut self, task_id: String, status: TaskStatus) {
        // Update the task status map in shared state first
        self.core.update_task_status(task_id.clone(), status);

        // Auto-switch pane to failed dependency when a task becomes skipped
        if status == TaskStatus::Skipped {
            self.handle_automatic_pane_switching(&task_id);
        }

        self.dispatch_action(Action::UpdateTaskStatus(task_id.clone(), status));

        // Update terminal progress indicator only when task reaches a completed state
        if Self::is_status_complete(status) {
            self.update_terminal_progress();
        }
    }

    /// Get task status efficiently from shared state HashMap
    pub fn get_task_status(&self, task_id: &str) -> Option<TaskStatus> {
        let state = self.core.state().lock();
        state.get_task_status(task_id)
    }

    /// Get task continuous flag efficiently from task graph in shared state
    pub fn is_task_continuous(&self, task_id: &str) -> bool {
        let state = self.core.state().lock();
        is_task_continuous(state.task_graph(), task_id)
    }

    /// Check if a task status is considered complete
    fn is_status_complete(status: TaskStatus) -> bool {
        !matches!(
            status,
            TaskStatus::NotStarted | TaskStatus::InProgress | TaskStatus::Shared
        )
    }

    pub fn print_task_terminal_output(&mut self, task_id: String, output: String) {
        // Check if a PTY instance already exists for this task
        // If so, it already has all the output from the task execution
        if self
            .core
            .state()
            .lock()
            .get_pty_instance(&task_id)
            .is_some()
        {
            // If the task is continuous, ensure the pty instances get resized appropriately
            if self.is_task_continuous(&task_id) {
                let _ = self.debounce_pty_resize();
            }
            return;
        }

        // Tasks run within a pseudo-terminal always have a pty instance and do not need a new one
        // Tasks not run within a pseudo-terminal need a new pty instance to print output
        let (rows, cols) = self.calculate_pty_dimensions_for_mode();
        let pty = PtyInstance::non_interactive_with_dimensions(rows, cols);

        // Add ANSI escape sequence to hide cursor at the end of output,
        // it would be confusing to have it visible when a task is a cache hit
        let output_with_hidden_cursor = format!("{}\x1b[?25l", output);
        write_output_to_pty(&pty, &output_with_hidden_cursor);

        self.register_pty_instance(&task_id, pty);
        // Ensure the pty instances get resized appropriately
        let _ = self.debounce_pty_resize();

        // If the task is continuous, ensure the pty instances get resized appropriately
        if self.is_task_continuous(&task_id) {
            let _ = self.debounce_pty_resize();
        }
    }

    pub fn end_tasks(&mut self, task_results: Vec<TaskResult>) {
        // When tasks finish ensure that pty instances are resized appropriately as they may be actively displaying output when they finish
        let _ = self.debounce_pty_resize();

        // Use TuiCore to record end timing and update status
        // This ensures task_end_times are recorded properly
        self.core.end_tasks(&task_results);

        self.dispatch_action(Action::EndTasks(task_results));
    }

    // Show countdown popup for the configured duration (making sure the help popup is not open first)
    pub fn end_command(&mut self) {
        let state = self.core.state().lock();
        state
            .get_console_messenger()
            .as_ref()
            .and_then(|c| c.end_running_tasks());
        drop(state);

        self.dispatch_action(Action::EndCommand);
    }

    // Internal method to handle Action::EndCommand
    fn handle_end_command(&mut self) {
        // Use TuiCore to determine auto-exit behavior
        match self.core.get_auto_exit_decision() {
            AutoExitDecision::Stay => {
                // User interacted or auto-exit disabled - do nothing
            }
            AutoExitDecision::StayWithFailures(failed_task_names) => {
                // Multiple failures - show them to user
                // If there are no visible panes, focus the first failed task
                if !self.has_visible_panes() {
                    self.selection_manager
                        .lock()
                        .select_task(failed_task_names.first().unwrap().clone());

                    // Display the task logs but keep focus on the task list
                    self.toggle_output_visibility();
                }
            }
            AutoExitDecision::ShowCountdown => {
                self.begin_exit_countdown();
            }
            AutoExitDecision::ExitImmediately => {
                self.quit();
            }
        }
    }

    fn quit(&mut self) {
        self.core.quit_immediately();
    }

    fn begin_exit_countdown(&mut self) {
        // Use TuiCore to get countdown duration
        let Some(countdown_duration) = self.core.get_countdown_duration() else {
            // Countdown is disabled, exit immediately
            self.quit();
            return;
        };

        // Show the countdown popup for the configured duration
        if let Some(countdown_popup) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
        {
            countdown_popup.start_countdown(countdown_duration);
            self.update_focus(Focus::CountdownPopup);
            self.core
                .schedule_quit(std::time::Duration::from_secs(countdown_duration));
        }
    }

    // A pseudo-terminal running task will provide the parser and writer directly
    pub fn register_running_interactive_task(
        &mut self,
        task_id: String,
        parser_and_writer: External<(ParserArc, WriterArc)>,
    ) {
        debug!("Registering interactive task: {}", task_id);
        let pty =
            PtyInstance::interactive(parser_and_writer.0.clone(), parser_and_writer.1.clone());
        self.register_running_task(task_id, pty);
    }

    pub fn register_running_non_interactive_task(&mut self, task_id: String) {
        let (rows, cols) = self.calculate_pty_dimensions_for_mode();
        let pty = PtyInstance::non_interactive_with_dimensions(rows, cols);
        self.register_pty_instance(&task_id, pty);
        self.update_task_status(task_id.clone(), TaskStatus::InProgress);
        // Ensure the pty instances get resized appropriately
        let _ = self.debounce_pty_resize();
    }

    fn register_running_task(&mut self, task_id: String, pty: PtyInstance) {
        self.register_pty_instance(&task_id, pty);
        self.update_task_status(task_id.clone(), TaskStatus::InProgress);
    }

    pub fn append_task_output(&mut self, task_id: String, output: String) {
        let state = self.core.state().lock();
        let pty = state
            .get_pty_instance(&task_id)
            .unwrap_or_else(|| panic!("{} has not been registered yet.", task_id));
        pty.process_output(output.as_bytes());
    }

    pub fn handle_event(
        &mut self,
        event: tui::Event,
        action_tx: &mpsc::UnboundedSender<Action>,
    ) -> Result<bool> {
        match event {
            tui::Event::Quit => {
                self.core.state().lock().quit_immediately();
                return Ok(false);
            }
            tui::Event::Tick => {
                let _ = action_tx.send(Action::Tick);

                // Check if we have a pending resize that needs to be processed
                if let Some(timer) = self.resize_debounce_timer {
                    let now = current_timestamp_millis() as u128;

                    if now >= timer {
                        // Timer expired, process the resize
                        self.handle_pty_resize()?;
                        self.resize_debounce_timer = None;
                    }
                }

                return Ok(false);
            }
            tui::Event::Render => action_tx.send(Action::Render)?,
            tui::Event::Resize(x, y) => action_tx.send(Action::Resize(x, y))?,
            tui::Event::Key(key) => {
                trace!("Handling Key Event: {:?}", key);

                // If the app is in interactive mode, interactions are with
                // the running task, not the app itself
                if !self.is_interactive_mode() {
                    // Record that the user has interacted with the app
                    self.core.mark_user_interacted();
                }

                // Handle Ctrl+C to quit, unless we're in interactive mode and the focus is on a terminal pane
                if key.code == KeyCode::Char('c')
                    && key.modifiers == KeyModifiers::CONTROL
                    && !(matches!(self.focus, Focus::MultipleOutput(_))
                        && self.is_interactive_mode())
                {
                    // Use TuiCore to handle Ctrl+C (end command, set forced shutdown, quit)
                    self.core.handle_ctrl_c();
                    return Ok(false);
                }

                if matches!(self.focus, Focus::MultipleOutput(_)) && self.is_interactive_mode() {
                    return match key.code {
                        KeyCode::Char('z') if key.modifiers == KeyModifiers::CONTROL => {
                            // Disable interactive mode when Ctrl+Z is pressed
                            self.set_interactive_mode(false);
                            Ok(false)
                        }
                        _ => {
                            // The TasksList will forward the key event to the focused terminal pane
                            self.handle_key_event(key).ok();
                            Ok(false)
                        }
                    };
                }

                if matches!(key.code, KeyCode::F(12)) {
                    self.dispatch_action(Action::ToggleDebugMode);
                    return Ok(false);
                }

                // F11 toggles between full-screen and inline mode
                // Don't allow mode switch during countdown (user is about to quit)
                if matches!(key.code, KeyCode::F(11))
                    && !matches!(self.focus, Focus::CountdownPopup)
                {
                    self.dispatch_action(Action::SwitchMode(TuiMode::Inline));
                    return Ok(false);
                }

                if self.debug_mode {
                    self.handle_debug_event(key);
                    return Ok(false);
                }

                // Only handle '?' key if we're not in interactive mode and the countdown popup is not open
                if matches!(key.code, KeyCode::Char('?'))
                    && !self.is_interactive_mode()
                    && !matches!(self.focus, Focus::CountdownPopup)
                {
                    let show_help_popup = !matches!(self.focus, Focus::HelpPopup);
                    if let Some(help_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                    {
                        help_popup.set_visible(show_help_popup);
                    }
                    if show_help_popup {
                        self.update_focus(Focus::HelpPopup);
                    } else {
                        self.update_focus(self.previous_focus);
                    }
                    return Ok(false);
                }

                // If countdown popup is open, handle its keyboard events
                if matches!(self.focus, Focus::CountdownPopup) {
                    // Any key pressed (other than scroll keys if the popup is scrollable) will cancel the countdown
                    if let Some(countdown_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
                    {
                        match key.code {
                            KeyCode::Char('q') => {
                                // Quit immediately
                                trace!("Confirming shutdown");
                                self.core.state().lock().quit_immediately();
                                return Ok(false);
                            }
                            KeyCode::Char('c') if key.modifiers == KeyModifiers::CONTROL => {
                                // Quit immediately
                                trace!("Confirming shutdown");
                                self.core.state().lock().quit_immediately();
                                return Ok(false);
                            }
                            KeyCode::Up | KeyCode::Char('k') if countdown_popup.is_scrollable() => {
                                countdown_popup.scroll_up();
                                return Ok(false);
                            }
                            KeyCode::Down | KeyCode::Char('j')
                                if countdown_popup.is_scrollable() =>
                            {
                                countdown_popup.scroll_down();
                                return Ok(false);
                            }
                            _ => {
                                countdown_popup.cancel_countdown();
                                self.core.state().lock().cancel_quit();
                                self.update_focus(self.previous_focus);
                            }
                        }
                    }

                    return Ok(false);
                }

                // If hint popup is open, only ESC dismisses it
                if matches!(self.focus, Focus::HintPopup) {
                    if let Some(hint_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
                    {
                        if key.code == KeyCode::Esc {
                            hint_popup.hide();
                            self.update_focus(self.previous_focus);
                        }
                        // All other keys are consumed while hint popup is visible
                    }
                    return Ok(false);
                }

                if let Some(tasks_list) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
                {
                    // Handle Q to trigger countdown or immediate exit, depending on the tasks
                    if !tasks_list.filter_mode && key.code == KeyCode::Char('q') {
                        // Use TuiCore to handle quit request (sets forced_shutdown, checks completion)
                        if self.core.handle_quit_request() == QuitDecision::StartCountdown {
                            self.begin_exit_countdown();
                        }
                        return Ok(false);
                    }
                }

                // If shortcuts popup is open, handle its keyboard events
                if matches!(self.focus, Focus::HelpPopup) {
                    match key.code {
                        KeyCode::Esc => {
                            if let Some(help_popup) = self
                                .components
                                .iter_mut()
                                .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                            {
                                help_popup.set_visible(false);
                            }
                            self.update_focus(self.previous_focus);
                        }
                        KeyCode::Up | KeyCode::Char('k') => {
                            if let Some(help_popup) = self
                                .components
                                .iter_mut()
                                .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                            {
                                help_popup.scroll_up();
                            }
                            return Ok(false);
                        }
                        KeyCode::Down | KeyCode::Char('j') => {
                            if let Some(help_popup) = self
                                .components
                                .iter_mut()
                                .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                            {
                                help_popup.scroll_down();
                            }
                            return Ok(false);
                        }
                        _ => {}
                    }
                    return Ok(false);
                }

                // Handle Up/Down keys for scrolling first
                if matches!(self.focus, Focus::MultipleOutput(_)) {
                    match key.code {
                        KeyCode::Up | KeyCode::Down => {
                            self.handle_key_event(key).ok();
                            return Ok(false);
                        }
                        KeyCode::Char('k') | KeyCode::Char('j') if !self.is_interactive_mode() => {
                            self.handle_key_event(key).ok();
                            return Ok(false);
                        }
                        _ => {}
                    }
                }

                // Get tasks list component for handling some key events
                if let Some(tasks_list) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
                {
                    match self.focus {
                        Focus::MultipleOutput(_) => {
                            if self.is_interactive_mode() {
                                // Send all other keys to the task list (and ultimately through the terminal pane to the PTY)
                                self.handle_key_event(key).ok();
                            } else {
                                // Handle navigation and special actions
                                match key.code {
                                    KeyCode::Tab => {
                                        self.focus_next();
                                    }
                                    KeyCode::BackTab => {
                                        self.focus_previous();
                                    }
                                    KeyCode::Esc => {
                                        if !self.is_task_list_hidden() {
                                            self.update_focus(Focus::TaskList);
                                        }
                                    }
                                    // Add our new shortcuts here
                                    KeyCode::Char('c') => {
                                        self.handle_key_event(key).ok();
                                    }
                                    KeyCode::Char('u') | KeyCode::Char('d')
                                        if key.modifiers.contains(KeyModifiers::CONTROL) =>
                                    {
                                        self.handle_key_event(key).ok();
                                    }
                                    KeyCode::Char('b') => {
                                        self.toggle_task_list();
                                    }
                                    KeyCode::Char('m') => {
                                        if let Some(area) = self.frame_area {
                                            self.toggle_layout_mode(area);
                                        }
                                    }
                                    // If focused on a specific terminal pane, and not interactive, enter should
                                    // swap to inline tui mode focusing that task
                                    KeyCode::Enter => {
                                        // dispatch action to switch to inline mode with focused task
                                        self.dispatch_action(Action::SwitchMode(TuiMode::Inline));
                                    }
                                    _ => {
                                        // Forward other keys for interactivity, scrolling (j/k) etc
                                        self.handle_key_event(key).ok();
                                    }
                                }
                            }
                            return Ok(false);
                        }
                        _ => {
                            // Handle spacebar toggle regardless of focus
                            if key.code == KeyCode::Char(' ') {
                                self.toggle_output_visibility();
                                return Ok(false); // Skip other key handling
                            }

                            let is_filter_mode = tasks_list.filter_mode;

                            match self.focus {
                                Focus::TaskList => match key.code {
                                    KeyCode::Char('j') if !is_filter_mode => {
                                        self.dispatch_action(Action::NextTask);
                                    }
                                    KeyCode::Down => {
                                        self.dispatch_action(Action::NextTask);
                                    }
                                    KeyCode::Char('k') if !is_filter_mode => {
                                        self.dispatch_action(Action::PreviousTask);
                                    }
                                    KeyCode::Up => {
                                        self.dispatch_action(Action::PreviousTask);
                                    }
                                    KeyCode::Esc => {
                                        if matches!(self.focus, Focus::HelpPopup) {
                                            if let Some(help_popup) =
                                                self.components.iter_mut().find_map(|c| {
                                                    c.as_any_mut().downcast_mut::<HelpPopup>()
                                                })
                                            {
                                                help_popup.set_visible(false);
                                            }
                                            self.update_focus(self.previous_focus);
                                        } else {
                                            // Only clear filter when help popup is not in focus

                                            tasks_list.clear_filter();
                                        }
                                    }
                                    KeyCode::Char(c) => {
                                        if tasks_list.filter_mode {
                                            tasks_list.add_filter_char(c);
                                        } else {
                                            match c {
                                                '/' => {
                                                    if tasks_list.filter_mode {
                                                        tasks_list.persist_filter();
                                                    } else {
                                                        tasks_list.enter_filter_mode();
                                                    }
                                                }
                                                c => {
                                                    if tasks_list.filter_mode {
                                                        tasks_list.add_filter_char(c);
                                                    } else {
                                                        match c {
                                                            'j' => {
                                                                self.dispatch_action(
                                                                    Action::NextTask,
                                                                );
                                                            }
                                                            'k' => {
                                                                self.dispatch_action(
                                                                    Action::PreviousTask,
                                                                );
                                                            }
                                                            '1' => {
                                                                self.assign_current_task_to_pane(0);
                                                                let _ = self.handle_pty_resize();
                                                                // No need to debounce
                                                            }
                                                            '2' => {
                                                                self.assign_current_task_to_pane(1);
                                                                let _ = self.handle_pty_resize();
                                                                // No need to debounce
                                                            }
                                                            '0' => self.clear_all_panes(),
                                                            'b' => self.toggle_task_list(),
                                                            'm' => {
                                                                if let Some(area) = self.frame_area
                                                                {
                                                                    self.toggle_layout_mode(area);
                                                                }
                                                            }
                                                            _ => {}
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    KeyCode::Backspace => {
                                        if tasks_list.filter_mode {
                                            tasks_list.remove_filter_char();
                                        }
                                    }
                                    KeyCode::Tab => {
                                        self.focus_next();
                                    }
                                    KeyCode::BackTab => {
                                        self.focus_previous();
                                    }
                                    KeyCode::Enter if is_filter_mode => {
                                        tasks_list.persist_filter();
                                    }
                                    KeyCode::Enter if matches!(self.focus, Focus::TaskList) => {
                                        self.display_and_focus_current_task_in_terminal_pane(false);
                                    }
                                    _ => {}
                                },
                                Focus::MultipleOutput(_idx) => match key.code {
                                    KeyCode::Tab => {
                                        self.focus_next();
                                    }
                                    KeyCode::BackTab => {
                                        self.focus_previous();
                                    }
                                    _ => {}
                                },
                                Focus::HelpPopup => {
                                    // Shortcuts popup has its own key handling above
                                }
                                Focus::CountdownPopup => {
                                    // Countdown popup has its own key handling above
                                }
                                Focus::HintPopup => {
                                    // Hint popup has its own key handling above
                                }
                            }
                        }
                    }
                }
            }
            _ => {}
        }

        for component in self.components.iter_mut() {
            if let Some(action) = component.handle_events(Some(event.clone()))? {
                action_tx.send(action)?;
            }
        }

        Ok(false)
    }

    pub fn handle_action(
        &mut self,
        tui: &mut Tui,
        action: Action,
        action_tx: &UnboundedSender<Action>,
    ) {
        if action != Action::Tick && action != Action::Render {
            trace!("{action:?}");
        }
        match &action {
            Action::StartCommand(_) => {
                let state = self.core.state().lock();
                state
                    .get_console_messenger()
                    .as_ref()
                    .and_then(|c| c.start_running_tasks());
            }
            Action::Tick => {
                let state = self.core.state().lock();
                state
                    .get_console_messenger()
                    .as_ref()
                    .and_then(|messenger| {
                        self.components
                            .iter()
                            .find_map(|c| c.as_any().downcast_ref::<TasksList>())
                            .and_then(|tasks_list| {
                                let pty_instances = state.get_pty_instances();
                                messenger.update_running_tasks(&tasks_list.tasks, &pty_instances)
                            })
                    });
                drop(state);

                // Auto-dismiss hint popup after duration elapsed
                if let Some(hint_popup) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
                {
                    if hint_popup.should_auto_dismiss() {
                        hint_popup.hide();
                        // Restore focus if hint popup was focused
                        if matches!(self.focus, Focus::HintPopup) {
                            self.update_focus(self.previous_focus);
                        }
                    }
                }

                // Clear expired status messages from terminal panes
                for terminal_pane_data in &mut self.terminal_pane_data {
                    if let Some((_, shown_at)) = &terminal_pane_data.status_message {
                        if shown_at.elapsed() > STATUS_MESSAGE_DURATION {
                            terminal_pane_data.status_message = None;
                        }
                    }
                }
            }
            // Quit immediately
            Action::Quit => {
                self.core.state().lock().quit_immediately();
            }
            // Cancel quitting
            Action::CancelQuit => {
                self.core.state().lock().cancel_quit();
                self.update_focus(self.previous_focus);
            }
            Action::Resize(w, h) => {
                let rect = Rect::new(0, 0, *w, *h);
                tui.resize(rect).ok();
                // Update the cached frame area
                self.frame_area = Some(rect);
                // Recalculate the layout areas
                self.recalculate_layout_areas();
                // Ensure the pty instances get resized appropriately (debounced)
                let _ = self.debounce_pty_resize();
            }
            Action::ToggleDebugMode => {
                self.debug_mode = !self.debug_mode;
                debug!("Debug mode: {}", self.debug_mode);
            }
            Action::Render => {
                tui.draw(|f| {
                    let area = f.area();

                    // Cache the frame area if it's never been set before (will be updated in subsequent resize events if necessary)
                    if self.frame_area.is_none() {
                        self.frame_area = Some(area);
                    }

                    // Determine the required layout areas for the tasks list and terminal panes using the LayoutManager
                    if self.layout_areas.is_none() {
                        self.recalculate_layout_areas();
                    }

                    let frame_area = self.frame_area.unwrap();
                    let layout_areas = self.layout_areas.as_ref().unwrap();

                    if self.debug_mode {
                        let debug_widget = TuiLoggerSmartWidget::default().state(&self.debug_state);
                        f.render_widget(debug_widget, frame_area);
                        return;
                    }

                    // TODO: move this to the layout manager?
                    // Check for minimum viable viewport size at the app level
                    if frame_area.height < 10 || frame_area.width < 40 {
                        // First ensure the frame area is at least 1x1, otherwise we can't render anything
                        if frame_area.width == 0 || frame_area.height == 0 {
                            return; // Can't render anything in a zero-sized area
                        }

                        // Create a simple message that fits in a single line to avoid scrolling issues
                        let message = Line::from(vec![
                            Span::styled(
                                " NX ",
                                Style::reset()
                                    .add_modifier(Modifier::BOLD)
                                    .bg(THEME.error)
                                    .fg(THEME.primary_fg),
                            ),
                            Span::raw(" Terminal too small "),
                        ]);

                        // When terminal is extremely small (height < 3), render just the message
                        // without any vertical padding to prevent index out of bounds errors
                        if frame_area.height < 3 {
                            let paragraph =
                                Paragraph::new(vec![message]).alignment(Alignment::Center);

                            // Create a safe area that's guaranteed to be within bounds
                            let safe_area = Rect {
                                x: frame_area.x,
                                y: frame_area.y,
                                width: frame_area
                                    .width
                                    .min(f.area().width.saturating_sub(frame_area.x)),
                                height: frame_area
                                    .height
                                    .min(f.area().height.saturating_sub(frame_area.y)),
                            };

                            f.render_widget(paragraph, safe_area);
                            return;
                        }

                        // For slightly larger terminals (height >= 3), use vertical padding
                        let empty_line = Line::from("");
                        let mut lines = vec![];

                        // Add empty lines to center vertically, but cap it to prevent going out of bounds
                        let vertical_padding = ((frame_area.height as usize).saturating_sub(3) / 2)
                            .min(frame_area.height as usize - 1); // Ensure we leave at least 1 line for the message

                        for _ in 0..vertical_padding {
                            lines.push(empty_line.clone());
                        }

                        // Add the message
                        lines.push(message);

                        let paragraph = Paragraph::new(lines).alignment(Alignment::Center);

                        // Create a safe area that's guaranteed to be within bounds (this can happen if the user resizes the window a lot before it stabilizes it seems)
                        let safe_area = Rect {
                            x: frame_area.x,
                            y: frame_area.y,
                            width: frame_area
                                .width
                                .min(f.area().width.saturating_sub(frame_area.x)),
                            height: frame_area
                                .height
                                .min(f.area().height.saturating_sub(frame_area.y)),
                        };

                        f.render_widget(paragraph, safe_area);
                        return;
                    }

                    // Draw the TaskList component, if visible
                    if let Some(task_list_area) = layout_areas.task_list {
                        if let Some(tasks_list) = self
                            .components
                            .iter_mut()
                            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
                        {
                            let _ = tasks_list.draw(f, task_list_area);
                        }
                    }

                    // Clone terminal pane areas upfront to avoid borrow conflicts with self
                    // This is a small vec (at most 2 elements), so the clone cost is minimal
                    let terminal_panes: Vec<Rect> = layout_areas.terminal_panes.clone();
                    let num_visible_panes = terminal_panes.len();

                    // Clone pane_tasks upfront to avoid borrow conflicts when calling render methods
                    // This is a small fixed-size array (2 elements), so the clone cost is minimal
                    let pane_tasks_snapshot: [Option<String>; 2] = if self.spacebar_mode {
                        // In spacebar mode, use the selected task in pane 0
                        let task = self
                            .selection_manager
                            .lock()
                            .get_selected_task_name()
                            .cloned();
                        [task, None]
                    } else {
                        self.pane_tasks.clone()
                    };

                    // Capture focus state before mutable borrows
                    let current_focus = self.focus;

                    // Iterate over panes in order, mapping to physical positions
                    // Physical position 0 gets the first pinned task, position 1 gets the second
                    let mut physical_idx = 0;
                    for (pane_idx, task_opt) in pane_tasks_snapshot.iter().enumerate() {
                        if let Some(task_name) = task_opt {
                            if physical_idx < terminal_panes.len() {
                                let pane_area = terminal_panes[physical_idx];

                                // Compute focus state based on pane index
                                let is_focused = matches!(
                                    current_focus,
                                    Focus::MultipleOutput(focused) if focused == pane_idx
                                );

                                // Compute next-tab-target based on physical position
                                let is_next_tab_target = !is_focused
                                    && match current_focus {
                                        Focus::TaskList => physical_idx == 0,
                                        Focus::MultipleOutput(_) => {
                                            physical_idx == 1 && num_visible_panes > 1
                                        }
                                        _ => false,
                                    };

                                let task_status = self
                                    .get_task_status(task_name)
                                    .unwrap_or(TaskStatus::NotStarted);

                                // If task is pending or skipped, show dependency view
                                if task_status == TaskStatus::NotStarted
                                    || task_status == TaskStatus::Skipped
                                {
                                    self.render_dependency_view_internal(
                                        f,
                                        pane_idx,
                                        pane_area,
                                        task_name.clone(),
                                        is_focused,
                                    );
                                } else {
                                    self.render_terminal_pane_internal(
                                        f,
                                        pane_idx,
                                        pane_area,
                                        task_name.clone(),
                                        is_focused,
                                        is_next_tab_target,
                                    );
                                }

                                physical_idx += 1;
                            }
                        }
                    }

                    // Draw the popups (help, countdown, interstitial)
                    // Draw each popup sequentially to avoid multiple mutable borrows
                    if let Some(help_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                    {
                        let _ = help_popup.draw(f, frame_area);
                    }
                    if let Some(countdown_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
                    {
                        let _ = countdown_popup.draw(f, frame_area);
                    }
                    if let Some(hint_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
                    {
                        let _ = hint_popup.draw(f, frame_area);
                    }
                })
                .ok();
            }
            Action::SendConsoleMessage(msg) => {
                let state = self.core.state().lock();
                if let Some(connection) = state.get_console_messenger() {
                    connection.send_terminal_string(msg);
                } else {
                    trace!("No console connection available");
                }
            }
            Action::EndCommand => {
                self.handle_end_command();
            }
            Action::ShowHint(message) => {
                // Only show hints if not suppressed by config
                let suppress_hints = self.core.state().lock().tui_config().suppress_hints;
                if !suppress_hints {
                    if let Some(hint_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
                    {
                        hint_popup.show(message.clone());
                        self.update_focus(Focus::HintPopup);
                    }
                }
            }
            _ => {}
        }

        // Update child components with the received action
        for component in self.components.iter_mut() {
            if let Ok(Some(new_action)) = component.update(action.clone()) {
                action_tx.send(new_action).ok();
            }
        }
    }

    #[cfg(not(test))]
    pub fn set_done_callback(
        &mut self,
        done_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) {
        self.core.state().lock().set_done_callback(done_callback);
    }

    #[cfg(not(test))]
    pub fn set_forced_shutdown_callback(
        &mut self,
        forced_shutdown_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) {
        self.core
            .state()
            .lock()
            .set_forced_shutdown_callback(forced_shutdown_callback);
    }

    pub fn call_done_callback(&self) {
        self.core.state().lock().call_done_callback();
    }

    pub fn set_cloud_message(&mut self, message: Option<String>) {
        // Store in state (for mode switching persistence)
        self.core.state().lock().set_cloud_message(message.clone());
        // Dispatch to TasksList component for UI rendering
        if let Some(message) = message {
            self.dispatch_action(Action::UpdateCloudMessage(message));
        }
    }

    /// Dispatches an action to the action tx for other components to handle however they see fit
    fn dispatch_action(&self, action: Action) {
        self.core.dispatch_action(action);
    }

    fn recalculate_layout_areas(&mut self) {
        if let Some(frame_area) = self.frame_area {
            self.layout_areas = Some(self.layout_manager.calculate_layout(frame_area));
        }
    }

    /// Checks if the current view has any visible output panes.
    fn has_visible_panes(&self) -> bool {
        self.pane_tasks.iter().any(|t| t.is_some())
    }

    /// Clears PTY reference and related state for a specific pane
    fn clear_pane_pty_reference(&mut self, pane_idx: usize) {
        if pane_idx < 2 {
            self.terminal_pane_data[pane_idx].pty = None;
            self.terminal_pane_data[pane_idx].can_be_interactive = false;
            self.terminal_pane_data[pane_idx].set_interactive(false);
        }
    }

    /// Clears all output panes and resets their associated state.
    fn clear_all_panes(&mut self) {
        self.pane_tasks = [None, None];

        // Clear PTY references for both panes
        self.clear_pane_pty_reference(0);
        self.clear_pane_pty_reference(1);

        self.update_focus(Focus::TaskList);
        self.set_spacebar_mode(false, None);
        self.dispatch_action(Action::UnpinAllTasks);
    }

    /// Toggles the visibility of the output pane for the currently selected task.
    /// In spacebar mode, the output follows the task selection.
    fn toggle_output_visibility(&mut self) {
        // TODO: Not sure why we do this, this action only happens when the task list is visible
        self.layout_manager
            .set_task_list_visibility(TaskListVisibility::Visible);

        // Extract task name first to end the immutable borrow
        let task_name = match self.selection_manager.lock().get_selected_task_name() {
            Some(name) => name.clone(),
            None => return,
        };

        if self.has_visible_panes() {
            self.clear_all_panes();
            self.set_spacebar_mode(false, None);
        } else {
            // Show current task in pane 1 in spacebar mode
            self.pane_tasks = [Some(task_name), None];
            self.set_spacebar_mode(true, None);
        }
    }

    fn set_spacebar_mode(
        &mut self,
        spacebar_mode: bool,
        selection_mode_override: Option<SelectionMode>,
    ) {
        self.spacebar_mode = spacebar_mode;

        let selection_mode = if spacebar_mode {
            // When entering spacebar mode, we want to track by name by default
            SelectionMode::TrackByName
        } else {
            // When exiting spacebar mode, we want to track by position by default
            SelectionMode::TrackByPosition
        };
        self.selection_manager
            .lock()
            .set_selection_mode(selection_mode_override.unwrap_or(selection_mode));

        if spacebar_mode {
            self.layout_manager
                .set_pane_arrangement(PaneArrangement::Single);
        } else {
            self.layout_manager
                .set_pane_arrangement(PaneArrangement::None);
        }

        // Recalculate the layout areas
        self.recalculate_layout_areas();

        // Ensure the pty instances get resized appropriately
        let _ = self.debounce_pty_resize();

        self.dispatch_action(Action::SetSpacebarMode(spacebar_mode));
    }

    fn focus_next(&mut self) {
        if !self.has_visible_panes() {
            return;
        }

        let focus = match self.focus {
            Focus::TaskList => {
                // Move to first visible pane
                if let Some(first_pane) = self.pane_tasks.iter().position(|t| t.is_some()) {
                    Focus::MultipleOutput(first_pane)
                } else {
                    Focus::TaskList
                }
            }
            Focus::MultipleOutput(current_pane) => {
                // Find next visible pane or go back to task list
                let next_pane = (current_pane + 1..2).find(|&idx| self.pane_tasks[idx].is_some());

                match next_pane {
                    Some(pane) => Focus::MultipleOutput(pane),
                    None => {
                        // If the task list is hidden, try and go back to the previous pane if there is one, otherwise do nothing
                        if self.is_task_list_hidden() {
                            if current_pane > 0 {
                                Focus::MultipleOutput(current_pane - 1)
                            } else {
                                return;
                            }
                        } else {
                            Focus::TaskList
                        }
                    }
                }
            }
            Focus::HelpPopup => Focus::TaskList,
            Focus::CountdownPopup => Focus::TaskList,
            Focus::HintPopup => Focus::TaskList,
        };

        self.update_focus(focus);
    }

    fn focus_previous(&mut self) {
        let num_panes = self.pane_tasks.iter().filter(|t| t.is_some()).count();
        if num_panes == 0 {
            return; // No panes to focus
        }

        let focus = match self.focus {
            Focus::TaskList => {
                // When on task list, go to the rightmost (highest index) pane
                if let Some(last_pane) = (0..2).rev().find(|&idx| self.pane_tasks[idx].is_some()) {
                    Focus::MultipleOutput(last_pane)
                } else {
                    Focus::TaskList
                }
            }
            Focus::MultipleOutput(current_pane) => {
                if current_pane > 0 {
                    // Try to go to previous pane
                    if let Some(prev_pane) = (0..current_pane)
                        .rev()
                        .find(|&idx| self.pane_tasks[idx].is_some())
                    {
                        Focus::MultipleOutput(prev_pane)
                    } else if !self.is_task_list_hidden() {
                        // Go to task list if it's visible
                        Focus::TaskList
                    } else {
                        // If task list is hidden, wrap around to rightmost pane
                        if let Some(last_pane) =
                            (0..2).rev().find(|&idx| self.pane_tasks[idx].is_some())
                        {
                            Focus::MultipleOutput(last_pane)
                        } else {
                            // Shouldn't happen (would mean no panes)
                            return;
                        }
                    }
                } else {
                    // We're at leftmost pane (index 0)
                    if !self.is_task_list_hidden() {
                        // Go to task list if it's visible
                        Focus::TaskList
                    } else if num_panes > 1 {
                        // If task list hidden and multiple panes, wrap to rightmost pane
                        if let Some(last_pane) =
                            (1..2).rev().find(|&idx| self.pane_tasks[idx].is_some())
                        {
                            Focus::MultipleOutput(last_pane)
                        } else {
                            // Stay on current pane if can't find another one
                            Focus::MultipleOutput(current_pane)
                        }
                    } else {
                        // Only one pane and task list hidden, nowhere to go
                        Focus::MultipleOutput(current_pane)
                    }
                }
            }
            Focus::HelpPopup => Focus::TaskList,
            Focus::CountdownPopup => Focus::TaskList,
            Focus::HintPopup => Focus::TaskList,
        };

        self.update_focus(focus);
    }

    fn toggle_task_list(&mut self) {
        // If there are no visible panes, do nothing, otherwise the screen will be blank
        if !self.has_visible_panes() {
            return;
        }
        self.layout_manager.toggle_task_list_visibility();
        self.recalculate_layout_areas();
        // Ensure the pty instances get resized appropriately (no debounce as this is based on an imperative user action)
        let _ = self.handle_pty_resize();
    }

    fn toggle_layout_mode(&mut self, area: Rect) {
        self.layout_manager.toggle_layout_mode(area);
        self.recalculate_layout_areas();
        // Ensure the pty instances get resized appropriately (no debounce as this is based on an imperative user action)
        let _ = self.handle_pty_resize();
    }

    fn assign_current_task_to_pane(&mut self, pane_idx: usize) {
        // Extract task name first to end the immutable borrow
        let task_name = match self.selection_manager.lock().get_selected_task_name() {
            Some(name) => name.clone(),
            None => return,
        };

        // If we're in spacebar mode, clear the spacebar placeholder before pinning
        // In spacebar mode, pane_tasks[0] is a placeholder that may hold a stale task
        if self.spacebar_mode {
            // Clear the spacebar placeholder in pane 0
            self.pane_tasks[0] = None;
            self.clear_pane_pty_reference(0);
            self.dependency_view_states[0] = None;

            // Exit spacebar mode
            self.set_spacebar_mode(false, Some(SelectionMode::TrackByName));

            // Pin the task to the requested pane
            self.pane_tasks[pane_idx] = Some(task_name.clone());
            self.layout_manager
                .set_pane_arrangement(PaneArrangement::Single);
            self.dispatch_action(Action::PinTask(task_name.clone(), pane_idx));
        } else {
            // Check if the task is already pinned to the OTHER pane
            let other_pane_idx = 1 - pane_idx;
            if self.pane_tasks[other_pane_idx].as_deref() == Some(task_name.as_str()) {
                // Clear the other pane - task is "moving" to the new pane
                self.pane_tasks[other_pane_idx] = None;
                self.clear_pane_pty_reference(other_pane_idx);
                self.dependency_view_states[other_pane_idx] = None;
                self.dispatch_action(Action::UnpinTask(task_name.clone(), other_pane_idx));

                // Adjust layout since we now only have one pane
                self.layout_manager
                    .set_pane_arrangement(PaneArrangement::Single);
            }

            // Check if the task is already pinned to the pane
            if self.pane_tasks[pane_idx].as_deref() == Some(task_name.as_str()) {
                // Task is already pinned to this pane - just focus it
                self.update_focus(Focus::MultipleOutput(pane_idx));
            } else {
                // Pin the task to the specified pane
                self.pane_tasks[pane_idx] = Some(task_name.clone());
                self.update_focus(Focus::TaskList);

                // Exit spacebar mode when pinning
                // When pinning a task, use name-based selection
                self.set_spacebar_mode(false, Some(SelectionMode::TrackByName));

                // Set pane arrangement based on count of pinned tasks
                let pinned_count = self.pane_tasks.iter().filter(|t| t.is_some()).count();
                match pinned_count {
                    0 => self
                        .layout_manager
                        .set_pane_arrangement(PaneArrangement::None),
                    1 => self
                        .layout_manager
                        .set_pane_arrangement(PaneArrangement::Single),
                    _ => self
                        .layout_manager
                        .set_pane_arrangement(PaneArrangement::Double),
                }

                self.dispatch_action(Action::PinTask(task_name.clone(), pane_idx));
            }
        }

        // Always re-evaluate the optimal size of the terminal pane(s)
        self.recalculate_layout_areas();
        // Ensure the pty instances get resized appropriately (no debounce as this is based on an imperative user action)
        let _ = self.handle_pty_resize();
    }

    /// Forward key events to the currently focused pane, if any.
    fn handle_key_event(&mut self, key: KeyEvent) -> io::Result<()> {
        if let Focus::MultipleOutput(pane_idx) = self.focus {
            // Get the task assigned to this pane to determine how to handle keys
            // In spacebar mode, use selection manager; in pinned mode, use pane_tasks
            let relevant_pane_task: Option<String> = if self.spacebar_mode {
                self.selection_manager
                    .lock()
                    .get_selected_task_name()
                    .cloned()
            } else {
                self.pane_tasks[pane_idx].clone()
            };

            if let Some(task_name) = relevant_pane_task {
                let task_status = self
                    .get_task_status(&task_name)
                    .unwrap_or(TaskStatus::NotStarted);

                if matches!(task_status, TaskStatus::NotStarted | TaskStatus::Skipped) {
                    // Task is pending - handle keys in dependency view
                    if let Some(dep_state) = &mut self.dependency_view_states[pane_idx] {
                        if let Some(action) = dep_state.handle_key_event(key) {
                            self.dispatch_action(action);
                        }
                    }
                    return Ok(());
                } else {
                    // Task is running/completed - handle keys in terminal pane
                    let terminal_pane_data = &mut self.terminal_pane_data[pane_idx];
                    if let Some(action) = terminal_pane_data.handle_key_event(key)? {
                        self.dispatch_action(action);
                    }
                }
            }
            Ok(())
        } else {
            Ok(())
        }
    }

    /// Returns true if the currently focused pane is in interactive mode.
    fn is_interactive_mode(&self) -> bool {
        match self.focus {
            Focus::MultipleOutput(pane_idx) => self.terminal_pane_data[pane_idx].is_interactive(),
            _ => false,
        }
    }

    pub fn set_interactive_mode(&mut self, interactive: bool) {
        if let Focus::MultipleOutput(pane_idx) = self.focus {
            self.terminal_pane_data[pane_idx].set_interactive(interactive);
        }
    }

    /// Ensures that the PTY instances get resized appropriately based on the latest layout areas.
    fn debounce_pty_resize(&mut self) -> io::Result<()> {
        // Get current time in milliseconds
        let now = current_timestamp_millis() as u128;

        // If we have a timer and it's not expired yet, just return
        if let Some(timer) = self.resize_debounce_timer {
            if now < timer {
                return Ok(());
            }
        }

        // Set a new timer for 200ms from now
        self.resize_debounce_timer = Some(now + 200);

        // Process the resize
        self.handle_pty_resize()
    }

    /// Actually processes the resize event by updating PTY dimensions.
    fn handle_pty_resize(&mut self) -> io::Result<()> {
        // Always use fullscreen mode logic
        {
            if self.layout_areas.is_none() {
                return Ok(());
            }

            let mut needs_sort = false;

            for (pane_idx, pane_area) in self
                .layout_areas
                .as_ref()
                .unwrap()
                .terminal_panes
                .iter()
                .enumerate()
            {
                let terminal_pane_data = &mut self.terminal_pane_data[pane_idx];
                if let Some(pty) = terminal_pane_data.pty.as_ref() {
                    let (pty_height, pty_width) =
                        TerminalPane::calculate_pty_dimensions(*pane_area);

                    // Get current dimensions before resize
                    let (current_rows, current_cols) = pty.get_dimensions();

                    // Skip resize if dimensions haven't actually changed
                    if current_rows == pty_height && current_cols == pty_width {
                        continue;
                    }

                    // With shared dimensions, we only need to call resize once per PTY instance
                    // The shared Arc<RwLock<(u16, u16)>> ensures all references see the update
                    let mut pty_clone = pty.as_ref().clone();
                    pty_clone.resize(pty_height, pty_width)?;

                    // If dimensions changed, mark for sort
                    if current_rows != pty_height {
                        needs_sort = true;
                    }
                }
            }

            // Sort tasks if needed after all resizing is complete
            if needs_sort {
                self.dispatch_action(Action::SortTasks);
            }
        }

        Ok(())
    }

    fn is_task_list_hidden(&self) -> bool {
        self.layout_manager.get_task_list_visibility() == TaskListVisibility::Hidden
    }

    fn register_pty_instance(&mut self, task_id: &str, pty: PtyInstance) {
        // Wrap in Arc
        let pty = Arc::new(pty);
        self.core
            .state()
            .lock()
            .register_pty_instance(task_id.to_string(), pty);
    }

    /// Calculate appropriate PTY dimensions based on the current TUI mode
    fn calculate_pty_dimensions_for_mode(&self) -> (u16, u16) {
        // For fullscreen mode, use reasonable defaults that will be resized later by terminal panes
        (24, 80)
    }

    // Writes the given output to the given parser, used for the case where a task is a cache hit, or when it is run outside of the rust pseudo-terminal
    fn write_output_to_parser(parser: &PtyInstance, output: String) {
        let normalized_output = normalize_newlines(output.as_bytes());
        parser.process_output(&normalized_output);
    }

    fn write_escape_sequence_to_parser(parser: &PtyInstance, sequence: impl Into<EscapeSequence>) {
        parser.process_output(sequence.into().as_bytes());
    }

    fn display_and_focus_current_task_in_terminal_pane(&mut self, force_spacebar_mode: bool) {
        if force_spacebar_mode {
            self.toggle_output_visibility();
        } else {
            self.assign_current_task_to_pane(0);
        }
        // Unlike in standard spacebar mode, also set focus to the pane, if applicable (if the user pressed enter a second time, there will be no visible panes)
        if self.has_visible_panes() {
            self.update_focus(Focus::MultipleOutput(0));
        }
    }

    fn update_focus(&mut self, focus: Focus) {
        self.previous_focus = self.focus;
        self.focus = focus;
        self.dispatch_action(Action::UpdateFocus(focus));
    }

    fn handle_debug_event(&mut self, key: KeyEvent) {
        // https://docs.rs/tui-logger/latest/tui_logger/#smart-widget-key-commands
        // |  KEY     | ACTION
        // |----------|-----------------------------------------------------------|
        // | h        | Toggles target selector widget hidden/visible
        // | f        | Toggle focus on the selected target only
        // | UP       | Select previous target in target selector widget
        // | DOWN     | Select next target in target selector widget
        // | LEFT     | Reduce SHOWN (!) log messages by one level
        // | RIGHT    | Increase SHOWN (!) log messages by one level
        // | -        | Reduce CAPTURED (!) log messages by one level
        // | +        | Increase CAPTURED (!) log messages by one level
        // | PAGEUP   | Enter Page Mode and scroll approx. half page up in log history.
        // | PAGEDOWN | Only in page mode: scroll 10 events down in log history.
        // | ESCAPE   | Exit page mode and go back to scrolling mode
        // | SPACE    | Toggles hiding of targets, which have logfilter set to off
        let debug_widget_event = match key.code {
            KeyCode::Char(' ') => Some(TuiWidgetEvent::SpaceKey),
            KeyCode::Esc => Some(TuiWidgetEvent::EscapeKey),
            KeyCode::PageUp => Some(TuiWidgetEvent::PrevPageKey),
            KeyCode::PageDown => Some(TuiWidgetEvent::NextPageKey),
            KeyCode::Up => Some(TuiWidgetEvent::UpKey),
            KeyCode::Down => Some(TuiWidgetEvent::DownKey),
            KeyCode::Left => Some(TuiWidgetEvent::LeftKey),
            KeyCode::Right => Some(TuiWidgetEvent::RightKey),
            KeyCode::Char('+') => Some(TuiWidgetEvent::PlusKey),
            KeyCode::Char('-') => Some(TuiWidgetEvent::MinusKey),
            KeyCode::Char('h') => Some(TuiWidgetEvent::HideKey),
            KeyCode::Char('f') => Some(TuiWidgetEvent::FocusKey),
            _ => None,
        };

        if let Some(event) = debug_widget_event {
            self.debug_state.transition(event);
        }
    }

    pub fn set_console_messenger(&mut self, messenger: NxConsoleMessageConnection) {
        self.core.state().lock().set_console_messenger(messenger);
        self.dispatch_action(Action::ConsoleMessengerAvailable(true));
    }

    /// Renders the dependency view for a pending task in the specified pane
    fn render_dependency_view_internal(
        &mut self,
        f: &mut ratatui::Frame,
        pane_idx: usize,
        pane_area: Rect,
        task_name: String,
        is_focused: bool,
    ) {
        // Calculate values that were previously passed in
        let task_status = self
            .get_task_status(&task_name)
            .unwrap_or(TaskStatus::NotStarted);
        let throbber_counter = self
            .components
            .iter()
            .find_map(|c| c.as_any().downcast_ref::<TasksList>())
            .map(|tasks_list| tasks_list.throbber_counter)
            .unwrap_or(0);

        // Create or update dependency view state for this pane
        let should_update = self.dependency_view_states[pane_idx]
            .as_ref()
            .map_or(false, |existing_state| {
                existing_state.current_task == task_name
            });

        if should_update {
            // Same task, update the existing state (preserves scroll position, etc.)
            if let Some(existing_state) = self.dependency_view_states[pane_idx].as_mut() {
                existing_state.update(task_status, is_focused, throbber_counter, pane_area);
            }
        } else {
            // Different task or no existing state - create a new one
            // This ensures we get fresh dependency analysis when task becomes SKIPPED
            let state = self.core.state().lock();
            let task_graph = state.task_graph();
            let new_state = DependencyViewState::new(
                task_name.clone(),
                task_status,
                task_graph,
                is_focused,
                throbber_counter,
                pane_area,
            );
            drop(state);
            self.dependency_view_states[pane_idx] = Some(new_state);
        }

        // No need to update status in DependencyViewState - we pass the full map to the widget
        if let Some(dep_state) = &mut self.dependency_view_states[pane_idx] {
            let state = self.core.state().lock();
            let task_status_map = state.get_task_status_map();
            let task_graph = state.task_graph();
            let dependency_view = DependencyView::new(task_status_map, task_graph);
            f.render_stateful_widget(dependency_view, pane_area, dep_state);
        }
    }

    /// Renders the terminal pane for a running/completed task in the specified pane
    fn render_terminal_pane_internal(
        &mut self,
        f: &mut ratatui::Frame,
        pane_idx: usize,
        pane_area: Rect,
        task_name: String,
        is_focused: bool,
        is_next_tab_target: bool,
    ) {
        // Calculate values that were previously passed in
        let task_status = self
            .get_task_status(&task_name)
            .unwrap_or(TaskStatus::NotStarted);
        let task_continuous = self.is_task_continuous(&task_name);
        let state = self.core.state().lock();
        let has_pty = state.get_pty_instance(&task_name).is_some();

        let terminal_pane_data = &mut self.terminal_pane_data[pane_idx];
        terminal_pane_data.is_continuous = task_continuous;
        let in_progress = task_status == TaskStatus::InProgress;
        if !in_progress && terminal_pane_data.is_interactive() {
            terminal_pane_data.set_interactive(false);
        }

        if has_pty {
            if let Some(pty) = state.get_pty_instance(&task_name) {
                terminal_pane_data.can_be_interactive = in_progress && pty.can_be_interactive();
                terminal_pane_data.pty = Some(pty.clone());

                // Immediately resize PTY to match the current terminal pane dimensions
                let (pty_height, pty_width) = TerminalPane::calculate_pty_dimensions(pane_area);
                let mut pty_clone = pty.as_ref().clone();
                pty_clone.resize(pty_height, pty_width).ok();
            } else {
                // Clear PTY data if the task exists but doesn't have a PTY instance
                terminal_pane_data.pty = None;
                terminal_pane_data.can_be_interactive = false;
            }
        } else {
            // Clear PTY data when switching to a task that doesn't have a PTY instance
            terminal_pane_data.pty = None;
            terminal_pane_data.can_be_interactive = false;
        }

        // Get task timing information from TasksList
        let (start_time, end_time) = self
            .components
            .iter()
            .find_map(|c| c.as_any().downcast_ref::<TasksList>())
            .map(|tasks_list| tasks_list.get_task_timing(&task_name))
            .unwrap_or((None, None));

        // Get estimated duration from app's estimated_task_timings
        let estimated_duration = state.estimated_task_timings().get(&task_name).copied();
        let has_console_messenger = state.get_console_messenger().is_some();
        drop(state);

        let mut pane_state = TerminalPaneState::new(
            task_name,
            task_status,
            task_continuous,
            is_focused,
            has_pty,
            is_next_tab_target,
            has_console_messenger,
            estimated_duration,
            start_time,
            end_time,
        );

        let terminal_pane = TerminalPane::new()
            .pty_data(terminal_pane_data)
            .continuous(task_continuous);

        f.render_stateful_widget(terminal_pane, pane_area, &mut pane_state);
    }

    pub fn set_estimated_task_timings(&mut self, timings: HashMap<String, i64>) {
        self.core.state().lock().set_estimated_task_timings(timings);
    }

    /// Handles automatic pane switching when a task becomes skipped.
    /// If the skipped task is currently being viewed in a pane, automatically
    /// switches that pane to show the failed dependency's terminal output.
    fn handle_automatic_pane_switching(&mut self, skipped_task_id: &str) {
        if let Some(failed_dep) = self.get_first_failed_dependency(skipped_task_id) {
            let panes_to_update: Vec<usize> = self
                .pane_tasks
                .iter()
                .enumerate()
                .filter(|(_, task)| task.as_deref() == Some(skipped_task_id))
                .map(|(idx, _)| idx)
                .collect();

            // Check if both panes would show the same task after updating
            let will_duplicate = panes_to_update.len() > 1
                || (panes_to_update.len() == 1 && {
                    let other_pane = 1 - panes_to_update[0];
                    self.pane_tasks[other_pane].as_ref() == Some(&failed_dep)
                });

            if will_duplicate {
                // Consolidate to single pane
                self.switch_pane_to_task(0, failed_dep);
                self.pane_tasks[1] = None;
                self.dependency_view_states[1] = None;
                self.terminal_pane_data[1] = TerminalPaneData::new();
                self.layout_manager
                    .set_pane_arrangement(PaneArrangement::Single);
                self.layout_areas = None;
            } else {
                // Update panes normally
                for pane_idx in panes_to_update {
                    self.switch_pane_to_task(pane_idx, failed_dep.clone());
                }
            }
        }
    }

    /// Switches a pane to display a different task, updating all necessary state.
    fn switch_pane_to_task(&mut self, pane_idx: usize, task_id: String) {
        self.pane_tasks[pane_idx] = Some(task_id.clone());

        // Clear cached states so they get recreated for the new task
        self.dependency_view_states[pane_idx] = None;

        // Assign the PTY for the new task to this pane if available
        let state = self.core.state().lock();
        if let Some(pty_instance) = state.get_pty_instance(&task_id) {
            self.terminal_pane_data[pane_idx].pty = Some(pty_instance.clone());

            // Immediately resize PTY to match the current terminal pane dimensions
            if let Some(layout_areas) = &self.layout_areas {
                if let Some(pane_area) = layout_areas.terminal_panes.get(pane_idx) {
                    let (pty_height, pty_width) =
                        TerminalPane::calculate_pty_dimensions(*pane_area);
                    let mut pty_clone = pty_instance.as_ref().clone();
                    pty_clone.resize(pty_height, pty_width).ok();
                }
            }
        }

        // Update the selection manager to prevent conflicts with manual selection
        {
            let mut selection_manager = self.selection_manager.lock();
            selection_manager.select_task(task_id);
        }
    }

    /// Gets the first failed dependency for a given task.
    ///
    /// Returns the task name of the first dependency that failed, causing this task to be skipped.
    /// This is used for automatic pane switching to show the root cause of failures.
    fn get_first_failed_dependency(&self, task_name: &str) -> Option<String> {
        let state = self.core.state().lock();
        let failed_deps =
            get_failed_dependencies(task_name, state.task_graph(), state.get_task_status_map());
        failed_deps.into_iter().next()
    }

    /// Updates the terminal progress indicator (OSC 9;4).
    /// Shows percentage of tasks that are complete (anything except NotStarted, InProgress, or Shared).
    fn update_terminal_progress(&self) {
        let state = self.core.state().lock();
        let total_tasks = state.get_task_status_map().len();
        if total_tasks == 0 {
            return;
        }

        let completed_tasks = state.get_completed_task_count();
        drop(state); // Release lock before I/O

        let percentage = (completed_tasks * 100) / total_tasks;

        // Write OSC 9;4 escape sequence to stderr (less likely to conflict with TUI rendering)
        // Format: ESC ] 9 ; 4 ; <state> ; <percentage> ST
        // state: 1 = show progress, 0 = hide
        // percentage: 0-100
        // Using ST terminator (\x1b\\) for maximum compatibility (Ghostty, Windows Terminal, VTE)
        let _ = io::stderr().write_all(format!("\x1b]9;4;1;{}\x1b\\", percentage).as_bytes());
        let _ = io::stderr().flush();
    }

    /// Clears the terminal progress indicator.
    pub fn clear_terminal_progress() {
        // State 0 = hide progress (using ST terminator for compatibility)
        let _ = io::stderr().write_all(b"\x1b]9;4;0;0\x1b\\");
        let _ = io::stderr().flush();
    }
}

// === TuiApp Trait Implementation ===

use crate::native::tui::tui_app::TuiApp;

impl TuiApp for App {
    // === Core Access ===

    fn core(&self) -> &TuiCore {
        &self.core
    }

    fn core_mut(&mut self) -> &mut TuiCore {
        &mut self.core
    }

    // === Event Handling (delegates to App methods) ===

    fn handle_event(
        &mut self,
        event: tui::Event,
        action_tx: &UnboundedSender<Action>,
    ) -> Result<bool> {
        self.handle_event(event, action_tx)
    }

    fn handle_action(
        &mut self,
        tui: &mut tui::Tui,
        action: Action,
        action_tx: &UnboundedSender<Action>,
    ) {
        self.handle_action(tui, action, action_tx);
    }

    // === Mode Identification ===

    fn get_tui_mode(&self) -> TuiMode {
        TuiMode::FullScreen
    }

    // === Initialization ===

    fn init(&mut self, area: Size) -> Result<()> {
        self.init(area)
    }

    // === Task Lifecycle (App has custom UI logic, so override defaults) ===

    fn start_command(&mut self, thread_count: Option<u32>) {
        App::start_command(self, thread_count);
    }

    // === Task Lifecycle (hooks for trait defaults) ===

    fn on_tasks_started(&mut self, tasks: &[Task]) {
        self.dispatch_action(Action::StartTasks(tasks.to_vec()));
    }

    fn on_tasks_ended(&mut self, task_results: &[TaskResult]) {
        // Resize PTYs when tasks finish (they may still be displaying output)
        let _ = self.debounce_pty_resize();
        self.dispatch_action(Action::EndTasks(task_results.to_vec()));
    }

    // start_tasks and end_tasks use trait defaults which call hooks above

    fn update_task_status(&mut self, task_id: String, status: TaskStatus) {
        App::update_task_status(self, task_id, status);
    }

    fn end_command(&mut self) {
        App::end_command(self);
    }

    // === PTY Registration (hooks for trait defaults) ===

    fn calculate_pty_dimensions(&self) -> (u16, u16) {
        self.calculate_pty_dimensions_for_mode()
    }

    fn on_pty_registered(&mut self, task_id: &str) {
        // Update task status and trigger resize debounce
        self.update_task_status(task_id.to_string(), TaskStatus::InProgress);
        let _ = self.debounce_pty_resize();
    }

    // Override print_task_terminal_output for App-specific continuous task handling
    fn print_task_terminal_output(&mut self, task_id: String, output: String) {
        // Call the inherent method which has continuous task handling
        App::print_task_terminal_output(self, task_id, output);
    }

    // Override append_task_output because App has different behavior (panics if not registered)
    fn append_task_output(&mut self, task_id: String, output: String) {
        App::append_task_output(self, task_id, output);
    }

    // `should_quit` uses default implementation from trait

    fn get_selected_task_name(&self) -> Option<String> {
        self.selection_manager
            .lock()
            .get_selected_task_name()
            .cloned()
    }

    fn get_focused_pane_task(&self) -> Option<String> {
        // If focus is on a terminal pane, return that pane's task
        // In spacebar mode, return the selected task (it follows selection)
        // Otherwise return the pinned task from that pane
        match self.focus {
            Focus::MultipleOutput(pane_idx) => {
                if self.spacebar_mode {
                    self.selection_manager
                        .lock()
                        .get_selected_task_name()
                        .cloned()
                } else {
                    self.pane_tasks[pane_idx].clone()
                }
            }
            _ => {
                // Focus is on task list - return None to let the caller
                // fall back to get_selected_task_name() for the user's selection
                None
            }
        }
    }

    fn save_ui_state_for_mode_switch(&self) {
        let focused_pane = match self.focus {
            Focus::MultipleOutput(pane_idx) => Some(pane_idx),
            _ => None,
        };

        let selected_task = self
            .selection_manager
            .lock()
            .get_selected_task_name()
            .cloned();

        self.core.state().lock().save_ui_state(
            self.pane_tasks.clone(),
            self.spacebar_mode,
            focused_pane,
            selected_task,
        );
    }
}
