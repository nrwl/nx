use color_eyre::eyre::Result;
use ratatui::{
    Frame,
    buffer::CellDiffOption,
    layout::{Alignment, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{
        Block, BorderType, Borders, Clear, Padding, Paragraph, Scrollbar, ScrollbarOrientation,
        ScrollbarState,
    },
};
use std::any::Any;
use std::num::NonZeroU16;
use std::time::{Duration, Instant};

use crate::native::tui::lifecycle::ThrottleExitSummary;
use crate::native::tui::theme::THEME;

use super::Component;

/// The docs link shown at the bottom of the report. OSC 8 lets the visible text
/// be a short human label while the link points at the full URL — so we show the
/// sentence (not the raw URL) and hide the href behind it (see the OSC 8 injection
/// in `render`). The bullet prefix is not part of the clickable link — it uses
/// the same "- " marker as the recommendation items, since this link is itself a
/// (generic) recommendation.
const PERF_URL_BULLET: &str = "- ";
const PERF_URL_LABEL: &str = "Learn how to improve your run's performance";
// Clickable target carries a utm tag to attribute traffic to this report; the
// visible label (PERF_URL_LABEL) stays clean.
const PERF_URL_HREF: &str =
    "https://nx.dev/docs/concepts/ci-concepts/parallelization-distribution?utm=performance-report";

/// Format a millisecond duration like the TS `formatDuration` (e.g. "470ms",
/// "13.4s", "1m 30s"), so the popup matches the terminal report.
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

/// The cache stat label from the counts, or None when there's nothing to show
/// (mirrors the TS `cacheStat`).
fn cache_label(s: &ThrottleExitSummary) -> Option<String> {
    if s.cache_skipped {
        return Some("Skipped (--skip-nx-cache)".to_string());
    }
    match (s.cache_hits, s.cacheable_count) {
        (Some(hits), Some(total)) if total > 0 => {
            let pct = (hits as f64 / total as f64 * 100.0).round() as i64;
            Some(format!("{hits}/{total} hit ({pct}%)"))
        }
        _ => None,
    }
}

/// A stat row — left-aligned label (padded), then the value. No leading indent:
/// the popup's border + padding already provide the margin.
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
    summary: Option<ThrottleExitSummary>,
    /// When pinned, the auto-exit countdown is stopped and the popup stays open
    /// (e.g. the user scrolled the report) until they explicitly quit.
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

    /// Set the run report shown above the hint text. The visual is built from
    /// these stats in {@link build_report_lines}.
    pub fn set_summary(&mut self, summary: ThrottleExitSummary) {
        self.summary = Some(summary);
    }

    /// Build the styled report lines (header stats, cache, recommendations) from
    /// the structured summary — the native equivalent of the TS `formatReport`.
    fn build_report_lines(&self) -> Vec<Line<'static>> {
        let Some(s) = self.summary.as_ref() else {
            return Vec::new();
        };
        let mut lines: Vec<Line<'static>> = Vec::new();

        lines.push(stat_line(
            "Run duration",
            format_duration(s.run_duration_ms),
        ));
        // Cache sits right under run duration (same section): the report is short
        // enough that a separate cache section just looked stranded.
        if let Some(cache) = cache_label(s) {
            lines.push(stat_line("Cache", cache));
        }
        lines.push(stat_line(
            "Critical path",
            format!(
                "{}   ({} tasks)",
                format_duration(s.critical_path_ms),
                s.critical_path_task_count
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

        // Recommendations. The header is always shown because the docs link that
        // `render` adds below is itself a (generic) recommendation. Only the
        // single-line, actionable levers (parallelism/cache/agents) go here; the
        // multi-line "speed up the longest tasks" rec is rendered LAST — after the
        // link — by `longest_tasks_lines`, so its task list ends the report.
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

    /// The "speed up / split the longest tasks" recommendation — the one multi-line
    /// rec, which embeds the task list. Rendered LAST in the report (after the docs
    /// link) so the detailed task list ends it. Empty when there's no such rec.
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
                // rest already carries its own 2-space indent from
                // formatTopTaskRows; add 2 more so it nests under the bullet.
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

    /// Stop the auto-exit countdown but keep the popup open. Used when the user
    /// interacts with the report (e.g. scrolls) so it doesn't close while reading.
    pub fn pin_open(&mut self) {
        self.pinned = true;
    }

    /// Whether the countdown has been cancelled (popup is staying open).
    pub fn is_pinned(&self) -> bool {
        self.pinned
    }

    /// Whether a run report has been set (i.e. the run has finished and there's
    /// something to show). Used to gate the "reopen report" key.
    pub fn has_summary(&self) -> bool {
        self.summary.is_some()
    }

    /// Re-open the report popup on demand, with no countdown — e.g. the user
    /// pressed a key to bring it back while exploring the TUI after the run.
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
            // Update scrollbar state with new position
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
            // Update scrollbar state with new position
            self.scrollbar_state = self
                .scrollbar_state
                .content_length(self.content_height)
                .viewport_content_length(self.viewport_height)
                .position(self.scroll_offset);
        }
    }

    pub fn render(&mut self, f: &mut Frame<'_>, area: Rect) {
        // Add a safety check to prevent rendering outside buffer bounds (this can happen if the user resizes the window a lot before it stabilizes it seems)
        if area.height == 0
            || area.width == 0
            || area.x >= f.area().width
            || area.y >= f.area().height
        {
            return; // Area is out of bounds, don't try to render
        }

        // Ensure area is entirely within frame bounds
        let safe_area = Rect {
            x: area.x,
            y: area.y,
            width: area.width.min(f.area().width.saturating_sub(area.x)),
            height: area.height.min(f.area().height.saturating_sub(area.y)),
        };

        let popup_width: u16 = 70;
        let popup_width = popup_width.min(safe_area.width.saturating_sub(4));

        // Two modes. With a report (run finished) → the Performance Report: the
        // stats + a docs link, with the keybinding actions in the bottom border.
        // Without one (e.g. the user pressed q mid-run, before the report exists) →
        // the original exit dialog: just the interactive hints.
        let mut content: Vec<Line> = Vec::new();
        // Index of the URL line within `content`, so we can turn it into a real
        // OSC 8 hyperlink after the Paragraph lays it out (see below).
        let mut url_line_index: Option<usize> = None;
        let report = self.build_report_lines();
        let has_report = !report.is_empty();
        if has_report {
            content.extend(report);
            // The docs link is a generic recommendation, rendered as a "- " item
            // directly under the same "Recommendations:" header (no blank line).
            // A non-linked bullet prefix, then the label which the OSC 8 injection
            // below turns into a clickable hyperlink. If injection is skipped (e.g.
            // the popup is too narrow for the label), this stays as plain text.
            url_line_index = Some(content.len());
            content.push(Line::from(vec![
                Span::styled(PERF_URL_BULLET, Style::default().fg(THEME.secondary_fg)),
                Span::styled(PERF_URL_LABEL, Style::default().fg(THEME.info)),
            ]));
            // The detailed "speed up the longest tasks" rec goes LAST, so its task
            // list ends the report.
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

        // Size the popup to fit the content. Chrome = 2 border rows + 2 padding
        // rows (Padding::proportional(1)). Estimate wrapped rows using the inner
        // width so a long report gets a taller popup; overflow scrolls.
        let inner_width = popup_width.saturating_sub(4).max(1);
        let estimated_rows: usize = content
            .iter()
            .map(|line| {
                let line_width = line.width() as u16;
                if line_width == 0 {
                    1
                } else {
                    (line_width.saturating_sub(1) / inner_width).saturating_add(1) as usize
                }
            })
            .sum();
        let popup_height = ((estimated_rows as u16).saturating_add(4))
            .min(safe_area.height.saturating_sub(4))
            .max(5);

        // Calculate the top-left position to center the popup
        let popup_x = safe_area.x + (safe_area.width.saturating_sub(popup_width)) / 2;
        let popup_y = safe_area.y + (safe_area.height.saturating_sub(popup_height)) / 2;

        // Create popup area
        let popup_area = Rect::new(popup_x, popup_y, popup_width, popup_height);

        // Calculate seconds remaining
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

        // Title. With a report it names the dialog ("Performance Report"); while
        // the auto-exit countdown runs it adds "— exiting in N..." (dropped once
        // pinned). Without a report (mid-run quit) it's the original countdown
        // dialog: just "Exiting in N...".
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

        // Keybinding actions in the bottom border (help-bar style, like the
        // terminal pane) — only with a report, where there's a pane to reopen and
        // possibly scroll. Scroll is offered only when the report overflows.
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

        // Get the inner area
        let inner_area = block.inner(popup_area);
        self.viewport_height = inner_area.height as usize;

        // Calculate content height based on line wrapping
        let wrapped_height = content
            .iter()
            .map(|line| {
                let line_width = line.width() as u16;
                if line_width == 0 {
                    1 // Empty lines still take up one row
                } else {
                    (line_width.saturating_sub(1) / inner_area.width).saturating_add(1) as usize
                }
            })
            .sum();
        self.content_height = wrapped_height;

        // Calculate scrollbar state
        let scrollable_rows = self.content_height.saturating_sub(self.viewport_height);
        let needs_scrollbar = scrollable_rows > 0;

        // Update scrollbar state
        self.scrollbar_state = if needs_scrollbar {
            self.scrollbar_state
                .content_length(scrollable_rows)
                .viewport_content_length(self.viewport_height)
                .position(self.scroll_offset)
        } else {
            ScrollbarState::default()
        };

        // Create scrollable paragraph
        let scroll_start = self.scroll_offset;
        let scroll_end = (self.scroll_offset + self.viewport_height).min(content.len());
        let visible_content = content[scroll_start..scroll_end].to_vec();

        let popup = Paragraph::new(visible_content)
            .block(block.clone())
            // trim: false preserves leading whitespace so the report's indentation
            // (e.g. the longest-tasks list nested under its recommendation) renders.
            .wrap(ratatui::widgets::Wrap { trim: false });

        // Render popup
        f.render_widget(Clear, popup_area);
        f.render_widget(popup, popup_area);

        // Turn the docs URL into a real OSC 8 hyperlink. ratatui's normal text
        // path can't carry it: control bytes (the ESC/BEL framing of an OSC 8
        // sequence) are filtered out of cells, so the escape never reaches the
        // terminal (ratatui#1028). The workaround is to write the whole sequence
        // straight into the line's first cell and use CellDiffOption::ForcedWidth
        // to tell the diff/cursor that the cell really spans the VISIBLE text's
        // width — so layout and diffing stay aligned. Requires ratatui-core >=
        // 0.1.2. The visible glyphs equal the plain fallback text, so when the
        // line scrolls the buffer↔terminal stay consistent.
        if let Some(url_index) = url_line_index {
            let inner_width = inner_area.width;
            let bullet_width = PERF_URL_BULLET.chars().count() as u16;
            let visible_width = PERF_URL_LABEL.chars().count() as u16;
            // Single-cell hyperlink only works when the label fits one row after the
            // bullet; otherwise fall back to the plain text the Paragraph drew.
            if url_index >= scroll_start
                && url_index < scroll_end
                && visible_width > 0
                && bullet_width.saturating_add(visible_width) <= inner_width
            {
                // Screen row where the Paragraph placed the label line: the inner-area
                // top plus the wrapped height of every visible line before it.
                let mut row = inner_area.y;
                for line in &content[scroll_start..url_index] {
                    let line_width = line.width() as u16;
                    let rows = if line_width == 0 {
                        1
                    } else {
                        (line_width.saturating_sub(1) / inner_width).saturating_add(1)
                    };
                    row = row.saturating_add(rows);
                }
                // Only inject when the line is actually within the visible viewport.
                if row < inner_area.y.saturating_add(inner_area.height) {
                    let seq = format!("\x1b]8;;{PERF_URL_HREF}\x07{PERF_URL_LABEL}\x1b]8;;\x07");
                    // The link starts after the (non-linked) bullet prefix.
                    let col = inner_area.x.saturating_add(bullet_width);
                    if let Some(cell) = f.buffer_mut().cell_mut((col, row)) {
                        cell.set_symbol(&seq);
                        cell.set_style(Style::default().fg(THEME.info));
                        cell.set_diff_option(CellDiffOption::ForcedWidth(
                            NonZeroU16::new(visible_width).unwrap(),
                        ));
                    }
                }
            }
        }

        // Render scrollbar if needed
        if needs_scrollbar {
            // Add padding text at top and bottom of scrollbar
            let top_text = Line::from(vec![Span::raw("  ")]);
            let bottom_text = Line::from(vec![Span::raw("  ")]);

            let text_width = 2; // Width of "  "

            // Top right padding
            let top_right_area = Rect {
                x: popup_area.x + popup_area.width - text_width as u16 - 3,
                y: popup_area.y,
                width: text_width as u16 + 2,
                height: 1,
            };

            // Bottom right padding
            let bottom_right_area = Rect {
                x: popup_area.x + popup_area.width - text_width as u16 - 3,
                y: popup_area.y + popup_area.height - 1,
                width: text_width as u16 + 2,
                height: 1,
            };

            // Render padding text
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
