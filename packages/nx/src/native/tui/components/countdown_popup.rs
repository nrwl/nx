use color_eyre::eyre::Result;
use ratatui::{
    layout::{Alignment, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{
        Block, BorderType, Borders, Clear, Padding, Paragraph, Scrollbar, ScrollbarOrientation,
        ScrollbarState,
    },
    Frame,
};
use std::any::Any;
use std::time::{Duration, Instant};

use super::{AppState, Component};

pub struct CountdownPopup {
    visible: bool,
    start_time: Option<Instant>,
    duration: Duration,
    scroll_offset: usize,
    scrollbar_state: ScrollbarState,
    content_height: usize,
    viewport_height: usize,
}

impl CountdownPopup {
    pub fn new() -> Self {
        Self {
            visible: false,
            start_time: None,
            duration: Duration::from_secs(3),
            scroll_offset: 0,
            scrollbar_state: ScrollbarState::default(),
            content_height: 0,
            viewport_height: 0,
        }
    }

    pub fn is_scrollable(&self) -> bool {
        self.content_height > self.viewport_height
    }

    pub fn start_countdown(&mut self, duration_secs: u64) {
        self.visible = true;
        self.start_time = Some(Instant::now());
        self.duration = Duration::from_secs(duration_secs);
        self.scroll_offset = 0;
        self.scrollbar_state = ScrollbarState::default();
    }

    pub fn cancel_countdown(&mut self) {
        self.visible = false;
        self.start_time = None;
    }

    pub fn should_quit(&self) -> bool {
        if let Some(start_time) = self.start_time {
            return start_time.elapsed() >= self.duration;
        }
        false
    }

    pub fn set_visible(&mut self, visible: bool) {
        self.visible = visible;
        if !visible {
            self.start_time = None;
        }
    }

    pub fn is_visible(&self) -> bool {
        self.visible
    }

    pub fn scroll_up(&mut self) {
        if self.scroll_offset > 0 {
            self.scroll_offset -= 1;
            // Update scrollbar state with new position
            self.scrollbar_state = self
                .scrollbar_state
                .content_length(self.content_height)
                .viewport_content_length(self.viewport_height)
                .position(self.scroll_offset);
        }
    }

    pub fn scroll_down(&mut self) {
        let max_scroll = self.content_height.saturating_sub(self.viewport_height);
        if self.scroll_offset < max_scroll {
            self.scroll_offset += 1;
            // Update scrollbar state with new position
            self.scrollbar_state = self
                .scrollbar_state
                .content_length(self.content_height)
                .viewport_content_length(self.viewport_height)
                .position(self.scroll_offset);
        }
    }

    pub fn render(&mut self, f: &mut Frame<'_>, area: Rect) {
        let popup_height = 9;
        let popup_width = 70;

        // Make sure we don't exceed the available area
        let popup_height = popup_height.min(area.height.saturating_sub(4));
        let popup_width = popup_width.min(area.width.saturating_sub(4));

        // Calculate the top-left position to center the popup
        let popup_x = area.x + (area.width.saturating_sub(popup_width)) / 2;
        let popup_y = area.y + (area.height.saturating_sub(popup_height)) / 2;

        // Create popup area with fixed dimensions
        let popup_area = Rect::new(popup_x, popup_y, popup_width, popup_height);

        // Calculate seconds remaining
        let seconds_remaining = if let Some(start_time) = self.start_time {
            let elapsed = start_time.elapsed();
            if elapsed >= self.duration {
                0
            } else {
                (self.duration - elapsed).as_secs()
            }
        } else {
            0
        };

        let time_remaining = seconds_remaining + 1;

        let content = vec![
            Line::from(vec![
                Span::styled("• Press ", Style::default().fg(Color::DarkGray)),
                Span::styled("any key", Style::default().fg(Color::Cyan)),
                Span::styled(
                    " to keep the TUI running and interactively explore the results.",
                    Style::default().fg(Color::DarkGray),
                ),
            ]),
            Line::from(""),
            Line::from(vec![
                Span::styled(
                    "• Learn how to configure auto-exit and more in the docs: ",
                    Style::default().fg(Color::DarkGray),
                ),
                Span::styled(
                    // NOTE: I tried OSC 8 sequences here but they broke the layout, see: https://github.com/ratatui/ratatui/issues/1028
                    "https://nx.dev/terminal-ui",
                    Style::default().fg(Color::Cyan),
                ),
            ]),
        ];

        let block = Block::default()
            .title(Line::from(vec![
                Span::raw("  "),
                Span::styled(
                    " NX ",
                    Style::default()
                        .add_modifier(Modifier::BOLD)
                        .bg(Color::Cyan)
                        .fg(Color::Black),
                ),
                Span::styled("  Exiting in ", Style::default().fg(Color::White)),
                Span::styled(
                    format!("{}", time_remaining),
                    Style::default().fg(Color::Cyan),
                ),
                Span::styled("...  ", Style::default().fg(Color::White)),
            ]))
            .title_alignment(Alignment::Left)
            .borders(Borders::ALL)
            .border_type(BorderType::Plain)
            .border_style(Style::default().fg(Color::Cyan))
            .padding(Padding::proportional(1));

        // Get the inner area
        let inner_area = block.inner(popup_area);
        self.viewport_height = inner_area.height as usize;

        // Calculate content height based on line wrapping
        let wrapped_height = content
            .iter()
            .map(|line| {
                let line_width = line.width() as u16;
                if line_width == 0 {
                    1 // Empty lines still take up one row
                } else {
                    (line_width.saturating_sub(1) / inner_area.width).saturating_add(1) as usize
                }
            })
            .sum();
        self.content_height = wrapped_height;

        // Calculate scrollbar state
        let scrollable_rows = self.content_height.saturating_sub(self.viewport_height);
        let needs_scrollbar = scrollable_rows > 0;

        // Update scrollbar state
        self.scrollbar_state = if needs_scrollbar {
            self.scrollbar_state
                .content_length(scrollable_rows)
                .viewport_content_length(self.viewport_height)
                .position(self.scroll_offset)
        } else {
            ScrollbarState::default()
        };

        // Create scrollable paragraph
        let scroll_start = self.scroll_offset;
        let scroll_end = (self.scroll_offset + self.viewport_height).min(content.len());
        let visible_content = content[scroll_start..scroll_end].to_vec();

        let popup = Paragraph::new(visible_content)
            .block(block.clone())
            .wrap(ratatui::widgets::Wrap { trim: true });

        // Render popup
        f.render_widget(Clear, popup_area);
        f.render_widget(popup, popup_area);

        // Render scrollbar if needed
        if needs_scrollbar {
            // Add padding text at top and bottom of scrollbar
            let top_text = Line::from(vec![Span::raw("  ")]);
            let bottom_text = Line::from(vec![Span::raw("  ")]);

            let text_width = 2; // Width of "  "

            // Top right padding
            let top_right_area = Rect {
                x: popup_area.x + popup_area.width - text_width as u16 - 3,
                y: popup_area.y,
                width: text_width as u16 + 2,
                height: 1,
            };

            // Bottom right padding
            let bottom_right_area = Rect {
                x: popup_area.x + popup_area.width - text_width as u16 - 3,
                y: popup_area.y + popup_area.height - 1,
                width: text_width as u16 + 2,
                height: 1,
            };

            // Render padding text
            f.render_widget(
                Paragraph::new(top_text)
                    .alignment(Alignment::Right)
                    .style(Style::default().fg(Color::Cyan)),
                top_right_area,
            );

            f.render_widget(
                Paragraph::new(bottom_text)
                    .alignment(Alignment::Right)
                    .style(Style::default().fg(Color::Cyan)),
                bottom_right_area,
            );

            let scrollbar = Scrollbar::default()
                .orientation(ScrollbarOrientation::VerticalRight)
                .begin_symbol(Some("↑"))
                .end_symbol(Some("↓"))
                .style(Style::default().fg(Color::Cyan));

            f.render_stateful_widget(scrollbar, popup_area, &mut self.scrollbar_state);
        }
    }
}

impl Clone for CountdownPopup {
    fn clone(&self) -> Self {
        Self {
            visible: self.visible,
            start_time: self.start_time,
            duration: self.duration,
            scroll_offset: self.scroll_offset,
            scrollbar_state: self.scrollbar_state,
            content_height: self.content_height,
            viewport_height: self.viewport_height,
        }
    }
}

impl Component for CountdownPopup {
    fn draw(&mut self, f: &mut Frame<'_>, rect: Rect, _: &mut AppState) -> Result<()> {
        if self.visible {
            self.render(f, rect);
        }
        Ok(())
    }

    fn as_any(&self) -> &dyn Any {
        self
    }

    fn as_any_mut(&mut self) -> &mut dyn Any {
        self
    }
}
