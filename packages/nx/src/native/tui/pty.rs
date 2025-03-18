use std::{
    io::{self, Write},
    sync::{Arc, Mutex, RwLock},
};
use vt100_ctt::Parser;

use super::utils::normalize_newlines;

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
                let lines_lost = (old_rows - rows) as usize;
                let current = new_parser.screen().scrollback();
                // Adjust by -1 to ensure that the cursor is consistently at the bottom of the visible output on resize
                new_parser
                    .screen_mut()
                    .set_scrollback(current + lines_lost - 1);
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

    pub fn get_screen(&self) -> Option<vt100_ctt::Screen> {
        self.parser.read().ok().map(|p| p.screen().clone())
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
    pub fn process_output(parser: &RwLock<Parser>, output: &[u8]) -> io::Result<()> {
        if let Ok(mut parser_guard) = parser.write() {
            let normalized = normalize_newlines(output);
            parser_guard.process(&normalized);
        }
        Ok(())
    }
}
