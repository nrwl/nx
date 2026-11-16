//! Width-aware string helpers for terminal rendering.

/// Display width (in terminal columns) of a string, honouring wide characters.
pub(crate) fn display_width(text: &str) -> usize {
    ratatui::text::Span::raw(text).width()
}

/// Fit `display` into `max_width` columns, appending an ellipsis when it must be
/// truncated. Width-aware so wide characters never overflow the area (and never
/// slices a multi-byte character at a non-char boundary).
pub(crate) fn fit_with_ellipsis(display: &str, max_width: usize) -> String {
    if max_width == 0 {
        return String::new();
    }
    if display_width(display) <= max_width {
        return display.to_string();
    }
    // No room for text plus an ellipsis — just fill with dots.
    if max_width <= 3 {
        return ".".repeat(max_width);
    }

    let budget = max_width - 3;
    let mut out = String::new();
    let mut width = 0usize;
    for ch in display.chars() {
        let char_width = display_width(&ch.to_string());
        if width + char_width > budget {
            break;
        }
        out.push(ch);
        width += char_width;
    }
    out.push_str("...");
    out
}
