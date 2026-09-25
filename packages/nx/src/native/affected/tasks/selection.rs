//! Decides which tasks a change affects: the tasks it touches directly, then
//! everything that reads their outputs, then what those need in order to run.

use napi::bindgen_prelude::*;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Arc;
use std::time::Instant;
use tracing::{debug, trace};

use super::dependency_closure::dependency_closure;
use super::dependent_outputs::compute_dependent_output_edges;
use super::touched::{ChangedExternals, touched_tasks};
use crate::native::glob::build_glob_set;
use crate::native::project_graph::types::ProjectGraph;
use crate::native::tasks::types::{HashPlans, TaskGraph};

#[napi(object)]
pub struct AffectedTasksOptions {
    /// `createNodes` globs of every loaded plugin. Resolved in TypeScript because
    /// `getPlugins` is async and spawns plugin workers.
    pub project_glob_patterns: Vec<String>,
    pub workspace_root: String,
    /// Tasks touched whatever their plan says: those of projects a dependency
    /// change names outright (`projectsAffectedByDependencyUpdates`, or a
    /// workspace project the root package.json depends on), and those whose
    /// executor hashes outside its plan. Ids not in the task graph are ignored.
    pub always_touched_task_ids: Vec<String>,
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

#[napi(object)]
pub struct AffectedTaskSelection {
    /// Every affected task, sorted.
    pub affected: Vec<String>,
    /// `affected` plus everything it depends on, sorted: what a run keeps.
    pub required: Vec<String>,
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
    let start = Instant::now();
    let (configs, deleted) = changed_project_configs(changed_files, options);

    // The project a deleted config described is gone, so no surviving task has
    // a fileset that names it and nothing narrower than everything is sound.
    let mut reached: Vec<String> = if deleted.is_empty() {
        reached_by_change(
            graph,
            hash_plans,
            task_graph,
            changed_files,
            &configs,
            options,
        )?
    } else {
        debug!("a project config was deleted, so every task is affected");
        task_graph.tasks.keys().cloned().collect()
    };
    reached.sort_unstable();

    let excluded: HashSet<&str> = options
        .excluded_projects
        .iter()
        .map(String::as_str)
        .collect();
    let affected: Vec<String> = reached
        .into_iter()
        .filter(|id| {
            task_graph.tasks.get(id).is_some_and(|task| {
                options.targets.contains(&task.target.target)
                    && !excluded.contains(task.target.project.as_str())
            })
        })
        .collect();

    let closure_start = Instant::now();
    let required = dependency_closure(task_graph, affected.iter().map(String::as_str));
    let closure_duration = closure_start.elapsed();

    debug!(
        "affected tasks selected in {:?} - {} changed files over {} tasks: {} affected, {} required ({:?})",
        start.elapsed(),
        changed_files.len(),
        task_graph.tasks.len(),
        affected.len(),
        required.len(),
        closure_duration
    );
    Ok(AffectedTaskSelection { affected, required })
}

/// The tasks a change touches directly, the always-touched ones, and every
/// task reading their outputs, before filtering to the requested targets.
fn reached_by_change(
    graph: &ProjectGraph,
    hash_plans: &HashPlans,
    task_graph: &TaskGraph,
    changed_files: &[String],
    configs: &[String],
    options: &AffectedTasksOptions,
) -> anyhow::Result<Vec<String>> {
    let touched_start = Instant::now();
    let externals = ChangedExternals::new(
        &options.changed_externals,
        &options.changed_external_types,
        &graph.external_nodes,
    );
    let mut touched = touched_tasks(graph, hash_plans, changed_files, configs, &externals)?;
    touched.extend(
        options
            .always_touched_task_ids
            .iter()
            .filter(|id| task_graph.tasks.contains_key(*id))
            .cloned(),
    );
    let touched_duration = touched_start.elapsed();

    let edges_start = Instant::now();
    let producers_of = compute_dependent_output_edges(hash_plans, task_graph);
    let edges_duration = edges_start.elapsed();

    let propagate_start = Instant::now();
    let reached = affected_through_output_reads(&touched, task_graph, &producers_of);
    debug!(
        "{} touched ({:?}), {} consumers of outputs ({:?}), {} reached ({:?})",
        touched.len(),
        touched_duration,
        producers_of.len(),
        edges_duration,
        reached.len(),
        propagate_start.elapsed()
    );
    Ok(reached)
}

/// Changed paths that are project configuration, split by whether the file is
/// still on disk. Raw rather than normalized, so the stat sees the path as
/// given, the way `projects_from_project_glob_changes` does.
fn changed_project_configs(
    changed_files: &[String],
    options: &AffectedTasksOptions,
) -> (Vec<String>, Vec<String>) {
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
                    trace!("ignoring unparseable plugin createNodes glob: {pattern}");
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

/// Carries affectedness from a producer to the tasks that read its outputs, never along
/// plain `dependsOn`. Reachability rather than an ordered pass, since continuous
/// dependencies and cycles defeat any fixed order.
fn affected_through_output_reads(
    touched: &HashSet<String>,
    task_graph: &TaskGraph,
    producers_of: &HashMap<String, Vec<String>>,
) -> Vec<String> {
    // Skip consumers outside the task graph so the walk never reaches them.
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

    affected.into_iter().map(str::to_string).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::tasks::types::HashInstruction;
    use crate::native::test_utils::{graph_of_roots as graph, hash_plans, strings, task_graph};

    /// Builds a one-task plan from the given instructions.
    fn plans(task: &str, instructions: Vec<HashInstruction>) -> HashPlans {
        hash_plans(&[(task, instructions)])
    }

    /// Rooted at the repository rather than this crate, so `packages/nx/...`
    /// paths stat the real files the deletion check asks about.
    fn options(always_touched: &[&str]) -> AffectedTasksOptions {
        AffectedTasksOptions {
            project_glob_patterns: strings(&["**/project.json", "**/package.json"]),
            workspace_root: format!("{}/../..", env!("CARGO_MANIFEST_DIR")),
            always_touched_task_ids: strings(always_touched),
            changed_externals: vec![],
            changed_external_types: vec![],
            excluded_projects: vec![],
            targets: strings(&["build", "serve", "e2e"]),
        }
    }

    /// A changed config is matched against the plugin globs here, so the plan's ProjectConfiguration fires.
    #[test]
    fn a_changed_project_config_reaches_its_consumers() {
        let g = graph(&[("a", "packages/nx"), ("b", "packages/js")]);
        let p = hash_plans(&[
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
        let p = hash_plans(&[("a:build", vec![]), ("b:build", vec![])]);
        let tg = task_graph(&[("a:build", &[]), ("b:build", &[])], &[]);
        let deleted = "packages/nx/does-not-exist/project.json";
        let s = compute_affected_task_selection(&g, &p, &tg, &strings(&[deleted]), &options(&[]))
            .unwrap();
        assert_eq!(s.affected, strings(&["a:build", "b:build"]));
    }

    #[test]
    fn an_always_touched_task_is_selected_and_ids_outside_the_graph_ignored() {
        let g = graph(&[("a", "libs/a")]);
        let p = hash_plans(&[("a:build", vec![])]);
        let tg = task_graph(&[("a:build", &[])], &[]);
        let s =
            compute_affected_task_selection(&g, &p, &tg, &[], &options(&["a:build", "gone:build"]))
                .unwrap();
        assert_eq!(s.affected, strings(&["a:build"]));
    }

    /// A consumer reads its producer's outputs, so the producer's change reaches it through the walk.
    #[test]
    fn propagates_from_a_producer_to_the_task_reading_its_outputs() {
        let g = graph(&[("ui", "libs/ui"), ("app", "apps/app")]);
        let p = hash_plans(&[
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
        let p = hash_plans(&[
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
        let p = hash_plans(&[
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
        let p = hash_plans(&[
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
        let p = hash_plans(&[
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
        let p = hash_plans(&[
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
        let p = hash_plans(&[("app:build", vec![reads_x()])]);
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
        let p = hash_plans(&[
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
        let p = hash_plans(&[
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
        let p = hash_plans(&[("app:build", vec![reads_x()])]);
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
        let p = hash_plans(&[("app:prebuild", vec![reads_x()]), ("app:build", vec![])]);
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
        let p = hash_plans(&[
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
