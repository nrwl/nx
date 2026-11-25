//! One invocation's disk files, indexed in workspace-relative path order.
//! Explicit roots hidden beneath a skipped subtree get their own visibility.
use super::super::{MIN_BATCH_GROUPS, OnceCache};
use super::FilesExpansion;
use super::parse_group;
use anyhow::Result;
use rayon::prelude::*;
use std::collections::HashSet;
use std::fmt::Write;
use std::ops::Range;
use std::path::Path;
use std::sync::OnceLock;

use crate::native::tasks::types::{HashInstruction, HashPlans};
use crate::native::walker::{DiskWalkIgnores, PathPredicate};
struct File {
    path: String,
    // Length of the widest requested root whose walk can see this file.
    visible_from: usize,
    content: OnceLock<Option<String>>,
}

pub(crate) struct SettledFiles {
    entries: Vec<File>,
    directory_roots: HashSet<String>,
    counts: InventoryCounts,
    positives: OnceCache<Vec<u32>>,
    negatives: OnceCache<Vec<u32>>,
}

impl SettledFiles {
    fn inventory(workspace_root: &Path, roots: HashSet<&str>) -> Result<Self> {
        let timer = std::time::Instant::now();
        let mut counts = InventoryCounts {
            requested_roots: roots.len(),
            ..Default::default()
        };
        let ignores = DiskWalkIgnores::new()?;
        let mut roots = Vec::from_iter(roots);
        roots.sort_unstable_by_key(|root| root.len());
        let mut directories = HashSet::new();
        let mut directory_roots = HashSet::new();
        let mut entries = Vec::new();
        let explicit_files: hashbrown::HashSet<&str> = roots.iter().copied().collect();
        let mut seen_files = hashbrown::HashSet::new();
        for root in roots {
            let start = workspace_root.join(root);
            if directories.contains(&start) {
                continue;
            }
            if seen_files.contains(root) {
                continue;
            }
            let Ok(metadata) = std::fs::metadata(&start) else {
                continue;
            };
            if metadata.is_file() {
                entries.push(File {
                    path: root.to_owned(),
                    visible_from: root.len(),
                    content: OnceLock::new(),
                });
                seen_files.insert(root.to_owned());
                continue;
            }
            if !metadata.is_dir() {
                directory_roots.insert(root.to_string());
                continue;
            }
            counts.traversal_starts += 1;
            let mut level = vec![start];
            while !level.is_empty() {
                level.retain(|d| directories.insert(d.clone()));
                counts.read_dir_calls += level.len();
                let children: Vec<_> = level
                    .par_iter()
                    .map(|dir| {
                        let mut dirs = Vec::new();
                        let mut files = Vec::new();
                        if let Ok(list) = std::fs::read_dir(dir) {
                            for entry in list.flatten() {
                                let path = entry.path();
                                if ignores.skips(&path) {
                                    continue;
                                }
                                let Ok(kind) = entry.file_type() else {
                                    continue;
                                };
                                if kind.is_dir() {
                                    dirs.push(path);
                                } else if kind.is_file()
                                    || (kind.is_symlink()
                                        && std::fs::metadata(&path).is_ok_and(|m| !m.is_dir()))
                                {
                                    if let Ok(relative) = path.strip_prefix(workspace_root) {
                                        files.push(relative.to_string_lossy().replace('\\', "/"));
                                    }
                                }
                            }
                        }
                        (dirs, files)
                    })
                    .collect();
                level.clear();
                for (mut dirs, files) in children {
                    level.append(&mut dirs);
                    for path in files {
                        // A literal root may also have been reached from a broader walk.
                        if explicit_files.contains(path.as_str()) {
                            seen_files.insert(path.clone());
                        }
                        entries.push(File {
                            path,
                            visible_from: root.len(),
                            content: OnceLock::new(),
                        });
                    }
                }
            }
        }
        // An explicit file root may also have been found below a directory.
        // Keep its widest visibility and assign one ID for all its consumers.
        entries.par_sort_unstable_by(|a, b| {
            a.path
                .cmp(&b.path)
                .then(a.visible_from.cmp(&b.visible_from))
        });
        entries.dedup_by(|a, b| a.path == b.path);
        counts.unique_directories = directories.len();
        directory_roots.extend(directories.into_iter().filter_map(|dir| {
            dir.strip_prefix(workspace_root)
                .ok()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
        }));
        counts.files = entries.len();
        counts.scan_seconds = timer.elapsed().as_secs_f64();
        Ok(Self {
            counts,
            entries,
            directory_roots,
            positives: OnceCache::new(),
            negatives: OnceCache::new(),
        })
    }

    // A sibling such as "pkg-tests" sorts between "pkg" and "pkg/".
    fn below(&self, root: &str) -> Range<usize> {
        if root.is_empty() {
            return 0..self.entries.len();
        }
        let prefix = format!("{root}/");
        let start = self
            .entries
            .partition_point(|f| f.path.as_str() < prefix.as_str());
        let end = start + self.entries[start..].partition_point(|f| f.path.starts_with(&prefix));
        start..end
    }

    fn exact(&self, path: &str) -> Option<usize> {
        self.entries
            .binary_search_by(|file| file.path.as_str().cmp(path))
            .ok()
    }
}

#[derive(Default)]
struct InventoryCounts {
    requested_roots: usize,
    traversal_starts: usize,
    read_dir_calls: usize,
    unique_directories: usize,
    files: usize,
    scan_seconds: f64,
}

impl SettledFiles {
    pub(crate) fn for_plans(
        workspace: &Path,
        plans: &HashPlans,
        is_tracked: PathPredicate,
    ) -> Result<Option<Self>> {
        let timer = std::time::Instant::now();
        use crate::native::tasks::plan::{Plan, kind};
        let disk: Vec<_> = plans
            .plans
            .values()
            .filter(|p| p.has(kind::DISK))
            .map(|p| p.only(kind::DISK))
            .collect();
        let ids = Plan::union_ids(&disk);
        // For a few distinct instructions retain the index's ordinary
        // pruned expansion. Older plans in the same pool do not affect this choice.
        if ids.len() < MIN_BATCH_GROUPS {
            return Ok(None);
        }
        let mut seen_globs = HashSet::<std::sync::Arc<str>>::new();
        let mut roots = HashSet::<String>::new();
        let mut tracked_literals = hashbrown::HashSet::new();
        for id in ids {
            let instruction = plans.pool.get(id);
            if let HashInstruction::IgnoredFileSet { globs, .. } = instruction.value() {
                for glob in globs.iter() {
                    if glob.starts_with('!') || seen_globs.contains(glob.as_ref()) {
                        continue;
                    }
                    seen_globs.insert(glob.clone());
                    for positive in parse_group(&[glob])?.0 {
                        // An upfront exact tracked file already has a workspace hash.
                        if positive.below.is_pattern() || !is_tracked(&positive.root) {
                            roots.insert(positive.root);
                        } else {
                            tracked_literals.insert(positive.root);
                        }
                    }
                }
            }
        }

        let roots = roots.iter().map(String::as_str).collect();
        let preparation = timer.elapsed().as_secs_f64();
        let mut inventory = Self::inventory(workspace, roots)?;
        // A direct tracked read may be absent on disk in the frozen up-front snapshot.
        let mut extra: Vec<_> = tracked_literals
            .into_iter()
            .filter(|path| inventory.exact(path).is_none())
            .map(|path| File {
                path,
                visible_from: usize::MAX,
                content: OnceLock::new(),
            })
            .collect();
        if !extra.is_empty() {
            inventory.entries.append(&mut extra);
            inventory
                .entries
                .par_sort_unstable_by(|a, b| a.path.cmp(&b.path));
        }
        tracing::debug!(target: "nx::native::tasks::task_hasher",
            "disk inventory: {} roots, {} directory reads, {} files in {:.3}s (+ {:.3}s setup)",
            inventory.counts.requested_roots, inventory.counts.read_dir_calls, inventory.counts.files,
            inventory.counts.scan_seconds, preparation);
        Ok(Some(inventory))
    }

    // Exact tracked files still use the workspace snapshot up front. Directory
    // matches must be visible from the requested root, including at ignored boundaries.
    fn positive_ids(
        &self,
        glob: &str,
        tracked: PathPredicate,
        scope: &super::ProjectScope,
    ) -> Result<Vec<u32>> {
        let mut ids = Vec::new();
        for positive in parse_group(&[glob])?.0 {
            let root = &positive.root;
            let has_pattern = positive.below.is_pattern();
            if let Some(id) = self.exact(root) {
                let file = &self.entries[id];
                if !has_pattern && (tracked(root) || file.visible_from != usize::MAX) {
                    ids.push(id as u32);
                    continue;
                }
                if file.visible_from != usize::MAX {
                    continue;
                }
            }
            if !self.directory_roots.contains(root) {
                continue;
            }
            ids.extend(
                self.below(root)
                    .filter(|&i| {
                        let file = &self.entries[i];
                        file.visible_from <= root.len()
                            && scope.admits(&positive, &file.path)
                            && positive.matches(&file.path)
                    })
                    .map(|i| i as u32),
            );
        }
        ids.sort_unstable();
        ids.dedup();
        Ok(ids)
    }

    fn negative_ids(&self, glob: &str) -> Result<Vec<u32>> {
        let mut ids = Vec::new();
        for n in parse_group(&[glob])?.1 {
            let root = n.root.as_str();
            ids.extend(
                self.exact(root)
                    .into_iter()
                    .chain(self.below(root))
                    .filter(|&i| n.excludes(&self.entries[i].path))
                    .map(|i| i as u32),
            );
        }
        ids.sort_unstable();
        ids.dedup();
        Ok(ids)
    }

    fn matches(
        &self,
        globs: &[impl AsRef<str>],
        roots: &[String],
        tracked: PathPredicate,
    ) -> Result<impl Iterator<Item = &File>> {
        // Length-frame the roots so a glob containing a separator cannot alias
        // another group with a different number of roots.
        let mut scope_key = String::new();
        for root in roots {
            write!(scope_key, "{}:{root}", root.len()).expect("writing to a String");
        }
        let scope = std::cell::OnceCell::new();
        let mut positives = Vec::new();
        let mut negatives = Vec::new();
        for glob in globs {
            let glob = glob.as_ref();
            if glob.starts_with('!') {
                let group = self
                    .negatives
                    .get_or_try_init(glob.to_string(), || self.negative_ids(glob))?;
                if !group.is_empty() {
                    negatives.push(group);
                }
            } else {
                let group =
                    self.positives
                        .get_or_try_init(format!("{scope_key}\0{glob}"), || {
                            self.positive_ids(
                                glob,
                                tracked,
                                scope.get_or_init(|| super::ProjectScope::new(roots)),
                            )
                        })?;
                positives.extend_from_slice(&group);
            }
        }
        positives.sort_unstable();
        positives.dedup();
        let probes = negatives.iter().map(|g| g.len()).sum::<usize>();
        // Tiny positives can probe broad negative sets directly. Otherwise
        // subtract sorted IDs in one pass, preserving canonical path order.
        if probes > positives.len().saturating_mul(32) {
            positives.retain(|id| negatives.iter().all(|g| g.binary_search(id).is_err()));
        } else if probes != 0 {
            let mut excluded: Vec<_> = negatives.iter().flat_map(|g| g.iter().copied()).collect();
            excluded.sort_unstable();
            excluded.dedup();
            let mut excluded = excluded.into_iter().peekable();
            positives.retain(|id| {
                while excluded.next_if(|n| n < id).is_some() {}
                excluded.next_if_eq(id).is_none()
            });
        }
        Ok(positives.into_iter().map(|id| &self.entries[id as usize]))
    }

    pub(crate) fn file_hashes(
        &self,
        globs: &[impl AsRef<str>],
        roots: &[String],
        tracked: PathPredicate,
        read: impl Fn(&str) -> Option<String>,
    ) -> Result<Vec<(String, String)>> {
        Ok(self
            .matches(globs, roots, tracked)?
            .filter_map(|file| {
                let value = file.content.get_or_init(|| read(&file.path)).as_ref()?;
                Some((file.path.clone(), value.clone()))
            })
            .collect())
    }

    pub(crate) fn paths(
        &self,
        globs: &[impl AsRef<str>],
        roots: &[String],
        tracked: PathPredicate,
    ) -> Result<FilesExpansion> {
        Ok(FilesExpansion {
            files: self
                .matches(globs, roots, tracked)?
                .map(|f| f.path.clone())
                .collect(),
        })
    }

    pub(crate) fn hash(
        &self,
        globs: &[impl AsRef<str>],
        roots: &[String],
        tracked: PathPredicate,
        read: impl Fn(&str) -> Option<String>,
        collect_inputs: bool,
    ) -> Result<(String, Vec<String>)> {
        let mut hash = xxhash_rust::xxh3::Xxh3::new();
        let mut inputs = Vec::new();
        for file in self.matches(globs, roots, tracked)? {
            if collect_inputs {
                inputs.push(file.path.clone());
            }
            if let Some(value) = file.content.get_or_init(|| read(&file.path)) {
                hash.update(file.path.as_bytes());
                hash.update(value.as_bytes());
            }
        }
        Ok((hash.digest().to_string(), inputs))
    }

    #[cfg(test)]
    pub(crate) fn positive(
        &self,
        glob: &str,
        tracked: PathPredicate,
        scope: &super::ProjectScope,
    ) -> Result<FilesExpansion> {
        Ok(FilesExpansion {
            files: self
                .positive_ids(glob, tracked, scope)?
                .into_iter()
                .map(|i| self.entries[i as usize].path.clone())
                .collect(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::super::{ProjectScope, Source, expand_globs};
    use super::*;
    use assert_fs::TempDir;

    #[test]
    fn invalid_positive_patterns_are_reported_even_for_missing_directories() -> Result<()> {
        let temp = TempDir::new()?;
        let root = temp.path();
        let group = ["new/[z-a]"];
        let source = Source::fileset_from_disk(root);
        for exists in [false, true] {
            if exists {
                std::fs::create_dir(root.join("new"))?;
            }
            let inventory = SettledFiles::inventory(root, ["new"].into_iter().collect())?;
            let old = expand_globs(&group, &[], &source);
            let indexed = inventory.paths(&group, &[], &|_| false);
            assert!(old.is_err());
            assert_eq!(
                indexed.err().map(|e| e.to_string()),
                old.err().map(|e| e.to_string())
            );
        }
        Ok(())
    }

    #[test]
    fn overlapping_walks_agree_with_independent_expansion_across_visibility_boundaries()
    -> Result<()> {
        let temp = TempDir::new()?;
        let external = TempDir::new()?;
        let workspace = temp.path();
        for name in [
            "pkg/src/a.ts",
            "pkg/src/b.css",
            "pkg-extra/z.ts",
            "pkg/nested/a.ts",
            "pkg/node_modules/sub/hidden.ts",
        ] {
            let path = workspace.join(name);
            std::fs::create_dir_all(path.parent().unwrap())?;
            std::fs::write(path, "x")?;
        }
        #[cfg(unix)]
        {
            std::fs::write(external.path().join("linked.ts"), "x")?;
            std::os::unix::fs::symlink(external.path(), workspace.join("pkg/external"))?;
            std::os::unix::fs::symlink(
                workspace.join("pkg/src/a.ts"),
                workspace.join("pkg/linked.ts"),
            )?;
        }
        let roots = [
            "",
            "pkg",
            "pkg/src",
            "pkg-extra",
            "pkg/node_modules/sub",
            "pkg/external",
            "missing",
        ];
        let scope_roots = vec!["pkg".into(), "pkg/nested".into()];
        let scope = ProjectScope::new(&scope_roots);
        let inventory = SettledFiles::inventory(workspace, roots.into_iter().collect())?;
        let patterns = [
            "pkg/**/*.ts",
            "pkg/src",
            "pkg/src/**/*.{ts,css}",
            "pkg-extra/**/*.ts",
            "pkg/node_modules/sub/**/*.ts",
            "missing/*.ts",
            "pkg/src/a.ts",
            "pkg/external/**/*.ts",
            "pkg/linked.ts",
            "**/*.ts",
        ];
        for glob in patterns {
            let glob = glob.to_string();
            assert_eq!(
                inventory.positive(&glob, &|_| false, &scope)?.files,
                expand_globs(
                    std::slice::from_ref(&glob),
                    &scope_roots,
                    &Source::fileset_from_disk(workspace)
                )?
                .files,
                "{glob}"
            );
        }
        assert_eq!(
            inventory.counts.read_dir_calls,
            inventory.counts.unique_directories
        );
        let new_file = "pkg/src/producer-output.ts";
        std::fs::write(workspace.join(new_file), "new contents")?;
        let fresh = SettledFiles::inventory(workspace, ["pkg"].into_iter().collect())?;
        assert!(
            fresh
                .positive("pkg/src/*.ts", &|_| false, &scope)?
                .files
                .iter()
                .any(|p| p == new_file)
        );
        Ok(())
    }
    #[test]
    fn shared_ids_match_independent_hash_and_paths_for_learned_and_declared_groups() -> Result<()> {
        use super::super::expand_globs;
        use crate::native::tasks::hashers::hash_files;
        use crate::native::workspace::ignored_index::{IgnoredIndex, RunStage};
        let temp = TempDir::new()?;
        let root = temp.path();
        std::fs::create_dir_all(root.join("p/nested"))?;
        for f in [
            "a.ts",
            "a.spec.ts",
            "a.d.ts",
            ".env",
            "b.css",
            "nested/b.ts",
        ] {
            std::fs::write(root.join("p").join(f), f)?;
        }
        let source = Source::fileset_from_disk(root);
        let reference = IgnoredIndex::new(None);
        let inventory = SettledFiles::inventory(root, ["p"].into_iter().collect())?;
        let known = |p: &str| std::fs::read_to_string(root.join(p)).ok();
        {
            for neg in [
                "!p/**/*.ts",
                "!p/**/*.{spec.ts,d.ts}",
                "!p/nested/**",
                "!p/.env",
                "!p/**/*",
            ] {
                for positive in ["p/**/*", "p/**/*.{ts,css}", "p/a.spec.ts", "p/missing.ts"] {
                    let group = [positive.to_string(), neg.to_string()];
                    let old = expand_globs(&group, &[], &source)?;
                    let expected =
                        hash_files(root, &old, known, &reference, RunStage::ATaskMayHaveWritten);
                    let (actual, paths) = inventory.hash(&group, &[], &|_| false, known, true)?;
                    assert_eq!((actual, paths), (expected, old.files), "{group:?}");
                }
            }
        }
        Ok(())
    }
}
