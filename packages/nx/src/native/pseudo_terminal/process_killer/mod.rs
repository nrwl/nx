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

/// Kill a process and all its descendants.
///
/// This function:
/// 1. Takes an atomic snapshot of all system processes
/// 2. Builds a parent->children map
/// 3. Collects all descendants via BFS
/// 4. Kills processes in reverse order (leaves first, then parents)
///
/// This is a best-effort operation that never fails or panics.
/// Processes that have already exited or can't be signaled are silently skipped.
pub(crate) fn kill_process_tree_internal(root_pid: i32, signal: Option<&str>) {
    let mapped_signal = map_signal(signal);
    let mut sys = System::new();

    // Minimal refresh - only need parent-child relationships
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,                          // not too relevant, sys is fresh anyway
        ProcessRefreshKind::nothing(), // skip CPU, memory, disk stats
    );

    // Build parent -> children map
    let mut children: HashMap<Pid, Vec<Pid>> = HashMap::with_capacity(sys.processes().len() / 4);
    for (pid, proc) in sys.processes() {
        // Skip threads (on Linux, threads appear as processes but we only want to kill processes)
        if proc.thread_kind().is_some() {
            continue;
        }
        if let Some(parent) = proc.parent() {
            children.entry(parent).or_default().push(*pid);
        }
    }

    let root = Pid::from(root_pid as usize);

    // Only proceed if root process exists
    if sys.process(root).is_none() {
        debug!("Root process {} is not found in the system", root_pid);
        return;
    }

    // BFS to collect all descendants
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

    debug!(
        "Killing {} processes with signal {}",
        to_kill.len(),
        mapped_signal
    );

    // Kill in reverse order: leaves first, then parents
    for pid in to_kill.into_iter().rev() {
        if let Some(proc) = sys.process(pid) {
            match proc.kill_with(mapped_signal) {
                Some(true) => {} // Signal sent successfully
                Some(false) => {
                    debug!(
                        "Failed to send signal {} to process {}: process already exited or insufficient permissions",
                        mapped_signal, pid
                    );
                }
                None => {
                    debug!(
                        "Failed to send signal {} to process {}: signal not supported on this platform. This should never happen.",
                        mapped_signal, pid
                    );
                }
            }
        }
    }
}

#[cfg_attr(windows, path = "windows.rs")]
#[cfg_attr(not(windows), path = "unix.rs")]
mod platform;

pub use platform::ProcessKiller;
