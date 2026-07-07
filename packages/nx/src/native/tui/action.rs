use crate::native::tasks::types::{Task, TaskResult};

use super::{
    app::Focus,
    components::{task_selection_manager::SelectionEntry, tasks_list::TaskStatus},
    lifecycle::{BatchInfo, BatchStatus, CloudConnectionStatus, TuiMode},
};

#[derive(Debug, Clone, PartialEq)]
pub enum Action {
    Tick,
    Render,
    Resize(u16, u16),
    Quit,
    CancelQuit,
    Error(String),
    Help,
    EnterFilterMode,
    ClearFilter,
    AddFilterChar(char),
    RemoveFilterChar,
    ScrollUp,
    ScrollDown,
    PinSelection(SelectionEntry, usize),
    UnpinSelection(usize),
    UnpinAllTasks,
    SortTasks,
    NextTask,
    PreviousTask,
    SetSpacebarMode(bool),
    ScrollPaneUp(usize),
    ScrollPaneDown(usize),
    UpdateTaskStatus(String, TaskStatus),
    SetTaskTiming(String, i64, i64),
    UpdateCloudMessage(String),
    /// Set a structured Nx Cloud link to render as a clickable label (display
    /// label, href URL). Distinct from `UpdateCloudMessage` so the displayed
    /// text and the opened URL can differ (e.g. "View in Nx Cloud").
    UpdateCloudLink(String, String),
    /// Update the Nx Cloud connection status shown in the bottom bar and used
    /// to gate the connect shortcut.
    UpdateCloudConnectionStatus(CloudConnectionStatus),
    UpdateFocus(Focus),
    StartCommand(Option<u32>),
    StartTasks(Vec<Task>),
    EndTasks(Vec<TaskResult>),
    ToggleDebugMode,
    ToggleMouseCapture,
    SendConsoleMessage(String),
    ConsoleMessengerAvailable(bool),
    EndCommand,
    ShowHint(String),
    SwitchMode(TuiMode),
    StartBatch(String, BatchInfo),
    EndBatch(String, BatchStatus),
    ExpandBatch(String),
    CollapseBatch(String),
}
