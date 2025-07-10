use color_eyre::eyre::Result;
use hashbrown::HashSet;
use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Modifier, Style, Stylize},
    text::{Line, Span},
    widgets::{Block, Cell, Paragraph, Row, Table},
};
use serde::{Deserialize, Serialize};
use std::{
    any::Any,
    sync::{Arc, Mutex},
};
use tokio::sync::mpsc::UnboundedSender;

use super::help_text::HelpText;
use super::pagination::Pagination;
use super::task_selection_manager::{SelectionMode, TaskSelectionManager};
use crate::native::tui::theme::THEME;
use crate::native::{
    tasks::types::{Task, TaskResult},
    tui::{
        action::Action,
        app::Focus,
        components::Component,
        lifecycle::RunMode,
        utils::{format_duration_since, sort_task_items},
    },
};

const TASK_NAME_WAITING_FOR_TASKS: &str = "Waiting for task...";
const CACHE_STATUS_LOCAL_KEPT_EXISTING: &str = "Kept Existing";
const CACHE_STATUS_LOCAL: &str = "Local";
const CACHE_STATUS_REMOTE: &str = "Remote";
const CACHE_STATUS_NOT_YET_KNOWN: &str = "...";
const CACHE_STATUS_NOT_APPLICABLE: &str = "-";
const DURATION_NOT_YET_KNOWN: &str = "...";

// This is just a fallback value, the real value will be set via start_command on the lifecycle
const DEFAULT_MAX_PARALLEL: usize = 0;

// Constants for layout calculation
const COLLAPSED_HELP_WIDTH: u16 = 19; // "quit: q help: ?"
const FULL_HELP_WIDTH: u16 = 86; // Full help text width
const MIN_CLOUD_URL_WIDTH: u16 = 15; // Minimum space to show at least part of the URL
const MIN_BOTTOM_SPACING: u16 = 4; // Minimum space between Pag, Cloud, Help

// Constants for column layout calculation
const STATUS_ICON_WIDTH: u16 = 6; // Width for status icon with NX logo
const TASK_NAME_RESERVED_MIN_WIDTH: u16 = TASK_NAME_WAITING_FOR_TASKS.len() as u16; // Minimum reserved space for the task name column
const TASK_NAME_LAYOUT_THRESHOLD: u16 = 30; // Minimum width at which we truncate task names for large task names to allow displaying other columns
const DURATION_COLUMN_WIDTH: u16 = 15; // Width for duration column
const CACHE_STATUS_COLUMN_WIDTH: u16 = CACHE_STATUS_LOCAL_KEPT_EXISTING.len() as u16; // Width for cache status column
const COLUMN_SEPARATOR_WIDTH: u16 = 1; // Column separator width

/// Represents which columns should be displayed in the task list
#[derive(Clone, Debug)]
struct ColumnVisibility {
    show_duration: bool,
    show_cache_status: bool,
}

/// Represents an individual task with its current state and execution details.
pub struct TaskItem {
    // Public to aid with sorting utility and testing
    pub name: String,
    duration: String,
    cache_status: String,
    // Public to aid with sorting utility and testing
    pub status: TaskStatus,
    pub terminal_output: String,
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
            status: self.status,
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
#[derive(Debug, PartialEq, Eq, Serialize, Deserialize)]
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
    pub throbber_counter: usize,
    pub filter_mode: bool,
    filter_text: String,
    filter_persisted: bool, // Whether the filter is in a persisted state
    spacebar_mode: bool,    // Whether we're in spacebar mode (output follows selection)
    cloud_message: Option<String>,
    max_parallel: usize, // Maximum number of parallel tasks
    title_text: String,
    pub action_tx: Option<UnboundedSender<Action>>,
    focus: Focus,
    pinned_tasks: [Option<String>; 2],
    initiating_tasks: HashSet<String>,
    run_mode: RunMode,
}

impl TasksList {
    /// Creates a new TasksList with the given tasks.
    /// Converts the input tasks into TaskItems and initializes the UI state.
    pub fn new(
        tasks: Vec<Task>,
        initiating_tasks: HashSet<String>,
        run_mode: RunMode,
        initial_focus: Focus,
        title_text: String,
        selection_manager: Arc<Mutex<TaskSelectionManager>>,
    ) -> Self {
        let mut task_items = Vec::new();

        for task in tasks {
            task_items.push(TaskItem::new(task.id, task.continuous.unwrap_or(false)));
        }

        let filtered_names = Vec::new();

        let mut s = Self {
            selection_manager,
            filtered_names,
            tasks: task_items,
            throbber_counter: 0,
            filter_mode: false,
            filter_text: String::new(),
            filter_persisted: false,
            spacebar_mode: false,
            cloud_message: None,
            max_parallel: DEFAULT_MAX_PARALLEL,
            title_text,
            action_tx: None,
            focus: initial_focus,
            pinned_tasks: [None, None],
            initiating_tasks,
            run_mode,
        };

        // Sort tasks to populate task selection list
        s.sort_tasks();

        s
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
    /// Groups tasks into in-progress, (maybe) highlighted, completed, and pending, with None values as separators.
    /// NEEDS ANALYSIS: Consider if this complex grouping logic should be moved to a dedicated type.
    fn create_entries_with_separator(&self, filtered_names: &[String]) -> Vec<Option<String>> {
        // Create vectors for each status group
        let mut in_progress = Vec::new();
        let mut highlighted = Vec::new();
        let mut completed = Vec::new();
        let mut pending = Vec::new();

        // Single iteration to categorize tasks
        for task_name in filtered_names {
            if let Some(task) = self.tasks.iter().find(|t| &t.name == task_name) {
                // If we're in run one mode, and the task is an initiating task, highlight it
                if matches!(self.run_mode, RunMode::RunOne)
                    && self.initiating_tasks.contains(task_name)
                    && !matches!(task.status, TaskStatus::InProgress)
                {
                    highlighted.push(task_name.clone());
                    continue;
                }
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
                entries.extend(std::iter::repeat_n(
                    None,
                    self.max_parallel - in_progress_count,
                ));
            }

            // Always add a separator after the parallel tasks section with a bottom cap
            // This will be marked for special styling with the bottom box corner
            entries.push(None);
        }

        // Add highlighted tasks followed by a separator, if there are any
        if !highlighted.is_empty() {
            entries.extend(highlighted.into_iter().map(Some));
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
        let is_first_page = self.selection_manager.lock().unwrap().get_current_page() == 0;
        let has_active_tasks = self
            .tasks
            .iter()
            .any(|t| matches!(t.status, TaskStatus::InProgress | TaskStatus::NotStarted));

        is_first_page && self.max_parallel > 0 && has_active_tasks
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
        let should_track_by_name = self.spacebar_mode;
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

    /// Gets the table style based on the current focus state.
    /// Returns a dimmed style when focus is not on the task list.
    fn get_table_style(&self) -> Style {
        if self.is_task_list_focused() {
            Style::default().fg(THEME.secondary_fg)
        } else {
            Style::default().dim().fg(THEME.secondary_fg)
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
        let should_track_by_name = self.spacebar_mode;
        let mode = if should_track_by_name {
            SelectionMode::TrackByName
        } else {
            SelectionMode::TrackByPosition
        };
        self.selection_manager
            .lock()
            .unwrap()
            .set_selection_mode(mode);

        // If we're in run one mode, and there are initiating tasks, sort them as highlighted tasks
        let highlighted_tasks =
            if matches!(self.run_mode, RunMode::RunOne) && !self.initiating_tasks.is_empty() {
                self.initiating_tasks.clone()
            } else {
                HashSet::new()
            };

        // Sort the tasks
        sort_task_items(&mut self.tasks, &highlighted_tasks);

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

    /// Calculates which columns should be displayed based on available space and task name lengths
    fn calculate_column_visibility(&self, available_width: u16) -> ColumnVisibility {
        // Calculate base space requirements
        let base_space = STATUS_ICON_WIDTH + COLUMN_SEPARATOR_WIDTH;

        if available_width <= base_space {
            // Too small to show any columns
            return ColumnVisibility {
                show_duration: false,
                show_cache_status: false,
            };
        }

        // Find the maximum task name length across all tasks
        let max_task_name_len = self
            .tasks
            .iter()
            .map(|task| task.name.len())
            .max()
            .unwrap_or(0) as u16;

        // Calculate the minimum required space for the task name column
        let min_required_space_for_task_name =
            TASK_NAME_RESERVED_MIN_WIDTH.max(max_task_name_len.min(TASK_NAME_LAYOUT_THRESHOLD));

        if available_width <= base_space + min_required_space_for_task_name {
            // Too small to show any columns
            return ColumnVisibility {
                show_duration: false,
                show_cache_status: false,
            };
        }

        // Calculate the remaining space after accounting for the minimum required space for the task name column
        let remaining_space = available_width - base_space - min_required_space_for_task_name;

        // Check if we can fit the duration column
        let duration_space_needed = DURATION_COLUMN_WIDTH + COLUMN_SEPARATOR_WIDTH;
        if remaining_space >= duration_space_needed {
            // Check if we can fit the cache status column as well
            let cache_space_needed = CACHE_STATUS_COLUMN_WIDTH + COLUMN_SEPARATOR_WIDTH;
            if remaining_space >= duration_space_needed + cache_space_needed {
                // We can fit both columns
                return ColumnVisibility {
                    show_duration: true,
                    show_cache_status: true,
                };
            }

            // We can't fit the cache status column, so show only duration column
            return ColumnVisibility {
                show_duration: true,
                show_cache_status: false,
            };
        }

        // We can't fit the duration column, so show only task name column
        ColumnVisibility {
            show_duration: false,
            show_cache_status: false,
        }
    }

    /// Creates header cells for the task list table.
    /// Shows either filter input or task status based on current state.
    fn get_header_cells(&self, column_visibility: &ColumnVisibility) -> Vec<Cell> {
        let status_style = if !self.is_task_list_focused() {
            Style::default().fg(THEME.secondary_fg).dim()
        } else {
            Style::default().fg(THEME.secondary_fg)
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
                THEME.error
            } else {
                THEME.success
            }
        } else {
            THEME.info
        };

        // Leave first cell empty for the logo
        let status_cell = Cell::from("").style(status_style);

        // Completion status text is now shown with the logo in the first cell
        // Just provide an empty second cell
        let status_text = String::new();

        let mut header_cells = vec![status_cell, Cell::from(status_text)];

        // Add cache status column header if visible
        if column_visibility.show_cache_status {
            header_cells.push(
                Cell::from(Line::from("Cache").right_aligned()).style(
                    Style::default()
                        .fg(header_color)
                        .add_modifier(Modifier::BOLD),
                ),
            );
        }

        // Add duration column header if visible
        if column_visibility.show_duration {
            header_cells.push(
                Cell::from(Line::from("Duration").right_aligned()).style(
                    Style::default()
                        .fg(header_color)
                        .add_modifier(Modifier::BOLD),
                ),
            );
        }

        header_cells
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

    fn generate_empty_row(&self, column_visibility: &ColumnVisibility) -> Row {
        let mut empty_cells = vec![
            Cell::from("   "), // Just spaces for indentation, no vertical line
            Cell::from(""),
        ];

        // Add cache status column cell if visible
        if column_visibility.show_cache_status {
            empty_cells.push(Cell::from(""));
        }

        // Add duration column cell if visible
        if column_visibility.show_duration {
            empty_cells.push(Cell::from(""));
        }

        Row::new(empty_cells)
    }

    /// Renders the filter display area.
    fn render_filter(&self, f: &mut Frame<'_>, filter_area: Rect) {
        let hidden_tasks = self.tasks.len() - self.filtered_names.len();
        let filter_text = format!("  Filter: {}", self.filter_text);
        let should_dim = !self.is_task_list_focused();

        let filter_style = if should_dim {
            Style::default().fg(THEME.warning).dim()
        } else {
            Style::default().fg(THEME.warning)
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

        let filter_lines = vec![
            Line::from(vec![Span::styled(filter_text, filter_style)]),
            Line::from(vec![Span::styled(instruction_text, filter_style)]),
        ];

        let filter_paragraph = Paragraph::new(filter_lines).alignment(Alignment::Left);
        f.render_widget(filter_paragraph, filter_area);
    }

    /// Renders the main task table.
    fn render_task_table(
        &self,
        f: &mut Frame<'_>,
        table_area: Rect,
        column_visibility: &ColumnVisibility,
    ) {
        let visible_entries = self
            .selection_manager
            .lock()
            .unwrap()
            .get_current_page_entries();
        let selected_style = Style::default()
            .fg(THEME.primary_fg)
            .add_modifier(Modifier::BOLD);
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
            THEME.info
        } else if all_tasks_completed {
            // All tasks are completed, check if any failed
            let has_failures = self
                .tasks
                .iter()
                .any(|t| matches!(t.status, TaskStatus::Failure));
            if has_failures {
                THEME.error
            } else {
                THEME.success
            }
        } else {
            // Tasks are still running
            THEME.info
        };

        // Get header cells using the existing method but add NX logo to first cell
        let mut header_cells = self.get_header_cells(column_visibility);

        // Get the style based on whether all tasks are completed
        let title_color = if all_tasks_completed {
            // Use the logo color for the title text as well
            logo_color
        } else {
            THEME.primary_fg
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
                Style::reset().bold().bg(logo_color).fg(THEME.primary_fg),
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

            let mut empty_cells = vec![
                Cell::from(Line::from(vec![
                    // Space for selection indicator
                    Span::raw(" "),
                    // Add vertical line for visual continuity, only on first page
                    if is_first_page && self.max_parallel > 0 {
                        Span::styled("│", Style::default().fg(THEME.info))
                    } else {
                        Span::raw(" ")
                    },
                    Span::raw("   "),
                ])),
                Cell::from(""),
            ];

            // Add cache status column cell if visible
            if column_visibility.show_cache_status {
                empty_cells.push(Cell::from(""));
            }

            // Add duration column cell if visible
            if column_visibility.show_duration {
                empty_cells.push(Cell::from(""));
            }
            all_rows.push(Row::new(empty_cells).height(1).style(normal_style));
        } else {
            // Even when there's no parallel section, add an empty row for consistent spacing
            all_rows.push(
                self.generate_empty_row(column_visibility)
                    .height(1)
                    .style(normal_style),
            );
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
                        .is_selected(task_name);

                    // Use the helper method to check if we should show the parallel section
                    let show_parallel = self.should_show_parallel_section();

                    // Only consider rows for the parallel section if appropriate
                    let is_in_parallel_section = show_parallel && row_idx < self.max_parallel;

                    let status_cell = match task.status {
                        TaskStatus::Success
                        | TaskStatus::LocalCacheKeptExisting
                        | TaskStatus::LocalCache
                        | TaskStatus::RemoteCache => Cell::from(Line::from(vec![
                            Span::raw(if is_selected { ">" } else { " " }),
                            Span::raw(" "),
                            Span::styled("✔", Style::default().fg(THEME.success)),
                            Span::raw(" "),
                        ])),
                        TaskStatus::Failure => Cell::from(Line::from(vec![
                            Span::raw(if is_selected { ">" } else { " " }),
                            Span::raw(" "),
                            Span::styled("✖", Style::default().fg(THEME.error)),
                            Span::raw(" "),
                        ])),
                        TaskStatus::Skipped => Cell::from(Line::from(vec![
                            Span::raw(if is_selected { ">" } else { " " }),
                            Span::raw(" "),
                            Span::styled("⏭", Style::default().fg(THEME.warning)),
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
                                spans.push(Span::styled("│", Style::default().fg(THEME.info)));
                            } else {
                                spans.push(Span::raw(" "));
                            }

                            // Add the spinner with consistent spacing
                            spans.push(Span::styled(
                                throbber_char.to_string(),
                                Style::default().fg(THEME.info_light),
                            ));

                            // Add trailing space to maintain consistent width
                            spans.push(Span::raw(" "));

                            Cell::from(Line::from(spans))
                        }
                        TaskStatus::Stopped => Cell::from(Line::from(vec![
                            Span::raw(if is_selected { ">" } else { " " }),
                            Span::raw(" "),
                            Span::styled("◼", Style::default().fg(THEME.secondary_fg)),
                            Span::raw(" "),
                        ])),
                        TaskStatus::NotStarted => Cell::from(Line::from(vec![
                            Span::raw(if is_selected { ">" } else { " " }),
                            // No need for parallel section check for pending tasks
                            Span::raw(" "),
                            Span::styled("·", Style::default().fg(THEME.secondary_fg)),
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
                                        Some(if !column_visibility.show_cache_status {
                                            format!("[{}]", idx + 1)
                                        } else {
                                            format!("[Pinned output {}]", idx + 1)
                                        })
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

                    // Add cache status cell if visible
                    if column_visibility.show_cache_status {
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
                        row_cells.push(cache_cell);
                    }

                    // Add duration cell if visible
                    if column_visibility.show_duration {
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

                    let mut empty_cells = vec![
                        Cell::from(Line::from(vec![
                            // Space for selection indicator (fixed width of 2)
                            Span::raw(" "),
                            // Add space and vertical line for parallel section (fixed position)
                            if is_first_page && self.max_parallel > 0 {
                                Span::styled("│", Style::default().fg(THEME.info))
                            } else {
                                Span::raw("  ")
                            },
                            Span::styled("·  ", Style::default().dim()),
                        ])),
                        Cell::from(Span::styled(
                            TASK_NAME_WAITING_FOR_TASKS,
                            Style::default().dim(),
                        )),
                    ];

                    // Add cache status column cell if visible
                    if column_visibility.show_cache_status {
                        empty_cells.push(Cell::from(""));
                    }

                    // Add duration column cell if visible
                    if column_visibility.show_duration {
                        empty_cells.push(Cell::from(""));
                    }
                    Row::new(empty_cells).height(1).style(normal_style)
                } else if is_bottom_cap {
                    // Add the bottom corner cap at the end of the parallel section, only on first page
                    let is_first_page =
                        self.selection_manager.lock().unwrap().get_current_page() == 0;

                    let mut empty_cells = vec![
                        Cell::from(Line::from(vec![
                            // Space for selection indicator (fixed width of 2)
                            Span::raw(" "),
                            // Add bottom corner for the box, or just spaces if not on first page
                            if is_first_page {
                                Span::styled("└", Style::default().fg(THEME.info))
                            } else {
                                Span::raw(" ")
                            },
                            Span::raw("   "),
                        ])),
                        Cell::from(""),
                    ];

                    // Add cache status column cell if visible
                    if column_visibility.show_cache_status {
                        empty_cells.push(Cell::from(""));
                    }

                    // Add duration column cell if visible
                    if column_visibility.show_duration {
                        empty_cells.push(Cell::from(""));
                    }
                    Row::new(empty_cells).height(1).style(normal_style)
                } else {
                    // Regular separator row outside the parallel section
                    let mut empty_cells = vec![Cell::from(""), Cell::from("")];

                    // Add cache status column cell if visible
                    if column_visibility.show_cache_status {
                        empty_cells.push(Cell::from(""));
                    }

                    // Add duration column cell if visible
                    if column_visibility.show_duration {
                        empty_cells.push(Cell::from(""));
                    }
                    Row::new(empty_cells).height(1).style(normal_style)
                }
            }
        }));

        let mut constraints = vec![
            Constraint::Length(STATUS_ICON_WIDTH), // Status icon with NX logo
            Constraint::Fill(1),                   // Task name with title
        ];

        // Add cache status column constraint if visible
        if column_visibility.show_cache_status {
            constraints.push(Constraint::Length(CACHE_STATUS_COLUMN_WIDTH));
        }

        // Add duration column constraint if visible
        if column_visibility.show_duration {
            constraints.push(Constraint::Length(DURATION_COLUMN_WIDTH));
        }

        let t = Table::new(all_rows, &constraints)
            .header(header)
            .block(Block::default())
            .style(self.get_table_style());

        f.render_widget(t, table_area);
    }

    /// Calculates the required width for the pagination display string.
    fn calculate_pagination_width(&self) -> u16 {
        let current_page = self.selection_manager.lock().unwrap().get_current_page() + 1; // Display is 1-based
        let total_pages = self.selection_manager.lock().unwrap().total_pages();
        format!("  <- {}/{} ->", current_page, total_pages).len() as u16
    }

    /// Renders the pagination component.
    fn render_pagination(&self, f: &mut Frame<'_>, pagination_area: Rect, is_dimmed: bool) {
        let total_pages = self.selection_manager.lock().unwrap().total_pages();
        let current_page = self.selection_manager.lock().unwrap().get_current_page();
        let pagination = Pagination::new(current_page, total_pages);

        let padded_area = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Length(2), // Left padding to align with task content
                Constraint::Min(10),   // Width for pagination content
                Constraint::Fill(1),   // Remaining space in the allocated area
            ])
            .split(pagination_area)[1]; // Use the second chunk (index 1)

        pagination.render(f, padded_area, is_dimmed);
    }

    /// Renders the help text component.
    fn render_help_text(
        &self,
        f: &mut Frame<'_>,
        help_text_area: Rect,
        is_collapsed: bool,
        is_dimmed: bool,
    ) {
        let help_text = HelpText::new(is_collapsed, is_dimmed, false);
        help_text.render(f, help_text_area);
    }

    /// Renders messages received from Nx Cloud
    fn render_cloud_message(&self, f: &mut Frame<'_>, cloud_message_area: Rect, is_dimmed: bool) {
        if let Some(message) = &self.cloud_message {
            let available_width = cloud_message_area.width;
            // Ensure minimum width to render anything
            if available_width == 0 || cloud_message_area.height == 0 {
                return;
            }

            let message_style = if is_dimmed {
                Style::default().fg(THEME.secondary_fg).dim()
            } else {
                Style::default().fg(THEME.secondary_fg)
            };

            // No URL present in the message, render the message as is if it fits, otherwise truncate
            if !message.contains("https://") {
                let message_line = Line::from(Span::styled(message.as_str(), message_style));
                // Line fits as is
                if message_line.width() <= available_width as usize {
                    let cloud_message_paragraph =
                        Paragraph::new(message_line).alignment(Alignment::Left);
                    f.render_widget(cloud_message_paragraph, cloud_message_area);
                    return;
                }
                // Line doesn't fit, truncate
                let max_message_render_len = available_width.saturating_sub(3); // Reserve for "..."
                let truncated_message =
                    format!("{}...", &message[..max_message_render_len as usize]);
                let cloud_message_paragraph =
                    Paragraph::new(Line::from(Span::styled(truncated_message, message_style)))
                        .alignment(Alignment::Left);
                f.render_widget(cloud_message_paragraph, cloud_message_area);
                return;
            }

            // Find URL position
            let url_start_pos = message.find("https://").unwrap_or(message.len());
            // Figure out the "prefix" (i.e. any message contents before the URL)
            let prefix = &message[0..url_start_pos];
            let url = &message[url_start_pos..];

            let prefix_len = prefix.len() as u16;
            let url_len = url.len() as u16;

            let mut spans = vec![];

            let url_style = if is_dimmed {
                Style::default().fg(THEME.info).underlined().dim()
            } else {
                Style::default().fg(THEME.info).underlined()
            };

            // Determine what fits, prioritizing the URL
            if url_len <= available_width {
                // Full URL Fits, check if the full message does, and if so, render the full thing
                if prefix_len + url_len <= available_width {
                    spans.push(Span::styled(prefix, message_style));
                    spans.push(Span::styled(url, url_style));
                } else {
                    // Only URL fits, do not render the prefix
                    spans.push(Span::styled(url, url_style));
                }
            } else if available_width >= MIN_CLOUD_URL_WIDTH {
                // Full URL doesn't fit, but Truncated URL does.
                let max_url_render_len = available_width.saturating_sub(3); // Reserve for "..."
                let truncated_url = format!("{}...", &url[..max_url_render_len as usize]);
                spans.push(Span::styled(truncated_url, url_style));
            } else {
                // Not enough space for even truncated URL, show nothing...
                // Hopefully in this situation user can make their terminal bigger or switch layout mode
            }

            if !spans.is_empty() {
                let message_line = Line::from(spans);
                let cloud_message_paragraph =
                    Paragraph::new(message_line).alignment(Alignment::Left);

                f.render_widget(cloud_message_paragraph, cloud_message_area);
            }
        }
    }
}

impl Component for TasksList {
    fn register_action_handler(&mut self, tx: UnboundedSender<Action>) -> Result<()> {
        self.action_tx = Some(tx);
        Ok(())
    }

    fn draw(&mut self, f: &mut Frame<'_>, area: Rect) -> Result<()> {
        // --- 1. Calculate Context ---
        let column_visibility = self.calculate_column_visibility(area.width);
        let _has_narrow_area_width = area.width < 90; // Keep for backward compatibility with bottom layout
        let filter_is_active = self.filter_mode || !self.filter_text.is_empty();
        let is_dimmed = !self.is_task_list_focused();
        let has_cloud_message = self.cloud_message.is_some();

        // --- 2. Determine Bottom Layout Mode ---
        enum BottomLayoutMode {
            SingleLine { help_collapsed: bool }, // Pag + Cloud + Help
            TwoLine { help_collapsed: bool },    // Cloud / Pag + Help
            NoCloud { help_collapsed: bool },    // Pag + Help
        }
        let layout_mode: BottomLayoutMode;

        if has_cloud_message {
            // Estimate cloud width (this might overestimate if URL gets truncated, but good for initial check)
            let cloud_text_width = if let Some(message) = &self.cloud_message {
                let url_start_pos = message.find("https://").unwrap_or(message.len());
                let prefix = &message[0..url_start_pos];
                let url = &message[url_start_pos..];
                (prefix.len() + url.len()) as u16
            } else {
                0
            };

            let required_width_full_help = self.calculate_pagination_width()
                + cloud_text_width
                + FULL_HELP_WIDTH
                + MIN_BOTTOM_SPACING;
            let required_width_collapsed_help = self.calculate_pagination_width()
                + cloud_text_width
                + COLLAPSED_HELP_WIDTH
                + MIN_BOTTOM_SPACING;

            if required_width_full_help <= area.width {
                layout_mode = BottomLayoutMode::SingleLine {
                    help_collapsed: false,
                };
            } else if required_width_collapsed_help <= area.width {
                layout_mode = BottomLayoutMode::SingleLine {
                    help_collapsed: true,
                };
            } else {
                layout_mode = BottomLayoutMode::TwoLine {
                    help_collapsed: true,
                }; // Force collapse in two-line mode
            }
        } else {
            // No Cloud message is present
            let required_width_full_help =
                self.calculate_pagination_width() + FULL_HELP_WIDTH + MIN_BOTTOM_SPACING;
            let required_width_collapsed_help =
                self.calculate_pagination_width() + COLLAPSED_HELP_WIDTH + MIN_BOTTOM_SPACING;

            if required_width_full_help <= area.width {
                layout_mode = BottomLayoutMode::NoCloud {
                    help_collapsed: false,
                };
            } else if required_width_collapsed_help <= area.width {
                layout_mode = BottomLayoutMode::NoCloud {
                    help_collapsed: true,
                };
            } else {
                // Force vertical PagHelp split, treat as TwoLine for structure, ensure help is collapsed
                layout_mode = BottomLayoutMode::TwoLine {
                    help_collapsed: true,
                };
            }
        }

        // --- 3. Calculate Main Vertical Split ---
        let mut vertical_constraints = vec![Constraint::Fill(1)]; // Table first
        let mut bottom_row_indices: std::collections::HashMap<&str, usize> =
            std::collections::HashMap::new();
        let mut current_chunk_index = 1; // Index for chunks after the table

        // Determine if help will be collapsed for the separator logic
        let final_help_collapsed = match layout_mode {
            BottomLayoutMode::SingleLine { help_collapsed } => help_collapsed,
            BottomLayoutMode::TwoLine { help_collapsed } => help_collapsed,
            BottomLayoutMode::NoCloud { help_collapsed } => help_collapsed,
        };

        let needs_filter_separator = matches!(layout_mode, BottomLayoutMode::TwoLine {..} | BottomLayoutMode::NoCloud {..} if has_cloud_message || !final_help_collapsed);
        let final_help_width = if final_help_collapsed {
            COLLAPSED_HELP_WIDTH
        } else {
            FULL_HELP_WIDTH
        };
        let needs_pag_help_vertical_split =
            self.calculate_pagination_width() + final_help_width + MIN_BOTTOM_SPACING > area.width;

        if filter_is_active {
            vertical_constraints.push(Constraint::Length(2)); // Filter area below table
            bottom_row_indices.insert("filter", current_chunk_index);
            current_chunk_index += 1;
            if needs_filter_separator || matches!(layout_mode, BottomLayoutMode::TwoLine { .. }) {
                // Add separator if filter isn't the very last thing
                vertical_constraints.push(Constraint::Length(1)); // Separator
                bottom_row_indices.insert("filter_sep", current_chunk_index);
                current_chunk_index += 1;
            }
        }
        if matches!(layout_mode, BottomLayoutMode::TwoLine { .. }) {
            // Reserve space for cloud or the top part of vertical PagHelp
            vertical_constraints.push(Constraint::Length(1));
            bottom_row_indices.insert("cloud_or_pag_vertical", current_chunk_index);
            current_chunk_index += 1;
            // Add separator between cloud and pag/help rows in two-line mode
            vertical_constraints.push(Constraint::Length(1));
            bottom_row_indices.insert("cloud_paghelp_sep", current_chunk_index);
            current_chunk_index += 1;
        }
        // Reserve space for pag/help row or the bottom part of vertical PagHelp
        vertical_constraints.push(Constraint::Length(1));
        bottom_row_indices.insert("paghelp_or_help_vertical", current_chunk_index);

        let vertical_chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints(vertical_constraints)
            .split(area);

        // --- 4. Assign Areas ---
        let table_area = vertical_chunks[0]; // Table is always the first chunk
        let filter_area = bottom_row_indices
            .get("filter")
            .map(|&i| vertical_chunks[i]);
        // Separator area not needed directly
        let cloud_or_pag_vertical_area = bottom_row_indices
            .get("cloud_or_pag_vertical")
            .map(|&i| vertical_chunks[i]);
        let paghelp_or_help_vertical_area = bottom_row_indices
            .get("paghelp_or_help_vertical")
            .map(|&i| vertical_chunks[i])
            .unwrap(); // Must exist at this point

        // --- 5. Render Table (Recalculate Pages First) ---
        self.recalculate_pages(table_area.height.saturating_sub(4));
        self.render_task_table(f, table_area, &column_visibility);

        // --- 6. Render Filter ---
        if let Some(area) = filter_area {
            if area.height > 0
                && area.width > 0
                && area.y < f.area().height
                && area.x < f.area().width
            {
                let safe_area = Rect {
                    x: area.x,
                    y: area.y,
                    width: area.width.min(f.area().width.saturating_sub(area.x)),
                    height: area.height.min(f.area().height.saturating_sub(area.y)),
                };
                self.render_filter(f, safe_area);
            }
        }

        // --- 7. Render Bottom Rows ---
        // Use final_help_collapsed and final_help_width from here down
        let help_is_collapsed = final_help_collapsed;
        let help_text_width = final_help_width;

        match layout_mode {
            BottomLayoutMode::SingleLine { .. } => {
                // Don't need help_collapsed from enum variant now
                // Pag + Cloud + Help on one line (pag_help_area)
                // Calculate exact cloud width based on available space in single line
                let cloud_message_render_width = area
                    .width
                    .saturating_sub(self.calculate_pagination_width().max(12)) // Ensure min width for Pag
                    .saturating_sub(help_text_width) // Use final calculated width
                    .saturating_sub(MIN_BOTTOM_SPACING);

                let constraints = vec![
                    Constraint::Length(self.calculate_pagination_width().max(12)),
                    Constraint::Length(cloud_message_render_width),
                    Constraint::Fill(1),
                    Constraint::Length(help_text_width),
                ];
                let row_chunks = Layout::default()
                    .direction(Direction::Horizontal)
                    .constraints(constraints)
                    .split(paghelp_or_help_vertical_area);

                // Render components with safety checks
                if !row_chunks.is_empty()
                    && row_chunks[0].height > 0
                    && row_chunks[0].width > 0
                    && row_chunks[0].y < f.area().height
                {
                    self.render_pagination(f, row_chunks[0].intersection(f.area()), is_dimmed);
                }
                if row_chunks.len() > 1
                    && row_chunks[1].height > 0
                    && row_chunks[1].width > 0
                    && row_chunks[1].y < f.area().height
                {
                    self.render_cloud_message(f, row_chunks[1].intersection(f.area()), is_dimmed);
                }
                if row_chunks.len() > 3
                    && row_chunks[3].height > 0
                    && row_chunks[3].width > 0
                    && row_chunks[3].y < f.area().height
                {
                    self.render_help_text(
                        f,
                        row_chunks[3].intersection(f.area()),
                        help_is_collapsed,
                        is_dimmed,
                    );
                }
            }
            BottomLayoutMode::TwoLine { .. } => {
                // Cloud (if present) row first
                if has_cloud_message {
                    if let Some(area) = cloud_or_pag_vertical_area {
                        if area.height > 0
                            && area.width > 0
                            && area.y < f.area().height
                            && area.x < f.area().width
                        {
                            // Apply padding safely
                            let constraints = [Constraint::Length(2), Constraint::Fill(1)];
                            let padded_chunks = Layout::default()
                                .direction(Direction::Horizontal)
                                .constraints(constraints)
                                .split(area);
                            if padded_chunks.len() >= 2 {
                                let safe_padded_area = padded_chunks[1].intersection(f.area());
                                if safe_padded_area.height > 0 && safe_padded_area.width > 0 {
                                    self.render_cloud_message(f, safe_padded_area, is_dimmed);
                                }
                            } else {
                                // Fallback: Render in original area if padding fails
                                let safe_area = area.intersection(f.area());
                                if safe_area.height > 0 && safe_area.width > 0 {
                                    self.render_cloud_message(f, safe_area, is_dimmed);
                                }
                            }
                        }
                    }
                }
                // Then Pag + Help row (or split vertically if needed)
                if needs_pag_help_vertical_split {
                    // Split paghelp_or_help_vertical_area vertically
                    let pag_help_chunks = Layout::default()
                        .direction(Direction::Vertical)
                        .constraints([Constraint::Length(1), Constraint::Length(1)])
                        .split(paghelp_or_help_vertical_area);
                    if pag_help_chunks.len() >= 2 {
                        // Render Pag into top chunk, Help into bottom chunk
                        let pag_area = pag_help_chunks[0];
                        let help_area = pag_help_chunks[1];

                        // Render pagination with safety check
                        if pag_area.height > 0 && pag_area.width > 0 && pag_area.y < f.area().height
                        {
                            self.render_pagination(f, pag_area.intersection(f.area()), is_dimmed);
                        }
                        // Render help text with safety check
                        if help_area.height > 0
                            && help_area.width > 0
                            && help_area.y < f.area().height
                        {
                            self.render_help_text(
                                f,
                                help_area.intersection(f.area()),
                                help_is_collapsed,
                                is_dimmed,
                            );
                        }
                    }
                } else {
                    // Render Pag + Help horizontally in paghelp_or_help_vertical_area
                    let constraints = vec![
                        Constraint::Length(self.calculate_pagination_width().max(12)),
                        Constraint::Fill(1),
                        Constraint::Length(help_text_width),
                    ];
                    let row_chunks = Layout::default()
                        .direction(Direction::Horizontal)
                        .constraints(constraints)
                        .split(paghelp_or_help_vertical_area);

                    // Render components with safety checks
                    if !row_chunks.is_empty()
                        && row_chunks[0].height > 0
                        && row_chunks[0].width > 0
                        && row_chunks[0].y < f.area().height
                    {
                        self.render_pagination(f, row_chunks[0].intersection(f.area()), is_dimmed);
                    }
                    if row_chunks.len() > 2
                        && row_chunks[2].height > 0
                        && row_chunks[2].width > 0
                        && row_chunks[2].y < f.area().height
                    {
                        self.render_help_text(
                            f,
                            row_chunks[2].intersection(f.area()),
                            help_is_collapsed,
                            is_dimmed,
                        );
                    }
                }
            }
            BottomLayoutMode::NoCloud { .. } => {
                // Pag + Help row (split vertically if needed)
                if needs_pag_help_vertical_split {
                    // Split paghelp_or_help_vertical_area vertically
                    let pag_help_chunks = Layout::default()
                        .direction(Direction::Vertical)
                        .constraints([Constraint::Length(1), Constraint::Length(1)])
                        .split(paghelp_or_help_vertical_area);
                    if pag_help_chunks.len() >= 2 {
                        if pag_help_chunks[0].height > 0
                            && pag_help_chunks[0].width > 0
                            && pag_help_chunks[0].y < f.area().height
                        {
                            self.render_pagination(
                                f,
                                pag_help_chunks[0].intersection(f.area()),
                                is_dimmed,
                            );
                        }
                        if pag_help_chunks[1].height > 0
                            && pag_help_chunks[1].width > 0
                            && pag_help_chunks[1].y < f.area().height
                        {
                            self.render_help_text(
                                f,
                                pag_help_chunks[1].intersection(f.area()),
                                help_is_collapsed,
                                is_dimmed,
                            );
                        }
                    }
                } else {
                    // Render Pag + Help horizontally
                    let constraints = vec![
                        Constraint::Length(self.calculate_pagination_width().max(12)),
                        Constraint::Fill(1),
                        Constraint::Length(help_text_width),
                    ];
                    let row_chunks = Layout::default()
                        .direction(Direction::Horizontal)
                        .constraints(constraints)
                        .split(paghelp_or_help_vertical_area);

                    // Render components with safety checks
                    if !row_chunks.is_empty()
                        && row_chunks[0].height > 0
                        && row_chunks[0].width > 0
                        && row_chunks[0].y < f.area().height
                    {
                        self.render_pagination(f, row_chunks[0].intersection(f.area()), is_dimmed);
                    }
                    if row_chunks.len() > 2
                        && row_chunks[2].height > 0
                        && row_chunks[2].width > 0
                        && row_chunks[2].y < f.area().height
                    {
                        self.render_help_text(
                            f,
                            row_chunks[2].intersection(f.area()),
                            help_is_collapsed,
                            is_dimmed,
                        );
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::TaskTarget;
    use ratatui::Terminal;
    use ratatui::backend::TestBackend;

    // Helper function to create a TasksList with test task data
    fn create_test_tasks_list() -> (TasksList, Vec<Task>) {
        let test_tasks = vec![
            Task {
                id: "task1".to_string(),
                target: TaskTarget {
                    project: "app1".to_string(),
                    target: "test".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            Task {
                id: "task2".to_string(),
                target: TaskTarget {
                    project: "app1".to_string(),
                    target: "build".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            Task {
                id: "task3".to_string(),
                target: TaskTarget {
                    project: "app2".to_string(),
                    target: "lint".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
        ];
        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(10)));
        let title_text = "Test Tasks".to_string();

        let tasks_list = TasksList::new(
            test_tasks.clone(),
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            title_text,
            selection_manager,
        );

        (tasks_list, test_tasks)
    }

    fn create_test_terminal(width: u16, height: u16) -> Terminal<TestBackend> {
        let backend = TestBackend::new(width, height);
        Terminal::new(backend).unwrap()
    }

    fn render_to_test_backend(terminal: &mut Terminal<TestBackend>, tasks_list: &mut TasksList) {
        terminal
            .draw(|f| {
                tasks_list.draw(f, f.area()).unwrap();
            })
            .unwrap();
    }

    #[test]
    fn test_initial_rendering() {
        let (mut tasks_list, _) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        // No tasks have been started yet

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_three_tasks_one_in_progress_two_pending_with_two_max_parallel() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        // Set 2 parallel tasks
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();
        // Start the first task
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_all_tasks_in_progress() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        // Set max parallel to 3
        tasks_list.update(Action::StartCommand(Some(3))).unwrap();

        // Start all tasks
        for task in &test_tasks {
            tasks_list
                .update(Action::StartTasks(vec![task.clone()]))
                .ok();
        }

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_completed_tasks_with_different_durations() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        tasks_list.update(Action::StartCommand(Some(3))).unwrap();

        // Create task results with different durations
        let mut task_results = Vec::new();

        // First task: 2 seconds
        let mut task1 = test_tasks[0].clone();
        task1.start_time = Some(1000);
        task1.end_time = Some(3000);

        // Second task: 10 seconds
        let mut task2 = test_tasks[1].clone();
        task2.start_time = Some(1000);
        task2.end_time = Some(11000);

        // Third task: 1 minute
        let mut task3 = test_tasks[2].clone();
        task3.start_time = Some(1000);
        task3.end_time = Some(61000);

        task_results.push(TaskResult {
            task: task1,
            status: "success".to_string(),
            code: 0,
            terminal_output: None,
        });

        task_results.push(TaskResult {
            task: task2,
            status: "success".to_string(),
            code: 0,
            terminal_output: None,
        });

        task_results.push(TaskResult {
            task: task3,
            status: "success".to_string(),
            code: 0,
            terminal_output: None,
        });

        // End tasks with the results that include duration information
        tasks_list.update(Action::EndTasks(task_results)).ok();

        // Explicitly update task statuses to Success to ensure they're properly marked as completed
        for task in &test_tasks {
            tasks_list
                .update(Action::UpdateTaskStatus(
                    task.id.clone(),
                    TaskStatus::Success,
                ))
                .ok();
        }

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_mixed_task_statuses() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        tasks_list.update(Action::StartCommand(Some(3))).unwrap();

        // Set different statuses for each task
        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[0].id.clone(),
                TaskStatus::Success,
            ))
            .ok();
        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[1].id.clone(),
                TaskStatus::Failure,
            ))
            .ok();
        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[2].id.clone(),
                TaskStatus::Skipped,
            ))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_task_with_cache_status() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        tasks_list.update(Action::StartCommand(Some(3))).unwrap();

        // Set various cache statuses
        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[0].id.clone(),
                TaskStatus::LocalCache,
            ))
            .ok();
        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[1].id.clone(),
                TaskStatus::RemoteCache,
            ))
            .ok();
        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[2].id.clone(),
                TaskStatus::LocalCacheKeptExisting,
            ))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_active_filter() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        // Set 2 parallel tasks
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();
        // Start the first task
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .ok();

        // Activate filter mode
        tasks_list.update(Action::EnterFilterMode).ok();
        // Add some filter text
        tasks_list.update(Action::AddFilterChar('a')).ok();
        tasks_list.update(Action::AddFilterChar('p')).ok();
        tasks_list.update(Action::AddFilterChar('p')).ok();
        tasks_list.update(Action::AddFilterChar('1')).ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_persisted_filter() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        // Set 2 parallel tasks
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();
        // Start the first task
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .ok();

        // Activate filter mode
        tasks_list.update(Action::EnterFilterMode).ok();
        // Add some filter text
        tasks_list.update(Action::AddFilterChar('a')).ok();
        tasks_list.update(Action::AddFilterChar('p')).ok();
        tasks_list.update(Action::AddFilterChar('p')).ok();
        tasks_list.update(Action::AddFilterChar('1')).ok();

        tasks_list.persist_filter();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_narrow_width_rendering() {
        let (mut tasks_list, _) = create_test_tasks_list();
        let mut terminal = create_test_terminal(40, 15);

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_very_narrow_width_rendering() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(20, 15);

        // Set 2 parallel tasks
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();
        // Start the first task
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_short_height_rendering() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 10);

        // Set 2 parallel tasks
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();
        // Start the first task
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_cloud_message_rendering() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        // All tasks should be complete in some way, we'll do a mixture of success and failure
        tasks_list
            .update(Action::EndTasks(vec![
                TaskResult {
                    task: test_tasks[0].clone(),
                    status: "success".to_string(),
                    code: 0,
                    terminal_output: None,
                },
                TaskResult {
                    task: test_tasks[1].clone(),
                    status: "failure".to_string(),
                    code: 1,
                    terminal_output: None,
                },
                TaskResult {
                    task: test_tasks[2].clone(),
                    status: "success".to_string(),
                    code: 0,
                    terminal_output: None,
                },
            ]))
            .unwrap();

        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[0].id.clone(),
                TaskStatus::Success,
            ))
            .unwrap();
        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[1].id.clone(),
                TaskStatus::Failure,
            ))
            .unwrap();
        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[2].id.clone(),
                TaskStatus::Success,
            ))
            .unwrap();

        // Set a cloud message with a URL
        tasks_list
            .update(Action::UpdateCloudMessage(
                "View logs and run details at https://nx.app/runs/KnGk4A47qk".to_string(),
            ))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_not_focused() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        // Set 2 parallel tasks
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();
        // Start the first task
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .ok();

        // Change focus away from task list
        tasks_list
            .update(Action::UpdateFocus(Focus::MultipleOutput(0)))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_spacebar_mode() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        // Set 2 parallel tasks
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();
        // Start the first task
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .ok();

        // Enable spacebar mode
        tasks_list.update(Action::SetSpacebarMode(true)).ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_pinned_tasks() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        // Set 2 parallel tasks
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();
        // Start the first task
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .ok();

        // Pin a task to pane 0
        tasks_list
            .update(Action::PinTask(test_tasks[0].id.clone(), 0))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_continuous_task() {
        let (mut tasks_list, _) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        // Create a task list with a continuous task
        let continuous_task = Task {
            id: "continuous-task".to_string(),
            target: TaskTarget {
                project: "app3".to_string(),
                target: "serve".to_string(),
                configuration: None,
            },
            outputs: vec![],
            project_root: Some("".to_string()),
            continuous: Some(true),
            start_time: None,
            end_time: None,
        };

        // Add and start the continuous task
        tasks_list
            .tasks
            .push(TaskItem::new(continuous_task.id.clone(), true));
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();
        tasks_list
            .update(Action::StartTasks(vec![continuous_task]))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_pagination() {
        // Create a list with many tasks to force pagination
        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(5))); // Only 5 tasks per page
        let mut tasks = Vec::new();

        // Create 12 tasks to force pagination
        for i in 1..=12 {
            let task = Task {
                id: format!("task{}", i),
                target: TaskTarget {
                    project: format!("app{}", i % 3 + 1),
                    target: "test".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            };
            tasks.push(task);
        }

        let mut tasks_list = TasksList::new(
            tasks.clone(),
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Many Tasks".to_string(),
            selection_manager,
        );

        let mut terminal = create_test_terminal(120, 15);

        // Set 2 parallel tasks
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();

        // Force apply filter to update the filtered_names
        tasks_list.apply_filter();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("pagination_page1", terminal.backend());

        // Move to next page
        tasks_list.update(Action::NextPage).ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("pagination_page2", terminal.backend());
    }

    #[test]
    fn test_run_one_mode_with_highlighted_task() {
        // Create a task list with a highlighted initiating task
        let test_tasks = vec![
            Task {
                id: "task1".to_string(),
                target: TaskTarget {
                    project: "app1".to_string(),
                    target: "test".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            Task {
                id: "task2".to_string(),
                target: TaskTarget {
                    project: "app1".to_string(),
                    target: "build".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
        ];

        // Create a set of initiating tasks (task1)
        let mut initiating_tasks = HashSet::new();
        initiating_tasks.insert("task1".to_string());

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(10)));

        let mut tasks_list = TasksList::new(
            test_tasks,
            initiating_tasks,
            RunMode::RunOne,
            Focus::TaskList,
            "Run One Mode".to_string(),
            selection_manager,
        );

        // Set 2 parallel tasks
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();

        let mut terminal = create_test_terminal(120, 15);

        // Force sort to ensure the highlighted task is positioned correctly
        tasks_list.sort_tasks();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_medium_width_rendering() {
        let (mut tasks_list, _) = create_test_tasks_list();
        let mut terminal = create_test_terminal(70, 15);

        // Set focus away from task list to verify help text shows regardless
        tasks_list
            .update(Action::UpdateFocus(Focus::MultipleOutput(0)))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_medium_width_with_long_task_names() {
        let long_task_name =
            "very-long-task-name-that-exceeds-thirty-characters-to-test-threshold-logic";
        let test_tasks = vec![
            Task {
                id: long_task_name.to_string(),
                target: TaskTarget {
                    project: "app1".to_string(),
                    target: "test".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            Task {
                id: "another-very-long-task-name-for-testing-purposes".to_string(),
                target: TaskTarget {
                    project: "app1".to_string(),
                    target: "build".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
        ];

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(10)));

        let mut tasks_list = TasksList::new(
            test_tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Running Test Tasks...".to_string(),
            selection_manager,
        );

        let mut terminal = create_test_terminal(70, 15);

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_narrow_width_duration_only() {
        let (mut tasks_list, _) = create_test_tasks_list();
        let mut terminal = create_test_terminal(55, 15); // Just enough for duration but not cache

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_wide_and_short_rendering() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(160, 10);

        // Start the first task
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_cloud_message_without_url() {
        let (mut tasks_list, _) = create_test_tasks_list();
        let mut terminal = create_test_terminal(90, 15);

        // Set a cloud message without a URL
        tasks_list
            .update(Action::UpdateCloudMessage(
                "This is some warning from Nx Cloud".to_string(),
            ))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_cloud_message_without_url_super_wide() {
        let (mut tasks_list, _) = create_test_tasks_list();
        let mut terminal = create_test_terminal(150, 15);

        // Set a cloud message without a URL
        tasks_list
            .update(Action::UpdateCloudMessage(
                "This is some warning from Nx Cloud".to_string(),
            ))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_cloud_message_two_line_layout() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(60, 15);

        tasks_list
            .update(Action::EndTasks(vec![
                TaskResult {
                    task: test_tasks[0].clone(),
                    status: "success".to_string(),
                    code: 0,
                    terminal_output: None,
                },
                TaskResult {
                    task: test_tasks[1].clone(),
                    status: "success".to_string(),
                    code: 0,
                    terminal_output: None,
                },
                TaskResult {
                    task: test_tasks[2].clone(),
                    status: "success".to_string(),
                    code: 0,
                    terminal_output: None,
                },
            ]))
            .unwrap();
        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[0].id.clone(),
                TaskStatus::Success,
            ))
            .unwrap();
        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[1].id.clone(),
                TaskStatus::Success,
            ))
            .unwrap();
        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[2].id.clone(),
                TaskStatus::Success,
            ))
            .unwrap();

        // Set a cloud message
        tasks_list
            .update(Action::UpdateCloudMessage(
                "View logs and run details at https://nx.app/runs/KnGk4A47qk".to_string(),
            ))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_very_narrow_pag_help_handling() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(25, 15);

        // Start the first task
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_very_narrow_pag_help_handling_with_cloud_message() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(25, 15);

        // Start the first task
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .ok();

        // Add a cloud message without a URL
        tasks_list
            .update(Action::UpdateCloudMessage(
                "The remote cache will not be read from or written to during this run.".to_string(),
            ))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_pagination_many_pages_wide() {
        let items_per_page = 1;
        let num_tasks = 100;

        let mut tasks = Vec::new();
        for i in 1..=num_tasks {
            tasks.push(Task {
                id: format!("task{}", i),
                target: TaskTarget {
                    project: "app".to_string(),
                    target: "test".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            });
        }

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(items_per_page)));

        let mut tasks_list = TasksList::new(
            tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Many Pages Test".to_string(),
            selection_manager,
        );

        let mut terminal = create_test_terminal(120, 6);

        // Go to page 50 (index 49)
        for _ in 0..49 {
            tasks_list.next_page();
        }

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_pagination_many_pages_wide_with_cloud_message() {
        let items_per_page = 1;
        let num_tasks = 100;

        let mut tasks = Vec::new();
        for i in 1..=num_tasks {
            tasks.push(Task {
                id: format!("task{}", i),
                target: TaskTarget {
                    project: "app".to_string(),
                    target: "test".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            });
        }

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(items_per_page)));

        let mut tasks_list = TasksList::new(
            tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Many Pages Test".to_string(),
            selection_manager,
        );

        let mut terminal = create_test_terminal(120, 6);

        // Go to page 50 (index 49)
        for _ in 0..49 {
            tasks_list.next_page();
        }

        // Set a cloud message
        tasks_list
            .update(Action::UpdateCloudMessage(
                "The remote cache will not be read from or written to during this run.".to_string(),
            ))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_pagination_many_pages_narrow() {
        let items_per_page = 1;
        let num_tasks = 100;

        let mut tasks = Vec::new();
        for i in 1..=num_tasks {
            tasks.push(Task {
                id: format!("task{}", i),
                target: TaskTarget {
                    project: "app".to_string(),
                    target: "test".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            });
        }

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(items_per_page)));

        let mut tasks_list = TasksList::new(
            tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Many Pages Test".to_string(),
            selection_manager,
        );

        let mut terminal = create_test_terminal(40, 6);

        // Go to page 50 (index 49)
        for _ in 0..49 {
            tasks_list.next_page();
        }

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_pagination_many_pages_narrow_with_cloud_message() {
        let items_per_page = 1;
        let num_tasks = 100;

        let mut tasks = Vec::new();
        for i in 1..=num_tasks {
            tasks.push(Task {
                id: format!("task{}", i),
                target: TaskTarget {
                    project: "app".to_string(),
                    target: "test".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            });
        }

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(items_per_page)));

        let mut tasks_list = TasksList::new(
            tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Many Pages Test".to_string(),
            selection_manager,
        );

        let mut terminal = create_test_terminal(40, 6);

        // Go to page 50 (index 49)
        for _ in 0..49 {
            tasks_list.next_page();
        }

        // Set a cloud message
        tasks_list
            .update(Action::UpdateCloudMessage(
                "The remote cache will not be read from or written to during this run.".to_string(),
            ))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_pinned_tasks_with_narrow_width() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(40, 15);

        tasks_list.pin_task(test_tasks[0].id.clone(), 0);

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_column_visibility_at_different_widths() {
        let (tasks_list, _) = create_test_tasks_list();

        // Very narrow - no extra columns
        let result = tasks_list.calculate_column_visibility(20);
        assert!(!result.show_duration);
        assert!(!result.show_cache_status);

        // Narrow - duration only
        let result = tasks_list.calculate_column_visibility(55);
        assert!(result.show_duration);
        assert!(!result.show_cache_status);

        // Medium - both columns with short task names
        let result = tasks_list.calculate_column_visibility(80);
        assert!(result.show_duration);
        assert!(result.show_cache_status);

        // Wide - both columns
        let result = tasks_list.calculate_column_visibility(120);
        assert!(result.show_duration);
        assert!(result.show_cache_status);
    }

    #[test]
    fn test_column_visibility_task_name_length_variations() {
        // Test various task name lengths: short, 29, 30, 31, and very long

        // Short task names (like default test tasks)
        let (tasks_list_short, _) = create_test_tasks_list();
        let result = tasks_list_short.calculate_column_visibility(80);
        assert!(result.show_duration);
        assert!(result.show_cache_status);

        // 29-character task name
        let task_name_29 = "this-is-exactly-29-chars-here"; // 29 characters
        let tasks_list_29 = create_tasks_list_with_name(task_name_29);
        let result = tasks_list_29.calculate_column_visibility(54);
        assert!(result.show_duration);
        assert!(!result.show_cache_status);

        // 30-character task name (threshold)
        let task_name_30 = "this-is-exactly-thirty-chars-1"; // 30 characters
        let tasks_list_30 = create_tasks_list_with_name(task_name_30);
        let result = tasks_list_30.calculate_column_visibility(55);
        assert!(result.show_duration);
        assert!(!result.show_cache_status);
        let result = tasks_list_30.calculate_column_visibility(87);
        assert!(result.show_duration);
        assert!(result.show_cache_status);

        // 31-character task name
        let task_name_31 = "this-is-exactly-thirty-one-char"; // 31 characters
        let tasks_list_31 = create_tasks_list_with_name(task_name_31);
        let result = tasks_list_31.calculate_column_visibility(66);
        assert!(result.show_duration);
        assert!(!result.show_cache_status);

        // Very long task name
        let long_task_name =
            "very-long-task-name-that-exceeds-thirty-characters-to-test-threshold-logic";
        let tasks_list_long = create_tasks_list_with_name(long_task_name);
        let result = tasks_list_long.calculate_column_visibility(52);
        assert!(!result.show_duration);
        assert!(!result.show_cache_status);
        let result = tasks_list_long.calculate_column_visibility(150);
        assert!(result.show_duration);
        assert!(result.show_cache_status);
    }

    // Helper function to create tasks list with specific task name
    fn create_tasks_list_with_name(task_name: &str) -> TasksList {
        let test_tasks = vec![Task {
            id: task_name.to_string(),
            target: TaskTarget {
                project: "app1".to_string(),
                target: "test".to_string(),
                configuration: None,
            },
            outputs: vec![],
            project_root: Some("".to_string()),
            continuous: Some(false),
            start_time: None,
            end_time: None,
        }];

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(10)));
        TasksList::new(
            test_tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Test Tasks".to_string(),
            selection_manager,
        )
    }

    #[test]
    fn test_calculate_column_visibility_mixed_task_name_lengths() {
        let test_tasks = vec![
            Task {
                id: "short".to_string(),
                target: TaskTarget {
                    project: "app1".to_string(),
                    target: "test".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            Task {
                id: "this-is-a-very-long-task-name-that-exceeds-thirty-characters".to_string(),
                target: TaskTarget {
                    project: "app2".to_string(),
                    target: "build".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
        ];

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(10)));
        let tasks_list = TasksList::new(
            test_tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Test Tasks".to_string(),
            selection_manager,
        );

        // At narrow width, should hide duration due to insufficient space for 30-char threshold
        // Base: 7, Duration: 16, Min threshold: 30, Total needed: 53
        let result = tasks_list.calculate_column_visibility(52);
        assert!(!result.show_duration);
        assert!(!result.show_cache_status);

        let result = tasks_list.calculate_column_visibility(53);
        assert!(result.show_duration);
        assert!(!result.show_cache_status);

        // Should base decision on longest task name, but still show duration at 66 width
        // Base: 7, Duration: 16, space_for_task_name: 43, which is >= 30 threshold
        let result = tasks_list.calculate_column_visibility(66);
        assert!(result.show_duration);
        assert!(!result.show_cache_status);

        // At wider width, should show both columns
        let result = tasks_list.calculate_column_visibility(150);
        assert!(result.show_duration);
        assert!(result.show_cache_status);
    }

    #[test]
    fn test_pagination_column_visibility_consistency() {
        // Create tasks with mixed name lengths distributed across pages
        let test_tasks = vec![
            // Page 1: Short task names
            Task {
                id: "short1".to_string(),
                target: TaskTarget {
                    project: "app1".to_string(),
                    target: "test".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            Task {
                id: "short2".to_string(),
                target: TaskTarget {
                    project: "app1".to_string(),
                    target: "build".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            Task {
                id: "short3".to_string(),
                target: TaskTarget {
                    project: "app1".to_string(),
                    target: "lint".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            // Page 2: Long task names
            Task {
                id: "this-is-a-very-long-task-name-that-exceeds-thirty-characters-page2-task1".to_string(),
                target: TaskTarget {
                    project: "app2".to_string(),
                    target: "e2e".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            Task {
                id: "another-extremely-long-task-name-for-testing-pagination-consistency-page2-task2".to_string(),
                target: TaskTarget {
                    project: "app2".to_string(),
                    target: "deploy".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
        ];

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(3))); // 3 tasks per page
        let mut tasks_list = TasksList::new(
            test_tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Pagination Test".to_string(),
            selection_manager,
        );

        // Force apply filter to update the filtered_names
        tasks_list.apply_filter();

        // Test at medium width - should hide columns due to long task names
        let visibility_page1 = tasks_list.calculate_column_visibility(66);

        // Navigate to page 2 (with long task names)
        tasks_list.next_page();
        let visibility_page2 = tasks_list.calculate_column_visibility(66);

        // Navigate back to page 1 (with short task names)
        tasks_list.previous_page();
        let visibility_page1_again = tasks_list.calculate_column_visibility(66);

        // Column visibility should be consistent across pages
        assert_eq!(
            visibility_page1.show_duration,
            visibility_page2.show_duration
        );
        assert_eq!(
            visibility_page1.show_cache_status,
            visibility_page2.show_cache_status
        );
        assert_eq!(
            visibility_page1.show_duration,
            visibility_page1_again.show_duration
        );
        assert_eq!(
            visibility_page1.show_cache_status,
            visibility_page1_again.show_cache_status
        );

        // At this width, should show duration but not cache status due to long task names
        assert!(visibility_page1.show_duration);
        assert!(!visibility_page1.show_cache_status);
    }

    #[test]
    fn test_pagination_column_visibility_consistency_wide_terminal() {
        // Create tasks with mixed name lengths
        let test_tasks = vec![
            // Page 1: Short task names
            Task {
                id: "short1".to_string(),
                target: TaskTarget {
                    project: "app1".to_string(),
                    target: "test".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            Task {
                id: "short2".to_string(),
                target: TaskTarget {
                    project: "app1".to_string(),
                    target: "build".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            // Page 2: Long task names
            Task {
                id: "this-is-a-very-long-task-name-that-exceeds-thirty-characters-for-testing"
                    .to_string(),
                target: TaskTarget {
                    project: "app2".to_string(),
                    target: "e2e".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            Task {
                id: "another-extremely-long-task-name-for-testing-pagination-consistency-behavior"
                    .to_string(),
                target: TaskTarget {
                    project: "app2".to_string(),
                    target: "deploy".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
        ];

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(2))); // 2 tasks per page
        let mut tasks_list = TasksList::new(
            test_tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Pagination Test".to_string(),
            selection_manager,
        );

        // Force apply filter to update the filtered_names
        tasks_list.apply_filter();

        // Test at wide width - should show duration but not cache status due to long task names
        let visibility_page1 = tasks_list.calculate_column_visibility(120);

        // Navigate to page 2 (with long task names)
        tasks_list.next_page();
        let visibility_page2 = tasks_list.calculate_column_visibility(120);

        // Navigate back to page 1 (with short task names)
        tasks_list.previous_page();
        let visibility_page1_again = tasks_list.calculate_column_visibility(120);

        // Column visibility should be consistent across pages
        assert_eq!(
            visibility_page1.show_duration,
            visibility_page2.show_duration
        );
        assert_eq!(
            visibility_page1.show_cache_status,
            visibility_page2.show_cache_status
        );
        assert_eq!(
            visibility_page1.show_duration,
            visibility_page1_again.show_duration
        );
        assert_eq!(
            visibility_page1.show_cache_status,
            visibility_page1_again.show_cache_status
        );

        // At this width with long task names, should show both columns
        assert!(visibility_page1.show_duration);
        assert!(visibility_page1.show_cache_status);
    }

    #[test]
    fn test_pagination_column_visibility_rendering_consistency() {
        // Create tasks with mixed name lengths
        let test_tasks = vec![
            // Page 1: Short task names
            Task {
                id: "short1".to_string(),
                target: TaskTarget {
                    project: "app1".to_string(),
                    target: "test".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            Task {
                id: "short2".to_string(),
                target: TaskTarget {
                    project: "app1".to_string(),
                    target: "build".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            // Page 2: Long task names that would affect column visibility
            Task {
                id: "this-is-a-very-long-task-name-that-exceeds-thirty-characters-and-affects-column-visibility".to_string(),
                target: TaskTarget {
                    project: "app2".to_string(),
                    target: "e2e".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
        ];

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(2))); // 2 tasks per page
        let mut tasks_list = TasksList::new(
            test_tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Pagination Test".to_string(),
            selection_manager,
        );

        // Force apply filter to update the filtered_names
        tasks_list.apply_filter();

        let mut terminal = create_test_terminal(80, 15);

        // Render page 1 (short task names)
        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "pagination_consistency_page1_short_names",
            terminal.backend()
        );

        // Navigate to page 2 (long task names)
        tasks_list.next_page();
        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "pagination_consistency_page2_long_names",
            terminal.backend()
        );

        // Navigate back to page 1 to verify consistency
        tasks_list.previous_page();
        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "pagination_consistency_page1_after_navigation",
            terminal.backend()
        );
    }

    #[test]
    fn test_cache_column_spacing_with_long_truncated_task_name() {
        let long_task_name =
            "this-is-a-very-long-task-name-that-will-definitely-be-truncated-when-displayed";
        let test_tasks = vec![Task {
            id: long_task_name.to_string(),
            target: TaskTarget {
                project: "app1".to_string(),
                target: "test".to_string(),
                configuration: None,
            },
            outputs: vec![],
            project_root: Some("".to_string()),
            continuous: Some(false),
            start_time: None,
            end_time: None,
        }];

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(10)));
        let mut tasks_list = TasksList::new(
            test_tasks.clone(),
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Test Tasks".to_string(),
            selection_manager,
        );

        // Use a narrower terminal width to force task name truncation
        let mut terminal = create_test_terminal(90, 15);

        tasks_list.update(Action::StartCommand(Some(3))).unwrap();

        // Set the long task name to LocalCacheKeptExisting to show "Keep Existing"
        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[0].id.clone(),
                TaskStatus::LocalCacheKeptExisting,
            ))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }
}
