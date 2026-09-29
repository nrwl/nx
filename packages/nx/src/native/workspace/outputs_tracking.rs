//! The daemon's record of each task's outputs, so a run can tell whether the
//! files on disk are still the ones the cache holds and skip copying them
//! back. A file stands while its `(mtime, size)` matches the record: watch
//! events only keep the index's listings current, so a late event for a
//! task's own write, or a rescan, cannot drop a record.

use std::path::Path;

use dashmap::DashMap;
use rayon::prelude::*;
use tracing::trace;

use crate::native::cache::expand_outputs::get_files_for_outputs_via;
use crate::native::glob::glob_transform::partition_glob;
use crate::native::hasher::hash_file_path;
use crate::native::workspace::ignored_index::{
    FileStamp, IgnoredIndex, IgnoredIndexReader, now_secs, stamp_of,
};

#[napi(object)]
pub struct TaskOutputs {
    pub outputs: Vec<String>,
    pub hash: String,
}

#[derive(Default)]
pub(crate) struct OutputRecords {
    /// By the task's output entries, so a new record replaces the last one.
    records: DashMap<String, Recorded>,
}

struct Recorded {
    hash: String,
    /// Sorted by path, as the expansion returns them.
    files: Vec<RecordedFile>,
}

struct RecordedFile {
    path: String,
    stamp: FileStamp,
    /// Kept only when the stamp cannot tell a same-size rewrite apart, see
    /// `needs_content`.
    content: Option<String>,
}

/// A whole-second mtime from the second the record was made could hide a
/// same-size rewrite later that second. Finer mtimes (APFS, ext4, NTFS) show
/// the rewrite, so only a coarse filesystem pays for reading the file.
fn needs_content(stamp: FileStamp, made_at: u64) -> bool {
    stamp.0.is_multiple_of(1_000_000_000) && (stamp.0 / 1_000_000_000) as u64 >= made_at
}

fn key(outputs: &[String]) -> String {
    let mut outputs = outputs.to_vec();
    outputs.sort();
    outputs.dedup();
    outputs.join("\n")
}

/// The existing files `outputs` names. `cached` answers from the index's
/// listings; otherwise every directory is read from disk.
fn expand(
    root: &Path,
    index: &IgnoredIndex,
    outputs: &[String],
    cached: bool,
) -> Option<Vec<String>> {
    get_files_for_outputs_via(root, outputs.to_vec(), &|dir| {
        index.files_under(root, dir, cached, &|_| true)
    })
    .ok()
}

impl OutputRecords {
    /// Remembers each task's outputs as they are on disk now.
    pub(crate) fn record(
        &self,
        root: &Path,
        reader: &IgnoredIndexReader,
        entries: Vec<TaskOutputs>,
    ) {
        for entry in &entries {
            for output in entry.outputs.iter().filter(|o| !o.starts_with('!')) {
                let dir = partition_glob(output).0;
                if !root.join(&dir).is_file() {
                    reader.track(root, &dir);
                }
            }
        }
        reader.catch_up();
        let index = reader.index();
        entries.into_par_iter().for_each(|entry| {
            // Read from disk: the watch may not have delivered the task's own
            // writes yet, and a listing missing them would record too little.
            let Some(paths) = expand(root, index, &entry.outputs, false) else {
                self.records.remove(&key(&entry.outputs));
                return;
            };
            let made_at = now_secs();
            let files = paths
                .into_par_iter()
                .filter_map(|path| {
                    let full_path = root.join(&path);
                    let stamp = stamp_of(&std::fs::metadata(&full_path).ok()?);
                    let content = needs_content(stamp, made_at)
                        .then(|| hash_file_path(&full_path))
                        .flatten();
                    Some(RecordedFile {
                        path,
                        stamp,
                        content,
                    })
                })
                .collect();
            self.records.insert(
                key(&entry.outputs),
                Recorded {
                    hash: entry.hash,
                    files,
                },
            );
        });
    }

    /// Whether each task's outputs are still as last recorded for its hash.
    pub(crate) fn unchanged(
        &self,
        root: &Path,
        reader: &IgnoredIndexReader,
        entries: Vec<TaskOutputs>,
    ) -> Vec<bool> {
        reader.catch_up();
        let index = reader.index();
        entries
            .into_par_iter()
            .map(|entry| {
                let Some(recorded) = self.records.get(&key(&entry.outputs)) else {
                    return false;
                };
                if recorded.hash != entry.hash {
                    return false;
                }
                let same_files = |paths: &[String]| {
                    paths.len() == recorded.files.len()
                        && paths
                            .iter()
                            .zip(&recorded.files)
                            .all(|(path, file)| path == &file.path)
                };
                let listed = expand(root, index, &entry.outputs, true);
                // A listing can lag a write the watch has not delivered, so
                // only the disk may say the set of files changed.
                if !listed.as_deref().is_some_and(same_files)
                    && !expand(root, index, &entry.outputs, false)
                        .as_deref()
                        .is_some_and(same_files)
                {
                    trace!("outputs of {} changed: different files", entry.hash);
                    return false;
                }
                recorded.files.par_iter().all(|file| {
                    let full_path = root.join(&file.path);
                    std::fs::metadata(&full_path)
                        .is_ok_and(|metadata| stamp_of(&metadata) == file.stamp)
                        && file.content.as_ref().is_none_or(|content| {
                            hash_file_path(&full_path).as_ref() == Some(content)
                        })
                })
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    use super::*;
    use crate::native::workspace::ignored_index::Watch;

    fn workspace() -> TempDir {
        let temp = TempDir::new().unwrap();
        for file in [
            "dist/app/a.txt",
            "dist/app/b.md",
            "dist/app/c.html",
            "src/index.ts",
        ] {
            temp.child(file).write_str(file).unwrap();
        }
        temp
    }

    fn watched() -> IgnoredIndexReader {
        let delivers_under: crate::native::workspace::ignored_index::DeliversUnder =
            Arc::new(|path: &str| !path.starts_with("node_modules"));
        IgnoredIndexReader::new(
            Arc::new(IgnoredIndex::new(Some(Watch { delivers_under }))),
            Arc::new(|| {}),
        )
    }

    fn entry(outputs: &[&str], hash: &str) -> TaskOutputs {
        TaskOutputs {
            outputs: outputs.iter().map(|o| o.to_string()).collect(),
            hash: hash.to_string(),
        }
    }

    fn check(
        records: &OutputRecords,
        temp: &TempDir,
        reader: &IgnoredIndexReader,
        outputs: &[&str],
        hash: &str,
    ) -> bool {
        records.unchanged(temp.path(), reader, vec![entry(outputs, hash)])[0]
    }

    fn set_modified(file: &Path, time: SystemTime) {
        std::fs::File::options()
            .write(true)
            .open(file)
            .unwrap()
            .set_modified(time)
            .unwrap();
    }

    #[test]
    fn untouched_outputs_match_their_record() {
        let temp = workspace();
        let (records, reader) = (OutputRecords::default(), watched());
        records.record(temp.path(), &reader, vec![entry(&["dist/app"], "h1")]);
        assert!(check(&records, &temp, &reader, &["dist/app"], "h1"));
    }

    #[test]
    fn another_hash_or_unrecorded_outputs_do_not_match() {
        let temp = workspace();
        let (records, reader) = (OutputRecords::default(), watched());
        records.record(temp.path(), &reader, vec![entry(&["dist/app"], "h1")]);
        assert!(!check(&records, &temp, &reader, &["dist/app"], "h2"));
        assert!(!check(&records, &temp, &reader, &["dist/other"], "h1"));
    }

    #[test]
    fn an_edit_a_new_file_or_a_deletion_is_caught() {
        let temp = workspace();
        let (records, reader) = (OutputRecords::default(), watched());
        let record = |records: &OutputRecords| {
            records.record(temp.path(), &reader, vec![entry(&["dist/app"], "h1")])
        };

        record(&records);
        temp.child("dist/app/a.txt").write_str("edited").unwrap();
        assert!(!check(&records, &temp, &reader, &["dist/app"], "h1"));

        record(&records);
        temp.child("dist/app/new.txt").write_str("new").unwrap();
        // A new file reaches the listing through the watch.
        reader.index().note_written(temp.path(), "dist/app/new.txt");
        assert!(!check(&records, &temp, &reader, &["dist/app"], "h1"));

        record(&records);
        std::fs::remove_file(temp.child("dist/app/b.md").path()).unwrap();
        assert!(!check(&records, &temp, &reader, &["dist/app"], "h1"));
    }

    #[test]
    fn a_same_size_rewrite_is_caught_by_its_mtime() {
        let temp = workspace();
        let (records, reader) = (OutputRecords::default(), watched());
        let file = temp.child("dist/app/a.txt");
        set_modified(file.path(), SystemTime::now() - Duration::from_secs(60));
        records.record(temp.path(), &reader, vec![entry(&["dist/app"], "h1")]);

        file.write_str("dist/app/a.TXT").unwrap();
        assert!(!check(&records, &temp, &reader, &["dist/app"], "h1"));
    }

    #[test]
    fn a_same_second_rewrite_on_a_coarse_filesystem_is_caught_by_content() {
        let temp = workspace();
        let (records, reader) = (OutputRecords::default(), watched());
        let file = temp.child("dist/app/a.txt");
        // A whole-second mtime in the current second, as a coarse filesystem
        // stamps a file the task has just written.
        let second = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let coarse = UNIX_EPOCH + Duration::from_secs(second + 1);
        set_modified(file.path(), coarse);
        records.record(temp.path(), &reader, vec![entry(&["dist/app"], "h1")]);

        file.write_str("dist/app/a.TXT").unwrap();
        set_modified(file.path(), coarse);
        assert!(!check(&records, &temp, &reader, &["dist/app"], "h1"));
    }

    #[test]
    fn a_file_the_glob_does_not_name_is_not_an_output() {
        let temp = workspace();
        let (records, reader) = (OutputRecords::default(), watched());
        let outputs = ["dist/**/*.txt"];
        records.record(temp.path(), &reader, vec![entry(&outputs, "h1")]);

        temp.child("dist/app/unrelated.ts").write_str("x").unwrap();
        reader
            .index()
            .note_written(temp.path(), "dist/app/unrelated.ts");
        assert!(check(&records, &temp, &reader, &outputs, "h1"));
        temp.child("dist/app/another.txt").write_str("x").unwrap();
        reader
            .index()
            .note_written(temp.path(), "dist/app/another.txt");
        assert!(!check(&records, &temp, &reader, &outputs, "h1"));
    }

    #[test]
    fn a_late_event_for_an_unchanged_file_keeps_the_record() {
        let temp = workspace();
        let (records, reader) = (OutputRecords::default(), watched());
        records.record(temp.path(), &reader, vec![entry(&["dist/app"], "h1")]);
        assert!(check(&records, &temp, &reader, &["dist/app"], "h1"));

        reader.index().note_written(temp.path(), "dist/app/a.txt");
        assert!(check(&records, &temp, &reader, &["dist/app"], "h1"));
    }

    #[test]
    fn a_rescan_keeps_records_for_unchanged_outputs() {
        let temp = workspace();
        let (records, reader) = (OutputRecords::default(), watched());
        records.record(temp.path(), &reader, vec![entry(&["dist/app"], "h1")]);
        assert!(check(&records, &temp, &reader, &["dist/app"], "h1"));

        reader.index().reseed(temp.path());
        assert!(check(&records, &temp, &reader, &["dist/app"], "h1"));

        // An edit the watch never reported still counts after the rescan.
        temp.child("dist/app/a.txt")
            .write_str("edited while events were lost")
            .unwrap();
        reader.index().reseed(temp.path());
        assert!(!check(&records, &temp, &reader, &["dist/app"], "h1"));
    }

    #[test]
    fn a_listing_that_lags_a_write_does_not_change_the_answer() {
        let temp = workspace();
        let (records, reader) = (OutputRecords::default(), watched());
        // Listed before the task writes, then written with no event delivered.
        records.record(temp.path(), &reader, vec![entry(&["dist/app"], "h0")]);
        assert!(check(&records, &temp, &reader, &["dist/app"], "h0"));
        temp.child("dist/app/written-by-task.txt")
            .write_str("x")
            .unwrap();

        records.record(temp.path(), &reader, vec![entry(&["dist/app"], "h1")]);
        assert!(check(&records, &temp, &reader, &["dist/app"], "h1"));
    }
}
