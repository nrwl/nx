use std::collections::HashMap;

use ratatui::{
    buffer::Buffer,
    layout::{Alignment, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, Padding, Paragraph, StatefulWidget, Widget},
};

use crate::native::tui::components::tasks_list::{TaskStatus, TasksList};
use crate::native::tui::theme::THEME;

pub struct DependencyViewState {
    pub current_task: String,
    pub task_status: TaskStatus,
    pub dependencies: Vec<String>,
    pub dependency_statuses: HashMap<String, TaskStatus>,
    pub is_focused: bool,
}

impl DependencyViewState {
    pub fn new(
        current_task: String,
        task_status: TaskStatus,
        dependencies: Vec<String>,
        dependency_statuses: HashMap<String, TaskStatus>,
        is_focused: bool,
    ) -> Self {
        Self {
            current_task,
            task_status,
            dependencies,
            dependency_statuses,
            is_focused,
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

    fn get_status_text(&self, status: TaskStatus) -> &'static str {
        match status {
            TaskStatus::Success => "completed",
            TaskStatus::LocalCacheKeptExisting => "cached (kept existing)",
            TaskStatus::LocalCache => "cached (local)",
            TaskStatus::RemoteCache => "cached (remote)",
            TaskStatus::Failure => "failed",
            TaskStatus::Skipped => "skipped",
            TaskStatus::InProgress => "in progress",
            TaskStatus::Shared => "shared",
            TaskStatus::Stopped => "stopped",
            TaskStatus::NotStarted => "not started",
        }
    }

    fn render_dependency_list(&self, state: &DependencyViewState, area: Rect, buf: &mut Buffer) {
        if state.dependencies.is_empty() {
            let no_deps_message = vec![Line::from(vec![Span::styled(
                "No dependencies - task can start immediately",
                Style::default().fg(THEME.success),
            )])];

            let paragraph = Paragraph::new(no_deps_message)
                .alignment(Alignment::Center)
                .style(Style::default());

            Widget::render(paragraph, area, buf);
            return;
        }

        let mut lines = Vec::new();
        
        // Add header
        let count = state.dependencies.len();
        let header = Line::from(vec![Span::styled(
            format!("Waiting for {} dependenc{}:", count, if count == 1 { "y" } else { "ies" }),
            Style::default().fg(THEME.primary_fg).add_modifier(Modifier::BOLD),
        )]);
        lines.push(header);
        lines.push(Line::from("")); // Empty line for spacing

        // Add each dependency
        for dep in &state.dependencies {
            let status = state.dependency_statuses.get(dep).unwrap_or(&TaskStatus::NotStarted);
            let status_icon = self.get_status_icon(*status);
            let status_text = self.get_status_text(*status);
            
            let line = Line::from(vec![
                status_icon,
                Span::styled(
                    dep.clone(),
                    Style::default().fg(THEME.primary_fg),
                ),
                Span::styled(
                    format!("  ({})", status_text),
                    Style::default().fg(THEME.secondary_fg),
                ),
            ]);
            lines.push(line);
        }

        let paragraph = Paragraph::new(lines)
            .alignment(Alignment::Left)
            .style(Style::default());

        Widget::render(paragraph, area, buf);
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
            Style::default().fg(THEME.secondary_fg).add_modifier(Modifier::DIM)
        };

        let title = format!("Dependencies for {}", state.current_task);
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