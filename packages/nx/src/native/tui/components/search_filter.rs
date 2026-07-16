//! The shared vim-style session UI used by both the task filter and the
//! terminal pane search. One implementation renders both so the two sessions
//! cannot drift apart; only the counts text and confirmed key hints differ.
//!
//! While the query is being typed, [`SearchFilterInput`] takes over the
//! status bar's row:
//!
//! ```text
//!  /{query}   {counts}   <enter> confirm, <esc> cancel
//! ```
//!
//! Once confirmed, the session renders compactly in the bar's middle slot via
//! [`confirmed_text`]: `/{query}  {counts} ({keys})`.

use ratatui::{
    buffer::Buffer,
    layout::{Alignment, Rect},
    style::Style,
    text::{Line, Span},
    widgets::Widget,
};

use super::nx_paragraph::NxParagraph;
use crate::native::tui::theme::THEME;

/// The whole-row input display for a session that is being typed.
pub struct SearchFilterInput<'a> {
    pub query: &'a str,
    /// Session-specific feedback shown after the query, e.g. `3/17 matches`
    /// or `4 tasks filtered out`. Omitted entirely when `None`.
    pub counts: Option<String>,
    pub is_dimmed: bool,
}

impl Widget for SearchFilterInput<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let base = if self.is_dimmed {
            Style::default().dim()
        } else {
            Style::default()
        };
        let hint_style = base.fg(THEME.secondary_fg);
        let mut spans = vec![Span::styled(
            format!(" /{}", self.query),
            base.fg(THEME.info),
        )];
        if let Some(counts) = self.counts {
            spans.push(Span::styled(format!("   {counts}"), hint_style));
        }
        spans.push(Span::styled("   <enter> confirm, <esc> cancel", hint_style));
        Widget::render(
            NxParagraph::new(Line::from(spans)).alignment(Alignment::Left),
            area,
            buf,
        );
    }
}

/// The compact middle-slot form of a confirmed session:
/// `/{query}  {counts} ({keys})`.
pub fn confirmed_text(query: &str, counts: Option<String>, keys: &str) -> String {
    match counts {
        Some(counts) => format!("/{query}  {counts} ({keys})"),
        None => format!("/{query}  ({keys})"),
    }
}
