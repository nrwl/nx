//! Full-width status bar on the bottom row(s) of the full-screen TUI.
//!
//! The bar shows the " NX " badge with the run status on the left, the Nx
//! Cloud message/link in the middle, and the keyboard hints on the right.
//! While the task filter is active the whole row swaps to the filter display,
//! vim-style.
//!
//! All display state arrives per frame via [`StatusBarProps`], derived from
//! the canonical `TuiState` (plus the app's focus and the task list's filter
//! session) — the bar deliberately owns no copy of that state. The struct is
//! persistent only so its [`LinkRegistry`] survives from the draw pass to the
//! mouse-release hit-test.

use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
};

use super::help_text::{HelpText, HelpTextContext};
use super::link::{Link, LinkRegistry};
use crate::native::tui::components::nx_paragraph::NxParagraph;
use crate::native::tui::theme::THEME;
use crate::native::tui::utils::format_duration_since;

const COLLAPSED_HELP_WIDTH: u16 = 19; // "quit: q help: ?"
const FULL_HELP_WIDTH: u16 = 86; // Full help text width
const MIN_CLOUD_URL_WIDTH: u16 = 15; // Minimum space to show at least part of the URL
const MIN_BOTTOM_SPACING: u16 = 4; // Minimum space between sections
const RIGHT_MARGIN: u16 = 1;
const LEFT_MARGIN: u16 = 2;
/// Badge + a minimum useful amount of the run status text.
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
    pub has_failures: bool,
    /// (first task start, last task end) in epoch ms, for the completed timing
    pub run_time_range: Option<(i64, i64)>,
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
    /// Whether the pane's task can take input, and whether it currently is
    /// (`None` when interactivity doesn't apply, e.g. a finished task).
    pub interactive: Option<bool>,
    /// Transient feedback (e.g. "copied to clipboard"), shown in place of the
    /// cloud message until it expires.
    pub status_message: Option<String>,
}

impl StatusBarProps {
    fn has_cloud_content(&self) -> bool {
        self.cloud_message.is_some() || self.cloud_link.is_some()
    }
}

enum BarLayout {
    /// [status] ... [cloud?] ... [help]
    SingleLine { help_collapsed: bool },
    /// Status row above a cloud + collapsed-help row.
    TwoLine,
}

pub struct StatusBar {
    link_registry: LinkRegistry,
}

impl Default for StatusBar {
    fn default() -> Self {
        Self::new()
    }
}

impl StatusBar {
    pub fn new() -> Self {
        Self {
            link_registry: LinkRegistry::new(),
        }
    }

    pub fn link_registry(&self) -> &LinkRegistry {
        &self.link_registry
    }

    pub fn link_registry_mut(&mut self) -> &mut LinkRegistry {
        &mut self.link_registry
    }

    /// Rows the bar needs at `width`. Pure and in agreement with `render` so
    /// the app can reserve the rows in its layout before drawing. The filter
    /// never affects the height — a filtering bar just leaves row 2 blank.
    pub fn required_height(width: u16, has_cloud_content: bool) -> u16 {
        match Self::layout_for(width, has_cloud_content) {
            BarLayout::SingleLine { .. } => 1,
            BarLayout::TwoLine => 2,
        }
    }

    fn layout_for(width: u16, has_cloud_content: bool) -> BarLayout {
        if has_cloud_content {
            let full_help = STATUS_MIN_WIDTH
                + MIN_BOTTOM_SPACING
                + MIN_CLOUD_URL_WIDTH
                + MIN_BOTTOM_SPACING
                + FULL_HELP_WIDTH
                + RIGHT_MARGIN;
            let collapsed_help = STATUS_MIN_WIDTH
                + MIN_BOTTOM_SPACING
                + MIN_CLOUD_URL_WIDTH
                + MIN_BOTTOM_SPACING
                + COLLAPSED_HELP_WIDTH
                + RIGHT_MARGIN;
            if width >= full_help {
                BarLayout::SingleLine {
                    help_collapsed: false,
                }
            } else if width >= collapsed_help {
                BarLayout::SingleLine {
                    help_collapsed: true,
                }
            } else {
                BarLayout::TwoLine
            }
        } else {
            let full_help = STATUS_MIN_WIDTH + MIN_BOTTOM_SPACING + FULL_HELP_WIDTH + RIGHT_MARGIN;
            BarLayout::SingleLine {
                help_collapsed: width < full_help,
            }
        }
    }

    /// Render into `area` (the rect reserved by the app's layout) and record
    /// any cloud link in the registry for the app's click hit-testing.
    pub fn render(&mut self, f: &mut Frame<'_>, area: Rect, props: &StatusBarProps) {
        // Reset per-frame link hit-testing; repopulated as the cloud link
        // renders below. (The app also clears this before the draw pass, but
        // clearing here keeps the bar correct when rendered directly in tests.)
        self.link_registry.clear();

        if area.height == 0
            || area.width == 0
            || area.x >= f.area().width
            || area.y >= f.area().height
        {
            return;
        }
        let area = area.intersection(f.area());

        let first_row = Rect { height: 1, ..area };

        // The filter display preempts the entire bar while active.
        if let Some(filter) = &props.filter {
            self.render_filter(f, first_row, filter, props.is_dimmed);
            return;
        }

        let layout = Self::layout_for(area.width, props.has_cloud_content());
        match layout {
            BarLayout::TwoLine if area.height >= 2 => {
                self.render_status(f, first_row, props);
                let second_row = Rect {
                    y: area.y + 1,
                    height: 1,
                    ..area
                };
                let chunks = Layout::default()
                    .direction(Direction::Horizontal)
                    .constraints([
                        Constraint::Length(LEFT_MARGIN),
                        Constraint::Fill(1),
                        Constraint::Length(MIN_BOTTOM_SPACING),
                        Constraint::Length(COLLAPSED_HELP_WIDTH + RIGHT_MARGIN),
                    ])
                    .split(second_row);
                self.render_middle(f, chunks[1], props);
                self.render_help_text(f, chunks[3], true, props);
            }
            // A TwoLine layout squeezed into a 1-row area (stale cached layout
            // for a frame) degrades to a single line without the cloud message.
            BarLayout::TwoLine => {
                self.render_single_line(f, first_row, true, false, props);
            }
            BarLayout::SingleLine { help_collapsed } => {
                let show_middle = props.has_cloud_content()
                    || props
                        .pane
                        .as_ref()
                        .is_some_and(|pane| pane.status_message.is_some());
                self.render_single_line(f, first_row, help_collapsed, show_middle, props);
            }
        }
    }

    fn render_single_line(
        &mut self,
        f: &mut Frame<'_>,
        row: Rect,
        help_collapsed: bool,
        show_middle: bool,
        props: &StatusBarProps,
    ) {
        let help_width = if help_collapsed {
            COLLAPSED_HELP_WIDTH
        } else {
            FULL_HELP_WIDTH
        };
        let status_line = Self::status_line(props);
        let natural_status_width = status_line.width() as u16;
        let reserved = if show_middle {
            help_width + RIGHT_MARGIN + 2 * MIN_BOTTOM_SPACING + MIN_CLOUD_URL_WIDTH
        } else {
            help_width + RIGHT_MARGIN + MIN_BOTTOM_SPACING
        };
        let status_width = natural_status_width.min(row.width.saturating_sub(reserved));

        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Length(status_width),
                Constraint::Length(MIN_BOTTOM_SPACING),
                Constraint::Fill(1),
                Constraint::Length(MIN_BOTTOM_SPACING),
                Constraint::Length(help_width + RIGHT_MARGIN),
            ])
            .split(row);

        f.render_widget(
            NxParagraph::new(status_line).alignment(Alignment::Left),
            chunks[0],
        );
        if show_middle {
            self.render_middle(f, chunks[2], props);
        }
        self.render_help_text(f, chunks[4], help_collapsed, props);
    }

    /// The middle section: a focused pane's transient feedback takes the slot
    /// over the cloud message until it expires.
    fn render_middle(&mut self, f: &mut Frame<'_>, area: Rect, props: &StatusBarProps) {
        if area.width == 0 || area.height == 0 {
            return;
        }
        if let Some(pane) = &props.pane
            && let Some(message) = &pane.status_message
        {
            let style = if props.is_dimmed {
                Style::default().fg(THEME.info).dim()
            } else {
                Style::default().fg(THEME.info)
            };
            f.render_widget(
                NxParagraph::new(Line::from(Span::styled(message.clone(), style)))
                    .alignment(Alignment::Left),
                area,
            );
            return;
        }
        self.render_cloud_message(f, area, props);
    }

    fn render_status(&self, f: &mut Frame<'_>, area: Rect, props: &StatusBarProps) {
        f.render_widget(
            NxParagraph::new(Self::status_line(props)).alignment(Alignment::Left),
            area,
        );
    }

    /// Minimal progress counts, colored by run state (the " NX " badge and the
    /// run title live in the task list's header).
    fn status_line(props: &StatusBarProps) -> Line<'static> {
        if props.total_count == 0 {
            return Line::default();
        }

        let state_color = if props.all_completed {
            if props.has_failures {
                THEME.error
            } else {
                THEME.success
            }
        } else {
            THEME.info
        };
        let mut counts_style = Style::default()
            .fg(state_color)
            .add_modifier(Modifier::BOLD);
        let mut dim_style = Style::default().dim();
        if props.is_dimmed {
            counts_style = counts_style.add_modifier(Modifier::DIM);
            dim_style = dim_style.add_modifier(Modifier::DIM);
        }

        let mut spans = vec![
            Span::raw(" "),
            Span::styled(
                format!("{}/{} tasks", props.completed_count, props.total_count),
                counts_style,
            ),
        ];
        if props.all_completed
            && let Some((first_start, last_end)) = props.run_time_range
        {
            spans.push(Span::styled(
                format!(" ({})", format_duration_since(first_start, last_end)),
                dim_style,
            ));
        }

        // The focused pane's interactivity indicator (moved off the pane's
        // bottom border).
        if let Some(pane) = &props.pane
            && let Some(is_interactive) = pane.interactive
        {
            let (mode_text, mode_color) = if is_interactive {
                ("INTERACTIVE", THEME.primary_fg)
            } else {
                ("NON-INTERACTIVE", THEME.secondary_fg)
            };
            let mut mode_style = Style::default().fg(mode_color);
            if props.is_dimmed {
                mode_style = mode_style.add_modifier(Modifier::DIM);
            }
            spans.push(Span::styled(format!("  {}", mode_text), mode_style));
        }

        Line::from(spans)
    }

    /// The whole-row filter display, ported from the task list's old two-line
    /// filter area and collapsed onto a single line.
    fn render_filter(&self, f: &mut Frame<'_>, row: Rect, filter: &FilterProps, is_dimmed: bool) {
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
        f.render_widget(NxParagraph::new(line).alignment(Alignment::Left), row);
    }

    /// Renders messages received from Nx Cloud.
    ///
    /// When the message contains a URL, the URL is rendered as a clickable
    /// [`Link`] (recorded in `link_registry` for the app to hit-test). The link
    /// truncates its display with an ellipsis when space is tight while still
    /// opening the full href.
    fn render_cloud_message(&mut self, f: &mut Frame<'_>, area: Rect, props: &StatusBarProps) {
        let available_width = area.width;
        if available_width == 0 || area.height == 0 {
            return;
        }
        let is_dimmed = props.is_dimmed;

        // A structured cloud link takes precedence: render its label as a
        // clickable link that opens the (different) href.
        if let Some((label, url)) = &props.cloud_link {
            let link = Link::new(label.clone(), url.clone()).dim(is_dimmed);
            f.render_stateful_widget(&link, area, &mut self.link_registry);
            return;
        }

        let Some(message) = &props.cloud_message else {
            return;
        };

        let message_style = if is_dimmed {
            Style::default().fg(THEME.secondary_fg).dim()
        } else {
            Style::default().fg(THEME.secondary_fg)
        };

        // No URL present: render the message as-is if it fits, otherwise truncate.
        if !message.contains("https://") {
            let message_line = Line::from(Span::styled(message.clone(), message_style));
            if message_line.width() <= available_width as usize {
                f.render_widget(
                    NxParagraph::new(message_line).alignment(Alignment::Left),
                    area,
                );
                return;
            }
            let max_message_render_len = available_width.saturating_sub(3) as usize; // Reserve for "..."
            let truncated_message = format!("{}...", &message[..max_message_render_len]);
            f.render_widget(
                NxParagraph::new(Line::from(Span::styled(truncated_message, message_style)))
                    .alignment(Alignment::Left),
                area,
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
            let prefix_paragraph =
                NxParagraph::new(Line::from(Span::styled(prefix.to_string(), message_style)))
                    .alignment(Alignment::Left);
            f.render_widget(prefix_paragraph, prefix_area);
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
        f.render_stateful_widget(&link, link_area, &mut self.link_registry);
    }

    fn render_help_text(
        &self,
        f: &mut Frame<'_>,
        area: Rect,
        is_collapsed: bool,
        props: &StatusBarProps,
    ) {
        let context = match &props.pane {
            Some(pane) => HelpTextContext::Pane {
                can_be_interactive: pane.interactive.is_some(),
                is_interactive: pane.interactive == Some(true),
            },
            None => HelpTextContext::TaskList {
                show_perf_report: props.perf_report_available,
            },
        };
        HelpText::new(is_collapsed, props.is_dimmed, false, context).render(f, area);
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
    ) -> (Terminal<TestBackend>, StatusBar) {
        let mut bar = StatusBar::new();
        let mut terminal = Terminal::new(TestBackend::new(width, height)).unwrap();
        terminal
            .draw(|f| {
                let area = f.area();
                bar.render(f, area, props);
            })
            .unwrap();
        (terminal, bar)
    }

    #[test]
    fn running_state_wide_shows_counts_and_full_help() {
        let mut props = base_props();
        props.completed_count = 1;
        let (terminal, _) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn running_state_narrow_collapses_help() {
        let props = base_props();
        let (terminal, _) = render_bar(80, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn completed_state_shows_title_and_duration() {
        let mut props = base_props();
        props.all_completed = true;
        props.completed_count = 3;
        props.run_time_range = Some((0, 4200));
        let (terminal, _) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn counts_are_green_on_success_and_red_on_failure() {
        let mut props = base_props();
        props.all_completed = true;
        props.completed_count = 3;

        let (terminal, _) = render_bar(140, 1, &props);
        // The counts text starts after the 1-col left margin.
        assert_eq!(terminal.backend().buffer()[(1, 0)].fg, THEME.success);

        props.has_failures = true;
        let (terminal, _) = render_bar(140, 1, &props);
        assert_eq!(terminal.backend().buffer()[(1, 0)].fg, THEME.error);
    }

    #[test]
    fn counts_are_info_colored_while_running() {
        let props = base_props();
        let (terminal, _) = render_bar(140, 1, &props);
        assert_eq!(terminal.backend().buffer()[(1, 0)].fg, THEME.info);
    }

    #[test]
    fn pane_focus_swaps_help_to_pane_hints_and_shows_mode() {
        let mut props = base_props();
        props.pane = Some(PaneProps {
            interactive: Some(false),
            status_message: None,
        });
        let (terminal, _) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn interactive_pane_shows_only_the_exit_toggle() {
        let mut props = base_props();
        props.pane = Some(PaneProps {
            interactive: Some(true),
            status_message: None,
        });
        let (terminal, _) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
    }

    #[test]
    fn pane_status_message_takes_the_middle_slot_over_cloud() {
        let mut props = base_props();
        props.cloud_link = Some((
            "View in Nx Cloud".to_string(),
            "https://nx.app/runs/KnGk4A47qk".to_string(),
        ));
        props.pane = Some(PaneProps {
            interactive: None,
            status_message: Some("copied to clipboard".to_string()),
        });
        let (terminal, bar) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
        // The cloud link is suppressed while the message shows, so nothing is
        // registered for click hit-testing.
        assert_eq!(bar.link_registry().hit_test(50, 0), None);
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
    fn cloud_link_renders_label_and_registers_href() {
        let mut props = base_props();
        props.cloud_link = Some((
            "View in Nx Cloud".to_string(),
            "https://nx.app/runs/KnGk4A47qk".to_string(),
        ));
        let (terminal, bar) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());

        // The label's drawn rect is hit-testable and resolves to the full href.
        let buffer_text: String = (0..140)
            .map(|x| terminal.backend().buffer()[(x, 0)].symbol().to_string())
            .collect();
        let label_x = buffer_text.find("View in Nx Cloud").unwrap() as u16;
        assert_eq!(
            bar.link_registry().hit_test(label_x, 0),
            Some("https://nx.app/runs/KnGk4A47qk")
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
        let (terminal, bar) = render_bar(60, 1, &props);
        insta::assert_snapshot!(terminal.backend());
        assert_eq!(bar.link_registry().hit_test(30, 0), None);
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
        let (terminal, bar) = render_bar(140, 1, &props);
        insta::assert_snapshot!(terminal.backend());
        // No cloud link is registered while the filter preempts the bar.
        assert_eq!(bar.link_registry().hit_test(70, 0), None);
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

        // Cloud content wraps to two rows only below the collapsed-help threshold.
        assert_eq!(StatusBar::required_height(200, true), 1);
        assert_eq!(StatusBar::required_height(135, true), 1);
        assert_eq!(StatusBar::required_height(68, true), 1);
        assert_eq!(StatusBar::required_height(67, true), 2);
        assert_eq!(StatusBar::required_height(40, true), 2);
    }
}
