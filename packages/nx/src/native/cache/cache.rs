use std::fs::{create_dir_all, read_to_string, write};
use std::path::{Path, PathBuf};
use std::time::Instant;

use fs_extra::remove_items;
use napi::bindgen_prelude::*;
use regex::Regex;
use rusqlite::params;
use sysinfo::Disks;
use tracing::trace;

use crate::native::cache::expand_outputs::_expand_outputs;
use crate::native::cache::file_ops::_copy;
use crate::native::db::connection::NxDbConnection;
use crate::native::utils::Normalize;

#[napi(object)]
#[derive(Default, Clone, Debug)]
pub struct CachedResult {
    pub code: i16,
    pub terminal_output: Option<String>,
    pub outputs_path: String,
    pub size: Option<i64>,
}

#[napi]
pub struct NxCache {
    pub cache_directory: String,
    workspace_root: PathBuf,
    cache_path: PathBuf,
    db: External<NxDbConnection>,
    link_task_details: bool,
    max_cache_size: i64,
}

#[napi]
impl NxCache {
    #[napi(constructor)]
    pub fn new(
        workspace_root: String,
        cache_path: String,
        db_connection: External<NxDbConnection>,
        link_task_details: Option<bool>,
        max_cache_size: Option<i64>,
    ) -> anyhow::Result<Self> {
        let cache_path = PathBuf::from(&cache_path);

        create_dir_all(&cache_path)?;
        create_dir_all(cache_path.join("terminalOutputs"))?;

        let max_cache_size = max_cache_size.unwrap_or(0);

        let r = Self {
            db: db_connection,
            workspace_root: PathBuf::from(workspace_root),
            cache_directory: cache_path.to_normalized_string(),
            cache_path,
            link_task_details: link_task_details.unwrap_or(true),
            max_cache_size,
        };

        r.setup()?;

        Ok(r)
    }

    fn setup(&self) -> anyhow::Result<()> {
        let query = if self.link_task_details {
            "CREATE TABLE IF NOT EXISTS cache_outputs (
                    hash    TEXT PRIMARY KEY NOT NULL,
                    code   INTEGER NOT NULL,
                    size   INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (hash) REFERENCES task_details (hash)
              );
            "
        } else {
            "CREATE TABLE IF NOT EXISTS cache_outputs (
                    hash    TEXT PRIMARY KEY NOT NULL,
                    code   INTEGER NOT NULL,
                    size   INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                "
        };

        self.db.execute(query, []).map_err(anyhow::Error::from)?;
        Ok(())
    }

    #[napi]
    pub fn get(&mut self, hash: String) -> anyhow::Result<Option<CachedResult>> {
        let start = Instant::now();
        trace!("GET {}", &hash);
        let task_dir = self.cache_path.join(&hash);

        let terminal_output_path = self.get_task_outputs_path_internal(&hash);

        let r = self
            .db
            .query_row(
                "UPDATE cache_outputs
                    SET accessed_at = CURRENT_TIMESTAMP
                    WHERE hash = ?1
                    RETURNING code, size",
                params![hash],
                |row| {
                    let code: i16 = row.get(0)?;
                    let size: i64 = row.get(1)?;

                    let start = Instant::now();
                    let terminal_output =
                        read_to_string(terminal_output_path).unwrap_or(String::from(""));
                    trace!("TIME reading terminal outputs {:?}", start.elapsed());

                    Ok(CachedResult {
                        code,
                        terminal_output: Some(terminal_output),
                        outputs_path: task_dir.to_normalized_string(),
                        size: Some(size),
                    })
                },
            )
            .map_err(|e| anyhow::anyhow!("Unable to get {}: {:?}", &hash, e))?;
        trace!("GET {} {:?}", &hash, start.elapsed());
        Ok(r)
    }

    #[napi]
    pub fn put(
        &mut self,
        hash: String,
        terminal_output: String,
        outputs: Vec<String>,
        code: i16,
    ) -> anyhow::Result<()> {
        trace!("PUT {}", &hash);
        let task_dir = self.cache_path.join(&hash);

        // Remove the task directory
        //
        trace!("Removing task directory: {:?}", &task_dir);
        remove_items(&[&task_dir])?;
        // Create the task directory again
        trace!("Creating task directory: {:?}", &task_dir);
        create_dir_all(&task_dir)?;

        // Write the terminal outputs into a file
        let task_outputs_path = self.get_task_outputs_path_internal(&hash);
        trace!("Writing terminal outputs to: {:?}", &task_outputs_path);
        let mut total_size: i64 = terminal_output.len() as i64;
        write(task_outputs_path, terminal_output)?;

        // Expand the outputs
        let expanded_outputs = _expand_outputs(&self.workspace_root, outputs)?;

        // Copy the outputs to the cache
        for expanded_output in expanded_outputs.iter() {
            let p = self.workspace_root.join(expanded_output);
            if p.exists() {
                let cached_outputs_dir = task_dir.join(expanded_output);
                trace!("Copying {:?} -> {:?}", &p, &cached_outputs_dir);
                total_size += _copy(p, cached_outputs_dir)?;
            }
        }

        self.record_to_cache(hash, code, total_size)?;
        Ok(())
    }

    #[napi]
    pub fn apply_remote_cache_results(
        &self,
        hash: String,
        result: CachedResult,
        outputs: Option<Vec<String>>,
    ) -> anyhow::Result<()> {
        trace!(
            "applying remote cache results: {:?} ({})",
            &hash,
            &result.outputs_path
        );
        let terminal_output = result.terminal_output.clone().unwrap_or(String::from(""));
        let mut size = terminal_output.len() as i64;
        if let Some(outputs) = outputs {
            if outputs.len() > 0 && result.code == 0 {
                size +=
                    try_and_retry(|| self.copy_files_from_cache(result.clone(), outputs.clone()))?;
            };
        }
        write(self.get_task_outputs_path(hash.clone()), terminal_output)?;

        let code: i16 = result.code;
        self.record_to_cache(hash, code, size)?;
        Ok(())
    }

    fn get_task_outputs_path_internal(&self, hash: &str) -> PathBuf {
        self.cache_path.join("terminalOutputs").join(hash)
    }

    #[napi]
    pub fn get_task_outputs_path(&self, hash: String) -> String {
        self.get_task_outputs_path_internal(&hash)
            .to_normalized_string()
    }

    fn record_to_cache(&self, hash: String, code: i16, size: i64) -> anyhow::Result<()> {
        trace!("Recording to cache: {}, {}, {}", &hash, code, size);
        self.db.execute(
            "INSERT OR REPLACE INTO cache_outputs (hash, code, size) VALUES (?1, ?2, ?3)",
            params![hash, code, size],
        )?;
        if self.max_cache_size != 0 {
            self.ensure_cache_size_within_limit()?
        }
        Ok(())
    }

    #[napi]
    pub fn get_cache_size(&self) -> anyhow::Result<i64> {
        self.db
            .query_row("SELECT SUM(size) FROM cache_outputs", [], |row| {
                row.get::<_, Option<i64>>(0)
                    // If there are no cache entries, the result is
                    // a single row with a NULL value. This would look like:
                    // Ok(None). We need to convert this to Ok(0).
                    .transpose()
                    .unwrap_or(Ok(0))
            })
            // The query_row returns an Result<Option<T>> to account for
            // a query that returned no rows. This isn't possible when using
            // SUM, so we can safely unwrap the Option, but need to transpose
            // to access it. The result represents a db error or mapping error.
            .transpose()
            .unwrap_or(Ok(0))
    }

    fn ensure_cache_size_within_limit(&self) -> anyhow::Result<()> {
        // 0 is equivalent to being unlimited.
        if self.max_cache_size == 0 {
            return Ok(());
        }
        let user_specified_max_cache_size = self.max_cache_size;
        let buffer_amount = (0.1 * user_specified_max_cache_size as f64) as i64;
        let target_cache_size = user_specified_max_cache_size - buffer_amount;

        let full_cache_size = self.get_cache_size()?;
        if user_specified_max_cache_size < full_cache_size {
            let mut cache_size = full_cache_size;
            let mut stmt = self.db.prepare(
                "SELECT hash, size FROM cache_outputs ORDER BY accessed_at ASC LIMIT 100",
            )?;
            'outer: while cache_size > target_cache_size {
                let rows = stmt.query_map([], |r| {
                    let hash: String = r.get(0)?;
                    let size: i64 = r.get(1)?;
                    Ok((hash, size))
                })?;
                for row in rows {
                    if let Ok((hash, size)) = row {
                        cache_size -= size;
                        self.db
                            .execute("DELETE FROM cache_outputs WHERE hash = ?1", params![hash])?;
                        remove_items(&[self.cache_path.join(&hash)])?;
                    }
                    // We've deleted enough cache entries to be under the
                    // target cache size, stop looking for more.
                    if cache_size < target_cache_size {
                        break 'outer;
                    }
                }
            }
        }
        Ok(())
    }

    #[napi]
    pub fn copy_files_from_cache(
        &self,
        cached_result: CachedResult,
        outputs: Vec<String>,
    ) -> anyhow::Result<i64> {
        let outputs_path = Path::new(&cached_result.outputs_path);

        let expanded_outputs = _expand_outputs(outputs_path, outputs)?;

        trace!("Removing expanded outputs: {:?}", &expanded_outputs);
        remove_items(
            expanded_outputs
                .iter()
                .map(|p| self.workspace_root.join(p))
                .collect::<Vec<_>>()
                .as_slice(),
        )?;

        trace!(
            "Copying Files from Cache {:?} -> {:?}",
            &outputs_path,
            &self.workspace_root
        );
        let sz = _copy(outputs_path, &self.workspace_root)?;

        Ok(sz)
    }

    #[napi]
    pub fn remove_old_cache_records(&self) -> anyhow::Result<()> {
        let outdated_cache = self
            .db
            .prepare(
                "DELETE FROM cache_outputs WHERE accessed_at < datetime('now', '-7 days') RETURNING hash",
            )?
            .query_map(params![], |row| {
                let hash: String = row.get(0)?;

                Ok(vec![
                    self.cache_path.join(&hash),
                    self.get_task_outputs_path_internal(&hash),
                ])
            })?
            .filter_map(anyhow::Result::ok)
            .flatten()
            .collect::<Vec<_>>();

        remove_items(&outdated_cache)?;

        Ok(())
    }

    #[napi]
    pub fn check_cache_fs_in_sync(&self) -> anyhow::Result<bool> {
        // Checks that the number of cache records in the database
        // matches the number of cache directories on the filesystem.
        // If they don't match, it means that the cache is out of sync.
        let cache_records_exist = self
            .db
            .query_row("SELECT EXISTS (SELECT 1 FROM cache_outputs)", [], |row| {
                let exists: bool = row.get(0)?;
                Ok(exists)
            })?
            .unwrap_or(false);

        if !cache_records_exist {
            let hash_regex = Regex::new(r"^\d+$").expect("Hash regex is invalid");
            let fs_entries = std::fs::read_dir(&self.cache_path).map_err(anyhow::Error::from)?;

            for entry in fs_entries {
                let entry = entry?;
                let is_dir = entry.file_type()?.is_dir();

                if is_dir {
                    if let Some(file_name) = entry.file_name().to_str() {
                        if hash_regex.is_match(file_name) {
                            return Ok(false);
                        }
                    }
                }
            }

            Ok(true)
        } else {
            Ok(true)
        }
    }
}

#[napi]
fn get_default_max_cache_size(cache_path: String) -> i64 {
    let disks = Disks::new_with_refreshed_list();
    let cache_path = PathBuf::from(cache_path);

    for disk in disks.list() {
        if cache_path.starts_with(disk.mount_point()) {
            return (disk.total_space() as f64 * 0.1) as i64;
        }
    }

    // Default to 100gb
    100 * 1024 * 1024 * 1024
}

fn try_and_retry<T, F>(mut f: F) -> anyhow::Result<T>
where
    F: FnMut() -> anyhow::Result<T>,
{
    let mut attempts = 0;
    // Generate a random number between 2 and 4 to raise to the power of attempts
    let base_exponent = rand::random::<f64>() * 2.0 + 2.0;
    let base_timeout = 15;

    loop {
        attempts += 1;
        match f() {
            Ok(result) => return Ok(result),
            Err(e) => {
                // Max time is 15 * (4 + 4² + 4³ + 4⁴ + 4⁵) = 20460ms
                if attempts == 6 {
                    // After enough attempts, throw the error
                    return Err(e);
                }
                let timeout = base_timeout as f64 * base_exponent.powi(attempts);
                std::thread::sleep(std::time::Duration::from_millis(timeout as u64));
            }
        }
    }
}
