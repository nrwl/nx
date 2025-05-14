use crate::native::tui::theme::THEME;
use ratatui::{
    Frame,
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
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

    /// Renders the pagination at the given location with the specified focus state.
    pub fn render(&self, f: &mut Frame<'_>, area: Rect, is_dimmed: bool) {
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

        let base_style = if is_dimmed {
            Style::default().add_modifier(Modifier::DIM)
        } else {
            Style::default()
        };

        let mut spans = vec![];

        // Ensure we have at least 1 page
        let total_pages = self.total_pages.max(1);
        let current_page = self.current_page.min(total_pages - 1);

        // Left arrow - dim if we're on the first page
        let left_arrow = if current_page == 0 {
            Span::styled("←", base_style.fg(THEME.info).add_modifier(Modifier::DIM))
        } else {
            Span::styled("←", base_style.fg(THEME.info))
        };
        spans.push(left_arrow);

        // Page numbers
        spans.push(Span::raw(" "));
        spans.push(Span::styled(
            format!("{}/{}", current_page + 1, total_pages),
            base_style.fg(THEME.secondary_fg),
        ));
        spans.push(Span::raw(" "));

        // Right arrow - dim if we're on the last page
        let right_arrow = if current_page >= total_pages.saturating_sub(1) {
            Span::styled("→", base_style.fg(THEME.info).add_modifier(Modifier::DIM))
        } else {
            Span::styled("→", base_style.fg(THEME.info))
        };
        spans.push(right_arrow);

        let pagination_line = Line::from(spans);
        let pagination = Paragraph::new(pagination_line);

        f.render_widget(pagination, safe_area);
    }
}
