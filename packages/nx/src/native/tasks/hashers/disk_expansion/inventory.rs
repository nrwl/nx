//! One invocation's disk files, indexed in workspace-relative path order.
//! Explicit roots hidden beneath a skipped subtree get their own visibility.
use super::super::{MIN_BATCH_GROUPS, OnceCache};
use super::entries::{Negation, Positive};
use super::{FilesExpansion, ProjectScope, parse_group};
use anyhow::Result;
use dashmap::{DashMap, mapref::entry::Entry};
use hashbrown::{HashMap, HashSet};
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use rayon::prelude::*;
use std::fs::Metadata;
use std::ops::Range;
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};

use crate::native::glob::expand_literal_braces;
use crate::native::tasks::types::{HashInstruction, HashPlans};
use crate::native::utils::path::{escapes_workspace, parent_dirs};
use crate::native::walker::{
    DiskWalkIgnores, PathPredicate, disk_relative_path, is_normalized_disk_root,
};

const MIN_PARALLEL_DISK_OPS: usize = 64;
const MIN_DISK_CHUNK_SIZE: usize = 16;

struct File {
    path: String,
    // Length of the widest requested root whose walk can see this file.
    visible_from: usize,
    content: OnceLock<Option<String>>,
    reading: Mutex<()>,
}

impl File {
    fn new(path: String, visible_from: usize) -> Self {
        Self {
            path,
            visible_from,
            content: OnceLock::new(),
            reading: Mutex::new(()),
        }
    }

    fn hash(&self, read: &impl Fn(&str) -> Option<String>) -> Option<&str> {
        self.content
            .get()
            .unwrap_or_else(|| {
                let _reading = self.reading.lock();
                self.content.get_or_init(|| read(&self.path))
            })
            .as_deref()
    }
}

struct PositiveMatches {
    // Exact files bypass project scope. Directory matches retain the walk
    // root so each group can apply its own nested project boundaries.
    directory: Option<String>,
    ids: Vec<u32>,
}

type DirectoryListings = DashMap<(String, Vec<String>), Arc<OnceCell<Vec<String>>>>;

pub(crate) struct SettledFiles {
    groups: HashSet<u32>,
    entries: Vec<File>,
    directory_roots: HashSet<String>,
    counts: InventoryCounts,
    positives: OnceCache<Vec<PositiveMatches>>,
    negatives: OnceCache<Vec<u32>>,
    pruned_listings: DirectoryListings,
}

impl SettledFiles {
    fn inventory(workspace_root: &Path, roots: HashSet<&str>) -> Result<Self> {
        Self::inventory_with_metadata(workspace_root, roots, |path| std::fs::metadata(path).ok())
    }

    fn inventory_with_metadata(
        workspace_root: &Path,
        roots: HashSet<&str>,
        metadata: impl Fn(&Path) -> Option<Metadata> + Sync,
    ) -> Result<Self> {
        let timer = std::time::Instant::now();
        let mut counts = InventoryCounts {
            requested_roots: roots.len(),
            ..Default::default()
        };
        let ignores = DiskWalkIgnores::new()?;
        // Walk shallower roots first. Siblings can be stat'ed together once
        // any ancestor walks have covered the roots they can see.
        let mut roots: Vec<_> = roots
            .into_iter()
            .map(|root| {
                let depth =
                    usize::from(!root.is_empty()) + root.bytes().filter(|&c| c == b'/').count();
                (depth, root)
            })
            .collect();
        roots.sort_unstable_by_key(|&(depth, _)| depth);
        let mut directories = HashSet::new();
        let mut directory_roots = HashSet::new();
        let mut entries = Vec::new();
        let explicit_files: HashSet<&str> = roots.iter().map(|&(_, root)| root).collect();
        let mut seen_files = HashSet::new();
        for layer in roots.chunk_by(|a, b| a.0 == b.0) {
            let uncovered: Vec<_> = layer
                .iter()
                .filter_map(|&(_, root)| {
                    if seen_files.contains(root) {
                        return None;
                    }
                    let start = workspace_root.join(root);
                    (!directories.contains(&start)).then_some((root, start))
                })
                .collect();
            let stat =
                |(root, start): (_, PathBuf)| metadata(&start).map(|meta| (root, meta.file_type()));
            let stats: Vec<_> =
                if uncovered.len() >= MIN_PARALLEL_DISK_OPS && rayon::current_num_threads() > 1 {
                    uncovered
                        .into_par_iter()
                        .with_min_len(MIN_DISK_CHUNK_SIZE)
                        .filter_map(stat)
                        .collect()
                } else {
                    uncovered.into_iter().filter_map(stat).collect()
                };
            for (root, kind) in stats {
                if kind.is_file() {
                    entries.push(File::new(root.to_owned(), root.len()));
                    seen_files.insert(root.to_owned());
                    continue;
                }
                directory_roots.insert(root.to_owned());
                if !kind.is_dir() {
                    continue;
                }
                counts.traversal_starts += 1;
                let mut level = vec![workspace_root.join(root)];
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
                                    let Some(relative) = disk_relative_path(workspace_root, &path)
                                    else {
                                        continue;
                                    };
                                    let Ok(kind) = entry.file_type() else {
                                        continue;
                                    };
                                    if kind.is_dir() {
                                        dirs.push(path);
                                    } else if kind.is_file()
                                        || (kind.is_symlink()
                                            && std::fs::metadata(&path).is_ok_and(|m| !m.is_dir()))
                                    {
                                        files.push(relative.into_owned());
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
                            entries.push(File::new(path, root.len()));
                        }
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
            disk_relative_path(workspace_root, &dir).map(|path| path.into_owned())
        }));
        counts.files = entries.len();
        counts.scan_seconds = timer.elapsed().as_secs_f64();
        Ok(Self {
            groups: HashSet::new(),
            counts,
            entries,
            directory_roots,
            positives: OnceCache::new(),
            negatives: OnceCache::new(),
            pruned_listings: DirectoryListings::new(),
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
        let ignores = DiskWalkIgnores::new()?;
        let mut groups = HashSet::new();
        let mut positives_by_glob = HashMap::<Arc<str>, Vec<Positive>>::new();
        let mut noncanonical = HashSet::new();
        let mut skip_roots_by_glob = HashMap::<Arc<str>, Vec<String>>::new();
        let mut skip_is_dir = HashMap::new();
        let mut group_globs = HashSet::new();
        for id in ids {
            let instruction = plans.pool.get(id);
            if let HashInstruction::IgnoredFileSet {
                globs,
                project_roots,
                ..
            } = instruction.value()
            {
                let positives = globs.iter().filter(|glob| !glob.starts_with('!'));
                for glob in positives.clone() {
                    if !positives_by_glob.contains_key(glob.as_ref()) {
                        // Let the ordinary expansion report malformed entries in their group order.
                        let Ok((entries, _)) = parse_group(&[glob]) else {
                            return Ok(None);
                        };
                        if entries
                            .iter()
                            .any(|entry| !is_normalized_disk_root(&entry.root))
                        {
                            noncanonical.insert(glob.clone());
                        }
                        positives_by_glob.insert(glob.clone(), entries);
                    }
                }
                // The ordinary walker may return noncanonical paths with their original spelling.
                if !noncanonical.is_empty()
                    && positives.clone().any(|g| noncanonical.contains(g.as_ref()))
                {
                    continue;
                }
                let entries = positives.clone().flat_map(|glob| &positives_by_glob[glob]);
                // A nested boundary requires both the owner and a distinct project below it.
                if project_roots.len() > 1 {
                    let scope = ProjectScope::new(project_roots);
                    if entries
                        .clone()
                        .any(|entry| scope.nested_roots(&entry.root).next().is_some())
                    {
                        continue;
                    }
                }
                let walk_roots = std::cell::OnceCell::new();
                if globs
                    .iter()
                    .filter(|glob| glob.starts_with('!'))
                    .any(|glob| {
                        let dirs = skip_roots_by_glob.entry(glob.clone()).or_insert_with(|| {
                            expand_literal_braces(glob)
                                .iter()
                                .filter_map(|expanded| Negation::possible_skip_root(expanded))
                                .collect()
                        });
                        // An excluded file cannot prune a traversal. Drop it from
                        // further group checks once a relevant walk has probed it.
                        dirs.retain(|dir| skip_is_dir.get(dir) != Some(&false));
                        dirs.iter().any(|dir| {
                            let roots: &HashSet<_> = walk_roots
                                .get_or_init(|| entries.clone().map(|e| e.root.as_str()).collect());
                            (roots.contains("") || parent_dirs(dir).any(|p| roots.contains(p)))
                                && *skip_is_dir.entry(dir.clone()).or_insert_with(|| {
                                    let path = workspace.join(dir);
                                    !escapes_workspace(Path::new(dir))
                                        && !ignores.skips(&path)
                                        && std::fs::symlink_metadata(path)
                                            .is_ok_and(|meta| meta.is_dir())
                                })
                        })
                    })
                {
                    continue;
                }
                groups.insert(id);
                group_globs.extend(positives.cloned());
            }
        }
        if groups.len() < MIN_BATCH_GROUPS {
            return Ok(None);
        }
        let mut roots = HashSet::new();
        let mut tracked_literals = HashSet::new();
        for glob in group_globs {
            for positive in &positives_by_glob[&glob] {
                // An upfront exact tracked file already has a workspace hash.
                if positive.below.is_pattern() || !is_tracked(&positive.root) {
                    roots.insert(positive.root.as_str());
                } else {
                    tracked_literals.insert(positive.root.as_str());
                }
            }
        }

        let preparation = timer.elapsed().as_secs_f64();
        let mut inventory = Self::inventory(workspace, roots)?;
        inventory.groups = groups;
        // A direct tracked read may be absent on disk in the frozen up-front snapshot.
        let mut extra: Vec<_> = tracked_literals
            .into_iter()
            .filter(|path| inventory.exact(path).is_none())
            .map(|path| File::new(path.to_owned(), usize::MAX))
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

    pub(crate) fn for_group(&self, id: u32) -> Option<&Self> {
        self.groups.contains(&id).then_some(self)
    }

    /// Keep a single filtered walk cheap. If other groups request the same
    /// traversal, share the pruned listing and apply their individual matchers.
    pub(crate) fn list_pruned_directory(
        &self,
        dir: &str,
        skip: &[String],
        accept: PathPredicate,
        read: impl Fn(PathPredicate) -> Option<Vec<String>>,
    ) -> Option<Vec<String>> {
        // Another group may already have required the full walk from this directory.
        if skip.is_empty() && self.directory_roots.contains(dir) {
            return Some(
                self.entries[self.below(dir)]
                    .iter()
                    .filter(|file| file.visible_from <= dir.len() && accept(&file.path))
                    .map(|file| file.path.clone())
                    .collect(),
            );
        }
        let mut skipped = skip.to_vec();
        skipped.sort_unstable();
        skipped.dedup();
        let listing = match self.pruned_listings.entry((dir.to_owned(), skipped)) {
            Entry::Vacant(slot) => {
                slot.insert(Arc::new(OnceCell::new()));
                return read(accept);
            }
            Entry::Occupied(slot) => Arc::clone(slot.get()),
        };
        let files = listing.get_or_try_init(|| read(&|_| true).ok_or(())).ok()?;
        Some(files.iter().filter(|path| accept(path)).cloned().collect())
    }

    // Exact tracked files still use the workspace snapshot up front. Directory
    // matches must be visible from the requested root, including at ignored boundaries.
    fn positive_matches(&self, glob: &str, tracked: PathPredicate) -> Result<Vec<PositiveMatches>> {
        let mut matches = Vec::new();
        for positive in parse_group(&[glob])?.0 {
            let root = &positive.root;
            let has_pattern = positive.below.is_pattern();
            if let Some(id) = self.exact(root) {
                let file = &self.entries[id];
                if !has_pattern && (tracked(root) || file.visible_from != usize::MAX) {
                    matches.push(PositiveMatches {
                        directory: None,
                        ids: vec![id as u32],
                    });
                    continue;
                }
                if file.visible_from != usize::MAX {
                    continue;
                }
            }
            if !self.directory_roots.contains(root) {
                continue;
            }
            let ids: Vec<_> = self
                .below(root)
                .filter(|&i| {
                    let file = &self.entries[i];
                    file.visible_from <= root.len() && positive.matches(&file.path)
                })
                .map(|i| i as u32)
                .collect();
            if !ids.is_empty() {
                matches.push(PositiveMatches {
                    directory: Some(positive.root),
                    ids,
                });
            }
        }
        Ok(matches)
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

    fn match_ids(
        &self,
        globs: &[impl AsRef<str>],
        roots: &[String],
        tracked: PathPredicate,
    ) -> Result<Vec<u32>> {
        let scope = std::cell::OnceCell::new();
        let mut positives = Vec::new();
        let mut negatives = Vec::new();
        for glob in globs.iter().map(AsRef::as_ref) {
            if glob.starts_with('!') {
                let group = self
                    .negatives
                    .get_or_try_init(glob.to_string(), || self.negative_ids(glob))?;
                if !group.is_empty() {
                    negatives.push(group);
                }
                continue;
            }
            let group = self
                .positives
                .get_or_try_init(glob.to_string(), || self.positive_matches(glob, tracked))?;
            for matched in group.iter() {
                let nested = matched.directory.as_deref().and_then(|dir| {
                    let scope = scope.get_or_init(|| ProjectScope::new(roots));
                    scope.nested_roots(dir).next().map(|_| (dir, scope))
                });
                if let Some((dir, scope)) = nested {
                    positives.extend(matched.ids.iter().copied().filter(|&id| {
                        !scope.crosses_nested_root(dir, &self.entries[id as usize].path)
                    }));
                } else {
                    positives.extend_from_slice(&matched.ids);
                }
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
        Ok(positives)
    }

    fn prefetch_content(
        &self,
        ids: &[u32],
        tracked: PathPredicate,
        read: &(impl Fn(&str) -> Option<String> + Sync),
    ) {
        if ids.len() < MIN_PARALLEL_DISK_OPS || rayon::current_num_threads() == 1 {
            return;
        }
        let pending: Vec<_> = ids
            .iter()
            .map(|&id| &self.entries[id as usize])
            .filter(|file| file.content.get().is_none() && !tracked(&file.path))
            .collect();
        if pending.len() < MIN_PARALLEL_DISK_OPS {
            return;
        }
        pending
            .into_par_iter()
            .with_min_len(MIN_DISK_CHUNK_SIZE)
            .for_each(|file| {
                // If an overlapping group is reading this file, keep working
                // through the remaining files. The ordered fold can wait later.
                if let Some(_reading) = file.reading.try_lock() {
                    file.content.get_or_init(|| read(&file.path));
                }
            });
    }

    pub(crate) fn file_hashes(
        &self,
        globs: &[impl AsRef<str>],
        roots: &[String],
        tracked: PathPredicate,
        read: impl Fn(&str) -> Option<String> + Sync,
    ) -> Result<Vec<(String, String)>> {
        let ids = self.match_ids(globs, roots, tracked)?;
        self.prefetch_content(&ids, tracked, &read);
        Ok(ids
            .into_iter()
            .filter_map(|id| {
                let file = &self.entries[id as usize];
                Some((file.path.clone(), file.hash(&read)?.to_owned()))
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
                .match_ids(globs, roots, tracked)?
                .into_iter()
                .map(|id| self.entries[id as usize].path.clone())
                .collect(),
        })
    }

    pub(crate) fn hash(
        &self,
        globs: &[impl AsRef<str>],
        roots: &[String],
        tracked: PathPredicate,
        read: impl Fn(&str) -> Option<String> + Sync,
        collect_inputs: bool,
    ) -> Result<(String, Vec<String>)> {
        let ids = self.match_ids(globs, roots, tracked)?;
        self.prefetch_content(&ids, tracked, &read);
        let mut hash = xxhash_rust::xxh3::Xxh3::new();
        let mut inputs = Vec::new();
        for id in ids {
            let file = &self.entries[id as usize];
            if collect_inputs {
                inputs.push(file.path.clone());
            }
            if let Some(value) = file.hash(&read) {
                hash.update(file.path.as_bytes());
                hash.update(value.as_bytes());
            }
        }
        Ok((hash.digest().to_string(), inputs))
    }
}

#[cfg(test)]
mod tests {
    use super::super::{Source, expand_globs};
    use super::*;
    use assert_fs::TempDir;

    #[cfg(unix)]
    #[test]
    fn a_raw_backslash_cannot_alias_a_directory_root() -> Result<()> {
        let temp = TempDir::new()?;
        let workspace = temp.path();
        std::fs::create_dir_all(workspace.join("pkg/a/b"))?;
        std::fs::write(workspace.join(r"pkg/a\b"), "raw filename")?;
        std::fs::write(workspace.join("pkg/a/b/x.js"), "selected file")?;
        let inventory =
            SettledFiles::inventory(workspace, ["pkg", "pkg/a/b"].into_iter().collect())?;
        let source = Source::fileset_from_disk(workspace);
        for glob in ["pkg/a/b/*.js", "pkg/a/b", "pkg/**/*"] {
            let expected = vec!["pkg/a/b/x.js"];
            assert_eq!(inventory.paths(&[glob], &[], &|_| false)?.files, expected);
            assert_eq!(expand_globs(&[glob], &[], &source)?.files, expected);
        }
        Ok(())
    }

    #[cfg(unix)]
    #[test]
    fn a_non_utf8_path_has_no_lossy_inventory_key() {
        use std::ffi::OsStr;
        use std::os::unix::ffi::OsStrExt;

        let root = Path::new("workspace");
        let invalid = root.join(OsStr::from_bytes(b"pkg/name-\xff"));
        assert!(disk_relative_path(root, &invalid).is_none());
        let valid = root.join("pkg/name-\u{fffd}");
        assert_eq!(
            disk_relative_path(root, &valid).as_deref(),
            Some("pkg/name-\u{fffd}")
        );
    }

    #[test]
    fn literal_roots_stat_in_parallel_after_ancestor_walks() -> Result<()> {
        use std::sync::atomic::{AtomicUsize, Ordering::Relaxed};
        use std::time::Duration;

        let temp = TempDir::new()?;
        let workspace = temp.path();
        let paths: Vec<_> = (0..128).map(|i| format!("pkg/file-{i:03}")).collect();
        std::fs::create_dir(workspace.join("pkg"))?;
        for path in &paths {
            std::fs::write(workspace.join(path), "sample")?;
        }
        let pool = rayon::ThreadPoolBuilder::new().num_threads(4).build()?;
        for ancestor in [false, true] {
            let mut roots: HashSet<_> = paths.iter().map(String::as_str).collect();
            if ancestor {
                roots.insert("pkg");
            }
            let calls = AtomicUsize::new(0);
            let workers = AtomicUsize::new(0);
            let inventory = pool.install(|| {
                SettledFiles::inventory_with_metadata(workspace, roots, |path| {
                    calls.fetch_add(1, Relaxed);
                    workers.fetch_or(1 << rayon::current_thread_index().unwrap(), Relaxed);
                    std::thread::sleep(Duration::from_millis(1));
                    std::fs::metadata(path).ok()
                })
            })?;
            assert_eq!(inventory.entries.len(), paths.len());
            assert_eq!(calls.load(Relaxed), if ancestor { 1 } else { paths.len() });
            assert_eq!(workers.load(Relaxed).count_ones() > 1, !ancestor);
        }
        Ok(())
    }

    #[test]
    fn large_disk_groups_read_cold_files_in_parallel_and_share_results() -> Result<()> {
        use crate::native::tasks::hashers::fold_file_hashes;
        use crate::native::test_utils::hash_plans;
        use std::sync::atomic::{AtomicUsize, Ordering::Relaxed};
        use std::time::Duration;

        let temp = TempDir::new()?;
        let workspace = temp.path();
        let paths: Vec<_> = (0..128).map(|i| format!("pkg/file-{i:03}.bin")).collect();
        std::fs::create_dir(workspace.join("pkg"))?;
        for path in &paths {
            std::fs::write(workspace.join(path), "sample")?;
        }
        let primary = ["pkg/*.bin", "!pkg/file-127.bin"];
        let overlap = ["pkg/*.bin", "!pkg/file-126.bin", "!pkg/file-127.bin"];
        let instruction = |group: &[&str]| {
            HashInstruction::ignored_files(group.iter().map(|glob| glob.to_string()).collect())
        };
        let names: Vec<_> = (0..MIN_BATCH_GROUPS - 1)
            .map(|i| format!("task-{i}"))
            .collect();
        let mut tasks: Vec<_> = names
            .iter()
            .map(|name| {
                (
                    name.as_str(),
                    vec![HashInstruction::ignored_files(vec![format!("out/{name}")])],
                )
            })
            .collect();
        tasks.push(("primary", vec![instruction(&primary)]));
        tasks.push(("overlap", vec![instruction(&overlap)]));
        let plans = hash_plans(&tasks);
        plans.pool.intern(instruction(&["deferred/**"]));
        std::fs::create_dir(workspace.join("deferred"))?;
        std::fs::write(workspace.join("deferred/output"), "producer output")?;
        let pool = rayon::ThreadPoolBuilder::new().num_threads(4).build()?;
        let expected: Vec<_> = paths[1..127]
            .iter()
            .map(|path| (path.clone(), "content-hash".to_owned()))
            .collect();
        let expected_hash = fold_file_hashes(expected.iter().map(|(path, hash)| (path, hash)));

        for (known, overlap_reads) in [(false, false), (false, true), (true, false)] {
            let tracked = &|_: &str| known;
            let inventory = pool
                .install(|| SettledFiles::for_plans(workspace, &plans, tracked))?
                .unwrap();
            assert!(!inventory.directory_roots.contains("deferred"));
            let primary_inventory = inventory
                .for_group(plans.pool.intern(instruction(&primary)))
                .unwrap();
            let workers = AtomicUsize::new(0);
            let calls = [const { AtomicUsize::new(0) }; 128];
            let read = |path: &str| {
                let idx: usize = path["pkg/file-".len()..]
                    .trim_end_matches(".bin")
                    .parse()
                    .unwrap();
                calls[idx].fetch_add(1, Relaxed);
                workers.fetch_or(1 << rayon::current_thread_index().unwrap(), Relaxed);
                if !known {
                    // Give Rayon work to steal without asserting on elapsed time.
                    std::thread::sleep(Duration::from_millis(1));
                }
                (idx != 0).then(|| "content-hash".to_owned())
            };
            let hash = || primary_inventory.hash(&primary, &[], tracked, read, true);
            let recorded = || inventory.file_hashes(&overlap, &[], tracked, read);
            let (hashed, recorded) = pool.install(|| {
                if overlap_reads {
                    rayon::join(hash, recorded)
                } else {
                    let hashed = hash();
                    (hashed, recorded())
                }
            });
            let (digest, inputs) = hashed?;
            assert_eq!(digest, expected_hash);
            assert_eq!(inputs, paths[..127]);
            assert_eq!(recorded?, expected[..125]);
            assert!(calls[..127].iter().all(|count| count.load(Relaxed) == 1));
            assert_eq!(calls[127].load(Relaxed), 0);
            if !overlap_reads {
                assert_eq!(workers.load(Relaxed).count_ones() > 1, !known);
            }
        }
        Ok(())
    }

    #[test]
    fn positive_cache_scales_with_globs_across_large_scopes() -> Result<()> {
        let temp = TempDir::new()?;
        let workspace = temp.path();
        let projects: Vec<_> = (0..256).map(|i| format!("packages/pkg-{i}")).collect();
        let globs: Vec<_> = projects
            .iter()
            .map(|root| format!("{root}/**/*.js"))
            .collect();
        let mut expected: Vec<_> = projects
            .iter()
            .map(|root| format!("{root}/index.js"))
            .collect();
        expected.sort_unstable();
        for path in &expected {
            let file = workspace.join(path);
            std::fs::create_dir_all(file.parent().unwrap())?;
            std::fs::write(file, "sample")?;
        }
        let inventory = SettledFiles::inventory(workspace, ["packages"].into_iter().collect())?;
        let mut scope = projects;
        for extra_root in ["other/project-a", "other/project-b"] {
            scope.push(extra_root.to_owned());
            assert_eq!(inventory.paths(&globs, &scope, &|_| false)?.files, expected);
            assert_eq!(inventory.positives.len(), globs.len());
            scope.pop();
        }
        Ok(())
    }

    #[test]
    fn cached_brace_matches_apply_each_groups_nested_project_boundaries() -> Result<()> {
        let temp = TempDir::new()?;
        let workspace = temp.path();
        std::fs::create_dir_all(workspace.join("pkg/a/nested"))?;
        std::fs::create_dir_all(workspace.join("pkg/b"))?;
        for file in ["pkg/a/index.js", "pkg/a/nested/index.js", "pkg/b/index.js"] {
            std::fs::write(workspace.join(file), "sample")?;
        }
        let inventory = SettledFiles::inventory(workspace, ["pkg"].into_iter().collect())?;
        let globs = ["pkg/{a,b}/**/*.js"];
        let source = Source::fileset_from_disk(workspace);
        let scopes = [vec![], vec!["pkg/a".into(), "pkg/a/nested".into()]];
        for scope in scopes {
            let expected = expand_globs(&globs, &scope, &source)?.files;
            assert_eq!(inventory.paths(&globs, &scope, &|_| false)?.files, expected);
            assert_eq!(
                expected.contains(&"pkg/a/nested/index.js".to_owned()),
                scope.is_empty()
            );
        }
        assert_eq!(inventory.positives.len(), 1);
        Ok(())
    }

    #[test]
    fn repeated_pruned_walks_share_only_the_listing_for_the_same_skips() -> Result<()> {
        use crate::native::walker::read_directory;
        let temp = TempDir::new()?;
        let root = temp.path();
        std::fs::create_dir_all(root.join("pkg/nested"))?;
        for path in ["pkg/a.js", "pkg/b.ts", "pkg/nested/c.js"] {
            std::fs::write(root.join(path), "")?;
        }
        let walks = std::cell::Cell::new(0);
        let list = |inventory: &SettledFiles, skip: &[String], suffix: &str| {
            let mut paths = inventory
                .list_pruned_directory("pkg", skip, &|p| p.ends_with(suffix), |accept| {
                    walks.set(walks.get() + 1);
                    read_directory(root, "pkg", accept, skip)
                })
                .unwrap();
            paths.sort();
            paths
        };
        let inventory = SettledFiles::inventory(root, HashSet::new())?;
        let skip = ["pkg/nested".to_string()];
        assert_eq!(list(&inventory, &skip, ".js"), ["pkg/a.js"]);
        assert_eq!(list(&inventory, &skip, ".ts"), ["pkg/b.ts"]);
        assert_eq!(list(&inventory, &skip, ".js"), ["pkg/a.js"]);
        assert_eq!(walks.get(), 2);
        assert_eq!(
            list(&inventory, &[], ".js"),
            ["pkg/a.js", "pkg/nested/c.js"]
        );
        assert_eq!(walks.get(), 3);
        std::fs::write(root.join("pkg/new.js"), "")?;
        let next = SettledFiles::inventory(root, HashSet::new())?;
        assert_eq!(list(&next, &skip, ".js"), ["pkg/a.js", "pkg/new.js"]);
        let shared = SettledFiles::inventory(root, ["pkg"].into_iter().collect())?;
        assert_eq!(list(&shared, &[], ".ts"), ["pkg/b.ts"]);
        assert_eq!(walks.get(), 4);
        Ok(())
    }

    #[test]
    fn groups_with_existing_excluded_subtrees_keep_the_pruned_walk() -> Result<()> {
        use crate::native::test_utils::hash_plans;

        let temp = TempDir::new()?;
        let workspace = temp.path();
        for dir in ["pkg/excluded", "apps/nested", "plain"] {
            std::fs::create_dir_all(workspace.join(dir))?;
        }
        std::fs::write(
            workspace.join("pkg/excluded/index.js"),
            "explicitly requested",
        )?;
        std::fs::write(workspace.join("plain/file.js"), "excluded file")?;
        let negative_subtree = HashInstruction::ignored_files(vec![
            "pkg/**/*".into(),
            "!pkg/{excluded,absent}/**".into(),
        ]);
        let nested_project = HashInstruction::IgnoredFileSet {
            globs: Arc::from([Arc::from("apps/**/*")]),
            project_roots: vec!["apps".into(), "apps/nested".into()],
            from_ultracache: false,
        };
        let negative_file =
            HashInstruction::ignored_files(vec!["plain/**".into(), "!plain/file.js".into()]);
        let unrelated =
            HashInstruction::ignored_files(vec!["plain/**".into(), "!pkg/excluded/**".into()]);
        let explicit = HashInstruction::ignored_files(vec!["pkg/excluded/**".into()]);
        let names: Vec<_> = (0..MIN_BATCH_GROUPS).map(|i| format!("task-{i}")).collect();
        let mut plans: Vec<_> = names
            .iter()
            .map(|name| {
                (
                    name.as_str(),
                    vec![HashInstruction::ignored_files(vec![format!(
                        "dist/{name}/**"
                    )])],
                )
            })
            .collect();
        plans.push((
            "sample",
            vec![
                negative_subtree.clone(),
                nested_project.clone(),
                negative_file.clone(),
                unrelated.clone(),
                explicit.clone(),
            ],
        ));
        let plans = hash_plans(&plans);
        let inventory = SettledFiles::for_plans(workspace, &plans, &|_| false)?.unwrap();
        assert!(
            inventory
                .for_group(plans.pool.intern(negative_subtree))
                .is_none()
        );
        assert!(
            inventory
                .for_group(plans.pool.intern(nested_project))
                .is_none()
        );
        assert!(
            inventory
                .for_group(plans.pool.intern(negative_file))
                .is_some()
        );
        assert!(inventory.for_group(plans.pool.intern(unrelated)).is_some());
        assert!(inventory.for_group(plans.pool.intern(explicit)).is_some());
        assert_eq!(inventory.counts.read_dir_calls, 2);
        assert_eq!(
            inventory
                .paths(&["pkg/excluded/**"], &[], &|_| false)?
                .files,
            ["pkg/excluded/index.js"]
        );
        Ok(())
    }

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
    fn malformed_globs_are_reported_in_group_order() -> Result<()> {
        let temp = TempDir::new()?;
        let workspace = temp.path();
        std::fs::create_dir(workspace.join("pkg"))?;
        let source = Source::fileset_from_disk(workspace);
        let inventory = SettledFiles::inventory(workspace, ["pkg"].into_iter().collect())?;
        for globs in [["pkg/[z-a]", "!other/[9-1]"], ["!other/[9-1]", "pkg/[z-a]"]] {
            assert_eq!(
                inventory
                    .paths(&globs, &[], &|_| false)
                    .err()
                    .unwrap()
                    .to_string(),
                expand_globs(&globs, &[], &source)
                    .err()
                    .unwrap()
                    .to_string()
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
                inventory.paths(&[&glob], &scope_roots, &|_| false)?.files,
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
                .paths(&["pkg/src/*.ts"], &scope_roots, &|_| false)?
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
