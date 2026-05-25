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
    /// On Windows, sysinfo only supports Signal::Kill (TerminateProcess).
    /// Unsupported signals automatically fall back to SIGKILL.
    pub fn kill(&self, signal: Option<&'static str>) {
        kill_process_tree_internal(self.pid, signal);
    }
}
