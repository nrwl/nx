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
    candidates: OnceLock<Vec<u32>>,
    always_covered: bool,
    package: bool,
}

// globset 0.4.18 uses a 10 MiB regex-automata Thompson NFA budget. Only
// literal paths and the simple rooted extension patterns below take a fast
// path. All other shapes use the same task-wide compiler as stock.
pub(super) const GLOBSET_LIMIT: usize = 10 << 20;
#[derive(Clone, Copy)]
pub(super) enum RootRead {
    Yes,
    No(usize),
    FullMatcher,
}

pub(super) fn root_read(text: &str, shapes: &DashMap<(usize, String), RootRead>) -> RootRead {
    use super::hash_planner::ROOT_TSCONFIG_FILES;
    if text.starts_with('!') {
        return RootRead::No(0);
    }
    if super::ultracache_eligibility::is_literal_path(text) {
        return if ROOT_TSCONFIG_FILES.contains(&text) {
            RootRead::Yes
        } else {
            RootRead::No(0)
        };
    }
    let Some((prefix, ext)) = text.split_once("/**/*.") else {
        return RootRead::FullMatcher;
    };
    if prefix.is_empty()
        || !prefix
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"/._- @".contains(&b))
    {
        return RootRead::FullMatcher;
    }
    let simple = |s: &str| {
        !s.is_empty()
            && s.bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
    };
    let alts = ext.strip_prefix('{').and_then(|e| e.strip_suffix('}'));
    if !simple(ext) && !alts.is_some_and(|e| e.split(',').all(simple)) {
        return RootRead::FullMatcher;
    }
    let key = (prefix.len(), ext.to_owned());
    *shapes.entry(key).or_insert_with(|| {
        // Each literal ASCII prefix byte compiles to one byte transition.
        // Substituting equal-length literal text preserves compilation size.
        let source = format!("{}/**/*.{ext}", "x".repeat(prefix.len()));
        let Ok(glob) = globset::GlobBuilder::new(&source)
            .literal_separator(true)
            .backslash_escape(true)
            .build()
        else {
            return RootRead::FullMatcher;
        };
        // A plain terminal extension uses globset's independent RequiredExtension
        // strategy. Its regex only has to compile individually.
        if alts.is_none() {
            let mut set = globset::GlobSetBuilder::new();
            set.add(glob);
            return if set.build().is_ok() {
                RootRead::No(0)
            } else {
                RootRead::FullMatcher
            };
        }
        use regex_automata::{nfa::thompson::NFA, util::syntax};
        let fits = |budget| {
            NFA::compiler()
                .syntax(syntax::Config::new().utf8(false).dot_matches_new_line(true))
                .configure(NFA::config().utf8(false).nfa_size_limit(Some(budget)))
                .build(glob.regex())
                .is_ok()
        };
        // The multi-pattern Thompson compiler creates each anchored pattern
        // independently and joins their starts with a union and one edge per
        // pattern. Reserve extra space for that edge and its shared state.
        let mut high = 1024;
        while high < GLOBSET_LIMIT && !fits(high) {
            high *= 2;
        }
        if high >= GLOBSET_LIMIT {
            return RootRead::FullMatcher;
        }
        let mut low = high / 2;
        while high - low > 256 {
            let mid = (low + high) / 2;
            if fits(mid) {
                high = mid;
            } else {
                low = mid;
            }
        }
        RootRead::No(high + 64)
    })
}

pub(super) struct RecordedGlobs<'a> {
    root_tsconfig: Vec<RootRead>,
    source_ids: Vec<u32>,
    exclusion_roots: BTreeMap<String, Vec<u32>>,
    entries: Vec<ReadGlob<'a>>,
    project_roots: &'a BTreeSet<String>,
    // A pool instruction depends on its backing store, owner and ordered globs.
    groups: DashMap<(bool, Option<String>, Vec<u32>), u32>,
}

enum ActiveExclusions<'g> {
    Sparse(BTreeMap<&'g str, Vec<u32>>),
    Dense(Vec<u64>),
}

/// Collect roots that are ancestors or descendants, respecting path segments.
fn overlapping_exclusions<K: std::borrow::Borrow<str> + Ord>(
    by_root: &BTreeMap<K, Vec<u32>>,
    root: &str,
    out: &mut Vec<u32>,
) {
    for dir in std::iter::once("")
        .chain(std::iter::once(root))
        .chain(parent_dirs(root))
    {
        if let Some(ids) = by_root.get(dir) {
            out.extend_from_slice(ids);
        }
    }
    descendant_exclusions(by_root, root, out);
}

fn descendant_exclusions<K: std::borrow::Borrow<str> + Ord>(
    by_root: &BTreeMap<K, Vec<u32>>,
    root: &str,
    out: &mut Vec<u32>,
) {
    let prefix = format!("{root}/");
    use std::ops::Bound::{Included, Unbounded};
    for (_, ids) in by_root
        .range::<str, _>((Included(prefix.as_str()), Unbounded))
        .take_while(|(dir, _)| (*dir).borrow().starts_with(&prefix))
    {
        out.extend_from_slice(ids);
    }
}

fn overlapping_roots<K: std::borrow::Borrow<str> + Ord>(
    by_root: &BTreeMap<K, Vec<u32>>,
    roots: &HashSet<&str>,
    out: &mut Vec<u32>,
) {
    let mut checked = HashSet::new();
    for &root in roots {
        if parent_dirs(root).any(|p| roots.contains(p)) {
            continue;
        }
        for dir in std::iter::once("")
            .chain(std::iter::once(root))
            .chain(parent_dirs(root))
        {
            if checked.insert(dir)
                && let Some(ids) = by_root.get(dir)
            {
                out.extend_from_slice(ids);
            }
        }
        descendant_exclusions(by_root, root, out);
    }
}

impl<'a> RecordedGlobs<'a> {
    pub(super) fn new(
        source: &[Arc<str>],
        projects: &'a std::collections::HashMap<String, String>,
        project_roots: &'a BTreeSet<String>,
    ) -> Self {
        use rayon::prelude::*;
        let shapes = DashMap::new();
        let root_tsconfig = source
            .par_iter()
            .map(|text| root_read(text, &shapes))
            .collect();
        let mut alternatives = HashMap::new();
        let mut texts = source.to_vec();
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
        let entries: Vec<_> = texts
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
                    always_covered: ALWAYS_ON_FILES.contains(&body),
                    package: body.starts_with("node_modules/") || body.contains("/node_modules/"),
                    candidates: OnceLock::new(),
                    text,
                    root,
                    tracked_owner,
                    disk_owner,
                    alternatives,
                    scope: OnceLock::new(),
                }
            })
            .collect();
        let mut exclusion_roots = BTreeMap::<String, Vec<u32>>::new();
        for (i, g) in entries
            .iter()
            .enumerate()
            .filter(|(_, g)| g.text.starts_with('!'))
        {
            exclusion_roots
                .entry(g.root.clone())
                .or_default()
                .push(i as u32);
            for &alt in &g.alternatives {
                exclusion_roots
                    .entry(entries[alt as usize].root.clone())
                    .or_default()
                    .push(alt);
            }
        }
        Self {
            root_tsconfig,
            exclusion_roots,
            source_ids: source.iter().map(|g| ids[g.as_ref()]).collect(),
            entries,
            project_roots,
            groups: Default::default(),
        }
    }

    /// A positive union matching either root file keeps it immediately. If
    /// the union might exceed globset's compiler limit, ask the original
    /// matcher, whose build failure conservatively keeps the files too.
    pub(super) fn reads_root_tsconfig(&self, task: &UltracacheTask) -> Option<bool> {
        let mut bytes = 0usize;
        for &id in &task.files {
            match self.root_tsconfig[id as usize] {
                RootRead::Yes => return Some(true),
                RootRead::No(cost) => bytes = bytes.saturating_add(cost),
                RootRead::FullMatcher => bytes = usize::MAX,
            }
        }
        (bytes < GLOBSET_LIMIT).then_some(false)
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
            g.always_covered || (g.package && !overlaps_any(not_installed, &g.root))
        };
        let owner = |id: u32| {
            if disk {
                Some(entry(id).disk_owner.unwrap_or(unowned))
            } else {
                entry(id).tracked_owner
            }
        };
        let mut buckets: HashMap<Option<&str>, Vec<u32>> = HashMap::new();
        let mut exclusions: Vec<u32> = Vec::new();
        for &source in &task.files {
            let id = self.source_ids[source as usize];
            let glob = &entry(id).text;
            let alts = &entry(id).alternatives;
            let negated = glob.starts_with('!');
            if alts.is_empty() {
                if !covered(id) {
                    if negated {
                        exclusions.push(id);
                    } else {
                        buckets.entry(owner(id)).or_default().push(id);
                    }
                }
            } else {
                let whole = alts.iter().all(|&a| !covered(a));
                if whole && (negated || alts.iter().all(|&a| owner(a) == owner(alts[0]))) {
                    if negated {
                        exclusions.push(id);
                    } else {
                        buckets.entry(owner(alts[0])).or_default().push(id);
                    }
                } else {
                    for &a in alts.iter().filter(|&&a| !covered(a)) {
                        if negated {
                            exclusions.push(a);
                        } else {
                            buckets.entry(owner(a)).or_default().push(a);
                        }
                    }
                }
            }
        }
        // Size the per-task index from its own exclusions. A small recording
        // must not clear a dictionary-sized bitset or scan other tasks' globs.
        let words = self.entries.len().div_ceil(64);
        let active = if words <= exclusions.len().saturating_mul(2) {
            let mut bits = vec![0u64; words];
            for &id in &exclusions {
                bits[id as usize / 64] |= 1 << (id % 64);
            }
            ActiveExclusions::Dense(bits)
        } else {
            let mut roots = BTreeMap::<&str, Vec<u32>>::new();
            for &id in &exclusions {
                roots.entry(entry(id).root.as_str()).or_default().push(id);
            }
            ActiveExclusions::Sparse(roots)
        };
        let mut instructions = Vec::with_capacity(buckets.len() + 1);
        for (project, mut group) in buckets {
            group.sort_unstable();
            group.dedup();
            self.add_exclusions(&mut group, &exclusions, &active);
            instructions.push(self.intern_group(pool, group, disk, project));
        }
        instructions.push(pool.intern(HashInstruction::UltracacheConfiguration(
            task.digest.clone(),
        )));
        instructions
    }

    pub(super) fn needs_output_roots(&self, task: &UltracacheTask) -> bool {
        task.files.iter().any(|&i| {
            let g = &self.entries[self.source_ids[i as usize] as usize];
            g.package
                || g.alternatives
                    .iter()
                    .any(|&a| self.entries[a as usize].package)
        })
    }

    fn add_exclusions(&self, group: &mut Vec<u32>, exclusions: &[u32], active: &ActiveExclusions) {
        if exclusions.is_empty() {
            return;
        }
        let mut matches = Vec::new();
        // A large bucket can contain thousands of sibling roots. Their shared
        // ancestor's exclusions must enter the result only once for this bucket.
        if group.len() > 16 {
            let roots: HashSet<_> = group
                .iter()
                .map(|&i| self.entries[i as usize].root.as_str())
                .collect();
            if roots.contains("") {
                matches.extend_from_slice(exclusions);
            } else {
                match active {
                    ActiveExclusions::Sparse(index) => {
                        overlapping_roots(index, &roots, &mut matches)
                    }
                    ActiveExclusions::Dense(bits) => {
                        overlapping_roots(&self.exclusion_roots, &roots, &mut matches);
                        matches.retain(|&i| bits[i as usize / 64] & (1 << (i % 64)) != 0);
                    }
                }
            }
        } else {
            for &id in group.iter() {
                let g = &self.entries[id as usize];
                let root = g.root.as_str();
                if root.is_empty() {
                    matches.clear();
                    matches.extend_from_slice(exclusions);
                    break;
                }
                match active {
                    ActiveExclusions::Sparse(roots) => {
                        overlapping_exclusions(roots, root, &mut matches)
                    }
                    ActiveExclusions::Dense(bits) => {
                        let candidates = g.candidates.get_or_init(|| {
                            let mut ids = Vec::new();
                            overlapping_exclusions(&self.exclusion_roots, root, &mut ids);
                            ids.sort_unstable();
                            ids.dedup();
                            ids
                        });
                        matches.extend(
                            candidates
                                .iter()
                                .copied()
                                .filter(|&i| bits[i as usize / 64] & (1 << (i % 64)) != 0),
                        );
                    }
                }
            }
        }
        matches.sort_unstable();
        matches.dedup();
        group.extend(matches);
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
#[cfg(test)]
mod tests {
    use super::super::hash_planner::ROOT_TSCONFIG_FILES;
    use super::*;
    use crate::native::glob::NxGlobSetBuilder;

    #[test]
    fn root_projection_respects_the_combined_compiler_limit_and_invalid_reads() {
        // Each regex fits on its own. The original set cannot compile them
        // together, so an otherwise disjoint root tsconfig must be retained.
        let long = "p".repeat(240);
        let dictionary: Arc<[Arc<str>]> = (0..1600)
            .map(|i| Arc::from(format!("pkg/{long}{i}/**/*.{{abcdef,ghijkl,mnopqr}}")))
            .collect();
        let roots = BTreeSet::new();
        let projects = std::collections::HashMap::new();
        let index = RecordedGlobs::new(&dictionary, &projects, &roots);
        for n in [1, 2, 8, 150, 500, 900, 1600] {
            let task = UltracacheTask {
                dictionary: dictionary.clone(),
                files: (0..n as u32).collect(),
                digest: String::new(),
                folder_state: false,
            };
            let original = NxGlobSetBuilder::new(&dictionary[..n]).and_then(|b| b.build(None));
            if n == 1600 {
                assert!(original.is_err());
            }
            let expected =
                original.map_or(true, |s| ROOT_TSCONFIG_FILES.iter().any(|p| s.is_match(p)));
            if let Some(projected) = index.reads_root_tsconfig(&task) {
                assert_eq!(projected, expected, "{n}");
            }
        }
        let shapes = DashMap::new();
        assert!(matches!(
            root_read("x/[z-a]", &shapes),
            RootRead::FullMatcher
        ));
        assert!(matches!(root_read("tsconfig.json", &shapes), RootRead::Yes));
    }
}
