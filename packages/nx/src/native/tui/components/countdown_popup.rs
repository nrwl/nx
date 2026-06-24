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

/// Make `visible` (as the Paragraph rendered it, possibly wrapped across rows) a
/// clickable OSC 8 hyperlink to `href`. ratatui's text path strips the escape
/// framing from cells (ratatui#1028), so instead we scan the buffer for the
/// rendered text and replace each per-row run with one self-contained OSC 8 cell
/// (sequence + `CellDiffOption::ForcedWidth` = the run's width), blanking the
/// rest — one cell per row keeps every link fragment robust to incremental
/// diffing. Matching collapses whitespace so a wrap point still matches; if
/// `visible` isn't found nothing is injected. Requires ratatui-core >= 0.1.2 for
/// ForcedWidth.
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

/// Format a millisecond duration like the TS `formatDuration` (e.g. "470ms",
/// "1m 30s"), so the popup matches the terminal report.
fn format_duration(ms: f64) -> String {
    if ms < 1000.0 {
        return format!("{}ms", ms.round() as i64);
    }
    let seconds = (ms / 100.0).round() / 10.0;
    if seconds >= 60.0 {
        let total = (ms / 1000.0).round() as i64;
        return format!("{}m {}s", total / 60, total % 60);
    }
    format!("{:.1}s", seconds)
}

/// Append "s" unless `count` is 1 (mirrors the TS `pluralize`).
fn pluralize(count: u32, noun: &str) -> String {
    if count == 1 {
        noun.to_string()
    } else {
        format!("{noun}s")
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

/// A stat row — left-aligned padded label, then the value.
fn stat_line(label: &str, value: String) -> Line<'static> {
    Line::from(vec![
        Span::styled(
            format!("{:<25}  ", format!("{label}:")),
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
                "{}   ({} {})",
                format_duration(s.critical_path_ms),
                s.critical_path_task_count,
                pluralize(s.critical_path_task_count, "task")
            ),
        ));
        let recoverable = if s.recoverable_ms > 0.0 && s.run_duration_ms > 0.0 {
            let pct = (s.recoverable_ms / s.run_duration_ms * 100.0).round() as i64;
            format!(
                "{}   ({}% of the run)",
                format_duration(s.recoverable_ms),
                pct
            )
        } else {
            format_duration(s.recoverable_ms)
        };
        lines.push(stat_line("Recoverable time", recoverable));

        // Header always shown: the docs link `render` adds below is itself a
        // recommendation. Only single-line recs go here; the multi-line
        // "speed up the longest tasks" rec is rendered LAST (after the link) by
        // `longest_tasks_lines`, so its task list ends the report.
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

        let popup_width: u16 = 70;
        let popup_width = popup_width.min(safe_area.width.saturating_sub(4));

        // Two modes: with a report (run finished) → the Performance Report;
        // without one (e.g. q pressed mid-run) → the original exit dialog with
        // just the interactive hints.
        let mut content: Vec<Line> = Vec::new();
        // Flag (via `is_some()` below) to gate the OSC 8 injection. The stored
        // index is unused; presence is what matters.
        let mut url_line_index: Option<usize> = None;
        let report = self.build_report_lines();
        let has_report = !report.is_empty();
        if has_report {
            content.extend(report);
            // The docs link is a "- " recommendation item; the label is turned
            // into a clickable hyperlink by the OSC 8 injection below, or stays
            // plain text if injection is skipped (e.g. popup too narrow).
            url_line_index = Some(content.len());
            content.push(Line::from(vec![
                Span::styled("- ", Style::default().fg(THEME.secondary_fg)),
                Span::styled(
                    self.summary.as_ref().unwrap().footer.text.clone(),
                    Style::default().fg(THEME.info),
                ),
            ]));
            // The "speed up the longest tasks" rec goes LAST so its task list
            // ends the report.
            content.extend(self.longest_tasks_lines());
        } else {
            content.push(Line::from(vec![
                Span::styled("• Press ", Style::default().fg(THEME.secondary_fg)),
                Span::styled("q to exit immediately ", Style::default().fg(THEME.info)),
                Span::styled("or ", Style::default().fg(THEME.secondary_fg)),
                Span::styled("any other key ", Style::default().fg(THEME.info)),
                Span::styled(
                    "to keep the TUI running and interactively explore the results.",
                    Style::default().fg(THEME.secondary_fg),
                ),
            ]));
            content.push(Line::from(""));
            content.push(Line::from(vec![
                Span::styled(
                    "• Learn how to configure auto-exit and more in the docs: ",
                    Style::default().fg(THEME.secondary_fg),
                ),
                Span::styled(
                    "https://nx.dev/terminal-ui",
                    Style::default().fg(THEME.info),
                ),
            ]));
        }

        // Size the popup to fit the content. Derive the inner width from a
        // matching chrome block so it tracks the real inner_area width used below
        // rather than hard-coding the padding arithmetic. Vertical chrome (2
        // border + 2 padding rows) is added back as +4; overflow scrolls.
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

        // Center the popup within the safe area.
        let popup_x = safe_area.x + (safe_area.width.saturating_sub(popup_width)) / 2;
        let popup_y = safe_area.y + (safe_area.height.saturating_sub(popup_height)) / 2;

        let popup_area = Rect::new(popup_x, popup_y, popup_width, popup_height);

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

        // Title: with a report, "Performance Report" plus "— exiting in N..."
        // while the countdown runs (dropped once pinned); without one, just
        // "Exiting in N...".
        let mut title_spans = vec![
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
            title_spans.push(Span::styled(
                "  Performance Report  ",
                Style::default().fg(THEME.primary_fg),
            ));
            if !self.pinned {
                title_spans.push(Span::styled(
                    "— exiting in ",
                    Style::default().fg(THEME.primary_fg),
                ));
                title_spans.push(Span::styled(
                    format!("{}", time_remaining),
                    Style::default().fg(THEME.info),
                ));
                title_spans.push(Span::styled("...  ", Style::default().fg(THEME.primary_fg)));
            }
        } else {
            title_spans.push(Span::styled(
                "  Exiting in ",
                Style::default().fg(THEME.primary_fg),
            ));
            title_spans.push(Span::styled(
                format!("{}", time_remaining),
                Style::default().fg(THEME.info),
            ));
            title_spans.push(Span::styled("...  ", Style::default().fg(THEME.primary_fg)));
        }

        let mut block = Block::default()
            .title(Line::from(title_spans))
            .title_alignment(Alignment::Left)
            .title_top(
                Line::from(vec![
                    Span::styled(" (esc) ", Style::default().fg(THEME.secondary_fg)),
                    Span::styled("✕  ", Style::default().fg(THEME.info)),
                ])
                .alignment(Alignment::Right),
            )
            .borders(Borders::ALL)
            .border_type(BorderType::Plain)
            .border_style(Style::default().fg(THEME.info))
            .padding(Padding::proportional(1));

        // Keybinding actions in the bottom border — only with a report, where
        // there's a pane to reopen and possibly scroll. Scroll is offered only
        // when the report overflows.
        if has_report {
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
            block = block.title_bottom(Line::from(footer).alignment(Alignment::Right));
        }

        let inner_area = block.inner(popup_area);
        self.viewport_height = inner_area.height as usize;

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

        // Turn the report's links into real OSC 8 hyperlinks. ratatui's text path
        // can't carry them — the ESC/BEL framing is filtered out of cells
        // (ratatui#1028) — so inject_osc8 locates and replaces them in the buffer.
        if url_line_index.is_some() {
            if let Some(s) = self.summary.as_ref() {
                // The docs footer link, then any recommendation phrases (e.g. the
                // remote-cache CTA spanning multiple wrapped rows). All labels and
                // hrefs come from the payload; a phrase not shown isn't found.
                inject_osc8(f, inner_area, &s.footer.text, &s.footer.href);
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

    // The footer + remote-cache link text/hrefs the payload carries (built in TS);
    // the popup must render and hyperlink exactly these.
    const FOOTER_LABEL: &str = "Learn how to improve your run's performance";
    const FOOTER_HREF: &str = "https://nx.dev/docs/concepts/ci-concepts/parallelization-distribution?utm=performance-report";
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
            footer: Link {
                text: FOOTER_LABEL.to_string(),
                href: FOOTER_HREF.to_string(),
            },
            links: Vec::new(),
        }
    }

    // Kept in lockstep with the TS formatDuration; drift would make the popup and
    // the terminal report disagree.
    #[test]
    fn format_duration_matches_ts() {
        assert_eq!(format_duration(470.0), "470ms");
        assert_eq!(format_duration(999.0), "999ms");
        assert_eq!(format_duration(1000.0), "1.0s");
        assert_eq!(format_duration(1500.0), "1.5s");
        assert_eq!(format_duration(9999.0), "10.0s");
        assert_eq!(format_duration(10000.0), "10.0s");
        assert_eq!(format_duration(59950.0), "1m 0s");
        assert_eq!(format_duration(60000.0), "1m 0s");
        assert_eq!(format_duration(90000.0), "1m 30s");
        assert_eq!(format_duration(119500.0), "2m 0s");
    }

    #[test]
    fn pluralize_matches_ts() {
        assert_eq!(pluralize(0, "task"), "tasks");
        assert_eq!(pluralize(1, "task"), "task");
        assert_eq!(pluralize(2, "task"), "tasks");
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

    #[test]
    fn osc8_link_lands_on_the_url_line_even_when_a_prior_rec_wraps() {
        // A long recommendation wrapping to several rows sits right before the
        // docs-link line. The OSC 8 escape must land on the link line (word-wrap
        // aware), not on a wrapped tail of the recommendation as a character-wrap
        // estimate did.
        let long_rec = "You're at this machine's 8 cores and tasks are still \
            queuing for a slot. If they're CPU-bound, distribute across machines \
            with Nx Agents → https://nx.dev/ci/features/distribute-task-execution; \
            if they're I/O-bound, a higher --parallel may help instead."
            .to_string();
        let mut popup = CountdownPopup::new();
        popup.set_summary(summary_with(vec![long_rec]));

        let mut terminal = Terminal::new(TestBackend::new(74, 60)).unwrap();
        terminal
            .draw(|f| {
                let area = f.area();
                popup.render(f, area);
            })
            .unwrap();

        let buffer = terminal.backend().buffer().clone();
        // Exactly one cell carries the OSC 8 sequence.
        let mut escape: Option<(u16, u16)> = None;
        for y in 0..buffer.area.height {
            for x in 0..buffer.area.width {
                if let Some(cell) = buffer.cell((x, y)) {
                    if cell.symbol().contains("\x1b]8;;") {
                        assert!(escape.is_none(), "more than one OSC 8 cell injected");
                        escape = Some((x, y));
                    }
                }
            }
        }
        let (x, y) = escape.expect("OSC 8 link cell should be injected");
        let sym = buffer.cell((x, y)).unwrap().symbol();
        assert!(sym.contains(FOOTER_HREF), "link target missing");
        assert!(sym.contains(FOOTER_LABEL), "link label missing");
        // It sits right after the "- " bullet, not inside a recommendation row.
        assert_eq!(buffer.cell((x - 2, y)).unwrap().symbol(), "-");
        assert_eq!(buffer.cell((x - 1, y)).unwrap().symbol(), " ");
        // Regression check: the label must NOT remain as plain text anywhere (the
        // ForcedWidth escape cell replaces it). The misplaced-link bug left the
        // label drawn plainly on the real link row.
        for yy in 0..buffer.area.height {
            let mut text = String::new();
            for xx in 0..buffer.area.width {
                let s = buffer.cell((xx, yy)).unwrap().symbol();
                // Mask the escape cell so its embedded label isn't counted.
                text.push_str(if s.contains('\x1b') { "\u{0}" } else { s });
            }
            assert!(
                !text.contains(FOOTER_LABEL),
                "label left as plain text on row {yy} — link misplaced"
            );
        }
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
                    assert!(
                        sym.contains(CACHE_HREF) || sym.contains(FOOTER_HREF),
                        "unexpected OSC 8 target"
                    );
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
