//! Encodes mouse events into the xterm mouse reporting wire format so they can
//! be forwarded to a child application running in a PTY.
//!
//! A TUI app running inside a task pane (vim, htop, lazygit, ...) requests
//! mouse reporting by emitting DECSET sequences (`?9`/`?1000`/`?1002`/`?1003`
//! plus the `?1005`/`?1006` encodings). The embedded vt100 parser tracks those
//! requests and exposes them as [`MouseProtocolMode`] / [`MouseProtocolEncoding`];
//! this module produces the byte sequences a real terminal would send back for
//! the mode and encoding the app asked for.

use crossterm::event::{KeyModifiers, MouseButton, MouseEventKind};
use vt100_ctt::{MouseProtocolEncoding, MouseProtocolMode};

/// Encode a mouse event for a child app, or `None` when the app's requested
/// mode doesn't cover this kind of event (including mode `None`).
///
/// `col` and `row` are 0-based cells relative to the child's screen; the wire
/// format is 1-based.
pub fn encode_mouse_event(
    mode: MouseProtocolMode,
    encoding: MouseProtocolEncoding,
    kind: MouseEventKind,
    modifiers: KeyModifiers,
    col: u16,
    row: u16,
) -> Option<Vec<u8>> {
    let reportable = match mode {
        MouseProtocolMode::None => false,
        MouseProtocolMode::Press => matches!(
            kind,
            MouseEventKind::Down(_)
                | MouseEventKind::ScrollUp
                | MouseEventKind::ScrollDown
                | MouseEventKind::ScrollLeft
                | MouseEventKind::ScrollRight
        ),
        MouseProtocolMode::PressRelease => {
            !matches!(kind, MouseEventKind::Drag(_) | MouseEventKind::Moved)
        }
        MouseProtocolMode::ButtonMotion => !matches!(kind, MouseEventKind::Moved),
        MouseProtocolMode::AnyMotion => true,
    };
    if !reportable {
        return None;
    }

    let (mut code, is_release) = match kind {
        MouseEventKind::Down(button) => (button_code(button), false),
        MouseEventKind::Up(button) => (button_code(button), true),
        MouseEventKind::Drag(button) => (button_code(button) + 32, false),
        MouseEventKind::Moved => (3 + 32, false),
        MouseEventKind::ScrollUp => (64, false),
        MouseEventKind::ScrollDown => (65, false),
        MouseEventKind::ScrollLeft => (66, false),
        MouseEventKind::ScrollRight => (67, false),
    };

    // X10 mode predates modifier reporting.
    if mode != MouseProtocolMode::Press {
        if modifiers.contains(KeyModifiers::SHIFT) {
            code += 4;
        }
        if modifiers.contains(KeyModifiers::ALT) {
            code += 8;
        }
        if modifiers.contains(KeyModifiers::CONTROL) {
            code += 16;
        }
    }

    let x = col as u32 + 1;
    let y = row as u32 + 1;

    match encoding {
        MouseProtocolEncoding::Sgr => Some(
            format!(
                "\x1b[<{};{};{}{}",
                code,
                x,
                y,
                if is_release { 'm' } else { 'M' }
            )
            .into_bytes(),
        ),
        MouseProtocolEncoding::Default => {
            // Legacy encoding can't distinguish which button was released:
            // the low two bits become 3, modifier bits are kept.
            let code = if is_release {
                (code & !0b11) | 0b11
            } else {
                code
            };
            Some(vec![
                0x1b,
                b'[',
                b'M',
                32 + code as u8,
                legacy_coord(x),
                legacy_coord(y),
            ])
        }
        MouseProtocolEncoding::Utf8 => {
            let code = if is_release {
                (code & !0b11) | 0b11
            } else {
                code
            };
            let mut bytes = b"\x1b[M".to_vec();
            let mut push = |value: u32| {
                let ch = char::from_u32(32 + value.min(2015)).unwrap_or(' ');
                let mut buf = [0u8; 4];
                bytes.extend_from_slice(ch.encode_utf8(&mut buf).as_bytes());
            };
            push(code);
            push(x);
            push(y);
            Some(bytes)
        }
    }
}

fn button_code(button: MouseButton) -> u32 {
    match button {
        MouseButton::Left => 0,
        MouseButton::Middle => 1,
        MouseButton::Right => 2,
    }
}

/// Legacy single-byte coordinate: 32 + value, saturating at the encoding's
/// 223-cell limit so the byte stays valid.
fn legacy_coord(value: u32) -> u8 {
    (32 + value.min(223)) as u8
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mode_none_reports_nothing() {
        assert_eq!(
            encode_mouse_event(
                MouseProtocolMode::None,
                MouseProtocolEncoding::Sgr,
                MouseEventKind::Down(MouseButton::Left),
                KeyModifiers::NONE,
                0,
                0,
            ),
            None
        );
    }

    #[test]
    fn sgr_press_and_release() {
        let press = encode_mouse_event(
            MouseProtocolMode::PressRelease,
            MouseProtocolEncoding::Sgr,
            MouseEventKind::Down(MouseButton::Left),
            KeyModifiers::NONE,
            4,
            9,
        )
        .unwrap();
        assert_eq!(press, b"\x1b[<0;5;10M");

        let release = encode_mouse_event(
            MouseProtocolMode::PressRelease,
            MouseProtocolEncoding::Sgr,
            MouseEventKind::Up(MouseButton::Left),
            KeyModifiers::NONE,
            4,
            9,
        )
        .unwrap();
        assert_eq!(release, b"\x1b[<0;5;10m");
    }

    #[test]
    fn sgr_wheel_and_modifiers() {
        let wheel_up = encode_mouse_event(
            MouseProtocolMode::PressRelease,
            MouseProtocolEncoding::Sgr,
            MouseEventKind::ScrollUp,
            KeyModifiers::NONE,
            0,
            0,
        )
        .unwrap();
        assert_eq!(wheel_up, b"\x1b[<64;1;1M");

        let ctrl_click = encode_mouse_event(
            MouseProtocolMode::PressRelease,
            MouseProtocolEncoding::Sgr,
            MouseEventKind::Down(MouseButton::Right),
            KeyModifiers::CONTROL,
            0,
            0,
        )
        .unwrap();
        assert_eq!(ctrl_click, b"\x1b[<18;1;1M");
    }

    #[test]
    fn legacy_encoding_press_and_release() {
        let press = encode_mouse_event(
            MouseProtocolMode::PressRelease,
            MouseProtocolEncoding::Default,
            MouseEventKind::Down(MouseButton::Left),
            KeyModifiers::NONE,
            0,
            0,
        )
        .unwrap();
        assert_eq!(press, b"\x1b[M\x20\x21\x21");

        // Release collapses to button 3 in the legacy encoding.
        let release = encode_mouse_event(
            MouseProtocolMode::PressRelease,
            MouseProtocolEncoding::Default,
            MouseEventKind::Up(MouseButton::Left),
            KeyModifiers::NONE,
            0,
            0,
        )
        .unwrap();
        assert_eq!(release, b"\x1b[M\x23\x21\x21");
    }

    #[test]
    fn legacy_encoding_clamps_large_coordinates() {
        let press = encode_mouse_event(
            MouseProtocolMode::PressRelease,
            MouseProtocolEncoding::Default,
            MouseEventKind::Down(MouseButton::Left),
            KeyModifiers::NONE,
            500,
            500,
        )
        .unwrap();
        assert_eq!(press[4], 255);
        assert_eq!(press[5], 255);
    }

    #[test]
    fn utf8_encoding_multibyte_coordinates() {
        let press = encode_mouse_event(
            MouseProtocolMode::PressRelease,
            MouseProtocolEncoding::Utf8,
            MouseEventKind::Down(MouseButton::Left),
            KeyModifiers::NONE,
            299,
            0,
        )
        .unwrap();
        // 32 + 300 = 332 encodes as two UTF-8 bytes.
        let mut expected = b"\x1b[M\x20".to_vec();
        let mut buf = [0u8; 4];
        expected.extend_from_slice(
            char::from_u32(332)
                .unwrap()
                .encode_utf8(&mut buf)
                .as_bytes(),
        );
        expected.extend_from_slice("\u{21}".as_bytes());
        assert_eq!(press, expected);
    }

    #[test]
    fn press_mode_ignores_release_drag_motion_and_modifiers() {
        for kind in [
            MouseEventKind::Up(MouseButton::Left),
            MouseEventKind::Drag(MouseButton::Left),
            MouseEventKind::Moved,
        ] {
            assert_eq!(
                encode_mouse_event(
                    MouseProtocolMode::Press,
                    MouseProtocolEncoding::Sgr,
                    kind,
                    KeyModifiers::NONE,
                    0,
                    0,
                ),
                None
            );
        }

        // X10 never learned about modifiers.
        let press = encode_mouse_event(
            MouseProtocolMode::Press,
            MouseProtocolEncoding::Sgr,
            MouseEventKind::Down(MouseButton::Left),
            KeyModifiers::CONTROL,
            0,
            0,
        )
        .unwrap();
        assert_eq!(press, b"\x1b[<0;1;1M");
    }

    #[test]
    fn motion_reporting_follows_mode() {
        let drag = MouseEventKind::Drag(MouseButton::Left);
        let moved = MouseEventKind::Moved;

        assert!(
            encode_mouse_event(
                MouseProtocolMode::PressRelease,
                MouseProtocolEncoding::Sgr,
                drag,
                KeyModifiers::NONE,
                0,
                0
            )
            .is_none()
        );
        assert_eq!(
            encode_mouse_event(
                MouseProtocolMode::ButtonMotion,
                MouseProtocolEncoding::Sgr,
                drag,
                KeyModifiers::NONE,
                2,
                3
            )
            .unwrap(),
            b"\x1b[<32;3;4M"
        );
        assert!(
            encode_mouse_event(
                MouseProtocolMode::ButtonMotion,
                MouseProtocolEncoding::Sgr,
                moved,
                KeyModifiers::NONE,
                0,
                0
            )
            .is_none()
        );
        assert_eq!(
            encode_mouse_event(
                MouseProtocolMode::AnyMotion,
                MouseProtocolEncoding::Sgr,
                moved,
                KeyModifiers::NONE,
                2,
                3
            )
            .unwrap(),
            b"\x1b[<35;3;4M"
        );
    }
}
