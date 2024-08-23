use napi::bindgen_prelude::*;
use rusqlite::{params, Connection};

#[napi(object)]
#[derive(Default, Clone)]
pub struct HashedTask {
    pub hash: String,
    pub project: String,
    pub target: String,
    pub configuration: Option<String>,
}

#[napi]
struct TaskDetails {
    db: External<Connection>,
}

#[napi]
impl TaskDetails {
    #[napi(constructor)]
    pub fn new(db: External<Connection>) -> anyhow::Result<Self> {
        let r = Self { db };

        r.setup()?;

        Ok(r)
    }

    fn setup(&self) -> anyhow::Result<()> {
        self.db.execute(
            "
            CREATE TABLE IF NOT EXISTS task_details (
                hash    TEXT PRIMARY KEY NOT NULL,
                project  TEXT NOT NULL,
                target  TEXT NOT NULL,
                configuration  TEXT
            );",
            params![],
        )?;

        Ok(())
    }

    #[napi]
    pub fn record_task_details(&self, tasks: Vec<HashedTask>) -> anyhow::Result<()> {
        for task in tasks.iter() {
            self.db.execute(
                "INSERT OR REPLACE INTO task_details  (hash, project, target, configuration)
                    VALUES (?1, ?2, ?3, ?4)",
                params![task.hash, task.project, task.target, task.configuration],
            )?;
        }

        Ok(())
    }
}
