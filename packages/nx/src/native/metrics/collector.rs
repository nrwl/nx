use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::JoinHandle;

use anyhow::Result;
use dashmap::DashMap;
use napi::{Env, JsFunction};
use napi_derive::napi;
use parking_lot::Mutex;
use sysinfo::{Pid, ProcessRefreshKind, System, UpdateKind};
use tracing::error;

use crate::native::metrics::types::{
    BatchMetricsSnapshot, BatchRegistration, CollectorConfig, IndividualTaskRegistration,
    MetricsUpdate, ProcessMetadata, ProcessMetrics, ProcessMetricsSnapshot, ProcessTreeMetrics,
    SystemInfo,
};
use crate::native::utils::time::current_timestamp_millis;
use napi::threadsafe_function::{
    ErrorStrategy::CalleeHandled, ThreadsafeFunction, ThreadsafeFunctionCallMode,
};

type ParentToChildrenMap = std::collections::HashMap<i32, Vec<i32>>;

/// Result from metrics collection containing all data needed for cleanup and notification
struct MetricsCollectionResult {
    /// The collected metrics snapshot
    metrics_snapshot: ProcessMetricsSnapshot,
    /// New metadata discovered during collection
    new_metadata: HashMap<i32, ProcessMetadata>,
}

/// Metadata store for process metadata
/// Stores latest metadata for each known process
pub struct MetadataStore {
    /// Metadata store: latest metadata for each known process
    pub(crate) metadata_store: DashMap<i32, ProcessMetadata>,
}

impl MetadataStore {
    /// Create a new metadata store
    pub fn new() -> Self {
        Self {
            metadata_store: DashMap::new(),
        }
    }

    /// Check if we already have metadata for a PID
    pub fn has_metadata(&self, pid: i32) -> bool {
        self.metadata_store.contains_key(&pid)
    }

    /// Insert metadata for a process
    pub fn insert_metadata(&self, pid: i32, metadata: ProcessMetadata) {
        self.metadata_store.insert(pid, metadata);
    }

    /// Clean up metadata for dead processes
    pub fn cleanup_dead_metadata(&self, live_pids: &HashSet<i32>) {
        self.metadata_store.retain(|pid, _| live_pids.contains(pid));
    }
}

/// Subscriber state for tracking metadata delivery
pub(crate) struct SubscriberState {
    pub callback: ThreadsafeFunction<MetricsUpdate, CalleeHandled>,
    pub needs_full_metadata: bool,
}

/// Handles the collection loop lifecycle in a dedicated thread
/// This struct owns all the shared state needed for metrics collection
struct CollectionRunner {
    // Control flags
    should_collect: Arc<AtomicBool>,
    is_collecting: Arc<AtomicBool>,

    // Process registries
    individual_tasks: Arc<DashMap<String, IndividualTaskRegistration>>,
    batches: Arc<DashMap<String, BatchRegistration>>,
    main_cli_pid: Arc<Mutex<Option<i32>>>,
    main_cli_subprocess_pids: Arc<DashMap<i32, Option<String>>>,
    daemon_pid: Arc<Mutex<Option<i32>>>,

    // Collection infrastructure
    system: Arc<Mutex<System>>,
    config: CollectorConfig,
    subscribers: Arc<Mutex<Vec<SubscriberState>>>,
    metadata_store: Arc<MetadataStore>,
}

impl CollectionRunner {
    fn new(collector: &ProcessMetricsCollector) -> Self {
        Self {
            should_collect: Arc::clone(&collector.should_collect),
            is_collecting: Arc::clone(&collector.is_collecting),
            individual_tasks: Arc::clone(&collector.individual_tasks),
            batches: Arc::clone(&collector.batches),
            main_cli_pid: Arc::clone(&collector.main_cli_pid),
            main_cli_subprocess_pids: Arc::clone(&collector.main_cli_subprocess_pids),
            daemon_pid: Arc::clone(&collector.daemon_pid),
            system: Arc::clone(&collector.system),
            config: collector.config.clone(),
            subscribers: Arc::clone(&collector.subscribers),
            metadata_store: Arc::clone(&collector.metadata_store),
        }
    }

    /// Run the collection loop
    fn run(self) {
        let interval = std::time::Duration::from_millis(self.config.collection_interval_ms);
        // Reuse HashSet across collection cycles to avoid repeated allocations
        let mut live_pids = HashSet::with_capacity(128);

        while self.should_collect.load(Ordering::Acquire) {
            // Collect current metrics
            match self.collect_metrics(&mut live_pids) {
                Ok(result) => {
                    self.notify_subscribers(result, &live_pids);
                }
                Err(e) => {
                    tracing::debug!("Metrics collection error: {}", e);
                }
            }

            // Sleep in small chunks so thread can exit quickly on shutdown
            self.sleep_with_early_exit(interval);
        }

        self.is_collecting.store(false, Ordering::Release);
    }

    /// Notify all subscribers with the collected metrics
    fn notify_subscribers(&self, result: MetricsCollectionResult, live_pids: &HashSet<i32>) {
        let snapshot = result.metrics_snapshot;
        let new_metadata_map = result.new_metadata;

        // Update metadata store with new processes
        for (pid, metadata) in &new_metadata_map {
            self.metadata_store.insert_metadata(*pid, metadata.clone());
        }

        // Clean up dead metadata and task registrations
        self.metadata_store.cleanup_dead_metadata(live_pids);

        // Wrap data in Arc for efficient sharing across subscribers
        let snapshot = Arc::new(snapshot);

        // Build notifications inside lock, then release before calling JS
        let notifications = {
            let mut subscribers = self.subscribers.lock();

            // Pre-compute metadata variants
            let needs_full = subscribers.iter().any(|s| s.needs_full_metadata);

            let full_metadata = if needs_full {
                Some(
                    self.metadata_store
                        .metadata_store
                        .iter()
                        .map(|entry| (entry.key().to_string(), entry.value().clone()))
                        .collect::<std::collections::HashMap<_, _>>(),
                )
            } else {
                None
            };
            let full_metadata = full_metadata.map(Arc::new);

            let new_metadata = if !new_metadata_map.is_empty() {
                Some(Arc::new(
                    new_metadata_map
                        .into_iter()
                        .map(|(pid, meta)| (pid.to_string(), meta))
                        .collect::<HashMap<_, _>>(),
                ))
            } else {
                None
            };

            // Build notification list with Arc clones (cheap - just pointer copies)
            subscribers
                .iter_mut()
                .map(|state| {
                    let metadata = if state.needs_full_metadata {
                        state.needs_full_metadata = false;
                        full_metadata.clone()
                    } else {
                        new_metadata.clone()
                    };

                    let update = MetricsUpdate {
                        metrics: Arc::clone(&snapshot),
                        metadata,
                    };

                    // Clone ThreadsafeFunction (cheap - internally Arc-based)
                    (state.callback.clone(), update)
                })
                .collect::<Vec<_>>()
        }; // Lock released here!

        // Notify subscribers
        for (callback, update) in notifications {
            let status = callback.call(Ok(update), ThreadsafeFunctionCallMode::NonBlocking);
            if !matches!(status, napi::Status::Ok) {
                tracing::debug!("Failed to notify subscriber: {:?}", status);
            }
        }
    }

    /// Sleep in small chunks for responsive shutdown
    /// This allows the thread to respond to shutdown signals within 50ms
    /// instead of waiting for the full collection interval
    fn sleep_with_early_exit(&self, interval: std::time::Duration) {
        let wake_interval = std::time::Duration::from_millis(50);
        let sleep_iterations = (interval.as_millis() / 50).max(1) as usize;

        for _ in 0..sleep_iterations {
            if !self.should_collect.load(Ordering::Acquire) {
                break; // Exit early if shutdown requested
            }
            std::thread::sleep(wake_interval);
        }
    }

    /// Build a map of parent PIDs to their children PIDs
    fn build_parent_child_map(sys: &System) -> ParentToChildrenMap {
        let capacity = sys.processes().len();
        sys.processes()
            .iter()
            .filter_map(|(pid, process)| {
                // sysinfo marks Linux threads via `thread_kind`; skip them so we only track real child processes
                if process.thread_kind().is_some() {
                    return None;
                }
                process
                    .parent()
                    .map(|p| (p.as_u32() as i32, pid.as_u32() as i32))
            })
            .fold(
                std::collections::HashMap::with_capacity(capacity),
                |mut map, (parent, child)| {
                    map.entry(parent).or_insert_with(Vec::new).push(child);
                    map
                },
            )
    }

    /// Collect all PIDs in a process tree starting from a root PID
    fn collect_tree_pids_from_map(children_map: &ParentToChildrenMap, root_pid: i32) -> Vec<i32> {
        let mut all_pids = Vec::new();
        let mut to_process = vec![root_pid];

        while let Some(current_pid) = to_process.pop() {
            all_pids.push(current_pid);

            if let Some(children) = children_map.get(&current_pid) {
                to_process.extend(children);
            }
        }

        all_pids
    }

    /// Collect process metrics and conditionally populate metadata if not cached
    /// Single-pass collection that checks metadata cache to avoid unnecessary string allocations
    /// Returns None if process no longer exists
    fn collect_process_info(
        sys: &System,
        pid: i32,
        metadata_store: &MetadataStore,
        new_metadata: &mut HashMap<i32, ProcessMetadata>,
        alias: Option<String>,
    ) -> Option<ProcessMetrics> {
        let process = sys.process(Pid::from(pid as usize))?;

        // Always collect metrics
        let metrics = ProcessMetrics {
            pid,
            cpu: process.cpu_usage() as f64,
            memory: process.memory() as i64,
        };

        // Conditionally collect metadata only if not cached
        if !metadata_store.has_metadata(pid) {
            let metadata = ProcessMetadata {
                ppid: process.parent().map(|p| p.as_u32() as i32).unwrap_or(0),
                name: process.name().to_string_lossy().into_owned(),
                command: process
                    .cmd()
                    .iter()
                    .map(|s| s.to_string_lossy())
                    .collect::<Vec<_>>()
                    .join(" "),
                exe_path: process
                    .exe()
                    .map(|p| p.to_string_lossy().into_owned())
                    .unwrap_or_default(),
                cwd: process
                    .cwd()
                    .map(|p| p.to_string_lossy().into_owned())
                    .unwrap_or_default(),
                alias,
            };
            new_metadata.insert(pid, metadata);
        }

        Some(metrics)
    }

    /// Collect metrics for the main CLI process and its registered subprocesses
    fn collect_main_cli_metrics(
        &self,
        sys: &System,
        new_metadata: &mut HashMap<i32, ProcessMetadata>,
        live_pids: &mut HashSet<i32>,
    ) -> Option<ProcessTreeMetrics> {
        let pid_opt = *self.main_cli_pid.lock();
        let pid = pid_opt?;

        let main = Self::collect_process_info(sys, pid, &self.metadata_store, new_metadata, None)?;
        live_pids.insert(main.pid);

        let subprocesses: Vec<ProcessMetrics> = self
            .main_cli_subprocess_pids
            .iter()
            .filter_map(|entry| {
                let subprocess_pid = *entry.key();
                let metrics = Self::collect_process_info(
                    sys,
                    subprocess_pid,
                    &self.metadata_store,
                    new_metadata,
                    entry.value().clone(),
                );
                if let Some(ref m) = metrics {
                    live_pids.insert(m.pid);
                }
                metrics
            })
            .collect();

        Some(ProcessTreeMetrics { main, subprocesses })
    }

    /// Collect metrics for the daemon process and its entire process tree
    fn collect_daemon_metrics(
        &self,
        sys: &System,
        children_map: &ParentToChildrenMap,
        new_metadata: &mut HashMap<i32, ProcessMetadata>,
        live_pids: &mut HashSet<i32>,
    ) -> Option<ProcessTreeMetrics> {
        let pid_opt = *self.daemon_pid.lock();
        let pid = pid_opt?;

        let discovered_pids = Self::collect_tree_pids_from_map(children_map, pid);
        let daemon_process_metrics: Vec<ProcessMetrics> = discovered_pids
            .into_iter()
            .filter_map(|p| {
                let metrics =
                    Self::collect_process_info(sys, p, &self.metadata_store, new_metadata, None);
                if let Some(ref m) = metrics {
                    live_pids.insert(m.pid);
                }
                metrics
            })
            .collect();

        if let Some(main) = daemon_process_metrics.first().copied() {
            let subprocesses = daemon_process_metrics.into_iter().skip(1).collect();
            Some(ProcessTreeMetrics { main, subprocesses })
        } else {
            None
        }
    }

    /// Collect metrics for all registered individual tasks
    /// Tasks can have multiple anchor PIDs; collects union of all discovered processes
    fn collect_all_task_metrics(
        &self,
        sys: &System,
        children_map: &ParentToChildrenMap,
        new_metadata: &mut HashMap<i32, ProcessMetadata>,
        live_pids: &mut HashSet<i32>,
    ) -> HashMap<String, Vec<ProcessMetrics>> {
        let mut tasks = HashMap::new();

        for entry in self.individual_tasks.iter() {
            let task_reg = entry.value();

            // Collect from ALL anchor PIDs for this task
            let mut all_pids = HashSet::new();
            for anchor_pid in &task_reg.anchor_pids {
                let tree_pids = Self::collect_tree_pids_from_map(children_map, *anchor_pid);
                all_pids.extend(tree_pids); // HashSet automatically deduplicates
            }

            // Convert PIDs to metrics
            let task_metrics: Vec<ProcessMetrics> = all_pids
                .into_iter()
                .filter_map(|pid| {
                    let metrics = Self::collect_process_info(
                        sys,
                        pid,
                        &self.metadata_store,
                        new_metadata,
                        None,
                    );
                    if let Some(ref m) = metrics {
                        live_pids.insert(m.pid);
                    }
                    metrics
                })
                .collect();

            tasks.insert(task_reg.task_id.clone(), task_metrics);
        }

        tasks
    }

    /// Collect metrics for all registered batches
    /// Batches have a single anchor PID shared by multiple tasks
    fn collect_all_batch_metrics(
        &self,
        sys: &System,
        children_map: &ParentToChildrenMap,
        new_metadata: &mut HashMap<i32, ProcessMetadata>,
        live_pids: &mut HashSet<i32>,
    ) -> HashMap<String, BatchMetricsSnapshot> {
        let mut batches_metrics = HashMap::new();

        for entry in self.batches.iter() {
            let batch_reg = entry.value();

            let discovered_pids =
                Self::collect_tree_pids_from_map(children_map, batch_reg.anchor_pid);
            let batch_processes: Vec<ProcessMetrics> = discovered_pids
                .into_iter()
                .filter_map(|pid| {
                    let metrics = Self::collect_process_info(
                        sys,
                        pid,
                        &self.metadata_store,
                        new_metadata,
                        None,
                    );
                    if let Some(ref m) = metrics {
                        live_pids.insert(m.pid);
                    }
                    metrics
                })
                .collect();

            batches_metrics.insert(
                batch_reg.batch_id.clone(),
                BatchMetricsSnapshot {
                    batch_id: batch_reg.batch_id.clone(),
                    task_ids: Arc::clone(&batch_reg.task_ids),
                    processes: batch_processes,
                },
            );
        }

        batches_metrics
    }

    /// Discover all current processes and collect their metrics
    fn collect_metrics(
        &self,
        live_pids: &mut HashSet<i32>,
    ) -> Result<MetricsCollectionResult, Box<dyn std::error::Error>> {
        // Capture timestamp FIRST for accuracy
        let timestamp = current_timestamp_millis();

        // Refresh all processes
        let mut sys = self.system.lock();
        sys.refresh_processes_specifics(
            sysinfo::ProcessesToUpdate::All,
            true, // remove_dead_processes
            ProcessRefreshKind::nothing()
                .with_memory()
                .with_cpu()
                .with_exe(UpdateKind::OnlyIfNotSet)
                .with_cmd(UpdateKind::OnlyIfNotSet)
                .with_cwd(UpdateKind::OnlyIfNotSet),
        );

        let children_map = Self::build_parent_child_map(&sys);

        // Remove dead processes to prevent stale metrics from terminated processes
        self.individual_tasks.retain(|_, task_reg| {
            task_reg
                .anchor_pids
                .iter()
                .any(|pid| sys.process(Pid::from(*pid as usize)).is_some())
        });
        self.batches.retain(|_, batch_reg| {
            sys.process(Pid::from(batch_reg.anchor_pid as usize))
                .is_some()
        });
        self.main_cli_subprocess_pids
            .retain(|pid, _| sys.process(Pid::from(*pid as usize)).is_some());
        if let Some(pid) = *self.daemon_pid.lock() {
            if sys.process(Pid::from(pid as usize)).is_none() {
                *self.daemon_pid.lock() = None;
            }
        }

        // Clear live PIDs from previous collection cycle (keeps allocated capacity)
        live_pids.clear();

        // Track new metadata discovered during collection (conditionally populated)
        let mut new_metadata = HashMap::new();

        // Collect metrics for all the processes
        let main_cli_metrics = self.collect_main_cli_metrics(&sys, &mut new_metadata, live_pids);
        let daemon_metrics =
            self.collect_daemon_metrics(&sys, &children_map, &mut new_metadata, live_pids);
        let tasks_metrics =
            self.collect_all_task_metrics(&sys, &children_map, &mut new_metadata, live_pids);
        let batches_metrics =
            self.collect_all_batch_metrics(&sys, &children_map, &mut new_metadata, live_pids);

        let metrics_snapshot = ProcessMetricsSnapshot {
            timestamp,
            main_cli: main_cli_metrics,
            daemon: daemon_metrics,
            tasks: tasks_metrics,
            batches: batches_metrics,
        };

        Ok(MetricsCollectionResult {
            metrics_snapshot,
            new_metadata,
        })
    }
}

/// High-performance metrics collector for Nx tasks
/// Thread-safe and designed for minimal overhead
#[napi]
pub struct ProcessMetricsCollector {
    /// Configuration for the collector
    config: CollectorConfig,
    /// Individual tasks with one or more anchor processes
    individual_tasks: Arc<DashMap<String, IndividualTaskRegistration>>,
    /// Batch executions with multiple tasks sharing a worker
    batches: Arc<DashMap<String, BatchRegistration>>,
    /// Main CLI process PID (set once at initialization, uses Mutex for &self methods)
    main_cli_pid: Arc<Mutex<Option<i32>>>,
    /// Main CLI subprocess PIDs and aliases (e.g., plugin workers when daemon is not used)
    main_cli_subprocess_pids: Arc<DashMap<i32, Option<String>>>,
    /// Daemon process PID (can be updated when daemon connects)
    daemon_pid: Arc<Mutex<Option<i32>>>,
    /// Cached CPU core count (set once at initialization)
    cpu_cores: u32,
    /// Cached total memory in bytes (set once at initialization)
    total_memory: i64,
    /// System info instance (shared for process querying)
    system: Arc<Mutex<System>>,
    /// Subscribers for metrics events (thread-safe)
    subscribers: Arc<Mutex<Vec<SubscriberState>>>,
    /// Metadata store for process metadata
    pub(crate) metadata_store: Arc<MetadataStore>,
    /// Collection thread state
    collection_thread: Mutex<Option<JoinHandle<()>>>,
    /// Atomic flag to control collection thread
    should_collect: Arc<AtomicBool>,
    /// Atomic flag to indicate if collection is running
    is_collecting: Arc<AtomicBool>,
}

#[napi]
impl ProcessMetricsCollector {
    /// Create a new ProcessMetricsCollector with default configuration
    #[napi(constructor)]
    pub fn new() -> Self {
        Self::with_config(CollectorConfig::default())
    }

    /// Create a new ProcessMetricsCollector with custom configuration
    fn with_config(config: CollectorConfig) -> Self {
        let sys = System::new_all();
        let cpu_cores = sys.cpus().len() as u32;
        let total_memory = sys.total_memory() as i64;

        Self {
            config,
            individual_tasks: Arc::new(DashMap::new()),
            batches: Arc::new(DashMap::new()),
            main_cli_pid: Arc::new(Mutex::new(None)),
            main_cli_subprocess_pids: Arc::new(DashMap::new()),
            daemon_pid: Arc::new(Mutex::new(None)),
            cpu_cores,
            total_memory,
            system: Arc::new(Mutex::new(sys)),
            subscribers: Arc::new(Mutex::new(Vec::new())),
            metadata_store: Arc::new(MetadataStore::new()),
            collection_thread: Mutex::new(None),
            should_collect: Arc::new(AtomicBool::new(false)),
            is_collecting: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Start metrics collection
    /// Idempotent - safe to call multiple times
    #[napi]
    pub fn start_collection(&self) -> anyhow::Result<()> {
        // Atomically check if collection is not running and start it
        // If already running, this is a no-op (idempotent behavior)
        if self
            .is_collecting
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            // Already started - this is fine, just return success (idempotent)
            return Ok(());
        }

        self.should_collect.store(true, Ordering::Release);

        // Create the collection runner
        let runner = CollectionRunner::new(self);

        // Spawn the collection thread
        let collection_thread = std::thread::Builder::new()
            .name("nx-metrics-collector".to_string())
            .spawn(move || runner.run())
            .map_err(|e| {
                // Failed to spawn thread - reset flag so future attempts can try again
                self.is_collecting.store(false, Ordering::Release);
                self.should_collect.store(false, Ordering::Release);
                error!("Failed to start metrics collection: {}", e);
                anyhow::anyhow!("Failed to start collection: {}", e)
            })?;

        *self.collection_thread.lock() = Some(collection_thread);

        Ok(())
    }

    /// Stop metrics collection
    /// Returns true if collection was stopped, false if not running
    #[napi]
    pub fn stop_collection(&self) -> anyhow::Result<bool> {
        if !self.is_collecting.load(Ordering::Acquire) {
            return Ok(false);
        }

        // Signal the collection thread to stop
        self.should_collect.store(false, Ordering::Release);

        // Wait for the collection thread to finish
        if let Some(thread) = self.collection_thread.lock().take() {
            if let Err(e) = thread.join() {
                error!("Collection thread panicked: {:?}", e);
            }
        }

        self.is_collecting.store(false, Ordering::Release);
        Ok(true)
    }

    /// Check if collection is currently running
    pub fn is_collecting(&self) -> bool {
        self.is_collecting.load(Ordering::Acquire)
    }

    /// Get system information (CPU cores and total memory)
    /// This is separate from the collection interval and meant to be called imperatively
    #[napi]
    pub fn get_system_info(&self) -> SystemInfo {
        SystemInfo {
            cpu_cores: self.cpu_cores,
            total_memory: self.total_memory,
        }
    }

    /// Register the main CLI process for metrics collection
    #[napi]
    pub fn register_main_cli_process(&self, pid: i32) {
        let mut cli_pid = self.main_cli_pid.lock();
        *cli_pid = Some(pid);
    }

    /// Register a subprocess of the main CLI for metrics collection
    #[napi]
    pub fn register_main_cli_subprocess(&self, pid: i32, alias: Option<String>) {
        self.main_cli_subprocess_pids.insert(pid, alias);

        // Establish baseline immediately for this subprocess
        // This ensures accurate CPU data from the first collection cycle after spawn
        let mut sys = self.system.lock();
        let target_pid = Pid::from(pid as usize);
        sys.refresh_processes_specifics(
            sysinfo::ProcessesToUpdate::Some(&[target_pid]),
            false, // don't remove dead processes
            ProcessRefreshKind::nothing().with_cpu(),
        );
    }

    /// Register the daemon process for metrics collection
    #[napi]
    pub fn register_daemon_process(&self, pid: i32) {
        let mut daemon_pid = self.daemon_pid.lock();
        *daemon_pid = Some(pid);
    }

    /// Register a process for a specific task
    /// Automatically creates the task if it doesn't exist
    #[napi]
    pub fn register_task_process(&self, task_id: String, pid: i32) {
        self.individual_tasks
            .entry(task_id.clone())
            .or_insert_with(|| IndividualTaskRegistration::new(task_id))
            .anchor_pids
            .insert(pid);

        // Establish baseline immediately for this task process
        // This ensures accurate CPU data from the first collection cycle after spawn
        let mut sys = self.system.lock();
        let target_pid = Pid::from(pid as usize);
        sys.refresh_processes_specifics(
            sysinfo::ProcessesToUpdate::Some(&[target_pid]),
            false, // don't remove dead processes
            ProcessRefreshKind::nothing().with_cpu(),
        );
    }

    /// Register a batch with multiple tasks sharing a worker
    #[napi]
    pub fn register_batch(&self, batch_id: String, task_ids: Vec<String>, pid: i32) {
        self.batches.insert(
            batch_id.clone(),
            BatchRegistration::new(batch_id, task_ids, pid),
        );

        // Establish baseline immediately for the batch worker
        let mut sys = self.system.lock();
        let target_pid = Pid::from(pid as usize);
        sys.refresh_processes_specifics(
            sysinfo::ProcessesToUpdate::Some(&[target_pid]),
            false, // don't remove dead processes
            ProcessRefreshKind::nothing().with_cpu(),
        );
    }

    /// Subscribe to push-based metrics notifications from TypeScript
    #[napi(ts_args_type = "callback: (err: Error | null, event: MetricsUpdate) => void")]
    pub fn subscribe(&self, env: Env, callback: JsFunction) -> anyhow::Result<()> {
        // Create threadsafe function for updates
        let mut tsfn: ThreadsafeFunction<MetricsUpdate, CalleeHandled> =
            callback.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;
        tsfn.unref(&env)?;

        // Store callback for future updates
        // The subscriber will receive full metadata on first update via needs_full_metadata flag
        let mut subscribers = self.subscribers.lock();
        subscribers.push(SubscriberState {
            callback: tsfn,
            needs_full_metadata: true,
        });

        Ok(())
    }
}

impl Drop for ProcessMetricsCollector {
    fn drop(&mut self) {
        // Ensure collection is stopped when dropping (RAII pattern)
        if self.is_collecting.load(Ordering::Acquire) {
            if let Err(e) = self.stop_collection() {
                error!(
                    "Failed to stop collection during ProcessMetricsCollector drop: {}",
                    e
                );
            }
        }
    }
}
