use std::fs::{
    create_dir_all, metadata, read_dir, read_to_string, remove_file, symlink_metadata, write,
};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime};
use tracing::{debug, trace};

use fs_extra::remove_items;
use rayon::prelude::*;
use regex::Regex;

use crate::native::cache::expand_outputs::{_expand_outputs, all_literal, normalize_outputs};
use crate::native::cache::file_ops::{copy_and_list, copy_outputs_into_workspace};
use crate::native::db::connection::{DbValue, NxDbConnection};
use crate::native::utils::Normalize;
use crate::native::workspace::outputs_tracking::OutputFile;
use napi::bindgen_prelude::External;
use std::sync::{Arc, Mutex};

/// What `put` copied into the cache.
#[napi(object)]
pub struct CachedOutputs {
    /// The output entries that exist, as `expand_outputs` finds them.
    pub expanded_outputs: Vec<String>,
    /// Each file copied, stamped as it is in the workspace.
    pub files: Vec<OutputFile>,
}

/// Each workspace file in `paths` as it is now. Only a regular file, or a
/// link to one, is kept: nothing else is an output file to stamp.
fn stamp_all<'a>(
    workspace_root: &Path,
    paths: impl ParallelIterator<Item = &'a PathBuf>,
) -> Vec<OutputFile> {
    paths
        .filter_map(|path| {
            let relative = path.strip_prefix(workspace_root).ok()?;
            let metadata = std::fs::metadata(path).ok()?;
            metadata
                .is_file()
                .then(|| OutputFile::new(relative.to_normalized_string(), &metadata))
        })
        .collect()
}

/// Batch logs older than this are swept. Matches `remove_old_cache_records`.
const BATCH_OUTPUT_MAX_AGE: Duration = Duration::from_secs(7 * 24 * 60 * 60);
/// Budget for `batchOutputs/`, separate from `maxCacheSize`.
const BATCH_OUTPUT_MAX_BYTES: u64 = 1024 * 1024 * 1024;
/// How recently a log must have been written to count as live.
const BATCH_OUTPUT_MIN_EVICTION_AGE: Duration = Duration::from_secs(60 * 60);

/// One directory, one file per batch — keyed by the batch rather than a
/// task hash, since one worker produces one log and the hash of any task in
/// it is still preliminary while it runs. Mirrored by
/// `batchOutputPathForKey` in tasks-runner/cache.ts, which writes them.
fn batch_outputs_path(cache_path: &str) -> PathBuf {
    PathBuf::from(cache_path).join("batchOutputs")
}

/// A free function, not a method: `BatchProcess` writes these logs whichever
/// cache implementation is active, so the sweep must not be reachable only
/// through the DB-backed one.
///
/// Deletes batch logs by age, then oldest-first while the directory is over
/// budget.
///
/// No database rows: nothing looks a batch log up by key, so a row would be
/// write-only bookkeeping that a hard-killed process could skip, orphaning
/// the file forever. The filesystem cannot drift from itself, and the file
/// is appended to for the life of its batch, so a size recorded anywhere
/// else is wrong until that batch ends.
///
/// The budget is separate from `maxCacheSize` on purpose: these are debug
/// artifacts, and sharing a budget would let one evict a replayable cache
/// entry — trading a rebuild for a text file.
///
/// The age sweep deletes at `BATCH_OUTPUT_MAX_AGE`; the eviction skips
/// anything written within `BATCH_OUTPUT_MIN_EVICTION_AGE`. That is
/// last-write, not creation, so a batch silent through a long quiet phase is
/// not protected.
#[napi]
pub fn sweep_batch_outputs(cache_path: String) -> anyhow::Result<()> {
    sweep_batch_outputs_with(
        &batch_outputs_path(&cache_path),
        SystemTime::now(),
        BATCH_OUTPUT_MAX_AGE,
        BATCH_OUTPUT_MAX_BYTES,
        BATCH_OUTPUT_MIN_EVICTION_AGE,
    )
}

/// The sweep proper, with its thresholds as parameters. Split out so tests can
/// drive the eviction path without writing a gigabyte, and pin the age window
/// without waiting a week.
fn sweep_batch_outputs_with(
    dir: &Path,
    now: SystemTime,
    max_age: Duration,
    max_bytes: u64,
    min_eviction_age: Duration,
) -> anyhow::Result<()> {
    // `read_dir` opens through `opendir(2)`, which follows a symlink on the
    // directory itself - so without this a `batchOutputs` symlinked elsewhere
    // would have that directory's aged files deleted instead. The per-entry
    // handling below already refuses to follow a link; this is the one hop it
    // cannot see. `~/.nx` is writable by anything sharing our uid, which is why
    // `probeWritable` opens with `wx` for the same reason.
    if symlink_metadata(dir).map(|m| !m.is_dir()).unwrap_or(true) {
        return Ok(());
    }

    let entries = match read_dir(dir) {
        Ok(entries) => entries,
        // Nothing has captured a batch log yet.
        Err(_) => return Ok(()),
    };

    let mut files: Vec<(PathBuf, u64, SystemTime)> = Vec::new();
    for entry in entries.flatten() {
        // From the dirent, so a symlink is neither followed for its age nor
        // counted as a file.
        if !entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
            continue;
        }
        let path = entry.path();
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let Ok(modified) = metadata.modified() else {
            continue;
        };
        let age = now.duration_since(modified).unwrap_or(Duration::ZERO);
        if age > max_age {
            // Racing another Nx process sweeping the same directory is fine.
            let _ = remove_file(&path);
            continue;
        }
        files.push((path, metadata.len(), modified));
    }

    let mut total: u64 = files.iter().map(|(_, size, _)| size).sum();
    if total <= max_bytes {
        return Ok(());
    }

    // Never evict a log young enough to belong to a batch that is still
    // running, possibly in another Nx process. Going over budget recovers on
    // the next sweep; deleting a live batch's only log does not.
    files.retain(|(_, _, modified)| {
        now.duration_since(*modified).unwrap_or(Duration::ZERO) > min_eviction_age
    });
    files.sort_by_key(|(_, _, modified)| *modified);
    for (path, size, _) in files {
        if total <= max_bytes {
            break;
        }
        if remove_file(&path).is_ok() {
            total = total.saturating_sub(size);
        }
    }
    Ok(())
}

#[napi(object)]
#[derive(Clone, Debug)]
pub struct TerminalOutputRecord {
    pub hash: String,
    /// Byte length of the terminal output written for this hash, so these
    /// files are counted against `maxCacheSize` like any other cache content.
    pub size: i64,
}

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
    db: Arc<Mutex<NxDbConnection>>,
    link_task_details: bool,
    max_cache_size: i64,
}

#[napi]
impl NxCache {
    #[napi(constructor)]
    pub fn new(
        workspace_root: String,
        cache_path: String,
        #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] db_connection: &External<
            Arc<Mutex<NxDbConnection>>,
        >,
        // TODO: this is unused by Nx but still required by Nx Cloud
        link_task_details: Option<bool>,
        max_cache_size: Option<i64>,
    ) -> anyhow::Result<Self> {
        let cache_path = PathBuf::from(&cache_path);

        create_dir_all(&cache_path)?;
        create_dir_all(cache_path.join("terminalOutputs"))?;

        let max_cache_size = max_cache_size.unwrap_or(0);

        let r = Self {
            db: Arc::clone(db_connection),
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
        // `is_cache_entry` distinguishes a real cache entry, which owns a
        // `<cacheDir>/<hash>` directory, from a row that exists only so the
        // terminal output of an uncacheable run is reachable by the GC. Only
        // the former may be served as a cache hit, and only while that directory
        // exists — see `get`/`fetch_cache_rows` and `build_cached_result`.
        let query = if self.link_task_details {
            "CREATE TABLE IF NOT EXISTS cache_outputs (
                hash    TEXT PRIMARY KEY NOT NULL,
                code   INTEGER NOT NULL,
                size   INTEGER NOT NULL,
                is_cache_entry BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_cache_entry IN (0, 1)),
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
                is_cache_entry BOOLEAN NOT NULL DEFAULT TRUE CHECK (is_cache_entry IN (0, 1)),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            "
        };

        self.db.lock().unwrap().execute_batch(query)?;
        Ok(())
    }

    #[napi]
    pub fn get(&mut self, hash: String) -> anyhow::Result<Option<CachedResult>> {
        let start = Instant::now();
        trace!("GET {}", &hash);

        // Direct primary-key lookup — cheaper per call than routing through
        // fetch_cache_rows() for a single hash.
        let row_data: Option<(i16, i64)> = self
            .db
            .lock()
            .unwrap()
            .query_row(
                "UPDATE cache_outputs
                    SET accessed_at = CURRENT_TIMESTAMP
                    WHERE hash = ?1 AND is_cache_entry
                    RETURNING code, size",
                &[DbValue::from(hash.as_str())],
            )
            .and_then(|row| {
                row.map(|r| Ok((r.get_i64(0)? as i16, r.get_i64(1)?)))
                    .transpose()
            })
            .map_err(|e| anyhow::anyhow!("Unable to get {}: {:?}", &hash, e))?;

        // Terminal output file read happens AFTER the lock is released.
        let result = row_data.and_then(|(code, size)| self.build_cached_result(&hash, code, size));
        if row_data.is_some() && result.is_none() {
            self.demote_stale_cache_records(std::slice::from_ref(&hash));
        }

        trace!("GET {} {:?}", &hash, start.elapsed());
        Ok(result)
    }

    #[napi]
    /// Batch version of get() that fetches multiple cache entries in a single
    /// SQL query and reads terminal output files in parallel via Rayon.
    pub fn get_batch(&mut self, hashes: Vec<String>) -> anyhow::Result<Vec<Option<CachedResult>>> {
        let start = Instant::now();
        if hashes.is_empty() {
            return Ok(vec![]);
        }

        // 1. One SQL round-trip: look up every hash and bump accessed_at.
        let rows = self.fetch_cache_rows(&hashes)?;

        // 2. For each requested hash, read its terminal output file in
        //    parallel. Misses stay as None so callers can correlate by index.
        let results: Vec<Option<CachedResult>> = hashes
            .par_iter()
            .map(|hash| {
                rows.get(hash)
                    .and_then(|&(code, size)| self.build_cached_result(hash, code, size))
            })
            .collect();

        // 3. A row whose artifacts are gone is a miss above; demote those rows
        //    in one transaction rather than from inside the parallel map.
        let stale: Vec<String> = hashes
            .iter()
            .zip(&results)
            .filter(|(hash, result)| result.is_none() && rows.contains_key(*hash))
            .map(|(hash, _)| hash.clone())
            .collect();
        if !stale.is_empty() {
            self.demote_stale_cache_records(&stale);
        }

        trace!("GET_BATCH {} hashes {:?}", hashes.len(), start.elapsed());
        Ok(results)
    }

    /// Runs one `UPDATE ... RETURNING` across every requested hash and
    /// returns the matching rows keyed by hash.
    ///
    /// Builds an `IN (?,?,?,...)` clause sized to the batch — turso has no
    /// rarray vtable, so the SQL text varies per batch size.
    fn fetch_cache_rows(
        &self,
        hashes: &[String],
    ) -> anyhow::Result<std::collections::HashMap<String, (i16, i64)>> {
        let placeholders = (1..=hashes.len())
            .map(|i| format!("?{}", i))
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "UPDATE cache_outputs SET accessed_at = CURRENT_TIMESTAMP
             WHERE hash IN ({}) AND is_cache_entry
             RETURNING hash, code, size",
            placeholders
        );
        let params: Vec<DbValue> = hashes.iter().map(|h| DbValue::from(h.as_str())).collect();

        let rows = self.db.lock().unwrap().query_rows(&sql, &params)?;
        let map = rows
            .into_iter()
            .filter_map(|row| {
                let hash = row.get_str(0).ok()?;
                let code = row.get_i64(1).ok()? as i16;
                let size = row.get_i64(2).ok()?;
                Some((hash, (code, size)))
            })
            .collect();
        Ok(map)
    }

    /// A cache row can outlive its artifact directory. Serving it as a hit
    /// would skip the task without restoring its outputs.
    fn build_cached_result(&self, hash: &str, code: i16, size: i64) -> Option<CachedResult> {
        let outputs_path = self.cache_path.join(hash);
        if !outputs_path.is_dir() {
            debug!(
                "Cache record {} has no artifacts at {:?}, treating as a miss",
                hash, &outputs_path
            );
            return None;
        }
        let terminal_output =
            read_to_string(self.get_task_outputs_path_internal(hash)).unwrap_or_default();
        Some(CachedResult {
            code,
            terminal_output: Some(terminal_output),
            outputs_path: outputs_path.to_normalized_string(),
            size: Some(size),
        })
    }

    #[napi]
    pub fn put(
        &mut self,
        hash: String,
        terminal_output: String,
        outputs: Vec<String>,
        code: i16,
    ) -> anyhow::Result<CachedOutputs> {
        let start = Instant::now();
        trace!("PUT {}", &hash);
        let task_dir = self.cache_path.join(&hash);

        // Remove the task directory
        //
        trace!("Removing task directory: {:?}", &task_dir);
        remove_items(&[&task_dir])?;
        trace!("Successfully removed task directory: {:?}", &task_dir);

        // Create the task directory again
        trace!("Creating task directory: {:?}", &task_dir);
        create_dir_all(&task_dir)?;
        trace!("Successfully created task directory: {:?}", &task_dir);

        // Write the terminal outputs into a file
        let task_outputs_path = self.get_task_outputs_path_internal(&hash);
        trace!("Writing terminal outputs to: {:?}", &task_outputs_path);
        let mut total_size: i64 = terminal_output.len() as i64;
        write(task_outputs_path, terminal_output)?;
        trace!("Successfully wrote terminal outputs ({} bytes)", total_size);

        // Expand the outputs
        let outputs = normalize_outputs(&self.workspace_root, outputs)?;
        let expanded_outputs = _expand_outputs(&self.workspace_root, outputs)?;
        trace!("Successfully expanded {} outputs", expanded_outputs.len());

        // Copy the outputs to the cache
        let mut copied_files = 0;
        let mut written = vec![];
        for expanded_output in expanded_outputs.iter() {
            let p = self.workspace_root.join(expanded_output);
            if p.exists() {
                let cached_outputs_dir = task_dir.join(expanded_output);
                trace!("Copying {:?} -> {:?}", &p, &cached_outputs_dir);
                let (copied_size, wrote) = copy_and_list(&p, &cached_outputs_dir, None)?;
                written.extend(wrote);
                total_size += copied_size;
                copied_files += 1;
                trace!(
                    "Successfully copied {} ({} bytes)",
                    expanded_output, copied_size
                );
            }
        }
        trace!(
            "Successfully copied {} files, total cache size: {} bytes",
            copied_files, total_size
        );

        self.record_to_cache(hash.clone(), code, total_size)?;
        debug!("PUT {} {:?}", &hash, start.elapsed());
        Ok(CachedOutputs {
            expanded_outputs,
            files: stamp_all(&self.workspace_root, written.par_iter().map(|(src, _)| src)),
        })
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
            &hash, &result.outputs_path
        );
        let terminal_output = result.terminal_output.clone().unwrap_or(String::from(""));
        let mut size = terminal_output.len() as i64;
        if let Some(outputs) = outputs {
            if outputs.len() > 0 && result.code == 0 {
                size += try_and_retry(|| self.restore(result.clone(), outputs.clone()))?.0;
            };
        }
        write(self.get_task_outputs_path(hash.clone()), terminal_output)?;

        let code: i16 = result.code;
        self.record_to_cache(hash, code, size)?;
        Ok(())
    }

    /// Register terminal outputs that were written without a cache entry —
    /// uncacheable tasks, and cacheable ones run with `--skip-nx-cache`.
    ///
    /// Without a row the file is invisible to `remove_old_cache_records`,
    /// which only ever walks hashes it finds in the database, so these files
    /// would accumulate forever. The row carries `is_cache_entry = FALSE` so it
    /// can never be served as a cache hit.
    ///
    /// On conflict `accessed_at` always moves: the reads filter these rows out,
    /// so they would otherwise age from the first write and be collected out
    /// from under a task that is still being run daily. `size` moves only while
    /// the row is still output-only (`NOT is_cache_entry`), so a task rerun with
    /// a longer log stops undercounting against `maxCacheSize`. `is_cache_entry`
    /// is never touched, and a row that already has artifacts keeps the size
    /// `put` recorded, so a rewrite can neither demote a real entry nor replace
    /// its whole-entry size with the terminal output's.
    #[napi]
    pub fn record_terminal_outputs(
        &mut self,
        records: Vec<TerminalOutputRecord>,
    ) -> anyhow::Result<()> {
        if records.is_empty() {
            return Ok(());
        }
        trace!("RECORD_TERMINAL_OUTPUTS {}", records.len());

        {
            let db = self.db.lock().unwrap();
            db.transaction(|db| {
                for record in records.iter() {
                    // `code` is meaningless for a row that can't be replayed;
                    // the reads all filter it out before it could be read.
                    db.execute(
                        // `size` is refreshed only for a row that is still
                        // output-only: a task rerun with a longer log would
                        // otherwise keep its first size forever and undercount
                        // against maxCacheSize. A row with artifacts is owned by
                        // `record_to_cache`, whose size covers the whole entry.
                        "INSERT INTO cache_outputs (hash, code, size, is_cache_entry)
                         VALUES (?1, 0, ?2, FALSE)
                         ON CONFLICT(hash) DO UPDATE SET
                             accessed_at = CURRENT_TIMESTAMP,
                             size = CASE WHEN NOT is_cache_entry THEN excluded.size ELSE size END",
                        &[
                            DbValue::from(record.hash.as_str()),
                            DbValue::Integer(record.size),
                        ],
                    )?;
                }
                Ok(())
            })?;
        }

        if self.max_cache_size != 0 {
            self.ensure_cache_size_within_limit()?;
        }
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
        // `is_cache_entry` is forced back to TRUE on conflict: an earlier
        // uncacheable run of the same hash (`--skip-nx-cache`) may have left a
        // terminal-output-only row, and this run did write the artifacts.
        self.db.lock().unwrap().execute(
            "INSERT INTO cache_outputs (hash, code, size, is_cache_entry) VALUES (?1, ?2, ?3, TRUE)
             ON CONFLICT(hash) DO UPDATE SET code = excluded.code, size = excluded.size, is_cache_entry = TRUE, created_at = CURRENT_TIMESTAMP, accessed_at = CURRENT_TIMESTAMP",
            &[
                DbValue::from(hash.as_str()),
                DbValue::Integer(code as i64),
                DbValue::Integer(size),
            ],
        )?;
        if self.max_cache_size != 0 {
            self.ensure_cache_size_within_limit()?
        }
        Ok(())
    }

    #[napi]
    pub fn get_cache_size(&self) -> anyhow::Result<i64> {
        let row = self
            .db
            .lock()
            .unwrap()
            .query_row("SELECT SUM(size) FROM cache_outputs", &[])?;
        // SUM returns NULL when there are no rows
        match row {
            Some(r) => r.get_i64(0).or(Ok(0)),
            None => Ok(0),
        }
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
            let db = self.db.lock().unwrap();
            'outer: while cache_size > target_cache_size {
                let rows = db.query_rows(
                    "SELECT hash, size FROM cache_outputs ORDER BY accessed_at ASC LIMIT 100",
                    &[],
                )?;
                if rows.is_empty() {
                    break;
                }
                for row in &rows {
                    if let (Ok(hash), Ok(size)) = (row.get_str(0), row.get_i64(1)) {
                        cache_size -= size;
                        db.execute(
                            "DELETE FROM cache_outputs WHERE hash = ?1",
                            &[DbValue::from(hash.as_str())],
                        )?;
                        // Both paths, matching remove_old_cache_records. Dropping
                        // the row without the terminal output file would strand
                        // that file with nothing left to point the GC at it.
                        remove_items(&[
                            self.cache_path.join(&hash),
                            self.get_task_outputs_path_internal(&hash),
                        ])?;
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

    /// Restores `outputs`. Returns each file written, stamped as it is now,
    /// when those are all the output files the workspace now holds: every
    /// output a path, and each one that exists replaced from the cache. A
    /// glob or a negation can leave other matching files in place.
    #[napi]
    pub fn copy_files_from_cache(
        &self,
        cached_result: CachedResult,
        outputs: Vec<String>,
    ) -> anyhow::Result<Option<Vec<OutputFile>>> {
        Ok(self.restore(cached_result, outputs)?.1)
    }

    /// The bytes restored, and the files written when they are all of them.
    fn restore(
        &self,
        cached_result: CachedResult,
        outputs: Vec<String>,
    ) -> anyhow::Result<(i64, Option<Vec<OutputFile>>)> {
        let outputs_path = Path::new(&cached_result.outputs_path);

        let outputs = normalize_outputs(&self.workspace_root, outputs)?;
        let literal = all_literal(&outputs);
        let expanded_outputs = _expand_outputs(outputs_path, outputs.clone())?;

        trace!(
            "Restoring {} outputs from cache {:?} -> {:?}",
            expanded_outputs.len(),
            &outputs_path,
            &self.workspace_root
        );
        let (size, written) =
            copy_outputs_into_workspace(&self.workspace_root, outputs_path, &expanded_outputs)?;
        // Stamped once the copy is done: a link can be written before the
        // file it points to.
        let files = stamp_all(
            &self.workspace_root,
            written.par_iter().map(|(_, dest)| dest),
        );
        let exact = literal && {
            let mut restored = expanded_outputs;
            let mut present = _expand_outputs(&self.workspace_root, outputs)?;
            restored.sort();
            present.sort();
            restored == present
        };
        Ok((size, exact.then_some(files)))
    }

    #[napi]
    pub fn remove_old_cache_records(&self) -> anyhow::Result<()> {
        let rows = self.db.lock().unwrap().query_rows(
            "DELETE FROM cache_outputs WHERE accessed_at < datetime('now', '-7 days') RETURNING hash",
            &[],
        )?;

        let outdated_cache: Vec<_> = rows
            .iter()
            .filter_map(|row| {
                let hash = row.get_str(0).ok()?;
                Some(vec![
                    self.cache_path.join(&hash),
                    self.get_task_outputs_path_internal(&hash),
                ])
            })
            .flatten()
            .collect();

        remove_items(&outdated_cache)?;

        Ok(())
    }

    /// Stop counting a row whose `<cacheDir>/<hash>` directory is gone as a
    /// cache entry: `is_cache_entry` becomes FALSE and `size` the bytes of the
    /// terminal output it still owns, which `remove_old_cache_records` collects
    /// as for any output-only row. Nothing is deleted.
    ///
    /// The directory is checked again inside an immediate transaction: `put`
    /// creates it before `record_to_cache` writes the row, and that write
    /// waits for the lock, so a directory still missing here is not one a
    /// concurrent `put` has just finished. Errors are logged, not returned;
    /// the lookup has already reported the miss.
    fn demote_stale_cache_records(&self, hashes: &[String]) {
        trace!("Demoting {} cache records without artifacts", hashes.len());
        let db = self.db.lock().unwrap();
        let outcome = db.transaction(|conn| {
            for hash in hashes {
                if self.cache_path.join(hash).is_dir() {
                    continue;
                }
                let terminal_output_size = metadata(self.get_task_outputs_path_internal(hash))
                    .map(|m| m.len() as i64)
                    .unwrap_or(0);
                conn.execute(
                    "UPDATE cache_outputs SET is_cache_entry = FALSE, size = ?2
                     WHERE hash = ?1 AND is_cache_entry",
                    &[
                        DbValue::from(hash.as_str()),
                        DbValue::Integer(terminal_output_size),
                    ],
                )?;
            }
            Ok(())
        });
        if let Err(e) = outcome {
            debug!("Unable to demote cache records without artifacts: {e:?}");
        }
    }

    #[napi]
    pub fn check_cache_fs_in_sync(&self) -> anyhow::Result<bool> {
        // Checks that the number of cache records in the database
        // matches the number of cache directories on the filesystem.
        // If they don't match, it means that the cache is out of sync.
        let cache_records_exist = self
            .db
            .lock()
            .unwrap()
            .query_row(
                // Only real cache entries own a `<hash>` directory, so only
                // those can be out of sync with the filesystem.
                "SELECT EXISTS (SELECT 1 FROM cache_outputs WHERE is_cache_entry)",
                &[],
            )?
            .and_then(|r| r.get_i64(0).ok())
            .map(|v| v == 1)
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

/// A tenth of the filesystem that holds `cache_path`, asked of that one
/// filesystem through its nearest existing ancestor (the cache directory may
/// not exist yet). Listing every mounted disk instead costs, on macOS, IOKit
/// and CacheDelete round trips per mount on the thread that is about to run
/// tasks, and those stall while disk images attach or detach.
#[napi]
fn get_default_max_cache_size(cache_path: String) -> i64 {
    for directory in Path::new(&cache_path).ancestors() {
        match fs4::total_space(directory) {
            Ok(total) => return (total as f64 * 0.1) as i64,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => {
                debug!(
                    "Could not read the filesystem size of {}: {error}",
                    directory.display()
                );
                break;
            }
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

#[cfg(test)]
mod test {
    use super::*;

    use assert_fs::TempDir;
    use std::fs::{File, create_dir_all};
    use std::time::Duration;

    fn write_log(dir: &Path, name: &str, bytes: usize, age: Duration) -> PathBuf {
        create_dir_all(dir).unwrap();
        let path = dir.join(name);
        std::fs::write(&path, vec![b'x'; bytes]).unwrap();
        let mtime = SystemTime::now() - age;
        File::options()
            .write(true)
            .open(&path)
            .unwrap()
            .set_modified(mtime)
            .unwrap();
        path
    }

    const HOUR: Duration = Duration::from_secs(3600);

    fn sweep(dir: &Path, max_bytes: u64) {
        sweep_batch_outputs_with(dir, SystemTime::now(), 7 * 24 * HOUR, max_bytes, HOUR).unwrap();
    }

    #[test]
    fn sweep_batch_outputs_is_a_noop_without_the_directory() {
        let temp = TempDir::new().unwrap();
        // Nothing has captured a batch log yet; this runs on every command.
        sweep_batch_outputs(temp.path().to_str().unwrap().to_string()).unwrap();
    }

    #[test]
    fn sweep_batch_outputs_deletes_by_age() {
        let temp = TempDir::new().unwrap();
        let old = write_log(temp.path(), "old.log", 16, 8 * 24 * HOUR);
        let fresh = write_log(temp.path(), "fresh.log", 16, Duration::from_secs(30));

        sweep(temp.path(), u64::MAX);

        assert!(
            !old.exists(),
            "a log past the age limit should be collected"
        );
        assert!(fresh.exists(), "a log inside the window should survive");
    }

    #[test]
    fn sweep_batch_outputs_evicts_oldest_first_to_the_budget() {
        let temp = TempDir::new().unwrap();
        let oldest = write_log(temp.path(), "a.log", 100, 5 * HOUR);
        let middle = write_log(temp.path(), "b.log", 100, 4 * HOUR);
        let newest = write_log(temp.path(), "c.log", 100, 3 * HOUR);

        // 300 bytes present, budget 150: the two oldest go.
        sweep(temp.path(), 150);

        assert!(!oldest.exists());
        assert!(!middle.exists());
        assert!(
            newest.exists(),
            "eviction stops as soon as it is under budget"
        );
    }

    #[test]
    fn sweep_batch_outputs_will_not_evict_a_log_a_live_batch_may_still_hold() {
        let temp = TempDir::new().unwrap();
        // Far over budget, but written seconds ago - a running batch appends to
        // its log for the life of the batch, possibly from another Nx process,
        // so evicting this loses the only copy of a run still going.
        let live = write_log(temp.path(), "live.log", 500, Duration::from_secs(5));
        let stale = write_log(temp.path(), "stale.log", 500, 3 * HOUR);

        sweep(temp.path(), 100);

        assert!(live.exists(), "a log written within the hour is off limits");
        assert!(!stale.exists(), "an older one over budget still goes");
    }

    #[cfg(unix)]
    #[test]
    fn sweep_batch_outputs_will_not_follow_a_symlinked_directory() {
        let temp = TempDir::new().unwrap();
        // What an agent confined to `~/.nx` can plant: `batchOutputs` pointing
        // somewhere it was never granted. Following it would delete that
        // directory's aged files instead of our own.
        let victim = temp.path().join("victim");
        let aged = write_log(&victim, "secrets.env", 16, 8 * 24 * HOUR);
        let link = temp.path().join("batchOutputs");
        std::os::unix::fs::symlink(&victim, &link).unwrap();

        sweep(&link, u64::MAX);

        assert!(
            aged.exists(),
            "a symlinked sweep root must be refused, not walked"
        );
    }

    #[cfg(unix)]
    #[test]
    fn normalize_outputs_relativizes_in_workspace_absolute_paths() {
        let ws = Path::new("/ws/root");
        let out = normalize_outputs(
            ws,
            vec!["dist".to_string(), "/ws/root/build/app".to_string()],
        )
        .unwrap();
        assert_eq!(out, vec!["dist".to_string(), "build/app".to_string()]);
    }

    #[cfg(unix)]
    #[test]
    fn normalize_outputs_errors_on_paths_outside_workspace() {
        let ws = Path::new("/ws/root");
        // Absolute path outside the workspace.
        assert!(normalize_outputs(ws, vec!["/etc/cron.d/evil".to_string()]).is_err());
        // Relative path climbing out via `..`.
        assert!(normalize_outputs(ws, vec!["../../escape".to_string()]).is_err());
        // A valid output alongside an escaping one still errors.
        assert!(
            normalize_outputs(ws, vec!["dist".to_string(), "../../escape".to_string()]).is_err()
        );
    }

    #[cfg(windows)]
    #[test]
    fn normalize_outputs_relativizes_in_workspace_absolute_paths() {
        let ws = Path::new(r"C:\ws\root");
        // A drive-letter absolute path inside the workspace is relativized and
        // its separators normalized to forward slashes.
        let out = normalize_outputs(
            ws,
            vec!["dist".to_string(), r"C:\ws\root\build\app".to_string()],
        )
        .unwrap();
        assert_eq!(out, vec!["dist".to_string(), "build/app".to_string()]);
    }

    #[test]
    fn normalize_outputs_keeps_escapes_in_relative_outputs() {
        let ws = Path::new(if cfg!(windows) {
            r"C:\ws\root"
        } else {
            "/ws/root"
        });
        let outputs = vec![
            r"app/\(group\)/**".to_string(),
            r"dist/\[id\].js".to_string(),
        ];
        assert_eq!(normalize_outputs(ws, outputs.clone()).unwrap(), outputs);
    }

    #[cfg(windows)]
    #[test]
    fn normalize_outputs_errors_on_paths_outside_workspace() {
        let ws = Path::new(r"C:\ws\root");
        // Absolute path on the same drive but outside the workspace.
        assert!(normalize_outputs(ws, vec![r"C:\Windows\System32".to_string()]).is_err());
        // Absolute path on a different drive.
        assert!(normalize_outputs(ws, vec![r"D:\elsewhere".to_string()]).is_err());
        // Relative path climbing out via `..`.
        assert!(normalize_outputs(ws, vec![r"..\..\escape".to_string()]).is_err());
        // A valid output alongside an escaping one still errors.
        assert!(
            normalize_outputs(ws, vec!["dist".to_string(), r"..\..\escape".to_string()]).is_err()
        );
    }

    /// A cache over `db` and `cache_dir` with its workspace at `workspace`.
    /// Two caches can share `db` (two Nx processes in one workspace) or only
    /// `cache_dir` (two workspaces on one cache directory).
    fn cache_with(workspace: &Path, db: &Path, cache_dir: &Path) -> NxCache {
        create_dir_all(workspace).unwrap();
        let db = crate::native::db::initialize::initialize_db(db).unwrap();
        NxCache::new(
            workspace.to_str().unwrap().to_string(),
            cache_dir.to_str().unwrap().to_string(),
            &External::new(Arc::new(Mutex::new(db))),
            None,
            None,
        )
        .unwrap()
    }

    /// A workspace, a cache directory and a database of its own under `temp`.
    fn cache_in(temp: &TempDir) -> NxCache {
        cache_with(
            &temp.path().join("workspace"),
            &temp.path().join("test.db"),
            &temp.path().join("cache"),
        )
    }

    /// `cache_outputs.hash` references `task_details`, which Nx fills in
    /// before it stores a task.
    fn record_task(cache: &NxCache, hash: &str) {
        cache
            .db
            .lock()
            .unwrap()
            .execute(
                "INSERT OR IGNORE INTO task_details (hash, project, target) VALUES (?1, 'app', 'build')",
                &[DbValue::from(hash)],
            )
            .unwrap();
    }

    /// Builds one output file for `hash` in the workspace and stores it with
    /// the terminal output `log`.
    fn put_output(cache: &mut NxCache, hash: &str) {
        record_task(cache, hash);
        let output = cache.workspace_root.join("dist").join(hash);
        create_dir_all(&output).unwrap();
        std::fs::write(output.join("main.js"), b"built").unwrap();
        cache
            .put(
                hash.to_string(),
                "log".to_string(),
                vec![format!("dist/{hash}")],
                0,
            )
            .unwrap();
    }

    /// `(is_cache_entry, size)` of the row for `hash`, if there is one.
    fn record_for(cache: &NxCache, hash: &str) -> Option<(bool, i64)> {
        cache
            .db
            .lock()
            .unwrap()
            .query_row(
                "SELECT is_cache_entry, size FROM cache_outputs WHERE hash = ?1",
                &[DbValue::from(hash)],
            )
            .unwrap()
            .map(|row| (row.get_i64(0).unwrap() != 0, row.get_i64(1).unwrap()))
    }

    const LOG_SIZE: i64 = "log".len() as i64;

    #[test]
    fn get_is_a_miss_once_the_artifact_directory_is_gone() {
        let temp = TempDir::new().unwrap();
        let mut cache = cache_in(&temp);
        put_output(&mut cache, "1");
        let hit = cache.get("1".to_string()).unwrap().unwrap();
        assert!(Path::new(&hit.outputs_path).is_dir());
        let (_, stored_size) = record_for(&cache, "1").unwrap();
        assert!(stored_size > LOG_SIZE);

        // The cache directory was emptied, moved or repointed; the database
        // still holds the row.
        std::fs::remove_dir_all(&hit.outputs_path).unwrap();

        assert!(cache.get("1".to_string()).unwrap().is_none());
        // The row now counts only the terminal output it still owns, which
        // stays on disk for `remove_old_cache_records`.
        assert_eq!(record_for(&cache, "1"), Some((false, LOG_SIZE)));
        assert!(cache.get_task_outputs_path_internal("1").is_file());
        assert_eq!(cache.get_cache_size().unwrap(), LOG_SIZE);
        assert!(cache.get("1".to_string()).unwrap().is_none());

        // The task reruns and its next put is a hit again.
        put_output(&mut cache, "1");
        assert!(cache.get("1".to_string()).unwrap().is_some());
        assert_eq!(record_for(&cache, "1"), Some((true, stored_size)));
    }

    #[test]
    fn get_batch_demotes_only_the_records_whose_artifacts_are_gone() {
        let temp = TempDir::new().unwrap();
        let mut cache = cache_in(&temp);
        put_output(&mut cache, "1");
        put_output(&mut cache, "2");
        let (_, stored_size) = record_for(&cache, "1").unwrap();
        std::fs::remove_dir_all(cache.cache_path.join("2")).unwrap();

        let results = cache
            .get_batch(vec!["1".to_string(), "2".to_string(), "3".to_string()])
            .unwrap();

        assert!(results[0].is_some());
        assert!(results[1].is_none());
        assert!(results[2].is_none());
        assert_eq!(record_for(&cache, "1"), Some((true, stored_size)));
        assert_eq!(record_for(&cache, "2"), Some((false, LOG_SIZE)));
        assert_eq!(record_for(&cache, "3"), None);
        assert!(cache.get_task_outputs_path_internal("1").is_file());
        assert!(cache.get_task_outputs_path_internal("2").is_file());
        assert_eq!(cache.get_cache_size().unwrap(), stored_size + LOG_SIZE);
    }

    #[test]
    fn a_task_with_no_outputs_still_hits() {
        let temp = TempDir::new().unwrap();
        let mut cache = cache_in(&temp);
        // `put` creates the directory whether or not anything is copied into
        // it, so the directory check cannot turn these into misses.
        record_task(&cache, "1");
        cache
            .put("1".to_string(), "log".to_string(), vec![], 0)
            .unwrap();

        assert!(cache.get("1".to_string()).unwrap().is_some());
        assert!(cache.get_batch(vec!["1".to_string()]).unwrap()[0].is_some());
    }

    /// `get` and `get_batch` both check the directory in `build_cached_result`
    /// and then call `demote_stale_cache_records`. Runs a `put` from `other`
    /// between the two, as a second Nx process would.
    fn put_between_check_and_cleanup(stale: &mut NxCache, other: &mut NxCache, hash: &str) {
        let (code, size) = stale.fetch_cache_rows(&[hash.to_string()]).unwrap()[hash];
        assert!(stale.build_cached_result(hash, code, size).is_none());
        put_output(other, hash);
        stale.demote_stale_cache_records(&[hash.to_string()]);
    }

    #[test]
    fn cleanup_keeps_a_result_stored_meanwhile_in_a_shared_database() {
        let temp = TempDir::new().unwrap();
        let workspace = temp.path().join("workspace");
        let db = temp.path().join("test.db");
        let cache_dir = temp.path().join("cache");
        // Two Nx processes in one workspace: two connections to one database.
        let mut a = cache_with(&workspace, &db, &cache_dir);
        let mut b = cache_with(&workspace, &db, &cache_dir);
        put_output(&mut a, "1");
        let (_, stored_size) = record_for(&a, "1").unwrap();
        std::fs::remove_dir_all(cache_dir.join("1")).unwrap();

        put_between_check_and_cleanup(&mut a, &mut b, "1");

        // B's row is still a cache entry, and both processes hit it with B's
        // terminal output.
        assert_eq!(record_for(&a, "1"), Some((true, stored_size)));
        let hit = b.get("1".to_string()).unwrap().unwrap();
        assert_eq!(hit.terminal_output.as_deref(), Some("log"));
        assert!(a.get("1".to_string()).unwrap().is_some());
    }

    #[test]
    fn cleanup_keeps_a_result_stored_meanwhile_through_a_separate_database() {
        let temp = TempDir::new().unwrap();
        let cache_dir = temp.path().join("cache");
        // Two workspaces sharing one cache directory, a database each.
        let mut a = cache_with(
            &temp.path().join("a/workspace"),
            &temp.path().join("a/test.db"),
            &cache_dir,
        );
        let mut b = cache_with(
            &temp.path().join("b/workspace"),
            &temp.path().join("b/test.db"),
            &cache_dir,
        );
        put_output(&mut a, "1");
        let (_, stored_size) = record_for(&a, "1").unwrap();
        std::fs::remove_dir_all(cache_dir.join("1")).unwrap();

        put_between_check_and_cleanup(&mut a, &mut b, "1");

        // B's row, directory and terminal output are untouched, and A's row
        // describes a directory that exists again.
        assert_eq!(record_for(&b, "1"), Some((true, stored_size)));
        assert!(cache_dir.join("terminalOutputs").join("1").is_file());
        let hit = b.get("1".to_string()).unwrap().unwrap();
        assert_eq!(hit.terminal_output.as_deref(), Some("log"));
        assert_eq!(record_for(&a, "1"), Some((true, stored_size)));
        assert!(a.get("1".to_string()).unwrap().is_some());
    }
}
