use super::utils::normalize_newlines;
use crossterm::event::{KeyCode, KeyEvent, MouseEvent, MouseEventKind};
use std::{
    io::{self, Write},
    sync::{Arc, Mutex, RwLock},
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
    pub task_id: String,
    pub parser: Arc<RwLock<Parser>>,
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    rows: u16,
    cols: u16,
}

impl PtyInstance {
    pub fn new(
        task_id: String,
        parser: Arc<RwLock<Parser>>,
        writer: Arc<Mutex<Box<dyn Write + Send>>>,
    ) -> io::Result<Self> {
        // Read the dimensions from the parser
        let (rows, cols) = parser.read().unwrap().screen().size();
        Ok(Self {
            task_id,
            parser,
            writer,
            rows,
            cols,
        })
    }

    pub fn resize(&mut self, rows: u16, cols: u16) -> io::Result<()> {
        // Ensure minimum sizes
        let rows = rows.max(3);
        let cols = cols.max(20);

        // Get current dimensions before resize
        let old_rows = self.rows;

        // Update the stored dimensions
        self.rows = rows;
        self.cols = cols;

        // Create a new parser with the new dimensions while preserving state
        if let Ok(mut parser_guard) = self.parser.write() {
            let raw_output = parser_guard.get_raw_output().to_vec();

            // Create new parser with new dimensions
            let mut new_parser = Parser::new(rows, cols, 10000);
            new_parser.process(&raw_output);

            // If we lost height, scroll up by that amount to maintain relative view position
            if rows < old_rows {
                // Set to 0 to ensure that the cursor is consistently at the bottom of the visible output on resize
                new_parser.screen_mut().set_scrollback(0);
            }

            *parser_guard = new_parser;
        }

        Ok(())
    }

    pub fn write_input(&mut self, input: &[u8]) -> io::Result<()> {
        if let Ok(mut writer_guard) = self.writer.lock() {
            writer_guard.write_all(input)?;
            writer_guard.flush()?;
        }

        Ok(())
    }

    pub fn handle_arrow_keys(&mut self, event: KeyEvent) {
        let application_cursor_mode = self.parser.read().unwrap().screen().application_cursor();
        debug!("Alternate Screen: {:?}", application_cursor_mode);
        if !application_cursor_mode {
            match event.code {
                KeyCode::Up => {
                    self.scroll_up();
                }
                KeyCode::Down => {
                    self.scroll_down();
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
        let application_cursor_mode = self.parser.read().unwrap().screen().application_cursor();
        debug!("Alternate Screen: {:?}", application_cursor_mode);
        if !application_cursor_mode {
            match event.kind {
                MouseEventKind::ScrollUp => {
                    self.scroll_up();
                }
                MouseEventKind::ScrollDown => {
                    self.scroll_down();
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

    pub fn scroll_up(&mut self) {
        if let Ok(mut parser) = self.parser.write() {
            let current = parser.screen().scrollback();
            parser.screen_mut().set_scrollback(current + 1);
        }
    }

    pub fn scroll_down(&mut self) {
        if let Ok(mut parser) = self.parser.write() {
            let current = parser.screen().scrollback();
            if current > 0 {
                parser.screen_mut().set_scrollback(current - 1);
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
