use super::scroll_momentum::{ScrollDirection, ScrollMomentum};
use super::utils::normalize_newlines;
use crossterm::event::{KeyCode, KeyEvent};
use parking_lot::{Mutex, RwLock, RwLockReadGuard};
use std::{
    io::{self, Write},
    sync::Arc,
};
use tracing::debug;
use vt100_ctt::Parser;
use wrap_ansi::wrap_ansi;

/// A wrapper that provides access to the terminal screen without cloning
///
/// This struct uses a read lock guard internally to maintain the lock on the parser while
/// allowing access to just the screen through deref coercion. This approach avoids the need to
/// clone the entire screen while still providing safe access to it. The guard is kept private
/// to ensure the lock is held for the lifetime of this reference.
///
/// Using Deref allows callers to treat this as if it were a direct reference to Screen.
pub struct PtyScreenRef<'a> {
    _guard: RwLockReadGuard<'a, Parser>,
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
    dimensions: Arc<RwLock<(u16, u16)>>,
    scroll_momentum: Arc<Mutex<ScrollMomentum>>,
}

/// Split formatted content (containing ANSI escape codes) into visual rows by terminal width.
///
/// The vt100 `all_contents_formatted()` method returns logical lines where content that
/// wrapped to the next row is concatenated without newlines. This function splits
/// those logical lines into visual rows based on the terminal width while preserving
/// ANSI escape sequences using the wrap-ansi crate.
///
/// # Arguments
///
/// * `content` - The formatted content string (may contain ANSI escape codes)
/// * `cols` - The terminal width in columns
///
/// # Returns
///
/// A vector of strings, each representing one visual row with ANSI codes preserved.
fn split_formatted_into_visual_rows(content: &str, cols: usize) -> Vec<String> {
    if cols == 0 {
        return content.lines().map(|s| s.to_string()).collect();
    }

    // Use wrap-ansi to wrap each logical line while preserving ANSI codes
    // The crate correctly handles escape sequences, Unicode width, and hyperlinks
    let options = wrap_ansi::WrapOptions::builder()
        .hard_wrap(true) // Break long words/sequences at column boundary
        .trim_whitespace(false) // Preserve spacing
        .word_wrap(false) // Don't break at word boundaries - match terminal behavior
        .build();

    content
        .lines()
        .flat_map(|line| {
            if line.is_empty() {
                vec![String::new()]
            } else {
                wrap_ansi(line, cols, Some(options.clone()))
                    .lines()
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>()
            }
        })
        .collect()
}

impl PtyInstance {
    /// Get buffered scrollback content that should be displayed above the current screen
    /// This gets content from last_rendered_lines to current scrollback for batched rendering
    ///
    /// The vt100 `all_contents_formatted()` method returns logical lines where wrapped
    /// content is concatenated without newlines. This method splits the content into
    /// visual rows based on terminal width while preserving ANSI formatting codes.
    pub fn get_buffered_scrollback_content_for_inline(
        &self,
        last_rendered_lines: usize,
    ) -> Vec<String> {
        let parser = self.parser.read();
        let screen = parser.screen();
        let (screen_rows, screen_cols) = screen.size();


        // Get all content with ANSI formatting preserved for colors
        let all_formatted = screen.all_contents_formatted();
        let content_str = String::from_utf8_lossy(&all_formatted);

        // Split content into visual rows based on terminal width
        // This handles the case where logical lines (from all_contents_formatted)
        // may be longer than terminal width due to wrapping
        let visual_rows = split_formatted_into_visual_rows(&content_str, screen_cols as usize);
        let total_visual_rows = visual_rows.len();

        // Calculate current scrollback: everything above the current visible screen
        let current_scrollback_rows = total_visual_rows.saturating_sub(screen_rows as usize);

        // Return buffered scrollback content since last render
        if current_scrollback_rows > last_rendered_lines {
            visual_rows[last_rendered_lines..current_scrollback_rows].to_vec()
        } else {
            Vec::new()
        }
    }

    /// Get the current number of scrollback lines (visual rows) for tracking
    pub fn get_scrollback_line_count(&self) -> usize {
        let parser = self.parser.read();
        let screen = parser.screen();
        let (screen_rows, screen_cols) = screen.size();
        let all_formatted = screen.all_contents_formatted();
        let content_str = String::from_utf8_lossy(&all_formatted);

        // Count visual rows, not logical lines
        let visual_rows = split_formatted_into_visual_rows(&content_str, screen_cols as usize);
        visual_rows.len().saturating_sub(screen_rows as usize)
    }

    pub fn interactive(
        parser: Arc<RwLock<Parser>>,
        writer: Arc<Mutex<Box<dyn Write + Send>>>,
    ) -> Self {
        // Read the dimensions from the parser
        let (rows, cols) = parser.read().screen().size();
        Self {
            parser,
            writer: Some(writer),
            dimensions: Arc::new(RwLock::new((rows, cols))),
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
            dimensions: Arc::new(RwLock::new((rows, cols))),
            scroll_momentum: Arc::new(Mutex::new(ScrollMomentum::new())),
        }
    }

    pub fn non_interactive_with_dimensions(rows: u16, cols: u16) -> Self {
        let parser = Arc::new(RwLock::new(Parser::new(rows, cols, 10000)));
        Self {
            parser,
            writer: None,
            dimensions: Arc::new(RwLock::new((rows, cols))),
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

        // Check dimensions and get old values in a single lock scope
        let (should_resize, old_rows, old_scrollback) = {
            let dimensions_guard = self.dimensions.read();
            let current_dimensions = *dimensions_guard;

            // Skip resize if dimensions haven't changed
            if rows == current_dimensions.0 && cols == current_dimensions.1 {
                return Ok(());
            }

            let old_scrollback = self.parser.read().screen().scrollback();

            (true, current_dimensions.0, old_scrollback)
        };

        if !should_resize {
            return Ok(());
        }

        // Update dimensions
        let mut dimensions_guard = self.dimensions.write();
        *dimensions_guard = (rows, cols);

        // Create a new parser with the new dimensions while preserving state
        {
            let mut parser_guard = self.parser.write();
            let raw_output = parser_guard.get_raw_output().to_vec();

            // Create new parser with new dimensions
            let mut new_parser = Parser::new(rows, cols, 10000);
            new_parser.process(&raw_output);

            // Preserve scroll position when possible
            // Calculate target scroll position based on dimension changes
            let target_scrollback = if rows < old_rows {
                // If we lost height and were scrolled up, adjust scroll position
                if old_scrollback > 0 {
                    old_scrollback.saturating_sub((old_rows - rows) as usize)
                } else {
                    0 // Keep at bottom
                }
            } else {
                // If we gained height or stayed the same, preserve exact scroll position
                old_scrollback
            };

            // Set target scroll position before processing
            new_parser.screen_mut().set_scrollback(target_scrollback);

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

    pub fn get_dimensions(&self) -> (u16, u16) {
        *self.dimensions.read()
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

    /// Get the terminal screen for rendering.
    /// Uses try_read() to avoid blocking - if the lock is contended,
    /// returns None and the frame can be skipped.
    pub fn get_screen(&'_ self) -> Option<PtyScreenRef<'_>> {
        self.parser
            .try_read()
            .map(|guard| PtyScreenRef { _guard: guard })
    }

    pub fn scroll_up(&mut self, amount: u8) {
        let mut parser = self.parser.write();
        let current = parser.screen().scrollback();
        parser
            .screen_mut()
            .set_scrollback(current + amount as usize);
    }

    pub fn scroll_down(&mut self, amount: u8) {
        let mut parser = self.parser.write();
        let current = parser.screen().scrollback();
        if current > 0 {
            parser
                .screen_mut()
                .set_scrollback(current.saturating_sub(amount as usize));
        }
    }

    pub fn scroll_to_top(&mut self) {
        let mut parser = self.parser.write();
        let screen = parser.screen();
        let total_content = screen.get_total_content_rows();
        let viewport_height = screen.size().0 as usize;
        let max_scrollback = total_content.saturating_sub(viewport_height);
        parser.screen_mut().set_scrollback(max_scrollback);
    }

    pub fn scroll_to_bottom(&mut self) {
        self.parser.write().screen_mut().set_scrollback(0);
    }

    pub fn get_scroll_offset(&self) -> usize {
        self.parser.read().screen().scrollback()
    }

    pub fn get_total_content_rows(&self) -> usize {
        self.parser.read().screen().get_total_content_rows()
    }

    /// Checks if the process is likely in interactive/raw mode
    /// Uses both alternate screen detection and cursor movement patterns
    pub fn handles_arrow_keys(&self) -> bool {
        let parser = self.parser.read();
        let screen = parser.screen();

        // Strong indicator: alternate screen mode (vim, less, git log, htop)
        if screen.alternate_screen() {
            return true;
        }

        // Check if recent output contains cursor movement sequences
        drop(parser); // Release lock before calling has_cursor_movement_in_output
        self.has_cursor_movement_in_output()
    }

    /// Simple check: does the recent output contain cursor movement escape sequences?
    /// This catches enquirer-style programs that move cursor but don't use alternate screen
    fn has_cursor_movement_in_output(&self) -> bool {
        let parser = self.parser.read();
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
    }

    /// Process output with an existing parser
    pub fn process_output(&self, output: &[u8]) {
        let normalized = normalize_newlines(output);
        self.parser.write().process(&normalized);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn create_test_pty_instance(alternate_screen: bool) -> PtyInstance {
        let parser = Arc::new(RwLock::new(Parser::new(24, 80, 1000)));

        // Set alternate screen mode if requested
        if alternate_screen {
            parser.write().process(b"\x1b[?1049h");
        }

        PtyInstance {
            parser,
            writer: None,
            dimensions: Arc::new(RwLock::new((24, 80))),
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
