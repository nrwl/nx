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

use super::help_text::HelpText;
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
    pub title_text: String,
    pub completed_count: usize,
    pub total_count: usize,
    pub all_completed: bool,
    pub has_failures: bool,
    /// (first task start, last task end) in epoch ms, for the completed timing
    pub run_time_range: Option<(i64, i64)>,
    /// When set, the bar's row swaps entirely to the filter display
    pub filter: Option<FilterProps>,
}

/// Filter session details shown while the task filter is active.
#[derive(Debug, Clone)]
pub struct FilterProps {
    pub text: String,
    pub persisted: bool,
    pub hidden_count: usize,
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
                self.render_cloud_message(f, chunks[1], props);
                self.render_help_text(f, chunks[3], true, props);
            }
            // A TwoLine layout squeezed into a 1-row area (stale cached layout
            // for a frame) degrades to a single line without the cloud message.
            BarLayout::TwoLine => {
                self.render_single_line(f, first_row, true, false, props);
            }
            BarLayout::SingleLine { help_collapsed } => {
                self.render_single_line(
                    f,
                    first_row,
                    help_collapsed,
                    props.has_cloud_content(),
                    props,
                );
            }
        }
    }

    fn render_single_line(
        &mut self,
        f: &mut Frame<'_>,
        row: Rect,
        help_collapsed: bool,
        show_cloud: bool,
        props: &StatusBarProps,
    ) {
        let help_width = if help_collapsed {
            COLLAPSED_HELP_WIDTH
        } else {
            FULL_HELP_WIDTH
        };
        let status_line = Self::status_line(props);
        let natural_status_width = status_line.width() as u16;
        let reserved = if show_cloud {
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
        if show_cloud {
            self.render_cloud_message(f, chunks[2], props);
        }
        self.render_help_text(f, chunks[4], help_collapsed, props);
    }

    fn render_status(&self, f: &mut Frame<'_>, area: Rect, props: &StatusBarProps) {
        f.render_widget(
            NxParagraph::new(Self::status_line(props)).alignment(Alignment::Left),
            area,
        );
    }

    /// The " NX " badge plus the run status, ported from the task list's old
    /// table header (badge/title styling and completed timing included).
    fn status_line(props: &StatusBarProps) -> Line<'static> {
        let logo_color = if props.total_count == 0 {
            THEME.info
        } else if props.all_completed {
            if props.has_failures {
                THEME.error
            } else {
                THEME.success
            }
        } else {
            THEME.info
        };

        let title_color = if props.all_completed {
            logo_color
        } else {
            THEME.primary_fg
        };
        let mut title_style = Style::default()
            .fg(title_color)
            .add_modifier(Modifier::BOLD);
        let mut dim_style = Style::default().dim();
        if props.is_dimmed {
            title_style = title_style.add_modifier(Modifier::DIM);
            dim_style = dim_style.add_modifier(Modifier::DIM);
        }

        let mut spans = vec![
            Span::raw(" "),
            Span::styled(
                " NX ",
                Style::reset()
                    .add_modifier(Modifier::BOLD)
                    .bg(logo_color)
                    .fg(THEME.primary_fg),
            ),
            Span::raw("  "),
        ];

        if props.all_completed {
            spans.push(Span::styled(
                format!("Completed {}", props.title_text),
                title_style,
            ));
            if let Some((first_start, last_end)) = props.run_time_range {
                spans.push(Span::styled(
                    format!(" ({})", format_duration_since(first_start, last_end)),
                    dim_style,
                ));
            }
        } else {
            spans.push(Span::styled(
                format!("Running {}...", props.title_text),
                title_style,
            ));
            if props.total_count > 0 {
                spans.push(Span::styled(
                    format!(" {}/{}", props.completed_count, props.total_count),
                    dim_style,
                ));
            }
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
        HelpText::new(
            is_collapsed,
            props.is_dimmed,
            false,
            props.perf_report_available,
        )
        .render(f, area);
    }
}
