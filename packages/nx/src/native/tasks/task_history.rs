use crate::native::db::connection::{DbValue, NxDbConnection};
use crate::native::tasks::types::TaskTarget;
use napi::bindgen_prelude::External;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tracing::trace;

pub const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS task_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    hash TEXT NOT NULL,
    status TEXT NOT NULL,
    code INTEGER NOT NULL,
    start TIMESTAMP NOT NULL,
    end TIMESTAMP NOT NULL,
    FOREIGN KEY (hash) REFERENCES task_details (hash)
);
CREATE INDEX IF NOT EXISTS hash_idx ON task_history (hash);
CREATE INDEX IF NOT EXISTS status_idx ON task_history (status);";

#[napi(object)]
pub struct TaskRun {
    pub hash: String,
    pub status: String,
    pub code: i16,
    pub start: i64,
    pub end: i64,
}

#[napi]
pub struct NxTaskHistory {
    db: Arc<Mutex<NxDbConnection>>,
}

#[napi]
impl NxTaskHistory {
    #[napi(constructor)]
    pub fn new(
        #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db: &External<
            Arc<Mutex<NxDbConnection>>,
        >,
    ) -> anyhow::Result<Self> {
        Ok(Self { db: Arc::clone(db) })
    }

    #[napi]
    pub fn record_task_runs(&mut self, task_runs: Vec<TaskRun>) -> anyhow::Result<()> {
        trace!("Recording task runs");
        let db = self.db.lock().unwrap();
        db.begin_transaction()?;
        for task_run in task_runs.iter() {
            db.execute(
                "INSERT OR REPLACE INTO task_history
                    (hash, status, code, start, end)
                    VALUES (?1, ?2, ?3, ?4, ?5)",
                &[
                    DbValue::from(task_run.hash.as_str()),
                    DbValue::from(task_run.status.as_str()),
                    DbValue::Integer(task_run.code as i64),
                    DbValue::Integer(task_run.start),
                    DbValue::Integer(task_run.end),
                ],
            )
            .inspect_err(|e| trace!("Error trying to insert {:?}: {:?}", &task_run.hash, e))?;
        }
        db.commit_transaction()?;
        Ok(())
    }

    #[napi]
    pub fn get_flaky_tasks(&self, hashes: Vec<String>) -> anyhow::Result<Vec<String>> {
        if hashes.is_empty() {
            return Ok(vec![]);
        }

        // Use IN (?,?,?) with dynamic placeholders instead of rarray
        let placeholders: Vec<String> = (1..=hashes.len()).map(|i| format!("?{}", i)).collect();
        let sql = format!(
            "SELECT hash FROM task_history
                WHERE hash IN ({}) AND status != 'stopped'
                GROUP BY hash
                HAVING COUNT(DISTINCT code) > 1",
            placeholders.join(", ")
        );
        let params: Vec<DbValue> = hashes.into_iter().map(DbValue::from).collect();

        let rows = self.db.lock().unwrap().query_rows(&sql, &params)?;
        rows.iter()
            .map(|row| row.get_str(0))
            .collect()
    }

    #[napi]
    pub fn get_estimated_task_timings(
        &self,
        targets: Vec<TaskTarget>,
    ) -> anyhow::Result<HashMap<String, f64>> {
        if targets.is_empty() {
            return Ok(HashMap::new());
        }

        let target_strings: Vec<String> = targets
            .iter()
            .map(|t| match &t.configuration {
                Some(configuration) => {
                    format!("{}:{}:{}", t.project, t.target, configuration)
                }
                _ => format!("{}:{}", t.project, t.target),
            })
            .collect();

        // Use IN (?,?,?) with dynamic placeholders instead of rarray
        let placeholders: Vec<String> =
            (1..=target_strings.len()).map(|i| format!("?{}", i)).collect();
        let sql = format!(
            "SELECT
                CONCAT_WS(':', project, target, configuration) AS target_string,
                AVG(end - start) AS duration
                FROM task_history
                    JOIN task_details ON task_history.hash = task_details.hash
                WHERE target_string IN ({}) AND status = 'success'
                GROUP BY target_string",
            placeholders.join(", ")
        );
        let params: Vec<DbValue> = target_strings.into_iter().map(DbValue::from).collect();

        let rows = self.db.lock().unwrap().query_rows(&sql, &params)?;
        let mut result = HashMap::new();
        for row in &rows {
            let target_string = row.get_str(0)?;
            let duration = row.get_f64(1)?;
            result.insert(target_string, duration);
        }
        Ok(result)
    }
}
