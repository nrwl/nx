use std::fs::{create_dir_all, read_to_string, write};
use std::path::{Path, PathBuf};
use std::time::Instant;

use fs_extra::remove_items;
use napi::bindgen_prelude::*;
use regex::Regex;
use rusqlite::{params, Connection, OptionalExtension};
use tracing::trace;

use crate::native::cache::expand_outputs::_expand_outputs;
use crate::native::cache::file_ops::_copy;
use crate::native::utils::Normalize;

#[napi(object)]
#[derive(Default, Clone, Debug)]
pub struct CachedResult {
    pub code: i16,
    pub terminal_output: String,
    pub outputs_path: String,
}

#[napi]
pub struct NxCache {
    pub cache_directory: String,
    workspace_root: PathBuf,
    cache_path: PathBuf,
    db: External<Connection>,
    link_task_details: bool,
}

#[napi]
impl NxCache {
    #[napi(constructor)]
    pub fn new(
        workspace_root: String,
        cache_path: String,
        db_connection: External<Connection>,
        link_task_details: Option<bool>,
    ) -> anyhow::Result<Self> {
        let cache_path = PathBuf::from(&cache_path);

        create_dir_all(&cache_path)?;
        create_dir_all(cache_path.join("terminalOutputs"))?;

        let r = Self {
            db: db_connection,
            workspace_root: PathBuf::from(workspace_root),
            cache_directory: cache_path.to_normalized_string(),
            cache_path,
            link_task_details: link_task_details.unwrap_or(true)
        };

        r.setup()?;

        Ok(r)
    }

    fn setup(&self) -> anyhow::Result<()> {
        let query = if self.link_task_details {
            "BEGIN;
                CREATE TABLE IF NOT EXISTS cache_outputs (
                    hash    TEXT PRIMARY KEY NOT NULL,
                    code   INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (hash) REFERENCES task_details (hash)
                );
                COMMIT;
            "
        } else {
            "BEGIN;
                CREATE TABLE IF NOT EXISTS cache_outputs (
                    hash    TEXT PRIMARY KEY NOT NULL,
                    code   INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                COMMIT;
            "
        };

        self.db
            .execute_batch(
                query,
            )
            .map_err(anyhow::Error::from)
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
                    RETURNING code",
                params![hash],
                |row| {
                    let code: i16 = row.get(0)?;

                    let start = Instant::now();
                    let terminal_output =
                        read_to_string(terminal_output_path).unwrap_or(String::from(""));
                    trace!("TIME reading terminal outputs {:?}", start.elapsed());

                    Ok(CachedResult {
                        code,
                        terminal_output,
                        outputs_path: task_dir.to_normalized_string(),
                    })
                },
            )
            .optional()
            .map_err(anyhow::Error::new)?;
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
        let task_outputs_path: _ = self.get_task_outputs_path_internal(&hash);
        trace!("Writing terminal outputs to: {:?}", &task_outputs_path);
        write(task_outputs_path, terminal_output)?;

        // Expand the outputs
        let expanded_outputs = _expand_outputs(&self.workspace_root, outputs)?;

        // Copy the outputs to the cache
        for expanded_output in expanded_outputs.iter() {
            let p = self.workspace_root.join(expanded_output);
            if p.exists() {
                let cached_outputs_dir = task_dir.join(expanded_output);
                trace!("Copying {:?} -> {:?}", &p, &cached_outputs_dir);
                _copy(p, cached_outputs_dir)?;
            }
        }

        trace!("Recording to cache: {:?}", &hash);
        self.record_to_cache(hash, code)?;
        Ok(())
    }

    #[napi]
    pub fn apply_remote_cache_results(
        &self,
        hash: String,
        result: CachedResult,
    ) -> anyhow::Result<()> {
        let terminal_output = result.terminal_output;
        write(self.get_task_outputs_path(hash.clone()), terminal_output)?;

        let code: i16 = result.code;
        self.record_to_cache(hash, code)?;
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

    fn record_to_cache(&self, hash: String, code: i16) -> anyhow::Result<()> {
        self.db.execute(
            "INSERT INTO cache_outputs
                (hash, code)
                VALUES (?1, ?2)",
            params![hash, code],
        )?;
        Ok(())
    }

    #[napi]
    pub fn copy_files_from_cache(
        &self,
        cached_result: CachedResult,
        outputs: Vec<String>,
    ) -> anyhow::Result<()> {
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
        _copy(outputs_path, &self.workspace_root)?;

        Ok(())
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
                    self.get_task_outputs_path_internal(&hash).into(),
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
        let cache_records_exist = self.db.query_row(
            "SELECT EXISTS (SELECT 1 FROM cache_outputs)",
            [],
            |row| {
                let exists: bool = row.get(0)?;
                Ok(exists)
            },
        )?;

        if !cache_records_exist {
            let hash_regex = Regex::new(r"^\d+$").expect("Hash regex is invalid");
            let fs_entries = std::fs::read_dir(&self.cache_path)
                .map_err(anyhow::Error::from)?;

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
