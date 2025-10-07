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
            collection_interval_ms: 500, // 500ms for push-based collection
        }
    }
}

/// Error types specific to metrics collection
#[derive(Debug, thiserror::Error)]
pub enum MetricsError {
    #[error("Collection not started")]
    CollectionNotStarted,
    #[error("Collection already started")]
    CollectionAlreadyStarted,
    #[error("System information error: {0}")]
    SystemError(String),
    #[error("Configuration error: {0}")]
    ConfigError(String),
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

/// Process snapshot with full metadata and metrics
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ProcessSnapshot {
    pub pid: i32,
    pub ppid: i32,
    pub name: String,
    pub command: String,
    pub exe_path: String,
    pub cwd: String,
    pub cpu: f64,
    pub memory: i64,
}

impl ProcessSnapshot {
    pub fn new(
        pid: i32,
        ppid: i32,
        name: String,
        command: String,
        exe_path: String,
        cwd: String,
        cpu: f64,
        memory: i64,
    ) -> Self {
        Self {
            pid,
            ppid,
            name,
            command,
            exe_path,
            cwd,
            cpu,
            memory,
        }
    }
}

/// Metrics data for collection cycle
#[napi(object)]
#[derive(Debug, Clone)]
pub struct MetricsData {
    pub timestamp: i64,
    pub main_cli_process: Option<ProcessSnapshot>,
    pub daemon_processes: Vec<ProcessSnapshot>,
    pub tasks: HashMap<String, Vec<ProcessSnapshot>>,
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
}

/// Process metrics (dynamic, changes every collection)
#[napi(object)]
#[derive(Debug, Clone, Copy)]
pub struct ProcessMetrics {
    pub pid: i32,
    pub cpu: f64,
    pub memory: i64,
}

/// Daemon metrics with main process and subprocesses
#[napi(object)]
#[derive(Debug, Clone)]
pub struct DaemonMetrics {
    pub main: ProcessMetrics,
    pub subprocesses: Vec<ProcessMetrics>,
}

/// Batch metrics snapshot
#[napi(object)]
#[derive(Debug, Clone)]
pub struct BatchMetricsSnapshot {
    pub batch_id: String,
    pub task_ids: Arc<Vec<String>>,
    pub processes: Vec<ProcessMetrics>,
}

/// Organized collection of process metrics with timestamp
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ProcessMetricsSnapshot {
    pub timestamp: i64,
    pub main_cli: Option<ProcessMetrics>,
    pub daemon: Option<DaemonMetrics>,
    pub tasks: HashMap<String, Vec<ProcessMetrics>>,
    pub batches: HashMap<String, BatchMetricsSnapshot>,
}

/// Metrics update sent every collection cycle
#[napi(object)]
#[derive(Debug, Clone)]
pub struct MetricsUpdate {
    pub metrics: Arc<ProcessMetricsSnapshot>,
    pub metadata: Option<Arc<HashMap<String, ProcessMetadata>>>,
}
