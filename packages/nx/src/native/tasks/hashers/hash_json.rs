use std::collections::HashMap;
use std::path::Path;

use anyhow::Result;
use serde_json::Value;
use tracing::{debug, debug_span, trace};
use xxhash_rust::xxh3::Xxh3;

use crate::native::glob::build_glob_set;
use crate::native::hasher::hash;
use crate::native::tasks::hashers::hash_workspace_files::globs_from_workspace_globs;
use crate::native::types::FileData;

pub struct JsonHashResult {
    pub hash: String,
    pub files: Vec<String>,
}

/// Hashes JSON files, optionally filtering to specific fields.
///
/// Token resolution (`{projectRoot}`, `{projectName}`) is handled upstream by the
/// `HashPlanner`, so `json_path` arrives here already resolved. `project_name` is
/// `Some` when the original pattern started with `{projectRoot}` (match against
/// `project_file_map`) and `None` for `{workspaceRoot}` patterns (match against
/// `all_workspace_files` after stripping the prefix).
///
/// Reads matching files from disk, parses JSON, filters by fields/excludeFields,
/// and hashes the result deterministically.
pub fn hash_json_files(
    workspace_root: &str,
    json_path: &str,
    project_name: Option<&str>,
    fields: Option<&[String]>,
    exclude_fields: Option<&[String]>,
    project_file_map: &HashMap<String, Vec<FileData>>,
    all_workspace_files: &[FileData],
) -> Result<JsonHashResult> {
    // Resolve file paths matching the glob
    let matched_files: Vec<&str> = if let Some(project_name) = project_name {
        // Project-root path: already resolved by the planner (e.g. "libs/my-lib/package.json")
        let glob_set = build_glob_set(&[json_path.to_string()])?;
        project_file_map
            .get(project_name)
            .map(|files| {
                files
                    .iter()
                    .filter(|f| glob_set.is_match(&f.file))
                    .map(|f| f.file.as_str())
                    .collect()
            })
            .unwrap_or_default()
    } else {
        // Workspace-root path: still carries the `{workspaceRoot}/` prefix
        let globs = globs_from_workspace_globs(&[json_path.to_string()]);
        if globs.is_empty() {
            vec![]
        } else {
            let glob_set = build_glob_set(&globs)?;
            all_workspace_files
                .iter()
                .filter(|f| glob_set.is_match(&f.file))
                .map(|f| f.file.as_str())
                .collect()
        }
    };

    if matched_files.is_empty() {
        return Ok(JsonHashResult {
            hash: hash(b""),
            files: vec![],
        });
    }

    let mut hasher = Xxh3::new();
    let mut result_files = Vec::with_capacity(matched_files.len());

    debug_span!("Hashing JSON fileset with inputs").in_scope(|| {
        for file_path in &matched_files {
            let file_start = std::time::Instant::now();
            let abs_path = Path::new(workspace_root).join(file_path);
            let Ok(bytes) = std::fs::read(&abs_path)
                .inspect_err(|e| trace!("Failed to read JSON file {:?}: {}", abs_path, e))
            else {
                continue;
            };

            let Ok(parsed) = serde_json::from_slice::<Value>(&bytes)
                .inspect_err(|e| trace!("Failed to parse JSON file {:?}: {}", abs_path, e))
            else {
                // If we can't parse it as JSON, hash the raw bytes
                hasher.update(file_path.as_bytes());
                hasher.update(&bytes);
                result_files.push(file_path.to_string());
                continue;
            };

            // Stream the JSON bytes (object keys sorted at every level) straight
            // into the hasher. The byte sequence is deterministic and defines the
            // cache key, so it MUST NOT change once released — do not reformat
            // without a migration.
            debug!("Adding {} to hash", file_path);
            hasher.update(file_path.as_bytes());
            // When no filters are set, skip the filter step to avoid cloning the
            // parsed tree just to return it unchanged.
            if fields.is_none() && exclude_fields.is_none() {
                hash_sorted_json(&mut hasher, &parsed);
            } else {
                let filtered = filter_json_value(&parsed, fields, exclude_fields);
                hash_sorted_json(&mut hasher, &filtered);
            }
            result_files.push(file_path.to_string());
            trace!("hash_json {}: {:?}", file_path, file_start.elapsed());
        }
        let hashed_value = hasher.digest().to_string();
        debug!("Hash Value: {}", hashed_value);

        Ok(JsonHashResult {
            hash: hashed_value,
            files: result_files,
        })
    })
}

/// Filters a JSON value based on field allowlist and denylist.
/// Fields use dot notation for nested access (e.g., "compilerOptions.target").
fn filter_json_value(
    value: &Value,
    fields: Option<&[String]>,
    exclude_fields: Option<&[String]>,
) -> Value {
    if fields.is_none() && exclude_fields.is_none() {
        return value.clone();
    }

    let Some(obj) = value.as_object() else {
        return value.clone();
    };

    let mut result = if let Some(fields) = fields {
        let mut filtered = serde_json::Map::new();
        for field_path in fields {
            let (key, rest) = match field_path.split_once('.') {
                Some((k, r)) => (k, Some(r)),
                None => (field_path.as_str(), None),
            };
            let Some(val) = obj.get(key) else {
                continue;
            };
            let Some(rest) = rest else {
                filtered.insert(key.to_string(), val.clone());
                continue;
            };
            let Some(nested_val) = extract_nested_field(val, rest) else {
                continue;
            };
            // Merge into existing key if already present so sibling paths like
            // ["a.b", "a.c"] produce a single {"a": {"b", "c"}} entry.
            if let Some(existing) = filtered.get(key) {
                if let (Some(existing_obj), Some(nested_obj)) =
                    (existing.as_object(), nested_val.as_object())
                {
                    let mut merged = existing_obj.clone();
                    for (k, v) in nested_obj {
                        merged.insert(k.clone(), v.clone());
                    }
                    filtered.insert(key.to_string(), Value::Object(merged));
                }
            } else {
                filtered.insert(key.to_string(), nested_val);
            }
        }
        filtered
    } else {
        obj.clone()
    };

    // Apply denylist
    if let Some(exclude_fields) = exclude_fields {
        for field_path in exclude_fields {
            remove_nested_field(&mut result, field_path);
        }
    }

    Value::Object(result)
}

/// Extracts a nested field from a JSON value using dot-notation path.
/// Returns the value wrapped in its parent structure.
/// e.g., for path "target" on `{"target": "ES2021", "paths": {...}}`,
/// returns `{"target": "ES2021"}`.
fn extract_nested_field(value: &Value, path: &str) -> Option<Value> {
    let (key, rest) = match path.split_once('.') {
        Some((k, r)) => (k, Some(r)),
        None => (path, None),
    };
    let val = value.as_object()?.get(key)?;
    let inner = match rest {
        Some(rest) => extract_nested_field(val, rest)?,
        None => val.clone(),
    };
    let mut wrapper = serde_json::Map::new();
    wrapper.insert(key.to_string(), inner);
    Some(Value::Object(wrapper))
}

/// Removes a field from a JSON object using dot-notation path.
fn remove_nested_field(obj: &mut serde_json::Map<String, Value>, path: &str) {
    match path.split_once('.') {
        Some((key, rest)) => {
            if let Some(Value::Object(nested)) = obj.get_mut(key) {
                remove_nested_field(nested, rest);
            }
        }
        None => {
            obj.remove(path);
        }
    }
}

/// Feeds a deterministic byte encoding of `value` into `hasher` so that two
/// JSON objects with the same contents but different key insertion order
/// produce the same hash.
///
/// The encoding is compact JSON (no whitespace) with object keys sorted at
/// every level. Arrays preserve their order. Leaf values are serialized by
/// `serde_json` so strings, numbers, bools, and null match standard JSON.
///
/// This is **not** RFC 8785 / JCS-compliant canonical JSON — it only sorts
/// keys. Number normalization, Unicode escape canonicalization, etc. are not
/// performed. The goal here is cache-key stability within this codebase, not
/// cross-implementation interoperability.
///
/// The produced byte sequence defines the cache key and MUST NOT change once
/// released — do not reformat without a migration.
fn hash_sorted_json(hasher: &mut Xxh3, value: &Value) {
    match value {
        Value::Object(map) => {
            let mut sorted: Vec<(&String, &Value)> = map.iter().collect();
            sorted.sort_by_key(|(k, _)| k.as_str());
            hasher.update(b"{");
            for (i, (k, v)) in sorted.iter().enumerate() {
                if i > 0 {
                    hasher.update(b",");
                }
                // Keys go through serde_json so escaping matches JSON rules
                let key_json = serde_json::to_string(k).unwrap();
                hasher.update(key_json.as_bytes());
                hasher.update(b":");
                hash_sorted_json(hasher, v);
            }
            hasher.update(b"}");
        }
        Value::Array(arr) => {
            hasher.update(b"[");
            for (i, v) in arr.iter().enumerate() {
                if i > 0 {
                    hasher.update(b",");
                }
                hash_sorted_json(hasher, v);
            }
            hasher.update(b"]");
        }
        // Leaves: numbers, strings, bools, null — serde_json handles escaping/formatting
        _ => {
            let leaf = serde_json::to_string(value).unwrap_or_default();
            hasher.update(leaf.as_bytes());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_filter_no_filters() {
        let json: Value = serde_json::from_str(r#"{"a": 1, "b": 2, "c": 3}"#).unwrap();
        let result = filter_json_value(&json, None, None);
        assert_eq!(result, json);
    }

    #[test]
    fn test_filter_with_fields_allowlist() {
        let json: Value =
            serde_json::from_str(r#"{"engines": "v18", "name": "foo", "version": "1.0"}"#).unwrap();
        let fields = vec!["engines".to_string()];
        let result = filter_json_value(&json, Some(&fields), None);
        let expected: Value = serde_json::from_str(r#"{"engines": "v18"}"#).unwrap();
        assert_eq!(result, expected);
    }

    #[test]
    fn test_filter_with_exclude_fields() {
        let json: Value = serde_json::from_str(r#"{"a": 1, "b": 2, "c": 3}"#).unwrap();
        let exclude = vec!["b".to_string()];
        let result = filter_json_value(&json, None, Some(&exclude));
        let expected: Value = serde_json::from_str(r#"{"a": 1, "c": 3}"#).unwrap();
        assert_eq!(result, expected);
    }

    #[test]
    fn test_filter_nested_dot_notation() {
        let json: Value = serde_json::from_str(
            r#"{"compilerOptions": {"target": "ES2021", "paths": {"@foo": ["libs/foo"]}, "module": "commonjs"}}"#,
        )
        .unwrap();
        let fields = vec!["compilerOptions.target".to_string()];
        let result = filter_json_value(&json, Some(&fields), None);
        let expected: Value =
            serde_json::from_str(r#"{"compilerOptions": {"target": "ES2021"}}"#).unwrap();
        assert_eq!(result, expected);
    }

    #[test]
    fn test_filter_merges_sibling_fields() {
        // Sibling paths under the same parent must merge, not overwrite each other
        let json: Value = serde_json::from_str(
            r#"{"compilerOptions": {"target": "ES2021", "module": "commonjs", "strict": true}}"#,
        )
        .unwrap();
        let fields = vec![
            "compilerOptions.target".to_string(),
            "compilerOptions.module".to_string(),
        ];
        let result = filter_json_value(&json, Some(&fields), None);
        let expected: Value = serde_json::from_str(
            r#"{"compilerOptions": {"target": "ES2021", "module": "commonjs"}}"#,
        )
        .unwrap();
        assert_eq!(result, expected);
    }

    #[test]
    fn test_filter_exclude_nested() {
        let json: Value = serde_json::from_str(
            r#"{"compilerOptions": {"target": "ES2021", "paths": {"@foo": ["libs/foo"]}}}"#,
        )
        .unwrap();
        let fields = vec!["compilerOptions".to_string()];
        let exclude = vec!["compilerOptions.paths".to_string()];
        let result = filter_json_value(&json, Some(&fields), Some(&exclude));
        let expected: Value =
            serde_json::from_str(r#"{"compilerOptions": {"target": "ES2021"}}"#).unwrap();
        assert_eq!(result, expected);
    }

    fn hash_of(value: &Value) -> String {
        let mut hasher = Xxh3::new();
        hash_sorted_json(&mut hasher, value);
        hasher.digest().to_string()
    }

    #[test]
    fn test_hash_sorted_json_sorts_keys() {
        // Different insertion order, same content → identical hash
        let a: Value = serde_json::from_str(r#"{"z": 1, "a": 2, "m": 3}"#).unwrap();
        let b: Value = serde_json::from_str(r#"{"a": 2, "m": 3, "z": 1}"#).unwrap();
        assert_eq!(hash_of(&a), hash_of(&b));
    }

    #[test]
    fn test_hash_sorted_json_nested_deterministic() {
        let a: Value = serde_json::from_str(r#"{"b": {"z": 1, "a": 2}, "a": 3}"#).unwrap();
        let b: Value = serde_json::from_str(r#"{"a": 3, "b": {"a": 2, "z": 1}}"#).unwrap();
        assert_eq!(hash_of(&a), hash_of(&b));
    }

    #[test]
    fn test_hash_sorted_json_distinguishes_array_order() {
        // Arrays are order-sensitive, unlike objects
        let a: Value = serde_json::from_str(r#"[1, 2, 3]"#).unwrap();
        let b: Value = serde_json::from_str(r#"[3, 2, 1]"#).unwrap();
        assert_ne!(hash_of(&a), hash_of(&b));
    }

    #[test]
    fn test_hash_json_files_workspace_root() {
        let dir = tempfile::tempdir().unwrap();
        let ws_root = dir.path().to_str().unwrap();

        // Create a JSON file
        let json_content = r#"{"engines": "v18", "name": "test", "version": "1.0"}"#;
        std::fs::write(dir.path().join("package.json"), json_content).unwrap();

        let all_workspace_files = vec![FileData {
            file: "package.json".into(),
            hash: "abc123".into(),
        }];

        let project_file_map: HashMap<String, Vec<FileData>> = HashMap::new();

        let result = hash_json_files(
            ws_root,
            "{workspaceRoot}/package.json",
            None,
            Some(&["engines".to_string()]),
            None,
            &project_file_map,
            &all_workspace_files,
        )
        .unwrap();

        assert!(!result.hash.is_empty());
        assert_eq!(result.files, vec!["package.json"]);

        // Hash should be deterministic
        let result2 = hash_json_files(
            ws_root,
            "{workspaceRoot}/package.json",
            None,
            Some(&["engines".to_string()]),
            None,
            &project_file_map,
            &all_workspace_files,
        )
        .unwrap();
        assert_eq!(result.hash, result2.hash);
    }

    #[test]
    fn test_hash_json_different_fields_different_hash() {
        let dir = tempfile::tempdir().unwrap();
        let ws_root = dir.path().to_str().unwrap();

        let json_content = r#"{"engines": "v18", "name": "test", "version": "1.0"}"#;
        std::fs::write(dir.path().join("package.json"), json_content).unwrap();

        let all_workspace_files = vec![FileData {
            file: "package.json".into(),
            hash: "abc123".into(),
        }];
        let project_file_map: HashMap<String, Vec<FileData>> = HashMap::new();

        let hash_engines = hash_json_files(
            ws_root,
            "{workspaceRoot}/package.json",
            None,
            Some(&["engines".to_string()]),
            None,
            &project_file_map,
            &all_workspace_files,
        )
        .unwrap();

        let hash_name = hash_json_files(
            ws_root,
            "{workspaceRoot}/package.json",
            None,
            Some(&["name".to_string()]),
            None,
            &project_file_map,
            &all_workspace_files,
        )
        .unwrap();

        assert_ne!(hash_engines.hash, hash_name.hash);
    }

    #[test]
    fn test_hash_json_project_root() {
        let dir = tempfile::tempdir().unwrap();
        let ws_root = dir.path().to_str().unwrap();

        let proj_dir = dir.path().join("libs").join("my-lib");
        std::fs::create_dir_all(&proj_dir).unwrap();
        let json_content = r#"{"name": "@scope/my-lib", "version": "1.0.0"}"#;
        std::fs::write(proj_dir.join("package.json"), json_content).unwrap();

        let project_file_map: HashMap<String, Vec<FileData>> = HashMap::from([(
            "my-lib".to_string(),
            vec![FileData {
                file: "libs/my-lib/package.json".into(),
                hash: "def456".into(),
            }],
        )]);

        // Planner pre-resolves `{projectRoot}` before the hasher sees it
        let result = hash_json_files(
            ws_root,
            "libs/my-lib/package.json",
            Some("my-lib"),
            Some(&["name".to_string()]),
            None,
            &project_file_map,
            &[],
        )
        .unwrap();

        assert!(!result.hash.is_empty());
        assert_eq!(result.files, vec!["libs/my-lib/package.json"]);
    }
}
