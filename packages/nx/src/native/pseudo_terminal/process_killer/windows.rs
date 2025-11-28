use super::kill_process_tree_internal;

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

    /// Kill the process tree rooted at this process.
    ///
    /// On Windows, the signal parameter is ignored - all signals map to
    /// TerminateProcess via sysinfo's Signal::Kill.
    pub fn kill(&self, signal: Option<&str>) {
        kill_process_tree_internal(self.pid, signal);
    }
}
