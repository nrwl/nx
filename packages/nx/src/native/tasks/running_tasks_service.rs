use crate::native::db::connection::NxDbConnection;
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

pub const READINESS_SCHEMA: &str = "CREATE TABLE IF NOT EXISTS running_task_readiness (
    task_id TEXT PRIMARY KEY NOT NULL,
    status INTEGER NOT NULL,
    url TEXT
);";

/// Adds `url` to a db made before it, which keeps its file name since the
/// column is additive. Older Nx processes sharing the db only touch `task_id`
/// and `status`, and their `INSERT OR REPLACE` leaves `url` empty. Runs under
/// the db lock file, from `initialize_db`.
pub(crate) fn add_readiness_url_column(db: &NxDbConnection) -> anyhow::Result<()> {
    let has_url = db
        .query_row(
            "SELECT 1 FROM pragma_table_info('running_task_readiness') WHERE name = 'url'",
            [],
            |row| row.get::<_, i64>(0),
        )?
        .is_some();
    if !has_url {
        db.execute("ALTER TABLE running_task_readiness ADD COLUMN url TEXT", [])?;
    }
    Ok(())
}

// A db whose `url` column couldn't be added still records readiness
fn is_missing_url_column(e: &anyhow::Error) -> bool {
    e.to_string().contains("no such column: url")
}

#[napi]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskReadiness {
    Pending,
    Ready,
    Failed,
}

impl TaskReadiness {
    fn from_db(value: i64) -> anyhow::Result<Self> {
        match value {
            0 => Ok(Self::Pending),
            1 => Ok(Self::Ready),
            2 => Ok(Self::Failed),
            other => anyhow::bail!("Unknown task readiness status {}", other),
        }
    }
}

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
        if let Some((pid, db_process_command, db_process_cwd)) = self.db.lock().unwrap().query_row(
            "SELECT pid, command, cwd FROM running_tasks WHERE task_id = ?",
            [task_id],
            |row| {
                let pid: u32 = row.get(0)?;
                let command: String = row.get(1)?;
                let cwd: String = row.get(2)?;

                Ok((pid, command, cwd))
            },
        )? {
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
        // Same transaction so a reader never sees a live row with stale readiness
        self.db.lock().unwrap().transaction(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO running_tasks (task_id, pid, command, cwd) VALUES (?, ?, ?, ?)",
                [&task_id, &pid.to_string(), &command_str, &cwd],
            )?;
            conn.execute(
                "INSERT OR REPLACE INTO running_task_readiness (task_id, status) VALUES (?, ?)",
                (&task_id, TaskReadiness::Pending as i64),
            )?;
            Ok(())
        })?;
        debug!("Added {} to running tasks", &task_id);
        self.added_tasks.insert(task_id);
        Ok(())
    }

    /// Release this process's claim on a task and its readiness. A row another
    /// process has since taken over is left in place.
    #[napi]
    pub fn remove_running_task(&self, task_id: String) -> anyhow::Result<()> {
        self.db.lock().unwrap().transaction(|conn| {
            let released = conn.execute(
                "DELETE FROM running_tasks WHERE task_id = ? AND pid = ?",
                [&task_id, &std::process::id().to_string()],
            )?;
            if released > 0 {
                conn.execute(
                    "DELETE FROM running_task_readiness WHERE task_id = ?",
                    [&task_id],
                )?;
            }
            Ok(())
        })?;
        debug!("Removed {} from running tasks", task_id);
        Ok(())
    }

    /// No-op unless this process holds the task's claim, so a late or displaced
    /// probe result cannot overwrite the current owner's verdict. `url` is the
    /// address the task reported, written with its status so a reader never
    /// sees one without the other.
    #[napi]
    pub fn set_task_readiness(
        &self,
        task_id: String,
        status: TaskReadiness,
        url: Option<String>,
    ) -> anyhow::Result<()> {
        let db = self.db.lock().unwrap();
        let pid = std::process::id().to_string();
        let updated = db.execute(
            "UPDATE running_task_readiness SET status = ?, url = ? WHERE task_id = ? AND task_id IN \
             (SELECT task_id FROM running_tasks WHERE task_id = ? AND pid = ?)",
            (status as i64, &url, &task_id, &task_id, &pid),
        );
        match updated {
            Err(e) if is_missing_url_column(&e) => {
                db.execute(
                    "UPDATE running_task_readiness SET status = ? WHERE task_id = ? AND task_id IN \
                     (SELECT task_id FROM running_tasks WHERE task_id = ? AND pid = ?)",
                    (status as i64, &task_id, &task_id, &pid),
                )?;
            }
            other => {
                other?;
            }
        }
        debug!("Set readiness of {} to {:?}", task_id, status);
        Ok(())
    }

    /// `None` when the task is not running.
    #[napi]
    pub fn get_task_readiness(&self, task_id: String) -> anyhow::Result<Option<TaskReadiness>> {
        if !self.is_task_running(&task_id)? {
            return Ok(None);
        }
        let status = self.db.lock().unwrap().query_row(
            "SELECT status FROM running_task_readiness WHERE task_id = ?",
            [&task_id],
            |row| row.get::<_, i64>(0),
        )?;
        status.map(TaskReadiness::from_db).transpose()
    }

    /// The address a running task reported with its readiness, if any.
    #[napi]
    pub fn get_task_ready_url(&self, task_id: String) -> anyhow::Result<Option<String>> {
        if !self.is_task_running(&task_id)? {
            return Ok(None);
        }
        match self.db.lock().unwrap().query_row(
            "SELECT url FROM running_task_readiness WHERE task_id = ?",
            [&task_id],
            |row| row.get::<_, Option<String>>(0),
        ) {
            Ok(url) => Ok(url.flatten()),
            Err(e) if is_missing_url_column(&e) => Ok(None),
            Err(e) => Err(e),
        }
    }
}

impl Drop for RunningTasksService {
    fn drop(&mut self) {
        // Release this service's claims on a normal teardown. A SIGKILL runs no
        // destructor, so those rows are left for `is_task_running` to reject and
        // the stale sweep to clear.
        for task_id in self.added_tasks.iter() {
            self.remove_running_task(task_id.clone()).ok();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::db::initialize::initialize_db;
    use std::env::args_os;
    use std::ffi::OsString;

    #[test]
    fn readiness_is_visible_through_another_connection() {
        let temp_dir = tempfile::tempdir().unwrap();
        let path = temp_dir.path().join("test.db");
        let mut owner = RunningTasksService::new(&External::new(Arc::new(Mutex::new(
            initialize_db(&path).unwrap(),
        ))))
        .unwrap();
        let reader = RunningTasksService::new(&External::new(Arc::new(Mutex::new(
            initialize_db(&path).unwrap(),
        ))))
        .unwrap();
        let id = "app:serve".to_string();

        assert_eq!(reader.get_task_readiness(id.clone()).unwrap(), None);
        owner.add_running_task(id.clone()).unwrap();
        assert_eq!(
            reader.get_task_readiness(id.clone()).unwrap(),
            Some(TaskReadiness::Pending)
        );
        owner
            .set_task_readiness(id.clone(), TaskReadiness::Ready, None)
            .unwrap();
        assert_eq!(
            reader.get_task_readiness(id.clone()).unwrap(),
            Some(TaskReadiness::Ready)
        );
        owner
            .set_task_readiness(id.clone(), TaskReadiness::Failed, None)
            .unwrap();
        assert_eq!(
            reader.get_task_readiness(id.clone()).unwrap(),
            Some(TaskReadiness::Failed)
        );
        // restart resets what the other connection sees
        owner.add_running_task(id.clone()).unwrap();
        assert_eq!(
            reader.get_task_readiness(id.clone()).unwrap(),
            Some(TaskReadiness::Pending)
        );
        owner.remove_running_task(id.clone()).unwrap();
        assert_eq!(reader.get_task_readiness(id.clone()).unwrap(), None);
    }

    #[test]
    fn ready_url_is_visible_through_another_connection_and_cleared_on_restart() {
        let temp_dir = tempfile::tempdir().unwrap();
        let path = temp_dir.path().join("test.db");
        let mut owner = RunningTasksService::new(&External::new(Arc::new(Mutex::new(
            initialize_db(&path).unwrap(),
        ))))
        .unwrap();
        let reader = RunningTasksService::new(&External::new(Arc::new(Mutex::new(
            initialize_db(&path).unwrap(),
        ))))
        .unwrap();
        let id = "app:serve".to_string();

        owner.add_running_task(id.clone()).unwrap();
        assert_eq!(reader.get_task_ready_url(id.clone()).unwrap(), None);
        owner
            .set_task_readiness(
                id.clone(),
                TaskReadiness::Ready,
                Some("http://localhost:4300/".into()),
            )
            .unwrap();
        assert_eq!(
            reader.get_task_ready_url(id.clone()).unwrap().as_deref(),
            Some("http://localhost:4300/")
        );
        owner.add_running_task(id.clone()).unwrap();
        assert_eq!(reader.get_task_ready_url(id.clone()).unwrap(), None);
        owner.remove_running_task(id.clone()).unwrap();
        assert_eq!(reader.get_task_ready_url(id).unwrap(), None);
    }

    #[test]
    fn adds_the_url_column_to_a_db_made_before_it() {
        let temp_dir = tempfile::tempdir().unwrap();
        let path = temp_dir.path().join("old.db");
        // The readiness table as an older Nx created it
        initialize_db(&path)
            .unwrap()
            .execute_batch(
                "DROP TABLE running_task_readiness; \
                 CREATE TABLE running_task_readiness (task_id TEXT PRIMARY KEY NOT NULL, status INTEGER NOT NULL);",
            )
            .unwrap();
        // Opening the existing db adds the column, and opening it again finds it
        initialize_db(&path).unwrap();
        let db = External::new(Arc::new(Mutex::new(initialize_db(&path).unwrap())));
        let mut service = RunningTasksService::new(&db).unwrap();

        let id = "app:serve".to_string();
        service.add_running_task(id.clone()).unwrap();
        service
            .set_task_readiness(
                id.clone(),
                TaskReadiness::Ready,
                Some("http://localhost:4300/".into()),
            )
            .unwrap();
        assert_eq!(
            service.get_task_ready_url(id.clone()).unwrap().as_deref(),
            Some("http://localhost:4300/")
        );
        // An older Nx writes rows without the column, which reads as no url
        db.lock()
            .unwrap()
            .execute(
                "INSERT OR REPLACE INTO running_task_readiness (task_id, status) VALUES (?, ?)",
                (&id, TaskReadiness::Ready as i64),
            )
            .unwrap();
        assert_eq!(service.get_task_ready_url(id).unwrap(), None);
    }

    #[test]
    fn records_readiness_when_the_url_column_is_missing() {
        let temp_dir = tempfile::tempdir().unwrap();
        let path = temp_dir.path().join("no-url.db");
        // A db whose url column couldn't be added
        let conn = initialize_db(&path).unwrap();
        conn.execute_batch(
            "DROP TABLE running_task_readiness; \
             CREATE TABLE running_task_readiness (task_id TEXT PRIMARY KEY NOT NULL, status INTEGER NOT NULL);",
        )
        .unwrap();
        let mut service =
            RunningTasksService::new(&External::new(Arc::new(Mutex::new(conn)))).unwrap();
        let id = "app:serve".to_string();

        service.add_running_task(id.clone()).unwrap();
        service
            .set_task_readiness(
                id.clone(),
                TaskReadiness::Ready,
                Some("http://localhost:4300/".into()),
            )
            .unwrap();
        assert_eq!(
            service.get_task_readiness(id.clone()).unwrap(),
            Some(TaskReadiness::Ready)
        );
        assert_eq!(service.get_task_ready_url(id).unwrap(), None);
    }

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

    #[test]
    fn remove_leaves_a_claim_taken_over_by_another_process() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        conn.execute_batch(READINESS_SCHEMA).unwrap();
        let mut service = RunningTasksService {
            db: Arc::new(Mutex::new(NxDbConnection::new(conn))),
            added_tasks: Default::default(),
        };
        let claim_owner = |service: &RunningTasksService| {
            service
                .db
                .lock()
                .unwrap()
                .query_row(
                    "SELECT pid FROM running_tasks WHERE task_id = ?",
                    ["app:serve"],
                    |row| row.get::<_, u32>(0),
                )
                .unwrap()
        };

        let readiness_row = |service: &RunningTasksService| {
            service
                .db
                .lock()
                .unwrap()
                .query_row(
                    "SELECT status FROM running_task_readiness WHERE task_id = ?",
                    ["app:serve"],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap()
        };

        service.add_running_task("app:serve".into()).unwrap();
        let other_pid = std::process::id() + 1;
        service
            .db
            .lock()
            .unwrap()
            .execute(
                "UPDATE running_tasks SET pid = ? WHERE task_id = ?",
                [other_pid.to_string().as_str(), "app:serve"],
            )
            .unwrap();

        service
            .set_task_readiness("app:serve".into(), TaskReadiness::Ready, None)
            .unwrap();
        assert_eq!(readiness_row(&service), Some(TaskReadiness::Pending as i64));

        service.remove_running_task("app:serve".into()).unwrap();
        assert_eq!(claim_owner(&service), Some(other_pid));
        assert_eq!(readiness_row(&service), Some(TaskReadiness::Pending as i64));

        service.add_running_task("app:serve".into()).unwrap();
        service.remove_running_task("app:serve".into()).unwrap();
        assert_eq!(claim_owner(&service), None);
    }
}
