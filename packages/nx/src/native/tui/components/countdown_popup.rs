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
    CloudConnectionStatus, Link as SummaryLink, PerformanceSummaryPayload,
};
use crate::native::tui::theme::THEME;
use crate::native::tui::utils::{format_duration, pluralize};

use super::Component;
use super::link::{Link, LinkRegistry};
use super::nx_paragraph::{NxLine, NxParagraph, NxSpan, NxText};

/// Sentinel `href` for the "Enable remote cache" button. It is registered in
/// the link registry like a real link (so its rendered rect is hit-testable),
/// but the app intercepts it and starts the connect flow instead of opening a
/// browser.
pub const CONNECT_BUTTON_HREF: &str = "nx-tui://enable-remote-cache";

/// Display text of the inline "Enable remote cache" button.
const CONNECT_BUTTON_LABEL: &str = "[ Enable remote cache ]";

/// State of the TUI-initiated connect attempt kicked off from the report's
/// "Enable remote cache" affordances. Persisted in `TuiState` so it survives
/// mode switches (both apps re-hydrate their popup from there).
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum CloudConnectState {
    /// No connect attempt has been made yet.
    #[default]
    NotStarted,
    /// JS is creating the workspace / generating the onboarding URL.
    Loading,
    /// The onboarding URL is ready to follow.
    Ready(String),
    /// The connect attempt failed (e.g. offline, missing git remote).
    Error(String),
}

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
    /// Nx Cloud connection status; `Some(NotConnected)` enables the
    /// "Enable remote cache" button and footer hint. `None` = cloud disabled.
    cloud_connection_status: Option<CloudConnectionStatus>,
    /// State of the connect attempt started from this popup.
    connect_state: CloudConnectState,
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
            cloud_connection_status: None,
            connect_state: CloudConnectState::default(),
        }
    }

    /// Set the run report shown above the hint text.
    pub fn set_summary(&mut self, summary: PerformanceSummaryPayload) {
        self.summary = Some(summary);
    }

    pub fn set_cloud_connection_status(&mut self, status: Option<CloudConnectionStatus>) {
        self.cloud_connection_status = status;
    }

    pub fn set_connect_state(&mut self, state: CloudConnectState) {
        self.connect_state = state;
    }

    pub fn connect_state(&self) -> &CloudConnectState {
        &self.connect_state
    }

    /// Whether the enable-remote-cache affordances apply at all: only while the
    /// workspace is not connected to Nx Cloud.
    pub fn can_connect_to_cloud(&self) -> bool {
        matches!(
            self.cloud_connection_status,
            Some(CloudConnectionStatus::NotConnected)
        )
    }

    /// Whether pressing the connect shortcut should start a (new) attempt: the
    /// affordance is live and there is no attempt in flight or completed (an
    /// `Error` allows a retry; a `Ready` URL is just displayed).
    pub fn should_start_connect(&self) -> bool {
        self.can_connect_to_cloud()
            && matches!(
                self.connect_state,
                CloudConnectState::NotStarted | CloudConnectState::Error(_)
            )
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
        let mut content = if has_report {
            self.report_mode_content(report)
        } else {
            Self::exit_dialog_content()
        };

        // Turn the recommendation phrases into clickable links, then lay the report
        // out through NxParagraph so each link's rect is recorded.
        self.link_registry.clear();
        let mut all_links: Vec<SummaryLink> = self
            .summary
            .as_ref()
            .map(|s| s.links.clone())
            .unwrap_or_default();

        // "Enable remote cache" button: appended inline right after the
        // remote-cache recommendation, only while the workspace is not
        // connected and no connect attempt has been made yet. It is a synthetic
        // link with a sentinel href that the app intercepts to start the
        // connect flow (linkify below turns it into a clickable rect).
        let show_connect_button = has_report
            && self.can_connect_to_cloud()
            && matches!(self.connect_state, CloudConnectState::NotStarted);
        if show_connect_button {
            let cache_link_texts: Vec<String> = all_links
                .iter()
                .filter(|l| l.href.contains("remote-cache"))
                .map(|l| l.text.clone())
                .collect();
            let cache_line = content.iter_mut().find(|line| {
                let raw: String = line
                    .spans
                    .iter()
                    .map(|s| s.content.as_ref())
                    .collect::<String>();
                cache_link_texts.iter().any(|t| raw.contains(t.as_str()))
            });
            if let Some(line) = cache_line {
                line.spans.push(Span::raw(" "));
                line.spans.push(Span::raw(CONNECT_BUTTON_LABEL));
                all_links.push(SummaryLink {
                    text: CONNECT_BUTTON_LABEL.to_string(),
                    href: CONNECT_BUTTON_HREF.to_string(),
                });
            }
        }

        let nx_content: NxText = content
            .into_iter()
            .map(|line| linkify_line(line, &all_links))
            .collect::<Vec<NxLine>>()
            .into();

        // Connect-attempt progress/result, rendered centered at the bottom of
        // the popup above the footer hints. Kept visible even after the status
        // flips to connected (the user still needs the URL to finish
        // onboarding in the browser).
        let connect_line: Option<NxLine> = if has_report {
            match &self.connect_state {
                CloudConnectState::NotStarted => None,
                CloudConnectState::Loading => {
                    Some(NxLine::from_spans(vec![NxSpan::Text(Span::styled(
                        "Generating your Nx Cloud connect URL...".to_string(),
                        Style::default().fg(THEME.secondary_fg),
                    ))]))
                }
                CloudConnectState::Ready(url) => Some(NxLine::from_spans(vec![NxSpan::Link(
                    Link::new(url.clone(), url.clone()),
                )])),
                CloudConnectState::Error(message) => {
                    Some(NxLine::from_spans(vec![NxSpan::Text(Span::styled(
                        format!("Could not connect: {message}"),
                        Style::default().fg(THEME.error),
                    ))]))
                }
            }
        } else {
            None
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
            let mut footer = vec![Span::raw("  ")];
            // Advertise the connect shortcut while it can start an attempt
            // (fresh or retry after an error).
            if self.should_start_connect() {
                footer.push(Span::styled(
                    "Enable remote cache: ",
                    Style::default().fg(THEME.secondary_fg),
                ));
                footer.push(Span::styled("<shift>+c", Style::default().fg(THEME.info)));
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
            // exceeds the 70-col popup cap and ratatui left-truncates the row.
            // Scrolling still works; the hint returns once an attempt starts.
            if self.is_scrollable() && !self.should_start_connect() {
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
        // fixed-width box, while staying wide enough for the title row, the bottom
        // keybindings and the connect URL; cap at 70 so long recommendations still wrap.
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
        // progress/URL line (plus a blank separator row above it).
        let connect_rows: u16 = connect_line
            .as_ref()
            .map(|l| {
                let text: NxText = vec![l.clone()].into();
                text.wrapped_rows(inner_width, false).max(1) as u16 + 1
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
        // Record the inner text area so the app can bound selection/link hit-tests.
        // The text area sits inside the border + padding, so it never includes
        // the scrollbar (drawn on the far-right border column).
        self.content_area = Some(inner_area);

        // Split the bottom rows off for the connect progress/URL line; the
        // report scrolls within what remains.
        let main_area = Rect {
            height: inner_area.height.saturating_sub(connect_rows),
            ..inner_area
        };
        let connect_area = Rect {
            // Skip the blank separator row above the connect line.
            y: inner_area.y + main_area.height + 1,
            height: connect_rows.saturating_sub(1),
            ..inner_area
        }
        // On a tiny terminal the clamped popup may not fit the reserved rows.
        .intersection(inner_area);
        self.viewport_height = main_area.height as usize;

        // Content height in wrapped rows, driving the scrollbar and the scroll
        // bound in scroll_down.
        self.content_height = nx_content.wrapped_rows(main_area.width, false);

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
        //
        // The block (borders + titles) renders over the whole popup; the report
        // paragraph renders into `main_area` so the reserved connect rows stay
        // clear of scrolled content.
        let popup = NxParagraph::new(nx_content)
            // trim: false preserves leading whitespace so the report's
            // indentation renders.
            .wrap(Wrap { trim: false })
            .scroll((self.scroll_offset as u16, 0));

        f.render_widget(Clear, popup_area);
        f.render_widget(block.clone(), popup_area);
        // NxParagraph records each rendered link's rect into the registry, which
        // the app's modal mouse handler hit-tests to open it.
        f.render_stateful_widget(popup, main_area, &mut self.link_registry);

        // The connect progress/URL line, centered above the footer hints.
        if let Some(line) = connect_line
            && connect_area.height > 0
        {
            let connect_paragraph = NxParagraph::new(NxText::from(vec![line]))
                .alignment(Alignment::Center)
                .wrap(Wrap { trim: false });
            f.render_stateful_widget(connect_paragraph, connect_area, &mut self.link_registry);
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

    /// A summary carrying the remote-cache CTA rec + link, as TS builds it.
    fn summary_with_cache_rec() -> PerformanceSummaryPayload {
        let mut s = summary_with(vec![format!("{CACHE_PHRASE}.")]);
        s.links = vec![Link {
            text: CACHE_PHRASE.to_string(),
            href: CACHE_HREF.to_string(),
        }];
        s
    }

    /// Render and return (visible text, clickable hrefs found anywhere).
    fn render_with_registry(popup: &mut CountdownPopup) -> (String, Vec<String>) {
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
        let registry = popup.link_registry().unwrap();
        let mut hrefs: Vec<String> = (0..buffer.area.height)
            .flat_map(|y| (0..buffer.area.width).map(move |x| (x, y)))
            .filter_map(|(x, y)| registry.hit_test(x, y).map(str::to_string))
            .collect();
        hrefs.sort();
        hrefs.dedup();
        (text, hrefs)
    }

    #[test]
    fn shows_connect_button_and_hint_only_when_not_connected() {
        // Not connected: the button follows the cache rec, is clickable via the
        // sentinel href, and the footer advertises the shortcut.
        let mut popup = CountdownPopup::new();
        popup.set_summary(summary_with_cache_rec());
        popup.set_cloud_connection_status(Some(CloudConnectionStatus::NotConnected));
        let (text, hrefs) = render_with_registry(&mut popup);
        assert!(text.contains("[ Enable remote cache ]"));
        assert!(text.contains("Enable remote cache: <shift>+c"));
        assert!(hrefs.iter().any(|h| h == CONNECT_BUTTON_HREF));

        // Connected: neither the button nor the footer hint render.
        let mut popup = CountdownPopup::new();
        popup.set_summary(summary_with_cache_rec());
        popup.set_cloud_connection_status(Some(CloudConnectionStatus::Connected));
        let (text, hrefs) = render_with_registry(&mut popup);
        assert!(!text.contains("[ Enable remote cache ]"));
        assert!(!text.contains("<shift>+c"));
        assert!(!hrefs.iter().any(|h| h == CONNECT_BUTTON_HREF));

        // No status at all (cloud disabled): same as connected.
        let mut popup = CountdownPopup::new();
        popup.set_summary(summary_with_cache_rec());
        let (text, _) = render_with_registry(&mut popup);
        assert!(!text.contains("[ Enable remote cache ]"));
        assert!(!text.contains("<shift>+c"));
    }

    #[test]
    fn footer_hint_shows_even_without_the_cache_rec() {
        // A run without the remote-cache recommendation (e.g. good hit rate but
        // still unconnected) has no button to attach, but the footer shortcut
        // still offers the connect flow.
        let mut popup = CountdownPopup::new();
        popup.set_summary(summary_with(vec!["Some other recommendation".to_string()]));
        popup.set_cloud_connection_status(Some(CloudConnectionStatus::NotConnected));
        let (text, hrefs) = render_with_registry(&mut popup);
        assert!(!text.contains("[ Enable remote cache ]"));
        assert!(text.contains("Enable remote cache: <shift>+c"));
        assert!(!hrefs.iter().any(|h| h == CONNECT_BUTTON_HREF));
    }

    #[test]
    fn connect_states_render_at_the_bottom() {
        // Loading: progress text, button and hint gone (attempt in flight).
        let mut popup = CountdownPopup::new();
        popup.set_summary(summary_with_cache_rec());
        popup.set_cloud_connection_status(Some(CloudConnectionStatus::NotConnected));
        popup.set_connect_state(CloudConnectState::Loading);
        let (text, _) = render_with_registry(&mut popup);
        assert!(text.contains("Generating your Nx Cloud connect URL..."));
        assert!(!text.contains("[ Enable remote cache ]"));
        assert!(!text.contains("<shift>+c"));

        // Ready: the short URL renders and is clickable; still no button.
        let url = "https://cloud.nx.app/connect/abcd1234";
        let mut popup = CountdownPopup::new();
        popup.set_summary(summary_with_cache_rec());
        popup.set_cloud_connection_status(Some(CloudConnectionStatus::NotConnected));
        popup.set_connect_state(CloudConnectState::Ready(url.to_string()));
        let (text, hrefs) = render_with_registry(&mut popup);
        assert!(text.contains(url));
        assert!(hrefs.iter().any(|h| h == url));
        assert!(!text.contains("[ Enable remote cache ]"));

        // The URL stays visible after the workspace flips to connected (the
        // user still needs it to finish onboarding in the browser).
        popup.set_cloud_connection_status(Some(CloudConnectionStatus::Connected));
        let (text, _) = render_with_registry(&mut popup);
        assert!(text.contains(url));

        // Error: the message renders and the retry shortcut is advertised.
        let mut popup = CountdownPopup::new();
        popup.set_summary(summary_with_cache_rec());
        popup.set_cloud_connection_status(Some(CloudConnectionStatus::NotConnected));
        popup.set_connect_state(CloudConnectState::Error("network down".to_string()));
        let (text, _) = render_with_registry(&mut popup);
        assert!(text.contains("Could not connect: network down"));
        assert!(text.contains("Enable remote cache: <shift>+c"));
    }

    #[test]
    fn scroll_hint_yields_to_the_connect_hint() {
        // A tall report overflows the popup viewport (scrollable). With the
        // connect hint shown, both hints together exceed the 70-col cap and
        // ratatui would left-truncate the footer - so the scroll hint yields.
        let mut tall = summary_with_cache_rec();
        tall.recommendations
            .extend((0..80).map(|i| format!("Recommendation number {i}")));

        let mut popup = CountdownPopup::new();
        popup.set_summary(tall.clone());
        popup.set_cloud_connection_status(Some(CloudConnectionStatus::NotConnected));
        let (text, _) = render_with_registry(&mut popup);
        assert!(text.contains("Enable remote cache: <shift>+c"));
        assert!(
            !text.contains("scroll:"),
            "scroll hint yields while the connect hint renders"
        );

        // Once an attempt started (hint gone), the scroll hint returns.
        popup.set_connect_state(CloudConnectState::Loading);
        let (text, _) = render_with_registry(&mut popup);
        assert!(!text.contains("<shift>+c"));
        assert!(text.contains("scroll:"));
    }

    #[test]
    fn connect_url_renders_centered() {
        let url = "https://cloud.nx.app/connect/abcd1234";
        let mut popup = CountdownPopup::new();
        popup.set_summary(summary_with_cache_rec());
        popup.set_cloud_connection_status(Some(CloudConnectionStatus::NotConnected));
        popup.set_connect_state(CloudConnectState::Ready(url.to_string()));
        let (text, _) = render_with_registry(&mut popup);

        let url_row = text.lines().find(|l| l.contains(url)).unwrap();
        // Compare the space padding between the border columns on either side
        // of the URL (work in chars: the border glyphs are multi-byte).
        let chars: Vec<char> = url_row.chars().collect();
        let left_border = chars.iter().position(|&c| c == '│').unwrap();
        let right_border = chars.iter().rposition(|&c| c == '│').unwrap();
        let inner: String = chars[left_border + 1..right_border].iter().collect();
        let start = inner.find(url).unwrap();
        let left_pad = start;
        let right_pad = inner.len() - start - url.len();
        assert!(
            left_pad.abs_diff(right_pad) <= 4,
            "URL should be roughly centered (left pad {left_pad}, right pad {right_pad})"
        );
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
