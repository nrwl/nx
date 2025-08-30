use crate::native::db::connection::NxDbConnection;
use napi::bindgen_prelude::*;
use rusqlite::params;
use tracing::trace;

#[napi(object)]
#[derive(Default, Clone, Debug)]
pub struct HashedTask {
    pub hash: String,
    pub project: String,
    pub target: String,
    pub configuration: Option<String>,
    pub cache: bool,
}

#[napi]
pub struct TaskDetails {
    db: External<NxDbConnection>,
}

#[napi]
impl TaskDetails {
    #[napi(constructor)]
    pub fn new(db: External<NxDbConnection>) -> anyhow::Result<Self> {
        let r = Self { db };

        r.setup()?;

        Ok(r)
    }

    fn setup(&self) -> anyhow::Result<()> {
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS task_details (
                hash    TEXT PRIMARY KEY NOT NULL,
                project  TEXT NOT NULL,
                target  TEXT NOT NULL,
                configuration  TEXT,
                cache  BOOLEAN NOT NULL DEFAULT 0
            );",
            params![],
        )?;

        Ok(())
    }

    #[napi]
    pub fn record_task_details(&mut self, tasks: Vec<HashedTask>) -> anyhow::Result<()> {
        trace!("Recording task details");
        self.db.transaction(|conn| {
            let mut stmt = conn.prepare("INSERT OR REPLACE INTO task_details (hash, project, target, configuration, cache) VALUES (?1, ?2, ?3, ?4, ?5)")?;
            for task in tasks.iter() {
                stmt.execute(
                    params![task.hash, task.project, task.target, task.configuration, task.cache],
                )?;
            }
            Ok(())
        })?;

        Ok(())
    }
}
