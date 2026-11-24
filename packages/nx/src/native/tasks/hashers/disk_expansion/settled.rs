//! Disk inputs for one batch after all task writes and restores have settled.
//! Walk each requested directory once. A walk stops at the usual ignores and
//! linked directories. An explicit root beyond such a boundary opens its own
//! subtree, visible only to entries rooted there or deeper.

use std::borrow::Cow;
use std::collections::{HashMap, HashSet};
use std::ops::Range;
use std::path::Path;
use std::sync::Arc;

use anyhow::Result;
use rayon::prelude::*;

use super::{Negation, Positive, ProjectScope, parse_group_with_exclusions};
use crate::native::glob::{NxGlobSet, build_glob_set};
use crate::native::tasks::hashers::RehashReadBudget;
use crate::native::tasks::hashers::{fold_file_hashes, output_entries};
use crate::native::tasks::id_set::IdSet;
use crate::native::tasks::rehash_evidence::{EMPTY, EvidenceId, RehashEvidence};
use crate::native::tasks::types::{HashInstruction, HashPlans};
use crate::native::types::FileData;
use crate::native::walker::DiskWalkIgnores;
use crate::native::workspace::rehash::RehashFileMap;

struct PositivePattern {
    entry: Positive,
    matcher: Option<Arc<NxGlobSet>>,
}

struct Patterns {
    positives: Vec<PositivePattern>,
    negatives: Vec<Negation>,
}

impl Patterns {
    fn new((positive, negatives): (Vec<Positive>, Vec<Negation>)) -> Result<Self> {
        let positives = positive
            .into_iter()
            .map(|entry| {
                let matcher = entry
                    .remainder
                    .as_ref()
                    .map(|rest| build_glob_set(&[rest]))
                    .transpose()?;
                Ok(PositivePattern { entry, matcher })
            })
            .collect::<Result<_>>()?;
        Ok(Self {
            positives,
            negatives,
        })
    }
}

struct Group {
    patterns: Vec<Arc<Patterns>>,
    scope: ProjectScope,
    output_filter: Option<Arc<NxGlobSet>>,
}

struct File<'a> {
    path: Cow<'a, str>,
    // Length of the widest requested root whose walk can see this file.
    visible_from: usize,
}

pub(crate) struct SettledFiles<'a> {
    entries: Vec<File<'a>>,
    hashes: Vec<Option<Cow<'a, str>>>,
}

impl<'a> SettledFiles<'a> {
    fn inventory(workspace_root: &Path, roots: HashSet<&str>, tracked: &[&'a str]) -> Result<Self> {
        let ignores = DiskWalkIgnores::new()?;
        let mut roots = Vec::from_iter(roots);
        roots.sort_unstable_by_key(|root| root.len());
        let mut directories = HashSet::new();
        let mut entries = Vec::new();
        let mut record = |path: Cow<'_, str>, visible_from| {
            // The name can borrow the caller's path table even when the file's
            // bytes require a live read. Only a disk observation adds an entry.
            let path = match tracked.binary_search(&path.as_ref()) {
                Ok(i) => Cow::Borrowed(tracked[i]),
                Err(_) => Cow::Owned(path.into_owned()),
            };
            entries.push(File { path, visible_from });
        };
        for root in roots {
            let start = workspace_root.join(root);
            if directories.contains(&start) {
                continue;
            }
            let Ok(metadata) = std::fs::metadata(&start) else {
                continue;
            };
            if metadata.is_file() {
                record(Cow::Borrowed(root), root.len());
                continue;
            }
            if !metadata.is_dir() {
                continue;
            }
            let mut stack = vec![start];
            while let Some(dir) = stack.pop() {
                if !directories.insert(dir.clone()) {
                    continue;
                }
                let Ok(entries) = std::fs::read_dir(&dir) else {
                    continue;
                };
                for entry in entries.flatten() {
                    let path = entry.path();
                    if ignores.skips(&path) {
                        continue;
                    }
                    let Ok(kind) = entry.file_type() else {
                        continue;
                    };
                    if kind.is_dir() {
                        stack.push(path);
                    } else if kind.is_file() || (kind.is_symlink() && path.is_file()) {
                        let mut relative = path.strip_prefix(workspace_root)?.to_string_lossy();
                        if relative.contains('\\') {
                            relative = Cow::Owned(relative.replace('\\', "/"));
                        }
                        record(relative, root.len());
                    }
                }
            }
        }
        // An explicit file root may also have been found below a directory.
        // Keep its widest visibility and assign one ID for all its consumers.
        entries.sort_unstable_by(|a, b| {
            a.path
                .cmp(&b.path)
                .then(a.visible_from.cmp(&b.visible_from))
        });
        entries.dedup_by(|a, b| a.path == b.path);
        Ok(Self {
            hashes: vec![None; entries.len()],
            entries,
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
            .partition_point(|f| f.path.as_ref() < prefix.as_str());
        let end = start + self.entries[start..].partition_point(|f| f.path.starts_with(&prefix));
        start..end
    }

    fn exact(&self, path: &str) -> Option<usize> {
        self.entries
            .binary_search_by(|file| file.path.as_ref().cmp(path))
            .ok()
    }

    fn select(&self, group: &Group) -> Vec<u32> {
        let mut ids = IdSet::default();
        for positive in group.patterns.iter().flat_map(|p| &p.positives) {
            let root = &positive.entry.root;
            if let Some(exact) = self.exact(root) {
                if positive.matcher.is_none() {
                    ids.extend([exact as u32]);
                }
                continue;
            }
            let prefix_len = root.len() + usize::from(!root.is_empty());
            let nested = group.scope.nested_below(&positive.entry);
            ids.extend(
                self.below(root)
                    .filter(|&i| {
                        let file = &self.entries[i];
                        file.visible_from <= root.len()
                            && positive
                                .matcher
                                .as_ref()
                                .is_none_or(|m| m.is_match(&file.path[prefix_len..]))
                            && (nested.is_empty()
                                || group.scope.admits(&positive.entry, &file.path))
                    })
                    .map(|i| i as u32),
            );
        }
        let mut ids = ids.into_sorted_vec();
        if let Some(glob) = &group.output_filter {
            ids.retain(|&id| glob.is_match(self.path(id)));
        }
        if !ids.is_empty() {
            let mut excluded = vec![false; ids.len()];
            for negation in group.patterns.iter().flat_map(|p| &p.negatives) {
                if let Some(exact) = self.exact(&negation.root) {
                    if let Ok(i) = ids.binary_search(&(exact as u32))
                        && negation.excludes(self.path(exact as u32))
                    {
                        excluded[i] = true;
                    }
                    continue;
                }
                let range = self.below(&negation.root);
                let first = ids.partition_point(|&id| (id as usize) < range.start);
                for (i, &id) in ids[first..].iter().enumerate() {
                    if id as usize >= range.end {
                        break;
                    }
                    if !excluded[first + i] && negation.excludes(self.path(id)) {
                        excluded[first + i] = true;
                    }
                }
            }
            let mut flags = excluded.into_iter();
            ids.retain(|_| !flags.next().unwrap());
        }
        ids
    }

    pub(crate) fn path(&self, id: u32) -> &str {
        &self.entries[id as usize].path
    }

    pub(crate) fn was_read(&self, id: u32) -> bool {
        self.hashes[id as usize].is_some()
    }

    pub(crate) fn fold(&self, ids: &[u32]) -> String {
        fold_file_hashes(
            ids.iter()
                .filter_map(|&id| Some((self.path(id), self.hashes[id as usize].as_deref()?))),
        )
    }
}

/// Hash large generated artifacts with a fixed-size buffer per worker.
fn hash_stream(
    path: &Path,
    buffer: &mut [u8],
    budget: &RehashReadBudget,
) -> Result<Option<String>> {
    let mut hash = xxhash_rust::xxh3::Xxh3::new();
    let read = budget.read(path, buffer, |bytes| hash.update(bytes))?;
    Ok(read.then(|| hash.digest().to_string()))
}

/// Sorted file IDs per disk instruction. IDs order like the workspace-relative paths.
pub(crate) struct SettledGroups<'a> {
    pub(crate) files: SettledFiles<'a>,
    pub(crate) groups: Vec<Option<Arc<[u32]>>>,
    pub(crate) evidence: Vec<EvidenceId>,
}

impl<'a> SettledGroups<'a> {
    pub(crate) fn new(
        workspace_root: &Path,
        plans: &HashPlans,
        used: &[bool],
        prehashed: &HashMap<&str, Option<String>>,
        tracked: &[&'a str],
        verified_files: impl Iterator<Item = (usize, &'a FileData)>,
        proof: Option<&RehashFileMap>,
        budget: &RehashReadBudget,
        evidence: &mut RehashEvidence,
    ) -> Result<Self> {
        let mut parsed: HashMap<(Arc<str>, bool), Arc<Patterns>> = HashMap::new();
        let mut groups = Vec::with_capacity(used.len());
        for (id, &used) in used.iter().enumerate() {
            let group = if used {
                match &*plans.pool.get(id as u32) {
                    HashInstruction::IgnoredFileSet {
                        globs,
                        project_roots,
                        exact_extension_exclusions,
                        ..
                    } => {
                        let mut patterns = Vec::with_capacity(globs.len());
                        for glob in globs.iter() {
                            let key = (
                                glob.clone(),
                                glob.starts_with('!') && *exact_extension_exclusions,
                            );
                            let pattern = match parsed.entry(key) {
                                std::collections::hash_map::Entry::Occupied(e) => e.get().clone(),
                                std::collections::hash_map::Entry::Vacant(e) => {
                                    let entries = parse_group_with_exclusions(
                                        std::slice::from_ref(glob),
                                        *exact_extension_exclusions,
                                    )?;
                                    e.insert(Arc::new(Patterns::new(entries)?)).clone()
                                }
                            };
                            patterns.push(pattern);
                        }
                        Some(Group {
                            patterns,
                            scope: ProjectScope::new(project_roots),
                            output_filter: None,
                        })
                    }
                    HashInstruction::TaskOutput(glob, outputs) => Some(Group {
                        patterns: vec![Arc::new(Patterns::new(output_entries(
                            workspace_root,
                            outputs,
                        )?)?)],
                        scope: ProjectScope::default(),
                        output_filter: Some(build_glob_set(&[glob])?),
                    }),
                    _ => None,
                }
            } else {
                None
            };
            groups.push(group);
        }
        drop(parsed);
        let roots = groups
            .iter()
            .flatten()
            .flat_map(|g| &g.patterns)
            .flat_map(|p| &p.positives)
            .map(|p| p.entry.root.as_str())
            .collect();
        let mut files = SettledFiles::inventory(workspace_root, roots, tracked)?;
        // Admit each selection before retaining the next one. An output glob
        // can match the whole workspace. Cap scratch at one such selection,
        // and share identical membership even across different selectors.
        let mut selections = HashSet::<Arc<[u32]>>::new();
        let mut group_evidence = Vec::with_capacity(groups.len());
        let groups = groups
            .into_iter()
            .enumerate()
            .map(|(index, group)| {
                let Some(group) = group else {
                    group_evidence.push(EMPTY);
                    return Ok(None);
                };
                let selected = files.select(&group);
                let output = matches!(
                    &*plans.pool.get(index as u32),
                    HashInstruction::TaskOutput(..)
                );
                let mutable = evidence.from_paths(
                    selected
                        .iter()
                        .map(|&id| files.path(id))
                        .filter(|path| output || tracked.binary_search(path).is_err()),
                )?;
                group_evidence.push(mutable);
                let shared = match selections.get(selected.as_slice()) {
                    Some(existing) => Arc::clone(existing),
                    None => {
                        let shared: Arc<[u32]> = selected.into();
                        selections.insert(shared.clone());
                        shared
                    }
                };
                Ok(Some(shared))
            })
            .collect::<Result<Vec<_>>>()?;
        drop(selections);
        let mut needed = vec![false; files.entries.len()];
        for &id in groups.iter().flatten().flat_map(|group| group.iter()) {
            needed[id as usize] = true;
        }
        // The caller can attest that the file map and the settled checkout
        // have identical bytes for these tracked regular files. Membership
        // still comes from disk, including ignored roots and symlinks.
        for (index, file) in verified_files {
            if let Some(i) = files.exact(&file.file)
                && needed[i]
                && !prehashed.contains_key(file.file.as_str())
                && proof.is_none_or(|p| p.still_matches(index, &workspace_root.join(&file.file)))
            {
                files.hashes[i] = Some(Cow::Borrowed(&file.hash));
                needed[i] = false;
            }
        }
        // A dependency output is mutable even if Git tracks its path.
        for (id, group) in groups.iter().enumerate() {
            if let Some(outputs) = group
                && matches!(&*plans.pool.get(id as u32), HashInstruction::TaskOutput(..))
            {
                for &output in outputs.iter() {
                    needed[output as usize] = true;
                }
            }
        }
        files
            .hashes
            .par_iter_mut()
            .zip(&files.entries)
            .zip(needed)
            .try_for_each_init(
                || vec![0; 32 * 1024],
                |buffer, ((hash, file), needed)| {
                    if needed {
                        *hash = if let Some(hash) = prehashed.get(file.path.as_ref()) {
                            hash.clone()
                        } else {
                            let path = workspace_root.join(file.path.as_ref());
                            hash_stream(&path, buffer, budget)?
                        }
                        .map(Cow::Owned);
                    }
                    Ok::<_, anyhow::Error>(())
                },
            )?;
        Ok(Self {
            files,
            groups,
            evidence: group_evidence,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::hashers::{
        Source, expand_globs_with_exclusions, resolve_task_output_files,
    };
    use crate::native::test_utils::hash_plans;
    use assert_fs::TempDir;
    use assert_fs::prelude::*;

    #[test]
    fn inventory_borrows_existing_tracked_names_and_discovers_untracked_files() {
        let temp = TempDir::new().unwrap();
        temp.child("dir/source").write_str("source").unwrap();
        temp.child("dir/generated").write_str("generated").unwrap();
        let tracked = ["dir/absent", "dir/source"];
        let files = SettledFiles::inventory(
            temp.path(),
            ["dir", "dir/source", "dir/absent"].into_iter().collect(),
            &tracked,
        )
        .unwrap();
        assert_eq!(files.entries.len(), 2);
        assert!(matches!(&files.entries[0].path, Cow::Owned(p) if p == "dir/generated"));
        assert!(matches!(files.entries[1].path, Cow::Borrowed(p) if std::ptr::eq(p, tracked[1])));
        assert_eq!(files.entries[1].visible_from, "dir".len());
    }

    #[test]
    fn streams_output_bytes_across_buffer_boundaries() {
        let temp = TempDir::new().unwrap();
        let path = temp.path().join("output");
        for size in [0, 1, 65535, 65536, 65537, 2_000_001] {
            let bytes: Vec<u8> = (0..size).map(|n| (n % 251) as u8).collect();
            std::fs::write(&path, &bytes).unwrap();
            assert_eq!(
                hash_stream(&path, &mut [0; 1024], &Default::default()).unwrap(),
                Some(crate::native::hasher::hash(&bytes))
            );
        }
    }

    #[test]
    fn overlapping_roots_have_the_same_visibility_as_separate_walks() {
        let temp = TempDir::new().unwrap();
        for path in [
            "pkg/src/a.ts",
            "pkg/src/a.spec.ts",
            "pkg/src/.hidden.ts",
            "pkg/src/[id].js",
            "pkg/node_modules/dep/n.js",
            "pkg-tests/sibling.js",
            "pkg/nested/p.json",
            "pkg/dist/out.d.ts",
        ] {
            temp.child(path).write_str(path).unwrap();
        }
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(temp.path().join("pkg/src"), temp.path().join("pkg/link"))
                .unwrap();
            std::os::unix::fs::symlink(
                temp.path().join("pkg/src/a.ts"),
                temp.path().join("pkg/linked.ts"),
            )
            .unwrap();
        }
        let instructions: Vec<_> = [
            (vec!["pkg/**"], vec![]),
            (
                vec!["pkg/**", "!pkg/src/**/*.ts"],
                vec!["pkg", "pkg/nested"],
            ),
            (vec!["pkg/link", "pkg/node_modules/dep"], vec![]),
            (
                vec!["pkg/link/*.ts", "pkg/nested/p.json", "pkg/missing.js"],
                vec![],
            ),
            (
                vec!["pkg/node_modules/dep/n.js", "pkg/src/a.spec.ts"],
                vec![],
            ),
        ]
        .into_iter()
        .map(|(globs, roots)| HashInstruction::IgnoredFileSet {
            globs: globs.into_iter().map(Arc::from).collect(),
            project_roots: roots.into_iter().map(str::to_owned).collect(),
            exact_extension_exclusions: true,
            from_ultracache: true,
        })
        .chain([HashInstruction::TaskOutput(
            "**/*".into(),
            vec![
                "pkg/src/[id].js".into(),
                "pkg/link".into(),
                "!pkg/link/a.ts".into(),
            ],
        )])
        .collect();
        let plans = hash_plans(&[("task", instructions)]);
        let settled = SettledGroups::new(
            temp.path(),
            &plans,
            &vec![true; plans.pool.len()],
            &HashMap::new(),
            &[],
            std::iter::empty(),
            None,
            &Default::default(),
            &mut RehashEvidence::new(None, 0).unwrap(),
        )
        .unwrap();
        for &id in &plans.plans["task"] {
            let expected = match &*plans.pool.get(id) {
                HashInstruction::IgnoredFileSet {
                    globs,
                    project_roots,
                    exact_extension_exclusions,
                    ..
                } => {
                    expand_globs_with_exclusions(
                        temp.path(),
                        globs,
                        project_roots,
                        &Source::fileset_from_disk(temp.path()),
                        *exact_extension_exclusions,
                    )
                    .unwrap()
                    .files
                }
                HashInstruction::TaskOutput(glob, outputs) => {
                    resolve_task_output_files(temp.path(), glob, outputs).unwrap()
                }
                _ => unreachable!(),
            };
            let actual: Vec<_> = settled.groups[id as usize]
                .as_ref()
                .unwrap()
                .iter()
                .map(|&id| settled.files.path(id))
                .collect();
            assert_eq!(actual, expected, "{}", plans.pool.label(id));
        }
    }

    #[test]
    fn a_verified_source_hash_never_replaces_dependency_output_bytes() {
        let temp = TempDir::new().unwrap();
        for path in ["src", "out", "generated"] {
            temp.child(path).write_str(path).unwrap();
        }
        let plans = hash_plans(&[(
            "task",
            vec![
                HashInstruction::IgnoredFileSet {
                    globs: vec!["src".into(), "out".into(), "generated".into()].into(),
                    project_roots: vec![],
                    exact_extension_exclusions: false,
                    from_ultracache: true,
                },
                HashInstruction::TaskOutput("**/*".into(), vec!["out".into()]),
            ],
        )]);
        let verified = ["src", "out"].map(|path| FileData {
            file: path.to_owned(),
            hash: "from-file-map".to_owned(),
        });
        let settled = SettledGroups::new(
            temp.path(),
            &plans,
            &vec![true; plans.pool.len()],
            &HashMap::new(),
            &[],
            verified.iter().enumerate(),
            None,
            &Default::default(),
            &mut RehashEvidence::new(None, 0).unwrap(),
        )
        .unwrap();
        let hash_of = |path| settled.files.hashes[settled.files.exact(path).unwrap()].as_deref();
        assert_eq!(hash_of("src"), Some("from-file-map"));
        assert_eq!(
            hash_of("out"),
            Some(crate::native::hasher::hash(b"out").as_str())
        );
        assert_eq!(
            hash_of("generated"),
            Some(crate::native::hasher::hash(b"generated").as_str())
        );
    }
}
