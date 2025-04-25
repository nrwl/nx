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
            task_count: 0,
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
}

impl LayoutManager {
    /// Creates a new LayoutManager with default settings.
    pub fn new() -> Self {
        Self {
            mode: LayoutMode::Auto,
            min_horizontal_width: 120, // Minimum width for horizontal layout to be viable
            min_vertical_height: 30,   // Minimum height for vertical layout to be viable
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
    fn is_vertical_layout_preferred(&self, terminal_width: u16, terminal_height: u16, task_count: usize) -> bool {
        // If there's only a single task, prefer vertical layout
        if task_count <= 1 {
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

    /// Calculates the layout based on the given terminal area and configuration.
    /// 
    /// Returns a LayoutAreas struct containing the calculated areas for each component.
    pub fn calculate_layout(&self, area: Rect, config: &LayoutConfig) -> LayoutAreas {
        match config.task_list_visibility {
            TaskListVisibility::Hidden => self.calculate_layout_hidden_task_list(area, config),
            TaskListVisibility::Visible => self.calculate_layout_visible_task_list(area, config),
        }
    }

    /// Calculates the layout when the task list is hidden.
    fn calculate_layout_hidden_task_list(&self, area: Rect, config: &LayoutConfig) -> LayoutAreas {
        let terminal_panes = match config.pane_arrangement {
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
    fn calculate_layout_visible_task_list(&self, area: Rect, config: &LayoutConfig) -> LayoutAreas {
        // Determine whether to use vertical or horizontal layout
        let use_vertical = match config.mode {
            LayoutMode::Auto => self.is_vertical_layout_preferred(area.width, area.height, config.task_count),
            LayoutMode::Vertical => true,
            LayoutMode::Horizontal => false,
        };

        if use_vertical {
            self.calculate_vertical_layout(area, config)
        } else {
            self.calculate_horizontal_layout(area, config)
        }
    }

    /// Calculates a vertical layout (task list above terminal panes).
    fn calculate_vertical_layout(&self, area: Rect, config: &LayoutConfig) -> LayoutAreas {
        // Allocate about 1/3 of the height to the task list
        let task_list_height = area.height / 3;
        let terminal_pane_height = area.height - task_list_height;

        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(task_list_height),
                Constraint::Length(terminal_pane_height),
            ])
            .split(area);

        let task_list_area = chunks[0];
        let terminal_pane_area = chunks[1];

        let terminal_panes = match config.pane_arrangement {
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
    fn calculate_horizontal_layout(&self, area: Rect, config: &LayoutConfig) -> LayoutAreas {
        // In horizontal layout, allocate about 1/3 of the width to the task list
        let task_list_width = area.width / 3;
        let terminal_pane_width = area.width - task_list_width;

        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Length(task_list_width),
                Constraint::Length(terminal_pane_width),
            ])
            .split(area);

        let task_list_area = chunks[0];
        let terminal_pane_area = chunks[1];

        let terminal_panes = match config.pane_arrangement {
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
}

impl Default for LayoutManager {
    fn default() -> Self {
        Self::new()
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
        let layout_manager = LayoutManager::new();
        assert_eq!(layout_manager.get_mode(), LayoutMode::Auto);
    }

    #[test]
    fn test_set_mode() {
        let mut layout_manager = LayoutManager::new();
        layout_manager.set_mode(LayoutMode::Vertical);
        assert_eq!(layout_manager.get_mode(), LayoutMode::Vertical);
        layout_manager.set_mode(LayoutMode::Horizontal);
        assert_eq!(layout_manager.get_mode(), LayoutMode::Horizontal);
    }

    #[test]
    fn test_hidden_task_list_layout() {
        let layout_manager = LayoutManager::new();
        let area = create_test_area(100, 50);
        let config = LayoutConfig {
            task_list_visibility: TaskListVisibility::Hidden,
            pane_arrangement: PaneArrangement::Single,
            task_count: 5, // Multiple tasks
            ..Default::default()
        };

        let layout = layout_manager.calculate_layout(area, &config);
        assert!(layout.task_list.is_none());
        assert_eq!(layout.terminal_panes.len(), 1);
        assert_eq!(layout.terminal_panes[0], area);
    }

    #[test]
    fn test_hidden_task_list_with_double_panes() {
        let layout_manager = LayoutManager::new();
        let area = create_test_area(100, 50);
        let config = LayoutConfig {
            task_list_visibility: TaskListVisibility::Hidden,
            pane_arrangement: PaneArrangement::Double,
            task_count: 5, // Multiple tasks
            ..Default::default()
        };

        let layout = layout_manager.calculate_layout(area, &config);
        assert!(layout.task_list.is_none());
        assert_eq!(layout.terminal_panes.len(), 2);
        assert_eq!(layout.terminal_panes[0].width, 50); // Half of total width
        assert_eq!(layout.terminal_panes[1].width, 50);
    }

    #[test]
    fn test_auto_mode_selects_horizontal_for_wide_terminal() {
        let layout_manager = LayoutManager::new();
        let area = create_test_area(200, 60); // Wide terminal
        let config = LayoutConfig {
            mode: LayoutMode::Auto,
            task_list_visibility: TaskListVisibility::Visible,
            pane_arrangement: PaneArrangement::Single,
            task_count: 5, // Multiple tasks
        };

        let layout = layout_manager.calculate_layout(area, &config);
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
        let layout_manager = LayoutManager::new();
        let area = create_test_area(80, 100); // Tall terminal
        let config = LayoutConfig {
            mode: LayoutMode::Auto,
            task_list_visibility: TaskListVisibility::Visible,
            pane_arrangement: PaneArrangement::Single,
            task_count: 5, // Multiple tasks
        };

        let layout = layout_manager.calculate_layout(area, &config);
        assert!(layout.task_list.is_some());
        
        // In vertical layout, task list should be on top, taking about 1/3 of height
        let task_list = layout.task_list.unwrap();
        assert_eq!(task_list.x, 0);
        assert_eq!(task_list.y, 0);
        assert_eq!(task_list.width, 80);
        assert_eq!(task_list.height, 100 / 3);
    }

    #[test]
    fn test_auto_mode_prefers_vertical_for_single_task() {
        let layout_manager = LayoutManager::new();
        let area = create_test_area(200, 60); // Wide terminal that would normally use horizontal
        let config = LayoutConfig {
            mode: LayoutMode::Auto,
            task_list_visibility: TaskListVisibility::Visible,
            pane_arrangement: PaneArrangement::Single,
            task_count: 1, // Single task
        };

        let layout = layout_manager.calculate_layout(area, &config);
        assert!(layout.task_list.is_some());
        
        // Even though terminal is wide, layout should be vertical for a single task
        let task_list = layout.task_list.unwrap();
        assert_eq!(task_list.x, 0);
        assert_eq!(task_list.y, 0);
        assert_eq!(task_list.width, 200);
        assert_eq!(task_list.height, 60 / 3);
    }

    #[test]
    fn test_forced_vertical_mode() {
        let layout_manager = LayoutManager::new();
        let area = create_test_area(200, 60); // Wide terminal that would normally use horizontal
        let config = LayoutConfig {
            mode: LayoutMode::Vertical, // But we force vertical
            task_list_visibility: TaskListVisibility::Visible,
            pane_arrangement: PaneArrangement::Single,
            task_count: 5, // Multiple tasks
        };

        let layout = layout_manager.calculate_layout(area, &config);
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
        let layout_manager = LayoutManager::new();
        let area = create_test_area(80, 100); // Tall terminal that would normally use vertical
        let config = LayoutConfig {
            mode: LayoutMode::Horizontal, // But we force horizontal
            task_list_visibility: TaskListVisibility::Visible,
            pane_arrangement: PaneArrangement::Single,
            task_count: 5, // Multiple tasks
        };

        let layout = layout_manager.calculate_layout(area, &config);
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
        let layout_manager = LayoutManager::new();
        let area = create_test_area(100, 80);
        let config = LayoutConfig {
            mode: LayoutMode::Vertical,
            task_list_visibility: TaskListVisibility::Visible,
            pane_arrangement: PaneArrangement::Double,
            task_count: 5, // Multiple tasks
        };

        let layout = layout_manager.calculate_layout(area, &config);
        assert_eq!(layout.terminal_panes.len(), 2);
        
        // In vertical layout with two panes, they should be side by side
        // below the task list
        assert_eq!(layout.terminal_panes[0].width, 50); // Half of total width
        assert_eq!(layout.terminal_panes[1].width, 50);
        assert_eq!(layout.terminal_panes[0].height, layout.terminal_panes[1].height);
        assert!(layout.terminal_panes[0].y > layout.task_list.unwrap().y);
    }

    #[test]
    fn test_double_panes_in_horizontal_layout() {
        let layout_manager = LayoutManager::new();
        let area = create_test_area(150, 60);
        let config = LayoutConfig {
            mode: LayoutMode::Horizontal,
            task_list_visibility: TaskListVisibility::Visible,
            pane_arrangement: PaneArrangement::Double,
            task_count: 5, // Multiple tasks
        };

        let layout = layout_manager.calculate_layout(area, &config);
        assert_eq!(layout.terminal_panes.len(), 2);
        
        // In horizontal layout with two panes, they should be stacked
        // to the right of the task list
        assert_eq!(layout.terminal_panes[0].height, 30); // Half of total height
        assert_eq!(layout.terminal_panes[1].height, 30);
        assert_eq!(layout.terminal_panes[0].width, layout.terminal_panes[1].width);
        assert!(layout.terminal_panes[0].x > layout.task_list.unwrap().x);
    }

    #[test]
    fn test_no_panes() {
        let layout_manager = LayoutManager::new();
        let area = create_test_area(100, 50);
        let config = LayoutConfig {
            task_list_visibility: TaskListVisibility::Visible,
            pane_arrangement: PaneArrangement::None,
            task_count: 5, // Multiple tasks
            ..Default::default()
        };

        let layout = layout_manager.calculate_layout(area, &config);
        assert!(layout.task_list.is_some());
        assert_eq!(layout.terminal_panes.len(), 0);
    }

    #[cfg(test)]
    mod visual_tests {
        use super::*;
        use ratatui::{backend::TestBackend, Terminal};
        use ratatui::widgets::{Block, Borders};
        use ratatui::style::{Color, Style};

        /// Render a layout configuration to a TestBackend for visualization
        fn render_layout(width: u16, height: u16, config: &LayoutConfig) -> Terminal<TestBackend> {
            let backend = TestBackend::new(width, height);
            let mut terminal = Terminal::new(backend).unwrap();
            let layout_manager = LayoutManager::new();

            terminal.draw(|frame| {
                let areas = layout_manager.calculate_layout(frame.area(), &config);
                
                // Render task list if visible
                if let Some(task_list_area) = areas.task_list {
                    let task_list_block = Block::default()
                        .title("Task List")
                        .borders(Borders::ALL)
                        .border_style(Style::default().fg(Color::Green));
                    
                    frame.render_widget(task_list_block, task_list_area);
                }
                
                // Render terminal panes
                for (i, pane_area) in areas.terminal_panes.iter().enumerate() {
                    let pane_block = Block::default()
                        .title(format!("Terminal Pane {}", i+1))
                        .borders(Borders::ALL)
                        .border_style(Style::default().fg(Color::Yellow));
                    
                    frame.render_widget(pane_block, *pane_area);
                }
            }).unwrap();
            
            terminal
        }

        /// Visual test for horizontal layout with two panes
        #[test]
        fn test_visualize_horizontal_layout_with_two_panes() {
            let config = LayoutConfig {
                mode: LayoutMode::Horizontal,
                task_list_visibility: TaskListVisibility::Visible,
                pane_arrangement: PaneArrangement::Double,
                task_count: 5, // Multiple tasks
            };
            
            let terminal = render_layout(100, 40, &config);
            insta::assert_snapshot!(terminal.backend());
        }

        /// Visual test for vertical layout with two panes
        #[test]
        fn test_visualize_vertical_layout_with_two_panes() {
            let config = LayoutConfig {
                mode: LayoutMode::Vertical,
                task_list_visibility: TaskListVisibility::Visible,
                pane_arrangement: PaneArrangement::Double,
                task_count: 5, // Multiple tasks
            };
            
            let terminal = render_layout(100, 40, &config);
            insta::assert_snapshot!(terminal.backend());
        }

        /// Visual test for hidden task list with two panes
        #[test]
        fn test_visualize_hidden_task_list_with_two_panes() {
            let config = LayoutConfig {
                mode: LayoutMode::Auto,
                task_list_visibility: TaskListVisibility::Hidden,
                pane_arrangement: PaneArrangement::Double,
                task_count: 5, // Multiple tasks
            };
            
            let terminal = render_layout(100, 40, &config);
            insta::assert_snapshot!(terminal.backend());
        }

        /// Visual test for auto mode with varied terminal sizes
        #[test]
        fn test_visualize_auto_mode_wide_terminal() {
            let config = LayoutConfig {
                mode: LayoutMode::Auto,
                task_list_visibility: TaskListVisibility::Visible,
                pane_arrangement: PaneArrangement::Single,
                task_count: 5, // Multiple tasks
            };
            
            let terminal = render_layout(120, 30, &config);
            insta::assert_snapshot!(terminal.backend());
        }

        /// Visual test for auto mode with single task (should be vertical regardless of terminal size)
        #[test]
        fn test_visualize_auto_mode_single_task() {
            let config = LayoutConfig {
                mode: LayoutMode::Auto,
                task_list_visibility: TaskListVisibility::Visible,
                pane_arrangement: PaneArrangement::Single,
                task_count: 1, // Single task
            };
            
            let terminal = render_layout(120, 30, &config); // Wide terminal that would normally use horizontal
            insta::assert_snapshot!(terminal.backend());
        }

        /// Visual test for auto mode with tall terminal
        #[test]
        fn test_visualize_auto_mode_tall_terminal() {
            let config = LayoutConfig {
                mode: LayoutMode::Auto,
                task_list_visibility: TaskListVisibility::Visible,
                pane_arrangement: PaneArrangement::Single,
                task_count: 5, // Multiple tasks
            };
            
            let terminal = render_layout(80, 60, &config);
            insta::assert_snapshot!(terminal.backend());
        }

        /// Visual test for single pane layout
        #[test]
        fn test_visualize_single_pane() {
            let config = LayoutConfig {
                mode: LayoutMode::Horizontal,
                task_list_visibility: TaskListVisibility::Visible,
                pane_arrangement: PaneArrangement::Single,
                task_count: 5, // Multiple tasks
            };
            
            let terminal = render_layout(100, 40, &config);
            insta::assert_snapshot!(terminal.backend());
        }

        // These tests will run even without the snapshot feature enabled
        // to verify layout calculations are correct
        
        #[test]
        fn test_verify_horizontal_layout_areas() {
            let layout_manager = LayoutManager::new();
            let area = create_test_area(100, 40);
            let config = LayoutConfig {
                mode: LayoutMode::Horizontal,
                task_list_visibility: TaskListVisibility::Visible,
                pane_arrangement: PaneArrangement::Double,
                task_count: 5, // Multiple tasks
            };
            
            let layout = layout_manager.calculate_layout(area, &config);
            
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
            let layout_manager = LayoutManager::new();
            let area = create_test_area(100, 40);
            let config = LayoutConfig {
                mode: LayoutMode::Vertical,
                task_list_visibility: TaskListVisibility::Visible,
                pane_arrangement: PaneArrangement::Double,
                task_count: 5, // Multiple tasks
            };
            
            let layout = layout_manager.calculate_layout(area, &config);
            
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

