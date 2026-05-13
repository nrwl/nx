use std::any::Any;

use color_eyre::eyre::Result;
use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
};

use crate::native::tui::theme::THEME;

use super::Component;
use super::tasks_list::TaskStatus;

/// Aggregated run-wide status counts derived from the task source of truth
/// every render. Maps `TaskStatus` variants to the chip categories used by
/// the bar.
///
/// Mapping (per NXC-3076 round 13):
/// - `passed`  = Success + LocalCache + LocalCacheKeptExisting + RemoteCache
/// - `cached`  = LocalCache + LocalCacheKeptExisting + RemoteCache
///               (sub-count of `passed`)
/// - `failed`  = Failure
/// - `skipped` = Skipped
/// - `stopped` = Stopped
/// - `running` = InProgress + Shared
/// - `pending` = NotStarted
///
/// `done` is the count of any terminal state (passed + failed + skipped +
/// stopped); `total` is the sum of all categories.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct StatusCounts {
    pub passed: usize,
    pub cached: usize,
    pub failed: usize,
    pub skipped: usize,
    pub stopped: usize,
    pub running: usize,
    pub pending: usize,
}

/// Width-of-N helper. `0` is still one digit.
fn digit_width(n: usize) -> u16 {
    if n == 0 {
        1
    } else {
        ((n as f64).log10().floor() as u16) + 1
    }
}

impl StatusCounts {
    /// Build counts from any iterator of statuses (e.g.
    /// `tasks_list.task_lookup.values().map(|t| t.status)`).
    pub fn from_iter<I>(statuses: I) -> Self
    where
        I: IntoIterator<Item = TaskStatus>,
    {
        let mut counts = StatusCounts::default();
        for status in statuses {
            match status {
                TaskStatus::Success => counts.passed += 1,
                TaskStatus::LocalCache
                | TaskStatus::LocalCacheKeptExisting
                | TaskStatus::RemoteCache => {
                    counts.passed += 1;
                    counts.cached += 1;
                }
                TaskStatus::Failure => counts.failed += 1,
                TaskStatus::Skipped => counts.skipped += 1,
                TaskStatus::Stopped => counts.stopped += 1,
                TaskStatus::InProgress | TaskStatus::Shared => counts.running += 1,
                TaskStatus::NotStarted => counts.pending += 1,
            }
        }
        counts
    }

    /// Total tasks across all categories.
    pub fn total(&self) -> usize {
        self.passed + self.failed + self.skipped + self.stopped + self.running + self.pending
    }

    /// Tasks that have reached any terminal state.
    pub fn done(&self) -> usize {
        self.passed + self.failed + self.skipped + self.stopped
    }
}

/// Minimum number of spaces between the left-aligned summary and the
/// right-aligned help when both are present on the same row.
const SUMMARY_HELP_GAP: u16 = 2;
/// Spaces between adjacent chips on the summary side.
const SUMMARY_CHIP_SEP: u16 = 2;
/// Spaces between adjacent help shortcuts on the help side.
const HELP_SHORTCUT_SEP: u16 = 2;

/// Side of the bar an item belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BarSide {
    Summary,
    Help,
}

/// Every droppable or sticky item the bar can render. Ordering of variants
/// is meaningful only insofar as `priority()` defines the actual drop
/// sequence (v4 actions-first ladder, see NXC-3076 prototypes round 13).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BarItem {
    // Sticky (rungs 11–13). Always present.
    Progress,         // rung 12 — "X/Y done"
    FailedChip,       // rung 11 — only present when failed > 0
    QuitHelp,         // rung 13
    HelpHelp,         // rung 13
    ShowTaskListHelp, // sticky when task list is hidden; absent otherwise
    // Droppable. Lower rung number = drops first.
    CachedBracket,  // rung 2  — "[N cached]" tail on PassedChip
    PinHelp,        // rung 3  — "pin output: 1 or 2"
    NavigateHelp,   // rung 4  — "navigate: ↑ ↓"
    FilterHelp,     // rung 5  — "filter: /"
    ShowOutputHelp, // rung 6  — "show output: <enter>"
    PendingChip,    // rung 7  — "· N"
    SkipStopChips,  // rung 8  — "⏭ N" and/or "◼ N"
    PassedChip,     // rung 9  — "✔ N"
    RunningChip,    // rung 10 — "⠋ N"
}

impl BarItem {
    pub fn side(self) -> BarSide {
        match self {
            BarItem::Progress
            | BarItem::FailedChip
            | BarItem::CachedBracket
            | BarItem::PendingChip
            | BarItem::SkipStopChips
            | BarItem::PassedChip
            | BarItem::RunningChip => BarSide::Summary,
            BarItem::QuitHelp
            | BarItem::HelpHelp
            | BarItem::ShowTaskListHelp
            | BarItem::PinHelp
            | BarItem::NavigateHelp
            | BarItem::FilterHelp
            | BarItem::ShowOutputHelp => BarSide::Help,
        }
    }

    /// Whether this item is contextually applicable given the current
    /// task-list visibility. `ShowTaskListHelp` only appears when hidden;
    /// `FilterHelp` only appears when visible (its target is the list).
    /// All other items are unconditionally applicable.
    pub fn applies_when(self, hidden_task_list: bool) -> bool {
        match self {
            BarItem::ShowTaskListHelp => hidden_task_list,
            BarItem::FilterHelp => !hidden_task_list,
            _ => true,
        }
    }

    /// Drop priority (rung number). Sticky items return `u8::MAX` since
    /// they're never considered by the greedy drop walk.
    pub fn priority(self) -> u8 {
        match self {
            BarItem::CachedBracket => 2,
            BarItem::PinHelp => 3,
            BarItem::NavigateHelp => 4,
            BarItem::FilterHelp => 5,
            BarItem::ShowOutputHelp => 6,
            BarItem::PendingChip => 7,
            BarItem::SkipStopChips => 8,
            BarItem::PassedChip => 9,
            BarItem::RunningChip => 10,
            // Sticky:
            BarItem::FailedChip
            | BarItem::Progress
            | BarItem::QuitHelp
            | BarItem::HelpHelp
            | BarItem::ShowTaskListHelp => u8::MAX,
        }
    }

    /// Display width when rendered, given the current run counts.
    /// Returns 0 for items whose underlying count is 0 (caller treats those
    /// as eager-zero-dropped at rung 1).
    pub fn width(self, counts: &StatusCounts) -> u16 {
        match self {
            // Progress renders "Waiting for tasks…" while no tasks are known,
            // and "X/Y done" otherwise. Width reported must match what's
            // rendered or the fit algorithm under-budgets and the help row
            // gets clipped instead of dropping shortcuts.
            BarItem::Progress if counts.total() == 0 => "Waiting for tasks…".chars().count() as u16,
            BarItem::Progress => digit_width(counts.done()) + 1 + digit_width(counts.total()) + 5,
            // "✖ N" — icon + space + digits
            BarItem::FailedChip if counts.failed > 0 => 2 + digit_width(counts.failed),
            // "✔ N" — icon + space + digits
            BarItem::PassedChip if counts.passed > 0 => 2 + digit_width(counts.passed),
            // " [N cached]" — leading space + bracket + digits + " cached]"
            //   width without leading space: 1 + digits + 8 = 9 + digits.
            //   The bracket renders as a tail on PassedChip, so its width
            //   contribution includes the leading space joining it to the
            //   number: " [N cached]" = 1 + 9 + digits = 10 + digits.
            BarItem::CachedBracket if counts.cached > 0 => 10 + digit_width(counts.cached),
            // "⠋ N"
            BarItem::RunningChip if counts.running > 0 => 2 + digit_width(counts.running),
            // "· N"
            BarItem::PendingChip if counts.pending > 0 => 2 + digit_width(counts.pending),
            // "⏭ N" and/or "◼ N" — render whichever counts are > 0,
            // separated by SUMMARY_CHIP_SEP. Both being zero ⇒ width 0.
            BarItem::SkipStopChips => {
                let mut parts: Vec<u16> = Vec::new();
                if counts.skipped > 0 {
                    parts.push(2 + digit_width(counts.skipped));
                }
                if counts.stopped > 0 {
                    parts.push(2 + digit_width(counts.stopped));
                }
                if parts.is_empty() {
                    0
                } else {
                    parts.iter().sum::<u16>() + SUMMARY_CHIP_SEP * (parts.len() as u16 - 1)
                }
            }
            // Help shortcut widths are fixed.
            BarItem::QuitHelp => 7,          // "quit: q"
            BarItem::HelpHelp => 7,          // "help: ?"
            BarItem::NavigateHelp => 13,     // "navigate: ↑ ↓"
            BarItem::FilterHelp => 9,        // "filter: /"
            BarItem::PinHelp => 18,          // "pin output: 1 or 2"
            BarItem::ShowOutputHelp => 20,   // "show output: <enter>"
            BarItem::ShowTaskListHelp => 17, // "show task list: b"
            // Any chip with count == 0 — eager-zero-dropped.
            _ => 0,
        }
    }
}

/// Result of the layout fit pass — which items render this frame, in
/// display order on each side. Also flags whether sticky text needs
/// compression (rung 14 fallback).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BarLayout {
    pub summary: Vec<BarItem>,
    pub help: Vec<BarItem>,
    pub compress_sticky: bool,
}

/// Fixed display order for the summary side (left → right when rendered).
fn summary_display_order() -> [BarItem; 7] {
    [
        BarItem::Progress,
        BarItem::PassedChip,
        BarItem::CachedBracket,
        BarItem::FailedChip,
        BarItem::SkipStopChips,
        BarItem::RunningChip,
        BarItem::PendingChip,
    ]
}

/// Fixed display order for the help side (left → right when rendered).
fn help_display_order() -> [BarItem; 7] {
    [
        BarItem::QuitHelp,
        BarItem::HelpHelp,
        BarItem::NavigateHelp,
        BarItem::FilterHelp,
        BarItem::PinHelp,
        BarItem::ShowOutputHelp,
        BarItem::ShowTaskListHelp,
    ]
}

/// Droppable items in drop order (rungs 2 → 10).
fn drop_order() -> [BarItem; 9] {
    [
        BarItem::CachedBracket,  // rung 2
        BarItem::PinHelp,        // rung 3
        BarItem::NavigateHelp,   // rung 4
        BarItem::FilterHelp,     // rung 5
        BarItem::ShowOutputHelp, // rung 6
        BarItem::PendingChip,    // rung 7
        BarItem::SkipStopChips,  // rung 8
        BarItem::PassedChip,     // rung 9
        BarItem::RunningChip,    // rung 10
    ]
}

/// Rendered width of one side (summary or help) given the kept items in
/// display order. `CachedBracket` is treated as attached: it contributes
/// its width but no preceding separator (the renderer glues it onto
/// `PassedChip` directly, and `CachedBracket.width(counts)` already
/// accounts for the joining space).
fn side_width(side: BarSide, items: &[BarItem], counts: &StatusCounts) -> u16 {
    if items.is_empty() {
        return 0;
    }
    let sep = match side {
        BarSide::Summary => SUMMARY_CHIP_SEP,
        BarSide::Help => HELP_SHORTCUT_SEP,
    };
    let content: u16 = items.iter().map(|i| i.width(counts)).sum();
    let sep_count = items
        .iter()
        .filter(|i| !matches!(i, BarItem::CachedBracket))
        .count() as u16;
    content + sep * sep_count.saturating_sub(1)
}

/// Total rendered width of a bar layout (summary + inter-side gap + help).
/// Shared between the fit pass (deciding whether a candidate set fits) and
/// the parity test (verifying it matches what the renderer actually emits).
fn layout_total_width(summary: &[BarItem], help: &[BarItem], counts: &StatusCounts) -> u16 {
    let s = side_width(BarSide::Summary, summary, counts);
    let h = side_width(BarSide::Help, help, counts);
    let gap = if s > 0 && h > 0 { SUMMARY_HELP_GAP } else { 0 };
    s + h + gap
}

/// Compute the bar layout for a given terminal width.
///
/// Algorithm:
/// 1. Build the candidate set: keep an item only if its `width(counts) > 0`
///    (eager zero-drop at rung 1).
/// 2. If everything fits in `width`, return the full set.
/// 3. **Greedy:** walk `drop_order()`, dropping items until content fits or
///    the list is exhausted.
/// 4. **Backward-optimize:** walk dropped items in reverse drop order
///    (most-recently-dropped first); un-drop any that still fits.
/// 5. **Compress sticky** (rung 14): set the flag if step 4 still
///    overflows. Renderer will shrink sticky text to fit.
pub fn fit_bar_layout(width: u16, counts: &StatusCounts, hidden_task_list: bool) -> BarLayout {
    // Start by collecting every renderable item: contextually applicable
    // (see `BarItem::applies_when`) and with positive width (eager
    // zero-drop at rung 1).
    let mut kept: std::collections::HashSet<BarItem> = std::collections::HashSet::new();
    for item in summary_display_order()
        .iter()
        .chain(help_display_order().iter())
    {
        if !item.applies_when(hidden_task_list) {
            continue;
        }
        if item.width(counts) > 0 {
            kept.insert(*item);
        }
    }

    // Helper: total width if `kept` were rendered as-is.
    let total_width = |kept: &std::collections::HashSet<BarItem>| -> u16 {
        let summary: Vec<BarItem> = summary_display_order()
            .into_iter()
            .filter(|i| kept.contains(i))
            .collect();
        let help: Vec<BarItem> = help_display_order()
            .into_iter()
            .filter(|i| kept.contains(i))
            .collect();
        layout_total_width(&summary, &help, counts)
    };

    // Greedy drop until it fits or we run out of droppable items.
    let mut dropped: Vec<BarItem> = Vec::new();
    for item in drop_order() {
        if total_width(&kept) <= width {
            break;
        }
        if kept.remove(&item) {
            dropped.push(item);
        }
    }

    // Backward-optimize, strict priority: walk dropped items in reverse
    // (most recently dropped first = highest priority among dropped). If
    // an un-drop fits, un-drop and continue. If it doesn't fit, stop —
    // never un-drop a lower-priority item while a higher-priority one
    // remains dropped. This is the invariant: drop order is final.
    for item in dropped.iter().rev() {
        kept.insert(*item);
        if total_width(&kept) > width {
            kept.remove(item);
            break;
        }
    }

    // If it still doesn't fit, flag sticky compression for the renderer.
    let compress_sticky = total_width(&kept) > width;

    let summary: Vec<BarItem> = summary_display_order()
        .iter()
        .copied()
        .filter(|i| kept.contains(i))
        .collect();
    let help: Vec<BarItem> = help_display_order()
        .iter()
        .copied()
        .filter(|i| kept.contains(i))
        .collect();

    BarLayout {
        summary,
        help,
        compress_sticky,
    }
}

/// Global bottom status bar — renders a single-line summary of the run
/// (`X/Y done`, per-status chips, cached sub-count) on the left and
/// keyboard shortcuts on the right. When a cloud message is present it
/// renders on the row immediately above the bar.
///
/// Counts are recomputed per render from the task source of truth and
/// passed in by the parent (no shared state owned here).
///
/// Drop order: actions-first (v4) — every non-critical action drops
/// before any chip. See `NXC-3076-IMPLEMENTATION-PLAN.md` and
/// `tmp/nxc-3076/prototypes.html` (round 13) for the full ladder.
pub struct StatusBar {
    is_dimmed: bool,
    /// Frame snapshot — App writes this each frame before `draw` via
    /// `set_state`. Cloud message lives in TuiState (single source of
    /// truth); this field is just the most recent read for rendering.
    counts: StatusCounts,
    task_list_hidden: bool,
    cloud_message: Option<String>,
}

impl StatusBar {
    pub fn new() -> Self {
        Self {
            is_dimmed: false,
            counts: StatusCounts::default(),
            task_list_hidden: false,
            cloud_message: None,
        }
    }

    pub fn set_dimmed(&mut self, dimmed: bool) {
        self.is_dimmed = dimmed;
    }

    /// Snapshot of run state — caller (App) writes this before `draw`.
    pub fn set_state(
        &mut self,
        counts: StatusCounts,
        task_list_hidden: bool,
        cloud_message: Option<String>,
    ) {
        self.counts = counts;
        self.task_list_hidden = task_list_hidden;
        self.cloud_message = cloud_message;
    }

    /// Outcome state of the run — drives the progress text color.
    fn run_outcome(&self) -> RunOutcome {
        let c = &self.counts;
        if c.total() == 0 {
            return RunOutcome::Waiting;
        }
        if c.running > 0 || c.pending > 0 {
            return RunOutcome::InProgress;
        }
        // All tasks reached terminal state.
        if c.stopped > 0 {
            RunOutcome::Stopped
        } else if c.failed > 0 {
            RunOutcome::Failed
        } else {
            RunOutcome::Passed
        }
    }

    /// Base style applied to every span — dim modifier when the bar is
    /// dimmed (focus elsewhere).
    fn base_style(&self) -> Style {
        if self.is_dimmed {
            Style::default().add_modifier(Modifier::DIM)
        } else {
            Style::default()
        }
    }

    fn render_cloud_row(&self, f: &mut Frame<'_>, area: Rect) {
        let Some(message) = &self.cloud_message else {
            return;
        };
        let base = self.base_style().fg(THEME.secondary_fg);
        let url_style = base.fg(THEME.info).add_modifier(Modifier::UNDERLINED);
        let url_start = message.find("https://");
        let avail = area.width as usize;

        let spans: Vec<Span<'static>> = match url_start {
            // No URL embedded — render whatever fits, truncate with ellipsis.
            None => {
                let text = truncate_to_width(message, avail);
                vec![Span::styled(text, base)]
            }
            Some(idx) => {
                let prefix = &message[..idx];
                let url = &message[idx..];
                let prefix_w = display_width(prefix);
                let url_w = display_width(url);
                let total_w = prefix_w + url_w;
                if total_w <= avail {
                    // Full message fits.
                    vec![
                        Span::styled(prefix.to_string(), base),
                        Span::styled(url.to_string(), url_style),
                    ]
                } else if url_w <= avail {
                    // Drop the prefix, render just the URL.
                    vec![Span::styled(url.to_string(), url_style)]
                } else if avail >= 4 {
                    // Truncate the URL itself — `truncate_to_width` adds the
                    // trailing ellipsis when it cuts content.
                    let truncated = truncate_to_width(url, avail);
                    vec![Span::styled(truncated, url_style)]
                } else {
                    return;
                }
            }
        };

        f.render_widget(
            Paragraph::new(Line::from(spans)).alignment(Alignment::Left),
            area,
        );
    }

    fn render_bar_row(&self, f: &mut Frame<'_>, area: Rect) {
        let counts = &self.counts;
        let outcome = self.run_outcome();
        let layout = fit_bar_layout(area.width, counts, self.task_list_hidden);

        // Build spans for each side based on the fit result.
        let summary_spans = self.build_summary_spans(&layout, counts, outcome);
        let help_spans = self.build_help_spans(&layout, counts);

        let summary_width = visual_width(&summary_spans);
        let help_width = visual_width(&help_spans);

        // Split the row: summary on the left (own width), the rest fills
        // (help right-aligned). When summary can't fit at all, the help
        // takes the whole row.
        let constraints = if summary_width == 0 {
            vec![Constraint::Fill(1)]
        } else if summary_width + help_width >= area.width {
            vec![Constraint::Length(summary_width), Constraint::Fill(1)]
        } else {
            vec![Constraint::Length(summary_width), Constraint::Fill(1)]
        };

        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints(constraints)
            .split(area);

        if summary_width > 0
            && let Some(rect) = chunks.first()
        {
            f.render_widget(
                Paragraph::new(Line::from(summary_spans)).alignment(Alignment::Left),
                *rect,
            );
        }

        if let Some(rect) = chunks.last() {
            f.render_widget(
                Paragraph::new(Line::from(help_spans)).alignment(Alignment::Right),
                *rect,
            );
        }
    }

    fn build_summary_spans(
        &self,
        layout: &BarLayout,
        counts: &StatusCounts,
        outcome: RunOutcome,
    ) -> Vec<Span<'static>> {
        let base = self.base_style();
        let progress_color = match outcome {
            RunOutcome::Passed => THEME.success,
            RunOutcome::Failed => THEME.error,
            RunOutcome::Stopped => THEME.warning,
            RunOutcome::Waiting => THEME.secondary_fg,
            RunOutcome::InProgress => THEME.primary_fg,
        };

        // Special-case: total = 0 → render only "Waiting for tasks…" in
        // the progress slot regardless of which chips the layout includes.
        if matches!(outcome, RunOutcome::Waiting) {
            return vec![Span::styled(
                "Waiting for tasks…".to_string(),
                base.fg(THEME.secondary_fg),
            )];
        }

        let mut spans: Vec<Span<'static>> = Vec::new();
        let mut first = true;
        let sep = "  ";

        for item in &layout.summary {
            // Cached bracket attaches to the passed chip — handle inline.
            if matches!(item, BarItem::CachedBracket) {
                continue;
            }
            if !first {
                spans.push(Span::styled(sep.to_string(), base));
            }
            first = false;

            match item {
                BarItem::Progress => {
                    let text = if layout.compress_sticky {
                        format!("{}/{}", counts.done(), counts.total())
                    } else {
                        format!("{}/{} done", counts.done(), counts.total())
                    };
                    let style = base.fg(progress_color).add_modifier(Modifier::BOLD);
                    spans.push(Span::styled(text, style));
                }
                BarItem::FailedChip => {
                    spans.push(Span::styled(
                        format!("✖ {}", counts.failed),
                        base.fg(THEME.error).add_modifier(Modifier::BOLD),
                    ));
                }
                BarItem::PassedChip => {
                    spans.push(Span::styled(
                        format!("✔ {}", counts.passed),
                        base.fg(THEME.success),
                    ));
                    if layout.summary.contains(&BarItem::CachedBracket) && counts.cached > 0 {
                        spans.push(Span::styled(
                            format!(" [{} cached]", counts.cached),
                            base.fg(THEME.secondary_fg),
                        ));
                    }
                }
                BarItem::RunningChip => {
                    spans.push(Span::styled(
                        format!("⠋ {}", counts.running),
                        base.fg(THEME.info),
                    ));
                }
                BarItem::PendingChip => {
                    spans.push(Span::styled(
                        format!("· {}", counts.pending),
                        base.fg(THEME.secondary_fg),
                    ));
                }
                BarItem::SkipStopChips => {
                    let mut inner_first = true;
                    if counts.skipped > 0 {
                        spans.push(Span::styled(
                            format!("⏭ {}", counts.skipped),
                            base.fg(THEME.warning),
                        ));
                        inner_first = false;
                    }
                    if counts.stopped > 0 {
                        if !inner_first {
                            spans.push(Span::styled(sep.to_string(), base));
                        }
                        spans.push(Span::styled(
                            format!("◼ {}", counts.stopped),
                            base.fg(THEME.secondary_fg),
                        ));
                    }
                }
                // Sticky help items don't appear on the summary side.
                _ => {}
            }
        }

        spans
    }

    fn build_help_spans(&self, layout: &BarLayout, _counts: &StatusCounts) -> Vec<Span<'static>> {
        let base = self.base_style();
        let label_style = base.fg(THEME.secondary_fg);
        let key_style = base.fg(THEME.info);
        let sep = "  ";

        let mut spans: Vec<Span<'static>> = Vec::new();
        let mut first = true;

        let push_label = |spans: &mut Vec<Span<'static>>, text: &str| {
            spans.push(Span::styled(text.to_string(), label_style));
        };
        let push_key = |spans: &mut Vec<Span<'static>>, text: &str| {
            spans.push(Span::styled(text.to_string(), key_style));
        };

        for item in &layout.help {
            if !first {
                spans.push(Span::styled(sep.to_string(), base));
            }
            first = false;

            match item {
                BarItem::QuitHelp => {
                    if layout.compress_sticky {
                        push_key(&mut spans, "q");
                    } else {
                        push_label(&mut spans, "quit: ");
                        push_key(&mut spans, "q");
                    }
                }
                BarItem::HelpHelp => {
                    if layout.compress_sticky {
                        push_key(&mut spans, "?");
                    } else {
                        push_label(&mut spans, "help: ");
                        push_key(&mut spans, "?");
                    }
                }
                BarItem::NavigateHelp => {
                    push_label(&mut spans, "navigate: ");
                    push_key(&mut spans, "↑ ↓");
                }
                BarItem::FilterHelp => {
                    push_label(&mut spans, "filter: ");
                    push_key(&mut spans, "/");
                }
                BarItem::PinHelp => {
                    push_label(&mut spans, "pin output: ");
                    push_key(&mut spans, "1");
                    push_label(&mut spans, " or ");
                    push_key(&mut spans, "2");
                }
                BarItem::ShowOutputHelp => {
                    push_label(&mut spans, "show output: ");
                    push_key(&mut spans, "<enter>");
                }
                BarItem::ShowTaskListHelp => {
                    push_label(&mut spans, "show task list: ");
                    push_key(&mut spans, "b");
                }
                _ => {}
            }
        }

        spans
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RunOutcome {
    Waiting,
    InProgress,
    Passed,
    Failed,
    Stopped,
}

/// Sum of `Span::width()` across a span slice.
fn visual_width(spans: &[Span<'_>]) -> u16 {
    spans.iter().map(|s| s.width() as u16).sum()
}

/// Display-column width of a string. ASCII assumed for most of the
/// strings rendered by the bar; for special glyphs (`✔`, `↑`, etc.) we
/// rely on each glyph being one column on monospace terminals — matches
/// the assumptions used by the existing TUI rendering code.
fn display_width(s: &str) -> usize {
    s.chars()
        .map(|c| {
            // Heuristic: control chars 0; everything else 1 column. Adequate
            // for our fixed glyph set; we don't render emoji ZWJ sequences.
            if c.is_control() { 0 } else { 1 }
        })
        .sum()
}

/// Truncate a string to fit within `max` display columns, appending `…`
/// when content is cut. Returns the original string unmodified when it
/// already fits.
fn truncate_to_width(s: &str, max: usize) -> String {
    if max == 0 {
        return String::new();
    }
    if display_width(s) <= max {
        return s.to_string();
    }
    if max == 1 {
        return "…".to_string();
    }
    let mut out = String::new();
    let mut w = 0usize;
    for c in s.chars() {
        if c.is_control() {
            continue;
        }
        if w + 1 > max - 1 {
            break;
        }
        out.push(c);
        w += 1;
    }
    out.push('…');
    out
}

impl Default for StatusBar {
    fn default() -> Self {
        Self::new()
    }
}

impl Component for StatusBar {
    fn draw(&mut self, f: &mut Frame, area: Rect) -> Result<()> {
        if area.width == 0
            || area.height == 0
            || area.x >= f.area().width
            || area.y >= f.area().height
        {
            return Ok(());
        }

        let safe_area = Rect {
            x: area.x,
            y: area.y,
            width: area.width.min(f.area().width.saturating_sub(area.x)),
            height: area.height.min(f.area().height.saturating_sub(area.y)),
        };

        // The bar always renders on the LAST row of the safe area. When a
        // cloud message is present, it gets the row immediately above.
        let bar_y = safe_area.y + safe_area.height.saturating_sub(1);
        let bar_area = Rect {
            x: safe_area.x,
            y: bar_y,
            width: safe_area.width,
            height: 1,
        };

        if self.cloud_message.is_some() && safe_area.height >= 2 {
            let cloud_area = Rect {
                x: safe_area.x,
                y: bar_y.saturating_sub(1),
                width: safe_area.width,
                height: 1,
            };
            self.render_cloud_row(f, cloud_area);
        }

        self.render_bar_row(f, bar_area);

        Ok(())
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

    #[test]
    fn empty_iter_yields_all_zeros() {
        let counts = StatusCounts::from_iter(std::iter::empty());
        assert_eq!(counts, StatusCounts::default());
        assert_eq!(counts.total(), 0);
        assert_eq!(counts.done(), 0);
    }

    #[test]
    fn maps_success_to_passed_without_caching() {
        let counts = StatusCounts::from_iter([TaskStatus::Success]);
        assert_eq!(counts.passed, 1);
        assert_eq!(counts.cached, 0);
    }

    #[test]
    fn maps_all_cache_variants_to_passed_and_cached() {
        let counts = StatusCounts::from_iter([
            TaskStatus::LocalCache,
            TaskStatus::LocalCacheKeptExisting,
            TaskStatus::RemoteCache,
        ]);
        assert_eq!(counts.passed, 3);
        assert_eq!(counts.cached, 3);
    }

    #[test]
    fn maps_failure_skipped_stopped_into_distinct_buckets() {
        let counts = StatusCounts::from_iter([
            TaskStatus::Failure,
            TaskStatus::Skipped,
            TaskStatus::Skipped,
            TaskStatus::Stopped,
        ]);
        assert_eq!(counts.failed, 1);
        assert_eq!(counts.skipped, 2);
        assert_eq!(counts.stopped, 1);
    }

    #[test]
    fn collapses_in_progress_and_shared_into_running() {
        let counts = StatusCounts::from_iter([
            TaskStatus::InProgress,
            TaskStatus::Shared,
            TaskStatus::InProgress,
        ]);
        assert_eq!(counts.running, 3);
    }

    #[test]
    fn not_started_maps_to_pending() {
        let counts = StatusCounts::from_iter([TaskStatus::NotStarted, TaskStatus::NotStarted]);
        assert_eq!(counts.pending, 2);
    }

    #[test]
    fn done_counts_only_terminal_states() {
        let counts = StatusCounts::from_iter([
            TaskStatus::Success,    // +passed → done
            TaskStatus::LocalCache, // +passed → done
            TaskStatus::Failure,    // +failed → done
            TaskStatus::Skipped,    // +skipped → done
            TaskStatus::Stopped,    // +stopped → done
            TaskStatus::InProgress, // running, NOT done
            TaskStatus::Shared,     // running, NOT done
            TaskStatus::NotStarted, // pending, NOT done
        ]);
        assert_eq!(counts.done(), 5);
        assert_eq!(counts.total(), 8);
    }

    // ---------- Ladder fit-algorithm tests ----------

    /// Mid-run sample state matching section A of the prototype's width
    /// frames: 12/29 done · ✔ 9 · ✖ 3 · ⠋ 5 · · 12. Cached/skip/stop are
    /// zero (eager-zero-dropped at rung 1).
    fn sample_counts() -> StatusCounts {
        StatusCounts {
            passed: 9,
            cached: 0,
            failed: 3,
            skipped: 0,
            stopped: 0,
            running: 5,
            pending: 12,
        }
    }

    fn contains(layout: &BarLayout, item: BarItem) -> bool {
        layout.summary.contains(&item) || layout.help.contains(&item)
    }

    #[test]
    fn wide_terminal_keeps_everything() {
        let layout = fit_bar_layout(160, &sample_counts(), false);
        assert!(!layout.compress_sticky);
        // All non-zero chips + all help shortcuts present.
        assert!(contains(&layout, BarItem::Progress));
        assert!(contains(&layout, BarItem::PassedChip));
        assert!(contains(&layout, BarItem::FailedChip));
        assert!(contains(&layout, BarItem::RunningChip));
        assert!(contains(&layout, BarItem::PendingChip));
        assert!(contains(&layout, BarItem::QuitHelp));
        assert!(contains(&layout, BarItem::HelpHelp));
        assert!(contains(&layout, BarItem::NavigateHelp));
        assert!(contains(&layout, BarItem::FilterHelp));
        assert!(contains(&layout, BarItem::PinHelp));
        assert!(contains(&layout, BarItem::ShowOutputHelp));
        // Cached + SkipStop are zero in this sample → eager-zero-dropped.
        assert!(!contains(&layout, BarItem::CachedBracket));
        assert!(!contains(&layout, BarItem::SkipStopChips));
    }

    /// W=100 — first to drop is pin (rung 3); all chips and other actions
    /// stay (97-cell content fits in 100 with 3 cells of spare margin).
    #[test]
    fn w100_drops_pin_only() {
        let layout = fit_bar_layout(100, &sample_counts(), false);
        assert!(!contains(&layout, BarItem::PinHelp));
        assert!(contains(&layout, BarItem::NavigateHelp));
        assert!(contains(&layout, BarItem::FilterHelp));
        assert!(contains(&layout, BarItem::ShowOutputHelp));
        assert!(contains(&layout, BarItem::PassedChip));
        assert!(contains(&layout, BarItem::RunningChip));
        assert!(contains(&layout, BarItem::PendingChip));
    }

    /// W=80 — pin + navigate + filter dropped (rungs 3, 4, 5).
    /// show output (rung 6, the primary inspection action) is preserved;
    /// full chip set stays.
    #[test]
    fn w80_keeps_show_output_as_last_action() {
        let layout = fit_bar_layout(80, &sample_counts(), false);
        assert!(!contains(&layout, BarItem::PinHelp));
        assert!(!contains(&layout, BarItem::NavigateHelp));
        assert!(!contains(&layout, BarItem::FilterHelp));
        assert!(contains(&layout, BarItem::ShowOutputHelp));
        assert!(contains(&layout, BarItem::PassedChip));
        assert!(contains(&layout, BarItem::RunningChip));
        assert!(contains(&layout, BarItem::PendingChip));
    }

    /// W=60 — all non-critical actions dropped (rungs 3–6). Full chip set
    /// (incl. pending) survives → actions-first invariant.
    #[test]
    fn w60_drops_all_actions_keeps_full_chip_set() {
        let layout = fit_bar_layout(60, &sample_counts(), false);
        assert!(!contains(&layout, BarItem::PinHelp));
        assert!(!contains(&layout, BarItem::NavigateHelp));
        assert!(!contains(&layout, BarItem::FilterHelp));
        assert!(!contains(&layout, BarItem::ShowOutputHelp));
        assert!(contains(&layout, BarItem::QuitHelp));
        assert!(contains(&layout, BarItem::HelpHelp));
        assert!(contains(&layout, BarItem::PassedChip));
        assert!(contains(&layout, BarItem::RunningChip));
        assert!(contains(&layout, BarItem::PendingChip));
    }

    /// W=45 — pending is the first chip to drop (rung 7); passed/running
    /// stay (rungs 9/10).
    #[test]
    fn w45_drops_pending_first_among_chips() {
        let layout = fit_bar_layout(45, &sample_counts(), false);
        assert!(!contains(&layout, BarItem::PendingChip));
        assert!(contains(&layout, BarItem::PassedChip));
        assert!(contains(&layout, BarItem::RunningChip));
        assert!(contains(&layout, BarItem::FailedChip));
    }

    /// W=40 — passed (rung 9) dropped; running (rung 10) still alive as
    /// the last non-sticky chip.
    #[test]
    fn w40_drops_passed_keeps_running() {
        let layout = fit_bar_layout(40, &sample_counts(), false);
        assert!(contains(&layout, BarItem::Progress));
        assert!(contains(&layout, BarItem::FailedChip));
        assert!(contains(&layout, BarItem::RunningChip));
        assert!(!contains(&layout, BarItem::PassedChip));
        assert!(!contains(&layout, BarItem::PendingChip));
    }

    /// W=35 — every non-sticky item dropped. Only progress + failed +
    /// quit/help remain. compress_sticky still false (33-cell content fits
    /// in 35).
    #[test]
    fn w35_only_sticky_remains() {
        let layout = fit_bar_layout(35, &sample_counts(), false);
        assert!(contains(&layout, BarItem::Progress));
        assert!(contains(&layout, BarItem::FailedChip));
        assert!(contains(&layout, BarItem::QuitHelp));
        assert!(contains(&layout, BarItem::HelpHelp));
        assert!(!contains(&layout, BarItem::PassedChip));
        assert!(!contains(&layout, BarItem::RunningChip));
        assert!(!contains(&layout, BarItem::PendingChip));
        assert!(!layout.compress_sticky);
    }

    #[test]
    fn extreme_narrow_flags_compression() {
        let layout = fit_bar_layout(20, &sample_counts(), false);
        assert!(layout.compress_sticky);
    }

    /// Walks widths from 200 down and confirms each droppable item's
    /// last-rendered width respects the v4 drop order (lower priority →
    /// drops at narrower widths first, i.e. last-rendered-width is lower).
    // ---------- Rendering tests ----------

    /// Set up a TestBackend, render the bar, return the terminal so the
    /// caller can assert on `terminal.backend()` (mirrors the snapshot
    /// pattern used by `tasks_list` tests).
    fn render_bar(
        width: u16,
        counts: StatusCounts,
        hidden: bool,
        cloud: Option<&str>,
    ) -> ratatui::Terminal<ratatui::backend::TestBackend> {
        use ratatui::Terminal;
        use ratatui::backend::TestBackend;
        let height: u16 = if cloud.is_some() { 2 } else { 1 };
        let backend = TestBackend::new(width, height);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut bar = StatusBar::new();
        bar.set_state(counts, hidden, cloud.map(|s| s.to_string()));
        terminal
            .draw(|f| {
                let area = Rect::new(0, 0, width, height);
                bar.draw(f, area).unwrap();
            })
            .unwrap();
        terminal
    }

    // ---------- Snapshot tests ----------
    //
    // Each snapshot locks in the exact textual layout of the bar at a
    // canonical scenario. Same pattern as `tasks_list` tests: render to
    // a `TestBackend`, snapshot the backend.
    //
    // To accept changes after intentional edits:
    //   cargo insta accept --workspace-root packages/nx \
    //     --glob 'src/native/tui/components/snapshots/*status_bar*'

    /// State with a non-zero count in every category — used by snapshots
    /// that need to exercise skip/stop + cached rendering paths.
    fn full_counts() -> StatusCounts {
        StatusCounts {
            passed: 9,
            cached: 6,
            failed: 3,
            skipped: 2,
            stopped: 1,
            running: 5,
            pending: 12,
        }
    }

    #[test]
    fn snapshot_width_160_full() {
        let terminal = render_bar(160, sample_counts(), false, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_width_100_drops_pin() {
        let terminal = render_bar(100, sample_counts(), false, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_width_80_show_output_preserved() {
        let terminal = render_bar(80, sample_counts(), false, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_width_65_full_chips_minimal_help() {
        let terminal = render_bar(65, sample_counts(), false, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_width_50_pending_dropped() {
        let terminal = render_bar(50, sample_counts(), false, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_width_40_passed_dropped() {
        let terminal = render_bar(40, sample_counts(), false, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_width_30_sticky_compressed() {
        let terminal = render_bar(30, sample_counts(), false, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_state_waiting_for_tasks() {
        let terminal = render_bar(100, StatusCounts::default(), false, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_state_mid_run() {
        let terminal = render_bar(100, sample_counts(), false, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_state_completed_all_passed() {
        let counts = StatusCounts {
            passed: 29,
            cached: 14,
            failed: 0,
            skipped: 0,
            stopped: 0,
            running: 0,
            pending: 0,
        };
        let terminal = render_bar(100, counts, false, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_state_completed_with_failures() {
        let counts = StatusCounts {
            passed: 26,
            cached: 0,
            failed: 3,
            skipped: 0,
            stopped: 0,
            running: 0,
            pending: 0,
        };
        let terminal = render_bar(100, counts, false, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_state_stopped_early() {
        let counts = StatusCounts {
            passed: 11,
            cached: 0,
            failed: 3,
            skipped: 0,
            stopped: 2,
            running: 0,
            pending: 13,
        };
        let terminal = render_bar(100, counts, false, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_state_with_cached_bracket() {
        let mut counts = sample_counts();
        counts.cached = 6;
        let terminal = render_bar(120, counts, false, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_state_with_skip_stop_chips() {
        let terminal = render_bar(120, full_counts(), false, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_cloud_full_message_fits() {
        let terminal = render_bar(
            80,
            sample_counts(),
            false,
            Some("View logs and run details at https://nx.app/runs/KnGk4A47qk"),
        );
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_cloud_url_only() {
        let terminal = render_bar(
            35,
            sample_counts(),
            false,
            Some("View logs and run details at https://nx.app/runs/KnGk4A47qk"),
        );
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_cloud_truncated_url() {
        let terminal = render_bar(
            18,
            sample_counts(),
            false,
            Some("View logs and run details at https://nx.app/runs/KnGk4A47qk"),
        );
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn snapshot_hidden_task_list() {
        let terminal = render_bar(100, sample_counts(), true, None);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn drop_order_respects_v4_priority() {
        // Use a state where every droppable item has a non-zero count so
        // none get eager-zero-dropped.
        let counts = StatusCounts {
            passed: 9,
            cached: 6,
            failed: 3,
            skipped: 2,
            stopped: 1,
            running: 5,
            pending: 12,
        };

        let droppable = [
            BarItem::CachedBracket,
            BarItem::PinHelp,
            BarItem::NavigateHelp,
            BarItem::FilterHelp,
            BarItem::ShowOutputHelp,
            BarItem::PendingChip,
            BarItem::SkipStopChips,
            BarItem::PassedChip,
            BarItem::RunningChip,
        ];

        let mut last_seen: std::collections::HashMap<BarItem, u16> =
            droppable.iter().map(|i| (*i, 0)).collect();

        for w in (20..=200).rev() {
            let layout = fit_bar_layout(w, &counts, false);
            for item in &droppable {
                if contains(&layout, *item) {
                    last_seen.insert(*item, w);
                }
            }
        }

        // Items earlier in `droppable` (lower priority) must disappear at
        // wider widths than items later in `droppable`. Equivalently:
        // last_seen[earlier] >= last_seen[later].
        for window in droppable.windows(2) {
            assert!(
                last_seen[&window[0]] >= last_seen[&window[1]],
                "drop order violation: {:?} (priority {}) still rendering at width {} when {:?} (priority {}) needs width {}",
                window[0],
                window[0].priority(),
                last_seen[&window[0]],
                window[1],
                window[1].priority(),
                last_seen[&window[1]],
            );
        }
    }

    #[test]
    fn skip_stop_only_renders_when_non_zero() {
        let mut counts = sample_counts();
        counts.skipped = 3;
        counts.stopped = 2;
        let layout = fit_bar_layout(120, &counts, false);
        assert!(contains(&layout, BarItem::SkipStopChips));
    }

    #[test]
    fn skip_stop_demoted_below_pending_in_drop_order() {
        // At a width where exactly one of {pending, skip/stop} must drop,
        // pending should go first (it sits at rung 7; skip/stop at rung 8).
        let mut counts = sample_counts();
        counts.skipped = 3; // ensure skip/stop renders
        // Build a tight width where everything fits except one of the two.
        // Cycle widths until the algorithm has to make that choice.
        for w in (45..=100).rev() {
            let layout = fit_bar_layout(w, &counts, false);
            let has_pending = contains(&layout, BarItem::PendingChip);
            let has_skip = contains(&layout, BarItem::SkipStopChips);
            if !has_pending && has_skip {
                // Found the canonical width — assertion holds.
                return;
            }
            if !has_skip && has_pending {
                panic!(
                    "skip/stop dropped before pending at width {} — drop order violation",
                    w
                );
            }
        }
    }

    #[test]
    fn hidden_task_list_includes_show_task_list_help() {
        let layout = fit_bar_layout(160, &sample_counts(), true);
        assert!(contains(&layout, BarItem::ShowTaskListHelp));
    }

    #[test]
    fn visible_task_list_omits_show_task_list_help() {
        let layout = fit_bar_layout(160, &sample_counts(), false);
        assert!(!contains(&layout, BarItem::ShowTaskListHelp));
    }

    #[test]
    fn hidden_task_list_drops_filter_help() {
        // Filter targets the task list. When the list is hidden, the
        // shortcut has no useful effect — it should be elided regardless of
        // available width.
        let layout = fit_bar_layout(200, &sample_counts(), true);
        assert!(!contains(&layout, BarItem::FilterHelp));
        // Sanity: filter is still present when the list is visible.
        let layout = fit_bar_layout(200, &sample_counts(), false);
        assert!(contains(&layout, BarItem::FilterHelp));
    }

    /// Invariant: the width the fit pass computes for a chosen layout must
    /// equal the width the renderer actually emits. Would have caught the
    /// CachedBracket separator over-charge (fix carried in this branch)
    /// before snapshots locked it in. Exercises every interesting width ×
    /// counts × hidden combination to keep coverage broad.
    #[test]
    fn fit_pass_width_matches_rendered_width() {
        let mut completed = sample_counts();
        completed.cached = 6;
        let stopped = StatusCounts {
            passed: 11,
            cached: 0,
            failed: 3,
            skipped: 0,
            stopped: 2,
            running: 0,
            pending: 13,
        };

        let scenarios: Vec<(u16, StatusCounts, bool)> = vec![
            // Width sweep with sample state (cached=0).
            (160, sample_counts(), false),
            (120, sample_counts(), false),
            (100, sample_counts(), false),
            (80, sample_counts(), false),
            (65, sample_counts(), false),
            (50, sample_counts(), false),
            (45, sample_counts(), false),
            (40, sample_counts(), false),
            (35, sample_counts(), false),
            // Cached present — exercises the separator-attachment path.
            (200, completed, false),
            (160, completed, false),
            (140, completed, false),
            (120, completed, false),
            (100, completed, false),
            // Full counts — every chip non-zero, including SkipStopChips.
            (200, full_counts(), false),
            (140, full_counts(), false),
            (120, full_counts(), false),
            (80, full_counts(), false),
            // Stopped variant — ensures inner SkipStopChips with only one
            // sub-chip renders identically to fit-pass expectation.
            (140, stopped, false),
            (100, stopped, false),
            // Hidden task list — drops `filter:`, adds `show task list: b`.
            (200, sample_counts(), true),
            (120, sample_counts(), true),
            (80, sample_counts(), true),
            // Empty run — only sticky help, no chips.
            (100, StatusCounts::default(), false),
            (40, StatusCounts::default(), false),
        ];

        for (w, counts, hidden) in scenarios {
            let layout = fit_bar_layout(w, &counts, hidden);

            let mut bar = StatusBar::new();
            bar.set_state(counts, hidden, None);
            let outcome = bar.run_outcome();
            let summary_spans = bar.build_summary_spans(&layout, &counts, outcome);
            let help_spans = bar.build_help_spans(&layout, &counts);

            let summary_w = visual_width(&summary_spans);
            let help_w = visual_width(&help_spans);
            let gap = if summary_w > 0 && help_w > 0 {
                SUMMARY_HELP_GAP
            } else {
                0
            };
            let rendered = summary_w + gap + help_w;

            let computed = layout_total_width(&layout.summary, &layout.help, &counts);

            assert_eq!(
                computed, rendered,
                "fit-pass width != rendered width at W={} hidden={} counts={:?} layout={:?}",
                w, hidden, counts, layout
            );
        }
    }

    #[test]
    fn empty_run_renders_only_sticky_help() {
        let counts = StatusCounts::default();
        let layout = fit_bar_layout(80, &counts, false);
        assert!(contains(&layout, BarItem::QuitHelp));
        assert!(contains(&layout, BarItem::HelpHelp));
        // Progress chip has width when total=0 too ("0/0 done").
        // No status chips at all.
        assert!(!contains(&layout, BarItem::PassedChip));
        assert!(!contains(&layout, BarItem::FailedChip));
        assert!(!contains(&layout, BarItem::PendingChip));
        assert!(!contains(&layout, BarItem::RunningChip));
        assert!(!contains(&layout, BarItem::SkipStopChips));
    }

    #[test]
    fn total_sums_all_categories() {
        // Cached is a sub-count of passed and must not be double-counted.
        let counts = StatusCounts::from_iter([
            TaskStatus::Success,
            TaskStatus::LocalCache,
            TaskStatus::RemoteCache,
            TaskStatus::Failure,
            TaskStatus::Skipped,
            TaskStatus::Stopped,
            TaskStatus::InProgress,
            TaskStatus::NotStarted,
        ]);
        assert_eq!(counts.total(), 8);
        assert_eq!(counts.cached, 2); // not in total
    }
}
