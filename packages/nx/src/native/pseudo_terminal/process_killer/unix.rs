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

    pub fn kill(&self, signal: Option<&str>) {
        kill_process_tree_internal(self.pid, signal);
    }
}
