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

use crate::native::affected::dependent_outputs::{
    compute_dependent_output_edges, with_dependencies,
};
use crate::native::affected::plan_ids::referenced_ids;
use crate::native::affected::project_paths::{ProjectRoots, normalize_path};
use crate::native::glob::{build_glob_set, fileset_patterns};
use crate::native::project_graph::types::{ExternalNode, ProjectGraph};
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
    /// Ecosystems whose manifest changed without the change being pinnable to
    /// packages, `npm` for a lock file. Every node of that type counts as
    /// moved, and a node of any other type does not: a pnpm lock file cannot
    /// have moved a Maven artifact.
    pub changed_external_types: Vec<String>,
    /// Projects `--exclude` names. Their tasks are dropped from the selection
    /// after the walk, so they still carry a change to the tasks reading them.
    pub excluded_projects: Vec<String>,
    /// The targets the command asked for. The graph also holds what they depend
    /// on, which carries a change but is only ever run as a dependency.
    pub targets: Vec<String>,
}

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

    /// `AllExternalDependencies` hashes every node, so any moved external
    /// reaches it whatever its type.
    fn any(&self) -> bool {
        !self.names.is_empty() || !self.types.is_empty()
    }
}

#[napi(object)]
pub struct AffectedTaskSelection {
    /// Every affected task, sorted.
    pub affected: Vec<String>,
    /// `affected` plus everything it depends on, sorted: what a run keeps.
    pub required: Vec<String>,
}

pub(crate) const ROOT_TSCONFIG_FILES: [&str; 2] = ["tsconfig.base.json", "tsconfig.json"];

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

    let externals = ChangedExternals::new(
        &options.changed_externals,
        &options.changed_external_types,
        &graph.external_nodes,
    );
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
    let excluded: HashSet<&str> = options
        .excluded_projects
        .iter()
        .map(String::as_str)
        .collect();
    let affected: Vec<String> = affected_through_output_reads(&touched, task_graph, &producers_of)
        .into_iter()
        .filter(|id| {
            task_graph.tasks.get(id).is_some_and(|task| {
                options.targets.contains(&task.target.target)
                    && !excluded.contains(task.target.project.as_str())
            })
        })
        .collect();
    let required = with_dependencies(task_graph, affected.iter().map(String::as_str));

    Ok(AffectedTaskSelection { affected, required })
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
    // One set per plugin, so a glob one plugin cannot parse leaves the others'
    // configs detected.
    let globs: Vec<_> = options
        .project_glob_patterns
        .iter()
        .filter_map(
            |pattern| match build_glob_set(std::slice::from_ref(pattern)) {
                Ok(glob) => Some(glob),
                Err(_) => {
                    warn!("ignoring unparseable plugin createNodes glob: {pattern}");
                    None
                }
            },
        )
        .collect();
    let workspace_root = Path::new(&options.workspace_root);
    let mut configs = Vec::new();
    let mut deleted = Vec::new();
    for file in changed_files {
        if !globs.iter().any(|glob| glob.is_match(file)) {
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
/// follows data rather than the schedule.
///
/// Reachability over `producers_of` reversed, in O(V+E). Visiting in some
/// dependency order would settle a chain in one pass, but only while the order
/// respects every edge affectedness can travel: a continuous dependency is one
/// such edge and an ordering built from `dependencies` alone does not hold it,
/// and a cycle leaves any order arbitrary. Reaching outward from the touched
/// set needs no order, so neither can strand a consumer.
///
/// Returns the affected set, sorted.
fn affected_through_output_reads(
    touched: &HashSet<String>,
    task_graph: &TaskGraph,
    producers_of: &HashMap<String, Vec<String>>,
) -> Vec<String> {
    // A read by a task outside the graph is not an edge, as an unknown producer
    // was never one.
    let known = |id: &str| task_graph.tasks.contains_key(id);

    let mut consumers_of: HashMap<&str, Vec<&str>> = HashMap::new();
    for (consumer, producers) in producers_of {
        if !known(consumer) {
            continue;
        }
        for producer in producers {
            consumers_of
                .entry(producer.as_str())
                .or_default()
                .push(consumer.as_str());
        }
    }

    let mut affected: HashSet<&str> = touched.iter().map(String::as_str).collect();
    let mut stack: Vec<&str> = affected.iter().copied().collect();
    while let Some(current) = stack.pop() {
        for consumer in consumers_of.get(current).into_iter().flatten() {
            if affected.insert(consumer) {
                stack.push(consumer);
            }
        }
    }

    let mut affected: Vec<String> = affected.into_iter().map(str::to_string).collect();
    affected.sort_unstable();
    affected
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
        let glob = build_glob_set(&fileset_patterns(globs))?;
        Ok(candidates
            .iter()
            .any(|&index| glob.is_match(&changed.files[index])))
    };

    match instruction {
        HashInstruction::WorkspaceFileSet(file_sets) => {
            any_matching(&globs_from_workspace_globs(file_sets), None)
        }
        HashInstruction::ProjectFileSet(project, file_sets) => {
            any_matching(file_sets, Some(project))
        }
        // Unscoped: the globs carry no project and the hasher expands them
        // workspace-wide. A changed file is tracked by definition, so a match is
        // the tracked case; untracked paths are handled by propagation.
        HashInstruction::IgnoredFileSet(globs) => any_matching(globs, None),
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
    use crate::native::tasks::types::{InstructionPool, Task, TaskTarget};
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
            deferred: Default::default(),
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
                            target: TaskTarget {
                                project: id.split(':').next().unwrap().to_string(),
                                target: id.split(':').nth(1).unwrap_or_default().to_string(),
                                ..Default::default()
                            },
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
            changed_external_types: vec![],
            excluded_projects: vec![],
            targets: strings(&["build", "serve", "e2e"]),
        }
    }

    static NO_NODES: std::sync::LazyLock<HashMap<String, ExternalNode>> =
        std::sync::LazyLock::new(HashMap::new);

    fn no_externals() -> ChangedExternals<'static> {
        ChangedExternals::new(&[], &[], &NO_NODES)
    }

    /// Named external nodes with their ecosystem, so `type_of` can answer.
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
        touched_tasks(g, &p, &strings(changed), &[], &no_externals()).unwrap()
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
        touched_tasks(
            &g,
            &p,
            &[],
            &[],
            &ChangedExternals::new(&moved, &types, &g.external_nodes),
        )
        .unwrap()
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
    /// change leaves another ecosystem's nodes alone. This is what lets a plugin
    /// declare its own externals and have the declaration mean something.
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
            deferred: Default::default(),
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
    }

    /// One plugin's glob failing to parse must not switch config detection off
    /// for every other plugin.
    #[test]
    fn an_unparseable_plugin_glob_does_not_disable_the_others() {
        let g = graph(&[("a", "libs/a")]);
        let p = plans("a:build", vec![]);
        let tg = task_graph(&[("a:build", &[])], &[]);
        let options = AffectedTasksOptions {
            project_glob_patterns: strings(&["[bad", "**/project.json"]),
            ..options(&[])
        };
        let s = compute_affected_task_selection(
            &g,
            &p,
            &tg,
            &strings(&["libs/removed/project.json"]),
            &options,
        )
        .unwrap();
        assert_eq!(s.affected, strings(&["a:build"]));
    }

    /// The project a deleted config described is gone from the graph, so no
    /// surviving task has a fileset naming it, and everything is selected.
    #[test]
    fn a_deleted_project_config_selects_every_task() {
        let g = graph(&[("a", "packages/nx")]);
        let p = multi_plans(&[("a:build", vec![]), ("b:build", vec![])]);
        let tg = task_graph(&[("a:build", &[]), ("b:build", &[])], &[]);
        let deleted = "packages/nx/does-not-exist/project.json";
        let s = compute_affected_task_selection(&g, &p, &tg, &strings(&[deleted]), &options(&[]))
            .unwrap();
        assert_eq!(s.affected, strings(&["a:build", "b:build"]));
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
    }

    /// A chain of three: reachability carries the change to the end, whatever
    /// order the walk visits in.
    #[test]
    fn propagates_along_a_chain() {
        let g = graph(&[("a", "libs/a")]);
        let p = multi_plans(&[
            (
                "a:build",
                vec![HashInstruction::ProjectFileSet(
                    "a".into(),
                    strings(&["libs/a/**/*"]),
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
    }

    /// A served task's outputs are read across a continuous dependency, which is
    /// the only edge reaching the consumer. Propagation has to cross it: the e2e
    /// suite reads what the serve task builds, so a change under the library it
    /// serves must select it.
    #[test]
    fn propagates_across_a_continuous_only_edge() {
        let g = graph(&[
            ("lib", "libs/lib"),
            ("web", "apps/web"),
            ("e2e", "apps/e2e"),
        ]);
        let p = multi_plans(&[
            (
                "lib:build",
                vec![HashInstruction::ProjectFileSet(
                    "lib".into(),
                    strings(&["libs/lib/**/*"]),
                )],
            ),
            (
                "web:serve",
                vec![HashInstruction::TaskOutput(
                    "**".into(),
                    strings(&["dist/libs/lib"]),
                )],
            ),
            (
                "e2e:e2e",
                vec![HashInstruction::IgnoredFileSet(strings(&[
                    "dist/apps/web/**",
                ]))],
            ),
        ]);
        let mut tg = task_graph(
            &[
                ("lib:build", &["dist/libs/lib"]),
                ("web:serve", &["dist/apps/web"]),
                ("e2e:e2e", &[]),
            ],
            &[("web:serve", &["lib:build"])],
        );
        tg.continuous_dependencies
            .insert("e2e:e2e".into(), strings(&["web:serve"]));

        let s = compute_affected_task_selection(
            &g,
            &p,
            &tg,
            &strings(&["libs/lib/src/x.ts"]),
            &options(&[]),
        )
        .unwrap();

        assert_eq!(
            s.affected,
            strings(&["e2e:e2e", "lib:build", "web:serve"]),
            "the e2e suite reads the served outputs and must run"
        );
    }

    /// e2e serves web, and web reads ui's build through a declared read, with no
    /// `^default` splicing ui's files into e2e's plan. The planner carries ui's
    /// TaskOutput into e2e's plan through the served task, so a change under ui
    /// has to reach e2e.
    #[test]
    fn propagates_a_task_output_across_a_continuous_dependency() {
        let g = graph(&[("ui", "libs/ui"), ("web", "apps/web"), ("e2e", "apps/e2e")]);
        let p = multi_plans(&[
            (
                "ui:build",
                vec![HashInstruction::ProjectFileSet(
                    "ui".into(),
                    strings(&["libs/ui/**/*"]),
                )],
            ),
            (
                "web:serve",
                vec![HashInstruction::TaskOutput(
                    "**/*.js".into(),
                    strings(&["dist/libs/ui"]),
                )],
            ),
            (
                "e2e:e2e",
                vec![HashInstruction::TaskOutput(
                    "**/*.js".into(),
                    strings(&["dist/libs/ui"]),
                )],
            ),
        ]);
        let mut tg = task_graph(
            &[
                ("ui:build", &["dist/libs/ui"]),
                ("web:serve", &["dist/apps/web"]),
                ("e2e:e2e", &[]),
            ],
            &[("web:serve", &["ui:build"])],
        );
        tg.continuous_dependencies
            .insert("e2e:e2e".into(), strings(&["web:serve"]));

        let s = compute_affected_task_selection(
            &g,
            &p,
            &tg,
            &strings(&["libs/ui/src/x.ts"]),
            &options(&[]),
        )
        .unwrap();

        assert_eq!(
            s.affected,
            strings(&["e2e:e2e", "ui:build", "web:serve"]),
            "the suite exercising the changed library must run"
        );
    }

    /// Two serve tasks that continuously depend on each other. Affectedness is
    /// all-or-nothing across a cycle, so neither the tasks in it nor the suite
    /// reading through it may be stranded by the order they are visited in.
    #[test]
    fn a_continuous_cycle_stands_nobody_up() {
        let g = graph(&[
            ("lib", "libs/lib"),
            ("a", "apps/a"),
            ("b", "apps/b"),
            ("c", "apps/c"),
        ]);
        let p = multi_plans(&[
            (
                "lib:build",
                vec![HashInstruction::ProjectFileSet(
                    "lib".into(),
                    strings(&["libs/lib/**/*"]),
                )],
            ),
            (
                "a:serve",
                vec![HashInstruction::IgnoredFileSet(strings(&[
                    "dist/libs/lib/**",
                ]))],
            ),
            (
                "b:serve",
                vec![HashInstruction::IgnoredFileSet(strings(&[
                    "dist/apps/a/**",
                ]))],
            ),
            (
                "c:e2e",
                vec![HashInstruction::IgnoredFileSet(strings(&[
                    "dist/apps/b/**",
                ]))],
            ),
        ]);
        let mut tg = task_graph(
            &[
                ("lib:build", &["dist/libs/lib"]),
                ("a:serve", &["dist/apps/a"]),
                ("b:serve", &["dist/apps/b"]),
                ("c:e2e", &[]),
            ],
            &[("a:serve", &["lib:build"])],
        );
        tg.continuous_dependencies
            .insert("a:serve".into(), strings(&["b:serve"]));
        tg.continuous_dependencies
            .insert("b:serve".into(), strings(&["a:serve"]));
        tg.continuous_dependencies
            .insert("c:e2e".into(), strings(&["b:serve"]));

        let s = compute_affected_task_selection(
            &g,
            &p,
            &tg,
            &strings(&["libs/lib/src/x.ts"]),
            &options(&[]),
        )
        .unwrap();

        assert_eq!(
            s.affected,
            strings(&["a:serve", "b:serve", "c:e2e", "lib:build"]),
            "a cycle must not decide the answer by task name"
        );
    }

    /// A `dependsOn` cycle neither hangs nor drops the tasks in it, and the
    /// answer does not move between runs.
    #[test]
    fn a_dependency_cycle_neither_hangs_nor_drops_a_task() {
        let g = graph(&[("lib", "libs/lib"), ("x", "apps/x"), ("y", "apps/y")]);
        let p = multi_plans(&[
            (
                "lib:build",
                vec![HashInstruction::ProjectFileSet(
                    "lib".into(),
                    strings(&["libs/lib/**/*"]),
                )],
            ),
            (
                "x:build",
                vec![
                    HashInstruction::TaskOutput("**".into(), strings(&["dist/libs/lib"])),
                    HashInstruction::TaskOutput("**".into(), strings(&["dist/y"])),
                ],
            ),
            (
                "y:build",
                vec![HashInstruction::TaskOutput(
                    "**".into(),
                    strings(&["dist/x"]),
                )],
            ),
        ]);
        let tg = task_graph(
            &[
                ("lib:build", &["dist/libs/lib"]),
                ("x:build", &["dist/x"]),
                ("y:build", &["dist/y"]),
            ],
            &[
                ("x:build", &["lib:build", "y:build"]),
                ("y:build", &["x:build"]),
            ],
        );

        let run = || {
            compute_affected_task_selection(
                &g,
                &p,
                &tg,
                &strings(&["libs/lib/src/x.ts"]),
                &options(&[]),
            )
            .unwrap()
            .affected
        };

        assert_eq!(run(), strings(&["lib:build", "x:build", "y:build"]));
        assert_eq!(run(), run(), "stable across runs");
    }

    // --- what a run keeps ------------------------------------------------------

    fn select(
        tg: &TaskGraph,
        p: &HashPlans,
        options: &AffectedTasksOptions,
    ) -> AffectedTaskSelection {
        compute_affected_task_selection(
            &graph(&[("app", "apps/app"), ("lib", "libs/lib")]),
            p,
            tg,
            &strings(&["x.txt"]),
            options,
        )
        .unwrap()
    }

    fn reads_x() -> HashInstruction {
        HashInstruction::WorkspaceFileSet(strings(&["{workspaceRoot}/x.txt"]))
    }

    /// An affected task still needs its upstream to run or restore from cache.
    #[test]
    fn required_adds_everything_an_affected_task_depends_on() {
        let p = multi_plans(&[("app:build", vec![reads_x()])]);
        let mut tg = task_graph(
            &[
                ("app:build", &[]),
                ("app:serve", &[]),
                ("api:serve", &[]),
                ("lib:build", &[]),
                ("util:build", &[]),
                ("other:build", &[]),
            ],
            &[
                ("app:build", &["lib:build"]),
                ("lib:build", &["util:build"]),
            ],
        );
        tg.continuous_dependencies
            .insert("app:build".into(), strings(&["api:serve"]));

        let s = select(&tg, &p, &options(&[]));

        assert_eq!(s.affected, strings(&["app:build"]));
        assert_eq!(
            s.required,
            strings(&["api:serve", "app:build", "lib:build", "util:build"])
        );
    }

    /// An excluded task is dropped from the selection, but a kept task that
    /// depends on it still gets it.
    #[test]
    fn an_excluded_project_is_kept_only_as_a_dependency() {
        let p = multi_plans(&[
            ("app:build", vec![reads_x()]),
            ("lib:build", vec![reads_x()]),
            ("other:build", vec![reads_x()]),
        ]);
        let tg = task_graph(
            &[("app:build", &[]), ("lib:build", &[]), ("other:build", &[])],
            &[("app:build", &["lib:build"])],
        );
        let options = AffectedTasksOptions {
            excluded_projects: strings(&["lib", "other"]),
            ..options(&[])
        };

        let s = select(&tg, &p, &options);

        assert_eq!(s.affected, strings(&["app:build"]));
        assert_eq!(s.required, strings(&["app:build", "lib:build"]));
    }

    /// Exclusion narrows what is selected, not what a change reaches.
    #[test]
    fn an_excluded_producer_still_affects_its_readers() {
        let p = multi_plans(&[
            ("lib:build", vec![reads_x()]),
            (
                "app:build",
                vec![HashInstruction::IgnoredFileSet(strings(&[
                    "dist/libs/lib/**",
                ]))],
            ),
        ]);
        let tg = task_graph(
            &[("lib:build", &["dist/libs/lib"]), ("app:build", &[])],
            &[("app:build", &["lib:build"])],
        );
        let options = AffectedTasksOptions {
            excluded_projects: strings(&["lib"]),
            ..options(&[])
        };

        let s = select(&tg, &p, &options);

        assert_eq!(s.affected, strings(&["app:build"]));
        assert_eq!(s.required, strings(&["app:build", "lib:build"]));
    }

    #[test]
    fn required_survives_a_dependency_cycle() {
        let p = multi_plans(&[("app:build", vec![reads_x()])]);
        let tg = task_graph(
            &[("app:build", &[]), ("lib:build", &[])],
            &[("app:build", &["lib:build"]), ("lib:build", &["app:build"])],
        );

        let s = select(&tg, &p, &options(&[]));

        assert_eq!(s.required, strings(&["app:build", "lib:build"]));
    }

    /// A dependency the command did not ask for is planned so a change can
    /// travel through it, but is not itself a result.
    #[test]
    fn a_dependency_only_target_is_not_reported_affected() {
        let p = multi_plans(&[("app:prebuild", vec![reads_x()]), ("app:build", vec![])]);
        let tg = task_graph(
            &[("app:prebuild", &["dist/gen"]), ("app:build", &[])],
            &[("app:build", &["app:prebuild"])],
        );
        let options = AffectedTasksOptions {
            targets: strings(&["build"]),
            ..options(&[])
        };

        let s = select(&tg, &p, &options);

        assert!(s.affected.is_empty());
        assert!(s.required.is_empty());
    }

    #[test]
    fn a_change_still_travels_through_a_dependency_only_target() {
        let p = multi_plans(&[
            ("app:prebuild", vec![reads_x()]),
            (
                "app:build",
                vec![HashInstruction::IgnoredFileSet(strings(&["dist/gen/**"]))],
            ),
        ]);
        let tg = task_graph(
            &[("app:prebuild", &["dist/gen"]), ("app:build", &[])],
            &[("app:build", &["app:prebuild"])],
        );
        let options = AffectedTasksOptions {
            targets: strings(&["build"]),
            ..options(&[])
        };

        let s = select(&tg, &p, &options);

        assert_eq!(s.affected, strings(&["app:build"]));
        assert_eq!(s.required, strings(&["app:build", "app:prebuild"]));
    }
}
