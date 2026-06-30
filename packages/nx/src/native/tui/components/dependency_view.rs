use std::collections::HashMap;

use crate::native::tasks::types::TaskGraph;
use crate::native::tui::action::Action;
use crate::native::tui::components::tasks_list::TaskStatus;
use crate::native::tui::graph_utils::{get_dependency_chain_failures, is_task_continuous};
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
    /// Clickable dependency rows captured during the last render: screen `y` →
    /// task name. Lets a mouse click navigate to the dependency under the cursor.
    pub dep_row_hits: Vec<(u16, String)>,
    /// Horizontal extent `[x0, x1)` of the dependency rows, for click hit-testing.
    pub dep_row_x_range: (u16, u16),
    /// Inner text region from the last render, used to bound a drag-based text
    /// selection over the dependency view (mirrors the task list).
    pub selection_area: Option<ratatui::layout::Rect>,
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
            dep_row_hits: Vec::new(),
            dep_row_x_range: (0, 0),
            selection_area: None,
        }
    }

    /// Resolve a click at terminal cell `(col, row)` to the dependency task under
    /// it, if any, using the row hit-map captured during the last render.
    pub fn handle_click(&self, col: u16, row: u16) -> Option<String> {
        let (x0, x1) = self.dep_row_x_range;
        if col < x0 || col >= x1 {
            return None;
        }
        self.dep_row_hits
            .iter()
            .find(|(y, _)| *y == row)
            .map(|(_, task)| task.clone())
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

    /// Returns true if this dependency view should handle key events (i.e., task is pending or skipped with scrollable content)
    pub fn should_handle_key_events(&self) -> bool {
        matches!(
            self.task_status,
            TaskStatus::NotStarted | TaskStatus::Skipped
        )
    }

    /// Calculate viewport height from pane area, accounting for borders and padding
    fn calculate_viewport_height(pane_area: ratatui::layout::Rect) -> usize {
        // Account for borders and padding
        (pane_area.height as usize).saturating_sub(4) // 2 for borders, 2 for padding
    }

    /// Handle key event with automatic viewport height calculation from stored pane area.
    /// Returns Some(Action) if an action should be dispatched, None otherwise.
    pub fn handle_key_event(&mut self, key: crossterm::event::KeyEvent) -> Option<Action> {
        let viewport_height = Self::calculate_viewport_height(self.pane_area);
        self.handle_key_event_with_viewport(key, viewport_height)
    }

    pub fn handle_key_event_with_viewport(
        &mut self,
        key: crossterm::event::KeyEvent,
        viewport_height: usize,
    ) -> Option<Action> {
        use crossterm::event::{KeyCode, KeyModifiers};

        // Only handle keys if there's actually content to scroll
        let content_height = self.dependencies.len() + 2; // +2 for header and spacing
        let max_scroll = content_height.saturating_sub(viewport_height);
        let has_scrollable_content = max_scroll > 0;

        match key.code {
            KeyCode::Up | KeyCode::Char('k') => {
                if has_scrollable_content && self.scroll_offset > 0 {
                    self.scroll_up();
                }
                None
            }
            KeyCode::Down | KeyCode::Char('j') => {
                if has_scrollable_content && self.scroll_offset < max_scroll {
                    self.scroll_down(viewport_height);
                }
                None
            }
            KeyCode::Char('u') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                if has_scrollable_content && self.scroll_offset > 0 {
                    for _ in 0..12 {
                        self.scroll_up();
                    }
                }
                None
            }
            KeyCode::Char('d') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                if has_scrollable_content && self.scroll_offset < max_scroll {
                    for _ in 0..12 {
                        self.scroll_down(viewport_height);
                    }
                }
                None
            }
            // Show hint for keys that users might expect to work but don't in dependency view
            KeyCode::Char('i') | KeyCode::Char('c') => Some(Action::ShowHint(
                "This task hasn't started yet. Keyboard shortcuts will be available once the task begins running.".to_string(),
            )),
            KeyCode::Char('a') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                Some(Action::ShowHint(
                    "This task hasn't started yet. Keyboard shortcuts will be available once the task begins running.".to_string(),
                ))
            }
            KeyCode::PageUp => {
                if has_scrollable_content && self.scroll_offset > 0 {
                    let page = viewport_height.saturating_sub(2).max(1);
                    self.scroll_offset = self.scroll_offset.saturating_sub(page);
                }
                None
            }
            KeyCode::PageDown => {
                if has_scrollable_content && self.scroll_offset < max_scroll {
                    let page = viewport_height.saturating_sub(2).max(1);
                    self.scroll_offset = (self.scroll_offset + page).min(max_scroll);
                }
                None
            }
            _ => None,
        }
    }
}

pub struct DependencyView<'a> {
    status_map: &'a HashMap<String, TaskStatus>,
    task_graph: &'a TaskGraph,
}

impl<'a> DependencyView<'a> {
    pub fn new(status_map: &'a HashMap<String, TaskStatus>, task_graph: &'a TaskGraph) -> Self {
        Self {
            status_map,
            task_graph,
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

    /// Check if a rectangle fits within buffer boundaries
    fn fits_in_buffer(area: &Rect, buf: &Buffer) -> bool {
        area.x + area.width <= buf.area().width && area.y < buf.area().height
    }

    /// Create a safe rectangle clamped to buffer boundaries
    fn clamp_to_buffer(area: Rect, buf: &Buffer) -> Option<Rect> {
        if area.width == 0 || area.height == 0 {
            return None;
        }

        let safe_area = Rect {
            x: area.x,
            y: area.y,
            width: area.width.min(buf.area().width.saturating_sub(area.x)),
            height: area.height.min(buf.area().height.saturating_sub(area.y)),
        };

        if safe_area.width > 0 && safe_area.height > 0 {
            Some(safe_area)
        } else {
            None
        }
    }

    /// Render padding around scrollbar with bounds checking
    fn render_scrollbar_padding(outer_area: Rect, buf: &mut Buffer, style: Style) {
        const PADDING_WIDTH: u16 = 2;
        const RIGHT_MARGIN: u16 = 3;
        const WIDTH_PADDING: u16 = 2;
        const TOTAL_WIDTH: u16 = PADDING_WIDTH + RIGHT_MARGIN + WIDTH_PADDING;

        // Early exit if area is too small or has no height
        if outer_area.width < TOTAL_WIDTH || outer_area.height == 0 {
            return;
        }

        let padding_text = Line::from(vec![Span::raw("  ")]);
        let x_pos = outer_area.x + outer_area.width - PADDING_WIDTH - RIGHT_MARGIN;
        let padding_area_width = PADDING_WIDTH + WIDTH_PADDING;

        // Render top padding
        let top_area = Rect {
            x: x_pos,
            y: outer_area.y,
            width: padding_area_width,
            height: 1,
        };

        if Self::fits_in_buffer(&top_area, buf) {
            Paragraph::new(padding_text.clone())
                .alignment(Alignment::Right)
                .style(style)
                .render(top_area, buf);
        }

        // Render bottom padding
        let bottom_area = Rect {
            x: x_pos,
            y: outer_area.y + outer_area.height - 1,
            width: padding_area_width,
            height: 1,
        };

        if Self::fits_in_buffer(&bottom_area, buf) {
            Paragraph::new(padding_text)
                .alignment(Alignment::Right)
                .style(style)
                .render(bottom_area, buf);
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

    /// Get the header text for a dependency view based on task status
    fn get_dependency_view_header(&self, state: &DependencyViewState) -> String {
        match state.task_status {
            TaskStatus::NotStarted => {
                let total_count = state.dependencies.len();
                let incomplete_count = state
                    .dependencies
                    .iter()
                    .filter(|dep| self.is_task_incomplete(dep))
                    .count();

                if incomplete_count == 0 && total_count > 0 {
                    "All dependencies satisfied, waiting for an available thread...".to_string()
                } else {
                    format!(
                        "Not started yet, waiting for {} / {} tasks to complete...",
                        incomplete_count, total_count
                    )
                }
            }
            TaskStatus::Skipped => {
                let root_causes = get_dependency_chain_failures(
                    &state.current_task,
                    self.task_graph,
                    self.status_map,
                );

                if let Some((root_task, _)) = root_causes.first() {
                    format!("Skipped because {} failed.", root_task)
                } else {
                    "Skipped due to dependency failures.".to_string()
                }
            }
            _ => "Dependencies:".to_string(),
        }
    }

    /// Get the header style for a dependency view based on task status
    fn get_dependency_view_header_style(&self, state: &DependencyViewState) -> Style {
        let base_style = match state.task_status {
            TaskStatus::NotStarted => {
                let total_count = state.dependencies.len();
                let incomplete_count = state
                    .dependencies
                    .iter()
                    .filter(|dep| self.is_task_incomplete(dep))
                    .count();

                Style::default()
                    .fg(if incomplete_count == 0 && total_count > 0 {
                        THEME.success
                    } else {
                        THEME.primary_fg
                    })
                    .add_modifier(Modifier::BOLD)
            }
            TaskStatus::Skipped => Style::default()
                .fg(THEME.warning)
                .add_modifier(Modifier::BOLD),
            _ => Style::default()
                .fg(THEME.primary_fg)
                .add_modifier(Modifier::BOLD),
        };

        Self::apply_focus_styling(base_style, state.is_focused)
    }

    fn render_dependency_list(
        &self,
        state: &mut DependencyViewState,
        inner_area: Rect,
        outer_area: Rect,
        buf: &mut Buffer,
    ) {
        // Rebuilt below for the rows actually drawn; clear up front so the
        // early-return paths (no deps / invalid area) leave no stale click map.
        state.dep_row_hits.clear();
        state.dep_row_x_range = (0, 0);

        if state.dependencies.is_empty() {
            self.render_no_dependencies(state, inner_area, buf);
            return;
        }

        let mut lines = Vec::new();

        // Add header with status-specific text and styling
        let header_text = self.get_dependency_view_header(state);
        let header_style = self.get_dependency_view_header_style(state);
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

        // First visible global line index after scrolling. Global indices 0 and 1
        // are the header and the spacing line; dependencies begin at index 2.
        let start = if state.scroll_offset > 0 && content_height > viewport_height {
            state
                .scroll_offset
                .min(content_height.saturating_sub(viewport_height))
        } else {
            0
        };
        let end = (start + viewport_height).min(content_height);

        // Capture the clickable dependency rows that are actually drawn so a mouse
        // click can navigate to the task under the cursor.
        let mut dep_row_hits = Vec::new();
        for global in start..end {
            let row_offset = (global - start) as u16;
            if row_offset >= content_area.height {
                break;
            }
            if let Some(dep_idx) = global.checked_sub(2)
                && let Some(dep) = state.dependencies.get(dep_idx)
            {
                dep_row_hits.push((content_area.y + row_offset, dep.clone()));
            }
        }
        state.dep_row_hits = dep_row_hits;
        state.dep_row_x_range = (content_area.x, content_area.x + content_area.width);

        let visible_lines: Vec<Line> = lines[start..end].to_vec();
        let paragraph = Paragraph::new(visible_lines)
            .alignment(Alignment::Left)
            .style(Style::default());

        Widget::render(paragraph, content_area, buf);

        // Render scrollbar if needed (using outer_area to extend to border edge)
        if needs_scrollbar {
            let border_color = match state.task_status {
                TaskStatus::Skipped => THEME.warning,
                _ => THEME.info,
            };

            let scrollbar_style = if state.is_focused {
                Style::default().fg(border_color)
            } else {
                Style::default()
                    .fg(border_color)
                    .add_modifier(Modifier::DIM)
            };

            let scrollbar = Scrollbar::default()
                .orientation(ScrollbarOrientation::VerticalRight)
                .begin_symbol(Some("↑"))
                .end_symbol(Some("↓"))
                .style(scrollbar_style);

            // Render scrollbar with bounds checking
            if let Some(safe_scrollbar_area) = Self::clamp_to_buffer(outer_area, buf) {
                scrollbar.render(safe_scrollbar_area, buf, &mut state.scrollbar_state);
            }

            // Render padding around scrollbar
            Self::render_scrollbar_padding(outer_area, buf, scrollbar_style);
        }
    }
}

impl<'a> StatefulWidget for DependencyView<'a> {
    type State = DependencyViewState;

    fn render(self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        // Update state with area info for responsive scrollbar
        state.pane_area = area;

        let border_color = match state.task_status {
            TaskStatus::Skipped => THEME.warning,
            _ => THEME.info,
        };

        let border_style = if state.is_focused {
            Style::default().fg(border_color)
        } else {
            Style::default()
                .fg(border_color)
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
        // Record the inner text region so the App can bound a drag-based text
        // selection over the dependency view.
        state.selection_area = Some(inner_area);
        block.render(area, buf);

        // Show different content based on task status
        if matches!(
            state.task_status,
            TaskStatus::NotStarted | TaskStatus::Skipped
        ) {
            self.render_dependency_list(state, inner_area, area, buf);
        } else {
            // Show a message indicating why the dependency view is not relevant
            let message = match state.task_status {
                TaskStatus::InProgress => "Task is now running",
                TaskStatus::Success => "Task completed successfully",
                TaskStatus::Failure => "Task failed",
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::TaskGraph;
    use ratatui::buffer::Buffer;
    use std::collections::HashMap;

    fn empty_task_graph() -> TaskGraph {
        TaskGraph {
            tasks: HashMap::new(),
            dependencies: HashMap::new(),
            continuous_dependencies: HashMap::new(),
            roots: vec![],
        }
    }

    #[test]
    fn test_handle_click_maps_rows_to_dependencies() {
        let task_graph = empty_task_graph();
        let status_map: HashMap<String, TaskStatus> = HashMap::new();

        let area = Rect {
            x: 0,
            y: 0,
            width: 60,
            height: 20,
        };
        let mut buf = Buffer::empty(area);

        let mut state = DependencyViewState {
            current_task: "app:build".to_string(),
            task_status: TaskStatus::NotStarted,
            dependencies: vec![
                "lib-a:build".to_string(),
                "lib-b:build".to_string(),
                "lib-c:build".to_string(),
            ],
            dependency_levels: HashMap::new(),
            is_focused: true,
            throbber_counter: 0,
            scroll_offset: 0,
            scrollbar_state: ScrollbarState::default(),
            pane_area: area,
            dep_row_hits: Vec::new(),
            dep_row_x_range: (0, 0),
            selection_area: None,
        };

        let view = DependencyView::new(&status_map, &task_graph);
        StatefulWidget::render(view, area, &mut buf, &mut state);

        // Inner content begins at y=2 (border + top padding). Lines are laid out as
        // header (y=2), spacing (y=3), then one dependency per row from y=4.
        assert_eq!(state.handle_click(5, 4).as_deref(), Some("lib-a:build"));
        assert_eq!(state.handle_click(5, 5).as_deref(), Some("lib-b:build"));
        assert_eq!(state.handle_click(5, 6).as_deref(), Some("lib-c:build"));

        // Header and spacing rows are not clickable.
        assert_eq!(state.handle_click(5, 2), None);
        assert_eq!(state.handle_click(5, 3), None);
        // A row with no dependency under it is not clickable.
        assert_eq!(state.handle_click(5, 7), None);
        // Clicks outside the dependency rows' x-range miss.
        assert_eq!(state.handle_click(200, 4), None);

        // The inner text region is recorded for drag-based selection and spans
        // the rendered dependency rows.
        let sel = state.selection_area.expect("selection area recorded");
        assert!(sel.y <= 4 && sel.y + sel.height > 6);
    }

    #[test]
    fn test_handle_click_respects_scroll_offset() {
        let task_graph = empty_task_graph();
        let status_map: HashMap<String, TaskStatus> = HashMap::new();

        // Short viewport so the list scrolls: header + spacing + 8 deps = 10 lines.
        let area = Rect {
            x: 0,
            y: 0,
            width: 60,
            height: 8, // inner height 4 → only a few rows visible at once
        };
        let mut buf = Buffer::empty(area);

        let deps: Vec<String> = (0..8).map(|i| format!("lib-{i}:build")).collect();
        let mut state = DependencyViewState {
            current_task: "app:build".to_string(),
            task_status: TaskStatus::NotStarted,
            dependencies: deps,
            dependency_levels: HashMap::new(),
            is_focused: true,
            throbber_counter: 0,
            scroll_offset: 3,
            scrollbar_state: ScrollbarState::default(),
            pane_area: area,
            dep_row_hits: Vec::new(),
            dep_row_x_range: (0, 0),
            selection_area: None,
        };

        let view = DependencyView::new(&status_map, &task_graph);
        StatefulWidget::render(view, area, &mut buf, &mut state);

        // With scroll_offset 3, global line 3 (the first dependency, lib-0 is global
        // index 2) is scrolled past, so the top visible row maps to lib-1.
        let top = state.dep_row_hits.first().expect("a row should be visible");
        assert_eq!(top.1, "lib-1:build");
        assert_eq!(state.handle_click(5, top.0).as_deref(), Some("lib-1:build"));
    }

    #[test]
    fn test_render_scrollbar_padding_normal_case() {
        let outer_area = Rect {
            x: 0,
            y: 0,
            width: 80,
            height: 30,
        };
        let mut buf = Buffer::empty(outer_area);
        let style = Style::default();

        // Should not panic
        DependencyView::render_scrollbar_padding(outer_area, &mut buf, style);
    }

    #[test]
    fn test_render_scrollbar_padding_narrow_buffer() {
        let outer_area = Rect {
            x: 0,
            y: 0,
            width: 76,
            height: 30,
        };
        let mut buf = Buffer::empty(outer_area);
        let style = Style::default();

        // This was a problematic case that caused panics before the fix
        DependencyView::render_scrollbar_padding(outer_area, &mut buf, style);
    }

    #[test]
    fn test_render_scrollbar_padding_very_narrow_buffer() {
        let outer_area = Rect {
            x: 0,
            y: 0,
            width: 10,
            height: 30,
        };
        let mut buf = Buffer::empty(outer_area);
        let style = Style::default();

        // Should handle very narrow buffers gracefully
        DependencyView::render_scrollbar_padding(outer_area, &mut buf, style);
    }

    #[test]
    fn test_render_scrollbar_padding_too_narrow_buffer() {
        let outer_area = Rect {
            x: 0,
            y: 0,
            width: 3,
            height: 30,
        };
        let mut buf = Buffer::empty(outer_area);
        let style = Style::default();

        // Should handle buffers too narrow for padding gracefully
        DependencyView::render_scrollbar_padding(outer_area, &mut buf, style);
    }

    #[test]
    fn test_render_scrollbar_padding_zero_width() {
        let outer_area = Rect {
            x: 0,
            y: 0,
            width: 0,
            height: 30,
        };
        let buffer_area = Rect {
            x: 0,
            y: 0,
            width: 80,
            height: 30,
        };
        let mut buf = Buffer::empty(buffer_area);
        let style = Style::default();

        // Should handle zero width gracefully
        DependencyView::render_scrollbar_padding(outer_area, &mut buf, style);
    }

    #[test]
    fn test_render_scrollbar_padding_zero_height() {
        let outer_area = Rect {
            x: 0,
            y: 0,
            width: 80,
            height: 0,
        };
        let buffer_area = Rect {
            x: 0,
            y: 0,
            width: 80,
            height: 30,
        };
        let mut buf = Buffer::empty(buffer_area);
        let style = Style::default();

        // Should handle zero height gracefully
        DependencyView::render_scrollbar_padding(outer_area, &mut buf, style);
    }

    #[test]
    fn test_render_scrollbar_padding_offset_areas() {
        let outer_area = Rect {
            x: 10,
            y: 5,
            width: 60,
            height: 20,
        };
        let buffer_area = Rect {
            x: 0,
            y: 0,
            width: 80,
            height: 30,
        };
        let mut buf = Buffer::empty(buffer_area);
        let style = Style::default();

        // Should handle offset areas correctly
        DependencyView::render_scrollbar_padding(outer_area, &mut buf, style);
    }

    #[test]
    fn test_safe_scrollbar_area_calculation() {
        let outer_area = Rect {
            x: 0,
            y: 0,
            width: 135,
            height: 37,
        };
        let buffer_area = Rect {
            x: 0,
            y: 0,
            width: 135,
            height: 37,
        };
        let buf = Buffer::empty(buffer_area);

        // This mimics the calculation done in render_dependency_list
        let safe_scrollbar_area = Rect {
            x: outer_area.x,
            y: outer_area.y,
            width: outer_area
                .width
                .min(buf.area().width.saturating_sub(outer_area.x)),
            height: outer_area
                .height
                .min(buf.area().height.saturating_sub(outer_area.y)),
        };

        // Should not exceed buffer boundaries
        assert!(safe_scrollbar_area.x + safe_scrollbar_area.width <= buf.area().width);
        assert!(safe_scrollbar_area.y + safe_scrollbar_area.height <= buf.area().height);
        assert!(safe_scrollbar_area.width > 0);
        assert!(safe_scrollbar_area.height > 0);
    }

    #[test]
    fn test_safe_scrollbar_area_problematic_case() {
        // This was the case that caused the (134, 37) panic
        let outer_area = Rect {
            x: 0,
            y: 0,
            width: 135,
            height: 37,
        };
        let buffer_area = Rect {
            x: 0,
            y: 0,
            width: 135,
            height: 37,
        };
        let buf = Buffer::empty(buffer_area);

        let safe_scrollbar_area = Rect {
            x: outer_area.x,
            y: outer_area.y,
            width: outer_area
                .width
                .min(buf.area().width.saturating_sub(outer_area.x)),
            height: outer_area
                .height
                .min(buf.area().height.saturating_sub(outer_area.y)),
        };

        // The key test: Y coordinate should never equal or exceed buffer height
        assert!(safe_scrollbar_area.y < buf.area().height);
        assert!(safe_scrollbar_area.y + safe_scrollbar_area.height <= buf.area().height);

        // Specifically test that we don't try to access Y=37 on a height-37 buffer
        assert!(safe_scrollbar_area.y + safe_scrollbar_area.height <= 37);
    }

    #[test]
    fn test_safe_scrollbar_area_edge_cases() {
        // Test various edge cases that previously caused panics
        let test_cases = vec![
            (45, 30),  // Original panic case
            (104, 30), // Second panic case
            (76, 30),  // Third panic case
            (141, 18), // Fourth panic case
            (135, 37), // Fifth panic case
        ];

        for (width, height) in test_cases {
            let outer_area = Rect {
                x: 0,
                y: 0,
                width,
                height,
            };
            let buffer_area = Rect {
                x: 0,
                y: 0,
                width,
                height,
            };
            let buf = Buffer::empty(buffer_area);

            let safe_scrollbar_area = Rect {
                x: outer_area.x,
                y: outer_area.y,
                width: outer_area
                    .width
                    .min(buf.area().width.saturating_sub(outer_area.x)),
                height: outer_area
                    .height
                    .min(buf.area().height.saturating_sub(outer_area.y)),
            };

            // These should never panic or exceed buffer bounds
            assert!(safe_scrollbar_area.x + safe_scrollbar_area.width <= width);
            assert!(safe_scrollbar_area.y + safe_scrollbar_area.height <= height);
            assert!(safe_scrollbar_area.width > 0);
            assert!(safe_scrollbar_area.height > 0);
        }
    }
}
