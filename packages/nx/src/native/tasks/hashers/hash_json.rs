use std::collections::HashMap;
use std::path::Path;

use anyhow::{Result, anyhow};
use serde_json::Value;
use tracing::trace;

use crate::native::glob::build_glob_set;
use crate::native::hasher::hash;
use crate::native::tasks::hashers::hash_project_files::globs_from_project_globs;
use crate::native::tasks::hashers::hash_workspace_files::globs_from_workspace_globs;
use crate::native::types::FileData;

pub struct JsonHashResult {
    pub hash: String,
    pub files: Vec<String>,
}

/// Hashes JSON files, optionally filtering to specific fields.
///
/// For `{projectRoot}` paths: matches against `project_file_map`
/// For `{workspaceRoot}` paths: matches against `all_workspace_files`
///
/// Reads matching files from disk, parses JSON, filters by fields/excludeFields,
/// and hashes the result deterministically.
pub fn hash_json_files(
    workspace_root: &str,
    json_path: &str,
    project_name: Option<&str>,
    project_root: Option<&str>,
    fields: Option<&[String]>,
    exclude_fields: Option<&[String]>,
    project_file_map: &HashMap<String, Vec<FileData>>,
    all_workspace_files: &[FileData],
) -> Result<JsonHashResult> {
    let is_project_root = json_path.starts_with("{projectRoot}");

    // Resolve file paths matching the glob
    let matched_files: Vec<&str> = if is_project_root {
        let project_name = project_name
            .ok_or_else(|| anyhow!("project_name required for {{projectRoot}} json input"))?;
        let project_root = project_root
            .ok_or_else(|| anyhow!("project_root required for {{projectRoot}} json input"))?;
        let globs = globs_from_project_globs(project_root, &[json_path.to_string()]);
        let glob_set = build_glob_set(&globs)?;
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

    let mut hasher = xxhash_rust::xxh3::Xxh3::new();
    let mut result_files = Vec::with_capacity(matched_files.len());

    for file_path in &matched_files {
        let abs_path = Path::new(workspace_root).join(file_path);
        let content = match std::fs::read_to_string(&abs_path) {
            Ok(c) => c,
            Err(e) => {
                trace!("Failed to read JSON file {:?}: {}", abs_path, e);
                continue;
            }
        };

        let parsed: Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(e) => {
                trace!("Failed to parse JSON file {:?}: {}", abs_path, e);
                // If we can't parse it as JSON, hash the raw content
                hasher.update(file_path.as_bytes());
                hasher.update(content.as_bytes());
                result_files.push(file_path.to_string());
                continue;
            }
        };

        let filtered = filter_json_value(&parsed, fields, exclude_fields);

        // Serialize deterministically (serde_json sorts keys for Value::Object when using BTreeMap internally)
        let serialized = canonical_json_string(&filtered);
        trace!("JSON hash input for {}: {}", file_path, serialized);

        hasher.update(file_path.as_bytes());
        hasher.update(serialized.as_bytes());
        result_files.push(file_path.to_string());
    }

    Ok(JsonHashResult {
        hash: hasher.digest().to_string(),
        files: result_files,
    })
}

/// Filters a JSON value based on field allowlist and denylist.
/// Fields use dot notation for nested access (e.g., "compilerOptions.target").
fn filter_json_value(
    value: &Value,
    fields: Option<&[String]>,
    exclude_fields: Option<&[String]>,
) -> Value {
    // If no filtering specified, return the whole value
    if fields.is_none() && exclude_fields.is_none() {
        return value.clone();
    }

    let Some(obj) = value.as_object() else {
        return value.clone();
    };

    let mut result = if let Some(fields) = fields {
        // Allowlist: only include specified fields
        let mut filtered = serde_json::Map::new();
        for field_path in fields {
            let parts: Vec<&str> = field_path.splitn(2, '.').collect();
            let key = parts[0];
            if let Some(val) = obj.get(key) {
                if parts.len() > 1 {
                    // Nested path: extract nested field
                    let nested = extract_nested_field(val, parts[1]);
                    if let Some(nested_val) = nested {
                        // Merge into existing key if already present
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
                } else {
                    filtered.insert(key.to_string(), val.clone());
                }
            }
        }
        filtered
    } else {
        // No allowlist — start with everything
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
/// e.g., for path "target" on {"target": "ES2021", "paths": {...}},
/// returns {"target": "ES2021"}
fn extract_nested_field(value: &Value, remaining_path: &str) -> Option<Value> {
    let parts: Vec<&str> = remaining_path.splitn(2, '.').collect();
    let key = parts[0];

    match value.as_object() {
        Some(obj) => {
            if let Some(val) = obj.get(key) {
                if parts.len() > 1 {
                    // More nesting
                    extract_nested_field(val, parts[1]).map(|nested| {
                        let mut wrapper = serde_json::Map::new();
                        wrapper.insert(key.to_string(), nested);
                        Value::Object(wrapper)
                    })
                } else {
                    let mut wrapper = serde_json::Map::new();
                    wrapper.insert(key.to_string(), val.clone());
                    Some(Value::Object(wrapper))
                }
            } else {
                None
            }
        }
        None => None,
    }
}

/// Removes a field from a JSON object using dot-notation path.
fn remove_nested_field(obj: &mut serde_json::Map<String, Value>, path: &str) {
    let parts: Vec<&str> = path.splitn(2, '.').collect();
    let key = parts[0];

    if parts.len() > 1 {
        // Recurse into nested object
        if let Some(Value::Object(nested)) = obj.get_mut(key) {
            remove_nested_field(nested, parts[1]);
        }
    } else {
        obj.remove(key);
    }
}

/// Produces a canonical (deterministic) JSON string by sorting object keys.
fn canonical_json_string(value: &Value) -> String {
    match value {
        Value::Object(map) => {
            let mut sorted: Vec<(&String, &Value)> = map.iter().collect();
            sorted.sort_by_key(|(k, _)| *k);
            let entries: Vec<String> = sorted
                .into_iter()
                .map(|(k, v)| {
                    format!(
                        "{}:{}",
                        serde_json::to_string(k).unwrap(),
                        canonical_json_string(v)
                    )
                })
                .collect();
            format!("{{{}}}", entries.join(","))
        }
        Value::Array(arr) => {
            let items: Vec<String> = arr.iter().map(|v| canonical_json_string(v)).collect();
            format!("[{}]", items.join(","))
        }
        _ => serde_json::to_string(value).unwrap_or_default(),
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

    #[test]
    fn test_canonical_json_string_sorts_keys() {
        let json: Value = serde_json::from_str(r#"{"z": 1, "a": 2, "m": 3}"#).unwrap();
        let result = canonical_json_string(&json);
        assert_eq!(result, r#"{"a":2,"m":3,"z":1}"#);
    }

    #[test]
    fn test_canonical_json_nested() {
        let json: Value = serde_json::from_str(r#"{"b": {"z": 1, "a": 2}, "a": 3}"#).unwrap();
        let result = canonical_json_string(&json);
        assert_eq!(result, r#"{"a":3,"b":{"a":2,"z":1}}"#);
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

        let result = hash_json_files(
            ws_root,
            "{projectRoot}/package.json",
            Some("my-lib"),
            Some("libs/my-lib"),
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
