use ratatui::{
    style::{Modifier, Style},
    text::Span,
};

use crate::native::tui::components::tasks_list::TaskStatus;
use crate::native::tui::theme::THEME;

/// Returns a status icon span for the given task status and throbber counter.
/// This is used consistently across the TUI for status visualization.
pub fn get_status_icon(status: TaskStatus, throbber_counter: usize) -> Span<'static> {
    match status {
        TaskStatus::Success
        | TaskStatus::LocalCacheKeptExisting
        | TaskStatus::LocalCache
        | TaskStatus::RemoteCache => Span::styled(
            "  ✔  ",
            Style::default()
                .fg(THEME.success)
                .add_modifier(Modifier::BOLD),
        ),
        TaskStatus::Failure => Span::styled(
            "  ✖  ",
            Style::default()
                .fg(THEME.error)
                .add_modifier(Modifier::BOLD),
        ),
        TaskStatus::Skipped => Span::styled(
            "  ⏭  ",
            Style::default()
                .fg(THEME.warning)
                .add_modifier(Modifier::BOLD),
        ),
        TaskStatus::InProgress | TaskStatus::Shared => {
            let throbber_chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
            let throbber_char = throbber_chars[throbber_counter % throbber_chars.len()];
            Span::styled(
                format!("  {}  ", throbber_char),
                Style::default().fg(THEME.info).add_modifier(Modifier::BOLD),
            )
        }
        TaskStatus::Stopped => Span::styled(
            "  ◼  ",
            Style::default()
                .fg(THEME.secondary_fg)
                .add_modifier(Modifier::BOLD),
        ),
        TaskStatus::NotStarted => Span::styled(
            "  ·  ",
            Style::default()
                .fg(THEME.secondary_fg)
                .add_modifier(Modifier::BOLD),
        ),
    }
}

/// Returns just the status character (without spacing) for the given status and throbber counter.
/// This is useful when you need to build custom spans with different spacing.
pub fn get_status_char(status: TaskStatus, throbber_counter: usize) -> char {
    match status {
        TaskStatus::Success
        | TaskStatus::LocalCacheKeptExisting
        | TaskStatus::LocalCache
        | TaskStatus::RemoteCache => '✔',
        TaskStatus::Failure => '✖',
        TaskStatus::Skipped => '⏭',
        TaskStatus::InProgress | TaskStatus::Shared => {
            let throbber_chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
            throbber_chars[throbber_counter % throbber_chars.len()]
        }
        TaskStatus::Stopped => '◼',
        TaskStatus::NotStarted => '·',
    }
}

/// Returns the appropriate style for a status icon.
pub fn get_status_style(status: TaskStatus) -> Style {
    match status {
        TaskStatus::Success
        | TaskStatus::LocalCacheKeptExisting
        | TaskStatus::LocalCache
        | TaskStatus::RemoteCache => Style::default()
            .fg(THEME.success)
            .add_modifier(Modifier::BOLD),
        TaskStatus::Failure => Style::default()
            .fg(THEME.error)
            .add_modifier(Modifier::BOLD),
        TaskStatus::Skipped => Style::default()
            .fg(THEME.warning)
            .add_modifier(Modifier::BOLD),
        TaskStatus::InProgress | TaskStatus::Shared => {
            Style::default().fg(THEME.info).add_modifier(Modifier::BOLD)
        }
        TaskStatus::Stopped | TaskStatus::NotStarted => Style::default()
            .fg(THEME.secondary_fg)
            .add_modifier(Modifier::BOLD),
    }
}
