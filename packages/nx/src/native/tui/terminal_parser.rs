use super::utils::clamp_csi_counts;

/// A vt100 parser that keeps its input verbatim for resize replays.
///
/// Insert and scroll counts are bounded by the current screen size only when
/// parsing, so a replay at a larger size applies the original counts.
pub struct TerminalParser {
    parser: vt100_ctt::Parser,
    raw_output: Vec<u8>,
}

struct NoCallbacks;

impl vt100_ctt::Callbacks for NoCallbacks {}

impl TerminalParser {
    pub fn new(rows: u16, cols: u16, scrollback_len: usize) -> Self {
        Self {
            parser: vt100_ctt::Parser::new(rows, cols, scrollback_len),
            raw_output: Vec::new(),
        }
    }

    pub fn process(&mut self, bytes: &[u8]) {
        self.raw_output.extend_from_slice(bytes);
        let (rows, cols) = self.parser.screen().size();
        // `process_cb` parses without recording, so `raw_output` stays the only copy.
        self.parser
            .process_cb(&clamp_csi_counts(bytes, rows, cols), &mut NoCallbacks);
    }

    pub fn screen(&self) -> &vt100_ctt::Screen {
        self.parser.screen()
    }

    pub fn screen_mut(&mut self) -> &mut vt100_ctt::Screen {
        self.parser.screen_mut()
    }

    pub fn get_raw_output(&self) -> &[u8] {
        &self.raw_output
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    #[test]
    fn process_bounds_insert_and_scroll_counts_by_the_screen() {
        let mut parser = TerminalParser::new(24, 80, 0);
        let start = Instant::now();
        parser.process(&b"\x1b[65535@\x1b[65535L\x1b[65535T".repeat(20));
        assert!(start.elapsed() < Duration::from_secs(2));
    }
}
