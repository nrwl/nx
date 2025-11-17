use anyhow::Result;
#[cfg(test)]
use crossbeam_channel::Receiver;
use crossbeam_channel::{Sender, unbounded};
use dashmap::DashMap;
use napi::{Env, JsFunction};
use napi_derive::napi;
use parking_lot::Mutex;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread::JoinHandle;
use std::time::Duration;
use sysinfo::{Pid, ProcessRefreshKind, System, UpdateKind};
use tracing::{error, trace};

use crate::native::metrics::types::{
    BatchRegistration, CollectorConfig, GroupInfo, GroupType, IndividualTaskRegistration, Metadata,
    MetricsUpdate, ProcessMetadata, ProcessMetrics, SystemInfo,
};
use crate::native::utils::time::current_timestamp_millis;
use napi::threadsafe_function::{
    ErrorStrategy::CalleeHandled, ThreadsafeFunction, ThreadsafeFunctionCallMode,
};

type ParentToChildrenMap = HashMap<i32, Vec<i32>>;

// Group ID constants
const MAIN_CLI_GROUP_ID: &str = "main_cli";
const MAIN_CLI_SUBPROCESSES_GROUP_ID: &str = "main_cli_subprocesses";
const DAEMON_GROUP_ID: &str = "daemon";

/// Result from metrics collection containing all data needed for cleanup and notification
struct MetricsCollectionResult {
    /// Timestamp for the collection
    timestamp: i64,
    /// Combined metadata for groups and processes
    metadata: Metadata,
    /// Process metrics
    processes: Vec<ProcessMetrics>,
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
    process_metadata_map: Arc<DashMap<String, ProcessMetadata>>,
    /// Track which group IDs have been sent (for incremental updates)
    group_metadata_map: Arc<DashMap<String, GroupInfo>>,
    /// Channel to send collected metrics to the main collector thread
    metrics_tx: Sender<MetricsCollectionResult>,
}

impl CollectionRunner {
    fn new(
        collector: &ProcessMetricsCollector,
        metrics_tx: Sender<MetricsCollectionResult>,
    ) -> Self {
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
            process_metadata_map: Arc::clone(&collector.process_metadata_map),
            group_metadata_map: Arc::clone(&collector.group_metadata_map),
            metrics_tx,
        }
    }

    /// Run the collection loop
    fn run(self) {
        let interval = Duration::from_millis(self.config.collection_interval_ms);

        while self.should_collect.load(Ordering::Acquire) {
            // Collect current metrics and send to main collector thread
            self.collect_metrics()
                .inspect_err(|e| tracing::debug!("Metrics collection error: {}", e))
                .map(|result| self.send_metrics(result))
                .ok();

            // Sleep in small chunks so thread can exit quickly on shutdown
            self.sleep_with_early_exit(interval);
        }

        self.is_collecting.store(false, Ordering::Release);
    }

    /// Send collected metrics to the main collector thread via channel
    fn send_metrics(&self, result: MetricsCollectionResult) {
        if let Err(e) = self.metrics_tx.send(result) {
            error!(
                "Failed to send metrics to collector (listener disconnected): {}",
                e
            );
            // Stop collection since listener is dead/gone
            // This prevents infinite error logging
            self.should_collect.store(false, Ordering::Release);
        }
    }

    /// Sleep in small chunks for responsive shutdown
    /// This allows the thread to respond to shutdown signals within 50ms
    /// instead of waiting for the full collection interval
    fn sleep_with_early_exit(&self, interval: Duration) {
        let wake_interval = Duration::from_millis(50);
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

    /// Collect process metrics and metadata if not cached
    /// Single-pass collection that checks metadata cache to avoid unnecessary string allocations
    /// Returns (metrics, Some(metadata)) if process is new, (metrics, None) if cached
    /// Returns None if process no longer exists
    fn collect_process_info(
        &self,
        sys: &System,
        pid: i32,
        alias: Option<String>,
        group_id: &str,
        is_root: bool,
    ) -> Option<(ProcessMetrics, Option<ProcessMetadata>)> {
        let process = sys.process(Pid::from(pid as usize))?;

        // Always collect metrics
        let metrics = ProcessMetrics {
            pid,
            cpu: process.cpu_usage() as f64,
            memory: process.memory() as i64,
        };

        // Conditionally collect metadata only if not cached
        let metadata = if !self.process_metadata_map.contains_key(&pid.to_string()) {
            Some(ProcessMetadata {
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
                group_id: group_id.to_string(),
                is_root,
            })
        } else {
            None
        };

        Some((metrics, metadata))
    }

    /// Collect metrics for the main CLI process only
    fn collect_main_cli_metrics(
        &self,
        sys: &System,
    ) -> (Vec<ProcessMetrics>, HashMap<i32, ProcessMetadata>) {
        let mut new_metadata = HashMap::new();
        let mut processes = Vec::new();

        // Read the PID while we have the system lock (caller holds it)
        // This avoids acquiring main_cli_pid lock while holding system lock
        let main_cli_pid = {
            trace!("Reading main_cli_pid in collect_main_cli_metrics");
            *self.main_cli_pid.lock()
        };

        if let Some(pid) = main_cli_pid
            && let Some((main, metadata)) =
                self.collect_process_info(sys, pid, None, MAIN_CLI_GROUP_ID, true)
        {
            processes.push(main);
            if let Some(meta) = metadata {
                new_metadata.insert(pid, meta);
            }
        }

        (processes, new_metadata)
    }

    /// Check if the main CLI process is registered
    fn is_main_cli_registered(&self) -> bool {
        trace!("Reading main_cli_pid in collect_main_cli_subprocess_metrics");
        self.main_cli_pid.lock().is_some()
    }

    /// Collect metrics for main CLI subprocesses and their process trees
    fn collect_main_cli_subprocess_metrics(
        &self,
        sys: &System,
        children_map: &ParentToChildrenMap,
    ) -> (Vec<ProcessMetrics>, HashMap<i32, ProcessMetadata>) {
        let mut new_metadata = HashMap::new();
        let mut processes = Vec::new();

        // Only collect subprocesses if the main CLI is registered and subprocesses exist
        let main_cli_registered = self.is_main_cli_registered();

        if main_cli_registered && !self.main_cli_subprocess_pids.is_empty() {
            for entry in self.main_cli_subprocess_pids.iter() {
                let subprocess_pid = *entry.key();
                let alias = entry.value().clone();

                // Collect the subprocess and its entire process tree
                let discovered_pids =
                    Self::collect_tree_pids_from_map(children_map, subprocess_pid);

                for pid in discovered_pids.into_iter() {
                    if let Some((metrics, metadata)) = self.collect_process_info(
                        sys,
                        pid,
                        if pid == subprocess_pid {
                            alias.clone()
                        } else {
                            None
                        },
                        MAIN_CLI_SUBPROCESSES_GROUP_ID,
                        pid == subprocess_pid, // First process is root
                    ) {
                        if let Some(meta) = metadata {
                            new_metadata.insert(pid, meta);
                        }
                        processes.push(metrics);
                    }
                }
            }
        }

        (processes, new_metadata)
    }

    /// Collect metrics for the daemon process and its entire process tree
    fn collect_daemon_metrics(
        &self,
        sys: &System,
        children_map: &ParentToChildrenMap,
    ) -> (Vec<ProcessMetrics>, HashMap<i32, ProcessMetadata>) {
        let mut new_metadata = HashMap::new();
        let mut processes = Vec::new();

        // Read daemon PID early to avoid holding system lock while acquiring daemon_pid lock
        let daemon_pid = {
            trace!("Reading daemon_pid in collect_daemon_metrics");
            *self.daemon_pid.lock()
        };

        if let Some(pid) = daemon_pid {
            let discovered_pids = Self::collect_tree_pids_from_map(children_map, pid);
            let daemon_process_metrics: Vec<ProcessMetrics> = discovered_pids
                .into_iter()
                .enumerate()
                .filter_map(|(idx, p)| {
                    if let Some((metrics, metadata)) = self.collect_process_info(
                        sys,
                        p,
                        None,
                        DAEMON_GROUP_ID,
                        idx == 0, // First process is root
                    ) {
                        if let Some(meta) = metadata {
                            new_metadata.insert(p, meta);
                        }
                        Some(metrics)
                    } else {
                        None
                    }
                })
                .collect();

            processes.extend(daemon_process_metrics);
        }

        (processes, new_metadata)
    }

    /// Collect metrics for all registered individual tasks
    /// Tasks can have multiple anchor PIDs; collects union of all discovered processes
    fn collect_all_task_metrics(
        &self,
        sys: &System,
        children_map: &ParentToChildrenMap,
    ) -> (Vec<ProcessMetrics>, HashMap<i32, ProcessMetadata>) {
        let mut tasks = Vec::new();
        let mut new_metadata = HashMap::new();

        for entry in self.individual_tasks.iter() {
            let task_reg = entry.value();
            let group_id = &task_reg.task_id;

            // Collect from ALL anchor PIDs for this task
            let mut all_pids = HashSet::new();
            for anchor_pid in &task_reg.anchor_pids {
                let tree_pids = Self::collect_tree_pids_from_map(children_map, *anchor_pid);
                all_pids.extend(tree_pids); // HashSet automatically deduplicates
            }

            // Convert PIDs to metrics
            // The first anchor PID is the root
            let anchor_pids_vec: Vec<i32> = task_reg.anchor_pids.iter().copied().collect();
            for pid in all_pids {
                let is_anchor = anchor_pids_vec.contains(&pid);
                if let Some((metrics, metadata)) =
                    self.collect_process_info(sys, pid, None, group_id, is_anchor)
                {
                    if let Some(meta) = metadata {
                        new_metadata.insert(pid, meta);
                    }
                    tasks.push(metrics);
                }
            }
        }

        (tasks, new_metadata)
    }

    /// Collect metrics for all registered batches
    /// Batches have a single anchor PID shared by multiple tasks
    fn collect_all_batch_metrics(
        &self,
        sys: &System,
        children_map: &ParentToChildrenMap,
    ) -> (Vec<ProcessMetrics>, HashMap<i32, ProcessMetadata>) {
        let mut batches_metrics = Vec::new();
        let mut new_metadata = HashMap::new();

        for entry in self.batches.iter() {
            let batch_reg = entry.value();
            let group_id = &batch_reg.batch_id;

            let discovered_pids =
                Self::collect_tree_pids_from_map(children_map, batch_reg.anchor_pid);
            let batch_anchor_pid = batch_reg.anchor_pid;

            for pid in discovered_pids {
                if let Some((metrics, metadata)) = self.collect_process_info(
                    sys,
                    pid,
                    None,
                    group_id,
                    pid == batch_anchor_pid, // Anchor PID is root
                ) {
                    if let Some(meta) = metadata {
                        new_metadata.insert(pid, meta);
                    }
                    batches_metrics.push(metrics);
                }
            }
        }

        (batches_metrics, new_metadata)
    }

    /// Create only NEW groups based on current registrations
    /// Returns only groups that haven't been sent before
    /// Also cleans up group IDs for tasks/batches that no longer exist
    fn create_new_group_info(&self) -> HashMap<String, GroupInfo> {
        trace!("Building live group IDs");
        // Build set of currently live groups
        let mut live_group_ids = HashSet::new();
        // Acquire locks once to minimize contention
        trace!("Acquiring main_cli_pid and daemon_pid locks");
        let main_cli_pid = self.main_cli_pid.lock();
        let daemon_pid = self.daemon_pid.lock();
        trace!("Locks acquired, checking registered processes");

        if main_cli_pid.is_some() {
            trace!("Main CLI registered");
            live_group_ids.insert(MAIN_CLI_GROUP_ID.to_string());
        }
        // Add main_cli_subprocesses group if subprocesses exist and main CLI is registered
        if main_cli_pid.is_some() && !self.main_cli_subprocess_pids.is_empty() {
            trace!(
                "Main CLI subprocesses registered: count={}",
                self.main_cli_subprocess_pids.len()
            );
            live_group_ids.insert(MAIN_CLI_SUBPROCESSES_GROUP_ID.to_string());
        }
        if daemon_pid.is_some() {
            trace!("Daemon registered");
            live_group_ids.insert(DAEMON_GROUP_ID.to_string());
        }
        drop(main_cli_pid);
        drop(daemon_pid);
        trace!("Locks released");
        for entry in self.individual_tasks.iter() {
            live_group_ids.insert(entry.key().clone());
        }
        for entry in self.batches.iter() {
            live_group_ids.insert(entry.key().clone());
        }

        // Clean up group IDs for tasks/batches that no longer exist
        self.group_metadata_map
            .retain(|group_id, _| live_group_ids.contains(group_id));

        let mut new_groups = HashMap::new();

        // Add main_cli group if registered and new
        if live_group_ids.contains(MAIN_CLI_GROUP_ID)
            && !self.group_metadata_map.contains_key(MAIN_CLI_GROUP_ID)
        {
            new_groups.insert(
                MAIN_CLI_GROUP_ID.to_string(),
                GroupInfo {
                    group_type: GroupType::MainCLI,
                    display_name: "Nx CLI".to_string(),
                    id: MAIN_CLI_GROUP_ID.to_string(),
                    task_ids: None,
                },
            );
        }

        // Add main_cli_subprocesses group if subprocesses exist and new
        if live_group_ids.contains(MAIN_CLI_SUBPROCESSES_GROUP_ID)
            && !self
                .group_metadata_map
                .contains_key(MAIN_CLI_SUBPROCESSES_GROUP_ID)
        {
            new_groups.insert(
                MAIN_CLI_SUBPROCESSES_GROUP_ID.to_string(),
                GroupInfo {
                    group_type: GroupType::MainCliSubprocesses,
                    display_name: "Nx CLI Subprocesses".to_string(),
                    id: MAIN_CLI_SUBPROCESSES_GROUP_ID.to_string(),
                    task_ids: None,
                },
            );
        }

        // Add daemon group if registered and new
        if live_group_ids.contains(DAEMON_GROUP_ID)
            && !self.group_metadata_map.contains_key(DAEMON_GROUP_ID)
        {
            new_groups.insert(
                DAEMON_GROUP_ID.to_string(),
                GroupInfo {
                    group_type: GroupType::Daemon,
                    display_name: "Nx Daemon".to_string(),
                    id: DAEMON_GROUP_ID.to_string(),
                    task_ids: None,
                },
            );
        }

        // Add groups for all NEW registered tasks
        for entry in self.individual_tasks.iter() {
            let task_id = entry.key().clone();
            if !self.group_metadata_map.contains_key(&task_id) {
                new_groups.insert(
                    task_id.clone(),
                    GroupInfo {
                        group_type: GroupType::Task,
                        display_name: task_id.clone(),
                        id: task_id,
                        task_ids: None,
                    },
                );
            }
        }

        // Add groups for all NEW registered batches
        for entry in self.batches.iter() {
            let batch_id = entry.key().clone();
            if !self.group_metadata_map.contains_key(&batch_id) {
                let batch_reg = entry.value();
                new_groups.insert(
                    batch_id.clone(),
                    GroupInfo {
                        group_type: GroupType::Batch,
                        display_name: batch_id.clone(),
                        id: batch_id,
                        task_ids: Some(batch_reg.task_ids.as_ref().to_vec()),
                    },
                );
            }
        }

        new_groups
    }

    /// Discover all current processes and collect their metrics
    fn collect_metrics(&self) -> Result<MetricsCollectionResult, Box<dyn std::error::Error>> {
        trace!("Starting metrics collection cycle");
        // Capture timestamp FIRST for accuracy
        let timestamp = current_timestamp_millis();

        // Refresh all processes and collect metrics in minimal lock scope
        trace!("Acquiring system lock for process refresh");
        let (
            main_cli_processes,
            main_cli_metadata,
            main_cli_subprocess_processes,
            main_cli_subprocess_metadata,
            daemon_processes,
            daemon_metadata,
            tasks_metrics,
            tasks_metadata,
            batches_metrics,
            batches_metadata,
            daemon_pid_to_clear,
        ) = {
            let mut sys = self.system.lock();
            trace!("System lock acquired, refreshing all processes");

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
            trace!("Process refresh complete, building parent-child map");

            let children_map = Self::build_parent_child_map(&sys);

            // Remove dead processes to prevent stale metrics from terminated processes
            trace!("Cleaning up dead processes from registration maps");
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
            trace!("Dead process cleanup complete");

            // Check if daemon process still exists (capture PID while holding system lock)
            trace!("Checking daemon process existence");
            let daemon_pid_to_clear = {
                let daemon_pid = self.daemon_pid.lock();
                (*daemon_pid).filter(|&pid| sys.process(Pid::from(pid as usize)).is_none())
            };

            // Collect metrics for all the processes while holding system lock
            trace!("Collecting metrics for all registered processes");
            let main_cli = self.collect_main_cli_metrics(&sys);
            let main_cli_subproc = self.collect_main_cli_subprocess_metrics(&sys, &children_map);
            let daemon = self.collect_daemon_metrics(&sys, &children_map);
            let tasks = self.collect_all_task_metrics(&sys, &children_map);
            let batches = self.collect_all_batch_metrics(&sys, &children_map);
            trace!("Metrics collection complete, releasing system lock");

            (
                main_cli.0,
                main_cli.1,
                main_cli_subproc.0,
                main_cli_subproc.1,
                daemon.0,
                daemon.1,
                tasks.0,
                tasks.1,
                batches.0,
                batches.1,
                daemon_pid_to_clear,
            )
        }; // system lock is released here

        // Now that system lock is released, clear daemon PID if needed
        // This avoids holding system lock while acquiring daemon_pid lock
        if let Some(_pid) = daemon_pid_to_clear {
            trace!("Clearing stale daemon PID after system lock release");
            let mut daemon_pid = self.daemon_pid.lock();
            // Double-check in case something changed while we waited for the lock
            if let Some(current_pid) = *daemon_pid
                && current_pid == _pid
            {
                *daemon_pid = None;
            }
        }

        // Accumulate metadata from all collection sources
        let mut new_metadata = main_cli_metadata;
        new_metadata.extend(main_cli_subprocess_metadata);
        new_metadata.extend(daemon_metadata);
        new_metadata.extend(tasks_metadata);
        new_metadata.extend(batches_metadata);

        // Flatten processes from all sources
        let mut processes = Vec::with_capacity(
            main_cli_processes.len()
                + main_cli_subprocess_processes.len()
                + daemon_processes.len()
                + tasks_metrics.len()
                + batches_metrics.len(),
        );
        processes.extend(main_cli_processes);
        processes.extend(main_cli_subprocess_processes);
        processes.extend(daemon_processes);
        processes.extend(tasks_metrics);
        processes.extend(batches_metrics);

        // Derive live PIDs from the collected processes for cleanup
        let live_pids: HashSet<String> = processes.iter().map(|p| p.pid.to_string()).collect();

        // Clean up dead process which are no longer alive
        self.process_metadata_map
            .retain(|pid, _| live_pids.contains(pid));

        // Convert i32 keys to strings and insert into DashMap in one pass
        let process_metadata_str: HashMap<String, ProcessMetadata> = new_metadata
            .into_iter()
            .map(|(pid, meta)| {
                let str_pid = pid.to_string();
                self.process_metadata_map
                    .insert(str_pid.clone(), meta.clone());
                (str_pid, meta)
            })
            .collect();

        // Create only NEW groups and insert into DashMap
        trace!("Creating new group info");
        let new_groups = self.create_new_group_info();
        trace!("Created {} new groups", new_groups.len());

        for (group_id, group_info) in &new_groups {
            self.group_metadata_map
                .insert(group_id.clone(), group_info.clone());
        }
        trace!("Inserted groups into metadata map");

        let metadata = Metadata {
            groups: new_groups,
            processes: process_metadata_str,
        };

        trace!(
            "Metrics collection complete: {} processes collected",
            processes.len()
        );
        Ok(MetricsCollectionResult {
            timestamp,
            processes,
            metadata,
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
    /// Metadata for all discovered processes (shared with collection thread)
    process_metadata_map: Arc<DashMap<String, ProcessMetadata>>,
    /// Track which group IDs have been sent (for incremental updates, shared with collection thread)
    group_metadata_map: Arc<DashMap<String, GroupInfo>>,
    /// Collection thread state
    collection_thread: Mutex<Option<JoinHandle<()>>>,
    /// Listener thread that receives metrics and notifies subscribers
    listener_thread: Mutex<Option<JoinHandle<()>>>,
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
            process_metadata_map: Arc::new(DashMap::new()),
            group_metadata_map: Arc::new(DashMap::new()),
            collection_thread: Mutex::new(None),
            listener_thread: Mutex::new(None),
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

        // Create unbounded channel for metrics communication
        // Unbounded ensures collection never blocks on sending metrics
        // Memory growth is self-limiting: if listener falls behind for many seconds,
        // the system likely has bigger problems than buffered metrics
        let (tx, rx) = unbounded::<MetricsCollectionResult>();

        // Create the collection runner with channel sender
        let runner = CollectionRunner::new(self, tx);

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

        // Store collection thread immediately so we can clean up if listener spawn fails
        *self.collection_thread.lock() = Some(collection_thread);

        // Spawn listener thread to receive metrics and notify subscribers
        let subscribers = Arc::clone(&self.subscribers);
        let process_metadata_map = Arc::clone(&self.process_metadata_map);
        let group_metadata_map = Arc::clone(&self.group_metadata_map);

        let listener_thread = std::thread::Builder::new()
            .name("nx-metrics-listener".to_string())
            .spawn(move || {
                // Receive metrics and notify subscribers
                while let Ok(result) = rx.recv() {
                    Self::notify_subscribers(
                        &subscribers,
                        &process_metadata_map,
                        &group_metadata_map,
                        result,
                    );
                }
            })
            .map_err(|e| {
                // Failed to spawn listener - clean up collection thread
                self.should_collect.store(false, Ordering::Release);

                // Wait for collection thread to stop gracefully
                if let Some(thread) = self.collection_thread.lock().take()
                    && let Err(join_err) = thread.join()
                {
                    error!("Collection thread panicked during cleanup: {:?}", join_err);
                }

                self.is_collecting.store(false, Ordering::Release);
                error!("Failed to start metrics listener: {}", e);
                anyhow::anyhow!("Failed to start listener: {}", e)
            })?;

        *self.listener_thread.lock() = Some(listener_thread);

        Ok(())
    }

    /// Notify all subscribers with the collected metrics
    /// This is called by the listener thread
    fn notify_subscribers(
        subscribers: &Arc<Mutex<Vec<SubscriberState>>>,
        process_metadata_map: &Arc<DashMap<String, ProcessMetadata>>,
        group_metadata_map: &Arc<DashMap<String, GroupInfo>>,
        result: MetricsCollectionResult,
    ) {
        let timestamp = result.timestamp;
        let processes = result.processes;

        // Check if any subscriber needs full metadata (before taking lock for long time)
        let any_needs_full = subscribers.lock().iter().any(|s| s.needs_full_metadata);

        // Build full metadata outside lock to avoid blocking subscription additions
        let full_metadata = if any_needs_full {
            Some(Metadata {
                groups: group_metadata_map
                    .iter()
                    .map(|entry| (entry.key().to_string(), entry.value().clone()))
                    .collect::<HashMap<_, _>>(),
                processes: process_metadata_map
                    .iter()
                    .map(|entry| (entry.key().to_string(), entry.value().clone()))
                    .collect::<HashMap<_, _>>(),
            })
        } else {
            None
        };

        // Build notifications inside lock, then release before calling JS
        let notifications = {
            let mut subscribers = subscribers.lock();

            // Build notification list
            subscribers
                .iter_mut()
                .enumerate()
                .map(|(idx, state)| {
                    // Use full metadata if needed, otherwise use collected metadata
                    let metadata = if state.needs_full_metadata {
                        state.needs_full_metadata = false;
                        full_metadata.clone().unwrap()
                    } else {
                        result.metadata.clone()
                    };

                    let update = MetricsUpdate {
                        timestamp,
                        processes: processes.clone(), // Clone Vec - ProcessMetrics is Copy so relatively efficient
                        metadata,
                    };

                    // Clone ThreadsafeFunction (cheap - internally Arc-based)
                    (idx, state.callback.clone(), update)
                })
                .collect::<Vec<_>>()
        }; // Lock released here!

        // Notify subscribers and track which ones failed
        let mut failed_indices = Vec::new();
        for (idx, callback, update) in notifications {
            let status = callback.call(Ok(update), ThreadsafeFunctionCallMode::NonBlocking);
            if !matches!(status, napi::Status::Ok) {
                tracing::debug!("Failed to notify subscriber at index {}: {:?}", idx, status);
                failed_indices.push(idx);
            }
        }

        // Clean up failed subscribers (they're dead/closed)
        if !failed_indices.is_empty() {
            let mut subscribers = subscribers.lock();
            // Remove in reverse order to maintain valid indices
            failed_indices.sort_unstable();
            for &idx in failed_indices.iter().rev() {
                if idx < subscribers.len() {
                    subscribers.remove(idx);
                    tracing::info!("Removed dead subscriber at index {}", idx);
                }
            }
        }
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
        // When it drops, the channel sender is dropped, signaling the listener to stop
        if let Some(thread) = self.collection_thread.lock().take()
            && let Err(e) = thread.join()
        {
            error!("Collection thread panicked: {:?}", e);
        }

        // Wait for the listener thread to finish
        if let Some(thread) = self.listener_thread.lock().take()
            && let Err(e) = thread.join()
        {
            error!("Listener thread panicked: {:?}", e);
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
        trace!("Registering main CLI process: pid={}", pid);

        // Establish baseline immediately for the main CLI process
        // This ensures accurate CPU data from the first collection cycle
        // Acquire system lock FIRST to avoid deadlock with collection thread
        trace!("Acquiring system lock for main CLI baseline refresh");
        let mut sys = self.system.lock();
        trace!("System lock acquired, refreshing process: pid={}", pid);

        let target_pid = Pid::from(pid as usize);
        sys.refresh_processes_specifics(
            sysinfo::ProcessesToUpdate::Some(&[target_pid]),
            false, // don't remove dead processes
            ProcessRefreshKind::nothing().with_cpu(),
        );
        drop(sys); // Explicitly release system lock
        trace!("System lock released after refresh");

        // Now register the PID (after releasing system lock)
        trace!("Acquiring main_cli_pid lock to register: pid={}", pid);
        *self.main_cli_pid.lock() = Some(pid);
        trace!("Main CLI process registered: pid={}", pid);
    }

    /// Register a subprocess of the main CLI for metrics collection
    #[napi]
    pub fn register_main_cli_subprocess(&self, pid: i32, alias: Option<String>) {
        trace!(
            "Registering main CLI subprocess: pid={}, alias={:?}",
            pid, alias
        );

        // Establish baseline immediately for this subprocess
        // This ensures accurate CPU data from the first collection cycle after spawn
        // Acquire system lock FIRST to avoid deadlock with collection thread
        trace!("Acquiring system lock for subprocess baseline refresh");
        let mut sys = self.system.lock();
        trace!("System lock acquired, refreshing subprocess: pid={}", pid);

        let target_pid = Pid::from(pid as usize);
        sys.refresh_processes_specifics(
            sysinfo::ProcessesToUpdate::Some(&[target_pid]),
            false, // don't remove dead processes
            ProcessRefreshKind::nothing().with_cpu(),
        );
        drop(sys); // Explicitly release system lock
        trace!("System lock released after subprocess refresh");

        // Now register in map (after releasing system lock)
        trace!("Inserting subprocess into map: pid={}", pid);
        self.main_cli_subprocess_pids.insert(pid, alias);
        trace!("Main CLI subprocess registered: pid={}", pid);
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
        trace!("Registering task process: task_id={}, pid={}", task_id, pid);

        // Establish baseline immediately for this task process
        // This ensures accurate CPU data from the first collection cycle after spawn
        // Acquire system lock FIRST to avoid deadlock with collection thread
        trace!("Acquiring system lock for task baseline refresh");
        let mut sys = self.system.lock();
        trace!(
            "System lock acquired, refreshing task process: task_id={}, pid={}",
            task_id, pid
        );

        let target_pid = Pid::from(pid as usize);
        sys.refresh_processes_specifics(
            sysinfo::ProcessesToUpdate::Some(&[target_pid]),
            false, // don't remove dead processes
            ProcessRefreshKind::nothing().with_cpu(),
        );
        drop(sys); // Explicitly release system lock
        trace!("System lock released after task refresh");

        // Now register the task (after releasing system lock)
        trace!("Inserting task into map: task_id={}, pid={}", task_id, pid);
        self.individual_tasks
            .entry(task_id.clone())
            .or_insert_with(|| IndividualTaskRegistration::new(task_id.clone()))
            .anchor_pids
            .insert(pid);
        trace!("Task process registered: task_id={}, pid={}", task_id, pid);
    }

    /// Register a batch with multiple tasks sharing a worker
    #[napi]
    pub fn register_batch(&self, batch_id: String, task_ids: Vec<String>, pid: i32) {
        trace!(
            "Registering batch: batch_id={}, task_count={}, pid={}",
            batch_id,
            task_ids.len(),
            pid
        );

        // Establish baseline immediately for the batch worker
        // Acquire system lock FIRST to avoid deadlock with collection thread
        trace!("Acquiring system lock for batch baseline refresh");
        let mut sys = self.system.lock();
        trace!(
            "System lock acquired, refreshing batch process: batch_id={}, pid={}",
            batch_id, pid
        );

        let target_pid = Pid::from(pid as usize);
        sys.refresh_processes_specifics(
            sysinfo::ProcessesToUpdate::Some(&[target_pid]),
            false, // don't remove dead processes
            ProcessRefreshKind::nothing().with_cpu(),
        );
        drop(sys); // Explicitly release system lock
        trace!("System lock released after batch refresh");

        // Now register the batch (after releasing system lock)
        trace!("Inserting batch into map: batch_id={}", batch_id);
        self.batches.insert(
            batch_id.clone(),
            BatchRegistration::new(batch_id.clone(), task_ids, pid),
        );
        trace!("Batch registered: batch_id={}, pid={}", batch_id, pid);
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
        if self.is_collecting.load(Ordering::Acquire)
            && let Err(e) = self.stop_collection()
        {
            error!(
                "Failed to stop collection during ProcessMetricsCollector drop: {}",
                e
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Helper to create a test CollectionRunner without NAPI dependencies
    fn create_test_runner() -> (CollectionRunner, Receiver<MetricsCollectionResult>) {
        let (tx, rx) = unbounded::<MetricsCollectionResult>();

        let runner = CollectionRunner {
            should_collect: Arc::new(AtomicBool::new(false)),
            is_collecting: Arc::new(AtomicBool::new(false)),
            individual_tasks: Arc::new(DashMap::new()),
            batches: Arc::new(DashMap::new()),
            main_cli_pid: Arc::new(Mutex::new(None)),
            main_cli_subprocess_pids: Arc::new(DashMap::new()),
            daemon_pid: Arc::new(Mutex::new(None)),
            system: Arc::new(Mutex::new(System::new())),
            config: CollectorConfig::default(),
            process_metadata_map: Arc::new(DashMap::new()),
            group_metadata_map: Arc::new(DashMap::new()),
            metrics_tx: tx,
        };

        (runner, rx)
    }

    #[test]
    fn test_create_new_group_info_with_no_registrations() {
        let (runner, _rx) = create_test_runner();
        let groups = runner.create_new_group_info();

        // No registrations should mean no groups
        assert_eq!(groups.len(), 0);
    }

    #[test]
    fn test_create_new_group_info_with_main_cli() {
        let (runner, _rx) = create_test_runner();
        *runner.main_cli_pid.lock() = Some(12345);

        let groups = runner.create_new_group_info();

        assert_eq!(groups.len(), 1);
        assert!(groups.contains_key(MAIN_CLI_GROUP_ID));
        assert_eq!(groups[MAIN_CLI_GROUP_ID].group_type, GroupType::MainCLI);
    }

    #[test]
    fn test_create_new_group_info_with_daemon() {
        let (runner, _rx) = create_test_runner();
        *runner.daemon_pid.lock() = Some(67890);

        let groups = runner.create_new_group_info();

        assert_eq!(groups.len(), 1);
        assert!(groups.contains_key(DAEMON_GROUP_ID));
        assert_eq!(groups[DAEMON_GROUP_ID].group_type, GroupType::Daemon);
    }

    #[test]
    fn test_create_new_group_info_with_task() {
        let (runner, _rx) = create_test_runner();
        let task_id = "my-app:build".to_string();
        runner.individual_tasks.insert(
            task_id.clone(),
            IndividualTaskRegistration {
                task_id: task_id.clone(),
                anchor_pids: HashSet::from([11111]),
            },
        );

        let groups = runner.create_new_group_info();

        assert_eq!(groups.len(), 1);
        assert!(groups.contains_key(&task_id));
        assert_eq!(groups[&task_id].group_type, GroupType::Task);
    }

    #[test]
    fn test_create_new_group_info_with_batch() {
        let (runner, _rx) = create_test_runner();
        let batch_id = "batch-1".to_string();
        let task_ids = vec!["task-1".to_string(), "task-2".to_string()];
        runner.batches.insert(
            batch_id.clone(),
            BatchRegistration {
                batch_id: batch_id.clone(),
                task_ids: Arc::new(task_ids.clone()),
                anchor_pid: 22222,
            },
        );

        let groups = runner.create_new_group_info();

        assert_eq!(groups.len(), 1);
        assert!(groups.contains_key(&batch_id));
        assert_eq!(groups[&batch_id].group_type, GroupType::Batch);
        assert_eq!(groups[&batch_id].task_ids, Some(task_ids));
    }

    #[test]
    fn test_incremental_group_creation() {
        let (runner, _rx) = create_test_runner();

        // First call with main_cli
        *runner.main_cli_pid.lock() = Some(12345);
        let groups1 = runner.create_new_group_info();
        assert_eq!(groups1.len(), 1);
        assert!(groups1.contains_key(MAIN_CLI_GROUP_ID));

        // Mark main_cli as sent
        for (id, info) in groups1 {
            runner.group_metadata_map.insert(id, info);
        }

        // Second call should return empty (main_cli already sent)
        let groups2 = runner.create_new_group_info();
        assert_eq!(groups2.len(), 0);

        // Add daemon
        *runner.daemon_pid.lock() = Some(67890);
        let groups3 = runner.create_new_group_info();
        assert_eq!(groups3.len(), 1);
        assert!(groups3.contains_key(DAEMON_GROUP_ID));
        assert!(!groups3.contains_key(MAIN_CLI_GROUP_ID));
    }

    #[test]
    fn test_dead_group_cleanup() {
        let (runner, _rx) = create_test_runner();
        let task_id = "task-1".to_string();

        // Register and create group
        runner.individual_tasks.insert(
            task_id.clone(),
            IndividualTaskRegistration {
                task_id: task_id.clone(),
                anchor_pids: HashSet::from([11111]),
            },
        );

        let groups = runner.create_new_group_info();
        for (id, info) in groups {
            runner.group_metadata_map.insert(id, info);
        }

        // Verify group exists
        assert!(runner.group_metadata_map.contains_key(&task_id));

        // Remove task (simulating task completion)
        runner.individual_tasks.remove(&task_id);

        // Call create_new_group_info which should clean up
        let _ = runner.create_new_group_info();

        // Verify group was removed
        assert!(!runner.group_metadata_map.contains_key(&task_id));
    }

    #[test]
    fn test_create_new_group_info_with_main_cli_subprocesses() {
        let (runner, _rx) = create_test_runner();

        // Register main CLI process
        *runner.main_cli_pid.lock() = Some(12345);

        // Register a subprocess
        runner
            .main_cli_subprocess_pids
            .insert(54321, Some("plugin-worker".to_string()));

        let groups = runner.create_new_group_info();

        // Should have 2 groups: main_cli and main_cli_subprocesses
        assert_eq!(groups.len(), 2);
        assert!(groups.contains_key(MAIN_CLI_GROUP_ID));
        assert!(groups.contains_key(MAIN_CLI_SUBPROCESSES_GROUP_ID));
        assert_eq!(groups[MAIN_CLI_GROUP_ID].group_type, GroupType::MainCLI);
        assert_eq!(
            groups[MAIN_CLI_SUBPROCESSES_GROUP_ID].group_type,
            GroupType::MainCliSubprocesses
        );
    }

    #[test]
    fn test_main_cli_subprocesses_only_with_main_cli() {
        let (runner, _rx) = create_test_runner();

        // Register subprocess without main CLI should NOT create subprocess group
        runner
            .main_cli_subprocess_pids
            .insert(54321, Some("plugin-worker".to_string()));

        let groups = runner.create_new_group_info();

        // No groups should be created since main CLI is not registered
        assert_eq!(groups.len(), 0);
    }

    #[test]
    fn test_main_cli_subprocesses_cleanup() {
        let (runner, _rx) = create_test_runner();

        // Register main CLI and subprocess, create groups
        *runner.main_cli_pid.lock() = Some(12345);
        runner
            .main_cli_subprocess_pids
            .insert(54321, Some("plugin-worker".to_string()));

        let groups = runner.create_new_group_info();
        assert_eq!(groups.len(), 2);

        // Mark as sent
        for (id, info) in groups {
            runner.group_metadata_map.insert(id, info);
        }

        // Remove subprocess
        runner.main_cli_subprocess_pids.clear();

        // Should clean up subprocess group but keep main CLI
        let groups2 = runner.create_new_group_info();
        assert_eq!(groups2.len(), 0); // No new groups (already sent)

        // Verify groups state after cleanup
        assert!(runner.group_metadata_map.contains_key(MAIN_CLI_GROUP_ID));
        assert!(
            !runner
                .group_metadata_map
                .contains_key(MAIN_CLI_SUBPROCESSES_GROUP_ID)
        );
    }

    #[test]
    fn test_concurrent_group_creation_with_subprocess_updates() {
        // This test verifies that create_new_group_info works correctly when
        // subprocesses are being registered concurrently. The fix ensures
        // lock ordering prevents deadlocks: system lock is released before
        // accessing registration maps
        use std::sync::Arc;
        use std::thread;
        use std::time::Duration;

        let (runner, _rx) = create_test_runner();
        let runner = Arc::new(runner);

        // Register an initial main CLI process
        *runner.main_cli_pid.lock() = Some(1234);

        // Spawn a thread that continuously calls create_new_group_info
        // (simulating the collection thread)
        let runner_collector = Arc::clone(&runner);
        let collector_handle = thread::spawn(move || {
            for _ in 0..10 {
                let _ = runner_collector.create_new_group_info();
                thread::sleep(Duration::from_millis(5));
            }
        });

        // Spawn threads that register subprocesses concurrently
        // (simulating registration threads)
        let handles: Vec<_> = (0..3)
            .map(|i| {
                let runner = Arc::clone(&runner);
                thread::spawn(move || {
                    for j in 0..5 {
                        let pid = 10000 + i * 100 + j;
                        runner
                            .main_cli_subprocess_pids
                            .insert(pid as i32, Some(format!("worker-{}", j)));
                        thread::sleep(Duration::from_millis(2));
                    }
                })
            })
            .collect();

        // Wait for all threads to complete
        for handle in handles {
            handle.join().unwrap();
        }
        collector_handle.join().unwrap();

        // Verify all subprocesses were registered
        assert_eq!(runner.main_cli_subprocess_pids.len(), 15);

        // Verify that create_new_group_info completes successfully
        // (If there was a deadlock, this would have hung during the test)
        let groups = runner.create_new_group_info();
        assert!(groups.contains_key(MAIN_CLI_SUBPROCESSES_GROUP_ID));
    }

    #[test]
    fn test_lock_order_consistency_across_registration_threads() {
        // This test verifies that the lock ordering is consistent:
        // All registration operations acquire system lock BEFORE registration maps.
        // This test spawns multiple threads doing concurrent registrations and
        // verify they all complete without deadlock.
        use std::sync::Arc;
        use std::thread;
        use std::time::Duration;

        let (runner, _rx) = create_test_runner();
        let runner = Arc::new(runner);

        // Initialize some baseline data
        *runner.main_cli_pid.lock() = Some(5000);

        // Spawn multiple threads doing different registration operations
        let handles: Vec<_> = (0..6)
            .map(|thread_id| {
                let runner = Arc::clone(&runner);
                thread::spawn(move || {
                    for i in 0..5 {
                        match thread_id {
                            0 => {
                                // Thread 0: Register subprocesses
                                runner
                                    .main_cli_subprocess_pids
                                    .insert(30000 + i, Some(format!("worker-{}", i)));
                            }
                            1 => {
                                // Thread 1: Create new groups
                                let _ = runner.create_new_group_info();
                            }
                            2 => {
                                // Thread 2: Access subprocess pids
                                let _ = runner.main_cli_subprocess_pids.len();
                            }
                            3 => {
                                // Thread 3: Access main_cli_pid
                                let _ = *runner.main_cli_pid.lock();
                            }
                            4 => {
                                // Thread 4: Register tasks
                                runner.individual_tasks.insert(
                                    format!("task-{}-{}", thread_id, i),
                                    IndividualTaskRegistration {
                                        task_id: format!("task-{}-{}", thread_id, i),
                                        anchor_pids: std::collections::HashSet::new(),
                                    },
                                );
                            }
                            5 => {
                                // Thread 5: Register batches
                                runner.batches.insert(
                                    format!("batch-{}-{}", thread_id, i),
                                    BatchRegistration {
                                        batch_id: format!("batch-{}-{}", thread_id, i),
                                        task_ids: Arc::new(vec![]),
                                        anchor_pid: 40000 + i,
                                    },
                                );
                            }
                            _ => {}
                        }
                        thread::sleep(Duration::from_millis(1));
                    }
                })
            })
            .collect();

        // Wait for all threads to complete
        for handle in handles {
            handle.join().unwrap();
        }

        // If we got here without deadlock or panic, the lock ordering is correct
        // Verify some data was collected
        assert!(runner.main_cli_subprocess_pids.len() > 0);
        assert!(runner.individual_tasks.len() > 0);
        assert!(runner.batches.len() > 0);
    }
}
