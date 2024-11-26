use std::rc::Rc;
use std::collections::HashMap;
use itertools::Itertools;
use napi::bindgen_prelude::*;
use rusqlite::vtab::array;
use rusqlite::{params, types::Value, Connection};

use crate::native::tasks::types::TaskTarget;

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
    db: External<Connection>,
}

#[napi]
impl NxTaskHistory {
    #[napi(constructor)]
    pub fn new(db: External<Connection>) -> anyhow::Result<Self> {
        let s = Self { db };

        s.setup()?;

        Ok(s)
    }

    fn setup(&self) -> anyhow::Result<()> {
        array::load_module(&self.db)?;
        self.db
            .execute_batch(
                "
            BEGIN;
            CREATE TABLE IF NOT EXISTS task_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                hash TEXT NOT NULL,
                status TEXT NOT NULL,
                code INTEGER NOT NULL,
                start TIMESTAMP NOT NULL,
                end TIMESTAMP NOT NULL,
                FOREIGN KEY (hash) REFERENCES task_details (hash)
            );
            CREATE INDEX IF NOT EXISTS hash_idx ON task_history (hash);
            COMMIT;
            ",
            )
            .map_err(anyhow::Error::from)
    }

    #[napi]
    pub fn record_task_runs(&self, task_runs: Vec<TaskRun>) -> anyhow::Result<()> {
        for task_run in task_runs.iter() {
            self.db
                .execute(
                    "
            INSERT INTO task_history
                (hash, status, code, start, end)
                VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        task_run.hash,
                        task_run.status,
                        task_run.code,
                        task_run.start,
                        task_run.end
                    ],
                )
                .map_err(anyhow::Error::from)?;
        }
        Ok(())
    }

    #[napi]
    pub fn get_flaky_tasks(&self, hashes: Vec<String>) -> anyhow::Result<Vec<String>> {
        let values = Rc::new(
            hashes
                .iter()
                .map(|s| Value::from(s.clone()))
                .collect::<Vec<Value>>(),
        );

        self.db
            .prepare(
                "SELECT hash from task_history
                    WHERE hash IN rarray(?1)
                    GROUP BY hash
                    HAVING COUNT(DISTINCT code) > 1
                ",
            )?
            .query_map([values], |row| row.get(0))?
            .map(|r| r.map_err(anyhow::Error::from))
            .collect()
    }

    #[napi]
    pub fn get_estimated_task_timings(&self, targets: Vec<TaskTarget>) -> anyhow::Result<HashMap<String, f64>> {
        let values = Rc::new(
            targets
                .iter()
                .map(|t| Value::from(
                    match &t.configuration {
                        Some(configuration) => format!("{}:{}:{}", t.project, t.target, configuration),
                        _ => format!("{}:{}", t.project, t.target)
                    }
                ))
                .collect::<Vec<Value>>(),
        );

        // for older query sql version, need to select:  (project || ':' || target || (CASE WHEN coalesce(configuration, '') <> '' THEN ':' || configuration ELSE '' END)) AS target_string,
        self.db
            .prepare(
                "
                SELECT
                    CONCAT_WS(':', project, target, configuration) AS target_string,
                    AVG(end - start) AS duration
                    FROM task_history
                        JOIN task_details ON task_history.hash = task_details.hash
                    WHERE target_string in rarray(?1)
                    GROUP BY target_string
                ",
            )?
            .query_map([values], |row| {
                let target_string: String = row.get(0)?;
                let duration: f64 = row.get(1)?;
                Ok((target_string, duration))
            })?
            .map(|r| r.map_err(anyhow::Error::from))
            .collect()
    }
}
