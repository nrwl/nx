use ratatui::{
    layout::{Alignment, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use crate::native::tui::theme::THEME;

pub struct HelpText {
    collapsed_mode: bool,
    is_dimmed: bool,
    align_left: bool,
}

impl HelpText {
    pub fn new(collapsed_mode: bool, is_dimmed: bool, align_left: bool) -> Self {
        Self {
            collapsed_mode,
            is_dimmed,
            align_left,
        }
    }

    pub fn set_collapsed_mode(&mut self, collapsed: bool) {
        self.collapsed_mode = collapsed;
    }

    pub fn render(&self, f: &mut Frame<'_>, area: Rect) {
        // Add a safety check to prevent rendering outside buffer bounds (this can happen if the user resizes the window a lot before it stabilizes it seems)
        if area.height == 0
            || area.width == 0
            || area.x >= f.area().width
            || area.y >= f.area().height
        {
            return; // Area is out of bounds, don't try to render
        }

        // Ensure area is entirely within frame bounds
        let safe_area = Rect {
            x: area.x,
            y: area.y,
            width: area.width.min(f.area().width.saturating_sub(area.x)),
            height: area.height.min(f.area().height.saturating_sub(area.y)),
        };

        let base_style = if self.is_dimmed {
            Style::default().add_modifier(Modifier::DIM)
        } else {
            Style::default()
        };
        let key_style = base_style.fg(THEME.info);
        let label_style = base_style.fg(THEME.secondary_fg);

        if self.collapsed_mode {
            // Show minimal hint
            let hint = vec![
                Span::styled("quit: ", label_style),
                Span::styled("q", key_style),
                Span::styled("  ", label_style),
                Span::styled("help: ", label_style),
                Span::styled("?", key_style),
            ];
            f.render_widget(
                Paragraph::new(Line::from(hint)).alignment(if self.align_left {
                    Alignment::Left
                } else {
                    Alignment::Right
                }),
                safe_area,
            );
        } else {
            // Show full shortcuts
            let shortcuts = vec![
                Span::styled("quit: ", label_style),
                Span::styled("q", key_style),
                Span::styled("  ", label_style),
                Span::styled("help: ", label_style),
                Span::styled("?", key_style),
                Span::styled("  ", label_style),
                Span::styled("navigate: ", label_style),
                Span::styled("↑ ↓", key_style),
                Span::styled("  ", label_style),
                Span::styled("filter: ", label_style),
                Span::styled("/", key_style),
                Span::styled("  ", label_style),
                Span::styled("pin output: ", label_style),
                Span::styled("", label_style),
                Span::styled("1", key_style),
                Span::styled(" or ", label_style),
                Span::styled("2", key_style),
                Span::styled("  ", label_style),
                Span::styled("show output: ", label_style),
                Span::styled("<enter>", key_style),
            ];

            f.render_widget(
                Paragraph::new(Line::from(shortcuts)).alignment(Alignment::Right),
                safe_area,
            );
        }
    }
}
