use napi_derive::napi;

/// Event types that can be emitted by the TUI to control task execution
///
/// These event types flow from the TUI (Rust) to the TaskOrchestrator (TypeScript).
/// The TypeScript side registers a handler via `registerLifecycleEventHandler`.
#[napi(string_enum)]
#[derive(Debug, PartialEq, Eq)]
pub enum LifecycleEventType {
    /// Re-run a completed task or restart a running task
    RerunTask,
    /// Kill a running task without re-running
    KillTask,
    /// Re-run all failed tasks
    RerunAllFailed,
    /// Kill all currently running tasks
    KillAllRunning,
}

/// Event emitted by the TUI to control task execution
///
/// Contains an event type and optional task_id for task-specific events.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct LifecycleEvent {
    /// The type of lifecycle event
    pub event_type: LifecycleEventType,
    /// The task ID (required for RerunTask and KillTask, None for bulk operations)
    pub task_id: Option<String>,
}

impl LifecycleEvent {
    /// Create a RerunTask event for a specific task
    pub fn rerun_task(task_id: String) -> Self {
        Self {
            event_type: LifecycleEventType::RerunTask,
            task_id: Some(task_id),
        }
    }

    /// Create a KillTask event for a specific task
    pub fn kill_task(task_id: String) -> Self {
        Self {
            event_type: LifecycleEventType::KillTask,
            task_id: Some(task_id),
        }
    }

    /// Create a RerunAllFailed event
    pub fn rerun_all_failed() -> Self {
        Self {
            event_type: LifecycleEventType::RerunAllFailed,
            task_id: None,
        }
    }

    /// Create a KillAllRunning event
    pub fn kill_all_running() -> Self {
        Self {
            event_type: LifecycleEventType::KillAllRunning,
            task_id: None,
        }
    }
}
