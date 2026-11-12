use super::{collect_process_tree, kill_process_tree_internal};
use nix::sys::signal::{Signal, kill, killpg};
use nix::unistd::{Pid, getpgid};
use std::time::Instant;
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};
use tracing::debug;

pub struct ProcessKiller {
    pid: i32,
}

impl ProcessKiller {
    pub fn new(pid: i32) -> Self {
        Self { pid }
    }

    pub fn get_pid(&self) -> i32 {
        self.pid
    }

    pub fn kill(&self, signal: Option<&'static str>) {
        kill_process_tree_internal(self.pid, signal);
    }
}

/// SIGKILL every process in the group `pgid`. A process that moved to another
/// group or session is out of reach.
///
/// `pgid` must be a group leader the caller has not reaped: its pid stays taken
/// until then, so the signal cannot reach a group that reused it. macOS can miss
/// a child being forked, so there the kill repeats until confirmed or
/// `deadline`. Elsewhere it is only sent: Linux and FreeBSD 13.3+ deliver a
/// group signal to every member, a child being forked included.
fn kill_process_group(pgid: Pid, deadline: Instant) {
    #[cfg(target_os = "macos")]
    let outcome = kill_until_exited(pgid, deadline);
    #[cfg(not(target_os = "macos"))]
    let outcome = {
        let _ = deadline;
        killpg(pgid, Signal::SIGKILL).map(|()| "sent")
    };
    debug!("Killed process group {}: {:?}", pgid, outcome);
}

/// `kill_process_group`, then SIGKILL each process under the leader that was
/// outside the group. Those come from one snapshot taken first, while they are
/// still the leader's descendants, so one that leaves the group after it escapes.
pub(crate) fn kill_process_group_and_strays(pgid: i32, deadline: Instant) {
    let group = Pid::from_raw(pgid);
    let mut sys = System::new();
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().without_tasks(),
    );
    let (tree, _) = collect_process_tree(&sys, pgid);
    // Picked before the group kill: a member it kills can be reaped and its pid
    // reused before the loop below
    let strays: Vec<Pid> = tree
        .into_iter()
        .map(|pid| Pid::from_raw(pid.as_u32() as i32))
        .filter(|&pid| getpgid(Some(pid)).is_ok_and(|its_group| its_group != group))
        .collect();
    kill_process_group(group, deadline);
    // Parents first, so a parent already has its SIGKILL when its child dies
    for pid in strays {
        let _ = kill(pid, Signal::SIGKILL);
    }
}

/// Kills the group until the kill fails twice in a row. XNU lists the members
/// that have not exited, then signals each, and answers EPERM if it signalled
/// none. A child forked after the listing is missed, and when every listed
/// member is reaped before its signal, that kill fails while the child lives;
/// the next kill finds it.
#[cfg(target_os = "macos")]
fn kill_until_exited(pgid: Pid, deadline: Instant) -> Result<&'static str, nix::errno::Errno> {
    use nix::errno::Errno;

    let mut failed_before = false;
    loop {
        match killpg(pgid, Signal::SIGKILL) {
            Ok(()) => failed_before = false,
            Err(Errno::EPERM | Errno::ESRCH) if failed_before => return Ok("confirmed"),
            Err(Errno::EPERM | Errno::ESRCH) => {
                failed_before = true;
                continue;
            }
            Err(errno) => return Err(errno),
        }
        if Instant::now() >= deadline {
            return Ok("unconfirmed");
        }
        std::thread::sleep(std::time::Duration::from_millis(1));
    }
}
