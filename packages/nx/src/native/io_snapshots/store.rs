use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::IoSnapshotResolution;
use super::client::{TaskInputs, TaskIoSnapshot};

pub const BUNDLE_VERSION: u32 = 1;
pub const BUNDLE_FILE: &str = "snapshots.json";

/// One resolved snapshot set, cached per requested commit.
#[derive(Serialize, Deserialize)]
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
        sort_unique(&mut snapshot.outputs);
    }
}

fn sort_unique(values: &mut Vec<String>) {
    values.sort();
    values.dedup();
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

/// Writes the bundle into a sibling temp directory and renames it into place so
/// readers never observe a partial bundle. A concurrent run that already
/// published the same commit wins; ours is discarded.
pub fn write(output_directory: &Path, bundle: &Bundle) -> io::Result<PathBuf> {
    let commit = &bundle.resolution.requested_commit;
    let target = bundle_dir(output_directory, commit);
    let temp = output_directory.join(format!(".tmp-{}-{}", commit, std::process::id()));
    fs::create_dir_all(&temp)?;
    let written = (|| {
        let file = fs::File::create(temp.join(BUNDLE_FILE))?;
        serde_json::to_writer(io::BufWriter::new(file), bundle)?;
        if target.exists() {
            fs::remove_dir_all(&target)?;
        }
        fs::rename(&temp, &target)
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
            outputs: vec![],
            coverage: None,
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
          "flat": { "commit": "c", "inputs": ["b", "a"], "outputs": [] },
          "structured": {
            "commit": "c",
            "inputs": {
              "projects": { "web": ["src/**/*.ts", "src/**/*.ts"] },
              "workspace": ["tsconfig.base.json"],
              "taskOutputs": { "ui:build": ["libs/ui/dist/index.js"] }
            },
            "outputs": ["apps/web/dist/**"],
            "coverage": "complete"
          }
        }"#;
        let mut snapshots: BTreeMap<String, TaskIoSnapshot> = serde_json::from_str(json).unwrap();
        normalize(&mut snapshots);
        assert_eq!(
            snapshots["flat"].inputs,
            TaskInputs::Flat(vec!["a".into(), "b".into()])
        );
        let TaskInputs::Structured(inputs) = &snapshots["structured"].inputs else {
            panic!("expected structured inputs");
        };
        assert_eq!(inputs.projects["web"], vec!["src/**/*.ts"]);
        assert_eq!(
            inputs.task_outputs["ui:build"],
            vec!["libs/ui/dist/index.js"]
        );
        assert_eq!(
            snapshots["structured"].coverage.as_deref(),
            Some("complete")
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
