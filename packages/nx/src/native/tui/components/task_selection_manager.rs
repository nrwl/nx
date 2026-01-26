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
    // The current selection state (Some = selected, None = no selection)
    selection_state: Option<SelectionEntry>,
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
}

impl TaskSelectionManager {
    pub fn new(viewport_height: usize) -> Self {
        Self {
            entries: Vec::new(),
            selection_state: None,
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
        // If we had a selection, try to find same item or fall back to first available
        let new_selection = previous_state.and_then(|selection| {
            let selected_id = selection.id();
            self.entries
                .iter()
                .find_map(|e| e.as_ref().filter(|entry| entry.id() == selected_id))
                .or_else(|| self.entries.iter().find_map(|e| e.as_ref()))
                .cloned()
        });
        self.select(new_selection);
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
        let new_selection = selection_index.and_then(|idx| self.find_nearest_entry(idx).cloned());
        self.select(new_selection);
    }

    /// Selects an item, clears selection if None
    pub fn select(&mut self, selection: Option<SelectionEntry>) {
        self.selection_state = selection;
        self.invalidate_selection_cache();
        self.ensure_selected_visible();
    }

    /// Convenience: selects a task by ID
    pub fn select_task(&mut self, task_id: String) {
        self.select(Some(SelectionEntry::Task(task_id)));
    }

    /// Convenience: selects a batch group by ID
    pub fn select_batch_group(&mut self, batch_id: String) {
        self.select(Some(SelectionEntry::BatchGroup(batch_id)));
    }

    /// Determine which section a task belongs to based on its position in entries
    /// Returns None for batch groups (they don't belong to a section)
    fn determine_task_section(&self, selection: &SelectionEntry) -> Option<TaskSection> {
        // Batch groups don't belong to sections
        if matches!(selection, SelectionEntry::BatchGroup(_)) {
            return None;
        }

        let item_id = selection.id();

        // Find the item's index in entries
        let item_index = self
            .entries
            .iter()
            .position(|entry| entry.as_ref().map(|e| e.id()) == Some(item_id))?;

        // Check if it's in the in-progress section (before the first None spacer)
        if item_index < self.in_progress_section_size {
            Some(TaskSection::InProgress)
        } else {
            Some(TaskSection::Other)
        }
    }

    pub fn next(&mut self) {
        if self.selection_state.is_none() {
            self.select_first_available();
            self.ensure_selected_visible();
            return;
        }

        if let Some(current_idx) = self.get_selected_index() {
            // Find next non-empty entry
            for idx in (current_idx + 1)..self.entries.len() {
                if let Some(entry) = &self.entries[idx] {
                    self.select(Some(entry.clone()));
                    return;
                }
            }
            // No next selectable found - scroll to reveal trailing entries (extended scroll)
            if self.can_scroll_down() {
                self.scroll_down(1);
            }
        }
    }

    pub fn previous(&mut self) {
        if self.selection_state.is_none() {
            self.select_first_available();
            self.ensure_selected_visible();
            return;
        }

        if let Some(current_idx) = self.get_selected_index() {
            // Check if we've scrolled past selection (extended scroll mode)
            // This happens when at last selectable and user scrolled down to see trailing None entries
            let has_selectable_below = self.entries[(current_idx + 1)..]
                .iter()
                .any(|e| e.is_some());

            if !has_selectable_below && self.can_scroll_up() {
                // Check if selection is not at bottom of viewport (we've scrolled past it)
                let viewport_bottom_idx = self
                    .scroll_offset
                    .saturating_add(self.viewport_height)
                    .saturating_sub(1);
                if current_idx < viewport_bottom_idx {
                    // Scroll back up first before moving selection
                    self.scroll_up(1);
                    self.invalidate_viewport_cache();
                    return;
                }
            }

            // Normal: Find previous non-empty entry
            for idx in (0..current_idx).rev() {
                if let Some(entry) = &self.entries[idx] {
                    self.select(Some(entry.clone()));
                    return;
                }
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

    /// Gets the currently selected item as a SelectionEntry enum
    pub fn get_selection(&self) -> Option<&SelectionEntry> {
        self.selection_state.as_ref()
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

    /// Find the nearest non-empty entry to the given index, preferring entries at or after the index
    fn find_nearest_entry(&self, idx: usize) -> Option<&SelectionEntry> {
        let idx = idx.min(self.entries.len());

        // First try at or after position
        self.entries
            .get(idx..)
            .and_then(|slice| slice.iter().find_map(|e| e.as_ref()))
            .or_else(|| {
                // Then try before position (in reverse to find closest)
                self.entries
                    .get(..idx)
                    .and_then(|slice| slice.iter().rev().find_map(|e| e.as_ref()))
            })
    }

    /// Get the index of the currently selected task among actual tasks only (excludes spacers)
    /// This represents progress through tasks only, ignoring None spacer entries (which are never selected)
    pub fn get_selected_task_index(&mut self) -> Option<usize> {
        // Extract selected item from state, or return None if not selected
        let selection = match &self.selection_state {
            Some(sel) => sel,
            _ => return None,
        };

        // Return cached value if available (only valid when we have a selection)
        if let Some(cached_index) = self.selected_task_index_cache {
            return Some(cached_index);
        }

        // Cache miss - compute and store the result
        let selected_id = selection.id();
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
        let first = self.entries.iter().find_map(|e| e.as_ref()).cloned();
        self.select(first);
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
        let id = self.selection_state.as_ref()?.id();
        self.entries
            .iter()
            .position(|entry| entry.as_ref().map(|e| e.id()) == Some(id))
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
        self.selection_state
            .as_ref()
            .and_then(|sel| self.determine_task_section(sel))
    }

    /// Update the in-progress section size by counting entries before the first spacer
    fn update_in_progress_section_size(&mut self) {
        self.in_progress_section_size = self.entries.iter().take_while(|e| e.is_some()).count();
    }

    /// Get all in-progress items (tasks and batch groups)
    pub fn get_in_progress_items(&self) -> Vec<SelectionEntry> {
        let safe_size = self.in_progress_section_size.min(self.entries.len());
        self.entries[0..safe_size]
            .iter()
            .filter_map(|e| e.clone())
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
            self.select(Some(SelectionEntry::Task(task_id)));
            return;
        }

        // Check if in-progress section is empty but there are pending tasks
        if in_progress_items.is_empty() {
            // Wait for next allocation - enter "waiting state"
            self.select(None);
            return;
        }

        // Switch to position tracking at the old index
        let target_index = old_in_progress_index.unwrap_or(0);

        // Try to select item at old index, falling back to lower indices
        for idx in (0..=target_index).rev() {
            if let Some(item) = in_progress_items.get(idx) {
                self.select(Some(item.clone()));
                return;
            }
        }

        // Shouldn't reach here, but fallback to first in-progress item
        if let Some(item) = in_progress_items.first() {
            self.select(Some(item.clone()));
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
            Some(SelectionEntry::Task(selected_task)) if selected_task != &task_id => {
                return;
            }
            Some(SelectionEntry::BatchGroup(_)) => return,
            None => return,
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
            if self.selection_state.is_none() {
                self.select(Some(SelectionEntry::Task(task_id)));
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
        assert_eq!(manager.get_selection(), None);
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
            manager.get_selection(),
            Some(&SelectionEntry::Task("Task 1".to_string()))
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
            manager.get_selection(),
            Some(&SelectionEntry::Task("Task 1".to_string()))
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
            manager.get_selection(),
            Some(&SelectionEntry::Task("Task 1".to_string()))
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
            manager.get_selection(),
            Some(&SelectionEntry::Task("Task 3".to_string()))
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
        manager.select_task("Task 2".to_string());
        assert_eq!(
            manager.get_selection(),
            Some(&SelectionEntry::Task("Task 2".to_string()))
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
            manager.get_selection(),
            Some(&SelectionEntry::Task("Task 1".to_string()))
        );
        manager.next();
        assert_eq!(
            manager.get_selection(),
            Some(&SelectionEntry::Task("Task 2".to_string()))
        );

        // Test previous
        manager.previous();
        assert_eq!(
            manager.get_selection(),
            Some(&SelectionEntry::Task("Task 1".to_string()))
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
            manager.get_selection(),
            Some(&SelectionEntry::Task("Task 1".to_string()))
        );

        // Update with empty entries
        let entries: Vec<Option<SelectionEntry>> = vec![];
        manager.update_entries(entries);

        // No entries, so no selection
        assert_eq!(manager.get_selection(), None);
    }

    #[test]
    fn test_batch_selection_type_detection() {
        let mut manager = TaskSelectionManager::new(2);

        // Test batch group selection
        manager.select_batch_group("my-batch-id".to_string());
        assert_eq!(
            manager.get_selection(),
            Some(&SelectionEntry::BatchGroup("my-batch-id".to_string()))
        );

        // Test task selection
        manager.select_task("my-task".to_string());
        assert_eq!(
            manager.get_selection(),
            Some(&SelectionEntry::Task("my-task".to_string()))
        );

        // Test another task selection
        manager.select_task("regular-task".to_string());
        assert_eq!(
            manager.get_selection(),
            Some(&SelectionEntry::Task("regular-task".to_string()))
        );

        // Test no selection
        let entries: Vec<Option<SelectionEntry>> = vec![];
        manager.update_entries(entries);
        assert_eq!(manager.get_selection(), None);
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
        assert_eq!(
            manager.get_selection(),
            Some(&SelectionEntry::Task("task1".to_string()))
        );

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
        assert!(matches!(manager.selection_state, None));

        // Navigation should exit waiting state
        manager.next();
        assert!(matches!(manager.selection_state, Some(_)));
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
