use std::collections::HashMap;
use std::sync::Arc;

use napi_derive::napi;

/// Configuration for the metrics collector
#[derive(Debug, Clone)]
pub struct CollectorConfig {
    /// How often to collect metrics (milliseconds)
    pub collection_interval_ms: u64,
}

impl Default for CollectorConfig {
    fn default() -> Self {
        Self {
            collection_interval_ms: 1_000, // 1 second for push-based collection
        }
    }
}

/// Registration data for individual tasks with multiple processes
#[derive(Debug, Clone)]
pub struct IndividualTaskRegistration {
    pub task_id: String,
    pub anchor_pids: std::collections::HashSet<i32>, // Multiple PIDs allowed
}

impl IndividualTaskRegistration {
    pub fn new(task_id: String) -> Self {
        Self {
            task_id,
            anchor_pids: std::collections::HashSet::new(),
        }
    }
}

/// Registration data for batch execution with multiple tasks sharing a worker
#[derive(Debug, Clone)]
pub struct BatchRegistration {
    pub batch_id: String,
    pub task_ids: Arc<Vec<String>>,
    pub anchor_pid: i32,
}

impl BatchRegistration {
    pub fn new(batch_id: String, task_ids: Vec<String>, anchor_pid: i32) -> Self {
        Self {
            batch_id,
            task_ids: Arc::new(task_ids),
            anchor_pid,
        }
    }
}

/// Process metadata (static, doesn't change during process lifetime)
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ProcessMetadata {
    pub ppid: i32,
    pub name: String,
    pub command: String,
    pub exe_path: String,
    pub cwd: String,
    pub alias: Option<String>,
    pub group_id: String,
    pub is_root: bool,
}

/// Process metrics (dynamic, changes every collection)
#[napi(object)]
#[derive(Debug, Clone, Copy)]
pub struct ProcessMetrics {
    pub pid: i32,
    pub cpu: f64,
    pub memory: i64,
}

/// Group type discriminator
#[napi(string_enum)]
#[derive(Debug, PartialEq, Eq)]
pub enum GroupType {
    MainCLI,
    MainCliSubprocesses,
    Daemon,
    DaemonSubprocesses,
    Task,
    Batch,
}

/// Group information - union of different process group types
/// Use group_type to discriminate which optional fields are present
#[napi(object)]
#[derive(Debug, Clone)]
pub struct GroupInfo {
    /// Type discriminator: MainCLI, Daemon, Task, or Batch
    pub group_type: GroupType,
    /// Display name for the group
    pub display_name: String,
    /// Unique ID for this group
    pub id: String,
    /// Task IDs in this batch (present for Batch groups)
    pub task_ids: Option<Vec<String>>,
}

/// Combined metadata for groups and processes
#[napi(object)]
#[derive(Debug, Clone)]
pub struct Metadata {
    /// Group-level metadata
    pub groups: HashMap<String, GroupInfo>,
    /// Process-level metadata (keyed by PID as string for NAPI compatibility)
    pub processes: HashMap<String, ProcessMetadata>,
}

/// Metrics update sent every collection cycle
#[napi(object)]
#[derive(Debug, Clone)]
pub struct MetricsUpdate {
    pub timestamp: i64,
    pub processes: Vec<ProcessMetrics>,
    pub metadata: Metadata,
}

/// System information (static system-level data)
#[napi(object)]
#[derive(Debug, Clone)]
pub struct SystemInfo {
    pub cpu_cores: u32,
    pub total_memory: i64,
}
