use color_eyre::eyre::Result;
use ratatui::{
    Frame,
    buffer::CellDiffOption,
    layout::{Alignment, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{
        Block, BorderType, Borders, Clear, Padding, Paragraph, Scrollbar, ScrollbarOrientation,
        ScrollbarState, Wrap,
    },
};
use std::any::Any;
use std::num::NonZeroU16;
use std::time::{Duration, Instant};

use crate::native::tui::lifecycle::PerformanceSummaryPayload;
use crate::native::tui::theme::THEME;
use crate::native::tui::utils::{format_duration, pluralize};

use super::Component;

/// Word-wrapped row count for `lines` at `width`, using the same wrapping the
/// Paragraph applies — a hand-rolled character-wrap estimate diverges from
/// ratatui's word wrapping.
fn wrapped_rows(lines: &[Line], width: u16) -> usize {
    if lines.is_empty() {
        return 0;
    }
    Paragraph::new(lines.to_vec())
        .wrap(Wrap { trim: false })
        .line_count(width.max(1))
}

/// Make `visible` a clickable OSC 8 hyperlink to `href` by rewriting the buffer:
/// ratatui's text path strips the escape framing from cells (ratatui#1028), so we
/// scan for the rendered text and replace each per-row run with one self-contained
/// OSC 8 cell (ForcedWidth = the run's width), blanking the rest. Whitespace is
/// collapsed when matching so a wrapped phrase still matches; no match → no-op.
fn inject_osc8(f: &mut Frame<'_>, inner_area: Rect, visible: &str, href: &str) {
    if visible.is_empty() {
        return;
    }
    // Flatten the inner area, recording each kept char's (col, row); whitespace
    // runs (incl. row breaks) collapse to a single space.
    let mut flat = String::new();
    let mut pos: Vec<(u16, u16)> = Vec::new();
    let mut prev_space = true; // collapse + trim leading
    for row in inner_area.y..inner_area.bottom() {
        for col in inner_area.x..inner_area.right() {
            let ch = f
                .buffer_mut()
                .cell((col, row))
                .and_then(|c| c.symbol().chars().next())
                .unwrap_or(' ');
            if ch == ' ' {
                if !prev_space {
                    flat.push(' ');
                    pos.push((u16::MAX, u16::MAX)); // sentinel: collapsed space
                    prev_space = true;
                }
            } else {
                flat.push(ch);
                pos.push((col, row));
                prev_space = false;
            }
        }
        if !prev_space {
            flat.push(' '); // a row break wraps like a space
            pos.push((u16::MAX, u16::MAX));
            prev_space = true;
        }
    }
    let target: String = visible.split_whitespace().collect::<Vec<_>>().join(" ");
    // Injects at the FIRST match. Invariant: each linked phrase must be unique
    // within the popup's rendered text, else the link lands on the wrong run.
    let Some(byte_idx) = flat.find(&target) else {
        return;
    };
    let char_start = flat[..byte_idx].chars().count();
    let target_len = target.chars().count();

    // Group the matched chars into per-row [first_col, last_col] segments.
    let mut segments: Vec<(u16, u16, u16)> = Vec::new();
    for (col, row) in pos.iter().skip(char_start).take(target_len).copied() {
        if col == u16::MAX {
            continue; // collapsed space between rows/words
        }
        match segments.last_mut() {
            Some((r, _first, last)) if *r == row => *last = col,
            _ => segments.push((row, col, col)),
        }
    }

    for (row, first_col, last_col) in segments {
        let mut segment_text = String::new();
        for col in first_col..=last_col {
            if let Some(cell) = f.buffer_mut().cell((col, row)) {
                segment_text.push_str(cell.symbol());
            }
        }
        let seq = format!("\x1b]8;;{href}\x07{segment_text}\x1b]8;;\x07");
        if let Some(cell) = f.buffer_mut().cell_mut((first_col, row)) {
            cell.set_symbol(&seq);
            cell.set_style(Style::default().fg(THEME.info));
            if let Some(width) = NonZeroU16::new(last_col - first_col + 1) {
                cell.set_diff_option(CellDiffOption::ForcedWidth(width));
            }
        }
        // The ForcedWidth cell owns the run's columns; blank the rest.
        for col in (first_col + 1)..=last_col {
            if let Some(cell) = f.buffer_mut().cell_mut((col, row)) {
                cell.set_symbol(" ");
            }
        }
    }
}

/// The cache stat label, or None when there's nothing to show (mirrors the TS
/// `cacheStat`).
fn cache_label(s: &PerformanceSummaryPayload) -> Option<String> {
    if s.cache_skipped {
        return Some("Skipped (--skip-nx-cache)".to_string());
    }
    let cache = s.cache.as_ref()?;
    if cache.total == 0 {
        return None;
    }
    let pct = (cache.hits as f64 / cache.total as f64 * 100.0).round() as i64;
    Some(format!("{}/{} hit ({}%)", cache.hits, cache.total, pct))
}

/// A stat row — label padded to the widest label ("Recoverable time:" = 17) so
/// values align without a gaping gap, then the value. Keep in sync with the TS report.
fn stat_line(label: &str, value: String) -> Line<'static> {
    Line::from(vec![
        Span::styled(
            format!("{:<17}  ", format!("{label}:")),
            Style::default().fg(THEME.secondary_fg),
        ),
        Span::styled(value, Style::default().fg(THEME.primary_fg)),
    ])
}

pub struct CountdownPopup {
    visible: bool,
    start_time: Option<Instant>,
    duration: Duration,
    scroll_offset: usize,
    scrollbar_state: ScrollbarState,
    content_height: usize,
    viewport_height: usize,
    /// Screen rect of the bordered popup box from the last render, used for
    /// click-outside-to-dismiss hit-testing.
    last_area: Option<Rect>,
    /// Screen rect of the inner text area (inside the border, clear of the
    /// scrollbar) from the last render, used to bound text selection/links.
    content_area: Option<Rect>,
    /// The run report shown above the hint text (None until set).
    summary: Option<PerformanceSummaryPayload>,
    /// When pinned, the auto-exit countdown is stopped and the popup stays open
    /// until the user explicitly quits.
    pinned: bool,
}

impl CountdownPopup {
    pub fn new() -> Self {
        Self {
            visible: false,
            start_time: None,
            duration: Duration::from_secs(3),
            scroll_offset: 0,
            scrollbar_state: ScrollbarState::default(),
            content_height: 0,
            viewport_height: 0,
            last_area: None,
            content_area: None,
            summary: None,
            pinned: false,
        }
    }

    /// Set the run report shown above the hint text.
    pub fn set_summary(&mut self, summary: PerformanceSummaryPayload) {
        self.summary = Some(summary);
    }

    /// Build the styled report lines from the structured summary — the native
    /// equivalent of the TS `formatReport`.
    fn build_report_lines(&self) -> Vec<Line<'static>> {
        let Some(s) = self.summary.as_ref() else {
            return Vec::new();
        };
        let mut lines: Vec<Line<'static>> = Vec::new();

        lines.push(stat_line(
            "Run duration",
            format_duration(s.run_duration_ms),
        ));
        if let Some(cache) = cache_label(s) {
            lines.push(stat_line("Cache", cache));
        }
        lines.push(stat_line(
            "Critical path",
            format!(
                "{} ({} {})",
                format_duration(s.critical_path_ms),
                s.critical_path_task_count,
                pluralize(s.critical_path_task_count, "task")
            ),
        ));
        let recoverable = if s.recoverable_ms > 0.0 && s.run_duration_ms > 0.0 {
            let pct = (s.recoverable_ms / s.run_duration_ms * 100.0).round() as i64;
            format!(
                "{} ({}% of the run)",
                format_duration(s.recoverable_ms),
                pct
            )
        } else {
            format_duration(s.recoverable_ms)
        };
        lines.push(stat_line("Recoverable time", recoverable));

        // Only single-line recs go here; the multi-line "speed up the longest tasks" rec
        // is rendered LAST by `longest_tasks_lines`. Skip the whole section (header
        // included) when there's nothing to recommend — e.g. a fully-cached run.
        if !s.recommendations.is_empty() {
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled(
                "Recommendations:",
                Style::default().fg(THEME.secondary_fg),
            )));
            for rec in s.recommendations.iter().filter(|r| !r.contains('\n')) {
                lines.push(Line::from(Span::styled(
                    format!("- {rec}"),
                    Style::default().fg(THEME.primary_fg),
                )));
            }
        }

        lines
    }

    /// The "speed up / split the longest tasks" recommendation — the one
    /// multi-line rec, embedding the task list. Rendered LAST so the task list
    /// ends the report. Empty when there's no such rec.
    fn longest_tasks_lines(&self) -> Vec<Line<'static>> {
        let mut lines: Vec<Line<'static>> = Vec::new();
        let Some(s) = self.summary.as_ref() else {
            return lines;
        };
        for rec in s.recommendations.iter().filter(|r| r.contains('\n')) {
            let mut parts = rec.split('\n');
            if let Some(first) = parts.next() {
                lines.push(Line::from(Span::styled(
                    format!("- {first}"),
                    Style::default().fg(THEME.primary_fg),
                )));
            }
            for rest in parts {
                // rest already carries a 2-space indent from formatTopTaskRows;
                // add 2 more so it nests under the bullet.
                lines.push(Line::from(Span::styled(
                    format!("  {rest}"),
                    Style::default().fg(THEME.secondary_fg),
                )));
            }
        }
        lines
    }

    pub fn is_scrollable(&self) -> bool {
        self.content_height > self.viewport_height
    }

    /// The bordered popup box drawn last frame, if visible.
    pub fn last_area(&self) -> Option<Rect> {
        self.last_area
    }

    /// The inner text area drawn last frame, if visible.
    pub fn content_area(&self) -> Option<Rect> {
        self.content_area
    }

    pub fn start_countdown(&mut self, duration_secs: u64) {
        self.visible = true;
        self.start_time = Some(Instant::now());
        self.duration = Duration::from_secs(duration_secs);
        self.scroll_offset = 0;
        self.scrollbar_state = ScrollbarState::default();
        self.pinned = false;
    }

    pub fn cancel_countdown(&mut self) {
        self.visible = false;
        self.start_time = None;
        self.pinned = false;
    }

    /// Stop the auto-exit countdown but keep the popup open — used when the user
    /// interacts with the report so it doesn't close while reading.
    pub fn pin_open(&mut self) {
        self.pinned = true;
    }

    /// Whether the countdown has been pinned/stopped while the popup stays open
    /// (distinct from `cancel_countdown`, which hides it entirely).
    pub fn is_pinned(&self) -> bool {
        self.pinned
    }

    /// Whether a run report has been set. Used to gate the "reopen report" key.
    pub fn has_summary(&self) -> bool {
        self.summary.is_some()
    }

    /// Re-open the report popup on demand, with no countdown.
    pub fn reopen(&mut self) {
        self.visible = true;
        self.pinned = true;
        self.scroll_offset = 0;
        self.scrollbar_state = ScrollbarState::default();
    }

    pub fn should_quit(&self) -> bool {
        if self.pinned {
            return false;
        }
        if let Some(start_time) = self.start_time {
            return start_time.elapsed() >= self.duration;
        }
        false
    }

    pub fn set_visible(&mut self, visible: bool) {
        self.visible = visible;
        if !visible {
            self.start_time = None;
        }
    }

    pub fn is_visible(&self) -> bool {
        self.visible
    }

    pub fn scroll_up(&mut self) {
        if self.scroll_offset > 0 {
            self.scroll_offset -= 1;
            self.scrollbar_state = self
                .scrollbar_state
                .content_length(self.content_height)
                .viewport_content_length(self.viewport_height)
                .position(self.scroll_offset);
        }
    }

    pub fn scroll_down(&mut self) {
        let max_scroll = self.content_height.saturating_sub(self.viewport_height);
        if self.scroll_offset < max_scroll {
            self.scroll_offset += 1;
            self.scrollbar_state = self
                .scrollbar_state
                .content_length(self.content_height)
                .viewport_content_length(self.viewport_height)
                .position(self.scroll_offset);
        }
    }

    /// Report-mode content: the report body, then the "longest tasks" rec so its list
    /// ends the popup.
    fn report_mode_content(
        &self,
        mut content: Vec<Line<'static>>,
    ) -> (Vec<Line<'static>>, Option<usize>) {
        let url_line_index = content.len();
        content.extend(self.longest_tasks_lines());
        // Some(..) marks report mode so the OSC 8 pass runs for the recommendation
        // links; the index value itself is unused.
        (content, Some(url_line_index))
    }

    /// Exit-dialog content shown when there's no report (e.g. q pressed mid-run) — just
    /// the interactive hints.
    fn exit_dialog_content() -> Vec<Line<'static>> {
        vec![
            Line::from(vec![
                Span::styled("• Press ", Style::default().fg(THEME.secondary_fg)),
                Span::styled("q to exit immediately ", Style::default().fg(THEME.info)),
                Span::styled("or ", Style::default().fg(THEME.secondary_fg)),
                Span::styled("any other key ", Style::default().fg(THEME.info)),
                Span::styled(
                    "to keep the TUI running and interactively explore the results.",
                    Style::default().fg(THEME.secondary_fg),
                ),
            ]),
            Line::from(""),
            Line::from(vec![
                Span::styled(
                    "• Learn how to configure auto-exit and more in the docs: ",
                    Style::default().fg(THEME.secondary_fg),
                ),
                Span::styled(
                    "https://nx.dev/terminal-ui",
                    Style::default().fg(THEME.info),
                ),
            ]),
        ]
    }

    /// The popup title spans: "NX Performance Report — exiting in N..." with a report
    /// (the countdown drops once pinned), or "NX — exiting in N..." without one.
    fn build_title_spans(&self, has_report: bool, time_remaining: u64) -> Vec<Span<'static>> {
        let mut spans = vec![
            Span::raw("  "),
            Span::styled(
                " NX ",
                Style::default()
                    .add_modifier(Modifier::BOLD)
                    .bg(THEME.info)
                    .fg(THEME.primary_fg),
            ),
        ];
        if has_report {
            spans.push(Span::styled(
                "  Performance Report",
                Style::default().fg(THEME.primary_fg),
            ));
        }
        // The countdown runs until the report is pinned; the no-report exit dialog
        // (q pressed mid-run) always shows it. The leading spaces give the gap after
        // the badge / report label.
        if !has_report || !self.pinned {
            spans.push(Span::styled(
                "  — exiting in ",
                Style::default().fg(THEME.primary_fg),
            ));
            spans.push(Span::styled(
                format!("{time_remaining}"),
                Style::default().fg(THEME.info),
            ));
            spans.push(Span::styled("...  ", Style::default().fg(THEME.primary_fg)));
        }
        spans
    }

    pub fn render(&mut self, f: &mut Frame<'_>, area: Rect) {
        // Guard against rendering outside buffer bounds (can happen while the
        // user resizes the window before it stabilizes).
        if area.height == 0
            || area.width == 0
            || area.x >= f.area().width
            || area.y >= f.area().height
        {
            return;
        }

        let safe_area = Rect {
            x: area.x,
            y: area.y,
            width: area.width.min(f.area().width.saturating_sub(area.x)),
            height: area.height.min(f.area().height.saturating_sub(area.y)),
        };

        let report = self.build_report_lines();
        let has_report = !report.is_empty();
        // Two modes: a finished run shows the Performance Report; otherwise (e.g. q
        // pressed mid-run) the original exit dialog with just the interactive hints.
        let (content, url_line_index) = if has_report {
            self.report_mode_content(report)
        } else {
            (Self::exit_dialog_content(), None)
        };

        let seconds_remaining = if let Some(start_time) = self.start_time {
            let elapsed = start_time.elapsed();
            if elapsed >= self.duration {
                0
            } else {
                (self.duration - elapsed).as_secs()
            }
        } else {
            0
        };
        let time_remaining = seconds_remaining + 1;

        let title_spans = self.build_title_spans(has_report, time_remaining);
        let close_hint = vec![
            Span::styled(" (esc) ", Style::default().fg(THEME.secondary_fg)),
            Span::styled("✕  ", Style::default().fg(THEME.info)),
        ];

        // Keybinding actions in the bottom border — only with a report, where there's
        // a pane to reopen and possibly scroll (scroll only when the report overflows).
        let bottom_hints: Option<Vec<Span>> = if has_report {
            let mut footer = vec![
                Span::raw("  "),
                Span::styled("quit: ", Style::default().fg(THEME.secondary_fg)),
                Span::styled("q", Style::default().fg(THEME.info)),
                Span::styled(
                    "   reopen report: ",
                    Style::default().fg(THEME.secondary_fg),
                ),
                Span::styled("p", Style::default().fg(THEME.info)),
            ];
            if self.is_scrollable() {
                footer.push(Span::styled(
                    "   scroll: ",
                    Style::default().fg(THEME.secondary_fg),
                ));
                footer.push(Span::styled("↑/↓", Style::default().fg(THEME.info)));
            }
            footer.push(Span::raw("  "));
            Some(footer)
        } else {
            None
        };

        // Horizontal chrome (borders + padding) the content sits inside — derived from
        // a matching block so the width math tracks the real padding instead of a magic
        // number (Padding::proportional(1) is 2 cells per side, not 1).
        let h_chrome = {
            let b = Block::default()
                .borders(Borders::ALL)
                .padding(Padding::proportional(1));
            100u16.saturating_sub(b.inner(Rect::new(0, 0, 100, 1)).width)
        };

        // Size the popup to its content so a short cached-run report doesn't float in a
        // fixed-width box, while staying wide enough for the title row and the bottom
        // keybindings; cap at 70 so long recommendations still wrap.
        let content_width = content.iter().map(|l| l.width() as u16).max().unwrap_or(0);
        let title_row_width: u16 = title_spans.iter().map(|s| s.width() as u16).sum::<u16>()
            + close_hint.iter().map(|s| s.width() as u16).sum::<u16>();
        let bottom_width: u16 = bottom_hints
            .as_ref()
            .map(|f| f.iter().map(|s| s.width() as u16).sum())
            .unwrap_or(0);
        let popup_width = content_width
            .max(title_row_width)
            .max(bottom_width)
            .saturating_add(h_chrome)
            .min(70)
            .min(safe_area.width.saturating_sub(4));

        // Inner width comes from a matching chrome block so it tracks the real
        // inner_area width below instead of hard-coded padding math; +4 for vertical
        // chrome, overflow scrolls.
        let inner_width = Block::default()
            .borders(Borders::ALL)
            .padding(Padding::proportional(1))
            .inner(Rect::new(0, 0, popup_width, 1))
            .width
            .max(1);
        let estimated_rows = wrapped_rows(&content, inner_width);
        let popup_height = ((estimated_rows as u16).saturating_add(4))
            .min(safe_area.height.saturating_sub(4))
            .max(5);

        let popup_x = safe_area.x + (safe_area.width.saturating_sub(popup_width)) / 2;
        let popup_y = safe_area.y + (safe_area.height.saturating_sub(popup_height)) / 2;

        let popup_area = Rect::new(popup_x, popup_y, popup_width, popup_height);

        // Record the popup box so the app can hit-test mouse events against it.
        self.last_area = Some(popup_area);

        let mut block = Block::default()
            .title(Line::from(title_spans))
            .title_alignment(Alignment::Left)
            .title_top(Line::from(close_hint).alignment(Alignment::Right))
            .borders(Borders::ALL)
            .border_type(BorderType::Plain)
            .border_style(Style::default().fg(THEME.info))
            .padding(Padding::proportional(1));
        if let Some(footer) = bottom_hints {
            block = block.title_bottom(Line::from(footer).alignment(Alignment::Right));
        }

        let inner_area = block.inner(popup_area);
        // Record the inner text area so the app can bound selection/link hit-tests.
        self.content_area = Some(inner_area);
        self.viewport_height = inner_area.height as usize;
        // The text area sits inside the border + padding, so it never includes
        // the scrollbar (drawn on the far-right border column).
        self.content_area = Some(inner_area);

        // Content height in wrapped rows, driving the scrollbar and the scroll
        // bound in scroll_down.
        self.content_height = wrapped_rows(&content, inner_area.width);

        let scrollable_rows = self.content_height.saturating_sub(self.viewport_height);
        let needs_scrollbar = scrollable_rows > 0;

        self.scrollbar_state = if needs_scrollbar {
            self.scrollbar_state
                .content_length(scrollable_rows)
                .viewport_content_length(self.viewport_height)
                .position(self.scroll_offset)
        } else {
            ScrollbarState::default()
        };

        // Scroll by visual (wrapped) ROWS. scroll_offset is bounded in wrapped
        // rows by scroll_down's max_scroll, matching Paragraph::scroll's row-based
        // offset — slicing the unwrapped `content` with a wrapped-row offset
        // panicked the process.
        let popup = Paragraph::new(content.clone())
            .block(block.clone())
            // trim: false preserves leading whitespace so the report's
            // indentation renders.
            .wrap(Wrap { trim: false })
            .scroll((self.scroll_offset as u16, 0));

        f.render_widget(Clear, popup_area);
        f.render_widget(popup, popup_area);

        // Turn the report's links into real OSC 8 hyperlinks (see inject_osc8).
        if url_line_index.is_some() {
            if let Some(s) = self.summary.as_ref() {
                // Hyperlink the recommendation phrases (labels and hrefs from the
                // payload); a phrase that isn't shown isn't found.
                for link in &s.links {
                    inject_osc8(f, inner_area, &link.text, &link.href);
                }
            }
        }

        if needs_scrollbar {
            // Blank out the corners so the scrollbar arrows don't collide with
            // the border.
            let top_text = Line::from(vec![Span::raw("  ")]);
            let bottom_text = Line::from(vec![Span::raw("  ")]);

            let text_width = 2;

            let top_right_area = Rect {
                x: popup_area.x + popup_area.width - text_width as u16 - 3,
                y: popup_area.y,
                width: text_width as u16 + 2,
                height: 1,
            };

            let bottom_right_area = Rect {
                x: popup_area.x + popup_area.width - text_width as u16 - 3,
                y: popup_area.y + popup_area.height - 1,
                width: text_width as u16 + 2,
                height: 1,
            };

            f.render_widget(
                Paragraph::new(top_text)
                    .alignment(Alignment::Right)
                    .style(Style::default().fg(THEME.info)),
                top_right_area,
            );

            f.render_widget(
                Paragraph::new(bottom_text)
                    .alignment(Alignment::Right)
                    .style(Style::default().fg(THEME.info)),
                bottom_right_area,
            );

            let scrollbar = Scrollbar::default()
                .orientation(ScrollbarOrientation::VerticalRight)
                .begin_symbol(Some("↑"))
                .end_symbol(Some("↓"))
                .style(Style::default().fg(THEME.info));

            f.render_stateful_widget(scrollbar, popup_area, &mut self.scrollbar_state);
        }
    }
}

impl Component for CountdownPopup {
    fn draw(&mut self, f: &mut Frame<'_>, rect: Rect) -> Result<()> {
        if self.visible {
            self.render(f, rect);
        } else {
            self.last_area = None;
            self.content_area = None;
        }
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
    use crate::native::tui::lifecycle::{CacheStat, Link};
    use ratatui::Terminal;
    use ratatui::backend::TestBackend;

    // The remote-cache CTA text/href the payload carries (built in TS); the popup must
    // render and hyperlink exactly these.
    const CACHE_PHRASE: &str =
        "Drastically reduce your run duration by sharing a cache across your team and CI";
    const CACHE_HREF: &str = "https://nx.dev/ci/features/remote-cache?utm=performance-report";

    fn summary_with(recommendations: Vec<String>) -> PerformanceSummaryPayload {
        PerformanceSummaryPayload {
            run_duration_ms: 100_000.0,
            critical_path_ms: 50_000.0,
            critical_path_task_count: 5,
            recoverable_ms: 0.0,
            cache: None,
            cache_skipped: false,
            recommendations,
            links: Vec::new(),
        }
    }

    #[test]
    fn cache_label_matches_ts() {
        let mut skipped = summary_with(vec![]);
        skipped.cache_skipped = true;
        assert_eq!(
            cache_label(&skipped).as_deref(),
            Some("Skipped (--skip-nx-cache)")
        );

        let mut partial = summary_with(vec![]);
        partial.cache = Some(CacheStat { hits: 1, total: 3 });
        assert_eq!(cache_label(&partial).as_deref(), Some("1/3 hit (33%)"));

        let mut full = summary_with(vec![]);
        full.cache = Some(CacheStat { hits: 1, total: 1 });
        assert_eq!(cache_label(&full).as_deref(), Some("1/1 hit (100%)"));

        assert_eq!(cache_label(&summary_with(vec![])), None);
        let mut zero = summary_with(vec![]);
        zero.cache = Some(CacheStat { hits: 0, total: 0 });
        assert_eq!(cache_label(&zero), None);
    }

    /// Render the popup's report to a newline-joined string of cell symbols.
    fn render_to_string(popup: &mut CountdownPopup) -> String {
        let mut terminal = Terminal::new(TestBackend::new(74, 60)).unwrap();
        terminal
            .draw(|f| {
                let area = f.area();
                popup.render(f, area);
            })
            .unwrap();
        let buffer = terminal.backend().buffer().clone();
        let mut text = String::new();
        for y in 0..buffer.area.height {
            for x in 0..buffer.area.width {
                text.push_str(buffer.cell((x, y)).unwrap().symbol());
            }
            text.push('\n');
        }
        text
    }

    #[test]
    fn renders_singular_task_count() {
        // Assert at the RENDER level, not just in `pluralize`: a hardcoded "tasks"
        // in the format string would slip past a helper-only test.
        let mut popup = CountdownPopup::new();
        let mut s = summary_with(vec![]);
        s.critical_path_task_count = 1;
        popup.set_summary(s);

        let text = render_to_string(&mut popup);
        assert!(text.contains("(1 task)"), "expected a singular task count");
        assert!(
            !text.contains("(1 tasks)"),
            "must not pluralize a single task"
        );
    }

    #[test]
    fn omits_the_recommendations_section_when_there_are_none() {
        // A fully-cached run has nothing to recommend; the header must not render alone.
        let mut popup = CountdownPopup::new();
        popup.set_summary(summary_with(vec![]));

        let text = render_to_string(&mut popup);
        assert!(
            !text.contains("Recommendations:"),
            "no recommendations → no Recommendations header"
        );
    }

    #[test]
    fn renders_zero_duration_without_nan_or_inf() {
        // A zero run duration must hit the recoverable-percentage guard rather
        // than divide by zero and leak NaN/inf.
        let mut popup = CountdownPopup::new();
        let mut s = summary_with(vec![]);
        s.run_duration_ms = 0.0;
        s.critical_path_ms = 0.0;
        s.recoverable_ms = 0.0;
        popup.set_summary(s);

        let text = render_to_string(&mut popup).to_lowercase();
        assert!(!text.contains("nan"), "NaN leaked into the report");
        assert!(!text.contains("inf"), "inf leaked into the report");
    }

    /// Width in columns of the rendered popup's border box.
    fn popup_border_width(text: &str) -> usize {
        let row = text
            .lines()
            .find(|l| l.contains('┌'))
            .expect("a bordered popup");
        let chars: Vec<char> = row.chars().collect();
        let left = chars.iter().position(|&c| c == '┌').unwrap();
        let right = chars.iter().rposition(|&c| c == '┐').unwrap();
        right - left + 1
    }

    #[test]
    fn sizes_the_popup_to_its_content() {
        // A short (cached-run) report is sized to its content + chrome, not the old
        // fixed-width box; a long recommendation still expands it up to the 70 cap.
        let mut short = CountdownPopup::new();
        short.set_summary(summary_with(vec![]));
        let short_w = popup_border_width(&render_to_string(&mut short));

        let mut wide = CountdownPopup::new();
        wide.set_summary(summary_with(vec![
            "Distribute across machines with Nx Agents to increase parallelism without \
             overwhelming local resource usage, then split the longest critical-path tasks."
                .to_string(),
        ]));
        let wide_w = popup_border_width(&render_to_string(&mut wide));

        assert!(
            short_w < 70,
            "short report should not be a fixed 70 wide: {short_w}"
        );
        assert!(
            short_w < wide_w,
            "popup width should follow content (short {short_w} vs wide {wide_w})"
        );
        assert!(wide_w <= 70, "popup width caps at 70: {wide_w}");
    }

    #[test]
    fn remote_cache_rec_links_the_whole_phrase_across_rows() {
        // The remote-cache rec is the whole sentence as a link; it wraps to
        // multiple rows, so each rendered row-segment must be linked.
        let rec = format!("{CACHE_PHRASE}.");
        let mut popup = CountdownPopup::new();
        let mut s = summary_with(vec![rec]);
        s.links = vec![Link {
            text: CACHE_PHRASE.to_string(),
            href: CACHE_HREF.to_string(),
        }];
        popup.set_summary(s);

        let mut terminal = Terminal::new(TestBackend::new(74, 60)).unwrap();
        terminal
            .draw(|f| {
                let area = f.area();
                popup.render(f, area);
            })
            .unwrap();
        let buffer = terminal.backend().buffer().clone();

        // Every OSC 8 cell targets a known page; at least one the remote cache.
        let mut cache_links = 0;
        for y in 0..buffer.area.height {
            for x in 0..buffer.area.width {
                let sym = buffer.cell((x, y)).unwrap().symbol();
                if sym.contains("\x1b]8;;") {
                    assert!(sym.contains(CACHE_HREF), "unexpected OSC 8 target");
                    if sym.contains(CACHE_HREF) {
                        cache_links += 1;
                    }
                }
            }
        }
        assert!(cache_links >= 1, "the cache phrase should be linked");

        // The raw URL is never visible, and the phrase (start AND end, i.e. every
        // wrapped row) is consumed by the links rather than left plain.
        for y in 0..buffer.area.height {
            let mut text = String::new();
            for x in 0..buffer.area.width {
                let s = buffer.cell((x, y)).unwrap().symbol();
                text.push_str(if s.contains('\x1b') { "\u{0}" } else { s });
            }
            assert!(
                !text.contains("https://nx.dev/ci/features/remote-cache"),
                "raw remote-cache URL visible on row {y}"
            );
            assert!(
                !text.contains("Drastically reduce"),
                "phrase start left unlinked on row {y}"
            );
            assert!(
                !text.contains("team and CI"),
                "phrase end (wrapped row) left unlinked on row {y}"
            );
        }
    }
}
