use color_eyre::eyre::Result;
use crossterm::event::KeyEvent;
use napi::bindgen_prelude::External;
use ratatui::{
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style, Stylize},
    text::{Line, Span},
    widgets::{Block, Borders, Cell, Paragraph, Row, Table},
    Frame,
};
use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex, RwLock};
use std::{any::Any, io};
use vt100_ctt::Parser;

use crate::native::tui::utils::{normalize_newlines, sort_task_items};
use crate::native::tui::{
    action::Action,
    app::Focus,
    components::Component,
    pty::PtyInstance,
    task::{Task, TaskResult},
    utils,
};
use crate::native::{
    pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc},
    tui::app::AppState,
};

use super::pagination::Pagination;
use super::task_selection_manager::TaskSelectionManager;
use super::terminal_pane::{TerminalPane, TerminalPaneData};
use super::{help_text::HelpText, terminal_pane::TerminalPaneState};

const CACHE_STATUS_LOCAL_KEPT_EXISTING: &str = "Kept Existing";
const CACHE_STATUS_LOCAL: &str = "Local";
const CACHE_STATUS_REMOTE: &str = "Remote";
const CACHE_STATUS_NOT_YET_KNOWN: &str = "...";
const CACHE_STATUS_NOT_APPLICABLE: &str = "-";

/// Represents an individual task with its current state and execution details.
pub struct TaskItem {
    // Public to aid with sorting utility and testing
    pub name: String,
    duration: String,
    cache_status: String,
    // Public to aid with sorting utility and testing
    pub status: TaskStatus,
    terminal_output: String,
    continuous: bool,
    start_time: Option<u128>,
    // Public to aid with sorting utility and testing
    pub end_time: Option<u128>,
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
                "".to_string()
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

#[derive(Clone, Copy, PartialEq, Debug)]
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

/// A list component that displays and manages tasks in a terminal UI.
/// Provides filtering, sorting, and output display capabilities.
pub struct TasksList {
    // task id -> pty instance
    pub pty_instances: HashMap<String, Arc<PtyInstance>>,
    selection_manager: TaskSelectionManager,
    tasks: Vec<TaskItem>,        // Source of truth - all tasks
    filtered_names: Vec<String>, // Names of tasks that match the filter
    throbber_counter: usize,
    pub filter_mode: bool,
    filter_text: String,
    filter_persisted: bool, // Whether the filter is in a persisted state
    focus: Focus,
    pane_tasks: [Option<String>; 2], // Tasks assigned to panes 1 and 2 (0-indexed)
    focused_pane: Option<usize>,     // Currently focused pane (if any)
    is_dimmed: bool,
    spacebar_mode: bool, // Whether we're in spacebar mode (output follows selection)
    terminal_pane_data: [TerminalPaneData; 2],
    target_names: Vec<String>,
    task_list_hidden: bool, // New field to track if task list is hidden
    cloud_message: Option<String>,
}

impl TasksList {
    /// Creates a new TasksList with the given tasks.
    /// Converts the input tasks into TaskItems and initializes the UI state.
    pub fn new(tasks: Vec<Task>, target_names: Vec<String>, pinned_tasks: Vec<String>) -> Self {
        let mut task_items = Vec::new();

        for task in tasks {
            task_items.push(TaskItem::new(task.id, task.continuous.unwrap_or(false)));
        }

        let filtered_names = Vec::new();
        let mut selection_manager = TaskSelectionManager::new(5); // Default 5 items per page

        let mut focus = Focus::TaskList;
        let mut focused_pane = None;

        let mut main_terminal_pane_data = TerminalPaneData::new();
        if let Some(main_task) = pinned_tasks.first() {
            selection_manager.select_task(main_task.clone());
            focus = Focus::MultipleOutput(0);
            focused_pane = Some(0);
            // If the main task is continuous, automatically enter interactive mode
            if task_items
                .iter()
                .find(|t| t.name == *main_task)
                .unwrap()
                .continuous
            {
                main_terminal_pane_data.set_interactive(true);
            }
        }

        let mut iter = pinned_tasks.into_iter().take(2);
        let pane_tasks = [iter.next(), iter.next()];

        Self {
            pty_instances: HashMap::new(),
            selection_manager,
            filtered_names,
            tasks: task_items,
            throbber_counter: 0,
            filter_mode: false,
            filter_text: String::new(),
            filter_persisted: false,
            focus,
            pane_tasks,
            focused_pane,
            is_dimmed: false,
            spacebar_mode: false,
            terminal_pane_data: [main_terminal_pane_data, TerminalPaneData::new()],
            target_names,
            task_list_hidden: false,
            cloud_message: None,
        }
    }

    /// Moves the selection to the next task in the list.
    /// If in spacebar mode, updates the output pane to show the newly selected task.
    pub fn next(&mut self) {
        self.selection_manager.next();
        self.update_pane_visibility_after_selection_change();
    }

    /// Moves the selection to the previous task in the list.
    /// If in spacebar mode, updates the output pane to show the newly selected task.
    pub fn previous(&mut self) {
        self.selection_manager.previous();
        self.update_pane_visibility_after_selection_change();
    }

    /// Moves to the next page of tasks.
    /// Does nothing if there are no filtered tasks.
    pub fn next_page(&mut self) {
        if self.filtered_names.is_empty() {
            return;
        }
        self.selection_manager.next_page();
        self.update_pane_visibility_after_selection_change();
    }

    /// Moves to the previous page of tasks.
    /// Does nothing if there are no filtered tasks.
    pub fn previous_page(&mut self) {
        if self.filtered_names.is_empty() {
            return;
        }
        self.selection_manager.previous_page();
        self.update_pane_visibility_after_selection_change();
    }

    /// Updates the output pane visibility after a task selection change.
    /// Only affects the display if in spacebar mode.
    fn update_pane_visibility_after_selection_change(&mut self) {
        // Only update pane visibility if we're in spacebar mode
        if self.spacebar_mode {
            if let Some(task_name) = self.selection_manager.get_selected_task_name() {
                self.pane_tasks[0] = Some(task_name.clone());
                // Re-evaluate the optimal size of the terminal pane and pty because the newly selected task may never have been shown before
                let _ = self.handle_resize(None);
            }
        }
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

        // Add in-progress tasks
        entries.extend(in_progress.into_iter().map(Some));

        // Add separator after in-progress tasks if there were any and if there are completed tasks
        if !entries.is_empty() && !completed.is_empty() {
            entries.push(None);
        }

        // Add completed tasks
        entries.extend(completed.into_iter().map(Some));

        // Add separator before pending tasks if there are any pending tasks and if there were any previous tasks
        if !pending.is_empty() && !entries.is_empty() {
            entries.push(None);
        }

        // Add pending tasks
        entries.extend(pending.into_iter().map(Some));

        entries
    }

    /// Recalculates the number of items that can be displayed per page based on the available height.
    /// Updates the selection manager with the new page size and current entries.
    fn recalculate_pages(&mut self, available_height: u16) {
        // Update selection manager's items per page
        self.selection_manager
            .set_items_per_page(available_height as usize);

        // Update entries in selection manager with separator
        let entries = self.create_entries_with_separator(&self.filtered_names);
        self.selection_manager.update_entries(entries);
    }

    /// Enters filter mode for task filtering.
    /// If there is existing filter text that isn't persisted, persists it instead.
    pub fn enter_filter_mode(&mut self) {
        if !self.filter_text.is_empty() && !self.filter_persisted {
            // If we have filter text and it's not persisted, pressing / should persist it
            self.filter_persisted = true;
            self.filter_mode = false;
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
    /// NEEDS ANALYSIS: Consider splitting the filter logic from the UI update logic.
    pub fn apply_filter(&mut self) {
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
        self.selection_manager.update_entries(entries);

        // Update spacebar mode output if active
        if self.focused_pane.is_none() && self.pane_tasks[0].is_some() {
            if self.filtered_names.is_empty() {
                self.pane_tasks[0] = None;
            } else if let Some(task_name) = self.selection_manager.get_selected_task_name() {
                self.pane_tasks[0] = Some(task_name.clone());
            }
        }
    }

    pub fn set_focus(&mut self, focus: Focus) {
        self.focus = focus;
        // Clear multi-output focus when returning to task list
        if matches!(focus, Focus::TaskList) {
            self.focused_pane = None;
        }
    }

    /// Toggles the visibility of the output pane for the currently selected task.
    /// In spacebar mode, the output follows the task selection.
    pub fn toggle_output_visibility(&mut self) {
        // Ensure task list is visible after every spacebar interaction
        self.task_list_hidden = false;

        if let Some(task_name) = self.selection_manager.get_selected_task_name() {
            if self.has_visible_panes() {
                // Always clear all panes when toggling with spacebar
                self.clear_all_panes();
                self.spacebar_mode = false;
            } else {
                // Show current task in pane 1 in spacebar mode
                self.pane_tasks = [Some(task_name.clone()), None];
                self.focused_pane = None;
                self.spacebar_mode = true; // Enter spacebar mode

                // Re-evaluate the optimal size of the terminal pane and pty
                let _ = self.handle_resize(None);
            }
        }
    }

    /// Checks if the current view has any visible output panes.
    pub fn has_visible_panes(&self) -> bool {
        self.pane_tasks.iter().any(|t| t.is_some())
    }

    /// Clears all output panes and resets their associated state.
    pub fn clear_all_panes(&mut self) {
        self.pane_tasks = [None, None];
        self.focused_pane = None;
        self.focus = Focus::TaskList;
        self.spacebar_mode = false;
    }

    pub fn assign_current_task_to_pane(&mut self, pane_idx: usize) {
        if let Some(task_name) = self.selection_manager.get_selected_task_name() {
            // If we're in spacebar mode and this is pane 0, convert to pinned mode
            if self.spacebar_mode && pane_idx == 0 {
                self.spacebar_mode = false;
                self.focused_pane = Some(0);
            } else {
                // Check if the task is already pinned to the pane
                if self.pane_tasks[pane_idx].as_deref() == Some(task_name.as_str()) {
                    // Unpin the task if it's already pinned
                    self.pane_tasks[pane_idx] = None;

                    // Adjust focused pane if necessary
                    if !self.has_visible_panes() {
                        self.focused_pane = None;
                        self.focus = Focus::TaskList;
                        self.spacebar_mode = false;
                    }
                } else {
                    // Pin the task to the specified pane
                    self.pane_tasks[pane_idx] = Some(task_name.clone());
                    self.focused_pane = Some(pane_idx);
                    self.focus = Focus::TaskList;
                    self.spacebar_mode = false; // Exit spacebar mode when pinning
                }
            }

            // Always re-evaluate the optimal size of the terminal pane(s) and pty(s)
            let _ = self.handle_resize(None);
        }
    }

    pub fn focus_next(&mut self) {
        let num_panes = self.pane_tasks.iter().filter(|t| t.is_some()).count();
        if num_panes == 0 {
            return; // No panes to focus
        }

        self.focus = match self.focus {
            Focus::TaskList => {
                // Move to first visible pane
                if let Some(first_pane) = self.pane_tasks.iter().position(|t| t.is_some()) {
                    Focus::MultipleOutput(first_pane)
                } else {
                    Focus::TaskList
                }
            }
            Focus::MultipleOutput(current_pane) => {
                // Find next visible pane or go back to task list
                let next_pane = (current_pane + 1..2).find(|&idx| self.pane_tasks[idx].is_some());

                match next_pane {
                    Some(pane) => Focus::MultipleOutput(pane),
                    None => Focus::TaskList,
                }
            }
            Focus::HelpPopup => Focus::TaskList,
        };
    }

    pub fn focus_previous(&mut self) {
        let num_panes = self.pane_tasks.iter().filter(|t| t.is_some()).count();
        if num_panes == 0 {
            return; // No panes to focus
        }

        self.focus = match self.focus {
            Focus::TaskList => {
                // Move to last visible pane
                if let Some(last_pane) = (0..2).rev().find(|&idx| self.pane_tasks[idx].is_some()) {
                    Focus::MultipleOutput(last_pane)
                } else {
                    Focus::TaskList
                }
            }
            Focus::MultipleOutput(current_pane) => {
                // Find previous visible pane or go back to task list
                if current_pane > 0 {
                    if let Some(prev_pane) = (0..current_pane)
                        .rev()
                        .find(|&idx| self.pane_tasks[idx].is_some())
                    {
                        Focus::MultipleOutput(prev_pane)
                    } else {
                        Focus::TaskList
                    }
                } else {
                    Focus::TaskList
                }
            }
            Focus::HelpPopup => Focus::TaskList,
        };
    }

    /// Gets the table style based on the current focus state.
    /// Returns a dimmed style when focus is not on the task list.
    fn get_table_style(&self) -> Style {
        match self.focus {
            Focus::MultipleOutput(_) | Focus::HelpPopup => Style::default().dim(),
            Focus::TaskList => Style::default(),
        }
    }

    /// Gets the current focus state of the component.
    pub fn get_focus(&self) -> Focus {
        self.focus
    }

    /// Forward key events to the currently focused pane, if any.
    pub fn handle_key_event(&mut self, key: KeyEvent) -> io::Result<()> {
        if let Focus::MultipleOutput(pane_idx) = self.focus {
            let terminal_pane_data = &mut self.terminal_pane_data[pane_idx];
            terminal_pane_data.handle_key_event(key)
        } else {
            Ok(())
        }
    }

    /// Returns true if the currently focused pane is in interactive mode.
    pub fn is_interactive_mode(&self) -> bool {
        match self.focus {
            Focus::MultipleOutput(pane_idx) => self.terminal_pane_data[pane_idx].is_interactive(),
            _ => false,
        }
    }

    // TODO: Investigate forcing the cursor, and therefore scroll position, to be at the bottom of the pty when scrolling is required, right now it is relative to the top of the output
    // and if a task is in progress this can feel a bit "off"
    //
    /// Handles window resize events by updating PTY dimensions.
    pub fn handle_resize(&mut self, area_size: Option<(u16, u16)>) -> io::Result<()> {
        let (width, height) = area_size.unwrap_or(
            // Fallback to detecting the overall terminal size
            crossterm::terminal::size()
                // And ultimately fallback so a sane default
                .unwrap_or((80, 24)),
        );

        // Calculate terminal pane area based on task list visibility and number of panes
        let total_panes = self.pane_tasks.iter().filter(|t| t.is_some()).count();

        let terminal_pane_area = if self.task_list_hidden {
            // When task list is hidden, use full width for panes
            if total_panes == 2 {
                Rect::new(0, 0, width / 2, height) // 50:50 split for two panes
            } else if total_panes == 1 {
                Rect::new(0, 0, width, height) // 100% width for one pane
            } else {
                Rect::new(0, 0, width, height)
            }
        } else {
            // When task list is visible, allocate space accordingly
            if self.pane_tasks[1].is_some() || total_panes == 2 {
                Rect::new(0, 0, width / 3, height) // One-third of width for two terminal panes (the other third is for the task list)
            } else if total_panes == 1 {
                Rect::new(0, 0, (width / 3) * 2, height) // Two-thirds of width for one terminal pane (the other third is for the task list)
            } else {
                Rect::new(0, 0, width, height)
            }
        };

        let mut needs_sort = false;

        // Handle resize for each visible pane's pty
        for (_, task_name) in self.pane_tasks.iter().enumerate() {
            if let Some(task_name) = task_name {
                if let Some(task) = self.tasks.iter_mut().find(|t| t.name == *task_name) {
                    if let Some(pty) = self.pty_instances.get_mut(&task.name) {
                        let (pty_height, pty_width) =
                            TerminalPane::calculate_pty_dimensions(terminal_pane_area);

                        // Get current dimensions before resize
                        let old_rows = if let Some(screen) = pty.clone().get_screen() {
                            let (rows, _) = screen.size();
                            rows
                        } else {
                            0
                        };
                        let mut pty_clone = pty.as_ref().clone();
                        pty_clone.resize(pty_height, pty_width)?;

                        // If dimensions changed, mark for sort
                        if old_rows != pty_height {
                            needs_sort = true;
                        }
                    }
                }
            }
        }

        // Sort tasks if needed after all resizing is complete
        if needs_sort {
            self.sort_tasks();
        }

        Ok(())
    }

    fn sort_tasks(&mut self) {
        sort_task_items(&mut self.tasks);

        // Update filtered indices to match new order
        self.filtered_names = self.tasks.iter().map(|t| t.name.clone()).collect();
        if !self.filter_text.is_empty() {
            self.apply_filter();
        }
    }

    /// Returns the count of running and remaining tasks.
    /// Only considers tasks that match the current filter.
    fn get_task_counts(&self) -> (usize, usize) {
        let running = self
            .tasks
            .iter()
            .filter(|t| {
                self.filtered_names.contains(&t.name) && matches!(t.status, TaskStatus::InProgress)
            })
            .count();
        let remaining = self
            .tasks
            .iter()
            .filter(|t| {
                self.filtered_names.contains(&t.name)
                    && matches!(t.status, TaskStatus::InProgress | TaskStatus::NotStarted)
            })
            .count();
        (running, remaining)
    }

    /// Creates header cells for the task list table.
    /// Shows either filter input or task status based on current state.
    fn get_header_cells(&self, collapsed_mode: bool) -> Vec<Cell> {
        let should_dim = matches!(self.focus, Focus::MultipleOutput(_));
        let status_style = if should_dim {
            Style::default().fg(Color::DarkGray).dim()
        } else {
            Style::default().fg(Color::DarkGray)
        };

        // Show filter input when in filter mode
        if self.filter_mode || !self.filter_text.is_empty() {
            let filter_text = format!("Filter: {}", self.filter_text);
            let filter_style = Style::default().fg(Color::Yellow);

            if collapsed_mode {
                vec![
                    Cell::from("").style(status_style),
                    Cell::from(filter_text).style(filter_style),
                ]
            } else {
                vec![
                    Cell::from("").style(status_style),
                    Cell::from(filter_text).style(filter_style),
                    Cell::from(Line::from("Cache").right_aligned()).style(
                        Style::default()
                            .fg(Color::Cyan)
                            .add_modifier(Modifier::BOLD),
                    ),
                    Cell::from(Line::from("Duration").right_aligned()).style(
                        Style::default()
                            .fg(Color::Cyan)
                            .add_modifier(Modifier::BOLD),
                    ),
                ]
            }
        } else {
            // Show normal status text
            let (running, remaining) = self.get_task_counts();
            let status_text = if running == 0 && remaining == 0 {
                // Get total completed tasks
                let completed = self
                    .tasks
                    .iter()
                    .filter(|t| {
                        matches!(
                            t.status,
                            TaskStatus::Success
                                | TaskStatus::Failure
                                | TaskStatus::LocalCache
                                | TaskStatus::LocalCacheKeptExisting
                                | TaskStatus::RemoteCache
                        )
                    })
                    .count();

                // Calculate total duration if we have start/end times
                if let Some(first_start) = self.tasks.iter().filter_map(|t| t.start_time).min() {
                    if let Some(last_end) = self.tasks.iter().filter_map(|t| t.end_time).max() {
                        format!(
                            "Completed {} tasks in {}",
                            completed,
                            utils::format_duration_since(first_start, last_end)
                        )
                    } else {
                        format!("Completed {} tasks", completed)
                    }
                } else {
                    format!("Completed {} tasks", completed)
                }
            } else if collapsed_mode {
                format!("{}/{} remaining...", running, remaining)
            } else {
                format!("Executing {}/{} remaining tasks...", running, remaining)
            };

            if collapsed_mode {
                vec![
                    Cell::from("").style(status_style),
                    Cell::from(status_text).style(status_style),
                ]
            } else {
                vec![
                    Cell::from("").style(status_style),
                    Cell::from(status_text).style(status_style),
                    Cell::from(Line::from("Cache").right_aligned()).style(
                        Style::default()
                            .fg(Color::Cyan)
                            .add_modifier(Modifier::BOLD),
                    ),
                    Cell::from(Line::from("Duration").right_aligned()).style(
                        Style::default()
                            .fg(Color::Cyan)
                            .add_modifier(Modifier::BOLD),
                    ),
                ]
            }
        }
    }

    /// Sets whether the component should be displayed in a dimmed state.
    pub fn set_dimmed(&mut self, is_dimmed: bool) {
        self.is_dimmed = is_dimmed;
    }

    /// Updates their status to InProgress and triggers a sort.
    pub fn start_tasks(&mut self, tasks: Vec<Task>, _app_state: &mut AppState) {
        for task in tasks {
            if let Some(task_item) = self.tasks.iter_mut().find(|t| t.name == task.id) {
                task_item.update_status(TaskStatus::InProgress);
            }
        }
        self.sort_tasks();
    }

    pub fn end_tasks(&mut self, task_results: Vec<TaskResult>, _app_state: &mut AppState) {
        for task_result in task_results {
            if let Some(task) = self
                .tasks
                .iter_mut()
                .find(|t| t.name == task_result.task.id)
            {
                let parsed_status = task_result.status.parse().unwrap();
                task.update_status(parsed_status);

                if task_result.task.start_time.is_some() && task_result.task.end_time.is_some() {
                    task.start_time = Some(task_result.task.start_time.unwrap() as u128);
                    task.end_time = Some(task_result.task.end_time.unwrap() as u128);
                    task.duration = utils::format_duration_since(
                        task_result.task.start_time.unwrap() as u128,
                        task_result.task.end_time.unwrap() as u128,
                    );
                }

                // If the task never had a pty, it must mean that it was run outside of the pseudo-terminal.
                // We create a new parser and writer for the task and register it and then write the final output to the parser
                if !self.pty_instances.contains_key(&task.name) {
                    let (parser, parser_and_writer) = Self::create_empty_parser_and_noop_writer();
                    if let Some(task_result_output) = task_result.terminal_output {
                        Self::write_output_to_parser(parser, task_result_output);
                    }
                    let task_name = task.name.clone();
                    self.create_and_register_pty_instance(&task_name, parser_and_writer);
                }
            }
        }
        self.sort_tasks();
        // Re-evaluate the optimal size of the terminal pane and pty because the newly available task outputs might already be being displayed
        let _ = self.handle_resize(None);
    }

    pub fn update_task_status(&mut self, task_id: String, status: TaskStatus) {
        if let Some(task) = self.tasks.iter_mut().find(|t| t.name == task_id) {
            task.update_status(status);
            self.sort_tasks();
        }
    }

    /// Toggles the visibility of the task list panel
    pub fn toggle_task_list(&mut self) {
        // Only allow hiding if at least one pane is visible, otherwise the screen will be blank
        if self.has_visible_panes() {
            self.task_list_hidden = !self.task_list_hidden;
        }
        let _ = self.handle_resize(None);
    }

    pub fn set_cloud_message(&mut self, message: Option<String>) {
        self.cloud_message = message;
    }

    // TODO: move to app level when the focus and pty data handling are moved up
    pub fn create_and_register_pty_instance(
        &mut self,
        task_id: &str,
        parser_and_writer: External<(ParserArc, WriterArc)>,
    ) {
        // Access the contents of the External
        let parser_and_writer_clone = parser_and_writer.clone();
        let (parser, writer) = &parser_and_writer_clone;
        let pty = Arc::new(
            PtyInstance::new(task_id.to_string(), parser.clone(), writer.clone())
                .map_err(|e| napi::Error::from_reason(format!("Failed to create PTY: {}", e)))
                .unwrap(),
        );

        self.pty_instances.insert(task_id.to_string(), pty.clone());
    }

    // TODO: move to app level when the focus and pty data handling are moved up
    pub fn create_empty_parser_and_noop_writer() -> (ParserArc, External<(ParserArc, WriterArc)>) {
        // Use sane defaults for rows, cols and scrollback buffer size. The dimensions will be adjusted dynamically later.
        let parser = Arc::new(RwLock::new(Parser::new(24, 80, 10000)));
        let writer: Arc<Mutex<Box<dyn Write + Send>>> =
            Arc::new(Mutex::new(Box::new(std::io::sink())));
        (parser.clone(), External::new((parser, writer)))
    }

    // TODO: move to app level when the focus and pty data handling are moved up
    // Writes the given output to the given parser, used for the case where a task is a cache hit, or when it is run outside of the rust pseudo-terminal
    pub fn write_output_to_parser(parser: ParserArc, output: String) {
        parser
            .write()
            .unwrap()
            .write_all(&normalize_newlines(output.as_bytes()))
            .unwrap();
    }
}

impl Component for TasksList {
    fn draw(&mut self, f: &mut Frame<'_>, area: Rect, _app_state: &mut AppState) -> Result<()> {
        // Determine if we should use collapsed mode based on viewport width
        let collapsed_mode = self.has_visible_panes() || area.width < 100;

        // Calculate the width for the task list
        let task_list_width = if self.task_list_hidden {
            0
        } else if collapsed_mode {
            area.width / 3
        } else {
            area.width
        };

        // Create the main layout chunks
        let main_chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints(if self.task_list_hidden {
                if self.pane_tasks.iter().filter(|t| t.is_some()).count() > 1 {
                    vec![Constraint::Percentage(50), Constraint::Percentage(50)]
                } else {
                    vec![Constraint::Percentage(100)]
                }
            } else if collapsed_mode {
                vec![
                    Constraint::Length(task_list_width),
                    Constraint::Min(0), // Remaining space for output(s)
                ]
            } else {
                vec![Constraint::Fill(1)]
            })
            .split(area);

        // Only draw task list if not hidden
        if !self.task_list_hidden {
            let task_list_area = main_chunks[0];

            let has_short_viewport = task_list_area.height < 12;

            // Create layout for title, table and bottom elements
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .constraints(if has_short_viewport {
                    vec![
                        Constraint::Length(2), // Title
                        Constraint::Min(3),    // Table gets most space
                        Constraint::Length(1), // Bottom bar
                        Constraint::Length(1), // Empty space at bottom (only when enough space)
                    ]
                } else if task_list_area.width < 60 {
                    vec![
                        Constraint::Length(2), // Title
                        Constraint::Min(3),    // Table gets most space
                        Constraint::Length(2), // Bottom bar (2 units for stacked layout)
                    ]
                } else {
                    vec![
                        Constraint::Length(2), // Title
                        Constraint::Min(3),    // Table gets most space
                        Constraint::Length(1), // Bottom bar
                    ]
                })
                .split(task_list_area);

            let title_area = chunks[0];
            let table_area = chunks[1];
            let bottom_area = chunks[2];

            // Create vertical layout with top padding
            let title_chunks = Layout::default()
                .direction(Direction::Vertical)
                .constraints([
                    Constraint::Length(1), // Top padding
                    Constraint::Min(1),    // Content
                ])
                .split(title_area);

            let title_style = if self.is_dimmed
                || matches!(self.focus, Focus::MultipleOutput(_) | Focus::HelpPopup)
            {
                Style::default().add_modifier(Modifier::DIM)
            } else {
                Style::default()
            };

            let mut title_text = vec![
                Span::raw(" "),
                Span::styled(" NX ", title_style.bold().bg(Color::Cyan).fg(Color::Black)),
                Span::raw("   "),
                Span::styled(" run-many ", title_style.fg(Color::Cyan).bold()),
            ];

            let task_names = self.target_names.clone();

            // Calculate the width of the fixed elements (everything except task names)
            let fixed_width: usize = title_text.iter().map(|s| s.width()).sum();
            let available_width = title_chunks[1].width as usize;

            // If we're in collapsed mode (output panes showing), we may need to truncate
            if collapsed_mode && !task_names.is_empty() {
                // Calculate how much space we have for task names
                let space_for_names = available_width.saturating_sub(fixed_width + 3); // +3 for ellipsis
                let mut current_width = 0;
                let mut included_names = Vec::new();

                // Add names until we run out of space
                for name in task_names.iter() {
                    let name_width = name.len() + 1; // +1 for the space
                    if current_width + name_width > space_for_names {
                        // No more space, add ellipsis and break
                        included_names.push(Span::styled("...", title_style.fg(Color::DarkGray)));
                        break;
                    }
                    included_names.push(Span::styled(
                        format!(" {}", name),
                        title_style.fg(Color::Gray),
                    ));
                    current_width += name_width;
                }

                title_text.extend(included_names);
            } else {
                // Original behavior for non-collapsed mode
                let middle_spans: Vec<Span> = task_names
                    .iter()
                    .map(|s| Span::styled(format!(" {}", s), title_style.fg(Color::Gray)))
                    .collect();

                title_text.extend(middle_spans);
            }

            // Add padding to fill remaining space
            let content_width: usize = title_text.iter().map(|s| s.width()).sum();

            // Check if we have a cloud message to display
            if let Some(message) = &self.cloud_message {
                if !self.has_visible_panes() {
                    // Extract URL for styling if present
                    if let Some(url_pos) = message.find("https://") {
                        let prefix = &message[0..url_pos];
                        let url = &message[url_pos..];

                        // Calculate widths
                        let url_width = url.len();
                        let prefix_width = prefix.len();
                        let total_message_width = prefix_width + url_width;
                        let buffer_space = 3; // Add a buffer space between title and message

                        // Define styles
                        let dimmed_style = Style::default().fg(Color::DarkGray);
                        let url_style = Style::default().fg(Color::LightCyan).bold().underlined();

                        // Case 1: Enough space for everything (prefix + URL + buffer)
                        if available_width >= content_width + total_message_width + buffer_space {
                            // Add padding between title and cloud message
                            let padding_width =
                                available_width - content_width - total_message_width;
                            title_text.push(Span::raw(" ".repeat(padding_width)));

                            // Add the message parts with appropriate styling
                            title_text.push(Span::styled(prefix, dimmed_style));
                            title_text.push(Span::styled(url, url_style));
                        }
                        // Case 2: Only enough space for URL + buffer (no prefix)
                        else if available_width >= content_width + url_width + buffer_space {
                            // Add padding between title and URL to keep URL right-aligned
                            let padding_width = available_width - content_width - url_width;
                            title_text.push(Span::raw(" ".repeat(padding_width)));

                            // Add only the URL
                            title_text.push(Span::styled(url, url_style));
                        }
                        // Case 3: Not enough space for URL with current title, truncate title
                        else if available_width >= url_width + 15 {
                            // Ensure minimum title width + buffer
                            // Save original title text length for comparison
                            let original_title_len = title_text.len();

                            // Keep truncating the title until we have enough space for the URL + buffer
                            while title_text.iter().map(|s| s.width()).sum::<usize>()
                                > available_width - url_width - buffer_space
                            {
                                if title_text.len() <= 2 {
                                    // Keep at least the NX logo
                                    break;
                                }
                                title_text.pop();
                            }

                            // Add ellipsis if we truncated the title (with dimmed styling)
                            if title_text.len() < original_title_len {
                                title_text.push(Span::styled("...", dimmed_style));
                            }

                            // Add padding to ensure URL is right-aligned
                            let current_width = title_text.iter().map(|s| s.width()).sum::<usize>();
                            let padding_width = available_width - current_width - url_width;
                            title_text.push(Span::raw(" ".repeat(padding_width)));

                            // Add the URL
                            title_text.push(Span::styled(url, url_style));
                        }
                        // Case 4: Not enough space for anything meaningful
                        else {
                            // Just add padding to fill available space
                            if available_width > content_width {
                                title_text
                                    .push(Span::raw(" ".repeat(available_width - content_width)));
                            }
                        }
                    } else {
                        // No URL, add the whole message if there's space (with buffer)
                        let buffer_space = 3;
                        if available_width > content_width + message.len() + buffer_space {
                            let padding_width = available_width - content_width - message.len();
                            title_text.push(Span::raw(" ".repeat(padding_width)));
                            title_text
                                .push(Span::styled(message, Style::default().fg(Color::DarkGray)));
                        } else if available_width > content_width {
                            // Not enough space, just add padding
                            title_text.push(Span::raw(" ".repeat(available_width - content_width)));
                        }
                    }
                } else if available_width > content_width {
                    // Has visible panes, just add padding
                    title_text.push(Span::raw(" ".repeat(available_width - content_width)));
                }
            } else if available_width > content_width {
                // No cloud message, add regular padding
                title_text.push(Span::raw(" ".repeat(available_width - content_width)));
            }

            let paragraph = Paragraph::new(Line::from(title_text)).alignment(Alignment::Left);

            // Render the title
            f.render_widget(paragraph, title_chunks[1]);

            // Reserve space for pagination and borders
            self.recalculate_pages(table_area.height.saturating_sub(6));

            let visible_entries = self.selection_manager.get_current_page_entries();
            let selected_style = Style::default().add_modifier(Modifier::BOLD);
            let normal_style = Style::default();

            // Get header cells using the new method
            let header_cells = self.get_header_cells(collapsed_mode);

            let header = Row::new(header_cells)
                .style(normal_style)
                .height(1)
                .top_margin(1) // Add margin above header
                .bottom_margin(1);

            // Create rows including filter summary if needed
            let mut all_rows = Vec::new();

            // Add filter summary row if filtering or there are filtered tasks
            let hidden_tasks = self.tasks.len() - self.filtered_names.len();
            if self.filter_mode || !self.filter_text.is_empty() {
                let filter_cells = if collapsed_mode {
                    vec![
                        Cell::from(""),
                        Cell::from(if hidden_tasks > 0 {
                            if self.filter_persisted {
                                format!(
                                    "{} tasks filtered out. Press / to edit, <esc> to clear",
                                    hidden_tasks
                                )
                            } else {
                                format!(
                                    "{} tasks filtered out. Press / to persist, <esc> to clear",
                                    hidden_tasks
                                )
                            }
                        } else if self.filter_persisted {
                            "Press / to edit filter".to_string()
                        } else {
                            "Press <esc> to clear filter".to_string()
                        })
                        .style(Style::default().fg(Color::Yellow)),
                    ]
                } else {
                    vec![
                        Cell::from(""),
                        Cell::from(if hidden_tasks > 0 {
                            if self.filter_persisted {
                                format!(
                                    "{} tasks filtered out. Press / to edit, <esc> to clear",
                                    hidden_tasks
                                )
                            } else {
                                format!(
                                    "{} tasks filtered out. Press / to persist, <esc> to clear",
                                    hidden_tasks
                                )
                            }
                        } else if self.filter_persisted {
                            "Press / to edit filter".to_string()
                        } else {
                            "Press <esc> to clear filter".to_string()
                        })
                        .style(Style::default().fg(Color::Yellow)),
                        Cell::from(""),
                        Cell::from(""),
                    ]
                };
                all_rows.push(Row::new(filter_cells).height(1));

                // Add empty row after filter summary
                let empty_cells = if collapsed_mode {
                    vec![Cell::from(""), Cell::from("")]
                } else {
                    vec![
                        Cell::from(""),
                        Cell::from(""),
                        Cell::from(""),
                        Cell::from(""),
                    ]
                };
                all_rows.push(Row::new(empty_cells).height(1));
            }

            // Add task rows
            all_rows.extend(visible_entries.iter().map(|entry| {
                if let Some(task_name) = entry {
                    // Find the task in the filtered list
                    if let Some(task) = self.tasks.iter().find(|t| &t.name == task_name) {
                        let is_selected = self.selection_manager.is_selected(&task_name);
                        let status_cell = match task.status {
                            TaskStatus::Success => Cell::from(Line::from(vec![
                                Span::raw(if is_selected { " > " } else { "   " }),
                                Span::styled(" ✔", Style::default().fg(Color::Green)),
                            ])),
                            TaskStatus::Failure => Cell::from(Line::from(vec![
                                Span::raw(if is_selected { " > " } else { "   " }),
                                Span::styled(" ✖", Style::default().fg(Color::Red)),
                            ])),
                            TaskStatus::Skipped => Cell::from(Line::from(vec![
                                Span::raw(if is_selected { " > " } else { "   " }),
                                Span::styled(" ⏭", Style::default().fg(Color::Yellow)),
                            ])),
                            TaskStatus::LocalCacheKeptExisting => Cell::from(Line::from(vec![
                                Span::raw(if is_selected { " > " } else { "   " }),
                                Span::styled(" ⚡", Style::default().fg(Color::Green)),
                            ])),
                            TaskStatus::LocalCache => Cell::from(Line::from(vec![
                                Span::raw(if is_selected { " > " } else { "   " }),
                                Span::styled(" ⚡", Style::default().fg(Color::Green)),
                            ])),
                            TaskStatus::RemoteCache => Cell::from(Line::from(vec![
                                Span::raw(if is_selected { " > " } else { "   " }),
                                Span::styled(" ⚡▼", Style::default().fg(Color::Green)),
                            ])),
                            TaskStatus::InProgress => {
                                let throbber_chars =
                                    ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
                                let throbber_char =
                                    throbber_chars[self.throbber_counter % throbber_chars.len()];
                                Cell::from(Line::from(vec![
                                    Span::raw(if is_selected { " > " } else { "   " }),
                                    Span::raw(" "),
                                    Span::styled(
                                        throbber_char.to_string(),
                                        Style::default().fg(Color::LightCyan),
                                    ),
                                ]))
                            }
                            TaskStatus::NotStarted => Cell::from(Line::from(vec![
                                Span::raw(if is_selected { " > " } else { "   " }),
                                Span::styled(" ·", Style::default().fg(Color::DarkGray)),
                            ])),
                        };

                        let name = {
                            // Show output indicators if the task is pinned to a pane (but not in spacebar mode)
                            let output_indicators = if !self.spacebar_mode {
                                self.pane_tasks
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
                                // Get status color based on task status
                                let status_color = match task.status {
                                    TaskStatus::Success
                                    | TaskStatus::LocalCacheKeptExisting
                                    | TaskStatus::LocalCache
                                    | TaskStatus::RemoteCache => Color::Green,
                                    TaskStatus::Failure => Color::Red,
                                    TaskStatus::Skipped => Color::Yellow,
                                    TaskStatus::InProgress => Color::LightCyan,
                                    TaskStatus::NotStarted => Color::DarkGray,
                                };

                                let line = Line::from(vec![
                                    Span::raw(task_name),
                                    Span::raw(" "),
                                    Span::styled(
                                        output_indicators,
                                        Style::default().dim().fg(status_color),
                                    ),
                                ]);
                                Cell::from(line)
                            } else {
                                Cell::from(task_name.clone())
                            }
                        };

                        let mut row_cells = vec![status_cell, name];

                        if !collapsed_mode {
                            row_cells.push(Cell::from(
                                Line::from(match task.cache_status.as_str() {
                                    CACHE_STATUS_NOT_YET_KNOWN | CACHE_STATUS_NOT_APPLICABLE => {
                                        vec![Span::styled(
                                            task.cache_status.clone(),
                                            Style::default().dim(),
                                        )]
                                    }
                                    _ => vec![Span::raw(task.cache_status.clone())],
                                })
                                .right_aligned(),
                            ));
                            row_cells.push(Cell::from(
                                Line::from(match task.duration.as_str() {
                                    "" | "Continuous" => vec![Span::styled(
                                        task.duration.clone(),
                                        Style::default().dim(),
                                    )],
                                    _ => vec![Span::raw(task.duration.clone())],
                                })
                                .right_aligned(),
                            ));
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
                    // Handle separator rows
                    let empty_cells = if collapsed_mode {
                        vec![Cell::from(""), Cell::from("")]
                    } else {
                        vec![
                            Cell::from(""),
                            Cell::from(""),
                            Cell::from(""),
                            Cell::from(""),
                        ]
                    };
                    Row::new(empty_cells).height(1)
                }
            }));

            let constraints = if collapsed_mode {
                vec![Constraint::Length(8), Constraint::Fill(1)]
            } else {
                vec![
                    Constraint::Length(8),  // Status icon
                    Constraint::Fill(1),    // Task name
                    Constraint::Length(30), // Cache status (increased width)
                    Constraint::Length(15), // Duration (increased width)
                ]
            };

            let t = Table::new(all_rows, &constraints)
                .header(header)
                .block(Block::default())
                .style(self.get_table_style());

            f.render_widget(t, table_area);

            let needs_vertical_bottom_layout = area.width < 90 || has_short_viewport;

            // Bottom bar layout
            let bottom_layout = if needs_vertical_bottom_layout {
                // Stack vertically when area is limited
                Layout::default()
                    .direction(Direction::Vertical)
                    .constraints(vec![
                        Constraint::Length(1), // Pagination
                        Constraint::Length(1), // Help text
                    ])
                    .split(bottom_area)
            } else {
                // Original horizontal layout
                Layout::default()
                    .direction(Direction::Horizontal)
                    .constraints(if collapsed_mode {
                        vec![
                            Constraint::Length(20), // Fixed width for pagination
                            Constraint::Fill(1),    // Flexible space for help text
                        ]
                    } else {
                        vec![
                            Constraint::Length(20), // Fixed width for pagination
                            Constraint::Fill(1),    // Flexible space for help text
                            Constraint::Length(20), // Mirror image for alignment
                        ]
                    })
                    .split(bottom_area)
            };

            // Determine if bottom bar elements should be dimmed
            let should_dim = matches!(self.focus, Focus::MultipleOutput(_));

            // Pagination (always shown)
            let total_pages = self.selection_manager.total_pages();
            let current_page = self.selection_manager.get_current_page();
            let pagination = Pagination::new(current_page, total_pages);
            pagination.render(f, bottom_layout[0], should_dim);

            // Help text
            let help_text = HelpText::new(collapsed_mode, should_dim, needs_vertical_bottom_layout);
            if !self.is_dimmed {
                // If dealing with a constrained viewport, we need to align horizontally
                if needs_vertical_bottom_layout {
                    // Add empty space in front of help text for better alignment
                    let help_text_area = Layout::default()
                        .direction(Direction::Horizontal)
                        .constraints([
                            Constraint::Length(9), // Match pagination indentation
                            Constraint::Fill(1),
                        ])
                        .split(bottom_layout[1])[1];

                    help_text.render(f, help_text_area);
                } else {
                    // Original rendering without padding
                    help_text.render(f, bottom_layout[1]);
                }
            }
        }

        // Handle output areas
        if collapsed_mode || self.task_list_hidden {
            let output_area = if self.task_list_hidden {
                // Use the full area when task list is hidden
                area
            } else {
                main_chunks[1]
            };

            let num_active_panes = self.pane_tasks.iter().filter(|t| t.is_some()).count();

            match num_active_panes {
                0 => (), // No panes to render
                1 => {
                    if self.pane_tasks[1].is_some() {
                        let output_chunks = Layout::default()
                            .direction(Direction::Horizontal)
                            .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
                            .spacing(2)
                            .split(output_area);

                        // Render placeholder for pane 1
                        let placeholder = Paragraph::new("Press 1 on a task to show it here")
                            .block(
                                Block::default()
                                    .title("  Output 1  ")
                                    .borders(Borders::ALL)
                                    .border_style(Style::default().fg(Color::DarkGray)),
                            )
                            .style(Style::default().fg(Color::DarkGray))
                            .alignment(Alignment::Center);

                        f.render_widget(placeholder, output_chunks[0]);

                        // Get task data before rendering
                        if let Some(task_name) = &self.pane_tasks[1] {
                            if let Some(task) = self.tasks.iter_mut().find(|t| t.name == *task_name)
                            {
                                let mut terminal_pane_data = &mut self.terminal_pane_data[1];
                                terminal_pane_data.is_continuous = task.continuous;

                                let mut has_pty = false;
                                if let Some(pty) = self.pty_instances.get(task_name) {
                                    terminal_pane_data.pty = Some(pty.clone());
                                    has_pty = true;
                                }

                                let is_focused = match self.focus {
                                    Focus::MultipleOutput(focused_pane_idx) => {
                                        1 == focused_pane_idx
                                    }
                                    _ => false,
                                };

                                let mut state = TerminalPaneState::new(
                                    task.name.clone(),
                                    task.status,
                                    task.continuous,
                                    is_focused,
                                    has_pty,
                                );

                                let terminal_pane = TerminalPane::new()
                                    .pty_data(&mut terminal_pane_data)
                                    .continuous(task.continuous);

                                f.render_stateful_widget(
                                    terminal_pane,
                                    output_chunks[1],
                                    &mut state,
                                );
                            }
                        }
                    } else if let Some((pane_idx, Some(task_name))) = self
                        .pane_tasks
                        .iter()
                        .enumerate()
                        .find(|(_, t)| t.is_some())
                    {
                        if let Some(task) = self.tasks.iter_mut().find(|t| t.name == *task_name) {
                            let mut terminal_pane_data = &mut self.terminal_pane_data[pane_idx];
                            terminal_pane_data.is_continuous = task.continuous;

                            let mut has_pty = false;
                            if let Some(pty) = self.pty_instances.get(task_name) {
                                terminal_pane_data.pty = Some(pty.clone());
                                has_pty = true;
                            }

                            let is_focused = match self.focus {
                                Focus::MultipleOutput(focused_pane_idx) => 0 == focused_pane_idx,
                                _ => false,
                            };

                            let mut state = TerminalPaneState::new(
                                task.name.clone(),
                                task.status,
                                task.continuous,
                                is_focused,
                                has_pty,
                            );

                            let terminal_pane = TerminalPane::new()
                                .pty_data(&mut terminal_pane_data)
                                .continuous(task.continuous);

                            f.render_stateful_widget(terminal_pane, output_area, &mut state);
                        }
                    }
                }
                _ => {
                    let output_chunks = Layout::default()
                        .direction(Direction::Horizontal)
                        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
                        .spacing(2)
                        .split(output_area);

                    for (pane_idx, chunk) in output_chunks.iter().enumerate() {
                        if let Some(task_name) = &self.pane_tasks[pane_idx] {
                            if let Some(task) = self.tasks.iter_mut().find(|t| t.name == *task_name)
                            {
                                let mut terminal_pane_data = &mut self.terminal_pane_data[pane_idx];
                                terminal_pane_data.is_continuous = task.continuous;

                                let mut has_pty = false;
                                if let Some(pty) = self.pty_instances.get(task_name) {
                                    terminal_pane_data.pty = Some(pty.clone());
                                    has_pty = true;
                                }

                                let is_focused = match self.focus {
                                    Focus::MultipleOutput(focused_pane_idx) => {
                                        pane_idx == focused_pane_idx
                                    }
                                    _ => false,
                                };

                                let mut state = TerminalPaneState::new(
                                    task.name.clone(),
                                    task.status,
                                    task.continuous,
                                    is_focused,
                                    has_pty,
                                );

                                let terminal_pane = TerminalPane::new()
                                    .pty_data(&mut terminal_pane_data)
                                    .continuous(task.continuous);

                                f.render_stateful_widget(terminal_pane, *chunk, &mut state);
                            }
                        } else {
                            let placeholder =
                                Paragraph::new("Press 1 or 2 on a task to show it here")
                                    .block(
                                        Block::default()
                                            .title(format!("Output {}", pane_idx + 1))
                                            .borders(Borders::ALL)
                                            .border_style(Style::default().fg(Color::DarkGray)),
                                    )
                                    .style(Style::default().fg(Color::DarkGray))
                                    .alignment(Alignment::Center);

                            f.render_widget(placeholder, *chunk);
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Updates the component state in response to an action.
    /// Returns an optional follow-up action.
    fn update(&mut self, action: Action, _app_state: &mut AppState) -> Result<Option<Action>> {
        match action {
            Action::Tick => {
                self.throbber_counter = self.throbber_counter.wrapping_add(1);
            }
            Action::Resize(w, h) => {
                self.handle_resize(Some((w, h)))?;
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

impl Default for TasksList {
    fn default() -> Self {
        Self {
            pty_instances: HashMap::new(),
            selection_manager: TaskSelectionManager::default(),
            tasks: Vec::new(),
            filtered_names: Vec::new(),
            throbber_counter: 0,
            filter_mode: false,
            filter_text: String::new(),
            filter_persisted: false,
            focus: Focus::TaskList,
            pane_tasks: [None, None],
            focused_pane: None,
            is_dimmed: false,
            spacebar_mode: false,
            terminal_pane_data: [TerminalPaneData::default(), TerminalPaneData::default()],
            target_names: Vec::new(),
            task_list_hidden: false,
            cloud_message: None,
        }
    }
}
