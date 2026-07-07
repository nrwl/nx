use ratatui::{
    Frame,
    layout::{Alignment, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
};

use crate::native::tui::components::nx_paragraph::NxParagraph;
use crate::native::tui::theme::THEME;

/// What the help line describes: the task list, or a focused terminal pane.
pub enum HelpTextContext {
    TaskList {
        show_perf_report: bool,
    },
    Pane {
        can_be_interactive: bool,
        is_interactive: bool,
    },
}

pub struct HelpText {
    collapsed_mode: bool,
    is_dimmed: bool,
    align_left: bool,
    context: HelpTextContext,
}

impl HelpText {
    pub fn new(
        collapsed_mode: bool,
        is_dimmed: bool,
        align_left: bool,
        context: HelpTextContext,
    ) -> Self {
        Self {
            collapsed_mode,
            is_dimmed,
            align_left,
            context,
        }
    }

    pub fn set_collapsed_mode(&mut self, collapsed: bool) {
        self.collapsed_mode = collapsed;
    }

    pub fn render(&self, f: &mut Frame<'_>, area: Rect) {
        // Add a safety check to prevent rendering outside buffer bounds (this can happen if the user resizes the window a lot before it stabilizes it seems)
        if area.height == 0
            || area.width == 0
            || area.x >= f.area().width
            || area.y >= f.area().height
        {
            return; // Area is out of bounds, don't try to render
        }

        // Ensure area is entirely within frame bounds
        let safe_area = Rect {
            x: area.x,
            y: area.y,
            width: area.width.min(f.area().width.saturating_sub(area.x)),
            height: area.height.min(f.area().height.saturating_sub(area.y)),
        };

        let base_style = if self.is_dimmed {
            Style::default().add_modifier(Modifier::DIM)
        } else {
            Style::default()
        };
        let key_style = base_style.fg(THEME.info);
        let label_style = base_style.fg(THEME.secondary_fg);

        // While a pane is interactive, every key except the toggle is forwarded
        // to the task, so the toggle is the only honest hint to show.
        if let HelpTextContext::Pane {
            is_interactive: true,
            ..
        } = self.context
        {
            let hint = if self.collapsed_mode {
                vec![
                    Span::styled("exit: ", label_style),
                    Span::styled("<ctrl>+z", key_style),
                ]
            } else {
                vec![
                    Span::styled("INTERACTIVE", base_style.fg(THEME.primary_fg)),
                    Span::styled("  ", label_style),
                    Span::styled("exit interactive: ", label_style),
                    Span::styled("<ctrl>+z", key_style),
                ]
            };
            f.render_widget(
                NxParagraph::new(Line::from(hint)).alignment(self.alignment()),
                safe_area,
            );
            return;
        }

        if self.collapsed_mode {
            // Show minimal hint
            let hint = vec![
                Span::styled("quit: ", label_style),
                Span::styled("q", key_style),
                Span::styled("  ", label_style),
                Span::styled("help: ", label_style),
                Span::styled("?", key_style),
            ];
            f.render_widget(
                NxParagraph::new(Line::from(hint)).alignment(self.alignment()),
                safe_area,
            );
            return;
        }

        // Show full shortcuts, led by the pane's interactivity indicator when
        // it applies (moved off the pane's bottom border).
        let mut shortcuts = vec![];
        if let HelpTextContext::Pane {
            can_be_interactive: true,
            ..
        } = self.context
        {
            shortcuts.push(Span::styled("NON-INTERACTIVE", label_style));
            shortcuts.push(Span::styled("  ", label_style));
        }
        shortcuts.extend([
            Span::styled("quit: ", label_style),
            Span::styled("q", key_style),
            Span::styled("  ", label_style),
            Span::styled("help: ", label_style),
            Span::styled("?", key_style),
        ]);

        match self.context {
            HelpTextContext::TaskList { show_perf_report } => {
                shortcuts.extend([
                    Span::styled("  ", label_style),
                    Span::styled("navigate: ", label_style),
                    Span::styled("↑ ↓", key_style),
                    Span::styled("  ", label_style),
                    Span::styled("filter: ", label_style),
                    Span::styled("/", key_style),
                    Span::styled("  ", label_style),
                    Span::styled("pin output: ", label_style),
                    Span::styled("", label_style),
                    Span::styled("1", key_style),
                    Span::styled(" or ", label_style),
                    Span::styled("2", key_style),
                    Span::styled("  ", label_style),
                    Span::styled("show output: ", label_style),
                    Span::styled("<enter>", key_style),
                ]);

                // Only advertise the performance report once it exists (run finished).
                if show_perf_report {
                    shortcuts.push(Span::styled("  ", label_style));
                    shortcuts.push(Span::styled("perf report: ", label_style));
                    shortcuts.push(Span::styled("p", key_style));
                }
            }
            HelpTextContext::Pane {
                can_be_interactive, ..
            } => {
                shortcuts.extend([
                    Span::styled("  ", label_style),
                    Span::styled("scroll: ", label_style),
                    Span::styled("↑ ↓", key_style),
                    Span::styled("  ", label_style),
                    Span::styled("copy: ", label_style),
                    Span::styled("c", key_style),
                    Span::styled("  ", label_style),
                    Span::styled("full screen: ", label_style),
                    Span::styled("<enter>", key_style),
                ]);
                if can_be_interactive {
                    shortcuts.push(Span::styled("  ", label_style));
                    shortcuts.push(Span::styled("interact: ", label_style));
                    shortcuts.push(Span::styled("i", key_style));
                }
            }
        }

        f.render_widget(
            NxParagraph::new(Line::from(shortcuts)).alignment(Alignment::Right),
            safe_area,
        );
    }

    fn alignment(&self) -> Alignment {
        if self.align_left {
            Alignment::Left
        } else {
            Alignment::Right
        }
    }
}
