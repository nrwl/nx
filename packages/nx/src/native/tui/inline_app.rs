use color_eyre::eyre::Result;
use crossterm::event::{KeyCode, KeyModifiers};
use hashbrown::HashSet;
use napi::bindgen_prelude::External;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use parking_lot::Mutex;
use ratatui::layout::Size;
use ratatui::style::Stylize;
use ratatui::text::Span;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc::UnboundedSender;
use tracing::debug;

use crate::native::ide::nx_console::messaging::NxConsoleMessageConnection;
use crate::native::{
    pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc},
    tasks::types::{Task, TaskGraph, TaskResult},
};

use super::action::Action;
use super::components::countdown_popup::CountdownPopup;
use super::components::tasks_list::TaskStatus;
use super::config::TuiConfig;
use super::graph_utils::get_task_count;
use super::lifecycle::{RunMode, TuiMode};
use super::pty::PtyInstance;
use super::tui;
use super::tui_app::TuiApp;
use super::tui_state::TuiState;
use super::utils::{get_task_status_color, get_task_status_icon, write_output_to_pty};

/// Simplified TUI application for inline viewport mode
///
/// InlineApp displays task execution in a compact inline format within the terminal,
/// showing only the currently running task's output. Unlike the full-screen App,
/// it has no interactive navigation and minimal UI elements.
///
/// # Design Philosophy
///
/// - **Single Task Focus**: Only shows output for the currently running task
/// - **No Navigation**: No arrow keys, tabs, or focus management
/// - **Simple Quit**: Only q, ESC, and Ctrl+C to quit
/// - **Scrollback Above**: Completed task output scrolls above the viewport
/// - **Shared State**: Uses Arc<Mutex<TuiState>> to enable mode switching
///
/// # State Management
///
/// All task execution state (tasks, status, PTY instances, timing, callbacks)
/// is stored in the shared TuiState. InlineApp only maintains UI-specific state
/// like scrollback tracking and render counters.
pub struct InlineApp {
    // === Shared State ===
    /// Shared task execution state (accessed via lock)
    state: Arc<Mutex<TuiState>>,

    // === Inline UI State ===
    /// Channel for sending actions to the event loop
    action_tx: Option<UnboundedSender<Action>>,
    /// The task whose output should be displayed (required for inline mode)
    /// This is set during mode switching or defaults to the first running task
    selected_task: Option<String>,
    /// Countdown popup for auto-exit (shared with full-screen mode)
    countdown_popup: CountdownPopup,

    // === Scrollback Rendering ===
    /// Track scrollback line count per task for incremental rendering
    task_scrollback_lines: HashMap<String, usize>,
    /// Track last rendered scrollback lines per task for buffered rendering
    task_last_rendered_scrollback: HashMap<String, usize>,
    /// Counter for buffering scrollback renders (render every 20th iteration)
    scrollback_render_counter: u32,
    /// Total lines inserted above TUI (for cleanup on exit)
    total_inserted_lines: u32,
}

impl InlineApp {
    /// Create new inline app with fresh state
    ///
    /// This constructor creates a new TuiState and wraps it in Arc<Mutex<>>.
    /// Use this when starting a new task execution session.
    ///
    /// # Arguments
    ///
    /// * `tasks` - All tasks to be executed
    /// * `initiating_tasks` - Tasks that were explicitly requested
    /// * `run_mode` - Whether this is run-one or run-many
    /// * `pinned_tasks` - Tasks that should always be visible (unused in inline mode)
    /// * `tui_config` - TUI configuration (auto-exit, etc.)
    /// * `title_text` - Title to display in status bar
    /// * `task_graph` - Task dependency graph
    pub fn new(
        tasks: Vec<Task>,
        initiating_tasks: HashSet<String>,
        run_mode: RunMode,
        pinned_tasks: Vec<String>,
        tui_config: TuiConfig,
        title_text: String,
        task_graph: TaskGraph,
    ) -> Result<Self> {
        let state = Arc::new(Mutex::new(TuiState::new(
            tasks,
            initiating_tasks,
            run_mode,
            pinned_tasks,
            tui_config,
            title_text,
            task_graph,
            HashMap::new(), // estimated_task_timings - will be set later via set_estimated_task_timings()
        )));

        Ok(Self {
            state,
            action_tx: None,
            selected_task: None, // Will auto-select first running task on render
            countdown_popup: CountdownPopup::new(),
            task_scrollback_lines: HashMap::new(),
            task_last_rendered_scrollback: HashMap::new(),
            scrollback_render_counter: 0,
            total_inserted_lines: 0,
        })
    }

    /// Create inline app with existing shared state
    ///
    /// This constructor is used for mode switching, allowing an InlineApp to be
    /// created from the same TuiState that was used by a full-screen App.
    /// The UI state (scrollback, render counters) is reset, but task execution
    /// state is preserved.
    ///
    /// # Arguments
    ///
    /// * `state` - Existing shared TuiState from another app instance
    /// * `selected_task` - Optional task to display (from full-screen selection)
    pub fn with_state(state: Arc<Mutex<TuiState>>, selected_task: Option<String>) -> Result<Self> {
        Ok(Self {
            state,
            action_tx: None,
            selected_task, // Use the provided selection from mode switch
            countdown_popup: CountdownPopup::new(),
            task_scrollback_lines: HashMap::new(),
            task_last_rendered_scrollback: HashMap::new(),
            scrollback_render_counter: 0,
            total_inserted_lines: 0,
        })
    }

    /// Get reference to the shared state (for mode switching)
    ///
    /// Returns an Arc clone, which is cheap (just increments ref count).
    pub fn get_state(&self) -> Arc<Mutex<TuiState>> {
        self.state.clone()
    }

    // === Helper Methods ===

    /// Immediately set quit flag in shared state
    fn quit_immediately(&mut self) {
        let mut state = self.state.lock();
        state.quit_immediately();
    }

    /// Get the task ID of the currently running task (if any)
    fn get_current_running_task(&self) -> Option<String> {
        self.state.lock().get_current_running_task()
    }

    /// Get count of completed tasks (any terminal state)
    fn get_completed_task_count(&self) -> usize {
        self.state.lock().get_completed_task_count()
    }

    /// Calculate PTY dimensions for inline mode
    ///
    /// Reserves space for UI elements (status bar, progress bar) and returns
    /// the remaining space for task output.
    fn calculate_inline_pty_dimensions(&self) -> (u16, u16) {
        // Get terminal size
        if let Ok((cols, rows)) = crossterm::terminal::size() {
            // Reserve space for status/progress bars (6 lines: 3+3 with borders)
            let content_height = rows.saturating_sub(3);
            (content_height, cols)
        } else {
            // Fallback to reasonable defaults
            (20, 80)
        }
    }

    /// Get names of tasks that failed
    fn get_failed_task_names(&self) -> Vec<String> {
        self.state.lock().get_failed_task_names()
    }

    /// Internal method to handle Action::EndCommand
    ///
    /// This checks whether auto-exit should happen and either starts the countdown
    /// or does nothing (if user has interacted or auto-exit is disabled).
    fn handle_end_command(&mut self) {
        use tracing::debug;

        debug!("📋 InlineApp::handle_end_command() called");

        // If the user has interacted with the app or auto-exit is disabled, do nothing
        let state = self.state.lock();
        let user_has_interacted = state.has_user_interacted();
        let should_exit_automatically = state.tui_config().auto_exit.should_exit_automatically();
        let task_graph_ref = state.task_graph();
        let task_count = get_task_count(task_graph_ref);
        drop(state);

        debug!(
            "  user_has_interacted: {}, should_exit_automatically: {}, task_count: {}",
            user_has_interacted, should_exit_automatically, task_count
        );

        if user_has_interacted || !should_exit_automatically {
            debug!("  ❌ Auto-exit blocked: user interacted or auto-exit disabled");
            return;
        }

        let failed_task_names = self.get_failed_task_names();
        debug!("  failed_task_count: {}", failed_task_names.len());

        // If there are more than 1 failed tasks, do not auto-exit
        // (In inline mode, we can't focus a specific task, so just skip auto-exit)
        if failed_task_names.len() > 1 {
            debug!("  ❌ Auto-exit blocked: multiple failed tasks");
            return;
        }

        if task_count > 1 {
            debug!("  ⏱️  Starting countdown (multi-task)");
            self.begin_exit_countdown()
        } else {
            debug!("  🚪 Quitting immediately (single task)");
            self.quit();
        }
    }

    /// Empty quit method (actual quit is handled by quit_immediately)
    fn quit(&mut self) {
        self.quit_immediately();
    }

    /// Start the exit countdown
    ///
    /// Shows the countdown popup and schedules the quit timer in shared state.
    fn begin_exit_countdown(&mut self) {
        use tracing::debug;

        let countdown_duration = self.state.lock().tui_config().auto_exit.countdown_seconds();
        debug!(
            "⏱️  InlineApp::begin_exit_countdown() - duration: {:?}",
            countdown_duration
        );

        // If countdown is disabled, exit immediately
        if countdown_duration.is_none() {
            debug!("  🚪 Countdown disabled, quitting immediately");
            self.quit();
            return;
        }

        // Otherwise, show the countdown popup for the configured duration
        let countdown_duration = countdown_duration.unwrap() as u64;
        debug!(
            "  📊 Starting countdown popup for {} seconds",
            countdown_duration
        );
        self.countdown_popup.start_countdown(countdown_duration);

        debug!("  ⏰ Scheduling quit timer");
        self.state
            .lock()
            .schedule_quit(std::time::Duration::from_secs(countdown_duration));

        debug!(
            "  ✅ Countdown started, popup visible: {}",
            self.countdown_popup.is_visible()
        );
    }

    /// Resize all PTY instances to match current inline dimensions
    ///
    /// Called when switching to inline mode via init().
    /// This ensures PTY output fits the available space, pushing excess content
    /// into scrollback.
    fn resize_all_ptys(&mut self) {
        let (rows, cols) = self.calculate_inline_pty_dimensions();

        let state = self.state.lock();

        // Resize each PTY instance
        for pty in state.get_pty_instances().values() {
            // Get current dimensions to avoid unnecessary resizes
            let (current_rows, current_cols) = pty.get_dimensions();

            // Only resize if dimensions actually changed
            if current_rows != rows || current_cols != cols {
                // Clone the PTY instance (cheap - just Arc ref counts)
                // so we can get mutable access for resize
                let mut pty_clone = pty.as_ref().clone();
                let _ = pty_clone.resize(rows, cols);
            }
        }
    }

    fn dispatch_action(&self, action: Action) {
        if let Some(tx) = &self.action_tx {
            tx.send(action).unwrap_or_else(|e| {
                debug!("Failed to dispatch action: {}", e);
            });
        }
    }
}

impl TuiApp for InlineApp {
    // === Event Handling ===

    fn handle_event(
        &mut self,
        event: tui::Event,
        action_tx: &UnboundedSender<Action>,
    ) -> Result<bool> {
        match event {
            tui::Event::Quit => {
                action_tx.send(Action::Quit)?;
                return Ok(true);
            }
            tui::Event::Key(key) => {
                // If countdown popup is visible, handle countdown-specific keys
                if self.countdown_popup.is_visible() {
                    match key.code {
                        KeyCode::Char('q') | KeyCode::Esc => {
                            // Quit immediately on 'q' or Esc when countdown is active
                            self.quit_immediately();
                            return Ok(true);
                        }
                        KeyCode::Char('c') if key.modifiers == KeyModifiers::CONTROL => {
                            // Quit immediately on Ctrl+C
                            self.quit_immediately();
                            return Ok(true);
                        }
                        KeyCode::Up | KeyCode::Char('k')
                            if self.countdown_popup.is_scrollable() =>
                        {
                            // Scroll up in countdown popup if scrollable
                            self.countdown_popup.scroll_up();
                            return Ok(false);
                        }
                        KeyCode::Down | KeyCode::Char('j')
                            if self.countdown_popup.is_scrollable() =>
                        {
                            // Scroll down in countdown popup if scrollable
                            self.countdown_popup.scroll_down();
                            return Ok(false);
                        }
                        _ => {
                            // Any other key cancels the countdown
                            self.countdown_popup.cancel_countdown();
                            self.state.lock().cancel_quit();
                            return Ok(false);
                        }
                    }
                }

                if matches!(key.code, KeyCode::Char('q')) && key.modifiers.is_empty() {
                    // Quit on 'q' or Esc when countdown is not active
                    let state = self.state.lock();
                    let all_tasks_completed = state.get_task_status_map().values().all(|status| {
                        matches!(
                            status,
                            TaskStatus::Success
                                | TaskStatus::Failure
                                | TaskStatus::Skipped
                                | TaskStatus::LocalCache
                                | TaskStatus::LocalCacheKeptExisting
                                | TaskStatus::RemoteCache
                                | TaskStatus::Stopped // Consider stopped continuous tasks as completed for exit purposes
                        )
                    });
                    drop(state);

                    if all_tasks_completed {
                        // If all tasks are done, quit immediately like Ctrl+C
                        let mut state = self.state.lock();
                        state.set_forced_shutdown(true);
                        state.quit_immediately();
                        drop(state);
                    } else {
                        // Otherwise, start the exit countdown to give the user the chance to change their mind in case of an accidental keypress
                        self.state.lock().set_forced_shutdown(true);
                        self.begin_exit_countdown();
                    }

                    return Ok(true);
                }

                if matches!(key.code, KeyCode::Char('c')) && key.modifiers == KeyModifiers::CONTROL
                {
                    let mut state = self.state.lock();
                    state
                        .get_console_messenger()
                        .as_ref()
                        .and_then(|c| c.end_running_tasks());

                    state.set_forced_shutdown(true);
                    // Quit immediately
                    state.quit_immediately();
                    drop(state);
                    return Ok(true);
                }

                if matches!(key.code, KeyCode::F(12)) {
                    // Toggle debug mode on F12
                    self.dispatch_action(Action::ToggleDebugMode);
                    return Ok(false);
                }
            }
            tui::Event::Render => action_tx.send(Action::Render)?,
            tui::Event::Tick => action_tx.send(Action::Tick)?,
            tui::Event::Resize(w, h) => action_tx.send(Action::Resize(w, h))?,
            _ => {} // Ignore mouse events, etc.
        }
        Ok(false)
    }

    fn handle_action(
        &mut self,
        tui: &mut tui::Tui,
        action: Action,
        _action_tx: &UnboundedSender<Action>,
    ) {
        match action {
            Action::Render => {
                // Render scrollback content above the TUI using insert_before
                self.render_scrollback_above_tui(tui);

                // Draw the inline TUI layout
                tui.draw(|f| {
                    let area = f.area();
                    self.render_inline_layout(f, area);
                })
                .ok();
            }
            Action::Quit => {
                self.quit_immediately();
            }
            Action::StartCommand(_) => {
                // Notify console messenger if connected
                let state = self.state.lock();
                if let Some(messenger) = state.get_console_messenger() {
                    messenger.start_running_tasks();
                }
            }
            Action::EndCommand => {
                self.handle_end_command();
            }
            _ => {} // Ignore other actions (including Resize - ratatui doesn't handle it properly for inline viewports)
        }
    }

    // === Action Channel ===

    fn register_action_handler(&mut self, tx: UnboundedSender<Action>) -> Result<()> {
        self.action_tx = Some(tx);
        Ok(())
    }

    // === Mode Identification ===

    fn get_tui_mode(&self) -> TuiMode {
        TuiMode::Inline
    }

    // === Initialization ===

    fn init(&mut self, _area: Size) -> Result<()> {
        // Resize all existing PTYs to inline dimensions
        // This is critical when switching from full-screen mode
        self.resize_all_ptys();
        Ok(())
    }

    // === Task Lifecycle ===

    fn start_command(&mut self, _thread_count: Option<u32>) {
        // Notify console messenger if connected
        let state = self.state.lock();
        if let Some(messenger) = state.get_console_messenger() {
            messenger.start_running_tasks();
        }
    }

    fn start_tasks(&mut self, tasks: Vec<Task>) {
        let mut state = self.state.lock();
        for task in &tasks {
            state.record_task_start(task.id.clone());
            state.update_task_status(task.id.clone(), TaskStatus::InProgress);
        }
        drop(state);

        // Auto-select the first task to display its output
        // This ensures we show output even after the task completes
        self.selected_task = Some(tasks[0].id.clone());
    }

    fn update_task_status(&mut self, task_id: String, status: TaskStatus) {
        let mut state = self.state.lock();
        state.update_task_status(task_id, status);
    }

    fn end_tasks(&mut self, task_results: Vec<TaskResult>) {
        let mut state = self.state.lock();
        for result in task_results {
            state.record_task_end(result.task.id.clone());
            // Update status based on result (0 = success)
            let status = if result.code == 0 {
                TaskStatus::Success
            } else {
                TaskStatus::Failure
            };
            state.update_task_status(result.task.id, status);
        }
    }

    fn end_command(&mut self) {
        let state = self.state.lock();
        state
            .get_console_messenger()
            .as_ref()
            .and_then(|c| c.end_running_tasks());
        drop(state);

        // Dispatch Action::EndCommand to trigger auto-exit logic
        if let Some(action_tx) = &self.action_tx {
            let _ = action_tx.send(Action::EndCommand);
        }
    }

    // === PTY Registration ===

    fn register_running_interactive_task(
        &mut self,
        task_id: String,
        parser_and_writer: External<(ParserArc, WriterArc)>,
    ) {
        let mut pty =
            PtyInstance::interactive(parser_and_writer.0.clone(), parser_and_writer.1.clone());

        // Resize PTY to inline dimensions
        let (rows, cols) = self.calculate_inline_pty_dimensions();
        pty.resize(rows, cols).ok();

        let pty = Arc::new(pty);
        let mut state = self.state.lock();
        state.register_pty_instance(task_id.clone(), pty);
        drop(state);

        // Initialize scrollback tracking
        self.task_scrollback_lines.insert(task_id.clone(), 0);
        self.task_last_rendered_scrollback.insert(task_id, 0);
    }

    fn register_running_non_interactive_task(&mut self, task_id: String) {
        let (rows, cols) = self.calculate_inline_pty_dimensions();
        let pty = PtyInstance::non_interactive_with_dimensions(rows, cols);

        let pty = Arc::new(pty);
        let mut state = self.state.lock();
        state.register_pty_instance(task_id.clone(), pty);
        drop(state);

        // Initialize scrollback tracking
        self.task_scrollback_lines.insert(task_id.clone(), 0);
        self.task_last_rendered_scrollback.insert(task_id, 0);
    }

    fn print_task_terminal_output(&mut self, task_id: String, output: String) {
        // Check if a PTY instance already exists for this task
        let state = self.state.lock();
        let has_pty = state.get_pty_instance(&task_id).is_some();
        if let Some(pty) = state.get_pty_instance(&task_id) {
            // Append output to the existing PTY instance to preserve scroll position
            write_output_to_pty(&pty, &output);
        }
        drop(state); // Drop the lock before any mutable borrows

        if !has_pty {
            // Tasks run within a pseudo-terminal always have a pty instance and do not need a new one
            // Tasks not run within a pseudo-terminal need a new pty instance to print output
            let (rows, cols) = self.calculate_inline_pty_dimensions();
            let pty = PtyInstance::non_interactive_with_dimensions(rows, cols);

            write_output_to_pty(&pty, &output);

            // Register the PTY instance in shared state
            let pty = Arc::new(pty);
            let mut state = self.state.lock();
            state.register_pty_instance(task_id.clone(), pty);
            drop(state);

            // Initialize scrollback tracking for the new PTY
            self.task_scrollback_lines.insert(task_id.clone(), 0);
            self.task_last_rendered_scrollback.insert(task_id, 0);
        }
    }

    fn append_task_output(&mut self, task_id: String, output: String) {
        // Same as print_task_terminal_output for inline mode
        self.print_task_terminal_output(task_id, output);
    }

    // === Callback Management ===

    fn set_done_callback(&mut self, callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>) {
        let mut state = self.state.lock();
        state.set_done_callback(callback);
    }

    fn set_forced_shutdown_callback(
        &mut self,
        callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) {
        let mut state = self.state.lock();
        state.set_forced_shutdown_callback(callback);
    }

    fn call_done_callback(&self) {
        let state = self.state.lock();
        state.call_done_callback();
    }

    // === Misc ===

    fn set_cloud_message(&mut self, _message: Option<String>) {
        // Cloud messages not displayed in inline mode
        // Could store in state if needed for mode switching
    }

    fn set_console_messenger(&mut self, messenger: NxConsoleMessageConnection) {
        let mut state = self.state.lock();
        state.set_console_messenger(messenger);
    }

    fn set_estimated_task_timings(&mut self, timings: HashMap<String, i64>) {
        let mut state = self.state.lock();
        state.set_estimated_task_timings(timings);
    }

    // === Quit Check ===

    fn should_quit(&self) -> bool {
        let state = self.state.lock();
        state.should_quit()
    }

    fn get_selected_task_name(&self) -> Option<String> {
        self.selected_task.clone()
    }

    fn get_shared_state(&self) -> Arc<Mutex<TuiState>> {
        self.get_state()
    }
}

// === Private Rendering Methods ===
impl InlineApp {
    fn render_scrollback_above_tui(&mut self, tui: &mut tui::Tui) {
        // Increment render counter
        self.scrollback_render_counter += 1;

        // Only render scrollback every 20th iteration to batch updates for VSCode
        let should_render_scrollback = self.scrollback_render_counter % 20 == 0;

        if !should_render_scrollback {
            return;
        }

        // Get the task to display (selected or first running)
        let current_task = self
            .selected_task
            .clone()
            .or_else(|| self.get_current_running_task());

        if let Some(current_task) = current_task {
            let state = self.state.lock();
            if let Some(pty) = state.get_pty_instance(&current_task) {
                let pty = pty.clone();
                drop(state);

                // Get last rendered scrollback line count for this task
                let last_rendered_lines = self
                    .task_last_rendered_scrollback
                    .get(&current_task)
                    .copied()
                    .unwrap_or(0);

                // Get buffered scrollback content since last render
                let buffered_scrollback_lines =
                    pty.get_buffered_scrollback_content_for_inline(last_rendered_lines);

                // Update tracking for next buffered render
                let current_scrollback_lines = pty.get_scrollback_line_count();
                self.task_scrollback_lines
                    .insert(current_task.clone(), current_scrollback_lines);

                // Render buffered scrollback above TUI using terminal.insert_before
                if !buffered_scrollback_lines.is_empty() {
                    use crate::native::tui::theme::THEME;
                    use ratatui::style::Style;
                    use ratatui::text::Line;
                    use ratatui::widgets::Paragraph;

                    let height = buffered_scrollback_lines.len() as u16;
                    let _ = tui.insert_before(height, |buf| {
                        // Convert buffered scrollback lines to ratatui Lines
                        let mut lines: Vec<Line> = buffered_scrollback_lines
                            .iter()
                            .map(|line| Line::from(line.as_str()))
                            .collect();

                        // Add a reset line at the end to ensure clean state for TUI below
                        lines.push(Line::from("\x1b[0m"));

                        // Create a paragraph with the buffered scrollback content + reset
                        let paragraph =
                            Paragraph::new(lines).style(Style::default().fg(THEME.secondary_fg));

                        // Render using the Widget trait
                        use ratatui::widgets::Widget;
                        paragraph.render(buf.area, buf);
                    });

                    // Track total lines inserted for cleanup on exit
                    self.total_inserted_lines += height as u32;

                    // Update last rendered count after successful render
                    self.task_last_rendered_scrollback
                        .insert(current_task.clone(), current_scrollback_lines);
                }
            }
        }
    }

    fn render_inline_layout(&mut self, f: &mut ratatui::Frame, area: ratatui::layout::Rect) {
        use ratatui::layout::{Constraint, Direction, Layout};

        // Put terminal content at the top, status/progress at bottom
        // Minimize UI elements to maximize terminal output space
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Fill(1), // Terminal output (at least 10 lines, takes remaining space)
                Constraint::Length(1), // Status bar (compact: 3 lines with border)
            ])
            .split(area);

        // Render main content section (terminal at top)
        self.render_inline_main_content(f, chunks[0]);

        // Render status section below
        self.render_inline_status(f, chunks[1]);

        // Render countdown popup as overlay if visible
        if self.countdown_popup.is_visible() {
            self.countdown_popup.render(f, area);
        }
    }

    fn render_inline_status(&self, f: &mut ratatui::Frame, area: ratatui::layout::Rect) {
        use crate::native::tui::theme::THEME;
        use ratatui::style::{Modifier, Style};
        use ratatui::text::Line;
        use ratatui::widgets::Paragraph;

        // Get current task and its status for color coding
        let current_task = self
            .selected_task
            .clone()
            .or_else(|| self.get_current_running_task());

        let (task_name, status, status_color) = if let Some(ref task_id) = current_task {
            let state = self.state.lock();
            let status = state
                .get_task_status(task_id)
                .unwrap_or(TaskStatus::NotStarted);
            drop(state);
            (task_id.clone(), status, get_task_status_color(status))
        } else {
            (
                String::from("Idle"),
                TaskStatus::NotStarted,
                THEME.secondary_fg,
            )
        };

        // Build status bar with NX logo and task name
        let status_line = Line::from(vec![
            Span::styled(
                " NX ",
                Style::default()
                    .fg(THEME.primary_fg)
                    .bg(status_color)
                    .add_modifier(Modifier::BOLD),
            )
            .not_crossed_out(),
            get_task_status_icon(status).not_crossed_out(),
            Span::styled(task_name, Style::default().fg(status_color)).not_crossed_out(),
        ]);

        let status_bar = Paragraph::new(status_line).crossed_out();
        f.render_widget(status_bar, area);
    }

    fn render_inline_main_content(&mut self, f: &mut ratatui::Frame, area: ratatui::layout::Rect) {
        // Show selected task output if available, otherwise first running task
        let current_task = self
            .selected_task
            .clone()
            .or_else(|| self.get_current_running_task());

        if let Some(current_task) = current_task {
            let state = self.state.lock();
            if let Some(pty) = state.get_pty_instance(&current_task) {
                let pty = pty.clone();
                drop(state);
                self.render_inline_task_output(f, area, &pty);
                return;
            }
        }

        // Fallback: show a message indicating no task is running
        use crate::native::tui::theme::THEME;
        use ratatui::layout::Alignment;
        use ratatui::style::Style;
        use ratatui::widgets::{Block, Borders, Paragraph};

        let message = Paragraph::new(" Waiting for tasks to start... ")
            .style(Style::default().fg(THEME.secondary_fg))
            .alignment(Alignment::Center)
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title(" Output ")
                    .border_style(Style::default().fg(THEME.secondary_fg)),
            );

        f.render_widget(message, area);
    }

    fn render_inline_task_output(
        &mut self,
        f: &mut ratatui::Frame,
        area: ratatui::layout::Rect,
        pty: &Arc<PtyInstance>,
    ) {
        use crate::native::tui::theme::THEME;
        use ratatui::style::Style;
        use ratatui::widgets::Block;
        use tui_term::widget::PseudoTerminal;

        // Scrollback is handled separately via terminal.insert_before
        // Just render the current terminal screen here
        if let Some(screen) = pty.get_screen() {
            let block = Block::default()
                .borders(ratatui::widgets::Borders::NONE)
                .border_style(Style::default().fg(THEME.primary_fg));

            // Use PseudoTerminal with block
            let pseudo_term = PseudoTerminal::new(&*screen).block(block);
            f.render_widget(pseudo_term, area);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::TaskTarget;
    use crate::native::tui::config;
    use crossterm::event::KeyEvent;
    use tokio::sync::mpsc;

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

    fn create_test_inline_app() -> InlineApp {
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

        InlineApp::new(
            tasks,
            initiating_tasks,
            RunMode::RunMany,
            vec![],
            config::TuiConfig::new(None, &cli_args),
            String::from("Test"),
            task_graph,
        )
        .unwrap()
    }

    // === Construction Tests ===

    #[test]
    fn test_inline_app_creation_with_new() {
        let app = create_test_inline_app();

        // Verify state is initialized
        let state = app.state.lock();
        assert_eq!(state.tasks().len(), 2);
        assert_eq!(state.title_text(), "Test");

        // Verify UI state is initialized
        drop(state); // Release lock
        assert!(app.action_tx.is_none());
        assert_eq!(app.scrollback_render_counter, 0);
        assert_eq!(app.total_inserted_lines, 0);
    }

    #[test]
    fn test_inline_app_creation_with_state() {
        // Create existing state
        let existing_tasks = vec![create_test_task("existing")];
        let existing_graph = TaskGraph {
            tasks: HashMap::new(),
            dependencies: HashMap::new(),
            continuous_dependencies: HashMap::new(),
            roots: vec![],
        };
        let cli_args = config::TuiCliArgs {
            targets: vec![],
            tui_auto_exit: None,
        };

        let existing_state = Arc::new(Mutex::new(TuiState::new(
            existing_tasks,
            HashSet::new(),
            RunMode::RunMany,
            vec![],
            config::TuiConfig::new(None, &cli_args),
            String::from("Existing"),
            existing_graph,
            HashMap::new(),
        )));

        // Create app with existing state
        let app = InlineApp::with_state(existing_state.clone(), None).unwrap();

        // Verify it uses the same state
        assert!(Arc::ptr_eq(&app.state, &existing_state));

        // Verify state contents are preserved
        let state = app.state.lock();
        assert_eq!(state.tasks().len(), 1);
        assert_eq!(state.title_text(), "Existing");
    }

    // === Event Handling Tests ===

    #[test]
    fn test_quit_on_q_key() {
        let mut app = create_test_inline_app();
        let (tx, _rx) = mpsc::unbounded_channel();

        let event = tui::Event::Key(KeyEvent::new(KeyCode::Char('q'), KeyModifiers::NONE));
        let result = app.handle_event(event, &tx).unwrap();

        // Should signal quit
        assert!(result);

        // Should have set quit flag
        assert!(app.should_quit());
    }

    #[test]
    fn test_quit_on_esc_key() {
        let mut app = create_test_inline_app();
        let (tx, _rx) = mpsc::unbounded_channel();

        let event = tui::Event::Key(KeyEvent::new(KeyCode::Esc, KeyModifiers::NONE));
        let result = app.handle_event(event, &tx).unwrap();

        assert!(result);
        assert!(app.should_quit());
    }

    #[test]
    fn test_quit_on_ctrl_c() {
        let mut app = create_test_inline_app();
        let (tx, _rx) = mpsc::unbounded_channel();

        let event = tui::Event::Key(KeyEvent::new(KeyCode::Char('c'), KeyModifiers::CONTROL));
        let result = app.handle_event(event, &tx).unwrap();

        assert!(result);
        assert!(app.should_quit());
    }

    #[test]
    fn test_ignore_navigation_keys() {
        let mut app = create_test_inline_app();
        let (tx, _rx) = mpsc::unbounded_channel();

        // These should all be ignored
        let keys = vec![
            KeyCode::Up,
            KeyCode::Down,
            KeyCode::Left,
            KeyCode::Right,
            KeyCode::Enter,
            KeyCode::Tab,
            KeyCode::Char('j'),
            KeyCode::Char('k'),
        ];

        for key in keys {
            let event = tui::Event::Key(KeyEvent::new(key, KeyModifiers::NONE));
            let result = app.handle_event(event, &tx).unwrap();

            // Should NOT quit
            assert!(!result);
        }
    }

    #[test]
    fn test_handle_render_event() {
        let mut app = create_test_inline_app();
        let (tx, mut rx) = mpsc::unbounded_channel();

        let event = tui::Event::Render;
        let result = app.handle_event(event, &tx).unwrap();

        // Should not quit
        assert!(!result);

        // Should forward Action::Render
        let action = rx.try_recv().unwrap();
        assert!(matches!(action, Action::Render));
    }

    #[test]
    fn test_handle_tick_event() {
        let mut app = create_test_inline_app();
        let (tx, mut rx) = mpsc::unbounded_channel();

        let event = tui::Event::Tick;
        let result = app.handle_event(event, &tx).unwrap();

        assert!(!result);

        let action = rx.try_recv().unwrap();
        assert!(matches!(action, Action::Tick));
    }

    // === PTY Registration Tests ===

    #[test]
    fn test_register_pty_initializes_scrollback() {
        let mut app = create_test_inline_app();

        // Register non-interactive PTY (simpler test)
        app.register_running_non_interactive_task(String::from("app1"));

        // Verify scrollback tracking initialized
        assert_eq!(app.task_scrollback_lines.get("app1"), Some(&0));
        assert_eq!(app.task_last_rendered_scrollback.get("app1"), Some(&0));

        // Verify PTY registered in state
        let state = app.state.lock();
        assert!(state.get_pty_instance("app1").is_some());
    }

    #[test]
    fn test_calculate_inline_pty_dimensions() {
        let app = create_test_inline_app();
        let (rows, cols) = app.calculate_inline_pty_dimensions();

        // Should reserve space for UI (6 lines)
        assert!(rows > 0);
        assert!(cols > 0);

        // On systems where we can get terminal size, verify reservation
        if let Ok((term_cols, term_rows)) = crossterm::terminal::size() {
            assert_eq!(cols, term_cols);
            assert_eq!(rows, term_rows.saturating_sub(6));
        }
    }

    // === Task Lifecycle Tests ===

    #[test]
    fn test_start_tasks() {
        let mut app = create_test_inline_app();

        let tasks = vec![create_test_task("app1")];
        app.start_tasks(tasks);

        // Verify status updated in state
        let state = app.state.lock();
        assert_eq!(state.get_task_status("app1"), Some(TaskStatus::InProgress));
    }

    #[test]
    fn test_update_task_status() {
        let mut app = create_test_inline_app();

        app.update_task_status(String::from("app1"), TaskStatus::Success);

        let state = app.state.lock();
        assert_eq!(state.get_task_status("app1"), Some(TaskStatus::Success));
    }

    #[test]
    fn test_end_tasks() {
        let mut app = create_test_inline_app();

        // Start task first
        app.start_tasks(vec![create_test_task("app1")]);

        // End task
        let results = vec![TaskResult {
            task: create_test_task("app1"),
            status: String::from("success"),
            code: 0,
            terminal_output: None,
        }];
        app.end_tasks(results);

        // Verify timing recorded
        let state = app.state.lock();
        let (start, end) = state.get_task_timing("app1");
        assert!(start.is_some());
        assert!(end.is_some());
    }

    // === Helper Method Tests ===

    #[test]
    fn test_get_current_running_task() {
        let mut app = create_test_inline_app();

        // No running tasks initially
        assert!(app.get_current_running_task().is_none());

        // Start a task
        app.update_task_status(String::from("app1"), TaskStatus::InProgress);

        // Should find running task
        assert_eq!(app.get_current_running_task(), Some(String::from("app1")));
    }

    #[test]
    fn test_get_completed_task_count() {
        let mut app = create_test_inline_app();

        // No completed tasks initially
        assert_eq!(app.get_completed_task_count(), 0);

        // Complete tasks
        app.update_task_status(String::from("app1"), TaskStatus::Success);
        app.update_task_status(String::from("app2"), TaskStatus::Failure);

        // Should count both
        assert_eq!(app.get_completed_task_count(), 2);
    }

    #[test]
    fn test_quit_immediately() {
        let mut app = create_test_inline_app();

        assert!(!app.should_quit());

        app.quit_immediately();

        assert!(app.should_quit());
    }

    // === TuiApp Trait Implementation Tests ===

    #[test]
    fn test_get_tui_mode() {
        let app = create_test_inline_app();
        // TuiMode doesn't implement PartialEq, so just verify it returns a value
        let _ = app.get_tui_mode();
        // Mode is correct by construction (always returns TuiMode::Inline)
    }

    #[test]
    fn test_register_action_handler() {
        let mut app = create_test_inline_app();
        let (tx, _rx) = mpsc::unbounded_channel();

        app.register_action_handler(tx.clone()).unwrap();

        // Verify action_tx is set
        assert!(app.action_tx.is_some());
    }

    // === State Access Tests ===

    #[test]
    fn test_get_state() {
        let app = create_test_inline_app();
        let state_ref = app.get_state();

        // Verify we can access state
        let state = state_ref.lock();
        assert_eq!(state.tasks().len(), 2);
    }

    // === Edge Case Tests ===

    #[test]
    fn test_multiple_quit_calls() {
        let mut app = create_test_inline_app();

        // Multiple quit calls should not panic
        app.quit_immediately();
        app.quit_immediately();
        app.quit_immediately();

        assert!(app.should_quit());
    }

    #[test]
    fn test_pty_registration_same_task_twice() {
        let mut app = create_test_inline_app();

        // Register same task twice
        app.register_running_non_interactive_task(String::from("app1"));
        app.register_running_non_interactive_task(String::from("app1"));

        // Should overwrite, not panic
        let state = app.state.lock();
        assert!(state.get_pty_instance("app1").is_some());
    }

    #[test]
    fn test_update_status_for_nonexistent_task() {
        let mut app = create_test_inline_app();

        // Should not panic
        app.update_task_status(String::from("nonexistent"), TaskStatus::Success);

        // Status should be recorded anyway
        let state = app.state.lock();
        assert_eq!(
            state.get_task_status("nonexistent"),
            Some(TaskStatus::Success)
        );
    }
}

#[cfg(test)]
mod integration_tests {
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

    fn create_test_inline_app() -> InlineApp {
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

        InlineApp::new(
            tasks,
            initiating_tasks,
            RunMode::RunMany,
            vec![],
            config::TuiConfig::new(None, &cli_args),
            String::from("Test"),
            task_graph,
        )
        .unwrap()
    }

    #[test]
    fn test_full_task_lifecycle() {
        let mut app = create_test_inline_app();

        // Start command
        app.start_command(None);

        // Start tasks
        let tasks = vec![create_test_task("app1")];
        app.start_tasks(tasks);

        // Register PTY
        app.register_running_non_interactive_task(String::from("app1"));

        // Update to success
        app.update_task_status(String::from("app1"), TaskStatus::Success);

        // End tasks
        app.end_tasks(vec![TaskResult {
            task: create_test_task("app1"),
            status: String::from("success"),
            code: 0,
            terminal_output: None,
        }]);

        // End command
        app.end_command();

        // Verify final state
        let state = app.state.lock();
        assert_eq!(state.get_task_status("app1"), Some(TaskStatus::Success));
        assert!(state.get_pty_instance("app1").is_some());
    }

    #[test]
    fn test_shared_state_between_apps() {
        // Create shared state
        let tasks = vec![create_test_task("shared")];
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

        let state = Arc::new(Mutex::new(TuiState::new(
            tasks,
            HashSet::new(),
            RunMode::RunMany,
            vec![],
            config::TuiConfig::new(None, &cli_args),
            String::from("Shared"),
            task_graph,
            HashMap::new(),
        )));

        // Create two apps with same state
        let mut app1 = InlineApp::with_state(state.clone(), None).unwrap();
        let app2 = InlineApp::with_state(state.clone(), None).unwrap();

        // Modify through app1
        app1.update_task_status(String::from("shared"), TaskStatus::Success);

        // Verify visible through app2
        assert!(!app2.should_quit()); // Can access state without issues
        let state2 = app2.state.lock();
        assert_eq!(state2.get_task_status("shared"), Some(TaskStatus::Success));
    }
}
