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

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
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
fn confirmed_text(query: &str, counts: Option<String>, keys: &str) -> String {
    match counts {
        Some(counts) => format!("/{query}  {counts} ({keys})"),
        None => format!("/{query}  ({keys})"),
    }
}

/// A key press interpreted against the vim-session keymap shared by the task
/// filter and the pane search. Both hosts translate keys through this one
/// table — open/resume on `/`, literal characters (including `/`) while
/// editing, `<enter>` confirms, `<esc>` cancels — so the two sessions'
/// bindings cannot drift. Host-specific keys (the search's n/N navigation)
/// stay with the host.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SessionEvent {
    /// `/` outside input mode: open a new session, or resume the confirmed
    /// one for editing with its query preserved.
    Open,
    /// A character typed while editing (including a literal `/`).
    Append(char),
    /// Backspace while editing.
    DeleteBack,
    /// `<enter>` while editing: confirm the session.
    Confirm,
    /// `<esc>`: cancel the session being edited, or clear a confirmed one.
    Cancel,
    /// Not part of the session keymap; the host handles it normally.
    NotHandled,
}

pub(crate) fn interpret_session_key(
    input_mode: bool,
    session_active: bool,
    key: &KeyEvent,
) -> SessionEvent {
    if input_mode {
        return match key.code {
            KeyCode::Esc => SessionEvent::Cancel,
            KeyCode::Enter => SessionEvent::Confirm,
            KeyCode::Backspace => SessionEvent::DeleteBack,
            KeyCode::Char(c) if !key.modifiers.contains(KeyModifiers::CONTROL) => {
                SessionEvent::Append(c)
            }
            _ => SessionEvent::NotHandled,
        };
    }
    match key.code {
        KeyCode::Char('/') => SessionEvent::Open,
        KeyCode::Esc if session_active => SessionEvent::Cancel,
        _ => SessionEvent::NotHandled,
    }
}

/// Filter session details shown while the task filter is active.
#[derive(Debug, Clone)]
pub struct FilterProps {
    pub text: String,
    /// True while the filter is being typed; the bar swaps to the input row.
    /// A confirmed filter renders compactly in the middle slot instead.
    pub input_mode: bool,
    pub hidden_count: usize,
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

impl PaneSearchProps {
    /// Bottom-up match position, matching the backward-from-the-bottom n/N
    /// navigation: the newest (bottom-most) match is `1`, the oldest is `N`.
    /// `current` is the index in ascending-row order.
    pub(crate) fn position(&self) -> usize {
        self.total - self.current
    }

    pub(crate) fn input_counts(&self) -> Option<String> {
        if self.total > 0 {
            Some(format!("{}/{} matches", self.position(), self.total))
        } else if self.query.is_empty() {
            None
        } else {
            Some("no matches".to_string())
        }
    }

    pub(crate) fn confirmed_text(&self) -> String {
        if self.total > 0 {
            confirmed_text(
                &self.query,
                Some(format!("{}/{}", self.position(), self.total)),
                "n/N, / to edit",
            )
        } else {
            confirmed_text(&self.query, Some("no matches".to_string()), "/ to edit")
        }
    }
}

impl FilterProps {
    pub(crate) fn input_counts(&self) -> Option<String> {
        (self.hidden_count > 0).then(|| format!("{} tasks filtered out", self.hidden_count))
    }

    pub(crate) fn confirmed_text(&self) -> String {
        let counts = (self.hidden_count > 0).then(|| format!("{} hidden", self.hidden_count));
        confirmed_text(&self.text, counts, "/ to edit")
    }
}
