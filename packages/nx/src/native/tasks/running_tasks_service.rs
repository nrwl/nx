use std::env::args;
use crate::native::db::connection::NxDbConnection;
use hashbrown::HashSet;
use napi::bindgen_prelude::External;
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
            if self.is_task_running_impl(&id)? {
                results.push(id);
            }
        }
        Ok(results)
    }

    pub fn is_task_running(&self, task_id: String) -> anyhow::Result<bool> {
        self.is_task_running_impl(&task_id)
    }

    fn is_task_running_impl(&self, task_id: &str) -> anyhow::Result<bool> {
        let mut stmt = self
            .db
            .prepare("SELECT pid FROM running_tasks WHERE task_id = ?")?;
        let pid: u32 = stmt.query_row([task_id], |row| row.get(0))?;
        debug!("Checking if {} should be running on {}", task_id, pid);

        let mut sys = System::new();
        sys.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[Pid::from(pid as usize)]),
            true,
            ProcessRefreshKind::everything(),
        );
        if let Some(process) = sys.process(sysinfo::Pid::from(pid as usize)) {
            // Check if the process name contains "nx" or is related to nx
            // TODO: check is the process is actually the same process
            Ok(true)
        } else {
        debug!("Process {} does not exist so {} is not running", pid, task_id);
            Ok(false)
        }
    }

    #[napi]
    pub fn add_running_task(&mut self, task_id: String) -> anyhow::Result<()> {
        let pid = std::process::id();
        let args = args();
        let mut stmt = self
            .db
            .prepare("INSERT INTO running_tasks (task_id, pid) VALUES (?, ?, ?)")?;
        stmt.execute([&task_id, &pid.to_string(), &args.into_iter().collect()])?;
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
                pid INTEGER NOT NULL
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
