use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Daemon status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DaemonStatus {
    Disconnected,
    Connecting,
    Connected,
}

/// Generic daemon message for request/response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DaemonMessage {
    /// Handshake message
    Handshake {
        #[serde(rename = "type")]
        msg_type: String,
        version: String,
    },
    /// Generic request message
    Request {
        #[serde(rename = "type")]
        msg_type: String,
        #[serde(flatten)]
        payload: serde_json::Value,
    },
    /// Generic response message
    Response(serde_json::Value),
}

/// Project graph response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectGraphResponse {
    #[serde(rename = "projectGraph")]
    pub project_graph: serde_json::Value,
    #[serde(rename = "sourceMaps")]
    pub source_maps: serde_json::Value,
}

/// File data response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDataResponse {
    pub data: Vec<serde_json::Value>,
}

/// Hash result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HashResult {
    pub hashes: Vec<String>,
}

/// File watcher change
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileWatcherChange {
    #[serde(rename = "changedProjects")]
    pub changed_projects: Vec<String>,
    #[serde(rename = "changedFiles")]
    pub changed_files: Vec<ChangedFile>,
}

/// Changed file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangedFile {
    pub file: String,
    pub ext: String,
    #[serde(rename = "type")]
    pub change_type: String, // "create" | "update" | "delete"
}

/// Workspace context file data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceContext {
    pub files: Vec<serde_json::Value>,
}

/// Configuration for file watcher registration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileWatcherConfig {
    #[serde(rename = "watchProjects")]
    pub watch_projects: WatchProjectsConfig,
    #[serde(rename = "includeGlobalWorkspaceFiles")]
    pub include_global_workspace_files: Option<bool>,
    #[serde(rename = "includeDependentProjects")]
    pub include_dependent_projects: Option<bool>,
    #[serde(rename = "allowPartialGraph")]
    pub allow_partial_graph: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum WatchProjectsConfig {
    All(String), // "all"
    Projects(Vec<String>),
}

/// Sync generator changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncGeneratorChanges {
    pub changes: HashMap<String, serde_json::Value>,
}

/// Task run information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRun {
    pub task: String,
    pub start: i64,
    pub end: i64,
    pub success: bool,
}

/// Estimated task timings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskTiming {
    pub task: String,
    pub estimated_duration: i64,
}

/// Flaky task information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlakyTask {
    pub task: String,
    pub flake_count: i32,
}

/// Pre-task execution context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreTasksExecutionContext {
    pub tasks: Vec<String>,
}

/// Post-task execution context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostTasksExecutionContext {
    pub task_results: Vec<TaskRunResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRunResult {
    pub task: String,
    pub success: bool,
    pub duration: i64,
}
