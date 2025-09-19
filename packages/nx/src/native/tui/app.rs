use color_eyre::eyre::Result;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers, MouseEvent, MouseEventKind};
use hashbrown::HashSet;
use napi::bindgen_prelude::External;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect, Size};
use ratatui::style::Modifier;
use ratatui::style::Style;
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Gauge, Paragraph, Widget};
use std::collections::HashMap;
use std::io;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use tokio::sync::mpsc::UnboundedSender;
use tracing::{debug, trace};
use tui_logger::{LevelFilter, TuiLoggerSmartWidget, TuiWidgetEvent, TuiWidgetState};
use tui_term::widget::PseudoTerminal;

use crate::native::tui::tui::Tui;
use crate::native::{
    pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc},
    tasks::types::{Task, TaskGraph, TaskResult},
};

use super::action::Action;
use super::components::Component;
use super::components::countdown_popup::CountdownPopup;
use super::components::dependency_view::{DependencyView, DependencyViewState};
use super::components::help_popup::HelpPopup;
use super::components::layout_manager::{
    LayoutAreas, LayoutManager, PaneArrangement, TaskListVisibility,
};
use super::components::task_selection_manager::{SelectionMode, TaskSelectionManager};
use super::components::tasks_list::{TaskStatus, TasksList};
use super::components::terminal_pane::{TerminalPane, TerminalPaneData, TerminalPaneState};
use super::config::TuiConfig;
use super::graph_utils::{get_task_count, is_task_continuous};
use super::lifecycle::{RunMode, TuiMode};
use super::pty::PtyInstance;
use super::theme::THEME;
use super::tui;
use super::utils::normalize_newlines;
use crate::native::ide::nx_console::messaging::NxConsoleMessageConnection;
use crate::native::tui::graph_utils::get_failed_dependencies;

pub struct App {
    pub components: Vec<Box<dyn Component>>,
    pub quit_at: Option<std::time::Instant>,
    focus: Focus,
    run_mode: RunMode,
    tui_mode: TuiMode,
    previous_focus: Focus,
    done_callback: Option<ThreadsafeFunction<(), ErrorStrategy::Fatal>>,
    forced_shutdown_callback: Option<ThreadsafeFunction<(), ErrorStrategy::Fatal>>,
    tui_config: TuiConfig,
    // We track whether the user has interacted with the app to determine if we should show perform any auto-exit at all
    user_has_interacted: bool,
    is_forced_shutdown: bool,
    layout_manager: LayoutManager,
    // Cached frame area used for layout calculations, only updated on terminal resize
    frame_area: Option<Rect>,
    // Cached result of layout manager's calculate_layout, only updated when necessary (e.g. terminal resize, task list visibility change etc)
    layout_areas: Option<LayoutAreas>,
    terminal_pane_data: [TerminalPaneData; 2],
    dependency_view_states: [Option<DependencyViewState>; 2],
    spacebar_mode: bool,
    pane_tasks: [Option<String>; 2], // Tasks assigned to panes 1 and 2 (0-indexed)
    action_tx: Option<UnboundedSender<Action>>,
    resize_debounce_timer: Option<u128>, // Timer for debouncing resize events
    // task id -> pty instance
    pty_instances: HashMap<String, Arc<PtyInstance>>,
    // Track scrollback line count per task for incremental rendering
    task_scrollback_lines: HashMap<String, usize>,
    // Track last rendered scrollback lines per task for buffered rendering
    task_last_rendered_scrollback: HashMap<String, usize>,
    // Counter for buffering scrollback renders (render every 20th iteration)
    scrollback_render_counter: u32,
    // Track total lines inserted above TUI for cleanup on exit
    total_inserted_lines: u32,
    selection_manager: Arc<Mutex<TaskSelectionManager>>,
    pinned_tasks: Vec<String>,
    task_graph: TaskGraph,
    task_status_map: HashMap<String, TaskStatus>, // App owns task status
    debug_mode: bool,
    debug_state: TuiWidgetState,
    console_messenger: Option<NxConsoleMessageConnection>,
    estimated_task_timings: HashMap<String, i64>,
    // Note: Inline rendering is handled within this App, no separate instance needed
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Focus {
    TaskList,
    MultipleOutput(usize),
    HelpPopup,
    CountdownPopup,
}

impl App {
    pub fn get_tui_mode(&self) -> TuiMode {
        self.tui_mode
    }

    fn should_use_inline_layout(&self) -> bool {
        matches!(self.tui_mode, TuiMode::Inline)
    }
    pub fn new(
        tasks: Vec<Task>,
        initiating_tasks: HashSet<String>,
        run_mode: RunMode,
        pinned_tasks: Vec<String>,
        tui_config: TuiConfig,
        title_text: String,
        task_graph: TaskGraph,
        tui_mode: TuiMode,
    ) -> Result<Self> {
        let task_count = get_task_count(&task_graph);
        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(5)));

        let initial_focus = Focus::TaskList;

        // Initialize task status map - App owns this now
        let mut task_status_map = HashMap::new();
        for task in &tasks {
            task_status_map.insert(task.id.clone(), TaskStatus::NotStarted);
        }

        let tasks_list = TasksList::new(
            tasks.clone(),
            initiating_tasks,
            run_mode,
            initial_focus,
            title_text,
            selection_manager.clone(),
        );
        let help_popup = HelpPopup::new();
        let countdown_popup = CountdownPopup::new();

        let components: Vec<Box<dyn Component>> = vec![
            Box::new(tasks_list),
            Box::new(help_popup),
            Box::new(countdown_popup),
        ];

        let main_terminal_pane_data = TerminalPaneData::new();

        // Note: Inline rendering is now handled as a mode within the main app
        debug!("🚀 App::new - TUI mode: {:?}", tui_mode);

        Ok(Self {
            run_mode,
            tui_mode,
            components,
            pinned_tasks,
            quit_at: None,
            focus: initial_focus,
            previous_focus: Focus::TaskList,
            done_callback: None,
            forced_shutdown_callback: None,
            tui_config,
            user_has_interacted: false,
            is_forced_shutdown: false,
            layout_manager: LayoutManager::new_with_run_mode(task_count, run_mode),
            frame_area: None,
            layout_areas: None,
            terminal_pane_data: [main_terminal_pane_data, TerminalPaneData::new()],
            dependency_view_states: [None, None],
            spacebar_mode: false,
            pane_tasks: [None, None],
            action_tx: None,
            resize_debounce_timer: None,
            pty_instances: HashMap::new(),
            task_scrollback_lines: HashMap::new(),
            task_last_rendered_scrollback: HashMap::new(),
            scrollback_render_counter: 0,
            total_inserted_lines: 0,
            selection_manager,
            task_graph,
            task_status_map,
            debug_mode: false,
            debug_state: TuiWidgetState::default().set_default_display_level(LevelFilter::Debug),
            console_messenger: None,
            estimated_task_timings: HashMap::new(),
        })
    }

    pub fn register_action_handler(&mut self, tx: UnboundedSender<Action>) -> Result<()> {
        self.action_tx = Some(tx);
        Ok(())
    }

    pub fn init(&mut self, _area: Size) -> Result<()> {
        // Iterate over the pinned tasks and assign them to the terminal panes (up to the maximum of 2), focusing the first one as well
        let pinned_tasks = self.pinned_tasks.clone();
        for (idx, task) in pinned_tasks.iter().enumerate() {
            if idx < 2 {
                self.selection_manager
                    .lock()
                    .unwrap()
                    .select_task(task.clone());

                if pinned_tasks.len() == 1 && idx == 0 {
                    self.display_and_focus_current_task_in_terminal_pane(match self.run_mode {
                        RunMode::RunMany => true,
                        RunMode::RunOne if get_task_count(&self.task_graph) == 1 => false,
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
        // Update App's task status map when tasks start
        for task in &tasks {
            self.task_status_map
                .insert(task.id.clone(), TaskStatus::InProgress);
        }

        self.dispatch_action(Action::StartTasks(tasks));
    }

    pub fn update_task_status(&mut self, task_id: String, status: TaskStatus) {
        // Update the App's task status map first
        self.task_status_map.insert(task_id.clone(), status);

        // Auto-switch pane to failed dependency when a task becomes skipped
        if status == TaskStatus::Skipped {
            self.handle_automatic_pane_switching(&task_id);
        }

        self.dispatch_action(Action::UpdateTaskStatus(task_id.clone(), status));
        if status == TaskStatus::InProgress && self.should_set_interactive_by_default(&task_id) {
            // Find which pane this task is assigned to
            for (pane_idx, pane_task) in self.pane_tasks.iter().enumerate() {
                if let Some(pane_task_id) = pane_task {
                    if pane_task_id == &task_id {
                        self.terminal_pane_data[pane_idx].set_interactive(true);
                        break;
                    }
                }
            }
        }
    }

    /// Get task status efficiently from App's own HashMap
    pub fn get_task_status(&self, task_id: &str) -> Option<TaskStatus> {
        self.task_status_map.get(task_id).copied()
    }

    /// Get task continuous flag efficiently from task graph
    pub fn is_task_continuous(&self, task_id: &str) -> bool {
        is_task_continuous(&self.task_graph, task_id)
    }

    fn should_set_interactive_by_default(&self, task_id: &str) -> bool {
        matches!(self.run_mode, RunMode::RunOne)
            && self
                .pty_instances
                .get(task_id)
                .is_some_and(|pty| pty.can_be_interactive())
    }

    pub fn print_task_terminal_output(&mut self, task_id: String, output: String) {
        // Check if a PTY instance already exists for this task
        if let Some(pty) = self.pty_instances.get(&task_id) {
            // Append output to the existing PTY instance to preserve scroll position
            // Add ANSI escape sequence to hide cursor at the end of output
            let output_with_hidden_cursor = format!("{}\x1b[?25l", output);
            Self::write_output_to_parser(pty, output_with_hidden_cursor);
        } else {
            // Tasks run within a pseudo-terminal always have a pty instance and do not need a new one
            // Tasks not run within a pseudo-terminal need a new pty instance to print output
            let (rows, cols) = self.calculate_pty_dimensions_for_mode();
            let pty = PtyInstance::non_interactive_with_dimensions(rows, cols);

            // Add ANSI escape sequence to hide cursor at the end of output, it would be confusing to have it visible when a task is a cache hit
            let output_with_hidden_cursor = format!("{}\x1b[?25l", output);
            Self::write_output_to_parser(&pty, output_with_hidden_cursor);

            self.register_pty_instance(&task_id, pty);
            // Ensure the pty instances get resized appropriately
            let _ = self.debounce_pty_resize();
        }

        // If the task is continuous, ensure the pty instances get resized appropriately
        if self.is_task_continuous(&task_id) {
            let _ = self.debounce_pty_resize();
        }
    }

    pub fn end_tasks(&mut self, task_results: Vec<TaskResult>) {
        // When tasks finish ensure that pty instances are resized appropriately as they may be actively displaying output when they finish
        let _ = self.debounce_pty_resize();
        self.dispatch_action(Action::EndTasks(task_results));
    }

    // Show countdown popup for the configured duration (making sure the help popup is not open first)
    pub fn end_command(&mut self) {
        self.console_messenger
            .as_ref()
            .and_then(|c| c.end_running_tasks());

        self.dispatch_action(Action::EndCommand);
    }

    // Internal method to handle Action::EndCommand
    fn handle_end_command(&mut self) {
        // If the user has interacted with the app or auto-exit is disabled, do nothing
        if self.user_has_interacted || !self.tui_config.auto_exit.should_exit_automatically() {
            return;
        }

        let failed_task_names = self.get_failed_task_names();
        // If there are more than 1 failed tasks, do not auto-exit
        if failed_task_names.len() > 1 {
            // If there are no visible panes (e.g. run one would have a pane open by default), focus the first failed task
            if !self.has_visible_panes() {
                self.selection_manager
                    .lock()
                    .unwrap()
                    .select_task(failed_task_names.first().unwrap().clone());

                // Display the task logs but keep focus on the task list to allow the user to navigate the failed tasks
                self.toggle_output_visibility();
            }
            return;
        }

        if get_task_count(&self.task_graph) > 1 {
            self.begin_exit_countdown()
        } else {
            self.quit();
        }
    }

    fn quit(&mut self) {
        self.quit_at = Some(std::time::Instant::now());
    }

    fn begin_exit_countdown(&mut self) {
        let countdown_duration = self.tui_config.auto_exit.countdown_seconds();
        // If countdown is disabled, exit immediately
        if countdown_duration.is_none() {
            self.quit();
            return;
        }

        // Otherwise, show the countdown popup for the configured duration
        let countdown_duration = countdown_duration.unwrap() as u64;
        if let Some(countdown_popup) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
        {
            countdown_popup.start_countdown(countdown_duration);
            self.update_focus(Focus::CountdownPopup);
            self.quit_at = Some(
                std::time::Instant::now() + std::time::Duration::from_secs(countdown_duration),
            );
        }
    }

    // A pseudo-terminal running task will provide the parser and writer directly
    pub fn register_running_interactive_task(
        &mut self,
        task_id: String,
        parser_and_writer: External<(ParserArc, WriterArc)>,
    ) {
        debug!(
            "🔗 Registering interactive task: {} (mode: {:?})",
            task_id, self.tui_mode
        );
        // Same logic for both full-screen and inline modes - the difference is in rendering, not task management
        let pty =
            PtyInstance::interactive(parser_and_writer.0.clone(), parser_and_writer.1.clone());
        self.register_running_task(task_id, pty);
    }

    pub fn register_running_non_interactive_task(&mut self, task_id: String) {
        debug!(
            "🔗 Registering NON-interactive task: {} (mode: {:?})",
            task_id, self.tui_mode
        );
        debug!(
            "❌ ISSUE: Task {} is being registered as NON-interactive - won't show in inline TUI!",
            task_id
        );
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
        let pty = self
            .pty_instances
            .get_mut(&task_id)
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
                let _ = action_tx.send(Action::Quit);
                return Ok(true);
            }
            tui::Event::Tick => {
                let _ = action_tx.send(Action::Tick);

                // Check if we have a pending resize that needs to be processed
                if let Some(timer) = self.resize_debounce_timer {
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis();

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
                    self.user_has_interacted = true;
                }

                // Handle Ctrl+C to quit, unless we're in interactive mode and the focus is on a terminal pane
                if key.code == KeyCode::Char('c')
                    && key.modifiers == KeyModifiers::CONTROL
                    && !(matches!(self.focus, Focus::MultipleOutput(_))
                        && self.is_interactive_mode())
                {
                    self.console_messenger
                        .as_ref()
                        .and_then(|c| c.end_running_tasks());

                    self.is_forced_shutdown = true;
                    // Quit immediately
                    self.quit_at = Some(std::time::Instant::now());
                    return Ok(true);
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
                                self.quit_at = Some(std::time::Instant::now());
                                return Ok(true);
                            }
                            KeyCode::Char('c') if key.modifiers == KeyModifiers::CONTROL => {
                                // Quit immediately
                                trace!("Confirming shutdown");
                                self.quit_at = Some(std::time::Instant::now());
                                return Ok(true);
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
                                self.quit_at = None;
                                self.update_focus(self.previous_focus);
                            }
                        }
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
                        // Check if all tasks are in a completed state using the task status map
                        let all_tasks_completed = self.task_status_map.values().all(|status| {
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

                        if all_tasks_completed {
                            // If all tasks are done, quit immediately like Ctrl+C
                            self.is_forced_shutdown = true;
                            self.quit_at = Some(std::time::Instant::now());
                        } else {
                            // Otherwise, start the exit countdown to give the user the chance to change their mind in case of an accidental keypress
                            self.is_forced_shutdown = true;
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
                                        let _ = self.debounce_pty_resize();
                                    }
                                    KeyCode::Down => {
                                        self.dispatch_action(Action::NextTask);
                                        let _ = self.debounce_pty_resize();
                                    }
                                    KeyCode::Char('k') if !is_filter_mode => {
                                        self.dispatch_action(Action::PreviousTask);
                                        let _ = self.debounce_pty_resize();
                                    }
                                    KeyCode::Up => {
                                        self.dispatch_action(Action::PreviousTask);
                                        let _ = self.debounce_pty_resize();
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
                                                                let _ = self.debounce_pty_resize();
                                                            }
                                                            'k' => {
                                                                self.dispatch_action(
                                                                    Action::PreviousTask,
                                                                );
                                                                let _ = self.debounce_pty_resize();
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
                            }
                        }
                    }
                }
            }
            tui::Event::Mouse(mouse) => {
                // If the app is in interactive mode, interactions are with
                // the running task, not the app itself
                if !self.is_interactive_mode() {
                    // Record that the user has interacted with the app
                    self.user_has_interacted = true;
                }

                if matches!(self.focus, Focus::MultipleOutput(_)) {
                    self.handle_mouse_event(mouse).ok();
                    return Ok(false);
                }

                match mouse.kind {
                    MouseEventKind::ScrollUp => {
                        if matches!(self.focus, Focus::TaskList) {
                            self.dispatch_action(Action::ScrollUp);
                        } else {
                            self.handle_key_event(KeyEvent::new(
                                KeyCode::Up,
                                KeyModifiers::empty(),
                            ))
                            .ok();
                        }
                    }
                    MouseEventKind::ScrollDown => {
                        if matches!(self.focus, Focus::TaskList) {
                            self.dispatch_action(Action::ScrollDown);
                        } else {
                            self.handle_key_event(KeyEvent::new(
                                KeyCode::Down,
                                KeyModifiers::empty(),
                            ))
                            .ok();
                        }
                    }
                    _ => {}
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
                self.console_messenger
                    .as_ref()
                    .and_then(|c| c.start_running_tasks());
            }
            Action::Tick => {
                self.console_messenger.as_ref().and_then(|messenger| {
                    self.components
                        .iter()
                        .find_map(|c| c.as_any().downcast_ref::<TasksList>())
                        .and_then(|tasks_list| {
                            messenger.update_running_tasks(&tasks_list.tasks, &self.pty_instances)
                        })
                });
            }
            // Quit immediately
            Action::Quit => {
                self.quit_at = Some(std::time::Instant::now());
            }
            // Cancel quitting
            Action::CancelQuit => {
                self.quit_at = None;
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
                // For inline TUI, render scrollback content above the TUI using insert_before
                if self.should_use_inline_layout() {
                    self.render_scrollback_above_tui(tui);
                }

                tui.draw(|f| {
                    let area = f.area();

                    // Cache the frame area if it's never been set before (will be updated in subsequent resize events if necessary)
                    if self.frame_area.is_none() {
                        self.frame_area = Some(area);
                    }

                    if self.should_use_inline_layout() {
                        self.render_inline_layout(f, area);
                        return;
                    }

                    // Determine the required layout areas for the tasks list and terminal panes using the LayoutManager
                    if self.layout_areas.is_none() {
                        self.recalculate_layout_areas();
                    }

                    let frame_area = self.frame_area.unwrap();
                    let layout_areas = self.layout_areas.as_mut().unwrap();

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

                    // Render terminal panes - first collect necessary data
                    let terminal_panes_data: Vec<(usize, Rect, Option<String>)> = layout_areas
                        .terminal_panes
                        .iter()
                        .enumerate()
                        .map(|(pane_idx, pane_area)| {
                            let relevant_pane_task: Option<String> = if self.spacebar_mode {
                                self.selection_manager
                                    .lock()
                                    .unwrap()
                                    .get_selected_task_name()
                                    .cloned()
                            } else {
                                self.pane_tasks[pane_idx].clone()
                            };
                            (pane_idx, *pane_area, relevant_pane_task)
                        })
                        .collect();

                    // Calculate minimal view context once for all panes
                    let is_minimal =
                        self.is_task_list_hidden() && get_task_count(&self.task_graph) == 1;

                    for (pane_idx, pane_area, relevant_pane_task) in terminal_panes_data {
                        if let Some(task_name) = relevant_pane_task {
                            let task_status = self
                                .get_task_status(&task_name)
                                .unwrap_or(TaskStatus::NotStarted);

                            // If task is pending or skipped, show dependency view
                            if task_status == TaskStatus::NotStarted
                                || task_status == TaskStatus::Skipped
                            {
                                self.render_dependency_view_internal(
                                    f, pane_idx, pane_area, task_name, is_minimal,
                                );
                            } else {
                                self.render_terminal_pane_internal(
                                    f, pane_idx, pane_area, task_name, is_minimal,
                                );
                            }
                        } else {
                            self.render_pane_placeholder(f, pane_idx, pane_area);
                        }
                    }

                    // Draw the help popup and countdown popup
                    let (first_part, second_part) = self.components.split_at_mut(2);
                    let help_popup = first_part[1]
                        .as_any_mut()
                        .downcast_mut::<HelpPopup>()
                        .unwrap();
                    let countdown_popup = second_part[0]
                        .as_any_mut()
                        .downcast_mut::<CountdownPopup>()
                        .unwrap();
                    let _ = help_popup.draw(f, frame_area);
                    let _ = countdown_popup.draw(f, frame_area);
                })
                .ok();
            }
            Action::SendConsoleMessage(msg) => {
                if let Some(connection) = &self.console_messenger {
                    connection.send_terminal_string(msg);
                } else {
                    trace!("No console connection available");
                }
            }
            Action::EndCommand => {
                self.handle_end_command();
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

    pub fn set_done_callback(
        &mut self,
        done_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) {
        self.done_callback = Some(done_callback);
    }

    pub fn set_forced_shutdown_callback(
        &mut self,
        forced_shutdown_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>,
    ) {
        self.forced_shutdown_callback = Some(forced_shutdown_callback);
    }

    pub fn call_done_callback(&self) {
        if self.is_forced_shutdown {
            if let Some(cb) = &self.forced_shutdown_callback {
                cb.call(
                    (),
                    napi::threadsafe_function::ThreadsafeFunctionCallMode::Blocking,
                );
            }
        }
        if let Some(cb) = &self.done_callback {
            cb.call(
                (),
                napi::threadsafe_function::ThreadsafeFunctionCallMode::Blocking,
            );
        }
    }

    pub fn set_cloud_message(&mut self, message: Option<String>) {
        if let Some(message) = message {
            self.dispatch_action(Action::UpdateCloudMessage(message));
        }
    }

    /// Dispatches an action to the action tx for other components to handle however they see fit
    fn dispatch_action(&self, action: Action) {
        if let Some(tx) = &self.action_tx {
            tx.send(action).unwrap_or_else(|e| {
                debug!("Failed to dispatch action: {}", e);
            });
        }
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

    /// Returns the names of tasks that have failed.
    fn get_failed_task_names(&self) -> Vec<String> {
        self.task_status_map
            .iter()
            .filter_map(|(task_name, status)| {
                if *status == TaskStatus::Failure {
                    Some(task_name.clone())
                } else {
                    None
                }
            })
            .collect()
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
        let task_name = match self
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
        {
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
            .unwrap()
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
        let task_name = match self
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
        {
            Some(name) => name.clone(),
            None => return,
        };

        // If we're in spacebar mode and this is pane 0, convert to pinned mode
        if self.spacebar_mode && pane_idx == 0 {
            // Clear the PTY reference when converting from spacebar to pinned mode
            self.clear_pane_pty_reference(pane_idx);

            // Pin the currently selected task to the pane
            self.pane_tasks[pane_idx] = Some(task_name.clone());

            // When converting from spacebar to pinned, stay in name-tracking mode
            self.set_spacebar_mode(false, Some(SelectionMode::TrackByName));
            if self.layout_manager.get_pane_arrangement() == PaneArrangement::None {
                self.layout_manager
                    .set_pane_arrangement(PaneArrangement::Single);
            }
            self.dispatch_action(Action::PinTask(task_name.clone(), pane_idx));
        } else {
            // Check if the task is already pinned to the pane
            if self.pane_tasks[pane_idx].as_deref() == Some(task_name.as_str()) {
                // Unpin the task if it's already pinned
                self.pane_tasks[pane_idx] = None;

                // Clear the PTY reference when unpinning
                self.clear_pane_pty_reference(pane_idx);

                // If this was previously pane 2 and its now unpinned and pane 1 is still set, set the pane arrangement to single
                if pane_idx == 1 && self.pane_tasks[0].is_some() {
                    self.layout_manager
                        .set_pane_arrangement(PaneArrangement::Single);
                }

                // Adjust focused pane if necessary
                if !self.has_visible_panes() {
                    self.update_focus(Focus::TaskList);
                    // When all panes are cleared, use position-based selection
                    self.set_spacebar_mode(false, Some(SelectionMode::TrackByPosition));
                    // If no visible panes are left, set the pane arrangement to none
                    self.layout_manager
                        .set_pane_arrangement(PaneArrangement::None);
                }

                self.dispatch_action(Action::UnpinTask(task_name.clone(), pane_idx));
            } else {
                // Pin the task to the specified pane
                self.pane_tasks[pane_idx] = Some(task_name.clone());
                self.update_focus(Focus::TaskList);

                // Exit spacebar mode when pinning
                // When pinning a task, use name-based selection
                self.set_spacebar_mode(false, Some(SelectionMode::TrackByName));

                if self.layout_manager.get_pane_arrangement() == PaneArrangement::None {
                    if pane_idx == 0 && self.pane_tasks[1].is_none() {
                        self.layout_manager
                            .set_pane_arrangement(PaneArrangement::Single);
                    } else if pane_idx == 1 || pane_idx == 0 && self.pane_tasks[1].is_some() {
                        self.layout_manager
                            .set_pane_arrangement(PaneArrangement::Double);
                    }
                }

                self.dispatch_action(Action::PinTask(task_name.clone(), pane_idx));
            }
        }

        // Always re-evaluate the optimal size of the terminal pane(s)
        self.recalculate_layout_areas();
        // Ensure the pty instances get resized appropriately (no debounce as this is based on an imperative user action)
        let _ = self.handle_pty_resize();
    }

    fn handle_mouse_event(&mut self, mouse_event: MouseEvent) -> io::Result<()> {
        if let Focus::MultipleOutput(pane_idx) = self.focus {
            let terminal_pane_data = &mut self.terminal_pane_data[pane_idx];
            terminal_pane_data.handle_mouse_event(mouse_event)
        } else {
            Ok(())
        }
    }

    /// Forward key events to the currently focused pane, if any.
    fn handle_key_event(&mut self, key: KeyEvent) -> io::Result<()> {
        if let Focus::MultipleOutput(pane_idx) = self.focus {
            // Get the task assigned to this pane to determine how to handle keys
            // In spacebar mode, use selection manager; in pinned mode, use pane_tasks
            let relevant_pane_task: Option<String> = if self.spacebar_mode {
                self.selection_manager
                    .lock()
                    .unwrap()
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
                        if dep_state.handle_key_event(key) {
                            return Ok(()); // Key was handled by dependency view
                        }
                    }
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
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis();

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
        match &self.tui_mode {
            TuiMode::FullScreen => {
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
                        let old_rows = if let Some(screen) = pty.get_screen() {
                            let (rows, _) = screen.size();
                            rows
                        } else {
                            0
                        };
                        let mut pty_clone = pty.as_ref().clone();
                        pty_clone.resize(pty_height, pty_width)?;

                        // If dimensions changed, mark for sort
                        if old_rows != pty_height {
                            needs_sort = true;
                        }
                    }
                }

                // Sort tasks if needed after all resizing is complete
                if needs_sort {
                    self.dispatch_action(Action::SortTasks);
                }
            }
            TuiMode::Inline => {
                // Inline viewport doesn't support resize events, so PTY instances
                // are initialized with correct dimensions from the start
                debug!("Inline mode doesn't support PTY resize - dimensions set during init");
            }
        }

        Ok(())
    }

    fn is_task_list_hidden(&self) -> bool {
        self.layout_manager.get_task_list_visibility() == TaskListVisibility::Hidden
    }

    fn register_pty_instance(&mut self, task_id: &str, mut pty: PtyInstance) {
        // Resize PTY before wrapping in Arc if in inline mode
        if matches!(&self.tui_mode, TuiMode::Inline) {
            if let Some(frame_area) = self.frame_area {
                // Reserve space for status/progress bars (roughly 3 lines)
                let inline_content_height = frame_area.height.saturating_sub(6);
                let inline_content_width = frame_area.width;
                pty.resize(inline_content_height, inline_content_width)
                    .unwrap();
            } else {
                // Fallback to reasonable defaults if no frame area yet
                pty.resize(20, 80).unwrap();
            }
        }

        // Wrap in Arc after resizing
        let pty = Arc::new(pty);
        self.pty_instances.insert(task_id.to_string(), pty);

        // Initialize scrollback line tracking for this task
        self.task_scrollback_lines.insert(task_id.to_string(), 0);
        self.task_last_rendered_scrollback
            .insert(task_id.to_string(), 0);
    }

    /// Calculate appropriate PTY dimensions based on the current TUI mode
    fn calculate_pty_dimensions_for_mode(&self) -> (u16, u16) {
        match &self.tui_mode {
            TuiMode::FullScreen => {
                // For fullscreen, use reasonable defaults that will be resized later by terminal panes
                (24, 80)
            }
            TuiMode::Inline => {
                // For inline mode, calculate dimensions based on available space
                if let Some(frame_area) = self.frame_area {
                    // Reserve space for status/progress bars (roughly 6 lines)
                    let inline_content_height = frame_area.height.saturating_sub(3);
                    let inline_content_width = frame_area.width;
                    (inline_content_height, inline_content_width)
                } else {
                    // Fallback to reasonable defaults if no frame area yet
                    (20, 80)
                }
            }
        }
    }

    // Writes the given output to the given parser, used for the case where a task is a cache hit, or when it is run outside of the rust pseudo-terminal
    fn write_output_to_parser(parser: &PtyInstance, output: String) {
        let normalized_output = normalize_newlines(output.as_bytes());
        parser.process_output(&normalized_output);
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
        let is_connected = messenger.is_connected();
        debug!(
            "🔗 Setting console messenger: is_connected={}",
            is_connected
        );
        self.console_messenger = Some(messenger);

        // ALWAYS dispatch ConsoleMessengerAvailable(true) regardless of connection status
        // The TUI should work even without Nx Console connection
        debug!(
            "✅ Dispatching ConsoleMessengerAvailable(true) - TUI should work with or without console connection"
        );
        self.dispatch_action(Action::ConsoleMessengerAvailable(true));

        if !is_connected {
            debug!(
                "ℹ️ Console messenger is not connected - Nx Console features will be disabled, but TUI will work normally"
            );
        }
    }

    /// Renders the dependency view for a pending task in the specified pane
    fn render_dependency_view_internal(
        &mut self,
        f: &mut ratatui::Frame,
        pane_idx: usize,
        pane_area: Rect,
        task_name: String,
        is_minimal: bool,
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

        let is_focused = match self.focus {
            Focus::MultipleOutput(focused_pane_idx) => pane_idx == focused_pane_idx,
            _ => false,
        };

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
            let new_state = DependencyViewState::new(
                task_name.clone(),
                task_status,
                &self.task_graph,
                is_focused,
                throbber_counter,
                pane_area,
            );
            self.dependency_view_states[pane_idx] = Some(new_state);
        }

        // No need to update status in DependencyViewState - we pass the full map to the widget
        if let Some(dep_state) = &mut self.dependency_view_states[pane_idx] {
            let dependency_view =
                DependencyView::new(&self.task_status_map, &self.task_graph, is_minimal);
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
        is_minimal: bool,
    ) {
        // Calculate values that were previously passed in
        let task_status = self
            .get_task_status(&task_name)
            .unwrap_or(TaskStatus::NotStarted);
        let task_continuous = self.is_task_continuous(&task_name);
        let has_pty = self.pty_instances.contains_key(&task_name);

        let is_focused = match self.focus {
            Focus::MultipleOutput(focused_pane_idx) => pane_idx == focused_pane_idx,
            _ => false,
        };

        let is_next_tab_target = !is_focused
            && match self.focus {
                Focus::TaskList => pane_idx == 0,
                Focus::MultipleOutput(0) => pane_idx == 1,
                _ => false,
            };
        let terminal_pane_data = &mut self.terminal_pane_data[pane_idx];
        terminal_pane_data.is_continuous = task_continuous;
        let in_progress = task_status == TaskStatus::InProgress;
        if !in_progress && terminal_pane_data.is_interactive() {
            terminal_pane_data.set_interactive(false);
        }

        if has_pty {
            if let Some(pty) = self.pty_instances.get(&task_name) {
                terminal_pane_data.can_be_interactive = in_progress && pty.can_be_interactive();
                terminal_pane_data.pty = Some(pty.clone());
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
        let estimated_duration = self.estimated_task_timings.get(&task_name).copied();

        let mut state = TerminalPaneState::new(
            task_name,
            task_status,
            task_continuous,
            is_focused,
            has_pty,
            is_next_tab_target,
            self.console_messenger.is_some(),
            estimated_duration,
            start_time,
            end_time,
        );

        let terminal_pane = TerminalPane::new()
            .minimal(is_minimal)
            .pty_data(terminal_pane_data)
            .continuous(task_continuous);

        f.render_stateful_widget(terminal_pane, pane_area, &mut state);
    }

    /// Renders a placeholder for an empty pane
    fn render_pane_placeholder(&self, f: &mut ratatui::Frame, pane_idx: usize, pane_area: Rect) {
        let placeholder =
            Paragraph::new(format!("Press {} on a task to show it here", pane_idx + 1))
                .block(
                    Block::default()
                        .title(format!("  Output {}  ", pane_idx + 1))
                        .borders(Borders::ALL)
                        .border_style(Style::default().fg(THEME.secondary_fg)),
                )
                .style(Style::default().fg(THEME.secondary_fg))
                .alignment(Alignment::Center);

        f.render_widget(placeholder, pane_area);
    }

    pub fn set_estimated_task_timings(&mut self, timings: HashMap<String, i64>) {
        self.estimated_task_timings = timings;
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
        if let Some(pty_instance) = self.pty_instances.get(&task_id) {
            self.terminal_pane_data[pane_idx].pty = Some(pty_instance.clone());
        }

        // Update the selection manager to prevent conflicts with manual selection
        if let Ok(mut selection_manager) = self.selection_manager.lock() {
            selection_manager.select_task(task_id);
        }
    }

    /// Gets the first failed dependency for a given task.
    ///
    /// Returns the task name of the first dependency that failed, causing this task to be skipped.
    /// This is used for automatic pane switching to show the root cause of failures.
    fn get_first_failed_dependency(&self, task_name: &str) -> Option<String> {
        let failed_deps =
            get_failed_dependencies(task_name, &self.task_graph, &self.task_status_map);
        failed_deps.into_iter().next()
    }

    // Inline rendering methods
    fn render_inline_layout(&mut self, f: &mut ratatui::Frame, area: Rect) {
        // Put terminal content at the top, status/progress at bottom
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Max(f.area().height.saturating_sub(8)), // Terminal output FIRST (at top)
                Constraint::Length(4),                              // Status bar (smaller)
                Constraint::Length(4),                              // Progress bar (minimal)
            ])
            .split(area);

        // Render main content section FIRST (terminal at top)
        self.render_inline_main_content(f, chunks[0]);

        // Render status section below
        self.render_inline_status(f, chunks[1]);

        // Render progress section at bottom
        self.render_inline_progress(f, chunks[2]);
    }

    fn render_inline_status(&self, f: &mut ratatui::Frame, area: Rect) {
        let current_task = self.get_current_running_task();
        let status_text = if let Some(task_id) = current_task {
            format!(" Running: {} ", task_id)
        } else {
            " Idle ".to_string()
        };

        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Min(20),    // Status text
                Constraint::Length(30), // Help text
            ])
            .split(area);

        let status = Paragraph::new(status_text)
            .style(Style::default().fg(THEME.primary_fg))
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title(" Status ")
                    .border_style(Style::default().fg(THEME.secondary_fg)),
            );

        let help = Paragraph::new(" Press 'q', Ctrl+C, or ESC to exit ")
            .style(Style::default().fg(THEME.warning))
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title(" Help ")
                    .border_style(Style::default().fg(THEME.secondary_fg)),
            );

        f.render_widget(status, chunks[0]);
        f.render_widget(help, chunks[1]);
    }

    fn render_inline_progress(&self, f: &mut ratatui::Frame, area: Rect) {
        let completed_count = self.get_completed_task_count();
        let total_count = self.task_status_map.len();

        let progress = if total_count > 0 {
            (completed_count as f64 / total_count as f64) * 100.0
        } else {
            0.0
        };

        let gauge = Gauge::default()
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title(" Progress ")
                    .border_style(Style::default().fg(THEME.secondary_fg)),
            )
            .gauge_style(Style::default().fg(THEME.success))
            .percent(progress as u16)
            .label(format!("{}/{} tasks", completed_count, total_count));

        f.render_widget(gauge, area);
    }

    fn render_inline_main_content(&mut self, f: &mut ratatui::Frame, area: Rect) {
        // Show running task output if available, otherwise show task list
        if let Some(current_task) = self.get_current_running_task() {
            // Clone the Arc to avoid borrow issues
            if let Some(pty) = self.pty_instances.get(&current_task).cloned() {
                self.render_inline_task_output(f, area, &current_task, &pty);
                return;
            }
        }

        // Fallback: render task list
        self.render_inline_task_list(f, area);
    }

    fn render_inline_task_output(
        &mut self,
        f: &mut ratatui::Frame,
        area: Rect,
        _task_name: &str,
        pty: &Arc<PtyInstance>,
    ) {
        // Scrollback is now handled separately via terminal.insert_before in render_scrollback_above_tui
        // Just render the current terminal screen here
        if let Some(screen) = pty.get_screen() {
            let block = Block::default()
                .borders(Borders::NONE)
                // .title(format!(" {} ", task_name))
                .border_style(Style::default().fg(THEME.primary_fg));

            // Use PseudoTerminal with block, just like terminal_pane does
            let pseudo_term = PseudoTerminal::new(&*screen).block(block);
            f.render_widget(pseudo_term, area);
        }
    }

    fn render_inline_task_list(&mut self, f: &mut ratatui::Frame, area: Rect) {
        // Reuse existing TasksList component but in simplified mode
        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            let _ = tasks_list.draw(f, area);
        }
    }

    fn render_scrollback_above_tui(&mut self, tui: &mut Tui) {
        // Increment render counter
        self.scrollback_render_counter += 1;

        // Only render scrollback every 20th iteration to batch updates for VSCode
        let should_render_scrollback = self.scrollback_render_counter % 20 == 0;

        if !should_render_scrollback {
            return;
        }

        // Get the current running task and its buffered scrollback content
        if let Some(current_task) = self.get_current_running_task() {
            if let Some(pty) = self.pty_instances.get(&current_task).cloned() {
                // Get last rendered scrollback line count for this task
                let last_rendered_lines = self
                    .task_last_rendered_scrollback
                    .get(&current_task)
                    .copied()
                    .unwrap_or(0);

                // Get buffered scrollback content since last render (accumulated over ~10 iterations)
                let buffered_scrollback_lines =
                    pty.get_buffered_scrollback_content_for_inline(last_rendered_lines);

                // Update tracking for next buffered render
                let current_scrollback_lines = pty.get_scrollback_line_count();
                self.task_scrollback_lines
                    .insert(current_task.clone(), current_scrollback_lines);

                // Render buffered scrollback above TUI using terminal.insert_before
                if !buffered_scrollback_lines.is_empty() {
                    let height = (buffered_scrollback_lines.len()) as u16; // +1 for reset line
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
                        paragraph.render(buf.area, buf);
                    });

                    // Track total lines inserted for cleanup on exit
                    self.total_inserted_lines += height as u32;

                    // Update last rendered count after successful render
                    self.task_last_rendered_scrollback
                        .insert(current_task.clone(), current_scrollback_lines);

                    debug!(
                        "Rendered {} buffered scrollback lines above TUI for {} (total scrollback: {}, total inserted: {}) [every 20th render]",
                        buffered_scrollback_lines.len(),
                        current_task,
                        current_scrollback_lines,
                        self.total_inserted_lines
                    );
                }
            }
        }
    }

    /// Clear scrollback lines that were inserted above the TUI on exit
    /// Uses cursor positioning to overwrite inserted content with blank lines
    pub fn cleanup_scrollback_on_exit(&self) {
        if self.total_inserted_lines > 0 && matches!(self.tui_mode, TuiMode::Inline) {
            use std::io::{self, Write};

            // Move cursor up to the beginning of inserted content
            print!("\x1b[{}A", self.total_inserted_lines);

            // Overwrite each line with spaces, then clear to end of line
            for _ in 0..self.total_inserted_lines {
                print!("\x1b[2K"); // Clear current line
                print!("\x1b[1B"); // Move cursor down one line
            }

            // Move cursor back to the original starting position
            print!("\x1b[{}A", self.total_inserted_lines);

            // Ensure output is flushed to terminal
            let _ = io::stdout().flush();

            debug!(
                "Cleaned up {} inserted scrollback lines on TUI exit using cursor positioning",
                self.total_inserted_lines
            );
        }
    }

    // Helper methods
    fn get_current_running_task(&self) -> Option<String> {
        self.task_status_map
            .iter()
            .find(|(_, status)| **status == TaskStatus::InProgress)
            .map(|(id, _)| id.clone())
    }

    fn get_completed_task_count(&self) -> usize {
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
}
