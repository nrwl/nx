use napi::Either;
use napi_derive::napi;
use std::collections::{HashMap, HashSet, VecDeque};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, Signal, System};
use tracing::debug;

/// Convert a numeric signal to its string representation.
/// Based on standard POSIX signal numbers.
fn signal_number_to_name(num: i32) -> &'static str {
    match num {
        1 => "SIGHUP",
        2 => "SIGINT",
        3 => "SIGQUIT",
        9 => "SIGKILL",
        15 => "SIGTERM",
        _ => {
            tracing::warn!("Unknown signal number {}, defaulting to SIGTERM", num);
            "SIGTERM"
        }
    }
}

/// Normalize a signal that can be either a string or number to an Option<&str>.
pub(crate) fn normalize_signal(signal: Option<&Either<String, i32>>) -> Option<&'static str> {
    signal.map(|s| match s {
        Either::A(string) => match string.as_str() {
            "SIGHUP" => "SIGHUP",
            "SIGINT" => "SIGINT",
            "SIGQUIT" => "SIGQUIT",
            "SIGKILL" => "SIGKILL",
            "SIGTERM" => "SIGTERM",
            _ => {
                tracing::warn!("Unknown signal '{}', defaulting to SIGTERM", string);
                "SIGTERM"
            }
        },
        Either::B(num) => signal_number_to_name(*num),
    })
}

/// Convert a Node.js signal string to sysinfo::Signal.
///
/// On Windows, sysinfo only supports `Signal::Kill` (TerminateProcess).
/// Other signal variants exist in the enum but `kill_with` returns `None`.
/// This is intentional: `killProcessTreeGraceful` uses the no-op as a
/// "wait for the grace period, then force-kill" strategy — children on
/// Windows already receive CTRL_C_EVENT from the OS when the user presses
/// Ctrl+C, so the graceful killer just needs to wait, not signal.
fn map_signal(signal: Option<&str>) -> Signal {
    match signal {
        Some("SIGKILL") => Signal::Kill,
        Some("SIGTERM") | None => Signal::Term,
        Some("SIGINT") => Signal::Interrupt,
        Some("SIGQUIT") => Signal::Quit,
        Some("SIGHUP") => Signal::Hangup,
        _ => Signal::Term,
    }
}

/// Kill a process and all its descendants (fire-and-forget).
///
/// Sends the requested signal but does NOT wait for processes to exit.
/// Use `killProcessTreeGraceful` when cleanup handlers must run.
#[napi(ts_args_type = "rootPid: number, signal?: string | number | undefined | null")]
pub fn kill_process_tree(root_pid: i32, signal: Option<Either<String, i32>>) {
    let signal_str = normalize_signal(signal.as_ref());
    kill_process_tree_internal(root_pid, signal_str);
}

/// Collect all PIDs in the process tree rooted at `root_pid` via BFS.
///
/// Returns the list in BFS order (root first, leaves last).
/// If the root process has already exited, returns an empty Vec.
fn collect_process_tree(sys: &System, root_pid: i32) -> (Vec<Pid>, HashMap<Pid, Vec<Pid>>) {
    let root = Pid::from(root_pid as usize);

    if sys.process(root).is_none() {
        debug!("Root process {} not found", root);
        return (Vec::new(), HashMap::new());
    }

    let mut children: HashMap<Pid, Vec<Pid>> = HashMap::with_capacity(sys.processes().len() / 4);
    for (pid, proc_info) in sys.processes() {
        // Skip threads (on Linux, threads appear as processes but we only want to kill processes)
        if proc_info.thread_kind().is_some() {
            continue;
        }
        if let Some(parent) = proc_info.parent() {
            children.entry(parent).or_default().push(*pid);
        }
    }

    let mut to_kill = Vec::new();
    let mut queue = VecDeque::new();
    let mut visited = HashSet::new();
    queue.push_back(root);
    visited.insert(root);

    while let Some(pid) = queue.pop_front() {
        if sys.process(pid).is_some() {
            to_kill.push(pid);
        }
        if let Some(kids) = children.get(&pid) {
            for &kid in kids {
                if visited.insert(kid) {
                    queue.push_back(kid);
                }
            }
        }
    }

    (to_kill, children)
}

/// Send a signal to PIDs in reverse order (leaves first, then parents).
///
/// If `force_kill_fallback` is true and the signal is unsupported on this
/// platform (e.g. SIGTERM on Windows), falls back to SIGKILL. This is used
/// by the fire-and-forget `killProcessTree` where we must guarantee the
/// process is killed. The graceful variant passes `false` so unsupported
/// signals are no-ops (letting the grace period + deadline handle it).
fn send_signal_to_pids(sys: &System, pids: &[Pid], signal: Signal, force_kill_fallback: bool) {
    for pid in pids.iter().rev() {
        if let Some(proc_info) = sys.process(*pid) {
            match proc_info.kill_with(signal) {
                Some(true) => {
                    debug!("Sent {} to process {}", signal, pid);
                }
                Some(false) => {
                    debug!("Process {} already exited or insufficient permissions", pid);
                }
                None => {
                    if force_kill_fallback && signal != Signal::Kill {
                        debug!(
                            "Signal {} not supported for process {}, falling back to SIGKILL",
                            signal, pid
                        );
                        proc_info.kill_with(Signal::Kill);
                    } else {
                        debug!("Signal {} not supported for process {}", signal, pid);
                    }
                }
            }
        }
    }
}

/// Snapshot all processes and signal the tree. Returns targeted PIDs.
fn snapshot_and_signal(root_pid: i32, signal: Signal) -> Vec<Pid> {
    let mut sys = System::new();
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());

    let (to_kill, _children) = collect_process_tree(&sys, root_pid);
    if to_kill.is_empty() {
        return Vec::new();
    }

    debug!(
        "Sending {} to {} processes (root: {})",
        signal,
        to_kill.len(),
        root_pid
    );
    // Fire-and-forget must guarantee the kill, so fall back to SIGKILL
    // on platforms where the requested signal is unsupported (e.g. Windows).
    send_signal_to_pids(&sys, &to_kill, signal, true);
    to_kill
}

/// Internal implementation shared by ProcessKiller and the napi fire-and-forget function.
pub(crate) fn kill_process_tree_internal(root_pid: i32, signal: Option<&str>) {
    snapshot_and_signal(root_pid, map_signal(signal));
}

/// Kill a process tree gracefully: signal → wait → SIGKILL.
///
/// Signals leaf processes first, waits for them to exit, then signals
/// their parents (now leaves). Repeats until the tree is empty or the
/// grace period expires, then force-kills survivors.
#[napi(
    ts_args_type = "rootPid: number, signal?: string | number | undefined | null, gracePeriodMs?: number | undefined | null"
)]
pub async fn kill_process_tree_graceful(
    root_pid: i32,
    signal: Option<Either<String, i32>>,
    grace_period_ms: Option<u32>,
) {
    let grace_ms = grace_period_ms.unwrap_or_else(|| {
        std::env::var("NX_PROCESS_KILL_GRACE_PERIOD")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(5000)
    });

    tokio::task::spawn_blocking(move || {
        let signal_str = normalize_signal(signal.as_ref());
        let mapped = map_signal(signal_str);

        // Snapshot full tree
        let mut sys = System::new();
        sys.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing(),
        );
        let (tree, mut children_of) = collect_process_tree(&sys, root_pid);
        if tree.is_empty() {
            return;
        }

        // SIGKILL: no point in bottom-up, just kill everything
        if mapped == Signal::Kill {
            send_signal_to_pids(&sys, &tree, Signal::Kill, false);
            return;
        }

        // Only snapshot PIDs receive the graceful signal. Processes spawned
        // later (cleanup handlers, docker compose, etc.) are tracked and
        // awaited but never signaled — they get time to finish naturally.
        let snapshot_pids: HashSet<Pid> = tree.iter().copied().collect();
        let mut remaining: HashSet<Pid> = snapshot_pids.clone();
        let mut signaled: HashSet<Pid> = HashSet::with_capacity(tree.len());
        let mut buf: Vec<Pid> = Vec::with_capacity(tree.len());
        let poll = std::time::Duration::from_millis(100);
        let deadline = std::time::Duration::from_millis(grace_ms as u64);
        let start = std::time::Instant::now();

        loop {
            // Signal new leaves among snapshot PIDs. A snapshot PID is a
            // "leaf" when all its children (original + newly discovered)
            // have exited from `remaining`.
            buf.clear();
            buf.extend(
                remaining
                    .iter()
                    .copied()
                    .filter(|pid| snapshot_pids.contains(pid)),
            );
            for &pid in &buf {
                let is_leaf = children_of
                    .get(&pid)
                    .map_or(true, |kids| kids.iter().all(|k| !remaining.contains(k)));
                if !is_leaf || !signaled.insert(pid) {
                    continue;
                }
                if let Some(proc) = sys.process(pid) {
                    proc.kill_with(mapped);
                }
            }

            std::thread::sleep(poll);

            // Full refresh to detect both exits and newly spawned processes.
            sys.refresh_processes_specifics(
                ProcessesToUpdate::All,
                true,
                ProcessRefreshKind::nothing(),
            );

            // Discover new children of tracked processes (cleanup
            // subprocesses). They are added to `remaining` so we await
            // them, and to `children_of` so their parent isn't
            // considered a leaf while they're alive.
            for (pid, proc_info) in sys.processes() {
                if remaining.contains(pid) || proc_info.thread_kind().is_some() {
                    continue;
                }
                if let Some(parent) = proc_info.parent() {
                    if remaining.contains(&parent) {
                        remaining.insert(*pid);
                        children_of.entry(parent).or_default().push(*pid);
                        debug!("Tracking new cleanup process {} (child of {})", pid, parent);
                    }
                }
            }

            remaining.retain(|pid| sys.process(*pid).is_some());

            if remaining.is_empty() {
                break;
            }
            if start.elapsed() >= deadline {
                debug!(
                    "Grace period expired after {}ms for root_pid={}. Force killing {} survivors",
                    start.elapsed().as_millis(),
                    root_pid,
                    remaining.len()
                );
                for pid in &remaining {
                    if let Some(proc) = sys.process(*pid) {
                        proc.kill_with(Signal::Kill);
                    }
                }
                break;
            }
        }
    })
    .await
    .unwrap_or_else(|e| tracing::error!("kill_process_tree_graceful task panicked: {}", e));
}

#[cfg_attr(windows, path = "windows.rs")]
#[cfg_attr(not(windows), path = "unix.rs")]
mod platform;

pub use platform::ProcessKiller;
