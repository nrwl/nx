use color_eyre::eyre::Result;
use ratatui::{
    Frame,
    layout::{Alignment, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{
        Block, BorderType, Borders, Clear, Padding, Scrollbar, ScrollbarOrientation,
        ScrollbarState, Wrap,
    },
};
use std::any::Any;
use std::time::{Duration, Instant};

use crate::native::tui::lifecycle::{
    CloudConnection, Link as SummaryLink, PerformanceSummaryPayload,
};
use crate::native::tui::theme::THEME;
use crate::native::tui::utils::{format_duration, pluralize};

use super::connect_flow::{CONNECT_CTA_HREF, ConnectFlowState, cta_spans};
use super::link::{Link, LinkRegistry};
use super::nx_paragraph::{NxLine, NxParagraph, NxSpan, NxText};
use super::{Component, ModalPopup};

/// Convert a styled line into an `NxLine`, turning any occurrence of a known
/// link phrase into a clickable [`Link`]. Replaces the old buffer-scanning OSC 8
/// injection: the link's rendered position now falls out of `NxParagraph`'s
/// placement instead of being recovered after the fact.
fn linkify_line(line: Line<'static>, links: &[SummaryLink]) -> NxLine {
    let mut out: Vec<NxSpan> = Vec::new();
    for span in line.spans {
        linkify_span(span, links, &mut out);
    }
    NxLine::from_spans(out)
}

fn linkify_span(span: Span<'static>, links: &[SummaryLink], out: &mut Vec<NxSpan>) {
    let style = span.style;
    let content = span.content.into_owned();
    let mut rest = content.as_str();
    loop {
        // Earliest occurrence of any link phrase in the remaining text.
        let next = links
            .iter()
            .filter(|l| !l.text.is_empty())
            .filter_map(|l| rest.find(l.text.as_str()).map(|idx| (idx, l)))
            .min_by_key(|(idx, _)| *idx);
        match next {
            Some((idx, link)) => {
                if idx > 0 {
                    out.push(NxSpan::Text(Span::styled(rest[..idx].to_string(), style)));
                }
                out.push(NxSpan::Link(Link::new(
                    link.text.clone(),
                    link.href.clone(),
                )));
                rest = &rest[idx + link.text.len()..];
                if rest.is_empty() {
                    return;
                }
            }
            None => {
                if !rest.is_empty() {
                    out.push(NxSpan::Text(Span::styled(rest.to_string(), style)));
                }
                return;
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
    /// Clickable report links recorded during render; the app hit-tests these
    /// (via the modal mouse path) to open them.
    link_registry: LinkRegistry,
    /// `NotConnected` is what makes the report offer remote caching.
    cloud_connection: CloudConnection,
    /// State of the connect attempt started from this report.
    connect_state: ConnectFlowState,
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
            link_registry: LinkRegistry::new(),
            cloud_connection: CloudConnection::Disabled,
            connect_state: ConnectFlowState::default(),
        }
    }

    pub fn set_cloud_connection(&mut self, status: CloudConnection) {
        self.cloud_connection = status;
    }

    pub fn set_connect_state(&mut self, state: ConnectFlowState) {
        self.connect_state = state;
    }

    /// Whether the connect shortcut should start a (new) attempt from here:
    /// the workspace is not connected yet, and nothing is in flight (an error
    /// allows a retry; a ready URL is only displayed).
    pub fn should_start_connect(&self) -> bool {
        matches!(self.cloud_connection, CloudConnection::NotConnected)
            && self.connect_state.needs_attempt()
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
        if self.visible { self.last_area } else { None }
    }

    /// The inner text area drawn last frame, if visible.
    pub fn content_area(&self) -> Option<Rect> {
        if self.visible {
            self.content_area
        } else {
            None
        }
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

    /// Report-mode content: the report body, then the "longest tasks" rec so its
    /// list ends the popup. The recommendation phrases in `links` become clickable
    /// via `linkify_line` at render.
    fn report_mode_content(&self, mut content: Vec<Line<'static>>) -> Vec<Line<'static>> {
        content.extend(self.longest_tasks_lines());
        content
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
            spans.push(Span::styled("...", Style::default().fg(THEME.primary_fg)));
        }
        spans.push(Span::raw("  "));
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
        let content = if has_report {
            self.report_mode_content(report)
        } else {
            Self::exit_dialog_content()
        };

        // Turn the recommendation phrases into clickable links, then lay the report
        // out through NxParagraph so each link's rect is recorded.
        self.link_registry.clear();
        let all_links: Vec<SummaryLink> = self
            .summary
            .as_ref()
            .map(|s| s.links.clone())
            .unwrap_or_default();
        let nx_content: NxText = content
            .into_iter()
            .map(|line| linkify_line(line, &all_links))
            .collect::<Vec<NxLine>>()
            .into();

        // Connect-attempt progress/result, rendered under a divider at the
        // bottom of the popup. Kept visible after the status flips to connected
        // — the user still needs the URL to finish onboarding in the browser.
        let connect_line = has_report
            .then(|| self.connect_state.inline_line())
            .flatten();

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
        // The connect hint doubles as a clickable call-to-action; its width is
        // captured so its rendered rect can be registered for hit-testing.
        let mut connect_hint_width: Option<u16> = None;
        let bottom_hints: Option<Vec<Span>> = if has_report {
            let mut footer = vec![Span::raw("  ")];
            if self.should_start_connect() {
                let hint = cta_spans("enable remote cache: ");
                connect_hint_width = Some(hint.iter().map(|s| s.width() as u16).sum());
                footer.extend(hint);
                footer.push(Span::raw("   "));
            }
            footer.extend([
                Span::styled("quit: ", Style::default().fg(THEME.secondary_fg)),
                Span::styled("q", Style::default().fg(THEME.info)),
                Span::styled(
                    "   reopen report: ",
                    Style::default().fg(THEME.secondary_fg),
                ),
                Span::styled("p", Style::default().fg(THEME.info)),
            ]);
            // The scroll hint yields to the connect hint: with both, the footer
            // exceeds the 70-column popup cap and ratatui left-truncates the
            // row. Scrolling still works; the hint returns once an attempt
            // starts.
            if self.is_scrollable() && connect_hint_width.is_none() {
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
        let content_width = nx_content
            .max_width()
            .max(connect_line.as_ref().map(|l| l.width()).unwrap_or(0));
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
        let estimated_rows = nx_content.wrapped_rows(inner_width, false);
        // Rows reserved at the bottom of the inner area for the connect
        // progress/URL line, plus a divider row and a blank row above it.
        let connect_rows: u16 = connect_line
            .as_ref()
            .map(|line| {
                let text: NxText = vec![line.clone()].into();
                text.wrapped_rows(inner_width, false).max(1) as u16 + 2
            })
            .unwrap_or(0);
        let popup_height = ((estimated_rows as u16)
            .saturating_add(connect_rows)
            .saturating_add(4))
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
        // Record the inner text area so the app can bound selection/link
        // hit-tests. It sits inside the border + padding, so it never includes
        // the scrollbar (drawn on the far-right border column).
        self.content_area = Some(inner_area);

        // Split the bottom rows off for the connect line; the report scrolls
        // within what remains.
        let report_area = Rect {
            height: inner_area.height.saturating_sub(connect_rows),
            ..inner_area
        };
        let connect_area = Rect {
            y: inner_area.y + report_area.height,
            height: connect_rows,
            ..inner_area
        }
        // On a tiny terminal the clamped popup may not fit the reserved rows.
        .intersection(inner_area);
        self.viewport_height = report_area.height as usize;

        // Content height in wrapped rows, driving the scrollbar and the scroll
        // bound in scroll_down.
        self.content_height = nx_content.wrapped_rows(report_area.width, false);

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
        let popup = NxParagraph::new(nx_content)
            // trim: false preserves leading whitespace so the report's
            // indentation renders.
            .wrap(Wrap { trim: false })
            .scroll((self.scroll_offset as u16, 0));

        f.render_widget(Clear, popup_area);
        // The chrome is drawn on its own so the report can be confined to the
        // rows above the connect line rather than the whole inner area.
        f.render_widget(block.clone(), popup_area);
        // NxParagraph records each rendered link's rect into the registry, which
        // the app's modal mouse handler hit-tests to open it.
        f.render_stateful_widget(popup, report_area, &mut self.link_registry);

        if let Some(line) = connect_line
            && connect_area.height >= 2
        {
            let divider = Rect {
                y: connect_area.y + 1,
                height: 1,
                ..connect_area
            };
            f.render_widget(
                NxParagraph::new(Line::from(Span::styled(
                    "─".repeat(divider.width as usize),
                    Style::default().fg(THEME.secondary_fg).dim(),
                ))),
                divider,
            );
            let text_area = Rect {
                y: connect_area.y + 2,
                height: connect_area.height.saturating_sub(2),
                ..connect_area
            };
            if text_area.height > 0 {
                let text: NxText = vec![line].into();
                f.render_stateful_widget(
                    NxParagraph::new(text)
                        .alignment(Alignment::Center)
                        .wrap(Wrap { trim: false }),
                    text_area,
                    &mut self.link_registry,
                );
            }
        }

        // Make the footer's connect hint clickable. The bottom title is
        // right-aligned within the borders, and the hint sits just after its
        // two leading spaces.
        if let Some(width) = connect_hint_width {
            let footer_start = popup_area.right().saturating_sub(1 + bottom_width);
            self.link_registry.push(
                Rect {
                    x: footer_start.saturating_add(2),
                    y: popup_area.bottom().saturating_sub(1),
                    width,
                    height: 1,
                },
                CONNECT_CTA_HREF.to_string(),
            );
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
                NxParagraph::new(top_text)
                    .alignment(Alignment::Right)
                    .style(Style::default().fg(THEME.info)),
                top_right_area,
            );

            f.render_widget(
                NxParagraph::new(bottom_text)
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

impl ModalPopup for CountdownPopup {
    fn is_visible(&self) -> bool {
        CountdownPopup::is_visible(self)
    }

    fn last_area(&self) -> Option<Rect> {
        CountdownPopup::last_area(self)
    }

    fn content_area(&self) -> Option<Rect> {
        CountdownPopup::content_area(self)
    }
}

impl Component for CountdownPopup {
    fn draw(&mut self, f: &mut Frame<'_>, rect: Rect) -> Result<()> {
        if self.visible {
            self.render(f, rect);
        } else {
            self.last_area = None;
            self.content_area = None;
            self.link_registry.clear();
        }
        Ok(())
    }

    fn link_registry(&self) -> Option<&LinkRegistry> {
        Some(&self.link_registry)
    }

    fn link_registry_mut(&mut self) -> Option<&mut LinkRegistry> {
        Some(&mut self.link_registry)
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
    const CACHE_HREF: &str = "https://nx.dev/ci/features/remote-cache?utm_source=nx-cli&utm_medium=cli&utm_campaign=performance-report&utm_content=remote-cache";

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

    /// A report popup for a workspace that is not connected to Nx Cloud.
    fn disconnected_report() -> CountdownPopup {
        let mut popup = CountdownPopup::new();
        popup.set_summary(summary_with(vec![]));
        popup.set_cloud_connection(CloudConnection::NotConnected);
        popup
    }

    #[test]
    fn report_offers_the_connect_shortcut_while_disconnected() {
        let mut popup = disconnected_report();
        let text = render_to_string(&mut popup);
        assert!(
            text.contains("enable remote cache: <shift>+c"),
            "got: {text}"
        );
    }

    #[test]
    fn report_hides_the_connect_shortcut_once_connected() {
        let mut popup = CountdownPopup::new();
        popup.set_summary(summary_with(vec![]));
        popup.set_cloud_connection(CloudConnection::Connected);
        let text = render_to_string(&mut popup);
        assert!(!text.contains("<shift>+c"), "got: {text}");
    }

    #[test]
    fn report_renders_the_connect_url_inline() {
        let mut popup = disconnected_report();
        popup.set_connect_state(ConnectFlowState::Ready("https://nx.app/c/abc".to_string()));
        let text = render_to_string(&mut popup);
        assert!(text.contains("Finish your setup:"), "got: {text}");
        assert!(text.contains("https://nx.app/c/abc"), "got: {text}");
        // An attempt is done, so the shortcut is no longer advertised.
        assert!(!text.contains("<shift>+c"), "got: {text}");
    }

    #[test]
    fn report_connect_hint_is_clickable() {
        let mut popup = disconnected_report();
        let mut terminal = Terminal::new(TestBackend::new(74, 60)).unwrap();
        terminal
            .draw(|f| {
                let area = f.area();
                popup.render(f, area);
            })
            .unwrap();
        let buffer = terminal.backend().buffer().clone();
        let registry = popup
            .link_registry()
            .expect("countdown exposes a link registry");
        // Find the rendered hint and hit-test its first cell.
        let (x, y) = (0..buffer.area.height)
            .find_map(|y| {
                let row: String = (0..buffer.area.width)
                    .map(|x| buffer.cell((x, y)).unwrap().symbol().to_string())
                    .collect();
                row.find("enable remote cache: ").map(|x| (x as u16, y))
            })
            .expect("connect hint is rendered");
        assert_eq!(registry.hit_test(x, y), Some(CONNECT_CTA_HREF));
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

        let registry = popup
            .link_registry()
            .expect("countdown exposes a link registry");
        // The cache phrase wraps to multiple rows; it must be clickable on every
        // one of them (a rect was recorded per wrapped row).
        let mut hit_rows: Vec<u16> = (0..buffer.area.height)
            .flat_map(|y| (0..buffer.area.width).map(move |x| (x, y)))
            .filter(|&(x, y)| registry.hit_test(x, y) == Some(CACHE_HREF))
            .map(|(_, y)| y)
            .collect();
        hit_rows.sort_unstable();
        hit_rows.dedup();
        assert!(
            hit_rows.len() >= 2,
            "the wrapped cache phrase should be clickable on each of its rows"
        );

        // The raw URL is never visible (the phrase is the display text).
        let visible: String = (0..buffer.area.height)
            .flat_map(|y| (0..buffer.area.width).map(move |x| (x, y)))
            .map(|(x, y)| buffer.cell((x, y)).unwrap().symbol().to_string())
            .collect();
        assert!(
            !visible.contains("https://nx.dev/ci/features/remote-cache"),
            "raw remote-cache URL must not be visible"
        );
    }
}
