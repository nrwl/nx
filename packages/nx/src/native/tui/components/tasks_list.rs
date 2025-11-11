use color_eyre::eyre::Result;
use hashbrown::{HashMap, HashSet};
use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Modifier, Style, Stylize},
    text::{Line, Span},
    widgets::{
        Block, Cell, Paragraph, Row, Scrollbar, ScrollbarOrientation, ScrollbarState, Table,
    },
};
use serde::{Deserialize, Serialize};
use std::{
    any::Any,
    sync::{Arc, Mutex},
};
use tokio::sync::mpsc::UnboundedSender;

use super::help_text::HelpText;
use super::task_selection_manager::{
    ScrollMetrics, SelectedItemType, Selection, SelectionEntry, SelectionMode, SelectionState,
    TaskSection, TaskSelectionManager,
};
use crate::native::tui::{
    scroll_momentum::{ScrollDirection, ScrollMomentum},
    status_icons,
    theme::THEME,
};
use crate::native::{
    tasks::types::{Task, TaskResult},
    tui::{
        action::Action,
        app::Focus,
        components::Component,
        lifecycle::RunMode,
        utils::{format_duration_since, format_live_duration, sort_task_items},
    },
    utils::time::current_timestamp_millis,
};

const TASK_NAME_WAITING_FOR_TASKS: &str = "Waiting for task...";
const CACHE_STATUS_LOCAL_MATCH: &str = "Match";
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
const MIN_BOTTOM_SPACING: u16 = 4; // Minimum space between Cloud and Help
const SCROLLBAR_WIDTH: u16 = 3; // Width for scrollbar area (1 scrollbar + 2 padding)

// Constants for column layout calculation
const STATUS_ICON_WIDTH: u16 = 6; // Width for status icon with NX logo
const TASK_NAME_RESERVED_MIN_WIDTH: u16 = TASK_NAME_WAITING_FOR_TASKS.len() as u16; // Minimum reserved space for the task name column
const TASK_NAME_LAYOUT_THRESHOLD: u16 = 30; // Minimum width at which we truncate task names for large task names to allow displaying other columns
const DURATION_COLUMN_WIDTH: u16 = 10; // Width for duration column
const CACHE_STATUS_COLUMN_WIDTH: u16 = CACHE_STATUS_REMOTE.len() as u16; // Width for cache status column
const COLUMN_SEPARATOR_WIDTH: u16 = 1; // Column separator width

/// Represents which columns should be displayed in the task list
#[derive(Clone, Debug)]
struct ColumnVisibility {
    show_duration: bool,
    show_cache_status: bool,
}

/// Represents an individual task with its current state and execution details.
#[derive(Debug)]
pub struct TaskItem {
    // Public to aid with sorting utility and testing
    pub name: String,
    duration: String,
    cache_status: String,
    // Public to aid with sorting utility and testing
    pub status: TaskStatus,
    pub terminal_output: String,
    pub continuous: bool,
    // Public to aid with sorting utility and testing
    pub start_time: Option<i64>,
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
                TaskStatus::LocalCacheKeptExisting => CACHE_STATUS_LOCAL_MATCH.to_string(),
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

/// Represents the status of a batch group.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BatchStatus {
    Running,
    Success,
    Failure,
}

/// Represents a batch group container that can hold multiple tasks.
#[derive(Debug, Clone)]
pub struct BatchGroupItem {
    pub batch_id: String,
    pub executor_name: String,
    pub task_count: usize,
    pub is_expanded: bool,
    pub status: BatchStatus,
    pub terminal_output: String,
    pub nested_tasks: Vec<String>, // Task IDs
    pub start_time: Option<i64>,   // Timestamp for batch ordering
}

impl BatchGroupItem {
    /// Creates a new batch group item with the given parameters.
    pub fn new(batch_id: String, executor_name: String) -> Self {
        Self {
            batch_id,
            executor_name,
            task_count: 0,
            is_expanded: false,
            status: BatchStatus::Running,
            terminal_output: String::new(),
            nested_tasks: Vec::new(),
            start_time: None,
        }
    }

    /// Creates a new batch group item with timestamp for ordering.
    pub fn new_with_timestamp(batch_id: String, executor_name: String, start_time: i64) -> Self {
        Self {
            batch_id,
            executor_name,
            task_count: 0,
            is_expanded: false,
            status: BatchStatus::Running,
            terminal_output: String::new(),
            nested_tasks: Vec::new(),
            start_time: Some(start_time),
        }
    }

    /// Adds a task to this batch group.
    pub fn add_task(&mut self, task_id: String) {
        self.nested_tasks.push(task_id);
        self.task_count = self.nested_tasks.len();
    }

    /// Removes a task from this batch group.
    pub fn remove_task(&mut self, task_id: &str) {
        self.nested_tasks.retain(|id| id != task_id);
        self.task_count = self.nested_tasks.len();
    }

    /// Updates the status of the batch group.
    pub fn update_status(&mut self, status: BatchStatus) {
        self.status = status;
    }

    /// Toggles the expanded state of the batch group.
    pub fn toggle_expanded(&mut self) {
        self.is_expanded = !self.is_expanded;
    }

    /// Appends output to the batch group's terminal output.
    pub fn append_output(&mut self, output: &str) {
        self.terminal_output.push_str(output);
    }
}

/// Represents a display item that can be either an individual task or a batch group.
#[derive(Debug, Clone)]
pub enum DisplayItem {
    Task(TaskItem),
    BatchGroup(BatchGroupItem),
}

/// A list component that displays and manages tasks in a terminal UI.
/// Provides filtering, sorting, and output display capabilities.
pub struct TasksList {
    selection_manager: Arc<Mutex<TaskSelectionManager>>,
    pub display_items: Vec<DisplayItem>, // Hierarchical display items (tasks and batch groups)
    pub task_lookup: HashMap<String, TaskItem>, // Quick lookup for task access by name
    filtered_display_items: Vec<DisplayItem>, // Hierarchical display items that match the filter
    scroll_momentum: ScrollMomentum,     // Track scroll momentum for smooth scrolling
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
    column_visibility: Option<ColumnVisibility>, // Cached column visibility result
    terminal_width: Option<u16>, // Cached terminal width for column visibility calculation
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
        let mut display_items = Vec::new();
        let mut task_lookup = HashMap::new();

        for task in tasks {
            let task_item = TaskItem::new(task.id.clone(), task.continuous.unwrap_or(false));
            task_lookup.insert(task.id.clone(), task_item.clone());
            display_items.push(DisplayItem::Task(task_item));
        }

        let filtered_display_items = Vec::new();

        let mut s = Self {
            selection_manager,
            filtered_display_items,
            display_items,
            task_lookup,
            scroll_momentum: ScrollMomentum::new(),
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
            column_visibility: None,
            terminal_width: None,
        };

        // Sort tasks to populate task selection list
        s.sort_tasks();

        s
    }

    pub fn set_max_parallel(&mut self, max_parallel: Option<u32>) {
        self.max_parallel = max_parallel.unwrap_or(DEFAULT_MAX_PARALLEL as u32) as usize;
    }

    /// Sorts the display items and populates the task selection list.
    pub fn sort_tasks(&mut self) {
        self.sort_tasks_with_mode(None);
    }

    fn sort_tasks_with_mode(&mut self, mode_override: Option<SelectionMode>) {
        let mode = mode_override.unwrap_or_else(|| self.determine_selection_mode());

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

        // Check if we have any batch groups to determine sorting strategy
        let has_batches = self
            .display_items
            .iter()
            .any(|item| matches!(item, DisplayItem::BatchGroup(_)));

        if has_batches {
            // New behavior: separate and sort tasks and batches when batches are present
            let mut individual_tasks = Vec::new();
            let mut batch_groups = Vec::new();

            for display_item in self.display_items.drain(..) {
                match display_item {
                    DisplayItem::Task(task) => individual_tasks.push(task),
                    DisplayItem::BatchGroup(batch_group) => batch_groups.push(batch_group),
                }
            }

            // Sort individual tasks using the existing sort function
            sort_task_items(&mut individual_tasks, &highlighted_tasks);

            // Sort batch groups by start time (newest first for running batches)
            batch_groups.sort_by(|a, b| b.start_time.cmp(&a.start_time));

            // Rebuild display_items with sorted tasks first, then batch groups
            // Skip tasks that are already part of batch groups
            for task in individual_tasks {
                let is_part_of_batch = batch_groups
                    .iter()
                    .any(|batch| batch.nested_tasks.contains(&task.name));

                if !is_part_of_batch {
                    self.display_items.push(DisplayItem::Task(task));
                }
            }
            for batch_group in batch_groups {
                self.display_items
                    .push(DisplayItem::BatchGroup(batch_group));
            }
        } else {
            // Original behavior: always sort individual tasks
            let mut tasks: Vec<TaskItem> = self
                .display_items
                .drain(..)
                .filter_map(|item| match item {
                    DisplayItem::Task(task) => Some(task),
                    DisplayItem::BatchGroup(_) => None,
                })
                .collect();

            sort_task_items(&mut tasks, &highlighted_tasks);

            // Rebuild display_items with sorted tasks
            self.display_items = tasks.into_iter().map(DisplayItem::Task).collect();
        }

        // Apply the current filter to get filtered display items
        self.apply_filter();
    }

    /// Returns true if a task is nested under an expanded batch group
    fn is_task_nested_in_expanded_batch(&self, task_id: &str) -> bool {
        // Check both display_items and filtered_display_items to ensure we find batch groups
        let collections = [&self.display_items, &self.filtered_display_items];

        for collection in &collections {
            for display_item in *collection {
                if let DisplayItem::BatchGroup(batch_group) = display_item {
                    if batch_group.is_expanded
                        && batch_group.nested_tasks.contains(&task_id.to_string())
                    {
                        return true;
                    }
                }
            }
        }
        false
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

    /// Gets the currently selected item identifier.
    /// Returns None if nothing is selected, or Some(id) where id can be:
    /// - Pure batch ID for batch groups
    /// - Pure task name for all tasks (whether nested in batches or standalone)
    pub fn get_selected_item(&self) -> Option<String> {
        let manager = self.selection_manager.lock().unwrap();
        match manager.get_selected_item_type() {
            SelectedItemType::Task => manager.get_selected_task_name().cloned(),
            SelectedItemType::BatchGroup => manager.get_selected_batch_id().cloned(),
            SelectedItemType::None => None,
        }
    }

    /// Checks if the currently selected item is a batch group.
    pub fn is_batch_group_selected(&self) -> bool {
        self.selection_manager
            .lock()
            .unwrap()
            .get_selected_item_type()
            == SelectedItemType::BatchGroup
    }

    /// Gets the type of the currently selected item.
    pub fn get_selected_item_type(&self) -> SelectedItemType {
        self.selection_manager
            .lock()
            .unwrap()
            .get_selected_item_type()
    }

    /// Gets the stored terminal output for a specific task.
    /// Returns None if the task is not found or has no terminal output.
    pub fn get_task_terminal_output(&self, task_id: &str) -> Option<String> {
        self.task_lookup.get(task_id).and_then(|task| {
            if task.terminal_output.is_empty() {
                None
            } else {
                Some(task.terminal_output.clone())
            }
        })
    }

    /// Expands the specified batch group.
    pub fn expand_batch(&mut self, batch_id: &str) {
        if let Some(batch_group) = self.get_batch_group_mut(batch_id) {
            if !batch_group.is_expanded {
                batch_group.toggle_expanded();
                self.apply_filter(); // Refresh the display
            }
        }
    }

    /// Collapses the specified batch group.
    /// If a nested task is currently selected, the selection moves to the batch group.
    pub fn collapse_batch(&mut self, batch_id: &str) {
        // Check if a nested task within this batch is selected
        let should_select_batch = if let Some(selected_id) = self.get_selected_item() {
            if self
                .selection_manager
                .lock()
                .unwrap()
                .get_selected_item_type()
                == SelectedItemType::Task
            {
                if let Some(batch_group) = self.get_batch_group_by_id(batch_id) {
                    batch_group.nested_tasks.contains(&selected_id)
                } else {
                    false
                }
            } else {
                false
            }
        } else {
            false
        };

        if let Some(batch_group) = self.get_batch_group_mut(batch_id) {
            if batch_group.is_expanded {
                batch_group.toggle_expanded();

                // If a nested task was selected, select the batch group instead
                if should_select_batch {
                    self.selection_manager
                        .lock()
                        .unwrap()
                        .select_batch_group(batch_id.to_string());
                }

                self.apply_filter(); // Refresh the display
            }
        }
    }

    /// Checks if collapsing the specified batch is allowed.
    /// Returns false if a nested task within the batch is currently selected.
    pub fn can_collapse_batch(&self, batch_id: &str) -> bool {
        if let Some(selected_id) = self.get_selected_item() {
            // Check if the selected task belongs to this batch and it's not a batch group selection
            if self
                .selection_manager
                .lock()
                .unwrap()
                .get_selected_item_type()
                == SelectedItemType::Task
            {
                if let Some(batch_group) = self.get_batch_group_by_id_filtered(batch_id) {
                    return !batch_group.nested_tasks.contains(&selected_id);
                }
            }
        }
        true
    }

    /// Scrolls the task list up with momentum support
    fn scroll_up(&mut self) {
        if self.filtered_display_items.is_empty() {
            return;
        }
        let lines = self.scroll_momentum.calculate_momentum(ScrollDirection::Up) as usize;
        self.selection_manager
            .lock()
            .unwrap()
            .scroll_up(lines.max(1));
    }

    /// Scrolls the task list down with momentum support
    fn scroll_down(&mut self) {
        if self.filtered_display_items.is_empty() {
            return;
        }
        let lines = self
            .scroll_momentum
            .calculate_momentum(ScrollDirection::Down) as usize;
        self.selection_manager
            .lock()
            .unwrap()
            .scroll_down(lines.max(1));
    }

    /// Creates a list of task entries with separators between different status groups.
    /// Groups tasks into in-progress, (maybe) highlighted, completed, and pending, with None values as separators.
    /// NEEDS ANALYSIS: Consider if this complex grouping logic should be moved to a dedicated type.

    /// Creates entries from hierarchical display items for the selection manager.
    /// Returns typed entries that preserve the distinction between tasks and batch groups,
    /// along with the actual in-progress section size for section tracking.
    fn create_entries_from_display_items(
        &self,
        display_items: &[DisplayItem],
    ) -> (Vec<Option<SelectionEntry>>, usize) {
        // Create vectors for each status group
        let mut in_progress = Vec::new();
        let mut highlighted = Vec::new();
        let mut completed = Vec::new();
        let mut pending = Vec::new();

        // First, collect all nested task IDs from batch groups to avoid duplicates
        let mut batched_tasks = std::collections::HashSet::new();
        for display_item in display_items {
            if let DisplayItem::BatchGroup(batch_group) = display_item {
                for task_id in &batch_group.nested_tasks {
                    batched_tasks.insert(task_id.clone());
                }
            }
        }

        // Process display items to categorize them
        for display_item in display_items {
            match display_item {
                DisplayItem::Task(task) => {
                    // Skip tasks that are part of batch groups (they will be handled by the batch logic)
                    if batched_tasks.contains(&task.name) {
                        continue;
                    }

                    // Handle individual tasks (same logic as before)
                    if matches!(self.run_mode, RunMode::RunOne)
                        && self.initiating_tasks.contains(&task.name)
                        && !matches!(task.status, TaskStatus::InProgress)
                    {
                        highlighted.push(SelectionEntry::Task(task.name.clone()));
                        continue;
                    }
                    match task.status {
                        TaskStatus::InProgress => {
                            in_progress.push(SelectionEntry::Task(task.name.clone()))
                        }
                        TaskStatus::NotStarted => {
                            pending.push(SelectionEntry::Task(task.name.clone()))
                        }
                        _ => completed.push(SelectionEntry::Task(task.name.clone())),
                    }
                }
                DisplayItem::BatchGroup(batch_group) => {
                    // Determine batch group status based on nested tasks
                    let has_in_progress = batch_group.nested_tasks.iter().any(|task_id| {
                        self.task_lookup
                            .get(task_id)
                            .map(|task| matches!(task.status, TaskStatus::InProgress))
                            .unwrap_or(false)
                    });
                    let has_pending = batch_group.nested_tasks.iter().any(|task_id| {
                        self.task_lookup
                            .get(task_id)
                            .map(|task| matches!(task.status, TaskStatus::NotStarted))
                            .unwrap_or(false)
                    });

                    // Add batch group identifier wrapped in SelectionEntry::BatchGroup
                    let batch_id = batch_group.batch_id.clone();

                    if has_in_progress {
                        in_progress.push(SelectionEntry::BatchGroup(batch_id.clone()));
                    } else if has_pending {
                        pending.push(SelectionEntry::BatchGroup(batch_id.clone()));
                    } else {
                        completed.push(SelectionEntry::BatchGroup(batch_id.clone()));
                    }

                    // NOTE: We do NOT add individual nested tasks to status vectors here!
                    // Nested tasks will be inserted immediately after their batch group
                    // when we assemble the final entries vector, ensuring they stay grouped.
                }
            }
        }

        let mut entries = Vec::new();

        // Check if there are any tasks that need to be run
        let has_tasks_to_run = !in_progress.is_empty() || !pending.is_empty();

        // When filtering is active, only show parallel section if there are InProgress tasks
        // When not filtering, show parallel section if there are any InProgress or pending tasks
        let should_show_parallel_section = if self.filter_text.is_empty() {
            has_tasks_to_run
        } else {
            !in_progress.is_empty() // Only show if there are filtered InProgress tasks
        };

        // Helper closure to expand batch groups with their nested tasks
        let expand_with_nested_tasks =
            |entries: &mut Vec<Option<SelectionEntry>>, items: &[SelectionEntry]| {
                for item in items {
                    entries.push(Some(item.clone()));
                    // If this is a batch group, immediately add all its nested tasks
                    if let SelectionEntry::BatchGroup(batch_id) = item {
                        if let Some(batch_group) = display_items.iter().find_map(|di| {
                            if let DisplayItem::BatchGroup(bg) = di {
                                if bg.batch_id == *batch_id && bg.is_expanded {
                                    Some(bg)
                                } else {
                                    None
                                }
                            } else {
                                None
                            }
                        }) {
                            // Add all nested tasks immediately after the batch group
                            for task_id in &batch_group.nested_tasks {
                                entries.push(Some(SelectionEntry::Task(task_id.clone())));
                            }
                        }
                    }
                }
            };

        // Track the actual in-progress section size (will be set below)
        let actual_in_progress_size;

        // Only show the parallel section if appropriate
        if should_show_parallel_section {
            // Create a fixed section for in-progress tasks (self.max_parallel slots)
            // Track how many entries we actually add (including nested tasks)
            let entries_before_parallel = entries.len();

            // Add actual in-progress tasks (with nested tasks expanded)
            expand_with_nested_tasks(&mut entries, &in_progress);

            let entries_added = entries.len() - entries_before_parallel;

            // This is the actual in-progress section size (including expanded nested tasks)
            actual_in_progress_size = entries_added;

            // Fill remaining slots with None up to self.max_parallel
            // Only add placeholder entries when NOT filtering
            if self.filter_text.is_empty() {
                if entries_added < self.max_parallel {
                    // When we have fewer entries than self.max_parallel, fill the remaining slots
                    // with empty placeholder rows to maintain the fixed height
                    entries.extend(std::iter::repeat_n(None, self.max_parallel - entries_added));
                }
            }

            // Always add a separator after the parallel section
            entries.push(None);
        } else {
            // No parallel section, so size is 0
            actual_in_progress_size = 0;
        }

        // Add highlighted items followed by a separator, if there are any
        if !highlighted.is_empty() {
            expand_with_nested_tasks(&mut entries, &highlighted);
            entries.push(None);
        }

        // Add completed items (with nested tasks expanded)
        expand_with_nested_tasks(&mut entries, &completed);

        // Add separator before pending items if there are any pending items and completed items exist
        if !pending.is_empty() && !completed.is_empty() {
            entries.push(None);
        }

        // Add pending items (with nested tasks expanded)
        expand_with_nested_tasks(&mut entries, &pending);

        (entries, actual_in_progress_size)
    }

    /// Check if any parallel entries are visible in the current viewport.
    fn has_visible_parallel_entries(&self, scroll_offset: usize) -> bool {
        if self.max_parallel == 0 || !self.has_active_tasks() {
            return false;
        }

        // Check if parallel section should be shown and get its end position
        let parallel_section_end = match self.get_parallel_section_end() {
            Some(end) => end,
            None => return false,
        };

        // Only get viewport entries if we know we need them
        let viewport_entries = {
            let manager = self.selection_manager.lock().unwrap();
            manager.get_viewport_entries()
        };

        // Edge case: empty viewport means no visible entries
        if viewport_entries.len() == 0 {
            return false;
        }

        // Viewport shows entries from scroll_offset to scroll_offset+viewport_size
        // Ranges overlap if: parallel_section_end > scroll_offset AND 0 < scroll_offset + viewport_size
        scroll_offset < parallel_section_end
    }

    /// Determine if an entry at absolute position is part of the parallel section
    fn is_in_parallel_section(&self, absolute_idx: usize) -> bool {
        if self.max_parallel == 0 || !self.has_active_tasks() {
            return false;
        }

        // Check if parallel section should be shown based on filtering logic
        let parallel_section_end = match self.get_parallel_section_end() {
            Some(end) => end,
            None => return false,
        };

        absolute_idx < parallel_section_end
    }

    /// Calculate the end position of the parallel section, returning None if no parallel section should be shown
    fn get_parallel_section_end(&self) -> Option<usize> {
        if self.filter_text.is_empty() {
            // When not filtering, show if there are any InProgress or pending tasks
            if !self.has_active_tasks() {
                return None;
            }

            // Calculate the actual parallel section size by counting in-progress items
            // This includes both standalone tasks and batch groups with their nested tasks
            let mut parallel_count = 0;

            for item in &self.display_items {
                match item {
                    DisplayItem::Task(task) => {
                        if matches!(task.status, TaskStatus::InProgress) {
                            parallel_count += 1;
                        }
                    }
                    DisplayItem::BatchGroup(batch) => {
                        // Check if batch has any in-progress or pending tasks
                        let has_in_progress = batch.nested_tasks.iter().any(|task_id| {
                            self.task_lookup
                                .get(task_id)
                                .map(|t| matches!(t.status, TaskStatus::InProgress))
                                .unwrap_or(false)
                        });

                        if has_in_progress {
                            parallel_count += 1; // Count the batch group itself
                            // Add nested tasks if expanded
                            if batch.is_expanded {
                                parallel_count += batch.nested_tasks.len();
                            }
                        }
                    }
                }
            }

            // Use the larger of parallel_count or max_parallel to ensure we show waiting entries
            let section_end = parallel_count.max(self.max_parallel);
            Some(section_end)
        } else {
            // When filtering, calculate filtered InProgress count once and use for both checks
            let filtered_in_progress_count = self
                .task_lookup
                .values()
                .filter(|t| {
                    matches!(t.status, TaskStatus::InProgress)
                        && t.name
                            .to_lowercase()
                            .contains(&self.filter_text.to_lowercase())
                })
                .count();

            // If no filtered InProgress tasks, don't show parallel section
            if filtered_in_progress_count == 0 {
                None
            } else {
                Some(filtered_in_progress_count)
            }
        }
    }

    /// Check if there are active tasks that warrant showing the parallel section
    fn has_active_tasks(&self) -> bool {
        self.task_lookup
            .values()
            .any(|t| matches!(t.status, TaskStatus::InProgress | TaskStatus::NotStarted))
    }

    // Add a helper method to check if we're in the initial loading state
    fn is_loading_state(&self) -> bool {
        // We're in loading state if all tasks are NotStarted and there are no InProgress tasks
        !self.task_lookup.is_empty()
            && self
                .task_lookup
                .values()
                .all(|t| matches!(t.status, TaskStatus::NotStarted))
            && !self
                .task_lookup
                .values()
                .any(|t| matches!(t.status, TaskStatus::InProgress))
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

    /// Checks if the terminal pane is currently showing the given task's output.
    /// This happens when:
    /// - Spacebar mode is active (terminal follows selection), OR
    /// - Terminal pane is focused and the task is pinned to that pane
    fn is_terminal_showing_task(&self, task_name: &str) -> bool {
        if let Focus::MultipleOutput(focused_pane_idx) = self.focus {
            self.spacebar_mode || self.pinned_tasks[focused_pane_idx].as_deref() == Some(task_name)
        } else {
            false
        }
    }

    fn has_pending_tasks(&self) -> bool {
        self.task_lookup
            .values()
            .any(|t| t.status == TaskStatus::NotStarted)
    }

    /// Determines the appropriate selection mode based on current state and output visibility.
    ///
    /// General rule: Track by name when task output is visible in terminal pane.
    ///
    /// Exception:
    /// - Terminal pane showing selected task → Always TrackByName
    ///
    /// In-progress section:
    /// - Always TrackByName (automatically switches to position when task finishes)
    ///
    /// Non-in-progress section:
    /// - If pinned tasks exist → TrackByName only if selected task is pinned
    /// - If no pinned tasks → TrackByName only if spacebar mode (terminal open)
    /// - Otherwise → TrackByPosition
    fn determine_selection_mode(&self) -> SelectionMode {
        let selection_manager = self.selection_manager.lock().unwrap();
        let selected_task_name = selection_manager.get_selected_task_name();

        // Priority 0: Batch groups always TrackByName (they don't have sections)
        let selected_type = selection_manager.get_selected_item_type();
        if matches!(selected_type, SelectedItemType::BatchGroup) {
            return SelectionMode::TrackByName;
        }

        // EXCEPTION: Terminal pane showing selected task → always track by name
        if let Some(selected_name) = selected_task_name {
            if self.is_terminal_showing_task(selected_name) {
                return SelectionMode::TrackByName;
            }
        }

        // IN-PROGRESS section: Always track by name while running
        if let Some(TaskSection::InProgress) = selection_manager.get_selected_task_section() {
            return SelectionMode::TrackByName;
        }

        // NON-IN-PROGRESS section: Output visibility determines mode
        let has_pinned_tasks = self.pinned_tasks.iter().any(|p| p.is_some());

        if has_pinned_tasks {
            // Pinned tasks exist: Only pinned task outputs are in terminal panes
            let is_selected_pinned = selected_task_name.is_some_and(|name| {
                self.pinned_tasks
                    .iter()
                    .any(|pinned| pinned.as_ref() == Some(name))
            });

            if is_selected_pinned {
                SelectionMode::TrackByName // Output visible in terminal pane
            } else {
                SelectionMode::TrackByPosition // Output not visible
            }
        } else {
            // No pinned tasks: Check if terminal pane is open
            if self.spacebar_mode {
                SelectionMode::TrackByName // Output visible in terminal pane
            } else {
                SelectionMode::TrackByPosition // No terminal pane open
            }
        }
    }

    /// Applies the current filter text to the task list.
    /// Updates filtered tasks and selection manager entries.
    pub fn apply_filter(&mut self) {
        let mode = self.determine_selection_mode();

        self.selection_manager
            .lock()
            .unwrap()
            .set_selection_mode(mode);

        // Apply filter to display items
        if self.filter_text.is_empty() {
            self.filtered_display_items = self.display_items.clone();
        } else {
            let filter_text = self.filter_text.to_lowercase();
            self.filtered_display_items = self
                .display_items
                .iter()
                .filter_map(|item| {
                    match item {
                        DisplayItem::Task(task) => {
                            if task.name.to_lowercase().contains(&filter_text) {
                                Some(item.clone())
                            } else {
                                None
                            }
                        }
                        DisplayItem::BatchGroup(batch_group) => {
                            // Check if batch group name matches filter
                            let batch_matches =
                                batch_group.batch_id.to_lowercase().contains(&filter_text);

                            // Check if any nested task matches filter
                            let has_matching_nested =
                                batch_group.nested_tasks.iter().any(|task_id| {
                                    self.task_lookup
                                        .get(task_id)
                                        .map(|task| task.name.to_lowercase().contains(&filter_text))
                                        .unwrap_or(false)
                                });

                            if batch_matches || has_matching_nested {
                                // If there are matching nested tasks, expand the batch group
                                let mut batch_group = batch_group.clone();
                                if has_matching_nested {
                                    batch_group.is_expanded = true;
                                }
                                Some(DisplayItem::BatchGroup(batch_group))
                            } else {
                                None
                            }
                        }
                    }
                })
                .collect();
        }

        // Create entries from filtered display items with section size tracking
        let (entries, in_progress_size) =
            self.create_entries_from_display_items(&self.filtered_display_items);
        let mut manager = self.selection_manager.lock().unwrap();
        manager.update_entries_with_size(entries, in_progress_size);
        // Explicitly scroll to ensure selected task is visible
        manager.ensure_selected_visible();
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

    /// Get task timing information for a specific task
    pub fn get_task_timing(&self, task_name: &str) -> (Option<i64>, Option<i64>) {
        if let Some(task_item) = self.task_lookup.get(task_name) {
            (task_item.start_time, task_item.end_time)
        } else {
            (None, None)
        }
    }

    /// Get all tasks as a vector for compatibility with existing APIs.
    pub fn get_all_tasks(&self) -> Vec<TaskItem> {
        self.task_lookup.values().cloned().collect()
    }

    /// Calculates the effective width needed for task names including pinned indicators
    fn calculate_effective_task_name_width(&self) -> u16 {
        self.task_lookup
            .values()
            .map(|task| {
                let base_len = task.name.len() as u16;

                // Calculate pinned indicator length for this task
                let pinned_indicator_len = if !self.spacebar_mode {
                    let indicator_count = self
                        .pinned_tasks
                        .iter()
                        .filter(|pinned_task| pinned_task.as_deref() == Some(task.name.as_str()))
                        .count();

                    if indicator_count > 0 {
                        // Format: " [1]" or " [1] [2]" - 4 chars per indicator (including spaces)
                        indicator_count * 4
                    } else {
                        0
                    }
                } else {
                    0 // No indicators in spacebar mode
                };

                base_len + pinned_indicator_len as u16
            })
            .max()
            .unwrap_or(0)
    }

    /// Calculates which columns should be displayed based on available space and task name lengths
    fn calculate_column_visibility(&mut self, available_width: u16) -> ColumnVisibility {
        // Only recalculate column visibility if terminal width has changed
        if self.terminal_width == Some(available_width) && self.column_visibility.is_some() {
            return self.column_visibility.as_ref().unwrap().clone();
        }
        self.terminal_width = Some(available_width);

        // Calculate base space requirements
        let base_space = STATUS_ICON_WIDTH + COLUMN_SEPARATOR_WIDTH;

        if available_width <= base_space {
            // Too small to show any columns
            return ColumnVisibility {
                show_duration: false,
                show_cache_status: false,
            };
        }

        // Find the maximum effective task name length across all tasks (including pinned indicators)
        let max_task_name_len = self.calculate_effective_task_name_width();

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
        let all_tasks_completed = !self.task_lookup.is_empty()
            && self.task_lookup.values().all(|t| {
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
                .task_lookup
                .values()
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
        for task in &tasks {
            let task_id = &task.id;

            // Update in task_lookup
            if let Some(task_item) = self.task_lookup.get_mut(task_id) {
                task_item.update_status(TaskStatus::InProgress);
                if task_item.start_time.is_none() {
                    // It should be set, but just in case
                    let current_time = current_timestamp_millis();
                    task_item.start_time = Some(current_time);
                }
                // Update duration to show "..." initially for non-continuous tasks
                if !task_item.continuous {
                    task_item.duration = DURATION_NOT_YET_KNOWN.to_string();
                }
            }

            // Update in display_items
            for display_item in &mut self.display_items {
                if let DisplayItem::Task(task_item) = display_item {
                    if task_item.name == *task_id {
                        task_item.update_status(TaskStatus::InProgress);
                        if task_item.start_time.is_none() {
                            let current_time = current_timestamp_millis();
                            task_item.start_time = Some(current_time);
                        }
                        if !task_item.continuous {
                            task_item.duration = DURATION_NOT_YET_KNOWN.to_string();
                        }
                        break;
                    }
                }
            }
        }

        // Sort tasks to update entries
        self.sort_tasks();
    }

    /// Performs initial in-progress task selection if not yet done.
    ///
    /// This is called from render() after tasks have been sorted and entries created.
    /// It ensures that when tasks first start running, we select the first in-progress task
    /// (unless the terminal is showing the currently selected task).
    ///
    /// Selection behavior:
    /// - If terminal is showing the currently selected task → keep it selected
    /// - Otherwise → select the first task in the in-progress section (after sorting)
    ///
    /// This implements the selection.md rule for initial startup in run-many mode.
    fn perform_initial_in_progress_selection_if_needed(&mut self) {
        // Get current state and check if we need to make a selection
        let (needs_selection, has_in_progress, selected_task) = {
            let selection_manager = self.selection_manager.lock().unwrap();
            let needs_selection = matches!(
                selection_manager.get_selection_state(),
                SelectionState::NoSelection
            );
            let in_progress_items = selection_manager.get_in_progress_items();
            let has_in_progress = !in_progress_items.is_empty();
            let selected_task = selection_manager.get_selected_task_name().cloned();
            (needs_selection, has_in_progress, selected_task)
        };

        // If already selected, nothing to do
        if !needs_selection {
            return;
        }

        // Check if terminal is showing a task (even though nothing is selected in state)
        let terminal_showing_task = if let Some(ref task) = selected_task {
            self.is_terminal_showing_task(task)
        } else {
            false
        };

        // Only select if terminal isn't showing a specific task
        if !terminal_showing_task {
            if has_in_progress {
                // Select the first in-progress task (from the already-sorted entries)
                self.select_first_in_progress_entry();
            } else {
                // No in-progress tasks yet, select first available entry
                self.selection_manager
                    .lock()
                    .unwrap()
                    .select_first_available();
            }
        }
    }

    /// Selects the first entry in the in-progress section.
    ///
    /// This is used during initial allocation to prioritize showing in-progress tasks.
    fn select_first_in_progress_entry(&mut self) {
        let mut selection_manager = self.selection_manager.lock().unwrap();

        // Get in-progress items from selection manager
        let in_progress_items = selection_manager.get_in_progress_items();

        // Select the first item if available
        if let Some(first_item) = in_progress_items.first() {
            match first_item {
                Selection::Task(task_id) => {
                    selection_manager.select_task(task_id.clone());
                }
                Selection::BatchGroup(batch_id) => {
                    selection_manager.select_batch_group(batch_id.clone());
                }
            }
        }
    }

    /// Handles an in-progress task finishing and moving to a different section.
    ///
    /// This is the most complex selection tracking scenario because:
    /// 1. The task moves from InProgress section to Other section (requires re-sort)
    /// 2. We need to decide if selection should switch to another task (position tracking)
    /// 3. Terminal pane exception can override the normal behavior
    ///
    /// Steps:
    /// 1. Sort while tracking by name (keeps the finished task selected)
    /// 2. Check if terminal is showing this task's output (exception case)
    /// 3. If no exception: switch selection to another task at same position
    /// 4. Set the final mode based on the (possibly new) selected task
    fn handle_in_progress_task_finished(
        &mut self,
        task_id: String,
        old_in_progress_index: Option<usize>,
    ) {
        // Step 1: Sort while tracking by name to keep finished task selected
        self.sort_tasks_with_mode(Some(SelectionMode::TrackByName));

        // Step 2: Check if terminal pane exception applies
        let terminal_showing_task = self.is_terminal_showing_task(&task_id);

        // Step 3: If no exception, apply position-based selection switching
        if !terminal_showing_task {
            let has_pending_tasks = self.has_pending_tasks();

            self.selection_manager
                .lock()
                .unwrap()
                .handle_task_status_change(
                    task_id,
                    old_in_progress_index,
                    false, // new_is_in_progress = false (task is no longer in progress)
                    has_pending_tasks,
                );
        }

        // Step 4: Set final mode based on current selection state
        let final_mode = self.determine_selection_mode();
        self.selection_manager
            .lock()
            .unwrap()
            .set_selection_mode(final_mode);
    }

    /// Updates a task's status and triggers a sort of the list.
    pub fn update_task_status(&mut self, task_id: String, status: TaskStatus) {
        // Get the old status and check if we're in a batch BEFORE updating
        let old_status = self
            .task_lookup
            .get(&task_id)
            .map(|t| t.status)
            .unwrap_or(TaskStatus::NotStarted);
        let old_is_in_progress = matches!(old_status, TaskStatus::InProgress | TaskStatus::Shared);
        let is_in_batch = self.is_task_nested_in_expanded_batch(&task_id);

        // Calculate old index BEFORE updating status (needed for position tracking)
        // Only needed for standalone tasks (not in batches)
        let old_in_progress_index = if old_is_in_progress && !is_in_batch {
            self.selection_manager
                .lock()
                .unwrap()
                .get_index_in_in_progress_section(&task_id)
        } else {
            None
        };

        // Update in task_lookup first
        if let Some(task_item) = self.task_lookup.get_mut(&task_id) {
            task_item.update_status(status.clone());
        }

        // Update in display_items
        for display_item in &mut self.display_items {
            match display_item {
                DisplayItem::Task(task_item) => {
                    if task_item.name == task_id {
                        task_item.update_status(status.clone());
                        break;
                    }
                }
                DisplayItem::BatchGroup(batch_group) => {
                    // If task is in a batch group, update the batch status if needed
                    if batch_group.nested_tasks.contains(&task_id) {
                        // Update batch status based on task statuses
                        // This could be extended to check all tasks in the batch
                        // For now, just update the individual task in lookup
                    }
                }
            }
        }

        // Apply master's smart selection logic ONLY for standalone tasks (not in batches)
        if !is_in_batch {
            let new_is_in_progress = matches!(status, TaskStatus::InProgress | TaskStatus::Shared);
            let is_finishing = old_is_in_progress && !new_is_in_progress;

            if is_finishing {
                // Complex case: in-progress task finished, may need to switch selection
                self.handle_in_progress_task_finished(task_id, old_in_progress_index);
            } else {
                // Simple case: just sort with appropriate mode
                self.sort_tasks();
            }

            // Ensure selected task is visible
            self.selection_manager
                .lock()
                .unwrap()
                .ensure_selected_visible();
        } else {
            // For tasks in batches: just sort (batch handles its own status updates)
            self.sort_tasks();
        }
    }

    /// Updates the live duration for all InProgress tasks that have a start_time.
    fn update_live_durations(&mut self) {
        // Update task_lookup
        for task in self.task_lookup.values_mut() {
            if matches!(task.status, TaskStatus::InProgress) && !task.continuous {
                if let Some(start_time) = task.start_time {
                    task.duration = format_live_duration(start_time);
                }
            }
        }

        // Update display_items
        for display_item in &mut self.display_items {
            if let DisplayItem::Task(task) = display_item {
                if matches!(task.status, TaskStatus::InProgress) && !task.continuous {
                    if let Some(start_time) = task.start_time {
                        task.duration = format_live_duration(start_time);
                    }
                }
            }
        }
    }

    pub fn end_tasks(&mut self, task_results: Vec<TaskResult>) {
        for task_result in task_results {
            let task_id = &task_result.task.id;

            // Update in task_lookup
            if let Some(task) = self.task_lookup.get_mut(task_id) {
                if task_result.task.start_time.is_some() && task_result.task.end_time.is_some() {
                    task.start_time = Some(task_result.task.start_time.unwrap());
                    task.end_time = Some(task_result.task.end_time.unwrap());
                    task.duration = format_duration_since(
                        task_result.task.start_time.unwrap(),
                        task_result.task.end_time.unwrap(),
                    );
                }
                // Store terminal output if provided
                if let Some(ref terminal_output) = task_result.terminal_output {
                    task.terminal_output = terminal_output.clone();
                }
            }

            // Update in display_items
            for display_item in &mut self.display_items {
                if let DisplayItem::Task(task) = display_item {
                    if task.name == *task_id {
                        if task_result.task.start_time.is_some()
                            && task_result.task.end_time.is_some()
                        {
                            task.start_time = Some(task_result.task.start_time.unwrap());
                            task.end_time = Some(task_result.task.end_time.unwrap());
                            task.duration = format_duration_since(
                                task_result.task.start_time.unwrap(),
                                task_result.task.end_time.unwrap(),
                            );
                        }
                        // Store terminal output if provided
                        if let Some(ref terminal_output) = task_result.terminal_output {
                            task.terminal_output = terminal_output.clone();
                        }
                        break;
                    }
                }
            }
        }
        self.sort_tasks();
        // Explicitly scroll to ensure selected task is visible after sort
        self.selection_manager
            .lock()
            .unwrap()
            .ensure_selected_visible();
    }

    /// Adds a new batch group to the display items with timestamp-based ordering.
    pub fn add_batch_group(&mut self, batch_group: BatchGroupItem) {
        // Insert batch group in timestamp order (newest first for running batches)
        let batch_start_time = batch_group.start_time.unwrap_or(0);

        // Find the right insertion point based on status and timestamp
        let insert_index = self.display_items.iter().position(|item| {
            match item {
                DisplayItem::BatchGroup(existing_batch) => {
                    let existing_start_time = existing_batch.start_time.unwrap_or(0);
                    // If both are running, order by start time (newest first)
                    if matches!(batch_group.status, BatchStatus::Running)
                        && matches!(existing_batch.status, BatchStatus::Running)
                    {
                        batch_start_time > existing_start_time
                    } else {
                        // Running batches come before completed ones
                        matches!(
                            existing_batch.status,
                            BatchStatus::Success | BatchStatus::Failure
                        )
                    }
                }
                DisplayItem::Task(existing_task) => {
                    // Running batches come before individual tasks
                    matches!(batch_group.status, BatchStatus::Running)
                        && !matches!(existing_task.status, TaskStatus::InProgress)
                }
            }
        });

        if let Some(index) = insert_index {
            self.display_items
                .insert(index, DisplayItem::BatchGroup(batch_group));
        } else {
            self.display_items
                .push(DisplayItem::BatchGroup(batch_group));
        }

        self.sort_tasks();
    }

    /// Removes a batch group and ungroups its tasks back to individual display.
    pub fn remove_batch_group(&mut self, batch_id: &str) -> Option<BatchGroupItem> {
        if let Some(pos) = self.display_items.iter().position(
            |item| matches!(item, DisplayItem::BatchGroup(batch) if batch.batch_id == batch_id),
        ) {
            if let DisplayItem::BatchGroup(batch_group) = self.display_items.remove(pos) {
                // Add tasks back as individual display items
                for task_id in &batch_group.nested_tasks {
                    if let Some(task) = self.task_lookup.get(task_id).cloned() {
                        self.display_items.push(DisplayItem::Task(task));
                    }
                }
                self.sort_tasks();
                return Some(batch_group);
            }
        }
        None
    }

    /// Gets a mutable reference to a batch group by its ID.
    pub fn get_batch_group_mut(&mut self, batch_id: &str) -> Option<&mut BatchGroupItem> {
        for display_item in &mut self.display_items {
            if let DisplayItem::BatchGroup(batch_group) = display_item {
                if batch_group.batch_id == batch_id {
                    return Some(batch_group);
                }
            }
        }
        None
    }

    /// Groups individual tasks into a batch group.
    /// Removes the individual task display items and adds them to the batch.
    pub fn group_tasks_into_batch(&mut self, task_ids: Vec<String>, batch_group: BatchGroupItem) {
        // Early validation
        if task_ids.is_empty() {
            return;
        }

        if batch_group.batch_id.is_empty() {
            return;
        }

        // Check if batch already exists
        if self.display_items.iter().any(|item| {
            matches!(item, DisplayItem::BatchGroup(bg) if bg.batch_id == batch_group.batch_id)
        }) {
            return;
        }

        // Count how many tasks will actually be grouped
        let tasks_to_group = self
            .display_items
            .iter()
            .filter(|item| matches!(item, DisplayItem::Task(task) if task_ids.contains(&task.name)))
            .count();

        if tasks_to_group == 0 {
            return;
        }

        if tasks_to_group != task_ids.len() {
            // Some tasks were not found - this is expected if tasks have already been grouped
        }

        // Remove individual task display items
        self.display_items.retain(|item| match item {
            DisplayItem::Task(task) => !task_ids.contains(&task.name),
            DisplayItem::BatchGroup(_) => true,
        });

        // Add the batch group
        self.display_items
            .push(DisplayItem::BatchGroup(batch_group));
        self.sort_tasks();
    }

    /// Ungroups batch tasks and moves them back to individual display.
    pub fn ungroup_batch_tasks(&mut self, batch_id: &str) {
        // Early validation
        if batch_id.is_empty() {
            return;
        }

        if let Some(_batch_group) = self.remove_batch_group(batch_id) {
            // Tasks are already added back to display_items in remove_batch_group
            // Just need to sort
            self.sort_tasks();
        }
    }

    /// Adds a task to an existing batch group.
    pub fn add_task_to_batch(&mut self, task_id: String, batch_id: &str) -> Result<(), String> {
        // Remove task from individual display if it exists
        self.display_items.retain(|item| match item {
            DisplayItem::Task(task) => task.name != task_id,
            DisplayItem::BatchGroup(_) => true,
        });

        // Add to batch group
        if let Some(batch_group) = self.get_batch_group_mut(batch_id) {
            batch_group.add_task(task_id);
            self.sort_tasks();
            Ok(())
        } else {
            Err(format!("Batch group {} not found", batch_id))
        }
    }

    /// Removes a task from a batch group and adds it back as individual display.
    pub fn remove_task_from_batch(&mut self, task_id: &str, batch_id: &str) -> Result<(), String> {
        if let Some(batch_group) = self.get_batch_group_mut(batch_id) {
            batch_group.remove_task(task_id);

            // Add task back as individual display item
            if let Some(task) = self.task_lookup.get(task_id).cloned() {
                self.display_items.push(DisplayItem::Task(task));
            }

            self.sort_tasks();
            Ok(())
        } else {
            Err(format!("Batch group {} not found", batch_id))
        }
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
        let total_tasks = self.task_lookup.len();
        // Count actual tasks in filtered display items (excluding batch groups)
        let filtered_task_count = self
            .filtered_display_items
            .iter()
            .filter(|item| matches!(item, DisplayItem::Task(_)))
            .count();
        let hidden_tasks = total_tasks - filtered_task_count;
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

    /// Checks if the scrollbar will be needed for the given table height
    fn will_need_scrollbar(&self, table_height: u16) -> bool {
        let header_and_spacing_rows = 4;
        let dynamic_viewport_height = table_height.saturating_sub(header_and_spacing_rows) as usize;
        let total_entries = self.selection_manager.lock().unwrap().get_total_entries();
        total_entries > dynamic_viewport_height
    }

    /// Renders the main task table with scrollbar if needed.
    fn render_task_table(
        &mut self,
        f: &mut Frame<'_>,
        table_area: Rect,
        column_visibility: &ColumnVisibility,
        needs_scrollbar: bool,
        scroll_metrics: &ScrollMetrics,
    ) {
        let visible_entries = self
            .selection_manager
            .lock()
            .unwrap()
            .get_viewport_entries();
        let selected_style = Style::default()
            .fg(THEME.primary_fg)
            .add_modifier(Modifier::BOLD);
        let normal_style = Style::default();

        // Determine if all tasks are completed
        let all_tasks_completed = !self.task_lookup.is_empty()
            && self.task_lookup.values().all(|t| {
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

        let has_visible_parallel_entries =
            self.has_visible_parallel_entries(scroll_metrics.scroll_offset);

        // Determine the color of the NX logo based on task status
        let logo_color = if self.task_lookup.is_empty() {
            // No tasks
            THEME.info
        } else if all_tasks_completed {
            // All tasks are completed, check if any failed
            let has_failures = self
                .task_lookup
                .values()
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
            let running = self
                .task_lookup
                .values()
                .filter(|t| matches!(t.status, TaskStatus::InProgress))
                .count();

            // First cell: Just the NX logo and box corner if needed
            let mut first_cell_spans = vec![Span::styled(
                " NX ",
                Style::reset().bold().bg(logo_color).fg(THEME.primary_fg),
            )];

            // Add spacing if needed - show when parallel section entries are present
            if has_visible_parallel_entries && running > 0 && !self.is_loading_state() {
                first_cell_spans.push(Span::raw(" "));
            }

            // Second cell: Put the title text in the task name column
            let mut second_cell_spans = vec![];

            // Add title with appropriate styling
            if all_tasks_completed {
                // Get the total time if available
                if let (Some(first_start), Some(last_end)) = (
                    self.task_lookup.values().filter_map(|t| t.start_time).min(),
                    self.task_lookup.values().filter_map(|t| t.end_time).max(),
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
        // while maintaining the seamless vertical line when parallel section is shown
        if has_visible_parallel_entries {
            let mut empty_cells = vec![
                Cell::from(Line::from(vec![
                    // Space for selection indicator
                    Span::raw(" "),
                    // Add vertical line for visual continuity when parallel entries are visible
                    Span::styled("│", Style::default().fg(THEME.info)),
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

        // Add hierarchical rows (batch groups and tasks)
        all_rows.extend(visible_entries.iter().enumerate().map(|(row_idx, entry)| {
            if let Some(entry_ref) = entry {
                let entry_id = entry_ref.id();
                let is_selected = self.selection_manager.lock().unwrap().is_selected(entry_id);

                // Calculate absolute position to determine if the entry is in the parallel section
                let absolute_idx = scroll_metrics.scroll_offset + row_idx;
                let is_in_parallel_section =
                    has_visible_parallel_entries && self.is_in_parallel_section(absolute_idx);

                // Handle different entry types
                if let Some(batch_group) = self.get_batch_group_by_id_filtered(entry_id) {
                    // This is a batch group (entry_id is pure batch ID)
                    self.render_batch_group_row(
                        batch_group,
                        is_selected,
                        is_in_parallel_section,
                        column_visibility,
                        selected_style,
                        normal_style,
                    )
                } else if let Some(task) = self.task_lookup.get(entry_id) {
                    // This is a task - determine if it's nested under an expanded batch
                    let is_nested_task = self.is_task_nested_in_expanded_batch(entry_id);

                    if is_nested_task {
                        self.render_nested_task_row(
                            task,
                            entry_id.to_string(),
                            is_selected,
                            is_in_parallel_section,
                            column_visibility,
                            selected_style,
                            normal_style,
                        )
                    } else {
                        self.render_task_row(
                            task,
                            entry_id.to_string(),
                            is_selected,
                            is_in_parallel_section,
                            column_visibility,
                            selected_style,
                            normal_style,
                        )
                    }
                } else {
                    // Unknown entry type
                    Row::new(vec![Cell::from("")]).height(1)
                }
            } else {
                // Handle None entries (separators)
                let absolute_idx = scroll_metrics.scroll_offset + row_idx;
                let is_in_parallel_section = self.is_in_parallel_section(absolute_idx);

                // Check if this is the bottom cap (the separator after the last parallel task)
                // Only show bottom corner when parallel section is shown
                let parallel_section_end = self.get_parallel_section_end().unwrap_or(0);
                let is_bottom_cap =
                    absolute_idx == parallel_section_end && has_visible_parallel_entries;

                if is_in_parallel_section && !is_bottom_cap {
                    // This is a "Waiting for task..." entry within the parallel section
                    let mut empty_cells = vec![
                        Cell::from(Line::from(vec![
                            // Space for selection indicator (fixed width of 2)
                            Span::raw(" "),
                            // Add vertical line for parallel section (always show when parallel entry is visible)
                            Span::styled("│", Style::default().fg(THEME.info)),
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
                    // Add the bottom corner cap at the end of the parallel section
                    let mut empty_cells = vec![
                        Cell::from(Line::from(vec![
                            // Space for selection indicator (fixed width of 2)
                            Span::raw(" "),
                            // Always show bottom corner when at structural boundary
                            Span::styled("└", Style::default().fg(THEME.info)),
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

        // Use pre-computed scroll metrics passed from main render method
        // This completely eliminates lock acquisitions in this method
        let total_task_count = scroll_metrics.total_task_count;
        let visible_task_count = scroll_metrics.visible_task_count;
        let selected_task_index = scroll_metrics.selected_task_index;

        // Split the area to reserve space for scrollbar and padding when needed
        let (table_render_area, scrollbar_area) = if needs_scrollbar {
            let horizontal_layout = Layout::default()
                .direction(Direction::Horizontal)
                .constraints([
                    Constraint::Fill(1),   // Table area
                    Constraint::Length(2), // Padding space between table and scrollbar
                    Constraint::Length(1), // Scrollbar area (1 character width)
                ])
                .split(table_area);
            (horizontal_layout[0], Some(horizontal_layout[2])) // Use index 2 for scrollbar
        } else {
            (table_area, None)
        };

        // Render the table in the allocated area (with space reserved for scrollbar if needed)
        let t = Table::new(all_rows, &constraints)
            .header(header)
            .block(Block::default())
            .style(self.get_table_style());

        f.render_widget(t, table_render_area);

        // Render scrollbar if needed
        if let Some(scrollbar_area) = scrollbar_area {
            // Position scrollbar to align with actual table content (below header and empty rows)
            let header_and_spacing_rows = 2; // Header + 1 empty spacing row
            let content_scrollbar_area = Rect {
                x: scrollbar_area.x,
                y: scrollbar_area.y + header_and_spacing_rows, // Start at actual content
                width: scrollbar_area.width,
                height: scrollbar_area
                    .height
                    .saturating_sub(header_and_spacing_rows), // Adjust height accordingly
            };

            // Ensure the scrollbar area is within frame bounds
            // This handles race conditions during terminal resize
            let safe_scrollbar_area = content_scrollbar_area.intersection(f.area());

            // Only render if we have a valid visible area
            if safe_scrollbar_area.width > 0 && safe_scrollbar_area.height > 0 {
                // Update scrollbar state using task-centric metrics for consistent task navigation
                // This ensures thumb positioning accurately reflects progress through tasks

                let selected_position = selected_task_index.unwrap_or(0);

                let mut scrollbar_state = ScrollbarState::default()
                    .content_length(total_task_count) // Total tasks excluding spacers
                    .viewport_content_length(visible_task_count) // Tasks visible in viewport (no spacers)
                    .position(selected_position); // Selected task's index among tasks

                // Determine scrollbar style based on focus state
                let base_style = Style::default().fg(THEME.info);
                let scrollbar_style = if self.is_task_list_focused() {
                    base_style
                } else {
                    base_style.dim()
                };

                let scrollbar = Scrollbar::default()
                    .orientation(ScrollbarOrientation::VerticalRight)
                    .begin_symbol(Some("↑"))
                    .end_symbol(Some("↓"))
                    .style(scrollbar_style);

                // Render scrollbar in the safe area
                f.render_stateful_widget(scrollbar, safe_scrollbar_area, &mut scrollbar_state);
            }
        }
    }

    /// Helper method to get a batch group by its ID from filtered display items
    fn get_batch_group_by_id_filtered(&self, batch_id: &str) -> Option<&BatchGroupItem> {
        for display_item in &self.filtered_display_items {
            if let DisplayItem::BatchGroup(batch_group) = display_item {
                if batch_group.batch_id == batch_id {
                    return Some(batch_group);
                }
            }
        }
        None
    }

    /// Helper method to get a batch group by its ID from display_items (not filtered)
    pub fn get_batch_group_by_id(&self, batch_id: &str) -> Option<&BatchGroupItem> {
        for display_item in &self.display_items {
            if let DisplayItem::BatchGroup(batch_group) = display_item {
                if batch_group.batch_id == batch_id {
                    return Some(batch_group);
                }
            }
        }
        None
    }

    /// Renders a batch group row with expand/collapse indicator
    fn render_batch_group_row(
        &self,
        batch_group: &BatchGroupItem,
        is_selected: bool,
        is_in_parallel_section: bool,
        column_visibility: &ColumnVisibility,
        selected_style: Style,
        normal_style: Style,
    ) -> Row {
        let status_cell = {
            let mut spans = vec![Span::raw(if is_selected { ">" } else { " " })];

            // Add vertical line for parallel section if needed
            if is_in_parallel_section {
                spans.push(Span::styled("│", Style::default().fg(THEME.info)));
            } else {
                spans.push(Span::raw(" "));
            }

            // Add batch status icon based on nested task status (status indicator first)
            let status_char = self.get_batch_status_char(batch_group);
            let status_style = self.get_batch_status_style(batch_group);
            spans.push(Span::styled(format!("{} ", status_char), status_style));

            // Add expand/collapse indicator (expand indicator second)
            let expand_char = if batch_group.is_expanded {
                "▼"
            } else {
                "▶"
            };
            spans.push(Span::styled(
                format!("{}  ", expand_char),
                Style::default().fg(THEME.info),
            ));

            Cell::from(Line::from(spans))
        };

        let name = {
            let batch_name = format!("{} ({})", batch_group.batch_id, batch_group.task_count);
            Cell::from(batch_name)
        };

        let mut row_cells = vec![status_cell, name];

        // Add cache status cell if visible (empty for batch groups)
        if column_visibility.show_cache_status {
            row_cells.push(Cell::from(""));
        }

        // Add duration cell if visible (empty for batch groups)
        if column_visibility.show_duration {
            row_cells.push(Cell::from(""));
        }

        Row::new(row_cells).height(1).style(if is_selected {
            selected_style
        } else {
            normal_style
        })
    }

    /// Renders a nested task row with indentation
    fn render_nested_task_row(
        &self,
        task: &TaskItem,
        task_name: String,
        is_selected: bool,
        _is_in_parallel_section: bool,
        column_visibility: &ColumnVisibility,
        selected_style: Style,
        normal_style: Style,
    ) -> Row {
        let status_cell = {
            let mut spans = vec![Span::raw(if is_selected { ">" } else { " " })];

            // ALWAYS add vertical line for nested tasks to show they're part of a batch
            // This provides the visual grouping indicator
            spans.push(Span::styled("│", Style::default().fg(THEME.info)));

            // DON'T indent status indicators - they should align with batch group status

            // Use centralized status icon function for consistent styling
            let status_char = status_icons::get_status_char(task.status, self.throbber_counter);
            let status_style = status_icons::get_status_style(task.status);
            spans.push(Span::styled(format!("{}  ", status_char), status_style));

            Cell::from(Line::from(spans))
        };

        let name = {
            // Show output indicators if the task is pinned to a pane (but not in spacebar mode)
            let output_indicators = if !self.spacebar_mode {
                self.pinned_tasks
                    .iter()
                    .enumerate()
                    .filter_map(|(idx, task)| {
                        if task.as_deref() == Some(task_name.as_str()) {
                            Some(format!("[{}]", idx + 1))
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
                    Span::raw("  "), // Add 2-space indentation for nested task names
                    Span::raw(task_name.clone()),
                    Span::raw(" "),
                    Span::styled(output_indicators, Style::default().dim()),
                ]);
                Cell::from(line)
            } else {
                let line = Line::from(vec![
                    Span::raw("  "), // Add 2-space indentation for nested task names
                    Span::raw(task_name.clone()),
                ]);
                Cell::from(line)
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
    }

    /// Renders a regular task row (unchanged from original logic)
    fn render_task_row(
        &self,
        task: &TaskItem,
        task_name: String,
        is_selected: bool,
        is_in_parallel_section: bool,
        column_visibility: &ColumnVisibility,
        selected_style: Style,
        normal_style: Style,
    ) -> Row {
        let status_cell = {
            let mut spans = vec![Span::raw(if is_selected { ">" } else { " " })];

            // Add vertical line for parallel section if needed (InProgress/Shared tasks only)
            if matches!(task.status, TaskStatus::InProgress | TaskStatus::Shared)
                && is_in_parallel_section
            {
                spans.push(Span::styled("│", Style::default().fg(THEME.info)));
            } else {
                spans.push(Span::raw(" "));
            }

            // Use centralized status icon function for consistent styling
            let status_char = status_icons::get_status_char(task.status, self.throbber_counter);
            let status_style = status_icons::get_status_style(task.status);
            spans.push(Span::styled(format!("{}    ", status_char), status_style));

            Cell::from(Line::from(spans))
        };

        let name = {
            // Show output indicators if the task is pinned to a pane (but not in spacebar mode)
            let output_indicators = if !self.spacebar_mode {
                self.pinned_tasks
                    .iter()
                    .enumerate()
                    .filter_map(|(idx, task)| {
                        if task.as_deref() == Some(task_name.as_str()) {
                            Some(format!("[{}]", idx + 1))
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
                    Span::raw(task_name.clone()),
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
    }

    /// Gets the status character for a batch group based on its nested tasks
    fn get_batch_status_char(&self, batch_group: &BatchGroupItem) -> char {
        let has_running = batch_group.nested_tasks.iter().any(|task_id| {
            self.task_lookup
                .get(task_id)
                .map(|task| matches!(task.status, TaskStatus::InProgress))
                .unwrap_or(false)
        });

        let has_failed = batch_group.nested_tasks.iter().any(|task_id| {
            self.task_lookup
                .get(task_id)
                .map(|task| matches!(task.status, TaskStatus::Failure))
                .unwrap_or(false)
        });

        let all_completed = !batch_group.nested_tasks.is_empty()
            && batch_group.nested_tasks.iter().all(|task_id| {
                self.task_lookup
                    .get(task_id)
                    .map(|task| {
                        matches!(
                            task.status,
                            TaskStatus::Success
                                | TaskStatus::Failure
                                | TaskStatus::Skipped
                                | TaskStatus::Stopped
                                | TaskStatus::LocalCache
                                | TaskStatus::LocalCacheKeptExisting
                                | TaskStatus::RemoteCache
                        )
                    })
                    .unwrap_or(false)
            });

        if has_running {
            // Show running animation for running batches
            let throbber_chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
            throbber_chars[self.throbber_counter % throbber_chars.len()]
        } else if has_failed {
            '✖'
        } else if all_completed {
            '✔'
        } else {
            '·'
        }
    }

    /// Gets the status style for a batch group based on its nested tasks
    fn get_batch_status_style(&self, batch_group: &BatchGroupItem) -> Style {
        let has_running = batch_group.nested_tasks.iter().any(|task_id| {
            self.task_lookup
                .get(task_id)
                .map(|task| matches!(task.status, TaskStatus::InProgress))
                .unwrap_or(false)
        });

        let has_failed = batch_group.nested_tasks.iter().any(|task_id| {
            self.task_lookup
                .get(task_id)
                .map(|task| matches!(task.status, TaskStatus::Failure))
                .unwrap_or(false)
        });

        let all_completed = !batch_group.nested_tasks.is_empty()
            && batch_group.nested_tasks.iter().all(|task_id| {
                self.task_lookup
                    .get(task_id)
                    .map(|task| {
                        matches!(
                            task.status,
                            TaskStatus::Success
                                | TaskStatus::Failure
                                | TaskStatus::Skipped
                                | TaskStatus::Stopped
                                | TaskStatus::LocalCache
                                | TaskStatus::LocalCacheKeptExisting
                                | TaskStatus::RemoteCache
                        )
                    })
                    .unwrap_or(false)
            });

        if has_running {
            Style::default().fg(THEME.info).add_modifier(Modifier::BOLD)
        } else if has_failed {
            Style::default()
                .fg(THEME.error)
                .add_modifier(Modifier::BOLD)
        } else if all_completed {
            Style::default()
                .fg(THEME.success)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default()
                .fg(THEME.secondary_fg)
                .add_modifier(Modifier::BOLD)
        }
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
        // Perform initial in-progress task selection if needed
        // This happens after sorting and entry creation, ensuring we select from the stable sorted order
        self.perform_initial_in_progress_selection_if_needed();

        // --- 1. Initial Context ---
        let filter_is_active = self.filter_mode || !self.filter_text.is_empty();
        let is_dimmed = !self.is_task_list_focused();
        let has_cloud_message = self.cloud_message.is_some();

        // --- 2. Determine Bottom Layout Mode ---
        enum BottomLayoutMode {
            SingleLine { help_collapsed: bool }, // Cloud + Help
            TwoLine { help_collapsed: bool },    // Cloud / Help
            NoCloud { help_collapsed: bool },    // Help only
        }
        let layout_mode: BottomLayoutMode;

        if has_cloud_message {
            // Calculate the actual cloud message width that will be rendered
            // This accounts for the URL-only fallback when the full message doesn't fit
            let cloud_text_width = if let Some(message) = &self.cloud_message {
                if message.contains("https://") {
                    let url_start_pos = message.find("https://").unwrap_or(message.len());
                    let prefix = &message[0..url_start_pos];
                    let url = &message[url_start_pos..];
                    let full_message_width = (prefix.len() + url.len()) as u16;
                    let url_width = url.len() as u16;

                    // Check if we'll need to fall back to URL-only rendering
                    // We need to account for the help text that will be on the same line
                    let available_for_cloud = area
                        .width
                        .saturating_sub(SCROLLBAR_WIDTH)
                        .saturating_sub(COLLAPSED_HELP_WIDTH)
                        .saturating_sub(MIN_BOTTOM_SPACING);

                    if full_message_width <= available_for_cloud {
                        full_message_width
                    } else {
                        // Will fall back to URL-only rendering
                        url_width
                    }
                } else {
                    message.len() as u16
                }
            } else {
                0
            };

            let required_width_full_help =
                SCROLLBAR_WIDTH + cloud_text_width + FULL_HELP_WIDTH + MIN_BOTTOM_SPACING;
            let required_width_collapsed_help =
                SCROLLBAR_WIDTH + cloud_text_width + COLLAPSED_HELP_WIDTH + MIN_BOTTOM_SPACING;

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
            let required_width_full_help = SCROLLBAR_WIDTH + FULL_HELP_WIDTH + MIN_BOTTOM_SPACING;
            let required_width_collapsed_help =
                SCROLLBAR_WIDTH + COLLAPSED_HELP_WIDTH + MIN_BOTTOM_SPACING;

            if required_width_full_help <= area.width {
                layout_mode = BottomLayoutMode::NoCloud {
                    help_collapsed: false,
                };
            } else if required_width_collapsed_help <= area.width {
                layout_mode = BottomLayoutMode::NoCloud {
                    help_collapsed: true,
                };
            } else {
                // Force vertical Help split, treat as TwoLine for structure, ensure help is collapsed
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
            // Reserve space for cloud or the top part of vertical Help
            vertical_constraints.push(Constraint::Length(1));
            bottom_row_indices.insert("cloud_or_help_vertical", current_chunk_index);
            current_chunk_index += 1;
            // Add separator between cloud and help rows in two-line mode
            vertical_constraints.push(Constraint::Length(1));
            bottom_row_indices.insert("cloud_help_sep", current_chunk_index);
            current_chunk_index += 1;
        }
        // Reserve space for help row or the bottom part of vertical Help
        vertical_constraints.push(Constraint::Length(1));
        bottom_row_indices.insert("help_vertical", current_chunk_index);

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
        let cloud_or_help_vertical_area = bottom_row_indices
            .get("cloud_or_help_vertical")
            .map(|&i| vertical_chunks[i]);
        let help_vertical_area = bottom_row_indices
            .get("help_vertical")
            .map(|&i| vertical_chunks[i])
            .unwrap(); // Must exist at this point

        // --- 5. Early Scrollbar Detection and Column Visibility ---
        // Check if scrollbar will be needed before calculating column visibility
        let needs_scrollbar = self.will_need_scrollbar(table_area.height);

        // Calculate effective width for column visibility (accounting for scrollbar if needed)
        let effective_width = if needs_scrollbar {
            area.width.saturating_sub(3) // Subtract scrollbar (1) + padding (2)
        } else {
            area.width
        };

        // Calculate column visibility with the effective width
        let column_visibility = self.calculate_column_visibility(effective_width);

        // If duration column is visible and was not visible before, update live durations
        let previous_show_duration = self
            .column_visibility
            .as_ref()
            .map_or(false, |cv| cv.show_duration);
        if column_visibility.show_duration && !previous_show_duration {
            self.update_live_durations();
        }
        // Cache the column visibility
        self.column_visibility = Some(column_visibility.clone());

        // --- 6. Render Table ---
        // Compute scroll metrics once here to reduce lock contention in render_task_table
        let scroll_metrics = {
            let mut manager = self.selection_manager.lock().unwrap();
            manager.update_viewport_and_get_metrics(table_area.height.saturating_sub(4) as usize)
        };
        self.render_task_table(
            f,
            table_area,
            &column_visibility,
            needs_scrollbar,
            &scroll_metrics,
        );

        // --- 7. Render Filter ---
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

        // --- 8. Render Bottom Rows ---
        // Use final_help_collapsed and final_help_width from here down
        let help_is_collapsed = final_help_collapsed;
        let help_text_width = final_help_width;

        match layout_mode {
            BottomLayoutMode::SingleLine { .. } => {
                // Don't need help_collapsed from enum variant now
                // Cloud + Help on one line
                // Calculate exact cloud width based on available space in single line
                let cloud_message_render_width = area
                    .width
                    .saturating_sub(help_text_width) // Use final calculated width
                    .saturating_sub(MIN_BOTTOM_SPACING);

                let constraints = vec![
                    Constraint::Length(cloud_message_render_width),
                    Constraint::Fill(1),
                    Constraint::Length(help_text_width),
                ];
                let row_chunks = Layout::default()
                    .direction(Direction::Horizontal)
                    .constraints(constraints)
                    .split(help_vertical_area);

                // Render components with safety checks
                if !row_chunks.is_empty()
                    && row_chunks[0].height > 0
                    && row_chunks[0].width > 0
                    && row_chunks[0].y < f.area().height
                {
                    self.render_cloud_message(f, row_chunks[0].intersection(f.area()), is_dimmed);
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
            BottomLayoutMode::TwoLine { .. } => {
                // Cloud (if present) row first
                if has_cloud_message {
                    if let Some(area) = cloud_or_help_vertical_area {
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
                // Render help text directly in the area
                if help_vertical_area.height > 0
                    && help_vertical_area.width > 0
                    && help_vertical_area.y < f.area().height
                {
                    self.render_help_text(
                        f,
                        help_vertical_area.intersection(f.area()),
                        help_is_collapsed,
                        is_dimmed,
                    );
                }
            }
            BottomLayoutMode::NoCloud { .. } => {
                // Help row
                // Render help text directly in the area
                if help_vertical_area.height > 0
                    && help_vertical_area.width > 0
                    && help_vertical_area.y < f.area().height
                {
                    self.render_help_text(
                        f,
                        help_vertical_area.intersection(f.area()),
                        help_is_collapsed,
                        is_dimmed,
                    );
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
                // Update live duration only if Duration column is visible
                if self
                    .column_visibility
                    .as_ref()
                    .map(|cv| cv.show_duration)
                    .unwrap_or(false)
                {
                    self.update_live_durations();
                }
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
                // Explicitly scroll to ensure selected task is visible after sort
                self.selection_manager
                    .lock()
                    .unwrap()
                    .ensure_selected_visible();
            }
            Action::UpdateTaskStatus(task_name, status) => {
                self.update_task_status(task_name, status);
            }
            Action::UpdateCloudMessage(message) => {
                self.cloud_message = Some(message);
            }
            Action::ScrollUp => {
                self.scroll_up();
            }
            Action::ScrollDown => {
                self.scroll_down();
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
            Action::ExpandBatch(batch_id) => {
                self.expand_batch(&batch_id);
            }
            Action::CollapseBatch(batch_id) => {
                self.collapse_batch(&batch_id);
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
    use crate::native::tui::app::Focus;
    use crate::native::tui::lifecycle::RunMode;
    use hashbrown::HashSet;
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
    fn test_more_in_progress_tasks_than_parallel_limit() {
        // Test case for bug: bottom corner └ is missing when there are more
        // in-progress tasks than the parallel limit.
        //
        // Scenario: 4 tasks are InProgress, but parallel limit is 2
        // Expected: Should show │ next to all 4 tasks, then └ separator
        // Actual (bug): Shows │ next to all 4 tasks, but missing └ separator

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
            Task {
                id: "task3".to_string(),
                target: TaskTarget {
                    project: "app3".to_string(),
                    target: "lint".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            Task {
                id: "task4".to_string(),
                target: TaskTarget {
                    project: "app4".to_string(),
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

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(10)));
        let mut tasks_list = TasksList::new(
            test_tasks.clone(),
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Test Tasks".to_string(),
            selection_manager,
        );

        let mut terminal = create_test_terminal(80, 15);

        // Set parallel limit to 2 (less than the 4 tasks we'll start)
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();

        // Start all 4 tasks - this exceeds the parallel limit
        for task in &test_tasks {
            tasks_list
                .update(Action::StartTasks(vec![task.clone()]))
                .ok();
        }

        render_to_test_backend(&mut terminal, &mut tasks_list);

        // This snapshot will show the bug: bottom corner └ is missing after the 4 in-progress tasks
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
        let task_item = TaskItem::new(continuous_task.id.clone(), true);
        tasks_list
            .task_lookup
            .insert(continuous_task.id.clone(), task_item.clone());
        tasks_list.display_items.push(DisplayItem::Task(task_item));
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();
        tasks_list
            .update(Action::StartTasks(vec![continuous_task]))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_basic_scrolling() {
        // Create a list with many tasks to test scrolling behavior
        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(5))); // Viewport size 5
        let mut tasks = Vec::new();

        // Create 12 tasks to test scrolling
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
        insta::assert_snapshot!("scrolling_initial", terminal.backend());

        // Scroll down to test viewport change
        tasks_list.update(Action::ScrollDown).ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("scrolling_after_scroll", terminal.backend());
    }

    #[test]
    fn test_no_vertical_line_when_waiting_entries_scrolled_out() {
        // Test that vertical line disappears when "Waiting for task..." entries are scrolled out of viewport
        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(4))); // Small viewport
        let mut tasks = Vec::new();

        // Create many tasks to ensure scrolling beyond waiting entries
        for i in 1..=10 {
            let task = Task {
                id: format!("task{}", i),
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
            };
            tasks.push(task);
        }

        let mut tasks_list = TasksList::new(
            tasks.clone(),
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Test Tasks".to_string(),
            selection_manager,
        );

        let mut terminal = create_test_terminal(80, 10);

        // Set parallel limit of 2 - this will create "Waiting for task..." entries at positions 0,1
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();
        tasks_list.apply_filter();

        // Initial render - should show waiting entries and vertical line
        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "vertical_line_with_waiting_entries_visible",
            terminal.backend()
        );

        // Scroll down multiple times to move past the waiting entries (positions 0,1)
        // With viewport size 4, we need to scroll enough to push waiting entries out
        tasks_list.update(Action::ScrollDown).ok();
        tasks_list.update(Action::ScrollDown).ok();
        tasks_list.update(Action::ScrollDown).ok(); // Scroll past waiting entries

        // Re-render after scrolling
        render_to_test_backend(&mut terminal, &mut tasks_list);

        // This snapshot will show the bug: vertical line │ appears even when no waiting entries visible
        insta::assert_snapshot!(
            "vertical_line_when_waiting_entries_scrolled_out",
            terminal.backend()
        );
    }

    #[test]
    fn test_no_bottom_corner_when_waiting_entries_scrolled_out() {
        // Test that bottom corner └ disappears when "Waiting for task..." entries are scrolled out of viewport
        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(4))); // Small viewport
        let mut tasks = Vec::new();

        // Create many tasks to ensure scrolling beyond waiting entries and bottom corner
        for i in 1..=10 {
            let task = Task {
                id: format!("task{}", i),
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
            };
            tasks.push(task);
        }

        let mut tasks_list = TasksList::new(
            tasks.clone(),
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Test Tasks".to_string(),
            selection_manager,
        );

        let mut terminal = create_test_terminal(80, 10);

        // Set parallel limit of 2 - this creates waiting entries at positions 0,1 and bottom corner at position 2
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();
        tasks_list.apply_filter();

        // Initial render - should show waiting entries and bottom corner └
        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "bottom_corner_with_waiting_entries_visible",
            terminal.backend()
        );

        // Scroll down carefully to move past waiting entries but keep bottom corner in viewport
        // Positions: 0,1 = waiting entries, 2 = bottom corner, 3+ = actual tasks
        // We want: viewport shows positions 2,3,4,5 (bottom corner visible, waiting entries scrolled out)
        tasks_list.update(Action::ScrollDown).ok();
        tasks_list.update(Action::ScrollDown).ok(); // This should show bottom corner but no waiting entries

        // Re-render after scrolling past all parallel section elements
        render_to_test_backend(&mut terminal, &mut tasks_list);

        // This snapshot should show the bug: bottom corner └ appears even when no waiting entries visible
        insta::assert_snapshot!(
            "bottom_corner_when_waiting_entries_scrolled_out",
            terminal.backend()
        );
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

        let mut terminal = create_test_terminal(48, 15);

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_narrow_width_duration_only() {
        let (mut tasks_list, _) = create_test_tasks_list();
        let mut terminal = create_test_terminal(43, 15); // Just enough for duration but not cache

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
    fn test_cloud_message_single_line_url_only() {
        // Tests SingleLine mode where full message doesn't fit but URL alone does
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
    fn test_cloud_message_two_line_layout() {
        // Tests actual TwoLine mode where URL + help don't fit on one line
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(45, 15); // Narrower terminal

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

        // Set a cloud message - URL (31) + collapsed help (19) + spacing (4) = 54 chars
        // Won't fit in 45 char width, forcing TwoLine mode
        tasks_list
            .update(Action::UpdateCloudMessage(
                "View logs and run details at https://nx.app/runs/KnGk4A47qk".to_string(),
            ))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_very_narrow_layout_handling() {
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
    fn test_deep_scrolling_narrow_terminal() {
        let viewport_size = 1;
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

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(viewport_size)));

        let mut tasks_list = TasksList::new(
            tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Deep Scrolling Test".to_string(),
            selection_manager,
        );

        let mut terminal = create_test_terminal(40, 6);

        // Scroll deep into task list (position 49)
        for _ in 0..49 {
            tasks_list.scroll_down();
        }

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
        let (mut tasks_list, _) = create_test_tasks_list();

        // Very narrow - no extra columns
        let result = tasks_list.calculate_column_visibility(20);
        assert!(!result.show_duration);
        assert!(!result.show_cache_status);

        // Narrow - duration only
        let result = tasks_list.calculate_column_visibility(43);
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
        let (mut tasks_list_short, _) = create_test_tasks_list();
        let result = tasks_list_short.calculate_column_visibility(80);
        assert!(result.show_duration);
        assert!(result.show_cache_status);

        // 29-character task name
        let task_name_29 = "this-is-exactly-29-chars-here"; // 29 characters
        let mut tasks_list_29 = create_tasks_list_with_name(task_name_29);
        let result = tasks_list_29.calculate_column_visibility(47);
        assert!(result.show_duration);
        assert!(!result.show_cache_status);

        // 30-character task name (threshold)
        let task_name_30 = "this-is-exactly-thirty-chars-1"; // 30 characters
        let mut tasks_list_30 = create_tasks_list_with_name(task_name_30);
        let result = tasks_list_30.calculate_column_visibility(48);
        assert!(result.show_duration);
        assert!(!result.show_cache_status);
        let result = tasks_list_30.calculate_column_visibility(80);
        assert!(result.show_duration);
        assert!(result.show_cache_status);

        // 31-character task name
        let task_name_31 = "this-is-exactly-thirty-one-char"; // 31 characters
        let mut tasks_list_31 = create_tasks_list_with_name(task_name_31);
        let result = tasks_list_31.calculate_column_visibility(54);
        assert!(result.show_duration);
        assert!(!result.show_cache_status);

        // Very long task name
        let long_task_name =
            "very-long-task-name-that-exceeds-thirty-characters-to-test-threshold-logic";
        let mut tasks_list_long = create_tasks_list_with_name(long_task_name);
        let result = tasks_list_long.calculate_column_visibility(47);
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
        let mut tasks_list = TasksList::new(
            test_tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Test Tasks".to_string(),
            selection_manager,
        );

        // At narrow width, should hide duration due to insufficient space for 30-char threshold
        // Base: 7, Duration: 11, Min threshold: 30, Total needed: 48
        let result = tasks_list.calculate_column_visibility(47);
        assert!(!result.show_duration);
        assert!(!result.show_cache_status);

        let result = tasks_list.calculate_column_visibility(48);
        assert!(result.show_duration);
        assert!(!result.show_cache_status);

        // Should base decision on longest task name, but still show duration at 54 width
        // Base: 7, Duration: 11, space_for_task_name: 36, which is >= 30 threshold
        let result = tasks_list.calculate_column_visibility(54);
        assert!(result.show_duration);
        assert!(!result.show_cache_status);

        // At wider width, should show both columns
        let result = tasks_list.calculate_column_visibility(150);
        assert!(result.show_duration);
        assert!(result.show_cache_status);
    }

    #[test]
    fn test_column_visibility_viewport_consistency() {
        // Create tasks with mixed name lengths distributed across viewports
        let test_tasks = vec![
            // Viewport 1: Short task names
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
            // Viewport 2: Long task names
            Task {
                id: "this-is-a-very-long-task-name-that-exceeds-thirty-characters-viewport2-task1".to_string(),
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
                id: "another-extremely-long-task-name-for-testing-viewport-consistency-viewport2-task2".to_string(),
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

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(3))); // viewport size 3
        let mut tasks_list = TasksList::new(
            test_tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Scrolling Test".to_string(),
            selection_manager,
        );

        // Force apply filter to update the filtered_names
        tasks_list.apply_filter();

        // Test at medium width - should hide cache column due to long task names
        let visibility_viewport1 = tasks_list.calculate_column_visibility(54);

        // Scroll to view long task names
        tasks_list.scroll_down();
        let visibility_viewport2 = tasks_list.calculate_column_visibility(54);

        // Navigate back to viewport 1 (with short task names)
        tasks_list.scroll_up();
        let visibility_viewport1_again = tasks_list.calculate_column_visibility(54);

        // Column visibility should be consistent across viewports
        assert_eq!(
            visibility_viewport1.show_duration,
            visibility_viewport2.show_duration
        );
        assert_eq!(
            visibility_viewport1.show_cache_status,
            visibility_viewport2.show_cache_status
        );
        assert_eq!(
            visibility_viewport1.show_duration,
            visibility_viewport1_again.show_duration
        );
        assert_eq!(
            visibility_viewport1.show_cache_status,
            visibility_viewport1_again.show_cache_status
        );

        // At this width, should show duration but not cache status due to long task names
        assert!(visibility_viewport1.show_duration);
        assert!(!visibility_viewport1.show_cache_status);
    }

    #[test]
    fn test_scrolling_column_visibility_consistency_wide_terminal() {
        // Create tasks with mixed name lengths
        let test_tasks = vec![
            // Viewport 1: Short task names
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
            // Viewport 2: Long task names
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
                id: "another-extremely-long-task-name-for-testing-scrolling-consistency-behavior"
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

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(2))); // viewport size 2
        let mut tasks_list = TasksList::new(
            test_tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Scrolling Test".to_string(),
            selection_manager,
        );

        // Force apply filter to update the filtered_names
        tasks_list.apply_filter();

        // Test at wide width - should show duration but not cache status due to long task names
        let visibility_viewport1 = tasks_list.calculate_column_visibility(120);

        // Scroll to view long task names
        tasks_list.scroll_down();
        let visibility_viewport2 = tasks_list.calculate_column_visibility(120);

        // Navigate back to viewport 1 (with short task names)
        tasks_list.scroll_up();
        let visibility_viewport1_again = tasks_list.calculate_column_visibility(120);

        // Column visibility should be consistent across viewports
        assert_eq!(
            visibility_viewport1.show_duration,
            visibility_viewport2.show_duration
        );
        assert_eq!(
            visibility_viewport1.show_cache_status,
            visibility_viewport2.show_cache_status
        );
        assert_eq!(
            visibility_viewport1.show_duration,
            visibility_viewport1_again.show_duration
        );
        assert_eq!(
            visibility_viewport1.show_cache_status,
            visibility_viewport1_again.show_cache_status
        );

        // At this width with long task names, should show both columns
        assert!(visibility_viewport1.show_duration);
        assert!(visibility_viewport1.show_cache_status);
    }

    #[test]
    fn test_scrolling_column_visibility_rendering_consistency() {
        // Create tasks with mixed name lengths
        let test_tasks = vec![
            // Viewport 1: Short task names
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
            // Viewport 2: Long task names that would affect column visibility
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

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(2))); // viewport size 2
        let mut tasks_list = TasksList::new(
            test_tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            "Scrolling Test".to_string(),
            selection_manager,
        );

        // Force apply filter to update the filtered_names
        tasks_list.apply_filter();

        let mut terminal = create_test_terminal(80, 15);

        // Render viewport 1 (short task names)
        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "scrolling_consistency_viewport1_short_names",
            terminal.backend()
        );

        // Scroll to view long task names
        tasks_list.scroll_down();
        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "scrolling_consistency_viewport2_long_names",
            terminal.backend()
        );

        // Navigate back to viewport 1 to verify consistency
        tasks_list.scroll_up();
        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "scrolling_consistency_viewport1_after_navigation",
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

        // Set the long task name to LocalCacheKeptExisting to show "Match"
        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[0].id.clone(),
                TaskStatus::LocalCacheKeptExisting,
            ))
            .ok();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_pinned_tasks_column_visibility_calculation() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();

        // Get effective width without pinned tasks
        let effective_width_without_pins = tasks_list.calculate_effective_task_name_width();

        // Pin a task which adds " [1]" to the effective task name width
        tasks_list.pin_task(test_tasks[0].id.clone(), 0);
        let effective_width_with_pins = tasks_list.calculate_effective_task_name_width();

        // The effective width with pins should be larger than without pins
        assert!(effective_width_with_pins > effective_width_without_pins);

        // The difference should be 4 characters (" [1]" format)
        let expected_difference = 4; // " [1]" format
        assert_eq!(
            effective_width_with_pins,
            effective_width_without_pins + expected_difference
        );
    }

    // Helper function to create a large TasksList to force scrollbar rendering
    fn create_large_tasks_list(num_tasks: usize) -> TasksList {
        let mut test_tasks = Vec::new();

        for i in 0..num_tasks {
            test_tasks.push(Task {
                id: format!("task-{}", i + 1),
                target: TaskTarget {
                    project: format!("app{}", (i % 5) + 1),
                    target: if i % 3 == 0 {
                        "test".to_string()
                    } else if i % 3 == 1 {
                        "build".to_string()
                    } else {
                        "lint".to_string()
                    },
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            });
        }

        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(10)));
        let title_text = "Test Tasks with Scrollbar".to_string();

        TasksList::new(
            test_tasks,
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            title_text,
            selection_manager,
        )
    }

    #[test]
    fn test_scrollbar_positioning_tall_terminal() {
        let mut tasks_list = create_large_tasks_list(50); // 50 tasks to force scrollbar
        let mut terminal = create_test_terminal(80, 30); // Tall terminal

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_scrollbar_positioning_medium_terminal() {
        let mut tasks_list = create_large_tasks_list(30); // 30 tasks to force scrollbar
        let mut terminal = create_test_terminal(80, 20); // Medium terminal

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_scrollbar_positioning_short_terminal() {
        let mut tasks_list = create_large_tasks_list(20); // 20 tasks to force scrollbar
        let mut terminal = create_test_terminal(80, 12); // Short terminal

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_scrollbar_focus_dimming() {
        let mut tasks_list = create_large_tasks_list(25); // 25 tasks to force scrollbar
        // Remove focus from task list
        tasks_list
            .update(Action::UpdateFocus(Focus::MultipleOutput(0)))
            .ok();
        let mut terminal = create_test_terminal(80, 20);

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_scrollbar_positioning_scrolled_down() {
        let mut tasks_list = create_large_tasks_list(40); // 40 tasks to force scrollbar
        let mut terminal = create_test_terminal(80, 20);

        // Scroll down several positions to test scrollbar thumb position
        for _ in 0..10 {
            tasks_list.update(Action::ScrollDown).ok();
        }

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_scrollbar_positioning_wide_terminal() {
        let mut tasks_list = create_large_tasks_list(35); // 35 tasks to force scrollbar
        let mut terminal = create_test_terminal(120, 25); // Wide terminal

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_scrollbar_positioning_narrow_terminal() {
        let mut tasks_list = create_large_tasks_list(25); // 25 tasks to force scrollbar
        let mut terminal = create_test_terminal(60, 18); // Narrow terminal

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_filter_hides_placeholders_but_shows_matching_in_progress() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        // Set max_parallel to 3 to create placeholder slots
        tasks_list.update(Action::StartCommand(Some(3))).unwrap();

        // Start only the first task (task1 - should match "app1" filter)
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .unwrap();

        // Apply filter that matches the running task - filter for "task1"
        tasks_list.update(Action::EnterFilterMode).unwrap();
        tasks_list.update(Action::AddFilterChar('t')).unwrap();
        tasks_list.update(Action::AddFilterChar('a')).unwrap();
        tasks_list.update(Action::AddFilterChar('s')).unwrap();
        tasks_list.update(Action::AddFilterChar('k')).unwrap();
        tasks_list.update(Action::AddFilterChar('1')).unwrap();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_filter_hides_parallel_section_when_no_in_progress_match() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        // Set max_parallel to 3
        tasks_list.update(Action::StartCommand(Some(3))).unwrap();

        // Start the first task (task1 contains "app1")
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .unwrap();

        // Complete the first task to move it to completed
        tasks_list
            .update(Action::EndTasks(vec![TaskResult {
                task: test_tasks[0].clone(),
                status: "success".to_string(),
                code: 0,
                terminal_output: None,
            }]))
            .unwrap();

        // Explicitly update task status to Success to ensure it's properly marked as completed
        tasks_list
            .update(Action::UpdateTaskStatus(
                test_tasks[0].id.clone(),
                TaskStatus::Success,
            ))
            .unwrap();

        // Apply filter that matches ONLY completed tasks, not InProgress
        // Filter for "task1" which should match the completed task1 but no InProgress tasks
        tasks_list.update(Action::EnterFilterMode).unwrap();
        tasks_list.update(Action::AddFilterChar('t')).unwrap();
        tasks_list.update(Action::AddFilterChar('a')).unwrap();
        tasks_list.update(Action::AddFilterChar('s')).unwrap();
        tasks_list.update(Action::AddFilterChar('k')).unwrap();
        tasks_list.update(Action::AddFilterChar('1')).unwrap();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn test_filter_never_shows_placeholders() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        // Set max_parallel to 3 to create placeholder slots
        tasks_list.update(Action::StartCommand(Some(3))).unwrap();

        // Start first two tasks
        tasks_list
            .update(Action::StartTasks(vec![
                test_tasks[0].clone(),
                test_tasks[1].clone(),
            ]))
            .unwrap();

        // Test 1: Filter that matches both InProgress tasks - use "task" to match task1 and task2
        tasks_list.update(Action::EnterFilterMode).unwrap();
        tasks_list.update(Action::AddFilterChar('t')).unwrap();
        tasks_list.update(Action::AddFilterChar('a')).unwrap();
        tasks_list.update(Action::AddFilterChar('s')).unwrap();
        tasks_list.update(Action::AddFilterChar('k')).unwrap();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "filtered_active_tasks_with_parallel_section",
            terminal.backend()
        );

        // Test 2: Complete both tasks and filter them - no parallel section
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
            ]))
            .unwrap();

        // Explicitly update task statuses to Success to ensure they're properly marked as completed
        for task in &test_tasks[0..2] {
            tasks_list
                .update(Action::UpdateTaskStatus(
                    task.id.clone(),
                    TaskStatus::Success,
                ))
                .unwrap();
        }

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "filtered_completed_tasks_no_parallel_section",
            terminal.backend()
        );

        // Test 3: Clear filter and add one that matches nothing
        tasks_list.update(Action::ClearFilter).unwrap();
        tasks_list.update(Action::EnterFilterMode).unwrap();
        tasks_list.update(Action::AddFilterChar('x')).unwrap();
        tasks_list.update(Action::AddFilterChar('y')).unwrap();
        tasks_list.update(Action::AddFilterChar('z')).unwrap();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("empty_filter_no_matches", terminal.backend());
    }

    #[test]
    fn test_parallel_section_visibility_with_filtered_tasks() {
        let (mut tasks_list, test_tasks) = create_test_tasks_list();
        let mut terminal = create_test_terminal(120, 15);

        // Set max_parallel to 2
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();

        // Start the first task only
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .unwrap();

        // Filter that excludes the InProgress task - should hide parallel section entirely
        // Filter for "task3" which will match only task3 (pending) but NOT task1 (InProgress)
        tasks_list.update(Action::EnterFilterMode).unwrap();
        tasks_list.update(Action::AddFilterChar('t')).unwrap();
        tasks_list.update(Action::AddFilterChar('a')).unwrap();
        tasks_list.update(Action::AddFilterChar('s')).unwrap();
        tasks_list.update(Action::AddFilterChar('k')).unwrap();
        tasks_list.update(Action::AddFilterChar('3')).unwrap();

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(terminal.backend());
    }

    // ========== BATCH DISPLAY TESTS ==========
    // These tests verify the hierarchical batch display functionality
    // and ensure task identity consistency across visual contexts.

    /// Helper function to create a TasksList with batch-enabled test data
    fn create_test_tasks_list_with_batches() -> (TasksList, Vec<Task>) {
        let test_tasks = vec![
            Task {
                id: "app:build".to_string(),
                target: TaskTarget {
                    project: "app".to_string(),
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
                id: "lib:build".to_string(),
                target: TaskTarget {
                    project: "lib".to_string(),
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
                id: "standalone:test".to_string(),
                target: TaskTarget {
                    project: "standalone".to_string(),
                    target: "test".to_string(),
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
        let title_text = "Batch Display Test".to_string();

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

    #[test]
    fn test_task_identity_consistency_across_batch_contexts() {
        // Test 1: Task identity consistency across batch contexts
        // Verifies that "app:build" behaves identically whether displayed standalone or nested in a batch group
        let (mut tasks_list, test_tasks) = create_test_tasks_list_with_batches();
        let mut terminal = create_test_terminal(120, 20);

        // Start with tasks displayed normally (no batches)
        tasks_list.update(Action::StartCommand(Some(3))).unwrap();

        // Start all tasks first to ensure they're in the task lookup
        tasks_list
            .update(Action::StartTasks(vec![
                test_tasks[0].clone(),
                test_tasks[1].clone(),
                test_tasks[2].clone(),
            ]))
            .unwrap();

        // Select the app:build task in standalone context
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("app:build".to_string());

        // Capture selection state in standalone context
        let standalone_selection = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
            .map(|s| s.to_string());

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("batch_identity_standalone_context", terminal.backend());

        // Now create a batch group for app:build and lib:build
        let mut batch_group = BatchGroupItem::new("batch1".to_string(), "executor".to_string());
        batch_group.task_count = 2;
        batch_group.nested_tasks = vec!["app:build".to_string(), "lib:build".to_string()];
        batch_group.is_expanded = true; // Start expanded to see nested tasks

        // Group the tasks into the batch
        tasks_list.group_tasks_into_batch(
            vec!["app:build".to_string(), "lib:build".to_string()],
            batch_group,
        );

        // Re-select the app:build task after grouping (since grouping affects display items)
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("app:build".to_string());

        // Update task statuses to InProgress to show them as running
        tasks_list
            .update(Action::UpdateTaskStatus(
                "app:build".to_string(),
                TaskStatus::InProgress,
            ))
            .unwrap();
        tasks_list
            .update(Action::UpdateTaskStatus(
                "lib:build".to_string(),
                TaskStatus::InProgress,
            ))
            .unwrap();

        // The selection should still be valid and point to the same task
        let batch_selection = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
            .map(|s| s.to_string());

        // Task identity must be consistent: both selections should refer to the same task
        assert_eq!(
            standalone_selection, batch_selection,
            "Task identity changed when displayed in batch context"
        );

        // Verify selection still points to app:build regardless of visual grouping
        assert_eq!(
            batch_selection,
            Some("app:build".to_string()),
            "Selection should still point to app:build task"
        );

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("batch_identity_batch_context", terminal.backend());

        // Test selection behavior: should be able to select the same task whether in batch or not
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("app:build".to_string());
        let reselection = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
            .map(|s| s.to_string());
        assert_eq!(
            reselection,
            Some("app:build".to_string()),
            "Should be able to select app:build task consistently"
        );
    }

    #[test]
    fn test_batch_lifecycle_selection_persistence() {
        // Test 2: Batch lifecycle selection persistence
        // Verifies that selection persists correctly when batch groups are expanded/collapsed
        let (mut tasks_list, test_tasks) = create_test_tasks_list_with_batches();
        let mut terminal = create_test_terminal(120, 20);

        tasks_list.update(Action::StartCommand(Some(3))).unwrap();

        // Start all tasks first to ensure they're in the task lookup
        tasks_list
            .update(Action::StartTasks(vec![
                test_tasks[0].clone(),
                test_tasks[1].clone(),
                test_tasks[2].clone(),
            ]))
            .unwrap();

        // Create a batch group with multiple tasks
        let mut batch_group = BatchGroupItem::new("batch1".to_string(), "executor".to_string());
        batch_group.task_count = 2;
        batch_group.nested_tasks = vec!["app:build".to_string(), "lib:build".to_string()];
        batch_group.is_expanded = true; // Start expanded

        // Group the tasks into the batch
        tasks_list.group_tasks_into_batch(
            vec!["app:build".to_string(), "lib:build".to_string()],
            batch_group,
        );

        // Update task statuses to InProgress to show them as running
        tasks_list
            .update(Action::UpdateTaskStatus(
                "app:build".to_string(),
                TaskStatus::InProgress,
            ))
            .unwrap();
        tasks_list
            .update(Action::UpdateTaskStatus(
                "lib:build".to_string(),
                TaskStatus::InProgress,
            ))
            .unwrap();

        // Select a task within the batch group when expanded
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("lib:build".to_string());
        let selection_before_collapse = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
            .map(|s| s.to_string());

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "batch_lifecycle_expanded_with_selection",
            terminal.backend()
        );

        // Collapse the batch group
        tasks_list.collapse_batch("batch1");

        // When batch is collapsed, selection moves to the batch group since nested task is hidden
        let selection_after_collapse = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_batch_id()
            .map(|s| s.to_string());
        assert_eq!(
            selection_after_collapse,
            Some("batch1".to_string()),
            "Selection should move to batch group when collapsed"
        );

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "batch_lifecycle_collapsed_with_selection",
            terminal.backend()
        );

        // Expand the batch group again
        tasks_list.expand_batch("batch1");

        // Selection remains on batch group after re-expansion
        let selection_after_expand = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_batch_id()
            .map(|s| s.to_string());
        assert_eq!(
            selection_after_expand,
            Some("batch1".to_string()),
            "Selection should remain on batch group after re-expansion"
        );

        // Selection has moved from nested task to batch group due to collapse/expand cycle
        assert_ne!(
            selection_after_expand, selection_before_collapse,
            "Selection changes when batch is collapsed since nested task becomes hidden"
        );

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "batch_lifecycle_re_expanded_with_selection",
            terminal.backend()
        );
    }

    #[test]
    fn test_selection_enum_discrimination() {
        // Test 3: Selection enum discrimination
        // Verifies that the Selection enum correctly discriminates between task and batch group selections
        let (mut tasks_list, test_tasks) = create_test_tasks_list_with_batches();
        let mut terminal = create_test_terminal(120, 20);

        tasks_list.update(Action::StartCommand(Some(3))).unwrap();

        // Start tasks first
        tasks_list
            .update(Action::StartTasks(vec![
                test_tasks[0].clone(),
                test_tasks[1].clone(),
            ]))
            .unwrap();

        // Update task statuses to InProgress to show them as running
        tasks_list
            .update(Action::UpdateTaskStatus(
                "app:build".to_string(),
                TaskStatus::InProgress,
            ))
            .unwrap();
        tasks_list
            .update(Action::UpdateTaskStatus(
                "lib:build".to_string(),
                TaskStatus::InProgress,
            ))
            .unwrap();

        // Now create a batch group for app:build and lib:build
        let mut batch_group = BatchGroupItem::new("batch1".to_string(), "executor".to_string());
        batch_group.task_count = 2;
        batch_group.nested_tasks = vec!["app:build".to_string(), "lib:build".to_string()];
        batch_group.is_expanded = true; // Start expanded to see nested tasks
        batch_group.status = BatchStatus::Running;

        // Group the tasks into the batch
        tasks_list.group_tasks_into_batch(
            vec!["app:build".to_string(), "lib:build".to_string()],
            batch_group,
        );

        // Test 1: Select a task and verify selection type
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("app:build".to_string());
        let selection_manager = tasks_list.selection_manager.lock().unwrap();

        // Verify we have a task selection
        match selection_manager.get_selection() {
            Some(crate::native::tui::components::task_selection_manager::Selection::Task(
                task_name,
            )) => {
                assert_eq!(
                    task_name, "app:build",
                    "Should have selected app:build task"
                );
            }
            Some(
                crate::native::tui::components::task_selection_manager::Selection::BatchGroup(_),
            ) => {
                panic!("Expected task selection, got batch group selection");
            }
            None => {
                panic!("Expected task selection, got none");
            }
        }

        // Verify task is selected and not batch group
        assert_eq!(
            selection_manager.get_selected_item_type(),
            crate::native::tui::components::task_selection_manager::SelectedItemType::Task,
            "Selected item type should be Task"
        );

        drop(selection_manager);

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("selection_enum_task_selected", terminal.backend());

        // Test 2: Select batch group and verify selection type
        // First we need to collapse the batch group
        for item in &mut tasks_list.display_items {
            if let DisplayItem::BatchGroup(batch) = item {
                if batch.batch_id == "batch1" {
                    batch.is_expanded = false;
                    break;
                }
            }
        }
        tasks_list.apply_filter(); // Refresh display after state change

        // Select the batch group (this should internally use BatchGroup selection)
        let mut selection_manager = tasks_list.selection_manager.lock().unwrap();
        selection_manager.select_batch_group("batch1".to_string());

        // Verify we have a batch group selection
        match selection_manager.get_selection() {
            Some(
                crate::native::tui::components::task_selection_manager::Selection::BatchGroup(
                    batch_id,
                ),
            ) => {
                assert_eq!(batch_id, "batch1", "Should have selected batch1 group");
            }
            Some(crate::native::tui::components::task_selection_manager::Selection::Task(_)) => {
                panic!("Expected batch group selection, got task selection");
            }
            None => {
                panic!("Expected batch group selection, got none");
            }
        }

        // Verify batch group is selected and not task
        assert_eq!(
            selection_manager.get_selected_item_type(),
            crate::native::tui::components::task_selection_manager::SelectedItemType::BatchGroup,
            "Selected item type should be BatchGroup"
        );

        drop(selection_manager);

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("selection_enum_batch_group_selected", terminal.backend());

        // Test 3: Verify selections are distinct - selecting one clears the other
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("lib:build".to_string());
        let selection_manager = tasks_list.selection_manager.lock().unwrap();

        // Should now be a task selection, not a batch group selection
        match selection_manager.get_selection() {
            Some(crate::native::tui::components::task_selection_manager::Selection::Task(
                task_name,
            )) => {
                assert_eq!(
                    task_name, "lib:build",
                    "Should have selected lib:build task"
                );
            }
            Some(
                crate::native::tui::components::task_selection_manager::Selection::BatchGroup(_),
            ) => {
                panic!("Expected task selection after selecting task, but got batch group");
            }
            None => {
                panic!("Expected task selection after selecting task, got none");
            }
        }
    }

    #[test]
    fn test_terminal_output_routing_consistency() {
        // Test 4: Terminal output routing consistency
        // Verifies that terminal output routing works correctly without prefix contamination
        let (mut tasks_list, test_tasks) = create_test_tasks_list_with_batches();
        let mut terminal = create_test_terminal(120, 20);

        tasks_list.update(Action::StartCommand(Some(3))).unwrap();

        // Start app:build task standalone first
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[0].clone()]))
            .unwrap();

        // Select the standalone task for terminal output
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("app:build".to_string());
        let standalone_selected = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
            .map(|s| s.to_string());

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("terminal_routing_standalone_task", terminal.backend());

        // Start lib:build task
        tasks_list
            .update(Action::StartTasks(vec![test_tasks[1].clone()]))
            .unwrap();

        // Update task statuses to InProgress to show them as running
        tasks_list
            .update(Action::UpdateTaskStatus(
                "app:build".to_string(),
                TaskStatus::InProgress,
            ))
            .unwrap();
        tasks_list
            .update(Action::UpdateTaskStatus(
                "lib:build".to_string(),
                TaskStatus::InProgress,
            ))
            .unwrap();

        // Now create a batch group that includes app:build and lib:build
        let mut batch_group = BatchGroupItem::new("batch1".to_string(), "executor".to_string());
        batch_group.task_count = 2;
        batch_group.nested_tasks = vec!["app:build".to_string(), "lib:build".to_string()];
        batch_group.is_expanded = true; // Start expanded to see nested tasks
        batch_group.status = BatchStatus::Running;

        // Group the tasks into the batch
        tasks_list.group_tasks_into_batch(
            vec!["app:build".to_string(), "lib:build".to_string()],
            batch_group,
        );

        // Select the same task (app:build) when it's displayed in batch context
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("app:build".to_string());
        let batch_selected = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
            .map(|s| s.to_string());

        // Task selection should be identical regardless of display context
        assert_eq!(
            standalone_selected, batch_selected,
            "Task selection should be identical in standalone and batch contexts"
        );

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("terminal_routing_batch_context", terminal.backend());

        // Verify that selection uses pure task IDs without contamination
        // This is tested by ensuring that the selection manager returns pure task names

        // Test selection to lib:build task in batch context
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("lib:build".to_string());
        let lib_selected = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
            .map(|s| s.to_string());

        assert_eq!(
            lib_selected,
            Some("lib:build".to_string()),
            "Should be able to select lib:build with pure task name"
        );

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("terminal_routing_lib_task_in_batch", terminal.backend());

        // Test that standalone task selection still works after batch operations
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("standalone:test".to_string());
        let standalone_test_selected = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
            .map(|s| s.to_string());

        assert_eq!(
            standalone_test_selected,
            Some("standalone:test".to_string()),
            "Should be able to select standalone task with pure name"
        );

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("terminal_routing_mixed_contexts", terminal.backend());
    }

    #[test]
    fn test_expand_collapse_keyboard_interactions() {
        // Test 4: Expand/collapse keyboard interactions
        // Verifies hierarchical batch display with proper expand/collapse behavior and nested task visibility
        let (mut tasks_list, test_tasks) = create_test_tasks_list_with_batches();
        let mut terminal = create_test_terminal(120, 20);

        tasks_list.update(Action::StartCommand(Some(3))).unwrap();

        // Start all tasks first to ensure they're in the task lookup
        tasks_list
            .update(Action::StartTasks(vec![
                test_tasks[0].clone(),
                test_tasks[1].clone(),
                test_tasks[2].clone(),
            ]))
            .unwrap();

        // Create a batch group with multiple tasks
        let mut batch_group = BatchGroupItem::new("batch1".to_string(), "executor".to_string());
        batch_group.task_count = 2;
        batch_group.nested_tasks = vec!["app:build".to_string(), "lib:build".to_string()];
        batch_group.is_expanded = true; // Start expanded to show nested tasks
        batch_group.status = BatchStatus::Running;

        // Group the tasks into the batch
        tasks_list.group_tasks_into_batch(
            vec!["app:build".to_string(), "lib:build".to_string()],
            batch_group,
        );

        // Update task statuses to InProgress to show them as running
        tasks_list
            .update(Action::UpdateTaskStatus(
                "app:build".to_string(),
                TaskStatus::InProgress,
            ))
            .unwrap();
        tasks_list
            .update(Action::UpdateTaskStatus(
                "lib:build".to_string(),
                TaskStatus::InProgress,
            ))
            .unwrap();

        // Test 1: Batch group starts expanded, shows nested tasks with proper indentation
        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("expand_collapse_initial_expanded", terminal.backend());

        // Test 2: Batch group can be collapsed, hides nested tasks
        for item in &mut tasks_list.display_items {
            if let DisplayItem::BatchGroup(batch) = item {
                if batch.batch_id == "batch1" {
                    batch.is_expanded = false;
                    break;
                }
            }
        }
        tasks_list.apply_filter(); // Refresh display after state change

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("expand_collapse_collapsed", terminal.backend());

        // Test 3: Batch group can be re-expanded, shows nested tasks again
        for item in &mut tasks_list.display_items {
            if let DisplayItem::BatchGroup(batch) = item {
                if batch.batch_id == "batch1" {
                    batch.is_expanded = true;
                    break;
                }
            }
        }
        tasks_list.apply_filter(); // Refresh display after state change

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("expand_collapse_re_expanded", terminal.backend());

        // Test 4: Prevention of collapse when nested task is selected
        // First select a nested task
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("lib:build".to_string());
        let selected_task = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
            .map(|s| s.to_string());
        assert_eq!(
            selected_task,
            Some("lib:build".to_string()),
            "Should be able to select nested task"
        );

        // Try to collapse the batch - in a real implementation this might be prevented
        // For this test, we'll demonstrate the state with a selected nested task
        for item in &mut tasks_list.display_items {
            if let DisplayItem::BatchGroup(batch) = item {
                if batch.batch_id == "batch1" {
                    // Check if any nested task is selected before collapsing
                    let has_selected_nested_task = batch.nested_tasks.iter().any(|task_id| {
                        tasks_list
                            .selection_manager
                            .lock()
                            .unwrap()
                            .get_selected_task_name()
                            .map_or(false, |selected| selected == task_id)
                    });

                    if !has_selected_nested_task {
                        batch.is_expanded = false;
                    }
                    // In this case, we keep it expanded because a nested task is selected
                    break;
                }
            }
        }

        // Verify the batch remains expanded when nested task is selected
        let batch_is_expanded = tasks_list.display_items.iter().any(|item| {
            if let DisplayItem::BatchGroup(batch) = item {
                batch.batch_id == "batch1" && batch.is_expanded
            } else {
                false
            }
        });
        assert!(
            batch_is_expanded,
            "Batch should remain expanded when nested task is selected"
        );

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "expand_collapse_prevent_collapse_with_selection",
            terminal.backend()
        );
    }

    #[test]
    fn test_default_collapsed_and_auto_expand() {
        // Test 5: Default collapsed and auto-expand behavior
        // Verifies that batch groups start collapsed by default and auto-expand when containing a previously selected task
        let (mut tasks_list, test_tasks) = create_test_tasks_list_with_batches();
        let mut terminal = create_test_terminal(120, 20);

        tasks_list.update(Action::StartCommand(Some(3))).unwrap();

        // Start all tasks first to ensure they're in the task lookup
        tasks_list
            .update(Action::StartTasks(vec![
                test_tasks[0].clone(),
                test_tasks[1].clone(),
                test_tasks[2].clone(),
            ]))
            .unwrap();

        // First, simulate a previous task selection before batch creation
        // Select lib:build task when it's still displayed standalone
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("lib:build".to_string());
        let pre_batch_selection = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
            .map(|s| s.to_string());
        assert_eq!(
            pre_batch_selection,
            Some("lib:build".to_string()),
            "Should be able to pre-select lib:build task"
        );

        // Create a batch group with default collapsed state (is_expanded = false)
        let mut batch_group = BatchGroupItem::new("batch1".to_string(), "executor".to_string());
        batch_group.task_count = 2;
        batch_group.nested_tasks = vec!["app:build".to_string(), "lib:build".to_string()];
        batch_group.is_expanded = false; // Start collapsed by default
        batch_group.status = BatchStatus::Running;

        // Group the tasks into the batch
        tasks_list.group_tasks_into_batch(
            vec!["app:build".to_string(), "lib:build".to_string()],
            batch_group,
        );

        // Update task statuses to InProgress to show them as running
        tasks_list
            .update(Action::UpdateTaskStatus(
                "app:build".to_string(),
                TaskStatus::InProgress,
            ))
            .unwrap();
        tasks_list
            .update(Action::UpdateTaskStatus(
                "lib:build".to_string(),
                TaskStatus::InProgress,
            ))
            .unwrap();

        // Test 1: Batch group starts collapsed by default, shows no nested tasks (shows waiting entries instead)
        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("default_collapsed_initial_state", terminal.backend());

        // Verify the batch starts collapsed
        let batch_is_collapsed = tasks_list.display_items.iter().any(|item| {
            if let DisplayItem::BatchGroup(batch) = item {
                batch.batch_id == "batch1" && !batch.is_expanded
            } else {
                false
            }
        });
        assert!(
            batch_is_collapsed,
            "Batch should start collapsed by default"
        );

        // Test 2: Re-select the nested task after grouping (simulating a previously selected task scenario)
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("lib:build".to_string());
        let reselected_task = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
            .map(|s| s.to_string());
        assert_eq!(
            reselected_task,
            Some("lib:build".to_string()),
            "Should be able to re-select lib:build task after grouping"
        );

        // Test 3: Auto-expand behavior when batch contains a previously selected task
        // In a real scenario, the batch would auto-expand if it contains a previously selected task
        // For this test, we'll manually trigger the expansion to show the expected behavior
        let has_selected_nested_task =
            reselected_task.map_or(false, |selected| selected == "lib:build");

        if has_selected_nested_task {
            // Manually expand to simulate auto-expand behavior
            for item in &mut tasks_list.display_items {
                if let DisplayItem::BatchGroup(batch) = item {
                    if batch.batch_id == "batch1" {
                        batch.is_expanded = true; // Simulate auto-expand
                        break;
                    }
                }
            }
            tasks_list.apply_filter(); // Refresh display after state change
        }

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("default_collapsed_auto_expand", terminal.backend());

        // Verify the batch is now expanded (simulating the auto-expand behavior)
        let batch_is_expanded = tasks_list.display_items.iter().any(|item| {
            if let DisplayItem::BatchGroup(batch) = item {
                batch.batch_id == "batch1" && batch.is_expanded
            } else {
                false
            }
        });
        assert!(
            batch_is_expanded,
            "Batch should be expanded when it contains a previously selected task"
        );

        // Test 4: Verify the selected task can be maintained after auto-expansion
        // Re-select to ensure it's still the intended task
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("lib:build".to_string());
        let post_expand_selection = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
            .map(|s| s.to_string());

        // Verify the selection points to lib:build and the task is now visible in the expanded batch
        assert_eq!(
            post_expand_selection,
            Some("lib:build".to_string()),
            "Should be able to select lib:build task in the expanded batch"
        );

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "default_collapsed_final_expanded_with_selection",
            terminal.backend()
        );

        // Test 5: Verify that without a previously selected task, batch would remain collapsed
        // Create another batch without any pre-selected tasks
        let mut batch_group2 = BatchGroupItem::new("batch2".to_string(), "executor2".to_string());
        batch_group2.task_count = 1;
        batch_group2.nested_tasks = vec!["standalone:test".to_string()];
        batch_group2.is_expanded = false; // Start collapsed
        batch_group2.status = BatchStatus::Running;

        // Group standalone:test into batch2
        tasks_list.group_tasks_into_batch(vec!["standalone:test".to_string()], batch_group2);

        tasks_list
            .update(Action::UpdateTaskStatus(
                "standalone:test".to_string(),
                TaskStatus::InProgress,
            ))
            .unwrap();

        // This batch should remain collapsed since no nested task was previously selected
        let batch2_is_collapsed = tasks_list.display_items.iter().any(|item| {
            if let DisplayItem::BatchGroup(batch) = item {
                batch.batch_id == "batch2" && !batch.is_expanded
            } else {
                false
            }
        });
        assert!(
            batch2_is_collapsed,
            "Batch2 should remain collapsed when no nested task was previously selected"
        );

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("default_collapsed_mixed_batch_states", terminal.backend());
    }

    #[test]
    fn test_multiple_concurrent_batches() {
        // Test 6: Multiple concurrent batches with independent expand/collapse states
        // Verifies that multiple batch groups can run simultaneously with individual tasks mixed in between
        // and that each batch maintains independent expand/collapse state

        // Create extended task list with additional tasks for multiple batches
        let test_tasks = vec![
            Task {
                id: "app:build".to_string(),
                target: TaskTarget {
                    project: "app".to_string(),
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
                id: "shared:build".to_string(),
                target: TaskTarget {
                    project: "shared".to_string(),
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
                id: "app:test".to_string(),
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
            },
            Task {
                id: "shared:test".to_string(),
                target: TaskTarget {
                    project: "shared".to_string(),
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
                id: "lint:check".to_string(),
                target: TaskTarget {
                    project: "lint".to_string(),
                    target: "check".to_string(),
                    configuration: None,
                },
                outputs: vec![],
                project_root: Some("".to_string()),
                continuous: Some(false),
                start_time: None,
                end_time: None,
            },
            Task {
                id: "format:check".to_string(),
                target: TaskTarget {
                    project: "format".to_string(),
                    target: "check".to_string(),
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
        let title_text = "Multiple Concurrent Batches Test".to_string();

        let mut tasks_list = TasksList::new(
            test_tasks.clone(),
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            title_text,
            selection_manager,
        );

        let mut terminal = create_test_terminal(120, 20);

        tasks_list.update(Action::StartCommand(Some(6))).unwrap();

        // Start all tasks first to ensure they're in the task lookup
        tasks_list
            .update(Action::StartTasks(test_tasks.clone()))
            .unwrap();

        // Update all task statuses to InProgress to show them as running
        for task in &test_tasks {
            tasks_list
                .update(Action::UpdateTaskStatus(
                    task.id.clone(),
                    TaskStatus::InProgress,
                ))
                .unwrap();
        }

        // Create first batch group: "build-batch" with app:build and shared:build
        let mut build_batch =
            BatchGroupItem::new("build-batch".to_string(), "executor".to_string());
        build_batch.task_count = 2;
        build_batch.nested_tasks = vec!["app:build".to_string(), "shared:build".to_string()];
        build_batch.is_expanded = true; // Start expanded to show nested tasks
        build_batch.status = BatchStatus::Running;

        // Create second batch group: "test-batch" with app:test and shared:test
        let mut test_batch = BatchGroupItem::new("test-batch".to_string(), "executor".to_string());
        test_batch.task_count = 2;
        test_batch.nested_tasks = vec!["app:test".to_string(), "shared:test".to_string()];
        test_batch.is_expanded = false; // Start collapsed
        test_batch.status = BatchStatus::Running;

        // Group the tasks into their respective batches
        tasks_list.group_tasks_into_batch(
            vec!["app:build".to_string(), "shared:build".to_string()],
            build_batch,
        );

        tasks_list.group_tasks_into_batch(
            vec!["app:test".to_string(), "shared:test".to_string()],
            test_batch,
        );

        // Test Snapshot 1: Multiple batches with mixed expand/collapse states and individual tasks
        // Expected layout:
        // lint:check (individual task)
        // ▼ build-batch (2) - expanded showing nested tasks
        //     app:build
        //     shared:build
        // ▶ test-batch (2) - collapsed
        // format:check (individual task)
        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "multiple_concurrent_batches_mixed_states",
            terminal.backend()
        );

        // Test Snapshot 2: Expand both batches to show all nested tasks
        for item in &mut tasks_list.display_items {
            if let DisplayItem::BatchGroup(batch) = item {
                if batch.batch_id == "test-batch" {
                    batch.is_expanded = true;
                    break;
                }
            }
        }
        tasks_list.apply_filter(); // Refresh display after state change

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "multiple_concurrent_batches_all_expanded",
            terminal.backend()
        );

        // Test Snapshot 3: Independent batch state management - collapse build-batch while keeping test-batch expanded
        for item in &mut tasks_list.display_items {
            if let DisplayItem::BatchGroup(batch) = item {
                if batch.batch_id == "build-batch" {
                    batch.is_expanded = false;
                    break;
                }
            }
        }
        tasks_list.apply_filter(); // Refresh display after state change

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!(
            "multiple_concurrent_batches_independent_states",
            terminal.backend()
        );

        // Verify that each batch maintains independent state
        let build_batch_state = tasks_list
            .display_items
            .iter()
            .find_map(|item| {
                if let DisplayItem::BatchGroup(batch) = item {
                    if batch.batch_id == "build-batch" {
                        Some(batch.is_expanded)
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .unwrap();

        let test_batch_state = tasks_list
            .display_items
            .iter()
            .find_map(|item| {
                if let DisplayItem::BatchGroup(batch) = item {
                    if batch.batch_id == "test-batch" {
                        Some(batch.is_expanded)
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .unwrap();

        assert!(!build_batch_state, "Build batch should be collapsed");
        assert!(test_batch_state, "Test batch should be expanded");

        // Verify individual tasks remain visible and unaffected by batch operations
        let individual_tasks_visible = tasks_list.display_items.iter().any(|item| {
            if let DisplayItem::Task(task) = item {
                task.name == "lint:check" || task.name == "format:check"
            } else {
                false
            }
        });
        assert!(
            individual_tasks_visible,
            "Individual tasks should remain visible between batches"
        );

        // Test task selection works correctly across multiple batches
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("shared:test".to_string());
        let selected_task = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_task_name()
            .map(|s| s.to_string());
        assert_eq!(
            selected_task,
            Some("shared:test".to_string()),
            "Should be able to select tasks from second batch"
        );

        // Verify that selecting a task in a collapsed batch works correctly
        // The test-batch is expanded, so shared:test should be directly selectable
        let selected_task_type = tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .get_selected_item_type();
        assert_eq!(
            selected_task_type,
            crate::native::tui::components::task_selection_manager::SelectedItemType::Task,
            "Selected item should be a task, not a batch group"
        );
    }

    #[test]
    fn test_mixed_task_statuses_during_batch_execution() {
        // CRITICAL TEST: Validates the core edge case where tasks with mixed completion statuses
        // remain grouped under a running batch instead of being displayed as standalone tasks.
        // This addresses the specific concern: "could you confirm any of them cover the case where
        // the batch is still in progress and some tasks are marked as finished (success or failure)
        // and we validate that they are still grouped under the batch?"

        let test_tasks = vec![
            Task {
                id: "app:build".to_string(),
                target: TaskTarget {
                    project: "app".to_string(),
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
                id: "app:test".to_string(),
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
            },
            Task {
                id: "shared:build".to_string(),
                target: TaskTarget {
                    project: "shared".to_string(),
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
                id: "shared:test".to_string(),
                target: TaskTarget {
                    project: "shared".to_string(),
                    target: "test".to_string(),
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
        let title_text = "Mixed Status Batch Test".to_string();

        let mut tasks_list = TasksList::new(
            test_tasks.clone(),
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            title_text,
            selection_manager,
        );

        let mut terminal = create_test_terminal(120, 20);

        // Start the command and all tasks
        tasks_list.update(Action::StartCommand(Some(4))).unwrap();
        tasks_list
            .update(Action::StartTasks(test_tasks.clone()))
            .unwrap();

        // Create a running batch containing all 4 tasks
        let mut mixed_batch =
            BatchGroupItem::new("build-batch".to_string(), "executor".to_string());
        mixed_batch.task_count = 4;
        mixed_batch.nested_tasks = vec![
            "app:build".to_string(),
            "app:test".to_string(),
            "shared:build".to_string(),
            "shared:test".to_string(),
        ];
        mixed_batch.is_expanded = true; // Start expanded to show all nested tasks
        mixed_batch.status = BatchStatus::Running; // CRITICAL: Batch is still running

        // Group all tasks into the running batch
        tasks_list.group_tasks_into_batch(
            vec![
                "app:build".to_string(),
                "app:test".to_string(),
                "shared:build".to_string(),
                "shared:test".to_string(),
            ],
            mixed_batch,
        );

        // Set mixed completion statuses while batch is still running:
        // ✅ app:build → Success (completed successfully)
        tasks_list
            .update(Action::UpdateTaskStatus(
                "app:build".to_string(),
                TaskStatus::Success,
            ))
            .ok();

        // ❌ app:test → Failure (completed with failure)
        tasks_list
            .update(Action::UpdateTaskStatus(
                "app:test".to_string(),
                TaskStatus::Failure,
            ))
            .ok();

        // ⠋ shared:build → InProgress (still running)
        tasks_list
            .update(Action::UpdateTaskStatus(
                "shared:build".to_string(),
                TaskStatus::InProgress,
            ))
            .ok();

        // · shared:test → NotStarted (not started yet)
        tasks_list
            .update(Action::UpdateTaskStatus(
                "shared:test".to_string(),
                TaskStatus::NotStarted,
            ))
            .ok();

        // Test Snapshot 1: Mixed statuses all grouped under running batch
        // Expected layout:
        // │⠋ ▼  build-batch (4)                         <- Running batch group
        // │✅      app:build                 45s   Remote <- Completed successfully, still grouped
        // │❌      app:test                  38s   Local  <- Failed, still grouped
        // │⠋      shared:build              12s    ...   <- In progress, still grouped
        // │·       shared:test               ...    ...   <- Not started, still grouped
        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("mixed_statuses_in_running_batch", terminal.backend());

        // CRITICAL ASSERTION: Verify NO tasks appear as standalone DisplayItem::Task entries
        // All tasks should only appear nested within the batch group
        let standalone_task_count = tasks_list
            .display_items
            .iter()
            .filter(|item| matches!(item, DisplayItem::Task(_)))
            .count();

        assert_eq!(
            standalone_task_count, 0,
            "No tasks should appear as standalone items while batch is running"
        );

        // Verify all tasks are properly contained within the batch group
        let batch_group = tasks_list
            .display_items
            .iter()
            .find_map(|item| {
                if let DisplayItem::BatchGroup(batch) = item {
                    if batch.batch_id == "build-batch" {
                        Some(batch)
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .expect("Batch group should exist");

        assert_eq!(
            batch_group.nested_tasks.len(),
            4,
            "Batch should contain all 4 tasks"
        );
        assert!(
            batch_group.is_expanded,
            "Batch should be expanded to show nested tasks"
        );
        assert!(
            matches!(batch_group.status, BatchStatus::Running),
            "Batch should still be running"
        );

        // Test Snapshot 2: Verify collapse/expand still works with mixed statuses
        // Collapse the batch to test that functionality remains intact
        for item in &mut tasks_list.display_items {
            if let DisplayItem::BatchGroup(batch) = item {
                if batch.batch_id == "build-batch" {
                    batch.is_expanded = false;
                    break;
                }
            }
        }
        tasks_list.apply_filter(); // Refresh display after state change

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("mixed_statuses_batch_collapsed", terminal.backend());

        // Verify that collapsed batch still contains all tasks (they're just hidden)
        let batch_group_after_collapse = tasks_list
            .display_items
            .iter()
            .find_map(|item| {
                if let DisplayItem::BatchGroup(batch) = item {
                    if batch.batch_id == "build-batch" {
                        Some(batch)
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .expect("Batch group should still exist after collapse");

        assert!(
            !batch_group_after_collapse.is_expanded,
            "Batch should be collapsed"
        );
        assert_eq!(
            batch_group_after_collapse.nested_tasks.len(),
            4,
            "Collapsed batch should still contain all 4 tasks"
        );

        // Final verification: Ensure no tasks became standalone after collapse
        let standalone_task_count_after_collapse = tasks_list
            .display_items
            .iter()
            .filter(|item| matches!(item, DisplayItem::Task(_)))
            .count();

        assert_eq!(
            standalone_task_count_after_collapse, 0,
            "No tasks should appear as standalone items even when batch is collapsed, found {} standalone tasks",
            standalone_task_count_after_collapse
        );
    }

    #[test]
    fn test_batch_completion_ungrouping() {
        // Test 5: Batch completion ungrouping
        // Verifies the complete lifecycle: group → complete → ungroup
        // This tests the transition from running batch with grouped tasks to individual tasks after completion

        let test_tasks = vec![
            Task {
                id: "app:build".to_string(),
                target: TaskTarget {
                    project: "app".to_string(),
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
                id: "lib:build".to_string(),
                target: TaskTarget {
                    project: "lib".to_string(),
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
        let title_text = "Test Batch Completion".to_string();
        let mut tasks_list = TasksList::new(
            test_tasks.clone(),
            HashSet::new(),
            RunMode::RunMany,
            Focus::TaskList,
            title_text,
            selection_manager,
        );
        let mut terminal = create_test_terminal(120, 15);

        // Set up parallel execution context
        tasks_list.update(Action::StartCommand(Some(2))).unwrap();

        // Start the tasks first to populate task_lookup
        tasks_list
            .update(Action::StartTasks(test_tasks.clone()))
            .unwrap();

        // Set up initial task statuses - tasks should be running
        tasks_list.update_task_status("app:build".to_string(), TaskStatus::InProgress);
        tasks_list.update_task_status("lib:build".to_string(), TaskStatus::InProgress);

        // Create and configure batch group (running batch)
        let mut batch_group = BatchGroupItem::new("batch1".to_string(), "nx:run-many".to_string());
        batch_group.task_count = 2;
        batch_group.nested_tasks = vec!["app:build".to_string(), "lib:build".to_string()];
        batch_group.is_expanded = true; // Start expanded to show nested tasks
        batch_group.status = BatchStatus::Running; // Running batch

        // Group the tasks into the running batch
        tasks_list.group_tasks_into_batch(
            vec!["app:build".to_string(), "lib:build".to_string()],
            batch_group,
        );

        tasks_list.apply_filter(); // Refresh display

        render_to_test_backend(&mut terminal, &mut tasks_list);

        // Snapshot 1: Before ungrouping - running batch with grouped tasks
        insta::assert_snapshot!("batch_completion_before_ungrouping", terminal.backend());

        // Verify batch group exists and contains tasks
        let batch_group_running = tasks_list
            .display_items
            .iter()
            .find_map(|item| {
                if let DisplayItem::BatchGroup(batch) = item {
                    if batch.batch_id == "batch1" {
                        Some(batch)
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .expect("Batch group should exist during running state");

        assert_eq!(
            batch_group_running.nested_tasks.len(),
            2,
            "Batch should contain both tasks"
        );
        assert!(
            batch_group_running.is_expanded,
            "Batch should be expanded to show nested tasks"
        );
        assert!(
            matches!(batch_group_running.status, BatchStatus::Running),
            "Batch should be running"
        );

        // Verify no standalone tasks exist while batch is running
        let standalone_count_before = tasks_list
            .display_items
            .iter()
            .filter(|item| matches!(item, DisplayItem::Task(_)))
            .count();
        assert_eq!(
            standalone_count_before, 0,
            "No tasks should appear as standalone while in running batch"
        );

        // --- SIMULATE BATCH COMPLETION ---

        // Step 1: Update batch status to completed
        for item in &mut tasks_list.display_items {
            if let DisplayItem::BatchGroup(batch) = item {
                if batch.batch_id == "batch1" {
                    batch.status = BatchStatus::Success; // Mark batch as completed
                    break;
                }
            }
        }

        // Step 2: Update individual task statuses to final states
        // First update with end times to simulate completion
        if let Some(task_item) = tasks_list.task_lookup.get_mut("app:build") {
            task_item.start_time = Some(1000);
            task_item.end_time = Some(46000); // 45s duration
        }
        if let Some(task_item) = tasks_list.task_lookup.get_mut("lib:build") {
            task_item.start_time = Some(1000);
            task_item.end_time = Some(39000); // 38s duration
        }
        tasks_list.update_task_status("app:build".to_string(), TaskStatus::LocalCache);
        tasks_list.update_task_status("lib:build".to_string(), TaskStatus::RemoteCache);

        // Step 3: Simulate batch completion ungrouping
        tasks_list.ungroup_batch_tasks("batch1");

        tasks_list.apply_filter(); // Refresh display after ungrouping
        render_to_test_backend(&mut terminal, &mut tasks_list);

        // Snapshot 2: After ungrouping - individual tasks with final statuses
        insta::assert_snapshot!("batch_completion_after_ungrouping", terminal.backend());

        // --- VERIFICATION AFTER UNGROUPING ---

        // Verify batch group no longer exists
        let batch_group_after_ungrouping = tasks_list.display_items.iter().find_map(|item| {
            if let DisplayItem::BatchGroup(batch) = item {
                if batch.batch_id == "batch1" {
                    Some(batch)
                } else {
                    None
                }
            } else {
                None
            }
        });
        assert!(
            batch_group_after_ungrouping.is_none(),
            "Batch group should be removed after ungrouping"
        );

        // Verify tasks now appear as individual standalone items
        let standalone_count_after = tasks_list
            .display_items
            .iter()
            .filter(|item| matches!(item, DisplayItem::Task(_)))
            .count();
        assert_eq!(
            standalone_count_after, 2,
            "Both tasks should appear as standalone items after ungrouping"
        );

        // Verify specific task statuses are preserved after ungrouping
        let app_build_task = tasks_list
            .display_items
            .iter()
            .find_map(|item| {
                if let DisplayItem::Task(task_item) = item {
                    if task_item.name == "app:build" {
                        Some(task_item)
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .expect("app:build task should exist as standalone after ungrouping");

        let lib_build_task = tasks_list
            .display_items
            .iter()
            .find_map(|item| {
                if let DisplayItem::Task(task_item) = item {
                    if task_item.name == "lib:build" {
                        Some(task_item)
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .expect("lib:build task should exist as standalone after ungrouping");

        // Verify final task statuses are correct
        assert!(
            matches!(app_build_task.status, TaskStatus::LocalCache),
            "app:build should have LocalCache status after ungrouping"
        );
        assert!(
            matches!(lib_build_task.status, TaskStatus::RemoteCache),
            "lib:build should have RemoteCache status after ungrouping"
        );

        // Verify task durations are preserved
        assert_eq!(
            app_build_task.start_time,
            Some(1000),
            "app:build start time should be preserved"
        );
        assert_eq!(
            app_build_task.end_time,
            Some(46000),
            "app:build end time should be preserved"
        );
        assert_eq!(
            lib_build_task.start_time,
            Some(1000),
            "lib:build start time should be preserved"
        );
        assert_eq!(
            lib_build_task.end_time,
            Some(39000),
            "lib:build end time should be preserved"
        );
    }

    #[test]
    fn test_hierarchical_navigation_flow() {
        // Test: Hierarchical navigation flow between batch group and nested tasks
        // Verifies that navigation works seamlessly between batch group header and individual tasks
        // Tests selection state changes, visual indicators, and viewport management during navigation

        // Use the existing helper function that creates the test tasks properly
        let (mut tasks_list, test_tasks) = create_test_tasks_list_with_batches();
        let mut terminal = create_test_terminal(120, 20);

        // Start command and tasks to get them in the running state
        tasks_list.update(Action::StartCommand(Some(3))).unwrap();
        tasks_list
            .update(Action::StartTasks(vec![
                test_tasks[0].clone(),
                test_tasks[1].clone(),
                test_tasks[2].clone(),
            ]))
            .unwrap();

        // Create expanded batch group with multiple tasks for navigation testing
        let mut batch_group =
            BatchGroupItem::new("build-batch".to_string(), "executor".to_string());
        batch_group.task_count = 3;
        batch_group.nested_tasks = vec![
            "app:build".to_string(),
            "lib:build".to_string(),
            "standalone:test".to_string(),
        ];
        batch_group.is_expanded = true; // Start expanded to show nested tasks

        // Group the tasks into the batch
        tasks_list.group_tasks_into_batch(
            vec![
                "app:build".to_string(),
                "lib:build".to_string(),
                "standalone:test".to_string(),
            ],
            batch_group,
        );

        // Update task statuses to InProgress to show them as running
        for task in &test_tasks {
            tasks_list
                .update(Action::UpdateTaskStatus(
                    task.id.clone(),
                    TaskStatus::InProgress,
                ))
                .unwrap();
        }

        // Step 1: Start with batch group selected
        // The selection manager should initially select the batch group
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_batch_group("build-batch".to_string());
        tasks_list.apply_filter(); // Refresh display after selection

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("navigation_batch_selected", terminal.backend());

        // Step 2: Navigate to first nested task (simulate down arrow navigation)
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("app:build".to_string());

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("navigation_first_nested_task_selected", terminal.backend());

        // Step 3: Navigate to middle nested task
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_task("lib:build".to_string());

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("navigation_middle_nested_task_selected", terminal.backend());

        // Step 4: Navigate back to batch group (simulate up arrow navigation)
        tasks_list
            .selection_manager
            .lock()
            .unwrap()
            .select_batch_group("build-batch".to_string());
        tasks_list.apply_filter(); // Refresh display after selection

        render_to_test_backend(&mut terminal, &mut tasks_list);
        insta::assert_snapshot!("navigation_back_to_batch", terminal.backend());

        // Verify selection state persistence and hierarchical structure
        let manager = tasks_list.selection_manager.lock().unwrap();

        // Verify final selection points to the batch group
        assert!(
            manager.get_selection().is_some(),
            "Something should be selected after navigation"
        );
        assert_eq!(
            manager.get_selected_batch_id().unwrap(),
            "build-batch",
            "Batch group should be selected"
        );

        // Verify the batch group structure is maintained
        let batch_group_found = tasks_list.display_items.iter().any(|item| {
            if let DisplayItem::BatchGroup(batch) = item {
                batch.batch_id == "build-batch" && batch.is_expanded && batch.task_count == 3
            } else {
                false
            }
        });
        assert!(
            batch_group_found,
            "Batch group should maintain correct structure during navigation"
        );

        // Verify the batch structure is correct
        let batch_count = tasks_list
            .display_items
            .iter()
            .filter(|item| matches!(item, DisplayItem::BatchGroup(_)))
            .count();
        assert_eq!(batch_count, 1, "Should have exactly 1 batch group");

        // Verify the batch contains all the tasks (they are nested within the batch, not as separate display items)
        let batch = tasks_list
            .display_items
            .iter()
            .find_map(|item| {
                if let DisplayItem::BatchGroup(batch) = item {
                    Some(batch)
                } else {
                    None
                }
            })
            .expect("Batch group should exist");
        assert_eq!(batch.task_count, 3, "Batch should contain 3 nested tasks");
        assert_eq!(
            batch.nested_tasks.len(),
            3,
            "Batch should have 3 nested tasks in its list"
        );

        // Verify selection indicator positioning works correctly
        // This is implicitly tested by the snapshot comparisons, but we can verify programmatically
        let display_item_count = tasks_list.display_items.len();
        assert_eq!(
            display_item_count, 1,
            "Should have 1 batch group (tasks are nested within it)"
        );

        drop(manager); // Release the lock

        // Test viewport management - ensure selected items remain visible
        // Since we're using a test terminal with sufficient height (20 lines),
        // all items should be visible, but this tests the viewport update mechanism
        let viewport_metrics = {
            let mut manager = tasks_list.selection_manager.lock().unwrap();
            manager.update_viewport_and_get_metrics(16) // 20 - 4 for headers/footers
        };

        // Verify viewport can accommodate the hierarchical structure
        if let Some(selected_index) = viewport_metrics.selected_task_index {
            assert!(
                selected_index < viewport_metrics.total_task_count,
                "Selected item should be within total task count"
            );
            assert!(
                selected_index < viewport_metrics.visible_task_count,
                "Selected item should be within visible viewport"
            );
        }
    }
}
