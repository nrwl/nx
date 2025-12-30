use color_eyre::eyre::Result;
use crossterm::event::{KeyCode, KeyEvent};
use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, Clear, Padding, Paragraph},
};
use std::any::Any;

use crate::native::tui::action::Action;
use crate::native::tui::theme::THEME;

use super::Component;

/// A modal confirmation dialog for destructive actions
///
/// Displays a centered dialog with a message and Yes/No buttons.
/// Defaults to "No" for safety. Supports keyboard navigation and shortcuts.
pub struct ConfirmDialog {
    visible: bool,
    message: String,
    pending_action: Option<Action>,
    selected_yes: bool, // false = No selected (default for safety)
}

impl ConfirmDialog {
    /// Create a new confirmation dialog
    pub fn new() -> Self {
        Self {
            visible: false,
            message: String::new(),
            pending_action: None,
            selected_yes: false, // Default to No for safety
        }
    }

    /// Show the dialog with a message and action to execute if confirmed
    ///
    /// # Arguments
    /// * `message` - The confirmation message to display
    /// * `action` - The action to execute if user confirms
    pub fn show(&mut self, message: String, action: Action) {
        self.visible = true;
        self.message = message;
        self.pending_action = Some(action);
        self.selected_yes = false; // Always default to No for safety
    }

    /// Hide the dialog
    pub fn hide(&mut self) {
        self.visible = false;
        self.pending_action = None;
    }

    /// Returns true if the dialog is currently visible
    pub fn is_visible(&self) -> bool {
        self.visible
    }

    /// Handle a key event
    ///
    /// Returns `Some(Action)` if the dialog should close:
    /// - `ConfirmAction(action)` if user confirmed
    /// - `CancelConfirmDialog` if user cancelled
    pub fn handle_key(&mut self, key: KeyEvent) -> Option<Action> {
        match key.code {
            // Navigation between Yes/No
            KeyCode::Left | KeyCode::Right | KeyCode::Tab => {
                self.selected_yes = !self.selected_yes;
                None
            }
            // Confirm selection
            KeyCode::Enter => {
                if self.selected_yes {
                    self.pending_action
                        .take()
                        .map(|a| Action::ConfirmAction(Box::new(a)))
                } else {
                    Some(Action::CancelConfirmDialog)
                }
            }
            // Shortcuts
            KeyCode::Char('y') | KeyCode::Char('Y') => self
                .pending_action
                .take()
                .map(|a| Action::ConfirmAction(Box::new(a))),
            KeyCode::Char('n') | KeyCode::Char('N') | KeyCode::Esc => {
                Some(Action::CancelConfirmDialog)
            }
            _ => None,
        }
    }

    /// Render the dialog centered on screen
    pub fn render(&self, f: &mut Frame<'_>, area: Rect) {
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

        // Calculate dialog dimensions
        let dialog_height: u16 = 7;
        let dialog_width: u16 = 50;

        // Make sure we don't exceed the available area
        let dialog_height = dialog_height.min(safe_area.height.saturating_sub(4));
        let dialog_width = dialog_width.min(safe_area.width.saturating_sub(4));

        // Center the dialog
        let x = safe_area.x + (safe_area.width.saturating_sub(dialog_width)) / 2;
        let y = safe_area.y + (safe_area.height.saturating_sub(dialog_height)) / 2;
        let dialog_area = Rect::new(x, y, dialog_width, dialog_height);

        // Clear the area behind the dialog
        f.render_widget(Clear, dialog_area);

        // Create the dialog block
        let block = Block::default()
            .title(Line::from(vec![
                Span::raw("  "),
                Span::styled(
                    " NX ",
                    Style::default()
                        .add_modifier(Modifier::BOLD)
                        .bg(THEME.warning)
                        .fg(THEME.primary_fg),
                ),
                Span::styled("  Confirm  ", Style::default().fg(THEME.primary_fg)),
            ]))
            .title_alignment(Alignment::Left)
            .borders(Borders::ALL)
            .border_type(BorderType::Plain)
            .border_style(Style::default().fg(THEME.warning))
            .padding(Padding::proportional(1));

        let inner = block.inner(dialog_area);

        // Layout: message on top, buttons at bottom
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Min(1),    // Message
                Constraint::Length(1), // Spacer
                Constraint::Length(1), // Buttons
            ])
            .split(inner);

        // Render the block
        f.render_widget(block, dialog_area);

        // Render message
        let message = Paragraph::new(self.message.clone())
            .alignment(Alignment::Center)
            .style(Style::default().fg(THEME.primary_fg));
        f.render_widget(message, chunks[0]);

        // Render buttons
        let yes_style = if self.selected_yes {
            Style::default()
                .fg(THEME.primary_fg)
                .bg(THEME.success)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(THEME.secondary_fg)
        };

        let no_style = if !self.selected_yes {
            Style::default()
                .fg(THEME.primary_fg)
                .bg(THEME.error)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(THEME.secondary_fg)
        };

        let buttons = Line::from(vec![
            Span::raw("  "),
            Span::styled(" Yes (y) ", yes_style),
            Span::raw("   "),
            Span::styled(" No (n) ", no_style),
            Span::raw("  "),
        ]);

        let buttons_para = Paragraph::new(buttons).alignment(Alignment::Center);
        f.render_widget(buttons_para, chunks[2]);
    }

    /// Get a reference to the pending action
    pub fn pending_action(&self) -> Option<&Action> {
        self.pending_action.as_ref()
    }
}

impl Default for ConfirmDialog {
    fn default() -> Self {
        Self::new()
    }
}

impl Component for ConfirmDialog {
    fn handle_key_event(&mut self, key: KeyEvent) -> Result<Option<Action>> {
        if self.visible {
            Ok(self.handle_key(key))
        } else {
            Ok(None)
        }
    }

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
