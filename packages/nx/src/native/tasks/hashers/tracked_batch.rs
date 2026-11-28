//! Match shared tracked globs once per file-map scope, then fold each group's
//! union in path order, like the ordinary file-map expansion.
use super::{MIN_BATCH_GROUPS, OnceCache};
use crate::native::glob::build_glob_set;
use crate::native::tasks::recorded_globs::{GLOBSET_LIMIT, RootRead, root_read};
use crate::native::types::FileData;
use anyhow::Result;
use dashmap::DashMap;
use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};

/// Only file positions survive a hashing call. They belong to one TaskHasher's
/// immutable file map. Pattern matches can grow with the requests and stay in
/// the batch that needs them.
#[derive(Default)]
pub(crate) struct TrackedFileIndices {
    projects: OnceLock<DashMap<String, Arc<PathOrder>>>,
    workspace: Arc<PathOrder>,
}

#[cfg(test)]
impl TrackedFileIndices {
    pub(crate) fn indexed_scopes(&self) -> (usize, Option<&[u32]>) {
        (
            self.projects.get().map_or(0, DashMap::len),
            self.workspace.get().and_then(Option::as_deref),
        )
    }
}

type PathOrder = OnceLock<Option<Vec<u32>>>;

fn sorted_positions(files: &[FileData]) -> Option<Vec<u32>> {
    if cfg!(windows) && files.iter().any(|f| f.file.contains('\\')) {
        return None;
    }
    let mut by_path: Vec<_> = (0..u32::try_from(files.len()).ok()?).collect();
    by_path.sort_unstable_by(|&a, &b| files[a as usize].file.cmp(&files[b as usize].file));
    // Regular expansion emits each path once and looks its data up in the file map.
    // Delegate ambiguous snapshots to that same lookup.
    if by_path
        .windows(2)
        .any(|pair| files[pair[0] as usize].file == files[pair[1] as usize].file)
    {
        return None;
    }
    Some(by_path)
}

struct Pattern<'a> {
    root: &'a str,
    tail: Option<&'a str>,
    regex_cost: usize,
}

impl<'a> Pattern<'a> {
    fn parse(text: &'a str, shapes: &DashMap<(usize, String), RootRead>) -> Option<Self> {
        let (root, tail) = match text.split_once("/**/*") {
            Some((root, tail)) if !tail.is_empty() => (root, Some(tail)),
            None => (text, None),
            _ => return None,
        };
        // Other glob syntax, escapes and non-canonical paths go through Nx's
        // regular fileset compiler and preserve its diagnostics.
        let plain = |c: u8| c.is_ascii_alphanumeric() || b"._- @".contains(&c);
        if root.len() > 4096
            || !root
                .split('/')
                .all(|s| !s.is_empty() && s != "." && s != ".." && s.bytes().all(plain))
        {
            return None;
        }
        let regex_cost = match tail {
            None => 0, // literal + literal directory prefix, neither needs a regex set
            Some(s)
                if s.len() < 512
                    && s.bytes().all(plain)
                    && s.rsplit_once('.').is_some_and(|(_, ext)| !ext.is_empty()) =>
            {
                0
            }
            Some(_) => match root_read(text, shapes) {
                RootRead::No(cost) => cost,
                _ => return None,
            },
        };
        Some(Self {
            root,
            tail,
            regex_cost,
        })
    }
}

/// Both the first suitability check and subsequent matches must accept the
/// whole group, including its combined regex size.
fn visit_group(
    globs: &[String],
    workspace: bool,
    mut visit: impl FnMut(bool, &str) -> Result<Option<usize>>,
) -> Result<bool> {
    let mut saw_positive = false;
    let mut cost = 0usize;
    for raw in globs {
        let (exclude, text) = raw
            .strip_prefix('!')
            .map_or((false, raw.as_str()), |s| (true, s));
        let body = if workspace {
            let Some(body) = text.strip_prefix("{workspaceRoot}/") else {
                return Ok(false);
            };
            body
        } else {
            text
        };
        let Some(regex_cost) = visit(exclude, body)? else {
            return Ok(false);
        };
        cost = cost.saturating_add(regex_cost);
        if cost >= GLOBSET_LIMIT {
            return Ok(false);
        }
        saw_positive |= !exclude;
    }
    Ok(saw_positive)
}

struct Matches {
    // Positions in path order, so merging groups also produces the hash fold order.
    ids: Vec<u32>,
    regex_cost: usize,
}

struct Scope<'a> {
    files: &'a [FileData],
    order: Arc<PathOrder>,
    patterns: OnceCache<Option<Matches>>,
}

impl<'a> Scope<'a> {
    fn new(files: &'a [FileData], order: Arc<PathOrder>) -> Self {
        Self {
            files,
            order,
            patterns: OnceCache::new(),
        }
    }

    fn matches(&self, pattern: Pattern, by_path: &[u32]) -> Result<Matches> {
        let Pattern {
            root,
            tail,
            regex_cost,
        } = pattern;
        let mut ids = Vec::new();
        let path = |i: u32| self.files[i as usize].file.as_str();
        if tail.is_none() {
            let start = by_path.partition_point(|&i| path(i) < root);
            let end = start + by_path[start..].partition_point(|&i| path(i) == root);
            ids.extend(start as u32..end as u32);
        }
        let prefix = format!("{root}/");
        let start = by_path.partition_point(|&i| path(i) < prefix.as_str());
        let end = start + by_path[start..].partition_point(|&i| path(i).starts_with(&prefix));
        let under = start as u32..end as u32;
        if let Some(tail) = tail {
            let matcher = build_glob_set(&[format!("**/*{tail}")])?;
            ids.extend(
                under.filter(|&rank| {
                    matcher.is_match(&path(by_path[rank as usize])[prefix.len()..])
                }),
            );
        } else {
            ids.extend(under);
        }
        Ok(Matches { ids, regex_cost })
    }
}

pub(crate) struct TrackedBatch<'a> {
    projects: &'a HashMap<String, Vec<FileData>>,
    workspace: &'a [FileData],
    indices: &'a TrackedFileIndices,
    scopes: DashMap<String, Arc<Scope<'a>>>,
    workspace_scope: OnceLock<Arc<Scope<'a>>>,
    shapes: DashMap<(usize, String), RootRead>,
}

impl<'a> TrackedBatch<'a> {
    fn new(
        projects: &'a HashMap<String, Vec<FileData>>,
        workspace: &'a [FileData],
        indices: &'a TrackedFileIndices,
    ) -> Self {
        Self {
            projects,
            workspace,
            indices,
            scopes: DashMap::new(),
            workspace_scope: OnceLock::new(),
            shapes: DashMap::new(),
        }
    }

    pub(crate) fn for_plans(
        plans: &crate::native::tasks::types::HashPlans,
        projects: &'a HashMap<String, Vec<FileData>>,
        workspace: &'a [FileData],
        indices: &'a TrackedFileIndices,
    ) -> Option<Self> {
        use crate::native::tasks::plan::{Plan, kind};
        if plans.pool.len() < MIN_BATCH_GROUPS {
            return None;
        }
        let groups: Vec<_> = plans
            .plans
            .values()
            .filter(|p| p.has(kind::TRACKED))
            .map(|p| p.only(kind::TRACKED))
            .collect();
        (Plan::union_ids(&groups).len() >= MIN_BATCH_GROUPS)
            .then(|| Self::new(projects, workspace, indices))
    }

    fn scope(&self, project: Option<&str>, globs: &[String]) -> Result<Option<Arc<Scope<'a>>>> {
        let cached = match project {
            Some(p) => self.scopes.get(p).map(|scope| Arc::clone(&scope)),
            None => self.workspace_scope.get().cloned(),
        };
        if cached.is_some() {
            return Ok(cached);
        }
        // A new scope only pays to sort its file map if the whole group can
        // use it. Existing scopes already memoize each pattern and its cost.
        if !visit_group(globs, project.is_none(), |_, text| {
            Ok(Pattern::parse(text, &self.shapes).map(|p| p.regex_cost))
        })? {
            return Ok(None);
        }
        let scope = if let Some(project) = project {
            let Some(files) = self.projects.get(project) else {
                return Ok(None);
            };
            self.scopes
                .entry(project.to_owned())
                .or_insert_with(|| {
                    let order = self
                        .indices
                        .projects
                        .get_or_init(DashMap::new)
                        .entry(project.to_owned())
                        .or_default()
                        .clone();
                    Arc::new(Scope::new(files, order))
                })
                .clone()
        } else {
            self.workspace_scope
                .get_or_init(|| {
                    Arc::new(Scope::new(self.workspace, self.indices.workspace.clone()))
                })
                .clone()
        };
        Ok(Some(scope))
    }

    /// None requests the ordinary matcher, including invalid patterns, mixed
    /// extglobs, negative-only groups and possible combined regex-size errors.
    pub(crate) fn select(
        &self,
        project: Option<&str>,
        globs: &[String],
    ) -> Result<Option<Vec<&'a FileData>>> {
        Ok(self
            .select_indices(project, globs)?
            .map(|(files, ids)| ids.into_iter().map(|i| &files[i as usize]).collect()))
    }

    /// `select` as indices into the scope's file map, in path order.
    pub(crate) fn select_indices(
        &self,
        project: Option<&str>,
        globs: &[String],
    ) -> Result<Option<(&'a [FileData], Vec<u32>)>> {
        let Some(scope) = self.scope(project, globs)? else {
            return Ok(None);
        };
        let Some(by_path) = scope.order.get_or_init(|| sorted_positions(scope.files)) else {
            return Ok(None);
        };
        let mut positive = Vec::new();
        let mut negative_matches = Vec::new();
        if !visit_group(globs, project.is_none(), |exclude, body| {
            let cached = scope.patterns.get_or_try_init(body.to_owned(), || {
                Pattern::parse(body, &self.shapes)
                    .map(|p| scope.matches(p, by_path))
                    .transpose()
            })?;
            let Some(m) = cached.as_ref() else {
                return Ok(None);
            };
            let cost = m.regex_cost;
            if exclude {
                if !m.ids.is_empty() {
                    negative_matches.push(cached);
                }
            } else {
                positive.extend_from_slice(&m.ids)
            }
            Ok(Some(cost))
        })? {
            return Ok(None);
        }
        positive.sort_unstable();
        positive.dedup();
        let negative = filter_sparse_exclusions(
            &mut positive,
            negative_matches
                .iter()
                .flat_map(|cached| cached.iter())
                .map(|m| m.ids.as_slice()),
        );
        let mut excluded = negative.iter().copied().peekable();
        Ok(Some((
            scope.files,
            positive
                .into_iter()
                .filter_map(|i| {
                    while excluded.next_if(|n| *n < i).is_some() {}
                    excluded
                        .next_if_eq(&i)
                        .is_none()
                        .then(|| by_path[i as usize])
                })
                .collect(),
        )))
    }
}

/// Probe large shared exclusions when few positive IDs need checking. Keep
/// denser exclusions for a single linear scan through the remaining positives.
fn filter_sparse_exclusions<'a>(
    positive: &mut Vec<u32>,
    negatives: impl Iterator<Item = &'a [u32]>,
) -> Cow<'a, [u32]> {
    let mut scan = Cow::Borrowed(&[][..]);
    for ids in negatives {
        let probe_cost = positive
            .len()
            .saturating_mul(ids.len().ilog2() as usize + 1);
        if probe_cost < ids.len() {
            positive.retain(|id| ids.binary_search(id).is_err());
        } else if scan.is_empty() {
            scan = Cow::Borrowed(ids);
        } else {
            scan.to_mut().extend_from_slice(ids);
        }
    }
    if let Cow::Owned(ids) = &mut scan {
        ids.sort_unstable();
        ids.dedup();
    }
    scan
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::hashers::{
        WorkspaceFileIndex, WorkspaceFileIndicesCache, collect_project_files,
        collect_workspace_file_paths_cached,
    };

    #[test]
    fn unsupported_groups_leave_both_file_indices_unbuilt() -> Result<()> {
        let files = vec![FileData {
            file: "pkg/a.ts".into(),
            hash: "a".into(),
        }];
        let projects = HashMap::from([("p".into(), files.clone())]);
        let indices = TrackedFileIndices::default();
        let batch = TrackedBatch::new(&projects, &files, &indices);
        for group in [
            vec!["pkg/**/*"],
            vec!["pkg/a.ts", "!pkg/**/*"],
            vec!["pkg/a.ts", "pkg/**/*.[", "pkg"],
            vec!["!pkg/a.ts"],
        ] {
            let globs: Vec<_> = group.iter().map(|&g| g.to_owned()).collect();
            assert!(batch.select(Some("p"), &globs)?.is_none(), "{group:?}");
            let globs: Vec<_> = group
                .iter()
                .map(|g| match g.strip_prefix('!') {
                    Some(g) => format!("!{{workspaceRoot}}/{g}"),
                    None => format!("{{workspaceRoot}}/{g}"),
                })
                .collect();
            assert!(batch.select(None, &globs)?.is_none(), "{group:?}");
        }
        assert!(
            batch
                .select(
                    None,
                    &["{workspaceRoot}/pkg".into(), "missing-token".into()]
                )?
                .is_none()
        );
        assert_eq!(indices.indexed_scopes(), (0, None));
        Ok(())
    }

    #[test]
    fn probes_broad_exclusions_for_sparse_positives_and_borrows_for_dense_positives() {
        let broad_exclusion: Vec<_> = (0..4096).collect();
        let mut sparse = vec![0, 2048, 4096];
        let scan = filter_sparse_exclusions(&mut sparse, [broad_exclusion.as_slice()].into_iter());
        assert!(scan.is_empty());
        assert_eq!(sparse, [4096]);

        let mut dense: Vec<_> = (0..8192).collect();
        let scan = filter_sparse_exclusions(&mut dense, [broad_exclusion.as_slice()].into_iter());
        assert!(std::ptr::eq(scan.as_ref(), broad_exclusion.as_slice()));
        assert_eq!(dense.len(), 8192);
    }

    #[test]
    fn matches_many_sparse_groups_with_shared_broad_exclusions() -> Result<()> {
        const GROUPS: u32 = 64;
        const EXCLUDED_FILES: u32 = 4096;
        let files = (0..EXCLUDED_FILES)
            .rev()
            .flat_map(|i| {
                [
                    (i < GROUPS).then(|| format!("pkg/kept/{i}/z.ts")),
                    Some(format!("pkg/generated/{i}/a.ts")),
                    (i < GROUPS).then(|| format!("pkg/kept/{i}/a.ts")),
                ]
                .into_iter()
                .flatten()
            })
            .map(|file| FileData {
                hash: file.clone(),
                file,
            })
            .collect();
        let projects = HashMap::from([("project".to_owned(), files)]);
        let indices = TrackedFileIndices::default();
        let batch = TrackedBatch::new(&projects, &[], &indices);
        for i in 0..GROUPS {
            let group = [
                "!pkg/generated".into(),
                format!("pkg/kept/{i}"),
                format!("pkg/generated/{i}"),
                "!pkg/generated/**/*.ts".into(),
                format!("pkg/kept/{i}/a.ts"),
            ];
            let selected = batch
                .select(Some("project"), &group)?
                .expect("indexed project group");
            assert_eq!(
                selected,
                collect_project_files("project", &group, &projects)?
            );
            let paths: Vec<_> = selected
                .into_iter()
                .map(|file| file.file.as_str())
                .collect();
            assert_eq!(
                paths,
                [format!("pkg/kept/{i}/a.ts"), format!("pkg/kept/{i}/z.ts")]
            );
        }
        let dense = ["pkg", "!pkg/generated", "!pkg/generated/**/*.ts"].map(str::to_owned);
        let selected = batch
            .select(Some("project"), &dense)?
            .expect("indexed dense project group");
        assert_eq!(selected.len(), 2 * GROUPS as usize);
        assert_eq!(
            selected,
            collect_project_files("project", &dense, &projects)?
        );
        Ok(())
    }

    #[test]
    fn delegates_groups_that_can_exceed_the_combined_regex_budget() -> Result<()> {
        let root = "p".repeat(240);
        let group: Vec<_> = (0..1600)
            .map(|i| format!("pkg/{root}{i}/**/*.{{abcdef,ghijkl,mnopqr}}"))
            .collect();
        let projects = HashMap::from([("p".to_owned(), Vec::new())]);
        let indices = TrackedFileIndices::default();
        assert!(collect_project_files("p", &group, &projects)?.is_empty());
        assert!(
            TrackedBatch::new(&projects, &[], &indices)
                .select(Some("p"), &group)?
                .is_none()
        );
        assert_eq!(indices.indexed_scopes(), (0, None));
        Ok(())
    }

    #[test]
    fn matches_project_and_workspace_files_in_path_order() -> Result<()> {
        let files: Vec<_> = [
            "p/nested/z.ts",
            "p-sibling/a.ts",
            "p/a.d.ts",
            "p/.dot.ts",
            "p/a.css",
            "p/no-extension",
            "p/nested/a.ts",
            "other/a.ts",
            "p/a.ts",
        ]
        .into_iter()
        .map(|path| FileData {
            file: path.into(),
            hash: path.into(),
        })
        .collect();
        let projects = HashMap::from([(
            "project".into(),
            files
                .iter()
                .filter(|f| f.file.starts_with("p/"))
                .cloned()
                .collect(),
        )]);
        let indices = TrackedFileIndices::default();
        let batch = TrackedBatch::new(&projects, &files, &indices);
        let workspace_index = WorkspaceFileIndex::new(Arc::new(files.clone()));
        for group in [
            vec!["p"],
            vec!["p/**/*.{ts,css}", "!p/**/*.d.ts", "!p/nested"],
            vec!["p/**/*.ts", "p/a.d.ts", "!p/nested/z.ts", "p-sibling/a.ts"],
            vec!["p/**/*a.ts", "other", "!p/.dot.ts"],
            vec!["p/no-extension", "p/nested", "p/a.ts", "missing"],
        ] {
            let globs: Vec<_> = group.iter().map(|g| g.to_string()).collect();
            let selected = batch
                .select(Some("project"), &globs)?
                .expect("indexed project group");
            let paths =
                |v: Vec<&FileData>| v.into_iter().map(|f| f.file.clone()).collect::<Vec<_>>();
            assert_eq!(
                paths(selected),
                paths(collect_project_files("project", &globs, &projects)?),
                "{group:?}"
            );
            let workspace: Vec<_> = group
                .iter()
                .map(|g| match g.strip_prefix('!') {
                    Some(g) => format!("!{{workspaceRoot}}/{g}"),
                    None => format!("{{workspaceRoot}}/{g}"),
                })
                .collect();
            assert_eq!(
                paths(
                    batch
                        .select(None, &workspace)?
                        .expect("indexed workspace group")
                ),
                collect_workspace_file_paths_cached(
                    &workspace,
                    &workspace_index,
                    &WorkspaceFileIndicesCache::new(),
                    None,
                )?,
                "{group:?}"
            );
        }
        for group in [
            ["!p/**/*.ts"],
            ["**/*.ts"],
            ["p/**/*.["],
            [r"p/\!literal"],
            ["p/../other"],
        ] {
            assert!(
                batch
                    .select(Some("project"), &group.map(str::to_owned))?
                    .is_none(),
                "{group:?}"
            );
        }
        Ok(())
    }
}
