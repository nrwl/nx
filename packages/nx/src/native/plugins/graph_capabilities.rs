use crate::native::db::connection::NxDbConnection;
use napi::bindgen_prelude::External;
use rusqlite::params;
use std::sync::{Arc, Mutex};

/// One row per plugin that built the latest graph, stamped with its `computedAt`.
/// Created here because `create_all_tables` only runs for a new database file.
const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS graph_plugin_capabilities (
    position   INTEGER PRIMARY KEY NOT NULL,
    computed_at   INTEGER NOT NULL,
    name   TEXT NOT NULL,
    create_nodes_pattern   TEXT,
    has_create_dependencies   INTEGER NOT NULL,
    has_create_metadata   INTEGER NOT NULL,
    has_pre_tasks_execution   INTEGER NOT NULL,
    has_post_tasks_execution   INTEGER NOT NULL
);";

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

#[napi]
pub struct GraphPluginCapabilities {
    db: Arc<Mutex<NxDbConnection>>,
}

#[napi]
impl GraphPluginCapabilities {
    #[napi(constructor)]
    pub fn new(
        #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db: &External<
            Arc<Mutex<NxDbConnection>>,
        >,
    ) -> anyhow::Result<Self> {
        let service = Self { db: Arc::clone(db) };
        {
            let db = service.db.lock().unwrap();
            db.execute_batch(SCHEMA)?;
        }
        Ok(service)
    }

    #[napi]
    pub fn record(
        &self,
        computed_at: i64,
        capabilities: Vec<CachedPluginCapabilities>,
    ) -> anyhow::Result<()> {
        let mut db = self.db.lock().unwrap();
        db.transaction(|conn| {
            conn.execute("DELETE FROM graph_plugin_capabilities", [])?;
            let mut insert = conn.prepare(
                "INSERT INTO graph_plugin_capabilities (
                    position, computed_at, name, create_nodes_pattern,
                    has_create_dependencies, has_create_metadata,
                    has_pre_tasks_execution, has_post_tasks_execution
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )?;
            for (position, plugin) in capabilities.iter().enumerate() {
                insert.execute(params![
                    position as i64,
                    computed_at,
                    plugin.name,
                    plugin.create_nodes_pattern,
                    plugin.has_create_dependencies,
                    plugin.has_create_metadata,
                    plugin.has_pre_tasks_execution,
                    plugin.has_post_tasks_execution,
                ])?;
            }
            Ok(())
        })?;
        Ok(())
    }

    /// The capabilities recorded with the graph computed at `computed_at`, or
    /// null when what is recorded belongs to another build or nothing is.
    #[napi]
    pub fn get(&self, computed_at: i64) -> anyhow::Result<Option<Vec<CachedPluginCapabilities>>> {
        let db = self.db.lock().unwrap();
        let mut query = db.prepare(
            "SELECT computed_at, name, create_nodes_pattern,
                    has_create_dependencies, has_create_metadata,
                    has_pre_tasks_execution, has_post_tasks_execution
             FROM graph_plugin_capabilities ORDER BY position",
        )?;
        let rows = query.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                CachedPluginCapabilities {
                    name: row.get(1)?,
                    create_nodes_pattern: row.get(2)?,
                    has_create_dependencies: row.get(3)?,
                    has_create_metadata: row.get(4)?,
                    has_pre_tasks_execution: row.get(5)?,
                    has_post_tasks_execution: row.get(6)?,
                },
            ))
        })?;

        let mut capabilities = Vec::new();
        for row in rows {
            let (stamp, plugin) = row?;
            if stamp != computed_at {
                return Ok(None);
            }
            capabilities.push(plugin);
        }
        Ok(if capabilities.is_empty() {
            None
        } else {
            Some(capabilities)
        })
    }
}
