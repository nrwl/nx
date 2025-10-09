use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::JoinHandle;

use anyhow::Result;
use dashmap::DashMap;
use parking_lot::Mutex;
use sysinfo::{Pid, ProcessRefreshKind, System, UpdateKind};

use crate::native::metrics::types::{
    BatchMetricsSnapshot, BatchRegistration, CollectorConfig, DaemonMetrics,
    IndividualTaskRegistration, MetricsError, MetricsUpdate, ProcessMetadata, ProcessMetrics,
    ProcessMetricsSnapshot, SystemInfo,
};
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
    /// All PIDs that we collected metrics for
    live_pids: HashSet<i32>,
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

/// High-performance metrics collector for Nx tasks
/// Thread-safe and designed for minimal overhead
pub struct MetricsCollector {
    /// Configuration for the collector
    config: CollectorConfig,
    /// Individual tasks with one or more anchor processes
    /// Using DashMap for concurrent access
    individual_tasks: Arc<DashMap<String, IndividualTaskRegistration>>,
    /// Batch executions with multiple tasks sharing a worker
    /// Using DashMap for concurrent access
    batches: Arc<DashMap<String, BatchRegistration>>,
    /// Main CLI process PID (set once at initialization, uses Mutex for &self methods)
    main_cli_pid: Arc<Mutex<Option<i32>>>,
    /// Daemon process PID (can be updated when daemon connects)
    daemon_pid: Arc<Mutex<Option<i32>>>,
    /// System info instance (shared for process querying)
    system: Arc<Mutex<System>>,
    /// Subscribers for metrics events (thread-safe)
    subscribers: Arc<Mutex<Vec<SubscriberState>>>,
    /// Metadata store for process metadata
    pub(crate) metadata_store: Arc<MetadataStore>,
    /// Collection thread state
    collection_thread: Option<JoinHandle<()>>,
    /// Atomic flag to control collection thread
    should_collect: Arc<AtomicBool>,
    /// Atomic flag to indicate if collection is running
    is_collecting: Arc<AtomicBool>,
}

impl MetricsCollector {
    /// Create a new MetricsCollector with default configuration
    pub fn new() -> Self {
        Self::with_config(CollectorConfig::default())
    }

    /// Create a new MetricsCollector with custom configuration
    pub fn with_config(config: CollectorConfig) -> Self {
        Self {
            config,
            individual_tasks: Arc::new(DashMap::new()),
            batches: Arc::new(DashMap::new()),
            main_cli_pid: Arc::new(Mutex::new(None)),
            daemon_pid: Arc::new(Mutex::new(None)),
            system: Arc::new(Mutex::new(System::new_all())),
            subscribers: Arc::new(Mutex::new(Vec::new())),
            metadata_store: Arc::new(MetadataStore::new()),
            collection_thread: None,
            should_collect: Arc::new(AtomicBool::new(false)),
            is_collecting: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Start metrics collection
    /// Idempotent - safe to call multiple times, subsequent calls are no-ops
    pub fn start_collection(&mut self) -> Result<(), MetricsError> {
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

        // Clone necessary Arc references for the thread
        let should_collect = Arc::clone(&self.should_collect);
        let is_collecting = Arc::clone(&self.is_collecting);
        let individual_tasks = Arc::clone(&self.individual_tasks);
        let batches = Arc::clone(&self.batches);
        let main_cli_pid = Arc::clone(&self.main_cli_pid);
        let daemon_pid = Arc::clone(&self.daemon_pid);
        let system = Arc::clone(&self.system);
        let config = self.config.clone();
        let subscribers = Arc::clone(&self.subscribers);
        let metadata_store = Arc::clone(&self.metadata_store);

        // Spawn the collection thread
        let collection_thread = std::thread::Builder::new()
            .name("nx-metrics-collector".to_string())
            .spawn(move || {
                Self::collection_loop(
                    should_collect,
                    is_collecting,
                    individual_tasks,
                    batches,
                    main_cli_pid,
                    daemon_pid,
                    system,
                    config,
                    subscribers,
                    metadata_store,
                );
            })
            .map_err(|e| {
                // Failed to spawn thread - reset flag so future attempts can try again
                self.is_collecting.store(false, Ordering::Release);
                self.should_collect.store(false, Ordering::Release);
                MetricsError::SystemError(format!("Failed to start collection thread: {}", e))
            })?;

        self.collection_thread = Some(collection_thread);

        Ok(())
    }

    /// Stop metrics collection
    pub fn stop_collection(&mut self) -> Result<(), MetricsError> {
        if !self.is_collecting.load(Ordering::Acquire) {
            return Err(MetricsError::CollectionNotStarted);
        }

        // Signal the collection thread to stop
        self.should_collect.store(false, Ordering::Release);

        // Wait for the collection thread to finish
        if let Some(thread) = self.collection_thread.take() {
            if let Err(e) = thread.join() {
                tracing::error!("Collection thread panicked: {:?}", e);
            }
        }

        self.is_collecting.store(false, Ordering::Release);
        Ok(())
    }

    /// Check if collection is currently running
    pub fn is_collecting(&self) -> bool {
        self.is_collecting.load(Ordering::Acquire)
    }

    /// Get system information (CPU cores and total memory)
    pub fn get_system_info(&self) -> SystemInfo {
        let sys = self.system.lock();
        SystemInfo {
            cpu_cores: sys.cpus().len() as u32,
            total_memory: sys.total_memory() as i64,
        }
    }

    /// Register the main CLI process
    /// Idempotent - safe to call multiple times with same PID
    /// No validation at registration time - validation happens during collection
    pub fn register_main_cli_process(&self, pid: i32) {
        let mut cli_pid = self.main_cli_pid.lock();
        *cli_pid = Some(pid);
    }

    /// Register the daemon process
    /// Idempotent - safe to call multiple times, overwrites with new PID
    /// No validation at registration time - validation happens during collection
    pub fn register_daemon_process(&self, pid: i32) {
        let mut daemon_pid = self.daemon_pid.lock();
        *daemon_pid = Some(pid);
    }

    /// Register a process for an individual task (called when process spawns)
    /// Can be called multiple times with same task_id to add more processes
    /// No validation at registration time - validation happens during collection
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

    /// The main collection loop that runs in a separate thread
    /// Discovers current metrics and directly notifies subscribers (true push-based)
    fn collection_loop(
        should_collect: Arc<AtomicBool>,
        is_collecting: Arc<AtomicBool>,
        individual_tasks: Arc<DashMap<String, IndividualTaskRegistration>>,
        batches: Arc<DashMap<String, BatchRegistration>>,
        main_cli_pid: Arc<Mutex<Option<i32>>>,
        daemon_pid: Arc<Mutex<Option<i32>>>,
        system: Arc<Mutex<System>>,
        config: CollectorConfig,
        subscribers: Arc<Mutex<Vec<SubscriberState>>>,
        metadata_store: Arc<MetadataStore>,
    ) {
        let interval = std::time::Duration::from_millis(config.collection_interval_ms);

        while should_collect.load(Ordering::Acquire) {
            // Collect current metrics
            match Self::discover_and_collect_current_metrics(
                &system,
                &individual_tasks,
                &batches,
                &main_cli_pid,
                &daemon_pid,
                &metadata_store,
            ) {
                Ok(result) => {
                    let snapshot = result.metrics_snapshot;
                    let new_metadata_map = result.new_metadata;

                    // Update metadata store with new processes
                    for (pid, metadata) in &new_metadata_map {
                        metadata_store.insert_metadata(*pid, metadata.clone());
                    }

                    // Clean up dead metadata and task registrations
                    metadata_store.cleanup_dead_metadata(&result.live_pids);

                    // Wrap data in Arc for efficient sharing across subscribers
                    let snapshot = Arc::new(snapshot);

                    // Build notifications inside lock, then release before calling JS
                    let notifications = {
                        let mut subscribers = subscribers.lock();

                        // Pre-compute metadata variants
                        let needs_full = subscribers.iter().any(|s| s.needs_full_metadata);

                        let full_metadata = if needs_full {
                            Some(
                                metadata_store
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

                    // Notify subscribers WITHOUT holding lock (fixes RUST-8)
                    for (callback, update) in notifications {
                        let status =
                            callback.call(Ok(update), ThreadsafeFunctionCallMode::NonBlocking);
                        if !matches!(status, napi::Status::Ok) {
                            tracing::debug!("Failed to notify subscriber: {:?}", status);
                        }
                    }
                }
                Err(e) => {
                    tracing::debug!("Metrics collection error: {}", e);
                }
            }

            // Sleep in small chunks so thread can exit quickly on shutdown
            // This allows the thread to respond to shutdown signals within 50ms
            // instead of waiting for the full collection interval (500ms default)
            let wake_interval = std::time::Duration::from_millis(50);
            let sleep_iterations = (interval.as_millis() / 50).max(1) as usize;

            for _ in 0..sleep_iterations {
                if !should_collect.load(Ordering::Acquire) {
                    break; // Exit early if shutdown requested
                }
                std::thread::sleep(wake_interval);
            }
        }

        is_collecting.store(false, Ordering::Release);
    }

    fn build_parent_child_map(sys: &System) -> ParentToChildrenMap {
        let capacity = sys.processes().len();
        sys.processes()
            .iter()
            .filter_map(|(pid, process)| {
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
    ) -> Option<ProcessMetrics> {
        let process = sys.process(Pid::from(pid as usize))?;

        // Always collect metrics (cheap - 3 numbers)
        let metrics = ProcessMetrics {
            pid,
            cpu: process.cpu_usage() as f64,
            memory: process.memory() as i64,
        };

        // Conditionally collect metadata only if not cached (expensive - 4 strings)
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
            };
            new_metadata.insert(pid, metadata);
        }

        Some(metrics)
    }

    /// Discover all current processes and collect their metrics
    /// Single system refresh for accurate timestamp and optimal performance
    /// Returns ephemeral data structure for immediate emission
    fn discover_and_collect_current_metrics(
        system: &Mutex<System>,
        individual_tasks: &DashMap<String, IndividualTaskRegistration>,
        batches: &DashMap<String, BatchRegistration>,
        main_cli_pid: &Mutex<Option<i32>>,
        daemon_pid: &Mutex<Option<i32>>,
        metadata_store: &MetadataStore,
    ) -> Result<MetricsCollectionResult, Box<dyn std::error::Error>> {
        // Capture timestamp FIRST for accuracy
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_else(|e| {
                tracing::warn!("System time before UNIX epoch: {}", e);
                std::time::Duration::ZERO
            })
            .as_millis() as i64;

        // Single system refresh for ALL processes (one scan, all data)
        // Remove dead processes to prevent stale metrics from terminated processes
        let mut sys = system.lock();
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

        // Clean up dead individual tasks - retain only tasks with at least one live anchor
        individual_tasks.retain(|_, task_reg| {
            task_reg
                .anchor_pids
                .iter()
                .any(|pid| sys.process(Pid::from(*pid as usize)).is_some())
        });

        // Clean up dead batches - retain only batches with live anchor
        batches.retain(|_, batch_reg| {
            sys.process(Pid::from(batch_reg.anchor_pid as usize))
                .is_some()
        });

        // Pre-allocate HashSet for tracking all live PIDs to reduce allocations
        let mut live_pids = HashSet::with_capacity(
            1 + // main_cli
            10 + // daemon + estimated subprocesses
            individual_tasks.len() * 5 + // individual tasks × avg processes per task
            batches.len() * 5, // batch tasks × avg processes per batch
        );

        // Track new metadata discovered during collection (conditionally populated)
        let mut new_metadata = HashMap::new();

        // Collect main CLI process
        let main_cli_metrics = {
            let cli_pid = main_cli_pid.lock();
            if let Some(pid) = *cli_pid {
                let metrics =
                    Self::collect_process_info(&sys, pid, metadata_store, &mut new_metadata);
                if let Some(ref m) = metrics {
                    live_pids.insert(m.pid);
                }
                metrics
            } else {
                None
            }
        };

        let daemon_metrics = {
            let daemon_pid_lock = daemon_pid.lock();
            if let Some(pid) = *daemon_pid_lock {
                let discovered_pids = Self::collect_tree_pids_from_map(&children_map, pid);
                let daemon_process_metrics: Vec<ProcessMetrics> = discovered_pids
                    .into_iter()
                    .filter_map(|p| {
                        let metrics =
                            Self::collect_process_info(&sys, p, metadata_store, &mut new_metadata);
                        if let Some(ref m) = metrics {
                            live_pids.insert(m.pid);
                        }
                        metrics
                    })
                    .collect();

                // Build DaemonMetrics from collected processes
                if let Some(main) = daemon_process_metrics.first().copied() {
                    let subprocesses = daemon_process_metrics.into_iter().skip(1).collect();
                    Some(DaemonMetrics { main, subprocesses })
                } else {
                    None
                }
            } else {
                None
            }
        };

        // Discover and collect individual task processes
        // Individual tasks can have multiple anchor PIDs
        let mut tasks = HashMap::new();
        for entry in individual_tasks.iter() {
            let task_reg = entry.value();

            // Collect from ALL anchor PIDs for this task
            let mut all_pids = HashSet::new();
            for anchor_pid in &task_reg.anchor_pids {
                let tree_pids = Self::collect_tree_pids_from_map(&children_map, *anchor_pid);
                all_pids.extend(tree_pids); // HashSet automatically deduplicates
            }

            // Convert PIDs to metrics
            let task_metrics: Vec<ProcessMetrics> = all_pids
                .into_iter()
                .filter_map(|pid| {
                    let metrics =
                        Self::collect_process_info(&sys, pid, metadata_store, &mut new_metadata);
                    if let Some(ref m) = metrics {
                        live_pids.insert(m.pid);
                    }
                    metrics
                })
                .collect();

            tasks.insert(task_reg.task_id.clone(), task_metrics);
        }

        // Discover and collect batch processes
        // Batches have single anchor PID shared by multiple tasks
        let mut batches_metrics = HashMap::new();
        for entry in batches.iter() {
            let batch_reg = entry.value();

            let discovered_pids =
                Self::collect_tree_pids_from_map(&children_map, batch_reg.anchor_pid);
            let batch_processes: Vec<ProcessMetrics> = discovered_pids
                .into_iter()
                .filter_map(|pid| {
                    let metrics =
                        Self::collect_process_info(&sys, pid, metadata_store, &mut new_metadata);
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

        let metrics_snapshot = ProcessMetricsSnapshot {
            timestamp,
            main_cli: main_cli_metrics,
            daemon: daemon_metrics,
            tasks,
            batches: batches_metrics,
        };

        Ok(MetricsCollectionResult {
            metrics_snapshot,
            new_metadata,
            live_pids,
        })
    }

    /// Subscribe to metrics updates
    pub fn subscribe(&mut self, callback: ThreadsafeFunction<MetricsUpdate, CalleeHandled>) {
        let mut subscribers = self.subscribers.lock();
        subscribers.push(SubscriberState {
            callback,
            needs_full_metadata: true,
        });
    }
}

impl Drop for MetricsCollector {
    fn drop(&mut self) {
        // Ensure collection is stopped when dropping (RAII pattern)
        if self.is_collecting.load(Ordering::Acquire) {
            let _ = self.stop_collection();
        }
    }
}
