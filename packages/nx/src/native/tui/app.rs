use super::task::{Task};
use super::{
    action::Action,
    components::{help_popup::HelpPopup, tasks_list::TasksList, Component},
    tui,
};
use color_eyre::eyre::Result;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers, MouseEventKind};
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction};
use ratatui::layout::{Alignment, Rect};
use ratatui::style::Modifier;
use ratatui::style::{Color, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use tokio::sync::mpsc;
use tokio::sync::mpsc::UnboundedSender;
use tracing::debug;
use crate::native::tui::tui::Tui;

pub struct App {
    pub tick_rate: f64,
    pub frame_rate: f64,
    pub components: Vec<Box<dyn Component>>,
    pub should_quit: bool,
    pub last_tick_key_events: Vec<KeyEvent>,
    focus: Focus,
    previous_focus: Focus,
    done_callback: Option<ThreadsafeFunction<(), ErrorStrategy::Fatal>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Focus {
    TaskList,
    MultipleOutput(usize),
    HelpPopup,
}

impl App {
    pub fn new(
        tick_rate: f64,
        frame_rate: f64,
        tasks: Vec<Task>,
        target_names: Vec<String>,
    ) -> Result<Self> {
        let tasks_list = TasksList::new(tasks, target_names);
        let help_popup = HelpPopup::new();

        let components: Vec<Box<dyn Component>> = vec![Box::new(tasks_list), Box::new(help_popup)];

        Ok(Self {
            tick_rate,
            frame_rate,
            components,
            should_quit: false,
            last_tick_key_events: Vec::new(),
            focus: Focus::TaskList,
            previous_focus: Focus::TaskList,
            done_callback: None,
        })
    }

    // Only needed for the prototype testing mode via main.rs
    // TODO: Remove this after Nx integration
    pub fn queue_all_tasks(&mut self) {
        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            tasks_list.queue_all_tasks();
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
                // Handle Ctrl+C to quit
                if key.code == KeyCode::Char('c') && key.modifiers == KeyModifiers::CONTROL {
                    return Ok(true);
                }

                // Get tasks list component to check interactive mode before handling '?' key
                if let Some(tasks_list) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
                {
                    // Only handle '?' key if we're not in interactive mode
                    if matches!(key.code, KeyCode::Char('?')) && !tasks_list.is_interactive_mode() {
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
                                if let Some(tasks_list) = self
                                    .components
                                    .iter_mut()
                                    .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
                                {
                                    tasks_list.toggle_output_visibility();
                                }
                                return Ok(false); // Skip other key handling
                            }

                            match self.focus {
                                Focus::TaskList => match key.code {
                                    KeyCode::Down | KeyCode::Char('j') => {
                                        if let Some(tasks_list) =
                                            self.components.iter_mut().find_map(|c| {
                                                c.as_any_mut().downcast_mut::<TasksList>()
                                            })
                                        {
                                            tasks_list.next();
                                        }
                                    }
                                    KeyCode::Up | KeyCode::Char('k') => {
                                        if let Some(tasks_list) =
                                            self.components.iter_mut().find_map(|c| {
                                                c.as_any_mut().downcast_mut::<TasksList>()
                                            })
                                        {
                                            tasks_list.previous();
                                        }
                                    }
                                    KeyCode::Left => {
                                        if let Some(tasks_list) =
                                            self.components.iter_mut().find_map(|c| {
                                                c.as_any_mut().downcast_mut::<TasksList>()
                                            })
                                        {
                                            tasks_list.previous_page();
                                        }
                                    }
                                    KeyCode::Right => {
                                        if let Some(tasks_list) =
                                            self.components.iter_mut().find_map(|c| {
                                                c.as_any_mut().downcast_mut::<TasksList>()
                                            })
                                        {
                                            tasks_list.next_page();
                                        }
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
                                            if let Some(tasks_list) =
                                                self.components.iter_mut().find_map(|c| {
                                                    c.as_any_mut().downcast_mut::<TasksList>()
                                                })
                                            {
                                                tasks_list.clear_filter();
                                            }
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
                                                            'b' => tasks_list.toggle_task_list(),
                                                            'q' => self.should_quit = true,
                                                            _ => {}
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    KeyCode::Backspace => {
                                        if let Some(tasks_list) =
                                            self.components.iter_mut().find_map(|c| {
                                                c.as_any_mut().downcast_mut::<TasksList>()
                                            })
                                        {
                                            if tasks_list.filter_mode {
                                                tasks_list.remove_filter_char();
                                            }
                                        }
                                    }
                                    KeyCode::Tab => {
                                        if let Some(tasks_list) =
                                            self.components.iter_mut().find_map(|c| {
                                                c.as_any_mut().downcast_mut::<TasksList>()
                                            })
                                        {
                                            if tasks_list.has_visible_panes() {
                                                tasks_list.focus_next();
                                                self.focus = tasks_list.get_focus();
                                            }
                                        }
                                    }
                                    KeyCode::BackTab => {
                                        if let Some(tasks_list) =
                                            self.components.iter_mut().find_map(|c| {
                                                c.as_any_mut().downcast_mut::<TasksList>()
                                            })
                                        {
                                            if tasks_list.has_visible_panes() {
                                                tasks_list.focus_previous();
                                                self.focus = tasks_list.get_focus();
                                            }
                                        }
                                    }
                                    _ => {}
                                },
                                Focus::MultipleOutput(_idx) => match key.code {
                                    KeyCode::Tab => {
                                        if let Some(tasks_list) =
                                            self.components.iter_mut().find_map(|c| {
                                                c.as_any_mut().downcast_mut::<TasksList>()
                                            })
                                        {
                                            tasks_list.focus_next();
                                            self.focus = tasks_list.get_focus();
                                        }
                                    }
                                    KeyCode::BackTab => {
                                        if let Some(tasks_list) =
                                            self.components.iter_mut().find_map(|c| {
                                                c.as_any_mut().downcast_mut::<TasksList>()
                                            })
                                        {
                                            tasks_list.focus_previous();
                                            self.focus = tasks_list.get_focus();
                                        }
                                    }
                                    _ => {}
                                },
                                Focus::HelpPopup => {
                                    // Shortcuts popup has its own key handling above
                                }
                            }
                        }
                    }
                }
            }
            tui::Event::Mouse(mouse) => {
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

    pub fn handle_action(&mut self, tui: &mut Tui, action: Action, action_tx: &UnboundedSender<Action>) {
        if action != Action::Tick && action != Action::Render {
            log::debug!("{action:?}");
        }
        match action {
            Action::Tick => {
                self.last_tick_key_events.drain(..);
            }
            Action::Quit => self.should_quit = true,
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
                    tasks_list.handle_resize(w, h).ok();
                }
                tui.draw(|f| {
                    for component in self.components.iter_mut() {
                        let r = component.draw(f, f.area());
                        if let Err(e) = r {
                            action_tx
                                .send(Action::Error(format!(
                                    "Failed to draw: {:?}",
                                    e
                                )))
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
                    if area.height < 12 || area.width < 40 {
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
                            Span::raw("Please make your terminal viewport larger in order to view the tasks UI"),
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
                    // Draw main components with dimming if popup is focused
                    let current_focus = self.focus();
                    for component in self.components.iter_mut() {
                        if let Some(tasks_list) =
                            component.as_any_mut().downcast_mut::<TasksList>()
                        {
                            tasks_list.set_dimmed(matches!(current_focus, Focus::HelpPopup));
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

    pub fn set_done_callback(&mut self, done_callback: ThreadsafeFunction<(), ErrorStrategy::Fatal>) {
        self.done_callback = Some(done_callback);
    }

    pub fn call_done_callback(&self) {
        if let Some(cb) = &self.done_callback {
            cb.call((), napi::threadsafe_function::ThreadsafeFunctionCallMode::Blocking);
        }
    }

    pub fn focus(&self) -> Focus {
        self.focus
    }
}
