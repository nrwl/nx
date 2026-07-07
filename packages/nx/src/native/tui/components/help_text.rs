use ratatui::{
    Frame,
    layout::{Alignment, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
};

use crate::native::tui::components::nx_paragraph::NxParagraph;
use crate::native::tui::theme::THEME;

/// Columns between adjacent help items.
const ITEM_SEPARATOR: &str = "  ";

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

/// The keyboard hints for the current focus context, rendered as whole items:
/// as many fit the given area as possible, dropping from the end (items are
/// ordered most-important first).
pub struct HelpText {
    is_dimmed: bool,
    align_left: bool,
    context: HelpTextContext,
}

impl HelpText {
    pub fn new(is_dimmed: bool, align_left: bool, context: HelpTextContext) -> Self {
        Self {
            is_dimmed,
            align_left,
            context,
        }
    }

    /// The width of the hints that must never be crowded out by other
    /// sections: quit/help for the task list, plus the pinned interactivity
    /// indicator for a pane that can take input.
    pub fn essential_width(&self) -> u16 {
        let suffix_width = self
            .pinned_suffix()
            .map(|suffix| Self::item_width(&suffix))
            .unwrap_or(0);
        let essential_items = match self.context {
            HelpTextContext::Pane {
                is_interactive: true,
                ..
            } => 0,
            _ => 2, // quit, help
        };
        let mut used = 0usize;
        for (idx, item) in self.items().iter().take(essential_items).enumerate() {
            let separator = if idx == 0 { 0 } else { ITEM_SEPARATOR.len() };
            used += separator + Self::item_width(item);
        }
        Self::joined_width(used, suffix_width) as u16
    }

    /// The width the help line actually renders at inside `max_width`: the
    /// pinned suffix (if any) plus the longest prefix of whole items that
    /// fits. Lets the caller reserve exactly the used columns and give the
    /// rest to other sections.
    pub fn fitted_width(&self, max_width: u16) -> u16 {
        let suffix_width = self
            .pinned_suffix()
            .map(|suffix| Self::item_width(&suffix))
            .unwrap_or(0);
        let items_budget = (max_width as usize).saturating_sub(Self::joined_width(0, suffix_width));
        Self::joined_width(self.fitted_items_width(items_budget), suffix_width) as u16
    }

    /// Width of the longest prefix of whole items fitting `budget`.
    fn fitted_items_width(&self, budget: usize) -> usize {
        let mut used = 0usize;
        for (idx, item) in self.items().iter().enumerate() {
            let separator = if idx == 0 { 0 } else { ITEM_SEPARATOR.len() };
            let item_width = Self::item_width(item);
            if used + separator + item_width > budget {
                break;
            }
            used += separator + item_width;
        }
        used
    }

    /// Combined width of the droppable items and the pinned suffix, with a
    /// separator between them only when both are present.
    fn joined_width(items_width: usize, suffix_width: usize) -> usize {
        match (items_width, suffix_width) {
            (0, s) => s,
            (i, 0) => i,
            (i, s) => i + ITEM_SEPARATOR.len() + s,
        }
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

        // Keep the longest prefix of whole items that fits the area, then pin
        // the suffix (the pane's interactivity indicator) at the far right.
        let label_style = self.label_style();
        let suffix = self.pinned_suffix();
        let suffix_width = suffix
            .as_ref()
            .map(|suffix| Self::item_width(suffix))
            .unwrap_or(0);
        let items_budget =
            (safe_area.width as usize).saturating_sub(Self::joined_width(0, suffix_width));

        let mut spans: Vec<Span<'static>> = Vec::new();
        let mut used = 0usize;
        for (idx, item) in self.items().into_iter().enumerate() {
            let separator = if idx == 0 { 0 } else { ITEM_SEPARATOR.len() };
            let item_width = Self::item_width(&item);
            if used + separator + item_width > items_budget {
                break;
            }
            if idx > 0 {
                spans.push(Span::styled(ITEM_SEPARATOR, label_style));
            }
            spans.extend(item);
            used += separator + item_width;
        }
        if let Some(suffix) = suffix {
            if !spans.is_empty() {
                spans.push(Span::styled(ITEM_SEPARATOR, label_style));
            }
            spans.extend(suffix);
        }
        if spans.is_empty() {
            return;
        }

        let alignment = if self.align_left {
            Alignment::Left
        } else {
            Alignment::Right
        };
        f.render_widget(
            NxParagraph::new(Line::from(spans)).alignment(alignment),
            safe_area,
        );
    }

    /// The hint items for the context, most important first (later items are
    /// the first to disappear when space runs out).
    fn items(&self) -> Vec<Vec<Span<'static>>> {
        let label_style = self.label_style();
        let key_style = self.base_style().fg(THEME.info);
        let item = |label: &'static str, key: &'static str| {
            vec![
                Span::styled(label, label_style),
                Span::styled(key, key_style),
            ]
        };

        match self.context {
            // While a pane is interactive, every key except the toggle is
            // forwarded to the task, so the pinned suffix is the only honest
            // hint to show.
            HelpTextContext::Pane {
                is_interactive: true,
                ..
            } => vec![],
            HelpTextContext::Pane { .. } => {
                vec![
                    item("quit: ", "q"),
                    item("help: ", "?"),
                    item("search: ", "/"),
                    item("full screen: ", "<enter>"),
                    item("copy: ", "c"),
                    item("scroll: ", "↑ ↓"),
                ]
            }
            HelpTextContext::TaskList { show_perf_report } => {
                let mut items = vec![
                    item("quit: ", "q"),
                    item("help: ", "?"),
                    item("navigate: ", "↑ ↓"),
                    item("filter: ", "/"),
                    vec![
                        Span::styled("pin output: ", label_style),
                        Span::styled("1", key_style),
                        Span::styled(" or ", label_style),
                        Span::styled("2", key_style),
                    ],
                    item("show output: ", "<enter>"),
                ];
                // Only advertise the performance report once it exists (run finished).
                if show_perf_report {
                    items.push(item("perf report: ", "p"));
                }
                items
            }
        }
    }

    /// The pane's interactivity indicator, rendered exactly as it used to be
    /// on the pane's bottom border, pinned as the right-most element and never
    /// dropped by the space fitting.
    fn pinned_suffix(&self) -> Option<Vec<Span<'static>>> {
        let HelpTextContext::Pane {
            can_be_interactive: true,
            is_interactive,
        } = self.context
        else {
            return None;
        };
        let key_style = self.base_style().fg(THEME.info);
        Some(if is_interactive {
            let mode_style = self.base_style().fg(THEME.primary_fg);
            vec![
                Span::styled("INTERACTIVE ", mode_style),
                Span::styled("<ctrl>+z", key_style),
                Span::styled(" to toggle", mode_style),
            ]
        } else {
            let mode_style = self.label_style();
            vec![
                Span::styled("NON-INTERACTIVE ", mode_style),
                Span::styled("i", key_style),
                Span::styled(" to toggle", mode_style),
            ]
        })
    }

    fn item_width(item: &[Span<'static>]) -> usize {
        item.iter().map(|span| span.width()).sum()
    }

    fn base_style(&self) -> Style {
        if self.is_dimmed {
            Style::default().add_modifier(Modifier::DIM)
        } else {
            Style::default()
        }
    }

    fn label_style(&self) -> Style {
        self.base_style().fg(THEME.secondary_fg)
    }
}
