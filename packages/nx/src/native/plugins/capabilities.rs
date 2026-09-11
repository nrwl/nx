use crate::native::db::connection::NxDbConnection;
use napi::bindgen_prelude::External;
use rusqlite::params;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tracing::trace;

/// Created by the service rather than `create_all_tables`, which only runs for
/// a database file that did not already exist. Registering it there instead
/// would need a `DB_VERSION` bump, and the version is part of the database
/// file name, so every existing workspace would lose its task cache index.
///
/// Adding a column here still needs that bump, since `IF NOT EXISTS` leaves an
/// existing table alone and the new column would be missing at read time.
pub const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS plugin_capabilities (
    key    TEXT PRIMARY KEY NOT NULL,
    name   TEXT NOT NULL,
    create_nodes_pattern   TEXT,
    has_create_dependencies   INTEGER NOT NULL,
    has_create_metadata   INTEGER NOT NULL,
    has_pre_tasks_execution   INTEGER NOT NULL,
    has_post_tasks_execution   INTEGER NOT NULL,
    source_files   TEXT NOT NULL,
    source_hash   TEXT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);";

/// How long a record outlives the run that wrote it.
///
/// An installed plugin's key carries its version, so an upgrade mints a new row
/// and orphans the old one. A local plugin's key is identity alone and its row is
/// updated in place when its sources change, which refreshes this. So the rows
/// this collects are the orphans: upgrades, uninstalls, and plugins a workspace
/// stopped configuring.
const MAX_RECORD_AGE: &str = "-30 days";

/// What a plugin module registers, independent of the options it is configured
/// with. Every field describes the module's exports, and an entry's options only
/// reach a plugin as an argument when a hook is called, so one record is valid
/// for every nx.json entry naming the same module.
#[napi(object)]
#[derive(Clone, Debug)]
pub struct CachedPluginCapabilities {
    pub name: String,
    pub create_nodes_pattern: Option<String>,
    pub has_create_dependencies: bool,
    pub has_create_metadata: bool,
    pub has_pre_tasks_execution: bool,
    pub has_post_tasks_execution: bool,
}

/// A record, which is the capabilities plus what they were derived from. The
/// files are the non-vendor closure the plugin's load read, newline separated,
/// and the hash is of their contents at that moment. Empty for a plugin whose
/// every source is vendored, where the key's version identifies it instead.
#[napi(object)]
#[derive(Clone, Debug)]
pub struct PluginRecord {
    pub capabilities: CachedPluginCapabilities,
    pub source_files: Vec<String>,
    pub source_hash: String,
}

#[napi(object)]
#[derive(Clone, Debug)]
pub struct PluginCapabilitiesEntry {
    pub key: String,
    pub record: PluginRecord,
}

#[napi]
pub struct PluginCapabilitiesCache {
    db: Arc<Mutex<NxDbConnection>>,
}

#[napi]
impl PluginCapabilitiesCache {
    #[napi(constructor)]
    pub fn new(
        #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db: &External<
            Arc<Mutex<NxDbConnection>>,
        >,
    ) -> anyhow::Result<Self> {
        let cache = Self { db: Arc::clone(db) };
        cache.db.lock().unwrap().execute_batch(SCHEMA)?;
        Ok(cache)
    }

    /// Returns only the keys that are present, so the caller can take the
    /// difference and load the rest.
    #[napi]
    pub fn get(&self, keys: Vec<String>) -> anyhow::Result<HashMap<String, PluginRecord>> {
        let mut found = HashMap::with_capacity(keys.len());
        let db = self.db.lock().unwrap();
        for key in keys.into_iter() {
            let row = db.query_row(
                "SELECT name, create_nodes_pattern, has_create_dependencies, has_create_metadata,
                        has_pre_tasks_execution, has_post_tasks_execution, source_files, source_hash
                 FROM plugin_capabilities WHERE key = ?1",
                params![&key],
                |row| {
                    let files: String = row.get(6)?;
                    Ok(PluginRecord {
                        capabilities: CachedPluginCapabilities {
                            name: row.get(0)?,
                            create_nodes_pattern: row.get(1)?,
                            has_create_dependencies: row.get(2)?,
                            has_create_metadata: row.get(3)?,
                            has_pre_tasks_execution: row.get(4)?,
                            has_post_tasks_execution: row.get(5)?,
                        },
                        source_files: if files.is_empty() {
                            vec![]
                        } else {
                            files.lines().map(|l| l.to_string()).collect()
                        },
                        source_hash: row.get(7)?,
                    })
                },
            )?;
            if let Some(record) = row {
                trace!("Found a record for {}", &key);
                found.insert(key, record);
            }
        }
        Ok(found)
    }

    #[napi]
    pub fn record(&mut self, entries: Vec<PluginCapabilitiesEntry>) -> anyhow::Result<()> {
        trace!("Recording capabilities for {} plugin(s)", entries.len());
        self.db.lock().unwrap().transaction(|conn| {
            // Swept here rather than on read: a read happens on most commands
            // and a write only when a plugin had to be loaded, so this keeps the
            // common path free of writes.
            conn.execute(
                "DELETE FROM plugin_capabilities WHERE created_at < datetime('now', ?1)",
                params![MAX_RECORD_AGE],
            )?;

            let mut stmt = conn.prepare(
                "INSERT INTO plugin_capabilities (key, name, create_nodes_pattern,
                        has_create_dependencies, has_create_metadata,
                        has_pre_tasks_execution, has_post_tasks_execution,
                        source_files, source_hash)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                 ON CONFLICT(key) DO UPDATE SET
                        name = excluded.name,
                        create_nodes_pattern = excluded.create_nodes_pattern,
                        has_create_dependencies = excluded.has_create_dependencies,
                        has_create_metadata = excluded.has_create_metadata,
                        has_pre_tasks_execution = excluded.has_pre_tasks_execution,
                        has_post_tasks_execution = excluded.has_post_tasks_execution,
                        source_files = excluded.source_files,
                        source_hash = excluded.source_hash,
                        created_at = CURRENT_TIMESTAMP",
            )?;
            for entry in entries.iter() {
                let capabilities = &entry.record.capabilities;
                stmt.execute(params![
                    entry.key,
                    capabilities.name,
                    capabilities.create_nodes_pattern,
                    capabilities.has_create_dependencies,
                    capabilities.has_create_metadata,
                    capabilities.has_pre_tasks_execution,
                    capabilities.has_post_tasks_execution,
                    entry.record.source_files.join("\n"),
                    entry.record.source_hash,
                ])?;
            }
            Ok(())
        })?;

        Ok(())
    }
}
