//! The daemon's record of each task's outputs, so a run can tell whether the
//! files on disk are still the ones the cache holds and skip copying them
//! back. A file stands while its `(mtime, size)` matches the record: watch
//! events only keep the index's listings current, so a late event for a
//! task's own write, or a rescan, cannot drop a record.

use std::fs::Metadata;
use std::path::Path;

use dashmap::DashMap;
use hashbrown::HashMap;
use rayon::prelude::*;
use tracing::trace;

use crate::native::cache::expand_outputs::get_files_for_outputs_via;
use crate::native::glob::glob_transform::partition_glob;
use crate::native::hasher::hash_file_path;
use crate::native::utils::Normalize;
use crate::native::walker::walk_reaches;
use crate::native::workspace::ignored_index::{
    FileStamp, IgnoredIndex, IgnoredIndexReader, now_secs, stamp_of,
};

#[napi(object)]
pub struct TaskOutputs {
    pub outputs: Vec<String>,
    pub hash: String,
    /// What the cache just wrote or restored for these outputs. Recorded as
    /// given, without walking, where `given_covers` allows.
    pub files: Option<Vec<OutputFile>>,
}

/// A workspace-relative file with the stamp it was left with.
#[napi(object)]
pub struct OutputFile {
    pub path: String,
    /// `<mtime nanos>:<size>`, a string because the nanoseconds do not fit a
    /// JavaScript number.
    pub stamp: String,
}

impl OutputFile {
    pub(crate) fn new(path: String, metadata: &Metadata) -> Self {
        let (mtime, size) = stamp_of(metadata);
        Self {
            path,
            stamp: format!("{mtime}:{size}"),
        }
    }

    fn stamp(&self) -> Option<FileStamp> {
        let (mtime, size) = self.stamp.split_once(':')?;
        Some((mtime.parse().ok()?, size.parse().ok()?))
    }
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

/// The path an output is read from, as `get_files_for_outputs_via` resolves
/// it: one that exists as written, with `/` separators, else the root of the
/// glob.
fn read_root(root: &Path, output: &str) -> String {
    if root.join(output).exists() {
        Path::new(output).to_normalized_string()
    } else {
        partition_glob(output).0
    }
}

/// Whether what the cache copies for `outputs` covers every file a check
/// reads, where a check reads each directory whole. The cache honours a
/// negation, does not follow a link on a glob's path, and never walks into
/// what `walk_reaches` vetoes, so any of those falls back to a walk. The
/// workspace root is never trusted, as a copy walks it with vetoes a check
/// does not apply to its start. A missing path is trusted: both sides are
/// empty.
fn given_covers(root: &Path, canonical_root: Option<&Path>, outputs: &[String]) -> bool {
    outputs.iter().all(|output| {
        // The cache reads a path with glob syntax as a glob even where it
        // exists as written, so it can copy less than a check reads.
        if output.starts_with('!')
            || (root.join(output).exists() && partition_glob(output).1.is_some())
        {
            return false;
        }
        let dir = read_root(root, output);
        let full = root.join(&dir);
        walk_reaches(root, "", &dir)
            && (std::fs::symlink_metadata(&full).is_err()
                || canonical_root.is_some_and(|canonical_root| {
                    dunce::canonicalize(&full).is_ok_and(|real| real == canonical_root.join(&dir))
                }))
    })
}

/// The files of `given` that `outputs` names, each with its stamp. A file
/// output left out of `given` is stat'ed.
fn expand_given(
    root: &Path,
    outputs: &[String],
    given: Vec<OutputFile>,
) -> Option<Vec<(String, FileStamp)>> {
    let stamps: HashMap<String, FileStamp> = given
        .into_iter()
        .filter_map(|file| Some((file.stamp()?, file.path)))
        .map(|(stamp, path)| (path, stamp))
        .collect();
    let paths = get_files_for_outputs_via(root, outputs.to_vec(), &|dir| {
        Some(
            stamps
                .keys()
                .filter(|path| walk_reaches(root, dir, path))
                .cloned()
                .collect(),
        )
    })
    .ok()?;
    Some(
        paths
            .into_iter()
            .filter_map(|path| {
                let stamp = match stamps.get(&path) {
                    Some(stamp) => *stamp,
                    None => stamp_of(&std::fs::metadata(root.join(&path)).ok()?),
                };
                Some((path, stamp))
            })
            .collect(),
    )
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
    /// Remembers each task's outputs: the files it was given, or else what is
    /// on disk now.
    pub(crate) fn record(
        &self,
        root: &Path,
        reader: &IgnoredIndexReader,
        entries: Vec<TaskOutputs>,
    ) {
        for entry in &entries {
            for output in entry.outputs.iter().filter(|o| !o.starts_with('!')) {
                let dir = read_root(root, output);
                if !root.join(&dir).is_file() {
                    reader.track(root, &dir);
                }
            }
        }
        let canonical_root = dunce::canonicalize(root).ok();
        let entries: Vec<_> = entries
            .into_iter()
            .map(|mut entry| {
                let given = entry
                    .files
                    .take()
                    .filter(|_| given_covers(root, canonical_root.as_deref(), &entry.outputs));
                (entry, given)
            })
            .collect();
        if entries.iter().any(|(_, given)| given.is_none()) {
            reader.catch_up();
        }
        let index = reader.index();
        entries.into_par_iter().for_each(|(entry, given)| {
            let stamped = match given {
                Some(given) => expand_given(root, &entry.outputs, given),
                // Read from disk: the watch may not have delivered the task's
                // own writes yet, and a listing missing them would record too
                // little.
                None => expand(root, index, &entry.outputs, false).map(|paths| {
                    paths
                        .into_par_iter()
                        .filter_map(|path| {
                            let stamp = stamp_of(&std::fs::metadata(root.join(&path)).ok()?);
                            Some((path, stamp))
                        })
                        .collect()
                }),
            };
            let Some(stamped) = stamped else {
                self.records.remove(&key(&entry.outputs));
                return;
            };
            let made_at = now_secs();
            let files = stamped
                .into_par_iter()
                .map(|(path, stamp)| {
                    let content = needs_content(stamp, made_at)
                        .then(|| hash_file_path(root.join(&path)))
                        .flatten();
                    RecordedFile {
                        path,
                        stamp,
                        content,
                    }
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
    use std::sync::atomic::{AtomicUsize, Ordering};
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
        counted().0
    }

    /// A reader that counts its catch-ups.
    fn counted() -> (IgnoredIndexReader, Arc<AtomicUsize>) {
        let delivers_under: crate::native::workspace::ignored_index::DeliversUnder =
            Arc::new(|path: &str| !path.starts_with("node_modules"));
        let count = Arc::new(AtomicUsize::new(0));
        let counter = Arc::clone(&count);
        let reader = IgnoredIndexReader::new(
            Arc::new(IgnoredIndex::new(Some(Watch { delivers_under }))),
            Arc::new(move || {
                counter.fetch_add(1, Ordering::SeqCst);
            }),
        );
        (reader, count)
    }

    fn entry(outputs: &[&str], hash: &str) -> TaskOutputs {
        TaskOutputs {
            outputs: outputs.iter().map(|o| o.to_string()).collect(),
            hash: hash.to_string(),
            files: None,
        }
    }

    fn given(temp: &TempDir, paths: &[&str]) -> Vec<OutputFile> {
        paths
            .iter()
            .map(|path| {
                let metadata = std::fs::metadata(temp.path().join(path)).unwrap();
                OutputFile::new(path.to_string(), &metadata)
            })
            .collect()
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

    #[test]
    fn a_given_file_list_is_recorded_as_given() {
        let temp = workspace();
        let (records, reader) = (OutputRecords::default(), watched());
        let files = ["dist/app/a.txt", "dist/app/b.md", "dist/app/c.html"];
        let record = |files: Vec<OutputFile>| {
            records.record(
                temp.path(),
                &reader,
                vec![TaskOutputs {
                    files: Some(files),
                    ..entry(&["dist/app"], "h1")
                }],
            )
        };

        record(given(&temp, &files));
        assert!(check(&records, &temp, &reader, &["dist/app"], "h1"));

        // The stamps are taken as given, not read again.
        let mut stale = given(&temp, &files);
        stale[0].stamp = "0:0".to_string();
        record(stale);
        assert!(!check(&records, &temp, &reader, &["dist/app"], "h1"));
    }

    #[test]
    fn a_given_file_list_keeps_only_what_a_walk_lists() {
        let temp = workspace();
        for file in ["dist/app/node_modules/dep.js", "dist/other/d.txt"] {
            temp.child(file).write_str(file).unwrap();
        }
        let (records, reader) = (OutputRecords::default(), watched());
        records.record(
            temp.path(),
            &reader,
            vec![TaskOutputs {
                files: Some(given(
                    &temp,
                    &[
                        "dist/app/a.txt",
                        "dist/app/b.md",
                        "dist/app/c.html",
                        "dist/app/node_modules/dep.js",
                        "dist/other/d.txt",
                    ],
                )),
                ..entry(&["dist/app"], "h1")
            }],
        );
        assert!(check(&records, &temp, &reader, &["dist/app"], "h1"));
    }

    #[test]
    fn a_given_file_list_that_a_negation_trimmed_is_not_trusted() {
        let temp = workspace();
        temp.child("dist/app/cache/x.bin").write_str("x").unwrap();
        let (records, reader) = (OutputRecords::default(), watched());
        let outputs = ["dist/app", "!dist/app/cache"];
        // What `put` copies: the cache honours the negation.
        records.record(
            temp.path(),
            &reader,
            vec![TaskOutputs {
                files: Some(given(
                    &temp,
                    &["dist/app/a.txt", "dist/app/b.md", "dist/app/c.html"],
                )),
                ..entry(&outputs, "h1")
            }],
        );
        assert!(check(&records, &temp, &reader, &outputs, "h1"));
    }

    #[test]
    fn a_given_file_list_is_trusted_only_where_it_covers_what_a_check_reads() {
        let temp = workspace();
        let canonical_root = dunce::canonicalize(temp.path()).unwrap();
        let covers = |outputs: &[&str]| {
            given_covers(
                temp.path(),
                Some(&canonical_root),
                &outputs.iter().map(|o| o.to_string()).collect::<Vec<_>>(),
            )
        };
        assert!(covers(&["dist/app", "dist/app/*.txt", "dist/not-yet"]));
        assert!(!covers(&["dist/app", "!dist/app/cache"]));
        assert!(!covers(&["node_modules/pkg/dist/*.js"]));
        assert!(!covers(&["*.txt"]));
        std::fs::create_dir_all(temp.path().join("app/[id]")).unwrap();
        assert!(!covers(&["app/[id]"]));
        #[cfg(unix)]
        {
            let link = |target: &str, link: &str| {
                std::os::unix::fs::symlink(temp.path().join(target), temp.path().join(link))
                    .unwrap()
            };
            link("dist/app", "dist/link");
            assert!(!covers(&["dist/link"]));
            assert!(!covers(&["dist/link/*.txt"]));
            // A link above the output, not only at it.
            link("dist", "out");
            assert!(!covers(&["out/app/*.txt"]));
            assert!(covers(&["out/not-yet"]));
        }
    }

    #[test]
    fn a_batch_mixing_trusted_and_walked_entries_records_both() {
        let temp = workspace();
        temp.child("dist/other/cache/x.bin").write_str("x").unwrap();
        temp.child("dist/other/d.txt").write_str("d").unwrap();
        let (records, (reader, catch_ups)) = (OutputRecords::default(), counted());
        let walked = ["dist/other", "!dist/other/cache"];
        // The trusted list leaves out a file on disk, to show it was used.
        let trusted = || TaskOutputs {
            files: Some(given(&temp, &["dist/app/a.txt", "dist/app/b.md"])),
            ..entry(&["dist/app"], "h1")
        };
        records.record(
            temp.path(),
            &reader,
            vec![
                trusted(),
                TaskOutputs {
                    files: Some(given(&temp, &["dist/other/d.txt"])),
                    ..entry(&walked, "h2")
                },
            ],
        );
        assert_eq!(catch_ups.load(Ordering::SeqCst), 1);
        assert!(!check(&records, &temp, &reader, &["dist/app"], "h1"));
        assert!(check(&records, &temp, &reader, &walked, "h2"));

        let before = catch_ups.load(Ordering::SeqCst);
        records.record(temp.path(), &reader, vec![trusted()]);
        assert_eq!(catch_ups.load(Ordering::SeqCst), before);
    }

    // `\` is not a glob escape on Windows until #37215.
    #[cfg(unix)]
    #[test]
    fn an_escaped_output_is_read_where_its_escapes_resolve() {
        let temp = workspace();
        temp.child("app/[id]/page.js").write_str("page").unwrap();
        let (records, reader) = (OutputRecords::default(), watched());
        let outputs = ["app/\\[id\\]"];
        records.record(
            temp.path(),
            &reader,
            vec![TaskOutputs {
                files: Some(given(&temp, &["app/[id]/page.js"])),
                ..entry(&outputs, "h1")
            }],
        );
        assert!(check(&records, &temp, &reader, &outputs, "h1"));
        temp.child("app/[id]/page.js").write_str("edited").unwrap();
        assert!(!check(&records, &temp, &reader, &outputs, "h1"));
    }

    #[cfg(windows)]
    #[test]
    fn a_backslash_output_that_exists_is_read_as_its_path() {
        let temp = workspace();
        let (records, reader) = (OutputRecords::default(), watched());
        records.record(
            temp.path(),
            &reader,
            vec![TaskOutputs {
                files: Some(given(
                    &temp,
                    &["dist/app/a.txt", "dist/app/b.md", "dist/app/c.html"],
                )),
                ..entry(&["dist\\app"], "h1")
            }],
        );
        assert!(check(&records, &temp, &reader, &["dist\\app"], "h1"));
        std::fs::remove_file(temp.path().join("dist/app/a.txt")).unwrap();
        assert!(!check(&records, &temp, &reader, &["dist\\app"], "h1"));
    }
}
