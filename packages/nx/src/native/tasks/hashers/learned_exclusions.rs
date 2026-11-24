//! A fileset whose `!` entries Nx Cloud learned from a recording. A learned
//! `*.ext` exclusion matches only files whose whole suffix is `.ext`, which a
//! glob set cannot express, so the exclusions are matched one by one.

use std::collections::HashMap;
use std::sync::Arc;

use anyhow::{Result, anyhow};

use super::disk_expansion::{Negation, parse_group_with_exclusions};
use crate::native::glob::{NxGlobSet, build_glob_set, fileset_patterns};
use crate::native::types::FileData;

pub(crate) struct LearnedFileSet {
    /// `None` when the fileset names nothing.
    positives: Option<Arc<NxGlobSet>>,
    exclusions: Vec<Negation>,
}

impl LearnedFileSet {
    pub(crate) fn new(globs: &[String]) -> Result<Self> {
        let positives: Vec<String> = globs
            .iter()
            .filter(|glob| !glob.starts_with('!'))
            .cloned()
            .collect();
        Ok(Self {
            positives: match positives.is_empty() {
                true => None,
                false => Some(build_glob_set(&fileset_patterns(&positives))?),
            },
            exclusions: parse_group_with_exclusions(globs, true)?.1,
        })
    }

    pub(crate) fn is_match(&self, path: &str) -> bool {
        self.positives
            .as_ref()
            .is_some_and(|positives| positives.is_match(path))
            && !self
                .exclusions
                .iter()
                .any(|exclusion| exclusion.excludes(path))
    }
}

/// Hashes the files of `project`, or every tracked file without one, that
/// `globs` match. Also returns their paths when `collect_paths`.
pub(crate) fn hash_learned_files(
    project: Option<&str>,
    globs: &[String],
    project_file_map: &HashMap<String, Vec<FileData>>,
    all_workspace_files: &[FileData],
    collect_paths: bool,
) -> Result<(String, Vec<String>)> {
    let fileset = LearnedFileSet::new(globs)?;
    let files = match project {
        Some(project) => project_file_map
            .get(project)
            .ok_or_else(|| anyhow!("project {} not found", project))?,
        None => all_workspace_files,
    };
    let mut hasher = xxhash_rust::xxh3::Xxh3::new();
    let mut paths = Vec::new();
    for file in files.iter().filter(|file| fileset.is_match(&file.file)) {
        hasher.update(file.file.as_bytes());
        hasher.update(file.hash.as_bytes());
        if collect_paths {
            paths.push(file.file.clone());
        }
    }
    Ok((hasher.digest().to_string(), paths))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn matched(globs: &[&str], paths: &[&'static str]) -> Vec<&'static str> {
        let globs: Vec<String> = globs.iter().map(|glob| glob.to_string()).collect();
        let fileset = LearnedFileSet::new(&globs).unwrap();
        paths
            .iter()
            .copied()
            .filter(|path| fileset.is_match(path))
            .collect()
    }

    #[test]
    fn a_learned_extension_exclusion_keeps_files_with_a_longer_suffix() {
        let paths = [
            "libs/a/src/x.ts",
            "libs/a/src/x.spec.ts",
            "libs/a/src/x.d.ts",
            "libs/a/src/.eslintrc.ts",
            "libs/a/other/y.ts",
        ];
        assert_eq!(
            matched(&["libs/a/**/*.ts", "!libs/a/src/**/*.ts"], &paths),
            [
                "libs/a/src/x.spec.ts",
                "libs/a/src/x.d.ts",
                "libs/a/other/y.ts"
            ]
        );
        assert_eq!(
            matched(&["libs/a/**/*.ts", "!libs/a/src/**/*.spec.ts"], &paths),
            [
                "libs/a/src/x.ts",
                "libs/a/src/x.d.ts",
                "libs/a/src/.eslintrc.ts",
                "libs/a/other/y.ts"
            ]
        );
    }

    #[test]
    fn a_path_or_directory_exclusion_removes_everything_it_names() {
        let paths = ["libs/a/src/x.ts", "libs/a/src/gen/y.ts", "libs/a/z.ts"];
        assert_eq!(
            matched(&["libs/a", "!libs/a/src/gen", "!libs/a/z.ts"], &paths),
            ["libs/a/src/x.ts"]
        );
        assert!(matched(&["!libs/a/z.ts"], &paths).is_empty());
    }
}
