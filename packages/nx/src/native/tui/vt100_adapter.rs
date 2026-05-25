//! Bridges `vt100_ctt::Screen` / `vt100_ctt::Cell` to the public traits in
//! `tui_term::widget`. We can't `impl Screen for vt100_ctt::Screen` directly
//! because of the orphan rule, so we wrap them in `#[repr(transparent)]`
//! newtypes and do a zero-cost reference cast.
//!
//! Allows `ratatui::style::Color` because PTY output is colours the child
//! process emitted; light/dark theme adjustment doesn't apply here.

#![allow(clippy::disallowed_types)]

use ratatui::buffer::Cell as BufferCell;
use ratatui::style::{Color, Modifier, Style};
use tui_term::widget::{Cell, Screen};

#[repr(transparent)]
pub struct Vt100CttScreen(vt100_ctt::Screen);

impl Vt100CttScreen {
    pub fn wrap(screen: &vt100_ctt::Screen) -> &Self {
        // SAFETY: `Vt100CttScreen` is `#[repr(transparent)]` over `vt100_ctt::Screen`,
        // so `&vt100_ctt::Screen` and `&Vt100CttScreen` have identical layout, ABI,
        // and alignment. The borrow's lifetime is preserved by the cast.
        unsafe { &*(screen as *const vt100_ctt::Screen as *const Self) }
    }
}

#[repr(transparent)]
pub struct Vt100CttCell(vt100_ctt::Cell);

impl Vt100CttCell {
    fn wrap(cell: &vt100_ctt::Cell) -> &Self {
        // SAFETY: see `Vt100CttScreen::wrap` — same `#[repr(transparent)]` invariant.
        unsafe { &*(cell as *const vt100_ctt::Cell as *const Self) }
    }
}

impl Screen for Vt100CttScreen {
    type C = Vt100CttCell;

    #[inline]
    fn cell(&self, row: u16, col: u16) -> Option<&Self::C> {
        self.0.cell(row, col).map(Vt100CttCell::wrap)
    }

    #[inline]
    fn hide_cursor(&self) -> bool {
        self.0.hide_cursor()
    }

    #[inline]
    fn cursor_position(&self) -> (u16, u16) {
        let (row, col) = self.0.cursor_position();
        let scrollback = u16::try_from(self.0.scrollback()).unwrap_or(u16::MAX);
        (row.saturating_add(scrollback), col)
    }
}

impl Cell for Vt100CttCell {
    #[inline]
    fn has_contents(&self) -> bool {
        self.0.has_contents()
    }

    #[inline]
    fn apply(&self, buf_cell: &mut BufferCell) {
        if self.0.has_contents() {
            buf_cell.set_symbol(&self.0.contents());
        }

        let mut modifier = Modifier::empty();
        if self.0.bold() {
            modifier |= Modifier::BOLD;
        }
        if self.0.italic() {
            modifier |= Modifier::ITALIC;
        }
        if self.0.underline() {
            modifier |= Modifier::UNDERLINED;
        }
        if self.0.inverse() {
            modifier |= Modifier::REVERSED;
        }
        if self.0.dimmed() {
            modifier |= Modifier::DIM;
        }

        let fg = map_color(self.0.fgcolor());
        let bg = map_color(self.0.bgcolor());

        buf_cell.set_style(Style::reset().fg(fg).bg(bg).add_modifier(modifier));
    }
}

#[inline]
fn map_color(color: vt100_ctt::Color) -> Color {
    match color {
        vt100_ctt::Color::Default => Color::Reset,
        vt100_ctt::Color::Idx(i) => Color::Indexed(i),
        vt100_ctt::Color::Rgb(r, g, b) => Color::Rgb(r, g, b),
    }
}
