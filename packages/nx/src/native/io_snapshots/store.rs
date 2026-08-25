use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::IoSnapshotResolution;
use super::bundle::{TaskInputs, TaskIoSnapshot};

pub const BUNDLE_VERSION: u32 = 1;
pub const BUNDLE_FILE: &str = "snapshots.json";

/// One resolved snapshot set, cached per requested commit.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bundle {
    pub version: u32,
    pub resolution: IoSnapshotResolution,
    pub snapshots: BTreeMap<String, TaskIoSnapshot>,
}

pub fn bundle_dir(output_directory: &Path, commit: &str) -> PathBuf {
    output_directory.join(commit)
}

/// Deterministic identity of the snapshot content, independent of which
/// commit it was requested for.
pub fn digest(snapshots: &BTreeMap<String, TaskIoSnapshot>) -> String {
    let canonical = serde_json::to_vec(snapshots).expect("BTreeMap of strings serializes");
    hex::encode(Sha256::digest(canonical))
}

pub fn normalize(snapshots: &mut BTreeMap<String, TaskIoSnapshot>) {
    for snapshot in snapshots.values_mut() {
        match &mut snapshot.inputs {
            TaskInputs::Flat(globs) => sort_unique(globs),
            TaskInputs::Structured(inputs) => {
                inputs.projects.values_mut().for_each(sort_unique);
                sort_unique(&mut inputs.workspace);
                inputs.task_outputs.values_mut().for_each(sort_unique);
            }
        }
        if let Some(task_outputs) = &mut snapshot.task_outputs {
            task_outputs.values_mut().for_each(sort_unique);
        }
        sort_unique(&mut snapshot.outputs);
    }
}

fn sort_unique(values: &mut Vec<String>) {
    values.sort();
    values.dedup();
}

/// Why a bundle directory yielded no bundle; mirrors the TS diagnostic reasons.
#[derive(Debug)]
pub(crate) struct BundleReadError {
    pub reason: &'static str,
    pub file: String,
    pub message: String,
}

static BUNDLE_CACHE: std::sync::LazyLock<
    dashmap::DashMap<PathBuf, (std::time::SystemTime, std::sync::Arc<Bundle>)>,
> = std::sync::LazyLock::new(dashmap::DashMap::new);

/// Parses `<directory>/snapshots.json`, re-reading only when its mtime changes
/// so a long-lived daemon serves repeated requests from memory.
pub(crate) fn read_bundle(directory: &Path) -> Result<std::sync::Arc<Bundle>, BundleReadError> {
    let file = directory.join(BUNDLE_FILE);
    let file_name = file.to_string_lossy().into_owned();
    let mtime = match fs::metadata(&file).and_then(|m| m.modified()) {
        Ok(mtime) => mtime,
        Err(err) => {
            let reason = if err.kind() == io::ErrorKind::NotFound {
                "no-bundle"
            } else {
                "invalid-bundle"
            };
            return Err(BundleReadError {
                reason,
                file: file_name,
                message: err.to_string(),
            });
        }
    };
    if let Some(cached) = BUNDLE_CACHE.get(&file) {
        if cached.0 == mtime {
            return Ok(std::sync::Arc::clone(&cached.1));
        }
    }
    let parsed = fs::File::open(&file)
        .map_err(|e| e.to_string())
        .and_then(|f| {
            serde_json::from_reader::<_, Bundle>(io::BufReader::new(f)).map_err(|e| e.to_string())
        })
        .and_then(|bundle| {
            if bundle.version == BUNDLE_VERSION {
                Ok(bundle)
            } else {
                Err(format!("not a version {BUNDLE_VERSION} snapshot bundle"))
            }
        });
    match parsed {
        Ok(bundle) => {
            let bundle = std::sync::Arc::new(bundle);
            BUNDLE_CACHE.insert(file, (mtime, std::sync::Arc::clone(&bundle)));
            Ok(bundle)
        }
        Err(message) => Err(BundleReadError {
            reason: "invalid-bundle",
            file: file_name,
            message,
        }),
    }
}

pub fn read_resolution(output_directory: &Path, commit: &str) -> Option<IoSnapshotResolution> {
    let file = fs::File::open(bundle_dir(output_directory, commit).join(BUNDLE_FILE)).ok()?;
    #[derive(Deserialize)]
    struct Header {
        version: u32,
        resolution: IoSnapshotResolution,
    }
    let header: Header = serde_json::from_reader(io::BufReader::new(file)).ok()?;
    (header.version == BUNDLE_VERSION).then_some(header.resolution)
}

/// Writes the bundle into a sibling temp directory and swaps it into place, so
/// a reader always sees either the previous bundle or the new one, never a
/// gap. Concurrent writers for the same commit: last one in wins.
pub fn write(output_directory: &Path, bundle: &Bundle) -> io::Result<PathBuf> {
    let commit = &bundle.resolution.requested_commit;
    let target = bundle_dir(output_directory, commit);
    let temp = output_directory.join(format!(".tmp-{}-{}", commit, std::process::id()));
    let old = output_directory.join(format!(".old-{}-{}", commit, std::process::id()));
    fs::create_dir_all(&temp)?;
    let written = (|| {
        let file = fs::File::create(temp.join(BUNDLE_FILE))?;
        serde_json::to_writer(io::BufWriter::new(file), bundle)?;
        if target.exists() {
            fs::rename(&target, &old)?;
        }
        let swapped = fs::rename(&temp, &target);
        if swapped.is_err() && old.exists() && !target.exists() {
            let _ = fs::rename(&old, &target);
        }
        let _ = fs::remove_dir_all(&old);
        swapped
    })();
    match written {
        Ok(()) => Ok(target),
        Err(err) => {
            let _ = fs::remove_dir_all(&temp);
            if target.join(BUNDLE_FILE).is_file() {
                Ok(target)
            } else {
                Err(err)
            }
        }
    }
}

/// A fetch that failed for reasons a retry will not fix (no endpoint, bad
/// credentials, malformed response); remembered per commit and API URL so the
/// next commands do not probe Nx Cloud again until it expires.
#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FetchFailure {
    pub api_url: String,
    pub reason: String,
    pub message: String,
    pub at: i64,
}

const FAILURE_FILE: &str = "failure.json";

pub fn record_failure(output_directory: &Path, commit: &str, failure: &FetchFailure) {
    let dir = bundle_dir(output_directory, commit);
    if fs::create_dir_all(&dir).is_err() {
        return;
    }
    if let Ok(file) = fs::File::create(dir.join(FAILURE_FILE)) {
        let _ = serde_json::to_writer(io::BufWriter::new(file), failure);
    }
}

pub fn read_failure(output_directory: &Path, commit: &str) -> Option<FetchFailure> {
    let file = fs::File::open(bundle_dir(output_directory, commit).join(FAILURE_FILE)).ok()?;
    serde_json::from_reader(io::BufReader::new(file)).ok()
}

/// Keeps the newest `retain` bundles (by fetch time) plus `keep`.
pub fn prune(output_directory: &Path, retain: usize, keep: &str) {
    let Ok(entries) = fs::read_dir(output_directory) else {
        return;
    };
    let mut bundles: Vec<(i64, PathBuf)> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with(".tmp-") {
            let _ = fs::remove_dir_all(&path);
            continue;
        }
        if name == keep || !path.is_dir() {
            continue;
        }
        let fetched_at = read_resolution(output_directory, &name)
            .map(|r| r.fetched_at)
            .unwrap_or(0);
        bundles.push((fetched_at, path));
    }
    bundles.sort_by(|a, b| b.0.cmp(&a.0));
    for (_, path) in bundles.into_iter().skip(retain.saturating_sub(1)) {
        let _ = fs::remove_dir_all(path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::TempDir;

    fn snapshot(commit: &str, inputs: &[&str]) -> TaskIoSnapshot {
        TaskIoSnapshot {
            commit: commit.into(),
            inputs: TaskInputs::Flat(inputs.iter().map(|s| s.to_string()).collect()),
            task_outputs: None,
            outputs: vec![],
        }
    }

    fn resolution(commit: &str, fetched_at: i64) -> IoSnapshotResolution {
        IoSnapshotResolution {
            requested_commit: commit.into(),
            commits: vec![commit.into()],
            source_commits: vec![],
            digest: String::new(),
            fetched_at,
            client_version: "test".into(),
            tasks: 0,
        }
    }

    #[test]
    fn digest_is_order_independent_after_normalize() {
        let mut a = BTreeMap::new();
        a.insert("app:build".to_string(), snapshot("c1", &["b", "a", "a"]));
        let mut b = BTreeMap::new();
        b.insert("app:build".to_string(), snapshot("c1", &["a", "b"]));
        normalize(&mut a);
        normalize(&mut b);
        assert_eq!(digest(&a), digest(&b));
        assert_eq!(
            a["app:build"].inputs,
            TaskInputs::Flat(vec!["a".into(), "b".into()])
        );
    }

    #[test]
    fn accepts_flat_and_structured_inputs() {
        let json = r#"{
          "flat": {
            "commit": "c",
            "inputs": ["b", "a", "dist/libs/ui/index.js"],
            "taskOutputs": { "ui:build": ["dist/libs/ui/index.js"] },
            "outputs": []
          },
          "structured": {
            "commit": "c",
            "inputs": {
              "projects": { "web": ["src/**/*.ts", "src/**/*.ts"] },
              "workspace": ["tsconfig.base.json"],
              "taskOutputs": { "ui:build": ["libs/ui/dist/index.js"] }
            },
            "outputs": ["apps/web/dist/**"]
          }
        }"#;
        let mut snapshots: BTreeMap<String, TaskIoSnapshot> = serde_json::from_str(json).unwrap();
        normalize(&mut snapshots);
        assert_eq!(
            snapshots["flat"].inputs,
            TaskInputs::Flat(vec!["a".into(), "b".into(), "dist/libs/ui/index.js".into()])
        );
        assert_eq!(
            snapshots["flat"].task_outputs.as_ref().unwrap()["ui:build"],
            vec!["dist/libs/ui/index.js"]
        );
        let TaskInputs::Structured(inputs) = &snapshots["structured"].inputs else {
            panic!("expected structured inputs");
        };
        assert_eq!(inputs.projects["web"], vec!["src/**/*.ts"]);
        assert_eq!(
            inputs.task_outputs["ui:build"],
            vec!["libs/ui/dist/index.js"]
        );
        // Round-trips through the on-disk bundle unchanged.
        let text = serde_json::to_string(&snapshots).unwrap();
        let again: BTreeMap<String, TaskIoSnapshot> = serde_json::from_str(&text).unwrap();
        assert_eq!(again, snapshots);
    }

    #[test]
    fn write_then_read_round_trips_and_prunes() {
        let temp = TempDir::new().unwrap();
        for (commit, at) in [("aaa", 1), ("bbb", 2), ("ccc", 3)] {
            let bundle = Bundle {
                version: BUNDLE_VERSION,
                resolution: resolution(commit, at),
                snapshots: BTreeMap::new(),
            };
            let dir = write(&temp, &bundle).unwrap();
            assert!(dir.join(BUNDLE_FILE).is_file());
            assert_eq!(read_resolution(&temp, commit).unwrap().fetched_at, at);
        }
        fs::create_dir_all(temp.join(".tmp-zzz-1")).unwrap();

        prune(&temp, 2, "ccc");
        assert!(read_resolution(&temp, "ccc").is_some());
        assert!(read_resolution(&temp, "bbb").is_some());
        assert!(read_resolution(&temp, "aaa").is_none());
        assert!(!temp.join(".tmp-zzz-1").exists());
    }

    #[test]
    fn read_bundle_reports_missing_and_invalid_and_caches_by_mtime() {
        let temp = TempDir::new().unwrap();
        let dir = temp.join("aaa");
        let missing = read_bundle(&dir).unwrap_err();
        assert_eq!(missing.reason, "no-bundle");

        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(BUNDLE_FILE), "{ not json").unwrap();
        let invalid = read_bundle(&dir).unwrap_err();
        assert_eq!(invalid.reason, "invalid-bundle");
        assert!(invalid.file.ends_with(BUNDLE_FILE));

        let mut bundle = Bundle {
            version: BUNDLE_VERSION,
            resolution: resolution("aaa", 1),
            snapshots: BTreeMap::new(),
        };
        write(&temp, &bundle).unwrap();
        let first = read_bundle(&dir).unwrap();
        assert!(std::sync::Arc::ptr_eq(&first, &read_bundle(&dir).unwrap()));

        bundle.resolution.fetched_at = 2;
        write(&temp, &bundle).unwrap();
        let later = std::time::SystemTime::now() + std::time::Duration::from_secs(5);
        let file = fs::File::options()
            .write(true)
            .open(dir.join(BUNDLE_FILE))
            .unwrap();
        file.set_modified(later).unwrap();
        assert_eq!(read_bundle(&dir).unwrap().resolution.fetched_at, 2);

        bundle.version = 99;
        write(&temp, &bundle).unwrap();
        let file = fs::File::options()
            .write(true)
            .open(dir.join(BUNDLE_FILE))
            .unwrap();
        file.set_modified(later + std::time::Duration::from_secs(5))
            .unwrap();
        assert_eq!(read_bundle(&dir).unwrap_err().reason, "invalid-bundle");
    }

    #[test]
    fn remembers_a_fetch_failure_per_commit() {
        let temp = TempDir::new().unwrap();
        assert_eq!(read_failure(&temp, "aaa"), None);
        let failure = FetchFailure {
            api_url: "https://cloud.example.com".into(),
            reason: "unsupported-server".into(),
            message: "404".into(),
            at: 7,
        };
        record_failure(&temp, "aaa", &failure);
        assert_eq!(read_failure(&temp, "aaa"), Some(failure));
        // A bundle written later for the same commit replaces the failure marker.
        let bundle = Bundle {
            version: BUNDLE_VERSION,
            resolution: resolution("aaa", 1),
            snapshots: BTreeMap::new(),
        };
        write(&temp, &bundle).unwrap();
        assert_eq!(read_failure(&temp, "aaa"), None);
    }

    #[test]
    fn rewriting_a_commit_replaces_the_bundle() {
        let temp = TempDir::new().unwrap();
        let mut bundle = Bundle {
            version: BUNDLE_VERSION,
            resolution: resolution("aaa", 1),
            snapshots: BTreeMap::new(),
        };
        write(&temp, &bundle).unwrap();
        bundle.resolution.fetched_at = 5;
        write(&temp, &bundle).unwrap();
        assert_eq!(read_resolution(&temp, "aaa").unwrap().fetched_at, 5);
    }
}
