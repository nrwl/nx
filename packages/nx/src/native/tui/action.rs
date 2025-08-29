use crate::native::tasks::types::{Task, TaskResult};

use super::{app::Focus, components::tasks_list::TaskStatus};

#[derive(Debug, Clone, PartialEq, Eq)]
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
    PinTask(String, usize),
    UnpinTask(String, usize),
    UnpinAllTasks,
    SortTasks,
    NextTask,
    PreviousTask,
    SetSpacebarMode(bool),
    ScrollPaneUp(usize),
    ScrollPaneDown(usize),
    UpdateTaskStatus(String, TaskStatus),
    UpdateCloudMessage(String),
    UpdateFocus(Focus),
    StartCommand(Option<u32>),
    StartTasks(Vec<Task>),
    EndTasks(Vec<TaskResult>),
    ToggleDebugMode,
    SendConsoleMessage(String),
    ConsoleMessengerAvailable(bool),
    EndCommand,
}
