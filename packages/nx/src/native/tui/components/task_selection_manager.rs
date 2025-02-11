pub struct TaskSelectionManager {
    // The list of task names in their current visual order, None represents empty rows
    entries: Vec<Option<String>>,
    // The currently selected task name
    selected_task_name: Option<String>,
    // Current page and pagination settings
    current_page: usize,
    items_per_page: usize,
}

impl TaskSelectionManager {
    pub fn new(items_per_page: usize) -> Self {
        Self {
            entries: Vec::new(),
            selected_task_name: None,
            current_page: 0,
            items_per_page,
        }
    }

    pub fn update_entries(&mut self, entries: Vec<Option<String>>) {
        // Keep track of currently selected task name
        let selected = self.selected_task_name.clone();

        // Update the entries
        self.entries = entries;

        // Ensure current page is valid before validating selection
        self.validate_current_page();

        // If we had a selection, try to find it in the new list
        if let Some(task_name) = selected {
            if !self
                .entries
                .iter()
                .any(|entry| entry.as_ref() == Some(&task_name))
            {
                // If task is no longer in the list, select first available task
                self.select_first_available();
            }
        } else {
            // No previous selection, select first available task
            self.select_first_available();
        }

        // Validate selection for current page
        self.validate_selection_for_current_page();
    }

    pub fn select(&mut self, task_name: Option<String>) {
        match task_name {
            Some(name) if self.entries.iter().any(|e| e.as_ref() == Some(&name)) => {
                self.selected_task_name = Some(name);
                // Update current page to show selected task
                if let Some(idx) = self
                    .entries
                    .iter()
                    .position(|e| e.as_deref() == self.selected_task_name.as_deref())
                {
                    self.current_page = idx / self.items_per_page;
                }
            }
            _ => {
                self.selected_task_name = None;
            }
        }
    }

    pub fn next(&mut self) {
        if let Some(current_idx) = self.get_selected_index() {
            // Find next non-empty entry
            for idx in (current_idx + 1)..self.entries.len() {
                if self.entries[idx].is_some() {
                    self.selected_task_name = self.entries[idx].clone();
                    // Update page if needed
                    self.current_page = idx / self.items_per_page;
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
                    // Update page if needed
                    self.current_page = idx / self.items_per_page;
                    return;
                }
            }
        } else {
            self.select_first_available();
        }
    }

    pub fn next_page(&mut self) {
        let total_pages = self.total_pages();
        if self.current_page < total_pages - 1 {
            self.current_page += 1;
            self.validate_selection_for_current_page();
        }
    }

    pub fn previous_page(&mut self) {
        if self.current_page > 0 {
            self.current_page -= 1;
            self.validate_selection_for_current_page();
        }
    }

    pub fn get_current_page_entries(&self) -> Vec<Option<String>> {
        let start = self.current_page * self.items_per_page;
        let end = (start + self.items_per_page).min(self.entries.len());
        self.entries[start..end].to_vec()
    }

    pub fn is_selected(&self, task_name: &str) -> bool {
        self.selected_task_name
            .as_ref()
            .map_or(false, |selected| selected == task_name)
    }

    pub fn get_selected_task_name(&self) -> Option<&String> {
        self.selected_task_name.as_ref()
    }

    pub fn total_pages(&self) -> usize {
        (self.entries.len() + self.items_per_page - 1) / self.items_per_page
    }

    pub fn get_current_page(&self) -> usize {
        self.current_page
    }

    fn select_first_available(&mut self) {
        self.selected_task_name = self.entries.iter().find_map(|e| e.clone());
        // Ensure selected task is on current page
        self.validate_selection_for_current_page();
    }

    fn validate_current_page(&mut self) {
        let total_pages = self.total_pages();
        if total_pages == 0 {
            self.current_page = 0;
        } else {
            self.current_page = self.current_page.min(total_pages - 1);
        }
    }

    fn validate_selection_for_current_page(&mut self) {
        if let Some(task_name) = &self.selected_task_name {
            let start = self.current_page * self.items_per_page;
            let end = (start + self.items_per_page).min(self.entries.len());

            // Check if selected task is on current page
            if start < end && !self.entries[start..end]
                .iter()
                .any(|e| e.as_ref() == Some(task_name))
            {
                // If not, select first available task on current page
                self.selected_task_name = self.entries[start..end].iter().find_map(|e| e.clone());
            }
        }
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

    pub fn get_selected_index_in_current_page(&self) -> Option<usize> {
        if let Some(task_name) = &self.selected_task_name {
            let current_page_entries = self.get_current_page_entries();
            current_page_entries.iter().position(|entry| entry.as_ref() == Some(task_name))
        } else {
            None
        }
    }

    pub fn set_items_per_page(&mut self, items_per_page: usize) {
        // Ensure we never set items_per_page to 0
        self.items_per_page = items_per_page.max(1);
        self.validate_current_page();
        self.validate_selection_for_current_page();
    }

    pub fn get_items_per_page(&self) -> usize {
        self.items_per_page
    }
}

impl Default for TaskSelectionManager {
    fn default() -> Self {
        Self::new(5) // Default to 5 items per page
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_manager() {
        let manager = TaskSelectionManager::new(5);
        assert_eq!(manager.get_selected_task_name(), None);
        assert_eq!(manager.get_current_page(), 0);
    }

    #[test]
    fn test_update_entries() {
        let mut manager = TaskSelectionManager::new(2);
        let entries = vec![Some("Task 1".to_string()), None, Some("Task 2".to_string())];
        manager.update_entries(entries);
        assert_eq!(
            manager.get_selected_task_name(),
            Some(&"Task 1".to_string())
        );
        assert_eq!(manager.total_pages(), 2);
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
        assert_eq!(manager.get_current_page(), 1); // Should move to page containing Task 2
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
    fn test_pagination() {
        let mut manager = TaskSelectionManager::new(2);
        let entries = vec![
            Some("Task 1".to_string()),
            Some("Task 2".to_string()),
            Some("Task 3".to_string()),
            Some("Task 4".to_string()),
        ];
        manager.update_entries(entries);

        assert_eq!(manager.total_pages(), 2);
        assert_eq!(manager.get_current_page(), 0);

        // Test next page
        manager.next_page();
        assert_eq!(manager.get_current_page(), 1);
        let page_entries = manager.get_current_page_entries();
        assert_eq!(page_entries.len(), 2);
        assert_eq!(page_entries[0], Some("Task 3".to_string()));

        // Test previous page
        manager.previous_page();
        assert_eq!(manager.get_current_page(), 0);
        let page_entries = manager.get_current_page_entries();
        assert_eq!(page_entries[0], Some("Task 1".to_string()));
    }

    #[test]
    fn test_is_selected() {
        let mut manager = TaskSelectionManager::new(2);
        let entries = vec![Some("Task 1".to_string()), Some("Task 2".to_string())];
        manager.update_entries(entries);

        assert!(manager.is_selected("Task 1"));
        assert!(!manager.is_selected("Task 2"));
    }
}
