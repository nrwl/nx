use arboard::Clipboard;

/// Copy `text` to the system clipboard, returning whether it succeeded. Keeps
/// the `Clipboard::new()` / `set_text` dance in one place so every copy path
/// (pane selection, full output, region selection, inline output) stays in sync.
pub(crate) fn copy_to_clipboard(text: &str) -> bool {
    Clipboard::new()
        .and_then(|mut clipboard| clipboard.set_text(text))
        .is_ok()
}
