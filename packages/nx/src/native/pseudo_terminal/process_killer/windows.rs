use std::ptr::null_mut;

use winapi::shared::minwindef::DWORD;
use winapi::shared::ntdef::HANDLE;
use winapi::um::processthreadsapi::{OpenProcess, TerminateProcess};
use winapi::um::winnt::{PROCESS_QUERY_INFORMATION, PROCESS_TERMINATE};

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

    // windows doesn't have different signals to kill with
    pub fn kill(&self, _: Option<&str>) -> anyhow::Result<()> {
        let pc = WinProcess::open(self.pid as DWORD).expect("!open");
        pc.kill()
            .map_err(|e| anyhow::anyhow!("Failed to kill process {}: {}", self.pid, e))?;
        Ok(())
    }
}

struct WinProcess(HANDLE);
impl WinProcess {
    fn open(pid: DWORD) -> anyhow::Result<WinProcess> {
        // https://msdn.microsoft.com/en-us/library/windows/desktop/ms684320%28v=vs.85%29.aspx
        let pc = unsafe { OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_TERMINATE, 0, pid) };
        if pc == null_mut() {
            anyhow::bail!("Failed to open process with pid {}", pid)
        } else {
            Ok(WinProcess(pc))
        }
    }

    fn kill(self) -> Result<(), String> {
        unsafe { TerminateProcess(self.0, 1) };
        Ok(())
    }
}
impl Drop for WinProcess {
    fn drop(&mut self) {
        unsafe { winapi::um::handleapi::CloseHandle(self.0) };
    }
}
