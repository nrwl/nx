use std::collections::HashMap;

use crate::native::tasks::types::TaskGraph;
use crate::native::tui::components::tasks_list::TaskStatus;
use crate::native::tui::graph_utils::is_task_continuous;
use crate::native::tui::status_icons;
use crate::native::tui::theme::THEME;
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

pub struct DependencyViewState {
    pub current_task: String,
    pub task_status: TaskStatus,
    pub dependencies: Vec<String>,
    pub dependency_levels: HashMap<String, usize>,
    pub is_focused: bool,
    pub throbber_counter: usize,
    pub scroll_offset: usize,
    pub scrollbar_state: ScrollbarState,
    pub pane_area: ratatui::layout::Rect,
}

impl DependencyViewState {
    pub fn new(
        task_name: String,
        task_status: TaskStatus,
        task_graph: &TaskGraph,
        is_focused: bool,
        throbber_counter: usize,
        pane_area: ratatui::layout::Rect,
    ) -> Self {
        use crate::native::tui::graph_utils::{
            collect_all_dependencies_with_levels, count_all_dependencies,
        };

        // Get ALL dependency information (including transitive)
        let (mut all_dependencies, dependency_levels) =
            collect_all_dependencies_with_levels(&task_name, task_graph);

        // Sort dependencies by total dependency count (highest to lowest), then alphabetically
        all_dependencies.sort_by(|a, b| {
            let count_a = count_all_dependencies(a, task_graph);
            let count_b = count_all_dependencies(b, task_graph);

            // Sort by total dependency count (descending), then alphabetically
            count_b.cmp(&count_a).then_with(|| a.cmp(b))
        });

        Self {
            current_task: task_name,
            task_status,
            dependencies: all_dependencies,
            dependency_levels,
            is_focused,
            throbber_counter,
            scroll_offset: 0,
            scrollbar_state: ScrollbarState::default(),
            pane_area,
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

    /// Updates the dependency view state with new data, preserving scroll position if the task is the same.
    /// Returns true if the state was updated, false if no update was needed.
    pub fn update(
        &mut self,
        task_status: TaskStatus,
        is_focused: bool,
        throbber_counter: usize,
        pane_area: ratatui::layout::Rect,
    ) {
        self.task_status = task_status;
        self.is_focused = is_focused;
        self.throbber_counter = throbber_counter;
        self.pane_area = pane_area;
    }

    /// Returns true if this dependency view should handle key events (i.e., task is pending)
    pub fn should_handle_key_events(&self) -> bool {
        matches!(self.task_status, TaskStatus::NotStarted)
    }

    /// Calculate viewport height from pane area, accounting for borders and padding
    fn calculate_viewport_height(pane_area: ratatui::layout::Rect) -> usize {
        // Account for borders and padding
        (pane_area.height as usize).saturating_sub(4) // 2 for borders, 2 for padding
    }

    /// Handle key event with automatic viewport height calculation from stored pane area
    pub fn handle_key_event(&mut self, key: crossterm::event::KeyEvent) -> bool {
        let viewport_height = Self::calculate_viewport_height(self.pane_area);
        self.handle_key_event_with_viewport(key, viewport_height)
    }

    pub fn handle_key_event_with_viewport(
        &mut self,
        key: crossterm::event::KeyEvent,
        viewport_height: usize,
    ) -> bool {
        use crossterm::event::{KeyCode, KeyModifiers};

        // Only handle keys if there's actually content to scroll
        let content_height = self.dependencies.len() + 2; // +2 for header and spacing
        let max_scroll = content_height.saturating_sub(viewport_height);
        let has_scrollable_content = max_scroll > 0;

        match key.code {
            KeyCode::Up | KeyCode::Char('k') => {
                if has_scrollable_content && self.scroll_offset > 0 {
                    self.scroll_up();
                    true
                } else {
                    false
                }
            }
            KeyCode::Down | KeyCode::Char('j') => {
                if has_scrollable_content && self.scroll_offset < max_scroll {
                    self.scroll_down(viewport_height);
                    true
                } else {
                    false
                }
            }
            KeyCode::Char('u') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                if has_scrollable_content && self.scroll_offset > 0 {
                    for _ in 0..12 {
                        self.scroll_up();
                    }
                    true
                } else {
                    false
                }
            }
            KeyCode::Char('d') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                if has_scrollable_content && self.scroll_offset < max_scroll {
                    for _ in 0..12 {
                        self.scroll_down(viewport_height);
                    }
                    true
                } else {
                    false
                }
            }
            _ => false,
        }
    }
}

pub struct DependencyView<'a> {
    status_map: &'a HashMap<String, TaskStatus>,
    task_graph: &'a TaskGraph,
    is_minimal: bool,
}

impl<'a> DependencyView<'a> {
    pub fn new(
        status_map: &'a HashMap<String, TaskStatus>,
        task_graph: &'a TaskGraph,
        is_minimal: bool,
    ) -> Self {
        Self {
            status_map,
            task_graph,
            is_minimal,
        }
    }

    /// Helper function to check if a task is considered incomplete
    fn is_task_incomplete(&self, dep: &str) -> bool {
        let status = self.status_map.get(dep).unwrap_or(&TaskStatus::NotStarted);
        let is_continuous = is_task_continuous(self.task_graph, dep);

        // For continuous tasks, InProgress and Stopped are considered complete
        // For regular tasks, only traditional completion statuses count
        !matches!(
            status,
            TaskStatus::Success
                | TaskStatus::LocalCacheKeptExisting
                | TaskStatus::LocalCache
                | TaskStatus::RemoteCache
                | TaskStatus::Skipped
        ) && !(is_continuous && matches!(status, TaskStatus::InProgress | TaskStatus::Stopped))
    }

    /// Apply focus styling to a base style - dims the style when not focused
    fn apply_focus_styling(base_style: Style, is_focused: bool) -> Style {
        if is_focused {
            base_style
        } else {
            base_style.add_modifier(Modifier::DIM)
        }
    }

    /// Render the no dependencies message
    fn render_no_dependencies(&self, state: &DependencyViewState, area: Rect, buf: &mut Buffer) {
        let base_style = Style::default().fg(THEME.success);
        let no_deps_style = Self::apply_focus_styling(base_style, state.is_focused);

        let no_deps_message = vec![Line::from(vec![Span::styled(
            "Waiting for available thread...",
            no_deps_style,
        )])];

        let paragraph = Paragraph::new(no_deps_message)
            .alignment(Alignment::Center)
            .style(Style::default());

        Widget::render(paragraph, area, buf);
    }

    fn render_dependency_list(
        &self,
        state: &mut DependencyViewState,
        inner_area: Rect,
        outer_area: Rect,
        buf: &mut Buffer,
    ) {
        if state.dependencies.is_empty() {
            self.render_no_dependencies(state, inner_area, buf);
            return;
        }

        let mut lines = Vec::new();

        // Count incomplete dependencies
        let total_count = state.dependencies.len();
        let incomplete_count = state
            .dependencies
            .iter()
            .filter(|dep| self.is_task_incomplete(dep))
            .count();

        // Add header with progress
        let header_text = if incomplete_count == 0 && total_count > 0 {
            "All dependencies satisfied, waiting for an available thread...".to_string()
        } else {
            format!(
                "Not started yet, waiting for {} / {} tasks to complete...",
                incomplete_count, total_count
            )
        };

        let header_base_style = Style::default()
            .fg(if incomplete_count == 0 && total_count > 0 {
                THEME.success
            } else {
                THEME.primary_fg
            })
            .add_modifier(Modifier::BOLD);

        let header_style = Self::apply_focus_styling(header_base_style, state.is_focused);
        let header = Line::from(vec![Span::styled(header_text, header_style)]);
        lines.push(header);
        lines.push(Line::from("")); // Empty line for spacing

        // Add all dependencies (no more truncation, we'll scroll instead)
        for dep in &state.dependencies {
            let status = self.status_map.get(dep).unwrap_or(&TaskStatus::NotStarted);
            let status_icon = status_icons::get_status_icon(*status, state.throbber_counter);

            let dep_base_style = Style::default().fg(THEME.primary_fg);
            let dep_style = Self::apply_focus_styling(dep_base_style, state.is_focused);

            let line = Line::from(vec![status_icon, Span::styled(dep.clone(), dep_style)]);
            lines.push(line);
        }

        // Calculate scrolling parameters
        let content_height = lines.len();
        let viewport_height = inner_area.height as usize;
        let max_scroll = content_height.saturating_sub(viewport_height);

        // Update scrollbar state
        let needs_scrollbar = max_scroll > 0;
        state.scrollbar_state = if needs_scrollbar {
            state
                .scrollbar_state
                .content_length(max_scroll)
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

        // Apply safety bounds to content area
        let content_area = Rect {
            x: inner_area.x,
            y: inner_area.y,
            width: inner_area
                .width
                .min(buf.area().width.saturating_sub(inner_area.x)),
            height: inner_area
                .height
                .min(buf.area().height.saturating_sub(inner_area.y)),
        };

        // Add additional safety check
        if content_area.width == 0 || content_area.height == 0 {
            return; // Don't render if the area is invalid
        }

        Widget::render(paragraph, content_area, buf);

        // Render scrollbar if needed (using outer_area to extend to border edge)
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

            scrollbar.render(outer_area, buf, &mut state.scrollbar_state);

            // Render padding around scrollbar
            let padding_text = Line::from(vec![Span::raw("  ")]);
            let padding_width = 2;
            let right_margin = 3;
            let width_padding = 2;

            // Ensure paddings don't extend past outer area
            if padding_width + right_margin < outer_area.width {
                // Top padding
                let top_right_area = Rect {
                    x: outer_area.x + outer_area.width - padding_width - right_margin,
                    y: outer_area.y,
                    width: padding_width + width_padding,
                    height: 1,
                };

                Paragraph::new(padding_text.clone())
                    .alignment(Alignment::Right)
                    .style(border_style)
                    .render(top_right_area, buf);

                // Bottom padding
                let bottom_right_area = Rect {
                    x: outer_area.x + outer_area.width - padding_width - right_margin,
                    y: outer_area.y + outer_area.height - 1,
                    width: padding_width + width_padding,
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

        let block = if self.is_minimal {
            Block::default()
                .borders(Borders::NONE)
                .padding(Padding::new(2, 2, 1, 1))
        } else {
            Block::default()
                .title(title)
                .title_alignment(Alignment::Left)
                .borders(Borders::ALL)
                .border_type(if state.is_focused {
                    BorderType::Thick
                } else {
                    BorderType::Plain
                })
                .border_style(border_style)
                .padding(Padding::new(2, 2, 1, 1))
        };

        let inner_area = block.inner(area);
        block.render(area, buf);

        // Only show dependency info for pending tasks
        if matches!(state.task_status, TaskStatus::NotStarted) {
            self.render_dependency_list(state, inner_area, area, buf);
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
