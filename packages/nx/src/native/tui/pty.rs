use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::{
    collections::HashMap,
    io::{self, Read, Write},
    sync::{Arc, Mutex, RwLock},
};
use vt100_ctt::Parser;
use crate::native::pseudo_terminal::pseudo_terminal::command_builder;

#[derive(Clone)]
pub struct PtyInstance {
    parser: Arc<RwLock<Parser>>,
    #[allow(dead_code)]
    writer: Option<Arc<Mutex<Box<dyn Write + Send>>>>,
    rows: u16,
    cols: u16,
    exit_status: Arc<Mutex<Option<i32>>>,
}

impl PtyInstance {
    pub fn new(
        rows: u16,
        cols: u16,
        command: &str,
        cwd: Option<&str>,
        env: Option<&HashMap<String, String>>,
    ) -> io::Result<Self> {
        let pty_system = NativePtySystem::default();

        let mut cmd = command_builder();
        cmd.arg(command);

        // Set working directory if provided, otherwise use current dir
        if let Some(dir) = cwd {
            cmd.cwd(dir);
        } else {
            cmd.cwd(std::env::current_dir()?);
        }

        // Set environment variables if provided
        if let Some(env_vars) = env {
            for (key, value) in env_vars {
                cmd.env(key, value);
            }
        }

        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        let parser = Arc::new(RwLock::new(Parser::new(rows, cols, 10000)));
        let parser_clone = parser.clone();
        let exit_status = Arc::new(Mutex::new(None));
        let exit_status_clone = exit_status.clone();

        let mut reader = pair.master.try_clone_reader().unwrap();
        let raw_writer = pair.master.take_writer().unwrap();
        let writer = Arc::new(Mutex::new(raw_writer));

        std::thread::spawn(move || {
            let mut child = pair.slave.spawn_command(cmd).unwrap();
            let status = child.wait().unwrap();
            *exit_status_clone.lock().unwrap() = Some(status.exit_code() as i32);
            drop(pair.slave);
        });

        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            let mut processed_buf = Vec::new();
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(size) => {
                        // Check if this buffer contains a clear screen sequence
                        let contains_clear = buf[..size]
                            .windows(4)
                            .any(|window| window == [0x1B, 0x5B, 0x32, 0x4A]);

                        if contains_clear {
                            // If we detect a clear screen sequence, start fresh
                            processed_buf.clear();
                            processed_buf.extend_from_slice(&buf[..size]);

                            let mut parser = parser_clone.write().unwrap();
                            // Get current dimensions
                            let (rows, cols) = parser.screen().size();
                            // Create a fresh parser
                            let mut new_parser = Parser::new(rows, cols, 10000);
                            // Process just this buffer
                            new_parser.process(&processed_buf);
                            *parser = new_parser;
                        } else {
                            // Normal processing
                            processed_buf.extend_from_slice(&buf[..size]);
                            let mut parser = parser_clone.write().unwrap();
                            parser.process(&processed_buf);
                        }

                        processed_buf.clear();
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(Self {
            parser,
            writer: Some(writer),
            rows,
            cols,
            exit_status,
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
        if let Some(writer) = &self.writer {
            if let Ok(mut writer_guard) = writer.lock() {
                writer_guard.write_all(input)?;
                writer_guard.flush()?;
            }
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

    pub fn clear_screen(&mut self) -> io::Result<()> {
        if let Some(writer) = &self.writer {
            if let Ok(mut writer_guard) = writer.lock() {
                // Send clear screen sequence
                writer_guard.write_all(&[0x1B, 0x5B, 0x32, 0x4A])?; // ESC[2J
                                                                    // Move cursor to home position
                writer_guard.write_all(&[0x1B, 0x5B, 0x48])?; // ESC[H
                writer_guard.flush()?;
            }

            // Reset scrollback buffer and ensure screen is cleared
            if let Ok(mut parser) = self.parser.write() {
                // Create a fresh parser to ensure a completely clean state
                let mut new_parser = Parser::new(self.rows, self.cols, 10000);
                // Process just the clear screen and cursor home sequences
                new_parser.process(&[0x1B, 0x5B, 0x32, 0x4A, 0x1B, 0x5B, 0x48]);

                // Clear the raw output buffer in the new parser
                new_parser.clear_raw_output();

                // Replace the existing parser
                *parser = new_parser;
            }
        }
        Ok(())
    }

    pub fn get_exit_status(&self) -> Option<i32> {
        self.exit_status.lock().unwrap().clone()
    }

    pub fn new_with_output(rows: u16, cols: u16, output: &[u8]) -> io::Result<Self> {
        let parser = Arc::new(RwLock::new(Parser::new(rows, cols, 10000)));

        // Process the cached output with normalized newlines
        if let Ok(mut parser_guard) = parser.write() {
            let normalized = Self::normalize_newlines(output);
            parser_guard.process(&normalized);
        }

        Ok(Self {
            parser,
            writer: None, // No writer needed for cached output
            rows,
            cols,
            exit_status: Arc::new(Mutex::new(None)),
        })
    }

    /// Ensures that all newlines in the output are properly handled by converting
    /// lone \n to \r\n sequences. This mimics terminal driver behavior.
    fn normalize_newlines(input: &[u8]) -> Vec<u8> {
        let mut output = Vec::with_capacity(input.len());
        let mut i = 0;
        while i < input.len() {
            if input[i] == b'\n' {
                // If this \n isn't preceded by \r, add the \r
                if i == 0 || input[i - 1] != b'\r' {
                    output.push(b'\r');
                }
            }
            output.push(input[i]);
            i += 1;
        }
        output
    }

    pub fn mark_as_completed(&mut self, exit_code: i32) -> io::Result<()> {
        if let Ok(mut status) = self.exit_status.lock() {
            *status = Some(exit_code);
        }
        Ok(())
    }
}
