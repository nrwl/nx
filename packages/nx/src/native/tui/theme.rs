// Sadly clippy doesn't seem to support only allowing the ratatui type, we have to disable the whole lint
#![allow(clippy::disallowed_types)]

// This is the only file we should use the `ratatui::style::Color` type in
use ratatui::style::Color;
use std::sync::LazyLock;
use terminal_colorsaurus::{ColorScheme, QueryOptions, color_scheme};
use tracing::debug;

pub static THEME: LazyLock<Theme> = LazyLock::new(Theme::init);

/// Holds theme-dependent colors calculated based on dark/light mode.
#[derive(Debug)]
pub struct Theme {
    pub is_dark_mode: bool,
    pub primary_fg: Color,
    pub secondary_fg: Color,
    pub error: Color,
    pub success: Color,
    pub warning: Color,
    pub info: Color,
    pub info_light: Color,
}

impl Theme {
    fn init() -> Self {
        if Self::is_dark_mode() {
            debug!("Initializing dark theme");
            Self::dark()
        } else {
            debug!("Initializing light theme");
            Self::light()
        }
    }

    fn dark() -> Self {
        Self {
            is_dark_mode: true,
            // reset => default foreground color
            primary_fg: Color::Reset,
            secondary_fg: Color::Gray,
            error: Color::Red,
            success: Color::Green,
            warning: Color::Yellow,
            info: Color::Cyan,
            info_light: Color::LightCyan,
        }
    }

    fn light() -> Self {
        Self {
            is_dark_mode: false,
            // reset => default foreground color
            primary_fg: Color::Reset,
            secondary_fg: Color::DarkGray,
            error: Color::Red,
            success: Color::Green,
            warning: Color::Yellow,
            info: Color::Cyan,
            info_light: Color::LightCyan,
        }
    }

    /// Detects if the current terminal likely uses a dark theme background.
    /// NOTE: This requires raw mode access and might not work correctly once the TUI is fully running.
    /// It should ideally be called once during initialization.
    fn is_dark_mode() -> bool {
        match color_scheme(QueryOptions::default()) {
            Ok(ColorScheme::Dark) => true,
            Ok(ColorScheme::Light) => false,
            Err(_) => true, // Default to dark mode if detection fails
        }
    }
}
