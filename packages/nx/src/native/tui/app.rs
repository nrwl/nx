use color_eyre::eyre::Result;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers, MouseEventKind};
use hashbrown::HashSet;
use napi::bindgen_prelude::External;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use ratatui::layout::{Alignment, Rect, Size};
use ratatui::style::Modifier;
use ratatui::style::Style;
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Paragraph};
use std::collections::HashMap;
use std::io::{self, Write};
use std::sync::{Arc, Mutex, RwLock};
use tokio::sync::mpsc;
use tokio::sync::mpsc::UnboundedSender;
use tracing::{debug, trace};
use tui_logger::{LevelFilter, TuiLoggerSmartWidget, TuiWidgetEvent, TuiWidgetState};
use vt100_ctt::Parser;

use crate::native::tui::tui::Tui;
use crate::native::{
    pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc},
    tasks::types::{Task, TaskResult},
};

use super::action::Action;
use super::components::countdown_popup::CountdownPopup;
use super::components::help_popup::HelpPopup;
use super::components::layout_manager::{
    LayoutAreas, LayoutManager, PaneArrangement, TaskListVisibility,
};
use super::components::task_selection_manager::{SelectionMode, TaskSelectionManager};
use super::components::tasks_list::{TaskStatus, TasksList};
use super::components::terminal_pane::{TerminalPane, TerminalPaneData, TerminalPaneState};
use super::components::Component;
use super::config::TuiConfig;
use super::lifecycle::RunMode;
use super::pty::PtyInstance;
use super::theme::THEME;
use super::tui;
use super::utils::normalize_newlines;

pub struct App {
    pub components: Vec<Box<dyn Component>>,
    pub quit_at: Option<std::time::Instant>,
    focus: Focus,
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
    spacebar_mode: bool,
    pane_tasks: [Option<String>; 2], // Tasks assigned to panes 1 and 2 (0-indexed)
    task_list_hidden: bool,
    action_tx: Option<UnboundedSender<Action>>,
    resize_debounce_timer: Option<u128>, // Timer for debouncing resize events
    // task id -> pty instance
    pty_instances: HashMap<String, Arc<PtyInstance>>,
    selection_manager: Arc<Mutex<TaskSelectionManager>>,
    pinned_tasks: Vec<String>,
    tasks: Vec<Task>,
    debug_mode: bool,
    debug_state: TuiWidgetState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Focus {
    TaskList,
    MultipleOutput(usize),
    HelpPopup,
    CountdownPopup,
}

impl App {
    pub fn new(
        tasks: Vec<Task>,
        initiating_tasks: HashSet<String>,
        run_mode: RunMode,
        pinned_tasks: Vec<String>,
        tui_config: TuiConfig,
        title_text: String,
    ) -> Result<Self> {
        let task_count = tasks.len();
        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(5)));

        let initial_focus = Focus::TaskList;
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

        Ok(Self {
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
            layout_manager: LayoutManager::new(task_count),
            frame_area: None,
            layout_areas: None,
            terminal_pane_data: [main_terminal_pane_data, TerminalPaneData::new()],
            spacebar_mode: false,
            pane_tasks: [None, None],
            task_list_hidden: false,
            action_tx: None,
            resize_debounce_timer: None,
            pty_instances: HashMap::new(),
            selection_manager,
            tasks,
            debug_mode: false,
            debug_state: TuiWidgetState::default().set_default_display_level(LevelFilter::Debug),
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
                    self.display_and_focus_current_task_in_terminal_pane(true);
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
        self.dispatch_action(Action::StartTasks(tasks));
    }

    pub fn update_task_status(&mut self, task_id: String, status: TaskStatus) {
        self.dispatch_action(Action::UpdateTaskStatus(task_id.clone(), status));
    }

    pub fn print_task_terminal_output(&mut self, task_id: String, output: String) {
        // Tasks run within a pseudo-terminal always have a pty instance and do not need a new one
        // Tasks not run within a pseudo-terminal need a new pty instance to print output
        if !self.pty_instances.contains_key(&task_id) {
            let (parser, parser_and_writer) = Self::create_empty_parser_and_noop_writer();

            // Add ANSI escape sequence to hide cursor at the end of output, it would be confusing to have it visible when a task is a cache hit
            let output_with_hidden_cursor = format!("{}\x1b[?25l", output);
            Self::write_output_to_parser(parser, output_with_hidden_cursor);

            self.create_and_register_pty_instance(&task_id, parser_and_writer);
            // Ensure the pty instances get resized appropriately
            let _ = self.debounce_pty_resize();
            return;
        }

        // If the task is continuous, ensure the pty instances get resized appropriately
        if let Some(task) = self.tasks.iter_mut().find(|t| t.id == task_id) {
            if task.continuous.unwrap_or(false) {
                let _ = self.debounce_pty_resize();
            }
        }
    }

    pub fn end_tasks(&mut self, task_results: Vec<TaskResult>) {
        // When tasks finish ensure that pty instances are resized appropriately as they may be actively displaying output when they finish
        let _ = self.debounce_pty_resize();
        self.dispatch_action(Action::EndTasks(task_results));
    }

    // Show countdown popup for the configured duration (making sure the help popup is not open first)
    pub fn end_command(&mut self) {
        // If the user has interacted with the app, or auto-exit is disabled, do nothing
        if self.user_has_interacted || !self.tui_config.auto_exit.should_exit_automatically() {
            return;
        }

        self.begin_exit_countdown()
    }

    fn begin_exit_countdown(&mut self) {
        let countdown_duration = self.tui_config.auto_exit.countdown_seconds();
        // If countdown is disabled, exit immediately
        if countdown_duration.is_none() {
            self.quit_at = Some(std::time::Instant::now());
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
    pub fn register_running_task(
        &mut self,
        task_id: String,
        parser_and_writer: External<(ParserArc, WriterArc)>,
    ) {
        self.create_and_register_pty_instance(&task_id, parser_and_writer);
        self.update_task_status(task_id.clone(), TaskStatus::InProgress);
    }

    pub fn register_running_task_with_empty_parser(&mut self, task_id: String) {
        let (_, parser_and_writer) = Self::create_empty_parser_and_noop_writer();
        self.create_and_register_pty_instance(&task_id, parser_and_writer);
        self.update_task_status(task_id.clone(), TaskStatus::InProgress);
        // Ensure the pty instances get resized appropriately
        let _ = self.debounce_pty_resize();
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

                // Record that the user has interacted with the app
                self.user_has_interacted = true;

                // Handle Ctrl+C to quit, unless we're in interactive mode and the focus is on a terminal pane
                if key.code == KeyCode::Char('c')
                    && key.modifiers == KeyModifiers::CONTROL
                    && !(matches!(self.focus, Focus::MultipleOutput(_))
                        && self.is_interactive_mode())
                {
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
                        // Check if all tasks are in a completed state
                        let all_tasks_completed = tasks_list.tasks.iter().all(|t| {
                            matches!(
                                t.status,
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
                                        if !self.task_list_hidden {
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
                                    KeyCode::Left => {
                                        self.dispatch_action(Action::PreviousPage);
                                        let _ = self.debounce_pty_resize();
                                    }
                                    KeyCode::Right => {
                                        self.dispatch_action(Action::NextPage);
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
                                                            'h' => {
                                                                self.dispatch_action(
                                                                    Action::PreviousPage,
                                                                );
                                                                let _ = self.debounce_pty_resize();
                                                            }
                                                            'l' => {
                                                                self.dispatch_action(
                                                                    Action::NextPage,
                                                                );
                                                                let _ = self.debounce_pty_resize();
                                                            }
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
                // Record that the user has interacted with the app
                self.user_has_interacted = true;

                match mouse.kind {
                    MouseEventKind::ScrollUp => {
                        if matches!(self.focus, Focus::MultipleOutput(_)) {
                            self.handle_key_event(KeyEvent::new(
                                KeyCode::Up,
                                KeyModifiers::empty(),
                            ))
                            .ok();
                        } else if matches!(self.focus, Focus::TaskList) {
                            self.dispatch_action(Action::PreviousTask);
                        }
                    }
                    MouseEventKind::ScrollDown => {
                        if matches!(self.focus, Focus::MultipleOutput(_)) {
                            self.handle_key_event(KeyEvent::new(
                                KeyCode::Down,
                                KeyModifiers::empty(),
                            ))
                            .ok();
                        } else if matches!(self.focus, Focus::TaskList) {
                            self.dispatch_action(Action::NextTask);
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
            // Quit immediately
            Action::Quit => self.quit_at = Some(std::time::Instant::now()),
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

                    // Render terminal panes
                    for (pane_idx, pane_area) in layout_areas.terminal_panes.iter().enumerate() {
                        if let Some(tasks_list) = self
                            .components
                            .iter_mut()
                            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
                        {
                            let relevant_pane_task: Option<String> = if self.spacebar_mode {
                                // Don't unwrap - handle the None case gracefully
                                self.selection_manager
                                    .lock()
                                    .unwrap()
                                    .get_selected_task_name()
                                    .cloned()
                            } else {
                                // Clone if it exists, but don't unwrap
                                self.pane_tasks[pane_idx].clone()
                            };

                            if relevant_pane_task.is_none() {
                                // The user has chosen to display a pane but there is currently not task assigned to it, render a placeholder
                                // Render placeholder for pane 1
                                let placeholder = Paragraph::new(format!(
                                    "Press {} on a task to show it here",
                                    pane_idx + 1
                                ))
                                .block(
                                    Block::default()
                                        .title(format!("  Output {}  ", pane_idx + 1))
                                        .borders(Borders::ALL)
                                        .border_style(Style::default().fg(THEME.secondary_fg)),
                                )
                                .style(Style::default().fg(THEME.secondary_fg))
                                .alignment(Alignment::Center);

                                f.render_widget(placeholder, *pane_area);
                                continue;
                            }

                            let relevant_pane_task = relevant_pane_task.unwrap();
                            if let Some(task) = tasks_list
                                .tasks
                                .iter_mut()
                                .find(|t| t.name == relevant_pane_task)
                            {
                                let terminal_pane_data = &mut self.terminal_pane_data[pane_idx];
                                terminal_pane_data.is_continuous = task.continuous;
                                let in_progress = task.status == TaskStatus::InProgress;
                                terminal_pane_data.can_be_interactive = in_progress;
                                if !in_progress {
                                    terminal_pane_data.set_interactive(false);
                                }

                                let mut has_pty = false;
                                if let Some(pty) = self.pty_instances.get(&relevant_pane_task) {
                                    terminal_pane_data.pty = Some(pty.clone());
                                    has_pty = true;
                                }

                                let is_focused = match self.focus {
                                    Focus::MultipleOutput(focused_pane_idx) => {
                                        pane_idx == focused_pane_idx
                                    }
                                    _ => false,
                                };

                                // Figure out if this pane is the next tab target
                                let is_next_tab_target = !is_focused
                                    && match self.focus {
                                        // If the task list is focused, the next tab target is the first pane
                                        Focus::TaskList => pane_idx == 0,
                                        // If the first pane is focused, the next tab target is the second pane
                                        Focus::MultipleOutput(0) => pane_idx == 1,
                                        _ => false,
                                    };

                                let mut state = TerminalPaneState::new(
                                    task.name.clone(),
                                    task.status,
                                    task.continuous,
                                    is_focused,
                                    has_pty,
                                    is_next_tab_target,
                                );

                                let terminal_pane = TerminalPane::new()
                                    .pty_data(terminal_pane_data)
                                    .continuous(task.continuous);

                                f.render_stateful_widget(terminal_pane, *pane_area, &mut state);
                            }
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
        let tx = self.action_tx.clone().unwrap();
        tokio::spawn(async move {
            let _ = tx.send(action);
        });
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

    /// Clears all output panes and resets their associated state.
    fn clear_all_panes(&mut self) {
        self.pane_tasks = [None, None];
        self.update_focus(Focus::TaskList);
        self.set_spacebar_mode(false, None);
        self.dispatch_action(Action::UnpinAllTasks);
    }

    /// Toggles the visibility of the output pane for the currently selected task.
    /// In spacebar mode, the output follows the task selection.
    fn toggle_output_visibility(&mut self) {
        self.task_list_hidden = false;
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
                        if self.task_list_hidden {
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
                    } else if !self.task_list_hidden {
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
                    if !self.task_list_hidden {
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
        self.task_list_hidden = !self.task_list_hidden;
        self.layout_manager
            .set_task_list_visibility(if self.task_list_hidden {
                TaskListVisibility::Hidden
            } else {
                TaskListVisibility::Visible
            });
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

    /// Forward key events to the currently focused pane, if any.
    fn handle_key_event(&mut self, key: KeyEvent) -> io::Result<()> {
        if let Focus::MultipleOutput(pane_idx) = self.focus {
            let terminal_pane_data = &mut self.terminal_pane_data[pane_idx];
            terminal_pane_data.handle_key_event(key)
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
                let (pty_height, pty_width) = TerminalPane::calculate_pty_dimensions(*pane_area);

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

        Ok(())
    }

    fn create_and_register_pty_instance(
        &mut self,
        task_id: &str,
        parser_and_writer: External<(ParserArc, WriterArc)>,
    ) {
        // Access the contents of the External
        let parser_and_writer_clone = parser_and_writer.clone();
        let (parser, writer) = &parser_and_writer_clone;
        let pty = Arc::new(
            PtyInstance::new(task_id.to_string(), parser.clone(), writer.clone())
                .map_err(|e| napi::Error::from_reason(format!("Failed to create PTY: {}", e)))
                .unwrap(),
        );

        self.pty_instances.insert(task_id.to_string(), pty.clone());
    }

    fn create_empty_parser_and_noop_writer() -> (ParserArc, External<(ParserArc, WriterArc)>) {
        // Use sane defaults for rows, cols and scrollback buffer size. The dimensions will be adjusted dynamically later.
        let parser = Arc::new(RwLock::new(Parser::new(24, 80, 10000)));
        let writer: Arc<Mutex<Box<dyn Write + Send>>> =
            Arc::new(Mutex::new(Box::new(std::io::sink())));
        (parser.clone(), External::new((parser, writer)))
    }

    // Writes the given output to the given parser, used for the case where a task is a cache hit, or when it is run outside of the rust pseudo-terminal
    fn write_output_to_parser(parser: ParserArc, output: String) {
        let normalized_output = normalize_newlines(output.as_bytes());
        parser
            .write()
            .unwrap()
            .write_all(&normalized_output)
            .unwrap();
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
}
