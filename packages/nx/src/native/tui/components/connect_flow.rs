//! Shared state and rendering for the TUI's connect-to-Nx-Cloud flow.
//!
//! The flow is owned by JS: pressing the connect shortcut fires a callback that
//! runs the same logic as `nx connect` headlessly and pushes the resulting
//! onboarding URL (or an error) back through the lifecycle. This module holds
//! the resulting state plus the two presentations of it, so any popup can host
//! the flow: [`ConnectFlowState::detail_lines`] for a popup dedicated to
//! connecting, and [`ConnectFlowState::inline_line`] for a single line embedded
//! under another popup's content (the run report).
//!
//! The state lives in `TuiState` rather than on a popup so it survives mode
//! switches and so a URL arriving while in inline mode is not dropped.

use ratatui::{style::Style, text::Span};

use crate::native::tui::theme::THEME;

use super::link::Link;
use super::nx_paragraph::{NxLine, NxSpan};

/// The shortcut that starts the flow, in the notation the rest of the TUI uses
/// for hints. Uppercase `C` only: lowercase `c` copies pane output.
pub const CONNECT_KEY_HINT: &str = "<shift>+c";

/// Sentinel `href` for a clickable connect call-to-action. It is registered in
/// a link registry like a real link so its rendered rect is hit-testable, but
/// the app intercepts it and starts the flow instead of opening a browser.
pub const CONNECT_CTA_HREF: &str = "nx-tui://connect-to-nx-cloud";

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum ConnectFlowState {
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

impl ConnectFlowState {
    /// Whether pressing the shortcut should start a (new) attempt. A `Ready`
    /// URL is kept — reopening shows it again without connecting twice — and an
    /// `Error` allows a retry.
    pub fn needs_attempt(&self) -> bool {
        matches!(self, Self::NotStarted | Self::Error(_))
    }

    /// The onboarding URL, once the attempt succeeded.
    pub fn url(&self) -> Option<&str> {
        match self {
            Self::Ready(url) => Some(url),
            _ => None,
        }
    }

    /// The full presentation, for a popup whose only job is connecting.
    pub fn detail_lines(&self) -> Vec<NxLine> {
        let primary = Style::default().fg(THEME.primary_fg);
        match self {
            Self::NotStarted | Self::Loading => {
                vec![NxLine::from_spans(vec![text(
                    "Generating your Nx Cloud connect URL...",
                    primary,
                )])]
            }
            Self::Ready(url) => vec![
                NxLine::from_spans(vec![text(
                    "Follow this link to finish connecting your workspace to Nx Cloud.",
                    primary,
                )]),
                NxLine::from_spans(vec![text("The setup takes about 2 minutes:", primary)]),
                NxLine::default(),
                // A curated link so a click always opens the full href, even
                // when the display text wraps across rows.
                NxLine::from_spans(vec![NxSpan::Link(Link::new(url, url))]),
            ],
            Self::Error(message) => vec![
                NxLine::from_spans(vec![text(
                    "Could not connect to Nx Cloud.",
                    Style::default().fg(THEME.error),
                )]),
                NxLine::default(),
                NxLine::from_spans(vec![text(message, primary)]),
                NxLine::default(),
                NxLine::from_spans(vec![
                    text("Press ", Style::default().fg(THEME.secondary_fg)),
                    text(CONNECT_KEY_HINT, Style::default().fg(THEME.info)),
                    text(
                        " to try again, or run `nx connect` in your terminal.",
                        Style::default().fg(THEME.secondary_fg),
                    ),
                ]),
            ],
        }
    }

    /// The compact presentation, for embedding under another popup's content.
    /// `None` before an attempt starts, so the host popup reserves no rows.
    pub fn inline_line(&self) -> Option<NxLine> {
        match self {
            Self::NotStarted => None,
            Self::Loading => Some(NxLine::from_spans(vec![text(
                "Generating your Nx Cloud connect URL...",
                Style::default().fg(THEME.secondary_fg),
            )])),
            Self::Ready(url) => Some(NxLine::from_spans(vec![
                text("Finish your setup: ", Style::default().fg(THEME.primary_fg)),
                NxSpan::Link(Link::new(url, url)),
            ])),
            Self::Error(message) => Some(NxLine::from_spans(vec![text(
                &format!("Could not connect: {message}"),
                Style::default().fg(THEME.error),
            )])),
        }
    }
}

/// The keyboard hint advertising the flow, styled like the TUI's other hints.
/// `label` lets the host popup phrase the outcome in its own terms (the run
/// report sells remote cache rather than the connection itself).
pub fn cta_spans(label: &'static str) -> Vec<Span<'static>> {
    vec![
        Span::styled(label, Style::default().fg(THEME.secondary_fg)),
        Span::styled(CONNECT_KEY_HINT, Style::default().fg(THEME.info)),
    ]
}

fn text(content: &str, style: Style) -> NxSpan {
    NxSpan::Text(Span::styled(content.to_string(), style))
}
