use arboard::Clipboard;
use color_eyre::eyre::Result;
use crossterm::event::{KeyCode, KeyModifiers};
use hashbrown::HashSet;
use napi::bindgen_prelude::External;
use parking_lot::Mutex;
use ratatui::layout::{Constraint, Direction, Layout, Size};
use ratatui::style::Modifier;
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::mpsc::UnboundedSender;
use tracing::debug;

/// Duration before status messages are automatically cleared
const STATUS_MESSAGE_DURATION: std::time::Duration = std::time::Duration::from_secs(3);

use crate::native::tui::utils::{
    calculate_actual_duration_ms, format_duration_with_estimate, get_task_status_style,
};
use crate::native::{
    pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc},
    tasks::types::{Task, TaskGraph},
};

use super::action::Action;
use super::components::countdown_popup::CountdownPopup;
use super::components::task_selection_manager::SelectionEntry;
use super::components::tasks_list::TaskStatus;
use super::config::TuiConfig;
use super::lifecycle::{BatchStatus, RunMode, TuiMode};
use super::pty::PtyInstance;
use super::tui;
use super::tui_app::TuiApp;
use super::tui_core::{AutoExitDecision, QuitDecision, TuiCore};
use super::tui_state::TuiState;
use super::utils::get_task_status_icon;

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
    // === Shared Core ===
    /// Shared core functionality (state management, callbacks, etc.)
    core: TuiCore,

    // === Inline UI State ===
    /// The item (task or batch) whose output should be displayed (required for inline mode)
    /// This is set during mode switching or defaults to the first running item
    selected_item: Option<SelectionEntry>,
    /// Countdown popup for auto-exit (shared with full-screen mode)
    countdown_popup: CountdownPopup,
    /// Whether we're in interactive mode (forwarding keys to PTY)
    is_interactive: bool,

    // === Scrollback Rendering ===
    /// Track scrollback line count per task for incremental rendering
    task_scrollback_lines: HashMap<String, usize>,
    /// Track last rendered scrollback lines per task for buffered rendering
    task_last_rendered_scrollback: HashMap<String, usize>,
    /// Counter for buffering scrollback renders (render every 20th iteration)
    scrollback_render_counter: u32,
    /// Total lines inserted above TUI (for cleanup on exit)
    total_inserted_lines: u32,
    /// Status message to display in the bottom chrome (e.g., "Output copied")
    status_message: Option<(String, Instant)>,
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
            None,
        )));

        Ok(Self {
            core: TuiCore::new(state),
            selected_item: None, // Will auto-select first running item on render
            countdown_popup: CountdownPopup::new(),
            is_interactive: false,
            task_scrollback_lines: HashMap::new(),
            task_last_rendered_scrollback: HashMap::new(),
            scrollback_render_counter: 0,
            total_inserted_lines: 0,
            status_message: None,
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
    /// * `selected_item` - Optional item (task or batch) to display (from full-screen selection)
    pub fn with_state(
        state: Arc<Mutex<TuiState>>,
        selected_item: Option<SelectionEntry>,
    ) -> Result<Self> {
        Ok(Self {
            core: TuiCore::new(state),
            selected_item, // Use the provided selection from mode switch
            countdown_popup: CountdownPopup::new(),
            is_interactive: false, // Always start non-interactive when switching modes
            // Reset all scrollback tracking when mode switching
            // PTYs will be resized in init(), which changes scrollback calculations
            task_scrollback_lines: HashMap::new(),
            task_last_rendered_scrollback: HashMap::new(),
            // Start at 19 so the first render (increment to 20) will trigger scrollback rendering
            // This ensures existing PTY content from full-screen mode is immediately displayed
            scrollback_render_counter: 19,
            total_inserted_lines: 0,
            status_message: None,
        })
    }

    /// Get reference to the shared state (for mode switching)
    ///
    /// Returns an Arc clone, which is cheap (just increments ref count).
    pub fn get_state(&self) -> Arc<Mutex<TuiState>> {
        self.core.state().clone()
    }

    // === Helper Methods ===

    /// Immediately set quit flag in shared state
    fn quit_immediately(&mut self) {
        self.core.quit_immediately();
    }

    /// Get the ID of the currently running item (task or batch, if any)
    fn get_current_running_item(&self) -> Option<String> {
        self.core.state().lock().get_current_running_item()
    }

    /// Internal method to handle Action::EndCommand
    fn handle_end_command(&mut self) {
        // Use TuiCore to determine auto-exit behavior
        match self.core.get_auto_exit_decision() {
            AutoExitDecision::Stay | AutoExitDecision::StayWithFailures(_) => {
                // User interacted, auto-exit disabled, or failures present - do nothing
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
        self.quit_immediately();
    }

    fn begin_exit_countdown(&mut self) {
        let Some(countdown_duration) = self.core.get_countdown_duration() else {
            self.quit();
            return;
        };

        self.countdown_popup.start_countdown(countdown_duration);
        self.core
            .schedule_quit(std::time::Duration::from_secs(countdown_duration));
    }

    /// Resize all PTY instances to match current inline dimensions
    ///
    /// Called when switching to inline mode via init().
    /// This ensures PTY output fits the available space, pushing excess content
    /// into scrollback.
    fn resize_selected_pty(&mut self, terminal_dimensions: (u16, u16)) -> Option<()> {
        let (rows, cols) = terminal_dimensions;
        let mut state = self.core.state().lock();

        let task_id = self.selected_item.as_ref()?.id();
        let pty_arc = state.get_pty_instance(task_id)?;
        let (current_rows, current_cols) = pty_arc.get_dimensions();

        // Only resize if dimensions actually changed
        if current_rows != rows || current_cols != cols {
            tracing::trace!(
                "InlineApp resizing PTY for {} from {}x{} to {}x{}",
                task_id,
                current_cols,
                current_rows,
                cols,
                rows
            );

            // Clone the PTY instance, resize it, and replace the Arc
            let mut pty_clone = pty_arc.as_ref().clone();
            if pty_clone.resize(rows, cols).is_ok() {
                state.register_pty_instance(task_id.to_string(), Arc::new(pty_clone));
            }
        }

        Some(())
    }

    fn dispatch_action(&self, action: Action) {
        self.core.dispatch_action(action);
    }

    // === Interactive Mode Methods ===
    // can_be_interactive() uses the trait default implementation from TuiApp

    /// Enter interactive mode
    fn enter_interactive_mode(&mut self) {
        self.is_interactive = true;
        debug!("Entered interactive mode");
    }

    /// Exit interactive mode
    fn exit_interactive_mode(&mut self) {
        self.is_interactive = false;
        debug!("Exited interactive mode");
    }

    /// Show a hint message in the status bar (replaces hint popup in inline mode)
    fn show_hint(&mut self, message: impl Into<String>) {
        // Check if hints are suppressed
        let suppress_hints = self.core.state().lock().tui_config().suppress_hints;
        if !suppress_hints {
            self.status_message = Some((message.into(), Instant::now()));
        }
    }

    /// Handle keyboard input in interactive mode - forward to PTY
    fn handle_interactive_key(&mut self, key: crossterm::event::KeyEvent) -> Result<()> {
        let task_id = self
            .selected_item
            .as_ref()
            .map(|s| s.id().to_string())
            .or_else(|| self.get_current_running_item());

        let Some(task_id) = task_id else {
            return Ok(());
        };

        let state = self.core.state().lock();
        let Some(pty) = state.get_pty_instance(&task_id) else {
            return Ok(());
        };

        // Clone the PTY to work with it outside the lock
        let mut pty_clone = pty.as_ref().clone();
        drop(state);

        match key.code {
            KeyCode::Char(c) if key.modifiers.contains(KeyModifiers::CONTROL) => {
                // Convert Ctrl+letter to ASCII control code (Ctrl+A = 0x01, Ctrl+C = 0x03, etc.)
                let ascii_code = (c as u8).wrapping_sub(0x60);
                debug!("Sending control code: {:?}", &[ascii_code]);
                pty_clone.write_input(&[ascii_code])?;
            }
            KeyCode::Char(c) => {
                pty_clone.write_input(c.to_string().as_bytes())?;
            }
            KeyCode::Up | KeyCode::Down => {
                pty_clone.handle_arrow_keys(key);
            }
            KeyCode::Enter => {
                pty_clone.write_input(b"\r")?;
            }
            KeyCode::Esc => {
                pty_clone.write_input(&[0x1b])?;
            }
            KeyCode::Backspace => {
                pty_clone.write_input(&[0x7f])?;
            }
            KeyCode::Tab => {
                pty_clone.write_input(b"\t")?;
            }
            KeyCode::Left => {
                pty_clone.write_input(b"\x1b[D")?;
            }
            KeyCode::Right => {
                pty_clone.write_input(b"\x1b[C")?;
            }
            KeyCode::Home => {
                pty_clone.write_input(b"\x1b[H")?;
            }
            KeyCode::End => {
                pty_clone.write_input(b"\x1b[F")?;
            }
            KeyCode::Delete => {
                pty_clone.write_input(b"\x1b[3~")?;
            }
            _ => {}
        }

        Ok(())
    }
}

impl TuiApp for InlineApp {
    // === Core Access ===

    fn core(&self) -> &TuiCore {
        &self.core
    }

    fn core_mut(&mut self) -> &mut TuiCore {
        &mut self.core
    }

    // === Event Handling ===

    fn handle_event(
        &mut self,
        event: tui::Event,
        action_tx: &UnboundedSender<Action>,
    ) -> Result<bool> {
        match event {
            tui::Event::Quit => {
                self.quit_immediately();
                return Ok(false);
            }
            tui::Event::Key(key) => {
                // If countdown popup is visible, handle countdown-specific keys
                if self.countdown_popup.is_visible() {
                    match key.code {
                        KeyCode::Char('q') => {
                            // Quit immediately on 'q' when countdown is active
                            self.quit_immediately();
                            return Ok(false);
                        }
                        KeyCode::Char('c') if key.modifiers == KeyModifiers::CONTROL => {
                            // Quit immediately on Ctrl+C
                            self.quit_immediately();
                            return Ok(false);
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
                            self.core.cancel_quit();
                            return Ok(false);
                        }
                    }
                }

                // === Interactive Mode Handling ===
                // When in interactive mode, Ctrl+Z exits, all other keys go to PTY
                if self.is_interactive {
                    // Ctrl+Z exits interactive mode
                    if matches!(key.code, KeyCode::Char('z'))
                        && key.modifiers == KeyModifiers::CONTROL
                    {
                        self.exit_interactive_mode();
                        return Ok(false);
                    }

                    // Forward all other keys to the PTY
                    self.handle_interactive_key(key).ok();
                    return Ok(false);
                }

                // === Non-Interactive Mode Handling ===

                // 'i' enters interactive mode if task supports it
                if matches!(key.code, KeyCode::Char('i')) && key.modifiers.is_empty() {
                    if self.can_be_interactive() {
                        self.enter_interactive_mode();
                    } else {
                        self.show_hint("This task does not support interactive mode. Only in-progress tasks that accept input can be interactive.");
                    }
                    return Ok(false);
                }

                if matches!(key.code, KeyCode::Char('q')) && key.modifiers.is_empty() {
                    // Use TuiCore to handle quit request (sets forced_shutdown, checks completion)
                    if self.core.handle_quit_request() == QuitDecision::StartCountdown {
                        self.begin_exit_countdown();
                    }
                    return Ok(false);
                }

                if matches!(key.code, KeyCode::Char('c')) && key.modifiers == KeyModifiers::CONTROL
                {
                    // Use TuiCore to handle Ctrl+C (end command, set forced shutdown, quit)
                    self.core.handle_ctrl_c();
                    return Ok(false);
                }

                if matches!(key.code, KeyCode::F(12)) {
                    // Toggle debug mode on F12
                    self.dispatch_action(Action::ToggleDebugMode);
                    return Ok(false);
                }

                // F11 toggles between inline and full-screen mode
                if matches!(key.code, KeyCode::F(11)) {
                    self.dispatch_action(Action::SwitchMode(TuiMode::FullScreen));
                    return Ok(false);
                }

                // ESC switches to full-screen mode (not quit like in countdown popup)
                if matches!(key.code, KeyCode::Esc) {
                    self.dispatch_action(Action::SwitchMode(TuiMode::FullScreen));
                    return Ok(false);
                }

                // Handle 'c' for copying terminal output to clipboard (same as full-screen mode)
                if matches!(key.code, KeyCode::Char('c')) && key.modifiers.is_empty() {
                    // Get the task to display (selected or first running)
                    let task_id = self
                        .selected_item
                        .as_ref()
                        .map(|s| s.id().to_string())
                        .or_else(|| self.get_current_running_item());

                    if let Some(task_id) = task_id {
                        let state = self.core.state().lock();
                        if let Some(pty) = state.get_pty_instance(&task_id) {
                            if let Some(screen) = pty.get_screen() {
                                // Unformatted output (no ANSI escape codes)
                                let output = screen.all_contents();
                                drop(state); // Release lock before clipboard operations
                                if let Ok(mut clipboard) = Clipboard::new() {
                                    if clipboard.set_text(output).is_ok() {
                                        // Show status message in bottom chrome
                                        self.status_message =
                                            Some((String::from("Output copied"), Instant::now()));
                                    }
                                }
                            }
                        }
                    }
                    return Ok(false);
                }

                let unhandled_key_message = if self.can_be_interactive() {
                    "This key is not handled by the TUI. To send input to the terminal, press 'i' to enter interactive mode."
                } else {
                    "This key is not handled by the TUI."
                };

                self.show_hint(unhandled_key_message);
                return Ok(false);
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
            Action::Tick => {
                // Clear expired status messages
                if let Some((_, shown_at)) = &self.status_message {
                    if shown_at.elapsed() > STATUS_MESSAGE_DURATION {
                        self.status_message = None;
                    }
                }
            }
            Action::Render => {
                // Render scrollback content above the TUI using insert_before
                self.render_scrollback_above_tui(tui);

                // Draw the inline TUI layout using draw_without_autoresize
                // This avoids cursor position queries that conflict with EventStream.
                // Normal tui.draw() calls autoresize() which queries cursor position,
                // causing hangs when EventStream is also reading from stdin.
                tui.draw_without_autoresize(|f| {
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
                let state = self.core.state().lock();
                if let Some(messenger) = state.get_console_messenger() {
                    messenger.start_running_tasks();
                }
            }
            Action::EndCommand => {
                self.handle_end_command();
            }
            Action::ShowHint(message) => {
                // In inline mode, show hints in the status bar instead of a popup
                self.show_hint(message);
            }
            Action::Resize(w, h) => {
                // Resize the PTY to match the new terminal dimensions
                self.resize_selected_pty((h, w));
                self.core.state().lock().set_dimensions((w, h));
            }
            _ => {} // Ignore other actions
        }
    }

    // === Mode Identification ===

    fn get_tui_mode(&self) -> TuiMode {
        TuiMode::Inline
    }

    // === Initialization ===

    fn init(&mut self, area: Size) -> Result<()> {
        // Resize all existing PTYs to inline dimensions
        // This is critical when switching from full-screen mode
        self.resize_selected_pty((area.height, area.width));
        self.core
            .state()
            .lock()
            .set_dimensions((area.width, area.height));
        Ok(())
    }

    // === PTY Registration (hooks for trait defaults) ===

    fn calculate_pty_dimensions(&self) -> (u16, u16) {
        let (rows, cols) = self
            .core
            .state()
            .lock()
            .get_dimensions()
            .unwrap_or_else(|| {
                // Get terminal size
                debug!("Getting terminal size for PTY dimensions inline_app");
                if let Ok((cols, rows)) = crossterm::terminal::size() {
                    (rows, cols)
                } else {
                    // Fallback to reasonable defaults
                    debug!("Failed to get terminal size, using default PTY dimensions");
                    (20, 80)
                }
            });

        // Reserves 2 rows at the bottom - one for the inline chrome,
        // one for space between terminal output and chrome.
        let content_height = rows.saturating_sub(2);
        (content_height, cols)
    }

    fn on_pty_registered(&mut self, task_id: &str) {
        // Initialize scrollback tracking for inline mode
        self.task_scrollback_lines.insert(task_id.to_string(), 0);
        self.task_last_rendered_scrollback
            .insert(task_id.to_string(), 0);
    }

    /// Override to resize interactive PTYs to inline dimensions
    ///
    /// Inline mode needs smaller PTYs to fit the compact viewport,
    /// unlike full-screen mode where interactive PTYs use their own dimensions.
    fn register_running_interactive_task(
        &mut self,
        task_id: String,
        parser_and_writer: External<(ParserArc, WriterArc)>,
    ) {
        let mut pty =
            PtyInstance::interactive(parser_and_writer.0.clone(), parser_and_writer.1.clone());

        // Resize PTY to inline dimensions (mode-specific)
        let (rows, cols) = self.calculate_pty_dimensions();
        pty.resize(rows, cols).ok();

        let pty = Arc::new(pty);
        self.state()
            .lock()
            .register_pty_instance(task_id.clone(), pty);

        // Call mode-specific hook
        self.on_pty_registered(&task_id);
    }

    // Other PTY registration methods use trait defaults

    // === Mode-specific overrides ===

    fn get_selected_item(&self) -> Option<SelectionEntry> {
        // Include fallback to first running item for inline mode
        // This ensures can_be_interactive and other trait methods work correctly
        self.selected_item.clone().or_else(|| {
            let item_id = self.get_current_running_item()?;
            let state = self.core.state().lock();
            // Check if item is a batch or a task
            if state.get_batch_metadata().contains_key(&item_id) {
                Some(SelectionEntry::BatchGroup(item_id))
            } else {
                Some(SelectionEntry::Task(item_id))
            }
        })
    }

    fn update_task_status(&mut self, task_id: String, status: TaskStatus) {
        debug!("Updating task '{}' status to {:?}", task_id, status);
        self.core.update_task_status(task_id, status);
        let can_be_interactive = self.can_be_interactive();
        if !can_be_interactive && self.is_interactive {
            // Exit interactive mode if the selected task can no longer be interactive
            self.is_interactive = false;
        }
    }

    fn end_tasks(&mut self, task_results: Vec<crate::native::tasks::types::TaskResult>) {
        debug!(
            "Ending tasks in InlineApp - {:?}. Selected task: {:?}",
            task_results
                .clone()
                .iter()
                .map(|t| &t.task.id)
                .collect::<Vec<_>>(),
            self.selected_item
        );
        self.core.end_tasks(&task_results);
        if task_results.iter().any(|t| {
            self.selected_item
                .as_ref()
                .is_some_and(|s| s.id() == t.task.id)
        }) {
            // If the selected task has completed, exit interactive mode
            self.is_interactive = false;
        }
    }

    fn set_batch_status(&mut self, batch_id: String, status: BatchStatus) {
        if batch_id.is_empty() || status == BatchStatus::Running {
            return;
        }

        debug!(
            "Updating batch '{}' status to {:?} in InlineApp",
            batch_id, status
        );

        // Get display name from batch_metadata
        let display_name = {
            let state = self.core.state().lock();
            state
                .get_batch_metadata()
                .get(&batch_id)
                .map(|b| {
                    format!(
                        "Batch: {} ({})",
                        b.info.executor_name,
                        b.info.task_ids.len()
                    )
                })
                .unwrap_or_else(|| format!("Batch: {}", batch_id))
        };

        // Update batch_metadata with completion status
        let completion_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        self.core.state().lock().complete_batch_metadata(
            &batch_id,
            status,
            display_name,
            completion_time,
        );
    }
}

// === Private Rendering Methods ===
impl InlineApp {
    fn render_scrollback_above_tui(&mut self, tui: &mut tui::Tui) {
        self.scrollback_render_counter += 1;

        // Only render scrollback every 20th iteration to batch updates for VSCode
        if self.scrollback_render_counter % 20 != 0 {
            return;
        }

        // Get the task to display (selected or first running)
        let current_task = self
            .selected_item
            .as_ref()
            .map(|s| s.id().to_string())
            .or_else(|| self.get_current_running_item());

        if let Some(ref current_task) = current_task {
            let state = self.core.state().lock();
            if let Some(pty) = state.get_pty_instance(current_task) {
                let pty = pty.clone();
                drop(state);

                // Get last rendered scrollback line count for this task
                let last_rendered_lines = self
                    .task_last_rendered_scrollback
                    .get(current_task)
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
                // Render in batches to avoid overwhelming the terminal
                if !buffered_scrollback_lines.is_empty() {
                    const MAX_LINES_PER_RENDER: usize = 250;

                    // Calculate how many lines to render this cycle
                    let lines_to_render = buffered_scrollback_lines.len().min(MAX_LINES_PER_RENDER);
                    let batch = &buffered_scrollback_lines[0..lines_to_render];

                    use crate::native::tui::theme::THEME;
                    use ratatui::style::Style;
                    use ratatui::text::Line;
                    use ratatui::widgets::Paragraph;

                    let height = lines_to_render as u16;

                    // Call insert_before on the dereferenced Terminal
                    // This only works with inline viewport
                    if let Ok(()) = tui.insert_before(height, |buf| {
                        // Convert batched scrollback lines to ratatui Lines
                        let lines: Vec<Line> =
                            batch.iter().map(|line| Line::from(line.as_str())).collect();

                        // Create a paragraph with the buffered scrollback content
                        let paragraph =
                            Paragraph::new(lines).style(Style::default().fg(THEME.secondary_fg));

                        // Render using the Widget trait
                        use ratatui::widgets::Widget;
                        paragraph.render(buf.area, buf);
                    }) {
                        // Track total lines inserted for cleanup on exit
                        self.total_inserted_lines += height as u32;

                        // Update last rendered count to reflect what we actually rendered
                        // This is incremental - we only advance by the batch size
                        let new_last_rendered = last_rendered_lines + lines_to_render;
                        self.task_last_rendered_scrollback
                            .insert(current_task.clone(), new_last_rendered);

                        tracing::trace!(
                            "render_scrollback_above_tui: Updated last_rendered from {} to {} (remaining: {})",
                            last_rendered_lines,
                            new_last_rendered,
                            current_scrollback_lines - new_last_rendered
                        );
                    } else {
                        tracing::error!(
                            "insert_before failed - method may not exist on this terminal type"
                        );
                    }
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
        use ratatui::style::Style;

        let (task_name, status, status_style, duration_text) =
            if let Some(ref selection) = self.selected_item {
                let state = self.core.state().lock();

                // Get status based on selection type
                let (display_name, status, start_time, end_time, estimated_ms) = match selection {
                    SelectionEntry::Task(task_id) => {
                        let status = state
                            .get_task_status(task_id)
                            .unwrap_or(TaskStatus::NotStarted);
                        let (start_time, end_time) = state.get_task_timing(task_id);
                        let estimated_ms = state.estimated_task_timings().get(task_id).copied();
                        (task_id.clone(), status, start_time, end_time, estimated_ms)
                    }
                    SelectionEntry::BatchGroup(batch_id) => {
                        // Get batch status from batch_metadata
                        let batch_metadata = state.get_batch_metadata();
                        if let Some(batch_state) = batch_metadata.get(batch_id) {
                            let status = match batch_state.final_status {
                                Some(BatchStatus::Success) => TaskStatus::Success,
                                Some(BatchStatus::Failure) => TaskStatus::Failure,
                                Some(BatchStatus::Running) | None => TaskStatus::InProgress,
                            };
                            let display_name = batch_state
                                .display_name
                                .clone()
                                .unwrap_or_else(|| batch_id.clone());
                            (
                                display_name,
                                status,
                                Some(batch_state.start_time),
                                batch_state.completion_time,
                                None, // No estimates for batches
                            )
                        } else {
                            // Batch not found in metadata - show as not started
                            (batch_id.clone(), TaskStatus::NotStarted, None, None, None)
                        }
                    }
                };
                drop(state);

                let actual_ms = calculate_actual_duration_ms(status, start_time, end_time);
                let duration = actual_ms
                    .map(|actual_ms| format_duration_with_estimate(actual_ms, estimated_ms));

                (
                    display_name,
                    status,
                    get_task_status_style(status),
                    duration,
                )
            } else if let Some(ref task_id) = self.get_current_running_item() {
                // Fallback: no selection but there's a running item
                let state = self.core.state().lock();
                let status = state
                    .get_task_status(task_id)
                    .unwrap_or(TaskStatus::InProgress);
                let (start_time, end_time) = state.get_task_timing(task_id);
                let estimated_ms = state.estimated_task_timings().get(task_id).copied();
                drop(state);

                let actual_ms = calculate_actual_duration_ms(status, start_time, end_time);
                let duration = actual_ms
                    .map(|actual_ms| format_duration_with_estimate(actual_ms, estimated_ms));

                (
                    task_id.clone(),
                    status,
                    get_task_status_style(status),
                    duration,
                )
            } else {
                (
                    String::from("Idle"),
                    TaskStatus::NotStarted,
                    get_task_status_style(TaskStatus::NotStarted),
                    None,
                )
            };

        // Get status message (e.g., "Output copied")
        let status_msg = self.status_message.as_ref().map(|(msg, _)| msg.as_str());

        // Check if we can show interactive mode indicator
        let can_interact = self.can_be_interactive();
        let show_interactive_hint = status == TaskStatus::InProgress && can_interact;

        // Calculate sizes for layout elements
        // Left side: " NX" (3) + icon (2) + task_name + some padding
        let left_fixed_size = 6; // " NX" + icon spacing
        let task_name_len = task_name.len();

        // Right side elements (in order of priority - highest priority items are always shown)
        let status_msg_size = status_msg.map(|m| m.len() + 2).unwrap_or(0); // "Output copied " with padding
        let esc_hint_size = 9; // "exit: esc" - always shown
        let duration_size = duration_text.as_ref().map(|d| d.len() + 4).unwrap_or(3); // duration or "??"
        let interactive_size = if show_interactive_hint {
            if self.is_interactive { 22 } else { 12 } // "INTERACTIVE <ctrl>+z " or "interact: i "
        } else {
            0
        };

        // Calculate available width and determine what fits
        let total_width = area.width as usize;
        let min_task_display = 10; // Minimum chars to show for task name

        // Required elements: left side + status msg (if present) + esc hint + duration
        let required_size = left_fixed_size
            + task_name_len.min(min_task_display)
            + status_msg_size
            + esc_hint_size
            + duration_size;

        // Determine if we have space for optional elements
        let available_for_optional = total_width.saturating_sub(required_size);
        let show_interactive = interactive_size > 0 && available_for_optional >= interactive_size;

        // Calculate actual right side size based on what we'll show
        let right_size = if status_msg_size > 0 {
            status_msg_size
        } else {
            esc_hint_size
                + duration_size
                + if show_interactive {
                    interactive_size
                } else {
                    0
                }
        };

        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Fill(10),               // Left: task info
                Constraint::Min(right_size as u16), // Right: esc + optional elements + duration
            ])
            .split(area);

        // Build left side: NX logo + status icon + task name
        let left_spans = vec![
            Span::styled(" NX", status_style.add_modifier(Modifier::BOLD)),
            get_task_status_icon(status, 1),
            Span::styled(task_name.clone(), status_style),
        ];

        f.render_widget(Paragraph::new(Line::from(left_spans)), chunks[0]);

        // Build right side: status msg + esc hint + interactive hint (if space) + cloud message (if space) + duration
        let mut right_spans = Vec::new();

        // Show status message (high priority - e.g., "Output copied")
        if let Some(msg) = status_msg {
            right_spans.push(Span::styled(
                format!("{} ", msg),
                Style::default().fg(THEME.info),
            ));
        } else {
            // ESC hint - always shown
            right_spans.push(Span::styled("exit: esc", Style::default().fg(THEME.info)));
            right_spans.push(Span::styled(" ", Style::default().fg(THEME.secondary_fg)));

            // Show interactive mode indicator if there's space
            if show_interactive && show_interactive_hint {
                if self.is_interactive {
                    // In interactive mode: show how to exit
                    right_spans.push(Span::styled(
                        "INTERACTIVE ",
                        Style::default().fg(THEME.primary_fg),
                    ));
                    right_spans.push(Span::styled("<ctrl>+z ", Style::default().fg(THEME.info)));
                } else {
                    // Not in interactive mode: show how to enter
                    right_spans.push(Span::styled("interact: i", Style::default().fg(THEME.info)));
                }
            }

            if let Some(ref duration) = duration_text {
                right_spans.push(Span::styled(" - ", Style::default().fg(THEME.secondary_fg)));
                right_spans.push(Span::styled(
                    duration.clone(),
                    Style::default().fg(THEME.secondary_fg),
                ));
            }
        }
        f.render_widget(Paragraph::new(Line::from(right_spans)), chunks[1]);
    }

    fn render_inline_main_content(&mut self, f: &mut ratatui::Frame, area: ratatui::layout::Rect) {
        // Show selected task output if available, otherwise first running task
        let current_task = self
            .selected_item
            .as_ref()
            .map(|s| s.id().to_string())
            .or_else(|| self.get_current_running_item());

        if let Some(ref current_task) = current_task {
            let state = self.core.state().lock();
            if let Some(pty) = state.get_pty_instance(current_task) {
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
            .block(Block::default().borders(Borders::NONE));

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
    use crate::native::tasks::types::{TaskResult, TaskTarget};
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
            config::TuiConfig::new(None, None, &cli_args),
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
        let state_ref = app.get_state();
        let state = state_ref.lock();
        assert_eq!(state.tasks().len(), 2);
        assert_eq!(state.title_text(), "Test");

        // Verify UI state is initialized
        drop(state); // Release lock
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
            config::TuiConfig::new(None, None, &cli_args),
            String::from("Existing"),
            existing_graph,
            HashMap::new(),
            None,
        )));

        // Create app with existing state
        let app = InlineApp::with_state(existing_state.clone(), None).unwrap();

        // Verify it uses the same state
        assert!(Arc::ptr_eq(&app.get_state(), &existing_state));

        // Verify state contents are preserved
        let state_ref = app.get_state();
        let state = state_ref.lock();
        assert_eq!(state.tasks().len(), 1);
        assert_eq!(state.title_text(), "Existing");
    }

    // === Event Handling Tests ===

    #[test]
    fn test_q_key_starts_countdown_when_tasks_not_complete() {
        let mut app = create_test_inline_app();
        let (tx, _rx) = mpsc::unbounded_channel();

        // Tasks are NotStarted, so 'q' should start countdown, not quit immediately
        let event = tui::Event::Key(KeyEvent::new(KeyCode::Char('q'), KeyModifiers::NONE));
        let result = app.handle_event(event, &tx).unwrap();

        // Return value is always false (quit is time-based)
        assert!(!result);

        // Countdown popup should be visible
        assert!(app.countdown_popup.is_visible());
    }

    #[test]
    fn test_q_key_quits_immediately_when_all_tasks_complete() {
        let mut app = create_test_inline_app();
        let (tx, _rx) = mpsc::unbounded_channel();

        // Mark all tasks as completed
        app.update_task_status(String::from("app1"), TaskStatus::Success);
        app.update_task_status(String::from("app2"), TaskStatus::Success);

        let event = tui::Event::Key(KeyEvent::new(KeyCode::Char('q'), KeyModifiers::NONE));
        let result = app.handle_event(event, &tx).unwrap();

        // Return value is always false (quit is time-based)
        assert!(!result);

        // Should quit immediately via time-based mechanism
        assert!(app.should_quit());
    }

    #[test]
    fn test_esc_key_dispatches_switch_mode_action() {
        // ESC in inline mode dispatches SwitchMode action to switch to fullscreen
        let mut app = create_test_inline_app();
        let (tx, mut rx) = mpsc::unbounded_channel();

        // Register action handler so dispatch_action works
        app.register_action_handler(tx.clone()).unwrap();

        let event = tui::Event::Key(KeyEvent::new(KeyCode::Esc, KeyModifiers::NONE));
        let result = app.handle_event(event, &tx).unwrap();

        // Should not quit
        assert!(!result);
        assert!(!app.should_quit());

        // Should dispatch SwitchMode(FullScreen) action
        let action = rx.try_recv().unwrap();
        assert!(matches!(action, Action::SwitchMode(TuiMode::FullScreen)));
    }

    #[test]
    fn test_f11_key_dispatches_switch_mode_action() {
        // F11 in inline mode dispatches SwitchMode action to switch to fullscreen
        let mut app = create_test_inline_app();
        let (tx, mut rx) = mpsc::unbounded_channel();

        // Register action handler so dispatch_action works
        app.register_action_handler(tx.clone()).unwrap();

        let event = tui::Event::Key(KeyEvent::new(KeyCode::F(11), KeyModifiers::NONE));
        let result = app.handle_event(event, &tx).unwrap();

        // Should not quit
        assert!(!result);
        assert!(!app.should_quit());

        // Should dispatch SwitchMode(FullScreen) action
        let action = rx.try_recv().unwrap();
        assert!(matches!(action, Action::SwitchMode(TuiMode::FullScreen)));
    }

    #[test]
    fn test_quit_on_ctrl_c() {
        let mut app = create_test_inline_app();
        let (tx, _rx) = mpsc::unbounded_channel();

        let event = tui::Event::Key(KeyEvent::new(KeyCode::Char('c'), KeyModifiers::CONTROL));
        let result = app.handle_event(event, &tx).unwrap();

        // Return value is always false (quit is time-based)
        assert!(!result);

        // Should quit immediately via time-based mechanism
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
        let state_ref = app.get_state();
        let state = state_ref.lock();
        assert!(state.get_pty_instance("app1").is_some());
    }

    #[test]
    fn test_calculate_pty_dimensions() {
        let app = create_test_inline_app();
        let (rows, cols) = app.calculate_pty_dimensions();

        // Should return reasonable dimensions (either from terminal or fallback)
        assert!(rows > 0, "rows should be positive");
        assert!(cols > 0, "cols should be positive");
    }

    // === Task Lifecycle Tests ===

    #[test]
    fn test_start_tasks() {
        let mut app = create_test_inline_app();

        let tasks = vec![create_test_task("app1")];
        app.start_tasks(tasks);

        // Verify status updated in state
        let state_ref = app.get_state();
        let state = state_ref.lock();
        assert_eq!(state.get_task_status("app1"), Some(TaskStatus::InProgress));
    }

    #[test]
    fn test_update_task_status() {
        let mut app = create_test_inline_app();

        app.update_task_status(String::from("app1"), TaskStatus::Success);

        let state_ref = app.get_state();
        let state = state_ref.lock();
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
        let state_ref = app.get_state();
        let state = state_ref.lock();
        let (start, end) = state.get_task_timing("app1");
        assert!(start.is_some());
        assert!(end.is_some());
    }

    // === Helper Method Tests ===

    #[test]
    fn test_get_current_running_item() {
        let mut app = create_test_inline_app();

        // No running tasks initially
        assert!(app.get_current_running_item().is_none());

        // Start a task
        app.update_task_status(String::from("app1"), TaskStatus::InProgress);

        // Should find running task
        assert_eq!(app.get_current_running_item(), Some(String::from("app1")));
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
        let (tx, mut rx) = mpsc::unbounded_channel();

        app.register_action_handler(tx.clone()).unwrap();

        // Verify action dispatch works after registration
        app.dispatch_action(Action::Tick);
        let action = rx.try_recv().unwrap();
        assert!(matches!(action, Action::Tick));
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

    // === Interactive Mode Tests ===

    #[test]
    fn test_interactive_mode_starts_false() {
        let app = create_test_inline_app();
        // Interactive mode should start as false
        assert!(!app.is_interactive);
    }

    #[test]
    fn test_can_be_interactive_returns_false_without_interactive_task() {
        let app = create_test_inline_app();
        // Without a registered interactive PTY, can_be_interactive should be false
        assert!(!app.can_be_interactive());
    }

    #[test]
    fn test_enter_and_exit_interactive_mode() {
        let mut app = create_test_inline_app();

        // Start in non-interactive mode
        assert!(!app.is_interactive);

        // Enter interactive mode
        app.enter_interactive_mode();
        assert!(app.is_interactive);

        // Exit interactive mode
        app.exit_interactive_mode();
        assert!(!app.is_interactive);
    }

    #[test]
    fn test_i_key_does_nothing_without_interactive_task() {
        let mut app = create_test_inline_app();
        let (tx, _rx) = mpsc::unbounded_channel();

        // Press 'i' without an interactive task
        let event = tui::Event::Key(KeyEvent::new(KeyCode::Char('i'), KeyModifiers::NONE));
        app.handle_event(event, &tx).unwrap();

        // Should remain non-interactive
        assert!(!app.is_interactive);
    }

    #[test]
    fn test_ctrl_z_exits_interactive_mode() {
        let mut app = create_test_inline_app();
        let (tx, _rx) = mpsc::unbounded_channel();

        // Manually enter interactive mode
        app.enter_interactive_mode();
        assert!(app.is_interactive);

        // Press Ctrl+Z
        let event = tui::Event::Key(KeyEvent::new(KeyCode::Char('z'), KeyModifiers::CONTROL));
        app.handle_event(event, &tx).unwrap();

        // Should exit interactive mode
        assert!(!app.is_interactive);
    }

    #[test]
    fn test_interactive_mode_captures_regular_keys() {
        let mut app = create_test_inline_app();
        let (tx, _rx) = mpsc::unbounded_channel();

        // Enter interactive mode
        app.enter_interactive_mode();

        // These keys should be captured (not trigger quit)
        let keys = vec![
            KeyEvent::new(KeyCode::Char('q'), KeyModifiers::NONE),
            KeyEvent::new(KeyCode::Char('c'), KeyModifiers::NONE),
            KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE),
            KeyEvent::new(KeyCode::Tab, KeyModifiers::NONE),
        ];

        for key in keys {
            let event = tui::Event::Key(key);
            app.handle_event(event, &tx).unwrap();
            // Should not quit
            assert!(!app.should_quit());
        }
    }

    #[test]
    fn test_with_state_starts_non_interactive() {
        // Create existing state
        let tasks = vec![create_test_task("app1")];
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
            config::TuiConfig::new(None, None, &cli_args),
            String::from("Test"),
            task_graph,
            HashMap::new(),
            None,
        )));

        // Create app with existing state (simulating mode switch)
        let app = InlineApp::with_state(state, None).unwrap();

        // Should start non-interactive
        assert!(!app.is_interactive);
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
        let state_ref = app.get_state();
        let state = state_ref.lock();
        assert!(state.get_pty_instance("app1").is_some());
    }

    #[test]
    fn test_update_status_for_nonexistent_task() {
        let mut app = create_test_inline_app();

        // Should not panic
        app.update_task_status(String::from("nonexistent"), TaskStatus::Success);

        // Status should be recorded anyway
        let state_ref = app.get_state();
        let state = state_ref.lock();
        assert_eq!(
            state.get_task_status("nonexistent"),
            Some(TaskStatus::Success)
        );
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use crate::native::tasks::types::{TaskResult, TaskTarget};
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
            config::TuiConfig::new(None, None, &cli_args),
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
        let state_ref = app.get_state();
        let state = state_ref.lock();
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
            config::TuiConfig::new(None, None, &cli_args),
            String::from("Shared"),
            task_graph,
            HashMap::new(),
            None,
        )));

        // Create two apps with same state
        let mut app1 = InlineApp::with_state(state.clone(), None).unwrap();
        let app2 = InlineApp::with_state(state.clone(), None).unwrap();

        // Modify through app1
        app1.update_task_status(String::from("shared"), TaskStatus::Success);

        // Verify visible through app2
        assert!(!app2.should_quit()); // Can access state without issues
        let state2_ref = app2.get_state();
        let state2 = state2_ref.lock();
        assert_eq!(state2.get_task_status("shared"), Some(TaskStatus::Success));
    }
}
