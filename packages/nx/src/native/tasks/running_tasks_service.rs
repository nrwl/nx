use crate::native::db::connection::NxDbConnection;
use crate::native::utils::Normalize;
use hashbrown::HashSet;
use napi::bindgen_prelude::External;
use std::env::args_os;
use std::ffi::OsString;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tracing::debug;

#[napi]
struct RunningTasksService {
    db: External<NxDbConnection>,
    added_tasks: HashSet<String>,
}

#[napi]
impl RunningTasksService {
    #[napi(constructor)]
    pub fn new(db: External<NxDbConnection>) -> anyhow::Result<Self> {
        let s = Self {
            db,
            added_tasks: Default::default(),
        };

        s.setup()?;

        Ok(s)
    }

    #[napi]
    pub fn get_running_tasks(&mut self, ids: Vec<String>) -> anyhow::Result<Vec<String>> {
        let mut results = Vec::<String>::with_capacity(ids.len());
        for id in ids.into_iter() {
            if self.is_task_running(&id)? {
                results.push(id);
            }
        }
        Ok(results)
    }

    fn is_task_running(&self, task_id: &String) -> anyhow::Result<bool> {
        let mut stmt = self
            .db
            .prepare("SELECT pid, command, cwd FROM running_tasks WHERE task_id = ?")?;
        if let Ok((pid, db_process_command, db_process_cwd)) = stmt.query_row([task_id], |row| {
            let pid: u32 = row.get(0)?;
            let command: String = row.get(1)?;
            let cwd: String = row.get(2)?;

            Ok((pid, command, cwd))
        }) {
            debug!("Checking if {} exists", pid);

            let mut sys = System::new();
            sys.refresh_processes_specifics(
                ProcessesToUpdate::Some(&[Pid::from(pid as usize)]),
                true,
                ProcessRefreshKind::everything(),
            );

            match sys.process(sysinfo::Pid::from(pid as usize)) {
                Some(process_info) => {
                    let cmd = process_info.cmd().to_vec();
                    let cmd_str = cmd
                        .iter()
                        .map(|s| s.to_string_lossy().to_string())
                        .collect::<Vec<_>>()
                        .join(" ");

                    if let Some(cwd_path) = process_info.cwd() {
                        let cwd_str = cwd_path.to_normalized_string();
                        Ok(cmd_str == db_process_command && cwd_str == db_process_cwd)
                    } else {
                        Ok(cmd_str == db_process_command)
                    }
                }
                None => Ok(false),
            }
        } else {
            Ok(false)
        }
    }

    #[napi]
    pub fn add_running_task(&mut self, task_id: String) -> anyhow::Result<()> {
        let pid = std::process::id();
        let command = args_os().collect::<Vec<OsString>>();
        // Convert command vector to a string representation
        let command_str = command
            .iter()
            .map(|s| s.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(" ");

        let cwd = std::env::current_dir()
            .expect("The current working directory does not exist")
            .to_normalized_string();
        let mut stmt = self.db.prepare(
            "INSERT OR REPLACE INTO running_tasks (task_id, pid, command, cwd) VALUES (?, ?, ?, ?)",
        )?;
        stmt.execute([&task_id, &pid.to_string(), &command_str, &cwd])?;
        self.added_tasks.insert(task_id);
        Ok(())
    }

    #[napi]
    pub fn remove_running_task(&self, task_id: String) -> anyhow::Result<()> {
        let mut stmt = self
            .db
            .prepare("DELETE FROM running_tasks WHERE task_id = ?")?;
        stmt.execute([task_id])?;
        Ok(())
    }

    fn setup(&self) -> anyhow::Result<()> {
        self.db.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS running_tasks (
                task_id TEXT PRIMARY KEY NOT NULL,
                pid INTEGER NOT NULL,
                command TEXT NOT NULL,
                cwd TEXT NOT NULL
            );
            ",
        )?;
        Ok(())
    }
}

impl Drop for RunningTasksService {
    fn drop(&mut self) {
        // Remove tasks added by this service. This might happen if process exits because of SIGKILL
        for task_id in self.added_tasks.iter() {
            self.remove_running_task(task_id.clone()).ok();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::args_os;
    use std::ffi::OsString;

    #[test]
    fn test_add_task() {
        let pid = std::process::id();

        let mut sys = System::new();
        sys.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[Pid::from(pid as usize)]),
            true,
            ProcessRefreshKind::everything(),
        );
        if let Some(process_info) = sys.process(sysinfo::Pid::from(pid as usize)) {
            // Check if the process name contains "nx" or is related to nx
            // TODO: check is the process is actually the same process
            dbg!(process_info);
            dbg!("Process {} is running", pid);
            let cmd = process_info.cmd().to_vec();
            let command = args_os().collect::<Vec<OsString>>();
            assert_eq!(cmd, command);
        } else {
            dbg!("Process {} is not running", pid);
        }
    }
}
