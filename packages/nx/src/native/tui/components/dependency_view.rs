use std::collections::HashMap;

use ratatui::{
    buffer::Buffer,
    layout::{Alignment, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{
        Block, BorderType, Borders, Padding, Paragraph, Scrollbar, ScrollbarOrientation,
        ScrollbarState, StatefulWidget, Widget,
    },
};

use crate::native::tui::components::tasks_list::{TaskStatus, TasksList};
use crate::native::tui::status_icons;
use crate::native::tui::theme::THEME;

pub struct DependencyViewState {
    pub current_task: String,
    pub task_status: TaskStatus,
    pub dependencies: Vec<String>,
    pub dependency_statuses: HashMap<String, TaskStatus>,
    pub dependency_levels: HashMap<String, usize>,
    pub dependency_continuous_flags: HashMap<String, bool>,
    pub is_focused: bool,
    pub throbber_counter: usize,
    pub scroll_offset: usize,
    pub scrollbar_state: ScrollbarState,
}

impl DependencyViewState {
    pub fn new(
        current_task: String,
        task_status: TaskStatus,
        dependencies: Vec<String>,
        dependency_statuses: HashMap<String, TaskStatus>,
        dependency_levels: HashMap<String, usize>,
        dependency_continuous_flags: HashMap<String, bool>,
        is_focused: bool,
    ) -> Self {
        Self {
            current_task,
            task_status,
            dependencies,
            dependency_statuses,
            dependency_levels,
            dependency_continuous_flags,
            is_focused,
            throbber_counter: 0,
            scroll_offset: 0,
            scrollbar_state: ScrollbarState::default(),
        }
    }

    pub fn scroll_up(&mut self) {
        self.scroll_offset = self.scroll_offset.saturating_sub(1);
    }

    pub fn scroll_down(&mut self, viewport_height: usize) {
        let content_height = self.dependencies.len() + 2; // +2 for header and spacing
        let max_scroll = content_height.saturating_sub(viewport_height);
        if self.scroll_offset < max_scroll {
            self.scroll_offset += 1;
        }
    }

    pub fn handle_key_event(
        &mut self,
        key: crossterm::event::KeyEvent,
        viewport_height: usize,
    ) -> bool {
        use crossterm::event::{KeyCode, KeyModifiers};

        match key.code {
            KeyCode::Up | KeyCode::Char('k') => {
                self.scroll_up();
                true
            }
            KeyCode::Down | KeyCode::Char('j') => {
                self.scroll_down(viewport_height);
                true
            }
            KeyCode::Char('u') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                for _ in 0..12 {
                    self.scroll_up();
                }
                true
            }
            KeyCode::Char('d') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                for _ in 0..12 {
                    self.scroll_down(viewport_height);
                }
                true
            }
            _ => false,
        }
    }
}

pub struct DependencyView<'a> {
    tasks_list: Option<&'a mut TasksList>,
}

impl<'a> DependencyView<'a> {
    pub fn new() -> Self {
        Self { tasks_list: None }
    }

    pub fn with_tasks_list(mut self, tasks_list: &'a mut TasksList) -> Self {
        self.tasks_list = Some(tasks_list);
        self
    }

    fn render_dependency_list(
        &self,
        state: &mut DependencyViewState,
        area: Rect,
        buf: &mut Buffer,
    ) {
        if state.dependencies.is_empty() {
            let no_deps_message = vec![
                Line::from(vec![Span::styled(
                    "No dependencies found in task graph",
                    Style::default().fg(THEME.success),
                )]),
                Line::from(vec![Span::styled(
                    "Task can start immediately",
                    Style::default().fg(THEME.success),
                )]),
            ];

            let paragraph = Paragraph::new(no_deps_message)
                .alignment(Alignment::Center)
                .style(Style::default());

            Widget::render(paragraph, area, buf);
            return;
        }

        let mut lines = Vec::new();

        // Count incomplete dependencies
        let total_count = state.dependencies.len();
        let incomplete_count = state
            .dependencies
            .iter()
            .filter(|dep| {
                let status = state
                    .dependency_statuses
                    .get(*dep)
                    .unwrap_or(&TaskStatus::NotStarted);
                let is_continuous = state
                    .dependency_continuous_flags
                    .get(*dep)
                    .unwrap_or(&false);

                // For continuous tasks, InProgress and Stopped are considered complete
                // For regular tasks, only traditional completion statuses count
                !matches!(
                    status,
                    TaskStatus::Success
                        | TaskStatus::LocalCacheKeptExisting
                        | TaskStatus::LocalCache
                        | TaskStatus::RemoteCache
                        | TaskStatus::Skipped
                ) && !(*is_continuous
                    && matches!(status, TaskStatus::InProgress | TaskStatus::Stopped))
            })
            .count();

        // Add header with progress
        let header_text = if incomplete_count == 0 && total_count > 0 {
            "All dependencies satisfied - task ready to start!".to_string()
        } else {
            format!(
                "Not started yet, waiting for {} / {} tasks to complete...",
                incomplete_count, total_count
            )
        };

        let header = Line::from(vec![Span::styled(
            header_text,
            Style::default()
                .fg(if incomplete_count == 0 && total_count > 0 {
                    THEME.success
                } else {
                    THEME.primary_fg
                })
                .add_modifier(Modifier::BOLD),
        )]);
        lines.push(header);
        lines.push(Line::from("")); // Empty line for spacing

        // Add all dependencies (no more truncation, we'll scroll instead)
        for dep in &state.dependencies {
            let status = state
                .dependency_statuses
                .get(dep)
                .unwrap_or(&TaskStatus::NotStarted);
            let status_icon = status_icons::get_status_icon(*status, state.throbber_counter);

            let line = Line::from(vec![
                status_icon,
                Span::styled(dep.clone(), Style::default().fg(THEME.primary_fg)),
            ]);
            lines.push(line);
        }

        // Calculate scrolling parameters
        let content_height = lines.len();
        let viewport_height = area.height as usize;
        let max_scroll = content_height.saturating_sub(viewport_height);

        // Update scrollbar state
        let needs_scrollbar = max_scroll > 0;
        state.scrollbar_state = if needs_scrollbar {
            state
                .scrollbar_state
                .content_length(content_height)
                .viewport_content_length(viewport_height)
                .position(state.scroll_offset)
        } else {
            ScrollbarState::default()
        };

        // Apply scroll offset to lines
        let visible_lines: Vec<Line> =
            if state.scroll_offset > 0 && content_height > viewport_height {
                let start = state
                    .scroll_offset
                    .min(content_height.saturating_sub(viewport_height));
                let end = (start + viewport_height).min(content_height);
                lines[start..end].to_vec()
            } else {
                lines
            };

        let paragraph = Paragraph::new(visible_lines)
            .alignment(Alignment::Left)
            .style(Style::default());

        // Render the scrollable area (leave space for scrollbar if needed)
        let content_area = if needs_scrollbar {
            Rect {
                x: area.x,
                y: area.y,
                width: area.width.saturating_sub(1),
                height: area.height,
            }
        } else {
            area
        };

        Widget::render(paragraph, content_area, buf);

        // Render scrollbar if needed
        if needs_scrollbar {
            let border_style = if state.is_focused {
                Style::default().fg(THEME.info)
            } else {
                Style::default()
                    .fg(THEME.secondary_fg)
                    .add_modifier(Modifier::DIM)
            };

            let scrollbar = Scrollbar::default()
                .orientation(ScrollbarOrientation::VerticalRight)
                .begin_symbol(Some("↑"))
                .end_symbol(Some("↓"))
                .style(border_style);

            scrollbar.render(area, buf, &mut state.scrollbar_state);
        }
    }
}

impl<'a> StatefulWidget for DependencyView<'a> {
    type State = DependencyViewState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        // Safety check for minimum area
        if area.width < 10 || area.height < 5 {
            return;
        }

        let border_style = if state.is_focused {
            Style::default().fg(THEME.info)
        } else {
            Style::default()
                .fg(THEME.secondary_fg)
                .add_modifier(Modifier::DIM)
        };

        let status_icon = status_icons::get_status_icon(state.task_status, state.throbber_counter);
        let title = vec![
            status_icon,
            Span::styled(
                format!("{}  ", state.current_task),
                Style::default().fg(if state.is_focused {
                    THEME.primary_fg
                } else {
                    THEME.secondary_fg
                }),
            ),
        ];

        let block = Block::default()
            .title(title)
            .title_alignment(Alignment::Left)
            .borders(Borders::ALL)
            .border_type(if state.is_focused {
                BorderType::Thick
            } else {
                BorderType::Plain
            })
            .border_style(border_style)
            .padding(Padding::new(2, 2, 1, 1));

        let inner_area = block.inner(area);
        block.render(area, buf);

        // Only show dependency info for pending tasks
        if matches!(state.task_status, TaskStatus::NotStarted) {
            self.render_dependency_list(state, inner_area, buf);
        } else {
            // Show a message indicating why the dependency view is not relevant
            let message = match state.task_status {
                TaskStatus::InProgress => "Task is now running",
                TaskStatus::Success => "Task completed successfully",
                TaskStatus::Failure => "Task failed",
                TaskStatus::Skipped => "Task was skipped",
                _ => "Task is no longer pending",
            };

            let message_line = vec![Line::from(vec![Span::styled(
                message,
                Style::default().fg(THEME.secondary_fg),
            )])];

            let paragraph = Paragraph::new(message_line)
                .alignment(Alignment::Center)
                .style(Style::default());

            Widget::render(paragraph, inner_area, buf);
        }
    }
}
