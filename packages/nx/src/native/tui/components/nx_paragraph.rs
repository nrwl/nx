//! `NxParagraph` — a paragraph widget that can embed clickable [`Link`]s and
//! reports their rendered positions, so links never need a post-render buffer
//! scan.
//!
//! For link-less content it delegates to ratatui's `Paragraph` (byte-identical
//! output, zero migration churn). When a line actually contains a [`Link`] it
//! owns the placement instead, drawing each span with `Buffer::set_stringn` and
//! recording every link's drawn rect into a [`LinkRegistry`] — the position is a
//! byproduct of placing the span, not something recovered afterwards.
//!
//! This module is the ONLY sanctioned user of ratatui's `Paragraph`; everywhere
//! else it's banned via clippy `disallowed_types`. Use `NxParagraph` instead.

use ratatui::{
    buffer::Buffer,
    layout::{Alignment, Rect},
    style::Style,
    text::{Line, Span, Text},
    widgets::{Block, StatefulWidget, Widget, Wrap},
};

use super::link::{Link, LinkRegistry};

fn text_width(s: &str) -> u16 {
    Span::raw(s).width() as u16
}

/// One inline piece of a line: plain styled text, or a clickable link.
#[derive(Debug, Clone)]
pub enum NxSpan {
    Text(Span<'static>),
    Link(Link),
}

impl NxSpan {
    fn content(&self) -> String {
        match self {
            NxSpan::Text(s) => s.content.to_string(),
            NxSpan::Link(l) => l.display().to_string(),
        }
    }

    fn style(&self) -> Style {
        match self {
            NxSpan::Text(s) => s.style,
            NxSpan::Link(l) => l.style(),
        }
    }

    fn href(&self) -> Option<String> {
        match self {
            NxSpan::Link(l) => Some(l.href().to_string()),
            NxSpan::Text(_) => None,
        }
    }

    /// The equivalent ratatui span (keeps styled text, drops link semantics).
    fn to_span(&self) -> Span<'static> {
        match self {
            NxSpan::Text(s) => s.clone(),
            NxSpan::Link(l) => Span::styled(l.display().to_string(), l.style()),
        }
    }
}

impl From<Span<'static>> for NxSpan {
    fn from(s: Span<'static>) -> Self {
        NxSpan::Text(s)
    }
}

impl From<Link> for NxSpan {
    fn from(l: Link) -> Self {
        NxSpan::Link(l)
    }
}

/// A line of [`NxSpan`]s.
#[derive(Debug, Clone, Default)]
pub struct NxLine {
    spans: Vec<NxSpan>,
}

impl NxLine {
    pub fn from_spans(spans: Vec<NxSpan>) -> Self {
        Self { spans }
    }

    fn has_links(&self) -> bool {
        self.spans.iter().any(|s| matches!(s, NxSpan::Link(_)))
    }

    fn to_line(&self) -> Line<'static> {
        Line::from(self.spans.iter().map(NxSpan::to_span).collect::<Vec<_>>())
    }

    /// Unwrapped display width of the line.
    pub fn width(&self) -> u16 {
        self.spans.iter().map(|s| text_width(&s.content())).sum()
    }
}

impl From<Line<'static>> for NxLine {
    fn from(l: Line<'static>) -> Self {
        Self {
            spans: l.spans.into_iter().map(NxSpan::Text).collect(),
        }
    }
}

impl From<Span<'static>> for NxLine {
    fn from(s: Span<'static>) -> Self {
        Self {
            spans: vec![NxSpan::Text(s)],
        }
    }
}

impl From<Vec<NxSpan>> for NxLine {
    fn from(spans: Vec<NxSpan>) -> Self {
        Self { spans }
    }
}

/// Paragraph content: a sequence of [`NxLine`]s.
#[derive(Debug, Clone, Default)]
pub struct NxText {
    lines: Vec<NxLine>,
}

impl NxText {
    fn has_links(&self) -> bool {
        self.lines.iter().any(NxLine::has_links)
    }

    /// Widest unwrapped line.
    pub fn max_width(&self) -> u16 {
        self.lines.iter().map(NxLine::width).max().unwrap_or(0)
    }

    /// Number of visual rows when word-wrapped to `width`.
    pub fn wrapped_rows(&self, width: u16, trim: bool) -> usize {
        self.layout_rows(width.max(1), true, trim).len()
    }

    fn to_text(&self) -> Text<'static> {
        Text::from(self.lines.iter().map(NxLine::to_line).collect::<Vec<_>>())
    }

    /// Lay the content out into visual rows of placed pieces, exactly as it will
    /// be drawn — the basis for both rendering link rects and counting rows.
    fn layout_rows(&self, width: u16, wrap: bool, trim: bool) -> Vec<Vec<Piece>> {
        let mut rows = Vec::new();
        for line in &self.lines {
            if wrap {
                wrap_line(line, width.max(1), trim, &mut rows);
            } else {
                rows.push(
                    line.spans
                        .iter()
                        .map(|s| {
                            let text = s.content();
                            let w = text_width(&text);
                            Piece {
                                text,
                                style: s.style(),
                                href: s.href(),
                                width: w,
                            }
                        })
                        .collect(),
                );
            }
        }
        rows
    }
}

impl From<&str> for NxText {
    fn from(s: &str) -> Self {
        Text::raw(s.to_string()).into()
    }
}

impl From<String> for NxText {
    fn from(s: String) -> Self {
        Text::raw(s).into()
    }
}

impl From<Span<'static>> for NxText {
    fn from(s: Span<'static>) -> Self {
        Self {
            lines: vec![NxLine::from(s)],
        }
    }
}

impl From<Line<'static>> for NxText {
    fn from(l: Line<'static>) -> Self {
        Self {
            lines: vec![NxLine::from(l)],
        }
    }
}

impl From<Text<'static>> for NxText {
    fn from(t: Text<'static>) -> Self {
        Self {
            lines: t.lines.into_iter().map(NxLine::from).collect(),
        }
    }
}

impl From<Vec<Line<'static>>> for NxText {
    fn from(lines: Vec<Line<'static>>) -> Self {
        Self {
            lines: lines.into_iter().map(NxLine::from).collect(),
        }
    }
}

impl From<NxLine> for NxText {
    fn from(line: NxLine) -> Self {
        Self { lines: vec![line] }
    }
}

impl From<Vec<NxLine>> for NxText {
    fn from(lines: Vec<NxLine>) -> Self {
        Self { lines }
    }
}

/// A placed run of text on a single visual row, with its display width and
/// (optional) link target.
#[derive(Debug, Clone)]
struct Piece {
    text: String,
    style: Style,
    href: Option<String>,
    width: u16,
}

/// Greedily word-wrap one line into `rows` at `width` columns (matching
/// ratatui's `Wrap { trim }` closely enough; the only consumers are link-bearing
/// paragraphs, whose snapshots are reconciled against this).
fn wrap_line(line: &NxLine, width: u16, trim: bool, rows: &mut Vec<Vec<Piece>>) {
    // Tokenize into whitespace / non-whitespace runs, carrying each run's style
    // and link target.
    let mut tokens: Vec<(String, Style, Option<String>, bool)> = Vec::new();
    for span in &line.spans {
        let content = span.content();
        let style = span.style();
        let href = span.href();
        let mut cur = String::new();
        let mut cur_is_space: Option<bool> = None;
        for ch in content.chars() {
            let is_space = ch == ' ';
            match cur_is_space {
                Some(s) if s == is_space => cur.push(ch),
                _ => {
                    if let Some(was_space) = cur_is_space {
                        tokens.push((std::mem::take(&mut cur), style, href.clone(), was_space));
                    }
                    cur.push(ch);
                    cur_is_space = Some(is_space);
                }
            }
        }
        if let Some(was_space) = cur_is_space {
            tokens.push((cur, style, href.clone(), was_space));
        }
    }

    let mut row: Vec<Piece> = Vec::new();
    let mut row_w: u16 = 0;
    for (text, style, href, is_space) in tokens {
        let tw = text_width(&text);

        if is_space && row.is_empty() && trim {
            continue; // trim leading whitespace at the start of a wrapped row
        }

        if row_w + tw > width && !row.is_empty() {
            rows.push(std::mem::take(&mut row));
            row_w = 0;
            if is_space && trim {
                continue; // the space that caused the wrap is dropped when trimming
            }
        }

        // A single token wider than the line is hard-broken across rows.
        if tw > width {
            if !row.is_empty() {
                rows.push(std::mem::take(&mut row));
                row_w = 0;
            }
            for chunk in hard_break(&text, width) {
                let cw = text_width(&chunk);
                rows.push(vec![Piece {
                    text: chunk,
                    style,
                    href: href.clone(),
                    width: cw,
                }]);
            }
            continue;
        }

        push_piece(&mut row, &mut row_w, text, style, href, tw);
    }
    rows.push(row); // a trailing (possibly empty) row preserves blank lines
}

/// Append a run to the current row, merging into the previous piece when the
/// style and link target match (so a wrapped link stays one rect per row).
fn push_piece(
    row: &mut Vec<Piece>,
    row_w: &mut u16,
    text: String,
    style: Style,
    href: Option<String>,
    tw: u16,
) {
    match row.last_mut() {
        Some(last) if last.style == style && last.href == href => {
            last.text.push_str(&text);
            last.width += tw;
        }
        _ => row.push(Piece {
            text,
            style,
            href,
            width: tw,
        }),
    }
    *row_w += tw;
}

/// Break an over-wide token into chunks each no wider than `width` columns.
fn hard_break(text: &str, width: u16) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut cur = String::new();
    let mut cur_w = 0u16;
    for ch in text.chars() {
        let cw = text_width(&ch.to_string());
        if cur_w + cw > width && !cur.is_empty() {
            chunks.push(std::mem::take(&mut cur));
            cur_w = 0;
        }
        cur.push(ch);
        cur_w += cw;
    }
    if !cur.is_empty() {
        chunks.push(cur);
    }
    chunks
}

/// A paragraph that can embed clickable [`Link`]s. Drop-in for ratatui's
/// `Paragraph`; render with `render_stateful_widget(.., &mut LinkRegistry)` to
/// capture link positions, or `render_widget` when there are no links.
pub struct NxParagraph<'a> {
    text: NxText,
    block: Option<Block<'a>>,
    style: Style,
    wrap: Option<Wrap>,
    scroll: (u16, u16),
    alignment: Alignment,
}

impl<'a> NxParagraph<'a> {
    pub fn new(text: impl Into<NxText>) -> Self {
        Self {
            text: text.into(),
            block: None,
            style: Style::default(),
            wrap: None,
            scroll: (0, 0),
            alignment: Alignment::Left,
        }
    }

    pub fn block(mut self, block: Block<'a>) -> Self {
        self.block = Some(block);
        self
    }

    pub fn style(mut self, style: Style) -> Self {
        self.style = style;
        self
    }

    pub fn wrap(mut self, wrap: Wrap) -> Self {
        self.wrap = Some(wrap);
        self
    }

    pub fn scroll(mut self, scroll: (u16, u16)) -> Self {
        self.scroll = scroll;
        self
    }

    pub fn alignment(mut self, alignment: Alignment) -> Self {
        self.alignment = alignment;
        self
    }

    pub fn left_aligned(self) -> Self {
        self.alignment(Alignment::Left)
    }

    pub fn centered(self) -> Self {
        self.alignment(Alignment::Center)
    }

    pub fn right_aligned(self) -> Self {
        self.alignment(Alignment::Right)
    }

    /// Number of visual rows the content wraps to at `width` — uses the same
    /// layout as rendering, so scroll math stays consistent.
    pub fn line_count(&self, width: u16) -> usize {
        self.text
            .layout_rows(width.max(1), self.wrap.is_some(), self.trim())
            .len()
    }

    fn trim(&self) -> bool {
        self.wrap.map(|w| w.trim).unwrap_or(false)
    }

    /// Equivalent ratatui `Paragraph` for the link-less fast path. This module
    /// is the sanctioned wrapper, so ratatui's banned widget is allowed here.
    #[allow(clippy::disallowed_types, clippy::disallowed_methods)]
    fn to_ratatui(self) -> ratatui::widgets::Paragraph<'a> {
        let mut p = ratatui::widgets::Paragraph::new(self.text.to_text())
            .style(self.style)
            .scroll(self.scroll)
            .alignment(self.alignment);
        if let Some(block) = self.block {
            p = p.block(block);
        }
        if let Some(wrap) = self.wrap {
            p = p.wrap(wrap);
        }
        p
    }

    /// Own the placement so each link's drawn rect can be recorded.
    fn render_with_links(self, area: Rect, buf: &mut Buffer, registry: &mut LinkRegistry) {
        let style = self.style;
        let alignment = self.alignment;
        let wrap = self.wrap.is_some();
        let trim = self.trim();
        let scroll = self.scroll;

        let text_area = if let Some(block) = self.block {
            let inner = block.inner(area);
            block.render(area, buf);
            inner
        } else {
            area
        };
        if text_area.width == 0 || text_area.height == 0 {
            return;
        }
        buf.set_style(text_area, style);

        let rows = self.text.layout_rows(text_area.width, wrap, trim);
        let scroll_y = scroll.0 as usize;
        for (vis_idx, row) in rows
            .iter()
            .enumerate()
            .skip(scroll_y)
            .take(text_area.height as usize)
        {
            let y = text_area.y + (vis_idx - scroll_y) as u16;
            let row_w: u16 = row.iter().map(|p| p.width).sum();
            let mut x = match alignment {
                Alignment::Left => text_area.x,
                Alignment::Center => text_area.x + text_area.width.saturating_sub(row_w) / 2,
                Alignment::Right => text_area.x + text_area.width.saturating_sub(row_w),
            };
            for piece in row {
                if x >= text_area.right() {
                    break;
                }
                let max = (text_area.right() - x) as usize;
                let (end_x, _) = buf.set_stringn(x, y, &piece.text, max, piece.style);
                if let Some(href) = &piece.href {
                    let drawn_w = end_x.saturating_sub(x);
                    if drawn_w > 0 {
                        registry.push(
                            Rect {
                                x,
                                y,
                                width: drawn_w,
                                height: 1,
                            },
                            href.clone(),
                        );
                    }
                }
                x = end_x;
            }
        }
    }
}

impl Widget for NxParagraph<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if self.text.has_links() {
            // No registry to record into, but still draw correctly (links render
            // as styled text, just not clickable).
            let mut throwaway = LinkRegistry::new();
            self.render_with_links(area, buf, &mut throwaway);
        } else {
            self.to_ratatui().render(area, buf);
        }
    }
}

impl StatefulWidget for NxParagraph<'_> {
    type State = LinkRegistry;

    fn render(self, area: Rect, buf: &mut Buffer, registry: &mut Self::State) {
        if self.text.has_links() {
            self.render_with_links(area, buf, registry);
        } else {
            self.to_ratatui().render(area, buf);
        }
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
    fn records_link_rect_inline() {
        let area = rect(0, 0, 30, 1);
        let mut buf = Buffer::empty(area);
        let mut registry = LinkRegistry::new();

        let line = NxLine::from_spans(vec![
            Span::raw("see ").into(),
            Link::new("the docs", "https://nx.dev").into(),
            Span::raw(" now").into(),
        ]);
        StatefulWidget::render(NxParagraph::new(line), area, &mut buf, &mut registry);

        let rendered: String = (0..16).map(|x| buf[(x, 0)].symbol()).collect();
        assert_eq!(rendered, "see the docs now");
        // Only "the docs" (cols 4..12) is the link.
        assert_eq!(registry.hit_test(3, 0), None);
        assert_eq!(registry.hit_test(4, 0), Some("https://nx.dev"));
        assert_eq!(registry.hit_test(11, 0), Some("https://nx.dev"));
        assert_eq!(registry.hit_test(12, 0), None);
    }

    #[test]
    fn wrapped_link_records_a_rect_per_row() {
        let area = rect(0, 0, 10, 3);
        let mut buf = Buffer::empty(area);
        let mut registry = LinkRegistry::new();

        // "alpha beta gamma" (16 cols) wraps within width 10.
        let line = NxLine::from_spans(vec![Link::new("alpha beta gamma", "u").into()]);
        StatefulWidget::render(
            NxParagraph::new(line).wrap(Wrap { trim: false }),
            area,
            &mut buf,
            &mut registry,
        );

        // Link is clickable on both wrapped rows.
        assert_eq!(registry.hit_test(0, 0), Some("u"));
        assert_eq!(registry.hit_test(0, 1), Some("u"));
    }

    #[test]
    fn link_less_paragraph_renders_and_registers_nothing() {
        let area = rect(0, 0, 12, 1);
        let mut buf = Buffer::empty(area);
        let mut registry = LinkRegistry::new();

        StatefulWidget::render(
            NxParagraph::new(Span::raw("plain text")),
            area,
            &mut buf,
            &mut registry,
        );

        let rendered: String = (0..10).map(|x| buf[(x, 0)].symbol()).collect();
        assert_eq!(rendered, "plain text");
        assert_eq!(registry.hit_test(0, 0), None);
    }

    #[test]
    fn line_count_matches_wrapping() {
        let para = NxParagraph::new(Span::raw("alpha beta gamma")).wrap(Wrap { trim: false });
        // 16 cols / width 10 -> 2 rows.
        assert_eq!(para.line_count(10), 2);
    }
}
