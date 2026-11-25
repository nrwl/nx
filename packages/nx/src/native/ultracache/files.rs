//! Verifies the immutable files supplied by Nx Cloud before publishing a version.
use std::collections::{HashMap, HashSet};
use std::fmt;
use std::fs::OpenOptions;
use std::io::{self, Read, Write};
use std::marker::PhantomData;
use std::path::Path;
use std::sync::Arc;

use anyhow::{Context, Result, bail, ensure};
use serde::de::{Error, MapAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use sha2::{Digest, Sha256};

use super::set::CompactSet;

// The bundle budget covers the manifest, objects and dictionary pages on disk.
const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_BUNDLE_BYTES: u64 = 512 * 1024 * 1024;
// Ocean's limit for one string configuration, including its JSON encoding.
const MAX_CONFIGURATION_BYTES: u64 = 8 * 1024 * 1024;

// Reject duplicate JSON keys: serde's default map keeps only the last value.
fn unique_map<'de, D, V>(de: D) -> Result<HashMap<String, V>, D::Error>
where
    D: Deserializer<'de>,
    V: Deserialize<'de>,
{
    struct Unique<V>(PhantomData<V>);
    impl<'de, V: Deserialize<'de>> Visitor<'de> for Unique<V> {
        type Value = HashMap<String, V>;
        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("an object with unique keys")
        }
        fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Self::Value, A::Error> {
            let mut values = HashMap::new();
            while let Some((key, value)) = map.next_entry()? {
                if values.insert(key, value).is_some() {
                    return Err(A::Error::custom("duplicate key in Ultracache object"));
                }
            }
            Ok(values)
        }
    }
    de.deserialize_map(Unique(PhantomData))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    enabled: bool,
    #[serde(rename = "updatedAt")]
    _updated_at: i64,
    #[serde(deserialize_with = "unique_map")]
    tasks: HashMap<String, Task>,
    #[serde(deserialize_with = "unique_map")]
    artifacts: HashMap<String, Artifact>,
    #[serde(default, deserialize_with = "unique_map")]
    dictionary_pages: HashMap<String, Page>,
    /// Hash each task's project folder state beside its configuration.
    /// Absent means off. Older Nx versions ignore the field.
    #[serde(default)]
    hash_project_folder_state: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Task {
    #[serde(rename = "commit")]
    _commit: String,
    #[serde(rename = "project")]
    _project: String,
    artifact_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Artifact {
    size_bytes: u64,
    #[serde(default = "version_two")]
    storage_version: u32,
    object_checksum: Option<String>,
    #[serde(default)]
    dictionary_page_ids: Vec<String>,
}

fn version_two() -> u32 {
    2
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Page {
    size_bytes: u64,
}

#[derive(Deserialize, Serialize)]
struct Config<T> {
    inputs: T,
    outputs: T,
}

fn check_sha(sha: &str) -> Result<()> {
    ensure!(
        sha.len() == 64
            && sha
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
        "invalid Ultracache SHA-256"
    );
    Ok(())
}

fn read_file(path: &Path, expected: Option<u64>, budget: &mut u64) -> Result<Vec<u8>> {
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(nix::libc::O_NOFOLLOW | nix::libc::O_NONBLOCK);
    }
    let file = options
        .open(path)
        .with_context(|| format!("opening {}", path.display()))?;
    let metadata = file.metadata()?;
    let len = metadata.len();
    ensure!(
        metadata.is_file() && len <= MAX_FILE_BYTES && len <= *budget,
        "Ultracache file exceeds size limit or is not a regular file"
    );
    ensure!(
        expected.is_none_or(|size| size == len),
        "Ultracache file size mismatch"
    );
    let mut bytes = Vec::with_capacity(len as usize);
    file.take(len + 1).read_to_end(&mut bytes)?;
    ensure!(
        bytes.len() as u64 == len,
        "Ultracache file changed during read"
    );
    *budget -= len;
    Ok(bytes)
}

fn read_object(dir: &Path, checksum: &str, size: u64, budget: &mut u64) -> Result<Vec<u8>> {
    check_sha(checksum)?;
    let bytes = read_file(&dir.join(format!("{checksum}.json")), Some(size), budget)?;
    ensure!(
        format!("{:x}", Sha256::digest(&bytes)) == checksum,
        "Ultracache object checksum mismatch: {checksum}"
    );
    Ok(bytes)
}

/// The original string config's checksum also binds the page mapping to the
/// task's logical artifact. Hash its JSON directly without building the expanded bytes.
struct LogicalChecksum {
    hash: Sha256,
    remaining: u64,
}

impl Write for LogicalChecksum {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.remaining = self
            .remaining
            .checked_sub(buf.len() as u64)
            .ok_or_else(|| {
                io::Error::other("expanded Ultracache configuration exceeds size limit")
            })?;
        self.hash.update(buf);
        Ok(buf.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

/// Serialize a dictionary-backed list like the original string list. A
/// repeated long glob costs no temporary copy even during checksum validation.
struct GlobList<'a> {
    ids: &'a [u32],
    globs: &'a [Arc<str>],
}

impl Serialize for GlobList<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_seq(self.ids.iter().map(|&id| self.globs[id as usize].as_ref()))
    }
}

struct Reader<'a> {
    dir: &'a Path,
    pages: &'a HashMap<String, Page>,
    page_indices: HashMap<String, usize>,
    // Wire ids are scoped to the pages an artifact names. Index them once
    // instead of merging whole dictionaries for every small config.
    symbols: HashMap<u32, Vec<(usize, u32)>>,
    budget: u64,
    set: CompactSet,
}

impl Reader<'_> {
    fn page_index(&mut self, sha: &str) -> Result<usize> {
        if let Some(&index) = self.page_indices.get(sha) {
            return Ok(index);
        }
        let page = self
            .pages
            .get(sha)
            .context("missing Ultracache dictionary page")?;
        let bytes = read_object(self.dir, sha, page.size_bytes, &mut self.budget)?;
        #[derive(Deserialize)]
        struct Dictionary(#[serde(deserialize_with = "unique_map")] HashMap<String, u32>);
        let Dictionary(entries) = serde_json::from_slice(&bytes)?;
        let index = self.page_indices.len();
        let mut ids = HashSet::with_capacity(entries.len());
        for (glob, id) in entries {
            ensure!(
                id <= i32::MAX as u32 && ids.insert(id),
                "invalid or duplicate id in Ultracache dictionary page"
            );
            self.symbols
                .entry(id)
                .or_default()
                .push((index, self.set.intern_glob(glob)));
        }
        self.page_indices.insert(sha.to_string(), index);
        Ok(index)
    }

    fn compact_inputs(&mut self, sha: &str, artifact: &Artifact) -> Result<Vec<u32>> {
        let checksum = artifact
            .object_checksum
            .as_deref()
            .context("missing v3 Ultracache object checksum")?;
        let bytes = read_object(self.dir, checksum, artifact.size_bytes, &mut self.budget)?;
        let mut config: Config<Vec<u32>> = serde_json::from_slice(&bytes)?;
        let mut allowed = HashSet::new();
        for page_sha in &artifact.dictionary_page_ids {
            allowed.insert(self.page_index(page_sha)?);
        }
        for id in config.inputs.iter_mut().chain(&mut config.outputs) {
            let mut matches = self
                .symbols
                .get(id)
                .into_iter()
                .flatten()
                .filter(|(page, _)| allowed.contains(page))
                .map(|(_, symbol)| *symbol);
            let symbol = matches
                .next()
                .context("unresolved Ultracache dictionary id")?;
            ensure!(
                matches.all(|other| other == symbol),
                "conflicting Ultracache dictionary id"
            );
            *id = symbol;
        }
        let mut logical = LogicalChecksum {
            hash: Sha256::new(),
            remaining: MAX_CONFIGURATION_BYTES,
        };
        let strings = |ids| GlobList {
            ids,
            globs: &self.set.globs,
        };
        serde_json::to_writer(
            &mut logical,
            &Config {
                inputs: strings(&config.inputs),
                outputs: strings(&config.outputs),
            },
        )?;
        ensure!(
            format!("{:x}", logical.hash.finalize()) == sha,
            "Ultracache logical artifact checksum mismatch: {sha}"
        );
        Ok(config.inputs)
    }

    fn artifact(&mut self, sha: &str, artifact: &Artifact) -> Result<u32> {
        check_sha(sha)?;
        let inputs = match artifact.storage_version {
            2 => {
                ensure!(
                    artifact.size_bytes <= MAX_CONFIGURATION_BYTES,
                    "expanded Ultracache configuration exceeds size limit"
                );
                ensure!(
                    artifact
                        .object_checksum
                        .as_deref()
                        .is_none_or(|checksum| checksum == sha)
                        && artifact.dictionary_page_ids.is_empty(),
                    "unexpected v2 Ultracache metadata"
                );
                let bytes = read_object(self.dir, sha, artifact.size_bytes, &mut self.budget)?;
                let config: Config<Vec<String>> = serde_json::from_slice(&bytes)?;
                config
                    .inputs
                    .into_iter()
                    .map(|g| self.set.intern_glob(g))
                    .collect()
            }
            3 => self.compact_inputs(sha, artifact)?,
            version => bail!("unsupported Ultracache storage version {version}"),
        };
        Ok(self.set.intern_inputs(inputs))
    }
}

pub(super) fn read(manifest_path: &Path, dir: &Path) -> Result<CompactSet> {
    read_with_budget(manifest_path, dir, MAX_BUNDLE_BYTES)
}

fn read_with_budget(manifest_path: &Path, dir: &Path, mut budget: u64) -> Result<CompactSet> {
    let manifest: Manifest = serde_json::from_slice(&read_file(manifest_path, None, &mut budget)?)?;
    if !manifest.enabled {
        ensure!(
            manifest.tasks.is_empty(),
            "disabled Ultracache manifest contains tasks"
        );
        return Ok(CompactSet::default());
    }
    let mut reader = Reader {
        dir,
        pages: &manifest.dictionary_pages,
        page_indices: HashMap::new(),
        symbols: HashMap::new(),
        budget,
        set: CompactSet::default(),
    };
    reader.set.hash_project_folder_state = manifest.hash_project_folder_state;
    let mut artifact_ids = HashMap::new();
    for (task_id, task) in manifest.tasks {
        let id = match artifact_ids.get(&task.artifact_id) {
            Some(&id) => id,
            None => {
                let artifact = manifest
                    .artifacts
                    .get(&task.artifact_id)
                    .context("missing Ultracache artifact")?;
                let id = reader.artifact(&task.artifact_id, artifact)?;
                artifact_ids.insert(task.artifact_id, id);
                id
            }
        };
        reader.set.tasks.insert(task_id, id);
    }
    Ok(reader.set)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;

    fn write_object(dir: &Path, bytes: &[u8]) -> String {
        let id = format!("{:x}", Sha256::digest(bytes));
        fs::write(dir.join(format!("{id}.json")), bytes).unwrap();
        id
    }

    #[test]
    fn combined_expanded_configurations_can_exceed_the_physical_bundle_budget() {
        let dir = tempfile::tempdir().unwrap();
        let dir = dir.path();
        let common = "shared/".repeat(300);
        let page = serde_json::to_vec(&json!({&common: 0, "a": 1, "b": 2, "c": 3})).unwrap();
        let page_sha = write_object(dir, &page);
        let mut manifest = json!({
            "enabled": true, "updatedAt": 1, "tasks": {}, "artifacts": {},
            "dictionaryPages": {&page_sha: {"sizeBytes": page.len()}}
        });
        let mut physical_bytes = page.len();
        let mut logical_sizes = Vec::new();
        for (i, unique) in ["a", "b", "c"].into_iter().enumerate() {
            let expanded =
                serde_json::to_vec(&json!({"inputs": [&common, unique], "outputs": []})).unwrap();
            let logical_id = format!("{:x}", Sha256::digest(&expanded));
            logical_sizes.push(expanded.len());
            let compact = serde_json::to_vec(&json!({"inputs": [0, i+1], "outputs": []})).unwrap();
            let checksum = write_object(dir, &compact);
            physical_bytes += compact.len();
            manifest["tasks"][unique] =
                json!({"project": unique, "commit": "head", "artifactId": logical_id});
            manifest["artifacts"][&logical_id] = json!({
                "storageVersion": 3, "sizeBytes": compact.len(),
                "objectChecksum": checksum, "dictionaryPageIds": [&page_sha]
            });
        }
        let manifest_path = dir.join("manifest.json");
        let bytes = serde_json::to_vec(&manifest).unwrap();
        physical_bytes += bytes.len();
        fs::write(&manifest_path, bytes).unwrap();
        assert!(logical_sizes.iter().all(|&size| size < physical_bytes));
        assert!(logical_sizes.iter().sum::<usize>() > physical_bytes);

        let set = read_with_budget(&manifest_path, dir, physical_bytes as u64).unwrap();
        assert_eq!(set.tasks.len(), 3);
        assert_eq!(set.globs.len(), 4);
        assert!(read_with_budget(&manifest_path, dir, physical_bytes as u64 - 1).is_err());
    }

    #[test]
    fn both_storage_versions_enforce_oceans_eight_mib_limit_per_configuration() {
        let dir = tempfile::tempdir().unwrap();
        let dir = dir.path();
        // Each occurrence adds 1024 encoded bytes including quotes and the separator.
        let glob = "g".repeat(1021);
        let count = 8192;
        let expanded = serde_json::to_vec(&Config {
            inputs: vec![glob.as_str(); count],
            outputs: Vec::<&str>::new(),
        })
        .unwrap();
        assert!(expanded.len() > 8 * 1024 * 1024);
        let logical_id = write_object(dir, &expanded);
        let page = serde_json::to_vec(&json!({&glob: 0})).unwrap();
        let page_sha = write_object(dir, &page);
        let compact = serde_json::to_vec(&json!({"inputs": vec![0;count], "outputs": []})).unwrap();
        let checksum = write_object(dir, &compact);
        let path = dir.join("manifest.json");
        for artifact in [
            json!({"sizeBytes": expanded.len()}),
            json!({"sizeBytes": compact.len(), "storageVersion": 3, "objectChecksum": checksum, "dictionaryPageIds": [&page_sha]}),
        ] {
            let manifest = json!({
                "enabled": true, "updatedAt": 1,
                "tasks": {"a": {"commit": "head", "project": "a", "artifactId": logical_id}},
                "artifacts": {&logical_id: artifact}, "dictionaryPages": {&page_sha: {"sizeBytes": page.len()}}
            });
            fs::write(&path, serde_json::to_vec(&manifest).unwrap()).unwrap();
            let err = read(&path, dir).err().unwrap();
            assert!(
                err.to_string()
                    .contains("expanded Ultracache configuration exceeds size limit"),
                "{err}"
            );
        }
    }

    #[test]
    fn bounds_both_the_file_read_and_the_reconstructed_object() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("large.json");
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(MAX_FILE_BYTES + 1).unwrap();
        let mut budget = MAX_BUNDLE_BYTES;
        assert!(read_file(&path, None, &mut budget).is_err());
        assert_eq!(budget, MAX_BUNDLE_BYTES);
        file.set_len(5).unwrap();
        budget = 4;
        assert!(read_file(&path, Some(5), &mut budget).is_err());
        let mut logical = LogicalChecksum {
            hash: Sha256::new(),
            remaining: 5,
        };
        logical.write_all(b"12345").unwrap();
        assert!(logical.write_all(b"6").is_err());
    }
}
