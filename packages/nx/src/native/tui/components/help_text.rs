use ratatui::{
    layout::{Alignment, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

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
        let base_style = if self.is_dimmed {
            Style::default().add_modifier(Modifier::DIM)
        } else {
            Style::default()
        };

        if self.collapsed_mode {
            // Show minimal hint
            let hint = vec![
                Span::styled("?", base_style.fg(Color::Cyan)),
                Span::styled(" for help   ", base_style.fg(Color::DarkGray)),
            ];
            f.render_widget(
                Paragraph::new(Line::from(hint)).alignment(if self.align_left {
                    Alignment::Left
                } else {
                    Alignment::Right
                }),
                area,
            );
        } else {
            // Show full shortcuts
            let shortcuts = vec![
                Span::styled("help: ", base_style.fg(Color::DarkGray)),
                Span::styled("?", base_style.fg(Color::Cyan)),
                Span::styled(" | ", base_style.fg(Color::DarkGray)),
                Span::styled("navigate: ", base_style.fg(Color::DarkGray)),
                Span::styled("↑ ↓", base_style.fg(Color::Cyan)),
                Span::styled(" | ", base_style.fg(Color::DarkGray)),
                Span::styled("filter: ", base_style.fg(Color::DarkGray)),
                Span::styled("/", base_style.fg(Color::Cyan)),
                Span::styled(" | ", base_style.fg(Color::DarkGray)),
                Span::styled("pin output: ", base_style.fg(Color::DarkGray)),
                Span::styled("", base_style.fg(Color::DarkGray)),
                Span::styled("1", base_style.fg(Color::Cyan)),
                Span::styled(" or ", base_style.fg(Color::DarkGray)),
                Span::styled("2", base_style.fg(Color::Cyan)),
                Span::styled(" | ", base_style.fg(Color::DarkGray)),
                Span::styled("focus output: ", base_style.fg(Color::DarkGray)),
                Span::styled("<tab>", base_style.fg(Color::Cyan)),
            ];

            f.render_widget(
                Paragraph::new(Line::from(shortcuts)).alignment(Alignment::Center),
                area,
            );
        }
    }
}
