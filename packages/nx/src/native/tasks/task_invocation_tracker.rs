use crate::native::db::connection::NxDbConnection;
use napi::bindgen_prelude::External;
use rusqlite::params;
use std::sync::{Arc, Mutex};
use tracing::debug;

pub const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS task_invocations (
    root_pid INTEGER NOT NULL,
    parent_pid INTEGER NOT NULL,
    task_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (root_pid, task_id)
);";

#[napi(object)]
#[derive(Clone, Debug)]
pub struct InvocationRecord {
    pub parent_pid: u32,
    pub task_id: String,
}

#[napi]
pub struct TaskInvocationTracker {
    db: Arc<Mutex<NxDbConnection>>,
    root_pid: u32,
}

#[napi]
impl TaskInvocationTracker {
    #[napi(constructor)]
    pub fn new(
        #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db: &External<
            Arc<Mutex<NxDbConnection>>,
        >,
        root_pid: u32,
    ) -> anyhow::Result<Self> {
        Ok(Self {
            db: Arc::clone(db),
            root_pid,
        })
    }

    /// Register a task as invoked. Throws if the task was already registered (loop detected).
    #[napi]
    pub fn register_task(&self, parent_pid: u32, task_id: String) -> anyhow::Result<()> {
        self.db.lock().unwrap().execute(
            "INSERT INTO task_invocations (root_pid, parent_pid, task_id) VALUES (?1, ?2, ?3)",
            params![self.root_pid, parent_pid, task_id],
        )?;
        debug!(
            "Registered task invocation: root_pid={}, parent_pid={}, task_id={}",
            self.root_pid, parent_pid, &task_id
        );
        Ok(())
    }

    /// Remove a task invocation record after task completes.
    #[napi]
    pub fn unregister_task(&self, task_id: String) -> anyhow::Result<()> {
        self.db.lock().unwrap().execute(
            "DELETE FROM task_invocations WHERE root_pid = ?1 AND task_id = ?2",
            params![self.root_pid, task_id],
        )?;
        debug!(
            "Unregistered task invocation: root_pid={}, task_id={}",
            self.root_pid, &task_id
        );
        Ok(())
    }

    /// Get all invocations for this root_pid, ordered by creation time.
    #[napi]
    pub fn get_invocation_chain(&self) -> anyhow::Result<Vec<InvocationRecord>> {
        let db = self.db.lock().unwrap();
        let mut stmt = db.prepare(
            "SELECT parent_pid, task_id FROM task_invocations WHERE root_pid = ?1 ORDER BY created_at ASC",
        )?;
        let records = stmt
            .query_map(params![self.root_pid], |row| {
                Ok(InvocationRecord {
                    parent_pid: row.get(0)?,
                    task_id: row.get(1)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(records)
    }

    /// Clean up stale invocations older than 1 day (handles PID recycling).
    #[napi]
    pub fn cleanup_stale(&self) -> anyhow::Result<()> {
        let deleted = self.db.lock().unwrap().execute(
            "DELETE FROM task_invocations WHERE created_at < datetime('now', '-1 day')",
            [],
        )?;
        if deleted > 0 {
            debug!("Cleaned up {} stale invocation records", deleted);
        }
        Ok(())
    }
}
