use crate::native::db::connection::{DbValue, NxDbConnection};
use crate::native::utils::Normalize;
use hashbrown::HashSet;
use napi::bindgen_prelude::External;
use std::env::args_os;
use std::ffi::OsString;
use std::sync::{Arc, Mutex};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tracing::debug;

pub const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS running_tasks (
    task_id TEXT PRIMARY KEY NOT NULL,
    pid INTEGER NOT NULL,
    command TEXT NOT NULL,
    cwd TEXT NOT NULL
);";

#[napi]
struct RunningTasksService {
    db: Arc<Mutex<NxDbConnection>>,
    added_tasks: HashSet<String>,
}

#[napi]
impl RunningTasksService {
    #[napi(constructor)]
    pub fn new(
        #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db: &External<
            Arc<Mutex<NxDbConnection>>,
        >,
    ) -> anyhow::Result<Self> {
        Ok(Self {
            db: Arc::clone(db),
            added_tasks: Default::default(),
        })
    }

    #[napi]
    pub fn get_running_tasks(&mut self, ids: Vec<String>) -> anyhow::Result<Vec<String>> {
        let mut results = Vec::<String>::with_capacity(ids.len());
        for id in ids.into_iter() {
            if self.is_task_running(&id)? {
                debug!("Task {} is running", &id);
                results.push(id);
            } else {
                debug!("Task {} is not running", id);
            }
        }
        Ok(results)
    }

    fn is_task_running(&self, task_id: &String) -> anyhow::Result<bool> {
        let row = self.db.lock().unwrap().query_row(
            "SELECT pid, command, cwd FROM running_tasks WHERE task_id = ?",
            &[DbValue::from(task_id.as_str())],
        )?;

        if let Some(row) = row {
            let pid = row.get_i64(0)? as u32;
            let db_process_command = row.get_str(1)?;
            let db_process_cwd = row.get_str(2)?;

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
        self.db.lock().unwrap().execute(
            "INSERT OR REPLACE INTO running_tasks (task_id, pid, command, cwd) VALUES (?1, ?2, ?3, ?4)",
            &[
                DbValue::from(task_id.as_str()),
                DbValue::from(pid.to_string().as_str()),
                DbValue::from(command_str.as_str()),
                DbValue::from(cwd.as_str()),
            ],
        )?;
        debug!("Added {} to running tasks", &task_id);
        self.added_tasks.insert(task_id);
        Ok(())
    }

    #[napi]
    pub fn remove_running_task(&self, task_id: String) -> anyhow::Result<()> {
        self.db
            .lock()
            .unwrap()
            .execute(
                "DELETE FROM running_tasks WHERE task_id = ?",
                &[DbValue::from(task_id.as_str())],
            )?;
        debug!("Removed {} from running tasks", task_id);
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
