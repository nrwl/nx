use ratatui::layout::{Constraint, Direction, Layout, Rect};

/// Represents the available layout modes for the TUI application.
///
/// - `Auto`: Layout is determined based on available terminal space
/// - `Vertical`: Forces vertical layout (task list above terminal panes)
/// - `Horizontal`: Forces horizontal layout (task list beside terminal panes)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LayoutMode {
    Auto,
    Vertical,
    Horizontal,
}

impl Default for LayoutMode {
    fn default() -> Self {
        Self::Auto
    }
}

/// Represents the possible arrangements of terminal panes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaneArrangement {
    /// No terminal panes are visible.
    None,
    /// Only one terminal pane is visible.
    Single,
    /// Two terminal panes are visible, side by side or stacked.
    Double,
}

/// Represents the visibility state of the task list.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskListVisibility {
    Visible,
    Hidden,
}

impl Default for TaskListVisibility {
    fn default() -> Self {
        Self::Visible
    }
}

/// Configuration for the layout calculations.
#[derive(Debug, Clone)]
pub struct LayoutConfig {
    /// The mode that determines how components are arranged.
    pub mode: LayoutMode,
    /// The visibility state of the task list.
    pub task_list_visibility: TaskListVisibility,
    /// The arrangement of terminal panes.
    pub pane_arrangement: PaneArrangement,
    /// The total number of tasks.
    pub task_count: usize,
}

impl Default for LayoutConfig {
    fn default() -> Self {
        Self {
            mode: LayoutMode::Auto,
            task_list_visibility: TaskListVisibility::Visible,
            pane_arrangement: PaneArrangement::None,
            task_count: 5,
        }
    }
}

/// Output of layout calculations containing areas for each component.
#[derive(Debug, Clone)]
pub struct LayoutAreas {
    /// Area for the task list, if visible.
    pub task_list: Option<Rect>,
    /// Areas for terminal panes.
    pub terminal_panes: Vec<Rect>,
}

/// Manages the layout of components in the TUI application.
///
/// The LayoutManager is responsible for calculating the optimal layout
/// for the task list and terminal panes based on the available terminal
/// space and the configured layout mode.
pub struct LayoutManager {
    /// The current layout mode.
    mode: LayoutMode,
    /// The minimum width required for a horizontal layout to be viable.
    min_horizontal_width: u16,
    /// The minimum height required for a vertical layout to be viable.
    min_vertical_height: u16,
    /// The arrangement of terminal panes.
    pane_arrangement: PaneArrangement,
    /// The visibility state of the task list.
    task_list_visibility: TaskListVisibility,
    /// The total number of tasks.
    task_count: usize,
    /// Padding between task list and terminal panes in horizontal layout (left-right).
    horizontal_padding: u16,
    /// Padding between task list and terminal panes in vertical layout (top-bottom).
    vertical_padding: u16,
}

impl LayoutManager {
    /// Creates a new LayoutManager with default settings.
    pub fn new(task_count: usize) -> Self {
        Self {
            mode: LayoutMode::Auto,
            // TODO: figure out these values
            min_horizontal_width: 120, // Minimum width for horizontal layout to be viable
            min_vertical_height: 30,   // Minimum height for vertical layout to be viable
            pane_arrangement: PaneArrangement::None,
            task_list_visibility: if task_count > 1 {
                TaskListVisibility::Visible
            } else {
                TaskListVisibility::Hidden
            },
            task_count,
            horizontal_padding: 2, // Default horizontal padding of 2 characters
            vertical_padding: 1,   // Default vertical padding of 1 character
        }
    }

    /// Sets the layout mode.
    pub fn set_mode(&mut self, mode: LayoutMode) {
        self.mode = mode;
    }

    /// Gets the current layout mode.
    pub fn get_mode(&self) -> LayoutMode {
        self.mode
    }

    /// Manually toggle the layout mode.
    /// Initially we will be attempting to automatically pick the best layout using auto, but with this function we should
    /// figure out our current orientation and toggle it to the opposite.
    /// i.e. in the simple case, if currently horizontal, toggle to vertical and vice versa.
    /// In the case where we are in auto mode, we need to figure out our current orientation and set the mode to the opposite.
    pub fn toggle_layout_mode(&mut self, area: Rect) {
        self.mode = match self.mode {
            LayoutMode::Auto => {
                // If we are in auto mode, we need to figure out our current orientation and set the mode to the opposite.
                if self.is_vertical_layout_preferred(area.width, area.height) {
                    LayoutMode::Horizontal
                } else {
                    LayoutMode::Vertical
                }
            }
            LayoutMode::Vertical => LayoutMode::Horizontal,
            LayoutMode::Horizontal => LayoutMode::Vertical,
        };
    }

    /// Sets the pane arrangement.
    pub fn set_pane_arrangement(&mut self, pane_arrangement: PaneArrangement) {
        self.pane_arrangement = pane_arrangement;
    }

    /// Gets the current pane arrangement.
    pub fn get_pane_arrangement(&self) -> PaneArrangement {
        self.pane_arrangement
    }

    /// Sets the task list visibility.
    pub fn set_task_list_visibility(&mut self, visibility: TaskListVisibility) {
        self.task_list_visibility = visibility;
    }

    /// Gets the current task list visibility.
    pub fn get_task_list_visibility(&self) -> TaskListVisibility {
        self.task_list_visibility
    }

    pub fn toggle_task_list_visibility(&mut self) {
        self.task_list_visibility = match self.task_list_visibility {
            TaskListVisibility::Visible => TaskListVisibility::Hidden,
            TaskListVisibility::Hidden => TaskListVisibility::Visible,
        };
    }

    /// Sets the task count.
    pub fn set_task_count(&mut self, count: usize) {
        self.task_count = count;
    }

    /// Gets the current task count.
    pub fn get_task_count(&self) -> usize {
        self.task_count
    }

    /// Sets the horizontal padding between task list and terminal panes.
    pub fn set_horizontal_padding(&mut self, padding: u16) {
        self.horizontal_padding = padding;
    }

    /// Gets the current horizontal padding between task list and terminal panes.
    pub fn get_horizontal_padding(&self) -> u16 {
        self.horizontal_padding
    }

    /// Sets the vertical padding between task list and terminal panes.
    pub fn set_vertical_padding(&mut self, padding: u16) {
        self.vertical_padding = padding;
    }

    /// Gets the current vertical padding between task list and terminal panes.
    pub fn get_vertical_padding(&self) -> u16 {
        self.vertical_padding
    }

    /// Calculates the layout based on the given terminal area.
    ///
    /// Returns a LayoutAreas struct containing the calculated areas for each component.
    pub fn calculate_layout(&self, area: Rect) -> LayoutAreas {
        // Basic bounds checking to prevent crashes
        if area.width == 0 || area.height == 0 {
            return LayoutAreas {
                task_list: None,
                terminal_panes: Vec::new(),
            };
        }

        match self.task_list_visibility {
            TaskListVisibility::Hidden => self.calculate_layout_hidden_task_list(area),
            TaskListVisibility::Visible => self.calculate_layout_visible_task_list(area),
        }
    }

    /// Calculates the layout when the task list is hidden.
    fn calculate_layout_hidden_task_list(&self, area: Rect) -> LayoutAreas {
        let terminal_panes = match self.pane_arrangement {
            PaneArrangement::None => Vec::new(),
            PaneArrangement::Single => vec![area],
            PaneArrangement::Double => {
                // Split the area into two equal parts
                let chunks = Layout::default()
                    .direction(Direction::Horizontal)
                    .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
                    .split(area);
                vec![chunks[0], chunks[1]]
            }
        };

        LayoutAreas {
            task_list: None,
            terminal_panes,
        }
    }

    /// Calculates the layout when the task list is visible.
    fn calculate_layout_visible_task_list(&self, area: Rect) -> LayoutAreas {
        // Determine whether to use vertical or horizontal layout
        let use_vertical = match self.mode {
            LayoutMode::Auto => self.is_vertical_layout_preferred(area.width, area.height),
            LayoutMode::Vertical => true,
            LayoutMode::Horizontal => false,
        };

        if use_vertical {
            self.calculate_vertical_layout(area)
        } else {
            self.calculate_horizontal_layout(area)
        }
    }

    /// Calculates a vertical layout (task list above terminal panes).
    fn calculate_vertical_layout(&self, area: Rect) -> LayoutAreas {
        // If no panes, task list gets the full area
        if self.pane_arrangement == PaneArrangement::None {
            return LayoutAreas {
                task_list: Some(area),
                terminal_panes: Vec::new(),
            };
        }

        // Prevent divide-by-zero
        let task_list_height = if area.height < 3 { 1 } else { area.height / 3 };

        // Apply padding only if there's enough space
        let padding_height = if area.height > task_list_height + self.vertical_padding {
            self.vertical_padding
        } else {
            0
        };

        // Ensure terminal pane has at least 1 row
        let available_height = area.height.saturating_sub(task_list_height);
        let terminal_pane_height = available_height.saturating_sub(padding_height);

        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(task_list_height),
                Constraint::Length(padding_height),
                Constraint::Length(terminal_pane_height),
            ])
            .split(area);

        let task_list_area = chunks[0];
        let terminal_pane_area = chunks[2]; // Skip the padding area (chunks[1])

        let terminal_panes = match self.pane_arrangement {
            PaneArrangement::None => Vec::new(),
            PaneArrangement::Single => vec![terminal_pane_area],
            PaneArrangement::Double => {
                // Split the terminal pane area horizontally for two panes
                let pane_chunks = Layout::default()
                    .direction(Direction::Horizontal)
                    .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
                    .split(terminal_pane_area);
                vec![pane_chunks[0], pane_chunks[1]]
            }
        };

        LayoutAreas {
            task_list: Some(task_list_area),
            terminal_panes,
        }
    }

    /// Calculates a horizontal layout (task list beside terminal panes).
    fn calculate_horizontal_layout(&self, area: Rect) -> LayoutAreas {
        // If no panes, task list gets the full area
        if self.pane_arrangement == PaneArrangement::None {
            return LayoutAreas {
                task_list: Some(area),
                terminal_panes: Vec::new(),
            };
        }

        // Prevent divide-by-zero
        let task_list_width = if area.width < 3 { 1 } else { area.width / 3 };

        // Apply padding only if there's enough space
        let padding_width = if area.width > task_list_width + self.horizontal_padding {
            self.horizontal_padding
        } else {
            0
        };

        // Ensure terminal pane has at least 1 column
        let available_width = area.width.saturating_sub(task_list_width);
        let terminal_pane_width = available_width.saturating_sub(padding_width);

        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Length(task_list_width),
                Constraint::Length(padding_width),
                Constraint::Length(terminal_pane_width),
            ])
            .split(area);

        let task_list_area = chunks[0];
        let terminal_pane_area = chunks[2]; // Skip the padding area (chunks[1])

        let terminal_panes = match self.pane_arrangement {
            PaneArrangement::None => Vec::new(),
            PaneArrangement::Single => vec![terminal_pane_area],
            PaneArrangement::Double => {
                // For two panes, split the terminal pane area vertically
                let pane_chunks = Layout::default()
                    .direction(Direction::Vertical)
                    .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
                    .split(terminal_pane_area);
                vec![pane_chunks[0], pane_chunks[1]]
            }
        };

        LayoutAreas {
            task_list: Some(task_list_area),
            terminal_panes,
        }
    }

    /// Creates a LayoutConfig from the current internal state.
    pub fn create_config(&self) -> LayoutConfig {
        LayoutConfig {
            mode: self.mode,
            task_list_visibility: self.task_list_visibility,
            pane_arrangement: self.pane_arrangement,
            task_count: self.task_count,
        }
    }

    /// Sets the minimum width required for a horizontal layout.
    pub fn set_min_horizontal_width(&mut self, width: u16) {
        self.min_horizontal_width = width;
    }

    /// Sets the minimum height required for a vertical layout.
    pub fn set_min_vertical_height(&mut self, height: u16) {
        self.min_vertical_height = height;
    }

    /// Determines if a vertical layout is preferred based on terminal dimensions and tasks.
    ///
    /// This is used in Auto mode to decide between vertical and horizontal layouts.
    ///
    /// Factors that influence the decision:
    /// - Terminal aspect ratio
    /// - Number of tasks (single task prefers vertical layout)
    /// - Minimum dimensions requirements
    fn is_vertical_layout_preferred(&self, terminal_width: u16, terminal_height: u16) -> bool {
        // Screen is pretty narrow so always prefer vertical layout
        if terminal_width < 75 {
            return true;
        }

        // Calculate aspect ratio (width/height)
        let aspect_ratio = terminal_width as f32 / terminal_height as f32;

        // If very wide and not very tall, prefer horizontal
        if aspect_ratio > 2.0 && terminal_height < self.min_vertical_height {
            return false;
        }

        // If very tall and not very wide, prefer vertical
        if aspect_ratio < 1.0 && terminal_width < self.min_horizontal_width {
            return true;
        }

        // Otherwise, prefer horizontal for wider terminals, vertical for taller ones
        aspect_ratio < 1.5
    }
}

impl Default for LayoutManager {
    fn default() -> Self {
        Self::new(5)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_area(width: u16, height: u16) -> Rect {
        Rect::new(0, 0, width, height)
    }

    #[test]
    fn test_default_mode_is_auto() {
        let layout_manager = LayoutManager::new(5);
        assert_eq!(layout_manager.get_mode(), LayoutMode::Auto);
    }

    #[test]
    fn test_default_properties() {
        let layout_manager = LayoutManager::new(5);
        assert_eq!(layout_manager.get_pane_arrangement(), PaneArrangement::None);
        assert_eq!(
            layout_manager.get_task_list_visibility(),
            TaskListVisibility::Visible
        );
        assert_eq!(layout_manager.get_task_count(), 5);
    }

    #[test]
    fn test_set_properties() {
        let mut layout_manager = LayoutManager::new(5);

        // Test setting pane arrangement
        layout_manager.set_pane_arrangement(PaneArrangement::Double);
        assert_eq!(
            layout_manager.get_pane_arrangement(),
            PaneArrangement::Double
        );

        // Test setting task list visibility
        layout_manager.set_task_list_visibility(TaskListVisibility::Hidden);
        assert_eq!(
            layout_manager.get_task_list_visibility(),
            TaskListVisibility::Hidden
        );

        // Test setting task count
        layout_manager.set_task_count(10);
        assert_eq!(layout_manager.get_task_count(), 10);
    }

    #[test]
    fn test_hidden_task_list_layout() {
        let mut layout_manager = LayoutManager::new(5);
        let area = create_test_area(100, 50);

        layout_manager.set_task_list_visibility(TaskListVisibility::Hidden);
        layout_manager.set_pane_arrangement(PaneArrangement::Single);
        layout_manager.set_task_count(5);

        let layout = layout_manager.calculate_layout(area);
        assert!(layout.task_list.is_none());
        assert_eq!(layout.terminal_panes.len(), 1);
        assert_eq!(layout.terminal_panes[0], area);
    }

    #[test]
    fn test_hidden_task_list_with_double_panes() {
        let mut layout_manager = LayoutManager::new(5);
        let area = create_test_area(100, 50);

        layout_manager.set_task_list_visibility(TaskListVisibility::Hidden);
        layout_manager.set_pane_arrangement(PaneArrangement::Double);
        layout_manager.set_task_count(5);

        let layout = layout_manager.calculate_layout(area);
        assert!(layout.task_list.is_none());
        assert_eq!(layout.terminal_panes.len(), 2);
        assert_eq!(layout.terminal_panes[0].width, 50); // Half of total width
        assert_eq!(layout.terminal_panes[1].width, 50);
    }

    #[test]
    fn test_auto_mode_selects_horizontal_for_wide_terminal() {
        let mut layout_manager = LayoutManager::new(5);
        let area = create_test_area(200, 60); // Wide terminal

        layout_manager.set_mode(LayoutMode::Auto);
        layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
        layout_manager.set_pane_arrangement(PaneArrangement::Single);
        layout_manager.set_task_count(5);

        let layout = layout_manager.calculate_layout(area);
        assert!(layout.task_list.is_some());

        // In horizontal layout, task list should be on the left, taking about 1/3 of width
        let task_list = layout.task_list.unwrap();
        assert_eq!(task_list.x, 0);
        assert_eq!(task_list.y, 0);
        assert_eq!(task_list.width, 200 / 3);
        assert_eq!(task_list.height, 60);
    }

    #[test]
    fn test_auto_mode_selects_vertical_for_tall_terminal() {
        let mut layout_manager = LayoutManager::new(5);
        let area = create_test_area(80, 100); // Tall terminal

        layout_manager.set_mode(LayoutMode::Auto);
        layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
        layout_manager.set_pane_arrangement(PaneArrangement::Single);
        layout_manager.set_task_count(5);

        let layout = layout_manager.calculate_layout(area);
        assert!(layout.task_list.is_some());

        // In vertical layout, task list should be on top, taking about 1/3 of height
        let task_list = layout.task_list.unwrap();
        assert_eq!(task_list.x, 0);
        assert_eq!(task_list.y, 0);
        assert_eq!(task_list.width, 80);
        assert_eq!(task_list.height, 100 / 3);
    }

    #[test]
    fn test_forced_vertical_mode() {
        let mut layout_manager = LayoutManager::new(5);
        let area = create_test_area(200, 60); // Wide terminal that would normally use horizontal

        layout_manager.set_mode(LayoutMode::Vertical);
        layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
        layout_manager.set_pane_arrangement(PaneArrangement::Single);
        layout_manager.set_task_count(5);

        let layout = layout_manager.calculate_layout(area);
        assert!(layout.task_list.is_some());

        // Even though terminal is wide, layout should be vertical
        let task_list = layout.task_list.unwrap();
        assert_eq!(task_list.x, 0);
        assert_eq!(task_list.y, 0);
        assert_eq!(task_list.width, 200);
        assert_eq!(task_list.height, 60 / 3);
    }

    #[test]
    fn test_forced_horizontal_mode() {
        let mut layout_manager = LayoutManager::new(5);
        let area = create_test_area(80, 100); // Tall terminal that would normally use vertical

        layout_manager.set_mode(LayoutMode::Horizontal);
        layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
        layout_manager.set_pane_arrangement(PaneArrangement::Single);
        layout_manager.set_task_count(5);

        let layout = layout_manager.calculate_layout(area);
        assert!(layout.task_list.is_some());

        // Even though terminal is tall, layout should be horizontal
        let task_list = layout.task_list.unwrap();
        assert_eq!(task_list.x, 0);
        assert_eq!(task_list.y, 0);
        assert_eq!(task_list.width, 80 / 3);
        assert_eq!(task_list.height, 100);
    }

    #[test]
    fn test_double_panes_in_vertical_layout() {
        let mut layout_manager = LayoutManager::new(5);
        let area = create_test_area(100, 80);

        layout_manager.set_mode(LayoutMode::Vertical);
        layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
        layout_manager.set_pane_arrangement(PaneArrangement::Double);
        layout_manager.set_task_count(5);

        let layout = layout_manager.calculate_layout(area);
        assert_eq!(layout.terminal_panes.len(), 2);

        // In vertical layout with two panes, they should be side by side
        // below the task list
        assert_eq!(layout.terminal_panes[0].width, 50); // Half of total width
        assert_eq!(layout.terminal_panes[1].width, 50);
        assert_eq!(
            layout.terminal_panes[0].height,
            layout.terminal_panes[1].height
        );
        assert!(layout.terminal_panes[0].y > layout.task_list.unwrap().y);
    }

    #[test]
    fn test_double_panes_in_horizontal_layout() {
        let mut layout_manager = LayoutManager::new(5);
        let area = create_test_area(150, 60);

        layout_manager.set_mode(LayoutMode::Horizontal);
        layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
        layout_manager.set_pane_arrangement(PaneArrangement::Double);
        layout_manager.set_task_count(5);

        let layout = layout_manager.calculate_layout(area);
        assert_eq!(layout.terminal_panes.len(), 2);

        // In horizontal layout with two panes, they should be stacked
        // to the right of the task list
        assert_eq!(layout.terminal_panes[0].height, 30); // Half of total height
        assert_eq!(layout.terminal_panes[1].height, 30);
        assert_eq!(
            layout.terminal_panes[0].width,
            layout.terminal_panes[1].width
        );
        assert!(layout.terminal_panes[0].x > layout.task_list.unwrap().x);
    }

    #[test]
    fn test_no_panes() {
        let mut layout_manager = LayoutManager::new(5);
        let area = create_test_area(100, 50);

        layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
        layout_manager.set_pane_arrangement(PaneArrangement::None);
        layout_manager.set_task_count(5);

        let layout = layout_manager.calculate_layout(area);
        assert!(layout.task_list.is_some());
        assert_eq!(layout.terminal_panes.len(), 0);
    }

    #[test]
    fn test_create_config() {
        let mut layout_manager = LayoutManager::new(5);

        // Set custom values for all properties
        layout_manager.set_mode(LayoutMode::Vertical);
        layout_manager.set_pane_arrangement(PaneArrangement::Double);
        layout_manager.set_task_list_visibility(TaskListVisibility::Hidden);
        layout_manager.set_task_count(8);

        // Create config from internal state
        let config = layout_manager.create_config();

        // Verify all properties match
        assert_eq!(config.mode, LayoutMode::Vertical);
        assert_eq!(config.pane_arrangement, PaneArrangement::Double);
        assert_eq!(config.task_list_visibility, TaskListVisibility::Hidden);
        assert_eq!(config.task_count, 8);
    }

    #[test]
    fn test_padding_between_components() {
        let mut layout_manager = LayoutManager::new(5);
        let area = create_test_area(100, 60);

        // Test with default horizontal padding (2)
        layout_manager.set_mode(LayoutMode::Horizontal);
        layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
        layout_manager.set_pane_arrangement(PaneArrangement::Single);

        let layout = layout_manager.calculate_layout(area);
        let task_list = layout.task_list.unwrap();
        let terminal_pane = layout.terminal_panes[0];

        // The gap between task list and terminal pane should equal the horizontal padding
        assert_eq!(terminal_pane.x - (task_list.x + task_list.width), 2);

        // Test with increased horizontal padding
        layout_manager.set_horizontal_padding(3);
        let layout = layout_manager.calculate_layout(area);
        let task_list = layout.task_list.unwrap();
        let terminal_pane = layout.terminal_panes[0];

        // The gap should now be 3
        assert_eq!(terminal_pane.x - (task_list.x + task_list.width), 3);

        // Test with vertical layout and default vertical padding (1)
        layout_manager.set_mode(LayoutMode::Vertical);
        let layout = layout_manager.calculate_layout(area);
        let task_list = layout.task_list.unwrap();
        let terminal_pane = layout.terminal_panes[0];

        // The gap should be vertical and equal to the vertical padding
        assert_eq!(terminal_pane.y - (task_list.y + task_list.height), 1);

        // Test with increased vertical padding
        layout_manager.set_vertical_padding(2);
        let layout = layout_manager.calculate_layout(area);
        let task_list = layout.task_list.unwrap();
        let terminal_pane = layout.terminal_panes[0];

        // The gap should now be 2
        assert_eq!(terminal_pane.y - (task_list.y + task_list.height), 2);
    }

    #[cfg(test)]
    mod visual_tests {
        use super::*;
        use ratatui::widgets::{Block, Borders};
        use ratatui::{Terminal, backend::TestBackend};

        /// Render a layout configuration to a TestBackend for visualization
        fn render_layout(
            width: u16,
            height: u16,
            layout_manager: &LayoutManager,
        ) -> Terminal<TestBackend> {
            let backend = TestBackend::new(width, height);
            let mut terminal = Terminal::new(backend).unwrap();

            terminal
                .draw(|frame| {
                    let areas = layout_manager.calculate_layout(frame.area());

                    // Render task list if visible
                    if let Some(task_list_area) = areas.task_list {
                        let task_list_block =
                            Block::default().title("Task List").borders(Borders::ALL);

                        frame.render_widget(task_list_block, task_list_area);
                    }

                    // Render terminal panes
                    for (i, pane_area) in areas.terminal_panes.iter().enumerate() {
                        let pane_block = Block::default()
                            .title(format!("Terminal Pane {}", i + 1))
                            .borders(Borders::ALL);

                        frame.render_widget(pane_block, *pane_area);
                    }
                })
                .unwrap();

            terminal
        }

        /// Visual test for horizontal layout with two panes
        #[test]
        fn test_visualize_horizontal_layout_with_two_panes() {
            let mut layout_manager = LayoutManager::new(5);
            layout_manager.set_mode(LayoutMode::Horizontal);
            layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
            layout_manager.set_pane_arrangement(PaneArrangement::Double);
            layout_manager.set_task_count(5);

            let terminal = render_layout(100, 40, &layout_manager);
            insta::assert_snapshot!(terminal.backend());
        }

        /// Visual test for vertical layout with two panes
        #[test]
        fn test_visualize_vertical_layout_with_two_panes() {
            let mut layout_manager = LayoutManager::new(5);
            layout_manager.set_mode(LayoutMode::Vertical);
            layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
            layout_manager.set_pane_arrangement(PaneArrangement::Double);
            layout_manager.set_task_count(5);

            let terminal = render_layout(100, 40, &layout_manager);
            insta::assert_snapshot!(terminal.backend());
        }

        /// Visual test for hidden task list with two panes
        #[test]
        fn test_visualize_hidden_task_list_with_two_panes() {
            let mut layout_manager = LayoutManager::new(5);
            layout_manager.set_mode(LayoutMode::Auto);
            layout_manager.set_task_list_visibility(TaskListVisibility::Hidden);
            layout_manager.set_pane_arrangement(PaneArrangement::Double);
            layout_manager.set_task_count(5);

            let terminal = render_layout(100, 40, &layout_manager);
            insta::assert_snapshot!(terminal.backend());
        }

        /// Visual test for auto mode with varied terminal sizes
        #[test]
        fn test_visualize_auto_mode_wide_terminal() {
            let mut layout_manager = LayoutManager::new(5);
            layout_manager.set_mode(LayoutMode::Auto);
            layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
            layout_manager.set_pane_arrangement(PaneArrangement::Single);
            layout_manager.set_task_count(5);

            let terminal = render_layout(120, 30, &layout_manager);
            insta::assert_snapshot!(terminal.backend());
        }

        /// Visual test for auto mode with tall terminal
        #[test]
        fn test_visualize_auto_mode_tall_terminal() {
            let mut layout_manager = LayoutManager::new(5);
            layout_manager.set_mode(LayoutMode::Auto);
            layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
            layout_manager.set_pane_arrangement(PaneArrangement::Single);
            layout_manager.set_task_count(5);

            let terminal = render_layout(80, 60, &layout_manager);
            insta::assert_snapshot!(terminal.backend());
        }

        /// Visual test for single pane layout
        #[test]
        fn test_visualize_single_pane() {
            let mut layout_manager = LayoutManager::new(5);
            layout_manager.set_mode(LayoutMode::Horizontal);
            layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
            layout_manager.set_pane_arrangement(PaneArrangement::Single);
            layout_manager.set_task_count(5);

            let terminal = render_layout(100, 40, &layout_manager);
            insta::assert_snapshot!(terminal.backend());
        }

        /// Visual test using different layout configurations
        #[test]
        fn test_visualize_different_configurations() {
            // Create a layout manager with one configuration
            let mut layout_manager1 = LayoutManager::new(5);
            layout_manager1.set_mode(LayoutMode::Horizontal);
            layout_manager1.set_pane_arrangement(PaneArrangement::Single);

            // Create another layout manager with different settings
            let mut layout_manager2 = LayoutManager::new(5);
            layout_manager2.set_mode(LayoutMode::Vertical);
            layout_manager2.set_task_list_visibility(TaskListVisibility::Visible);
            layout_manager2.set_pane_arrangement(PaneArrangement::Double);
            layout_manager2.set_task_count(3);

            // Render both for visual comparison
            let terminal_config1 = render_layout(100, 40, &layout_manager1);
            insta::assert_snapshot!("config1", terminal_config1.backend());

            let terminal_config2 = render_layout(100, 40, &layout_manager2);
            insta::assert_snapshot!("config2", terminal_config2.backend());
        }

        /// Visual test for default case - no panes and full width task list
        #[test]
        fn test_visualize_no_panes_full_width_task_list() {
            let layout_manager = LayoutManager::new(5);

            let terminal = render_layout(100, 40, &layout_manager);
            insta::assert_snapshot!(terminal.backend());
        }

        /// Visual test for narrow screen rendering (width < 75)
        #[test]
        fn test_visualize_narrow_screen_layout() {
            // Create layout with auto mode, which should pick vertical layout for narrow screens
            let mut layout_manager = LayoutManager::new(5);
            layout_manager.set_mode(LayoutMode::Auto);
            layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
            layout_manager.set_pane_arrangement(PaneArrangement::Single);
            layout_manager.set_task_count(5);

            // Test with a narrow screen (width < 75)
            let terminal = render_layout(74, 40, &layout_manager);
            insta::assert_snapshot!("narrow_screen_layout", terminal.backend());

            // Also test with extremely narrow screen
            let terminal = render_layout(50, 40, &layout_manager);
            insta::assert_snapshot!("extremely_narrow_screen_layout", terminal.backend());

            // Also test with slightly narrow screen
            let terminal = render_layout(80, 40, &layout_manager);
            insta::assert_snapshot!("slightly_narrow_screen_layout", terminal.backend());
        }

        // These tests will run even without the snapshot feature enabled
        // to verify layout calculations are correct

        #[test]
        fn test_verify_horizontal_layout_areas() {
            let mut layout_manager = LayoutManager::new(5);
            let area = create_test_area(100, 40);

            layout_manager.set_mode(LayoutMode::Horizontal);
            layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
            layout_manager.set_pane_arrangement(PaneArrangement::Double);
            layout_manager.set_task_count(5);

            let layout = layout_manager.calculate_layout(area);

            // Verify task list exists and is on the left
            assert!(layout.task_list.is_some());
            let task_list = layout.task_list.unwrap();
            assert_eq!(task_list.x, 0);
            assert_eq!(task_list.width, 100 / 3);
            assert_eq!(task_list.height, 40);

            // Verify we have two panes to the right of the task list
            assert_eq!(layout.terminal_panes.len(), 2);
            assert!(layout.terminal_panes[0].x > task_list.x);
            assert!(layout.terminal_panes[1].x > task_list.x);

            // Verify panes are stacked
            assert_eq!(layout.terminal_panes[0].height, 20);
            assert_eq!(layout.terminal_panes[1].height, 20);
            assert!(layout.terminal_panes[1].y > layout.terminal_panes[0].y);
        }

        #[test]
        fn test_verify_vertical_layout_areas() {
            let mut layout_manager = LayoutManager::new(5);
            let area = create_test_area(100, 40);

            layout_manager.set_mode(LayoutMode::Vertical);
            layout_manager.set_task_list_visibility(TaskListVisibility::Visible);
            layout_manager.set_pane_arrangement(PaneArrangement::Double);
            layout_manager.set_task_count(5);

            let layout = layout_manager.calculate_layout(area);

            // Verify task list exists and is on top
            assert!(layout.task_list.is_some());
            let task_list = layout.task_list.unwrap();
            assert_eq!(task_list.y, 0);
            assert_eq!(task_list.width, 100);
            assert_eq!(task_list.height, 40 / 3);

            // Verify we have two panes below the task list
            assert_eq!(layout.terminal_panes.len(), 2);
            assert!(layout.terminal_panes[0].y > task_list.y);
            assert!(layout.terminal_panes[1].y > task_list.y);

            // Verify panes are side by side
            assert_eq!(layout.terminal_panes[0].width, 50);
            assert_eq!(layout.terminal_panes[1].width, 50);
            assert!(layout.terminal_panes[1].x > layout.terminal_panes[0].x);
        }
    }
}
