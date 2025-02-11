use ratatui::{
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

pub struct Pagination {
    current_page: usize,
    total_pages: usize,
}

impl Pagination {
    pub fn new(current_page: usize, total_pages: usize) -> Self {
        Self {
            current_page,
            total_pages,
        }
    }

    pub fn render(&self, f: &mut Frame<'_>, area: Rect, is_dimmed: bool) {
        let base_style = if is_dimmed {
            Style::default().add_modifier(Modifier::DIM)
        } else {
            Style::default()
        };

        // Left indentation to align with other elements
        let mut spans = vec![Span::raw("         ")];

        // Left arrow - dim if we're on the first page
        let left_arrow = if self.current_page == 0 {
            Span::styled("←", base_style.fg(Color::Cyan).add_modifier(Modifier::DIM))
        } else {
            Span::styled("←", base_style.fg(Color::Cyan))
        };
        spans.push(left_arrow);

        // Page numbers
        spans.push(Span::raw(" "));
        spans.push(Span::styled(
            format!("{}/{}", self.current_page + 1, self.total_pages),
            base_style.fg(Color::DarkGray),
        ));
        spans.push(Span::raw(" "));

        // Right arrow - dim if we're on the last page
        let right_arrow = if self.current_page >= self.total_pages.saturating_sub(1) {
            Span::styled("→", base_style.fg(Color::Cyan).add_modifier(Modifier::DIM))
        } else {
            Span::styled("→", base_style.fg(Color::Cyan))
        };
        spans.push(right_arrow);

        let pagination_line = Line::from(spans);
        let pagination = Paragraph::new(pagination_line);

        f.render_widget(pagination, area);
    }
}
