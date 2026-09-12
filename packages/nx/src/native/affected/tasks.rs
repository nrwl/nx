//! Decides which tasks a change affects.
//!
//! Three steps, all here so the answer crosses the napi boundary once: which
//! tasks a change touches, a changed path tested against each hash-plan
//! instruction's globs and a moved package against its `External` names; which
//! upstream tasks each task reads the outputs of; and the walk that carries
//! affectedness from a producer to the tasks reading it.
//!
//! Matching globs rather than resolving instructions to file lists is what makes
//! the first step both correct and affordable. A deleted file has no entry in
//! the workspace file map, so a resolved list can never contain it, and every
//! rename would be missed. It also inverts the cost: `O(unique instructions x
//! changed files)` instead of `O(unique instructions x files per instruction)`,
//! and changed files number in the tens where instruction filesets reach
//! thousands. Instructions are interned, so the same glob set shared by a
//! thousand tasks is compiled and tested once.

use napi::bindgen_prelude::*;
use rayon::prelude::*;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Arc;
use tracing::warn;

use crate::native::affected::dependent_outputs::compute_dependent_output_edges;
use crate::native::affected::plan_ids::referenced_ids;
use crate::native::affected::project_paths::{ProjectRoots, normalize_path};
use crate::native::glob::build_glob_set;
use crate::native::project_graph::types::ProjectGraph;
use crate::native::tasks::hash_planner::ROOT_TSCONFIG_FILES;
use crate::native::tasks::hashers::globs_from_workspace_globs;
use crate::native::tasks::types::{HashInstruction, HashPlans, TaskGraph};

#[napi(object)]
pub struct AffectedTasksOptions {
    /// `createNodes` globs of every loaded plugin. Resolved in TypeScript because
    /// `getPlugins` is async and spawns plugin workers.
    pub project_glob_patterns: Vec<String>,
    pub workspace_root: String,
    /// Tasks of the projects a dependency change names outright, through
    /// `projectsAffectedByDependencyUpdates` or as a workspace project the root
    /// package.json depends on. Ids not in the task graph are ignored.
    pub seed_task_ids: Vec<String>,
    /// External node names whose version or integrity moved. A plan carries them
    /// as `External(name)`, so a package is matched the way a path is.
    pub changed_externals: Vec<String>,
    /// The change could not be pinned to packages, or the workspace asked for
    /// everything on a lockfile change, so every external counts as moved.
    pub all_externals_changed: bool,
}

/// The externals a change moved, as the matcher asks about them.
pub(crate) struct ChangedExternals<'a> {
    names: HashSet<&'a str>,
    all: bool,
}

impl<'a> ChangedExternals<'a> {
    pub(crate) fn new(names: &'a [String], all: bool) -> Self {
        Self {
            names: names.iter().map(String::as_str).collect(),
            all,
        }
    }

    fn includes(&self, name: &str) -> bool {
        self.all || self.names.contains(name)
    }

    fn any(&self) -> bool {
        self.all || !self.names.is_empty()
    }
}

#[napi(object)]
pub struct AffectedTaskSelection {
    /// Every affected task, sorted.
    pub affected: Vec<String>,
    /// Consumer -> the affected producers whose outputs it reads. Only the
    /// edges the walk crossed, which is what `--explain` reports.
    pub producers_of: HashMap<String, Vec<String>>,
    /// Changed project configs no longer on disk. Every task was seeded for
    /// them, since the project each described is gone from the graph.
    pub deleted_project_configs: Vec<String>,
}

#[napi]
pub fn affected_tasks(
    project_graph: &External<Arc<ProjectGraph>>,
    #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
    hash_plans: &External<HashPlans>,
    task_graph: TaskGraph,
    changed_files: Vec<String>,
    options: AffectedTasksOptions,
) -> Result<AffectedTaskSelection> {
    Ok(compute_affected_task_selection(
        project_graph,
        hash_plans,
        &task_graph,
        &changed_files,
        &options,
    )?)
}

pub(crate) fn compute_affected_task_selection(
    graph: &ProjectGraph,
    hash_plans: &HashPlans,
    task_graph: &TaskGraph,
    changed_files: &[String],
    options: &AffectedTasksOptions,
) -> anyhow::Result<AffectedTaskSelection> {
    let (configs, deleted) = changed_project_configs(changed_files, options);

    let externals =
        ChangedExternals::new(&options.changed_externals, options.all_externals_changed);
    let mut touched: HashSet<String> =
        touched_tasks(graph, hash_plans, changed_files, &configs, &externals)?
            .into_iter()
            .collect();
    touched.extend(
        options
            .seed_task_ids
            .iter()
            .filter(|id| task_graph.tasks.contains_key(*id))
            .cloned(),
    );
    // The project a deleted config described is gone, so no surviving task has
    // a fileset that names it and nothing narrower than everything is sound.
    if !deleted.is_empty() {
        touched.extend(task_graph.tasks.keys().cloned());
    }

    let producers_of = compute_dependent_output_edges(hash_plans, task_graph);
    let (affected, producers_of) =
        affected_through_output_reads(&touched, task_graph, &producers_of);

    Ok(AffectedTaskSelection {
        affected,
        producers_of,
        deleted_project_configs: deleted,
    })
}

/// Changed paths that are project configuration, split by whether the file is
/// still on disk. Raw rather than normalized, so the stat sees the path as
/// given, the way `projects_from_project_glob_changes` does.
fn changed_project_configs(
    changed_files: &[String],
    options: &AffectedTasksOptions,
) -> (Vec<String>, Vec<String>) {
    // Load-bearing: with both the included and excluded sets empty, `is_match`
    // returns `!excluded.is_match(..)`, i.e. true for every file.
    if options.project_glob_patterns.is_empty() {
        return (Vec::new(), Vec::new());
    }
    let Ok(glob) = build_glob_set(&options.project_glob_patterns) else {
        warn!("ignoring unparseable plugin createNodes globs, no project config change detected");
        return (Vec::new(), Vec::new());
    };
    let workspace_root = Path::new(&options.workspace_root);
    let mut configs = Vec::new();
    let mut deleted = Vec::new();
    for file in changed_files {
        if !glob.is_match(file) {
            continue;
        }
        if workspace_root.join(file).exists() {
            configs.push(file.clone());
        } else {
            deleted.push(file.clone());
        }
    }
    (configs, deleted)
}

/// Task ids with at least one changed file or moved package among their plan's
/// inputs.
///
/// `changed_project_configs` is the subset of `changed_files` that is project
/// configuration.
pub(crate) fn touched_tasks(
    graph: &ProjectGraph,
    hash_plans: &HashPlans,
    changed_files: &[String],
    changed_project_configs: &[String],
    externals: &ChangedExternals,
) -> anyhow::Result<Vec<String>> {
    let roots = ProjectRoots::new(graph);
    let changed = ChangedFiles::new(&roots, changed_files);

    // The projects whose configuration changed. ProjectConfiguration resolves to
    // no files, so nothing else in the plan can see this.
    let reconfigured: HashSet<&str> = changed_project_configs
        .iter()
        .filter_map(|file| roots.owner_of(&normalize_path(file)))
        .collect();

    // Only whether an instruction matched, never which files: the selection is
    // a membership question, and nothing downstream reads the per-file detail.
    let ids = referenced_ids(hash_plans);
    let hits: Vec<bool> = ids
        .par_iter()
        .map(|&id| {
            instruction_matches(
                hash_plans.pool.get(id).value(),
                &changed,
                &reconfigured,
                externals,
            )
        })
        .collect::<anyhow::Result<_>>()?;
    let mut matched = vec![false; ids.last().map_or(0, |&id| id as usize + 1)];
    for (&id, hit) in ids.iter().zip(hits) {
        matched[id as usize] = hit;
    }

    let mut touched: Vec<String> = hash_plans
        .plans
        .par_iter()
        .filter(|(_, plan)| plan.iter().any(|&id| matched[id as usize]))
        .map(|(task_id, _)| task_id.clone())
        .collect();
    // `plans` is a HashMap, so sort for a reproducible answer.
    touched.par_sort_unstable();
    Ok(touched)
}

/// Carries affectedness from a producer to the tasks that read its outputs.
///
/// A consumer reads its dependency's build artifacts, which are gitignored and
/// do not exist yet, so the dependency's *inputs* are what decide the consumer.
/// Only output-read edges are followed, never plain `dependsOn`: affectedness
/// follows data rather than the schedule. Walking in topological order settles
/// a chain in O(V+E), where unioning upstream file sets would copy a shared
/// ancestor once per path through a diamond.
///
/// Returns the affected set, sorted, and the edges it crossed: for every
/// affected task, the affected producers it reads. A task that was touched
/// directly still records its producers, since `--explain` lists every reason
/// that applies rather than the first one found.
fn affected_through_output_reads(
    touched: &HashSet<String>,
    task_graph: &TaskGraph,
    producers_of: &HashMap<String, Vec<String>>,
) -> (Vec<String>, HashMap<String, Vec<String>>) {
    let mut affected: HashSet<&str> = touched.iter().map(String::as_str).collect();
    let mut edges: HashMap<String, Vec<String>> = HashMap::new();
    for id in topological_order(task_graph) {
        let Some(producers) = producers_of.get(id) else {
            continue;
        };
        let hit: Vec<String> = producers
            .iter()
            .filter(|producer| affected.contains(producer.as_str()))
            .cloned()
            .collect();
        if hit.is_empty() {
            continue;
        }
        edges.insert(id.to_string(), hit);
        affected.insert(id);
    }
    let mut affected: Vec<String> = affected.into_iter().map(str::to_string).collect();
    affected.sort_unstable();
    (affected, edges)
}

/// Dependencies before dependents, Kahn's algorithm. Any task a cycle keeps out
/// of the order is appended, so a cyclic graph degrades to "no propagation
/// across the cycle" rather than hanging or dropping a task. Ids are visited in
/// sorted order so the result is the same on every run.
fn topological_order(task_graph: &TaskGraph) -> Vec<&str> {
    let mut ids: Vec<&str> = task_graph.tasks.keys().map(String::as_str).collect();
    ids.sort_unstable();

    let mut in_degree: HashMap<&str, usize> = ids.iter().map(|id| (*id, 0)).collect();
    let mut dependents: HashMap<&str, Vec<&str>> = HashMap::new();
    for id in &ids {
        for dep in task_graph.dependencies.get(*id).into_iter().flatten() {
            // An edge to a task outside the graph is not an edge.
            if !in_degree.contains_key(dep.as_str()) {
                continue;
            }
            *in_degree.get_mut(id).unwrap() += 1;
            dependents.entry(dep.as_str()).or_default().push(id);
        }
    }

    let mut order: Vec<&str> = ids
        .iter()
        .copied()
        .filter(|id| in_degree[id] == 0)
        .collect();
    let mut head = 0;
    while head < order.len() {
        let id = order[head];
        head += 1;
        for dependent in dependents.get(id).into_iter().flatten() {
            let remaining = in_degree.get_mut(dependent).unwrap();
            *remaining -= 1;
            if *remaining == 0 {
                order.push(dependent);
            }
        }
    }
    if order.len() < ids.len() {
        let seen: HashSet<&str> = order.iter().copied().collect();
        order.extend(ids.iter().copied().filter(|id| !seen.contains(id)));
    }
    order
}

/// The changed paths, normalized, with each one's owning project resolved once
/// and indexed by owner.
///
/// A project-scoped instruction is tested only against the files its project
/// owns, and when that project owns none it is answered without compiling its
/// globs. Most of a workspace's instructions are scoped to projects a change
/// never touches, and compiling a glob set is the expensive step.
struct ChangedFiles<'a> {
    files: Vec<String>,
    all: Vec<usize>,
    by_owner: HashMap<&'a str, Vec<usize>>,
}

impl<'a> ChangedFiles<'a> {
    fn new(roots: &'a ProjectRoots, changed_files: &[String]) -> Self {
        let files: Vec<String> = changed_files.iter().map(|f| normalize_path(f)).collect();
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

/// Whether any changed file is one this instruction would hash.
///
/// `TaskOutput` is deliberately absent: it resolves to a dependent task's build
/// artifacts, which are gitignored and do not exist yet when affected runs, so
/// intersecting it is always empty and misleadingly so. Dependency changes reach
/// a consumer through `affected_through_output_reads` instead.
fn instruction_matches(
    instruction: &HashInstruction,
    changed: &ChangedFiles,
    reconfigured: &HashSet<&str>,
    externals: &ChangedExternals,
) -> anyhow::Result<bool> {
    // Scoped to one project, the way the hasher scopes the same globs with
    // project_file_map, or workspace-wide when there is no owner to match.
    let any_matching = |globs: &[String], project: Option<&str>| -> anyhow::Result<bool> {
        let candidates = changed.candidates(project);
        if globs.is_empty() || candidates.is_empty() {
            return Ok(false);
        }
        let glob = build_glob_set(globs)?;
        Ok(candidates
            .iter()
            .any(|&index| glob.is_match(&changed.files[index])))
    };

    match instruction {
        HashInstruction::WorkspaceFileSet(file_sets) => {
            any_matching(&globs_from_workspace_globs(file_sets), None)
        }
        HashInstruction::ProjectFileSet(project, file_sets, false) => {
            any_matching(file_sets, Some(project))
        }
        // Unscoped: the hasher's disk arm discards the project and expands
        // workspace-wide. A changed file is tracked by definition, so a match is
        // the tracked case; untracked paths are handled by propagation.
        HashInstruction::ProjectFileSet(_, globs, true) => any_matching(globs, None),
        HashInstruction::JsonFileSet(json) => match json.project_name.as_deref() {
            Some(project) => any_matching(std::slice::from_ref(&json.json_path), Some(project)),
            None => any_matching(
                &globs_from_workspace_globs(std::slice::from_ref(&json.json_path)),
                None,
            ),
        },
        HashInstruction::TsConfiguration(_) => Ok(changed
            .files
            .iter()
            .any(|f| ROOT_TSCONFIG_FILES.contains(&f.as_str()))),
        // Hashes the project's config object, which resolves to no files, so it
        // is matched on the config having changed rather than on a fileset. The
        // planner splices one of these per dependency, which is what carries a
        // dependency's config change to its consumers.
        HashInstruction::ProjectConfiguration(project) => {
            Ok(reconfigured.contains(project.as_str()))
        }
        HashInstruction::External(name) => Ok(externals.includes(name)),
        // Hashes every external node, so any one moving changes it.
        HashInstruction::AllExternalDependencies => Ok(externals.any()),
        // Not judgeable from a diff: runtime output, env, cwd and the snapshot
        // marker. Task outputs are carried by propagation instead.
        _ => Ok(false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::project_graph::types::Project;
    use crate::native::tasks::types::{InstructionPool, Task};
    use std::collections::HashMap;

    fn graph(roots: &[(&str, &str)]) -> ProjectGraph {
        ProjectGraph {
            nodes: roots
                .iter()
                .map(|(name, root)| {
                    (
                        name.to_string(),
                        Project {
                            root: root.to_string(),
                            ..Default::default()
                        },
                    )
                })
                .collect(),
            dependencies: HashMap::new(),
            external_nodes: HashMap::new(),
        }
    }

    fn strings(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    /// Builds a one-task plan from the given instructions.
    fn plans(task: &str, instructions: Vec<HashInstruction>) -> HashPlans {
        multi_plans(&[(task, instructions)])
    }

    fn multi_plans(entries: &[(&str, Vec<HashInstruction>)]) -> HashPlans {
        let pool = Arc::new(InstructionPool::new());
        HashPlans {
            plans: entries
                .iter()
                .map(|(task, instructions)| {
                    let ids = instructions
                        .iter()
                        .map(|i| pool.intern(i.clone()))
                        .collect();
                    (task.to_string(), ids)
                })
                .collect(),
            pool,
        }
    }

    fn task_graph(tasks: &[(&str, &[&str])], deps: &[(&str, &[&str])]) -> TaskGraph {
        TaskGraph {
            tasks: tasks
                .iter()
                .map(|(id, outputs)| {
                    (
                        id.to_string(),
                        Task {
                            id: id.to_string(),
                            outputs: strings(outputs),
                            ..Default::default()
                        },
                    )
                })
                .collect(),
            dependencies: deps
                .iter()
                .map(|(id, d)| (id.to_string(), strings(d)))
                .collect(),
            continuous_dependencies: HashMap::new(),
            roots: vec![],
        }
    }

    /// Rooted at the repository rather than this crate, so `packages/nx/...`
    /// paths stat the real files the deletion check asks about.
    fn options(seeds: &[&str]) -> AffectedTasksOptions {
        AffectedTasksOptions {
            project_glob_patterns: strings(&["**/project.json", "**/package.json"]),
            workspace_root: format!("{}/../..", env!("CARGO_MANIFEST_DIR")),
            seed_task_ids: strings(seeds),
            changed_externals: vec![],
            all_externals_changed: false,
        }
    }

    fn no_externals() -> ChangedExternals<'static> {
        ChangedExternals::new(&[], false)
    }

    fn touched_for(
        g: &ProjectGraph,
        instructions: Vec<HashInstruction>,
        changed: &[&str],
    ) -> Vec<String> {
        let p = plans("a:build", instructions);
        touched_tasks(g, &p, &strings(changed), &[], &no_externals()).unwrap()
    }

    fn touched_for_externals(
        instructions: Vec<HashInstruction>,
        moved: &[&str],
        all: bool,
    ) -> Vec<String> {
        let g = graph(&[("a", "libs/a")]);
        let p = plans("a:build", instructions);
        let moved = strings(moved);
        touched_tasks(&g, &p, &[], &[], &ChangedExternals::new(&moved, all)).unwrap()
    }

    // --- matching ---------------------------------------------------------------

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
        let instruction =
            HashInstruction::ProjectFileSet("a".into(), strings(&["libs/**/*.ts"]), false);
        assert_eq!(
            touched_for(&g, vec![instruction.clone()], &["libs/a/src/x.ts"]),
            vec!["a:build"]
        );
        assert!(touched_for(&g, vec![instruction], &["libs/b/src/x.ts"]).is_empty());
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
                    strings(&["libs/a/**/*.ts"]),
                    false
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
            touched_for_externals(plan(), &["npm:lodash"], false),
            vec!["a:build"]
        );
        assert!(touched_for_externals(plan(), &["npm:react"], false).is_empty());
        assert!(touched_for_externals(plan(), &[], false).is_empty());
    }

    #[test]
    fn all_external_dependencies_matches_when_any_package_moved() {
        let plan = || vec![HashInstruction::AllExternalDependencies];
        assert_eq!(
            touched_for_externals(plan(), &["npm:lodash"], false),
            vec!["a:build"]
        );
        assert!(touched_for_externals(plan(), &[], false).is_empty());
    }

    /// The locator could not say which packages moved, so every external counts,
    /// including one the change never named.
    #[test]
    fn every_external_counts_when_the_change_could_not_be_pinned() {
        assert_eq!(
            touched_for_externals(
                vec![HashInstruction::External("npm:react".into())],
                &[],
                true
            ),
            vec!["a:build"]
        );
        assert_eq!(
            touched_for_externals(vec![HashInstruction::AllExternalDependencies], &[], true),
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
                vec![HashInstruction::ProjectFileSet(
                    "a".into(),
                    strings(&["libs/a/generated/**/*.ts"]),
                    true
                )],
                &["libs/a/generated/api.ts"]
            ),
            vec!["a:build"]
        );
    }

    /// The hasher expands a disk-backed fileset workspace-wide and never reads
    /// the project off it, so matching it inside that project would under-select
    /// every read of another project's generated output.
    #[test]
    fn a_disk_backed_fileset_matches_outside_its_own_project() {
        let g = graph(&[("a", "libs/a"), ("b", "libs/b")]);
        assert_eq!(
            touched_for(
                &g,
                vec![HashInstruction::ProjectFileSet(
                    "a".into(),
                    strings(&["libs/b/generated/**/*.ts"]),
                    true
                )],
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

        let hit = touched_tasks(&g, &p, &config_a, &config_a, &no_externals()).unwrap();
        assert_eq!(hit, strings(&["consumer:build"]));

        // Another project's config leaves it alone.
        let miss = touched_tasks(&g, &p, &config_b, &config_b, &no_externals()).unwrap();
        assert!(miss.is_empty());

        // A source file in the same project is not a config change, so this
        // does not widen back out to project granularity.
        let source = touched_tasks(
            &g,
            &p,
            &strings(&["libs/a/src/index.ts"]),
            &[],
            &no_externals(),
        )
        .unwrap();
        assert!(source.is_empty());
    }

    /// `plans` is a HashMap, so the answer has to be sorted or it varies per run.
    #[test]
    fn the_touched_list_is_sorted() {
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
        };
        let touched = touched_tasks(&g, &p, &strings(&["x.txt"]), &[], &no_externals()).unwrap();
        assert_eq!(touched, strings(&["a:build", "m:build", "z:build"]));
    }

    // --- selection ---------------------------------------------------------------

    /// The config is matched here against the plugin globs, so the plan's
    /// ProjectConfiguration fires without TypeScript pre-computing the list.
    #[test]
    fn a_changed_project_config_reaches_its_consumers() {
        let g = graph(&[("a", "packages/nx"), ("b", "packages/js")]);
        let p = multi_plans(&[
            (
                "b:build",
                vec![HashInstruction::ProjectConfiguration("a".into())],
            ),
            ("c:build", vec![]),
        ]);
        let tg = task_graph(&[("b:build", &[]), ("c:build", &[])], &[]);
        let s = compute_affected_task_selection(
            &g,
            &p,
            &tg,
            &strings(&["packages/nx/package.json"]),
            &options(&[]),
        )
        .unwrap();
        assert_eq!(s.affected, strings(&["b:build"]));
        assert!(s.deleted_project_configs.is_empty());
    }

    /// The project a deleted config described is gone from the graph, so no
    /// surviving task has a fileset naming it. Everything is selected, and the
    /// file is reported so `--explain` can say why.
    #[test]
    fn a_deleted_project_config_selects_every_task() {
        let g = graph(&[("a", "packages/nx")]);
        let p = multi_plans(&[("a:build", vec![]), ("b:build", vec![])]);
        let tg = task_graph(&[("a:build", &[]), ("b:build", &[])], &[]);
        let deleted = "packages/nx/does-not-exist/project.json";
        let s = compute_affected_task_selection(&g, &p, &tg, &strings(&[deleted]), &options(&[]))
            .unwrap();
        assert_eq!(s.affected, strings(&["a:build", "b:build"]));
        assert_eq!(s.deleted_project_configs, strings(&[deleted]));
    }

    #[test]
    fn a_seed_selects_the_task_and_ignores_ids_outside_the_graph() {
        let g = graph(&[("a", "libs/a")]);
        let p = multi_plans(&[("a:build", vec![])]);
        let tg = task_graph(&[("a:build", &[])], &[]);
        let s =
            compute_affected_task_selection(&g, &p, &tg, &[], &options(&["a:build", "gone:build"]))
                .unwrap();
        assert_eq!(s.affected, strings(&["a:build"]));
    }

    /// A consumer reads its producer's outputs, so the producer's change reaches
    /// it through the walk, and the edge it crossed is reported.
    #[test]
    fn propagates_from_a_producer_to_the_task_reading_its_outputs() {
        let g = graph(&[("ui", "libs/ui"), ("app", "apps/app")]);
        let p = multi_plans(&[
            (
                "ui:build",
                vec![HashInstruction::ProjectFileSet(
                    "ui".into(),
                    strings(&["libs/ui/**/*"]),
                    false,
                )],
            ),
            (
                "app:build",
                vec![HashInstruction::TaskOutput(
                    "**/*.js".into(),
                    strings(&["dist/libs/ui"]),
                )],
            ),
            ("docs:build", vec![]),
        ]);
        let tg = task_graph(
            &[
                ("ui:build", &["dist/libs/ui"]),
                ("app:build", &["dist/app"]),
                ("docs:build", &["dist/docs"]),
            ],
            &[("app:build", &["ui:build"]), ("docs:build", &["ui:build"])],
        );
        let s = compute_affected_task_selection(
            &g,
            &p,
            &tg,
            &strings(&["libs/ui/src/index.ts"]),
            &options(&[]),
        )
        .unwrap();
        // docs:build depends on ui:build but never reads its outputs, so a
        // dependsOn edge alone does not carry affectedness.
        assert_eq!(s.affected, strings(&["app:build", "ui:build"]));
        assert_eq!(s.producers_of["app:build"], strings(&["ui:build"]));
        assert!(!s.producers_of.contains_key("ui:build"));
    }

    /// Settled in one pass because dependencies come first: a chain of three
    /// reaches the end without revisiting.
    #[test]
    fn propagates_along_a_chain() {
        let g = graph(&[("a", "libs/a")]);
        let p = multi_plans(&[
            (
                "a:build",
                vec![HashInstruction::ProjectFileSet(
                    "a".into(),
                    strings(&["libs/a/**/*"]),
                    false,
                )],
            ),
            (
                "b:build",
                vec![HashInstruction::TaskOutput(
                    "**".into(),
                    strings(&["dist/a"]),
                )],
            ),
            (
                "c:build",
                vec![HashInstruction::TaskOutput(
                    "**".into(),
                    strings(&["dist/b"]),
                )],
            ),
        ]);
        let tg = task_graph(
            &[
                ("a:build", &["dist/a"]),
                ("b:build", &["dist/b"]),
                ("c:build", &["dist/c"]),
            ],
            &[("b:build", &["a:build"]), ("c:build", &["b:build"])],
        );
        let s =
            compute_affected_task_selection(&g, &p, &tg, &strings(&["libs/a/x.ts"]), &options(&[]))
                .unwrap();
        assert_eq!(s.affected, strings(&["a:build", "b:build", "c:build"]));
        assert_eq!(s.producers_of["c:build"], strings(&["b:build"]));
    }

    /// The order is dependencies first, deterministic, and a cycle neither hangs
    /// nor drops the tasks in it.
    #[test]
    fn topological_order_puts_dependencies_first_and_survives_a_cycle() {
        let tg = task_graph(
            &[("a", &[]), ("b", &[]), ("c", &[]), ("x", &[]), ("y", &[])],
            &[("b", &["a"]), ("c", &["b"]), ("x", &["y"]), ("y", &["x"])],
        );
        let order = topological_order(&tg);
        let pos = |id: &str| order.iter().position(|o| *o == id).unwrap();
        assert!(pos("a") < pos("b") && pos("b") < pos("c"));
        assert_eq!(order.len(), 5, "the cycle's tasks are still present");
        assert_eq!(order, topological_order(&tg), "stable across runs");
    }
}
