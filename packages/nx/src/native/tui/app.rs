use color_eyre::eyre::Result;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers, MouseButton, MouseEvent, MouseEventKind};

use super::scroll_momentum::ScrollDirection;
#[cfg(not(test))]
use napi::threadsafe_function::ThreadsafeFunction;
#[cfg(not(test))]
use napi::{Status, bindgen_prelude::Unknown};
use parking_lot::Mutex;
use ratatui::layout::{Alignment, Position, Rect, Size};
use ratatui::style::Modifier;
use ratatui::style::Style;
use ratatui::text::{Line, Span};
use std::collections::HashMap;
use std::io;
use std::io::Write;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::sync::mpsc::UnboundedSender;
use tracing::{debug, trace};
use tui_logger::{LevelFilter, TuiLoggerSmartWidget, TuiWidgetEvent, TuiWidgetState};

use crate::native::tui::tui::Tui;
use crate::native::{
    pseudo_terminal::pseudo_terminal::{ParserArc, WriterArc},
    tasks::types::{Task, TaskResult},
};

use super::action::Action;
use super::clipboard::copy_to_clipboard;
use super::components::countdown_popup::CountdownPopup;
use super::components::dependency_view::{DependencyView, DependencyViewState};
use super::components::help_popup::HelpPopup;
use super::components::hint_popup::HintPopup;
use super::components::layout_manager::{
    LayoutAreas, LayoutManager, PaneArrangement, TaskListVisibility,
};
use super::components::nx_paragraph::NxParagraph;
use super::components::status_bar::{StatusBar, StatusBarProps};
use super::components::task_selection_manager::{
    SelectionEntry, SelectionMode, TaskSelectionManager,
};
use super::components::tasks_list::{TaskListClick, TaskStatus, TasksList};
use super::components::terminal_pane::{TerminalPane, TerminalPaneData, TerminalPaneState};
use super::components::{Component, ModalPopup};
use super::graph_utils::{get_task_count, is_task_continuous};
use super::lifecycle::{BatchStatus, PerformanceSummaryPayload, RunMode, TuiMode};
use super::pty::PtyInstance;
use super::theme::THEME;
use super::tui;
use super::utils::write_output_to_pty;
use crate::native::ide::nx_console::messaging::NxConsoleMessageConnection;
use crate::native::tui::graph_utils::get_failed_dependencies;
use crate::native::tui::tui_core::{AutoExitDecision, QuitDecision, TuiCore};
use crate::native::tui::tui_state::TuiState;
use crate::native::utils::time::current_timestamp_millis;

use crate::native::tui::lifecycle::BatchInfo;

#[derive(Debug, Clone)]
pub struct BatchState {
    pub info: BatchInfo, // executor_name, task_ids
    pub start_time: i64, // Timestamp when batch was registered
}

/// Information preserved for completed batches that are pinned to panes
#[derive(Debug, Clone)]
pub struct CompletedBatchInfo {
    pub display_name: String,      // Pre-computed "Batch: esbuild (5)"
    pub completion_time: i64,      // When it finished
    pub final_status: BatchStatus, // Success or Failure
}

/// Context for rendering a terminal pane (task or batch)
struct TerminalPaneContext {
    display_name: String,
    status: TaskStatus,
    is_continuous: bool,
    is_focused: bool,
    is_next_tab_target: bool,
    estimated_duration: Option<i64>,
    start_time: Option<i64>,
    end_time: Option<i64>,
}

impl From<BatchStatus> for TaskStatus {
    fn from(status: BatchStatus) -> Self {
        match status {
            BatchStatus::Running => TaskStatus::InProgress,
            BatchStatus::Success => TaskStatus::Success,
            BatchStatus::Failure => TaskStatus::Failure,
        }
    }
}

/// Duration before status messages in terminal panes are automatically cleared
const STATUS_MESSAGE_DURATION: std::time::Duration = std::time::Duration::from_secs(3);

pub struct App {
    // === Shared Core ===
    /// Shared core functionality (state management, callbacks, etc.)
    core: TuiCore,

    // === Full-Screen UI State ===
    pub components: Vec<Box<dyn Component>>,
    /// Focus layers, bottom to top; the top entry is the current focus.
    /// Never empty: index 0 is always a base layer (`TaskList` or
    /// `MultipleOutput`), replaced in place by lateral navigation, while popup
    /// layers are pushed above it (each at most once).
    focus_stack: Vec<Focus>,
    layout_manager: LayoutManager,
    // Cached frame area used for layout calculations, only updated on terminal resize
    frame_area: Option<Rect>,
    // Cached result of layout manager's calculate_layout, only updated when necessary (e.g. terminal resize, task list visibility change etc)
    layout_areas: Option<LayoutAreas>,
    terminal_pane_data: [TerminalPaneData; 2],
    dependency_view_states: [Option<DependencyViewState>; 2],
    /// Full-width bottom status bar. Not a `Component`: it renders from
    /// per-frame props derived from canonical state and persists only so its
    /// link registry survives from the draw pass to the mouse-release hit-test.
    status_bar: StatusBar,
    spacebar_mode: bool,
    pane_tasks: [Option<SelectionEntry>; 2], // Selections assigned to panes 1 and 2 (0-indexed)
    resize_debounce_timer: Option<u128>,     // Timer for debouncing resize events
    selection_manager: Arc<Mutex<TaskSelectionManager>>,
    debug_mode: bool,
    debug_state: TuiWidgetState,
    /// Flag to indicate this App was restored from a mode switch and should skip init pane setup
    restored_from_mode_switch: bool,
    // Batch tracking
    batch_states: HashMap<String, BatchState>, // batch_id → BatchState
    completed_pinned_batches: HashMap<String, CompletedBatchInfo>, // Completed batches still pinned to panes
    /// Hit-test regions captured during the last render, used to route mouse
    /// clicks/scrolls to whatever is under the cursor. Rebuilt every frame.
    mouse_regions: Vec<MouseRegion>,
    /// Timestamp + cell of the last left-button press, for double-click detection.
    last_click: Option<(std::time::Instant, u16, u16)>,
    /// Index of the pane an in-progress text-selection drag belongs to.
    selecting_pane: Option<usize>,
    /// Whether the TUI is currently capturing the mouse. Toggled with F10 so the
    /// user can fall back to their terminal's native cell selection.
    mouse_capture_enabled: bool,
    /// An in-progress (or completed-but-still-highlighted) text selection over a
    /// rendered region (popup text area or task list), in screen coordinates.
    region_selection: Option<RegionSelection>,
    /// Snapshot of the selectable region's on-screen cells from the last render,
    /// used to extract selected text and resolve link clicks. Rebuilt every
    /// frame while a popup is open or a region selection is active.
    region_snapshot: Option<RegionSnapshot>,
    /// A left-press over the task list whose action (select row / inline / cloud
    /// link) is deferred to release, so a drag becomes a text selection instead.
    pending_list_click: Option<(u16, u16, bool)>,
    /// A left-press on a dependency-view row whose navigation `(pane_idx, task)`
    /// is deferred to release, so a drag becomes a text selection instead.
    pending_dep_nav: Option<(usize, String)>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Focus {
    TaskList,
    MultipleOutput(usize),
    HelpPopup,
    CountdownPopup,
    HintPopup,
}

impl Focus {
    /// Popup layers stack over the base layer of the focus stack; base layers
    /// (`TaskList`, `MultipleOutput`) are replaced in place instead.
    fn is_popup(self) -> bool {
        matches!(
            self,
            Focus::HelpPopup | Focus::CountdownPopup | Focus::HintPopup
        )
    }

    /// The popup component backing this focus layer, when it is a popup.
    fn modal(self, app: &App) -> Option<&dyn ModalPopup> {
        match self {
            Focus::HelpPopup => app.component::<HelpPopup>().map(|p| p as &dyn ModalPopup),
            Focus::CountdownPopup => app
                .component::<CountdownPopup>()
                .map(|p| p as &dyn ModalPopup),
            Focus::HintPopup => app.component::<HintPopup>().map(|p| p as &dyn ModalPopup),
            Focus::TaskList | Focus::MultipleOutput(_) => None,
        }
    }

    /// Whether this focus layer is still visible/meaningful to the user.
    /// Consulted when pruning layers revealed by `App::close_popup`; base
    /// layers are the floor of the stack and always count as active.
    fn is_active(self, app: &App) -> bool {
        match self {
            Focus::TaskList | Focus::MultipleOutput(_) => true,
            _ => self.modal(app).is_some_and(|p| p.is_visible()),
        }
    }
}

/// A rectangular region captured during the last render that mouse events can
/// target. Rebuilt every frame so hit-testing always reflects what's on screen.
#[derive(Debug, Clone, Copy)]
struct MouseRegion {
    rect: Rect,
    kind: MouseRegionKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MouseRegionKind {
    /// The task list panel. Row vs. cloud-link resolution is delegated to the
    /// `TasksList` component, which knows its own internal geometry.
    TaskList,
    /// An output pane, identified by its index into `terminal_pane_data`.
    Pane(usize),
}

/// A text selection over a rendered region (a popup's text area or the task
/// list), tracked in screen coordinates. Unlike the PTY selection (which uses
/// content coordinates and survives scrolling), this reads straight off the
/// rendered buffer, so it intentionally does not re-anchor when the region
/// scrolls mid-drag.
#[derive(Debug, Clone, Copy)]
struct RegionSelection {
    /// Where the drag started, `(col, row)`.
    anchor: (u16, u16),
    /// Current drag position, `(col, row)`.
    cursor: (u16, u16),
    /// The region the selection is confined to.
    area: Rect,
    /// Whether the left button is still held.
    dragging: bool,
}

impl RegionSelection {
    /// `(start, end)` ordered in reading order (top-to-bottom, left-to-right).
    fn ordered(&self) -> ((u16, u16), (u16, u16)) {
        // Compare by (row, col) so earlier rows always sort first.
        let a = (self.anchor.1, self.anchor.0);
        let c = (self.cursor.1, self.cursor.0);
        if a <= c {
            (self.anchor, self.cursor)
        } else {
            (self.cursor, self.anchor)
        }
    }

    /// Whether the selection covers any cells (a click with no drag does not).
    fn is_nonempty(&self) -> bool {
        self.anchor != self.cursor
    }

    /// Whether `(col, row)` is inside the selection, using reading-order
    /// semantics so partial first/last rows highlight correctly.
    fn contains(&self, col: u16, row: u16) -> bool {
        let ((sx, sy), (ex, ey)) = self.ordered();
        if row < sy || row > ey {
            return false;
        }
        if sy == ey {
            col >= sx && col <= ex
        } else if row == sy {
            col >= sx
        } else if row == ey {
            col <= ex
        } else {
            true
        }
    }
}

/// Per-cell glyphs of a selectable region (popup text area or task list),
/// captured each frame so mouse-up can extract the selected text and clicks can
/// resolve links without re-deriving the rendered layout.
#[derive(Debug, Clone)]
struct RegionSnapshot {
    /// The region the cells were captured from.
    area: Rect,
    /// `cells[row][col]` is the symbol at `(area.x + col, area.y + row)`.
    cells: Vec<Vec<String>>,
}

impl RegionSnapshot {
    /// Resolve a URL at a clicked cell by scanning for a whitespace-delimited
    /// token that looks like a link.
    fn url_at(&self, col: u16, row: u16) -> Option<String> {
        if !self.area.contains(Position::new(col, row)) {
            return None;
        }
        let cells = self.cells.get((row - self.area.y) as usize)?;
        let c = (col - self.area.x) as usize;
        let is_ws = |s: &str| s.trim().is_empty();
        if cells.get(c).is_none_or(|s| is_ws(s)) {
            return None;
        }
        // Expand left and right over the contiguous non-whitespace run.
        let mut start = c;
        while start > 0 && !is_ws(&cells[start - 1]) {
            start -= 1;
        }
        let mut end = c;
        while end + 1 < cells.len() && !is_ws(&cells[end + 1]) {
            end += 1;
        }
        let token: String = cells[start..=end].concat();
        let trimmed = token
            .trim_start_matches(['(', '[', '<'])
            .trim_end_matches([')', '.', ',', ']', '>']);
        if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            Some(trimmed.to_string())
        } else {
            None
        }
    }

    /// Extract the selected text in reading order, trimming trailing blanks.
    fn selected_text(&self, sel: &RegionSelection) -> String {
        let ((sx, sy), (ex, ey)) = sel.ordered();
        let mut out = String::new();
        for screen_row in sy..=ey {
            if screen_row < self.area.y || screen_row >= self.area.y + self.area.height {
                continue;
            }
            let Some(cells) = self.cells.get((screen_row - self.area.y) as usize) else {
                continue;
            };
            if cells.is_empty() {
                if screen_row != ey {
                    out.push('\n');
                }
                continue;
            }
            let last = cells.len() - 1;
            let to_idx = |screen_col: u16| (screen_col.saturating_sub(self.area.x)) as usize;
            let (from, to) = if sy == ey {
                (to_idx(sx), to_idx(ex))
            } else if screen_row == sy {
                (to_idx(sx), last)
            } else if screen_row == ey {
                (0, to_idx(ex))
            } else {
                (0, last)
            };
            let from = from.min(last);
            let to = to.min(last);
            let line: String = cells[from..=to].concat();
            out.push_str(line.trim_end());
            if screen_row != ey {
                out.push('\n');
            }
        }
        out
    }
}

/// Maximum delay between two left-clicks (on the same cell) to count as a
/// double-click. crossterm reports individual button presses, so we detect
/// double-clicks ourselves.
const DOUBLE_CLICK_MS: u128 = 400;

/// Open a URL in the user's default browser (NXC-3940). Best-effort: a missing
/// opener can never crash the TUI. Returns `true` if the opener process was
/// spawned, `false` if it couldn't be (e.g. no `xdg-open` on a headless box) so
/// the caller can tell the user instead of failing silently. The child's stdio
/// is detached to null so it can't corrupt the terminal we're drawing to.
fn open_url(url: &str) -> bool {
    use std::process::{Command, Stdio};

    #[cfg(target_os = "macos")]
    let mut cmd = {
        let mut c = Command::new("open");
        c.arg(url);
        c
    };
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = Command::new("cmd");
        // The empty "" is the window title argument that `start` expects first.
        c.args(["/C", "start", "", url]);
        c
    };
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let mut cmd = {
        let mut c = Command::new("xdg-open");
        c.arg(url);
        c
    };

    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .is_ok()
}

impl App {
    /// Create a new App with existing shared state (for mode switching)
    ///
    /// This constructor is used when switching from inline mode to full-screen mode,
    /// allowing state to be preserved during the transition.
    pub fn with_state(state: Arc<Mutex<TuiState>>, _tui_mode: TuiMode) -> Result<Self> {
        let selection_manager = Arc::new(Mutex::new(TaskSelectionManager::new(5)));

        // Get data from shared state to initialize UI components
        let (
            tasks,
            initiating_tasks,
            run_mode,
            _,
            task_count,
            task_status_map,
            task_start_times,
            task_end_times,
            // UI state for restoration
            saved_pane_tasks,
            saved_spacebar_mode,
            saved_focused_pane,
            saved_selected_item,
            // Batch metadata for restoration
            batch_metadata,
            // Batch expansion states for restoration
            batch_expansion_states,
            // Max parallel for restoration
            saved_max_parallel,
        ) = {
            let state_lock = state.lock();
            (
                state_lock.tasks().to_vec(),
                state_lock.initiating_tasks().clone(),
                state_lock.run_mode(),
                state_lock.pinned_tasks().to_vec(),
                get_task_count(state_lock.task_graph()),
                state_lock.get_task_status_map().clone(),
                state_lock.get_task_start_times().clone(),
                state_lock.get_task_end_times().clone(),
                // Get saved UI state
                state_lock.get_ui_pane_tasks().clone(),
                state_lock.get_ui_spacebar_mode(),
                state_lock.get_ui_focused_pane(),
                state_lock.get_ui_selected_item().cloned(),
                // Get batch metadata for restoration
                state_lock.get_batch_metadata().clone(),
                // Get batch expansion states for restoration
                state_lock.get_batch_expansion_states().clone(),
                // Get max_parallel for restoration
                state_lock.get_max_parallel(),
            )
        };

        // Determine initial focus based on saved state
        let initial_focus = match saved_focused_pane {
            Some(pane_idx) if saved_pane_tasks[pane_idx].is_some() => {
                Focus::MultipleOutput(pane_idx)
            }
            _ if saved_pane_tasks[0].is_some() || saved_pane_tasks[1].is_some() => Focus::TaskList,
            _ => Focus::TaskList,
        };

        let mut tasks_list = TasksList::new(
            tasks.to_vec(),
            initiating_tasks,
            run_mode,
            initial_focus,
            selection_manager.clone(),
            state.clone(),
        );

        // Restore max_parallel for proper decorator line rendering
        if let Some(max_parallel) = saved_max_parallel {
            tasks_list.set_max_parallel(Some(max_parallel));
        }

        // Sync task status from shared state (important for mode switching)
        // TasksList::new creates TaskItems with NotStarted status, but we need
        // to restore the actual status from TuiState
        for (task_id, status) in task_status_map {
            tasks_list.update_task_status(&task_id, status);

            // Also sync timing data for this task
            let start_time = task_start_times.get(&task_id).copied();
            let end_time = task_end_times.get(&task_id).copied();
            if start_time.is_some() || end_time.is_some() {
                tasks_list.set_task_timing(task_id, start_time, end_time);
            }
        }

        // Recreate batch groups for running batches (mode switching restoration)
        for (batch_id, stored_batch) in &batch_metadata {
            if !stored_batch.is_completed {
                let is_expanded = batch_expansion_states
                    .get(batch_id)
                    .copied()
                    .unwrap_or(true);
                tasks_list.start_batch(
                    batch_id.clone(),
                    stored_batch.info.executor_name.clone(),
                    stored_batch.info.task_ids.clone(),
                    stored_batch.start_time,
                    is_expanded,
                );
            }
        }

        let help_popup = HelpPopup::new();
        let mut countdown_popup = CountdownPopup::new();
        // Re-hydrate the run report from shared state so it survives mode switches.
        if let Some(summary) = state.lock().exit_summary() {
            countdown_popup.set_summary(summary);
        }
        let hint_popup = HintPopup::new();

        let components: Vec<Box<dyn Component>> = vec![
            Box::new(tasks_list),
            Box::new(help_popup),
            Box::new(countdown_popup),
            Box::new(hint_popup),
        ];

        let main_terminal_pane_data = TerminalPaneData::new();

        // Create layout manager and configure based on saved state
        let mut layout_manager = LayoutManager::new_with_run_mode(task_count, run_mode);

        // Restore pane arrangement based on saved pane tasks
        let has_pane0 = saved_pane_tasks[0].is_some();
        let has_pane1 = saved_pane_tasks[1].is_some();
        if has_pane0 && has_pane1 {
            layout_manager.set_pane_arrangement(PaneArrangement::Double);
        } else if has_pane0 || has_pane1 || saved_spacebar_mode {
            layout_manager.set_pane_arrangement(PaneArrangement::Single);
        }

        // Check if we're restoring from a mode switch (has saved UI state)
        let has_restored_state = saved_pane_tasks[0].is_some()
            || saved_pane_tasks[1].is_some()
            || saved_spacebar_mode
            || saved_selected_item.is_some();

        tracing::trace!(
            "App::with_state - restored panes: [{:?}, {:?}], focus: {:?}, spacebar: {}, selected: {:?}",
            saved_pane_tasks[0],
            saved_pane_tasks[1],
            initial_focus,
            saved_spacebar_mode,
            saved_selected_item
        );

        // Restore selection (after trace so we can log the value)
        selection_manager.lock().select(saved_selected_item);

        Ok(Self {
            core: TuiCore::new(state),
            components,
            focus_stack: vec![initial_focus],
            layout_manager,
            frame_area: None,
            layout_areas: None,
            terminal_pane_data: [main_terminal_pane_data, TerminalPaneData::new()],
            dependency_view_states: [None, None],
            status_bar: StatusBar::new(),
            spacebar_mode: saved_spacebar_mode,
            pane_tasks: saved_pane_tasks,
            resize_debounce_timer: None,
            selection_manager,
            debug_mode: false,
            debug_state: TuiWidgetState::default().set_default_display_level(LevelFilter::Debug),
            restored_from_mode_switch: has_restored_state,
            mouse_regions: Vec::new(),
            last_click: None,
            selecting_pane: None,
            mouse_capture_enabled: true,
            region_selection: None,
            region_snapshot: None,
            pending_list_click: None,
            pending_dep_nav: None,
            // Restore batch states from TuiState (mode switching persistence)
            batch_states: batch_metadata
                .iter()
                .filter(|(_, b)| !b.is_completed)
                .map(|(id, b)| {
                    (
                        id.clone(),
                        BatchState {
                            info: b.info.clone(),
                            start_time: b.start_time,
                        },
                    )
                })
                .collect(),
            completed_pinned_batches: batch_metadata
                .iter()
                .filter(|(_, b)| b.is_completed)
                .map(|(id, b)| {
                    (
                        id.clone(),
                        CompletedBatchInfo {
                            display_name: b
                                .display_name
                                .clone()
                                .unwrap_or_else(|| format!("Batch: {}", id)),
                            completion_time: b.completion_time.unwrap_or(0),
                            final_status: b.final_status.unwrap_or(BatchStatus::Success),
                        },
                    )
                })
                .collect(),
        })
    }

    /// Get the shared state Arc (for mode switching)
    pub fn get_state(&self) -> Arc<Mutex<TuiState>> {
        self.core.state().clone()
    }

    pub fn register_action_handler(&mut self, tx: UnboundedSender<Action>) -> Result<()> {
        self.core.register_action_handler(tx);
        Ok(())
    }

    pub fn init(&mut self, _area: Size) -> Result<()> {
        // If we're restoring from a mode switch, skip the pinned tasks initialization
        // because we've already restored the pane state from TuiState
        if self.restored_from_mode_switch {
            debug!("App::init - Skipping pinned task setup, restored from mode switch");
            return Ok(());
        }

        // Iterate over the pinned tasks and assign them to the terminal panes (up to the maximum of 2), focusing the first one as well
        let (pinned_tasks, run_mode, task_count, initiating_tasks) = {
            let state = self.core.state().lock();
            (
                state.pinned_tasks().to_vec(),
                state.run_mode(),
                get_task_count(state.task_graph()),
                state.initiating_tasks().clone(),
            )
        };

        for (idx, task) in pinned_tasks.iter().enumerate() {
            if idx < 2 {
                self.selection_manager.lock().select_task(task);

                if pinned_tasks.len() == 1 && idx == 0 {
                    self.display_and_focus_current_task_in_terminal_pane(match run_mode {
                        RunMode::RunMany => true,
                        RunMode::RunOne if task_count == 1 => false,
                        RunMode::RunOne => true,
                    });
                } else {
                    self.assign_current_task_to_pane(idx);
                }
            }
        }

        // Select the first initiating task (ensures user's requested task is selected)
        // Only in RunOne mode - in RunMany there's no single initiating task to prioritize
        if matches!(run_mode, RunMode::RunOne) {
            if let Some(first_initiating) = initiating_tasks.iter().next() {
                self.selection_manager.lock().select_task(first_initiating);
            }
        }

        Ok(())
    }

    pub fn start_command(&mut self, thread_count: Option<u32>) {
        // Save max_parallel to TuiState for mode switching persistence
        self.core.state().lock().save_max_parallel(thread_count);
        self.dispatch_action(Action::StartCommand(thread_count));
    }

    pub fn start_tasks(&mut self, tasks: Vec<Task>) {
        // Use TuiCore to record timing and update status
        // This ensures task_start_times are recorded properly
        self.core.start_tasks(&tasks);
        self.dispatch_action(Action::StartTasks(tasks));
    }

    pub fn update_task_status(&mut self, task_id: &str, status: TaskStatus) {
        // Get old status before updating to check for state transition
        let old_status = self.core.state().lock().get_task_status(task_id);
        // Update the task status map in shared state first
        self.core.update_task_status(task_id, status);

        // Auto-switch pane to failed dependency when a task becomes skipped
        if status == TaskStatus::Skipped {
            self.handle_automatic_pane_switching(task_id);
        }

        self.dispatch_action(Action::UpdateTaskStatus(task_id.to_owned(), status));

        // Update terminal progress indicator only when transitioning TO complete
        // FROM non-complete to prevent needless updates
        let was_complete = old_status
            .map(|s| Self::is_status_complete(s))
            .unwrap_or(false);

        if !was_complete && Self::is_status_complete(status) {
            self.update_terminal_progress();
        }
    }

    /// Get task status efficiently from shared state HashMap
    pub fn get_task_status(&self, task_id: &str) -> Option<TaskStatus> {
        let state = self.core.state().lock();
        state.get_task_status(task_id)
    }

    /// Get task continuous flag efficiently from task graph in shared state
    pub fn is_task_continuous(&self, task_id: &str) -> bool {
        let state = self.core.state().lock();
        is_task_continuous(state.task_graph(), task_id)
    }

    /// Check if a task status is considered complete
    fn is_status_complete(status: TaskStatus) -> bool {
        status.is_terminal()
    }

    pub fn print_task_terminal_output(&mut self, task_id: String, output: String) {
        // If a PTY already exists, the task's output was streamed via
        // append_task_output and we don't write it again. We still emit the
        // cursor-hide escape — append_task_output doesn't, and a finished
        // pane shouldn't show a blinking virtual cursor.
        {
            let state = self.core.state().lock();
            if let Some(pty) = state.get_pty_instance(&task_id) {
                pty.process_output(b"\x1b[?25l");
                drop(state);
                if self.is_task_continuous(&task_id) {
                    let _ = self.throttle_pty_resize();
                }
                return;
            }
        }

        // Tasks not run within a pseudo-terminal need a new pty instance to print output.
        let (rows, cols) = self.calculate_pty_dimensions_for_mode();
        let pty = PtyInstance::non_interactive_with_dimensions(rows, cols);

        // Hide the cursor at the end of static output so it doesn't blink in
        // a finished pane (most visible on cache hits).
        let output_with_hidden_cursor = format!("{}\x1b[?25l", output);
        write_output_to_pty(&pty, &output_with_hidden_cursor);

        self.register_pty_instance(&task_id, pty);
        let _ = self.throttle_pty_resize();
    }

    pub fn end_tasks(&mut self, task_results: Vec<TaskResult>) {
        // When tasks finish ensure that pty instances are resized appropriately as they may be actively displaying output when they finish
        let _ = self.throttle_pty_resize();

        // Use TuiCore to record end timing and update status
        // This ensures task_end_times are recorded properly
        self.core.end_tasks(&task_results);

        self.dispatch_action(Action::EndTasks(task_results));
    }

    // Show countdown popup for the configured duration (making sure the help popup is not open first)
    pub fn end_command(&mut self) {
        let state = self.core.state().lock();
        state
            .get_console_messenger()
            .as_ref()
            .and_then(|c| c.end_running_tasks());
        drop(state);

        self.dispatch_action(Action::EndCommand);
    }

    // Internal method to handle Action::EndCommand
    fn handle_end_command(&mut self) {
        // Use TuiCore to determine auto-exit behavior
        match self.core.get_auto_exit_decision() {
            AutoExitDecision::Stay => {
                // User interacted or auto-exit disabled - do nothing
            }
            AutoExitDecision::StayWithFailures(failed_task_names) => {
                // Multiple failures - show them to user
                // If there are no visible panes, focus the first failed task
                if !self.has_visible_panes() {
                    self.selection_manager
                        .lock()
                        .select_task(failed_task_names.first().unwrap());

                    // Display the task logs but keep focus on the task list
                    self.toggle_output_visibility();
                }
            }
            AutoExitDecision::ShowCountdown => {
                self.begin_exit_countdown();
            }
            AutoExitDecision::ExitImmediately => {
                self.quit();
            }
        }
    }

    fn quit(&mut self) {
        self.core.quit_immediately();
    }

    fn begin_exit_countdown(&mut self) {
        // Use TuiCore to get countdown duration
        let Some(countdown_duration) = self.core.get_countdown_duration() else {
            // Countdown is disabled, exit immediately
            self.quit();
            return;
        };

        // Show the countdown popup for the configured duration
        if let Some(countdown_popup) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
        {
            countdown_popup.start_countdown(countdown_duration);
            self.push_focus(Focus::CountdownPopup);
            self.core
                .schedule_quit(std::time::Duration::from_secs(countdown_duration));
        }
    }

    // A pseudo-terminal running task will provide the parser and writer directly
    pub fn register_running_interactive_task(
        &mut self,
        task_id: String,
        parser_and_writer: &(ParserArc, WriterArc),
    ) {
        debug!("Registering interactive task: {}", task_id);
        let pty =
            PtyInstance::interactive(parser_and_writer.0.clone(), parser_and_writer.1.clone());
        self.register_running_task(task_id, pty);
    }

    pub fn register_running_non_interactive_task(&mut self, task_id: String) {
        let (rows, cols) = self.calculate_pty_dimensions_for_mode();
        let pty = PtyInstance::non_interactive_with_dimensions(rows, cols);
        self.register_pty_instance(&task_id, pty);
        self.update_task_status(&task_id, TaskStatus::InProgress);
        // Ensure the pty instances get resized appropriately
        let _ = self.throttle_pty_resize();
    }

    fn register_running_task(&mut self, task_id: String, pty: PtyInstance) {
        self.register_pty_instance(&task_id, pty);
        self.update_task_status(&task_id, TaskStatus::InProgress);
    }

    pub fn append_task_output(&mut self, task_id: String, output: String) {
        // Check if PTY exists, create lazily if not (handles batch tasks)
        {
            let state = self.core.state().lock();
            if let Some(pty) = state.get_pty_instance(&task_id) {
                pty.process_output(output.as_bytes());
                return;
            }
        }

        // Create new PTY for task (batch tasks won't have one registered)
        let (rows, cols) = self.calculate_pty_dimensions_for_mode();
        let pty = PtyInstance::non_interactive_with_dimensions(rows, cols);
        pty.process_output(output.as_bytes());
        self.register_pty_instance(&task_id, pty);
        let _ = self.throttle_pty_resize();
    }

    pub fn append_batch_output(&mut self, batch_id: String, output: String) {
        let state = self.core.state().lock();
        if let Some(pty) = state.get_pty_instance(&batch_id) {
            pty.process_output(output.as_bytes());
        }
    }

    pub fn set_batch_status(&mut self, batch_id: String, status: BatchStatus) {
        // Early validation - running status doesn't trigger completion
        if batch_id.is_empty() || status == BatchStatus::Running {
            return;
        }

        // Success and failure trigger ungrouping. Route through the action queue
        // (like StartBatch) so completion is applied on the event-loop thread
        // AFTER the nested tasks' queued status/timing updates. Otherwise the
        // direct call races those updates and ungroups against stale component state.
        self.dispatch_action(Action::EndBatch(batch_id, status));
    }

    pub fn handle_event(
        &mut self,
        event: tui::Event,
        action_tx: &mpsc::UnboundedSender<Action>,
    ) -> Result<bool> {
        match event {
            tui::Event::Quit => {
                self.core.state().lock().quit_immediately();
                return Ok(false);
            }
            tui::Event::Tick => {
                let _ = action_tx.send(Action::Tick);

                // Check if we have a pending resize that needs to be processed
                if let Some(timer) = self.resize_debounce_timer {
                    let now = current_timestamp_millis() as u128;

                    if now >= timer {
                        // Timer expired, process the resize
                        self.handle_pty_resize()?;
                        self.resize_debounce_timer = None;
                    }
                }

                return Ok(false);
            }
            tui::Event::Render => action_tx.send(Action::Render)?,
            tui::Event::Resize(x, y) => action_tx.send(Action::Resize(x, y))?,
            tui::Event::Mouse(mouse) => {
                self.handle_mouse_event(mouse, action_tx);
            }
            tui::Event::Key(key) => {
                trace!("Handling Key Event: {:?}", key);

                // If the app is in interactive mode, interactions are with
                // the running task, not the app itself
                if !self.is_interactive_mode() {
                    // Record that the user has interacted with the app. This also
                    // cancels any pending auto-exit countdown (see mark_user_interacted),
                    // so a key press reliably keeps the TUI running even if it returns
                    // before reaching the countdown popup's own key handling below.
                    self.core.mark_user_interacted();
                }

                // Handle Ctrl+C to quit, unless we're in interactive mode and the focus is on a terminal pane
                if key.code == KeyCode::Char('c')
                    && key.modifiers == KeyModifiers::CONTROL
                    && !(matches!(self.focus(), Focus::MultipleOutput(_))
                        && self.is_interactive_mode())
                {
                    // Use TuiCore to handle Ctrl+C (end command, set forced shutdown, quit)
                    self.core.handle_ctrl_c();
                    return Ok(false);
                }

                if matches!(self.focus(), Focus::MultipleOutput(_)) && self.is_interactive_mode() {
                    return match key.code {
                        KeyCode::Char('z') if key.modifiers == KeyModifiers::CONTROL => {
                            // Disable interactive mode when Ctrl+Z is pressed
                            self.set_interactive_mode(false);
                            Ok(false)
                        }
                        _ => {
                            // Typing into a running interactive task still means the
                            // user is present, so record it (the `!is_interactive_mode()`
                            // guard above skipped the mark) before forwarding the key —
                            // otherwise the run-end auto-exit would quit on an active user.
                            self.core.mark_user_interacted();
                            // The TasksList will forward the key event to the focused terminal pane
                            self.handle_key_event(key).ok();
                            Ok(false)
                        }
                    };
                }

                if matches!(key.code, KeyCode::F(12)) {
                    self.dispatch_action(Action::ToggleDebugMode);
                    return Ok(false);
                }

                // F10 toggles mouse capture so the user can fall back to their
                // terminal's native cell selection (and back).
                if matches!(key.code, KeyCode::F(10)) {
                    self.dispatch_action(Action::ToggleMouseCapture);
                    return Ok(false);
                }

                // F11 toggles between full-screen and inline mode
                // Don't allow mode switch during countdown (user is about to quit)
                if matches!(key.code, KeyCode::F(11))
                    && !matches!(self.focus(), Focus::CountdownPopup)
                {
                    self.dispatch_action(Action::SwitchMode(TuiMode::Inline));
                    return Ok(false);
                }

                if self.debug_mode {
                    self.handle_debug_event(key);
                    return Ok(false);
                }

                // Only handle '?' key if we're not in interactive mode and the countdown popup is not open
                if matches!(key.code, KeyCode::Char('?'))
                    && !self.is_interactive_mode()
                    && !matches!(self.focus(), Focus::CountdownPopup)
                {
                    let show_help_popup = !matches!(self.focus(), Focus::HelpPopup);
                    if let Some(help_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                    {
                        help_popup.set_visible(show_help_popup);
                    }
                    if show_help_popup {
                        self.push_focus(Focus::HelpPopup);
                    } else {
                        self.close_popup(Focus::HelpPopup);
                    }
                    return Ok(false);
                }

                // Reopen the run report popup ('p' = performance). Skipped while
                // filtering so 'p' types into the filter instead of reopening.
                let is_filtering = self
                    .components
                    .iter()
                    .find_map(|c| c.as_any().downcast_ref::<TasksList>())
                    .map(|tasks_list| tasks_list.filter_mode)
                    .unwrap_or(false);
                if matches!(key.code, KeyCode::Char('p') | KeyCode::Char('P'))
                    && !self.is_interactive_mode()
                    && !is_filtering
                    && !matches!(self.focus(), Focus::CountdownPopup | Focus::HelpPopup)
                {
                    if let Some(countdown_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
                    {
                        if countdown_popup.has_summary() {
                            countdown_popup.reopen();
                            self.push_focus(Focus::CountdownPopup);
                        }
                    }
                    return Ok(false);
                }

                // If countdown popup is open, handle its keyboard events
                if matches!(self.focus(), Focus::CountdownPopup) {
                    // Control keys (q, Ctrl-C, scroll/pin, p, Esc) are handled here and
                    // return. Any other key dismisses the popup and then falls through
                    // to its normal handler below, so the keystroke isn't wasted just
                    // closing the report.
                    if let Some(countdown_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
                    {
                        match key.code {
                            KeyCode::Char('q') => {
                                // Quit immediately
                                trace!("Confirming shutdown");
                                self.core.state().lock().quit_immediately();
                                return Ok(false);
                            }
                            KeyCode::Char('c') if key.modifiers == KeyModifiers::CONTROL => {
                                // Quit immediately
                                trace!("Confirming shutdown");
                                self.core.state().lock().quit_immediately();
                                return Ok(false);
                            }
                            KeyCode::Up
                            | KeyCode::Char('k')
                            | KeyCode::Down
                            | KeyCode::Char('j') => {
                                // ↑/↓ pins the popup open (stops the auto-exit) so the
                                // report stays up to read, and scrolls if it overflows.
                                countdown_popup.pin_open();
                                if countdown_popup.is_scrollable() {
                                    if matches!(key.code, KeyCode::Up | KeyCode::Char('k')) {
                                        countdown_popup.scroll_up();
                                    } else {
                                        countdown_popup.scroll_down();
                                    }
                                }
                                self.core.state().lock().cancel_quit();
                                return Ok(false);
                            }
                            KeyCode::Char('p') | KeyCode::Char('P')
                                if countdown_popup.has_summary() =>
                            {
                                // `p` toggles the report. It's visible+focused here, so
                                // this press dismisses it (and stops the auto-exit);
                                // pressing `p` again from the task list reopens it via
                                // the handler above. The mid-run exit dialog has no
                                // summary, so `p` falls through to the dismiss catch-all.
                                countdown_popup.cancel_countdown();
                                self.core.state().lock().cancel_quit();
                                self.close_popup(Focus::CountdownPopup);
                                return Ok(false);
                            }
                            KeyCode::Esc => {
                                // Two-stage Esc on the report: first press pins it open,
                                // second closes it. The mid-run exit dialog has nothing
                                // to read, so Esc dismisses it at once.
                                if countdown_popup.has_summary() && !countdown_popup.is_pinned() {
                                    countdown_popup.pin_open();
                                    self.core.state().lock().cancel_quit();
                                } else {
                                    countdown_popup.cancel_countdown();
                                    self.core.state().lock().cancel_quit();
                                    self.close_popup(Focus::CountdownPopup);
                                }
                                return Ok(false);
                            }
                            KeyCode::F(11) | KeyCode::Enter if countdown_popup.has_summary() => {
                                // Jump from the report straight into inline in one
                                // press. Without an explicit arm the popup would
                                // swallow this key just to dismiss itself, so the
                                // switch wouldn't happen until a second press.
                                countdown_popup.cancel_countdown();
                                self.core.state().lock().cancel_quit();
                                self.close_popup(Focus::CountdownPopup);
                                self.dispatch_action(Action::SwitchMode(TuiMode::Inline));
                                return Ok(false);
                            }
                            _ => {
                                // Dismiss the report, then fall through (no early
                                // return) so this key still performs its normal action.
                                countdown_popup.cancel_countdown();
                                self.core.state().lock().cancel_quit();
                                self.close_popup(Focus::CountdownPopup);
                            }
                        }
                    }
                    // No early return: control keys above already returned; a dismissal
                    // falls through to the normal key handling below.
                }

                // If hint popup is open, only ESC dismisses it
                if matches!(self.focus(), Focus::HintPopup) {
                    if let Some(hint_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
                        && hint_popup.is_visible()
                    {
                        if key.code == KeyCode::Esc {
                            hint_popup.hide();
                            self.close_popup(Focus::HintPopup);
                        }
                        // All other keys are consumed while hint popup is visible
                        return Ok(false);
                    }
                    // Focus points at a hint popup that is no longer visible;
                    // repair the focus and let the key take its normal path
                    // instead of feeding it to an invisible modal.
                    self.close_popup(Focus::HintPopup);
                }

                if let Some(tasks_list) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
                {
                    // Handle Q to trigger countdown or immediate exit, depending on the tasks
                    if !tasks_list.filter_mode && key.code == KeyCode::Char('q') {
                        // Use TuiCore to handle quit request (sets forced_shutdown, checks completion)
                        if self.core.handle_quit_request() == QuitDecision::StartCountdown {
                            self.begin_exit_countdown();
                        }
                        return Ok(false);
                    }
                }

                // If shortcuts popup is open, handle its keyboard events
                if matches!(self.focus(), Focus::HelpPopup) {
                    match key.code {
                        KeyCode::Esc => {
                            if let Some(help_popup) = self
                                .components
                                .iter_mut()
                                .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                            {
                                help_popup.set_visible(false);
                            }
                            self.close_popup(Focus::HelpPopup);
                        }
                        KeyCode::Up | KeyCode::Char('k') => {
                            if let Some(help_popup) = self
                                .components
                                .iter_mut()
                                .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                            {
                                help_popup.scroll_up();
                            }
                            return Ok(false);
                        }
                        KeyCode::Down | KeyCode::Char('j') => {
                            if let Some(help_popup) = self
                                .components
                                .iter_mut()
                                .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                            {
                                help_popup.scroll_down();
                            }
                            return Ok(false);
                        }
                        KeyCode::PageUp => {
                            if let Some(help_popup) = self
                                .components
                                .iter_mut()
                                .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                            {
                                help_popup.page_up();
                            }
                            return Ok(false);
                        }
                        KeyCode::PageDown => {
                            if let Some(help_popup) = self
                                .components
                                .iter_mut()
                                .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                            {
                                help_popup.page_down();
                            }
                            return Ok(false);
                        }
                        _ => {}
                    }
                    return Ok(false);
                }

                // Handle Up/Down/PageUp/PageDown keys for scrolling first
                if matches!(self.focus(), Focus::MultipleOutput(_)) {
                    match key.code {
                        KeyCode::Up | KeyCode::Down | KeyCode::PageUp | KeyCode::PageDown => {
                            self.handle_key_event(key).ok();
                            return Ok(false);
                        }
                        KeyCode::Char('k') | KeyCode::Char('j') if !self.is_interactive_mode() => {
                            self.handle_key_event(key).ok();
                            return Ok(false);
                        }
                        _ => {}
                    }
                }

                // Get tasks list component for handling some key events
                let focus = self.focus();
                if let Some(tasks_list) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
                {
                    match focus {
                        Focus::MultipleOutput(_) => {
                            if self.is_interactive_mode() {
                                // Send all other keys to the task list (and ultimately through the terminal pane to the PTY)
                                self.handle_key_event(key).ok();
                            } else {
                                // Handle navigation and special actions
                                match key.code {
                                    KeyCode::Tab => {
                                        self.focus_next();
                                    }
                                    KeyCode::BackTab => {
                                        self.focus_previous();
                                    }
                                    KeyCode::Esc => {
                                        if !self.is_task_list_hidden() {
                                            self.set_base_focus(Focus::TaskList);
                                        }
                                    }
                                    // Add our new shortcuts here
                                    KeyCode::Char('c') => {
                                        self.handle_key_event(key).ok();
                                    }
                                    KeyCode::Char('u') | KeyCode::Char('d')
                                        if key.modifiers.contains(KeyModifiers::CONTROL) =>
                                    {
                                        self.handle_key_event(key).ok();
                                    }
                                    KeyCode::Char('b') => {
                                        self.toggle_task_list();
                                    }
                                    KeyCode::Char('m') => {
                                        if let Some(area) = self.frame_area {
                                            self.toggle_layout_mode(area);
                                        }
                                    }
                                    // If focused on a specific terminal pane, and not interactive, enter should
                                    // swap to inline tui mode focusing that task
                                    KeyCode::Enter => {
                                        // dispatch action to switch to inline mode with focused task
                                        self.dispatch_action(Action::SwitchMode(TuiMode::Inline));
                                    }
                                    _ => {
                                        // Forward other keys for interactivity, scrolling (j/k) etc
                                        self.handle_key_event(key).ok();
                                    }
                                }
                            }
                            return Ok(false);
                        }
                        _ => {
                            // Handle spacebar toggle regardless of focus
                            if key.code == KeyCode::Char(' ') {
                                self.toggle_output_visibility();
                                return Ok(false); // Skip other key handling
                            }

                            let is_filter_mode = tasks_list.filter_mode;

                            match focus {
                                Focus::TaskList => match key.code {
                                    KeyCode::Char('j') if !is_filter_mode => {
                                        self.dispatch_action(Action::NextTask);
                                    }
                                    KeyCode::Down => {
                                        self.dispatch_action(Action::NextTask);
                                    }
                                    KeyCode::Char('k') if !is_filter_mode => {
                                        self.dispatch_action(Action::PreviousTask);
                                    }
                                    KeyCode::Up => {
                                        self.dispatch_action(Action::PreviousTask);
                                    }
                                    KeyCode::Right if !is_filter_mode => {
                                        tasks_list.try_expand_selected_batch();
                                    }
                                    KeyCode::Left if !is_filter_mode => {
                                        tasks_list.try_collapse_selected_batch();
                                    }
                                    KeyCode::Esc => {
                                        if matches!(focus, Focus::HelpPopup) {
                                            if let Some(help_popup) =
                                                self.components.iter_mut().find_map(|c| {
                                                    c.as_any_mut().downcast_mut::<HelpPopup>()
                                                })
                                            {
                                                help_popup.set_visible(false);
                                            }
                                            self.close_popup(Focus::HelpPopup);
                                        } else {
                                            // Only clear filter when help popup is not in focus

                                            tasks_list.clear_filter();
                                        }
                                    }
                                    KeyCode::Char(c) => {
                                        if tasks_list.filter_mode {
                                            tasks_list.add_filter_char(c);
                                        } else {
                                            match c {
                                                '/' => {
                                                    tasks_list.enter_filter_mode();
                                                }
                                                c => {
                                                    match c {
                                                        'j' => {
                                                            self.dispatch_action(Action::NextTask);
                                                        }
                                                        'k' => {
                                                            self.dispatch_action(
                                                                Action::PreviousTask,
                                                            );
                                                        }
                                                        '1' => {
                                                            self.toggle_current_task_in_pane(0);
                                                            let _ = self.handle_pty_resize();
                                                            // No need to debounce
                                                        }
                                                        '2' => {
                                                            self.toggle_current_task_in_pane(1);
                                                            let _ = self.handle_pty_resize();
                                                            // No need to debounce
                                                        }
                                                        '0' => self.clear_all_panes(),
                                                        'b' => self.toggle_task_list(),
                                                        'm' => {
                                                            if let Some(area) = self.frame_area {
                                                                self.toggle_layout_mode(area);
                                                            }
                                                        }
                                                        _ => {}
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    KeyCode::Backspace => {
                                        if tasks_list.filter_mode {
                                            tasks_list.remove_filter_char();
                                        }
                                    }
                                    KeyCode::Tab => {
                                        self.focus_next();
                                    }
                                    KeyCode::BackTab => {
                                        self.focus_previous();
                                    }
                                    KeyCode::Enter if is_filter_mode => {
                                        tasks_list.persist_filter();
                                    }
                                    KeyCode::Enter if matches!(self.focus(), Focus::TaskList) => {
                                        self.display_and_focus_current_task_in_terminal_pane(false);
                                    }
                                    _ => {}
                                },
                                Focus::MultipleOutput(_idx) => match key.code {
                                    KeyCode::Tab => {
                                        self.focus_next();
                                    }
                                    KeyCode::BackTab => {
                                        self.focus_previous();
                                    }
                                    _ => {}
                                },
                                Focus::HelpPopup => {
                                    // Shortcuts popup has its own key handling above
                                }
                                Focus::CountdownPopup => {
                                    // Countdown popup has its own key handling above
                                }
                                Focus::HintPopup => {
                                    // Hint popup has its own key handling above
                                }
                            }
                        }
                    }
                }
            }
            _ => {}
        }

        for component in self.components.iter_mut() {
            if let Some(action) = component.handle_events(Some(event.clone()))? {
                action_tx.send(action)?;
            }
        }

        Ok(false)
    }

    pub fn handle_action(
        &mut self,
        tui: &mut Tui,
        action: Action,
        action_tx: &UnboundedSender<Action>,
    ) {
        if action != Action::Tick && action != Action::Render {
            trace!("{action:?}");
        }
        match &action {
            Action::StartCommand(_) => {
                let state = self.core.state().lock();
                state
                    .get_console_messenger()
                    .as_ref()
                    .and_then(|c| c.start_running_tasks());
            }
            Action::Tick => {
                let state = self.core.state().lock();
                state
                    .get_console_messenger()
                    .as_ref()
                    .and_then(|messenger| {
                        self.components
                            .iter()
                            .find_map(|c| c.as_any().downcast_ref::<TasksList>())
                            .and_then(|tasks_list| {
                                let pty_instances = state.get_pty_instances();
                                messenger.update_running_tasks(
                                    &tasks_list.get_all_tasks(),
                                    &pty_instances,
                                )
                            })
                    });
                drop(state);

                // Auto-dismiss hint popup after duration elapsed
                if let Some(hint_popup) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
                {
                    if hint_popup.should_auto_dismiss() {
                        hint_popup.hide();
                        // Drop the hint's focus layer wherever it sits — it may
                        // be buried under another popup rather than on top.
                        self.close_popup(Focus::HintPopup);
                    }
                }

                // Clear expired status messages from terminal panes
                for terminal_pane_data in &mut self.terminal_pane_data {
                    if let Some((_, shown_at)) = &terminal_pane_data.status_message {
                        if shown_at.elapsed() > STATUS_MESSAGE_DURATION {
                            terminal_pane_data.status_message = None;
                        }
                    }
                }
            }
            // Quit immediately
            Action::Quit => {
                self.core.state().lock().quit_immediately();
            }
            // Cancel quitting
            Action::CancelQuit => {
                self.core.state().lock().cancel_quit();
                self.close_popup(Focus::CountdownPopup);
            }
            Action::Resize(w, h) => {
                let rect = Rect::new(0, 0, *w, *h);
                tui.resize(rect).ok();
                // Update the cached frame area
                self.frame_area = Some(rect);
                // Recalculate the layout areas
                self.recalculate_layout_areas();
                // Ensure the pty instances get resized appropriately (debounced)
                let _ = self.throttle_pty_resize();
            }
            Action::ToggleDebugMode => {
                self.debug_mode = !self.debug_mode;
                debug!("Debug mode: {}", self.debug_mode);
            }
            Action::ToggleMouseCapture => {
                self.mouse_capture_enabled = !self.mouse_capture_enabled;
                if self.mouse_capture_enabled {
                    let _ = crate::native::tui::tui::enable_mouse_capture();
                    // Returning to in-app behavior; drop the explanatory hint.
                    if let Some(hint_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
                        && hint_popup.is_visible()
                    {
                        hint_popup.hide();
                        self.close_popup(Focus::HintPopup);
                    }
                } else {
                    let _ = crate::native::tui::tui::disable_mouse_capture();
                    // In-app selections can no longer be updated by the mouse.
                    self.clear_all_pane_selections();
                    self.region_selection = None;
                    self.dispatch_action(Action::ShowHint(
                        "Mouse capture off — drag to select text with your terminal. Press F10 to re-enable."
                            .to_string(),
                    ));
                }
            }
            Action::Render => {
                // Derive the status bar's props from canonical state up front,
                // taking the state lock once and dropping it before the
                // TasksList read (its filter methods take the same lock).
                let (mut status_bar_props, filter_text) = {
                    let state = self.core.state().lock();
                    (
                        StatusBarProps {
                            is_dimmed: !matches!(self.focus, Focus::TaskList),
                            perf_report_available: state.has_exit_summary(),
                            cloud_message: state.get_cloud_message().map(str::to_string),
                            cloud_link: state.get_cloud_link().cloned(),
                            completed_count: state.get_completed_task_count(),
                            total_count: state.tasks().len(),
                            all_completed: state.is_run_completed(),
                            has_failures: state.has_failures(),
                            run_time_range: state.run_time_range(),
                            filter: None,
                        },
                        state.get_filter_text().to_string(),
                    )
                };
                status_bar_props.filter = self
                    .components
                    .iter()
                    .find_map(|c| c.as_any().downcast_ref::<TasksList>())
                    .and_then(|tasks_list| tasks_list.filter_display(&filter_text));

                // Hit-test regions are rebuilt every frame inside the draw closure,
                // then stored on self so mouse events can resolve what's under the cursor.
                let mut captured_regions: Vec<MouseRegion> = Vec::new();
                tui.draw(|f| {
                    let area = f.area();

                    // Clear every component's link registry before drawing. Each
                    // repopulates its links as it renders, so a component that
                    // isn't drawn this frame leaves no stale clickable regions.
                    for component in self.components.iter_mut() {
                        if let Some(registry) = component.link_registry_mut() {
                            registry.clear();
                        }
                    }
                    self.status_bar.link_registry_mut().clear();

                    // Cache the frame area if it's never been set before (will be updated in subsequent resize events if necessary)
                    if self.frame_area.is_none() {
                        self.frame_area = Some(area);
                    }

                    // Determine the required layout areas for the tasks list and terminal panes using the LayoutManager
                    if self.layout_areas.is_none() {
                        self.recalculate_layout_areas();
                    }

                    let frame_area = self.frame_area.unwrap();
                    let layout_areas = self.layout_areas.as_ref().unwrap();
                    let status_bar_area = layout_areas.status_bar;

                    if self.debug_mode {
                        let debug_widget = TuiLoggerSmartWidget::default().state(&self.debug_state);
                        f.render_widget(debug_widget, frame_area);
                        return;
                    }

                    // TODO: move this to the layout manager?
                    // Check for minimum viable viewport size at the app level
                    if frame_area.height < 10 || frame_area.width < 40 {
                        // First ensure the frame area is at least 1x1, otherwise we can't render anything
                        if frame_area.width == 0 || frame_area.height == 0 {
                            return; // Can't render anything in a zero-sized area
                        }

                        // Create a simple message that fits in a single line to avoid scrolling issues
                        let message = Line::from(vec![
                            Span::styled(
                                " NX ",
                                Style::reset()
                                    .add_modifier(Modifier::BOLD)
                                    .bg(THEME.error)
                                    .fg(THEME.primary_fg),
                            ),
                            Span::raw(" Terminal too small "),
                        ]);

                        // When terminal is extremely small (height < 3), render just the message
                        // without any vertical padding to prevent index out of bounds errors
                        if frame_area.height < 3 {
                            let paragraph =
                                NxParagraph::new(vec![message]).alignment(Alignment::Center);

                            // Create a safe area that's guaranteed to be within bounds
                            let safe_area = Rect {
                                x: frame_area.x,
                                y: frame_area.y,
                                width: frame_area
                                    .width
                                    .min(f.area().width.saturating_sub(frame_area.x)),
                                height: frame_area
                                    .height
                                    .min(f.area().height.saturating_sub(frame_area.y)),
                            };

                            f.render_widget(paragraph, safe_area);
                            return;
                        }

                        // For slightly larger terminals (height >= 3), use vertical padding
                        let empty_line = Line::from("");
                        let mut lines = vec![];

                        // Add empty lines to center vertically, but cap it to prevent going out of bounds
                        let vertical_padding = ((frame_area.height as usize).saturating_sub(3) / 2)
                            .min(frame_area.height as usize - 1); // Ensure we leave at least 1 line for the message

                        for _ in 0..vertical_padding {
                            lines.push(empty_line.clone());
                        }

                        // Add the message
                        lines.push(message);

                        let paragraph = NxParagraph::new(lines).alignment(Alignment::Center);

                        // Create a safe area that's guaranteed to be within bounds (this can happen if the user resizes the window a lot before it stabilizes it seems)
                        let safe_area = Rect {
                            x: frame_area.x,
                            y: frame_area.y,
                            width: frame_area
                                .width
                                .min(f.area().width.saturating_sub(frame_area.x)),
                            height: frame_area
                                .height
                                .min(f.area().height.saturating_sub(frame_area.y)),
                        };

                        f.render_widget(paragraph, safe_area);
                        return;
                    }

                    // Draw the TaskList component, if visible
                    if let Some(task_list_area) = layout_areas.task_list
                        && let Some(tasks_list) = self
                            .components
                            .iter_mut()
                            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
                    {
                        let _ = tasks_list.draw(f, task_list_area);
                        captured_regions.push(MouseRegion {
                            rect: task_list_area,
                            kind: MouseRegionKind::TaskList,
                        });
                    }

                    // Clone terminal pane areas upfront to avoid borrow conflicts with self
                    // This is a small vec (at most 2 elements), so the clone cost is minimal
                    let terminal_panes: Vec<Rect> = layout_areas.terminal_panes.clone();
                    let num_visible_panes = terminal_panes.len();

                    // Clone pane_tasks upfront to avoid borrow conflicts when calling render methods
                    // This is a small fixed-size array (2 elements), so the clone cost is minimal
                    let pane_tasks_snapshot: [Option<SelectionEntry>; 2] = if self.spacebar_mode {
                        // In spacebar mode, use the current selection from selection manager
                        let manager = self.selection_manager.lock();
                        let selection = manager.get_selection().cloned();
                        [selection, None]
                    } else {
                        self.pane_tasks.clone()
                    };

                    // Capture focus state before mutable borrows
                    let current_focus = self.focus();

                    // Iterate over panes in order, mapping to physical positions
                    // Physical position 0 gets the first pinned task, position 1 gets the second
                    let mut physical_idx = 0;
                    for (pane_idx, selection_opt) in pane_tasks_snapshot.iter().enumerate() {
                        let Some(sel) = selection_opt else { continue };
                        let Some(&pane_area) = terminal_panes.get(physical_idx) else {
                            continue;
                        };

                        let is_focused = matches!(
                            current_focus,
                            Focus::MultipleOutput(focused) if focused == pane_idx
                        );

                        let is_next_tab_target = !is_focused
                            && match current_focus {
                                Focus::TaskList => physical_idx == 0,
                                Focus::MultipleOutput(_) => {
                                    physical_idx == 1 && num_visible_panes > 1
                                }
                                _ => false,
                            };

                        match sel {
                            SelectionEntry::BatchGroup(batch_id) => {
                                self.render_batch_terminal_pane_internal(
                                    f,
                                    pane_idx,
                                    pane_area,
                                    batch_id.clone(),
                                    is_focused,
                                    is_next_tab_target,
                                );
                            }
                            SelectionEntry::Task(task_name) => {
                                let task_status = self
                                    .get_task_status(task_name)
                                    .unwrap_or(TaskStatus::NotStarted);

                                if matches!(
                                    task_status,
                                    TaskStatus::NotStarted | TaskStatus::Skipped
                                ) {
                                    self.render_dependency_view_internal(
                                        f,
                                        pane_idx,
                                        pane_area,
                                        task_name.clone(),
                                        is_focused,
                                    );
                                } else {
                                    self.render_terminal_pane_internal(
                                        f,
                                        pane_idx,
                                        pane_area,
                                        task_name.clone(),
                                        is_focused,
                                        is_next_tab_target,
                                    );
                                }
                            }
                        }

                        captured_regions.push(MouseRegion {
                            rect: pane_area,
                            kind: MouseRegionKind::Pane(pane_idx),
                        });
                        physical_idx += 1;
                    }

                    // Draw the full-width status bar into its reserved bottom
                    // row(s), before the popups so they overlay it.
                    if let Some(bar_area) = status_bar_area {
                        self.status_bar.render(f, bar_area, &status_bar_props);
                    }

                    // Draw the popups (help, countdown, interstitial)
                    // Draw each popup sequentially to avoid multiple mutable borrows
                    if let Some(help_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                    {
                        let _ = help_popup.draw(f, frame_area);
                    }
                    if let Some(countdown_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
                    {
                        let _ = countdown_popup.draw(f, frame_area);
                    }
                    if let Some(hint_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
                    {
                        let _ = hint_popup.draw(f, frame_area);
                    }

                    // Snapshot the selectable region's cells (for mouse selection
                    // / link clicks) and paint any in-progress selection on top.
                    self.capture_region_snapshot_and_highlight(f);

                    // Persistent indicator while mouse capture is disabled (F10),
                    // drawn last so it sits above everything else.
                    if !self.mouse_capture_enabled {
                        Self::draw_mouse_capture_badge(f, frame_area);
                    }
                })
                .ok();
                self.mouse_regions = captured_regions;
            }
            Action::SendConsoleMessage(msg) => {
                let state = self.core.state().lock();
                if let Some(connection) = state.get_console_messenger() {
                    connection.send_terminal_string(msg);
                } else {
                    trace!("No console connection available");
                }
            }
            Action::EndCommand => {
                self.handle_end_command();
            }
            Action::ShowHint(message) => {
                // Only show hints if not suppressed by config
                let suppress_hints = self.core.state().lock().tui_config().suppress_hints;
                if !suppress_hints {
                    if let Some(hint_popup) = self
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
                    {
                        hint_popup.show(message.clone());
                        self.push_focus(Focus::HintPopup);
                    }
                }
            }
            Action::StartBatch(batch_id, batch_info) => {
                self.handle_batch_start(batch_id.clone(), batch_info.clone());
            }
            Action::EndBatch(batch_id, status) => {
                self.handle_batch_complete(batch_id.clone(), *status);
            }
            _ => {}
        }

        // Update child components with the received action
        for component in self.components.iter_mut() {
            if let Ok(Some(new_action)) = component.update(action.clone()) {
                action_tx.send(new_action).ok();
            }
        }
    }

    #[cfg(not(test))]
    pub fn set_done_callback(
        &mut self,
        done_callback: ThreadsafeFunction<(), Unknown<'static>, (), Status, false>,
    ) {
        self.core.state().lock().set_done_callback(done_callback);
    }

    #[cfg(not(test))]
    pub fn set_forced_shutdown_callback(
        &mut self,
        forced_shutdown_callback: ThreadsafeFunction<(), Unknown<'static>, (), Status, false>,
    ) {
        self.core
            .state()
            .lock()
            .set_forced_shutdown_callback(forced_shutdown_callback);
    }

    pub fn call_done_callback(&self) {
        self.core.state().lock().call_done_callback();
    }

    pub fn set_cloud_message(&mut self, message: Option<String>) {
        self.core.state().lock().set_cloud_message(message);
        // Cloud content affects the status bar height on narrow terminals.
        self.layout_areas = None;
    }

    pub fn set_cloud_link(&mut self, label: String, url: String) {
        self.core.state().lock().set_cloud_link(Some((label, url)));
        // Cloud content affects the status bar height on narrow terminals.
        self.layout_areas = None;
    }

    /// Dispatches an action to the action tx for other components to handle however they see fit
    fn dispatch_action(&self, action: Action) {
        self.core.dispatch_action(action);
    }

    fn recalculate_layout_areas(&mut self) {
        if let Some(frame_area) = self.frame_area {
            let has_cloud_content = {
                let state = self.core.state().lock();
                state.get_cloud_message().is_some() || state.get_cloud_link().is_some()
            };
            let status_bar_height = StatusBar::required_height(frame_area.width, has_cloud_content);
            self.layout_areas = Some(
                self.layout_manager
                    .calculate_layout(frame_area, status_bar_height),
            );
        }
    }

    /// Checks if the current view has any visible output panes.
    fn has_visible_panes(&self) -> bool {
        self.pane_tasks.iter().any(|t| t.is_some())
    }

    /// Clears PTY reference and related state for a specific pane
    fn clear_pane_pty_reference(&mut self, pane_idx: usize) {
        if pane_idx < 2 {
            self.terminal_pane_data[pane_idx].pty = None;
            self.terminal_pane_data[pane_idx].can_be_interactive = false;
            self.terminal_pane_data[pane_idx].set_interactive(false);
        }
    }

    /// Clears all output panes and resets their associated state.
    fn clear_all_panes(&mut self) {
        // Clean up all completed batches and their PTYs since we're clearing all panes
        {
            let mut state = self.core.state().lock();
            for batch_id in self.completed_pinned_batches.keys() {
                state.get_pty_instances_mut().remove(batch_id);
                state.remove_batch_metadata(batch_id);
            }
        }
        self.completed_pinned_batches.clear();

        self.pane_tasks = [None, None];

        // Clear PTY references for both panes
        self.clear_pane_pty_reference(0);
        self.clear_pane_pty_reference(1);

        self.set_base_focus(Focus::TaskList);
        self.set_spacebar_mode(false, None);
        self.dispatch_action(Action::UnpinAllTasks);
    }

    /// Toggles the visibility of the output pane for the currently selected item (task or batch group).
    /// In spacebar mode, the output follows the selection.
    fn toggle_output_visibility(&mut self) -> Option<()> {
        // TODO: Not sure why we do this, this action only happens when the task list is visible
        self.layout_manager
            .set_task_list_visibility(TaskListVisibility::Visible);

        let selection = self.selection_manager.lock().get_selection().cloned()?;

        if self.has_visible_panes() {
            self.clear_all_panes();
            self.set_spacebar_mode(false, None);
        } else {
            // Show current selection in pane 1 in spacebar mode
            self.pane_tasks = [Some(selection), None];
            self.set_spacebar_mode(true, None);
        }
        Some(())
    }

    fn set_spacebar_mode(
        &mut self,
        spacebar_mode: bool,
        selection_mode_override: Option<SelectionMode>,
    ) {
        self.spacebar_mode = spacebar_mode;

        let selection_mode = if spacebar_mode {
            // When entering spacebar mode, we want to track by name by default
            SelectionMode::TrackByName
        } else {
            // When exiting spacebar mode, we want to track by position by default
            SelectionMode::TrackByPosition
        };
        self.selection_manager
            .lock()
            .set_selection_mode(selection_mode_override.unwrap_or(selection_mode));

        if spacebar_mode {
            self.layout_manager
                .set_pane_arrangement(PaneArrangement::Single);
        } else {
            self.layout_manager
                .set_pane_arrangement(PaneArrangement::None);
        }

        // Recalculate the layout areas
        self.recalculate_layout_areas();

        // Ensure the pty instances get resized appropriately
        let _ = self.throttle_pty_resize();

        self.dispatch_action(Action::SetSpacebarMode(spacebar_mode));
    }

    fn focus_next(&mut self) {
        if !self.has_visible_panes() {
            return;
        }

        let focus = match self.focus() {
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
                        if self.is_task_list_hidden() {
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
            Focus::HintPopup => Focus::TaskList,
        };

        self.set_base_focus(focus);
    }

    fn focus_previous(&mut self) {
        let num_panes = self.pane_tasks.iter().filter(|t| t.is_some()).count();
        if num_panes == 0 {
            return; // No panes to focus
        }

        let focus = match self.focus() {
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
                    } else if !self.is_task_list_hidden() {
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
                    if !self.is_task_list_hidden() {
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
            Focus::HintPopup => Focus::TaskList,
        };

        self.set_base_focus(focus);
    }

    fn toggle_task_list(&mut self) {
        // If there are no visible panes, do nothing, otherwise the screen will be blank
        if !self.has_visible_panes() {
            return;
        }
        self.layout_manager.toggle_task_list_visibility();
        self.recalculate_layout_areas();
        // Ensure the pty instances get resized appropriately (no debounce as this is based on an imperative user action)
        let _ = self.handle_pty_resize();
    }

    fn toggle_layout_mode(&mut self, area: Rect) {
        self.layout_manager.toggle_layout_mode(area);
        self.recalculate_layout_areas();
        // Ensure the pty instances get resized appropriately (no debounce as this is based on an imperative user action)
        let _ = self.handle_pty_resize();
    }

    /// Toggle pin state: if the selected task is already in this pane, unpin it;
    /// otherwise pin it (moving from the other pane if needed). Used by [1]/[2] keys.
    fn toggle_current_task_in_pane(&mut self, pane_idx: usize) -> Option<()> {
        let selection = self.selection_manager.lock().get_selection().cloned()?;

        if self.spacebar_mode {
            self.exit_spacebar_and_pin(selection, pane_idx);
        } else if self.pane_tasks[pane_idx].as_ref() == Some(&selection) {
            // Already pinned to this pane — unpin it
            self.pane_tasks[pane_idx] = None;
            self.clear_pane_pty_reference(pane_idx);
            self.dependency_view_states[pane_idx] = None;

            let pinned_count = self.pane_tasks.iter().filter(|t| t.is_some()).count();
            match pinned_count {
                0 => {
                    self.set_base_focus(Focus::TaskList);
                    self.set_spacebar_mode(false, Some(SelectionMode::TrackByPosition));
                    self.layout_manager
                        .set_pane_arrangement(PaneArrangement::None);
                }
                1 => self
                    .layout_manager
                    .set_pane_arrangement(PaneArrangement::Single),
                _ => self
                    .layout_manager
                    .set_pane_arrangement(PaneArrangement::Double),
            }

            self.dispatch_action(Action::UnpinSelection(pane_idx));
        } else {
            self.move_or_pin_selection(selection, pane_idx);
        }

        self.finalize_pane_assignment();
        Some(())
    }

    /// Pin the selected task to a pane. If the task is already pinned to the other
    /// pane, it moves it. Never unpins, never focuses. Used by init and as a
    /// building block for display_and_focus.
    /// The dependency-view state for `pane_idx`, but only when the pane is
    /// actually rendering a dependency view (a pending/skipped task). A pane only
    /// shows the dependency view under that condition, so mirror it before
    /// trusting the captured render data.
    fn active_dependency_view(&self, pane_idx: usize) -> Option<&DependencyViewState> {
        let pane_sel = if self.spacebar_mode {
            self.selection_manager.lock().get_selection().cloned()
        } else {
            self.pane_tasks[pane_idx].clone()
        };
        let SelectionEntry::Task(task_name) = pane_sel? else {
            return None;
        };
        let status = self
            .get_task_status(&task_name)
            .unwrap_or(TaskStatus::NotStarted);
        if !matches!(status, TaskStatus::NotStarted | TaskStatus::Skipped) {
            return None;
        }
        self.dependency_view_states[pane_idx].as_ref()
    }

    /// Mutable counterpart to [`Self::active_dependency_view`], for scrolling the
    /// dependency view in response to the mouse wheel.
    fn active_dependency_view_mut(&mut self, pane_idx: usize) -> Option<&mut DependencyViewState> {
        let pane_sel = if self.spacebar_mode {
            self.selection_manager.lock().get_selection().cloned()
        } else {
            self.pane_tasks[pane_idx].clone()
        };
        let SelectionEntry::Task(task_name) = pane_sel? else {
            return None;
        };
        let status = self
            .get_task_status(&task_name)
            .unwrap_or(TaskStatus::NotStarted);
        if !matches!(status, TaskStatus::NotStarted | TaskStatus::Skipped) {
            return None;
        }
        self.dependency_view_states[pane_idx].as_mut()
    }

    /// If `pane_idx` is currently rendering a dependency view, resolve a click at
    /// `(col, row)` to the dependency task under the cursor. Returns `None` when
    /// the pane isn't showing a dependency view or the click missed every row.
    fn dependency_view_click_target(&self, pane_idx: usize, col: u16, row: u16) -> Option<String> {
        self.active_dependency_view(pane_idx)?
            .handle_click(col, row)
    }

    /// The selectable text region of `pane_idx`'s dependency view, used to bound a
    /// drag-based text selection. `None` when the pane isn't showing one.
    fn dependency_view_selection_area(&self, pane_idx: usize) -> Option<Rect> {
        self.active_dependency_view(pane_idx)?.selection_area
    }

    /// Select `task_name`, pin it to `pane_idx`, and focus that pane — used to
    /// navigate from a dependency view to one of the dependencies it lists.
    fn navigate_to_task_in_pane(&mut self, task_name: &str, pane_idx: usize) {
        self.selection_manager.lock().select_task(task_name);
        self.assign_current_task_to_pane(pane_idx);
        self.set_base_focus(Focus::MultipleOutput(pane_idx));
    }

    fn assign_current_task_to_pane(&mut self, pane_idx: usize) -> Option<()> {
        let selection = self.selection_manager.lock().get_selection().cloned()?;

        if self.spacebar_mode {
            self.exit_spacebar_and_pin(selection, pane_idx);
        } else {
            self.move_or_pin_selection(selection, pane_idx);
        }

        self.finalize_pane_assignment();
        Some(())
    }

    /// Shared helper: exit spacebar mode and pin the selection to the target pane.
    fn exit_spacebar_and_pin(&mut self, selection: SelectionEntry, pane_idx: usize) {
        self.pane_tasks[0] = None;
        self.clear_pane_pty_reference(0);
        self.dependency_view_states[0] = None;

        self.set_spacebar_mode(false, Some(SelectionMode::TrackByName));

        self.dispatch_action(Action::PinSelection(selection.clone(), pane_idx));
        self.pane_tasks[pane_idx] = Some(selection);
        self.layout_manager
            .set_pane_arrangement(PaneArrangement::Single);
    }

    /// Shared helper: move a selection from the other pane or pin a fresh selection.
    fn move_or_pin_selection(&mut self, selection: SelectionEntry, pane_idx: usize) {
        let other_pane_idx = 1 - pane_idx;
        if self.pane_tasks[other_pane_idx].as_ref() == Some(&selection) {
            // Moving from the other pane
            self.pane_tasks[other_pane_idx] = None;
            self.clear_pane_pty_reference(other_pane_idx);
            self.dependency_view_states[other_pane_idx] = None;
            self.dispatch_action(Action::UnpinSelection(other_pane_idx));

            self.layout_manager
                .set_pane_arrangement(PaneArrangement::Single);

            self.dispatch_action(Action::PinSelection(selection.clone(), pane_idx));
            self.pane_tasks[pane_idx] = Some(selection);
        } else {
            // Fresh pin
            self.cleanup_pane_completed_batch(pane_idx);

            self.dispatch_action(Action::PinSelection(selection.clone(), pane_idx));
            self.pane_tasks[pane_idx] = Some(selection);
            self.set_base_focus(Focus::TaskList);

            self.set_spacebar_mode(false, Some(SelectionMode::TrackByName));

            let pinned_count = self.pane_tasks.iter().filter(|t| t.is_some()).count();
            match pinned_count {
                0 => self
                    .layout_manager
                    .set_pane_arrangement(PaneArrangement::None),
                1 => self
                    .layout_manager
                    .set_pane_arrangement(PaneArrangement::Single),
                _ => self
                    .layout_manager
                    .set_pane_arrangement(PaneArrangement::Double),
            }
        }
    }

    fn finalize_pane_assignment(&mut self) {
        // Always re-evaluate the optimal size of the terminal pane(s)
        self.recalculate_layout_areas();
        // Ensure the pty instances get resized appropriately (no debounce as this is based on an imperative user action)
        let _ = self.handle_pty_resize();
    }

    /// Forward key events to the currently focused pane, if any.
    fn handle_key_event(&mut self, key: KeyEvent) -> io::Result<()> {
        if let Focus::MultipleOutput(pane_idx) = self.focus() {
            // Get the task assigned to this pane to determine how to handle keys
            // In spacebar mode, use selection manager; in pinned mode, use pane_tasks
            let selection = if self.spacebar_mode {
                self.selection_manager.lock().get_selection().cloned()
            } else {
                self.pane_tasks[pane_idx].clone()
            };

            match selection {
                Some(SelectionEntry::BatchGroup(_)) => {
                    // Batch groups show terminal output, handle keys in terminal pane
                    // Batch PTY instances are typically non-interactive, but still handle scrolling
                    let terminal_pane_data = &mut self.terminal_pane_data[pane_idx];
                    if let Some(action) = terminal_pane_data.handle_key_event(key)? {
                        self.dispatch_action(action);
                    }
                }
                Some(SelectionEntry::Task(task_name)) => {
                    // Handle task (identifier is pure task name)
                    let task_status = self
                        .get_task_status(&task_name)
                        .unwrap_or(TaskStatus::NotStarted);
                    if matches!(task_status, TaskStatus::NotStarted | TaskStatus::Skipped) {
                        // Task is pending - handle keys in dependency view
                        if let Some(dep_state) = &mut self.dependency_view_states[pane_idx]
                            && let Some(action) = dep_state.handle_key_event(key)
                        {
                            self.dispatch_action(action);
                        }
                        return Ok(());
                    } else {
                        // Task is running/completed - handle keys in terminal pane
                        let terminal_pane_data = &mut self.terminal_pane_data[pane_idx];
                        if let Some(action) = terminal_pane_data.handle_key_event(key)? {
                            self.dispatch_action(action);
                        }
                    }
                }
                None => {}
            }
            Ok(())
        } else {
            Ok(())
        }
    }

    /// Handle a mouse event from the terminal.
    ///
    /// The mouse is only captured in fullscreen mode (see `Tui::enter` and
    /// `Tui::switch_mode`), so this is only reached there. Wheel events scroll
    /// whatever is under the cursor; left-clicks select/focus and double-clicks
    /// drop into the inline view.
    fn handle_mouse_event(&mut self, mouse: MouseEvent, action_tx: &mpsc::UnboundedSender<Action>) {
        // When the user has disabled capture (F10), the terminal owns the mouse;
        // ignore any stray events that still arrive.
        if !self.mouse_capture_enabled {
            return;
        }

        // Mouse activity means the user is present, exactly like a key press:
        // mark interaction so auto-exit won't fire (and an active countdown can
        // be clicked away below).
        if !self.is_interactive_mode() {
            self.core.mark_user_interacted();
        }

        // A focused popup is a modal layer: it absorbs all mouse events so they
        // never fall through to the task list or panes underneath it.
        if self.active_modal_kind().is_some() {
            self.handle_modal_mouse(mouse);
            return;
        }

        let (col, row) = (mouse.column, mouse.row);
        match mouse.kind {
            MouseEventKind::ScrollUp => self.scroll_at(col, row, ScrollDirection::Up, action_tx),
            MouseEventKind::ScrollDown => {
                self.scroll_at(col, row, ScrollDirection::Down, action_tx)
            }
            MouseEventKind::Down(MouseButton::Left) => self.handle_left_press(col, row),
            MouseEventKind::Drag(MouseButton::Left) => self.handle_left_drag(col, row),
            MouseEventKind::Up(MouseButton::Left) => self.handle_left_release(col, row),
            _ => {}
        }
    }

    /// Find the topmost hit-test region under a cell, if any. Iterates in
    /// reverse so regions drawn later (on top) win ties.
    fn region_at(&self, col: u16, row: u16) -> Option<MouseRegionKind> {
        let point = Position::new(col, row);
        self.mouse_regions
            .iter()
            .rev()
            .find(|r| r.rect.contains(point))
            .map(|r| r.kind)
    }

    /// Scroll whatever is under the cursor: an output pane scrolls its buffer,
    /// the task list moves its selection, and empty space falls back to the
    /// focused element.
    fn scroll_at(
        &mut self,
        col: u16,
        row: u16,
        direction: ScrollDirection,
        action_tx: &mpsc::UnboundedSender<Action>,
    ) {
        match self.region_at(col, row) {
            Some(MouseRegionKind::Pane(pane_idx)) => {
                // Mirror the keyboard path: a pane showing a dependency view (a
                // pending/skipped task) scrolls that list; otherwise scroll the
                // terminal buffer. Without this fork the wheel scrolled the
                // hidden PTY behind the dependency view.
                if let Some(dep_state) = self.active_dependency_view_mut(pane_idx) {
                    dep_state.scroll(direction);
                } else {
                    self.terminal_pane_data[pane_idx].handle_mouse_scroll(direction);
                }
            }
            Some(MouseRegionKind::TaskList) => {
                // Scrolling the list moves rows under a screen-coordinate
                // selection, so drop the now-stale highlight.
                self.region_selection = None;
                self.send_list_scroll(direction, action_tx);
            }
            None => self.scroll_focused(direction, action_tx),
        }
    }

    /// Move the task-list selection in `direction` (wheel over the list).
    fn send_list_scroll(
        &self,
        direction: ScrollDirection,
        action_tx: &mpsc::UnboundedSender<Action>,
    ) {
        let action = match direction {
            ScrollDirection::Up => Action::PreviousTask,
            ScrollDirection::Down => Action::NextTask,
        };
        let _ = action_tx.send(action);
    }

    /// Scroll the currently focused element when the cursor isn't over a known
    /// region (e.g. the gap between panes).
    fn scroll_focused(
        &mut self,
        direction: ScrollDirection,
        action_tx: &mpsc::UnboundedSender<Action>,
    ) {
        if let Focus::MultipleOutput(pane_idx) = self.focus() {
            self.terminal_pane_data[pane_idx].handle_mouse_scroll(direction);
        } else {
            self.send_list_scroll(direction, action_tx);
        }
    }

    /// Handle a left mouse button press: focus/select what was clicked, begin a
    /// text selection in a pane, and on a double-click drop into the inline view.
    fn handle_left_press(&mut self, col: u16, row: u16) {
        // Detect a double-click: a second press on the same cell within the
        // window. Matching the column too keeps a click that lands on the same
        // row but a different region (e.g. task list then a pane) from being
        // misread as a double-click.
        let now = std::time::Instant::now();
        let is_double = self
            .last_click
            .map(|(t, c, r)| {
                c == col && r == row && now.duration_since(t).as_millis() <= DOUBLE_CLICK_MS
            })
            .unwrap_or(false);
        self.last_click = Some((now, col, row));

        // Any fresh press starts a clean slate for region selection / deferred
        // clicks; the matched region re-arms whichever it needs.
        self.region_selection = None;
        self.pending_list_click = None;
        self.pending_dep_nav = None;

        match self.region_at(col, row) {
            Some(MouseRegionKind::Pane(pane_idx)) => {
                // Focus the clicked pane; double-click drops to inline (NXC-3942).
                self.set_base_focus(Focus::MultipleOutput(pane_idx));
                self.terminal_pane_data[pane_idx].clear_selection();
                // A dependency-view pane behaves like the task list: a plain click
                // navigates to the dependency, a click+drag selects text. Defer the
                // navigation to release and arm a region selection over its text
                // area so a drag highlights instead of navigating.
                if let Some(area) = self.dependency_view_selection_area(pane_idx) {
                    self.pending_dep_nav = self
                        .dependency_view_click_target(pane_idx, col, row)
                        .map(|task| (pane_idx, task));
                    if area.contains(Position::new(col, row)) {
                        self.region_selection = Some(RegionSelection {
                            anchor: (col, row),
                            cursor: (col, row),
                            area,
                            dragging: true,
                        });
                    }
                    return;
                }
                if is_double {
                    self.dispatch_action(Action::SwitchMode(TuiMode::Inline));
                    return;
                }
                // Begin a text selection drag at the clicked cell (NXC-3946).
                if let Some((r, c)) = self.terminal_pane_data[pane_idx].content_coords_at(col, row)
                {
                    self.terminal_pane_data[pane_idx].begin_selection(r, c);
                    self.selecting_pane = Some(pane_idx);
                }
            }
            Some(MouseRegionKind::TaskList) => {
                // Interacting with the list clears any pending pane selection.
                self.clear_all_pane_selections();
                // Defer the click action to release so a drag becomes a text
                // selection instead of selecting the row / entering inline.
                self.pending_list_click = Some((col, row, is_double));
                // Arm a potential text selection if the press is on the table's
                // text region (not the filter bar, cloud message, etc.).
                if let Some(area) = self.task_list_selection_area()
                    && area.contains(Position::new(col, row))
                {
                    self.region_selection = Some(RegionSelection {
                        anchor: (col, row),
                        cursor: (col, row),
                        area,
                        dragging: true,
                    });
                }
            }
            None => {}
        }
    }

    /// Extend the in-progress text selection as the mouse drags. Pane drags
    /// auto-scroll at the edges (NXC-3946); task-list drags extend a screen
    /// selection clamped to the table.
    fn handle_left_drag(&mut self, col: u16, row: u16) {
        if let Some(pane_idx) = self.selecting_pane {
            match self.terminal_pane_data[pane_idx].content_edge(row) {
                -1 => self.terminal_pane_data[pane_idx].handle_mouse_scroll(ScrollDirection::Up),
                1 => self.terminal_pane_data[pane_idx].handle_mouse_scroll(ScrollDirection::Down),
                _ => {}
            }
            if let Some((r, c)) = self.terminal_pane_data[pane_idx].content_coords_clamped(col, row)
            {
                self.terminal_pane_data[pane_idx].update_selection(r, c);
            }
            return;
        }

        // Task-list text selection: moving past the anchor makes this a drag, so
        // the deferred click won't fire on release.
        if let Some(sel) = &mut self.region_selection
            && sel.dragging
        {
            let a = sel.area;
            sel.cursor = (
                col.clamp(a.x, a.x + a.width.saturating_sub(1)),
                row.clamp(a.y, a.y + a.height.saturating_sub(1)),
            );
        }
    }

    /// Finish a left-drag. A pane or task-list drag copies the selected text; a
    /// task-list press that never moved performs the deferred click instead.
    fn handle_left_release(&mut self, col: u16, row: u16) {
        if let Some(pane_idx) = self.selecting_pane.take() {
            if self.terminal_pane_data[pane_idx].finish_selection() {
                self.terminal_pane_data[pane_idx].copy_selection();
            }
            self.pending_dep_nav = None;
            return;
        }

        let dragged = self
            .region_selection
            .map(|s| s.is_nonempty())
            .unwrap_or(false);
        if dragged {
            // A real drag (task list or dependency view): copy, suppress any
            // deferred click, and leave the highlight up.
            self.finish_region_selection();
            self.pending_list_click = None;
            self.pending_dep_nav = None;
            return;
        }

        // A plain click: drop the empty (armed) selection.
        self.region_selection = None;

        // An external link takes priority over row navigation/selection. This is
        // only reached on the non-modal path (a modal short-circuits in
        // `handle_mouse_event`), so links under a modal can't be clicked.
        if let Some(href) = self.link_at(col, row) {
            self.pending_list_click = None;
            self.pending_dep_nav = None;
            self.open_url_or_hint(&href);
            return;
        }

        // Run the deferred action for whichever region was pressed.
        if let Some((pane_idx, task)) = self.pending_dep_nav.take() {
            self.pending_list_click = None;
            self.navigate_to_task_in_pane(&task, pane_idx);
        } else if let Some((col, row, is_double)) = self.pending_list_click.take() {
            self.perform_task_list_click(col, row, is_double);
        }
    }

    /// Run the deferred task-list click: select the row, or open it in the main
    /// terminal pane on a double-click. (A clicked link is handled earlier in
    /// `handle_left_release`, before this runs.)
    fn perform_task_list_click(&mut self, col: u16, row: u16, is_double: bool) {
        let result = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
            .map(|tl| tl.handle_click(col, row, is_double));
        match result.flatten() {
            // Selecting a task focuses the list (NXC-3941); double-click opens and
            // focuses the task in the main terminal pane (same as pressing Enter).
            // Inline mode is reserved for double-clicking a pane (NXC-3943).
            Some(TaskListClick::Select) => self.set_base_focus(Focus::TaskList),
            Some(TaskListClick::OpenInPane) => {
                self.display_and_focus_current_task_in_terminal_pane(false)
            }
            None => {}
        }
    }

    /// Open `href` in the browser, or show a hint with the URL if no opener is
    /// available (e.g. a headless/SSH session with no `xdg-open`) so the click
    /// doesn't fail silently and the user can copy the link by hand.
    fn open_url_or_hint(&self, href: &str) {
        if !open_url(href) {
            self.dispatch_action(Action::ShowHint(format!(
                "Couldn't open a browser. Copy this link: {href}"
            )));
        }
    }

    /// The external link at `(col, row)`, across every non-modal component that
    /// rendered one this frame. Registries are cleared at the start of each draw
    /// pass, so a component that isn't drawn holds no stale links.
    fn link_at(&self, col: u16, row: u16) -> Option<String> {
        self.components
            .iter()
            .filter_map(|c| c.link_registry())
            .chain(std::iter::once(self.status_bar.link_registry()))
            .find_map(|registry| registry.hit_test(col, row))
            .map(str::to_string)
    }

    /// The task list's text region (excluding the scrollbar), recorded last
    /// render. Bounds a drag-based selection over the list.
    fn task_list_selection_area(&self) -> Option<Rect> {
        self.components
            .iter()
            .find_map(|c| c.as_any().downcast_ref::<TasksList>())
            .and_then(|tl| tl.selection_area())
    }

    /// Clear text selections in every pane.
    fn clear_all_pane_selections(&mut self) {
        for pane in &mut self.terminal_pane_data {
            pane.clear_selection();
        }
    }

    /// The focused popup acting as a modal layer, if any.
    fn active_modal_kind(&self) -> Option<Focus> {
        match self.focus() {
            Focus::HelpPopup | Focus::CountdownPopup => Some(self.focus()),
            // Invariant: every hint hide is paired with close_popup in the
            // same handler, so a focused-but-hidden hint should be impossible.
            // The visibility check is defense in depth — if an unpaired hide
            // ever slips in, the dead layer must not become an invisible modal
            // that absorbs all mouse events (this wedged the whole TUI once).
            focus @ Focus::HintPopup if focus.is_active(self) => Some(focus),
            _ => None,
        }
    }

    /// The bordered box of the currently focused popup, as recorded during the
    /// last render.
    fn active_modal_area(&self) -> Option<Rect> {
        self.focus().modal(self)?.last_area()
    }

    /// The inner text area of the focused popup (inside the border, clear of the
    /// scrollbar). Selections and link hit-tests are confined to this.
    fn active_modal_content_area(&self) -> Option<Rect> {
        self.focus().modal(self)?.content_area()
    }

    /// The external link at `(col, row)` belonging to the active modal, if any.
    /// Scoped to the modal so a click can't fall through to a link on the layer
    /// underneath (and so the modal's own links still work).
    fn active_modal_link_at(&self, col: u16, row: u16) -> Option<String> {
        self.focus()
            .modal(self)?
            .link_registry()?
            .hit_test(col, row)
            .map(str::to_string)
    }

    /// Keep the focused modal open on interaction. For the auto-exit report this
    /// pins it (so its countdown stops) and cancels the pending quit, mirroring
    /// the keyboard scroll/pin path. Other popups have no countdown, so it's a
    /// no-op for them.
    fn pin_active_modal_open(&mut self) {
        if !matches!(self.focus(), Focus::CountdownPopup) {
            return;
        }
        if let Some(p) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
        {
            p.pin_open();
        }
        self.core.state().lock().cancel_quit();
    }

    /// Route a mouse event to the focused popup: open a clicked link, dismiss it
    /// on a click *outside*, or scroll/select inside — any interaction pins the
    /// auto-exit report open rather than closing it.
    fn handle_modal_mouse(&mut self, mouse: MouseEvent) {
        // Without a recorded area we can't hit-test; swallow the event anyway so
        // it can't leak to the layers underneath.
        let Some(area) = self.active_modal_area() else {
            return;
        };
        let (col, row) = (mouse.column, mouse.row);
        let inside = area.contains(Position::new(col, row));

        match mouse.kind {
            // Scrolling the report pins it open (stopping the auto-exit), exactly
            // like the keyboard up/down path, so it can't close out mid-scroll.
            MouseEventKind::ScrollUp if inside => {
                self.pin_active_modal_open();
                self.scroll_active_modal(ScrollDirection::Up);
            }
            MouseEventKind::ScrollDown if inside => {
                self.pin_active_modal_open();
                self.scroll_active_modal(ScrollDirection::Down);
            }
            MouseEventKind::Down(MouseButton::Left) => {
                // A clicked link always wins, in every modal (including the
                // auto-exit report), so links stay clickable. Opening one pins the
                // report open so its countdown can't close it under the click.
                // Curated `Link`s take priority over the raw URL buffer-scan.
                if let Some(href) = self
                    .active_modal_link_at(col, row)
                    .or_else(|| self.region_url_at(col, row))
                {
                    self.pin_active_modal_open();
                    self.open_url_or_hint(&href);
                    return;
                }
                // Only a click *outside* the modal dismisses it.
                if !inside {
                    self.dismiss_active_modal();
                    return;
                }
                // A click inside keeps the modal open; for the report that means
                // pinning it so the countdown stops instead of exiting while read.
                self.pin_active_modal_open();
                // Begin a selection only within the text area, so dragging over the
                // border or scrollbar doesn't highlight them. A click on the
                // border/padding is swallowed (it's still inside the modal).
                if let Some(content) = self.active_modal_content_area()
                    && content.contains(Position::new(col, row))
                {
                    self.region_selection = Some(RegionSelection {
                        anchor: (col, row),
                        cursor: (col, row),
                        area: content,
                        dragging: true,
                    });
                }
            }
            MouseEventKind::Drag(MouseButton::Left) => {
                if let Some(sel) = &mut self.region_selection
                    && sel.dragging
                {
                    let a = sel.area;
                    sel.cursor = (
                        col.clamp(a.x, a.x + a.width.saturating_sub(1)),
                        row.clamp(a.y, a.y + a.height.saturating_sub(1)),
                    );
                }
            }
            MouseEventKind::Up(MouseButton::Left) => {
                self.finish_region_selection();
            }
            _ => {}
        }
    }

    /// Scroll the focused popup, if it supports scrolling. Any scroll
    /// invalidates the screen-coordinate selection, so it is cleared.
    fn scroll_active_modal(&mut self, direction: ScrollDirection) {
        match self.focus() {
            Focus::HelpPopup => {
                if let Some(p) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                {
                    match direction {
                        ScrollDirection::Up => p.scroll_up(),
                        ScrollDirection::Down => p.scroll_down(),
                    }
                }
            }
            Focus::CountdownPopup => {
                if let Some(p) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
                    && p.is_scrollable()
                {
                    match direction {
                        ScrollDirection::Up => p.scroll_up(),
                        ScrollDirection::Down => p.scroll_down(),
                    }
                }
            }
            _ => {}
        }
        self.region_selection = None;
    }

    /// Dismiss the focused popup, mirroring its keyboard-dismiss behavior.
    fn dismiss_active_modal(&mut self) {
        match self.focus() {
            Focus::HelpPopup => {
                if let Some(p) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
                {
                    p.set_visible(false);
                }
                self.close_popup(Focus::HelpPopup);
            }
            Focus::CountdownPopup => {
                // Clicking away keeps the TUI running, like pressing any key.
                if let Some(p) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
                {
                    p.cancel_countdown();
                }
                self.core.state().lock().cancel_quit();
                self.close_popup(Focus::CountdownPopup);
            }
            Focus::HintPopup => {
                if let Some(p) = self
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
                {
                    p.hide();
                }
                self.close_popup(Focus::HintPopup);
            }
            _ => {}
        }
        self.region_selection = None;
    }

    /// Finish a region text selection: stop dragging and copy it to the
    /// clipboard, or drop an empty (click-only) selection.
    fn finish_region_selection(&mut self) {
        let Some(sel) = self.region_selection.as_mut() else {
            return;
        };
        sel.dragging = false;
        let sel = *sel;
        if !sel.is_nonempty() {
            self.region_selection = None;
            return;
        }
        let text = self.region_selected_text(&sel);
        if text.trim().is_empty() {
            return;
        }
        // Surface a failure the same way the pane copy path does, instead of
        // dropping the text on the floor when the clipboard is unavailable.
        if !copy_to_clipboard(&text) {
            self.dispatch_action(Action::ShowHint("Copy failed".to_string()));
        }
    }

    /// Resolve a URL at a clicked cell from the last region snapshot.
    fn region_url_at(&self, col: u16, row: u16) -> Option<String> {
        self.region_snapshot.as_ref()?.url_at(col, row)
    }

    /// Extract the selected text from the last region snapshot in reading order.
    fn region_selected_text(&self, sel: &RegionSelection) -> String {
        self.region_snapshot
            .as_ref()
            .map(|snap| snap.selected_text(sel))
            .unwrap_or_default()
    }

    /// Capture the cells of the region currently being selected (or, while a
    /// popup is focused, its text area so links can be resolved) and
    /// reverse-video any in-progress selection on top.
    fn capture_region_snapshot_and_highlight(&mut self, f: &mut ratatui::Frame) {
        // Prefer the active selection's own bounds (task list or popup); fall
        // back to the focused popup's text area so its links stay clickable even
        // before a drag starts. Either way the border/scrollbar are excluded.
        let Some(area) = self
            .region_selection
            .map(|s| s.area)
            .or_else(|| self.active_modal_content_area())
        else {
            self.region_snapshot = None;
            return;
        };
        // Clamp to the actual buffer to stay in bounds.
        let buf_area = f.area();
        let x0 = area.x.max(buf_area.x);
        let y0 = area.y.max(buf_area.y);
        let x1 = (area.x + area.width).min(buf_area.x + buf_area.width);
        let y1 = (area.y + area.height).min(buf_area.y + buf_area.height);
        if x1 <= x0 || y1 <= y0 {
            self.region_snapshot = None;
            return;
        }
        let area = Rect::new(x0, y0, x1 - x0, y1 - y0);

        let selection = self.region_selection;
        let buf = f.buffer_mut();
        let mut cells = Vec::with_capacity(area.height as usize);
        for y in area.y..area.y + area.height {
            let mut row_cells = Vec::with_capacity(area.width as usize);
            for x in area.x..area.x + area.width {
                let symbol = buf
                    .cell((x, y))
                    .map(|cell| cell.symbol().to_string())
                    .unwrap_or_else(|| " ".to_string());
                row_cells.push(symbol);
                // Reverse-video the selected cells (tui has no selection concept).
                if let Some(sel) = selection
                    && sel.contains(x, y)
                    && let Some(cell) = buf.cell_mut((x, y))
                {
                    cell.modifier |= Modifier::REVERSED;
                }
            }
            cells.push(row_cells);
        }
        self.region_snapshot = Some(RegionSnapshot { area, cells });
    }

    /// Draw the persistent "mouse capture off" badge in the top-right corner.
    fn draw_mouse_capture_badge(f: &mut ratatui::Frame, frame_area: Rect) {
        let label = " MOUSE OFF · F10 ";
        let width = label.chars().count() as u16;
        if frame_area.width < width || frame_area.height == 0 {
            return;
        }
        let badge_area = Rect {
            x: frame_area.x + frame_area.width - width,
            y: frame_area.y,
            width,
            height: 1,
        };
        let badge = NxParagraph::new(Line::from(Span::styled(
            label,
            Style::reset()
                .add_modifier(Modifier::BOLD)
                .bg(THEME.warning)
                .fg(THEME.primary_fg),
        )));
        f.render_widget(ratatui::widgets::Clear, badge_area);
        f.render_widget(badge, badge_area);
    }

    /// Returns true if the currently focused pane is in interactive mode.
    fn is_interactive_mode(&self) -> bool {
        match self.focus() {
            Focus::MultipleOutput(pane_idx) => self.terminal_pane_data[pane_idx].is_interactive(),
            _ => false,
        }
    }

    pub fn set_interactive_mode(&mut self, interactive: bool) {
        if let Focus::MultipleOutput(pane_idx) = self.focus() {
            self.terminal_pane_data[pane_idx].set_interactive(interactive);
        }
    }

    /// Throttles PTY resize calls to at most one per 200 ms.
    ///
    /// This is a throttle (fire-then-block), not a debounce (delay-until-quiet):
    /// the first call in a window executes immediately; subsequent calls within
    /// 200 ms are dropped. During a resize drag this prevents excessive reparse
    /// work while still updating dimensions on the first event of each burst.
    fn throttle_pty_resize(&mut self) -> io::Result<()> {
        let now = current_timestamp_millis() as u128;

        if self.resize_debounce_timer.is_some_and(|timer| now < timer) {
            return Ok(());
        }

        self.resize_debounce_timer = Some(now + 200);

        // Process the resize
        self.handle_pty_resize()
    }

    /// Actually processes the resize event by updating PTY dimensions.
    fn handle_pty_resize(&mut self) -> io::Result<()> {
        // Always use fullscreen mode logic
        {
            if self.layout_areas.is_none() {
                return Ok(());
            }

            let mut needs_sort = false;

            for (pane_idx, pane_area) in self
                .layout_areas
                .as_ref()
                .unwrap()
                .terminal_panes
                .iter()
                .enumerate()
            {
                let terminal_pane_data = &mut self.terminal_pane_data[pane_idx];
                if let Some(pty) = terminal_pane_data.pty.as_ref() {
                    let (pty_height, pty_width) =
                        TerminalPane::calculate_pty_dimensions(*pane_area);

                    // Get current dimensions before resize
                    let (current_rows, current_cols) = pty.get_dimensions();

                    // Skip resize if dimensions haven't actually changed
                    if current_rows == pty_height && current_cols == pty_width {
                        continue;
                    }

                    // Async resize avoids blocking the event loop for large terminal outputs
                    pty.resize_async(pty_height, pty_width);

                    // If dimensions changed, mark for sort
                    if current_rows != pty_height {
                        needs_sort = true;
                    }
                }
            }

            // Sort tasks if needed after all resizing is complete
            if needs_sort {
                self.dispatch_action(Action::SortTasks);
            }
        }

        Ok(())
    }

    fn is_task_list_hidden(&self) -> bool {
        self.layout_manager.get_task_list_visibility() == TaskListVisibility::Hidden
    }

    fn register_pty_instance(&mut self, task_id: &str, pty: PtyInstance) {
        // Wrap in Arc
        let pty = Arc::new(pty);
        self.core
            .state()
            .lock()
            .register_pty_instance(task_id.to_string(), pty);
    }

    /// Calculate appropriate PTY dimensions based on the current TUI mode
    fn calculate_pty_dimensions_for_mode(&self) -> (u16, u16) {
        // For fullscreen mode, use reasonable defaults that will be resized later by terminal panes
        (24, 80)
    }

    fn display_and_focus_current_task_in_terminal_pane(&mut self, force_spacebar_mode: bool) {
        if force_spacebar_mode {
            self.toggle_output_visibility();
        } else {
            // If already pinned to a pane, just focus it rather than reassigning
            let selection = self.selection_manager.lock().get_selection().cloned();
            if let Some(ref sel) = selection {
                if let Some(pane_idx) = self.pane_tasks.iter().position(|t| t.as_ref() == Some(sel))
                {
                    self.set_base_focus(Focus::MultipleOutput(pane_idx));
                    return;
                }
            }
            self.assign_current_task_to_pane(0);
        }
        // Focus the pane if one is now visible
        if self.has_visible_panes() {
            self.set_base_focus(Focus::MultipleOutput(0));
        }
    }

    /// The first component of concrete type `T`, if one exists.
    fn component<T: 'static>(&self) -> Option<&T> {
        self.components
            .iter()
            .find_map(|c| c.as_any().downcast_ref::<T>())
    }

    /// The current focus: the top of the focus stack.
    fn focus(&self) -> Focus {
        *self.focus_stack.last().expect("focus stack is never empty")
    }

    /// Replace the base focus layer (lateral navigation between the task list
    /// and output panes). Popup layers stacked above it are undisturbed.
    fn set_base_focus(&mut self, focus: Focus) {
        debug_assert!(
            !focus.is_popup(),
            "set_base_focus takes a base layer, got {focus:?}"
        );
        let old_top = self.focus();
        self.focus_stack[0] = focus;
        self.sync_focus_change(old_top);
    }

    /// Focus a popup layer, stacking it over whatever is focused now. Pushing
    /// the layer that is already on top is a no-op, and a layer buried deeper
    /// in the stack is moved to the top rather than duplicated — the stack can
    /// never hold the same layer twice, so closing popups can never loop.
    fn push_focus(&mut self, focus: Focus) {
        debug_assert!(
            focus.is_popup(),
            "push_focus takes a popup layer, got {focus:?}"
        );
        let old_top = self.focus();
        if old_top == focus {
            return;
        }
        self.focus_stack.retain(|&layer| layer != focus);
        self.focus_stack.push(focus);
        self.sync_focus_change(old_top);
    }

    /// Dismiss a popup layer, removing it from the stack wherever it sits
    /// (popups can die while buried, e.g. a hint auto-expiring under the run
    /// report). Any layers revealed on top that are no longer active are
    /// pruned too, so focus always lands on something the user can see.
    fn close_popup(&mut self, focus: Focus) {
        let old_top = self.focus();
        self.focus_stack.retain(|&layer| layer != focus);
        while self.focus_stack.len() > 1 && !self.focus().is_active(self) {
            self.focus_stack.pop();
        }
        if self.focus_stack.is_empty() {
            self.focus_stack.push(Focus::TaskList);
        }
        self.sync_focus_change(old_top);
    }

    /// Shared plumbing after a stack mutation: if the top changed, drop the
    /// region text selection (it belongs to the previously focused layer) and
    /// notify components of the new focus.
    fn sync_focus_change(&mut self, old_top: Focus) {
        let new_top = self.focus();
        if new_top != old_top {
            self.region_selection = None;
            self.dispatch_action(Action::UpdateFocus(new_top));
        }
    }

    fn handle_debug_event(&mut self, key: KeyEvent) {
        // https://docs.rs/tui-logger/latest/tui_logger/#smart-widget-key-commands
        // |  KEY     | ACTION
        // |----------|-----------------------------------------------------------|
        // | h        | Toggles target selector widget hidden/visible
        // | f        | Toggle focus on the selected target only
        // | UP       | Select previous target in target selector widget
        // | DOWN     | Select next target in target selector widget
        // | LEFT     | Reduce SHOWN (!) log messages by one level
        // | RIGHT    | Increase SHOWN (!) log messages by one level
        // | -        | Reduce CAPTURED (!) log messages by one level
        // | +        | Increase CAPTURED (!) log messages by one level
        // | PAGEUP   | Enter Page Mode and scroll approx. half page up in log history.
        // | PAGEDOWN | Only in page mode: scroll 10 events down in log history.
        // | ESCAPE   | Exit page mode and go back to scrolling mode
        // | SPACE    | Toggles hiding of targets, which have logfilter set to off
        let debug_widget_event = match key.code {
            KeyCode::Char(' ') => Some(TuiWidgetEvent::SpaceKey),
            KeyCode::Esc => Some(TuiWidgetEvent::EscapeKey),
            KeyCode::PageUp => Some(TuiWidgetEvent::PrevPageKey),
            KeyCode::PageDown => Some(TuiWidgetEvent::NextPageKey),
            KeyCode::Up => Some(TuiWidgetEvent::UpKey),
            KeyCode::Down => Some(TuiWidgetEvent::DownKey),
            KeyCode::Left => Some(TuiWidgetEvent::LeftKey),
            KeyCode::Right => Some(TuiWidgetEvent::RightKey),
            KeyCode::Char('+') => Some(TuiWidgetEvent::PlusKey),
            KeyCode::Char('-') => Some(TuiWidgetEvent::MinusKey),
            KeyCode::Char('h') => Some(TuiWidgetEvent::HideKey),
            KeyCode::Char('f') => Some(TuiWidgetEvent::FocusKey),
            _ => None,
        };

        if let Some(event) = debug_widget_event {
            self.debug_state.transition(event);
        }
    }

    pub fn set_console_messenger(&mut self, messenger: NxConsoleMessageConnection) {
        self.core.state().lock().set_console_messenger(messenger);
        self.dispatch_action(Action::ConsoleMessengerAvailable(true));
    }

    /// Renders the dependency view for a pending task in the specified pane
    fn render_dependency_view_internal(
        &mut self,
        f: &mut ratatui::Frame,
        pane_idx: usize,
        pane_area: Rect,
        task_name: String,
        is_focused: bool,
    ) {
        // Calculate values that were previously passed in
        let task_status = self
            .get_task_status(&task_name)
            .unwrap_or(TaskStatus::NotStarted);
        let throbber_counter = self
            .components
            .iter()
            .find_map(|c| c.as_any().downcast_ref::<TasksList>())
            .map(|tasks_list| tasks_list.throbber_counter)
            .unwrap_or(0);

        // Create or update dependency view state for this pane
        let should_update = self.dependency_view_states[pane_idx]
            .as_ref()
            .is_some_and(|s| s.current_task == task_name);

        if should_update {
            // Same task, update the existing state (preserves scroll position, etc.)
            if let Some(existing_state) = self.dependency_view_states[pane_idx].as_mut() {
                existing_state.update(task_status, is_focused, throbber_counter, pane_area);
            }
        } else {
            // Different task or no existing state - create a new one
            // This ensures we get fresh dependency analysis when task becomes SKIPPED
            let state = self.core.state().lock();
            let task_graph = state.task_graph();
            let new_state = DependencyViewState::new(
                task_name.clone(),
                task_status,
                task_graph,
                is_focused,
                throbber_counter,
                pane_area,
            );
            drop(state);
            self.dependency_view_states[pane_idx] = Some(new_state);
        }

        // No need to update status in DependencyViewState - we pass the full map to the widget
        if let Some(dep_state) = &mut self.dependency_view_states[pane_idx] {
            let state = self.core.state().lock();
            let task_status_map = state.get_task_status_map();
            let task_graph = state.task_graph();
            let dependency_view = DependencyView::new(task_status_map, task_graph);
            f.render_stateful_widget(dependency_view, pane_area, dep_state);
        }
    }

    // ========================================================================
    // Terminal Pane Helper Methods
    // ========================================================================

    /// Sets up PTY for a terminal pane, handling resize and interactivity
    fn setup_pane_pty(
        &mut self,
        pane_idx: usize,
        item_id: &str,
        pane_area: Rect,
        in_progress: bool,
        allow_interactive: bool,
    ) {
        let terminal_pane_data = &mut self.terminal_pane_data[pane_idx];

        if !in_progress && terminal_pane_data.is_interactive() {
            terminal_pane_data.set_interactive(false);
        }

        let state = self.core.state().lock();
        if let Some(pty) = state.get_pty_instance(item_id) {
            terminal_pane_data.can_be_interactive =
                allow_interactive && in_progress && pty.can_be_interactive();
            terminal_pane_data.pty = Some(pty.clone());

            // Resize PTY to match terminal pane dimensions (async to avoid blocking render)
            let (pty_height, pty_width) = TerminalPane::calculate_pty_dimensions(pane_area);
            pty.resize_async(pty_height, pty_width);
        } else {
            terminal_pane_data.pty = None;
            terminal_pane_data.can_be_interactive = false;
        }
    }

    /// Gets display name for a batch group
    fn get_batch_display_name(&self, batch_id: &str) -> String {
        self.batch_states
            .get(batch_id)
            .map(|state| {
                format!(
                    "Batch: {} ({})",
                    state.info.executor_name,
                    state.info.task_ids.len()
                )
            })
            .unwrap_or_else(|| format!("Batch: {}", batch_id))
    }

    /// Gets task timing from TasksList
    fn get_task_timing(&self, task_name: &str) -> (Option<i64>, Option<i64>) {
        self.components
            .iter()
            .find_map(|c| c.as_any().downcast_ref::<TasksList>())
            .map(|tasks_list| tasks_list.get_task_timing(task_name))
            .unwrap_or((None, None))
    }

    /// Renders a terminal pane widget with the given context
    fn render_terminal_pane_widget(
        &mut self,
        f: &mut ratatui::Frame,
        pane_idx: usize,
        pane_area: Rect,
        ctx: TerminalPaneContext,
    ) {
        let terminal_pane_data = &mut self.terminal_pane_data[pane_idx];
        terminal_pane_data.is_continuous = ctx.is_continuous;

        let has_pty = terminal_pane_data.pty.is_some();

        let mut state = TerminalPaneState::new(
            ctx.display_name,
            ctx.status,
            ctx.is_continuous,
            ctx.is_focused,
            has_pty,
            ctx.is_next_tab_target,
            self.core.state().lock().get_console_messenger().is_some(),
            ctx.estimated_duration,
            ctx.start_time,
            ctx.end_time,
        );

        let terminal_pane = TerminalPane::new()
            .pty_data(terminal_pane_data)
            .continuous(ctx.is_continuous);

        f.render_stateful_widget(terminal_pane, pane_area, &mut state);
    }

    // ========================================================================
    // Terminal Pane Render Methods
    // ========================================================================

    /// Renders the terminal pane for a running/completed task in the specified pane
    fn render_terminal_pane_internal(
        &mut self,
        f: &mut ratatui::Frame,
        pane_idx: usize,
        pane_area: Rect,
        task_name: String,
        is_focused: bool,
        is_next_tab_target: bool,
    ) {
        let task_status = self
            .get_task_status(&task_name)
            .unwrap_or(TaskStatus::NotStarted);
        let task_continuous = self.is_task_continuous(&task_name);
        let in_progress = task_status == TaskStatus::InProgress;

        // Setup PTY for this pane (tasks support interactive mode)
        self.setup_pane_pty(pane_idx, &task_name, pane_area, in_progress, true);

        let (start_time, end_time) = self.get_task_timing(&task_name);
        let estimated_duration = self
            .core
            .state()
            .lock()
            .estimated_task_timings()
            .get(&task_name)
            .copied();

        self.render_terminal_pane_widget(
            f,
            pane_idx,
            pane_area,
            TerminalPaneContext {
                display_name: task_name,
                status: task_status,
                is_continuous: task_continuous,
                is_focused,
                is_next_tab_target,
                estimated_duration,
                start_time,
                end_time,
            },
        );
    }

    /// Renders the terminal pane for a batch group showing combined batch output
    fn render_batch_terminal_pane_internal(
        &mut self,
        f: &mut ratatui::Frame,
        pane_idx: usize,
        pane_area: Rect,
        batch_id: String,
        is_focused: bool,
        is_next_tab_target: bool,
    ) {
        // Determine batch state and display info
        let (batch_name, status, start_time) =
            if let Some(batch_state) = self.batch_states.get(&batch_id) {
                // Running batch
                (
                    self.get_batch_display_name(&batch_id),
                    TaskStatus::InProgress,
                    Some(batch_state.start_time),
                )
            } else if let Some(completed) = self.completed_pinned_batches.get(&batch_id) {
                // Completed but pinned batch
                (
                    format!("{} [completed]", completed.display_name),
                    completed.final_status.into(),
                    None,
                )
            } else {
                // Shouldn't happen, but fallback
                (format!("Batch: {}", batch_id), TaskStatus::NotStarted, None)
            };

        // Batches are always in progress (ungrouped on completion) and non-interactive
        self.setup_pane_pty(
            pane_idx,
            &batch_id,
            pane_area,
            status == TaskStatus::InProgress,
            false,
        );

        self.render_terminal_pane_widget(
            f,
            pane_idx,
            pane_area,
            TerminalPaneContext {
                display_name: batch_name,
                status,
                is_continuous: false,
                is_focused,
                is_next_tab_target,
                estimated_duration: None,
                start_time,
                end_time: None,
            },
        );
    }

    pub fn set_estimated_task_timings(&mut self, timings: HashMap<String, i64>) {
        self.core.state().lock().set_estimated_task_timings(timings);
    }

    /// Handles automatic pane switching when a task becomes skipped.
    /// If the skipped task is currently being viewed in a pane, automatically
    /// switches that pane to show the failed dependency's terminal output.
    fn handle_automatic_pane_switching(&mut self, skipped_task_id: &str) {
        if let Some(failed_dep) = self.get_first_failed_dependency(skipped_task_id) {
            let panes_to_update: Vec<usize> = self
                .pane_tasks
                .iter()
                .enumerate()
                .filter(|(_, sel)| sel.as_ref().map(|s| s.id()) == Some(skipped_task_id))
                .map(|(idx, _)| idx)
                .collect();

            // Check if both panes would show the same task after updating
            let will_duplicate = panes_to_update.len() > 1
                || (panes_to_update.len() == 1 && {
                    let other_pane = 1 - panes_to_update[0];
                    self.pane_tasks[other_pane].as_ref().map(|s| s.id())
                        == Some(failed_dep.as_str())
                });

            if will_duplicate {
                // Consolidate to single pane
                self.switch_pane_to_task(0, failed_dep);
                self.pane_tasks[1] = None;
                self.dependency_view_states[1] = None;
                self.terminal_pane_data[1] = TerminalPaneData::new();
                self.layout_manager
                    .set_pane_arrangement(PaneArrangement::Single);
                self.layout_areas = None;
            } else {
                // Update panes normally
                for pane_idx in panes_to_update {
                    self.switch_pane_to_task(pane_idx, failed_dep.clone());
                }
            }
        }
    }

    /// Switches a pane to display a different task, updating all necessary state.
    fn switch_pane_to_task(&mut self, pane_idx: usize, task_id: String) {
        self.switch_pane_to_selection(pane_idx, SelectionEntry::Task(task_id));
    }

    /// Switches a pane to display a different selection (task, batch, or nested task), updating all necessary state.
    fn switch_pane_to_selection(&mut self, pane_idx: usize, selection: SelectionEntry) {
        let selection_id = selection.id().to_string();

        self.pane_tasks[pane_idx] = Some(selection.clone());

        // Clear cached states so they get recreated for the new selection
        self.dependency_view_states[pane_idx] = None;

        // Assign the PTY for the new task to this pane if available
        let state = self.core.state().lock();
        if let Some(pty_instance) = state.get_pty_instance(&selection_id) {
            self.terminal_pane_data[pane_idx].pty = Some(pty_instance.clone());

            // Async resize PTY to match the current terminal pane dimensions
            if let Some(pane_area) = self
                .layout_areas
                .as_ref()
                .and_then(|la| la.terminal_panes.get(pane_idx))
            {
                let (pty_height, pty_width) = TerminalPane::calculate_pty_dimensions(*pane_area);
                pty_instance.resize_async(pty_height, pty_width);
            }
        } else {
            self.terminal_pane_data[pane_idx].pty = None;
        }

        // Update the selection manager to prevent conflicts with manual selection
        self.selection_manager.lock().select(Some(selection));
    }

    /// Gets the first failed dependency for a given task.
    ///
    /// Returns the task name of the first dependency that failed, causing this task to be skipped.
    /// This is used for automatic pane switching to show the root cause of failures.
    fn get_first_failed_dependency(&self, task_name: &str) -> Option<String> {
        let state = self.core.state().lock();
        let failed_deps =
            get_failed_dependencies(task_name, state.task_graph(), state.get_task_status_map());
        failed_deps.into_iter().next()
    }

    /// Updates the terminal progress indicator (OSC 9;4).
    /// Shows percentage of tasks that are complete (anything except NotStarted, InProgress, or Shared).
    fn update_terminal_progress(&self) {
        let state = self.core.state().lock();
        let total_tasks = state.get_task_status_map().len();
        if total_tasks == 0 {
            return;
        }

        let completed_tasks = state.get_completed_task_count();
        drop(state); // Release lock before I/O

        let percentage = (completed_tasks * 100) / total_tasks;

        // Write OSC 9;4 escape sequence to stderr (less likely to conflict with TUI rendering)
        // Format: ESC ] 9 ; 4 ; <state> ; <percentage> ST
        // state: 1 = show progress, 0 = hide
        // percentage: 0-100
        // Using ST terminator (\x1b\\) for maximum compatibility (Ghostty, Windows Terminal, VTE)
        let _ = io::stderr().write_all(format!("\x1b]9;4;1;{}\x1b\\", percentage).as_bytes());
        let _ = io::stderr().flush();
    }

    /// Clears the terminal progress indicator.
    pub fn clear_terminal_progress() {
        // State 0 = hide progress (using ST terminator for compatibility)
        let _ = io::stderr().write_all(b"\x1b]9;4;0;0\x1b\\");
        let _ = io::stderr().flush();
    }

    /// Handles the start of a batch by grouping individual tasks into a batch group.
    /// Tasks are removed from individual display and shown as nested items under the batch.
    fn handle_batch_start(&mut self, batch_id: String, batch_info: BatchInfo) {
        let start_time = self
            .batch_states
            .get(&batch_id)
            .map(|state| state.start_time)
            .unwrap_or_else(current_timestamp_millis);

        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            // New batches always start collapsed
            tasks_list.start_batch(
                batch_id,
                batch_info.executor_name,
                batch_info.task_ids,
                start_time,
                false,
            );
        }
    }

    /// Handles batch completion by ungrouping tasks back to individual display.
    /// Invoked on every batch-status report; only ungroups once all nested tasks
    /// are terminal (see the guard below).
    fn handle_batch_complete(&mut self, batch_id: String, final_status: BatchStatus) {
        // Early validation
        if batch_id.is_empty() {
            return;
        }

        // A batch reports its status on every run iteration, and incomplete
        // batches are re-run for their remaining tasks. Only complete (ungroup +
        // clean up) once every nested task has reached a terminal state, so an
        // intermediate report doesn't prematurely ungroup and then re-group.
        // Safe to read component state here: EndBatch is processed on the
        // event-loop thread after the nested tasks' queued status updates.
        let all_tasks_complete = self
            .components
            .iter()
            .find_map(|c| c.as_any().downcast_ref::<TasksList>())
            .map_or(false, |tasks_list| tasks_list.is_batch_complete(&batch_id));
        if !all_tasks_complete {
            // A nested task isn't terminal yet (an intermediate re-run report, or
            // a stuck/aborted task). Breadcrumb if a batch ever stays grouped.
            trace!(
                "Deferring batch '{}' completion: nested tasks not all terminal yet",
                batch_id
            );
            return;
        }

        // Check if batch is truly pinned (not in spacebar mode)
        let is_pinned = !self.spacebar_mode
            && self
                .pane_tasks
                .iter()
                .any(|sel| matches!(sel, Some(SelectionEntry::BatchGroup(id)) if id == &batch_id));

        if is_pinned {
            // Preserve state for pinned batch
            let display_name = self.get_batch_display_name(&batch_id);
            let completion_time = current_timestamp_millis();
            self.completed_pinned_batches.insert(
                batch_id.clone(),
                CompletedBatchInfo {
                    display_name: display_name.clone(),
                    completion_time,
                    final_status,
                },
            );
            // Also update TuiState for mode switching persistence
            self.core.state().lock().complete_batch_metadata(
                &batch_id,
                final_status,
                display_name,
                completion_time,
            );
            // Remove from batch_states but keep PTY
            self.batch_states.remove(&batch_id);
        } else {
            // Full cleanup for non-pinned batches
            self.cleanup_batch_pty(&batch_id);
        }

        if let Some(tasks_list) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<TasksList>())
        {
            tasks_list.ungroup_batch_tasks(&batch_id);
        }
    }

    /// Cleans up batch PTY instance when batch completes
    fn cleanup_batch_pty(&mut self, batch_id: &str) {
        let mut state = self.core.state().lock();
        state.get_pty_instances_mut().remove(batch_id);
        state.remove_batch_metadata(batch_id);
        drop(state);
        self.batch_states.remove(batch_id);
    }

    /// Cleans up completed batch from a pane if it exists
    fn cleanup_pane_completed_batch(&mut self, pane_idx: usize) {
        if let Some(SelectionEntry::BatchGroup(batch_id)) = &self.pane_tasks[pane_idx] {
            let batch_id = batch_id.clone();
            if self.completed_pinned_batches.contains_key(&batch_id) {
                // Check if still referenced by other pane
                let other_pane = 1 - pane_idx;
                let still_referenced =
                    self.pane_tasks[other_pane].as_ref().map(|s| s.id()) == Some(batch_id.as_str());

                if !still_referenced {
                    let mut state = self.core.state().lock();
                    state.get_pty_instances_mut().remove(&batch_id);
                    state.remove_batch_metadata(&batch_id);
                    drop(state);
                    self.completed_pinned_batches.remove(&batch_id);
                }
            }
        }
    }
}

// === TuiApp Trait Implementation ===

use crate::native::tui::tui_app::TuiApp;

impl TuiApp for App {
    // === Core Access ===

    fn core(&self) -> &TuiCore {
        &self.core
    }

    fn core_mut(&mut self) -> &mut TuiCore {
        &mut self.core
    }

    // === Event Handling (delegates to App methods) ===

    fn handle_event(
        &mut self,
        event: tui::Event,
        action_tx: &UnboundedSender<Action>,
    ) -> Result<bool> {
        self.handle_event(event, action_tx)
    }

    fn handle_action(
        &mut self,
        tui: &mut Tui,
        action: Action,
        action_tx: &UnboundedSender<Action>,
    ) {
        self.handle_action(tui, action, action_tx);
    }

    // === Mode Identification ===

    fn get_tui_mode(&self) -> TuiMode {
        TuiMode::FullScreen
    }

    // === Initialization ===

    fn init(&mut self, area: Size) -> Result<()> {
        self.init(area)
    }

    // === Task Lifecycle (App has custom UI logic, so override defaults) ===

    fn start_command(&mut self, thread_count: Option<u32>) {
        App::start_command(self, thread_count);
    }

    // === Task Lifecycle (hooks for trait defaults) ===

    fn on_tasks_started(&mut self, tasks: &[Task]) {
        self.dispatch_action(Action::StartTasks(tasks.to_vec()));
    }

    fn set_task_timing(&mut self, task_id: String, start_time: i64, end_time: i64) {
        self.dispatch_action(Action::SetTaskTiming(task_id, start_time, end_time));
    }

    fn on_tasks_ended(&mut self, task_results: &[TaskResult]) {
        // Resize PTYs when tasks finish (they may still be displaying output)
        let _ = self.throttle_pty_resize();
        self.dispatch_action(Action::EndTasks(task_results.to_vec()));
        self.update_terminal_progress();
    }

    // start_tasks and end_tasks use trait defaults which call hooks above

    fn update_task_status(&mut self, task_id: &str, status: TaskStatus) {
        App::update_task_status(self, task_id, status);
    }

    fn end_command(&mut self) {
        App::end_command(self);
    }

    fn set_exit_summary(&mut self, summary: PerformanceSummaryPayload) {
        // Persist in shared state so the report survives mode switches (rebuilt
        // apps re-hydrate their fresh popup from here). The status bar's help
        // text reads the flag from state, so no component sync is needed.
        self.core.state().lock().set_exit_summary(summary.clone());
        if let Some(countdown_popup) = self
            .components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
        {
            countdown_popup.set_summary(summary);
        }
    }

    // === PTY Registration (hooks for trait defaults) ===

    fn calculate_pty_dimensions(&self) -> (u16, u16) {
        self.calculate_pty_dimensions_for_mode()
    }

    fn on_pty_registered(&mut self, task_id: &str) {
        // Update task status and trigger resize debounce
        self.update_task_status(task_id, TaskStatus::InProgress);
        let _ = self.throttle_pty_resize();
    }

    // Override print_task_terminal_output for App-specific continuous task handling
    fn print_task_terminal_output(&mut self, task_id: String, output: String) {
        // Call the inherent method which has continuous task handling
        App::print_task_terminal_output(self, task_id, output);
    }

    // Override append_task_output because App has different behavior (panics if not registered)
    fn append_task_output(&mut self, task_id: String, output: String) {
        App::append_task_output(self, task_id, output);
    }

    // `should_quit` uses default implementation from trait

    fn get_selected_item(&self) -> Option<SelectionEntry> {
        self.selection_manager.lock().get_selection().cloned()
    }

    fn get_focused_pane_item(&self) -> Option<SelectionEntry> {
        // If focus is on a terminal pane, return that pane's item
        // In spacebar mode, return the selected item (it follows selection)
        // Otherwise return the pinned item from that pane
        match self.focus() {
            Focus::MultipleOutput(pane_idx) => {
                if self.spacebar_mode {
                    self.selection_manager.lock().get_selection().cloned()
                } else {
                    self.pane_tasks[pane_idx].clone()
                }
            }
            _ => {
                // Focus is on task list - return None to let the caller
                // fall back to get_selected_item_id() for the user's selection
                None
            }
        }
    }

    fn save_ui_state_for_mode_switch(&self) {
        let focused_pane = match self.focus() {
            Focus::MultipleOutput(pane_idx) => Some(pane_idx),
            _ => None,
        };

        let selected_item = self.selection_manager.lock().get_selection().cloned();

        // Get batch expansion states from TasksList. (The filter text needs no
        // saving: TuiState owns it canonically.)
        let batch_expansion_states = self
            .components
            .iter()
            .find_map(|c| c.as_any().downcast_ref::<TasksList>())
            .map(|tasks_list| tasks_list.get_batch_expansion_states())
            .unwrap_or_default();

        let mut state = self.core.state().lock();
        state.save_ui_state(
            self.pane_tasks.clone(),
            self.spacebar_mode,
            focused_pane,
            selected_item,
            batch_expansion_states,
        );
    }

    // === Batch Methods (hooks for UI updates) ===

    fn on_batch_registered(&mut self, batch_id: &str, batch_info: &BatchInfo, start_time: i64) {
        // Store in App-local batch_states for quick access
        self.batch_states.insert(
            batch_id.to_string(),
            BatchState {
                info: batch_info.clone(),
                start_time,
            },
        );

        // Trigger resize for new PTY instance
        let _ = self.throttle_pty_resize();

        // Dispatch UI action
        self.dispatch_action(Action::StartBatch(batch_id.to_string(), batch_info.clone()));
    }

    fn set_batch_status(&mut self, batch_id: String, status: BatchStatus) {
        App::set_batch_status(self, batch_id, status);
    }

    /// Override the trait default (which only stores in state) so the napi
    /// `&mut dyn TuiApp` call reaches the inherent method that also dispatches
    /// `Action::UpdateCloudMessage` to the rendered TasksList.
    fn set_cloud_message(&mut self, message: Option<String>) {
        App::set_cloud_message(self, message);
    }

    fn set_cloud_link(&mut self, label: String, url: String) {
        App::set_cloud_link(self, label, url);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::TaskGraph;
    use crate::native::tui::config;
    use crate::native::tui::lifecycle::TuiMode;
    use crate::native::tui::tui_state::TuiState;
    use hashbrown::HashSet;
    use std::collections::HashMap;

    fn create_test_app() -> App {
        let tasks = vec![Task::new("app1:build", "build").with_project_root("/tmp/app1")];
        let task_graph = TaskGraph {
            tasks: HashMap::new(),
            dependencies: HashMap::new(),
            continuous_dependencies: HashMap::new(),
            roots: vec![],
        };
        let cli_args = config::TuiCliArgs {
            targets: vec![],
            tui_auto_exit: None,
        };

        let state = Arc::new(Mutex::new(TuiState::new(
            tasks,
            HashSet::new(),
            RunMode::RunMany,
            vec![],
            config::TuiConfig::new(None, None, &cli_args),
            String::from("Test"),
            task_graph,
            HashMap::new(),
            None,
        )));

        App::with_state(state, TuiMode::FullScreen).unwrap()
    }

    /// Clicks on the cloud link resolve through `link_at`, which chains the
    /// status bar's registry after the component registries.
    #[test]
    fn test_link_at_finds_status_bar_links() {
        let mut app = create_test_app();
        app.status_bar.link_registry_mut().push(
            Rect::new(2, 30, 10, 1),
            "https://nx.app/runs/abc".to_string(),
        );

        assert_eq!(
            app.link_at(5, 30),
            Some("https://nx.app/runs/abc".to_string())
        );
        assert_eq!(app.link_at(5, 29), None);
    }

    /// `print_task_terminal_output` must hide the cursor whether or not the
    /// PTY pre-existed. The PTY-exists branch (e.g. a batch task whose
    /// terminal output was streamed via `append_task_output` first) used to
    /// return early and lose the cursor-hide; that left a blinking virtual
    /// cursor at the end of finished panes.
    #[test]
    fn test_print_task_terminal_output_hides_cursor_when_pty_already_exists() {
        let mut app = create_test_app();
        let task_id = String::from("app1:build");

        // Simulate a batch task: streamed terminal output creates the PTY,
        // then the orchestrator calls `print_task_terminal_output` to mark
        // the task as finished.
        app.append_task_output(
            task_id.clone(),
            String::from("> Task :app1:build UP-TO-DATE\n"),
        );
        app.print_task_terminal_output(
            task_id.clone(),
            String::from("> Task :app1:build UP-TO-DATE\n"),
        );

        let state = app.core.state().lock();
        let pty = state.get_pty_instance(&task_id).expect("PTY should exist");
        assert!(
            pty.get_screen()
                .expect("PTY parser should be readable")
                .hide_cursor(),
            "cursor must be hidden after print_task_terminal_output finalizes the pane"
        );
    }

    /// `append_task_output` is the streaming path — it must NOT hide the
    /// cursor, otherwise a still-running task's pane would freeze its cursor
    /// mid-stream.
    #[test]
    fn test_append_task_output_does_not_hide_cursor() {
        let mut app = create_test_app();
        let task_id = String::from("app1:build");

        app.append_task_output(task_id.clone(), String::from("first chunk\n"));
        app.append_task_output(task_id.clone(), String::from("second chunk\n"));

        let state = app.core.state().lock();
        let pty = state.get_pty_instance(&task_id).expect("PTY should exist");
        assert!(
            !pty.get_screen()
                .expect("PTY parser should be readable")
                .hide_cursor(),
            "append_task_output is for streaming; the cursor must remain visible"
        );
    }

    /// Same finalization for the path where no PTY exists yet (cache hits,
    /// non-streaming results).
    #[test]
    fn test_print_task_terminal_output_hides_cursor_when_no_pty_exists() {
        let mut app = create_test_app();
        let task_id = String::from("app1:build");

        app.print_task_terminal_output(task_id.clone(), String::from("cached output\n"));

        let state = app.core.state().lock();
        let pty = state
            .get_pty_instance(&task_id)
            .expect("PTY should be created");
        assert!(
            pty.get_screen()
                .expect("PTY parser should be readable")
                .hide_cursor(),
            "cursor must be hidden when print creates a fresh PTY"
        );
    }

    // === Mouse capture toggle + region mouse handling ===

    /// Build a snapshot from text rows whose top-left is at `(x, y)`.
    fn snapshot_from(x: u16, y: u16, rows: &[&str]) -> RegionSnapshot {
        let width = rows.iter().map(|r| r.chars().count()).max().unwrap_or(0) as u16;
        let cells: Vec<Vec<String>> = rows
            .iter()
            .map(|row| {
                let mut cs: Vec<String> = row.chars().map(|c| c.to_string()).collect();
                while cs.len() < width as usize {
                    cs.push(" ".to_string());
                }
                cs
            })
            .collect();
        RegionSnapshot {
            area: Rect::new(x, y, width, rows.len() as u16),
            cells,
        }
    }

    fn selection(anchor: (u16, u16), cursor: (u16, u16), area: Rect) -> RegionSelection {
        RegionSelection {
            anchor,
            cursor,
            area,
            dragging: false,
        }
    }

    #[test]
    fn region_selection_orders_regardless_of_drag_direction() {
        let area = Rect::new(0, 0, 20, 5);
        // Dragged up-and-left: cursor is before the anchor in reading order.
        let sel = selection((10, 3), (2, 1), area);
        assert_eq!(sel.ordered(), ((2, 1), (10, 3)));
        assert!(sel.is_nonempty());
        assert!(!selection((4, 2), (4, 2), area).is_nonempty());
    }

    #[test]
    fn region_selection_contains_uses_reading_order() {
        let area = Rect::new(0, 0, 20, 5);
        let sel = selection((3, 1), (5, 3), area);
        // First row: only from the start column rightward.
        assert!(!sel.contains(2, 1));
        assert!(sel.contains(3, 1));
        assert!(sel.contains(19, 1));
        // Middle row: entire width.
        assert!(sel.contains(0, 2));
        // Last row: only up to the end column.
        assert!(sel.contains(5, 3));
        assert!(!sel.contains(6, 3));
        // Outside the row range.
        assert!(!sel.contains(4, 0));
        assert!(!sel.contains(4, 4));
    }

    #[test]
    fn snapshot_detects_url_under_cursor() {
        let snap = snapshot_from(2, 1, &["see https://nx.dev/terminal-ui for docs"]);
        // "https://..." starts at column index 4 -> screen col 6.
        assert_eq!(
            snap.url_at(10, 1).as_deref(),
            Some("https://nx.dev/terminal-ui")
        );
        // Clicking the plain word "see" yields nothing.
        assert_eq!(snap.url_at(2, 1), None);
        // Clicking whitespace yields nothing.
        assert_eq!(snap.url_at(5, 1), None);
        // Clicking outside the snapshot area yields nothing.
        assert_eq!(snap.url_at(0, 0), None);
    }

    #[test]
    fn snapshot_trims_trailing_punctuation_from_url() {
        let snap = snapshot_from(0, 0, &["docs (https://nx.dev/terminal-ui)."]);
        assert_eq!(
            snap.url_at(10, 0).as_deref(),
            Some("https://nx.dev/terminal-ui")
        );
    }

    #[test]
    fn snapshot_extracts_single_row_selection() {
        let snap = snapshot_from(0, 0, &["hello world"]);
        // Select "world": screen cols 6..=10.
        let sel = selection((6, 0), (10, 0), snap.area);
        assert_eq!(snap.selected_text(&sel), "world");
    }

    #[test]
    fn snapshot_extracts_multi_row_selection() {
        let snap = snapshot_from(0, 0, &["first line", "second line", "third line"]);
        // From col 6 of row 0 through col 5 of row 2.
        let sel = selection((6, 0), (5, 2), snap.area);
        // Trailing whitespace on each row is trimmed when copying.
        assert_eq!(snap.selected_text(&sel), "line\nsecond line\nthird");
    }

    /// The `ModalPopup` contract: a hidden popup reports no hit-test geometry,
    /// including in the window between being hidden and the next draw (the
    /// draw pass also clears the recorded areas, but lazily — consumers must
    /// never observe a stale `Some` from the previous render).
    #[test]
    fn hidden_popup_reports_no_modal_geometry() {
        fn draw_popup<T: Component>(app: &mut App) {
            let mut terminal =
                ratatui::Terminal::new(ratatui::backend::TestBackend::new(120, 40)).unwrap();
            terminal
                .draw(|f| {
                    let area = f.area();
                    if let Some(popup) = app
                        .components
                        .iter_mut()
                        .find_map(|c| c.as_any_mut().downcast_mut::<T>())
                    {
                        let _ = popup.draw(f, area);
                    }
                })
                .unwrap();
        }

        // Hint popup: hide() without a redraw.
        let mut app = create_test_app();
        app.components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
            .unwrap()
            .show("hint".to_string());
        app.focus_stack = vec![Focus::TaskList, Focus::HintPopup];
        draw_popup::<HintPopup>(&mut app);
        assert!(app.active_modal_area().is_some(), "visible hint has a box");
        app.components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
            .unwrap()
            .hide();
        assert!(
            app.active_modal_area().is_none(),
            "hidden hint must not leak stale hit-test geometry"
        );
        assert!(app.active_modal_content_area().is_none());

        // Help popup: set_visible(false) without a redraw.
        let mut app = create_test_app();
        app.components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
            .unwrap()
            .set_visible(true);
        app.focus_stack = vec![Focus::TaskList, Focus::HelpPopup];
        draw_popup::<HelpPopup>(&mut app);
        assert!(app.active_modal_area().is_some(), "visible help has a box");
        app.components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<HelpPopup>())
            .unwrap()
            .set_visible(false);
        assert!(
            app.active_modal_area().is_none(),
            "hidden help must not leak stale hit-test geometry"
        );
        assert!(app.active_modal_content_area().is_none());

        // Run report: cancel_countdown() without a redraw.
        let mut app = create_test_app();
        app.components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
            .unwrap()
            .reopen();
        app.focus_stack = vec![Focus::TaskList, Focus::CountdownPopup];
        draw_popup::<CountdownPopup>(&mut app);
        assert!(
            app.active_modal_area().is_some(),
            "visible report has a box"
        );
        app.components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
            .unwrap()
            .cancel_countdown();
        assert!(
            app.active_modal_area().is_none(),
            "dismissed report must not leak stale hit-test geometry"
        );
        assert!(app.active_modal_content_area().is_none());
    }

    #[test]
    fn active_modal_kind_only_for_popups() {
        let mut app = create_test_app();
        for (stack, expected) in [
            (vec![Focus::TaskList], false),
            (vec![Focus::MultipleOutput(0)], false),
            (vec![Focus::TaskList, Focus::HelpPopup], true),
            (vec![Focus::TaskList, Focus::CountdownPopup], true),
        ] {
            app.focus_stack = stack.clone();
            assert_eq!(app.active_modal_kind().is_some(), expected, "{stack:?}");
        }

        // The hint popup is only a modal while it is actually visible. A
        // hidden hint that still holds focus must not absorb mouse events.
        app.focus_stack = vec![Focus::TaskList, Focus::HintPopup];
        assert!(
            app.active_modal_kind().is_none(),
            "a hidden hint popup must not act as a modal"
        );
        app.components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
            .unwrap()
            .show("hint".to_string());
        assert!(
            app.active_modal_kind().is_some(),
            "a visible hint popup is a modal"
        );
    }

    // === Focus stack (regression: hint popup focus wedge) ===

    /// A second `ShowHint` while a hint was already focused used to record
    /// `HintPopup` as its own previous focus in the old one-slot register,
    /// making every restore self-loop and parking focus on an invisible modal
    /// until an F11 mode round-trip rebuilt the app. With the stack, pushing
    /// an already-top layer is a no-op and closing it lands on the base layer.
    #[test]
    fn repeated_hint_push_cannot_poison_focus_restore() {
        let mut app = create_test_app();
        // First hint focuses the popup...
        app.push_focus(Focus::HintPopup);
        // ...and a second hint arrives while it is still focused (e.g. the
        // F10 mouse-capture toast fired while another toast was up).
        app.push_focus(Focus::HintPopup);
        assert_eq!(
            app.focus_stack,
            vec![Focus::TaskList, Focus::HintPopup],
            "pushing the focused layer again must not grow the stack"
        );
        app.close_popup(Focus::HintPopup);
        assert_eq!(app.focus(), Focus::TaskList);
    }

    /// A popup can die while buried under another popup (the hint auto-expires
    /// while the run report is focused). Closing the top popup must skip the
    /// dead layer and land on the base layer, not on a hidden popup.
    #[test]
    fn closing_top_popup_prunes_dead_buried_layers() {
        let mut app = create_test_app();
        app.components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
            .unwrap()
            .show("hint".to_string());
        app.push_focus(Focus::HintPopup);
        // The run report opens over the hint...
        app.push_focus(Focus::CountdownPopup);
        assert_eq!(
            app.focus_stack,
            vec![Focus::TaskList, Focus::HintPopup, Focus::CountdownPopup]
        );
        // ...and the hint expires while buried.
        app.components
            .iter_mut()
            .find_map(|c| c.as_any_mut().downcast_mut::<HintPopup>())
            .unwrap()
            .hide();
        // Dismissing the report lands on the task list, not the hidden hint.
        app.close_popup(Focus::CountdownPopup);
        assert_eq!(app.focus(), Focus::TaskList);
    }

    /// Defense in depth: even if focus points at a hidden hint popup, keys
    /// must fall through to their normal handlers instead of being consumed
    /// by an invisible modal.
    #[test]
    fn hidden_hint_focus_does_not_swallow_keys() {
        let mut app = create_test_app();
        // Wedged state: the popup is focused but not visible.
        app.focus_stack = vec![Focus::TaskList, Focus::HintPopup];

        let (tx, _rx) = mpsc::unbounded_channel();
        app.register_action_handler(tx.clone()).unwrap();
        app.handle_event(
            tui::Event::Key(KeyEvent::new(KeyCode::Char('q'), KeyModifiers::NONE)),
            &tx,
        )
        .unwrap();

        assert!(
            app.core.state().lock().is_forced_shutdown(),
            "`q` must reach the quit handler instead of being swallowed by a hidden hint popup"
        );
    }

    #[test]
    fn interacting_with_report_pins_it_open_and_cancels_quit() {
        let mut app = create_test_app();
        // An auto-exit is due and the report popup is focused.
        app.core
            .state()
            .lock()
            .schedule_quit(std::time::Duration::from_secs(0));
        app.focus_stack = vec![Focus::TaskList, Focus::CountdownPopup];
        assert!(
            app.core.state().lock().should_quit(),
            "auto-exit is due before any interaction"
        );

        // A click/scroll inside the report pins it instead of letting it exit.
        app.pin_active_modal_open();

        assert!(
            !app.core.state().lock().should_quit(),
            "interacting with the report cancels the pending auto-exit"
        );
        let pinned = app
            .components
            .iter()
            .find_map(|c| c.as_any().downcast_ref::<CountdownPopup>())
            .map(|p| p.is_pinned());
        assert_eq!(
            pinned,
            Some(true),
            "the report is pinned open, not dismissed"
        );
    }

    #[test]
    fn disabled_capture_ignores_mouse_events() {
        let mut app = create_test_app();
        app.mouse_capture_enabled = false;
        let (tx, _rx) = mpsc::unbounded_channel();
        // Should early-return without panicking or touching state.
        app.handle_mouse_event(
            MouseEvent {
                kind: MouseEventKind::Down(MouseButton::Left),
                column: 1,
                row: 1,
                modifiers: KeyModifiers::NONE,
            },
            &tx,
        );
        assert!(app.region_selection.is_none());
    }

    #[test]
    fn mouse_event_marks_user_interacted() {
        let mut app = create_test_app();
        assert!(
            !app.core.state().lock().has_user_interacted(),
            "no interaction yet"
        );
        let (tx, _rx) = mpsc::unbounded_channel();
        app.handle_mouse_event(
            MouseEvent {
                kind: MouseEventKind::Down(MouseButton::Left),
                column: 1,
                row: 1,
                modifiers: KeyModifiers::NONE,
            },
            &tx,
        );
        assert!(
            app.core.state().lock().has_user_interacted(),
            "a mouse click marks the user as present so auto-exit won't fire"
        );
    }

    #[test]
    fn double_click_requires_same_column() {
        let mut app = create_test_app();
        // A pane fills the right half; a double-click inside it drops to inline.
        app.mouse_regions = vec![MouseRegion {
            rect: Rect::new(20, 0, 40, 10),
            kind: MouseRegionKind::Pane(0),
        }];
        let (tx, mut rx) = mpsc::unbounded_channel();
        app.register_action_handler(tx).unwrap();

        // Two quick clicks on the same row but different columns must NOT be read
        // as a double-click: a same-row click from the task list into a pane used
        // to drop into inline.
        app.handle_left_press(25, 3);
        app.handle_left_press(40, 3);
        let switched = std::iter::from_fn(|| rx.try_recv().ok())
            .any(|a| matches!(a, Action::SwitchMode(TuiMode::Inline)));
        assert!(
            !switched,
            "two clicks on the same row but different columns are not a double-click"
        );

        // Two quick clicks on the exact same cell are a real double-click.
        app.last_click = None;
        app.handle_left_press(30, 5);
        app.handle_left_press(30, 5);
        let switched = std::iter::from_fn(|| rx.try_recv().ok())
            .any(|a| matches!(a, Action::SwitchMode(TuiMode::Inline)));
        assert!(switched, "two clicks on the same cell are a double-click");
    }

    #[test]
    fn wheel_over_dependency_view_scrolls_list_not_pty() {
        let mut app = create_test_app();
        app.spacebar_mode = false;
        // A pending task pinned to pane 0 renders a (scrollable) dependency view.
        app.pane_tasks[0] = Some(SelectionEntry::Task("pending-task".to_string()));
        app.dependency_view_states[0] = Some(DependencyViewState {
            current_task: "pending-task".to_string(),
            task_status: TaskStatus::NotStarted,
            dependencies: (0..30).map(|i| format!("dep{i}")).collect(),
            dependency_levels: HashMap::new(),
            is_focused: true,
            throbber_counter: 0,
            scroll_offset: 0,
            scrollbar_state: ratatui::widgets::ScrollbarState::default(),
            pane_area: Rect::new(20, 0, 40, 8),
            dep_row_hits: Vec::new(),
            dep_row_x_range: (0, 0),
            selection_area: None,
        });
        app.mouse_regions = vec![MouseRegion {
            rect: Rect::new(20, 0, 40, 8),
            kind: MouseRegionKind::Pane(0),
        }];

        let (tx, _rx) = mpsc::unbounded_channel();
        app.scroll_at(30, 4, ScrollDirection::Down, &tx);

        assert_eq!(
            app.dependency_view_states[0]
                .as_ref()
                .unwrap()
                .scroll_offset,
            1,
            "the wheel scrolls the dependency view, not the hidden terminal buffer"
        );
    }

    #[test]
    fn focus_change_clears_region_selection() {
        let mut app = create_test_app();
        app.region_selection = Some(selection((1, 1), (3, 1), Rect::new(0, 0, 10, 5)));
        app.push_focus(Focus::HelpPopup);
        assert!(
            app.region_selection.is_none(),
            "moving focus must drop the region selection"
        );
    }

    #[test]
    fn task_list_drag_release_copies_and_consumes_click() {
        let mut app = create_test_app();
        let area = Rect::new(0, 0, 20, 5);
        // A non-empty selection means the user dragged.
        app.region_selection = Some(RegionSelection {
            anchor: (0, 0),
            cursor: (9, 0),
            area,
            dragging: true,
        });
        app.pending_list_click = Some((0, 0, false));
        // No snapshot set, so finish copies nothing (and won't touch the real
        // clipboard) but still exercises the drag branch.
        app.handle_left_release(9, 0);
        assert!(
            app.pending_list_click.is_none(),
            "a drag must consume the deferred click so the row action doesn't fire"
        );
        assert!(
            app.region_selection.is_some(),
            "the selection stays highlighted after copying"
        );
    }

    #[test]
    fn task_list_plain_click_release_runs_deferred_click() {
        let mut app = create_test_app();
        let area = Rect::new(0, 0, 20, 5);
        // Anchor == cursor: the press never moved, so it's a click, not a drag.
        app.region_selection = Some(RegionSelection {
            anchor: (2, 2),
            cursor: (2, 2),
            area,
            dragging: true,
        });
        app.pending_list_click = Some((2, 2, false));
        app.handle_left_release(2, 2);
        assert!(
            app.region_selection.is_none(),
            "an empty selection is dropped so it doesn't linger as a highlight"
        );
        assert!(
            app.pending_list_click.is_none(),
            "the deferred click is consumed"
        );
    }

    /// Show the performance report popup (focused) with an already-due auto-exit.
    fn show_focused_report(app: &mut App) {
        {
            let popup = app
                .components
                .iter_mut()
                .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
                .expect("countdown popup exists");
            popup.set_summary(PerformanceSummaryPayload::default());
            popup.start_countdown(3);
        }
        app.push_focus(Focus::CountdownPopup);
        // Arm an already-due quit so cancellation is observable via should_quit().
        app.core
            .state()
            .lock()
            .schedule_quit(std::time::Duration::from_secs(0));
        assert!(
            app.core.state().lock().should_quit(),
            "precondition: auto-exit armed"
        );
    }

    fn report_visible(app: &App) -> bool {
        app.components
            .iter()
            .find_map(|c| c.as_any().downcast_ref::<CountdownPopup>())
            .expect("countdown popup exists")
            .is_visible()
    }

    /// Render the focused report once so it records its on-screen box, returning
    /// that box for inside/outside hit-testing.
    fn render_report(app: &mut App) -> Rect {
        let mut terminal =
            ratatui::Terminal::new(ratatui::backend::TestBackend::new(120, 40)).unwrap();
        terminal
            .draw(|f| {
                let area = f.area();
                if let Some(popup) = app
                    .components
                    .iter_mut()
                    .find_map(|c| c.as_any_mut().downcast_mut::<CountdownPopup>())
                {
                    let _ = popup.draw(f, area);
                }
            })
            .unwrap();
        app.active_modal_area().expect("popup recorded its box")
    }

    #[test]
    fn clicking_outside_report_dismisses_inside_keeps_open() {
        let down = |column, row| MouseEvent {
            kind: MouseEventKind::Down(MouseButton::Left),
            column,
            row,
            modifiers: KeyModifiers::NONE,
        };

        // Outside the box dismisses it.
        let mut app = create_test_app();
        show_focused_report(&mut app);
        let modal = render_report(&mut app);
        assert!(
            modal.x > 0 && modal.width < 120,
            "report is a centered box with margins, got {modal:?}"
        );
        let (tx, _rx) = mpsc::unbounded_channel();
        app.register_action_handler(tx.clone()).unwrap();
        app.handle_mouse_event(down(0, 0), &tx);
        assert!(
            !report_visible(&app),
            "a click outside the report box dismisses it"
        );

        // Inside the box keeps it open.
        let mut app = create_test_app();
        show_focused_report(&mut app);
        let modal = render_report(&mut app);
        let (tx, _rx) = mpsc::unbounded_channel();
        app.register_action_handler(tx.clone()).unwrap();
        app.handle_mouse_event(
            down(modal.x + modal.width / 2, modal.y + modal.height / 2),
            &tx,
        );
        assert!(
            report_visible(&app),
            "a click inside the report box leaves it open"
        );
    }

    /// `p` toggles the report: while it is focused, the press dismisses it and
    /// cancels the auto-exit countdown (the reopen half is handled separately when
    /// the popup is not focused).
    #[test]
    fn test_p_dismisses_focused_report_and_cancels_exit() {
        let mut app = create_test_app();
        show_focused_report(&mut app);

        let (tx, _rx) = mpsc::unbounded_channel();
        app.register_action_handler(tx.clone()).unwrap();
        app.handle_event(
            tui::Event::Key(KeyEvent::new(KeyCode::Char('p'), KeyModifiers::NONE)),
            &tx,
        )
        .unwrap();

        assert!(
            !report_visible(&app),
            "`p` should dismiss the focused report"
        );
        assert!(
            !app.core.state().lock().should_quit(),
            "`p` should cancel the auto-exit countdown"
        );
    }

    /// Enter while the report is focused jumps to inline in a single press (and
    /// cancels the auto-exit), instead of only dismissing the popup.
    #[test]
    fn test_enter_on_report_switches_to_inline_in_one_press() {
        let mut app = create_test_app();
        show_focused_report(&mut app);

        let (tx, mut rx) = mpsc::unbounded_channel();
        app.register_action_handler(tx.clone()).unwrap();
        app.handle_event(
            tui::Event::Key(KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE)),
            &tx,
        )
        .unwrap();

        assert!(!report_visible(&app), "Enter should dismiss the report");
        assert!(
            !app.core.state().lock().should_quit(),
            "Enter should cancel the auto-exit"
        );
        let mut switched_to_inline = false;
        while let Ok(action) = rx.try_recv() {
            if matches!(action, Action::SwitchMode(TuiMode::Inline)) {
                switched_to_inline = true;
            }
        }
        assert!(
            switched_to_inline,
            "Enter on the report should switch to inline in one press"
        );
    }
}
