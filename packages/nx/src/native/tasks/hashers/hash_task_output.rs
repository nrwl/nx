use std::path::Path;

use anyhow::Result;

use super::hash_ignored_files::{
    FileStamp, FilesExpansion, FilesExpansionCache, expand_files_cached, hash_files,
    shared_file_content_cache,
};
use crate::native::glob::build_glob_set;

/// Result of hashing task output files, including the matched file paths
pub struct TaskOutputHashResult {
    pub hash: String,
    pub files: Vec<String>,
}

/// The files under a dependency's declared `outputs` that `glob` selects,
/// read the way an `includeIgnored` fileset is: an entry names a file or
/// everything under a directory, a glob entry walks from its literal prefix,
/// and a `!` entry filters. The outputs' expansion is shared by every task
/// that reads them in one hashing call; `glob` then filters per task.
pub fn expand_task_outputs(
    workspace_root: &Path,
    glob: &str,
    outputs: &[String],
    known: &(dyn Fn(&str) -> bool + Sync),
    cache: &FilesExpansionCache,
) -> Result<FilesExpansion> {
    let entries: Vec<String> = outputs
        .iter()
        .filter_map(|entry| normalize_output_entry(entry))
        .collect();
    let key = format!("outputs:[{}]", entries.join(","));
    let expansion = expand_files_cached(workspace_root, &key, &entries, cache, known)?;
    let selected = build_glob_set(&[glob])?;
    let (files, stamps): (Vec<String>, Vec<Option<FileStamp>>) = expansion
        .files
        .iter()
        .zip(&expansion.stamps)
        .filter(|(file, _)| selected.is_match(file))
        .map(|(file, stamp)| (file.clone(), *stamp))
        .unzip();
    // An output that does not exist is not an input.
    Ok(FilesExpansion {
        files,
        stamps,
        missing: Vec::new(),
        walks: expansion.walks.clone(),
    })
}

pub fn hash_task_output(
    workspace_root: &Path,
    glob: &str,
    outputs: &[String],
    known: &(dyn Fn(&str) -> bool + Sync),
    known_hash: impl Fn(&str) -> Option<String> + Sync,
    cache: &FilesExpansionCache,
) -> Result<TaskOutputHashResult> {
    let expansion = expand_task_outputs(workspace_root, glob, outputs, known, cache)?;
    let hash = hash_files(
        workspace_root,
        &expansion,
        known_hash,
        shared_file_content_cache(),
    );
    Ok(TaskOutputHashResult {
        hash,
        files: expansion.files,
    })
}

/// The file-resolution half of `hash_task_output`, for the inspector.
pub fn resolve_task_output_files(
    workspace_root: &Path,
    glob: &str,
    outputs: &[String],
    known: &(dyn Fn(&str) -> bool + Sync),
) -> Result<Vec<String>> {
    let expansion = expand_task_outputs(
        workspace_root,
        glob,
        outputs,
        known,
        &FilesExpansionCache::new(),
    )?;
    Ok(expansion.files)
}

/// Resolves `.` and `..` lexically: outputs are declared relative to the
/// workspace and may climb (`{projectRoot}/../shared`). An entry that leaves
/// the workspace, or is absolute, names nothing here.
fn normalize_output_entry(entry: &str) -> Option<String> {
    let (bang, body) = match entry.strip_prefix('!') {
        Some(rest) => ("!", rest),
        None => ("", entry),
    };
    if body.starts_with('/') {
        return None;
    }
    let mut segments: Vec<&str> = Vec::new();
    for segment in body.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                segments.pop()?;
            }
            other => segments.push(other),
        }
    }
    Some(format!("{bang}{}", segments.join("/")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    fn strings(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    fn workspace() -> TempDir {
        let temp = TempDir::new().unwrap();
        for file in [
            "dist/apps/web/index.js",
            "dist/apps/web/index.js.map",
            "dist/apps/web/assets/a.css",
            "dist/@scope/pkg/index.js",
            "dist/libs/lib/index.js",
        ] {
            temp.child(file).write_str(file).unwrap();
        }
        temp
    }

    fn files(temp: &TempDir, glob: &str, outputs: &[&str]) -> Vec<String> {
        resolve_task_output_files(temp.path(), glob, &strings(outputs), &|_| false).unwrap()
    }

    #[test]
    fn selects_the_files_the_glob_names_under_the_declared_outputs() {
        let temp = workspace();
        assert_eq!(
            files(&temp, "**/*.js", &["dist/apps/web"]),
            vec!["dist/apps/web/index.js"]
        );
        assert_eq!(
            files(&temp, "**/*", &["dist/apps/web/**/*.css"]),
            vec!["dist/apps/web/assets/a.css"]
        );
        assert_eq!(
            files(&temp, "**/*", &["dist/apps/web", "!dist/apps/web/**/*.map"]),
            vec!["dist/apps/web/assets/a.css", "dist/apps/web/index.js"]
        );
        assert_eq!(
            files(&temp, "**/*.js", &["dist/apps/web", "dist/libs/lib"]),
            vec!["dist/apps/web/index.js", "dist/libs/lib/index.js"]
        );
    }

    #[test]
    fn keeps_at_in_an_output_prefix() {
        let temp = workspace();
        assert_eq!(
            files(&temp, "**/*.js", &["dist/@scope/pkg/**"]),
            vec!["dist/@scope/pkg/index.js"]
        );
    }

    #[test]
    fn resolves_dot_segments_and_drops_entries_that_leave_the_workspace() {
        assert_eq!(
            normalize_output_entry("apps/web/../shared").as_deref(),
            Some("apps/shared")
        );
        assert_eq!(normalize_output_entry("./dist/").as_deref(), Some("dist"));
        assert_eq!(
            normalize_output_entry("!apps/web/../shared/**").as_deref(),
            Some("!apps/shared/**")
        );
        assert_eq!(normalize_output_entry("../outside"), None);
        assert_eq!(normalize_output_entry("/abs/dist"), None);
        let temp = workspace();
        assert_eq!(
            files(&temp, "**/*.js", &["dist/apps/web/../../libs/lib"]),
            vec!["dist/libs/lib/index.js"]
        );
    }

    #[test]
    fn a_missing_output_is_not_an_input() {
        let temp = workspace();
        let cache = FilesExpansionCache::new();
        let hash = |outputs: &[&str]| {
            hash_task_output(
                temp.path(),
                "**/*.js",
                &strings(outputs),
                &|_| false,
                |_| None,
                &cache,
            )
            .unwrap()
        };
        let with_absent = hash(&["dist/absent", "dist/apps/web"]);
        let without = hash(&["dist/apps/web"]);
        assert_eq!(with_absent.files, vec!["dist/apps/web/index.js"]);
        assert_eq!(with_absent.hash, without.hash);
    }

    #[test]
    fn the_hash_follows_the_content() {
        let temp = workspace();
        let hash = || {
            hash_task_output(
                temp.path(),
                "**/*.js",
                &strings(&["dist/apps/web"]),
                &|_| false,
                |_| None,
                &FilesExpansionCache::new(),
            )
            .unwrap()
            .hash
        };
        let first = hash();
        assert_eq!(first, hash());
        temp.child("dist/apps/web/index.js")
            .write_str("changed")
            .unwrap();
        assert_ne!(first, hash());
    }
}
