use color_eyre::eyre::Result;
use ratatui::{
    Frame,
    layout::{Alignment, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, Clear, Padding, Paragraph},
};
use std::any::Any;
use std::time::{Duration, Instant};

use crate::native::tui::theme::THEME;

use super::Component;

/// Default duration before the hint popup auto-dismisses
const AUTO_DISMISS_DURATION: Duration = Duration::from_secs(2);
/// Default popup dimensions
const POPUP_HEIGHT: u16 = 7;
const POPUP_WIDTH: u16 = 80;

/// A reusable popup component for displaying contextual hints and guidance to users.
/// Used to show informational messages that auto-dismiss after a configurable duration
/// or when the user presses ESC.
pub struct HintPopup {
    visible: bool,
    message: String,
    shown_at: Option<Instant>,
    auto_dismiss_duration: Duration,
}

impl HintPopup {
    pub fn new() -> Self {
        Self {
            visible: false,
            message: String::new(),
            shown_at: None,
            auto_dismiss_duration: AUTO_DISMISS_DURATION,
        }
    }

    /// Shows the popup with the given message
    pub fn show(&mut self, message: String) {
        self.visible = true;
        self.message = message;
        self.shown_at = Some(Instant::now());
    }

    /// Hides the popup
    pub fn hide(&mut self) {
        self.visible = false;
        self.shown_at = None;
    }

    /// Returns true if the popup is currently visible
    pub fn is_visible(&self) -> bool {
        self.visible
    }

    /// Returns true if the popup should be auto-dismissed based on elapsed time
    pub fn should_auto_dismiss(&self) -> bool {
        self.shown_at
            .is_some_and(|t| t.elapsed() >= self.auto_dismiss_duration)
    }

    pub fn render(&mut self, f: &mut Frame<'_>, area: Rect) {
        // Add a safety check to prevent rendering outside buffer bounds
        if area.height == 0
            || area.width == 0
            || area.x >= f.area().width
            || area.y >= f.area().height
        {
            return;
        }

        // Ensure area is entirely within frame bounds
        let safe_area = Rect {
            x: area.x,
            y: area.y,
            width: area.width.min(f.area().width.saturating_sub(area.x)),
            height: area.height.min(f.area().height.saturating_sub(area.y)),
        };

        // Make sure we don't exceed the available area
        let popup_height = POPUP_HEIGHT.min(safe_area.height.saturating_sub(4));
        let popup_width = POPUP_WIDTH.min(safe_area.width.saturating_sub(4));

        // Calculate the top-left position to center the popup
        let popup_x = safe_area.x + (safe_area.width.saturating_sub(popup_width)) / 2;
        let popup_y = safe_area.y + (safe_area.height.saturating_sub(popup_height)) / 2;

        // Create popup area with fixed dimensions
        let popup_area = Rect::new(popup_x, popup_y, popup_width, popup_height);

        let content = vec![Line::from(vec![Span::styled(
            &self.message,
            Style::default().fg(THEME.primary_fg),
        )])];

        // Build dismiss hint for bottom border
        let dismiss_hint = Line::from(vec![
            Span::styled("  Press ", Style::default().fg(THEME.secondary_fg)),
            Span::styled("ESC", Style::default().fg(THEME.info)),
            Span::styled(" to dismiss  ", Style::default().fg(THEME.secondary_fg)),
        ]);

        let block = Block::default()
            .title(Line::from(vec![
                Span::raw("  "),
                Span::styled(
                    " NX ",
                    Style::default()
                        .add_modifier(Modifier::BOLD)
                        .bg(THEME.info)
                        .fg(THEME.primary_fg),
                ),
                Span::styled("  ", Style::default().fg(THEME.primary_fg)),
            ]))
            .title_alignment(Alignment::Left)
            .title_bottom(dismiss_hint.alignment(Alignment::Right))
            .borders(Borders::ALL)
            .border_type(BorderType::Plain)
            .border_style(Style::default().fg(THEME.info))
            .padding(Padding::proportional(1));

        let popup = Paragraph::new(content)
            .block(block)
            .wrap(ratatui::widgets::Wrap { trim: true });

        // Render popup
        f.render_widget(Clear, popup_area);
        f.render_widget(popup, popup_area);
    }
}

impl Default for HintPopup {
    fn default() -> Self {
        Self::new()
    }
}

impl Component for HintPopup {
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
