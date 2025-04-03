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

use crate::native::tui::utils::{is_cache_hit, normalize_newlines, sort_task_items};
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
use super::task_selection_manager::{SelectionMode, TaskSelectionManager};
use super::terminal_pane::{TerminalPane, TerminalPaneData};
use super::{help_text::HelpText, terminal_pane::TerminalPaneState};

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
    task_list_hidden: bool,
    cloud_message: Option<String>,
    max_parallel: usize, // Maximum number of parallel tasks
    title_text: String,
    resize_debounce_timer: Option<u128>, // Timer for debouncing resize events
    pending_resize: Option<(u16, u16)>,  // Pending resize dimensions
}

impl TasksList {
    /// Creates a new TasksList with the given tasks.
    /// Converts the input tasks into TaskItems and initializes the UI state.
    pub fn new(tasks: Vec<Task>, pinned_tasks: Vec<String>, title_text: String) -> Self {
        let mut task_items = Vec::new();

        for task in tasks {
            task_items.push(TaskItem::new(task.id, task.continuous.unwrap_or(false)));
        }

        let filtered_names = Vec::new();
        let mut selection_manager = TaskSelectionManager::new(5); // Default 5 items per page

        let mut focus = Focus::TaskList;
        let mut focused_pane = None;

        let main_terminal_pane_data = TerminalPaneData::new();
        if let Some(main_task) = pinned_tasks.first() {
            selection_manager.select_task(main_task.clone());
            // Auto-focus the main task
            focus = Focus::MultipleOutput(0);
            focused_pane = Some(0);
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
            task_list_hidden: false,
            cloud_message: None,
            max_parallel: DEFAULT_MAX_PARALLEL,
            title_text,
            resize_debounce_timer: None,
            pending_resize: None,
        }
    }

    pub fn set_max_parallel(&mut self, max_parallel: Option<u32>) {
        self.max_parallel = max_parallel.unwrap_or(DEFAULT_MAX_PARALLEL as u32) as usize;
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

    // Add a helper method to safely check if we should show the parallel section
    fn should_show_parallel_section(&self) -> bool {
        // Only show the parallel section if we're on the first page and have tasks in progress or pending
        let is_first_page = self.selection_manager.get_current_page() == 0;
        let has_active_tasks = self
            .tasks
            .iter()
            .any(|t| matches!(t.status, TaskStatus::InProgress | TaskStatus::NotStarted));

        is_first_page && has_active_tasks && !self.is_loading_state()
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
        // Set the appropriate selection mode based on our current state
        let should_track_by_name = self.spacebar_mode || self.has_visible_panes();
        let mode = if should_track_by_name {
            SelectionMode::TrackByName
        } else {
            SelectionMode::TrackByPosition
        };
        self.selection_manager.set_selection_mode(mode);

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
                // Update selection mode to position-based
                self.selection_manager
                    .set_selection_mode(SelectionMode::TrackByPosition);
            } else {
                // Show current task in pane 1 in spacebar mode
                self.pane_tasks = [Some(task_name.clone()), None];
                self.focused_pane = None;
                self.spacebar_mode = true; // Enter spacebar mode

                // Update selection mode to name-based when entering spacebar mode
                self.selection_manager
                    .set_selection_mode(SelectionMode::TrackByName);

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
        // When all panes are cleared, use position-based selection
        self.selection_manager
            .set_selection_mode(SelectionMode::TrackByPosition);
    }

    pub fn assign_current_task_to_pane(&mut self, pane_idx: usize) {
        if let Some(task_name) = self.selection_manager.get_selected_task_name() {
            // If we're in spacebar mode and this is pane 0, convert to pinned mode
            if self.spacebar_mode && pane_idx == 0 {
                self.spacebar_mode = false;
                self.focused_pane = Some(0);
                // When converting from spacebar to pinned, stay in name-tracking mode
                self.selection_manager
                    .set_selection_mode(SelectionMode::TrackByName);
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
                        // When all panes are cleared, use position-based selection
                        self.selection_manager
                            .set_selection_mode(SelectionMode::TrackByPosition);
                    }
                } else {
                    // Pin the task to the specified pane
                    self.pane_tasks[pane_idx] = Some(task_name.clone());
                    self.focused_pane = Some(pane_idx);
                    self.focus = Focus::TaskList;
                    self.spacebar_mode = false; // Exit spacebar mode when pinning
                                                // When pinning a task, use name-based selection
                    self.selection_manager
                        .set_selection_mode(SelectionMode::TrackByName);
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
                    None => {
                        // If the task list is hidden, try and go back to the previous pane if there is one, otherwise do nothing
                        if self.task_list_hidden {
                            if current_pane > 0 {
                                Focus::MultipleOutput(current_pane - 1)
                            } else {
                                return;
                            }
                        } else {
                            Focus::TaskList
                        }
                    }
                }
            }
            Focus::HelpPopup => Focus::TaskList,
            Focus::CountdownPopup => Focus::TaskList,
        };
    }

    pub fn focus_previous(&mut self) {
        let num_panes = self.pane_tasks.iter().filter(|t| t.is_some()).count();
        if num_panes == 0 {
            return; // No panes to focus
        }

        self.focus = match self.focus {
            Focus::TaskList => {
                // When on task list, go to the rightmost (highest index) pane
                if let Some(last_pane) = (0..2).rev().find(|&idx| self.pane_tasks[idx].is_some()) {
                    Focus::MultipleOutput(last_pane)
                } else {
                    Focus::TaskList
                }
            }
            Focus::MultipleOutput(current_pane) => {
                if current_pane > 0 {
                    // Try to go to previous pane
                    if let Some(prev_pane) = (0..current_pane)
                        .rev()
                        .find(|&idx| self.pane_tasks[idx].is_some())
                    {
                        Focus::MultipleOutput(prev_pane)
                    } else if !self.task_list_hidden {
                        // Go to task list if it's visible
                        Focus::TaskList
                    } else {
                        // If task list is hidden, wrap around to rightmost pane
                        if let Some(last_pane) =
                            (0..2).rev().find(|&idx| self.pane_tasks[idx].is_some())
                        {
                            Focus::MultipleOutput(last_pane)
                        } else {
                            // Shouldn't happen (would mean no panes)
                            return;
                        }
                    }
                } else {
                    // We're at leftmost pane (index 0)
                    if !self.task_list_hidden {
                        // Go to task list if it's visible
                        Focus::TaskList
                    } else if num_panes > 1 {
                        // If task list hidden and multiple panes, wrap to rightmost pane
                        if let Some(last_pane) =
                            (1..2).rev().find(|&idx| self.pane_tasks[idx].is_some())
                        {
                            Focus::MultipleOutput(last_pane)
                        } else {
                            // Stay on current pane if can't find another one
                            Focus::MultipleOutput(current_pane)
                        }
                    } else {
                        // Only one pane and task list hidden, nowhere to go
                        Focus::MultipleOutput(current_pane)
                    }
                }
            }
            Focus::HelpPopup => Focus::TaskList,
            Focus::CountdownPopup => Focus::TaskList,
        };
    }

    /// Gets the table style based on the current focus state.
    /// Returns a dimmed style when focus is not on the task list.
    fn get_table_style(&self) -> Style {
        match self.focus {
            Focus::MultipleOutput(_) | Focus::HelpPopup | Focus::CountdownPopup => {
                Style::default().dim()
            }
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

    /// Handles window resize events by updating PTY dimensions.
    pub fn handle_resize(&mut self, area_size: Option<(u16, u16)>) -> io::Result<()> {
        // Store the new dimensions as pending
        self.pending_resize = area_size;

        // Get current time in milliseconds
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis();

        // If we have a timer and it's not expired yet, just return
        if let Some(timer) = self.resize_debounce_timer {
            if now < timer {
                return Ok(());
            }
        }

        // Set a new timer for 500ms from now
        self.resize_debounce_timer = Some(now + 500);

        // Process the resize
        self.process_resize()
    }

    /// Actually processes the resize event by updating PTY dimensions.
    fn process_resize(&mut self) -> io::Result<()> {
        let (width, height) = self.pending_resize.unwrap_or(
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
        // Set the appropriate selection mode based on our current state
        let should_track_by_name = self.spacebar_mode || self.has_visible_panes();
        let mode = if should_track_by_name {
            SelectionMode::TrackByName
        } else {
            SelectionMode::TrackByPosition
        };
        self.selection_manager.set_selection_mode(mode);

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
        self.selection_manager.update_entries(entries);
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
    fn get_header_cells(&self, collapsed_mode: bool, narrow_viewport: bool) -> Vec<Cell> {
        let should_dim = matches!(
            self.focus,
            Focus::MultipleOutput(_) | Focus::HelpPopup | Focus::CountdownPopup
        );
        let status_style = if should_dim {
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

        // Show running tasks status (no longer showing filter in header)
        let (running, remaining) = self.get_task_counts();

        // Leave first cell empty for the logo
        let status_cell = Cell::from("").style(status_style);

        // Completion status text is now shown with the logo in the first cell
        // Just provide an empty second cell
        let status_text = String::new();

        if collapsed_mode {
            vec![status_cell, Cell::from(status_text)]
        } else if narrow_viewport {
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
            // Move focus to the next output pane
            if matches!(self.focus, Focus::TaskList) {
                self.focus_next();
            }
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
        let normalized_output = normalize_newlines(output.as_bytes());
        parser
            .write()
            .unwrap()
            .write_all(&normalized_output)
            .unwrap();
    }
}

impl Component for TasksList {
    fn draw(&mut self, f: &mut Frame<'_>, area: Rect, _app_state: &mut AppState) -> Result<()> {
        let collapsed_mode = self.has_visible_panes();

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
                        Constraint::Fill(1),   // Table gets most space
                        Constraint::Length(2), // Filter display (when active)
                        Constraint::Length(1), // Empty line between filter and pagination
                        Constraint::Length(1), // Bottom bar (pagination)
                    ]
                } else if task_list_area.width < 60 {
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
                })
                .split(task_list_area);

            let table_area = chunks[0];
            let filter_area = chunks[1];
            let empty_line = chunks[2]; // Empty line between filter and pagination
            let pagination_area = chunks[3]; // Bottom bar area - now contains the cloud message rendering

            // Reserve space for pagination and borders
            self.recalculate_pages(table_area.height.saturating_sub(4));

            let visible_entries = self.selection_manager.get_current_page_entries();
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

            let narrow_viewport = area.width < 90;

            // Get header cells using the existing method but add NX logo to first cell
            let mut header_cells = self.get_header_cells(collapsed_mode, narrow_viewport);

            // Get the style based on whether all tasks are completed
            let title_color = if all_tasks_completed {
                // Use the logo color for the title text as well
                logo_color
            } else {
                Color::White
            };

            // Apply modifiers based on focus state
            let title_style = if self.is_dimmed
                || matches!(self.focus, Focus::MultipleOutput(_) | Focus::HelpPopup)
            {
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
                let is_first_page = self.selection_manager.get_current_page() == 0;
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
                        let time_str = utils::format_duration_since(first_start, last_end);

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
                let is_first_page = self.selection_manager.get_current_page() == 0;

                let empty_cells = if collapsed_mode {
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
                    ]
                } else if narrow_viewport {
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
                let empty_cells = if collapsed_mode {
                    vec![
                        Cell::from("   "), // Just spaces for indentation, no vertical line
                        Cell::from(""),
                    ]
                } else if narrow_viewport {
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
                        let is_selected = self.selection_manager.is_selected(&task_name);

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
                            TaskStatus::InProgress => {
                                let throbber_chars =
                                    ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
                                let throbber_char =
                                    throbber_chars[self.throbber_counter % throbber_chars.len()];

                                let mut spans =
                                    vec![Span::raw(if is_selected { ">" } else { " " })];

                                // Add vertical line for parallel section if needed (always takes 1 character width)
                                if is_in_parallel_section
                                    && self.selection_manager.get_current_page() == 0
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

                        if !collapsed_mode {
                            if narrow_viewport {
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
                                        CACHE_STATUS_NOT_YET_KNOWN
                                        | CACHE_STATUS_NOT_APPLICABLE => {
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
                        } else {
                            // No cache/duration cells in collapsed mode
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
                        let is_first_page = self.selection_manager.get_current_page() == 0;

                        let empty_cells = if collapsed_mode {
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
                                Cell::from(Span::styled(
                                    "Waiting for task...",
                                    Style::default().dim(),
                                )),
                            ]
                        } else if narrow_viewport {
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
                                Cell::from(Span::styled(
                                    "Waiting for task...",
                                    Style::default().dim(),
                                )),
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
                                Cell::from(Span::styled(
                                    "Waiting for task...",
                                    Style::default().dim(),
                                )),
                                Cell::from(""),
                                Cell::from(""),
                            ]
                        };
                        Row::new(empty_cells).height(1).style(normal_style)
                    } else if is_bottom_cap {
                        // Add the bottom corner cap at the end of the parallel section, only on first page
                        let is_first_page = self.selection_manager.get_current_page() == 0;

                        let empty_cells = if collapsed_mode {
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
                            ]
                        } else if narrow_viewport {
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
                        let empty_cells = if collapsed_mode {
                            vec![Cell::from(""), Cell::from("")]
                        } else if narrow_viewport {
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

            let constraints = if collapsed_mode {
                vec![Constraint::Length(6), Constraint::Fill(1)]
            } else if narrow_viewport {
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

            // After rendering the table, render the filter text if active
            if self.filter_mode || !self.filter_text.is_empty() {
                let hidden_tasks = self.tasks.len() - self.filtered_names.len();

                // Render exactly as it was before, just at the bottom
                // Add proper indentation to align with task content - 4 spaces matches the task indentation
                let filter_text = format!("  Filter: {}", self.filter_text);

                // Determine if filter text should be dimmed based on focus
                let should_dim = matches!(
                    self.focus,
                    Focus::MultipleOutput(_) | Focus::HelpPopup | Focus::CountdownPopup
                );

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
            }

            // Render cloud message in its dedicated area if it exists
            let needs_vertical_bottom_layout = narrow_viewport || has_short_viewport;

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

            // Determine if bottom bar elements should be dimmed
            let should_dim = matches!(
                self.focus,
                Focus::MultipleOutput(_) | Focus::HelpPopup | Focus::CountdownPopup
            );

            // Get pagination info
            let total_pages = self.selection_manager.total_pages();
            let current_page = self.selection_manager.get_current_page();

            // Create combined bottom bar with pagination on left and help text centered
            let pagination = Pagination::new(current_page, total_pages);

            // Calculate how much space the pagination needs (with arrows)
            let pagination_width = 20; // Increase width for pagination with arrows

            // Create help text component
            let help_text = HelpText::new(
                collapsed_mode || self.cloud_message.is_some(),
                should_dim,
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

                pagination.render(f, pagination_area, should_dim);

                // Only show help text if not dimmed
                if !self.is_dimmed {
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
                            Constraint::Fill(1), // Cloud message gets most of the remaining space
                            Constraint::Length(2), // Right-side padding for breathing room
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

                pagination.render(f, pagination_area, should_dim);

                // Only show help text if not dimmed
                if !self.is_dimmed {
                    // Let the help text use its dedicated area
                    help_text.render(f, bottom_bar_layout[1]);
                }

                // Render cloud message if it exists
                if let Some(message) = &self.cloud_message {
                    // Only proceed with cloud message rendering if:
                    // - We're not in collapsed mode, OR
                    // - The message contains a URL
                    let should_show_message = !collapsed_mode || message.contains("https://");

                    if should_show_message {
                        // Get available width for the cloud message
                        let available_width = bottom_bar_layout[2].width as usize;

                        // Create text with URL styling if needed
                        let message_line = if let Some(url_pos) = message.find("https://") {
                            let prefix = &message[0..url_pos];
                            let url = &message[url_pos..];

                            // Determine styles based on dimming state
                            let prefix_style = if should_dim {
                                Style::default().fg(Color::DarkGray).dim()
                            } else {
                                Style::default().fg(Color::DarkGray)
                            };

                            let url_style = if should_dim {
                                Style::default().fg(Color::LightCyan).underlined().dim()
                            } else {
                                Style::default().fg(Color::LightCyan).underlined()
                            };

                            // In collapsed mode or with limited width, prioritize showing the URL
                            if collapsed_mode || available_width < 30 {
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
                                            &url[..available_width
                                                .saturating_sub(3)
                                                .min(url.len())]
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
                                            &url[..available_width
                                                .saturating_sub(3)
                                                .min(url.len())]
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

                            let message_style = if should_dim {
                                Style::default().fg(Color::DarkGray).dim()
                            } else {
                                Style::default().fg(Color::DarkGray)
                            };

                            Line::from(vec![Span::styled(display_message, message_style)])
                        };

                        let cloud_message_paragraph =
                            Paragraph::new(message_line).alignment(Alignment::Right);
                        f.render_widget(cloud_message_paragraph, bottom_bar_layout[2]);
                    }
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
                                terminal_pane_data.is_cache_hit = is_cache_hit(task.status);

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
                            terminal_pane_data.is_cache_hit = is_cache_hit(task.status);

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
                                terminal_pane_data.is_cache_hit = is_cache_hit(task.status);

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

                // Check if we have a pending resize that needs to be processed
                if let Some(timer) = self.resize_debounce_timer {
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis();

                    if now >= timer {
                        // Timer expired, process the resize
                        if self.pending_resize.is_some() {
                            self.process_resize()?;
                        }
                        self.resize_debounce_timer = None;
                        self.pending_resize = None;
                    }
                }
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
            task_list_hidden: false,
            cloud_message: None,
            max_parallel: DEFAULT_MAX_PARALLEL,
            title_text: String::new(),
            resize_debounce_timer: None,
            pending_resize: None,
        }
    }
}
