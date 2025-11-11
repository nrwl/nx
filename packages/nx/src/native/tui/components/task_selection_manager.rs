/// Batch data structure containing scroll-related metrics to reduce lock contention
/// during scroll operations by gathering all needed information in a single lock acquisition
#[derive(Debug, Clone)]
pub struct ScrollMetrics {
    pub total_task_count: usize,
    pub visible_task_count: usize,
    pub selected_task_index: Option<usize>,
    pub can_scroll_up: bool,
    pub can_scroll_down: bool,
    pub scroll_offset: usize,
}

pub struct TaskSelectionManager {
    // The list of entries (tasks and batch groups) in their current visual order, None represents empty rows
    entries: Vec<Option<SelectionEntry>>,
    // The current selection state (Selected or NoSelection)
    selection_state: SelectionState,
    // Scroll offset for viewport management
    scroll_offset: usize,
    // Viewport height for visible area calculations
    viewport_height: usize,
    // Selection mode determines how the selection behaves when entries change
    selection_mode: SelectionMode,

    // Section tracking for split-index behavior
    /// Number of tasks in the in-progress section
    in_progress_section_size: usize,

    // Performance caches to avoid repeated O(n) operations during rendering
    /// Cached index of the currently selected task among actual tasks (excludes spacers)
    selected_task_index_cache: Option<usize>,
    /// Cached count of total actual tasks (excludes None spacer entries)
    total_task_count_cache: Option<usize>,
    /// Cached count of actual tasks visible in the current viewport
    visible_task_count_cache: Option<usize>,
}

/// Represents which section a task belongs to
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum TaskSection {
    /// In-progress tasks (InProgress or Shared status)
    InProgress,
    /// All other tasks (Pending, Success, Failure, etc.)
    Other,
}

/// Controls how task selection behaves when entries are updated or reordered
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum SelectionMode {
    /// Track a specific task by name regardless of its position in the list
    /// Used when a task is pinned or in spacebar mode
    TrackByName,

    /// Track selection by position/index in the list
    /// Used when no tasks are pinned and not in spacebar mode
    TrackByPosition,
}

/// Represents a selection in the TUI, eliminating the need for string prefixes
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Selection {
    /// A task is selected (pure task ID like "app:build")
    Task(String),
    /// A batch group is selected (pure batch ID)
    BatchGroup(String),
}

/// Represents the current selection state of the task manager
#[derive(Clone, PartialEq, Debug)]
pub enum SelectionState {
    /// A task or batch group is currently selected
    Selected(Selection),
    /// No task is selected (waiting for selection)
    NoSelection,
}

/// Represents an entry in the selection manager with type information
/// This preserves the distinction between tasks and batch groups through the pipeline
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SelectionEntry {
    /// A task entry (task ID like "app:build")
    Task(String),
    /// A batch group entry (batch ID)
    BatchGroup(String),
}

impl SelectionEntry {
    /// Gets the ID regardless of entry type
    pub fn id(&self) -> &str {
        match self {
            SelectionEntry::Task(id) | SelectionEntry::BatchGroup(id) => id,
        }
    }

    /// Converts this entry into a Selection variant
    pub fn to_selection(&self) -> Selection {
        match self {
            SelectionEntry::Task(id) => Selection::Task(id.clone()),
            SelectionEntry::BatchGroup(id) => Selection::BatchGroup(id.clone()),
        }
    }
}

/// Represents the type of item currently selected
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SelectedItemType {
    /// No item is selected
    None,
    /// A batch group is selected
    BatchGroup,
    /// A task is selected (whether nested in batch or standalone)
    Task,
}

impl TaskSelectionManager {
    pub fn new(viewport_height: usize) -> Self {
        Self {
            entries: Vec::new(),
            selection_state: SelectionState::NoSelection,
            scroll_offset: 0,
            viewport_height: viewport_height.max(1),
            selection_mode: SelectionMode::TrackByName,
            in_progress_section_size: 0,
            selected_task_index_cache: None,
            total_task_count_cache: None,
            visible_task_count_cache: None,
        }
    }

    // Cache invalidation methods for performance optimization

    /// Invalidate all performance caches when entries change
    /// This should be called whenever the entries vector is modified
    fn invalidate_all_caches(&mut self) {
        self.selected_task_index_cache = None;
        self.total_task_count_cache = None;
        self.visible_task_count_cache = None;
    }

    /// Invalidate only selection-related cache when selection changes
    /// This should be called whenever the selected task changes
    fn invalidate_selection_cache(&mut self) {
        self.selected_task_index_cache = None;
    }

    /// Invalidate only viewport-related cache when scroll or viewport changes
    /// This should be called whenever scroll_offset or viewport_height changes
    fn invalidate_viewport_cache(&mut self) {
        self.visible_task_count_cache = None;
    }

    /// Sets the selection mode
    pub fn set_selection_mode(&mut self, mode: SelectionMode) {
        self.selection_mode = mode;
    }

    /// Gets the current selection mode
    pub fn get_selection_mode(&self) -> SelectionMode {
        self.selection_mode
    }

    pub fn update_entries(&mut self, entries: Vec<Option<SelectionEntry>>) {
        match self.selection_mode {
            SelectionMode::TrackByName => self.update_entries_track_by_name(entries, None),
            SelectionMode::TrackByPosition => self.update_entries_track_by_position(entries, None),
        }
    }

    /// Update entries with explicit in-progress section size
    pub fn update_entries_with_size(
        &mut self,
        entries: Vec<Option<SelectionEntry>>,
        in_progress_size: usize,
    ) {
        match self.selection_mode {
            SelectionMode::TrackByName => {
                self.update_entries_track_by_name(entries, Some(in_progress_size))
            }
            SelectionMode::TrackByPosition => {
                self.update_entries_track_by_position(entries, Some(in_progress_size))
            }
        }
    }

    /// Updates entries while trying to preserve the selected task by name
    fn update_entries_track_by_name(
        &mut self,
        entries: Vec<Option<SelectionEntry>>,
        in_progress_size: Option<usize>,
    ) {
        // Keep track of current selection state
        let previous_state = self.selection_state.clone();

        // Update the entries
        self.entries = entries;
        // Invalidate all caches since entries have changed
        self.invalidate_all_caches();

        // Update section size - use provided size if available, otherwise compute from entries
        if let Some(size) = in_progress_size {
            self.in_progress_section_size = size;
        } else {
            self.update_in_progress_section_size();
        }

        // Update selection state based on previous state
        self.selection_state = match previous_state {
            SelectionState::Selected(selection) => {
                // Extract the ID from the selection
                let selected_id = match &selection {
                    Selection::Task(id) | Selection::BatchGroup(id) => id,
                };

                // Check if the item still exists in the entries
                let item_still_exists = self
                    .entries
                    .iter()
                    .any(|entry| entry.as_ref().map(|e| e.id()) == Some(selected_id.as_str()));

                if item_still_exists {
                    // Item is still in the list, find it and preserve its type
                    let mut found = None;
                    for entry in &self.entries {
                        if let Some(e) = entry {
                            if e.id() == selected_id {
                                found = Some(SelectionState::Selected(e.to_selection()));
                                break;
                            }
                        }
                    }
                    // Use found selection or select first available
                    found.unwrap_or_else(|| match self.entries.iter().find_map(|e| e.as_ref()) {
                        Some(entry) => SelectionState::Selected(entry.to_selection()),
                        None => SelectionState::NoSelection,
                    })
                } else {
                    // Item no longer exists - select first available
                    // This follows master's rule: no preference between batches and tasks
                    match self.entries.iter().find_map(|e| e.as_ref()) {
                        Some(entry) => SelectionState::Selected(entry.to_selection()),
                        None => SelectionState::NoSelection,
                    }
                }
            }
            SelectionState::NoSelection => {
                // Stay in waiting state - selection happens at render time
                SelectionState::NoSelection
            }
        };

        // Invalidate selection cache
        self.invalidate_selection_cache();
    }

    /// Updates entries while trying to preserve the selected position in the list
    fn update_entries_track_by_position(
        &mut self,
        entries: Vec<Option<SelectionEntry>>,
        in_progress_size: Option<usize>,
    ) {
        // Get the current selection index
        let selection_index = self.get_selected_index();

        // Update the entries
        self.entries = entries;
        // Invalidate all caches since entries have changed
        self.invalidate_all_caches();

        // Update section size - use provided size if available, otherwise compute from entries
        if let Some(size) = in_progress_size {
            self.in_progress_section_size = size;
        } else {
            self.update_in_progress_section_size();
        }

        // Update selection state based on position
        self.selection_state = if let Some(idx) = selection_index {
            // Try to maintain the position - find next non-empty entry at or after position
            let mut found_entry = None;
            for i in idx..self.entries.len() {
                if let Some(Some(entry)) = self.entries.get(i) {
                    found_entry = Some(entry.to_selection());
                    break;
                }
            }

            // If not found after, try before
            if found_entry.is_none() {
                for i in (0..idx).rev() {
                    if let Some(Some(entry)) = self.entries.get(i) {
                        found_entry = Some(entry.to_selection());
                        break;
                    }
                }
            }

            // Use found entry or select first available
            match found_entry.or_else(|| {
                self.entries
                    .iter()
                    .find_map(|e| e.as_ref().map(|entry| entry.to_selection()))
            }) {
                Some(selection) => SelectionState::Selected(selection),
                None => SelectionState::NoSelection,
            }
        } else {
            // No previous selection - stay in waiting state (selection happens at render time)
            SelectionState::NoSelection
        };

        // Invalidate selection cache
        self.invalidate_selection_cache();
    }

    pub fn select(&mut self, task_name: Option<String>) {
        match task_name {
            Some(name)
                if self
                    .entries
                    .iter()
                    .any(|e| e.as_ref().map(|entry| entry.id()) == Some(name.as_str())) =>
            {
                // Find the entry and preserve its type
                for entry in &self.entries {
                    if let Some(e) = entry {
                        if e.id() == name {
                            self.selection_state = SelectionState::Selected(e.to_selection());
                            // Invalidate selection cache since selected item changed
                            self.invalidate_selection_cache();
                            // Scroll to ensure the selected item is visible
                            self.ensure_selected_visible();
                            return;
                        }
                    }
                }
            }
            _ => {
                self.selection_state = SelectionState::NoSelection;
                // Invalidate selection cache since selection was cleared
                self.invalidate_selection_cache();
            }
        }
    }

    pub fn select_task(&mut self, task_id: String) {
        self.selection_state = SelectionState::Selected(Selection::Task(task_id));
        // Invalidate selection cache since selected task changed
        self.invalidate_selection_cache();
        self.ensure_selected_visible();
    }

    /// Selects a batch group by its ID
    pub fn select_batch_group(&mut self, batch_id: String) {
        self.selection_state = SelectionState::Selected(Selection::BatchGroup(batch_id));
        // Invalidate selection cache since selection changed
        self.invalidate_selection_cache();
        self.ensure_selected_visible();
    }

    /// Determine which section a task belongs to based on its position in entries
    /// Returns None for batch groups (they don't belong to a section)
    fn determine_task_section(&self, selection: &Selection) -> Option<TaskSection> {
        // Batch groups don't belong to sections
        if matches!(selection, Selection::BatchGroup(_)) {
            return None;
        }

        let item_id = match selection {
            Selection::Task(id) | Selection::BatchGroup(id) => id,
        };

        // Find the item's index in entries
        let item_index = self
            .entries
            .iter()
            .position(|entry| entry.as_ref().map(|e| e.id()) == Some(item_id.as_str()))?;

        // Check if it's in the in-progress section (before the first None spacer)
        if item_index < self.in_progress_section_size {
            Some(TaskSection::InProgress)
        } else {
            Some(TaskSection::Other)
        }
    }

    pub fn next(&mut self) {
        match &self.selection_state {
            SelectionState::Selected(_) => {
                if let Some(current_idx) = self.get_selected_index() {
                    // Find next non-empty entry
                    for idx in (current_idx + 1)..self.entries.len() {
                        if let Some(entry) = &self.entries[idx] {
                            self.selection_state = SelectionState::Selected(entry.to_selection());
                            self.invalidate_selection_cache();
                            self.ensure_selected_visible();
                            return;
                        }
                    }
                }
            }
            SelectionState::NoSelection => {
                self.select_first_available();
                self.ensure_selected_visible();
            }
        }
    }

    pub fn previous(&mut self) {
        match &self.selection_state {
            SelectionState::Selected(_) => {
                if let Some(current_idx) = self.get_selected_index() {
                    // Find previous non-empty entry
                    for idx in (0..current_idx).rev() {
                        if let Some(entry) = &self.entries[idx] {
                            self.selection_state = SelectionState::Selected(entry.to_selection());
                            self.invalidate_selection_cache();
                            self.ensure_selected_visible();
                            return;
                        }
                    }
                }
            }
            SelectionState::NoSelection => {
                self.select_first_available();
                self.ensure_selected_visible();
            }
        }
    }

    /// Scroll up by the specified number of lines
    pub fn scroll_up(&mut self, lines: usize) {
        self.scroll_offset = self.scroll_offset.saturating_sub(lines);
        // Invalidate viewport cache since scroll position changed
        self.invalidate_viewport_cache();
    }

    /// Scroll down by the specified number of lines
    pub fn scroll_down(&mut self, lines: usize) {
        let max_scroll = self.entries.len().saturating_sub(self.viewport_height);
        self.scroll_offset = self.scroll_offset.saturating_add(lines).min(max_scroll);
        // Invalidate viewport cache since scroll position changed
        self.invalidate_viewport_cache();
    }

    /// Ensure the selected task is visible in the viewport by adjusting scroll if needed
    pub fn ensure_selected_visible(&mut self) {
        if let Some(idx) = self.get_selected_index() {
            let old_scroll_offset = self.scroll_offset;
            // If selected task is above viewport, scroll up to show it
            if idx < self.scroll_offset {
                self.scroll_offset = idx;
            }
            // If selected task is below viewport, scroll down to show it
            else if idx >= self.scroll_offset + self.viewport_height {
                self.scroll_offset = idx.saturating_sub(self.viewport_height.saturating_sub(1));
            }

            // Only invalidate viewport cache if scroll actually changed
            if self.scroll_offset != old_scroll_offset {
                self.invalidate_viewport_cache();
            }
        }
    }

    /// Get the entries visible in the current viewport
    pub fn get_viewport_entries(&self) -> Vec<Option<SelectionEntry>> {
        let start = self.scroll_offset;
        let end = (start + self.viewport_height).min(self.entries.len());
        self.entries[start..end].to_vec()
    }

    pub fn is_selected(&self, task_name: &str) -> bool {
        match &self.selection_state {
            SelectionState::Selected(Selection::Task(selected_task))
            | SelectionState::Selected(Selection::BatchGroup(selected_task)) => {
                selected_task == task_name
            }
            _ => false,
        }
    }

    /// Gets the currently selected item as a Selection enum
    pub fn get_selection(&self) -> Option<&Selection> {
        match &self.selection_state {
            SelectionState::Selected(selection) => Some(selection),
            _ => None,
        }
    }

    /// Gets the selected task name if a task is selected, otherwise None
    pub fn get_selected_task_name(&self) -> Option<&String> {
        match &self.selection_state {
            SelectionState::Selected(Selection::Task(task_name)) => Some(task_name),
            _ => None,
        }
    }

    /// Gets the current selection state
    pub fn get_selection_state(&self) -> &SelectionState {
        &self.selection_state
    }

    /// Gets the in-progress section size
    pub fn get_in_progress_section_size(&self) -> usize {
        self.in_progress_section_size
    }

    /// Determines the type of the currently selected item
    pub fn get_selected_item_type(&self) -> SelectedItemType {
        match &self.selection_state {
            SelectionState::Selected(Selection::Task(_)) => SelectedItemType::Task,
            SelectionState::Selected(Selection::BatchGroup(_)) => SelectedItemType::BatchGroup,
            _ => SelectedItemType::None,
        }
    }

    /// Gets the batch ID if a batch group is selected
    pub fn get_selected_batch_id(&self) -> Option<&String> {
        match &self.selection_state {
            SelectionState::Selected(Selection::BatchGroup(batch_id)) => Some(batch_id),
            _ => None,
        }
    }

    /// Gets the selected item ID and type in one call (unified getter)
    /// This is the preferred method over separate type/ID getters
    pub fn get_selected_item(&self) -> Option<(&String, SelectedItemType)> {
        match &self.selection_state {
            SelectionState::Selected(Selection::Task(id)) => Some((id, SelectedItemType::Task)),
            SelectionState::Selected(Selection::BatchGroup(id)) => {
                Some((id, SelectedItemType::BatchGroup))
            }
            _ => None,
        }
    }

    /// Gets the task name if a task is selected (deprecated method name)
    pub fn get_selected_nested_task_name(&self) -> Option<&String> {
        self.get_selected_task_name()
    }

    /// Gets the task name if a task is selected (deprecated method name)
    pub fn get_selected_regular_task_name(&self) -> Option<&String> {
        self.get_selected_task_name()
    }

    /// Get total number of entries
    pub fn get_total_entries(&self) -> usize {
        self.entries.len()
    }

    /// Get total number of actual tasks (excludes None spacer entries)
    pub fn get_total_task_count(&mut self) -> usize {
        if let Some(cached_count) = self.total_task_count_cache {
            return cached_count;
        }

        // Cache miss - compute and store the result
        let count = self.entries.iter().filter(|entry| entry.is_some()).count();
        self.total_task_count_cache = Some(count);
        count
    }

    /// Get the number of actual tasks visible in the current viewport
    /// This excludes None spacer entries from the viewport calculation
    pub fn get_visible_task_count(&mut self) -> usize {
        if let Some(cached_count) = self.visible_task_count_cache {
            return cached_count;
        }

        // Cache miss - compute and store the result
        let count = self
            .get_viewport_entries()
            .iter()
            .filter(|entry| entry.is_some())
            .count();
        self.visible_task_count_cache = Some(count);
        count
    }

    /// Get the index of the currently selected task among actual tasks only (excludes spacers)
    /// This represents progress through tasks only, ignoring None spacer entries (which are never selected)
    pub fn get_selected_task_index(&mut self) -> Option<usize> {
        // Extract selected item from state, or return None if not selected
        let selection = match &self.selection_state {
            SelectionState::Selected(sel) => sel,
            _ => return None,
        };

        // Return cached value if available (only valid when we have a selection)
        if let Some(cached_index) = self.selected_task_index_cache {
            return Some(cached_index);
        }

        // Cache miss - compute and store the result
        let selected_id = match selection {
            Selection::Task(id) | Selection::BatchGroup(id) => id,
        };
        let mut task_index = 0;
        for entry in &self.entries {
            if let Some(e) = entry {
                if e.id() == selected_id {
                    self.selected_task_index_cache = Some(task_index);
                    return Some(task_index);
                }
                task_index += 1;
            }
        }
        None
    }

    /// Check if there are more entries above the current viewport
    pub fn can_scroll_up(&self) -> bool {
        self.scroll_offset > 0
    }

    /// Check if there are more entries below the current viewport
    pub fn can_scroll_down(&self) -> bool {
        self.scroll_offset + self.viewport_height < self.entries.len()
    }

    pub fn select_first_available(&mut self) {
        self.selection_state = match self
            .entries
            .iter()
            .find_map(|e| e.as_ref().map(|entry| entry.to_selection()))
        {
            Some(selection) => SelectionState::Selected(selection),
            None => SelectionState::NoSelection,
        };
        // Invalidate selection cache since selected item changed
        self.invalidate_selection_cache();
    }

    /// Validate and adjust scroll offset to ensure it's within bounds
    fn validate_scroll_offset(&mut self) {
        let max_scroll = self.entries.len().saturating_sub(self.viewport_height);
        let old_scroll_offset = self.scroll_offset;
        self.scroll_offset = self.scroll_offset.min(max_scroll);

        // Only invalidate viewport cache if scroll actually changed
        if self.scroll_offset != old_scroll_offset {
            self.invalidate_viewport_cache();
        }
    }

    pub fn get_selected_index(&self) -> Option<usize> {
        match &self.selection_state {
            SelectionState::Selected(Selection::Task(id))
            | SelectionState::Selected(Selection::BatchGroup(id)) => self
                .entries
                .iter()
                .position(|entry| entry.as_ref().map(|e| e.id()) == Some(id.as_str())),
            _ => None,
        }
    }

    /// Set the viewport height (visible area size)
    pub fn set_viewport_height(&mut self, viewport_height: usize) {
        let old_viewport_height = self.viewport_height;
        self.viewport_height = viewport_height.max(1);

        // Only invalidate viewport cache if viewport height actually changed
        if self.viewport_height != old_viewport_height {
            self.invalidate_viewport_cache();
        }

        self.validate_scroll_offset();
        self.ensure_selected_visible();
    }

    /// Update viewport height and return current metrics in single lock acquisition.
    /// This combines the common pattern of setting viewport height and then querying
    /// multiple metrics, reducing lock contention during scroll operations.
    pub fn update_viewport_and_get_metrics(&mut self, viewport_height: usize) -> ScrollMetrics {
        self.set_viewport_height(viewport_height);
        ScrollMetrics {
            total_task_count: self.get_total_task_count(),
            visible_task_count: self.get_visible_task_count(),
            selected_task_index: self.get_selected_task_index(),
            can_scroll_up: self.can_scroll_up(),
            can_scroll_down: self.can_scroll_down(),
            scroll_offset: self.scroll_offset,
        }
    }

    // Section tracking methods for split-index behavior

    /// Get the section the currently selected task belongs to
    /// Returns None for batch groups (they don't have sections)
    pub fn get_selected_task_section(&self) -> Option<TaskSection> {
        match &self.selection_state {
            SelectionState::Selected(selection) => self.determine_task_section(selection),
            _ => None,
        }
    }

    /// Update the in-progress section size by counting entries before the first spacer
    fn update_in_progress_section_size(&mut self) {
        let mut count = 0;
        for entry in &self.entries {
            if entry.is_some() {
                count += 1;
            } else {
                // Hit the spacer, stop counting
                break;
            }
        }
        self.in_progress_section_size = count;
    }

    /// Get the index of a task within the in-progress section
    /// Works for both tasks and batch groups (returns position among all entries in section)
    pub fn get_index_in_in_progress_section(&self, item_id: &str) -> Option<usize> {
        self.entries[0..self.in_progress_section_size]
            .iter()
            .filter_map(|e| e.as_ref())
            .position(|entry| entry.id() == item_id)
    }

    /// Get all in-progress items (tasks and batch groups)
    pub fn get_in_progress_items(&self) -> Vec<Selection> {
        self.entries[0..self.in_progress_section_size]
            .iter()
            .filter_map(|e| e.as_ref().map(|entry| entry.to_selection()))
            .collect()
    }

    /// Handle a task finishing from the in-progress section
    ///
    /// # Parameters
    /// - `task_id`: The task that finished
    /// - `old_in_progress_index`: The index the task had in the in-progress section before finishing
    /// - `has_pending_tasks`: Whether there are pending tasks waiting to start
    fn handle_in_progress_task_finished(
        &mut self,
        task_id: String,
        old_in_progress_index: Option<usize>,
        has_pending_tasks: bool,
    ) {
        // Get in-progress items, excluding the one that just finished
        // (entries have already been updated to reflect the status change)
        let in_progress_items = self.get_in_progress_items();

        // Check for last task scenario
        if in_progress_items.is_empty() && !has_pending_tasks {
            // This was the last task - keep tracking by name
            self.selection_state = SelectionState::Selected(Selection::Task(task_id));
            self.invalidate_selection_cache();
            return;
        }

        // Check if in-progress section is empty but there are pending tasks
        if in_progress_items.is_empty() {
            // Wait for next allocation - enter "waiting state"
            self.selection_state = SelectionState::NoSelection;
            self.invalidate_selection_cache();
            return;
        }

        // Switch to position tracking at the old index
        let target_index = old_in_progress_index.unwrap_or(0);

        // Try to select item at old index, falling back to lower indices
        for idx in (0..=target_index).rev() {
            if let Some(item) = in_progress_items.get(idx) {
                self.selection_state = SelectionState::Selected(item.clone());
                self.invalidate_selection_cache();
                return;
            }
        }

        // Shouldn't reach here, but fallback to first in-progress item
        if let Some(item) = in_progress_items.first() {
            self.selection_state = SelectionState::Selected(item.clone());
            self.invalidate_selection_cache();
        }
    }

    /// Handle task lifecycle transitions to manage selection state
    ///
    /// # Parameters
    /// - `task_id`: The task whose status changed
    /// - `old_in_progress_index`: The index the task had in the in-progress section BEFORE status change (if it was in that section)
    /// - `new_is_in_progress`: Whether the task is NOW in-progress (true for starting, false for finishing)
    /// - `has_pending_tasks`: Whether there are pending tasks waiting to start
    ///
    /// Handles two transitions:
    /// 1. Task starting (pending → in-progress): Exits NoSelection state
    /// 2. Task finishing (in-progress → completed): Switches selection or enters NoSelection state
    pub fn handle_task_status_change(
        &mut self,
        task_id: String,
        old_in_progress_index: Option<usize>,
        new_is_in_progress: bool,
        has_pending_tasks: bool,
    ) {
        // Only process if this is the selected task OR we're waiting for a task
        match &self.selection_state {
            SelectionState::Selected(Selection::Task(selected_task))
                if selected_task != &task_id =>
            {
                return;
            }
            SelectionState::Selected(Selection::BatchGroup(_)) => return,
            SelectionState::NoSelection => return,
            _ => {} // Allow Selected(matching task) to continue
        }

        // Handle two lifecycle transitions:

        // 1. Task finishing: was in-progress → not in-progress
        if old_in_progress_index.is_some() && !new_is_in_progress {
            self.handle_in_progress_task_finished(
                task_id,
                old_in_progress_index,
                has_pending_tasks,
            );
        }
        // 2. Task starting: was NOT in-progress → now in-progress
        else if old_in_progress_index.is_none() && new_is_in_progress {
            // Clear waiting state if we're in NoSelection
            if matches!(self.selection_state, SelectionState::NoSelection) {
                self.selection_state = SelectionState::Selected(Selection::Task(task_id));
                self.invalidate_selection_cache();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_manager() {
        let manager = TaskSelectionManager::new(5);
        assert_eq!(manager.get_selected_task_name(), None);
        assert_eq!(manager.get_selection_mode(), SelectionMode::TrackByName);
        assert!(!manager.can_scroll_up());
        assert!(!manager.can_scroll_down()); // No entries, can't scroll
    }

    #[test]
    fn test_update_entries_track_by_name() {
        let mut manager = TaskSelectionManager::new(2);
        manager.set_selection_mode(SelectionMode::TrackByName);

        // Initial entries
        let entries = vec![
            Some(SelectionEntry::Task("Task 1".to_string())),
            None,
            Some(SelectionEntry::Task("Task 2".to_string())),
        ];
        manager.update_entries(entries);
        manager.select_first_available(); // Manual selection since NoSelection doesn't auto-select
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"Task 1".to_string())
        );

        // Update entries with same tasks but different order
        let entries = vec![
            Some(SelectionEntry::Task("Task 2".to_string())),
            None,
            Some(SelectionEntry::Task("Task 1".to_string())),
        ];
        manager.update_entries(entries);

        // Selection should still be Task 1 despite order change
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"Task 1".to_string())
        );
    }

    #[test]
    fn test_update_entries_track_by_position() {
        let mut manager = TaskSelectionManager::new(2);
        manager.set_selection_mode(SelectionMode::TrackByPosition);

        // Initial entries
        let entries = vec![
            Some(SelectionEntry::Task("Task 1".to_string())),
            None,
            Some(SelectionEntry::Task("Task 2".to_string())),
        ];
        manager.update_entries(entries);
        manager.select_first_available(); // Manual selection since NoSelection doesn't auto-select
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"Task 1".to_string())
        );

        // Update entries with different tasks but same structure
        let entries = vec![
            Some(SelectionEntry::Task("Task 3".to_string())),
            None,
            Some(SelectionEntry::Task("Task 4".to_string())),
        ];
        manager.update_entries(entries);

        // Selection should be Task 3 (same position as Task 1 was)
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"Task 3".to_string())
        );
    }

    #[test]
    fn test_select() {
        let mut manager = TaskSelectionManager::new(2);
        let entries = vec![
            Some(SelectionEntry::Task("Task 1".to_string())),
            None,
            Some(SelectionEntry::Task("Task 2".to_string())),
        ];
        manager.update_entries(entries);
        manager.select(Some("Task 2".to_string()));
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"Task 2".to_string())
        );
    }

    #[test]
    fn test_navigation() {
        let mut manager = TaskSelectionManager::new(2);
        let entries = vec![
            Some(SelectionEntry::Task("Task 1".to_string())),
            None,
            Some(SelectionEntry::Task("Task 2".to_string())),
            Some(SelectionEntry::Task("Task 3".to_string())),
        ];
        manager.update_entries(entries);
        manager.select_first_available(); // Manual selection since NoSelection doesn't auto-select

        // Test next
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"Task 1".to_string())
        );
        manager.next();
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"Task 2".to_string())
        );

        // Test previous
        manager.previous();
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"Task 1".to_string())
        );
    }

    #[test]
    fn test_scrolling() {
        let mut manager = TaskSelectionManager::new(2); // Viewport height = 2
        let entries = vec![
            Some(SelectionEntry::Task("Task 1".to_string())),
            Some(SelectionEntry::Task("Task 2".to_string())),
            Some(SelectionEntry::Task("Task 3".to_string())),
            Some(SelectionEntry::Task("Task 4".to_string())),
        ];
        manager.update_entries(entries);

        assert_eq!(manager.get_total_entries(), 4);

        // Initial state - at top of list
        assert!(!manager.can_scroll_up());
        assert!(manager.can_scroll_down());
        let viewport_entries = manager.get_viewport_entries();
        assert_eq!(
            viewport_entries[0],
            Some(SelectionEntry::Task("Task 1".to_string()))
        );
        assert_eq!(
            viewport_entries[1],
            Some(SelectionEntry::Task("Task 2".to_string()))
        );

        // Test scrolling down
        manager.scroll_down(1);
        assert!(manager.can_scroll_up());
        assert!(manager.can_scroll_down());
        let viewport_entries = manager.get_viewport_entries();
        assert_eq!(viewport_entries.len(), 2);
        assert_eq!(
            viewport_entries[0],
            Some(SelectionEntry::Task("Task 2".to_string()))
        );
        assert_eq!(
            viewport_entries[1],
            Some(SelectionEntry::Task("Task 3".to_string()))
        );

        // Test scrolling up
        manager.scroll_up(1);
        assert!(!manager.can_scroll_up());
        assert!(manager.can_scroll_down());
        let viewport_entries = manager.get_viewport_entries();
        assert_eq!(
            viewport_entries[0],
            Some(SelectionEntry::Task("Task 1".to_string()))
        );
        assert_eq!(
            viewport_entries[1],
            Some(SelectionEntry::Task("Task 2".to_string()))
        );
    }

    #[test]
    fn test_is_selected() {
        let mut manager = TaskSelectionManager::new(2);
        let entries = vec![
            Some(SelectionEntry::Task("Task 1".to_string())),
            Some(SelectionEntry::Task("Task 2".to_string())),
        ];
        manager.update_entries(entries);
        manager.select_first_available(); // Manual selection since NoSelection doesn't auto-select

        assert!(manager.is_selected("Task 1"));
        assert!(!manager.is_selected("Task 2"));
    }

    #[test]
    fn test_handle_position_tracking_empty_entries() {
        let mut manager = TaskSelectionManager::new(2);
        manager.set_selection_mode(SelectionMode::TrackByPosition);

        // Initial entries
        let entries = vec![
            Some(SelectionEntry::Task("Task 1".to_string())),
            Some(SelectionEntry::Task("Task 2".to_string())),
        ];
        manager.update_entries(entries);
        manager.select_first_available(); // Manual selection since NoSelection doesn't auto-select
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"Task 1".to_string())
        );

        // Update with empty entries
        let entries: Vec<Option<SelectionEntry>> = vec![];
        manager.update_entries(entries);

        // No entries, so no selection
        assert_eq!(manager.get_selected_task_name(), None);
    }

    #[test]
    fn test_batch_selection_type_detection() {
        let mut manager = TaskSelectionManager::new(2);

        // Test batch group selection (using pure batch ID)
        manager.select_batch_group("my-batch-id".to_string());
        assert_eq!(
            manager.get_selected_item_type(),
            SelectedItemType::BatchGroup
        );
        assert_eq!(
            manager.get_selected_batch_id(),
            Some(&"my-batch-id".to_string())
        );
        assert_eq!(manager.get_selected_task_name(), None);

        // Test task selection (no more distinction between nested and regular)
        manager.select_task("my-task".to_string());
        assert_eq!(manager.get_selected_item_type(), SelectedItemType::Task);
        assert_eq!(manager.get_selected_batch_id(), None);
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"my-task".to_string())
        );

        // Test another task selection
        manager.select_task("regular-task".to_string());
        assert_eq!(manager.get_selected_item_type(), SelectedItemType::Task);
        assert_eq!(manager.get_selected_batch_id(), None);
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"regular-task".to_string())
        );

        // Test no selection
        let entries: Vec<Option<SelectionEntry>> = vec![];
        manager.update_entries(entries);
        assert_eq!(manager.get_selected_item_type(), SelectedItemType::None);
        assert_eq!(manager.get_selected_batch_id(), None);
        assert_eq!(manager.get_selected_nested_task_name(), None);
        assert_eq!(manager.get_selected_regular_task_name(), None);
    }

    #[test]
    fn test_awaiting_pending_task_state() {
        let mut manager = TaskSelectionManager::new(5);

        // Set up initial entries with in-progress section
        let entries = vec![
            Some(SelectionEntry::Task("task1".to_string())),
            None, // Spacer
            Some(SelectionEntry::Task("pending1".to_string())),
        ];
        manager.update_entries_with_size(entries, 1);
        manager.select_first_available(); // Manual selection since NoSelection doesn't auto-select

        // task1 should be selected initially
        assert_eq!(manager.get_selected_task_name(), Some(&"task1".to_string()));

        // Simulate task1 finishing (it was at index 0 in in-progress section)
        // After update_entries, task1 is no longer in in-progress section
        let entries = vec![
            None, // Spacer - in-progress section is now empty
            Some(SelectionEntry::Task("pending1".to_string())),
            Some(SelectionEntry::Task("task1".to_string())), // Moved to completed section
        ];
        manager.update_entries_with_size(entries, 0);

        // Now handle the status change - should enter NoSelection state
        manager.handle_task_status_change("task1".to_string(), Some(0), false, true);

        // Should be in NoSelection state
        assert!(matches!(
            manager.selection_state,
            SelectionState::NoSelection
        ));

        // Navigation should exit waiting state
        manager.next();
        assert!(matches!(
            manager.selection_state,
            SelectionState::Selected(_)
        ));
    }

    #[test]
    fn test_section_tracking() {
        let mut manager = TaskSelectionManager::new(5);

        // Set up entries with in-progress and other sections
        let entries = vec![
            Some(SelectionEntry::Task("in-progress-1".to_string())),
            Some(SelectionEntry::Task("in-progress-2".to_string())),
            None, // Spacer
            Some(SelectionEntry::Task("other-1".to_string())),
            Some(SelectionEntry::Task("other-2".to_string())),
        ];
        manager.update_entries_with_size(entries, 2);

        // Select in-progress task
        manager.select_task("in-progress-1".to_string());
        assert_eq!(
            manager.get_selected_task_section(),
            Some(TaskSection::InProgress)
        );

        // Select other section task
        manager.select_task("other-1".to_string());
        assert_eq!(
            manager.get_selected_task_section(),
            Some(TaskSection::Other)
        );

        // Batch groups should return None for section
        manager.select_batch_group("batch-1".to_string());
        assert_eq!(manager.get_selected_task_section(), None);
    }
}
