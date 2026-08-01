use ratatui::{
    buffer::Buffer,
    layout::{Alignment, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Widget,
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
        /// Whether the pane shows terminal output. When false (a not-yet-started
        /// task's dependency view) the output-only hints (search, copy) are
        /// dropped.
        has_output: bool,
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
    /// sections: the right-anchored quit/help for the task list, plus the
    /// pinned interactivity indicator for a pane that can take input.
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
            _ => 2, // quit, help (the two right-most items)
        };
        let items = self.items();
        let start = items.len().saturating_sub(essential_items);
        Self::joined_width(Self::items_width(&items[start..]), suffix_width) as u16
    }

    /// The width the help line actually renders at inside `max_width`: the
    /// pinned suffix (if any) plus the longest suffix of whole items that
    /// fits. Lets the caller reserve exactly the used columns and give the
    /// rest to other sections.
    pub fn fitted_width(&self, max_width: u16) -> u16 {
        let suffix_width = self
            .pinned_suffix()
            .map(|suffix| Self::item_width(&suffix))
            .unwrap_or(0);
        let items_budget = (max_width as usize).saturating_sub(Self::joined_width(0, suffix_width));
        let items = self.items();
        let start = self.fitted_items_start(&items, items_budget);
        Self::joined_width(Self::items_width(&items[start..]), suffix_width) as u16
    }

    /// Index of the left-most item that still fits when keeping the right-most
    /// items (dropping whole items from the left). Returns `items.len()` when
    /// nothing fits.
    fn fitted_items_start(&self, items: &[Vec<Span<'static>>], budget: usize) -> usize {
        let mut used = 0usize;
        let mut start = items.len();
        for (idx, item) in items.iter().enumerate().rev() {
            let separator = if idx == items.len() - 1 {
                0
            } else {
                ITEM_SEPARATOR.len()
            };
            let item_width = Self::item_width(item);
            if used + separator + item_width > budget {
                break;
            }
            used += separator + item_width;
            start = idx;
        }
        start
    }

    /// Width of a contiguous run of items joined by separators.
    fn items_width(items: &[Vec<Span<'static>>]) -> usize {
        items
            .iter()
            .enumerate()
            .map(|(idx, item)| {
                let separator = if idx == 0 { 0 } else { ITEM_SEPARATOR.len() };
                separator + Self::item_width(item)
            })
            .sum()
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

    pub fn render(&self, buf: &mut Buffer, area: Rect) {
        // Add a safety check to prevent rendering outside buffer bounds (this can happen if the user resizes the window a lot before it stabilizes it seems)
        let buf_area = *buf.area();
        if area.height == 0
            || area.width == 0
            || area.x >= buf_area.width
            || area.y >= buf_area.height
        {
            return; // Area is out of bounds, don't try to render
        }

        // Ensure area is entirely within buffer bounds
        let safe_area = Rect {
            x: area.x,
            y: area.y,
            width: area.width.min(buf_area.width.saturating_sub(area.x)),
            height: area.height.min(buf_area.height.saturating_sub(area.y)),
        };

        // Keep the longest suffix of whole items that fits, so the most
        // important hints (quit/help) stay anchored on the right and new items
        // grow in from the left. The pinned suffix (the pane's interactivity
        // indicator) sits to the right of everything and is never dropped.
        let label_style = self.label_style();
        let suffix = self.pinned_suffix();
        let suffix_width = suffix
            .as_ref()
            .map(|suffix| Self::item_width(suffix))
            .unwrap_or(0);
        let items_budget =
            (safe_area.width as usize).saturating_sub(Self::joined_width(0, suffix_width));

        let items = self.items();
        let start = self.fitted_items_start(&items, items_budget);
        let mut spans: Vec<Span<'static>> = Vec::new();
        for (idx, item) in items.into_iter().enumerate() {
            if idx < start {
                continue;
            }
            if idx > start {
                spans.push(Span::styled(ITEM_SEPARATOR, label_style));
            }
            spans.extend(item);
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
        NxParagraph::new(Line::from(spans))
            .alignment(alignment)
            .render(safe_area, buf);
    }

    /// The hint items in left-to-right display order: least important first,
    /// with quit/help anchored on the right. As space shrinks, whole items
    /// drop from the left, so quit/help are the last to go.
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
            HelpTextContext::Pane { has_output, .. } => {
                let mut items = vec![item("scroll: ", "↑ ↓")];
                // search and copy only act on terminal output; a not-yet-started
                // task's dependency view has none, so drop them there.
                if has_output {
                    items.push(item("copy: ", "c"));
                    items.push(item("search: ", "/"));
                }
                items.push(item("full screen: ", "<enter>"));
                items.push(item("quit: ", "q"));
                items.push(item("help: ", "?"));
                items
            }
            HelpTextContext::TaskList { show_perf_report } => {
                let mut items = vec![];
                // Only advertise the performance report once it exists (run
                // finished); it is the least important, so it sits left-most.
                if show_perf_report {
                    items.push(item("perf report: ", "p"));
                }
                items.push(vec![
                    Span::styled("pin output: ", label_style),
                    Span::styled("1", key_style),
                    Span::styled(" or ", label_style),
                    Span::styled("2", key_style),
                ]);
                items.push(item("show output: ", "<enter>"));
                items.push(item("filter: ", "/"));
                items.push(item("navigate: ", "↑ ↓"));
                items.push(item("quit: ", "q"));
                items.push(item("help: ", "?"));
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
            ..
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
