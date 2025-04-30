use color_eyre::eyre::Result;
use ratatui::{
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style, Stylize},
    text::{Line, Span},
    widgets::{Block, Cell, Paragraph, Row, Table},
    Frame,
};
use std::{
    any::Any,
    sync::{Arc, Mutex},
};
use tokio::sync::mpsc::UnboundedSender;

use crate::native::{
    tasks::types::{Task, TaskResult},
    tui::{
        action::Action,
        app::Focus,
        components::Component,
        utils::{format_duration_since, sort_task_items},
    },
};

use super::help_text::HelpText;
use super::pagination::Pagination;
use super::task_selection_manager::{SelectionMode, TaskSelectionManager};

const CACHE_STATUS_LOCAL_KEPT_EXISTING: &str = "Kept Existing";
const CACHE_STATUS_LOCAL: &str = "Local";
const CACHE_STATUS_REMOTE: &str = "Remote";
const CACHE_STATUS_NOT_YET_KNOWN: &str = "...";
const CACHE_STATUS_NOT_APPLICABLE: &str = "-";
const DURATION_NOT_YET_KNOWN: &str = "...";

// This is just a fallback value, the real value will be set via start_command on the lifecycle
const DEFAULT_MAX_PARALLEL: usize = 3;

/// Represents an individual task with its current state and execution details.
pub struct TaskItem {
    // Public to aid with sorting utility and testing
    pub name: String,
    duration: String,
    cache_status: String,
    // Public to aid with sorting utility and testing
    pub status: TaskStatus,
    terminal_output: String,
    pub continuous: bool,
    start_time: Option<i64>,
    // Public to aid with sorting utility and testing
    pub end_time: Option<i64>,
}

impl Clone for TaskItem {
    fn clone(&self) -> Self {
        Self {
            name: self.name.clone(),
            duration: self.duration.clone(),
            cache_status: self.cache_status.clone(),
            status: self.status.clone(),
            continuous: self.continuous,
            terminal_output: self.terminal_output.clone(),
            start_time: self.start_time,
            end_time: self.end_time,
        }
    }
}

impl TaskItem {
    pub fn new(name: String, continuous: bool) -> Self {
        Self {
            name,
            duration: if continuous {
                "Continuous".to_string()
            } else {
                "...".to_string()
            },
            cache_status: if continuous {
                // We know upfront that the cache status will not be applicable
                CACHE_STATUS_NOT_APPLICABLE.to_string()
            } else {
                CACHE_STATUS_NOT_YET_KNOWN.to_string()
            },
            status: TaskStatus::NotStarted,
            continuous,
            terminal_output: String::new(),
            start_time: None,
            end_time: None,
        }
    }

    pub fn update_status(&mut self, status: TaskStatus) {
        self.status = status;
        // Update the cache_status label that gets printed in the UI
        if self.continuous {
            self.cache_status = CACHE_STATUS_NOT_APPLICABLE.to_string();
        } else {
            self.cache_status = match status {
                TaskStatus::InProgress => CACHE_STATUS_NOT_YET_KNOWN.to_string(),
                TaskStatus::LocalCacheKeptExisting => CACHE_STATUS_LOCAL_KEPT_EXISTING.to_string(),
                TaskStatus::LocalCache => CACHE_STATUS_LOCAL.to_string(),
                TaskStatus::RemoteCache => CACHE_STATUS_REMOTE.to_string(),
                _ => CACHE_STATUS_NOT_APPLICABLE.to_string(),
            }
        }
    }
}

#[napi]
#[derive(Debug, PartialEq, Eq)]
pub enum TaskStatus {
    // Explicit statuses that can come from the task runner
    Success,
    Failure,
    Skipped,
    LocalCacheKeptExisting,
    LocalCache,
    RemoteCache,
    // Internal-only statuses for UI state management
    // These will never come from the task runner - they are managed by our Rust code
    NotStarted,
    InProgress,
    // This task is being run in a different process
    Shared,
    // This continuous task has been stopped by Nx
    Stopped,
}

impl std::str::FromStr for TaskStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        // We only parse external statuses that can come from the task runner
        // Internal statuses (NotStarted, InProgress) are managed by our Rust code
        match s.to_lowercase().as_str() {
            "success" => Ok(Self::Success),
            "failure" => Ok(Self::Failure),
            "skipped" => Ok(Self::Skipped),
            "local-cache-kept-existing" => Ok(Self::LocalCacheKeptExisting),
            "local-cache" => Ok(Self::LocalCache),
            "remote-cache" => Ok(Self::RemoteCache),
            // We don't accept InProgress or NotStarted from external sources
            "in-progress" | "in_progress" | "running" | "not-started" | "not_started"
            | "pending" => Err(format!(
                "Status '{}' cannot be set externally - it is managed internally by the UI",
                s
            )),
            _ => Err(format!("Unknown task status: {}", s)),
        }
    }
}

#[napi]
pub fn parse_task_status(string_status: String) -> napi::Result<TaskStatus> {
    string_status
        .as_str()
        .parse()
        .map_err(napi::Error::from_reason)
}

/// A list component that displays and manages tasks in a terminal UI.
/// Provides filtering, sorting, and output display capabilities.
pub struct TasksList {
    selection_manager: Arc<Mutex<TaskSelectionManager>>,
    pub tasks: Vec<TaskItem>,    // Source of truth - all tasks
    filtered_names: Vec<String>, // Names of tasks that match the filter
    throbber_counter: usize,
    pub filter_mode: bool,
    filter_text: String,
    filter_persisted: bool, // Whether the filter is in a persisted state
    pane_tasks: [Option<String>; 2], // Tasks assigned to panes 1 and 2 (0-indexed)
    spacebar_mode: bool,    // Whether we're in spacebar mode (output follows selection)
    cloud_message: Option<String>,
    max_parallel: usize, // Maximum number of parallel tasks
    title_text: String,
    pub action_tx: Option<UnboundedSender<Action>>,
    focus: Focus,
    pinned_tasks: [Option<String>; 2],
}

impl TasksList {
    /// Creates a new TasksList with the given tasks.
    /// Converts the input tasks into TaskItems and initializes the UI state.
    pub fn new(
        tasks: Vec<Task>,
        pinned_tasks: Vec<String>,
        initial_focus: Focus,
        title_text: String,
        selection_manager: Arc<Mutex<TaskSelectionManager>>,
    ) -> Self {
        let mut task_items = Vec::new();

        for task in tasks {
            task_items.push(TaskItem::new(task.id, task.continuous.unwrap_or(false)));
        }

        let filtered_names = Vec::new();

        let mut iter = pinned_tasks.into_iter().take(2);
        let pane_tasks = [iter.next(), iter.next()];

        Self {
            selection_manager,
            filtered_names,
            tasks: task_items,
            throbber_counter: 0,
            filter_mode: false,
            filter_text: String::new(),
            filter_persisted: false,
            pane_tasks,
            spacebar_mode: false,
            cloud_message: None,
            max_parallel: DEFAULT_MAX_PARALLEL,
            title_text,
            action_tx: None,
            focus: initial_focus,
            pinned_tasks: [None, None],
        }
    }

    pub fn set_max_parallel(&mut self, max_parallel: Option<u32>) {
        self.max_parallel = max_parallel.unwrap_or(DEFAULT_MAX_PARALLEL as u32) as usize;
    }

    /// Returns true if the task list is currently focused
    fn is_task_list_focused(&self) -> bool {
        matches!(self.focus, Focus::TaskList)
    }

    /// Moves the selection to the next task in the list.
    fn next_task(&mut self) {
        self.selection_manager.lock().unwrap().next();
    }

    /// Moves the selection to the previous task in the list.
    fn previous_task(&mut self) {
        self.selection_manager.lock().unwrap().previous();
    }

    /// Moves to the next page of tasks.
    /// Does nothing if there are no filtered tasks.
    fn next_page(&mut self) {
        if self.filtered_names.is_empty() {
            return;
        }
        self.selection_manager.lock().unwrap().next_page();
    }

    /// Moves to the previous page of tasks.
    /// Does nothing if there are no filtered tasks.
    fn previous_page(&mut self) {
        if self.filtered_names.is_empty() {
            return;
        }
        self.selection_manager.lock().unwrap().previous_page();
    }

    /// Creates a list of task entries with separators between different status groups.
    /// Groups tasks into in-progress, completed, and pending, with None values as separators.
    /// NEEDS ANALYSIS: Consider if this complex grouping logic should be moved to a dedicated type.
    fn create_entries_with_separator(&self, filtered_names: &[String]) -> Vec<Option<String>> {
        // Create vectors for each status group
        let mut in_progress = Vec::new();
        let mut completed = Vec::new();
        let mut pending = Vec::new();

        // Single iteration to categorize tasks
        for task_name in filtered_names {
            if let Some(task) = self.tasks.iter().find(|t| &t.name == task_name) {
                match task.status {
                    TaskStatus::InProgress => in_progress.push(task_name.clone()),
                    TaskStatus::NotStarted => pending.push(task_name.clone()),
                    _ => completed.push(task_name.clone()),
                }
            }
        }

        let mut entries = Vec::new();

        // Check if there are any tasks that need to be run
        let has_tasks_to_run = !in_progress.is_empty() || !pending.is_empty();

        // Only show the parallel section if there are tasks in progress or pending
        if has_tasks_to_run {
            // Create a fixed section for in-progress tasks (self.max_parallel slots)
            // Add actual in-progress tasks
            entries.extend(in_progress.iter().map(|name| Some(name.clone())));

            // Fill remaining slots with None up to self.max_parallel
            let in_progress_count = in_progress.len();
            if in_progress_count < self.max_parallel {
                // When we have fewer InProgress tasks than self.max_parallel, fill the remaining slots
                // with empty placeholder rows to maintain the fixed height
                entries.extend(std::iter::repeat(None).take(self.max_parallel - in_progress_count));
            }

            // Always add a separator after the parallel tasks section with a bottom cap
            // This will be marked for special styling with the bottom box corner
            entries.push(None);
        }

        // Add completed tasks
        entries.extend(completed.iter().map(|name| Some(name.clone())));

        // Add separator before pending tasks if there are any pending tasks and completed tasks exist
        if !pending.is_empty() && !completed.is_empty() {
            entries.push(None);
        }

        // Add pending tasks
        entries.extend(pending.into_iter().map(Some));

        entries
    }

    // Add a helper method to safely check if we should show the parallel in progress section
    fn should_show_parallel_section(&self) -> bool {
        // Only show the parallel section if we're on the first page and have tasks in progress or pending
        let is_first_page = self.selection_manager.lock().unwrap().get_current_page() == 0;
        let has_active_tasks = self
            .tasks
            .iter()
            .any(|t| matches!(t.status, TaskStatus::InProgress | TaskStatus::NotStarted));

        is_first_page && has_active_tasks
    }

    // Add a helper method to check if we're in the initial loading state
    fn is_loading_state(&self) -> bool {
        // We're in loading state if all tasks are NotStarted and there are no InProgress tasks
        !self.tasks.is_empty()
            && self
                .tasks
                .iter()
                .all(|t| matches!(t.status, TaskStatus::NotStarted))
            && !self
                .tasks
                .iter()
                .any(|t| matches!(t.status, TaskStatus::InProgress))
    }

    /// Recalculates the number of items that can be displayed per page based on the available height.
    /// Updates the selection manager with the new page size and current entries.
    fn recalculate_pages(&mut self, available_height: u16) {
        // Update selection manager's items per page
        self.selection_manager
            .lock()
            .unwrap()
            .set_items_per_page(available_height as usize);

        // Update entries in selection manager with separator
        let entries = self.create_entries_with_separator(&self.filtered_names);
        self.selection_manager
            .lock()
            .unwrap()
            .update_entries(entries);
    }

    /// Enters filter mode for task filtering.
    /// If there is existing filter text that isn't persisted, persists it instead.
    pub fn enter_filter_mode(&mut self) {
        if !self.filter_text.is_empty() && !self.filter_persisted {
            self.persist_filter();
        } else {
            // Otherwise enter normal filter mode
            self.filter_persisted = false;
            self.filter_mode = true;
        }
    }

    /// Exits filter mode and clears the persisted state.
    pub fn exit_filter_mode(&mut self) {
        self.filter_mode = false;
        self.filter_persisted = false;
    }

    pub fn persist_filter(&mut self) {
        self.filter_persisted = true;
        self.filter_mode = false;
    }

    /// Clears the current filter and resets filter-related state.
    pub fn clear_filter(&mut self) {
        self.filter_mode = false;
        self.filter_persisted = false;
        self.filter_text.clear();
        self.apply_filter();
    }

    /// Adds a character to the filter text if not in persisted mode.
    /// Special handling for '/' character which can trigger filter persistence.
    pub fn add_filter_char(&mut self, c: char) {
        // Never add '/' character to filter text
        if c == '/' {
            if !self.filter_text.is_empty() && !self.filter_persisted {
                // If we have filter text and it's not persisted, pressing / should persist it
                self.filter_persisted = true;
                self.filter_mode = false;
            }
            return;
        }

        // Otherwise, only add the character if we're not in persisted mode
        if !self.filter_persisted {
            self.filter_text.push(c);
            self.apply_filter();
        }
    }

    /// Removes the last character from the filter text.
    pub fn remove_filter_char(&mut self) {
        self.filter_text.pop();
        self.apply_filter();
    }

    /// Applies the current filter text to the task list.
    /// Updates filtered tasks and selection manager entries.
    pub fn apply_filter(&mut self) {
        // Set the appropriate selection mode based on our current state
        let should_track_by_name = self.spacebar_mode || self.has_visible_panes();
        let mode = if should_track_by_name {
            SelectionMode::TrackByName
        } else {
            SelectionMode::TrackByPosition
        };
        self.selection_manager
            .lock()
            .unwrap()
            .set_selection_mode(mode);

        // Apply filter
        if self.filter_text.is_empty() {
            self.filtered_names = self.tasks.iter().map(|t| t.name.clone()).collect();
        } else {
            self.filtered_names = self
                .tasks
                .iter()
                .filter(|item| {
                    item.name
                        .to_lowercase()
                        .contains(&self.filter_text.to_lowercase())
                })
                .map(|t| t.name.clone())
                .collect();
        }

        // Update entries in selection manager with separator
        let entries = self.create_entries_with_separator(&self.filtered_names);
        self.selection_manager
            .lock()
            .unwrap()
            .update_entries(entries);
    }

    /// Checks if the current view has any visible output panes.
    pub fn has_visible_panes(&self) -> bool {
        self.pane_tasks.iter().any(|t| t.is_some())
    }

    /// Gets the table style based on the current focus state.
    /// Returns a dimmed style when focus is not on the task list.
    fn get_table_style(&self) -> Style {
        if self.is_task_list_focused() {
            Style::default()
        } else {
            Style::default().dim()
        }
    }

    fn pin_task(&mut self, task_name: String, pane_idx: usize) {
        self.pinned_tasks[pane_idx] = Some(task_name);
    }

    fn unpin_task(&mut self, _task_name: String, pane_idx: usize) {
        self.pinned_tasks[pane_idx] = None;
    }

    fn unpin_all_tasks(&mut self) {
        self.pinned_tasks = [None, None];
    }

    pub fn sort_tasks(&mut self) {
        // Set the appropriate selection mode based on our current state
        let should_track_by_name = self.spacebar_mode || self.has_visible_panes();
        let mode = if should_track_by_name {
            SelectionMode::TrackByName
        } else {
            SelectionMode::TrackByPosition
        };
        self.selection_manager
            .lock()
            .unwrap()
            .set_selection_mode(mode);

        // Sort the tasks
        sort_task_items(&mut self.tasks);

        // Update filtered indices to match new order
        self.filtered_names = self.tasks.iter().map(|t| t.name.clone()).collect();

        if !self.filter_text.is_empty() {
            // Apply filter but don't sort again
            self.filtered_names = self
                .tasks
                .iter()
                .filter(|item| {
                    item.name
                        .to_lowercase()
                        .contains(&self.filter_text.to_lowercase())
                })
                .map(|t| t.name.clone())
                .collect();
        }

        // Update the entries in the selection manager
        let entries = self.create_entries_with_separator(&self.filtered_names);
        self.selection_manager
            .lock()
            .unwrap()
            .update_entries(entries);
    }

    /// Creates header cells for the task list table.
    /// Shows either filter input or task status based on current state.
    fn get_header_cells(&self, has_narrow_area_width: bool) -> Vec<Cell> {
        let status_style = if !self.is_task_list_focused() {
            Style::default().fg(Color::DarkGray).dim()
        } else {
            Style::default().fg(Color::DarkGray)
        };

        // Determine if all tasks are completed and the status color to use
        let all_tasks_completed = !self.tasks.is_empty()
            && self.tasks.iter().all(|t| {
                matches!(
                    t.status,
                    TaskStatus::Success
                        | TaskStatus::Failure
                        | TaskStatus::Skipped
                        | TaskStatus::LocalCache
                        | TaskStatus::LocalCacheKeptExisting
                        | TaskStatus::RemoteCache
                )
            });

        let header_color = if all_tasks_completed {
            let has_failures = self
                .tasks
                .iter()
                .any(|t| matches!(t.status, TaskStatus::Failure));
            if has_failures {
                Color::Red
            } else {
                Color::Green
            }
        } else {
            Color::Cyan
        };

        // Leave first cell empty for the logo
        let status_cell = Cell::from("").style(status_style);

        // Completion status text is now shown with the logo in the first cell
        // Just provide an empty second cell
        let status_text = String::new();

        if has_narrow_area_width {
            vec![
                status_cell,
                Cell::from(status_text),
                Cell::from(Line::from("Duration").right_aligned()).style(
                    Style::default()
                        .fg(header_color)
                        .add_modifier(Modifier::BOLD),
                ),
            ]
        } else {
            vec![
                status_cell,
                Cell::from(status_text),
                Cell::from(Line::from("Cache").right_aligned()).style(
                    Style::default()
                        .fg(header_color)
                        .add_modifier(Modifier::BOLD),
                ),
                Cell::from(Line::from("Duration").right_aligned()).style(
                    Style::default()
                        .fg(header_color)
                        .add_modifier(Modifier::BOLD),
                ),
            ]
        }
    }

    /// Updates their status to InProgress and triggers a sort.
    pub fn start_tasks(&mut self, tasks: Vec<Task>) {
        for task in tasks {
            if let Some(task_item) = self.tasks.iter_mut().find(|t| t.name == task.id) {
                task_item.update_status(TaskStatus::InProgress);
            }
        }
        self.sort_tasks();
    }

    /// Updates a task's status and triggers a sort of the list.
    pub fn update_task_status(&mut self, task_id: String, status: TaskStatus) {
        if let Some(task_item) = self.tasks.iter_mut().find(|t| t.name == task_id) {
            task_item.update_status(status);
            self.sort_tasks();
        }
    }

    pub fn end_tasks(&mut self, task_results: Vec<TaskResult>) {
        for task_result in task_results {
            if let Some(task) = self
                .tasks
                .iter_mut()
                .find(|t| t.name == task_result.task.id)
            {
                if task_result.task.start_time.is_some() && task_result.task.end_time.is_some() {
                    task.start_time = Some(task_result.task.start_time.unwrap());
                    task.end_time = Some(task_result.task.end_time.unwrap());
                    task.duration = format_duration_since(
                        task_result.task.start_time.unwrap(),
                        task_result.task.end_time.unwrap(),
                    );
                }
            }
        }
        self.sort_tasks();
    }
}

impl Component for TasksList {
    fn register_action_handler(&mut self, tx: UnboundedSender<Action>) -> Result<()> {
        self.action_tx = Some(tx);
        Ok(())
    }

    fn draw(&mut self, f: &mut Frame<'_>, area: Rect) -> Result<()> {
        let has_short_area_height = area.height < 12;
        let has_narrow_area_width = area.width < 90;
        let filter_is_active = self.filter_mode || !self.filter_text.is_empty();

        // Create layout for title, table and bottom elements
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints(if filter_is_active {
                // When filter is active, keep the original layout with space for filter display
                if has_short_area_height {
                    vec![
                        Constraint::Fill(1),   // Table gets most space
                        Constraint::Length(2), // Filter display (when active)
                        Constraint::Length(1), // Empty line between filter and pagination
                        Constraint::Length(1), // Bottom bar (pagination)
                    ]
                } else if area.width < 60 {
                    vec![
                        Constraint::Fill(1),   // Table gets most space
                        Constraint::Length(2), // Filter display (when active)
                        Constraint::Length(1), // Empty line between filter and pagination
                        Constraint::Length(2), // Bottom bar (2 units for stacked layout)
                    ]
                } else {
                    vec![
                        Constraint::Fill(1),   // Table gets most space
                        Constraint::Length(2), // Filter display (when active)
                        Constraint::Length(1), // Empty line between filter and pagination
                        Constraint::Length(1), // Bottom bar
                    ]
                }
            } else {
                // When filter is not active, don't allocate space for it
                if has_short_area_height {
                    vec![
                        Constraint::Fill(1),   // Table gets all available space
                        Constraint::Length(1), // Bottom bar (pagination)
                    ]
                } else if area.width < 60 {
                    vec![
                        Constraint::Fill(1),   // Table gets all available space
                        Constraint::Length(2), // Bottom bar (2 units for stacked layout)
                    ]
                } else {
                    vec![
                        Constraint::Fill(1),   // Table gets all available space
                        Constraint::Length(1), // Bottom bar
                    ]
                }
            })
            .split(area);

        // Assign table_area and pagination_area based on whether filter is active
        let (table_area, pagination_area) = if filter_is_active {
            let table_area = chunks[0];
            let filter_area = chunks[1];
            let pagination_area = chunks[3]; // Bottom bar area

            // Only render filter if active
            // After rendering the table, render the filter text (we know filter is active here)
            let hidden_tasks = self.tasks.len() - self.filtered_names.len();

            // Render exactly as it was before, just at the bottom
            // Add proper indentation to align with task content - 4 spaces matches the task indentation
            let filter_text = format!("  Filter: {}", self.filter_text);

            // Determine if filter text should be dimmed based on focus
            let should_dim = !self.is_task_list_focused();

            let filter_style = if should_dim {
                Style::default().fg(Color::Yellow).dim()
            } else {
                Style::default().fg(Color::Yellow)
            };

            let instruction_text = if hidden_tasks > 0 {
                if self.filter_persisted {
                    format!(
                        "  -> {} tasks filtered out. Press / to edit, <esc> to clear",
                        hidden_tasks
                    )
                } else {
                    format!(
                        "  -> {} tasks filtered out. Press / to persist, <esc> to clear",
                        hidden_tasks
                    )
                }
            } else if self.filter_persisted {
                "    Press / to edit filter".to_string()
            } else {
                "  Press <esc> to clear filter".to_string()
            };

            // Render the full filter information exactly as it was before
            let filter_lines = vec![
                Line::from(vec![Span::styled(filter_text, filter_style)]),
                Line::from(vec![Span::styled(instruction_text, filter_style)]),
            ];

            let filter_paragraph = Paragraph::new(filter_lines).alignment(Alignment::Left);

            f.render_widget(filter_paragraph, filter_area);

            (table_area, pagination_area)
        } else {
            // When filter is not active, use simpler layout
            let table_area = chunks[0];
            let pagination_area = chunks[1]; // Bottom bar is the second chunk when no filter
            (table_area, pagination_area)
        };

        // Reserve space for pagination and borders
        self.recalculate_pages(table_area.height.saturating_sub(4));

        let visible_entries = self
            .selection_manager
            .lock()
            .unwrap()
            .get_current_page_entries();
        let selected_style = Style::default().add_modifier(Modifier::BOLD);
        let normal_style = Style::default();

        // Determine if all tasks are completed
        let all_tasks_completed = !self.tasks.is_empty()
            && self.tasks.iter().all(|t| {
                matches!(
                    t.status,
                    TaskStatus::Success
                        | TaskStatus::Failure
                        | TaskStatus::Skipped
                        | TaskStatus::Stopped
                        | TaskStatus::LocalCache
                        | TaskStatus::LocalCacheKeptExisting
                        | TaskStatus::RemoteCache
                )
            });

        // Determine the color of the NX logo based on task status
        let logo_color = if self.tasks.is_empty() {
            // No tasks
            Color::Cyan
        } else if all_tasks_completed {
            // All tasks are completed, check if any failed
            let has_failures = self
                .tasks
                .iter()
                .any(|t| matches!(t.status, TaskStatus::Failure));
            if has_failures {
                Color::Red
            } else {
                Color::Green
            }
        } else {
            // Tasks are still running
            Color::Cyan
        };

        // Get header cells using the existing method but add NX logo to first cell
        let mut header_cells = self.get_header_cells(has_narrow_area_width);

        // Get the style based on whether all tasks are completed
        let title_color = if all_tasks_completed {
            // Use the logo color for the title text as well
            logo_color
        } else {
            Color::White
        };

        // Apply modifiers based on focus state
        let title_style = if !self.is_task_list_focused() {
            // Keep the color but add dim modifier
            Style::default()
                .fg(title_color)
                .add_modifier(Modifier::BOLD)
                .add_modifier(Modifier::DIM)
        } else {
            // Normal style with bold
            Style::default()
                .fg(title_color)
                .add_modifier(Modifier::BOLD)
        };

        // Replace the first cell with a new one containing the NX logo and title
        if !header_cells.is_empty() {
            // Determine if we need to add the vertical line with top corner
            let show_parallel = self.should_show_parallel_section();
            let is_first_page = self.selection_manager.lock().unwrap().get_current_page() == 0;
            let running = self
                .tasks
                .iter()
                .filter(|t| matches!(t.status, TaskStatus::InProgress))
                .count();

            // First cell: Just the NX logo and box corner if needed
            let mut first_cell_spans = vec![Span::styled(
                " NX ",
                title_style.bold().bg(logo_color).fg(Color::Black),
            )];

            // Add box corner if needed
            if show_parallel && is_first_page && running > 0 && !self.is_loading_state() {
                first_cell_spans.push(Span::raw(" "));
                // Top corner of the box
            }

            // Second cell: Put the title text in the task name column
            let mut second_cell_spans = vec![];

            // Add title with appropriate styling
            if all_tasks_completed {
                // Get the total time if available
                if let (Some(first_start), Some(last_end)) = (
                    self.tasks.iter().filter_map(|t| t.start_time).min(),
                    self.tasks.iter().filter_map(|t| t.end_time).max(),
                ) {
                    // Create text with separate spans for completed message and time
                    let title_segment = format!("Completed {} ", self.title_text);
                    let time_str = format_duration_since(first_start, last_end);

                    second_cell_spans.push(Span::styled(title_segment, title_style));
                    second_cell_spans.push(Span::styled(
                        format!("({})", time_str),
                        Style::default().dim(),
                    ));
                } else {
                    second_cell_spans.push(Span::styled(
                        format!("Completed {}", self.title_text),
                        title_style,
                    ));
                }
            } else {
                second_cell_spans.push(Span::styled(
                    format!("Running {}...", self.title_text),
                    title_style,
                ));
            }

            // Update the cells
            header_cells[0] = Cell::from(Line::from(first_cell_spans));
            if header_cells.len() > 1 {
                header_cells[1] = Cell::from(Line::from(second_cell_spans));
            }
        }

        let header = Row::new(header_cells)
            .style(normal_style)
            .height(1)
            .top_margin(1) // Restore margin above header
            .bottom_margin(0); // Keep zero margin below header to avoid gaps

        // Create rows including filter summary if needed
        let mut all_rows = Vec::new();

        // Add an empty row right after the header to create visual spacing
        // while maintaining the seamless vertical line if we're showing the parallel section
        if self.should_show_parallel_section() {
            let is_first_page = self.selection_manager.lock().unwrap().get_current_page() == 0;

            let empty_cells = if has_narrow_area_width {
                vec![
                    Cell::from(Line::from(vec![
                        // Space for selection indicator
                        Span::raw(" "),
                        // Add vertical line for visual continuity, only on first page
                        if is_first_page {
                            Span::styled("│", Style::default().fg(Color::Cyan))
                        } else {
                            Span::raw(" ")
                        },
                        Span::raw("   "),
                    ])),
                    Cell::from(""),
                    Cell::from(""),
                ]
            } else {
                vec![
                    Cell::from(Line::from(vec![
                        // Space for selection indicator
                        Span::raw(" "),
                        // Add vertical line for visual continuity, only on first page
                        if is_first_page {
                            Span::styled("│", Style::default().fg(Color::Cyan))
                        } else {
                            Span::raw(" ")
                        },
                        Span::raw("   "),
                    ])),
                    Cell::from(""),
                    Cell::from(""),
                    Cell::from(""),
                ]
            };
            all_rows.push(Row::new(empty_cells).height(1).style(normal_style));
        } else {
            // Even when there's no parallel section, add an empty row for consistent spacing
            // but don't include any vertical line styling
            let empty_cells = if has_narrow_area_width {
                vec![
                    Cell::from("   "), // Just spaces for indentation, no vertical line
                    Cell::from(""),
                    Cell::from(""),
                ]
            } else {
                vec![
                    Cell::from("   "), // Just spaces for indentation, no vertical line
                    Cell::from(""),
                    Cell::from(""),
                    Cell::from(""),
                ]
            };
            all_rows.push(Row::new(empty_cells).height(1).style(normal_style));
        }

        // Add task rows
        all_rows.extend(visible_entries.iter().enumerate().map(|(row_idx, entry)| {
            if let Some(task_name) = entry {
                // Find the task in the filtered list
                if let Some(task) = self.tasks.iter().find(|t| &t.name == task_name) {
                    let is_selected = self
                        .selection_manager
                        .lock()
                        .unwrap()
                        .is_selected(&task_name);

                    // Use the helper method to check if we should show the parallel section
                    let show_parallel = self.should_show_parallel_section();

                    // Only consider rows for the parallel section if appropriate
                    let is_in_parallel_section = show_parallel && row_idx < self.max_parallel;

                    let status_cell = match task.status {
                        TaskStatus::Success => Cell::from(Line::from(vec![
                            Span::raw(if is_selected { ">" } else { " " }),
                            Span::raw(" "),
                            Span::styled("✔", Style::default().fg(Color::Green)),
                            Span::raw(" "),
                        ])),
                        TaskStatus::Failure => Cell::from(Line::from(vec![
                            Span::raw(if is_selected { ">" } else { " " }),
                            Span::raw(" "),
                            Span::styled("✖", Style::default().fg(Color::Red)),
                            Span::raw(" "),
                        ])),
                        TaskStatus::Skipped => Cell::from(Line::from(vec![
                            Span::raw(if is_selected { ">" } else { " " }),
                            Span::raw(" "),
                            Span::styled("⏭", Style::default().fg(Color::Yellow)),
                            Span::raw(" "),
                        ])),
                        TaskStatus::LocalCacheKeptExisting => Cell::from(Line::from(vec![
                            Span::raw(if is_selected { ">" } else { " " }),
                            Span::raw(" "),
                            Span::styled("◼", Style::default().fg(Color::Green)),
                            Span::raw(" "),
                        ])),
                        TaskStatus::LocalCache => Cell::from(Line::from(vec![
                            Span::raw(if is_selected { ">" } else { " " }),
                            Span::raw(" "),
                            Span::styled("◼", Style::default().fg(Color::Green)),
                            Span::raw(" "),
                        ])),
                        TaskStatus::RemoteCache => Cell::from(Line::from(vec![
                            Span::raw(if is_selected { ">" } else { " " }),
                            Span::raw(" "),
                            Span::styled("▼", Style::default().fg(Color::Green)),
                            Span::raw(" "),
                        ])),
                        TaskStatus::InProgress | TaskStatus::Shared => {
                            let throbber_chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
                            let throbber_char =
                                throbber_chars[self.throbber_counter % throbber_chars.len()];

                            let mut spans = vec![Span::raw(if is_selected { ">" } else { " " })];

                            // Add vertical line for parallel section if needed (always takes 1 character width)
                            if is_in_parallel_section
                                && self.selection_manager.lock().unwrap().get_current_page() == 0
                            {
                                spans.push(Span::styled("│", Style::default().fg(Color::Cyan)));
                            } else {
                                spans.push(Span::raw(" "));
                            }

                            // Add the spinner with consistent spacing
                            spans.push(Span::styled(
                                throbber_char.to_string(),
                                Style::default().fg(Color::LightCyan),
                            ));

                            // Add trailing space to maintain consistent width
                            spans.push(Span::raw(" "));

                            Cell::from(Line::from(spans))
                        }
                        TaskStatus::Stopped => Cell::from(Line::from(vec![
                            Span::raw(if is_selected { ">" } else { " " }),
                            Span::raw(" "),
                            Span::styled("⯀️", Style::default().fg(Color::DarkGray)),
                            Span::raw(" "),
                        ])),
                        TaskStatus::NotStarted => Cell::from(Line::from(vec![
                            Span::raw(if is_selected { ">" } else { " " }),
                            // No need for parallel section check for pending tasks
                            Span::raw(" "),
                            Span::styled("·", Style::default().fg(Color::DarkGray)),
                            Span::raw(" "),
                        ])),
                    };

                    let name = {
                        // Show output indicators if the task is pinned to a pane (but not in spacebar mode)
                        let output_indicators = if !self.spacebar_mode {
                            self.pinned_tasks
                                .iter()
                                .enumerate()
                                .filter_map(|(idx, task)| {
                                    if task.as_deref() == Some(task_name.as_str()) {
                                        Some(format!("[Pinned output {}]", idx + 1))
                                    } else {
                                        None
                                    }
                                })
                                .collect::<Vec<_>>()
                                .join(" ")
                        } else {
                            String::new()
                        };

                        if !output_indicators.is_empty() {
                            let line = Line::from(vec![
                                Span::raw(task_name),
                                Span::raw(" "),
                                Span::styled(output_indicators, Style::default().dim()),
                            ]);
                            Cell::from(line)
                        } else {
                            Cell::from(task_name.clone())
                        }
                    };

                    let mut row_cells = vec![status_cell, name];

                    if has_narrow_area_width {
                        // In narrow viewport mode (not collapsed), show only duration column
                        let duration_cell = Cell::from(
                            Line::from(match task.duration.as_str() {
                                "" | "Continuous" | DURATION_NOT_YET_KNOWN => {
                                    vec![Span::styled(
                                        task.duration.clone(),
                                        if is_selected {
                                            Style::default().add_modifier(Modifier::BOLD)
                                        } else {
                                            Style::default().dim()
                                        },
                                    )]
                                }
                                _ => vec![Span::styled(
                                    task.duration.clone(),
                                    if is_selected {
                                        Style::default().add_modifier(Modifier::BOLD)
                                    } else {
                                        Style::default()
                                    },
                                )],
                            })
                            .right_aligned(),
                        );

                        row_cells.push(duration_cell);
                    } else {
                        // In full width mode, show both cache and duration columns
                        // Cache status cell
                        let cache_cell = Cell::from(
                            Line::from(match task.cache_status.as_str() {
                                CACHE_STATUS_NOT_YET_KNOWN | CACHE_STATUS_NOT_APPLICABLE => {
                                    vec![Span::styled(
                                        task.cache_status.clone(),
                                        if is_selected {
                                            Style::default().add_modifier(Modifier::BOLD)
                                        } else {
                                            Style::default().dim()
                                        },
                                    )]
                                }
                                _ => vec![Span::styled(
                                    task.cache_status.clone(),
                                    if is_selected {
                                        Style::default().add_modifier(Modifier::BOLD)
                                    } else {
                                        Style::default()
                                    },
                                )],
                            })
                            .right_aligned(),
                        );

                        // Duration cell
                        let duration_cell = Cell::from(
                            Line::from(match task.duration.as_str() {
                                "" | "Continuous" | DURATION_NOT_YET_KNOWN => {
                                    vec![Span::styled(
                                        task.duration.clone(),
                                        if is_selected {
                                            Style::default().add_modifier(Modifier::BOLD)
                                        } else {
                                            Style::default().dim()
                                        },
                                    )]
                                }
                                _ => vec![Span::styled(
                                    task.duration.clone(),
                                    if is_selected {
                                        Style::default().add_modifier(Modifier::BOLD)
                                    } else {
                                        Style::default()
                                    },
                                )],
                            })
                            .right_aligned(),
                        );

                        row_cells.push(cache_cell);
                        row_cells.push(duration_cell);
                    }

                    Row::new(row_cells).height(1).style(if is_selected {
                        selected_style
                    } else {
                        normal_style
                    })
                } else {
                    // This shouldn't happen, but provide a fallback
                    Row::new(vec![Cell::from("")]).height(1)
                }
            } else {
                // Handle None entries (separators)
                // Check if this is within the parallel section
                let show_parallel = self.should_show_parallel_section();
                let is_in_parallel_section = show_parallel && row_idx < self.max_parallel;

                // Check if this is the bottom cap (the separator after the last parallel task)
                let is_bottom_cap = show_parallel && row_idx == self.max_parallel;

                if is_in_parallel_section {
                    // Add a vertical line for separators in the parallel section, only on first page
                    let is_first_page =
                        self.selection_manager.lock().unwrap().get_current_page() == 0;

                    let empty_cells = if has_narrow_area_width {
                        vec![
                            Cell::from(Line::from(vec![
                                // Space for selection indicator (fixed width of 2)
                                Span::raw(" "),
                                // Add space and vertical line for parallel section (fixed position)
                                if is_first_page {
                                    Span::styled("│", Style::default().fg(Color::Cyan))
                                } else {
                                    Span::raw("  ")
                                },
                                Span::styled("·  ", Style::default().dim()),
                            ])),
                            Cell::from(Span::styled("Waiting for task...", Style::default().dim())),
                            Cell::from(""),
                        ]
                    } else {
                        vec![
                            Cell::from(Line::from(vec![
                                // Space for selection indicator (fixed width of 2)
                                Span::raw(" "),
                                // Add space and vertical line for parallel section (fixed position)
                                if is_first_page {
                                    Span::styled("│", Style::default().fg(Color::Cyan))
                                } else {
                                    Span::raw("  ")
                                },
                                Span::styled("·  ", Style::default().dim()),
                            ])),
                            Cell::from(Span::styled("Waiting for task...", Style::default().dim())),
                            Cell::from(""),
                            Cell::from(""),
                        ]
                    };
                    Row::new(empty_cells).height(1).style(normal_style)
                } else if is_bottom_cap {
                    // Add the bottom corner cap at the end of the parallel section, only on first page
                    let is_first_page =
                        self.selection_manager.lock().unwrap().get_current_page() == 0;

                    let empty_cells = if has_narrow_area_width {
                        vec![
                            Cell::from(Line::from(vec![
                                // Space for selection indicator (fixed width of 2)
                                Span::raw(" "),
                                // Add bottom corner for the box, or just spaces if not on first page
                                if is_first_page {
                                    Span::styled("└", Style::default().fg(Color::Cyan))
                                } else {
                                    Span::raw(" ")
                                },
                                Span::raw("   "),
                            ])),
                            Cell::from(""),
                            Cell::from(""),
                        ]
                    } else {
                        vec![
                            Cell::from(Line::from(vec![
                                // Space for selection indicator (fixed width of 2)
                                Span::raw(" "),
                                // Add bottom corner for the box, or just spaces if not on first page
                                if is_first_page {
                                    Span::styled("└", Style::default().fg(Color::Cyan))
                                } else {
                                    Span::raw(" ")
                                },
                                Span::raw("   "),
                            ])),
                            Cell::from(""),
                            Cell::from(""),
                            Cell::from(""),
                        ]
                    };
                    Row::new(empty_cells).height(1).style(normal_style)
                } else {
                    // Regular separator row outside the parallel section
                    let empty_cells = if has_narrow_area_width {
                        vec![Cell::from(""), Cell::from(""), Cell::from("")]
                    } else {
                        vec![
                            Cell::from(""),
                            Cell::from(""),
                            Cell::from(""),
                            Cell::from(""),
                        ]
                    };
                    Row::new(empty_cells).height(1).style(normal_style)
                }
            }
        }));

        let constraints = if has_narrow_area_width {
            vec![
                Constraint::Length(6), // Status icon with NX logo
                Constraint::Fill(1),   // Task name with title
                // No cache status for narrow viewports
                Constraint::Length(15), // Duration (increased width)
            ]
        } else {
            vec![
                Constraint::Length(6),  // Status icon with NX logo
                Constraint::Fill(1),    // Task name with title
                Constraint::Length(30), // Cache status (increased width)
                Constraint::Length(15), // Duration (increased width)
            ]
        };

        let t = Table::new(all_rows, &constraints)
            .header(header)
            .block(Block::default())
            .style(self.get_table_style());

        f.render_widget(t, table_area);

        // Render cloud message in its dedicated area if it exists
        let needs_vertical_bottom_layout = has_narrow_area_width;

        // Bottom bar layout
        let bottom_layout = if needs_vertical_bottom_layout {
            // Stack vertically when area is limited
            Layout::default()
                .direction(Direction::Vertical)
                .constraints(vec![
                    Constraint::Length(1), // Pagination
                    Constraint::Length(1), // Help text
                ])
                .split(pagination_area)
        } else {
            // Original horizontal layout - use the full width for a single area
            Layout::default()
                .direction(Direction::Horizontal)
                .constraints(vec![
                    Constraint::Fill(1), // Full width for both pagination and help text
                ])
                .split(pagination_area)
        };

        // Get pagination info
        let total_pages = self.selection_manager.lock().unwrap().total_pages();
        let current_page = self.selection_manager.lock().unwrap().get_current_page();

        // Create combined bottom bar with pagination on left and help text centered
        let pagination = Pagination::new(current_page, total_pages);

        // Create help text component
        let help_text = HelpText::new(
            self.cloud_message.is_some(),
            !self.is_task_list_focused(),
            false,
        ); // Use collapsed mode when cloud message is present

        // Always draw pagination
        if needs_vertical_bottom_layout {
            // For vertical layout, render pagination and help text separately
            let pagination_area = Layout::default()
                .direction(Direction::Horizontal)
                .constraints([
                    Constraint::Length(2), // Left padding to align with content
                    Constraint::Min(12),   // Space for pagination
                    Constraint::Fill(1),   // Remaining space
                ])
                .split(bottom_layout[0])[1];

            pagination.render(f, pagination_area, !self.is_task_list_focused());

            // Only show help text if focused
            if self.is_task_list_focused() {
                help_text.render(f, bottom_layout[1]);
            }
        } else {
            // For horizontal layout, create a three-part layout: pagination on left, help text in middle, cloud message on right
            let has_cloud_message = self.cloud_message.is_some();
            let bottom_bar_layout = Layout::default()
                .direction(Direction::Horizontal)
                .constraints(if has_cloud_message {
                    [
                        Constraint::Length(12), // Width for pagination (with padding)
                        Constraint::Length(24), // Smaller width for help text when cloud message is present
                        Constraint::Fill(1),    // Cloud message gets most of the remaining space
                        Constraint::Length(0),  // No right-side padding
                    ]
                } else {
                    [
                        Constraint::Length(15), // Width for pagination (with padding)
                        Constraint::Fill(1),    // Help text gets all remaining space
                        Constraint::Length(1),  // Minimal width when no cloud message
                        Constraint::Length(0),  // No right padding needed when no cloud message
                    ]
                })
                .split(bottom_layout[0]);

            // Render pagination in its area
            let pagination_area = Layout::default()
                .direction(Direction::Horizontal)
                .constraints([
                    Constraint::Length(2),  // Left padding to align with task content
                    Constraint::Length(10), // Width for pagination
                    Constraint::Fill(1),    // Remaining space
                ])
                .split(bottom_bar_layout[0])[1];

            pagination.render(f, pagination_area, !self.is_task_list_focused());

            // Only show help text if focused
            if self.is_task_list_focused() {
                // Let the help text use its dedicated area
                help_text.render(f, bottom_bar_layout[1]);
            }

            // Render cloud message if it exists
            if let Some(message) = &self.cloud_message {
                let should_show_message = message.contains("https://");

                if should_show_message {
                    // Get available width for the cloud message
                    let available_width = bottom_bar_layout[2].width as usize;

                    // Create text with URL styling if needed
                    let message_line = if let Some(url_pos) = message.find("https://") {
                        let prefix = &message[0..url_pos];
                        let url = &message[url_pos..];

                        // Determine styles based on dimming state
                        let prefix_style = if !self.is_task_list_focused() {
                            Style::default().fg(Color::DarkGray).dim()
                        } else {
                            Style::default().fg(Color::DarkGray)
                        };

                        let url_style = if !self.is_task_list_focused() {
                            Style::default().fg(Color::LightCyan).underlined().dim()
                        } else {
                            Style::default().fg(Color::LightCyan).underlined()
                        };

                        // In collapsed mode or with limited width, prioritize showing the URL
                        if available_width < 30 {
                            // Show only the URL, completely omit prefix if needed
                            if url.len() > available_width.saturating_sub(3) {
                                // URL is too long, we need to truncate it
                                let shortened_url = if url.contains("nx.app") {
                                    // For nx.app links, try to preserve the run ID at the end
                                    let parts: Vec<&str> = url.split('/').collect();
                                    if parts.len() > 4 {
                                        // Try to show the domain and run ID
                                        format!("{}/../{}", parts[0], parts[parts.len() - 1])
                                    } else {
                                        // Just truncate
                                        format!(
                                            "{}...",
                                            &url[..available_width
                                                .saturating_sub(3)
                                                .min(url.len())]
                                        )
                                    }
                                } else {
                                    // For other URLs, just truncate
                                    format!(
                                        "{}...",
                                        &url[..available_width.saturating_sub(3).min(url.len())]
                                    )
                                };

                                Line::from(vec![Span::styled(shortened_url, url_style)])
                            } else {
                                // URL fits, show it all
                                Line::from(vec![Span::styled(url, url_style)])
                            }
                        } else {
                            // Normal mode with enough space - try to show prefix and URL
                            if prefix.len() + url.len() > available_width.saturating_sub(3) {
                                // Not enough space for both, prioritize URL
                                let shortened_url = if url.contains("nx.app") {
                                    // For nx.app links, try to preserve the run ID at the end
                                    let parts: Vec<&str> = url.split('/').collect();
                                    if parts.len() > 4 {
                                        // Try to show the domain and run ID
                                        format!("{}/../{}", parts[0], parts[parts.len() - 1])
                                    } else {
                                        // Just truncate
                                        format!(
                                            "{}...",
                                            &url[..available_width
                                                .saturating_sub(3)
                                                .min(url.len())]
                                        )
                                    }
                                } else {
                                    // For other URLs, just truncate
                                    format!(
                                        "{}...",
                                        &url[..available_width.saturating_sub(3).min(url.len())]
                                    )
                                };

                                // If we still have space for a bit of prefix, show it
                                let remaining_space =
                                    available_width.saturating_sub(shortened_url.len() + 3);
                                if remaining_space > 5 && !prefix.is_empty() {
                                    let shortened_prefix = if prefix.len() > remaining_space {
                                        format!(
                                            "{}...",
                                            &prefix[..remaining_space.saturating_sub(3)]
                                        )
                                    } else {
                                        prefix.to_string()
                                    };

                                    Line::from(vec![
                                        Span::styled(shortened_prefix, prefix_style),
                                        Span::styled(shortened_url, url_style),
                                    ])
                                } else {
                                    // No space for prefix, just show URL
                                    Line::from(vec![Span::styled(shortened_url, url_style)])
                                }
                            } else {
                                // Enough space for both prefix and URL
                                Line::from(vec![
                                    Span::styled(prefix, prefix_style),
                                    Span::styled(url, url_style),
                                ])
                            }
                        }
                    } else {
                        // Handle non-URL messages (only shown in non-collapsed mode)
                        let display_message = if message.len() > available_width {
                            format!("{}...", &message[..available_width.saturating_sub(3)])
                        } else {
                            message.clone()
                        };

                        let message_style = if !self.is_task_list_focused() {
                            Style::default().fg(Color::DarkGray).dim()
                        } else {
                            Style::default().fg(Color::DarkGray)
                        };

                        Line::from(vec![Span::styled(display_message, message_style)])
                    };

                    let cloud_message_paragraph =
                        Paragraph::new(message_line).alignment(Alignment::Right);

                    // Add a safety check to prevent rendering outside buffer bounds (this can happen if the user resizes the window a lot before it stabilizes it seems)
                    let cloud_message_area = bottom_bar_layout[2];
                    if cloud_message_area.width > 0
                        && cloud_message_area.height > 0
                        && cloud_message_area.x < f.area().width
                        && cloud_message_area.y < f.area().height
                    {
                        // Ensure area is entirely within frame bounds
                        let safe_area = Rect {
                            x: cloud_message_area.x,
                            y: cloud_message_area.y,
                            width: cloud_message_area
                                .width
                                .min(f.area().width.saturating_sub(cloud_message_area.x)),
                            height: cloud_message_area
                                .height
                                .min(f.area().height.saturating_sub(cloud_message_area.y)),
                        };

                        f.render_widget(cloud_message_paragraph, safe_area);
                    }
                }
            }
        }

        Ok(())
    }

    /// Updates the component state in response to an action.
    fn update(&mut self, action: Action) -> Result<Option<Action>> {
        match action {
            Action::Tick => {
                self.throbber_counter = self.throbber_counter.wrapping_add(1);
            }
            Action::EnterFilterMode => {
                if self.filter_mode {
                    self.exit_filter_mode();
                } else {
                    self.enter_filter_mode();
                }
            }
            Action::ClearFilter => {
                self.clear_filter();
            }
            Action::AddFilterChar(c) => {
                if self.filter_mode {
                    self.add_filter_char(c);
                }
            }
            Action::RemoveFilterChar => {
                if self.filter_mode {
                    self.remove_filter_char();
                }
            }
            Action::PinTask(task_name, pane_idx) => {
                self.pin_task(task_name, pane_idx);
            }
            Action::UnpinTask(task_name, pane_idx) => {
                self.unpin_task(task_name, pane_idx);
            }
            Action::UnpinAllTasks => {
                self.unpin_all_tasks();
            }
            Action::SortTasks => {
                self.sort_tasks();
            }
            Action::UpdateTaskStatus(task_name, status) => {
                self.update_task_status(task_name, status);
            }
            Action::UpdateCloudMessage(message) => {
                self.cloud_message = Some(message);
            }
            Action::NextPage => {
                self.next_page();
            }
            Action::PreviousPage => {
                self.previous_page();
            }
            Action::NextTask => {
                self.next_task();
            }
            Action::PreviousTask => {
                self.previous_task();
            }
            Action::SetSpacebarMode(spacebar_mode) => {
                self.spacebar_mode = spacebar_mode;
            }
            Action::UpdateFocus(focus) => {
                self.focus = focus;
            }
            Action::StartCommand(thread_count) => {
                self.set_max_parallel(thread_count);
            }
            Action::StartTasks(tasks) => {
                self.start_tasks(tasks);
            }
            Action::EndTasks(task_results) => {
                self.end_tasks(task_results);
            }
            _ => {}
        }
        Ok(None)
    }

    fn as_any(&self) -> &dyn Any {
        self
    }

    fn as_any_mut(&mut self) -> &mut dyn Any {
        self
    }
}
