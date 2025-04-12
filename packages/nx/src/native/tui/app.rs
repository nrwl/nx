use color_eyre::eyre::Result;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers, MouseEventKind};
use napi::bindgen_prelude::External;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use ratatui::layout::{Alignment, Rect};
use ratatui::style::Modifier;
use ratatui::style::{Color, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use tokio::sync::mpsc;
use tokio::sync::mpsc::UnboundedSender;
use tracing::debug;

use crate::native::pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc};
use crate::native::tasks::types::{Task, TaskResult};
use crate::native::tui::tui::Tui;

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
        let tasks_list = TasksList::new(tasks, pinned_tasks, title_text);
        let help_popup = HelpPopup::new();
        let countdown_popup = CountdownPopup::new();
        let focus = tasks_list.get_focus();
        let components: Vec<Box<dyn Component>> = vec![
            Box::new(tasks_list),
            Box::new(help_popup),
            Box::new(countdown_popup),
        ];

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
        })
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

    pub fn print_task_terminal_output(
        &mut self,
        task_id: String,
        status: TaskStatus,
        output: String,
    ) {
        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            // If the status is a cache hit, we need to create a new parser and writer for the task in order to print the output
            if is_cache_hit(status) {
                let (parser, parser_and_writer) = TasksList::create_empty_parser_and_noop_writer();

                // Add ANSI escape sequence to hide cursor at the end of output, it would be confusing to have it visible when a task is a cache hit
                let output_with_hidden_cursor = format!("{}\x1b[?25l", output);
                TasksList::write_output_to_parser(parser, output_with_hidden_cursor);

                tasks_list.create_and_register_pty_instance(&task_id, parser_and_writer);
                tasks_list.update_task_status(task_id.clone(), status);
                let _ = tasks_list.handle_resize(None);
                return;
            }

            // If the task is continuous, we are only updating the status, not the output
            if let Some(task) = tasks_list.tasks.iter_mut().find(|t| t.name == task_id) {
                if task.continuous {
                    tasks_list.update_task_status(task_id.clone(), status);
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
                    if matches!(tasks_list.get_focus(), Focus::MultipleOutput(_)) {
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

                    match tasks_list.get_focus() {
                        Focus::MultipleOutput(_) => {
                            if tasks_list.is_interactive_mode() {
                                // Send all other keys to the task list (and ultimately through the terminal pane to the PTY)
                                tasks_list.handle_key_event(key).ok();
                            } else {
                                // Handle navigation and special actions
                                match key.code {
                                    KeyCode::Tab => {
                                        tasks_list.focus_next();
                                        self.focus = tasks_list.get_focus();
                                    }
                                    KeyCode::BackTab => {
                                        tasks_list.focus_previous();
                                        self.focus = tasks_list.get_focus();
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
                                        tasks_list.toggle_task_list();
                                        self.focus = tasks_list.get_focus();
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
                                tasks_list.toggle_output_visibility();
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
                                                            '1' => tasks_list
                                                                .assign_current_task_to_pane(0),
                                                            '2' => tasks_list
                                                                .assign_current_task_to_pane(1),
                                                            '0' => tasks_list.clear_all_panes(),
                                                            'h' => tasks_list.previous_page(),
                                                            'l' => tasks_list.next_page(),
                                                            'b' => {
                                                                tasks_list.toggle_task_list();
                                                                self.focus = tasks_list.get_focus();
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
                                        if tasks_list.has_visible_panes() {
                                            tasks_list.focus_next();
                                            self.focus = tasks_list.get_focus();
                                        }
                                    }
                                    KeyCode::BackTab => {
                                        if tasks_list.has_visible_panes() {
                                            tasks_list.focus_previous();
                                            self.focus = tasks_list.get_focus();
                                        }
                                    }
                                    _ => {}
                                },
                                Focus::MultipleOutput(_idx) => match key.code {
                                    KeyCode::Tab => {
                                        tasks_list.focus_next();
                                        self.focus = tasks_list.get_focus();
                                    }
                                    KeyCode::BackTab => {
                                        tasks_list.focus_previous();
                                        self.focus = tasks_list.get_focus();
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
                            if matches!(tasks_list.get_focus(), Focus::MultipleOutput(_)) {
                                tasks_list
                                    .handle_key_event(KeyEvent::new(
                                        KeyCode::Up,
                                        KeyModifiers::empty(),
                                    ))
                                    .ok();
                            } else if matches!(tasks_list.get_focus(), Focus::TaskList) {
                                tasks_list.previous();
                            }
                        }
                        MouseEventKind::ScrollDown => {
                            if matches!(tasks_list.get_focus(), Focus::MultipleOutput(_)) {
                                tasks_list
                                    .handle_key_event(KeyEvent::new(
                                        KeyCode::Down,
                                        KeyModifiers::empty(),
                                    ))
                                    .ok();
                            } else if matches!(tasks_list.get_focus(), Focus::TaskList) {
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
        match action {
            // Quit immediately
            Action::Quit => self.quit_at = Some(std::time::Instant::now()),
            // Cancel quitting
            Action::CancelQuit => {
                self.quit_at = None;
                self.focus = self.previous_focus;
            }
            Action::Resize(w, h) => {
                tui.resize(Rect::new(0, 0, w, h)).ok();

                // Ensure the help popup is resized correctly
                if let Some(help_popup) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                {
                    help_popup.handle_resize(w, h);
                }

                // Propagate resize to PTY instances
                if let Some(tasks_list) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
                {
                    tasks_list.handle_resize(Some((w, h))).ok();
                }
                tui.draw(|f| {
                    for component in self.components.iter_mut() {
                        let r = component.draw(f, f.area());
                        if let Err(e) = r {
                            action_tx
                                .send(Action::Error(format!("Failed to draw: {:?}", e)))
                                .ok();
                        }
                    }
                })
                .ok();
            }
            Action::Render => {
                tui.draw(|f| {
                    let area = f.area();

                    // Check for minimum viable viewport size at the app level
                    if area.height < 10 || area.width < 40 {
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
                        let vertical_padding = (area.height as usize).saturating_sub(3) / 2;
                        for _ in 0..vertical_padding {
                            lines.push(empty_line.clone());
                        }

                        // Add the message
                        lines.push(message);

                        let paragraph = Paragraph::new(lines)
                            .alignment(Alignment::Center);
                        f.render_widget(paragraph, area);
                        return;
                    }

                    // Only render components if viewport is large enough
                    // Draw main components with dimming if a popup is focused
                    let current_focus = self.focus();
                    for component in self.components.iter_mut() {
                        if let Some(tasks_list) =
                            component.as_any_mut().downcast_mut::<TasksList>()
                        {
                            tasks_list.set_dimmed(matches!(current_focus, Focus::HelpPopup | Focus::CountdownPopup));
                            tasks_list.set_focus(current_focus);
                        }
                        let r = component.draw(f, f.area());
                        if let Err(e) = r {
                            action_tx
                                .send(Action::Error(format!("Failed to draw: {:?}", e)))
                                .ok();
                        }
                    }
                }).ok();
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
}
