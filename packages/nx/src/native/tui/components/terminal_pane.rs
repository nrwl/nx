use crate::native::tui::clipboard::copy_to_clipboard;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use ratatui::{
    buffer::Buffer,
    layout::{Alignment, Rect},
    style::{Modifier, Style, Stylize},
    text::{Line, Span},
    widgets::{
        Block, BorderType, Borders, Padding, Scrollbar, ScrollbarOrientation, ScrollbarState,
        StatefulWidget, Widget,
    },
};
use std::{io, sync::Arc, time::Instant};
use tracing::debug;
use tui_term::widget::PseudoTerminal;

use crate::native::tui::components::nx_paragraph::NxParagraph;
use crate::native::tui::components::tasks_list::TaskStatus;
use crate::native::tui::scroll_momentum::{ScrollDirection, ScrollMomentum};
use crate::native::tui::theme::THEME;
use crate::native::tui::utils::{
    format_duration_with_estimate, get_task_status_icon, get_task_status_style,
};
use crate::native::tui::vt100_adapter::Vt100CttScreen;
use crate::native::tui::{action::Action, pty::PtyInstance};

/// A text selection within a terminal pane, tracked in absolute content
/// (visual-row, column) coordinates so it stays anchored to the text as the
/// pane scrolls.
#[derive(Debug, Clone, Copy)]
struct TextSelection {
    anchor: (usize, usize),
    cursor: (usize, usize),
    /// Whether a drag is currently in progress (vs. a finalized selection).
    dragging: bool,
}

impl TextSelection {
    /// Normalized `(start, end)` with `start <= end` in reading order.
    fn range(&self) -> ((usize, usize), (usize, usize)) {
        if self.anchor <= self.cursor {
            (self.anchor, self.cursor)
        } else {
            (self.cursor, self.anchor)
        }
    }

    /// True once the selection spans more than its origin cell (a real drag).
    fn is_nonempty(&self) -> bool {
        self.anchor != self.cursor
    }

    /// Whether content cell `(row, col)` falls inside the selection (inclusive).
    fn contains(&self, row: usize, col: usize) -> bool {
        let (start, end) = self.range();
        let after_start = row > start.0 || (row == start.0 && col >= start.1);
        let before_end = row < end.0 || (row == end.0 && col <= end.1);
        after_start && before_end
    }
}

/// Configuration for terminal pane layout and display constants
#[derive(Debug, Clone)]
struct TerminalPaneConfig {
    /// Minimum width required to display duration information
    min_duration_display_width: u16,
    /// Maximum task name length before truncation to allow displaying other columns
    task_name_max_length: usize,
    /// Padding around task name separator
    task_name_separator_padding: usize,
    /// Spacing for tab text display
    tab_text_spacing: usize,
    /// Right margin for UI elements
    right_margin: u16,
    /// Width padding for UI elements
    width_padding: u16,
    /// Text displayed for tab focus instruction
    tab_text: &'static str,
    /// Short tab text displayed when there's no space for the full tab text but there's space for the minimal tab text
    short_tab_text: &'static str,
}

/// A vim-style search session over a pane's terminal content.
#[derive(Debug, Clone, Default)]
pub struct PaneSearch {
    pub query: String,
    /// Typing into the query (true) vs navigating matches with n/N (false).
    pub input_mode: bool,
    /// Match positions in the PTY's visual coordinates: (row, col, col_width).
    pub matches: Vec<(usize, usize, usize)>,
    /// Index into `matches` of the match the view last jumped to.
    pub current: usize,
    /// PTY output generation when `matches` was last computed. A re-scan runs
    /// only when this changes, so navigating a finished task's static
    /// scrollback doesn't re-scan it on every keypress. Uses the generation
    /// rather than a content-row count because the count saturates once the
    /// scrollback fills (old lines keep being evicted while the count pins),
    /// which would freeze the match list against shifting text.
    pub searched_generation: u64,
}

pub struct TerminalPaneData {
    pub pty: Option<Arc<PtyInstance>>,
    pub is_interactive: bool,
    pub is_continuous: bool,
    pub can_be_interactive: bool,
    // Momentum scrolling state
    scroll_momentum: ScrollMomentum,
    // Transient status message with timestamp for auto-clear
    pub status_message: Option<(String, Instant)>,
    /// Active text selection within this pane, if any (NXC-3946).
    selection: Option<TextSelection>,
    /// Active search session, if any.
    pub search: Option<PaneSearch>,
    /// Inner content rect (inside borders/padding) captured during the last
    /// render, used to translate mouse coordinates into content coordinates.
    last_content_area: Option<Rect>,
}

impl TerminalPaneData {
    pub fn new() -> Self {
        Self {
            pty: None,
            is_interactive: false,
            is_continuous: false,
            can_be_interactive: false,
            scroll_momentum: ScrollMomentum::new(),
            status_message: None,
            selection: None,
            search: None,
            last_content_area: None,
        }
    }

    /// Whether the search input is capturing keystrokes (the app routes every
    /// key here while this is true).
    pub fn search_input_active(&self) -> bool {
        self.search.as_ref().is_some_and(|search| search.input_mode)
    }

    /// Re-scan for search matches if the pane's output has changed since the
    /// last scan, keeping the user on their current match. Called each frame so
    /// an active search's match count tracks a still-running task's streaming
    /// output without the user pressing a key. Cheap when nothing has changed:
    /// `refresh_matches` short-circuits on an unchanged output generation.
    pub fn refresh_search_if_grown(&mut self) {
        if self.search.is_some() {
            self.refresh_matches();
        }
    }

    /// Recompute matches for the current query and optionally jump to the
    /// nearest match at or below the current viewport top.
    fn recompute_search(&mut self, jump: bool) {
        let Some(pty) = &self.pty else {
            return;
        };
        let top = pty.visual_top();
        let positions = self
            .search
            .as_ref()
            .map(|search| pty.search_visual_positions(&search.query))
            .unwrap_or_default();
        let generation = pty.output_generation();
        let Some(search) = &mut self.search else {
            return;
        };
        search.matches = positions;
        search.searched_generation = generation;
        search.current = search
            .matches
            .iter()
            .position(|(row, _, _)| *row >= top)
            .unwrap_or(0);
        if jump {
            self.jump_to_current_match();
        }
    }

    /// Refresh the match list against the current content (it may have changed)
    /// WITHOUT re-anchoring `current` to the scroll position: n/N must step
    /// relative to the match the user is on, not whatever scrolled into view.
    /// Skips the re-scan entirely when the output generation is unchanged since
    /// the last search — navigating a finished task's scrollback costs nothing.
    fn refresh_matches(&mut self) {
        let Some(pty) = &self.pty else {
            return;
        };
        let generation = pty.output_generation();
        if self
            .search
            .as_ref()
            .is_some_and(|search| search.searched_generation == generation)
        {
            return;
        }
        let positions = self
            .search
            .as_ref()
            .map(|search| pty.search_visual_positions(&search.query))
            .unwrap_or_default();
        if let Some(search) = &mut self.search {
            let previous = search.matches.get(search.current).copied();
            search.matches = positions;
            search.searched_generation = generation;
            search.current = previous
                .and_then(|prev| search.matches.iter().position(|m| *m == prev))
                .unwrap_or_else(|| search.current.min(search.matches.len().saturating_sub(1)));
        }
    }

    /// Step to the next (+1) or previous (-1) match, wrapping around.
    fn search_step(&mut self, direction: i64) {
        if let Some(search) = &mut self.search {
            let len = search.matches.len();
            if len == 0 {
                return;
            }
            search.current = ((search.current as i64 + direction).rem_euclid(len as i64)) as usize;
        }
        self.jump_to_current_match();
    }

    fn jump_to_current_match(&mut self) {
        let Some(search) = &self.search else {
            return;
        };
        let Some((row, _, _)) = search.matches.get(search.current).copied() else {
            return;
        };
        if let Some(pty) = &self.pty {
            let mut pty_mut = pty.as_ref().clone();
            pty_mut.scroll_to_visual_row(row);
        }
    }

    pub fn handle_key_event(&mut self, key: KeyEvent) -> io::Result<Option<Action>> {
        // Vim-style search input: while typing, every key edits the query.
        if self.search_input_active() {
            match key.code {
                KeyCode::Esc => {
                    self.search = None;
                }
                KeyCode::Enter => {
                    // Confirm and switch to n/N navigation. A matchless query is
                    // kept — a still-running task may produce matches later, and
                    // the live refresh will pick them up. Only an empty query
                    // (nothing to search for) closes the search.
                    if self
                        .search
                        .as_ref()
                        .is_some_and(|search| !search.query.is_empty())
                    {
                        if let Some(search) = &mut self.search {
                            search.input_mode = false;
                        }
                    } else {
                        self.search = None;
                    }
                }
                KeyCode::Backspace => {
                    if let Some(search) = &mut self.search {
                        search.query.pop();
                    }
                    self.recompute_search(true);
                }
                KeyCode::Char(c) if !key.modifiers.contains(KeyModifiers::CONTROL) => {
                    if let Some(search) = &mut self.search {
                        search.query.push(c);
                    }
                    self.recompute_search(true);
                }
                _ => {}
            }
            return Ok(None);
        }

        if !self.is_interactive {
            // A confirmed search navigates with n/N and clears with Esc.
            if self.search.is_some() {
                match key.code {
                    KeyCode::Char('n') => {
                        // Content may have changed since the last search.
                        self.refresh_matches();
                        self.search_step(1);
                        return Ok(None);
                    }
                    KeyCode::Char('N') => {
                        self.refresh_matches();
                        self.search_step(-1);
                        return Ok(None);
                    }
                    KeyCode::Esc => {
                        self.search = None;
                        return Ok(None);
                    }
                    _ => {}
                }
            }
            // '/' opens a fresh search over the pane's content.
            if key.code == KeyCode::Char('/') && self.pty.is_some() {
                self.search = Some(PaneSearch {
                    input_mode: true,
                    ..Default::default()
                });
                return Ok(None);
            }
        }

        if let Some(pty) = &mut self.pty {
            let mut pty_mut = pty.as_ref().clone();
            match key.code {
                // Scrolling keybindings (up/down arrow keys or 'k'/'j') are only handled if we're not in interactive mode.
                // If interactive, the event falls through to be forwarded to the PTY so that we can support things like interactive prompts within tasks.
                KeyCode::Up | KeyCode::Char('k') if !self.is_interactive => {
                    self.scroll(ScrollDirection::Up);
                    return Ok(None);
                }
                KeyCode::Down | KeyCode::Char('j') if !self.is_interactive => {
                    self.scroll(ScrollDirection::Down);
                    return Ok(None);
                }
                // Handle Home/End keys for jumping to beginning/end when not in interactive mode
                KeyCode::Home if !self.is_interactive => {
                    pty_mut.scroll_to_top();
                    return Ok(None);
                }
                KeyCode::End if !self.is_interactive => {
                    pty_mut.scroll_to_bottom();
                    return Ok(None);
                }
                // Handle PageUp/PageDown for full-page scrolling when not in interactive mode
                KeyCode::PageUp if !self.is_interactive => {
                    let (rows, _) = pty_mut.get_dimensions();
                    let page = (rows.min(255) as u8).saturating_sub(2).max(1);
                    pty_mut.scroll_up(page);
                    return Ok(None);
                }
                KeyCode::PageDown if !self.is_interactive => {
                    let (rows, _) = pty_mut.get_dimensions();
                    let page = (rows.min(255) as u8).saturating_sub(2).max(1);
                    pty_mut.scroll_down(page);
                    return Ok(None);
                }
                // Handle ctrl+u and ctrl+d for scrolling when not in interactive mode
                KeyCode::Char('u')
                    if key.modifiers.contains(KeyModifiers::CONTROL) && !self.is_interactive =>
                {
                    pty_mut.scroll_up(12);
                    return Ok(None);
                }
                KeyCode::Char('d')
                    if key.modifiers.contains(KeyModifiers::CONTROL) && !self.is_interactive =>
                {
                    pty_mut.scroll_down(12);
                    return Ok(None);
                }
                // Handle 'c' for copying when not in interactive mode. Prefer an
                // active selection; fall back to copying the whole output.
                KeyCode::Char('c') if !self.is_interactive => {
                    let status_message =
                        if let Some(sel) = self.selection.filter(|s| s.is_nonempty()) {
                            let (start, end) = sel.range();
                            let text = pty.selected_text(start, end);
                            if text.is_empty() {
                                None
                            } else if copy_to_clipboard(&text) {
                                Some("Selection copied")
                            } else {
                                Some("Copy failed")
                            }
                        } else if let Some(screen) = pty.get_screen() {
                            // Unformatted output (no ANSI escape codes)
                            let output = screen.all_contents();
                            if copy_to_clipboard(&output) {
                                Some("Output copied")
                            } else {
                                Some("Copy failed")
                            }
                        } else {
                            None
                        };
                    // Set status message outside the pty borrow
                    if let Some(msg) = status_message {
                        self.status_message = Some((msg.to_owned(), Instant::now()));
                    }
                    return Ok(None);
                }
                // Handle 'i' to enter interactive mode for in progress tasks
                KeyCode::Char('i') if self.can_be_interactive && !self.is_interactive => {
                    self.set_interactive(true);
                    return Ok(None);
                }
                // Show hint when 'i' is pressed but task can't be interactive
                KeyCode::Char('i') if !self.can_be_interactive => {
                    return Ok(Some(Action::ShowHint(
                        "This task does not support interactive mode. Only in-progress tasks that accept input can be interactive."
                            .to_string(),
                    )));
                }
                KeyCode::Char('a')
                    if key.modifiers.contains(KeyModifiers::CONTROL) && !self.is_interactive =>
                {
                    let Some(screen) = pty.get_screen() else {
                        return Ok(None);
                    };
                    let contents = screen.all_contents();
                    // Set status message outside the pty borrow scope
                    self.status_message = Some(("Sent to assistant".to_string(), Instant::now()));
                    return Ok(Some(Action::SendConsoleMessage(contents)));
                }
                // Only send input to PTY if we're in interactive mode
                _ if self.is_interactive => match key.code {
                    KeyCode::Char(c) if key.modifiers.contains(KeyModifiers::CONTROL) => {
                        let ascii_code = (c as u8) - 0x60;
                        debug!("Sending ASCII code: {}", &[ascii_code].escape_ascii());
                        pty_mut.write_input(&[ascii_code])?;
                    }
                    KeyCode::Char(c) => {
                        pty_mut.write_input(c.to_string().as_bytes())?;
                    }
                    KeyCode::Up | KeyCode::Down => {
                        pty_mut.handle_arrow_keys(key);
                    }
                    KeyCode::Enter => {
                        pty_mut.write_input(b"\r")?;
                    }
                    KeyCode::Esc => {
                        pty_mut.write_input(&[0x1b])?;
                    }
                    KeyCode::Backspace => {
                        pty_mut.write_input(&[0x7f])?;
                    }
                    _ => {}
                },
                // Show hint popup for unhandled character keys when not in interactive mode
                // but only if the task can be made interactive
                KeyCode::Char(_) | KeyCode::Enter | KeyCode::Backspace
                    if !self.is_interactive && self.can_be_interactive =>
                {
                    return Ok(Some(Action::ShowHint(
                        "This key is not handled by the TUI. To send input to the terminal, press 'i' to enter interactive mode."
                            .to_string(),
                    )));
                }
                _ => {}
            }
        }
        Ok(None)
    }

    pub fn set_interactive(&mut self, interactive: bool) {
        self.is_interactive = interactive;
        // Reset scroll momentum when changing modes
        self.scroll_momentum.reset();
        // Once interactive, every key (Esc included) is forwarded to the child
        // program, so a lingering search could never be navigated or cleared.
        // Drop it on entering interactive mode.
        if interactive {
            self.search = None;
        }
    }

    pub fn is_interactive(&self) -> bool {
        self.is_interactive
    }

    /// Scroll with momentum in the given direction
    fn scroll(&mut self, direction: ScrollDirection) {
        if let Some(pty) = &self.pty {
            let mut pty_mut = pty.as_ref().clone();
            let scroll_amount = self.scroll_momentum.calculate_momentum(direction);

            match direction {
                ScrollDirection::Up => pty_mut.scroll_up(scroll_amount),
                ScrollDirection::Down => pty_mut.scroll_down(scroll_amount),
            }
        }
    }

    /// Public entry point for mouse-wheel scrolling of the terminal output.
    /// Reuses the same momentum model as keyboard scrolling so the wheel and
    /// arrow keys feel consistent.
    pub fn handle_mouse_scroll(&mut self, direction: ScrollDirection) {
        self.scroll(direction);
    }

    // --- Text selection (NXC-3946) -------------------------------------------

    /// Translate a terminal cell `(col, row)` into absolute content coordinates
    /// `(visual_row, column)` within this pane, if the pane has rendered content
    /// and the cell falls inside the content area.
    pub fn content_coords_at(&self, col: u16, row: u16) -> Option<(usize, usize)> {
        let area = self.last_content_area?;
        if col < area.x
            || col >= area.x.saturating_add(area.width)
            || row < area.y
            || row >= area.y.saturating_add(area.height)
        {
            return None;
        }
        let pty = self.pty.as_ref()?;
        let screen_row = (row - area.y) as usize;
        let screen_col = (col - area.x) as usize;
        // Map the on-screen row to an absolute content row: the top visible row
        // is `total - viewport_height - scrollback` rows from the start.
        let top = pty
            .get_total_content_rows()
            .saturating_sub(area.height as usize)
            .saturating_sub(pty.get_scroll_offset());
        Some((top + screen_row, screen_col))
    }

    /// Like [`content_coords_at`](Self::content_coords_at) but clamps the cell
    /// into the content area first, so a drag that strays outside the pane still
    /// extends the selection to the nearest edge.
    pub fn content_coords_clamped(&self, col: u16, row: u16) -> Option<(usize, usize)> {
        let area = self.last_content_area?;
        if area.width == 0 || area.height == 0 {
            return None;
        }
        let c = col.clamp(area.x, area.x + area.width - 1);
        let r = row.clamp(area.y, area.y + area.height - 1);
        self.content_coords_at(c, r)
    }

    /// Vertical edge of the content area the cell is at, for drag auto-scroll:
    /// `-1` at/above the top edge, `1` at/below the bottom edge, `0` otherwise.
    pub fn content_edge(&self, row: u16) -> i8 {
        match self.last_content_area {
            Some(area) if area.height > 0 => {
                if row <= area.y {
                    -1
                } else if row >= area.y + area.height - 1 {
                    1
                } else {
                    0
                }
            }
            _ => 0,
        }
    }

    /// Begin a selection drag at the given content coordinates.
    pub fn begin_selection(&mut self, row: usize, col: usize) {
        self.selection = Some(TextSelection {
            anchor: (row, col),
            cursor: (row, col),
            dragging: true,
        });
    }

    /// Update the in-progress selection's cursor to new content coordinates.
    pub fn update_selection(&mut self, row: usize, col: usize) {
        if let Some(sel) = &mut self.selection
            && sel.dragging
        {
            sel.cursor = (row, col);
        }
    }

    /// Finish the current selection drag. A plain click (no movement) clears the
    /// selection. Returns true if a non-empty selection remains.
    pub fn finish_selection(&mut self) -> bool {
        if let Some(sel) = &mut self.selection {
            sel.dragging = false;
            if !sel.is_nonempty() {
                self.selection = None;
                return false;
            }
            return true;
        }
        false
    }

    /// Clear any selection.
    pub fn clear_selection(&mut self) {
        self.selection = None;
    }

    /// Copy the current selection to the clipboard and set a status message.
    pub fn copy_selection(&mut self) {
        let Some(sel) = self.selection else {
            return;
        };
        if !sel.is_nonempty() {
            return;
        }
        let Some(pty) = self.pty.as_ref() else {
            return;
        };
        let (start, end) = sel.range();
        let text = pty.selected_text(start, end);
        if text.is_empty() {
            return;
        }
        let msg = if copy_to_clipboard(&text) {
            "Selection copied"
        } else {
            "Copy failed"
        };
        self.status_message = Some((msg.to_owned(), Instant::now()));
    }
}

impl Default for TerminalPaneData {
    fn default() -> Self {
        Self::new()
    }
}

pub struct TerminalPaneState {
    pub task_name: String,
    pub task_status: TaskStatus,
    pub is_continuous: bool,
    pub is_focused: bool,
    pub scroll_offset: usize,
    pub scrollbar_state: ScrollbarState,
    pub has_pty: bool,
    pub is_next_tab_target: bool,
    pub console_available: bool,
    // Cache expected viewport dimensions for consistent scrollbar calculations
    pub expected_viewport_height: Option<u16>,
    pub estimated_duration: Option<i64>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
}

impl TerminalPaneState {
    pub fn new(
        task_name: String,
        task_status: TaskStatus,
        is_continuous: bool,
        is_focused: bool,
        has_pty: bool,
        is_next_tab_target: bool,
        console_available: bool,
        estimated_duration: Option<i64>,
        start_time: Option<i64>,
        end_time: Option<i64>,
    ) -> Self {
        Self {
            task_name,
            task_status,
            is_continuous,
            is_focused,
            scroll_offset: 0,
            scrollbar_state: ScrollbarState::default(),
            has_pty,
            is_next_tab_target,
            console_available,
            expected_viewport_height: None,
            estimated_duration,
            start_time,
            end_time,
        }
    }
}

pub struct TerminalPane<'a> {
    pty_data: Option<&'a mut TerminalPaneData>,
    is_continuous: bool,
}

impl<'a> TerminalPane<'a> {
    pub fn new() -> Self {
        Self {
            pty_data: None,
            is_continuous: false,
        }
    }

    pub fn pty_data(mut self, data: &'a mut TerminalPaneData) -> Self {
        self.pty_data = Some(data);
        self
    }

    pub fn continuous(mut self, continuous: bool) -> Self {
        self.is_continuous = continuous;
        self
    }

    fn get_status_icon(&self, status: TaskStatus) -> Span<'static> {
        get_task_status_icon(status, 2)
    }

    fn get_base_style(&self, status: TaskStatus) -> Style {
        get_task_status_style(status)
    }

    /// Calculates appropriate pty dimensions by applying relevant borders and padding adjustments to the given area
    pub fn calculate_pty_dimensions(area: Rect) -> (u16, u16) {
        // Account for borders and padding correctly
        let pty_height = area
            .height
            .saturating_sub(2) // borders
            .saturating_sub(2); // padding (1 top + 1 bottom)
        let pty_width = area
            .width
            .saturating_sub(2) // borders
            .saturating_sub(4) // padding (2 left + 2 right)
            .saturating_sub(1); // 1 extra (based on empirical testing) to ensure characters are not cut off

        // Ensure minimum sizes
        let pty_height = pty_height.max(3);
        let pty_width = pty_width.max(20);

        (pty_height, pty_width)
    }

    /// Returns whether currently in interactive mode.
    pub fn is_currently_interactive(&self) -> bool {
        self.pty_data
            .as_ref()
            .map(|data| data.is_interactive)
            .unwrap_or(false)
    }

    /// Calculate content rows based on expected viewport height, not current PTY dimensions.
    /// This provides consistent scrollbar calculations even when PTY hasn't been resized yet.
    fn calculate_content_rows_for_viewport(
        &self,
        pty: &crate::native::tui::pty::PtyInstance,
        expected_viewport_height: u16,
    ) -> usize {
        // Try to get current content rows from PTY
        let current_content_rows = pty.get_total_content_rows();

        // If we have a cached viewport height and it differs from expected,
        // we need to estimate content based on the expected dimensions
        if let Some(screen) = pty.get_screen() {
            let (current_rows, _current_cols) = screen.size();

            // If current PTY dimensions match expected viewport, use current calculation
            if current_rows == expected_viewport_height {
                return current_content_rows;
            }

            // Otherwise, estimate content rows based on expected viewport height
            // This is a simple heuristic: assume content scales linearly with viewport height
            if current_rows > 0 {
                let scale_factor = expected_viewport_height as f64 / current_rows as f64;
                let estimated_content = (current_content_rows as f64 * scale_factor) as usize;
                return estimated_content.max(expected_viewport_height as usize);
            }
        }

        // Fallback to current calculation
        current_content_rows
    }

    /// Configuration for terminal pane layout and display
    const CONFIG: TerminalPaneConfig = TerminalPaneConfig {
        min_duration_display_width: 20, // allows displaying "999.9s (999.9s avg)"
        task_name_max_length: 30,
        task_name_separator_padding: 3,
        tab_text_spacing: 6,
        right_margin: 3,
        width_padding: 2,
        tab_text: "Press <tab> to focus output",
        short_tab_text: "<tab> to focus",
    };

    /// Determines whether the duration display should be shown in the terminal pane
    /// based on task status, configuration, and space constraints.
    fn should_show_duration_display(&self, state: &TerminalPaneState, area: Rect) -> bool {
        !state.is_continuous
            && state.estimated_duration.is_some()
            && matches!(
                state.task_status,
                TaskStatus::InProgress
                    | TaskStatus::Success
                    | TaskStatus::Failure
                    | TaskStatus::LocalCacheKeptExisting
                    | TaskStatus::LocalCache
                    | TaskStatus::RemoteCache
            )
            && area.width > Self::CONFIG.min_duration_display_width
    }

    /// Formats the duration display for terminal pane showing live/actual duration vs estimated duration
    fn format_duration_display(&self, state: &TerminalPaneState) -> Option<String> {
        let estimated = state.estimated_duration?;
        let start = state.start_time?;

        let actual_ms = match state.task_status {
            TaskStatus::InProgress => {
                let current_ms = crate::native::utils::time::current_timestamp_millis();
                current_ms.saturating_sub(start)
            }
            TaskStatus::Success
            | TaskStatus::Failure
            | TaskStatus::LocalCacheKeptExisting
            | TaskStatus::LocalCache
            | TaskStatus::RemoteCache => {
                let end = state.end_time?;
                end.saturating_sub(start)
            }
            _ => return None,
        };

        Some(format_duration_with_estimate(actual_ms, Some(estimated)))
    }
}

// This lifetime is needed for our terminal pane data, it breaks without it
#[allow(clippy::needless_lifetimes)]
impl<'a> StatefulWidget for TerminalPane<'a> {
    type State = TerminalPaneState;

    fn render(mut self, area: Rect, buf: &mut Buffer, state: &mut Self::State) {
        // Clamp to the buffer to avoid rendering outside bounds
        let safe_area = area.intersection(*buf.area());
        if safe_area.width == 0 || safe_area.height == 0 {
            return;
        }

        // Add bounds checking to prevent panic when terminal is too narrow
        // Safety check: ensure area is at least 5x5 to render anything properly
        if safe_area.width < 5 || safe_area.height < 5 {
            // Just render a minimal indicator instead of a full pane
            let text = "...";
            let paragraph = NxParagraph::new(text)
                .style(Style::default().fg(THEME.secondary_fg))
                .alignment(Alignment::Center);
            Widget::render(paragraph, safe_area, buf);
            return;
        }

        let base_style = self.get_base_style(state.task_status);
        let border_style = if state.is_focused {
            base_style
        } else {
            base_style.add_modifier(Modifier::DIM)
        };

        let status_icon = self.get_status_icon(state.task_status);

        let mut title = vec![];

        title.push(status_icon.clone());
        title.push(Span::styled(
            format!("{}  ", state.task_name),
            match state.is_focused {
                true => Style::default()
                    .fg(THEME.primary_fg)
                    .add_modifier(Modifier::BOLD),
                false => Style::default().fg(THEME.secondary_fg),
            },
        ));

        // Calculate all layout values once to avoid redundant calculations
        let task_name_display_len = if state.task_name.len() <= Self::CONFIG.task_name_max_length {
            state.task_name.len() + Self::CONFIG.task_name_separator_padding
        } else {
            Self::CONFIG.task_name_max_length + Self::CONFIG.task_name_separator_padding
        };

        let show_duration = self.should_show_duration_display(state, safe_area);
        let (duration_width, duration_formatted) = if show_duration {
            if let Some(text) = self.format_duration_display(state) {
                let formatted = format!("  {}  ", text);
                (formatted.len(), Some(formatted))
            } else {
                (0, None)
            }
        } else {
            (0, None)
        };

        // Determine which tab text to show based on available space
        let tab_text_to_show = if state.is_next_tab_target {
            let base_width = task_name_display_len
                + Self::CONFIG.tab_text_spacing
                + if show_duration { duration_width } else { 0 };

            // Check if we have space for full tab text
            if safe_area.width as usize >= base_width + Self::CONFIG.tab_text.len() {
                Some(Self::CONFIG.tab_text)
            } else if safe_area.width as usize >= base_width + Self::CONFIG.short_tab_text.len() {
                Some(Self::CONFIG.short_tab_text)
            } else {
                None
            }
        } else {
            None
        };

        // Display the appropriate tab text
        if let Some(tab_text) = tab_text_to_show {
            let tab_target_text = Span::raw(tab_text).remove_modifier(Modifier::DIM);
            // In light themes, use the primary fg color for the tab target text to make sure it's clearly visible
            if !THEME.is_dark_mode {
                title.push(tab_target_text.fg(THEME.primary_fg));
            } else {
                title.push(tab_target_text);
            }
        }

        let block = Block::default()
            .title(title)
            .title_alignment(Alignment::Left)
            .borders(Borders::ALL)
            .border_type(if state.is_focused {
                BorderType::Thick
            } else {
                BorderType::Plain
            })
            .border_style(border_style)
            .padding(Padding::new(2, 2, 1, 1));

        // If the task is in progress, we need to check if a pty instance is available, and if not
        // it implies that the task is being run outside the pseudo-terminal and all we can do is
        // wait for the task results to arrive
        if matches!(state.task_status, TaskStatus::InProgress) && !state.has_pty {
            let message = vec![Line::from(vec![Span::styled(
                "Waiting for task results...",
                if state.is_focused {
                    self.get_base_style(TaskStatus::InProgress)
                } else {
                    self.get_base_style(TaskStatus::InProgress)
                        .add_modifier(Modifier::DIM)
                },
            )])];

            let paragraph = NxParagraph::new(message)
                .block(block)
                .alignment(Alignment::Center)
                .style(Style::default());

            Widget::render(paragraph, safe_area, buf);
            return;
        }

        // If the task is in progress, we need to check if a pty instance is available, and if not
        // it implies that the task is being run outside the pseudo-terminal and all we can do is
        // wait for the task results to arrive
        if matches!(state.task_status, TaskStatus::Shared) && !state.has_pty {
            let message = vec![Line::from(vec![Span::styled(
                "Running in another Nx process...",
                if state.is_focused {
                    self.get_base_style(TaskStatus::Shared)
                } else {
                    self.get_base_style(TaskStatus::Shared)
                        .add_modifier(Modifier::DIM)
                },
            )])];

            let paragraph = NxParagraph::new(message)
                .block(block)
                .alignment(Alignment::Center)
                .style(Style::default());

            Widget::render(paragraph, safe_area, buf);
            return;
        }

        // If the task has been stopped but does not have a pty
        if matches!(state.task_status, TaskStatus::Stopped) && !state.has_pty {
            let message = vec![Line::from(vec![Span::styled(
                "Running in another Nx process...",
                if state.is_focused {
                    self.get_base_style(TaskStatus::Stopped)
                } else {
                    self.get_base_style(TaskStatus::Stopped)
                        .add_modifier(Modifier::DIM)
                },
            )])];

            let paragraph = NxParagraph::new(message)
                .block(block)
                .alignment(Alignment::Center)
                .style(Style::default());

            Widget::render(paragraph, safe_area, buf);
            return;
        }

        // If the task was skipped, show skipped message
        if matches!(state.task_status, TaskStatus::Skipped) {
            let message_style = if state.is_focused {
                self.get_base_style(TaskStatus::Skipped)
            } else {
                self.get_base_style(TaskStatus::Skipped)
                    .add_modifier(Modifier::DIM)
            };
            let message = vec![Line::from(vec![Span::styled(
                "Task was skipped",
                message_style,
            )])];

            let paragraph = NxParagraph::new(message)
                .block(block)
                .alignment(Alignment::Center)
                .style(Style::default());

            Widget::render(paragraph, safe_area, buf);
            return;
        }

        // If the task completed successfully but has no PTY output (e.g., nx:noop tasks), show completion message
        if matches!(
            state.task_status,
            TaskStatus::Success
                | TaskStatus::LocalCache
                | TaskStatus::LocalCacheKeptExisting
                | TaskStatus::RemoteCache
        ) && !state.has_pty
        {
            let message_style = if state.is_focused {
                self.get_base_style(state.task_status)
            } else {
                self.get_base_style(state.task_status)
                    .add_modifier(Modifier::DIM)
            };
            let message = vec![Line::from(vec![Span::styled(
                "Task completed successfully",
                message_style,
            )])];

            let paragraph = NxParagraph::new(message)
                .block(block)
                .alignment(Alignment::Center)
                .style(Style::default());

            Widget::render(paragraph, safe_area, buf);
            return;
        }

        let inner_area = block.inner(safe_area);

        // Record the content rect so mouse events can map cells to content
        // coordinates for text selection. Scoped so the mutable borrow ends
        // before the immutable render borrow below.
        if let Some(pty_data) = &mut self.pty_data {
            pty_data.last_content_area = Some(inner_area);
        }

        if let Some(pty_data) = &self.pty_data {
            if let Some(pty) = &pty_data.pty {
                // Read every value that needs the parser lock BEFORE acquiring the
                // `screen` read guard below. parking_lot's RwLock is non-reentrant
                // and writer-preferring: a blocking `read()` taken while `screen`
                // is still held deadlocks the render thread against the PTY's
                // output-writer thread the moment that thread has a `write()`
                // queued. That is what froze the entire TUI when selecting text in
                // a pane that was still producing output.
                let viewport_height = inner_area.height;
                let current_scroll = pty.get_scroll_offset();
                // Calculate content based on expected dimensions, not current PTY
                // dimensions. This prevents scrollbar flash when the PTY hasn't
                // been resized yet.
                let total_content_rows =
                    self.calculate_content_rows_for_viewport(pty, viewport_height);
                // Absolute content-row count used to map the selection overlay,
                // matching `content_coords_at`'s basis.
                let selection_content_rows = pty.get_total_content_rows();

                if let Some(screen) = pty.get_screen() {
                    // Cache expected viewport height for consistent calculations
                    state.expected_viewport_height = Some(viewport_height);
                    let scrollable_rows =
                        total_content_rows.saturating_sub(viewport_height as usize);

                    // Determine if scrollbar is needed based on content vs viewport size
                    // This is deterministic and doesn't depend on actual PTY dimensions
                    let needs_scrollbar = scrollable_rows > 0;

                    // Reset scrollbar state if no scrolling needed
                    state.scrollbar_state = if needs_scrollbar {
                        let position = scrollable_rows.saturating_sub(current_scroll);
                        state
                            .scrollbar_state
                            .content_length(scrollable_rows)
                            .viewport_content_length(viewport_height as usize)
                            .position(position)
                    } else {
                        ScrollbarState::default()
                    };

                    let pseudo_term =
                        PseudoTerminal::new(Vt100CttScreen::wrap(&screen)).block(block);
                    Widget::render(pseudo_term, safe_area, buf);

                    // Overlay the text-selection highlight (NXC-3946). tui-term has
                    // no selection concept, so we reverse-video the selected cells
                    // after it has rendered. Map each visible cell to its content
                    // row and test it against the selection.
                    if let Some(selection) = pty_data.selection {
                        let top = selection_content_rows
                            .saturating_sub(inner_area.height as usize)
                            .saturating_sub(current_scroll);
                        for sy in 0..inner_area.height {
                            let content_row = top + sy as usize;
                            for sx in 0..inner_area.width {
                                if selection.contains(content_row, sx as usize)
                                    && let Some(cell) =
                                        buf.cell_mut((inner_area.x + sx, inner_area.y + sy))
                                {
                                    cell.modifier |= Modifier::REVERSED;
                                }
                            }
                        }
                    }

                    // Overlay search-match highlights the same way: plain
                    // matches in reverse-video, the current match on a
                    // distinct warning-colored background (like vim's
                    // CurSearch) so it stands out from its siblings.
                    if let Some(search) = &pty_data.search
                        && !search.matches.is_empty()
                    {
                        let (_, pty_cols) = pty.get_dimensions();
                        let cols = (pty_cols as usize).max(1);
                        let top = selection_content_rows
                            .saturating_sub(inner_area.height as usize)
                            .saturating_sub(current_scroll);
                        let bottom = top + inner_area.height as usize;
                        for (idx, (row, col, len)) in search.matches.iter().enumerate() {
                            // Walk the match cells, following wraps onto
                            // subsequent visual rows.
                            for i in 0..*len {
                                let offset = col + i;
                                let cell_row = row + offset / cols;
                                let cell_col = offset % cols;
                                if cell_row < top
                                    || cell_row >= bottom
                                    || cell_col >= inner_area.width as usize
                                {
                                    continue;
                                }
                                if let Some(cell) = buf.cell_mut((
                                    inner_area.x + cell_col as u16,
                                    inner_area.y + (cell_row - top) as u16,
                                )) {
                                    if idx == search.current {
                                        cell.set_bg(THEME.warning);
                                        cell.set_fg(ratatui::style::Color::Black);
                                        cell.modifier.remove(Modifier::DIM);
                                        cell.modifier.remove(Modifier::REVERSED);
                                    } else {
                                        cell.modifier |= Modifier::REVERSED;
                                    }
                                }
                            }
                        }
                    }

                    // Only render scrollbar if needed
                    if needs_scrollbar {
                        let scrollbar = Scrollbar::default()
                            .orientation(ScrollbarOrientation::VerticalRight)
                            .begin_symbol(Some("↑"))
                            .end_symbol(Some("↓"))
                            .style(border_style);

                        scrollbar.render(safe_area, buf, &mut state.scrollbar_state);
                    }

                    // Render scrollbar padding when needed, but not for minimal non-interactive panes
                    if needs_scrollbar {
                        // Render padding for both top and bottom when scrollbar is present
                        let padding_text = Line::from(vec![Span::raw("  ")]);
                        let padding_width = 2;

                        // Ensure paddings don't extend past safe area
                        if padding_width + Self::CONFIG.right_margin < safe_area.width {
                            // Top padding
                            let top_right_area = Rect {
                                x: safe_area.x + safe_area.width
                                    - padding_width
                                    - Self::CONFIG.right_margin,
                                y: safe_area.y,
                                width: padding_width + Self::CONFIG.width_padding,
                                height: 1,
                            };

                            Widget::render(
                                NxParagraph::new(padding_text.clone())
                                    .alignment(Alignment::Right)
                                    .style(border_style),
                                top_right_area,
                                buf,
                            );

                            // Bottom padding
                            let bottom_right_area = Rect {
                                x: safe_area.x + safe_area.width
                                    - padding_width
                                    - Self::CONFIG.right_margin,
                                y: safe_area.y + safe_area.height - 1,
                                width: padding_width + Self::CONFIG.width_padding,
                                height: 1,
                            };

                            Widget::render(
                                NxParagraph::new(padding_text)
                                    .alignment(Alignment::Right)
                                    .style(border_style),
                                bottom_right_area,
                                buf,
                            );
                        }
                    }

                    // Duration display (shown regardless of focus state when pane is open)
                    if show_duration {
                        if let Some(duration_formatted_text) = duration_formatted {
                            let duration_line = Line::from(vec![Span::styled(
                                duration_formatted_text,
                                Style::default().fg(THEME.secondary_fg),
                            )]);

                            // Calculate remaining width after reserving space for task name
                            let remaining_width =
                                safe_area.width.saturating_sub(task_name_display_len as u16);

                            if duration_width as u16
                                + Self::CONFIG.right_margin
                                + Self::CONFIG.width_padding
                                <= remaining_width
                                && safe_area.height > 1
                                && safe_area.width >= Self::CONFIG.min_duration_display_width
                            {
                                let duration_area = Rect {
                                    x: safe_area.x + safe_area.width
                                        - duration_width as u16
                                        - Self::CONFIG.right_margin,
                                    y: safe_area.y,
                                    width: duration_width as u16 + Self::CONFIG.width_padding,
                                    height: 1,
                                };

                                Widget::render(
                                    NxParagraph::new(duration_line)
                                        .alignment(Alignment::Right)
                                        .style(border_style),
                                    duration_area,
                                    buf,
                                );
                            }
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::layout::Rect;

    fn press(pane: &mut TerminalPaneData, code: KeyCode) {
        pane.handle_key_event(KeyEvent::new(code, KeyModifiers::NONE))
            .unwrap();
    }

    /// Search highlights must land exactly on the matched text after the pane
    /// renders through its real path — border, padding, `block.inner`,
    /// scrollback, ANSI colour codes, auto-wrapped lines, and a scroll offset
    /// from jumping to a match. Guards the "highlight is off by one when lines
    /// wrap" class of regression: any highlighted cell run that doesn't spell
    /// the query is drift between the match basis and the rendered grid.
    #[test]
    fn search_highlights_align_with_matches_through_the_render_path() {
        use crate::native::tui::pty::PtyInstance;
        use ratatui::style::Modifier;
        use std::sync::Arc;

        // Area 40x100 -> pty dims via calculate_pty_dimensions: 36 rows x 93 cols.
        let area = Rect::new(0, 0, 100, 40);
        let (pty_rows, pty_cols) = TerminalPane::calculate_pty_dimensions(area);
        let pty = Arc::new(PtyInstance::non_interactive_with_dimensions(
            pty_rows, pty_cols,
        ));

        // Stream enough content to overflow the screen (force scrollback) with
        // interleaved WRAPPING lines (paths wider than pty_cols).
        let mut feed = String::new();
        for i in 0..60 {
            feed.push_str(&format!("\x1b[34m[INFO]\x1b[0m step {i}\r\n"));
            if i % 4 == 0 {
                feed.push_str(&format!(
                    "\x1b[33m[WARNING]\x1b[0m /home/jason/projects/nx7/packages/maven/batch-runner/src/main/kotlin/dev/nx/maven/File{i}.kt long path that wraps here\r\n"
                ));
            }
        }
        pty.process_output(feed.as_bytes());

        let matches = pty.search_visual_positions("info");
        let mut data = TerminalPaneData::new();
        data.pty = Some(pty.clone());
        // Pick a match in the middle and jump to it (scrolls the viewport), the
        // exact interaction the user performs when reporting the off-by-one.
        let current = matches.len() / 2;
        data.search = Some(PaneSearch {
            query: "info".to_string(),
            input_mode: false,
            matches,
            current,
            searched_generation: pty.output_generation(),
        });
        data.jump_to_current_match();

        let mut state = TerminalPaneState::new(
            "maven:build".to_string(),
            TaskStatus::InProgress,
            false,
            true,
            true,
            false,
            true,
            None,
            None,
            None,
        );

        let mut buf = Buffer::empty(area);
        let pane = TerminalPane::new().pty_data(&mut data);
        StatefulWidget::render(pane, area, &mut buf, &mut state);

        // Collect contiguous highlighted (REVERSED or warning-bg) runs and the
        // text under them. Every run should read "INFO" — anything else is drift.
        let mut bad = Vec::new();
        for y in 0..area.height {
            let mut run = String::new();
            let mut run_x = 0u16;
            for x in 0..area.width {
                let cell = &buf[(x, y)];
                let hot = cell.modifier.contains(Modifier::REVERSED) || cell.bg == THEME.warning;
                if hot {
                    if run.is_empty() {
                        run_x = x;
                    }
                    run.push_str(cell.symbol());
                } else if !run.is_empty() {
                    if run.to_lowercase() != "info" {
                        bad.push((run_x, y, run.clone()));
                    }
                    run.clear();
                }
            }
            if !run.is_empty() && run.to_lowercase() != "info" {
                bad.push((run_x, y, run.clone()));
            }
        }
        for (x, y, text) in &bad {
            eprintln!("MISALIGNED highlight at ({x},{y}): {text:?}");
        }
        assert!(bad.is_empty(), "{} misaligned highlight runs", bad.len());
    }

    /// n and N step forward/backward through the match list and wrap around.
    /// (With no pty the refresh/jump are no-ops, so this isolates the index
    /// stepping — the scroll-position re-anchoring itself needs a live pty and
    /// is exercised via the higher-level flows.)
    #[test]
    fn search_n_and_shift_n_step_relative_to_the_current_match() {
        let mut pane = TerminalPaneData::new();
        pane.search = Some(PaneSearch {
            query: "x".to_string(),
            input_mode: false,
            matches: vec![(1, 0, 1), (5, 0, 1), (9, 0, 1)],
            current: 0,
            ..Default::default()
        });

        let current = |pane: &TerminalPaneData| pane.search.as_ref().unwrap().current;
        press(&mut pane, KeyCode::Char('n'));
        assert_eq!(current(&pane), 1);
        press(&mut pane, KeyCode::Char('n'));
        assert_eq!(current(&pane), 2);
        press(&mut pane, KeyCode::Char('n'));
        assert_eq!(current(&pane), 0, "n wraps forward");
        press(&mut pane, KeyCode::Char('N'));
        assert_eq!(current(&pane), 2, "N wraps backward");

        // Esc clears the whole search session.
        press(&mut pane, KeyCode::Esc);
        assert!(pane.search.is_none());
    }

    /// The search input captures printable keys into the query and Enter
    /// confirms into n/N navigation only when matches exist.
    #[test]
    fn search_input_edits_the_query_and_enter_without_matches_closes() {
        let mut pane = TerminalPaneData::new();
        press(&mut pane, KeyCode::Char('/'));
        assert!(pane.search.is_none(), "no pty: '/' does not open a search");

        pane.pty = Some(Arc::new(PtyInstance::non_interactive_with_dimensions(
            24, 80,
        )));
        press(&mut pane, KeyCode::Char('/'));
        assert!(pane.search_input_active());

        press(&mut pane, KeyCode::Char('e'));
        press(&mut pane, KeyCode::Char('r'));
        press(&mut pane, KeyCode::Backspace);
        assert_eq!(pane.search.as_ref().unwrap().query, "e");

        // A non-empty query with no matches is still confirmed — a running task
        // may produce matches later, which the live refresh will pick up.
        press(&mut pane, KeyCode::Enter);
        assert!(
            !pane.search_input_active(),
            "Enter confirms into navigation"
        );
        assert_eq!(pane.search.as_ref().unwrap().query, "e");

        // Clearing the query and confirming closes the search (nothing to find).
        press(&mut pane, KeyCode::Char('/'));
        assert!(pane.search_input_active());
        press(&mut pane, KeyCode::Backspace);
        press(&mut pane, KeyCode::Enter);
        assert!(pane.search.is_none());
    }

    /// A confirmed search's match count tracks a running task's streaming
    /// output on refresh, without the user pressing a key.
    #[test]
    fn search_count_updates_live_as_output_grows() {
        let feed = |n: usize| "error\r\n".repeat(n);
        let pty = Arc::new(PtyInstance::non_interactive_with_dimensions(24, 80));
        pty.process_output(feed(40).as_bytes());

        let mut pane = TerminalPaneData::new();
        pane.pty = Some(pty.clone());
        pane.search = Some(PaneSearch {
            query: "error".to_string(),
            input_mode: false,
            ..Default::default()
        });

        pane.refresh_search_if_grown();
        let first = pane.search.as_ref().unwrap().matches.len();
        assert!(first >= 40, "expected at least 40 matches, got {first}");

        // More output arrives; a plain refresh (no keypress) grows the count.
        pty.process_output(feed(40).as_bytes());
        pane.refresh_search_if_grown();
        let second = pane.search.as_ref().unwrap().matches.len();
        assert!(
            second > first,
            "count should grow live: {first} -> {second}"
        );

        // With no new output, the refresh short-circuits and the count holds.
        pane.refresh_search_if_grown();
        assert_eq!(pane.search.as_ref().unwrap().matches.len(), second);
    }

    /// A live refresh that turns up the first match (0 -> 1) must update the
    /// count without scrolling the viewport to it — only n/N or (re)submitting
    /// the query jumps.
    #[test]
    fn live_refresh_does_not_jump_the_viewport() {
        let pty = Arc::new(PtyInstance::non_interactive_with_dimensions(24, 80));
        // Enough non-matching output to build scrollback the view can sit in.
        pty.process_output("no match here\r\n".repeat(50).as_bytes());

        let mut pane = TerminalPaneData::new();
        pane.pty = Some(pty.clone());
        pane.search = Some(PaneSearch {
            query: "error".to_string(),
            input_mode: false,
            ..Default::default()
        });
        pane.refresh_search_if_grown();
        assert_eq!(pane.search.as_ref().unwrap().matches.len(), 0);

        // Scroll the viewport up, away from the bottom. This is what makes the
        // assertion meaningful: the single match appears at the *bottom*, so a
        // stray jump to it would collapse the scroll offset back toward zero.
        // If the view stayed at the bottom (offset 0), "no jump" and "jumped to
        // a bottom match" would both read 0 and the test would prove nothing.
        {
            let mut pty_mut = pty.as_ref().clone();
            pty_mut.scroll_to_top();
        }

        // The first match appears in new output at the bottom. Record the scroll
        // position *after* the output arrives, so we isolate the refresh's effect.
        pty.process_output("first error\r\n".as_bytes());
        let scroll_before = pty.get_scroll_offset();
        assert!(
            scroll_before > 0,
            "precondition: the viewport is scrolled up, not at the bottom"
        );
        pane.refresh_search_if_grown();

        assert_eq!(pane.search.as_ref().unwrap().matches.len(), 1);
        assert_eq!(
            pty.get_scroll_offset(),
            scroll_before,
            "a live refresh must not scroll the viewport to the new match"
        );
    }

    /// Entering interactive mode (`i`) must clear a confirmed search: once
    /// interactive, every key including Esc is forwarded to the child program,
    /// so a lingering search could never be navigated or dismissed.
    #[test]
    fn entering_interactive_mode_clears_a_confirmed_search() {
        let pty = Arc::new(PtyInstance::non_interactive_with_dimensions(24, 80));
        pty.process_output(b"some output here\r\n");
        let mut pane = TerminalPaneData::new();
        pane.pty = Some(pty);
        pane.can_be_interactive = true;
        pane.search = Some(PaneSearch {
            query: "output".to_string(),
            input_mode: false,
            matches: vec![(0, 5, 6)],
            current: 0,
            ..Default::default()
        });

        press(&mut pane, KeyCode::Char('i'));

        assert!(pane.is_interactive());
        assert!(
            pane.search.is_none(),
            "interactive mode must clear the search so Esc isn't swallowed by the child"
        );
    }

    /// The change-detector must keep firing after the scrollback fills. Past
    /// `SCROLLBACK_SIZE` the content-row count pins forever while old lines are
    /// still evicted underneath, so a count-based detector would freeze and the
    /// match list would never update. Keyed on the output generation instead, a
    /// live refresh still finds a match that appears after saturation.
    #[test]
    fn search_finds_matches_after_scrollback_saturates() {
        let pty = Arc::new(PtyInstance::non_interactive_with_dimensions(24, 80));
        // Well past SCROLLBACK_SIZE (1000): the row count is now saturated.
        pty.process_output("no match\r\n".repeat(1200).as_bytes());

        let mut pane = TerminalPaneData::new();
        pane.pty = Some(pty.clone());
        pane.search = Some(PaneSearch {
            query: "target".to_string(),
            input_mode: false,
            ..Default::default()
        });
        pane.refresh_search_if_grown();
        assert_eq!(pane.search.as_ref().unwrap().matches.len(), 0);

        // A row count would report the same value before and after this output,
        // so it can no longer signal the change — the generation still does.
        let rows_before = pty.get_total_content_rows();
        pty.process_output("a target appears\r\n".as_bytes());
        assert_eq!(
            pty.get_total_content_rows(),
            rows_before,
            "precondition: the content-row count is saturated (no longer changes)"
        );

        pane.refresh_search_if_grown();
        assert_eq!(
            pane.search.as_ref().unwrap().matches.len(),
            1,
            "a live refresh must re-scan even after the row count saturates"
        );
    }

    #[test]
    fn test_text_selection_contains_inclusive_range() {
        let sel = TextSelection {
            anchor: (1, 2),
            cursor: (3, 4),
            dragging: false,
        };
        // Before the start of the selection.
        assert!(!sel.contains(1, 1));
        assert!(!sel.contains(0, 9));
        // Start cell is inclusive.
        assert!(sel.contains(1, 2));
        // A fully-covered middle row.
        assert!(sel.contains(2, 0));
        assert!(sel.contains(2, 999));
        // End row is covered up to and including the end column.
        assert!(sel.contains(3, 4));
        assert!(!sel.contains(3, 5));
    }

    #[test]
    fn test_text_selection_normalizes_reversed_drag() {
        // Dragging up/left puts the cursor before the anchor; the range should
        // still be normalized.
        let sel = TextSelection {
            anchor: (3, 4),
            cursor: (1, 2),
            dragging: true,
        };
        assert!(sel.contains(1, 2));
        assert!(sel.contains(2, 10));
        assert!(sel.contains(3, 4));
        assert!(!sel.contains(1, 1));
        assert!(!sel.contains(3, 5));
    }

    #[test]
    fn test_text_selection_empty_is_single_cell() {
        let sel = TextSelection {
            anchor: (2, 5),
            cursor: (2, 5),
            dragging: true,
        };
        assert!(!sel.is_nonempty());
        assert!(sel.contains(2, 5));
        assert!(!sel.contains(2, 6));
    }

    // Helper function to create a TerminalPane for testing
    fn create_terminal_pane() -> TerminalPane<'static> {
        TerminalPane::new()
    }

    // Helper function to create a TerminalPaneState for testing
    fn create_terminal_pane_state(
        task_status: TaskStatus,
        is_continuous: bool,
        estimated_duration: Option<i64>,
        start_time: Option<i64>,
        end_time: Option<i64>,
    ) -> TerminalPaneState {
        TerminalPaneState::new(
            "test-task".to_string(),
            task_status,
            is_continuous,
            false, // is_focused
            false, // has_pty
            false, // is_next_tab_target
            false, // console_available
            estimated_duration,
            start_time,
            end_time,
        )
    }

    #[test]
    fn test_title_styling_when_focused_vs_unfocused() {
        // Test focused state - should have bold title
        let focused_state = TerminalPaneState::new(
            "test-task".to_string(),
            TaskStatus::InProgress,
            false, // is_continuous
            true,  // is_focused - this is what we're testing
            false, // has_pty
            false, // is_next_tab_target
            false, // console_available
            None,  // estimated_duration
            None,  // start_time
            None,  // end_time
        );

        // Test unfocused state - should not have bold title
        let unfocused_state = TerminalPaneState::new(
            "test-task".to_string(),
            TaskStatus::InProgress,
            false, // is_continuous
            false, // is_focused - this is what we're testing
            false, // has_pty
            false, // is_next_tab_target
            false, // console_available
            None,  // estimated_duration
            None,  // start_time
            None,  // end_time
        );

        // Since we can't easily test the actual rendering without a complete UI setup,
        // we test that our logic correctly sets the focus state in the struct
        assert!(focused_state.is_focused);
        assert!(!unfocused_state.is_focused);

        // The actual styling logic is tested by the compiler -
        // if it compiles, our conditional modifier logic is syntactically correct
    }

    #[test]
    fn test_should_show_duration_display_conditions() {
        let terminal_pane = create_terminal_pane();
        let area = Rect::new(0, 0, 30, 10); // width = 30, sufficient for display

        // Test that duration display is shown for InProgress tasks with estimated duration
        let state = create_terminal_pane_state(
            TaskStatus::InProgress,
            false,      // not continuous
            Some(1000), // has estimated duration
            None,
            None,
        );
        assert!(terminal_pane.should_show_duration_display(&state, area));

        // Test that duration display is shown for Success tasks with estimated duration
        let state = create_terminal_pane_state(
            TaskStatus::Success,
            false,      // not continuous
            Some(1000), // has estimated duration
            None,
            None,
        );
        assert!(terminal_pane.should_show_duration_display(&state, area));

        // Test that duration display is shown for Failure tasks with estimated duration
        let state = create_terminal_pane_state(
            TaskStatus::Failure,
            false,      // not continuous
            Some(1000), // has estimated duration
            None,
            None,
        );
        assert!(terminal_pane.should_show_duration_display(&state, area));

        // Test that duration display is shown for all cache-related successful completion statuses
        let state = create_terminal_pane_state(
            TaskStatus::LocalCacheKeptExisting,
            false,      // not continuous
            Some(1000), // has estimated duration
            None,
            None,
        );
        assert!(terminal_pane.should_show_duration_display(&state, area));

        let state = create_terminal_pane_state(
            TaskStatus::LocalCache,
            false,      // not continuous
            Some(1000), // has estimated duration
            None,
            None,
        );
        assert!(terminal_pane.should_show_duration_display(&state, area));

        let state = create_terminal_pane_state(
            TaskStatus::RemoteCache,
            false,      // not continuous
            Some(1000), // has estimated duration
            None,
            None,
        );
        assert!(terminal_pane.should_show_duration_display(&state, area));

        let state = create_terminal_pane_state(
            TaskStatus::Skipped,
            false,      // not continuous
            Some(1000), // has estimated duration
            None,
            None,
        );
        assert!(!terminal_pane.should_show_duration_display(&state, area));

        // Test that duration display is NOT shown for continuous tasks
        let state = create_terminal_pane_state(
            TaskStatus::InProgress,
            true,       // continuous
            Some(1000), // has estimated duration
            None,
            None,
        );
        assert!(!terminal_pane.should_show_duration_display(&state, area));

        // Test that duration display is NOT shown without estimated duration
        let state = create_terminal_pane_state(
            TaskStatus::InProgress,
            false, // not continuous
            None,  // no estimated duration
            None,
            None,
        );
        assert!(!terminal_pane.should_show_duration_display(&state, area));

        // Test that duration display is NOT shown with insufficient width
        let narrow_area = Rect::new(0, 0, 15, 10); // width = 15, insufficient
        let state = create_terminal_pane_state(
            TaskStatus::InProgress,
            false,      // not continuous
            Some(1000), // has estimated duration
            None,
            None,
        );
        assert!(!terminal_pane.should_show_duration_display(&state, narrow_area));

        // Test that duration display is NOT shown for NotStarted tasks
        let state = create_terminal_pane_state(
            TaskStatus::NotStarted,
            false,      // not continuous
            Some(1000), // has estimated duration
            None,
            None,
        );
        assert!(!terminal_pane.should_show_duration_display(&state, area));

        // Test edge case: exactly at minimum width (insufficient space)
        let min_area = Rect::new(0, 0, TerminalPane::CONFIG.min_duration_display_width, 10);
        let state = create_terminal_pane_state(
            TaskStatus::InProgress,
            false,      // not continuous
            Some(1000), // has estimated duration
            None,
            None,
        );
        assert!(!terminal_pane.should_show_duration_display(&state, min_area));

        // Test edge case: just above minimum width
        let above_min_area = Rect::new(
            0,
            0,
            TerminalPane::CONFIG.min_duration_display_width + 1,
            10,
        );
        let state = create_terminal_pane_state(
            TaskStatus::InProgress,
            false,      // not continuous
            Some(1000), // has estimated duration
            None,
            None,
        );
        assert!(terminal_pane.should_show_duration_display(&state, above_min_area));
    }
}
