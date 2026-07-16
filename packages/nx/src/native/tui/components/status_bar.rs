//! Full-width status bar on the bottom row(s) of the full-screen TUI.
//!
//! The bar shows the run progress counts on the left (clickable into the Nx
//! Cloud run when a link exists), free-text cloud messages or focused-pane
//! feedback in the middle, and context-aware keyboard hints on the right.
//! While the task filter is active the whole row swaps to the filter display,
//! vim-style.
//!
//! All display state arrives per frame via [`StatusBarProps`], derived from
//! the canonical `TuiState` (plus the app's focus and the task list's filter
//! session) — the bar deliberately owns no copy of that state. It is a
//! transient [`StatefulWidget`]: the App constructs one per frame from the
//! props and supplies a persistent [`LinkRegistry`] as the widget state, which
//! survives from the draw pass to the mouse-release hit-test.

use ratatui::{
    buffer::Buffer,
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{StatefulWidget, Widget},
};

use super::help_text::{HelpText, HelpTextContext};
use super::link::{Link, LinkRegistry, fit_with_ellipsis};
use crate::native::tui::components::nx_paragraph::NxParagraph;
use crate::native::tui::theme::THEME;
use crate::native::tui::utils::{format_duration_since, format_live_duration};

// The two essential help items, "quit: q" + "  " + "help: ?" (16 columns).
const MIN_HELP_WIDTH: u16 = 16;
const MIN_CLOUD_URL_WIDTH: u16 = 15; // Minimum space to show at least part of the URL
const MIN_BOTTOM_SPACING: u16 = 4; // Minimum space between sections
const RIGHT_MARGIN: u16 = 1;
const LEFT_MARGIN: u16 = 2;
/// A minimum useful amount of the run status text.
const STATUS_MIN_WIDTH: u16 = 25;

/// Per-frame view props derived from canonical state.
#[derive(Debug, Clone, Default)]
pub struct StatusBarProps {
    pub is_dimmed: bool,
    pub perf_report_available: bool,
    pub cloud_message: Option<String>,
    pub cloud_link: Option<(String, String)>,
    pub completed_count: usize,
    pub total_count: usize,
    pub all_completed: bool,
    /// First task start in epoch ms; drives the live overall duration
    pub run_started_at: Option<i64>,
    /// Last task end in epoch ms; freezes the duration once the run completes
    pub run_ended_at: Option<i64>,
    /// When set, the bar's row swaps entirely to the filter display
    pub filter: Option<FilterProps>,
    /// When set, a terminal pane has focus: the help hints describe the pane
    /// and its interactive state / transient feedback show in the bar.
    pub pane: Option<PaneProps>,
}

/// Filter session details shown while the task filter is active.
#[derive(Debug, Clone)]
pub struct FilterProps {
    pub text: String,
    pub persisted: bool,
    pub hidden_count: usize,
}

/// Focused-pane details shown while a terminal pane has focus.
#[derive(Debug, Clone, Default)]
pub struct PaneProps {
    /// Whether the pane is showing terminal output (the task has started) as
    /// opposed to a dependency view (a not-yet-started task). Gates the hints
    /// that act on output — search, copy — which are meaningless without it.
    pub has_output: bool,
    /// Whether the pane's task can take input, and whether it currently is
    /// (`None` when interactivity doesn't apply, e.g. a finished task).
    pub interactive: Option<bool>,
    /// Transient feedback (e.g. "copied to clipboard"), shown in place of the
    /// cloud message until it expires.
    pub status_message: Option<String>,
    /// A vim-style search over the pane's output; swaps the bar's row to the
    /// search display while set.
    pub search: Option<PaneSearchProps>,
}

/// The focused pane's search session, for the bar's search display.
#[derive(Debug, Clone, Default)]
pub struct PaneSearchProps {
    pub query: String,
    /// Typing into the query (true) vs navigating matches with n/N (false).
    pub input_mode: bool,
    /// Zero-based index of the match the view last jumped to.
    pub current: usize,
    pub total: usize,
}

impl StatusBarProps {
    /// Whether a free-text cloud message needs the middle display. A
    /// structured cloud link supersedes it (the progress counts become the
    /// link, so nothing renders in the middle).
    fn has_cloud_message(&self) -> bool {
        self.cloud_link.is_none() && self.cloud_message.is_some()
    }
}

enum BarLayout {
    /// [status] [message/cloud] ... [help]
    SingleLine,
    /// Status row above a cloud + help row.
    TwoLine,
}

/// Transient per-frame widget. Holds only a borrow of the props; its clickable
/// [`LinkRegistry`] is the [`StatefulWidget`] state, owned by the App (which
/// hit-tests it on mouse release).
pub struct StatusBar<'a> {
    props: &'a StatusBarProps,
}

impl<'a> StatusBar<'a> {
    pub fn new(props: &'a StatusBarProps) -> Self {
        Self { props }
    }

    /// Rows the bar needs at `width`. Pure and in agreement with `render` so
    /// the app can reserve the rows in its layout before drawing. The filter
    /// never affects the height — a filtering bar just leaves row 2 blank.
    pub fn required_height(width: u16, has_cloud_message: bool) -> u16 {
        match Self::layout_for(width, has_cloud_message) {
            BarLayout::SingleLine => 1,
            BarLayout::TwoLine => 2,
        }
    }

    fn layout_for(width: u16, has_cloud_message: bool) -> BarLayout {
        // With a free-text cloud message, wrap to two rows when one row can't
        // hold every section's minimum. (A structured cloud link lives on the
        // counts, so it never needs a second row.)
        let single_line_min = STATUS_MIN_WIDTH
            + MIN_BOTTOM_SPACING
            + MIN_CLOUD_URL_WIDTH
            + MIN_BOTTOM_SPACING
            + MIN_HELP_WIDTH
            + RIGHT_MARGIN;
        if has_cloud_message && width < single_line_min {
            BarLayout::TwoLine
        } else {
            BarLayout::SingleLine
        }
    }

    /// Render into `area` (the rect reserved by the app's layout) and record
    /// any cloud link in `registry` for the app's click hit-testing.
    fn draw(area: Rect, buf: &mut Buffer, registry: &mut LinkRegistry, props: &StatusBarProps) {
        // Reset per-frame link hit-testing; repopulated as the cloud link
        // renders below.
        registry.clear();

        let buf_area = *buf.area();
        if area.height == 0
            || area.width == 0
            || area.x >= buf_area.width
            || area.y >= buf_area.height
        {
            return;
        }
        let area = area.intersection(buf_area);

        let first_row = Rect { height: 1, ..area };

        // The filter display preempts the entire bar while active.
        if let Some(filter) = &props.filter {
            Self::render_filter(buf, first_row, filter, props.is_dimmed);
            return;
        }

        // Likewise the focused pane's search input while the query is being
        // typed. A confirmed search renders compactly in the middle slot
        // instead, so the pane hints and interactivity indicator come back.
        if let Some(pane) = &props.pane
            && let Some(search) = &pane.search
            && search.input_mode
        {
            Self::render_search(buf, first_row, search, props.is_dimmed);
            return;
        }

        let layout = Self::layout_for(area.width, props.has_cloud_message());
        match layout {
            BarLayout::TwoLine if area.height >= 2 => {
                let status_line = Self::status_line(props);
                Self::render_status(buf, registry, first_row, status_line, props);
                let second_row = Rect {
                    y: area.y + 1,
                    height: 1,
                    ..area
                };
                let help = Self::build_help(props);
                let help_width = help.fitted_width(second_row.width.saturating_sub(
                    LEFT_MARGIN + MIN_CLOUD_URL_WIDTH + MIN_BOTTOM_SPACING + RIGHT_MARGIN,
                ));
                let chunks = Layout::default()
                    .direction(Direction::Horizontal)
                    .constraints([
                        Constraint::Length(LEFT_MARGIN),
                        Constraint::Fill(1),
                        Constraint::Length(MIN_BOTTOM_SPACING),
                        Constraint::Length(help_width + RIGHT_MARGIN),
                    ])
                    .split(second_row);
                Self::render_middle(buf, registry, chunks[1], props);
                help.render(buf, chunks[3]);
            }
            // A TwoLine layout squeezed into a 1-row area (stale cached layout
            // for a frame) degrades to a single line without the cloud message.
            BarLayout::TwoLine => {
                Self::render_single_line(buf, registry, first_row, false, props);
            }
            BarLayout::SingleLine => {
                Self::render_single_line(buf, registry, first_row, true, props);
            }
        }
    }

    /// Lay the row out by natural content widths: the status and the middle
    /// message take exactly what they need, and the help absorbs the remaining
    /// space one whole hint item at a time. Slack sits between the middle and
    /// the right-aligned help.
    fn render_single_line(
        buf: &mut Buffer,
        registry: &mut LinkRegistry,
        row: Rect,
        allow_middle: bool,
        props: &StatusBarProps,
    ) {
        let status_line = Self::status_line(props);
        let status_natural = status_line.width() as u16;
        let help = Self::build_help(props);
        let middle_natural = if allow_middle {
            Self::middle_natural_width(props)
        } else {
            None
        };

        // The context's essential hints (e.g. the interactivity toggle while a
        // pane is focused) are never crowded out by the middle message.
        let help_min = help.essential_width();
        let (middle_min, gaps) = match middle_natural {
            Some(natural) => (natural.min(MIN_CLOUD_URL_WIDTH), 2 * MIN_BOTTOM_SPACING),
            None => (0, MIN_BOTTOM_SPACING),
        };
        // The status text truncates only once the other sections' minimums
        // wouldn't fit.
        let status_width = status_natural.min(
            row.width
                .saturating_sub(gaps + middle_min + help_min + RIGHT_MARGIN),
        );
        // The middle takes its natural width next (the Link/message truncate
        // themselves when squeezed below it), preserving the essential hints.
        let middle_width = middle_natural
            .map(|natural| {
                natural.min(
                    row.width
                        .saturating_sub(status_width + gaps + help_min + RIGHT_MARGIN),
                )
            })
            .unwrap_or(0);
        // The help absorbs whatever remains, one whole item at a time.
        let help_width = help.fitted_width(
            row.width
                .saturating_sub(status_width + middle_width + gaps + RIGHT_MARGIN),
        );

        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Length(status_width),
                Constraint::Length(MIN_BOTTOM_SPACING),
                Constraint::Length(middle_width),
                Constraint::Fill(1),
                Constraint::Length(help_width + RIGHT_MARGIN),
            ])
            .split(row);

        Self::render_status(buf, registry, chunks[0], status_line, props);
        if middle_width > 0 {
            Self::render_middle(buf, registry, chunks[2], props);
        }
        help.render(buf, chunks[4]);
    }

    /// Natural width of the middle section's content: a focused pane's
    /// transient message, its confirmed search, or the cloud message. (A
    /// structured cloud link has no middle display — the progress counts are
    /// the link.)
    fn middle_natural_width(props: &StatusBarProps) -> Option<u16> {
        if let Some(pane) = &props.pane {
            if let Some(message) = &pane.status_message {
                return Some(Span::raw(message.as_str()).width() as u16);
            }
            if let Some(search) = &pane.search {
                return Some(
                    Span::raw(Self::confirmed_search_text(search).as_str()).width() as u16,
                );
            }
        }
        if props.cloud_link.is_some() {
            return None;
        }
        props
            .cloud_message
            .as_ref()
            .map(|message| Span::raw(message.as_str()).width() as u16)
    }

    /// The compact middle-slot text for a confirmed search session.
    ///
    /// Matches are numbered from the bottom of the log upward — the newest
    /// (bottom-most) match is `1`, the oldest at the top is `N` — mirroring the
    /// backward-from-the-bottom navigation. `current` is the index in
    /// ascending-row order, so the displayed position is `total - current`.
    fn confirmed_search_text(search: &PaneSearchProps) -> String {
        if search.total > 0 {
            format!(
                "/{}  {}/{} (n/N)",
                search.query,
                search.total - search.current,
                search.total
            )
        } else {
            format!("/{}  no matches", search.query)
        }
    }

    /// The middle section: a focused pane's transient feedback takes the slot
    /// over its confirmed search, which takes it over the cloud message.
    fn render_middle(
        buf: &mut Buffer,
        registry: &mut LinkRegistry,
        area: Rect,
        props: &StatusBarProps,
    ) {
        if area.width == 0 || area.height == 0 {
            return;
        }
        let info_style = if props.is_dimmed {
            Style::default().fg(THEME.info).dim()
        } else {
            Style::default().fg(THEME.info)
        };
        if let Some(pane) = &props.pane {
            if let Some(message) = &pane.status_message {
                Widget::render(
                    NxParagraph::new(Line::from(Span::styled(message.clone(), info_style)))
                        .alignment(Alignment::Left),
                    area,
                    buf,
                );
                return;
            }
            if let Some(search) = &pane.search {
                Widget::render(
                    NxParagraph::new(Line::from(Span::styled(
                        Self::confirmed_search_text(search),
                        info_style,
                    )))
                    .alignment(Alignment::Left),
                    area,
                    buf,
                );
                return;
            }
        }
        Self::render_cloud_message(buf, registry, area, props);
    }

    /// Render the progress counts and, when a structured cloud link exists,
    /// register their rect as the clickable way into the Nx Cloud run.
    fn render_status(
        buf: &mut Buffer,
        registry: &mut LinkRegistry,
        area: Rect,
        status_line: Line<'static>,
        props: &StatusBarProps,
    ) {
        let clickable_width = (status_line.width() as u16).min(area.width);
        Widget::render(
            NxParagraph::new(status_line).alignment(Alignment::Left),
            area,
            buf,
        );
        if let Some((_, url)) = &props.cloud_link
            && clickable_width > 0
            && area.height > 0
        {
            registry.push(
                Rect {
                    x: area.x,
                    y: area.y,
                    width: clickable_width,
                    height: 1,
                },
                url.clone(),
            );
        }
    }

    /// Minimal progress counts. Deliberately quiet — the " NX " badge in the
    /// task list header carries the run-state color signal.
    fn status_line(props: &StatusBarProps) -> Line<'static> {
        if props.total_count == 0 {
            return Line::default();
        }

        let mut counts_style = Style::default().fg(THEME.secondary_fg);
        // A quiet affordance: the counts are the clickable way into the Nx
        // Cloud run when a structured link exists.
        if props.cloud_link.is_some() {
            counts_style = counts_style.add_modifier(Modifier::UNDERLINED);
        }
        let mut dim_style = Style::default().dim();
        if props.is_dimmed {
            counts_style = counts_style.add_modifier(Modifier::DIM);
            dim_style = dim_style.add_modifier(Modifier::DIM);
        }

        let mut spans = vec![
            Span::raw(" "),
            Span::styled(
                format!("{}/{}", props.completed_count, props.total_count),
                counts_style,
            ),
        ];
        // Overall run duration: live while running, frozen once complete.
        if let Some(started_at) = props.run_started_at {
            let duration = match props.run_ended_at {
                Some(ended_at) if props.all_completed => {
                    format_duration_since(started_at, ended_at)
                }
                _ => format_live_duration(started_at),
            };
            spans.push(Span::styled(format!(" ({})", duration), dim_style));
        }

        Line::from(spans)
    }

    /// The whole-row search display for the focused pane's vim-style search.
    fn render_search(buf: &mut Buffer, row: Rect, search: &PaneSearchProps, is_dimmed: bool) {
        let base = if is_dimmed {
            Style::default().dim()
        } else {
            Style::default()
        };
        let query_style = base.fg(THEME.info);
        let hint_style = base.fg(THEME.secondary_fg);

        let counts = if search.total > 0 {
            format!("{}/{} matches", search.current + 1, search.total)
        } else if search.query.is_empty() {
            String::new()
        } else {
            "no matches".to_string()
        };
        let hints = if search.input_mode {
            "<enter> confirm, <esc> cancel"
        } else {
            "n/N to navigate, <esc> to clear"
        };

        let mut spans = vec![Span::styled(format!(" /{}", search.query), query_style)];
        if !counts.is_empty() {
            spans.push(Span::styled(format!("   {}", counts), hint_style));
        }
        spans.push(Span::styled(format!("   {}", hints), hint_style));
        Widget::render(
            NxParagraph::new(Line::from(spans)).alignment(Alignment::Left),
            row,
            buf,
        );
    }

    /// The whole-row filter display, ported from the task list's old two-line
    /// filter area and collapsed onto a single line.
    fn render_filter(buf: &mut Buffer, row: Rect, filter: &FilterProps, is_dimmed: bool) {
        let filter_style = if is_dimmed {
            Style::default().fg(THEME.warning).dim()
        } else {
            Style::default().fg(THEME.warning)
        };

        let instruction_text = if filter.hidden_count > 0 {
            if filter.persisted {
                format!(
                    "-> {} tasks filtered out. Press / to edit, <esc> to clear",
                    filter.hidden_count
                )
            } else {
                format!(
                    "-> {} tasks filtered out. Press / to persist, <esc> to clear",
                    filter.hidden_count
                )
            }
        } else if filter.persisted {
            "Press / to edit filter".to_string()
        } else {
            "Press <esc> to clear filter".to_string()
        };

        let line = Line::from(Span::styled(
            format!("  Filter: {}   {}", filter.text, instruction_text),
            filter_style,
        ));
        Widget::render(NxParagraph::new(line).alignment(Alignment::Left), row, buf);
    }

    /// Renders messages received from Nx Cloud.
    ///
    /// When the message contains a URL, the URL is rendered as a clickable
    /// [`Link`] (recorded in `link_registry` for the app to hit-test). The link
    /// truncates its display with an ellipsis when space is tight while still
    /// opening the full href.
    fn render_cloud_message(
        buf: &mut Buffer,
        registry: &mut LinkRegistry,
        area: Rect,
        props: &StatusBarProps,
    ) {
        let available_width = area.width;
        if available_width == 0 || area.height == 0 {
            return;
        }
        let is_dimmed = props.is_dimmed;

        let Some(message) = &props.cloud_message else {
            return;
        };

        let message_style = if is_dimmed {
            Style::default().fg(THEME.secondary_fg).dim()
        } else {
            Style::default().fg(THEME.secondary_fg)
        };

        // No URL present: render the message, truncating with an ellipsis when
        // it doesn't fit. `fit_with_ellipsis` is width-aware and never slices a
        // multi-byte character at a non-char boundary.
        if !message.contains("https://") {
            let text = fit_with_ellipsis(message, available_width as usize);
            Widget::render(
                NxParagraph::new(Line::from(Span::styled(text, message_style)))
                    .alignment(Alignment::Left),
                area,
                buf,
            );
            return;
        }

        // Split into a plain-text prefix and the URL.
        let url_start_pos = message.find("https://").unwrap_or(message.len());
        let prefix = &message[0..url_start_pos];
        let url = &message[url_start_pos..];
        let prefix_width = Span::raw(prefix).width() as u16;
        let url_width = Span::raw(url).width() as u16;

        // The full URL doesn't fit and there isn't even room for a useful
        // truncation: render nothing (user can widen the terminal).
        if url_width > available_width && available_width < MIN_CLOUD_URL_WIDTH {
            return;
        }

        // Show the prefix only when it fits alongside the full URL; otherwise the
        // URL link takes the whole row (the link truncates itself if needed).
        let show_prefix = prefix_width > 0 && prefix_width + url_width <= available_width;
        let link_x = if show_prefix {
            let prefix_area = Rect {
                width: prefix_width,
                ..area
            };
            Widget::render(
                NxParagraph::new(Line::from(Span::styled(prefix.to_string(), message_style)))
                    .alignment(Alignment::Left),
                prefix_area,
                buf,
            );
            area.x.saturating_add(prefix_width)
        } else {
            area.x
        };

        let link_width = area.right().saturating_sub(link_x);
        if link_width == 0 {
            return;
        }
        let link_area = Rect {
            x: link_x,
            y: area.y,
            width: link_width,
            height: 1,
        };

        // Display text and href are the same here (the URL); a caller that wants
        // friendly text like "View in Nx Cloud" passes a distinct display.
        let link = Link::new(url, url).dim(is_dimmed);
        StatefulWidget::render(&link, link_area, buf, registry);
    }

    fn build_help(props: &StatusBarProps) -> HelpText {
        let context = match &props.pane {
            Some(pane) => HelpTextContext::Pane {
                can_be_interactive: pane.interactive.is_some(),
                is_interactive: pane.interactive == Some(true),
                has_output: pane.has_output,
            },
            None => HelpTextContext::TaskList {
                show_perf_report: props.perf_report_available,
            },
        };
        HelpText::new(props.is_dimmed, false, context)
    }
}

impl StatefulWidget for StatusBar<'_> {
    type State = LinkRegistry;

    fn render(self, area: Rect, buf: &mut Buffer, registry: &mut LinkRegistry) {
        Self::draw(area, buf, registry, self.props);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::Terminal;
    use ratatui::backend::TestBackend;

    fn base_props() -> StatusBarProps {
        StatusBarProps {
            total_count: 3,
            ..Default::default()
        }
    }

    fn render_bar(
        width: u16,
        height: u16,
        props: &StatusBarProps,
    ) -> (Terminal<TestBackend>, LinkRegistry) {
        let mut registry = LinkRegistry::new();
        let mut terminal = Terminal::new(TestBackend::new(width, height)).unwrap();
        terminal
            .draw(|f| {
                let area = f.area();
                f.render_stateful_widget(StatusBar::new(props), area, &mut registry);
            })
            .unwrap();
        (terminal, registry)
    }

    #[test]
    fn running_state_wide_shows_counts_and_full_help() {
        let mut props = base_props();
        props.completed_count = 1;
        let (terminal, _) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    fn rendered_row(width: u16, props: &StatusBarProps) -> String {
        let (terminal, _) = render_bar(width, 1, props);
        (0..width)
            .map(|x| terminal.backend().buffer()[(x, 0)].symbol().to_string())
            .collect()
    }

    #[test]
    fn task_list_help_full_order_with_perf_report() {
        // The full left-to-right order once the run has finished (perf report
        // available): least-important on the left, quit/help anchored right.
        let mut props = base_props();
        props.perf_report_available = true;
        props.all_completed = true;
        props.completed_count = 3;
        let row = rendered_row(160, &props);
        assert!(
            row.contains(
                "perf report: p  pin output: 1 or 2  show output: <enter>  filter: /  navigate: ↑ ↓  quit: q  help: ?"
            ),
            "got: {row}"
        );
    }

    /// The pane help follows the same rule: quit/help anchored on the right
    /// (before the pinned interactivity indicator), items dropping from the
    /// left as the row narrows.
    #[test]
    fn pane_without_output_hides_search_and_copy() {
        let mut props = base_props();
        props.pane = Some(PaneProps {
            has_output: false,
            interactive: None,
            status_message: None,
            search: None,
        });
        let row = rendered_row(140, &props);
        assert!(row.contains("scroll: ↑ ↓"), "got: {row}");
        assert!(
            row.contains("full screen: <enter>  quit: q  help: ?"),
            "got: {row}"
        );
        assert!(
            !row.contains("search:"),
            "search hidden without output: {row}"
        );
        assert!(!row.contains("copy:"), "copy hidden without output: {row}");
    }

    #[test]
    fn pane_help_anchors_quit_help_and_drops_from_the_left() {
        let mut props = base_props();
        props.pane = Some(PaneProps {
            has_output: true,
            interactive: Some(false),
            status_message: None,
            search: None,
        });
        let row = rendered_row(70, &props);
        assert!(
            row.contains("quit: q  help: ?  NON-INTERACTIVE i to toggle"),
            "got: {row}"
        );
        assert!(
            !row.contains("scroll:"),
            "left-most hint should drop: {row}"
        );
    }

    #[test]
    fn running_state_narrow_shows_fewer_help_items() {
        let props = base_props();
        let (terminal, _) = render_bar(80, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn completed_state_shows_counts_and_frozen_duration() {
        let mut props = base_props();
        props.all_completed = true;
        props.completed_count = 3;
        props.run_started_at = Some(0);
        props.run_ended_at = Some(4200);
        let (terminal, _) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn counts_stay_quiet_regardless_of_run_state() {
        // The " NX " badge in the task list header carries the run-state
        // color; the counts are deliberately plain in every state.
        let mut props = base_props();
        let (terminal, _) = render_bar(140, 1, &props);
        // The counts text starts after the 1-col left margin.
        assert_eq!(terminal.backend().buffer()[(1, 0)].fg, THEME.secondary_fg);
        assert!(
            !terminal.backend().buffer()[(1, 0)]
                .modifier
                .contains(Modifier::BOLD)
        );

        props.all_completed = true;
        props.completed_count = 3;
        let (terminal, _) = render_bar(140, 1, &props);
        assert_eq!(terminal.backend().buffer()[(1, 0)].fg, THEME.secondary_fg);
    }

    #[test]
    fn running_duration_is_live_while_incomplete() {
        let mut props = base_props();
        props.completed_count = 1;
        props.run_started_at = Some(0);
        // No run_ended_at and not all_completed: the duration ticks live, so
        // only assert its presence rather than its (time-dependent) value.
        let (terminal, _) = render_bar(140, 1, &props);
        let row: String = (0..140)
            .map(|x| terminal.backend().buffer()[(x, 0)].symbol().to_string())
            .collect();
        assert!(row.starts_with(" 1/3 ("), "got: {row}");
    }

    #[test]
    fn pane_focus_swaps_help_to_pane_hints_and_shows_mode() {
        let mut props = base_props();
        props.pane = Some(PaneProps {
            has_output: true,
            interactive: Some(false),
            status_message: None,
            search: None,
        });
        let (terminal, _) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn interactive_pane_shows_only_the_exit_toggle() {
        let mut props = base_props();
        props.pane = Some(PaneProps {
            has_output: true,
            interactive: Some(true),
            status_message: None,
            search: None,
        });
        let (terminal, _) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn cloud_message_never_crowds_out_the_pane_essentials() {
        // Regression: a long cloud message used to squeeze the help down to
        // quit/help, hiding the interactivity indicator and toggle hint.
        let mut props = base_props();
        props.cloud_message =
            Some("View logs and run details at https://nx.app/runs/KnGk4A47qk".to_string());
        props.pane = Some(PaneProps {
            has_output: true,
            interactive: Some(false),
            status_message: None,
            search: None,
        });
        let (terminal, _) = render_bar(120, 1, &props);
        insta::assert_snapshot!(terminal.backend());

        // The single-item INTERACTIVE toggle survives the same squeeze.
        props.pane = Some(PaneProps {
            has_output: true,
            interactive: Some(true),
            status_message: None,
            search: None,
        });
        let (terminal, _) = render_bar(120, 1, &props);
        let row: String = (0..120)
            .map(|x| terminal.backend().buffer()[(x, 0)].symbol().to_string())
            .collect();
        assert!(row.contains("INTERACTIVE <ctrl>+z to toggle"), "got: {row}");
    }

    #[test]
    fn pane_status_message_takes_the_middle_slot_over_cloud() {
        let mut props = base_props();
        props.cloud_link = Some((
            "View in Nx Cloud".to_string(),
            "https://nx.app/runs/KnGk4A47qk".to_string(),
        ));
        props.pane = Some(PaneProps {
            has_output: true,
            interactive: None,
            status_message: Some("copied to clipboard".to_string()),
            search: None,
        });
        let (terminal, registry) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
        // The message occupies the middle, while the counts stay clickable
        // into the cloud run.
        assert_eq!(registry.hit_test(50, 0), None);
        assert_eq!(
            registry.hit_test(1, 0),
            Some("https://nx.app/runs/KnGk4A47qk")
        );
    }

    #[test]
    fn cloud_message_shares_the_single_line() {
        let mut props = base_props();
        props.cloud_message =
            Some("View logs and run details at https://nx.app/runs/KnGk4A47qk".to_string());
        let (terminal, _) = render_bar(180, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn cloud_link_rides_on_the_counts() {
        let mut props = base_props();
        props.cloud_link = Some((
            "View in Nx Cloud".to_string(),
            "https://nx.app/runs/KnGk4A47qk".to_string(),
        ));
        let (terminal, registry) = render_bar(140, 1, &props);
        // No separate middle display: the counts are the link.
        insta::assert_snapshot!(terminal.backend());

        // The counts rect is hit-testable, resolves to the run URL, and gets
        // the quiet underline affordance.
        assert_eq!(
            registry.hit_test(1, 0),
            Some("https://nx.app/runs/KnGk4A47qk")
        );
        assert!(
            terminal.backend().buffer()[(1, 0)]
                .modifier
                .contains(Modifier::UNDERLINED)
        );
        // Without a link there is no underline and nothing registered.
        let (terminal, registry) = render_bar(140, 1, &base_props());
        assert_eq!(registry.hit_test(1, 0), None);
        assert!(
            !terminal.backend().buffer()[(1, 0)]
                .modifier
                .contains(Modifier::UNDERLINED)
        );
    }

    #[test]
    fn narrow_width_with_cloud_wraps_to_two_lines() {
        let mut props = base_props();
        props.cloud_message = Some("https://nx.app/runs/KnGk4A47qk".to_string());
        let (terminal, _) = render_bar(60, 2, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn two_line_layout_squeezed_into_one_row_drops_the_cloud_message() {
        let mut props = base_props();
        props.cloud_message = Some("https://nx.app/runs/KnGk4A47qk".to_string());
        let (terminal, registry) = render_bar(60, 1, &props);
        insta::assert_snapshot!(terminal.backend());
        assert_eq!(registry.hit_test(30, 0), None);
    }

    #[test]
    fn filter_display_preempts_the_whole_bar() {
        let mut props = base_props();
        props.cloud_message = Some("https://nx.app/runs/KnGk4A47qk".to_string());
        props.filter = Some(FilterProps {
            text: "build".to_string(),
            persisted: false,
            hidden_count: 4,
        });
        let (terminal, registry) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
        // No cloud link is registered while the filter preempts the bar.
        assert_eq!(registry.hit_test(70, 0), None);
    }

    #[test]
    fn pane_search_preempts_the_whole_bar() {
        let mut props = base_props();
        props.cloud_message = Some("https://nx.app/runs/KnGk4A47qk".to_string());
        props.pane = Some(PaneProps {
            has_output: true,
            interactive: Some(false),
            status_message: None,
            search: Some(PaneSearchProps {
                query: "error".to_string(),
                input_mode: true,
                current: 2,
                total: 17,
            }),
        });
        let (terminal, _) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn confirmed_pane_search_shows_navigation_hints() {
        let mut props = base_props();
        props.pane = Some(PaneProps {
            has_output: true,
            interactive: Some(false),
            status_message: None,
            search: Some(PaneSearchProps {
                query: "error".to_string(),
                input_mode: false,
                current: 2,
                total: 17,
            }),
        });
        let (terminal, _) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn confirmed_pane_search_on_the_newest_match_reads_one() {
        // Matches are numbered from the bottom up, so the bottom-most match
        // (current == total - 1 in ascending-row order) shows `1/N`.
        let mut props = base_props();
        props.pane = Some(PaneProps {
            has_output: true,
            interactive: Some(false),
            status_message: None,
            search: Some(PaneSearchProps {
                query: "error".to_string(),
                input_mode: false,
                current: 16,
                total: 17,
            }),
        });
        let (terminal, _) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn confirmed_pane_search_with_no_matches() {
        let mut props = base_props();
        props.pane = Some(PaneProps {
            has_output: true,
            interactive: Some(false),
            status_message: None,
            search: Some(PaneSearchProps {
                query: "nothere".to_string(),
                input_mode: false,
                current: 0,
                total: 0,
            }),
        });
        let (terminal, _) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn persisted_filter_shows_edit_hint() {
        let mut props = base_props();
        props.filter = Some(FilterProps {
            text: "build".to_string(),
            persisted: true,
            hidden_count: 4,
        });
        let (terminal, _) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn filter_with_no_hidden_tasks_shows_clear_hint() {
        let mut props = base_props();
        props.filter = Some(FilterProps {
            text: "build".to_string(),
            persisted: false,
            hidden_count: 0,
        });
        let (terminal, _) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn dimmed_bar_dims_the_status_text() {
        let mut props = base_props();
        props.is_dimmed = true;
        let (terminal, _) = render_bar(140, 1, &props);
        // The counts text starts after the 1-col left margin.
        assert!(
            terminal.backend().buffer()[(1, 0)]
                .modifier
                .contains(Modifier::DIM)
        );
    }

    #[test]
    fn required_height_matches_layout_thresholds() {
        // No cloud content: always a single row.
        assert_eq!(StatusBar::required_height(200, false), 1);
        assert_eq!(StatusBar::required_height(60, false), 1);
        assert_eq!(StatusBar::required_height(40, false), 1);

        // Cloud content wraps to two rows only when the section minimums cannot
        // share one row. single_line_min = STATUS_MIN_WIDTH(25) + gap(4) +
        // MIN_CLOUD_URL_WIDTH(15) + gap(4) + MIN_HELP_WIDTH(16) + RIGHT_MARGIN(1) = 65.
        assert_eq!(StatusBar::required_height(200, true), 1);
        assert_eq!(StatusBar::required_height(135, true), 1);
        assert_eq!(StatusBar::required_height(65, true), 1);
        assert_eq!(StatusBar::required_height(64, true), 2);
        assert_eq!(StatusBar::required_height(40, true), 2);
    }
}
