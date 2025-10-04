use std::sync::Arc;

use napi::{
    Env,
    threadsafe_function::{ErrorStrategy::CalleeHandled, ThreadsafeFunction},
};
use napi_derive::napi;
use parking_lot::RwLock;
use tracing::error;

use crate::native::metrics::collector::MetricsCollector;
use crate::native::metrics::types::MetricsUpdate;

/// NAPI wrapper for the process metrics collector
/// Provides a JavaScript-friendly interface for metrics collection
#[napi]
pub struct ProcessMetricsCollector {
    /// The actual metrics collector instance
    collector: Arc<RwLock<MetricsCollector>>,
}

#[napi]
impl ProcessMetricsCollector {
    /// Create a new metrics collector with default configuration
    #[napi(constructor)]
    pub fn new() -> anyhow::Result<Self> {
        let collector = MetricsCollector::new();

        Ok(Self {
            collector: Arc::new(RwLock::new(collector)),
        })
    }

    /// Start metrics collection
    /// Idempotent - safe to call multiple times
    #[napi]
    pub fn start_collection(&self) -> anyhow::Result<()> {
        let mut collector = self.collector.write();
        collector.start_collection().map_err(|e| {
            error!("Failed to start metrics collection: {}", e);
            anyhow::anyhow!("Failed to start collection: {}", e)
        })
    }

    /// Stop metrics collection
    /// Returns true if collection was stopped, false if not running
    #[napi]
    pub fn stop_collection(&self) -> anyhow::Result<bool> {
        let mut collector = self.collector.write();
        match collector.stop_collection() {
            Ok(()) => Ok(true),
            Err(crate::native::metrics::types::MetricsError::CollectionNotStarted) => Ok(false),
            Err(e) => {
                error!("[METRICS-NAPI] Failed to stop metrics collection: {}", e);
                Err(anyhow::anyhow!("Failed to stop collection: {}", e))
            }
        }
    }

    /// Register the main CLI process for metrics collection
    #[napi]
    pub fn register_main_cli_process(&self, pid: i32) {
        let collector = self.collector.read();
        collector.register_main_cli_process(pid);
    }

    /// Register the daemon process for metrics collection
    #[napi]
    pub fn register_daemon_process(&self, pid: i32) {
        let collector = self.collector.read();
        collector.register_daemon_process(pid);
    }

    /// Register a process for a specific task
    /// Automatically creates the task if it doesn't exist
    #[napi]
    pub fn register_task_process(&self, task_id: String, pid: i32) {
        let collector = self.collector.read();
        collector.register_task_process(task_id, pid);
    }

    /// Register a batch with multiple tasks sharing a worker
    #[napi]
    pub fn register_batch(&self, batch_id: String, task_ids: Vec<String>, pid: i32) {
        let collector = self.collector.read();
        collector.register_batch(batch_id, task_ids, pid);
    }

    /// Subscribe to push-based metrics notifications from TypeScript
    #[napi(ts_args_type = "callback: (err: Error | null, event: MetricsUpdate) => void")]
    pub fn subscribe(&mut self, env: Env, callback: napi::JsFunction) -> anyhow::Result<()> {
        // Create threadsafe function for updates
        let mut tsfn: ThreadsafeFunction<MetricsUpdate, CalleeHandled> =
            callback.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;
        tsfn.unref(&env)?;

        // Store callback for future updates
        // The subscriber will receive full metadata on first update via needs_full_metadata flag
        let mut collector = self.collector.write();
        collector.subscribe(tsfn);

        Ok(())
    }
}

// Implement Drop for proper cleanup
impl Drop for ProcessMetricsCollector {
    fn drop(&mut self) {
        // Block until we acquire the lock - this is safe because:
        // 1. parking_lot::RwLock doesn't poison on panic (unlike std::sync::RwLock)
        // 2. Worst case: blocks for one collection interval (~50ms) during shutdown
        // 3. True deadlock impossible (only one lock, no circular dependencies)
        // 4. Alternative (try_write) risks permanent resource leak if lock is held
        let mut collector = self.collector.write();
        if collector.is_collecting() {
            if let Err(e) = collector.stop_collection() {
                error!(
                    "Failed to stop collection during ProcessMetricsCollector drop: {}",
                    e
                );
            }
        }
    }
}
