use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::rc::Rc;
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result, ensure};
use napi::bindgen_prelude::{External, JsObjectValue, Object};
use rayon::prelude::*;
use rusqlite::{params, types::Value};
use tracing::debug;

use super::configurations::EntryCache;
use super::set::{CompactSet, LegacyEntry};
use super::{
    UltracacheConfigurationImportOptions, UltracacheConfigurationResolution,
    UltracacheConfigurations, files,
};
use crate::native::db::connection::NxDbConnection;
use crate::native::utils::time::current_timestamp_millis;

pub type Db = Arc<Mutex<NxDbConnection>>;

/// The workspace database's Ultracache configurations, pinned by commit and fetch time.
#[napi]
#[derive(Clone)]
pub struct UltracacheConfigurationStore {
    db: Db,
}

fn invalid_response(error: impl std::fmt::Display) -> napi::Error<String> {
    napi::Error::new(
        "INVALID_RESPONSE".into(),
        format!("Nx Cloud returned unreadable Ultracache configurations: {error}"),
    )
}

#[napi]
impl UltracacheConfigurationStore {
    #[napi(constructor)]
    pub fn new(
        #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db: &External<Db>,
    ) -> napi::Result<Self, String> {
        // Existing workspace databases acquire the new tables on first use.
        db.lock()
            .unwrap()
            .execute_batch(SCHEMA)
            .map_err(|err| napi::Error::new("STORE_UNAVAILABLE".into(), err.to_string()))?;
        Ok(Self { db: Arc::clone(db) })
    }

    /// Compatibility with consumers of the original native JSON importer.
    #[napi(js_name = "import")]
    pub fn import_set(
        &self,
        options: UltracacheConfigurationImportOptions,
    ) -> napi::Result<UltracacheConfigurations, String> {
        let entries: HashMap<String, LegacyEntry> =
            serde_json::from_str(&options.configurations_json).map_err(invalid_response)?;
        let mut set = CompactSet::default();
        for (id, entry) in entries {
            set.add_legacy(id, entry.inputs);
        }
        set.hash_project_folder_state = options.hash_project_folder_state.unwrap_or(false);
        self.publish(options.requested_commit, set)
    }

    /// Imports the older Cloud API one JS property at a time.
    /// The folder-state switch is the manifest's `hashProjectFolderState`; it
    /// defaults to `false`.
    #[napi]
    pub fn import_entries(
        &self,
        requested_commit: String,
        #[napi(
            ts_arg_type = "Readonly<Record<string, { commit: string; inputs: readonly string[] }>>"
        )]
        configurations: Object<'_>,
        hash_project_folder_state: Option<bool>,
    ) -> napi::Result<UltracacheConfigurations, String> {
        let mut set = CompactSet::default();
        set.hash_project_folder_state = hash_project_folder_state.unwrap_or(false);
        for id in Object::keys(&configurations).map_err(invalid_response)? {
            if !configurations
                .has_own_property(&id)
                .map_err(invalid_response)?
            {
                continue;
            }
            let entry = configurations
                .get::<Object>(&id)
                .map_err(invalid_response)?
                .ok_or_else(|| invalid_response("missing task configuration"))?;
            entry
                .get::<String>("commit")
                .map_err(invalid_response)?
                .ok_or_else(|| invalid_response("missing commit"))?;
            let inputs = entry
                .get::<Vec<String>>("inputs")
                .map_err(invalid_response)?
                .ok_or_else(|| invalid_response("missing inputs"))?;
            set.add_legacy(id, inputs);
        }
        self.publish(requested_commit, set)
    }

    /// Verifies and imports the immutable manifest and its referenced objects.
    #[napi]
    pub fn import_files(
        &self,
        requested_commit: String,
        manifest_path: String,
        files_directory: String,
    ) -> napi::Result<UltracacheConfigurations, String> {
        let set = files::read(Path::new(&manifest_path), Path::new(&files_directory))
            .map_err(invalid_response)?;
        self.publish(requested_commit, set)
    }

    /// The newest stored set for this commit, reading only its summary.
    #[napi]
    pub fn get(&self, commit: String) -> Option<UltracacheConfigurations> {
        self.open(commit, None)
    }

    /// The exact version handed to the worker by its coordinator.
    #[napi]
    pub fn get_version(&self, commit: String, fetched_at: i64) -> Option<UltracacheConfigurations> {
        self.open(commit, Some(fetched_at))
    }
}

// Older Nx clients keep reading and writing the two original tables. Keeping
// compact versions separate prevents those clients from opening a partial set.
// A version in the original tables never hashes project folder state: those
// clients predate it. The switch belongs to a compact version, and each
// import publishes a new one with its own `fetched_at`, so one
// (commit, fetched_at) pin never mixes the two.
const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS io_snapshot_versions (
    commit_sha TEXT NOT NULL, fetched_at INTEGER NOT NULL, tasks INTEGER NOT NULL,
    PRIMARY KEY (commit_sha, fetched_at)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS io_snapshot_entries (
    commit_sha TEXT NOT NULL, fetched_at INTEGER NOT NULL, task_id TEXT NOT NULL, entry TEXT NOT NULL,
    PRIMARY KEY (commit_sha, fetched_at, task_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS io_snapshot_compact_versions (
    id INTEGER PRIMARY KEY, commit_sha TEXT NOT NULL, fetched_at INTEGER NOT NULL, tasks INTEGER NOT NULL,
    UNIQUE (commit_sha, fetched_at)
);
CREATE TABLE IF NOT EXISTS io_snapshot_compact_tasks (
    version INTEGER NOT NULL, task_id TEXT NOT NULL, artifact INTEGER NOT NULL,
    PRIMARY KEY (version, task_id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS io_snapshot_compact_artifacts (
    version INTEGER NOT NULL, id INTEGER NOT NULL, inputs BLOB NOT NULL,
    PRIMARY KEY (version, id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS io_snapshot_compact_globs (
    version INTEGER NOT NULL, id INTEGER NOT NULL, glob TEXT NOT NULL,
    PRIMARY KEY (version, id)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS io_snapshot_compact_features (
    version INTEGER NOT NULL, feature TEXT NOT NULL,
    PRIMARY KEY (version, feature)
) WITHOUT ROWID;
";

/// The `io_snapshot_compact_features` row of a version whose manifest set
/// `hashProjectFolderState`. A separate table, so older Nx versions sharing the
/// database keep reading and writing versions as before.
const PROJECT_FOLDER_STATE: &str = "hashProjectFolderState";

fn integers(ids: impl Iterator<Item = u32>) -> Rc<Vec<Value>> {
    Rc::new(ids.map(|id| Value::Integer(id.into())).collect())
}

impl UltracacheConfigurationStore {
    fn publish(
        &self,
        commit: String,
        set: CompactSet,
    ) -> napi::Result<UltracacheConfigurations, String> {
        let tasks = set.tasks.len() as u32;
        // A page can also describe recorded outputs and other tasks in the workspace.
        // Persist only the strings this snapshot needs for hashing.
        let mut used = vec![false; set.globs.len()];
        for &glob in set.inputs.keys().flatten() {
            used[glob as usize] = true;
        }
        let (version, fetched_at) = self.db.lock().unwrap().transaction_immediate(|conn| {
            // Serialize allocation across processes, including two imports in the same millisecond.
            let fetched_at: i64 = conn.query_row(
                "SELECT MAX(?2, COALESCE(MAX(fetched_at) + 1, 0)) FROM (
                    SELECT MAX(fetched_at) AS fetched_at FROM io_snapshot_versions WHERE commit_sha = ?1
                    UNION ALL SELECT MAX(fetched_at) FROM io_snapshot_compact_versions WHERE commit_sha = ?1)",
                params![commit, current_timestamp_millis()],
                |row| row.get(0),
            )?;
            conn.execute(
                "INSERT INTO io_snapshot_compact_versions (commit_sha, fetched_at, tasks) VALUES (?1, ?2, ?3)",
                params![commit, fetched_at, tasks],
            )?;
            let version = conn.last_insert_rowid();
            let mut globs = conn.prepare("INSERT INTO io_snapshot_compact_globs VALUES (?1, ?2, ?3)")?;
            for (id, glob) in set.globs.iter().enumerate() {
                if used[id] {
                    globs.execute(params![version, id, glob.as_ref()])?;
                }
            }
            let mut artifacts = conn.prepare("INSERT INTO io_snapshot_compact_artifacts VALUES (?1, ?2, ?3)")?;
            for (inputs, id) in &set.inputs {
                let bytes: Vec<u8> = inputs.iter().flat_map(|id| id.to_le_bytes()).collect();
                artifacts.execute(params![version, id, bytes])?;
            }
            let mut insert_task = conn.prepare("INSERT INTO io_snapshot_compact_tasks VALUES (?1, ?2, ?3)")?;
            for (task, artifact) in &set.tasks {
                insert_task.execute(params![version, task, artifact])?;
            }
            if set.hash_project_folder_state {
                conn.execute(
                    "INSERT INTO io_snapshot_compact_features VALUES (?1, ?2)",
                    params![version, PROJECT_FOLDER_STATE],
                )?;
            }
            Ok((version, fetched_at))
        }).map_err(|err| napi::Error::new("WRITE_FAILED".into(), err.to_string()))?;
        Ok(UltracacheConfigurations::new(
            UltracacheConfigurationResolution {
                requested_commit: commit,
                fetched_at,
                tasks,
            },
            self.clone(),
            Some(version),
            set.hash_project_folder_state,
        ))
    }

    fn open(&self, commit: String, fetched_at: Option<i64>) -> Option<UltracacheConfigurations> {
        let (version, fetched_at, tasks, ambiguous, folder_state) = self.db.lock().unwrap().query_row(
            "WITH newest AS (
                SELECT id, fetched_at, tasks FROM (
                    SELECT id, fetched_at, tasks FROM io_snapshot_compact_versions WHERE commit_sha = ?1
                    UNION ALL SELECT NULL, fetched_at, tasks FROM io_snapshot_versions WHERE commit_sha = ?1)
                WHERE ?2 IS NULL OR fetched_at = ?2 ORDER BY fetched_at DESC, id DESC LIMIT 1
             )
             SELECT id, fetched_at, tasks, id IS NOT NULL AND EXISTS (
                SELECT 1 FROM io_snapshot_versions WHERE commit_sha = ?1 AND fetched_at = newest.fetched_at
             ), EXISTS (
                SELECT 1 FROM io_snapshot_compact_features WHERE version = newest.id AND feature = ?3
             ) FROM newest",
            params![commit, fetched_at, PROJECT_FOLDER_STATE],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get::<_, bool>(3)?, row.get::<_, bool>(4)?)),
        ).inspect_err(|err| debug!("ultracache: unreadable configurations for {commit}: {err}")).ok()??;
        // An older writer can still pick its own timestamp. A worker cannot
        // distinguish two versions with the same public pin.
        if ambiguous {
            debug!("ultracache: ambiguous configuration version for {commit} at {fetched_at}");
            return None;
        }
        Some(UltracacheConfigurations::new(
            UltracacheConfigurationResolution {
                requested_commit: commit,
                fetched_at,
                tasks,
            },
            self.clone(),
            version,
            folder_state,
        ))
    }

    pub(super) fn read_entries(
        &self,
        version: Option<i64>,
        resolution: &UltracacheConfigurationResolution,
        task_ids: &[&str],
        cache: &mut EntryCache,
    ) -> Result<()> {
        let ids = Rc::new(
            task_ids
                .iter()
                .map(|id| Value::from(id.to_string()))
                .collect::<Vec<_>>(),
        );
        let Some(version) = version else {
            let rows: Vec<(String, String)> = self.db.lock().unwrap().query_map(
                "SELECT task_id, entry FROM io_snapshot_entries WHERE commit_sha = ?1 AND fetched_at = ?2 AND task_id IN rarray(?3)",
                (&resolution.requested_commit, resolution.fetched_at, ids), |row| Ok((row.get(0)?, row.get(1)?)))?;
            for (id, json) in rows {
                let entry: LegacyEntry = serde_json::from_str(&json).with_context(|| {
                    format!("parsing the stored Ultracache configuration of {id}")
                })?;
                let mut inputs: Vec<Arc<str>> = entry
                    .inputs
                    .into_iter()
                    .map(|glob| {
                        if let Some(shared) = cache.legacy_globs.get(glob.as_str()) {
                            return shared.clone();
                        }
                        let shared: Arc<str> = glob.into();
                        cache.legacy_globs.insert(shared.clone());
                        shared
                    })
                    .collect();
                inputs.sort_unstable();
                inputs.dedup();
                cache.tasks.insert(id, Some(inputs.into()));
            }
            return Ok(());
        };
        let tasks: Vec<(String, u32)> = self.db.lock().unwrap().query_map(
            "SELECT task_id, artifact FROM io_snapshot_compact_tasks WHERE version = ?1 AND task_id IN rarray(?2)",
            (version, ids), |row| Ok((row.get(0)?, row.get(1)?)))?;
        let needed: HashSet<u32> = tasks
            .iter()
            .map(|(_, id)| *id)
            .filter(|id| !cache.artifacts.contains_key(id))
            .collect();
        if !needed.is_empty() {
            let rows: Vec<(u32, Vec<u8>)> = self.db.lock().unwrap().query_map(
                "SELECT id, inputs FROM io_snapshot_compact_artifacts WHERE version = ?1 AND id IN rarray(?2)",
                (version, integers(needed.iter().copied())), |row| Ok((row.get(0)?, row.get(1)?)))?;
            ensure!(
                rows.len() == needed.len(),
                "missing stored Ultracache artifact"
            );
            let mut glob_ids = HashSet::new();
            let mut artifacts = Vec::with_capacity(rows.len());
            for (id, bytes) in rows {
                let (words, trailing) = bytes.as_chunks::<4>();
                ensure!(trailing.is_empty(), "invalid stored Ultracache input ids");
                let inputs: Vec<u32> = words.iter().copied().map(u32::from_le_bytes).collect();
                glob_ids.extend(
                    inputs
                        .iter()
                        .copied()
                        .filter(|g| !cache.globs.contains_key(g)),
                );
                artifacts.push((id, inputs));
            }
            if !glob_ids.is_empty() {
                let rows: Vec<(u32, String)> = self.db.lock().unwrap().query_map(
                    "SELECT id, glob FROM io_snapshot_compact_globs WHERE version = ?1 AND id IN rarray(?2)",
                    (version, integers(glob_ids.iter().copied())), |row| Ok((row.get(0)?, row.get(1)?)))?;
                ensure!(
                    rows.len() == glob_ids.len(),
                    "missing stored Ultracache glob"
                );
                cache
                    .globs
                    .extend(rows.into_iter().map(|(id, glob)| (id, glob.into())));
            }
            // Sort each newly requested artifact independently. Small or repeated
            // requests never revisit the glob dictionary already held by the handle.
            let lists: Vec<_> = artifacts
                .into_par_iter()
                .map(|(id, ids)| {
                    let mut inputs: Vec<_> = ids.iter().map(|g| cache.globs[g].clone()).collect();
                    inputs.sort_unstable();
                    (id, Arc::<[_]>::from(inputs))
                })
                .collect();
            cache.artifacts.extend(lists);
        }
        for (id, artifact) in tasks {
            cache
                .tasks
                .insert(id, Some(cache.artifacts[&artifact].clone()));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests;
