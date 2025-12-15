use crossterm::Command;

/// Wrapper around ANSI escape sequence bytes.
///
/// Use `.into()` on any crossterm `Command` to convert it to an `EscapeSequence`.
pub struct EscapeSequence(Vec<u8>);

impl EscapeSequence {
    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }

    pub fn into_bytes(self) -> Vec<u8> {
        self.0
    }
}

impl<C: Command> From<C> for EscapeSequence {
    fn from(cmd: C) -> Self {
        let mut buffer = String::new();
        // Writing to a String cannot fail
        cmd.write_ansi(&mut buffer)
            .expect("write to String cannot fail");
        EscapeSequence(buffer.into_bytes())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crossterm::cursor::{Hide, MoveTo, Show};
    use crossterm::style::{Color, Print, ResetColor, SetForegroundColor};
    use crossterm::terminal::{Clear, ClearType};

    #[test]
    fn test_cursor_hide() {
        let seq: EscapeSequence = Hide.into();
        // CSI ?25l - hide cursor
        assert_eq!(seq.as_bytes(), b"\x1b[?25l");
    }

    #[test]
    fn test_cursor_show() {
        let seq: EscapeSequence = Show.into();
        // CSI ?25h - show cursor
        assert_eq!(seq.as_bytes(), b"\x1b[?25h");
    }

    #[test]
    fn test_cursor_move_to() {
        let seq: EscapeSequence = MoveTo(10, 20).into();
        // CSI row;colH (1-indexed, so row=21, col=11)
        assert_eq!(seq.as_bytes(), b"\x1b[21;11H");
    }

    #[test]
    fn test_print() {
        let seq: EscapeSequence = Print("hello").into();
        // Print just outputs the text directly
        assert_eq!(seq.as_bytes(), b"hello");
    }

    #[test]
    fn test_clear_all() {
        let seq: EscapeSequence = Clear(ClearType::All).into();
        // CSI 2J - clear entire screen
        assert_eq!(seq.as_bytes(), b"\x1b[2J");
    }

    #[test]
    fn test_reset_color() {
        let seq: EscapeSequence = ResetColor.into();
        // CSI 0m - reset all attributes
        assert_eq!(seq.as_bytes(), b"\x1b[0m");
    }

    #[test]
    fn test_set_foreground_color() {
        let seq: EscapeSequence = SetForegroundColor(Color::Red).into();
        // Should start with CSI and end with 'm'
        let bytes = seq.as_bytes();
        assert!(bytes.starts_with(b"\x1b["));
        assert!(bytes.ends_with(b"m"));
    }

    #[test]
    fn test_into_bytes_consumes() {
        let seq: EscapeSequence = Hide.into();
        let bytes = seq.into_bytes();
        assert_eq!(bytes, b"\x1b[?25l");
    }
}
