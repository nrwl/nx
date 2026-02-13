use crate::native::db::connection::NxDbConnection;
use napi::bindgen_prelude::*;
use tracing::trace;

pub const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS output_fingerprints (
    task_hash    TEXT PRIMARY KEY NOT NULL,
    fingerprint  TEXT NOT NULL
);";

#[napi]
pub struct OutputFingerprints {
    db: External<NxDbConnection>,
}

#[napi]
impl OutputFingerprints {
    #[napi(constructor)]
    pub fn new(db: External<NxDbConnection>) -> Self {
        Self { db }
    }

    #[napi]
    pub fn record(&mut self, task_hash: String, fingerprint: String) -> anyhow::Result<()> {
        trace!("Recording output fingerprint for hash {}", task_hash);
        self.db.execute(
            "INSERT OR REPLACE INTO output_fingerprints (task_hash, fingerprint) VALUES (?1, ?2)",
            [&task_hash, &fingerprint],
        )?;
        Ok(())
    }

    #[napi]
    pub fn get(&self, task_hash: String) -> anyhow::Result<Option<String>> {
        self.db.query_row(
            "SELECT fingerprint FROM output_fingerprints WHERE task_hash = ?1",
            [&task_hash],
            |row| row.get(0),
        )
    }
}
