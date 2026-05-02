use crate::native::db::connection::{DbValue, NxDbConnection};
use napi::bindgen_prelude::External;
use std::sync::{Arc, Mutex};

/// One row per plugin that built the latest graph, stamped with its `computedAt`.
/// Created here because `create_all_tables` only runs for a new database file.
const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS nx_plugin_capabilities (
    position   INTEGER PRIMARY KEY NOT NULL,
    computed_at   INTEGER NOT NULL,
    create_nodes_pattern   TEXT,
    has_create_dependencies   INTEGER NOT NULL,
    has_create_metadata   INTEGER NOT NULL,
    has_pre_tasks_execution   INTEGER NOT NULL,
    has_post_tasks_execution   INTEGER NOT NULL
);";

#[napi(object)]
#[derive(Clone, Debug)]
pub struct CachedPluginCapabilities {
    pub create_nodes_pattern: Option<String>,
    pub has_create_dependencies: bool,
    pub has_create_metadata: bool,
    pub has_pre_tasks_execution: bool,
    pub has_post_tasks_execution: bool,
}

#[napi]
pub struct NxPluginCapabilities {
    db: Arc<Mutex<NxDbConnection>>,
}

#[napi]
impl NxPluginCapabilities {
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
        let db = self.db.lock().unwrap();
        db.transaction(|conn| {
            conn.execute("DELETE FROM nx_plugin_capabilities", &[])?;
            for (position, plugin) in capabilities.iter().enumerate() {
                conn.execute(
                    "INSERT INTO nx_plugin_capabilities (
                        position, computed_at, create_nodes_pattern,
                        has_create_dependencies, has_create_metadata,
                        has_pre_tasks_execution, has_post_tasks_execution
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    &[
                        DbValue::Integer(position as i64),
                        DbValue::Integer(computed_at),
                        match &plugin.create_nodes_pattern {
                            Some(pattern) => DbValue::from(pattern.as_str()),
                            None => DbValue::Null,
                        },
                        DbValue::from(plugin.has_create_dependencies),
                        DbValue::from(plugin.has_create_metadata),
                        DbValue::from(plugin.has_pre_tasks_execution),
                        DbValue::from(plugin.has_post_tasks_execution),
                    ],
                )?;
            }
            Ok(())
        })?;
        Ok(())
    }

    /// The capabilities recorded with the graph computed at `computed_at`, or
    /// null when what is recorded belongs to another build or nothing is.
    #[napi]
    pub fn get(&self, computed_at: i64) -> anyhow::Result<Option<Vec<CachedPluginCapabilities>>> {
        let rows = self.db.lock().unwrap().query_rows(
            "SELECT computed_at, create_nodes_pattern,
                    has_create_dependencies, has_create_metadata,
                    has_pre_tasks_execution, has_post_tasks_execution
             FROM nx_plugin_capabilities ORDER BY position",
            &[],
        )?;

        let mut capabilities = Vec::new();
        for row in rows {
            if row.get_i64(0)? != computed_at {
                return Ok(None);
            }
            capabilities.push(CachedPluginCapabilities {
                create_nodes_pattern: row.get_optional_str(1)?,
                has_create_dependencies: row.get_i64(2)? != 0,
                has_create_metadata: row.get_i64(3)? != 0,
                has_pre_tasks_execution: row.get_i64(4)? != 0,
                has_post_tasks_execution: row.get_i64(5)? != 0,
            });
        }
        Ok(if capabilities.is_empty() {
            None
        } else {
            Some(capabilities)
        })
    }
}
