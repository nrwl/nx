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

/// Convert a Node.js signal string to sysinfo::Signal with platform-appropriate mapping.
///
/// On Windows, all signals map to Kill (TerminateProcess) since Windows doesn't
/// have Unix-style signals for console applications.
fn map_signal(signal: Option<&str>) -> Signal {
    #[cfg(windows)]
    {
        // Windows only supports Kill (TerminateProcess)
        let _ = signal; // suppress unused warning
        Signal::Kill
    }

    #[cfg(not(windows))]
    {
        match signal {
            Some("SIGKILL") => Signal::Kill,
            Some("SIGTERM") | None => Signal::Term,
            Some("SIGINT") => Signal::Interrupt,
            Some("SIGQUIT") => Signal::Quit,
            Some("SIGHUP") => Signal::Hangup,
            _ => Signal::Term,
        }
    }
}

/// Kill a process and all its descendants.
#[napi(ts_args_type = "rootPid: number, signal?: string | number | undefined | null")]
pub fn kill_process_tree(root_pid: i32, signal: Option<Either<String, i32>>) {
    let signal_str = normalize_signal(signal.as_ref());
    kill_process_tree_internal(root_pid, signal_str);
}

/// Collect all PIDs in the process tree rooted at `root_pid` via BFS.
///
/// Returns the list in BFS order (root first, leaves last).
fn collect_process_tree(sys: &System, root_pid: i32) -> Vec<Pid> {
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

    let root = Pid::from(root_pid as usize);
    if sys.process(root).is_none() {
        debug!("Root process {} not found", root_pid);
        return Vec::new();
    }

    let mut to_kill = Vec::new();
    let mut queue = VecDeque::new();
    let mut visited = HashSet::new();
    queue.push_back(root);
    visited.insert(root);

    while let Some(pid) = queue.pop_front() {
        to_kill.push(pid);
        if let Some(kids) = children.get(&pid) {
            for &kid in kids {
                if visited.insert(kid) {
                    queue.push_back(kid);
                }
            }
        }
    }

    to_kill
}

/// Send a signal to PIDs in reverse order (leaves first, then parents).
fn send_signal_to_pids(sys: &System, pids: &[Pid], signal: Signal) {
    for pid in pids.iter().rev() {
        if let Some(proc_info) = sys.process(*pid) {
            match proc_info.kill_with(signal) {
                Some(true) => {
                    debug!("Sent {} to process {}", signal, pid);
                }
                Some(false) => {
                    debug!(
                        "Process {} already exited or insufficient permissions",
                        pid
                    );
                }
                None => {
                    debug!(
                        "Signal {} not supported for process {}",
                        signal, pid
                    );
                }
            }
        }
    }
}

/// Check which PIDs from the list are still alive.
fn get_alive_pids(pids: &[Pid]) -> Vec<Pid> {
    let mut sys = System::new();
    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(pids),
        true,
        ProcessRefreshKind::nothing(),
    );
    pids.iter()
        .filter(|pid| sys.process(**pid).is_some())
        .copied()
        .collect()
}

/// Snapshot all processes and signal the tree. Returns targeted PIDs.
fn snapshot_and_signal(root_pid: i32, signal: Signal) -> Vec<Pid> {
    let mut sys = System::new();
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing(),
    );

    let to_kill = collect_process_tree(&sys, root_pid);
    if to_kill.is_empty() {
        return Vec::new();
    }

    debug!(
        "Sending {} to {} processes (root: {})",
        signal,
        to_kill.len(),
        root_pid
    );
    send_signal_to_pids(&sys, &to_kill, signal);
    to_kill
}

/// Internal implementation shared by ProcessKiller and the napi fire-and-forget function.
pub(crate) fn kill_process_tree_internal(root_pid: i32, signal: Option<&str>) {
    snapshot_and_signal(root_pid, map_signal(signal));
}

/// Kill a process and all its descendants (fire-and-forget).
///
/// Sends the requested signal to all processes in the tree but does NOT
/// Kill a process tree gracefully: signal → wait → SIGKILL.
///
/// 1. Sends the requested signal (default SIGTERM) to all descendants
/// 2. Polls every 100ms, waiting up to `grace_period_ms` (default 5000) for exit
/// 3. Force-kills any survivors with SIGKILL
///
/// Returns a Promise (runs on a background thread via tokio so it doesn't
/// block the Node.js event loop).
#[napi]
pub async fn kill_process_tree_graceful(
    root_pid: i32,
    signal: Option<String>,
    grace_period_ms: Option<u32>,
) {
    let grace_ms = grace_period_ms.unwrap_or(5000);
    let signal_clone = signal;

    tokio::task::spawn_blocking(move || {
        let mapped = map_signal(signal_clone.as_deref());
        let to_kill = snapshot_and_signal(root_pid, mapped);

        if to_kill.is_empty() || mapped == Signal::Kill {
            return;
        }

        let poll = std::time::Duration::from_millis(100);
        let deadline = std::time::Duration::from_millis(grace_ms as u64);
        let start = std::time::Instant::now();

        loop {
            std::thread::sleep(poll);

            let alive = get_alive_pids(&to_kill);
            if alive.is_empty() {
                debug!(
                    "All processes exited gracefully after {}ms",
                    start.elapsed().as_millis()
                );
                return;
            }
            if start.elapsed() >= deadline {
                debug!(
                    "Grace period expired after {}ms. Force killing {} remaining processes",
                    start.elapsed().as_millis(),
                    alive.len()
                );
                let mut sys = System::new();
                sys.refresh_processes_specifics(
                    ProcessesToUpdate::Some(&alive),
                    true,
                    ProcessRefreshKind::nothing(),
                );
                send_signal_to_pids(&sys, &alive, Signal::Kill);
                return;
            }
        }
    })
    .await
    .ok();
}

#[cfg_attr(windows, path = "windows.rs")]
#[cfg_attr(not(windows), path = "unix.rs")]
mod platform;

pub use platform::ProcessKiller;
