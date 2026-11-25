//! Match shared tracked globs once per file-map scope, then fold each group's
//! union in path order, like the ordinary file-map expansion.
use super::{MIN_BATCH_GROUPS, OnceCache};
use crate::native::glob::build_glob_set;
use crate::native::tasks::recorded_globs::{GLOBSET_LIMIT, RootRead, root_read};
use crate::native::types::FileData;
use anyhow::Result;
use dashmap::DashMap;
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};

struct Matches {
    ids: Vec<u32>,
    regex_cost: usize,
}

struct Scope<'a> {
    files: &'a [FileData],
    by_path: Vec<u32>,
    canonical_separators: bool,
    patterns: OnceCache<Option<Matches>>,
}

impl<'a> Scope<'a> {
    fn new(files: &'a [FileData]) -> Self {
        let mut by_path: Vec<u32> = (0..files.len() as u32).collect();
        by_path.sort_unstable_by(|&a, &b| files[a as usize].file.cmp(&files[b as usize].file));
        Self {
            files,
            by_path,
            patterns: OnceCache::new(),
            canonical_separators: !cfg!(windows) || files.iter().all(|f| !f.file.contains('\\')),
        }
    }

    fn matches(
        &self,
        text: &str,
        shapes: &DashMap<(usize, String), RootRead>,
    ) -> Result<Option<Matches>> {
        let (root, tail) = match text.split_once("/**/*") {
            Some((root, tail)) if !tail.is_empty() => (root, Some(tail)),
            None => (text, None),
            _ => return Ok(None),
        };
        // Other glob syntax, escapes and non-canonical paths go through Nx's
        // original combined compiler and preserve its diagnostics.
        let plain = |c: u8| c.is_ascii_alphanumeric() || b"._- @".contains(&c);
        if root.len() > 4096
            || !root
                .split('/')
                .all(|s| !s.is_empty() && s != "." && s != ".." && s.bytes().all(plain))
        {
            return Ok(None);
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
                _ => return Ok(None),
            },
        };
        let mut ids = Vec::new();
        let by_path = &self.by_path;
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
        Ok(Some(Matches { ids, regex_cost }))
    }
}

pub(crate) struct TrackedBatch<'a> {
    projects: &'a HashMap<String, Vec<FileData>>,
    workspace: &'a [FileData],
    scopes: DashMap<String, Arc<Scope<'a>>>,
    workspace_scope: OnceLock<Arc<Scope<'a>>>,
    shapes: DashMap<(usize, String), RootRead>,
}

impl<'a> TrackedBatch<'a> {
    fn new(projects: &'a HashMap<String, Vec<FileData>>, workspace: &'a [FileData]) -> Self {
        Self {
            projects,
            workspace,
            scopes: DashMap::new(),
            workspace_scope: OnceLock::new(),
            shapes: DashMap::new(),
        }
    }

    pub(crate) fn for_plans(
        plans: &crate::native::tasks::types::HashPlans,
        projects: &'a HashMap<String, Vec<FileData>>,
        workspace: &'a [FileData],
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
        (Plan::union_ids(&groups).len() >= MIN_BATCH_GROUPS).then(|| Self::new(projects, workspace))
    }

    /// None requests the ordinary matcher, including invalid patterns, mixed
    /// extglobs, negative-only groups and possible combined regex-size errors.
    pub(crate) fn select(
        &self,
        project: Option<&str>,
        globs: &[String],
    ) -> Result<Option<Vec<&'a FileData>>> {
        let scope = if let Some(project) = project {
            let Some(files) = self.projects.get(project) else {
                return Ok(None);
            };
            if let Some(s) = self.scopes.get(project) {
                Arc::clone(s.value())
            } else {
                self.scopes
                    .entry(project.to_owned())
                    .or_insert_with(|| Arc::new(Scope::new(files)))
                    .clone()
            }
        } else {
            self.workspace_scope
                .get_or_init(|| Arc::new(Scope::new(self.workspace)))
                .clone()
        };
        if !scope.canonical_separators {
            return Ok(None);
        }
        let mut positive = Vec::new();
        let mut negative = Vec::new();
        let mut saw_positive = false;
        let mut cost = 0usize;
        for raw in globs {
            let (exclude, pattern) = raw
                .strip_prefix('!')
                .map_or((false, raw.as_str()), |s| (true, s));
            let body = if project.is_none() {
                let Some(s) = pattern.strip_prefix("{workspaceRoot}/") else {
                    return Ok(None);
                };
                s
            } else {
                pattern
            };
            let cached = scope
                .patterns
                .get_or_try_init(body.to_owned(), || scope.matches(body, &self.shapes))?;
            let Some(m) = cached.as_ref() else {
                return Ok(None);
            };
            cost = cost.saturating_add(m.regex_cost);
            if cost >= GLOBSET_LIMIT {
                return Ok(None);
            }
            if exclude {
                negative.extend_from_slice(&m.ids)
            } else {
                saw_positive = true;
                positive.extend_from_slice(&m.ids)
            }
        }
        if !saw_positive {
            return Ok(None);
        }
        positive.sort_unstable();
        positive.dedup();
        negative.sort_unstable();
        negative.dedup();
        let mut excluded = negative.into_iter().peekable();
        Ok(Some(
            positive
                .into_iter()
                .filter_map(|i| {
                    while excluded.next_if(|n| *n < i).is_some() {}
                    excluded
                        .next_if_eq(&i)
                        .is_none()
                        .then(|| &scope.files[scope.by_path[i as usize] as usize])
                })
                .collect(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::hashers::{
        WorkspaceFileIndex, WorkspaceFileIndicesCache, collect_project_files,
        collect_workspace_file_paths_cached,
    };

    #[test]
    fn delegates_groups_that_can_exceed_the_combined_regex_budget() -> Result<()> {
        let root = "p".repeat(240);
        let group: Vec<_> = (0..1600)
            .map(|i| format!("pkg/{root}{i}/**/*.{{abcdef,ghijkl,mnopqr}}"))
            .collect();
        let projects = HashMap::from([("p".to_owned(), Vec::new())]);
        assert!(collect_project_files("p", &group, &projects)?.is_empty());
        assert!(
            TrackedBatch::new(&projects, &[])
                .select(Some("p"), &group)?
                .is_none()
        );
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
        let batch = TrackedBatch::new(&projects, &files);
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
                    &WorkspaceFileIndicesCache::new()
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
