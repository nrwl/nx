//! A reusable, clickable link to an external HTTP resource.
//!
//! Ratatui spans don't know where they were rendered, so a clickable piece of
//! text has to record its own rect at draw time. [`Link`] is a
//! [`StatefulWidget`] whose state is a [`LinkRegistry`]: rendering a link draws
//! its (styled, underlined) display text into the given area and pushes the
//! drawn rect plus the underlying `href` into the registry. The app hit-tests
//! the registry on click and opens the matching `href`.
//!
//! The display text and the `href` are intentionally separate, so a link can
//! show "View in Nx Cloud" while opening `https://nx.app/...`. This also
//! subsumes the "truncate the visible URL but open the full one" behaviour: the
//! registered `href` is always the full target even when the display is clipped.
//!
//! Links are styled persistently (underline + the info/accent colour) rather
//! than reacting to pointer hover. The TUI deliberately enables only a narrow
//! set of mouse modes (no all-motion tracking), so bare hover produces no
//! events to react to — see `tui.rs`.

use crate::native::tui::strings::{display_width, fit_with_ellipsis};
use ratatui::{
    buffer::Buffer,
    layout::{Position, Rect},
    style::{Modifier, Style},
    widgets::StatefulWidget,
};

use crate::native::tui::theme::THEME;

/// A single rendered link's clickable rect and the resource it opens.
#[derive(Debug, Clone, PartialEq, Eq)]
struct LinkHit {
    area: Rect,
    href: String,
}

/// Per-frame collection of rendered links for one component.
///
/// Cleared at the top of every draw pass and repopulated as links render, so a
/// component that isn't drawn this frame holds no stale hits.
#[derive(Debug, Default, Clone)]
pub struct LinkRegistry {
    hits: Vec<LinkHit>,
}

impl LinkRegistry {
    pub fn new() -> Self {
        Self { hits: Vec::new() }
    }

    /// Drop all recorded hits. Call at the start of each draw.
    pub fn clear(&mut self) {
        self.hits.clear();
    }

    /// Record a rendered link.
    pub fn push(&mut self, area: Rect, href: String) {
        self.hits.push(LinkHit { area, href });
    }

    /// Return the `href` of the link at `(col, row)`, if any. Later-registered
    /// links win on overlap (they were drawn on top).
    pub fn hit_test(&self, col: u16, row: u16) -> Option<&str> {
        self.hits
            .iter()
            .rev()
            .find(|hit| hit.area.contains(Position::new(col, row)))
            .map(|hit| hit.href.as_str())
    }
}

/// A clickable link to an external HTTP resource.
#[derive(Debug, Clone)]
pub struct Link {
    display: String,
    href: String,
    dim: bool,
}

impl Link {
    pub fn new(display: impl Into<String>, href: impl Into<String>) -> Self {
        Self {
            display: display.into(),
            href: href.into(),
            dim: false,
        }
    }

    /// Render the link dimmed (e.g. for an unfocused pane).
    pub fn dim(mut self, dim: bool) -> Self {
        self.dim = dim;
        self
    }

    pub fn href(&self) -> &str {
        &self.href
    }

    /// The text shown for the link (distinct from the opened `href`).
    pub fn display(&self) -> &str {
        &self.display
    }

    pub(crate) fn style(&self) -> Style {
        let mut style = Style::default()
            .fg(THEME.info)
            .add_modifier(Modifier::UNDERLINED);
        if self.dim {
            style = style.add_modifier(Modifier::DIM);
        }
        style
    }
}

impl StatefulWidget for &Link {
    type State = LinkRegistry;

    fn render(self, area: Rect, buf: &mut Buffer, registry: &mut Self::State) {
        if area.width == 0 || area.height == 0 {
            return;
        }

        let text = fit_with_ellipsis(&self.display, area.width as usize);
        let drawn_width = (display_width(&text) as u16).min(area.width);
        if drawn_width == 0 {
            return;
        }

        buf.set_stringn(area.x, area.y, &text, area.width as usize, self.style());

        registry.push(
            Rect {
                x: area.x,
                y: area.y,
                width: drawn_width,
                height: 1,
            },
            self.href.clone(),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rect(x: u16, y: u16, width: u16, height: u16) -> Rect {
        Rect {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn hit_test_returns_href_for_point_inside() {
        let mut registry = LinkRegistry::new();
        registry.push(rect(5, 2, 16, 1), "https://nx.app/run".to_string());

        assert_eq!(registry.hit_test(5, 2), Some("https://nx.app/run"));
        assert_eq!(registry.hit_test(20, 2), Some("https://nx.app/run"));
    }

    #[test]
    fn hit_test_returns_none_for_point_outside() {
        let mut registry = LinkRegistry::new();
        registry.push(rect(5, 2, 16, 1), "https://nx.app/run".to_string());

        assert_eq!(registry.hit_test(4, 2), None); // left of link
        assert_eq!(registry.hit_test(21, 2), None); // right of link
        assert_eq!(registry.hit_test(10, 3), None); // wrong row
    }

    #[test]
    fn hit_test_is_empty_when_nothing_registered() {
        let registry = LinkRegistry::new();
        assert_eq!(registry.hit_test(0, 0), None);
    }

    #[test]
    fn hit_test_overlap_prefers_last_registered() {
        let mut registry = LinkRegistry::new();
        registry.push(rect(0, 0, 10, 1), "first".to_string());
        registry.push(rect(0, 0, 10, 1), "second".to_string());

        assert_eq!(registry.hit_test(3, 0), Some("second"));
    }

    #[test]
    fn clear_drops_all_hits() {
        let mut registry = LinkRegistry::new();
        registry.push(rect(0, 0, 10, 1), "x".to_string());
        registry.clear();
        assert_eq!(registry.hit_test(3, 0), None);
    }

    #[test]
    fn render_draws_display_text_and_registers_href() {
        let area = rect(0, 0, 20, 1);
        let mut buf = Buffer::empty(area);
        let mut registry = LinkRegistry::new();

        let link = Link::new("View in Nx Cloud", "https://nx.app/runs/abc");
        StatefulWidget::render(&link, area, &mut buf, &mut registry);

        let rendered: String = (0..16).map(|x| buf[(x, 0)].symbol()).collect();
        assert_eq!(rendered, "View in Nx Cloud");

        // The drawn text (16 cols), not the whole area, is the click target, and
        // the full href is recorded.
        assert_eq!(registry.hit_test(0, 0), Some("https://nx.app/runs/abc"));
        assert_eq!(registry.hit_test(15, 0), Some("https://nx.app/runs/abc"));
        assert_eq!(registry.hit_test(16, 0), None); // blank space past the text
    }

    #[test]
    fn render_styles_text_underlined_in_info_colour() {
        let area = rect(0, 0, 10, 1);
        let mut buf = Buffer::empty(area);
        let mut registry = LinkRegistry::new();

        let link = Link::new("docs", "https://nx.dev");
        StatefulWidget::render(&link, area, &mut buf, &mut registry);

        let cell = &buf[(0, 0)];
        assert_eq!(cell.fg, THEME.info);
        assert!(cell.modifier.contains(Modifier::UNDERLINED));
        assert!(!cell.modifier.contains(Modifier::DIM));
    }

    #[test]
    fn render_dim_applies_dim_modifier() {
        let area = rect(0, 0, 10, 1);
        let mut buf = Buffer::empty(area);
        let mut registry = LinkRegistry::new();

        let link = Link::new("docs", "https://nx.dev").dim(true);
        StatefulWidget::render(&link, area, &mut buf, &mut registry);

        assert!(buf[(0, 0)].modifier.contains(Modifier::DIM));
    }

    #[test]
    fn render_truncates_with_ellipsis_but_registers_full_href() {
        let area = rect(0, 0, 8, 1);
        let mut buf = Buffer::empty(area);
        let mut registry = LinkRegistry::new();

        let link = Link::new("View in Nx Cloud", "https://nx.app/runs/abc");
        StatefulWidget::render(&link, area, &mut buf, &mut registry);

        let rendered: String = (0..8).map(|x| buf[(x, 0)].symbol()).collect();
        assert_eq!(rendered, "View ...");
        // Clicking the truncated display still opens the full href.
        assert_eq!(registry.hit_test(0, 0), Some("https://nx.app/runs/abc"));
        assert_eq!(registry.hit_test(7, 0), Some("https://nx.app/runs/abc"));
    }

    #[test]
    fn render_into_zero_width_area_registers_nothing() {
        let area = rect(0, 0, 0, 1);
        let mut buf = Buffer::empty(rect(0, 0, 1, 1));
        let mut registry = LinkRegistry::new();

        let link = Link::new("docs", "https://nx.dev");
        StatefulWidget::render(&link, area, &mut buf, &mut registry);

        assert_eq!(registry.hit_test(0, 0), None);
    }
}
