use super::scroll_momentum::{ScrollDirection, ScrollMomentum};
use super::utils::normalize_newlines;
use crossterm::event::{KeyCode, KeyEvent, MouseEvent, MouseEventKind};
use parking_lot::Mutex;
use std::{
    io::{self, Write},
    sync::{Arc, RwLock},
};
use tracing::debug;
use vt100_ctt::Parser;

/// A wrapper that provides access to the terminal screen without cloning
///
/// This struct uses a read lock guard internally to maintain the lock on the parser while
/// allowing access to just the screen through deref coercion. This approach avoids the need to
/// clone the entire screen while still providing safe access to it. The guard is kept private
/// to ensure the lock is held for the lifetime of this reference.
///
/// Using Deref allows callers to treat this as if it were a direct reference to Screen.
pub struct PtyScreenRef<'a> {
    _guard: std::sync::RwLockReadGuard<'a, Parser>,
}

impl std::ops::Deref for PtyScreenRef<'_> {
    type Target = vt100_ctt::Screen;

    fn deref(&self) -> &Self::Target {
        self._guard.screen()
    }
}

#[derive(Clone)]
pub struct PtyInstance {
    parser: Arc<RwLock<Parser>>,
    writer: Option<Arc<Mutex<Box<dyn Write + Send>>>>,
    rows: u16,
    cols: u16,
    scroll_momentum: Arc<Mutex<ScrollMomentum>>,
}

impl PtyInstance {
    pub fn interactive(
        parser: Arc<RwLock<Parser>>,
        writer: Arc<Mutex<Box<dyn Write + Send>>>,
    ) -> Self {
        // Read the dimensions from the parser
        let (rows, cols) = parser.read().unwrap().screen().size();
        Self {
            parser,
            writer: Some(writer),
            rows,
            cols,
            scroll_momentum: Arc::new(Mutex::new(ScrollMomentum::new())),
        }
    }

    pub fn non_interactive() -> Self {
        // Use sane defaults for rows, cols and scrollback buffer size. The dimensions will be adjusted dynamically later.
        let rows = 24;
        let cols = 80;
        let parser = Arc::new(RwLock::new(Parser::new(rows, cols, 10000)));
        Self {
            parser,
            writer: None,
            rows,
            cols,
            scroll_momentum: Arc::new(Mutex::new(ScrollMomentum::new())),
        }
    }

    pub fn can_be_interactive(&self) -> bool {
        self.writer.is_some()
    }

    pub fn resize(&mut self, rows: u16, cols: u16) -> io::Result<()> {
        // Ensure minimum sizes
        let rows = rows.max(3);
        let cols = cols.max(20);

        // Skip resize if dimensions haven't changed
        if rows == self.rows && cols == self.cols {
            return Ok(());
        }

        // Get current dimensions and scroll position before resize
        let old_rows = self.rows;
        let old_scrollback = if let Ok(parser_guard) = self.parser.read() {
            parser_guard.screen().scrollback()
        } else {
            0
        };

        // Update the stored dimensions
        self.rows = rows;
        self.cols = cols;

        // Create a new parser with the new dimensions while preserving state
        if let Ok(mut parser_guard) = self.parser.write() {
            let raw_output = parser_guard.get_raw_output().to_vec();

            // Create new parser with new dimensions
            let mut new_parser = Parser::new(rows, cols, 10000);
            new_parser.process(&raw_output);

            // Preserve scroll position when possible
            if rows < old_rows {
                // If we lost height and were scrolled up, try to maintain scroll position
                if old_scrollback > 0 {
                    // Adjust scrollback to account for lost rows
                    let adjusted_scrollback =
                        old_scrollback.saturating_sub((old_rows - rows) as usize);
                    new_parser.screen_mut().set_scrollback(adjusted_scrollback);
                } else {
                    // If we weren't scrolled, keep at bottom
                    new_parser.screen_mut().set_scrollback(0);
                }
            } else {
                // If we gained height or stayed the same, preserve exact scroll position
                new_parser.screen_mut().set_scrollback(old_scrollback);
            }

            *parser_guard = new_parser;
        }

        Ok(())
    }

    pub fn write_input(&mut self, input: &[u8]) -> io::Result<()> {
        if let Some(writer) = &self.writer {
            let mut writer_guard = writer.lock();
            debug!("Writing input: {:?}", input);
            writer_guard.write_all(input)?;
            writer_guard.flush()?;
        } else {
            debug!("Swallowing input: {:?}", input);
        }

        Ok(())
    }

    pub fn handle_arrow_keys(&mut self, event: KeyEvent) {
        let alternative_screen = self.parser.read().unwrap().screen().alternate_screen();
        debug!("Alternate Screen: {:?}", alternative_screen);
        if !alternative_screen {
            match event.code {
                KeyCode::Up => {
                    let amount = self
                        .scroll_momentum
                        .lock()
                        .calculate_momentum(ScrollDirection::Up);
                    self.scroll_up(amount);
                }
                KeyCode::Down => {
                    let amount = self
                        .scroll_momentum
                        .lock()
                        .calculate_momentum(ScrollDirection::Down);
                    self.scroll_down(amount);
                }
                _ => {}
            }
        } else {
            match event.code {
                KeyCode::Up => {
                    self.write_input(b"\x1b[A").ok();
                }
                KeyCode::Down => {
                    self.write_input(b"\x1b[B").ok();
                }
                _ => {}
            }
        }
    }

    pub fn send_mouse_event(&mut self, event: MouseEvent) {
        let alternative_screen = self.parser.read().unwrap().screen().alternate_screen();
        debug!("Alternate Screen: {:?}", alternative_screen);
        if !alternative_screen {
            match event.kind {
                MouseEventKind::ScrollUp => {
                    let amount = self
                        .scroll_momentum
                        .lock()
                        .calculate_momentum(ScrollDirection::Up);
                    self.scroll_up(amount);
                }
                MouseEventKind::ScrollDown => {
                    let amount = self
                        .scroll_momentum
                        .lock()
                        .calculate_momentum(ScrollDirection::Down);
                    self.scroll_down(amount);
                }
                _ => {}
            }
        } else {
            match event.kind {
                MouseEventKind::ScrollUp => {
                    self.write_input(b"\x1b[A").ok();
                }
                MouseEventKind::ScrollDown => {
                    self.write_input(b"\x1b[B").ok();
                }
                _ => {}
            }
        }
    }

    pub fn get_screen(&self) -> Option<PtyScreenRef> {
        self.parser
            .read()
            .ok()
            .map(|guard| PtyScreenRef { _guard: guard })
    }

    pub fn scroll_up(&mut self, amount: u8) {
        if let Ok(mut parser) = self.parser.write() {
            let current = parser.screen().scrollback();
            parser
                .screen_mut()
                .set_scrollback(current + amount as usize);
        }
    }

    pub fn scroll_down(&mut self, amount: u8) {
        if let Ok(mut parser) = self.parser.write() {
            let current = parser.screen().scrollback();
            if current > 0 {
                parser
                    .screen_mut()
                    .set_scrollback(current.saturating_sub(amount as usize));
            }
        }
    }

    pub fn get_scroll_offset(&self) -> usize {
        if let Ok(parser) = self.parser.read() {
            return parser.screen().scrollback();
        }
        0
    }

    pub fn get_total_content_rows(&self) -> usize {
        if let Ok(parser) = self.parser.read() {
            let screen = parser.screen();
            screen.get_total_content_rows()
        } else {
            0
        }
    }

    /// Process output with an existing parser
    pub fn process_output(&self, output: &[u8]) {
        if let Ok(mut parser_guard) = self.parser.write() {
            let normalized = normalize_newlines(output);
            parser_guard.process(&normalized)
        }
    }
}
