use crate::native::db::connection::NxDbConnection;
use napi::bindgen_prelude::External;
use rusqlite::params;
use std::sync::{Arc, Mutex};
use tracing::debug;

pub const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS task_invocations (
    root_pid INTEGER NOT NULL,
    pid INTEGER NOT NULL,
    task_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (root_pid, pid, task_id)
);";

#[napi(object)]
#[derive(Clone, Debug)]
pub struct InvocationRecord {
    pub pid: u32,
    pub task_id: String,
}

/// Tracks which tasks each Nx process in a nested process tree is running, so
/// that a task which re-invokes itself can be reported instead of looping
/// forever.
///
/// Every process in the tree shares a `root_pid`, but sharing a root does not
/// imply a parent/child relationship: sibling Nx processes are common and
/// legitimate (N atomized e2e specs each spawning the same `serve-static` web
/// server, or two parallel tasks that each shell out to `nx run lib:build`).
/// Only an invocation belonging to an actual *ancestor* of this process is a
/// loop, so the check is scoped to `ancestor_pids` rather than to the whole
/// tree.
#[napi]
pub struct TaskInvocationTracker {
    db: Arc<Mutex<NxDbConnection>>,
    root_pid: u32,
    /// Pids of the ancestor Nx processes, outermost first. Does not include
    /// this process.
    ancestor_pids: Vec<u32>,
}

#[napi]
impl TaskInvocationTracker {
    #[napi(constructor)]
    pub fn new(
        #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db: &External<
            Arc<Mutex<NxDbConnection>>,
        >,
        root_pid: u32,
        ancestor_pids: Vec<u32>,
    ) -> anyhow::Result<Self> {
        Ok(Self {
            db: Arc::clone(db),
            root_pid,
            ancestor_pids,
        })
    }

    /// Register a task as invoked by the process identified by `pid`.
    ///
    /// Returns `Some(chain)` when an ancestor process is already running this
    /// task — a genuine loop — where `chain` is every task invoked along the
    /// ancestry path, outermost first. Returns `None` when the task was
    /// registered successfully, including when a *sibling* process is already
    /// running it.
    #[napi]
    pub fn register_task(
        &self,
        pid: u32,
        task_id: String,
    ) -> anyhow::Result<Option<Vec<InvocationRecord>>> {
        if !self.ancestor_pids.is_empty() {
            // One read: the chain is rendered from the same snapshot the loop
            // check ran against, so an ancestor unregistering in between
            // cannot leave the reported chain empty.
            let records = self.invocations_for_root()?;
            if records
                .iter()
                .any(|record| record.task_id == task_id && self.ancestor_pids.contains(&record.pid))
            {
                debug!(
                    "Loop detected: task {} is already running in an ancestor of pid {}",
                    &task_id, pid
                );
                return Ok(Some(self.ancestor_invocation_chain(&records)));
            }
        }

        // A sibling may already hold this task id, so re-registering is not an
        // error; the primary key includes the pid to keep the rows distinct.
        self.db.lock().unwrap().execute(
            "INSERT OR REPLACE INTO task_invocations (root_pid, pid, task_id) VALUES (?1, ?2, ?3)",
            params![self.root_pid, pid, task_id],
        )?;
        debug!(
            "Registered task invocation: root_pid={}, pid={}, task_id={}",
            self.root_pid, pid, &task_id
        );
        Ok(None)
    }

    /// Remove a task invocation record after the task completes. Scoped to the
    /// registering process so that a sibling finishing the same task does not
    /// drop this process's record.
    #[napi]
    pub fn unregister_task(&self, pid: u32, task_id: String) -> anyhow::Result<()> {
        self.db.lock().unwrap().execute(
            "DELETE FROM task_invocations WHERE root_pid = ?1 AND pid = ?2 AND task_id = ?3",
            params![self.root_pid, pid, task_id],
        )?;
        debug!(
            "Unregistered task invocation: root_pid={}, pid={}, task_id={}",
            self.root_pid, pid, &task_id
        );
        Ok(())
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

    /// Every task invoked along this process's ancestry path, outermost
    /// ancestor first. Ordering comes from the ancestry itself rather than
    /// from `created_at`, whose one-second granularity cannot order rows
    /// written within the same second.
    fn ancestor_invocation_chain(&self, records: &[InvocationRecord]) -> Vec<InvocationRecord> {
        let mut chain = Vec::new();
        for ancestor_pid in &self.ancestor_pids {
            for record in records {
                if record.pid == *ancestor_pid {
                    chain.push(record.clone());
                }
            }
        }
        chain
    }

    fn invocations_for_root(&self) -> anyhow::Result<Vec<InvocationRecord>> {
        let db = self.db.lock().unwrap();
        let mut stmt = db.prepare(
            "SELECT pid, task_id FROM task_invocations WHERE root_pid = ?1 ORDER BY created_at ASC",
        )?;
        let records = stmt
            .query_map(params![self.root_pid], |row| {
                Ok(InvocationRecord {
                    pid: row.get(0)?,
                    task_id: row.get(1)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(records)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::db::connection::NxDbConnection;
    use rusqlite::Connection;

    const ROOT_PID: u32 = 100;

    fn tracker(db: &Arc<Mutex<NxDbConnection>>, ancestor_pids: Vec<u32>) -> TaskInvocationTracker {
        TaskInvocationTracker {
            db: Arc::clone(db),
            root_pid: ROOT_PID,
            ancestor_pids,
        }
    }

    fn in_memory_db() -> Arc<Mutex<NxDbConnection>> {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA).unwrap();
        Arc::new(Mutex::new(NxDbConnection::new(conn)))
    }

    #[test]
    fn allows_sibling_processes_to_run_the_same_task() {
        let db = in_memory_db();
        // Two children of the root. Neither is an ancestor of the other.
        let sibling_a = tracker(&db, vec![ROOT_PID]);
        let sibling_b = tracker(&db, vec![ROOT_PID]);

        assert!(
            sibling_a
                .register_task(200, "app-e2e:serve-static".into())
                .unwrap()
                .is_none()
        );
        assert!(
            sibling_b
                .register_task(300, "app-e2e:serve-static".into())
                .unwrap()
                .is_none(),
            "a sibling running the same task is not a loop"
        );
    }

    #[test]
    fn reports_a_loop_when_an_ancestor_is_running_the_task() {
        let db = in_memory_db();
        let root = tracker(&db, vec![]);
        let child = tracker(&db, vec![ROOT_PID]);

        root.register_task(ROOT_PID, "app-e2e:serve-static".into())
            .unwrap();
        let chain = child
            .register_task(200, "app-e2e:serve-static".into())
            .unwrap()
            .expect("re-invoking an ancestor's task is a loop");

        assert_eq!(chain.len(), 1);
        assert_eq!(chain[0].task_id, "app-e2e:serve-static");
        assert_eq!(chain[0].pid, ROOT_PID);
    }

    #[test]
    fn reports_a_loop_through_an_intermediate_process() {
        let db = in_memory_db();
        let root = tracker(&db, vec![]);
        let middle = tracker(&db, vec![ROOT_PID]);
        let leaf = tracker(&db, vec![ROOT_PID, 200]);

        root.register_task(ROOT_PID, "app-e2e:e2e-ci--a.cy.ts".into())
            .unwrap();
        middle
            .register_task(200, "app-e2e:serve-static".into())
            .unwrap();
        let chain = leaf
            .register_task(300, "app-e2e:serve-static".into())
            .unwrap()
            .expect("the grandparent chain re-invokes serve-static");

        // Outermost ancestor first, so the rendered chain reads root -> leaf.
        let rendered: Vec<&str> = chain.iter().map(|r| r.task_id.as_str()).collect();
        assert_eq!(
            rendered,
            vec!["app-e2e:e2e-ci--a.cy.ts", "app-e2e:serve-static"]
        );
    }

    #[test]
    fn chain_order_follows_ancestry_not_created_at() {
        let db = in_memory_db();
        let root = tracker(&db, vec![]);
        let middle = tracker(&db, vec![ROOT_PID]);
        let leaf = tracker(&db, vec![ROOT_PID, 200]);

        root.register_task(ROOT_PID, "root:task".into()).unwrap();
        middle.register_task(200, "mid:task".into()).unwrap();
        // Make the root's row the newest, so created_at ordering would invert
        // the chain.
        db.lock()
            .unwrap()
            .execute(
                "UPDATE task_invocations SET created_at = datetime('now', '+1 hour') WHERE pid = ?1",
                params![ROOT_PID],
            )
            .unwrap();

        let chain = leaf
            .register_task(300, "mid:task".into())
            .unwrap()
            .expect("re-invoking an ancestor's task is a loop");

        let rendered: Vec<&str> = chain.iter().map(|r| r.task_id.as_str()).collect();
        assert_eq!(rendered, vec!["root:task", "mid:task"]);
    }

    #[test]
    fn unregistering_does_not_drop_a_sibling_record() {
        let db = in_memory_db();
        let sibling_a = tracker(&db, vec![ROOT_PID]);
        let sibling_b = tracker(&db, vec![ROOT_PID]);
        let child_of_b = tracker(&db, vec![ROOT_PID, 300]);

        sibling_a
            .register_task(200, "app-e2e:serve-static".into())
            .unwrap();
        sibling_b
            .register_task(300, "app-e2e:serve-static".into())
            .unwrap();
        sibling_a
            .unregister_task(200, "app-e2e:serve-static".into())
            .unwrap();

        assert!(
            child_of_b
                .register_task(400, "app-e2e:serve-static".into())
                .unwrap()
                .is_some(),
            "sibling A's cleanup must not erase sibling B's invocation"
        );
    }

    #[test]
    fn a_task_can_be_re_registered_after_it_completes() {
        let db = in_memory_db();
        let root = tracker(&db, vec![]);
        let child = tracker(&db, vec![ROOT_PID]);

        root.register_task(ROOT_PID, "app-e2e:build".into())
            .unwrap();
        root.unregister_task(ROOT_PID, "app-e2e:build".into())
            .unwrap();

        assert!(
            child
                .register_task(200, "app-e2e:build".into())
                .unwrap()
                .is_none()
        );
    }
}
