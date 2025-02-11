use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Action {
    Tick,
    Render,
    Resize(u16, u16),
    Quit,
    Error(String),
    Help,
    // Task list actions
    EnterFilterMode,
    ClearFilter,
    AddFilterChar(char),
    RemoveFilterChar,
    ScrollUp,
    ScrollDown,
    NextTask,
    PreviousTask,
    NextPage,
    PreviousPage,
    ToggleOutput,
    ToggleMark,
    UnmarkAll,
    FocusNext,
    FocusPrevious,
    ScrollPaneUp(usize),
    ScrollPaneDown(usize),
}
