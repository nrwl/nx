use crate::native::db::connection::NxDbConnection;
use napi::bindgen_prelude::External;
use std::sync::{Arc, Mutex};
use tracing::trace;
use turso_core::Value;

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
        self.db.lock().unwrap().transaction(|db| {
            for task in tasks.iter() {
            db.execute(
                "INSERT OR REPLACE INTO task_details (hash, project, target, configuration) VALUES (?1, ?2, ?3, ?4)",
                &[
                    Value::from_text(task.hash.clone()),
                    Value::from_text(task.project.clone()),
                    Value::from_text(task.target.clone()),
                    match &task.configuration {
                        Some(c) => Value::from_text(c.clone()),
                        None => Value::Null,
                    },
                ],
            )?;
            }
            Ok(())
        })
    }
}
