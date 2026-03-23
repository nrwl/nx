//! Project graph reading and completion logic.
//! For project names: scans raw JSON bytes without full deserialization.
//! For targets: does a full parse (only when needed).

use std::collections::BTreeSet;
use std::env;
use std::fs;
use std::path::PathBuf;

/// Complete with all project:target pairs matching the current prefix.
/// Typing narrows the list (e.g., "nx:" shows all nx targets, "nx:b" shows nx:build).
pub fn get_project_target_completions(current: &str) -> Vec<String> {
    let raw = match read_cached_graph_raw() {
        Some(r) => r,
        None => return vec![],
    };

    let graph: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(g) => g,
        Err(_) => return vec![],
    };

    let nodes = match graph.get("nodes").and_then(|n| n.as_object()) {
        Some(n) => n,
        None => return vec![],
    };

    let mut results = Vec::new();
    for (name, node) in nodes {
        if let Some(targets) = node
            .get("data")
            .and_then(|d| d.get("targets"))
            .and_then(|t| t.as_object())
        {
            for target in targets.keys() {
                let pair = format!("{name}:{target}");
                if current.is_empty() || pair.starts_with(current) {
                    results.push(pair);
                }
            }
        }
    }
    results
}

/// Fast project name extraction by scanning raw JSON bytes.
pub fn get_project_completions(prefix: &str) -> Vec<String> {
    let raw = match read_cached_graph_raw() {
        Some(r) => r,
        None => return vec![],
    };
    extract_node_keys(&raw, prefix)
}

/// Return projects that have a specific target (e.g., only projects with a "build" target).
pub fn get_projects_with_target(prefix: &str, target: &str) -> Vec<String> {
    let raw = match read_cached_graph_raw() {
        Some(r) => r,
        None => return vec![],
    };

    let graph: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(g) => g,
        Err(_) => return vec![],
    };

    let nodes = match graph.get("nodes").and_then(|n| n.as_object()) {
        Some(n) => n,
        None => return vec![],
    };

    nodes
        .iter()
        .filter(|(name, node)| {
            (prefix.is_empty() || name.starts_with(prefix))
                && node
                    .get("data")
                    .and_then(|d| d.get("targets"))
                    .and_then(|t| t.get(target))
                    .is_some()
        })
        .map(|(name, _)| name.clone())
        .collect()
}

pub fn get_target_completions(prefix: &str, project: Option<&str>) -> Vec<String> {
    let raw = match read_cached_graph_raw() {
        Some(r) => r,
        None => return vec![],
    };

    let graph: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(g) => g,
        Err(_) => return vec![],
    };

    let nodes = match graph.get("nodes").and_then(|n| n.as_object()) {
        Some(n) => n,
        None => return vec![],
    };

    if let Some(project_name) = project {
        nodes
            .get(project_name)
            .and_then(|node| node.get("data"))
            .and_then(|data| data.get("targets"))
            .and_then(|targets| targets.as_object())
            .map(|targets| {
                targets
                    .keys()
                    .filter(|t| prefix.is_empty() || t.starts_with(prefix))
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    } else {
        let mut targets = BTreeSet::new();
        for node in nodes.values() {
            if let Some(node_targets) = node
                .get("data")
                .and_then(|d| d.get("targets"))
                .and_then(|t| t.as_object())
            {
                for key in node_targets.keys() {
                    if prefix.is_empty() || key.starts_with(prefix) {
                        targets.insert(key.clone());
                    }
                }
            }
        }
        targets.into_iter().collect()
    }
}

/// Scan raw JSON to extract top-level keys from the "nodes" object.
/// This avoids deserializing the entire 5MB+ project graph.
fn extract_node_keys(raw: &str, prefix: &str) -> Vec<String> {
    let bytes = raw.as_bytes();
    let len = bytes.len();

    let needle = b"\"nodes\"";
    let nodes_pos = match find_bytes(bytes, needle) {
        Some(p) => p,
        None => return vec![],
    };

    let mut i = nodes_pos + needle.len();
    while i < len && bytes[i] != b'{' {
        i += 1;
    }
    if i >= len {
        return vec![];
    }

    let mut names = Vec::new();
    let mut depth: i32 = 0;

    while i < len {
        match bytes[i] {
            b'{' => {
                depth += 1;
                i += 1;
            }
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    break;
                }
                i += 1;
            }
            b'"' if depth == 1 => {
                i += 1;
                let start = i;
                while i < len && bytes[i] != b'"' {
                    if bytes[i] == b'\\' {
                        i += 1;
                    }
                    i += 1;
                }
                let key = &raw[start..i];
                i += 1;

                while i < len && bytes[i] == b' ' {
                    i += 1;
                }
                if i < len && bytes[i] == b':' {
                    if prefix.is_empty() || key.starts_with(prefix) {
                        names.push(key.to_string());
                    }
                }
            }
            b'"' => {
                i += 1;
                while i < len && bytes[i] != b'"' {
                    if bytes[i] == b'\\' {
                        i += 1;
                    }
                    i += 1;
                }
                i += 1;
            }
            _ => {
                i += 1;
            }
        }
    }

    names
}

fn find_bytes(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

fn read_cached_graph_raw() -> Option<String> {
    let cwd = env::current_dir().ok()?;
    let data_dir = env::var("NX_WORKSPACE_DATA_DIRECTORY")
        .or_else(|_| env::var("NX_PROJECT_GRAPH_CACHE_DIRECTORY"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| cwd.join(".nx").join("workspace-data"));

    let graph_path = data_dir.join("project-graph.json");
    fs::read_to_string(&graph_path).ok()
}
