use arboard::Clipboard;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use ratatui::{
    buffer::Buffer,
    layout::{Alignment, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{
        Block, BorderType, Borders, Padding, Paragraph, Scrollbar, ScrollbarOrientation,
        ScrollbarState, StatefulWidget, Widget,
    },
};
use std::{io, sync::Arc};
use tui_term::widget::PseudoTerminal;

use crate::native::tui::pty::PtyInstance;

use super::tasks_list::TaskStatus;

pub struct TerminalPaneData {
    pub pty: Option<Arc<PtyInstance>>,
    pub is_interactive: bool,
    pub is_continuous: bool,
}

impl TerminalPaneData {
    pub fn new() -> Self {
        Self {
            pty: None,
            is_interactive: false,
            is_continuous: false,
        }
    }

    pub fn handle_key_event(&mut self, key: KeyEvent) -> io::Result<()> {
        if let Some(pty) = &mut self.pty {
            let mut pty_mut = pty.as_ref().clone();
            match key.code {
                // Handle arrow key based scrolling regardless of interactive mode
                KeyCode::Up => {
                    pty_mut.scroll_up();
                    return Ok(());
                }
                KeyCode::Down => {
                    pty_mut.scroll_down();
                    return Ok(());
                }
                // Handle j/k for scrolling when not in interactive mode
                KeyCode::Char('k') | KeyCode::Char('j') if !self.is_interactive => {
                    match key.code {
                        KeyCode::Char('k') => pty_mut.scroll_up(),
                        KeyCode::Char('j') => pty_mut.scroll_down(),
                        _ => {}
                    }
                    return Ok(());
                }
                // Handle ctrl+u and ctrl+d for scrolling when not in interactive mode
                KeyCode::Char('u')
                    if key.modifiers.contains(KeyModifiers::CONTROL) && !self.is_interactive =>
                {
                    // Scroll up a somewhat arbitrary "chunk" (12 lines)
                    for _ in 0..12 {
                        pty_mut.scroll_up();
                    }
                    return Ok(());
                }
                KeyCode::Char('d')
                    if key.modifiers.contains(KeyModifiers::CONTROL) && !self.is_interactive =>
                {
                    // Scroll down a somewhat arbitrary "chunk" (12 lines)
                    for _ in 0..12 {
                        pty_mut.scroll_down();
                    }
                    return Ok(());
                }
                // Handle 'c' for copying when not in interactive mode
                KeyCode::Char('c') if !self.is_interactive => {
                    if let Some(screen) = pty.get_screen() {
                        // Unformatted output (no ANSI escape codes)
                        let output = screen.all_contents();
                        match Clipboard::new() {
                            Ok(mut clipboard) => {
                                clipboard.set_text(output).ok();
                            }
                            Err(_) => {
                                // TODO: Is there a way to handle this error? Maybe a new kind of error popup?
                            }
                        }
                    }
                    return Ok(());
                }
                // Handle 'i' to enter interactive mode for continuous tasks
                KeyCode::Char('i') if !self.is_interactive => {
                    self.set_interactive(true);
                    return Ok(());
                }
                // Handle Ctrl+Z to exit interactive mode
                KeyCode::Char('z')
                    if key.modifiers == KeyModifiers::CONTROL && self.is_interactive =>
                {
                    self.set_interactive(false);
                    return Ok(());
                }
                // Only send input to PTY if we're in interactive mode
                _ if self.is_interactive => match key.code {
                    KeyCode::Char(c) => {
                        pty_mut.write_input(c.to_string().as_bytes())?;
                    }
                    KeyCode::Enter => {
                        pty_mut.write_input(b"\r")?;
                    }
                    KeyCode::Esc => {
                        pty_mut.write_input(&[0x1b])?;
                    }
                    KeyCode::Backspace => {
                        pty_mut.write_input(&[0x7f])?;
                    }
                    _ => {}
                },
                _ => {}
            }
        }
        Ok(())
    }

    pub fn set_interactive(&mut self, interactive: bool) {
        self.is_interactive = interactive;
    }

    pub fn is_interactive(&self) -> bool {
        self.is_interactive
    }
}

impl Default for TerminalPaneData {
    fn default() -> Self {
        Self::new()
    }
}

pub struct TerminalPaneState {
    pub task_name: String,
    pub task_status: TaskStatus,
    pub is_continuous: bool,
    pub is_focused: bool,
    pub scroll_offset: usize,
    pub scrollbar_state: ScrollbarState,
    pub has_pty: bool,
}

impl TerminalPaneState {
    pub fn new(
        task_name: String,
        task_status: TaskStatus,
        is_continuous: bool,
        is_focused: bool,
        has_pty: bool,
    ) -> Self {
        Self {
            task_name,
            task_status,
            is_continuous,
            is_focused,
            scroll_offset: 0,
            scrollbar_state: ScrollbarState::default(),
            has_pty,
        }
    }
}

pub struct TerminalPane<'a> {
    pty_data: Option<&'a mut TerminalPaneData>,
    is_continuous: bool,
}

impl<'a> TerminalPane<'a> {
    pub fn new() -> Self {
        Self {
            pty_data: None,
            is_continuous: false,
        }
    }

    pub fn pty_data(mut self, data: &'a mut TerminalPaneData) -> Self {
        self.pty_data = Some(data);
        self
    }

    pub fn continuous(mut self, continuous: bool) -> Self {
        self.is_continuous = continuous;
        self
    }

    fn get_status_icon(&self, status: TaskStatus) -> Span {
        match status {
            TaskStatus::Success => Span::styled(
                "  ✔  ",
                Style::default()
                    .fg(Color::Green)
                    .add_modifier(Modifier::BOLD),
            ),
            TaskStatus::LocalCacheKeptExisting | TaskStatus::LocalCache => Span::styled(
                "  ⚡ ",
                Style::default()
                    .fg(Color::Green)
                    .add_modifier(Modifier::BOLD),
            ),
            TaskStatus::RemoteCache => Span::styled(
                "  ⚡▼  ",
                Style::default()
                    .fg(Color::Green)
                    .add_modifier(Modifier::BOLD),
            ),
            TaskStatus::Failure => Span::styled(
                "  ✖  ",
                Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
            ),
            TaskStatus::Skipped => Span::styled(
                "  ⏭  ",
                Style::default()
                    .fg(Color::Yellow)
                    .add_modifier(Modifier::BOLD),
            ),
            TaskStatus::InProgress => Span::styled(
                "  ●  ",
                Style::default()
                    .fg(Color::LightCyan)
                    .add_modifier(Modifier::BOLD),
            ),
            TaskStatus::NotStarted => Span::styled(
                "  ·  ",
                Style::default()
                    .fg(Color::DarkGray)
                    .add_modifier(Modifier::BOLD),
            ),
        }
    }

    fn get_base_style(&self, status: TaskStatus) -> Style {
        Style::default().fg(match status {
            TaskStatus::Success
            | TaskStatus::LocalCacheKeptExisting
            | TaskStatus::LocalCache
            | TaskStatus::RemoteCache => Color::Green,
            TaskStatus::Failure => Color::Red,
            TaskStatus::Skipped => Color::Yellow,
            TaskStatus::InProgress => Color::LightCyan,
            TaskStatus::NotStarted => Color::DarkGray,
        })
    }

    /// Calculates appropriate pty dimensions by applying relevant borders and padding adjustments to the given area
    pub fn calculate_pty_dimensions(area: Rect) -> (u16, u16) {
        // Account for borders and padding correctly
        let pty_height = area
            .height
            .saturating_sub(2) // borders
            .saturating_sub(2); // padding (1 top + 1 bottom)
        let pty_width = area
            .width
            .saturating_sub(2) // borders
            .saturating_sub(4) // padding (2 left + 2 right)
            .saturating_sub(1); // 1 extra (based on empirical testing) to ensure characters are not cut off

        // Ensure minimum sizes
        let pty_height = pty_height.max(3);
        let pty_width = pty_width.max(20);

        (pty_height, pty_width)
    }

    /// Returns whether currently in interactive mode.
    pub fn is_currently_interactive(&self) -> bool {
        self.pty_data
            .as_ref()
            .map(|data| data.is_interactive)
            .unwrap_or(false)
    }
}

impl<'a> StatefulWidget for TerminalPane<'a> {
    type State = TerminalPaneState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        let base_style = self.get_base_style(state.task_status);
        let border_style = if state.is_focused {
            base_style
        } else {
            base_style.add_modifier(Modifier::DIM)
        };

        let status_icon = self.get_status_icon(state.task_status);
        let block = Block::default()
            .title(Line::from(vec![
                status_icon.clone(),
                Span::raw(format!("{}  ", state.task_name))
                    .style(Style::default().fg(Color::White)),
            ]))
            .title_alignment(Alignment::Left)
            .borders(Borders::ALL)
            .border_type(BorderType::Plain)
            .border_style(border_style)
            .padding(Padding::new(2, 2, 1, 1));

        // If task hasn't started yet, show pending message
        if matches!(state.task_status, TaskStatus::NotStarted) {
            let message = vec![Line::from(vec![Span::styled(
                "Task is pending...",
                Style::default().fg(Color::DarkGray),
            )])];

            let paragraph = Paragraph::new(message)
                .block(block)
                .alignment(Alignment::Center)
                .style(Style::default());

            Widget::render(paragraph, area, buf);
            return;
        }

        // If the task is in progress, we need to check if a pty instance is available, and if not
        // it implies that the task is being run outside the pseudo-terminal and all we can do is
        // wait for the task results to arrive
        if matches!(state.task_status, TaskStatus::InProgress) && !state.has_pty {
            let message = vec![Line::from(vec![Span::styled(
                "Waiting for task results...",
                if state.is_focused {
                    self.get_base_style(TaskStatus::InProgress)
                } else {
                    self.get_base_style(TaskStatus::InProgress)
                        .add_modifier(Modifier::DIM)
                },
            )])];

            let paragraph = Paragraph::new(message)
                .block(block)
                .alignment(Alignment::Center)
                .style(Style::default());

            Widget::render(paragraph, area, buf);
            return;
        }

        let inner_area = block.inner(area);

        if let Some(pty_data) = &self.pty_data {
            if let Some(pty) = &pty_data.pty {
                if let Some(screen) = pty.get_screen() {
                    let viewport_height = inner_area.height;
                    let current_scroll = pty.get_scroll_offset();

                    let total_content_rows = pty.get_total_content_rows();
                    let scrollable_rows =
                        total_content_rows.saturating_sub(viewport_height as usize);
                    let needs_scrollbar = scrollable_rows > 0;

                    // Reset scrollbar state if no scrolling needed
                    state.scrollbar_state = if needs_scrollbar {
                        let position = scrollable_rows.saturating_sub(current_scroll);
                        state
                            .scrollbar_state
                            .content_length(scrollable_rows)
                            .viewport_content_length(viewport_height as usize)
                            .position(position)
                    } else {
                        ScrollbarState::default()
                    };

                    let pseudo_term = PseudoTerminal::new(&screen).block(block);
                    Widget::render(pseudo_term, area, buf);

                    // Only render scrollbar if needed
                    if needs_scrollbar {
                        let scrollbar = Scrollbar::default()
                            .orientation(ScrollbarOrientation::VerticalRight)
                            .begin_symbol(Some("↑"))
                            .end_symbol(Some("↓"))
                            .style(border_style);

                        scrollbar.render(area, buf, &mut state.scrollbar_state);
                    }

                    // Show interactive/readonly status for focused tasks
                    if state.is_focused {
                        // Bottom right status
                        let bottom_text = if self.is_currently_interactive() {
                            Line::from(vec![
                                Span::raw("  "),
                                Span::styled("<ctrl>+z", Style::default().fg(Color::Cyan)),
                                Span::styled(
                                    " to exit interactive  ",
                                    Style::default().fg(Color::White),
                                ),
                            ])
                        } else {
                            Line::from(vec![
                                Span::raw("  "),
                                Span::styled("i", Style::default().fg(Color::Cyan)),
                                Span::styled(
                                    " to make interactive  ",
                                    Style::default().fg(Color::DarkGray),
                                ),
                            ])
                        };

                        let text_width = bottom_text
                            .spans
                            .iter()
                            .map(|span| span.content.len())
                            .sum::<usize>();

                        let bottom_right_area = Rect {
                            x: area.x + area.width - text_width as u16 - 3,
                            y: area.y + area.height - 1,
                            width: text_width as u16 + 2,
                            height: 1,
                        };

                        Paragraph::new(bottom_text)
                            .alignment(Alignment::Right)
                            .style(border_style)
                            .render(bottom_right_area, buf);

                        // Top right status
                        let top_text = if self.is_currently_interactive() {
                            Line::from(vec![Span::styled(
                                "  INTERACTIVE  ",
                                Style::default().fg(Color::White),
                            )])
                        } else {
                            Line::from(vec![Span::styled(
                                "  NON-INTERACTIVE  ",
                                Style::default().fg(Color::DarkGray),
                            )])
                        };

                        let mode_width = top_text
                            .spans
                            .iter()
                            .map(|span| span.content.len())
                            .sum::<usize>();

                        let top_right_area = Rect {
                            x: area.x + area.width - mode_width as u16 - 3,
                            y: area.y,
                            width: mode_width as u16 + 2,
                            height: 1,
                        };

                        Paragraph::new(top_text)
                            .alignment(Alignment::Right)
                            .style(border_style)
                            .render(top_right_area, buf);
                    } else if needs_scrollbar {
                        // Render padding for both top and bottom when scrollbar is present
                        let padding_text = Line::from(vec![Span::raw("  ")]);
                        let padding_width = 2;

                        // Top padding
                        let top_right_area = Rect {
                            x: area.x + area.width - padding_width - 3,
                            y: area.y,
                            width: padding_width + 2,
                            height: 1,
                        };

                        Paragraph::new(padding_text.clone())
                            .alignment(Alignment::Right)
                            .style(border_style)
                            .render(top_right_area, buf);

                        // Bottom padding
                        let bottom_right_area = Rect {
                            x: area.x + area.width - padding_width - 3,
                            y: area.y + area.height - 1,
                            width: padding_width + 2,
                            height: 1,
                        };

                        Paragraph::new(padding_text)
                            .alignment(Alignment::Right)
                            .style(border_style)
                            .render(bottom_right_area, buf);
                    }
                }
            }
        }
    }
}
