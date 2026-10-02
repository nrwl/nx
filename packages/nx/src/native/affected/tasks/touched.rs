//! Which tasks a change reaches directly: changed paths and moved packages
//! matched against each hash-plan instruction.
//!
//! Globs are matched rather than resolved to file lists, since a deleted file is in no file index.

use rayon::prelude::*;
use std::collections::{HashMap, HashSet};

use super::changed_contents::ChangedContents;
use super::dependent_outputs::is_path_prefix;
use super::plan_ids::referenced_ids;
use crate::native::affected::project_paths::ProjectRoots;
use crate::native::glob::{build_glob_set, fileset_patterns, normalize_glob, partition_glob};
use crate::native::project_graph::types::{ExternalNode, ProjectGraph};
use crate::native::tasks::hashers::globs_from_workspace_globs;
use crate::native::tasks::types::{HashInstruction, HashPlans, JsonFileSetInput};
use crate::native::utils::path::normalize_js_path;

/// The externals a change moved, as the matcher asks about them.
pub(crate) struct ChangedExternals<'a> {
    names: HashSet<&'a str>,
    types: HashSet<&'a str>,
    external_nodes: &'a HashMap<String, ExternalNode>,
}

impl<'a> ChangedExternals<'a> {
    pub(crate) fn new(
        names: &'a [String],
        types: &'a [String],
        external_nodes: &'a HashMap<String, ExternalNode>,
    ) -> Self {
        Self {
            names: names.iter().map(String::as_str).collect(),
            types: types.iter().map(String::as_str).collect(),
            external_nodes,
        }
    }

    /// An unset type is not a claim of membership, so it matches no ecosystem.
    /// The lock-file parsers set `npm` on every node they produce, so a node
    /// without one came from somewhere that never said it was a package.
    fn includes(&self, name: &str) -> bool {
        self.names.contains(name)
            || self
                .external_nodes
                .get(name)
                .and_then(|node| node.r#type.as_deref())
                .is_some_and(|kind| self.types.contains(kind))
    }

    /// The ecosystem that counts `name` as moved when the change could not be
    /// pinned to packages; `None` when it names this package or misses it.
    fn moved_with_ecosystem(&self, name: &str) -> Option<&str> {
        if self.names.contains(name) {
            return None;
        }
        self.external_nodes
            .get(name)
            .and_then(|node| node.r#type.as_deref())
            .filter(|kind| self.types.contains(kind))
    }

    /// `AllExternalDependencies` hashes every node, so any moved external
    /// reaches it whatever its type.
    fn any(&self) -> bool {
        !self.names.is_empty() || !self.types.is_empty()
    }
}

pub(crate) const ROOT_TSCONFIG_FILES: [&str; 2] = ["tsconfig.base.json", "tsconfig.json"];

/// The changed paths, normalized and indexed by owning project, so an instruction
/// scoped to a project that owns no changed file never compiles its globs.
struct ChangedFiles<'a> {
    files: Vec<String>,
    all: Vec<usize>,
    by_owner: HashMap<&'a str, Vec<usize>>,
}

impl<'a> ChangedFiles<'a> {
    fn new(roots: &'a ProjectRoots, changed_files: &[String]) -> Self {
        let files: Vec<String> = changed_files.iter().map(|f| normalize_js_path(f)).collect();
        let mut by_owner: HashMap<&str, Vec<usize>> = HashMap::new();
        for (index, file) in files.iter().enumerate() {
            if let Some(owner) = roots.owner_of(file) {
                by_owner.entry(owner).or_default().push(index);
            }
        }
        Self {
            all: (0..files.len()).collect(),
            files,
            by_owner,
        }
    }

    /// Indices of the files an instruction scoped to `project` can see; every
    /// file for an unscoped one.
    fn candidates(&self, project: Option<&str>) -> &[usize] {
        match project {
            Some(project) => self.by_owner.get(project).map_or(&[], Vec::as_slice),
            None => &self.all,
        }
    }
}

/// The candidates under some positive glob's literal leading folders, the only
/// place it can match, so most instructions are ruled out before compiling.
/// Normalized first, which only widens the prefix.
fn under_literal_prefix(
    globs: &[String],
    changed: &ChangedFiles,
    candidates: &[usize],
) -> Vec<usize> {
    if candidates.is_empty() {
        return Vec::new();
    }
    let prefixes: Vec<String> = globs
        .iter()
        .filter(|glob| !glob.starts_with('!'))
        .map(|glob| partition_glob(&normalize_glob(glob)).0)
        .collect();
    if prefixes.iter().any(String::is_empty) {
        return candidates.to_vec();
    }
    candidates
        .iter()
        .copied()
        .filter(|&index| {
            prefixes
                .iter()
                .any(|prefix| is_path_prefix(prefix, &changed.files[index]))
        })
        .collect()
}

/// The changed files a `JsonFileSet` reads, matched as `collect_json_input_files` does.
fn json_files_in_diff<'c>(
    json: &JsonFileSetInput,
    changed: &'c ChangedFiles,
) -> anyhow::Result<Vec<&'c str>> {
    let (globs, project) = match json.project_name.as_deref() {
        Some(project) => (vec![json.json_path.clone()], Some(project)),
        None => (
            globs_from_workspace_globs(std::slice::from_ref(&json.json_path)),
            None,
        ),
    };
    let candidates = changed.candidates(project);
    if globs.is_empty() || candidates.is_empty() {
        return Ok(Vec::new());
    }
    let glob = build_glob_set(&globs)?;
    Ok(candidates
        .iter()
        .map(|&index| changed.files[index].as_str())
        .filter(|file| glob.is_match(file))
        .collect())
}

/// A changed file that reached a task, and the input pattern it reached it by.
#[napi(object)]
#[derive(Clone, Debug)]
pub struct InputMatch {
    pub file: String,
    /// The fileset that matched. Absent for an instruction with no pattern to
    /// name, such as the root tsconfig.
    pub pattern: Option<String>,
}

/// What reached one task: the files its filesets matched and the packages it
/// hashes that moved.
#[napi(object)]
#[derive(Clone, Debug, Default)]
pub struct TaskInputMatches {
    pub files: Vec<InputMatch>,
    /// External node names the plan hashes one by one that moved.
    pub packages: Vec<String>,
    /// The plan hashes every external dependency, and one moved.
    pub all_externals: bool,
    /// Changed config files of the projects whose configuration the plan hashes.
    pub project_configs: Vec<String>,
    /// Ecosystems a change moved whole, without naming packages, that the plan
    /// hashes packages of. Reported once rather than per package.
    pub moved_ecosystems: Vec<String>,
}

impl TaskInputMatches {
    fn matched(&self) -> bool {
        !self.files.is_empty()
            || !self.packages.is_empty()
            || self.all_externals
            || !self.project_configs.is_empty()
            || !self.moved_ecosystems.is_empty()
    }

    fn sort(&mut self) {
        self.files
            .sort_by(|a, b| a.file.cmp(&b.file).then(a.pattern.cmp(&b.pattern)));
        self.files
            .dedup_by(|a, b| a.file == b.file && a.pattern == b.pattern);
        self.packages.sort_unstable();
        self.packages.dedup();
        self.project_configs.sort_unstable();
        self.project_configs.dedup();
        self.moved_ecosystems.sort_unstable();
        self.moved_ecosystems.dedup();
    }
}

/// What the change matched, once per matching instruction rather than once per
/// task: a lib's fileset reached through `^production` is one instruction
/// shared by every dependent, so copying its files into each would grow with
/// changed files × dependents.
#[derive(Debug, Default)]
pub(crate) struct InputMatches {
    /// One entry per instruction that matched something, sorted.
    pub table: Vec<TaskInputMatches>,
    /// Per touched task, the `table` entries its plan holds, ascending.
    pub by_task: HashMap<String, Vec<u32>>,
}

impl InputMatches {
    /// Everything that reached `task`, merged as one task's matches.
    #[cfg(test)]
    pub fn for_task(&self, task: &str) -> Option<TaskInputMatches> {
        let mut merged = TaskInputMatches::default();
        for &index in self.by_task.get(task)? {
            let hits = &self.table[index as usize];
            merged.files.extend(hits.files.iter().cloned());
            merged.packages.extend(hits.packages.iter().cloned());
            merged.all_externals |= hits.all_externals;
            merged
                .project_configs
                .extend(hits.project_configs.iter().cloned());
            merged
                .moved_ecosystems
                .extend(hits.moved_ecosystems.iter().cloned());
        }
        merged.sort();
        Some(merged)
    }
}

/// Every changed file a plan instruction matched with the pattern responsible,
/// every moved package it hashes, and every changed config it hashes, and
/// which of those each task's plan holds.
///
/// `changed_project_configs` is the subset of `changed_files` that is project
/// configuration still on disk. Without `detail`, a fileset stops at its first
/// matching file and names no pattern: selection only asks whether it matched.
pub(crate) fn compute_input_matches(
    graph: &ProjectGraph,
    hash_plans: &HashPlans,
    changed_files: &[String],
    changed_project_configs: &[String],
    externals: &ChangedExternals,
    contents: &ChangedContents,
    detail: bool,
) -> anyhow::Result<InputMatches> {
    let roots = ProjectRoots::new(graph);
    let changed = ChangedFiles::new(&roots, changed_files);
    let mut reconfigured: HashMap<&str, Vec<String>> = HashMap::new();
    for file in changed_project_configs {
        if let Some(project) = roots.owner_of(&normalize_js_path(file)) {
            reconfigured.entry(project).or_default().push(file.clone());
        }
    }

    // Per instruction, what it matched. Only instructions that matched
    // something are kept.
    let ids = referenced_ids(hash_plans);
    let hits: HashMap<u32, TaskInputMatches> = ids
        .par_iter()
        .map(|&id| {
            let hits = instruction_matches_detail(
                hash_plans.pool.get(id).value(),
                &changed,
                changed_files,
                &reconfigured,
                externals,
                contents,
                detail,
            )?;
            Ok::<_, anyhow::Error>((id, hits))
        })
        .filter(|entry| entry.as_ref().map_or(true, |(_, hits)| hits.matched()))
        .collect::<anyhow::Result<HashMap<_, _>>>()?;
    // Ordered by instruction id so the table is reproducible.
    let mut hits: Vec<(u32, TaskInputMatches)> = hits.into_iter().collect();
    hits.sort_unstable_by_key(|(id, _)| *id);
    // Indexed by instruction id: every plan entry is looked up, most to no match.
    let mut slot: Vec<Option<u32>> = vec![None; ids.last().map_or(0, |&id| id as usize + 1)];
    let mut table = Vec::with_capacity(hits.len());
    for (index, (id, mut hit)) in hits.into_iter().enumerate() {
        hit.sort();
        slot[id as usize] = Some(index as u32);
        table.push(hit);
    }

    let by_task = hash_plans
        .plans
        .par_iter()
        .filter_map(|(task_id, plan)| {
            let mut indexes: Vec<u32> = plan.iter().filter_map(|&id| slot[id as usize]).collect();
            if indexes.is_empty() {
                return None;
            }
            indexes.sort_unstable();
            indexes.dedup();
            Some((task_id.clone(), indexes))
        })
        .collect();
    Ok(InputMatches { table, by_task })
}

/// What an instruction matched: the files and which pattern reached each, or
/// the package that moved. `TaskOutput` never matches;
/// `affected_through_output_reads` carries it instead.
///
/// The whole glob set decides the match, so negations still exclude; the
/// individual positives are then tested only to name the one responsible.
fn instruction_matches_detail(
    instruction: &HashInstruction,
    changed: &ChangedFiles,
    raw_files: &[String],
    reconfigured: &HashMap<&str, Vec<String>>,
    externals: &ChangedExternals,
    contents: &ChangedContents,
    detail: bool,
) -> anyhow::Result<TaskInputMatches> {
    let of_files = |files: Vec<InputMatch>| TaskInputMatches {
        files,
        ..Default::default()
    };
    // A package moved by name, or only because its whole ecosystem did.
    let of_external = |name: &str| match externals.moved_with_ecosystem(name) {
        Some(ecosystem) => TaskInputMatches {
            moved_ecosystems: vec![ecosystem.to_string()],
            ..Default::default()
        },
        None if externals.includes(name) => TaskInputMatches {
            packages: vec![name.to_string()],
            ..Default::default()
        },
        None => TaskInputMatches::default(),
    };
    let collect = |globs: &[String], project: Option<&str>| -> anyhow::Result<Vec<InputMatch>> {
        let candidates = under_literal_prefix(globs, changed, changed.candidates(project));
        if candidates.is_empty() {
            return Ok(vec![]);
        }
        let full = build_glob_set(&fileset_patterns(globs))?;
        if !detail {
            return Ok(candidates
                .into_iter()
                .find(|&i| full.is_match(&changed.files[i]))
                .map(|i| InputMatch {
                    file: raw_files[i].clone(),
                    pattern: None,
                })
                .into_iter()
                .collect());
        }
        let hits: Vec<usize> = candidates
            .into_iter()
            .filter(|&i| full.is_match(&changed.files[i]))
            .collect();
        if hits.is_empty() {
            return Ok(vec![]);
        }
        // Keyed by the entry as declared, so the reason names what the user
        // wrote rather than the `/**` twin a glob-free path expands to.
        let declared: Vec<&String> = globs.iter().filter(|glob| !glob.starts_with('!')).collect();
        // A lone positive is responsible for every match, with nothing to compile.
        let positives: Vec<(&String, _)> = if declared.len() == 1 {
            vec![]
        } else {
            declared
                .iter()
                .map(|glob| {
                    build_glob_set(&fileset_patterns(std::slice::from_ref(*glob)))
                        .map(|set| (*glob, set))
                })
                .collect::<anyhow::Result<Vec<_>>>()?
        };

        Ok(hits
            .into_iter()
            .map(|i| InputMatch {
                // The path as it was given, so it reads back like the diff.
                file: raw_files[i].clone(),
                pattern: match declared.as_slice() {
                    [only] => Some((*only).clone()),
                    _ => positives
                        .iter()
                        .find(|(_, set)| set.is_match(&changed.files[i]))
                        .map(|(glob, _)| (*glob).clone()),
                },
            })
            .collect())
    };

    match instruction {
        HashInstruction::WorkspaceFileSet(file_sets) => {
            collect(&globs_from_workspace_globs(file_sets), None).map(of_files)
        }
        HashInstruction::ProjectFileSet(project, file_sets) => {
            collect(file_sets, Some(project)).map(of_files)
        }
        HashInstruction::IgnoredFileSet(globs) => {
            let globs: Vec<String> = globs.iter().map(|glob| normalize_glob(glob)).collect();
            collect(&globs, None).map(of_files)
        }
        HashInstruction::JsonFileSet(json)
            if json.fields.is_some() || json.exclude_fields.is_some() =>
        {
            Ok(of_files(
                json_files_in_diff(json, changed)?
                    .into_iter()
                    .filter(|file| contents.json_file_changed(file, json))
                    .map(|file| InputMatch {
                        file: file.to_string(),
                        pattern: Some(json.json_path.clone()),
                    })
                    .collect(),
            ))
        }
        HashInstruction::JsonFileSet(json) => match json.project_name.as_deref() {
            Some(project) => collect(std::slice::from_ref(&json.json_path), Some(project)),
            None => collect(
                &globs_from_workspace_globs(std::slice::from_ref(&json.json_path)),
                None,
            ),
        }
        .map(of_files),
        HashInstruction::TsConfiguration(project) => {
            let roots: Vec<InputMatch> = changed
                .files
                .iter()
                .enumerate()
                .filter(|(_, file)| ROOT_TSCONFIG_FILES.contains(&file.as_str()))
                .map(|(i, _)| InputMatch {
                    file: raw_files[i].clone(),
                    pattern: None,
                })
                .collect();
            // Only read and compare the root tsconfig when one is in the diff.
            let changed = !roots.is_empty() && contents.ts_config_changed(project);
            Ok(TaskInputMatches {
                files: if changed { roots } else { vec![] },
                ..of_external("typescript")
            })
        }
        HashInstruction::External(name) => Ok(of_external(name)),
        HashInstruction::AllExternalDependencies => Ok(TaskInputMatches {
            all_externals: externals.any(),
            ..Default::default()
        }),
        HashInstruction::ProjectConfiguration(project) => Ok(TaskInputMatches {
            project_configs: reconfigured
                .get(project.as_str())
                .cloned()
                .unwrap_or_default(),
            ..Default::default()
        }),
        _ => Ok(TaskInputMatches::default()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::InstructionPool;
    use crate::native::test_utils::{graph_of_roots as graph, hash_plans, strings};
    use std::sync::Arc;

    /// The tasks with any input match: what selection treats as touched.
    fn touched_tasks(
        graph: &ProjectGraph,
        hash_plans: &HashPlans,
        changed_files: &[String],
        changed_project_configs: &[String],
        externals: &ChangedExternals,
        contents: &ChangedContents,
    ) -> anyhow::Result<HashSet<String>> {
        Ok(compute_input_matches(
            graph,
            hash_plans,
            changed_files,
            changed_project_configs,
            externals,
            contents,
            false,
        )?
        .by_task
        .into_keys()
        .collect())
    }

    /// Builds a one-task plan from the given instructions.
    fn plans(task: &str, instructions: Vec<HashInstruction>) -> HashPlans {
        hash_plans(&[(task, instructions)])
    }

    static NO_NODES: std::sync::LazyLock<HashMap<String, ExternalNode>> =
        std::sync::LazyLock::new(HashMap::new);

    fn no_externals() -> ChangedExternals<'static> {
        ChangedExternals::new(&[], &[], &NO_NODES)
    }

    /// Named external nodes with their ecosystem, so `ChangedExternals::includes` can match on type.
    fn externals_graph(externals: &[(&str, &str)]) -> ProjectGraph {
        let mut g = graph(&[("a", "libs/a")]);
        g.external_nodes = externals
            .iter()
            .map(|(name, kind)| {
                (
                    name.to_string(),
                    ExternalNode {
                        r#type: Some(kind.to_string()),
                        package_name: Some(name.to_string()),
                        version: "1.0.0".into(),
                        hash: None,
                    },
                )
            })
            .collect();
        g
    }

    fn touched_for(
        g: &ProjectGraph,
        instructions: Vec<HashInstruction>,
        changed: &[&str],
    ) -> Vec<String> {
        let p = plans("a:build", instructions);
        sorted(
            touched_tasks(
                g,
                &p,
                &strings(changed),
                &[],
                &no_externals(),
                &ChangedContents::default(),
            )
            .unwrap(),
        )
    }

    fn sorted(touched: HashSet<String>) -> Vec<String> {
        let mut touched: Vec<String> = touched.into_iter().collect();
        touched.sort();
        touched
    }

    fn touched_for_externals(
        instructions: Vec<HashInstruction>,
        moved: &[&str],
        types: &[&str],
    ) -> Vec<String> {
        touched_in(graph(&[("a", "libs/a")]), instructions, moved, types)
    }

    fn touched_in(
        g: ProjectGraph,
        instructions: Vec<HashInstruction>,
        moved: &[&str],
        types: &[&str],
    ) -> Vec<String> {
        let p = plans("a:build", instructions);
        let moved = strings(moved);
        let types = strings(types);
        sorted(
            touched_tasks(
                &g,
                &p,
                &[],
                &[],
                &ChangedExternals::new(&moved, &types, &g.external_nodes),
                &ChangedContents::default(),
            )
            .unwrap(),
        )
    }

    #[test]
    fn workspace_fileset_matches_after_stripping_the_token() {
        let g = graph(&[("a", "libs/a")]);
        assert_eq!(
            touched_for(
                &g,
                vec![HashInstruction::WorkspaceFileSet(strings(&[
                    "{workspaceRoot}/babel.config.json"
                ]))],
                &["babel.config.json"]
            ),
            vec!["a:build"]
        );
    }

    #[test]
    fn project_fileset_matches_only_inside_its_own_project() {
        let g = graph(&[("a", "libs/a"), ("b", "libs/b")]);
        let instruction = HashInstruction::ProjectFileSet("a".into(), strings(&["libs/**/*.ts"]));
        assert_eq!(
            touched_for(&g, vec![instruction.clone()], &["libs/a/src/x.ts"]),
            vec!["a:build"]
        );
        assert!(touched_for(&g, vec![instruction], &["libs/b/src/x.ts"]).is_empty());
    }

    /// A fileset entry with no glob syntax is the file or everything under it,
    /// which is how the hasher reads it. Matching the literal alone would leave
    /// a `{projectRoot}/src` input blind to every file inside `src`.
    #[test]
    fn a_glob_free_path_matches_everything_under_it() {
        let g = graph(&[("a", "libs/a")]);
        assert_eq!(
            touched_for(
                &g,
                vec![HashInstruction::ProjectFileSet(
                    "a".into(),
                    strings(&["libs/a/src"])
                )],
                &["libs/a/src/deep/x.ts"]
            ),
            vec!["a:build"]
        );
        // The negated form excludes the subtree the same way.
        assert!(
            touched_for(
                &g,
                vec![HashInstruction::ProjectFileSet(
                    "a".into(),
                    strings(&["libs/a/**/*", "!libs/a/generated"])
                )],
                &["libs/a/generated/x.ts"]
            )
            .is_empty()
        );
    }

    /// The whole reason for matching globs instead of resolving file lists: a
    /// deleted path is in no file index, so a resolved list could never contain
    /// it and every rename would be missed.
    #[test]
    fn matches_a_path_with_no_file_behind_it() {
        let g = graph(&[("a", "libs/a")]);
        assert_eq!(
            touched_for(
                &g,
                vec![HashInstruction::ProjectFileSet(
                    "a".into(),
                    strings(&["libs/a/**/*.ts"])
                )],
                &["libs/a/src/deleted.ts"]
            ),
            vec!["a:build"]
        );
    }

    #[test]
    fn task_output_never_matches() {
        let g = graph(&[("a", "libs/a")]);
        assert!(
            touched_for(
                &g,
                vec![HashInstruction::TaskOutput(
                    "**/*.js".into(),
                    strings(&["dist/libs/b"])
                )],
                &["dist/libs/b/index.js"]
            )
            .is_empty()
        );
    }

    #[test]
    fn runtime_and_environment_never_match() {
        let g = graph(&[("a", "libs/a")]);
        assert!(
            touched_for(
                &g,
                vec![
                    HashInstruction::Runtime("node -v".into()),
                    HashInstruction::Environment("CI".into()),
                ],
                &["node -v", "CI"]
            )
            .is_empty()
        );
    }

    /// A lockfile change reaches a plan as the external node's name, so it is
    /// matched by package rather than by path.
    #[test]
    fn external_matches_the_named_package_only() {
        let plan = || vec![HashInstruction::External("npm:lodash".into())];
        assert_eq!(
            touched_for_externals(plan(), &["npm:lodash"], &[]),
            vec!["a:build"]
        );
        assert!(touched_for_externals(plan(), &["npm:react"], &[]).is_empty());
        assert!(touched_for_externals(plan(), &[], &[]).is_empty());
    }

    #[test]
    fn all_external_dependencies_matches_when_any_package_moved() {
        let plan = || vec![HashInstruction::AllExternalDependencies];
        assert_eq!(
            touched_for_externals(plan(), &["npm:lodash"], &[]),
            vec!["a:build"]
        );
        assert!(touched_for_externals(plan(), &[], &[]).is_empty());
    }

    /// The locator could not say which packages moved, so every external counts,
    /// including one the change never named.
    #[test]
    fn every_external_counts_when_the_change_could_not_be_pinned() {
        assert_eq!(
            touched_in(
                externals_graph(&[("npm:react", "npm")]),
                vec![HashInstruction::External("npm:react".into())],
                &[],
                &["npm"],
            ),
            vec!["a:build"]
        );
        assert_eq!(
            touched_for_externals(
                vec![HashInstruction::AllExternalDependencies],
                &[],
                &["npm"]
            ),
            vec!["a:build"]
        );
    }

    /// A pnpm lock file cannot have moved a Maven artifact, so an unpinned npm
    /// change leaves another ecosystem's nodes alone.
    #[test]
    fn an_unpinned_change_stays_within_its_own_ecosystem() {
        let guava = "gradle:com.google.guava:guava";
        assert!(
            touched_in(
                externals_graph(&[(guava, "gradle")]),
                vec![HashInstruction::External(guava.into())],
                &[],
                &["npm"],
            )
            .is_empty(),
            "a gradle artifact is not moved by a lock file change"
        );
        assert_eq!(
            touched_in(
                externals_graph(&[("npm:react", "npm")]),
                vec![HashInstruction::External("npm:react".into())],
                &[],
                &["npm"],
            ),
            vec!["a:build"],
            "an npm package still is"
        );
    }

    /// A node that never declared an ecosystem is not claimed by one, so an
    /// unpinned npm change leaves it alone. Naming it outright still matches.
    #[test]
    fn an_untyped_node_is_claimed_by_no_ecosystem() {
        let untyped = || {
            let mut g = graph(&[("a", "libs/a")]);
            g.external_nodes.insert(
                "gradle:guava".into(),
                ExternalNode {
                    r#type: None,
                    package_name: Some("guava".into()),
                    version: "1.0.0".into(),
                    hash: None,
                },
            );
            g
        };
        let plan = || vec![HashInstruction::External("gradle:guava".into())];

        assert!(
            touched_in(untyped(), plan(), &[], &["npm"]).is_empty(),
            "an unset type is not npm"
        );
        assert_eq!(
            touched_in(untyped(), plan(), &["gradle:guava"], &[]),
            vec!["a:build"],
            "a pinned name matches whatever the type"
        );
    }

    /// AllExternalDependencies hashes every node whatever its type, so any moved
    /// external reaches it.
    #[test]
    fn all_external_dependencies_still_matches_another_ecosystem() {
        assert_eq!(
            touched_in(
                externals_graph(&[("gradle:guava", "gradle")]),
                vec![HashInstruction::AllExternalDependencies],
                &[],
                &["npm"],
            ),
            vec!["a:build"]
        );
    }

    #[test]
    fn tsconfiguration_matches_either_root_tsconfig() {
        let g = graph(&[("a", "libs/a")]);
        for file in ROOT_TSCONFIG_FILES {
            assert_eq!(
                touched_for(
                    &g,
                    vec![HashInstruction::TsConfiguration("a".into())],
                    &[file]
                ),
                vec!["a:build"],
                "{file} should mark the task touched"
            );
        }
        assert!(
            touched_for(
                &g,
                vec![HashInstruction::TsConfiguration("a".into())],
                &["libs/a/tsconfig.json"]
            )
            .is_empty(),
            "only the ROOT tsconfig counts"
        );
    }

    #[test]
    fn files_input_matches_a_tracked_path() {
        let g = graph(&[("a", "libs/a")]);
        assert_eq!(
            touched_for(
                &g,
                vec![HashInstruction::IgnoredFileSet(strings(&[
                    "libs/a/generated/**/*.ts"
                ]))],
                &["libs/a/generated/api.ts"]
            ),
            vec!["a:build"]
        );
    }

    #[test]
    fn a_disk_backed_fileset_with_repeated_slashes_matches_the_normalized_path() {
        let g = graph(&[("a", "apps/app")]);
        let instruction = HashInstruction::IgnoredFileSet(strings(&[
            "apps//app/src/**",
            "!apps//app/src//**/*.map",
        ]));
        assert_eq!(
            touched_for(&g, vec![instruction.clone()], &["apps/app/src/x.ts"]),
            vec!["a:build"]
        );
        assert!(touched_for(&g, vec![instruction], &["apps/app/src/x.js.map"]).is_empty());
    }

    /// The hasher expands a disk-backed fileset workspace-wide, so scoping the
    /// match to the declaring project would under-select every read of another
    /// project's generated output.
    #[test]
    fn a_disk_backed_fileset_matches_outside_its_own_project() {
        let g = graph(&[("a", "libs/a"), ("b", "libs/b")]);
        assert_eq!(
            touched_for(
                &g,
                vec![HashInstruction::IgnoredFileSet(strings(&[
                    "libs/b/generated/**/*.ts"
                ]))],
                &["libs/b/generated/api.ts"]
            ),
            vec!["a:build"]
        );
    }

    #[test]
    fn negations_in_a_workspace_fileset_are_honoured() {
        let g = graph(&[("a", "libs/a")]);
        let instruction = HashInstruction::WorkspaceFileSet(strings(&[
            "{workspaceRoot}/config/**",
            "!{workspaceRoot}/config/local.json",
        ]));
        assert_eq!(
            touched_for(&g, vec![instruction.clone()], &["config/app.json"]),
            vec!["a:build"]
        );
        assert!(touched_for(&g, vec![instruction], &["config/local.json"]).is_empty());
    }

    /// ProjectConfiguration resolves to no files, so only a changed config for
    /// that exact project can match it. This is what carries a dependency's
    /// config change to its consumers, whose plans each carry one.
    #[test]
    fn project_configuration_matches_only_its_own_changed_config() {
        let g = graph(&[("a", "libs/a"), ("b", "libs/b")]);
        let p = plans(
            "consumer:build",
            vec![HashInstruction::ProjectConfiguration("a".into())],
        );
        let config_a = strings(&["libs/a/project.json"]);
        let config_b = strings(&["libs/b/project.json"]);

        let hit = touched_tasks(
            &g,
            &p,
            &config_a,
            &config_a,
            &no_externals(),
            &ChangedContents::default(),
        )
        .unwrap();
        assert_eq!(sorted(hit), strings(&["consumer:build"]));

        // Another project's config leaves it alone.
        let miss = touched_tasks(
            &g,
            &p,
            &config_b,
            &config_b,
            &no_externals(),
            &ChangedContents::default(),
        )
        .unwrap();
        assert!(miss.is_empty());

        // A source file in the same project is not a config change, so this
        // does not widen back out to project granularity.
        let source = touched_tasks(
            &g,
            &p,
            &strings(&["libs/a/src/index.ts"]),
            &[],
            &no_externals(),
            &ChangedContents::default(),
        )
        .unwrap();
        assert!(source.is_empty());
    }

    /// One instruction is checked once and answers for every plan that shares it.
    #[test]
    fn every_plan_sharing_a_matched_instruction_is_touched() {
        let g = graph(&[("a", "libs/a")]);
        let pool = Arc::new(InstructionPool::new());
        let id = pool.intern(HashInstruction::WorkspaceFileSet(strings(&[
            "{workspaceRoot}/x.txt",
        ])));
        let p = HashPlans {
            pool,
            plans: HashMap::from([
                ("z:build".to_string(), vec![id]),
                ("a:build".to_string(), vec![id]),
                ("m:build".to_string(), vec![id]),
            ]),
            deferred: Default::default(),
        };
        let touched = touched_tasks(
            &g,
            &p,
            &strings(&["x.txt"]),
            &[],
            &no_externals(),
            &ChangedContents::default(),
        )
        .unwrap();
        assert_eq!(sorted(touched), strings(&["a:build", "m:build", "z:build"]));
    }

    fn json_input(fields: &[&str], exclude: &[&str]) -> HashInstruction {
        HashInstruction::JsonFileSet(Box::new(JsonFileSetInput {
            project_name: None,
            json_path: "{workspaceRoot}/package.json".into(),
            fields: (!fields.is_empty()).then(|| strings(fields)),
            exclude_fields: (!exclude.is_empty()).then(|| strings(exclude)),
        }))
    }

    fn touched_by_package_json(instruction: HashInstruction, changed_paths: &[&str]) -> bool {
        let g = graph(&[("a", "libs/a")]);
        let contents = ChangedContents::default().with_json_diff(
            "package.json",
            Some(
                changed_paths
                    .iter()
                    .map(|p| p.split('.').map(String::from).collect())
                    .collect(),
            ),
        );
        !touched_tasks(
            &g,
            &plans("a:build", vec![instruction]),
            &strings(&["package.json"]),
            &[],
            &no_externals(),
            &contents,
        )
        .unwrap()
        .is_empty()
    }

    #[test]
    fn a_field_filtered_json_input_ignores_other_fields() {
        assert!(!touched_by_package_json(
            json_input(&["version"], &[]),
            &["description"]
        ));
        assert!(touched_by_package_json(
            json_input(&["version"], &[]),
            &["version"]
        ));
        assert!(!touched_by_package_json(
            json_input(&[], &["scripts"]),
            &["scripts.test"]
        ));
        assert!(touched_by_package_json(
            json_input(&[], &["scripts"]),
            &["name"]
        ));
        // Unfiltered, it hashes the whole file.
        assert!(touched_by_package_json(
            json_input(&[], &[]),
            &["description"]
        ));
    }

    /// Only a file whose diff was supplied is judged by field.
    #[test]
    fn an_uncompared_json_file_counts_as_changed() {
        let g = graph(&[("a", "libs/a")]);
        let touched = touched_tasks(
            &g,
            &plans("a:build", vec![json_input(&["version"], &[])]),
            &strings(&["package.json"]),
            &[],
            &no_externals(),
            &ChangedContents::default(),
        )
        .unwrap();
        assert_eq!(sorted(touched), strings(&["a:build"]));
    }

    #[test]
    fn a_selectively_hashed_tsconfig_paths_change_touches_its_project_only() {
        let g = graph(&[("a", "libs/a"), ("b", "libs/b")]);
        let p = hash_plans(&[
            (
                "a:build",
                vec![HashInstruction::TsConfiguration("a".into())],
            ),
            (
                "b:build",
                vec![HashInstruction::TsConfiguration("b".into())],
            ),
        ]);
        let contents = ChangedContents::default().with_ts_config_projects(&["a"]);
        let touched = touched_tasks(
            &g,
            &p,
            &strings(&["tsconfig.base.json"]),
            &[],
            &no_externals(),
            &contents,
        )
        .unwrap();
        assert_eq!(sorted(touched), strings(&["a:build"]));
    }

    /// The hasher prefixes the tsconfig hash with the `typescript` node's.
    #[test]
    fn moving_typescript_touches_every_tsconfig_input() {
        assert_eq!(
            touched_for_externals(
                vec![HashInstruction::TsConfiguration("a".into())],
                &["typescript"],
                &[]
            ),
            vec!["a:build"]
        );
    }

    #[test]
    fn input_matches_name_the_file_and_the_pattern_responsible() {
        let g = graph(&[("a", "libs/a")]);
        let p = plans(
            "a:build",
            vec![HashInstruction::ProjectFileSet(
                "a".into(),
                strings(&["libs/a/**/*.ts", "!libs/a/**/*.spec.ts"]),
            )],
        );
        let hits = compute_input_matches(
            &g,
            &p,
            &strings(&["libs/a/src/x.ts", "libs/a/src/x.spec.ts"]),
            &[],
            &no_externals(),
            &ChangedContents::default(),
            true,
        )
        .unwrap();
        let hit = &hits.for_task("a:build").unwrap().files;
        assert_eq!(hit.len(), 1, "the negated spec file is excluded");
        assert_eq!(hit[0].file, "libs/a/src/x.ts");
        assert_eq!(hit[0].pattern.as_deref(), Some("libs/a/**/*.ts"));
    }

    #[test]
    fn input_matches_name_the_moved_package_and_the_all_externals_hash() {
        let g = graph(&[("a", "libs/a")]);
        let p = hash_plans(&[
            (
                "a:build",
                vec![
                    HashInstruction::External("npm:lodash".into()),
                    HashInstruction::External("npm:react".into()),
                ],
            ),
            ("a:lint", vec![HashInstruction::AllExternalDependencies]),
            (
                "a:test",
                vec![HashInstruction::External("npm:react".into())],
            ),
        ]);
        let moved = strings(&["npm:lodash"]);
        let hits = compute_input_matches(
            &g,
            &p,
            &[],
            &[],
            &ChangedExternals::new(&moved, &[], &g.external_nodes),
            &ChangedContents::default(),
            true,
        )
        .unwrap();
        let build = hits.for_task("a:build").unwrap();
        assert_eq!(build.packages, strings(&["npm:lodash"]));
        assert!(!build.all_externals);
        assert!(hits.for_task("a:lint").unwrap().all_externals);
        assert!(
            hits.for_task("a:test").is_none(),
            "an unmoved package is no reason"
        );
    }

    /// An unpinned change moves every package of its ecosystem; naming each one
    /// under every task would bury the explanation.
    #[test]
    fn input_matches_report_an_unpinned_ecosystem_once() {
        let g = externals_graph(&[("npm:lodash", "npm"), ("npm:react", "npm")]);
        let p = plans(
            "a:build",
            vec![
                HashInstruction::External("npm:lodash".into()),
                HashInstruction::External("npm:react".into()),
            ],
        );
        let moved = strings(&["npm:react"]);
        let types = strings(&["npm"]);
        let hits = compute_input_matches(
            &g,
            &p,
            &[],
            &[],
            &ChangedExternals::new(&moved, &types, &g.external_nodes),
            &ChangedContents::default(),
            true,
        )
        .unwrap();
        let build = hits.for_task("a:build").unwrap();
        assert_eq!(build.packages, strings(&["npm:react"]));
        assert_eq!(build.moved_ecosystems, strings(&["npm"]));
    }
}
