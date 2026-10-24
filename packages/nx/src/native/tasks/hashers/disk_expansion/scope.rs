//! Which project's files a positive entry may match. An entry belongs to the
//! deepest project whose root holds the directory it is read from, and it
//! matches only that project's files, like a `{projectRoot}` fileset: it does
//! not reach into a project nested below. An entry that no project holds, or
//! only the workspace-root project, matches everything it names.

use std::collections::BTreeSet;
use std::sync::Arc;

use anyhow::Result;

use super::entries::Positive;
use super::expansion::parse_group;
use crate::native::glob::{NxGlobSet, build_glob_set};
use crate::native::utils::path::parent_dirs;

/// The project roots a group needs to decide ownership: each scoped entry's
/// owner and every root nested below where it is read from.
#[derive(Default)]
pub(crate) struct ProjectScope {
    roots: BTreeSet<String>,
}

impl ProjectScope {
    pub(crate) fn new(roots: &[String]) -> Self {
        Self {
            roots: roots.iter().cloned().collect(),
        }
    }

    /// The deepest root that is `directory` or holds it.
    fn owner_of_directory(&self, directory: &str) -> Option<&str> {
        std::iter::once(directory)
            .chain(parent_dirs(directory))
            .find_map(|dir| self.roots.get(dir).map(String::as_str))
    }

    /// The deepest root holding the file at `path`.
    fn owner_of_file(&self, path: &str) -> Option<&str> {
        parent_dirs(path).find_map(|dir| self.roots.get(dir).map(String::as_str))
    }

    /// The roots below where `entry` reads from: projects it cannot match,
    /// so a walk need not enter them. Empty when `entry` is unscoped.
    pub(crate) fn nested_below(&self, entry: &Positive) -> Vec<String> {
        if self.roots.is_empty() || self.owner_of_directory(&entry.root).is_none() {
            return vec![];
        }
        roots_below(&self.roots, &entry.root)
            .map(str::to_string)
            .collect()
    }

    /// Whether `entry` may match `path`.
    pub(crate) fn admits(&self, entry: &Positive, path: &str) -> bool {
        if self.roots.is_empty() {
            return true;
        }
        match self.owner_of_directory(&entry.root) {
            None => true,
            owner => self.owner_of_file(path) == owner,
        }
    }
}

/// The roots `ProjectScope` needs for `positives`, from every project root in
/// the workspace except the workspace root's own (`.`), sorted.
pub(crate) fn scope_roots(positives: &[Positive], project_roots: &BTreeSet<String>) -> Vec<String> {
    let all = ProjectScope {
        roots: project_roots.clone(),
    };
    let mut needed: BTreeSet<&str> = BTreeSet::new();
    for entry in positives {
        let Some(owner) = all.owner_of_directory(&entry.root) else {
            continue;
        };
        needed.insert(owner);
        needed.extend(roots_below(project_roots, &entry.root));
    }
    needed.into_iter().map(str::to_string).collect()
}

/// The roots strictly below `dir`, in order.
fn roots_below<'a>(roots: &'a BTreeSet<String>, dir: &str) -> impl Iterator<Item = &'a str> {
    let below = format!("{dir}/");
    roots
        .range(below.clone()..)
        .take_while(move |root| root.starts_with(&below))
        .map(String::as_str)
}

/// For a caller holding paths rather than walking: whether a path one of
/// `globs`' positives matches is also admitted by it. `None` when nothing is
/// scoped, so every match stands.
pub(crate) struct ScopedMatcher {
    entries: Vec<(Positive, Option<Arc<NxGlobSet>>)>,
    scope: ProjectScope,
}

impl ScopedMatcher {
    pub(crate) fn new(globs: &[String], project_roots: &[String]) -> Result<Option<Self>> {
        if project_roots.is_empty() {
            return Ok(None);
        }
        let entries = parse_group(globs)?
            .0
            .into_iter()
            .map(|entry| {
                let set = entry
                    .remainder
                    .as_deref()
                    .map(|rest| build_glob_set(&[rest]))
                    .transpose()?;
                Ok((entry, set))
            })
            .collect::<Result<_>>()?;
        Ok(Some(Self {
            entries,
            scope: ProjectScope::new(project_roots),
        }))
    }

    pub(crate) fn admits(&self, path: &str) -> bool {
        self.entries.iter().any(|(entry, set)| {
            let rest = match entry.root.as_str() {
                "" => Some(path),
                root => path.strip_prefix(root).and_then(|rest| match rest {
                    "" => Some(rest),
                    _ => rest.strip_prefix('/'),
                }),
            };
            let matched = match (rest, set) {
                (None, _) => false,
                (Some(_), None) => true,
                (Some(rest), Some(set)) => set.is_match(rest),
            };
            matched && self.scope.admits(entry, path)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn roots(paths: &[&str]) -> BTreeSet<String> {
        paths.iter().map(|p| p.to_string()).collect()
    }

    fn positive(glob: &str) -> Positive {
        Positive::parse(glob).unwrap()
    }

    #[test]
    fn an_entry_keeps_the_owners_files_and_skips_nested_projects() {
        let all = roots(&[
            "packages/gradle",
            "packages/gradle/batch-runner",
            "packages/nx",
        ]);
        let entry = positive("packages/gradle/**/*");
        let needed = scope_roots(std::slice::from_ref(&entry), &all);
        assert_eq!(
            needed,
            vec!["packages/gradle", "packages/gradle/batch-runner"]
        );

        let scope = ProjectScope::new(&needed);
        assert!(scope.admits(&entry, "packages/gradle/src/index.ts"));
        assert!(scope.admits(&entry, "packages/gradle/build/out.json"));
        assert!(!scope.admits(&entry, "packages/gradle/batch-runner/build.gradle.kts"));
        assert!(!scope.admits(&entry, "packages/gradle/batch-runner/build/out.jar"));
    }

    #[test]
    fn a_walk_need_not_enter_the_projects_below_a_scoped_entry() {
        let all = roots(&[
            "packages/gradle",
            "packages/gradle/batch-runner",
            "packages/gradle/batch-runner/inner",
            "packages/gradle-two",
        ]);
        let below = |glob: &str| {
            let entry = positive(glob);
            let scope = ProjectScope::new(&scope_roots(std::slice::from_ref(&entry), &all));
            scope.nested_below(&entry)
        };
        assert_eq!(
            below("packages/gradle/**/*"),
            vec![
                "packages/gradle/batch-runner",
                "packages/gradle/batch-runner/inner"
            ]
        );
        assert_eq!(
            below("packages/gradle/batch-runner/**"),
            vec!["packages/gradle/batch-runner/inner"]
        );
        // Unscoped entries read every project, so nothing is skipped.
        assert!(below("packages/**/*.json").is_empty());
    }

    #[test]
    fn an_entry_read_from_inside_a_nested_project_belongs_to_it() {
        let all = roots(&["packages/gradle", "packages/gradle/batch-runner"]);
        let entry = positive("packages/gradle/batch-runner/build/**");
        let needed = scope_roots(std::slice::from_ref(&entry), &all);
        assert_eq!(needed, vec!["packages/gradle/batch-runner"]);
        assert!(
            ProjectScope::new(&needed).admits(&entry, "packages/gradle/batch-runner/build/a.jar")
        );
    }

    #[test]
    fn an_entry_no_project_holds_matches_everything() {
        let all = roots(&["packages/gradle", "packages/gradle/batch-runner"]);
        for glob in ["**/*.json", "packages/**/*.json", "dist/**"] {
            let entry = positive(glob);
            assert!(
                scope_roots(std::slice::from_ref(&entry), &all).is_empty(),
                "{glob}"
            );
        }
        // Another entry's roots do not scope it.
        let scoped = positive("packages/gradle/**");
        let open = positive("packages/**/*.json");
        let needed = scope_roots(
            &[
                positive("packages/gradle/**"),
                positive("packages/**/*.json"),
            ],
            &all,
        );
        let scope = ProjectScope::new(&needed);
        assert!(scope.admits(&open, "packages/gradle/batch-runner/project.json"));
        assert!(!scope.admits(&scoped, "packages/gradle/batch-runner/project.json"));
    }

    #[test]
    fn an_exact_path_belongs_to_the_project_holding_it() {
        let all = roots(&["packages/gradle", "packages/gradle/batch-runner"]);
        let entry = positive("packages/gradle/batch-runner/build.gradle.kts");
        let needed = scope_roots(std::slice::from_ref(&entry), &all);
        assert!(
            ProjectScope::new(&needed)
                .admits(&entry, "packages/gradle/batch-runner/build.gradle.kts")
        );
    }

    #[test]
    fn a_root_is_matched_by_whole_segments() {
        let all = roots(&["packages/gradle", "packages/gradle-two"]);
        let entry = positive("packages/gradle/**");
        let needed = scope_roots(std::slice::from_ref(&entry), &all);
        assert_eq!(needed, vec!["packages/gradle"]);
        let scope = ProjectScope::new(&needed);
        assert!(scope.admits(&entry, "packages/gradle/a.ts"));
    }
}
