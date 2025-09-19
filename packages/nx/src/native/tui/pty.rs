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
    /// Get buffered scrollback content that should be displayed above the current screen
    /// This gets content from last_rendered_lines to current scrollback for batched rendering
    pub fn get_buffered_scrollback_content_for_inline(
        &self,
        last_rendered_lines: usize,
    ) -> Vec<String> {
        if let Ok(parser) = self.parser.read() {
            let screen = parser.screen();
            let (screen_rows, _) = screen.size();

            // Get all content with ANSI formatting preserved for colors
            let all_formatted = screen.all_contents_formatted();
            let content_str = String::from_utf8_lossy(&all_formatted);
            let all_lines: Vec<&str> = content_str.lines().collect();

            let total_lines = all_lines.len();

            // Calculate current scrollback: everything above the current visible screen
            let current_scrollback_lines = total_lines.saturating_sub(screen_rows as usize);

            // Return buffered scrollback content since last render
            if current_scrollback_lines > last_rendered_lines {
                let start_index = last_rendered_lines;
                let end_index = current_scrollback_lines;

                // Return the buffered scrollback content
                all_lines[start_index..end_index]
                    .iter()
                    .map(|line| line.to_string())
                    .collect()
            } else {
                Vec::new()
            }
        } else {
            Vec::new()
        }
    }

    /// Get the current number of scrollback lines for tracking
    pub fn get_scrollback_line_count(&self) -> usize {
        if let Ok(parser) = self.parser.read() {
            let screen = parser.screen();
            let (screen_rows, _) = screen.size();
            let all_formatted = screen.all_contents_formatted();
            let content_str = String::from_utf8_lossy(&all_formatted);
            let total_lines = content_str.lines().count();
            total_lines.saturating_sub(screen_rows as usize)
        } else {
            0
        }
    }

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

    pub fn non_interactive_with_dimensions(rows: u16, cols: u16) -> Self {
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
        let handles_arrow_keys = self.handles_arrow_keys();
        debug!(
            "Handling arrow keys: {:?}, Interactive: {}",
            event, handles_arrow_keys
        );

        if handles_arrow_keys {
            // Interactive program (enquirer, vim, git log, etc.) - send keys to program
            match event.code {
                KeyCode::Up => {
                    self.write_input(b"\x1b[A").ok();
                }
                KeyCode::Down => {
                    self.write_input(b"\x1b[B").ok();
                }
                _ => {}
            }
        } else {
            // Non-interactive program - handle scrolling ourselves
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
        }
    }

    pub fn send_mouse_event(&mut self, event: MouseEvent) {
        let is_interactive = self.handles_arrow_keys();
        debug!("Mouse event: {:?}, Interactive: {}", event, is_interactive);

        if is_interactive {
            // Interactive program - send scroll as arrow keys
            match event.kind {
                MouseEventKind::ScrollUp => {
                    self.write_input(b"\x1b[A").ok();
                }
                MouseEventKind::ScrollDown => {
                    self.write_input(b"\x1b[B").ok();
                }
                _ => {}
            }
        } else {
            // Non-interactive program - handle scrolling ourselves
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

    pub fn scroll_to_top(&mut self) {
        if let Ok(mut parser) = self.parser.write() {
            let screen = parser.screen();
            let total_content = screen.get_total_content_rows();
            let viewport_height = screen.size().0 as usize;
            let max_scrollback = total_content.saturating_sub(viewport_height);
            parser.screen_mut().set_scrollback(max_scrollback);
        }
    }

    pub fn scroll_to_bottom(&mut self) {
        if let Ok(mut parser) = self.parser.write() {
            parser.screen_mut().set_scrollback(0);
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

    /// Checks if the process is likely in interactive/raw mode
    /// Uses both alternate screen detection and cursor movement patterns
    pub fn handles_arrow_keys(&self) -> bool {
        if let Ok(parser) = self.parser.read() {
            let screen = parser.screen();

            // Strong indicator: alternate screen mode (vim, less, git log, htop)
            if screen.alternate_screen() {
                return true;
            }

            // Check if recent output contains cursor movement sequences
            if self.has_cursor_movement_in_output() {
                return true;
            }
        }

        false
    }

    /// Simple check: does the recent output contain cursor movement escape sequences?
    /// This catches enquirer-style programs that move cursor but don't use alternate screen
    fn has_cursor_movement_in_output(&self) -> bool {
        if let Ok(parser) = self.parser.read() {
            let raw_output = parser.get_raw_output();
            let output_str = std::str::from_utf8(raw_output).unwrap_or("");

            // Check for any cursor control sequences in one pass
            [
                "\x1b[?25l",
                "\x1b[?25h",
                "\x1b[H",
                "\x1b[A",
                "\x1b[B",
                "\x1b[C",
                "\x1b[D",
            ]
            .iter()
            .any(|seq| output_str.contains(seq))
        } else {
            false
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, RwLock};
    use vt100_ctt::Parser;

    fn create_test_pty_instance(alternate_screen: bool) -> PtyInstance {
        let parser = Arc::new(RwLock::new(Parser::new(24, 80, 1000)));

        // Set alternate screen mode if requested
        if alternate_screen {
            if let Ok(mut parser_guard) = parser.write() {
                parser_guard.process(b"\x1b[?1049h");
            }
        }

        PtyInstance {
            parser,
            writer: None,
            rows: 24,
            cols: 80,
            scroll_momentum: Arc::new(Mutex::new(ScrollMomentum::new())),
        }
    }

    #[test]
    fn test_handles_arrow_keys_initially_false() {
        let pty = create_test_pty_instance(false);
        assert!(
            !pty.handles_arrow_keys(),
            "Should initially not be interactive"
        );
    }

    #[test]
    fn test_handles_arrow_keys_alternate_screen() {
        let pty = create_test_pty_instance(true);
        assert!(
            pty.handles_arrow_keys(),
            "Should detect alternate screen as interactive"
        );
    }

    #[test]
    fn test_handles_arrow_keys_cursor_movement() {
        let pty = create_test_pty_instance(false);

        // Initially should not be interactive
        assert!(!pty.handles_arrow_keys());

        // Process output with cursor hide sequence (enquirer-style)
        pty.process_output(b"\x1b[?25l");
        assert!(
            pty.handles_arrow_keys(),
            "Should detect cursor hide as interactive"
        );
    }

    #[test]
    fn test_handles_arrow_keys_enquirer_style_output() {
        let pty = create_test_pty_instance(false);

        // Simulate enquirer output with cursor positioning
        let enquirer_output =
            b"? Select option \x1b[?25l\x1b[1;1H> Option 1\x1b[2;1H  Option 2\x1b[?25h";
        pty.process_output(enquirer_output);

        assert!(
            pty.handles_arrow_keys(),
            "Should detect enquirer-style cursor manipulation"
        );
    }
}
