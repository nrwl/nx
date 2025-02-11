use color_eyre::eyre::Result;
use std::any::Any;

use super::Component;
use super::Frame;

use ratatui::{
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{
        Block, BorderType, Borders, Clear, Padding, Paragraph, Scrollbar, ScrollbarOrientation,
        ScrollbarState,
    },
};

pub struct HelpPopup {
    scroll_offset: usize,
    scrollbar_state: ScrollbarState,
    content_height: usize,
    viewport_height: usize,
    visible: bool,
}

impl HelpPopup {
    pub fn new() -> Self {
        Self {
            scroll_offset: 0,
            scrollbar_state: ScrollbarState::default(),
            content_height: 0,
            viewport_height: 0,
            visible: false,
        }
    }

    pub fn set_visible(&mut self, visible: bool) {
        self.visible = visible;
    }

    // Ensure the scroll state is reset to avoid recalc issues
    pub fn handle_resize(&mut self, _width: u16, _height: u16) {
        self.scroll_offset = 0;
        self.scrollbar_state = ScrollbarState::default();
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
        let percent_y = 85;
        let percent_x = 70;

        let popup_layout = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Percentage((100 - percent_y) / 2),
                Constraint::Percentage(percent_y),
                Constraint::Percentage((100 - percent_y) / 2),
            ])
            .split(area);

        let popup_area = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Percentage((100 - percent_x) / 2),
                Constraint::Percentage(percent_x),
                Constraint::Percentage((100 - percent_x) / 2),
            ])
            .split(popup_layout[1])[1];

        let keybindings = vec![
            // Misc
            ("?", "Toggle this popup"),
            ("", ""),
            // Navigation
            ("↑ or k", "Navigate/scroll task output up"),
            ("↓ or j", "Navigate/scroll task output down"),
            ("<ctrl>+u", "Scroll task output up"),
            ("<ctrl>+d", "Scroll task output down"),
            ("← or h", "Navigate left"),
            ("→ or l", "Navigate right"),
            ("", ""),
            // Task List Controls
            ("/", "Filter tasks based on search term"),
            ("<esc>", "Clear filter"),
            ("", ""),
            // Output Controls
            ("<space>", "Quick toggle a single output pane"),
            ("b", "Toggle task list visibility"),
            ("1", "Pin task to be shown in output pane 1"),
            ("2", "Pin task to be shown in output pane 2"),
            (
                "<tab>",
                "Move focus between task list and output panes 1 and 2",
            ),
            ("c", "Copy focused output to clipboard"),
            ("", ""),
            // Interactive Mode
            ("i", "Interact with a continuous task when it is in focus"),
            ("<ctrl>+z", "Stop interacting with a continuous task"),
        ];

        let mut content: Vec<Line> = vec![
            // Welcome text
            Line::from(vec![
                Span::styled(
                    "Thanks for using Nx! To get the most out of this terminal UI, please check out the docs: ",
                    Style::default().fg(Color::White),
                ),
                Span::styled(
                    // NOTE: I tried OSC 8 sequences here but they broke the layout, see: https://github.com/ratatui/ratatui/issues/1028
                    "https://nx.dev/terminal-ui",
                    Style::default().fg(Color::Cyan),
                ),
            ]),
            Line::from(vec![
                Span::styled(
                    "If you are finding Nx useful, please consider giving it a star on GitHub, it means a lot: ",
                    Style::default().fg(Color::White),
                ),
                Span::styled(
                    // NOTE: I tried OSC 8 sequences here but they broke the layout, see: https://github.com/ratatui/ratatui/issues/1028
                    "https://github.com/nrwl/nx",
                    Style::default().fg(Color::Cyan),
                ),
            ]),
            Line::from(""), // Empty line for spacing
            Line::from(vec![Span::styled(
                "Available keyboard shortcuts:",
                Style::default().fg(Color::DarkGray),
            )]),
            Line::from(""), // Empty line for spacing
        ];

        // Add keybindings to content
        content.extend(
            keybindings
                .into_iter()
                .map(|(key, desc)| {
                    if key.is_empty() {
                        Line::from("")
                    } else {
                        // Split the key text on " or " if it exists
                        let key_parts: Vec<&str> = key.split(" or ").collect();
                        let mut spans = Vec::new();

                        // Calculate the total visible length (excluding color codes)
                        let visible_length = if key_parts.len() > 1 {
                            key_parts.iter().map(|s| s.len()).sum::<usize>() + 2
                        // for alignment
                        } else {
                            key.len()
                        };

                        // Add each key part with the appropriate styling
                        for (i, part) in key_parts.iter().enumerate() {
                            if i > 0 {
                                spans.push(Span::styled(
                                    " or ",
                                    Style::default().fg(Color::DarkGray),
                                ));
                            }
                            spans.push(Span::styled(
                                part.to_string(),
                                Style::default().fg(Color::Cyan),
                            ));
                        }

                        // Add padding to align all descriptions
                        let padding = " ".repeat(11usize.saturating_sub(visible_length));
                        spans.push(Span::raw(padding));

                        // Add the separator and description
                        spans.push(Span::styled("=   ", Style::default().fg(Color::DarkGray)));
                        spans.push(Span::styled(desc, Style::default().fg(Color::White)));

                        Line::from(spans)
                    }
                })
                .collect::<Vec<Line>>(),
        );

        // Update content height based on actual content
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
                Span::styled("  Help  ", Style::default().fg(Color::White)),
            ]))
            .title_alignment(Alignment::Left)
            .borders(Borders::ALL)
            .border_type(BorderType::Plain)
            .border_style(Style::default().fg(Color::Cyan))
            .padding(Padding::proportional(1));

        let inner_area = block.inner(popup_area);
        self.viewport_height = inner_area.height as usize;

        // Calculate wrapped height by measuring each line
        let wrapped_height = content
            .iter()
            .map(|line| {
                // Get total width of all spans in the line
                let line_width = line.width() as u16;
                // Calculate how many rows this line will take up when wrapped
                if line_width == 0 {
                    1 // Empty lines still take up one row
                } else {
                    (line_width.saturating_sub(1) / inner_area.width).saturating_add(1) as usize
                }
            })
            .sum();
        self.content_height = wrapped_height;

        // Calculate scrollbar state using the same logic as task list output panes
        let scrollable_rows = self.content_height.saturating_sub(self.viewport_height);
        let needs_scrollbar = scrollable_rows > 0;

        // Reset scrollbar state if no scrolling needed
        self.scrollbar_state = if needs_scrollbar {
            let position = self.scroll_offset;
            self.scrollbar_state
                .content_length(scrollable_rows)
                .viewport_content_length(self.viewport_height)
                .position(position)
        } else {
            ScrollbarState::default()
        };

        // Create scrollable paragraph
        let scroll_start = self.scroll_offset;
        let scroll_end = (self.scroll_offset + self.viewport_height).min(content.len());
        let visible_content = content[scroll_start..scroll_end].to_vec();

        let popup = Paragraph::new(visible_content)
            .block(block)
            .alignment(Alignment::Left)
            .wrap(ratatui::widgets::Wrap { trim: true });

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

impl Clone for HelpPopup {
    fn clone(&self) -> Self {
        Self {
            scroll_offset: self.scroll_offset,
            scrollbar_state: self.scrollbar_state,
            content_height: self.content_height,
            viewport_height: self.viewport_height,
            visible: self.visible,
        }
    }
}

impl Component for HelpPopup {
    fn draw(&mut self, f: &mut Frame<'_>, rect: Rect) -> Result<()> {
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
