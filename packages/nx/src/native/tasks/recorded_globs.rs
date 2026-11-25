//! Recorded glob roots, project ownership and exclusions shared by one planning batch.
use super::hash_planner::{ALWAYS_ON_FILES, overlaps_any, walk_root};
use super::hashers::{parse_group, scope_roots};
use super::types::{HashInstruction, InstructionPool};
use super::ultracache_eligibility::UltracacheTask;
use crate::native::glob::{expand_literal_braces, normalize_glob};
use crate::native::utils::path::parent_dirs;
use dashmap::{DashMap, mapref::entry::Entry};
use hashbrown::{HashMap, HashSet};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, OnceLock};

struct ReadGlob<'a> {
    text: Arc<str>,
    root: String,
    tracked_owner: Option<&'a str>,
    disk_owner: Option<&'a str>,
    alternatives: Vec<u32>,
    scope: OnceLock<Option<Vec<String>>>,
}

pub(super) struct RecordedGlobs<'a> {
    ids: HashMap<Arc<str>, u32>,
    entries: Vec<ReadGlob<'a>>,
    project_roots: &'a BTreeSet<String>,
    // A pool instruction depends on its backing store, owner and ordered globs.
    groups: DashMap<(bool, Option<String>, Vec<u32>), u32>,
}

impl<'a> RecordedGlobs<'a> {
    pub(super) fn new<'t>(
        tasks: impl Iterator<Item = &'t UltracacheTask>,
        projects: &'a std::collections::HashMap<String, String>,
        project_roots: &'a BTreeSet<String>,
    ) -> Self {
        let mut unique = HashSet::new();
        for task in tasks {
            for glob in task.files.iter() {
                if !unique.contains(glob) {
                    unique.insert(glob.clone());
                }
            }
        }
        let mut alternatives = HashMap::new();
        let mut texts: Vec<_> = unique.into_iter().collect();
        for glob in &texts {
            if glob.contains('{') {
                let expanded = expand_literal_braces(glob);
                alternatives.insert(glob.clone(), expanded);
            }
        }
        texts.extend(
            alternatives
                .values()
                .flatten()
                .map(|s| Arc::from(s.as_str())),
        );
        // Id order is glob-text order. Sort and key groups on integers, including
        // split brace alternatives, without changing their diagnostic labels.
        texts.sort_unstable();
        texts.dedup();
        let ids: HashMap<_, _> = texts
            .iter()
            .enumerate()
            .map(|(i, t)| (t.clone(), i as u32))
            .collect();
        let entries = texts
            .into_iter()
            .map(|text| {
                let body = text.strip_prefix('!').unwrap_or(&text);
                let root = walk_root(body);
                let tracked_owner = std::iter::once(root.as_str())
                    .chain(parent_dirs(&root))
                    .find_map(|dir| projects.get(dir))
                    .map(String::as_str);
                let disk_owner = parent_dirs(body)
                    .find_map(|dir| projects.get(dir))
                    .map(String::as_str);
                let alternatives = alternatives
                    .remove(&text)
                    .unwrap_or_default()
                    .iter()
                    .map(|s| ids[s.as_str()])
                    .collect();
                ReadGlob {
                    text,
                    root,
                    tracked_owner,
                    disk_owner,
                    alternatives,
                    scope: OnceLock::new(),
                }
            })
            .collect();
        Self {
            ids,
            entries,
            project_roots,
            groups: Default::default(),
        }
    }

    pub(super) fn instructions(
        &self,
        pool: &InstructionPool,
        task: &UltracacheTask,
        unowned: &str,
        not_installed: &[String],
        disk: bool,
    ) -> Vec<u32> {
        let entry = |id: u32| &self.entries[id as usize];
        let covered = |id: u32| {
            let g = entry(id);
            let path = g.text.strip_prefix('!').unwrap_or(&g.text);
            ALWAYS_ON_FILES.contains(&path)
                || ((path.starts_with("node_modules/") || path.contains("/node_modules/"))
                    && !overlaps_any(not_installed, &g.root))
        };
        let owner = |id: u32| {
            if disk {
                Some(entry(id).disk_owner.unwrap_or(unowned))
            } else {
                entry(id).tracked_owner
            }
        };
        let mut buckets: HashMap<Option<&str>, Vec<u32>> = HashMap::new();
        let mut exclusions: BTreeMap<&str, Vec<u32>> = BTreeMap::new();
        for glob in task.files.iter() {
            let id = self.ids[glob];
            let alts = &entry(id).alternatives;
            let negated = glob.starts_with('!');
            if alts.is_empty() {
                if !covered(id) {
                    if negated {
                        exclusions.entry(&entry(id).root).or_default().push(id);
                    } else {
                        buckets.entry(owner(id)).or_default().push(id);
                    }
                }
            } else {
                let whole = alts.iter().all(|&a| !covered(a));
                if whole && (negated || alts.iter().all(|&a| owner(a) == owner(alts[0]))) {
                    if negated {
                        exclusions.entry(&entry(id).root).or_default().push(id);
                    } else {
                        buckets.entry(owner(alts[0])).or_default().push(id);
                    }
                } else {
                    for &a in alts.iter().filter(|&&a| !covered(a)) {
                        if negated {
                            exclusions.entry(&entry(a).root).or_default().push(a);
                        } else {
                            buckets.entry(owner(a)).or_default().push(a);
                        }
                    }
                }
            }
        }
        let mut instructions = Vec::with_capacity(buckets.len() + 1);
        for (project, mut group) in buckets {
            group.sort_unstable();
            group.dedup();
            self.add_exclusions(&mut group, &exclusions);
            instructions.push(self.intern_group(pool, group, disk, project));
        }
        instructions.push(pool.intern(HashInstruction::UltracacheConfiguration(
            task.digest.clone(),
        )));
        instructions
    }

    fn add_exclusions(&self, group: &mut Vec<u32>, exclusions: &BTreeMap<&str, Vec<u32>>) {
        let entry = |id: u32| &self.entries[id as usize];
        if !exclusions.is_empty() {
            let roots: HashSet<_> = group.iter().map(|&id| entry(id).root.as_str()).collect();
            let mut matches = Vec::new();
            if roots.contains("") {
                matches.extend(exclusions.values().flatten().copied());
            } else {
                let mut checked = HashSet::new();
                for &root in &roots {
                    // A wider positive already queries this entire interval. The
                    // remaining descendant ranges are disjoint. Test their shared
                    // ancestors once per group, even for thousands of sibling files.
                    if parent_dirs(root).any(|dir| roots.contains(dir)) {
                        continue;
                    }
                    for dir in std::iter::once("")
                        .chain(std::iter::once(root))
                        .chain(parent_dirs(root))
                    {
                        if checked.insert(dir)
                            && let Some(ids) = exclusions.get(dir)
                        {
                            matches.extend_from_slice(ids);
                        }
                    }
                    let prefix = format!("{root}/");
                    matches.extend(
                        exclusions
                            .range(prefix.as_str()..)
                            .take_while(|(dir, _)| dir.starts_with(&prefix))
                            .flat_map(|(_, ids)| ids)
                            .copied(),
                    );
                }
            }
            matches.sort_unstable();
            matches.dedup();
            group.extend(matches);
        }
    }

    fn intern_group(
        &self,
        pool: &InstructionPool,
        group: Vec<u32>,
        disk: bool,
        project: Option<&str>,
    ) -> u32 {
        let key = (disk, project.filter(|_| !disk).map(str::to_string), group);
        match self.groups.entry(key) {
            Entry::Occupied(hit) => *hit.get(),
            Entry::Vacant(slot) => {
                let ids = &slot.key().2;
                let globs = || ids.iter().map(|&i| &self.entries[i as usize]);
                let instruction = if disk {
                    let mut roots = BTreeSet::new();
                    for glob in globs() {
                        // parse_group returning an error makes the complete group
                        // unscoped. Expansion will still report the original error.
                        let scope = glob.scope.get_or_init(|| {
                            parse_group(std::slice::from_ref(&glob.text))
                                .ok()
                                .map(|(positives, _)| scope_roots(&positives, self.project_roots))
                        });
                        let Some(scope) = scope else {
                            roots.clear();
                            break;
                        };
                        roots.extend(scope.iter().cloned());
                    }
                    HashInstruction::IgnoredFileSet {
                        globs: globs().map(|g| g.text.clone()).collect(),
                        project_roots: roots.into_iter().collect(),
                        from_ultracache: true,
                    }
                } else {
                    let normalized = globs().map(|g| normalize_glob(&g.text));
                    match project {
                        Some(p) => HashInstruction::ProjectFileSet(p.into(), normalized.collect()),
                        None => HashInstruction::WorkspaceFileSet(
                            normalized
                                .map(|g| match g.strip_prefix('!') {
                                    Some(rest) => format!("!{{workspaceRoot}}/{rest}"),
                                    None => format!("{{workspaceRoot}}/{g}"),
                                })
                                .collect(),
                        ),
                    }
                };
                let id = pool.intern(instruction);
                slot.insert(id);
                id
            }
        }
    }
}
