use crate::native::db::connection::{DbValue, NxDbConnection};
use napi::bindgen_prelude::External;
use std::sync::{Arc, Mutex};
use tracing::trace;

pub const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS task_details (
    hash    TEXT PRIMARY KEY NOT NULL,
    project  TEXT NOT NULL,
    target  TEXT NOT NULL,
    configuration  TEXT
);";

#[napi(object)]
#[derive(Default, Clone, Debug)]
pub struct HashedTask {
    pub hash: String,
    pub project: String,
    pub target: String,
    pub configuration: Option<String>,
}

#[napi]
pub struct TaskDetails {
    db: Arc<Mutex<NxDbConnection>>,
}

#[napi]
impl TaskDetails {
    #[napi(constructor)]
    pub fn new(
        #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db: &External<
            Arc<Mutex<NxDbConnection>>,
        >,
    ) -> anyhow::Result<Self> {
        Ok(Self { db: Arc::clone(db) })
    }

    #[napi]
    pub fn record_task_details(&mut self, tasks: Vec<HashedTask>) -> anyhow::Result<()> {
        trace!("Recording task details");
        let db = self.db.lock().unwrap();
        db.begin_transaction()?;
        for task in tasks.iter() {
            db.execute(
                "INSERT OR REPLACE INTO task_details (hash, project, target, configuration) VALUES (?1, ?2, ?3, ?4)",
                &[
                    DbValue::from(task.hash.as_str()),
                    DbValue::from(task.project.as_str()),
                    DbValue::from(task.target.as_str()),
                    match &task.configuration {
                        Some(c) => DbValue::from(c.as_str()),
                        None => DbValue::Null,
                    },
                ],
            )?;
        }
        db.commit_transaction()?;
        Ok(())
    }
}
