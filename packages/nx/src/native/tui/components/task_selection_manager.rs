/// Batch data structure containing scroll-related metrics to reduce lock contention
/// during scroll operations by gathering all needed information in a single lock acquisition
#[derive(Debug, Clone)]
pub struct ScrollMetrics {
    pub total_entries: usize,
    pub visible_task_count: usize,
    pub selected_absolute_index: Option<usize>,
    pub can_scroll_up: bool,
    pub can_scroll_down: bool,
}

pub struct TaskSelectionManager {
    // The list of task names in their current visual order, None represents empty rows
    entries: Vec<Option<String>>,
    // The currently selected task name
    selected_task_name: Option<String>,
    // Scroll offset for viewport management
    scroll_offset: usize,
    // Viewport height for visible area calculations
    viewport_height: usize,
    // Selection mode determines how the selection behaves when entries change
    selection_mode: SelectionMode,
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

impl TaskSelectionManager {
    pub fn new(viewport_height: usize) -> Self {
        Self {
            entries: Vec::new(),
            selected_task_name: None,
            scroll_offset: 0,
            viewport_height: viewport_height.max(1),
            selection_mode: SelectionMode::TrackByName,
        }
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
            SelectionMode::TrackByName => self.update_entries_track_by_name(entries),
            SelectionMode::TrackByPosition => self.update_entries_track_by_position(entries),
        }
    }

    /// Updates entries while trying to preserve the selected task by name
    fn update_entries_track_by_name(&mut self, entries: Vec<Option<String>>) {
        // Keep track of currently selected task name
        let selected = self.selected_task_name.clone();

        // Update the entries
        self.entries = entries;

        // If we had a selection, try to find it in the new list
        if let Some(task_name) = selected {
            // First check if the task still exists in the entries
            let task_still_exists = self
                .entries
                .iter()
                .any(|entry| entry.as_ref() == Some(&task_name));

            if task_still_exists {
                // Task is still in the list, keep it selected with the same name
                self.selected_task_name = Some(task_name);
                // Scroll to ensure the selected task is visible
                self.scroll_to_selected();
            } else {
                // If task is no longer in the list, select first available task
                self.select_first_available();
            }
        } else {
            // No previous selection, select first available task
            self.select_first_available();
        }
    }

    /// Updates entries while trying to preserve the selected position in the list
    fn update_entries_track_by_position(&mut self, entries: Vec<Option<String>>) {
        // Get the current selection index
        let selection_index = self.get_selected_index();

        // Update the entries
        self.entries = entries;

        // If we had a selection and there are entries, try to maintain the position
        if let Some(idx) = selection_index {
            // Find the next non-empty entry at or after the position
            for i in idx..self.entries.len() {
                if let Some(Some(name)) = self.entries.get(i) {
                    self.selected_task_name = Some(name.clone());
                    self.scroll_to_selected();
                    return;
                }
            }

            // If we can't find one after, try before
            for i in (0..idx).rev() {
                if let Some(Some(name)) = self.entries.get(i) {
                    self.selected_task_name = Some(name.clone());
                    self.scroll_to_selected();
                    return;
                }
            }

            // If we couldn't find anything, select first available
            self.select_first_available();
        } else {
            // No previous selection, select first available task
            self.select_first_available();
        }
    }

    pub fn select(&mut self, task_name: Option<String>) {
        match task_name {
            Some(name) if self.entries.iter().any(|e| e.as_ref() == Some(&name)) => {
                self.selected_task_name = Some(name);
                // Scroll to ensure the selected task is visible
                self.scroll_to_selected();
            }
            _ => {
                self.selected_task_name = None;
            }
        }
    }

    pub fn select_task(&mut self, task_id: String) {
        self.selected_task_name = Some(task_id);
        self.scroll_to_selected();
    }

    pub fn next(&mut self) {
        if let Some(current_idx) = self.get_selected_index() {
            // Find next non-empty entry
            for idx in (current_idx + 1)..self.entries.len() {
                if self.entries[idx].is_some() {
                    self.selected_task_name = self.entries[idx].clone();
                    self.scroll_to_selected();
                    return;
                }
            }
        } else {
            self.select_first_available();
        }
    }

    pub fn previous(&mut self) {
        if let Some(current_idx) = self.get_selected_index() {
            // Find previous non-empty entry
            for idx in (0..current_idx).rev() {
                if self.entries[idx].is_some() {
                    self.selected_task_name = self.entries[idx].clone();
                    self.scroll_to_selected();
                    return;
                }
            }
        } else {
            self.select_first_available();
        }
    }

    /// Scroll up by the specified number of lines
    pub fn scroll_up(&mut self, lines: usize) {
        self.scroll_offset = self.scroll_offset.saturating_sub(lines);
    }

    /// Scroll down by the specified number of lines
    pub fn scroll_down(&mut self, lines: usize) {
        let max_scroll = self.entries.len().saturating_sub(self.viewport_height);
        self.scroll_offset = (self.scroll_offset + lines).min(max_scroll);
    }

    /// Scroll to ensure the selected task is visible in the viewport
    pub fn scroll_to_selected(&mut self) {
        if let Some(idx) = self.get_selected_index() {
            // If selected task is above viewport, scroll up to show it
            if idx < self.scroll_offset {
                self.scroll_offset = idx;
            }
            // If selected task is below viewport, scroll down to show it
            else if idx >= self.scroll_offset + self.viewport_height {
                self.scroll_offset = idx.saturating_sub(self.viewport_height.saturating_sub(1));
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
        self.selected_task_name
            .as_ref()
            .is_some_and(|selected| selected == task_name)
    }

    pub fn get_selected_task_name(&self) -> Option<&String> {
        self.selected_task_name.as_ref()
    }

    /// Get total number of entries
    pub fn get_total_entries(&self) -> usize {
        self.entries.len()
    }

    /// Get the number of actual tasks visible in the current viewport
    /// This excludes None spacer entries from the viewport calculation
    pub fn get_visible_task_count(&self) -> usize {
        self.get_viewport_entries()
            .iter()
            .filter(|entry| entry.is_some())
            .count()
    }

    /// Get the absolute index of the currently selected task in the complete entries array
    /// This includes spacer entries and represents true progress through the complete task list
    pub fn get_selected_absolute_index(&self) -> Option<usize> {
        if let Some(selected_name) = &self.selected_task_name {
            self.entries
                .iter()
                .position(|entry| entry.as_ref().map_or(false, |name| name == selected_name))
        } else {
            None
        }
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
        self.selected_task_name = self.entries.iter().find_map(|e| e.clone());
        // Ensure selected task is visible in viewport
        self.scroll_to_selected();
    }

    /// Validate and adjust scroll offset to ensure it's within bounds
    fn validate_scroll_offset(&mut self) {
        let max_scroll = self.entries.len().saturating_sub(self.viewport_height);
        self.scroll_offset = self.scroll_offset.min(max_scroll);
    }

    pub fn get_selected_index(&self) -> Option<usize> {
        if let Some(task_name) = &self.selected_task_name {
            self.entries
                .iter()
                .position(|entry| entry.as_ref() == Some(task_name))
        } else {
            None
        }
    }

    /// Set the viewport height (visible area size)
    pub fn set_viewport_height(&mut self, viewport_height: usize) {
        self.viewport_height = viewport_height.max(1);
        self.validate_scroll_offset();
        self.scroll_to_selected();
    }

    /// Update viewport height and return current metrics in single lock acquisition.
    /// This combines the common pattern of setting viewport height and then querying
    /// multiple metrics, reducing lock contention during scroll operations.
    pub fn update_viewport_and_get_metrics(&mut self, viewport_height: usize) -> ScrollMetrics {
        self.set_viewport_height(viewport_height);
        ScrollMetrics {
            total_entries: self.get_total_entries(),
            visible_task_count: self.get_visible_task_count(),
            selected_absolute_index: self.get_selected_absolute_index(),
            can_scroll_up: self.can_scroll_up(),
            can_scroll_down: self.can_scroll_down(),
        }
    }
}

impl Default for TaskSelectionManager {
    fn default() -> Self {
        Self::new(10) // Default viewport height
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
}
