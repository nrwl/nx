use arboard::Clipboard;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers, MouseEvent, MouseEventKind};
use ratatui::{
    buffer::Buffer,
    layout::{Alignment, Rect},
    style::{Modifier, Style, Stylize},
    text::{Line, Span},
    widgets::{
        Block, BorderType, Borders, Padding, Paragraph, Scrollbar, ScrollbarOrientation,
        ScrollbarState, StatefulWidget, Widget,
    },
};
use std::{io, sync::Arc};
use tracing::debug;
use tui_term::widget::PseudoTerminal;

use crate::native::tui::components::tasks_list::TaskStatus;
use crate::native::tui::scroll_momentum::{ScrollDirection, ScrollMomentum};
use crate::native::tui::theme::THEME;
use crate::native::tui::{action::Action, pty::PtyInstance};

pub struct TerminalPaneData {
    pub pty: Option<Arc<PtyInstance>>,
    pub is_interactive: bool,
    pub is_continuous: bool,
    pub can_be_interactive: bool,
    // Momentum scrolling state
    scroll_momentum: ScrollMomentum,
}

impl TerminalPaneData {
    pub fn new() -> Self {
        Self {
            pty: None,
            is_interactive: false,
            is_continuous: false,
            can_be_interactive: false,
            scroll_momentum: ScrollMomentum::new(),
        }
    }

    pub fn handle_key_event(&mut self, key: KeyEvent) -> io::Result<Option<Action>> {
        if let Some(pty) = &mut self.pty {
            let mut pty_mut = pty.as_ref().clone();
            match key.code {
                // Scrolling keybindings (up/down arrow keys or 'k'/'j') are only handled if we're not in interactive mode.
                // If interactive, the event falls through to be forwarded to the PTY so that we can support things like interactive prompts within tasks.
                KeyCode::Up | KeyCode::Char('k') if !self.is_interactive => {
                    self.scroll(ScrollDirection::Up);
                    return Ok(None);
                }
                KeyCode::Down | KeyCode::Char('j') if !self.is_interactive => {
                    self.scroll(ScrollDirection::Down);
                    return Ok(None);
                }
                // Handle ctrl+u and ctrl+d for scrolling when not in interactive mode
                KeyCode::Char('u')
                    if key.modifiers.contains(KeyModifiers::CONTROL) && !self.is_interactive =>
                {
                    pty_mut.scroll_up(12);
                    return Ok(None);
                }
                KeyCode::Char('d')
                    if key.modifiers.contains(KeyModifiers::CONTROL) && !self.is_interactive =>
                {
                    pty_mut.scroll_down(12);
                    return Ok(None);
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
                    return Ok(None);
                }
                // Handle 'i' to enter interactive mode for in progress tasks
                KeyCode::Char('i') if self.can_be_interactive && !self.is_interactive => {
                    self.set_interactive(true);
                    return Ok(None);
                }
                KeyCode::Char('a')
                    if key.modifiers.contains(KeyModifiers::CONTROL) && !self.is_interactive =>
                {
                    let Some(screen) = pty.get_screen() else {
                        return Ok(None);
                    };
                    return Ok(Some(Action::SendConsoleMessage(screen.all_contents())));
                }
                // Only send input to PTY if we're in interactive mode
                _ if self.is_interactive => match key.code {
                    KeyCode::Char(c) if key.modifiers.contains(KeyModifiers::CONTROL) => {
                        let ascii_code = (c as u8) - 0x60;
                        debug!("Sending ASCII code: {}", &[ascii_code].escape_ascii());
                        pty_mut.write_input(&[ascii_code])?;
                    }
                    KeyCode::Char(c) => {
                        pty_mut.write_input(c.to_string().as_bytes())?;
                    }
                    KeyCode::Up | KeyCode::Down => {
                        pty_mut.handle_arrow_keys(key);
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
        Ok(None)
    }

    pub fn handle_mouse_event(&mut self, event: MouseEvent) -> io::Result<()> {
        if let Some(pty) = &mut self.pty {
            let mut pty_mut = pty.as_ref().clone();
            if self.is_interactive {
                pty_mut.send_mouse_event(event);
            } else {
                match event.kind {
                    MouseEventKind::ScrollUp => {
                        self.scroll(ScrollDirection::Up);
                    }
                    MouseEventKind::ScrollDown => {
                        self.scroll(ScrollDirection::Down);
                    }
                    _ => {}
                }
            }
        }
        Ok(())
    }

    pub fn set_interactive(&mut self, interactive: bool) {
        self.is_interactive = interactive;
        // Reset scroll momentum when changing modes
        self.scroll_momentum.reset();
    }

    pub fn is_interactive(&self) -> bool {
        self.is_interactive
    }

    /// Scroll with momentum in the given direction
    fn scroll(&mut self, direction: ScrollDirection) {
        if let Some(pty) = &self.pty {
            let mut pty_mut = pty.as_ref().clone();
            let scroll_amount = self.scroll_momentum.calculate_momentum(direction);

            match direction {
                ScrollDirection::Up => pty_mut.scroll_up(scroll_amount),
                ScrollDirection::Down => pty_mut.scroll_down(scroll_amount),
            }
        }
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
    pub is_next_tab_target: bool,
    pub console_available: bool,
    // Cache expected viewport dimensions for consistent scrollbar calculations
    pub expected_viewport_height: Option<u16>,
}

impl TerminalPaneState {
    pub fn new(
        task_name: String,
        task_status: TaskStatus,
        is_continuous: bool,
        is_focused: bool,
        has_pty: bool,
        is_next_tab_target: bool,
        console_available: bool,
    ) -> Self {
        Self {
            task_name,
            task_status,
            is_continuous,
            is_focused,
            scroll_offset: 0,
            scrollbar_state: ScrollbarState::default(),
            has_pty,
            is_next_tab_target,
            console_available,
            expected_viewport_height: None,
        }
    }
}

pub struct TerminalPane<'a> {
    pty_data: Option<&'a mut TerminalPaneData>,
    is_continuous: bool,
    minimal: bool,
}

impl<'a> TerminalPane<'a> {
    pub fn new() -> Self {
        Self {
            pty_data: None,
            is_continuous: false,
            minimal: false,
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

    pub fn minimal(mut self, minimal: bool) -> Self {
        self.minimal = minimal;
        self
    }

    fn get_status_icon(&self, status: TaskStatus) -> Span {
        match status {
            TaskStatus::Success
            | TaskStatus::LocalCacheKeptExisting
            | TaskStatus::LocalCache
            | TaskStatus::RemoteCache => Span::styled(
                "  ✔  ",
                Style::default()
                    .fg(THEME.success)
                    .add_modifier(Modifier::BOLD),
            ),
            TaskStatus::Failure => Span::styled(
                "  ✖  ",
                Style::default()
                    .fg(THEME.error)
                    .add_modifier(Modifier::BOLD),
            ),
            TaskStatus::Skipped => Span::styled(
                "  ⏭  ",
                Style::default()
                    .fg(THEME.warning)
                    .add_modifier(Modifier::BOLD),
            ),
            TaskStatus::InProgress | TaskStatus::Shared => Span::styled(
                "  ●  ",
                Style::default().fg(THEME.info).add_modifier(Modifier::BOLD),
            ),
            TaskStatus::Stopped => Span::styled(
                "  ◼  ",
                Style::default()
                    .fg(THEME.secondary_fg)
                    .add_modifier(Modifier::BOLD),
            ),
            TaskStatus::NotStarted => Span::styled(
                "  ·  ",
                Style::default()
                    .fg(THEME.secondary_fg)
                    .add_modifier(Modifier::BOLD),
            ),
        }
    }

    fn get_base_style(&self, status: TaskStatus) -> Style {
        Style::default().fg(match status {
            TaskStatus::Success
            | TaskStatus::LocalCacheKeptExisting
            | TaskStatus::LocalCache
            | TaskStatus::RemoteCache => THEME.success,
            TaskStatus::Failure => THEME.error,
            TaskStatus::Skipped => THEME.warning,
            TaskStatus::InProgress | TaskStatus::Shared => THEME.info,
            TaskStatus::NotStarted | TaskStatus::Stopped => THEME.secondary_fg,
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

    /// Calculate content rows based on expected viewport height, not current PTY dimensions.
    /// This provides consistent scrollbar calculations even when PTY hasn't been resized yet.
    fn calculate_content_rows_for_viewport(
        &self,
        pty: &crate::native::tui::pty::PtyInstance,
        expected_viewport_height: u16,
    ) -> usize {
        // Try to get current content rows from PTY
        let current_content_rows = pty.get_total_content_rows();

        // If we have a cached viewport height and it differs from expected,
        // we need to estimate content based on the expected dimensions
        if let Some(screen) = pty.get_screen() {
            let (current_rows, _current_cols) = screen.size();

            // If current PTY dimensions match expected viewport, use current calculation
            if current_rows == expected_viewport_height {
                return current_content_rows;
            }

            // Otherwise, estimate content rows based on expected viewport height
            // This is a simple heuristic: assume content scales linearly with viewport height
            if current_rows > 0 {
                let scale_factor = expected_viewport_height as f64 / current_rows as f64;
                let estimated_content = (current_content_rows as f64 * scale_factor) as usize;
                return estimated_content.max(expected_viewport_height as usize);
            }
        }

        // Fallback to current calculation
        current_content_rows
    }
}

// This lifetime is needed for our terminal pane data, it breaks without it
#[allow(clippy::needless_lifetimes)]
impl<'a> StatefulWidget for TerminalPane<'a> {
    type State = TerminalPaneState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        // Add bounds checking to prevent panic when terminal is too narrow
        // Safety check: ensure area is at least 5x5 to render anything properly
        if area.width < 5 || area.height < 5 {
            // Just render a minimal indicator instead of a full pane
            let safe_area = Rect {
                x: area.x,
                y: area.y,
                width: area.width.min(buf.area().width.saturating_sub(area.x)),
                height: area.height.min(buf.area().height.saturating_sub(area.y)),
            };

            if safe_area.width > 0 && safe_area.height > 0 {
                // Only attempt to render if we have a valid area
                let text = "...";
                let paragraph = Paragraph::new(text)
                    .style(Style::default().fg(THEME.secondary_fg))
                    .alignment(Alignment::Center);
                Widget::render(paragraph, safe_area, buf);
            }
            return;
        }

        // Ensure the area doesn't extend beyond buffer boundaries
        let safe_area = Rect {
            x: area.x,
            y: area.y,
            width: area.width.min(buf.area().width.saturating_sub(area.x)),
            height: area.height.min(buf.area().height.saturating_sub(area.y)),
        };

        let base_style = self.get_base_style(state.task_status);
        let border_style = if state.is_focused {
            base_style
        } else {
            base_style.add_modifier(Modifier::DIM)
        };

        let status_icon = self.get_status_icon(state.task_status);

        let mut title = vec![];

        if self.minimal {
            title.push(Span::styled(
                " NX ",
                Style::default().fg(THEME.primary_fg).bold().bg(base_style
                    .fg
                    .expect("Base style should have foreground color")),
            ));
            title.push(Span::raw("  "));
        } else {
            title.push(status_icon.clone());
        }
        title.push(Span::styled(
            format!("{}  ", state.task_name),
            Style::default().fg(if state.is_focused {
                THEME.primary_fg
            } else {
                THEME.secondary_fg
            }),
        ));

        if state.is_next_tab_target {
            let tab_target_text =
                Span::raw("Press <tab> to focus output ").remove_modifier(Modifier::DIM);
            // In light themes, use the primary fg color for the tab target text to make sure it's clearly visible
            if !THEME.is_dark_mode {
                title.push(tab_target_text.fg(THEME.primary_fg));
            } else {
                title.push(tab_target_text);
            }
        }

        let block = Block::default()
            .title(title)
            .title_alignment(Alignment::Left)
            .borders(if self.minimal {
                Borders::NONE
            } else {
                Borders::ALL
            })
            .border_type(if state.is_focused {
                BorderType::Thick
            } else {
                BorderType::Plain
            })
            .border_style(border_style)
            .padding(Padding::new(2, 2, 1, 1));

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

            Widget::render(paragraph, safe_area, buf);
            return;
        }

        // If the task is in progress, we need to check if a pty instance is available, and if not
        // it implies that the task is being run outside the pseudo-terminal and all we can do is
        // wait for the task results to arrive
        if matches!(state.task_status, TaskStatus::Shared) && !state.has_pty {
            let message = vec![Line::from(vec![Span::styled(
                "Running in another Nx process...",
                if state.is_focused {
                    self.get_base_style(TaskStatus::Shared)
                } else {
                    self.get_base_style(TaskStatus::Shared)
                        .add_modifier(Modifier::DIM)
                },
            )])];

            let paragraph = Paragraph::new(message)
                .block(block)
                .alignment(Alignment::Center)
                .style(Style::default());

            Widget::render(paragraph, safe_area, buf);
            return;
        }

        // If the task has been stopped but does not have a pty
        if matches!(state.task_status, TaskStatus::Stopped) && !state.has_pty {
            let message = vec![Line::from(vec![Span::styled(
                "Running in another Nx process...",
                if state.is_focused {
                    self.get_base_style(TaskStatus::Stopped)
                } else {
                    self.get_base_style(TaskStatus::Stopped)
                        .add_modifier(Modifier::DIM)
                },
            )])];

            let paragraph = Paragraph::new(message)
                .block(block)
                .alignment(Alignment::Center)
                .style(Style::default());

            Widget::render(paragraph, safe_area, buf);
            return;
        }

        // If the task was skipped, show skipped message
        if matches!(state.task_status, TaskStatus::Skipped) {
            let message_style = if state.is_focused {
                self.get_base_style(TaskStatus::Skipped)
            } else {
                self.get_base_style(TaskStatus::Skipped)
                    .add_modifier(Modifier::DIM)
            };
            let message = vec![Line::from(vec![Span::styled(
                "Task was skipped",
                message_style,
            )])];

            let paragraph = Paragraph::new(message)
                .block(block)
                .alignment(Alignment::Center)
                .style(Style::default());

            Widget::render(paragraph, safe_area, buf);
            return;
        }

        // If the task completed successfully but has no PTY output (e.g., nx:noop tasks), show completion message
        if matches!(
            state.task_status,
            TaskStatus::Success
                | TaskStatus::LocalCache
                | TaskStatus::LocalCacheKeptExisting
                | TaskStatus::RemoteCache
        ) && !state.has_pty
        {
            let message_style = if state.is_focused {
                self.get_base_style(state.task_status)
            } else {
                self.get_base_style(state.task_status)
                    .add_modifier(Modifier::DIM)
            };
            let message = vec![Line::from(vec![Span::styled(
                "Task completed successfully",
                message_style,
            )])];

            let paragraph = Paragraph::new(message)
                .block(block)
                .alignment(Alignment::Center)
                .style(Style::default());

            Widget::render(paragraph, safe_area, buf);
            return;
        }

        let inner_area = block.inner(safe_area);

        if let Some(pty_data) = &self.pty_data {
            if let Some(pty) = &pty_data.pty {
                if let Some(screen) = pty.get_screen() {
                    let viewport_height = inner_area.height;

                    // Cache expected viewport height for consistent calculations
                    state.expected_viewport_height = Some(viewport_height);

                    let current_scroll = pty.get_scroll_offset();

                    // Calculate content based on expected dimensions, not current PTY dimensions
                    // This prevents scrollbar flash when PTY hasn't been resized yet
                    let total_content_rows =
                        self.calculate_content_rows_for_viewport(pty, viewport_height);
                    let scrollable_rows =
                        total_content_rows.saturating_sub(viewport_height as usize);

                    // Determine if scrollbar is needed based on content vs viewport size
                    // This is deterministic and doesn't depend on actual PTY dimensions
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

                    let pseudo_term = PseudoTerminal::new(&*screen).block(block);
                    Widget::render(pseudo_term, safe_area, buf);

                    // Only render scrollbar if needed
                    if needs_scrollbar {
                        let scrollbar = Scrollbar::default()
                            .orientation(ScrollbarOrientation::VerticalRight)
                            .begin_symbol(Some("↑"))
                            .end_symbol(Some("↓"))
                            .style(border_style);

                        scrollbar.render(safe_area, buf, &mut state.scrollbar_state);
                    }

                    // Show instructions to quit in minimal mode if somehow terminal became non-interactive
                    if self.minimal && !self.is_currently_interactive() {
                        let top_text = Line::from(vec![
                            Span::styled("quit: ", Style::default().fg(THEME.primary_fg)),
                            Span::styled("q ", Style::default().fg(THEME.info)),
                        ]);

                        let mode_width = top_text
                            .spans
                            .iter()
                            .map(|span| span.content.len())
                            .sum::<usize>();

                        // Ensure text doesn't extend past safe area
                        if mode_width as u16 + 3 < safe_area.width {
                            let top_right_area = Rect {
                                x: safe_area.x + safe_area.width - mode_width as u16 - 3,
                                y: safe_area.y,
                                width: mode_width as u16 + 2,
                                height: 1,
                            };

                            Paragraph::new(top_text)
                                .alignment(Alignment::Right)
                                .style(border_style)
                                .render(top_right_area, buf);
                        }

                    // Show interactive/readonly status for focused, in progress tasks, when not in minimal mode
                    } else if state.task_status == TaskStatus::InProgress
                        && state.is_focused
                        && pty_data.can_be_interactive
                        && !self.minimal
                    {
                        // Bottom right status
                        let bottom_text = if self.is_currently_interactive() {
                            Line::from(vec![
                                Span::raw("  "),
                                Span::styled("<ctrl>+z", Style::default().fg(THEME.info)),
                                Span::styled(
                                    " to exit interactive  ",
                                    Style::default().fg(THEME.primary_fg),
                                ),
                            ])
                        } else {
                            Line::from(vec![
                                Span::raw("  "),
                                Span::styled("i", Style::default().fg(THEME.info)),
                                Span::styled(
                                    " to make interactive  ",
                                    Style::default().fg(THEME.secondary_fg),
                                ),
                            ])
                        };

                        let text_width = bottom_text
                            .spans
                            .iter()
                            .map(|span| span.content.len())
                            .sum::<usize>();

                        // Ensure status text doesn't extend past safe area
                        if text_width as u16 + 3 < safe_area.width {
                            let bottom_right_area = Rect {
                                x: safe_area.x + safe_area.width - text_width as u16 - 3,
                                y: safe_area.y + safe_area.height - 1,
                                width: text_width as u16 + 2,
                                height: 1,
                            };

                            Paragraph::new(bottom_text)
                                .alignment(Alignment::Right)
                                .style(border_style)
                                .render(bottom_right_area, buf);
                        }

                        // Top right status
                        let top_text = if self.is_currently_interactive() {
                            Line::from(vec![Span::styled(
                                "  INTERACTIVE  ",
                                Style::default().fg(THEME.primary_fg),
                            )])
                        } else {
                            Line::from(vec![Span::styled(
                                "  NON-INTERACTIVE  ",
                                Style::default().fg(THEME.secondary_fg),
                            )])
                        };

                        let mode_width = top_text
                            .spans
                            .iter()
                            .map(|span| span.content.len())
                            .sum::<usize>();

                        // Ensure status text doesn't extend past safe area
                        if mode_width as u16 + 3 < safe_area.width {
                            let top_right_area = Rect {
                                x: safe_area.x + safe_area.width - mode_width as u16 - 3,
                                y: safe_area.y,
                                width: mode_width as u16 + 2,
                                height: 1,
                            };

                            Paragraph::new(top_text)
                                .alignment(Alignment::Right)
                                .style(border_style)
                                .render(top_right_area, buf);
                        }
                    } else if needs_scrollbar {
                        // Render padding for both top and bottom when scrollbar is present
                        let padding_text = Line::from(vec![Span::raw("  ")]);
                        let padding_width = 2;

                        // Ensure paddings don't extend past safe area
                        if padding_width + 3 < safe_area.width {
                            // Top padding
                            let top_right_area = Rect {
                                x: safe_area.x + safe_area.width - padding_width - 3,
                                y: safe_area.y,
                                width: padding_width + 2,
                                height: 1,
                            };

                            Paragraph::new(padding_text.clone())
                                .alignment(Alignment::Right)
                                .style(border_style)
                                .render(top_right_area, buf);

                            // Bottom padding
                            let bottom_right_area = Rect {
                                x: safe_area.x + safe_area.width - padding_width - 3,
                                y: safe_area.y + safe_area.height - 1,
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
}
