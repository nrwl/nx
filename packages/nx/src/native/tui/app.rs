use color_eyre::eyre::Result;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers, MouseEventKind};
use napi::bindgen_prelude::External;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use ratatui::layout::{Alignment, Rect};
use ratatui::style::Modifier;
use ratatui::style::{Color, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Paragraph};
use tokio::sync::mpsc;
use tokio::sync::mpsc::UnboundedSender;
use tracing::debug;

use crate::native::pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc};
use crate::native::tasks::types::{Task, TaskResult};
use crate::native::tui::tui::Tui;

use super::components::layout_manager::{LayoutAreas, LayoutConfig, LayoutManager, PaneArrangement, TaskListVisibility};
use super::components::task_selection_manager::SelectionMode;
use super::components::terminal_pane::{TerminalPane, TerminalPaneData, TerminalPaneState};
use super::config::TuiConfig;
use super::utils::is_cache_hit;
use super::{
    action::Action,
    components::{
        countdown_popup::CountdownPopup,
        help_popup::HelpPopup,
        tasks_list::{TaskStatus, TasksList},
        Component,
    },
    tui,
};

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
    
    // Refactor
    layout_manager: LayoutManager,
    // Cached frame area used for layout calculations, only updated on terminal resize
    frame_area: Option<Rect>,
    // Cached result of layout manager's calculate_layout, only updated when necessary (e.g. terminal resize, task list visibility change etc)
    layout_areas: Option<LayoutAreas>,
    terminal_pane_data: [TerminalPaneData; 2],
    // The task that is currently visually selected in the tasks list
    selected_task: Option<String>,
    spacebar_mode: bool,
    pane_tasks: [Option<String>; 2], // Tasks assigned to panes 1 and 2 (0-indexed)
    task_list_hidden: bool,
    focused_pane: Option<usize>,     // Currently focused pane (if any)
    action_tx: Option<UnboundedSender<Action>>,
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
        pinned_tasks: Vec<String>,
        tui_config: TuiConfig,
        title_text: String,
    ) -> Result<Self> {
        let task_count = tasks.len();

        // Determine initial focus
        let mut focus = Focus::TaskList;
        let mut focused_pane = None;
        if let Some(main_task) = pinned_tasks.first() {
            // selection_manager.select_task(main_task.clone());
            // Auto-focus the main task
            focus = Focus::MultipleOutput(0);
            focused_pane = Some(0);
        }
        let mut iter = pinned_tasks.iter().take(2).map(|s| s.clone());
        let pane_tasks = [iter.next(), iter.next()];

        let tasks_list = TasksList::new(tasks, pinned_tasks, title_text, matches!(focus, Focus::TaskList));
        // let layout = Layout::new(tasks, pinned_tasks, title_text);
        let help_popup = HelpPopup::new();
        let countdown_popup = CountdownPopup::new();

        let components: Vec<Box<dyn Component>> = vec![
            // Box::new(layout),
            Box::new(tasks_list),
            Box::new(help_popup),
            Box::new(countdown_popup),
        ];

        let main_terminal_pane_data = TerminalPaneData::new();

        Ok(Self {
            components,
            quit_at: None,
            focus,
            previous_focus: Focus::TaskList,
            done_callback: None,
            forced_shutdown_callback: None,
            tui_config,
            user_has_interacted: false,
            is_forced_shutdown: false,
            layout_manager: LayoutManager::new(task_count),
            frame_area: None,
            layout_areas: None,
            terminal_pane_data: [main_terminal_pane_data, TerminalPaneData::default()],
            selected_task: None,
            spacebar_mode: false,
            pane_tasks,
            task_list_hidden: false,
            focused_pane,
            action_tx: None,
        })
    }

    pub fn register_action_handler(&mut self, tx: UnboundedSender<Action>) -> Result<()> {
        self.action_tx = Some(tx);
        Ok(())
    }

    pub fn start_command(&mut self, thread_count: Option<u32>) {
        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            tasks_list.set_max_parallel(thread_count);
        }
    }

    pub fn start_tasks(&mut self, tasks: Vec<Task>) {
        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            tasks_list.start_tasks(tasks);
        }
    }

    pub fn set_task_status(&mut self, task_id: String, status: TaskStatus) {
        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            tasks_list.set_task_status(task_id, status);
        }
    }

    pub fn print_task_terminal_output(&mut self, task_id: String, output: String) {
        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            // Tasks run within a pseudo-terminal always have a pty instance and do not need a new one
            // Tasks not run within a pseudo-terminal need a new pty instance to print output
            if !tasks_list.pty_instances.contains_key(&task_id) {
                let (parser, parser_and_writer) = TasksList::create_empty_parser_and_noop_writer();

                // Add ANSI escape sequence to hide cursor at the end of output, it would be confusing to have it visible when a task is a cache hit
                let output_with_hidden_cursor = format!("{}\x1b[?25l", output);
                TasksList::write_output_to_parser(parser, output_with_hidden_cursor);

                tasks_list.create_and_register_pty_instance(&task_id, parser_and_writer);
                let _ = tasks_list.handle_resize(None);
                return;
            }

            // If the task is continuous, we are only updating the status, not the output
            if let Some(task) = tasks_list.tasks.iter_mut().find(|t| t.name == task_id) {
                if task.continuous {
                    let _ = tasks_list.handle_resize(None);
                }
            }
        }
    }

    pub fn end_tasks(&mut self, task_results: Vec<TaskResult>) {
        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            tasks_list.end_tasks(task_results);
        }
    }

    // Show countdown popup for the configured duration (making sure the help popup is not open first)
    pub fn end_command(&mut self) {
        // If the user has interacted with the app, or auto-exit is disabled, do nothing
        if self.user_has_interacted || !self.tui_config.auto_exit.should_exit_automatically() {
            return;
        }

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
            self.previous_focus = self.focus;
            self.focus = Focus::CountdownPopup;
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
        task_status: TaskStatus,
    ) {
        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            tasks_list.create_and_register_pty_instance(&task_id, parser_and_writer);
            tasks_list.update_task_status(task_id.clone(), task_status);
        }
    }

    pub fn register_running_task_with_empty_parser(&mut self, task_id: String) {
        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            let (_, parser_and_writer) = TasksList::create_empty_parser_and_noop_writer();

            tasks_list.create_and_register_pty_instance(&task_id, parser_and_writer);
            tasks_list.update_task_status(task_id.clone(), TaskStatus::InProgress);
            let _ = tasks_list.handle_resize(None);
        }
    }

    pub fn append_task_output(&mut self, task_id: String, output: String) {
        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            let pty = tasks_list
                .pty_instances
                .get_mut(&task_id)
                .expect(&format!("{} has not been registered yet.", task_id));

            pty.process_output(output.as_bytes());
        }
    }

    pub fn handle_event(
        &mut self,
        event: tui::Event,
        action_tx: &mpsc::UnboundedSender<Action>,
    ) -> Result<bool> {
        match event {
            tui::Event::Quit => {
                action_tx.send(Action::Quit)?;
                return Ok(true);
            }
            tui::Event::Tick => action_tx.send(Action::Tick)?,
            tui::Event::Render => action_tx.send(Action::Render)?,
            tui::Event::Resize(x, y) => action_tx.send(Action::Resize(x, y))?,
            tui::Event::Key(key) => {
                debug!("Handling Key Event: {:?}", key);

                // Record that the user has interacted with the app
                self.user_has_interacted = true;

                // Handle Ctrl+C to quit
                if key.code == KeyCode::Char('c') && key.modifiers == KeyModifiers::CONTROL {
                    self.is_forced_shutdown = true;
                    // Quit immediately
                    self.quit_at = Some(std::time::Instant::now());
                    return Ok(true);
                }

                // Get tasks list component to check interactive mode before handling '?' key
                if let Some(tasks_list) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
                {
                    // Only handle '?' key if we're not in interactive mode and the countdown popup is not open
                    if matches!(key.code, KeyCode::Char('?'))
                        && !tasks_list.is_interactive_mode()
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
                            self.previous_focus = self.focus;
                            self.focus = Focus::HelpPopup;
                        } else {
                            self.focus = self.previous_focus;
                        }
                        return Ok(false);
                    }
                }

                // If countdown popup is open, handle its keyboard events
                if matches!(self.focus, Focus::CountdownPopup) {
                    // Any key pressed (other than scroll keys if the popup is scrollable) will cancel the countdown
                    if let Some(countdown_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
                    {
                        if !countdown_popup.is_scrollable() {
                            countdown_popup.cancel_countdown();
                            self.quit_at = None;
                            self.focus = self.previous_focus;
                            return Ok(false);
                        }
                        match key.code {
                            KeyCode::Up | KeyCode::Char('k') => {
                                countdown_popup.scroll_up();
                                return Ok(false);
                            }
                            KeyCode::Down | KeyCode::Char('j') => {
                                countdown_popup.scroll_down();
                                return Ok(false);
                            }
                            _ => {
                                countdown_popup.cancel_countdown();
                                self.quit_at = None;
                                self.focus = self.previous_focus;
                            }
                        }
                    }

                    return Ok(false);
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
                            self.focus = self.previous_focus;
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

                // Get tasks list component for handling key events
                if let Some(tasks_list) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
                {
                    // Handle Up/Down keys for scrolling first
                    if matches!(self.focus, Focus::MultipleOutput(_)) {
                        match key.code {
                            KeyCode::Up | KeyCode::Down => {
                                tasks_list.handle_key_event(key).ok();
                                return Ok(false);
                            }
                            KeyCode::Char('k') | KeyCode::Char('j')
                                if !tasks_list.is_interactive_mode() =>
                            {
                                tasks_list.handle_key_event(key).ok();
                                return Ok(false);
                            }
                            _ => {}
                        }
                    }

                    match self.focus {
                        Focus::MultipleOutput(_) => {
                            if tasks_list.is_interactive_mode() {
                                // Send all other keys to the task list (and ultimately through the terminal pane to the PTY)
                                tasks_list.handle_key_event(key).ok();
                            } else {
                                // Handle navigation and special actions
                                match key.code {
                                    KeyCode::Tab => {
                                        self.focus_next();
                                    }
                                    KeyCode::BackTab => {
                                        self.focus_previous();
                                    }
                                    // Add our new shortcuts here
                                    KeyCode::Char('c') => {
                                        tasks_list.handle_key_event(key).ok();
                                    }
                                    KeyCode::Char('u') | KeyCode::Char('d')
                                        if key.modifiers.contains(KeyModifiers::CONTROL) =>
                                    {
                                        tasks_list.handle_key_event(key).ok();
                                    }
                                    KeyCode::Char('b') => {
                                        self.toggle_task_list();
                                    }
                                    KeyCode::Char('m') => {
                                        self.cycle_layout_modes();
                                    }
                                    _ => {
                                        // Forward other keys for interactivity, scrolling (j/k) etc
                                        tasks_list.handle_key_event(key).ok();
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
                                        tasks_list.next();
                                    }
                                    KeyCode::Down => {
                                        tasks_list.next();
                                    }
                                    KeyCode::Char('k') if !is_filter_mode => {
                                        tasks_list.previous();
                                    }
                                    KeyCode::Up => {
                                        tasks_list.previous();
                                    }
                                    KeyCode::Left => {
                                        tasks_list.previous_page();
                                    }
                                    KeyCode::Right => {
                                        tasks_list.next_page();
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
                                            self.focus = self.previous_focus;
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
                                                        tasks_list.exit_filter_mode();
                                                    } else {
                                                        tasks_list.enter_filter_mode();
                                                    }
                                                }
                                                c => {
                                                    if tasks_list.filter_mode {
                                                        tasks_list.add_filter_char(c);
                                                    } else {
                                                        match c {
                                                            'j' => tasks_list.next(),
                                                            'k' => tasks_list.previous(),
                                                            '1' => self.assign_current_task_to_pane(0),
                                                            '2' => self.assign_current_task_to_pane(1),
                                                            '0' => self.clear_all_panes(),
                                                            'h' => tasks_list.previous_page(),
                                                            'l' => tasks_list.next_page(),
                                                            'b' => {
                                                                self.toggle_task_list();
                                                            }
                                                            'm' => {
                                                                self.cycle_layout_modes();
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
                                    _ => {}
                                },
                                Focus::MultipleOutput(_idx) => match key.code {
                                    KeyCode::Tab => {
                                        self.focus_next();
                                        // self.focus = tasks_list.get_focus();
                                    }
                                    KeyCode::BackTab => {
                                        self.focus_previous();
                                        // self.focus = tasks_list.get_focus();
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

                if let Some(tasks_list) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
                {
                    match mouse.kind {
                        MouseEventKind::ScrollUp => {
                            if matches!(self.focus, Focus::MultipleOutput(_)) {
                                tasks_list
                                    .handle_key_event(KeyEvent::new(
                                        KeyCode::Up,
                                        KeyModifiers::empty(),
                                    ))
                                    .ok();
                            } else if matches!(self.focus, Focus::TaskList) {
                                tasks_list.previous();
                            }
                        }
                        MouseEventKind::ScrollDown => {
                            if matches!(self.focus, Focus::MultipleOutput(_)) {
                                tasks_list
                                    .handle_key_event(KeyEvent::new(
                                        KeyCode::Down,
                                        KeyModifiers::empty(),
                                    ))
                                    .ok();
                            } else if matches!(self.focus, Focus::TaskList) {
                                tasks_list.next();
                            }
                        }
                        _ => {}
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
            debug!("{action:?}");
        }
        match &action {
            // Quit immediately
            Action::Quit => self.quit_at = Some(std::time::Instant::now()),
            // Cancel quitting
            Action::CancelQuit => {
                self.quit_at = None;
                self.focus = self.previous_focus;
            }
            Action::Resize(w, h) => {
                let rect = Rect::new(0, 0, *w, *h);
                tui.resize(rect).ok();
                // Update the cached frame area
                self.frame_area = Some(rect);
                // Recalculate the layout areas
                self.recalculate_layout_areas();

                // TODO: turn these into actions and handle them within the components???

                // Ensure the help popup is resized correctly
                if let Some(help_popup) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                {
                    help_popup.handle_resize(*w, *h);
                }

                // Propagate resize to PTY instances
                if let Some(tasks_list) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
                {
                    tasks_list.handle_resize(Some((*w, *h))).ok();
                }
            }
            Action::Render => {
                tui.draw(|f| {
                    let area = f.area();
                    // Cache the frame area if it's never been set before (will be updated in subsequent resize events if necessary)
                    if !self.frame_area.is_some() {
                        self.frame_area = Some(area);
                    }
                    // Determine the required layout areas for the tasks list and terminal panes using the LayoutManager
                    if !self.layout_areas.is_some() {
                        self.recalculate_layout_areas();
                    }

                    let frame_area = self.frame_area.unwrap();
                    let layout_areas = self.layout_areas.as_mut().unwrap();

                    // TODO: move this to the layout manager???
                    // Check for minimum viable viewport size at the app level
                    if frame_area.height < 10 || frame_area.width < 40 {
                        let message = Line::from(vec![
                            Span::raw("  "),
                            Span::styled(
                                " NX ",
                                Style::reset()
                                    .add_modifier(Modifier::BOLD)
                                    .bg(Color::Red)
                                    .fg(Color::Black),
                            ),
                            Span::raw("  "),
                            Span::raw("Please make your terminal viewport larger in order to view the terminal UI"),
                        ]);

                        // Create empty lines for vertical centering
                        let empty_line = Line::from("");
                        let mut lines = vec![];

                        // Add empty lines to center vertically
                        let vertical_padding = (frame_area.height as usize).saturating_sub(3) / 2;
                        for _ in 0..vertical_padding {
                            lines.push(empty_line.clone());
                        }

                        // Add the message
                        lines.push(message);

                        let paragraph = Paragraph::new(lines)
                            .alignment(Alignment::Center);
                        f.render_widget(paragraph, frame_area);
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
                            // TODO: unify with layout manager maybe???
                            let relevant_pane_task = if self.spacebar_mode {
                                self.selected_task.clone().unwrap()
                            } else {
                                self.pane_tasks[pane_idx].clone().unwrap()
                            };
                            
                            if let Some(task) = tasks_list.tasks.iter_mut().find(|t| t.name == relevant_pane_task) {
                                let mut terminal_pane_data = &mut self.terminal_pane_data[1];
                                terminal_pane_data.is_continuous = task.continuous;
                                    terminal_pane_data.is_cache_hit = is_cache_hit(task.status);
        
                                let mut has_pty = false;
                                if let Some(pty) = tasks_list.pty_instances.get(&relevant_pane_task) {
                                    terminal_pane_data.pty = Some(pty.clone());
                                    has_pty = true;
                                }
        
                                let is_focused = match self.focus {
                                    Focus::MultipleOutput(focused_pane_idx) => {
                                        pane_idx == focused_pane_idx
                                    }
                                    _ => false,
                                };
        
                                let mut state = TerminalPaneState::new(
                                    task.name.clone(),
                                    task.status,
                                    task.continuous,
                                    is_focused,
                                    has_pty,
                                );
        
                                let terminal_pane = TerminalPane::new()
                                    .pty_data(&mut terminal_pane_data)
                                    .continuous(task.continuous);
        
                                f.render_stateful_widget(
                                    terminal_pane,
                                    *pane_area,
                                    &mut state,
                                );
        
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
                }).ok();
            }
            Action::SelectTask(task_name) => {
                self.selected_task = Some(task_name.clone());
            }
            _ => {}
        }

        // Update components
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

    pub fn focus(&self) -> Focus {
        self.focus
    }

    pub fn set_cloud_message(&mut self, message: Option<String>) {
        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            tasks_list.set_cloud_message(message);
        }
    }

    pub fn recalculate_layout_areas(&mut self) {
        if let Some(frame_area) = self.frame_area {
            self.layout_areas = Some(self.layout_manager.calculate_layout(frame_area));
        }
    }

    /// Checks if the current view has any visible output panes.
    pub fn has_visible_panes(&self) -> bool {
        self.pane_tasks.iter().any(|t| t.is_some())
    }

    /// Clears all output panes and resets their associated state.
    pub fn clear_all_panes(&mut self) {
        self.pane_tasks = [None, None];
        self.focused_pane = None;
        self.focus = Focus::TaskList;
        self.set_spacebar_mode(false, None);

        let tx = self.action_tx.clone().unwrap();
        tokio::spawn(async move {
            tx.send(Action::UnpinAllTasks).unwrap();
        });
    }

    /// Toggles the visibility of the output pane for the currently selected task.
    /// In spacebar mode, the output follows the task selection.
    pub fn toggle_output_visibility(&mut self) {
        // Ensure task list is visible after every spacebar interaction
        self.task_list_hidden = false;
        self.layout_manager.set_task_list_visibility(TaskListVisibility::Visible);

        if let Some(task_name) = self.selected_task.clone() {
            if self.has_visible_panes() {
                // Always clear all panes when toggling with spacebar
                self.clear_all_panes();
                self.set_spacebar_mode(false, None);
            } else {
                // Show current task in pane 1 in spacebar mode
                self.pane_tasks = [Some(task_name.clone()), None];
                self.focused_pane = None;
                self.set_spacebar_mode(true, None);
            }
        }
    }

    fn set_spacebar_mode(&mut self, spacebar_mode: bool, selection_mode_override: Option<SelectionMode>) {
        self.spacebar_mode = spacebar_mode;

        if spacebar_mode {
            self.layout_manager.set_pane_arrangement(PaneArrangement::Single);
        } else {
            self.layout_manager.set_pane_arrangement(PaneArrangement::None);
        }

        // Recalculate the layout areas
        self.recalculate_layout_areas();

        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            tasks_list.set_spacebar_mode(spacebar_mode, selection_mode_override);
        }
    }

    pub fn focus_next(&mut self) {
        if !self.has_visible_panes() {
            return;
        }

        self.focus = match self.focus {
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

        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            tasks_list.set_focused(matches!(self.focus, Focus::TaskList));
        }
    }

    pub fn focus_previous(&mut self) {
        let num_panes = self.pane_tasks.iter().filter(|t| t.is_some()).count();
        if num_panes == 0 {
            return; // No panes to focus
        }

        self.focus = match self.focus {
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

        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            tasks_list.set_focused(matches!(self.focus, Focus::TaskList));
        }
    }

    pub fn toggle_task_list(&mut self) {
        // If there are no visible panes, do nothing otherwise the screen will be blank
        if !self.has_visible_panes() {
            return;
        }
        self.task_list_hidden = !self.task_list_hidden;
        self.layout_manager.set_task_list_visibility(if self.task_list_hidden { TaskListVisibility::Hidden } else { TaskListVisibility::Visible });
        self.recalculate_layout_areas();
    }

    pub fn cycle_layout_modes(&mut self) {
        // TODO: add visual feedback about layout modes
        self.layout_manager.cycle_layout_mode();
        self.recalculate_layout_areas();
    }

    pub fn assign_current_task_to_pane(&mut self, pane_idx: usize) {
        if let Some(task_name) = self.selected_task.clone() {
            // If we're in spacebar mode and this is pane 0, convert to pinned mode
            if self.spacebar_mode && pane_idx == 0 {
                self.focused_pane = Some(0);
                // When converting from spacebar to pinned, stay in name-tracking mode
                self.set_spacebar_mode(false, Some(SelectionMode::TrackByName));
                self.layout_manager.set_pane_arrangement(PaneArrangement::Single);
                
                let tx = self.action_tx.clone().unwrap();
                tokio::spawn(async move {
                    tx.send(Action::PinTask(task_name, pane_idx)).unwrap();
                });
            } else {
                // Check if the task is already pinned to the pane
                if self.pane_tasks[pane_idx].as_deref() == Some(task_name.as_str()) {
                    // Unpin the task if it's already pinned
                    self.pane_tasks[pane_idx] = None;

                    // Adjust focused pane if necessary
                    if !self.has_visible_panes() {
                        self.focused_pane = None;
                        self.focus = Focus::TaskList;
                        // When all panes are cleared, use position-based selection
                        self.set_spacebar_mode(false, Some(SelectionMode::TrackByPosition));
                    }

                    self.layout_manager.set_pane_arrangement(PaneArrangement::None);

                    let tx = self.action_tx.clone().unwrap();
                    tokio::spawn(async move {
                        tx.send(Action::UnpinTask(task_name, pane_idx)).unwrap();
                    });
                } else {
                    // Pin the task to the specified pane
                    self.pane_tasks[pane_idx] = Some(task_name.clone());
                    self.focused_pane = Some(pane_idx);
                    self.focus = Focus::TaskList;

                    // Exit spacebar mode when pinning
                    // When pinning a task, use name-based selection
                    self.set_spacebar_mode(false, Some(SelectionMode::TrackByName));

                    if pane_idx == 0 {
                        self.layout_manager.set_pane_arrangement(PaneArrangement::Single);
                    } else if pane_idx == 1 {
                        self.layout_manager.set_pane_arrangement(PaneArrangement::Double);
                    }

                    let tx = self.action_tx.clone().unwrap();
                    tokio::spawn(async move {
                        tx.send(Action::PinTask(task_name, pane_idx)).unwrap();
                    });
                }
            }

            // Always re-evaluate the optimal size of the terminal pane(s) and pty(s)
            // TODO: this isn't actually resizing the ptys right????
            self.recalculate_layout_areas();
        }
    }
}
