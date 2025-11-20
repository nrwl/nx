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
    // The list of task names in their current visual order, None represents empty rows
    entries: Vec<Option<String>>,
    // The current selection state (Selected, AwaitingPendingTask, or NoSelection)
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

/// Represents the current selection state of the task manager
#[derive(Clone, PartialEq, Debug)]
pub enum SelectionState {
    /// A task is currently selected
    Selected(String),
    /// Waiting for a pending task to start (intentional deselection)
    AwaitingPendingTask,
    /// No task is selected
    NoSelection,
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

    pub fn update_entries(&mut self, entries: Vec<Option<String>>) {
        match self.selection_mode {
            SelectionMode::TrackByName => self.update_entries_track_by_name(entries, None),
            SelectionMode::TrackByPosition => self.update_entries_track_by_position(entries, None),
        }
    }

    /// Update entries with explicit in-progress section size
    pub fn update_entries_with_size(
        &mut self,
        entries: Vec<Option<String>>,
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
        entries: Vec<Option<String>>,
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
            SelectionState::Selected(task_name) => {
                // Check if the task still exists in the entries
                let task_still_exists = self
                    .entries
                    .iter()
                    .any(|entry| entry.as_ref() == Some(&task_name));

                if task_still_exists {
                    // Task is still in the list, keep it selected
                    SelectionState::Selected(task_name)
                } else {
                    // Task no longer exists - select first available
                    match self.entries.iter().find_map(|e| e.as_ref().cloned()) {
                        Some(name) => SelectionState::Selected(name),
                        None => SelectionState::NoSelection,
                    }
                }
            }
            SelectionState::AwaitingPendingTask => {
                // Stay in waiting state
                SelectionState::AwaitingPendingTask
            }
            SelectionState::NoSelection => {
                // No previous selection - select first available
                match self.entries.iter().find_map(|e| e.as_ref().cloned()) {
                    Some(name) => SelectionState::Selected(name),
                    None => SelectionState::NoSelection,
                }
            }
        };

        // Invalidate selection cache
        self.invalidate_selection_cache();
    }

    /// Updates entries while trying to preserve the selected position in the list
    fn update_entries_track_by_position(
        &mut self,
        entries: Vec<Option<String>>,
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
            let mut found_task = None;
            for i in idx..self.entries.len() {
                if let Some(Some(name)) = self.entries.get(i) {
                    found_task = Some(name.clone());
                    break;
                }
            }

            // If not found after, try before
            if found_task.is_none() {
                for i in (0..idx).rev() {
                    if let Some(Some(name)) = self.entries.get(i) {
                        found_task = Some(name.clone());
                        break;
                    }
                }
            }

            // Use found task or select first available
            match found_task.or_else(|| self.entries.iter().find_map(|e| e.as_ref().cloned())) {
                Some(name) => SelectionState::Selected(name),
                None => SelectionState::NoSelection,
            }
        } else {
            // No previous selection, select first available task
            match self.entries.iter().find_map(|e| e.as_ref().cloned()) {
                Some(name) => SelectionState::Selected(name),
                None => SelectionState::NoSelection,
            }
        };

        // Invalidate selection cache
        self.invalidate_selection_cache();
    }

    pub fn select(&mut self, task_name: Option<String>) {
        self.selection_state = match task_name {
            Some(name) if self.entries.iter().any(|e| e.as_ref() == Some(&name)) => {
                SelectionState::Selected(name)
            }
            _ => SelectionState::NoSelection,
        };
        // Invalidate selection cache since selected task changed
        self.invalidate_selection_cache();
        // Scroll to ensure the selected task is visible
        self.ensure_selected_visible();
    }

    pub fn select_task(&mut self, task_id: String) {
        self.selection_state = SelectionState::Selected(task_id);
        // Invalidate selection cache since selected task changed
        self.invalidate_selection_cache();
        self.ensure_selected_visible();
    }

    /// Determine which section a task belongs to based on its position in entries
    fn determine_task_section(&self, task_name: &str) -> Option<TaskSection> {
        // Find the task's index in entries
        let task_index = self
            .entries
            .iter()
            .position(|entry| entry.as_deref() == Some(task_name))?;

        // Check if it's in the in-progress section (before the first None spacer)
        if task_index < self.in_progress_section_size {
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
                        if let Some(task_name) = &self.entries[idx] {
                            self.selection_state = SelectionState::Selected(task_name.clone());
                            self.invalidate_selection_cache();
                            self.ensure_selected_visible();
                            return;
                        }
                    }
                }
            }
            SelectionState::AwaitingPendingTask => {
                self.exit_waiting_state_and_select_first();
                self.ensure_selected_visible();
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
                        if let Some(task_name) = &self.entries[idx] {
                            self.selection_state = SelectionState::Selected(task_name.clone());
                            self.invalidate_selection_cache();
                            self.ensure_selected_visible();
                            return;
                        }
                    }
                }
            }
            SelectionState::AwaitingPendingTask => {
                self.exit_waiting_state_and_select_first();
                self.ensure_selected_visible();
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
    pub fn get_viewport_entries(&self) -> Vec<Option<String>> {
        let start = self.scroll_offset;
        let end = (start + self.viewport_height).min(self.entries.len());
        self.entries[start..end].to_vec()
    }

    pub fn is_selected(&self, task_name: &str) -> bool {
        match &self.selection_state {
            SelectionState::Selected(selected) => selected == task_name,
            _ => false,
        }
    }

    pub fn get_selected_task_name(&self) -> Option<&String> {
        match &self.selection_state {
            SelectionState::Selected(name) => Some(name),
            _ => None,
        }
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
        // Extract selected name from state, or return None if not selected
        let selected_name = match &self.selection_state {
            SelectionState::Selected(name) => name,
            _ => return None,
        };

        // Return cached value if available (only valid when we have a selection)
        if let Some(cached_index) = self.selected_task_index_cache {
            return Some(cached_index);
        }

        // Cache miss - compute and store the result
        let mut task_index = 0;
        for entry in &self.entries {
            if let Some(name) = entry {
                if name == selected_name {
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

    fn select_first_available(&mut self) {
        self.selection_state = match self.entries.iter().find_map(|e| e.as_ref().cloned()) {
            Some(name) => SelectionState::Selected(name),
            None => SelectionState::NoSelection,
        };
        // Invalidate selection cache since selected task changed
        self.invalidate_selection_cache();
    }

    /// Exit waiting state by selecting the first available task
    /// Used when navigating (next/previous) while in AwaitingPendingTask state
    fn exit_waiting_state_and_select_first(&mut self) {
        if let Some(first_task) = self.entries.iter().find_map(|e| e.as_ref()) {
            self.selection_state = SelectionState::Selected(first_task.clone());
            self.invalidate_selection_cache();
        }
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
            SelectionState::Selected(task_name) => self
                .entries
                .iter()
                .position(|entry| entry.as_ref() == Some(task_name)),
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
    pub fn get_selected_task_section(&self) -> Option<TaskSection> {
        match &self.selection_state {
            SelectionState::Selected(name) => self.determine_task_section(name),
            _ => None,
        }
    }

    /// Update the in-progress section size by counting tasks before the first spacer
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
    pub fn get_index_in_in_progress_section(&self, task_name: &str) -> Option<usize> {
        self.entries[0..self.in_progress_section_size]
            .iter()
            .filter_map(|e| e.as_ref())
            .position(|name| name == task_name)
    }

    /// Get all in-progress tasks
    fn get_in_progress_tasks(&self) -> Vec<String> {
        self.entries[0..self.in_progress_section_size]
            .iter()
            .filter_map(|e| e.clone())
            .collect()
    }

    /// Handle a task finishing from the in-progress section
    ///
    /// # Parameters
    /// - `task_name`: The task that finished
    /// - `old_in_progress_index`: The index the task had in the in-progress section before finishing
    /// - `has_pending_tasks`: Whether there are pending tasks waiting to start
    fn handle_in_progress_task_finished(
        &mut self,
        task_name: String,
        old_in_progress_index: Option<usize>,
        has_pending_tasks: bool,
    ) {
        // Get in-progress tasks, excluding the one that just finished
        // (entries have already been updated to reflect the status change)
        let in_progress_tasks = self.get_in_progress_tasks();

        // Check for last task scenario
        if in_progress_tasks.is_empty() && !has_pending_tasks {
            // This was the last task - keep tracking by name
            self.selection_state = SelectionState::Selected(task_name);
            self.invalidate_selection_cache();
            return;
        }

        // Check if in-progress section is empty but there are pending tasks
        if in_progress_tasks.is_empty() {
            // Wait for next allocation - enter "waiting state"
            self.selection_state = SelectionState::AwaitingPendingTask;
            self.invalidate_selection_cache();
            return;
        }

        // Switch to position tracking at the old index
        let target_index = old_in_progress_index.unwrap_or(0);

        // Try to select task at old index, falling back to lower indices
        for idx in (0..=target_index).rev() {
            if let Some(task) = in_progress_tasks.get(idx) {
                self.selection_state = SelectionState::Selected(task.clone());
                self.invalidate_selection_cache();
                return;
            }
        }

        // Shouldn't reach here, but fallback to first in-progress task
        if let Some(task) = in_progress_tasks.first() {
            self.selection_state = SelectionState::Selected(task.clone());
            self.invalidate_selection_cache();
        }
    }

    /// Handle task status changes to manage section transitions
    ///
    /// # Parameters
    /// - `task_name`: The task whose status changed
    /// - `old_in_progress_index`: The index the task had in the in-progress section BEFORE status change (if it was in-progress)
    /// - `new_is_in_progress`: Whether the task is now in-progress
    /// - `has_pending_tasks`: Whether there are pending tasks waiting to start
    pub fn handle_task_status_change(
        &mut self,
        task_name: String,
        old_in_progress_index: Option<usize>,
        new_is_in_progress: bool,
        has_pending_tasks: bool,
    ) {
        // Only process if this is the selected task
        match &self.selection_state {
            SelectionState::Selected(selected_name) if selected_name != &task_name => return,
            SelectionState::NoSelection => return,
            _ => {}
        }

        if old_in_progress_index.is_some() && !new_is_in_progress {
            // Selected in-progress task just finished
            self.handle_in_progress_task_finished(
                task_name,
                old_in_progress_index,
                has_pending_tasks,
            );
        } else if old_in_progress_index.is_none() && new_is_in_progress {
            // Task started (pending → in-progress) - clear waiting state if we're in AwaitingPendingTask
            if matches!(self.selection_state, SelectionState::AwaitingPendingTask) {
                self.selection_state = SelectionState::Selected(task_name);
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
        let entries = vec![Some("Task 1".to_string()), None, Some("Task 2".to_string())];
        manager.update_entries(entries);
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"Task 1".to_string())
        );

        // Update entries with same tasks but different order
        let entries = vec![Some("Task 2".to_string()), None, Some("Task 1".to_string())];
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
        let entries = vec![Some("Task 1".to_string()), None, Some("Task 2".to_string())];
        manager.update_entries(entries);
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"Task 1".to_string())
        );

        // Update entries with different tasks but same structure
        let entries = vec![Some("Task 3".to_string()), None, Some("Task 4".to_string())];
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
        let entries = vec![Some("Task 1".to_string()), None, Some("Task 2".to_string())];
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
            Some("Task 1".to_string()),
            None,
            Some("Task 2".to_string()),
            Some("Task 3".to_string()),
        ];
        manager.update_entries(entries);

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
            Some("Task 1".to_string()),
            Some("Task 2".to_string()),
            Some("Task 3".to_string()),
            Some("Task 4".to_string()),
        ];
        manager.update_entries(entries);

        assert_eq!(manager.get_total_entries(), 4);

        // Initial state - at top of list
        assert!(!manager.can_scroll_up());
        assert!(manager.can_scroll_down());
        let viewport_entries = manager.get_viewport_entries();
        assert_eq!(viewport_entries[0], Some("Task 1".to_string()));
        assert_eq!(viewport_entries[1], Some("Task 2".to_string()));

        // Test scrolling down
        manager.scroll_down(1);
        assert!(manager.can_scroll_up());
        assert!(manager.can_scroll_down());
        let viewport_entries = manager.get_viewport_entries();
        assert_eq!(viewport_entries.len(), 2);
        assert_eq!(viewport_entries[0], Some("Task 2".to_string()));
        assert_eq!(viewport_entries[1], Some("Task 3".to_string()));

        // Test scrolling up
        manager.scroll_up(1);
        assert!(!manager.can_scroll_up());
        assert!(manager.can_scroll_down());
        let viewport_entries = manager.get_viewport_entries();
        assert_eq!(viewport_entries[0], Some("Task 1".to_string()));
        assert_eq!(viewport_entries[1], Some("Task 2".to_string()));
    }

    #[test]
    fn test_is_selected() {
        let mut manager = TaskSelectionManager::new(2);
        let entries = vec![Some("Task 1".to_string()), Some("Task 2".to_string())];
        manager.update_entries(entries);

        assert!(manager.is_selected("Task 1"));
        assert!(!manager.is_selected("Task 2"));
    }

    #[test]
    fn test_handle_position_tracking_empty_entries() {
        let mut manager = TaskSelectionManager::new(2);
        manager.set_selection_mode(SelectionMode::TrackByPosition);

        // Initial entries
        let entries = vec![Some("Task 1".to_string()), Some("Task 2".to_string())];
        manager.update_entries(entries);
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"Task 1".to_string())
        );

        // Update with empty entries
        let entries: Vec<Option<String>> = vec![];
        manager.update_entries(entries);

        // No entries, so no selection
        assert_eq!(manager.get_selected_task_name(), None);
    }

    #[test]
    fn test_section_detection() {
        let mut manager = TaskSelectionManager::new(5);

        // Create entries with in-progress and other sections
        let entries = vec![
            Some("in-progress-1".to_string()),
            Some("in-progress-2".to_string()),
            None, // Spacer
            Some("other-1".to_string()),
            Some("other-2".to_string()),
        ];
        manager.update_entries(entries);

        // Select in-progress task
        manager.select_task("in-progress-1".to_string());
        assert_eq!(
            manager.get_selected_task_section(),
            Some(TaskSection::InProgress)
        );

        // Select other task
        manager.select_task("other-1".to_string());
        assert_eq!(
            manager.get_selected_task_section(),
            Some(TaskSection::Other)
        );
    }

    #[test]
    fn test_in_progress_task_finished_with_other_running() {
        let mut manager = TaskSelectionManager::new(5);

        // Initial state: 2 in-progress tasks
        let entries = vec![
            Some("task-1".to_string()),
            Some("task-2".to_string()),
            None, // Spacer
            Some("finished-1".to_string()),
        ];
        manager.update_entries(entries);
        manager.select_task("task-2".to_string());

        // Simulate task-2 finishing: first update entries (task-2 moves to Other section)
        let entries = vec![
            Some("task-1".to_string()),
            None, // Spacer
            Some("finished-1".to_string()),
            Some("task-2".to_string()), // Moved to Other section
        ];
        manager.update_entries(entries);

        // Then notify about status change with old index 1
        manager.handle_task_status_change("task-2".to_string(), Some(1), false, false);

        // After task-2 finishes and moves to Other section, the old index (1) is now
        // out of bounds for the remaining in-progress tasks. The fallback logic tries
        // index 1 → None, then index 0 → finds task-1 (the only remaining in-progress task).
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"task-1".to_string())
        );
        assert_eq!(
            manager.get_selected_task_section(),
            Some(TaskSection::InProgress)
        );
    }

    #[test]
    fn test_in_progress_task_finished_last_task() {
        let mut manager = TaskSelectionManager::new(5);

        // Initial state: 1 in-progress task, no pending
        let entries = vec![
            Some("last-task".to_string()),
            None, // Spacer
        ];
        manager.update_entries(entries);
        manager.select_task("last-task".to_string());

        // Simulate last-task finishing (no pending tasks)
        // First update entries to move task to Other section (simulates sort_tasks)
        let entries = vec![
            None,                          // Spacer - in-progress section is now empty
            Some("last-task".to_string()), // Moved to Other section
        ];
        manager.update_entries(entries);

        // Then notify about status change with old index 0
        manager.handle_task_status_change("last-task".to_string(), Some(0), false, false);

        // Should keep tracking by name
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"last-task".to_string())
        );
        assert_eq!(
            manager.get_selected_task_section(),
            Some(TaskSection::Other)
        );
    }

    #[test]
    fn test_in_progress_task_finished_with_pending() {
        let mut manager = TaskSelectionManager::new(5);

        // Initial state: 1 in-progress task
        let entries = vec![
            Some("running-task".to_string()),
            None, // Spacer
        ];
        manager.update_entries(entries);
        manager.select_task("running-task".to_string());

        // Simulate running-task finishing: first update entries (task moves to Other section)
        let entries = vec![
            None,                             // Spacer - in-progress section is now empty
            Some("running-task".to_string()), // Moved to Other section
        ];
        manager.update_entries(entries);

        // Then notify about status change with old index 0 and pending tasks
        manager.handle_task_status_change("running-task".to_string(), Some(0), false, true);

        // Should deselect (wait for next allocation)
        assert_eq!(manager.get_selected_task_name(), None);
        assert_eq!(manager.get_selected_task_section(), None);
    }

    #[test]
    fn test_section_maintained_during_reorder() {
        let mut manager = TaskSelectionManager::new(5);

        // Initial state
        let entries = vec![
            Some("task-a".to_string()),
            Some("task-b".to_string()),
            None, // Spacer
            Some("other-1".to_string()),
        ];
        manager.update_entries(entries);
        manager.select_task("task-b".to_string());

        // Reorder (task-b moves to index 0)
        let entries = vec![
            Some("task-b".to_string()),
            Some("task-a".to_string()),
            None, // Spacer
            Some("other-1".to_string()),
        ];
        manager.set_selection_mode(SelectionMode::TrackByName);
        manager.update_entries(entries);

        // Should still be selected
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"task-b".to_string())
        );
    }

    #[test]
    fn test_navigation_from_awaiting_pending_task() {
        let mut manager = TaskSelectionManager::new(5);

        // Initial state: 1 in-progress task
        let entries = vec![
            Some("running-task".to_string()),
            None, // Spacer
            Some("pending-task".to_string()),
        ];
        manager.update_entries(entries);
        manager.select_task("running-task".to_string());

        // Simulate task finishing with pending tasks: update entries
        let entries = vec![
            None,                             // Spacer - in-progress section is now empty
            Some("running-task".to_string()), // Moved to Other section
            Some("pending-task".to_string()),
        ];
        manager.update_entries(entries);

        // Enter AwaitingPendingTask state
        manager.handle_task_status_change("running-task".to_string(), Some(0), false, true);

        // Verify we're in waiting state
        assert_eq!(manager.get_selected_task_name(), None);

        // Test navigation with next() - should exit waiting state and select first available
        manager.next();
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"running-task".to_string())
        );

        // Reset to waiting state for testing previous()
        manager.selection_state = SelectionState::AwaitingPendingTask;
        assert_eq!(manager.get_selected_task_name(), None);

        // Test navigation with previous() - should also exit waiting state
        manager.previous();
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"running-task".to_string())
        );
    }

    #[test]
    fn test_all_tasks_in_one_section_no_spacer() {
        let mut manager = TaskSelectionManager::new(5);

        // Create entries with no spacer - all tasks in one section
        let entries = vec![
            Some("task-1".to_string()),
            Some("task-2".to_string()),
            Some("task-3".to_string()),
        ];
        manager.update_entries(entries);

        // Verify in_progress_section_size counts all tasks (no spacer found)
        assert_eq!(manager.in_progress_section_size, 3);

        // Verify first task is selected
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"task-1".to_string())
        );

        // Verify navigation works
        manager.next();
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"task-2".to_string())
        );

        manager.next();
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"task-3".to_string())
        );

        // Verify section detection - all tasks should be InProgress
        assert_eq!(
            manager.get_selected_task_section(),
            Some(TaskSection::InProgress)
        );

        manager.select_task("task-1".to_string());
        assert_eq!(
            manager.get_selected_task_section(),
            Some(TaskSection::InProgress)
        );
    }

    #[test]
    fn test_all_tasks_in_progress_no_other_section() {
        let mut manager = TaskSelectionManager::new(5);

        // Create entries where all tasks are in-progress, no "Other" section
        // Spacer exists but nothing after it
        let entries = vec![
            Some("task-1".to_string()),
            Some("task-2".to_string()),
            None, // Spacer
        ];
        manager.update_entries(entries);

        // Verify in_progress_section_size is correct
        assert_eq!(manager.in_progress_section_size, 2);

        // Select a task
        manager.select_task("task-1".to_string());

        // Verify it's detected as InProgress
        assert_eq!(
            manager.get_selected_task_section(),
            Some(TaskSection::InProgress)
        );

        // Verify navigation works within the section
        manager.next();
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"task-2".to_string())
        );
        assert_eq!(
            manager.get_selected_task_section(),
            Some(TaskSection::InProgress)
        );
    }
}
