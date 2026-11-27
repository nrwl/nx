use crate::native::glob::{NxGlobSet, NxGlobSetBuilder};
use crate::native::tasks::plan::{Plan, PlanBuilder, kind};
use crate::native::tasks::recorded_globs::RecordedGlobs;
use crate::native::tasks::types::{HashInstruction, InstructionPool, Task, TaskGraph};
use crate::native::tasks::ultracache_eligibility::{self, UltracacheTask};
use crate::native::types::Input;
use std::sync::OnceLock;

use super::deferral::{upstream_output_roots, walk_root};
use super::inputs::FileSetStore;
use super::{HashPlanner, ROOT_TSCONFIG_FILES};

/// Ids a plan keeps even when a configuration replaces its declared files: those of
/// `always` inputs. Only `replace_with_configuration` reads them, so a plan no
/// configuration replaces skips collecting them.
pub(super) struct AlwaysIds(Option<PlanBuilder>);

impl AlwaysIds {
    pub(super) fn collecting(collect: bool) -> Self {
        Self(collect.then(PlanBuilder::default))
    }

    pub(super) fn extend(&mut self, ids: impl IntoIterator<Item = u32>) {
        if let Some(set) = &mut self.0 {
            set.ids(ids);
        }
    }

    pub(super) fn include(&mut self, plan: &Plan) {
        if let Some(set) = &mut self.0 {
            set.include(plan.clone());
        }
    }

    pub(super) fn is_collecting(&self) -> bool {
        self.0.is_some()
    }

    fn finish(self, pool: &InstructionPool) -> Plan {
        self.0.map(|s| s.finish(pool)).unwrap_or_default()
    }
}

/// A task's Ultracache configuration plus a matcher over its observed reads,
/// used to decide whether a class-mapped file (root tsconfig, a declared
/// `{json}` file) was actually read. An unparsable glob keeps the native
/// instruction (conservative).
pub(super) struct UltracacheContext<'a> {
    entry: &'a UltracacheTask,
    /// Construct the original combined matcher only when an exact recorded path
    /// cannot answer the query. Errors conservatively keep class-mapped inputs.
    observed: OnceLock<Result<Option<NxGlobSet>, ()>>,
}

impl<'a> UltracacheContext<'a> {
    pub(super) fn new(entry: &'a UltracacheTask) -> Self {
        Self {
            entry,
            observed: OnceLock::new(),
        }
    }

    fn literal(&self, path: &str) -> bool {
        ultracache_eligibility::is_literal_path(path)
            && !path.starts_with('!')
            && self
                .entry
                .files
                .binary_search_by(|&id| self.entry.dictionary[id as usize].as_ref().cmp(path))
                .is_ok()
    }

    fn read(&self, path: &str) -> bool {
        self.literal(path)
            || match self.observed.get_or_init(|| {
                let patterns: Vec<_> = self
                    .entry
                    .files
                    .iter()
                    .map(|&id| &self.entry.dictionary[id as usize])
                    .filter(|g| !g.starts_with('!') && !ultracache_eligibility::is_literal_path(g))
                    .collect();
                if patterns.is_empty() {
                    return Ok(None);
                }
                NxGlobSetBuilder::new(&patterns)
                    .and_then(|b| b.build(None))
                    .map(Some)
                    .map_err(|_| ())
            }) {
                Ok(Some(set)) => set.is_match(path),
                Ok(None) => false,
                Err(()) => true,
            }
    }
}

impl HashPlanner {
    /// Observed reads minus natively covered files, one group per owning
    /// project and one for the reads no project owns, plus the entry digest.
    /// A group is disk-backed, and unowned reads join the `.` project's group,
    /// else the task's. With `includeUnstableFiles: false` it is an ordinary
    /// fileset instead. Declared filesets, negations included, never shape
    /// the groups.
    /// Replaces the declared filesets in `ids` (self, deps, `{input, projects}`)
    /// with `task`'s observed reads; TsConfiguration and JSON inputs survive
    /// only if read. `always` is kept, and added where the configuration path never
    /// gathered it (the task's own filesets). With `includeUnstableFiles: false`
    /// the reads are ordinary filesets of tracked files, so declared
    /// `includeIgnored` filesets are kept too.
    pub(super) fn replace_with_configuration(
        &self,
        task: &Task,
        task_graph: &TaskGraph,
        context: &UltracacheContext,
        globs: &RecordedGlobs,
        plan: Plan,
        always_on_id: u32,
        always: AlwaysIds,
    ) -> PlanBuilder {
        let pool = &self.instruction_pool;
        let keep_tsconfig = globs
            .reads_root_tsconfig(context.entry)
            .unwrap_or_else(|| ROOT_TSCONFIG_FILES.iter().any(|p| context.read(p)));
        let include_unstable = task
            .ultracache
            .as_ref()
            .and_then(|ultracache| ultracache.include_unstable_files)
            .unwrap_or(true);
        // Files under node_modules that no external hashes: upstream outputs,
        // and what a declared `includeIgnored` group walks into there. None
        // of them is tracked.
        let mut not_installed = Vec::new();
        if include_unstable && globs.needs_output_roots(context.entry) {
            not_installed = upstream_output_roots(task_graph, &task.id);
            for id in plan.only(kind::DECLARED_DISK).ids().iter() {
                if let HashInstruction::IgnoredFileSet { globs, .. } = &*pool.get(*id) {
                    not_installed.extend(
                        globs
                            .iter()
                            .filter(|glob| !glob.starts_with('!'))
                            .map(|glob| walk_root(glob))
                            .filter(|root| {
                                root.split('/').any(|segment| segment == "node_modules")
                            }),
                    );
                }
            }
            not_installed.sort_unstable();
        }
        let mut retained = kind::OTHER | kind::ALWAYS_DEFERRED;
        if keep_tsconfig {
            retained |= kind::TS;
        }
        if !include_unstable {
            retained |= kind::DECLARED_DISK;
        }
        let mut result = PlanBuilder::default();
        result.include(plan.only(retained));
        result.include(always.finish(pool));
        result.ids(plan.only(kind::JSON).ids().iter().copied().filter(|&id| {
            !pool.replaced_by_configuration(id, keep_tsconfig, |path| context.read(path))
        }));
        result.ids([always_on_id]);
        let unowned = self
            .workspace_root_project
            .get_or_init(|| {
                self.project_graph
                    .nodes
                    .iter()
                    .find(|(_, p)| p.root == ".")
                    .map(|(name, _)| name.clone())
            })
            .as_deref()
            .unwrap_or(&task.target.project);
        result.ids(globs.instructions(
            pool,
            context.entry,
            unowned,
            &not_installed,
            include_unstable,
        ));
        result
    }
}

/// Drops groups from the Ultracache configuration that a declared group in
/// the same plan already hashes, so the files are walked once.
pub(super) fn drop_ultracache_duplicates(pool: &InstructionPool, plan: Plan) -> Plan {
    if !plan.has(kind::DECLARED_DISK) || !plan.has(kind::RECORDED_DISK) {
        return plan;
    }
    let disk = plan.only(kind::DECLARED_DISK);
    let declared = OnceLock::new();
    let mut result = PlanBuilder::default();
    result.include(plan.only(!kind::RECORDED_DISK));
    result.ids(
        plan.only(kind::RECORDED_DISK)
            .ids()
            .iter()
            .copied()
            .filter(|&id| {
                let other = match pool.get(id).value() {
                    HashInstruction::IgnoredFileSet {
                        globs,
                        project_roots,
                        ..
                    } => HashInstruction::IgnoredFileSet {
                        globs: globs.clone(),
                        project_roots: project_roots.clone(),
                        from_ultracache: false,
                    },
                    _ => unreachable!(),
                };
                pool.id_of(&other).is_none_or(|id| {
                    declared
                        .get_or_init(|| disk.ids())
                        .binary_search(&id)
                        .is_err()
                })
            }),
    );
    result.finish(pool)
}

/// The inputs `always` keeps, as they hash without a recording. A negation
/// trims its store's positives, so it goes with a marked one; a store with no
/// positive selects every other file and goes whole once any entry is marked.
pub(super) fn retained_inputs<'a>(inputs: &[Input<'a>]) -> Vec<Input<'a>> {
    if !inputs.iter().any(Input::always) {
        return vec![];
    }
    let file_sets = || {
        inputs.iter().filter_map(|input| match input {
            Input::FileSet {
                fileset,
                include_ignored,
                always,
                ..
            } => Some((
                FileSetStore::of(fileset, *include_ignored),
                fileset.starts_with('!'),
                *always,
            )),
            _ => None,
        })
    };
    let positive_stores: Vec<FileSetStore> = file_sets()
        .filter(|(_, negation, _)| !negation)
        .map(|(store, ..)| store)
        .collect();
    let stores_keeping_negations: Vec<FileSetStore> = file_sets()
        .filter(|(store, negation, always)| {
            *always && (!negation || !positive_stores.contains(store))
        })
        .map(|(store, ..)| store)
        .collect();
    inputs
        .iter()
        .filter(|input| match input {
            Input::FileSet {
                fileset,
                include_ignored,
                ..
            } if fileset.starts_with('!') => {
                stores_keeping_negations.contains(&FileSetStore::of(fileset, *include_ignored))
            }
            input => input.always(),
        })
        .cloned()
        .collect()
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod always_tests {
    use super::*;
    use crate::native::project_graph::types::{Project, ProjectGraph, Target};
    use crate::native::test_utils::{
        excluding_unstable_files, including_unstable_files, task_graph, ultracache_configurations,
    };
    use crate::native::types::{
        DepsOutputsInput, FileSetInput, InputsInput, JsInputs, JsonInput, NxJson,
    };
    use napi::Either;
    use napi::bindgen_prelude::{Either9, External};
    use std::collections::HashMap;
    use std::sync::Arc;

    #[test]
    fn a_configuration_group_a_declared_group_matches_is_dropped() {
        let pool = InstructionPool::new();
        let group = |globs: &[&str], from_ultracache| HashInstruction::IgnoredFileSet {
            globs: globs.iter().map(|glob| Arc::from(*glob)).collect(),
            project_roots: vec!["libs/app".into()],
            from_ultracache,
        };
        let declared = pool.intern(group(&["libs/app/fixtures/**"], false));
        let duplicate = pool.intern(group(&["libs/app/fixtures/**"], true));
        let other = pool.intern(group(&["libs/app/src/**"], true));
        let ids = Plan::from_ids([declared, duplicate, other], &pool);
        let deduped = drop_ultracache_duplicates(&pool, ids);
        assert_eq!(&*deduped.ids(), &[declared, other]);
    }

    fn named(input: &str, dependencies: bool, always: bool) -> JsInputs {
        Either9::A(InputsInput {
            input: input.into(),
            dependencies: Some(dependencies),
            projects: None,
            always: Some(always),
        })
    }

    fn selected(projects: &[&str], always: bool) -> JsInputs {
        Either9::A(InputsInput {
            input: "default".into(),
            dependencies: None,
            projects: Some(Either::B(projects.iter().map(|p| p.to_string()).collect())),
            always: Some(always),
        })
    }

    fn selected_dependencies(projects: &[&str], always: bool) -> JsInputs {
        Either9::A(InputsInput {
            input: "default".into(),
            dependencies: Some(true),
            projects: Some(Either::B(projects.iter().map(|p| p.to_string()).collect())),
            always: Some(always),
        })
    }

    fn fileset(fileset: &str, always: bool) -> JsInputs {
        Either9::C(FileSetInput {
            fileset: fileset.into(),
            dependencies: None,
            include_ignored: None,
            always: Some(always),
        })
    }

    fn ignored_fileset(fileset: &str, dependencies: bool, always: bool) -> JsInputs {
        Either9::C(FileSetInput {
            fileset: fileset.into(),
            dependencies: Some(dependencies),
            include_ignored: Some(true),
            always: Some(always),
        })
    }

    /// `targets` maps a task id to its inputs; every project lives at
    /// `libs/<name>`.
    fn planner(targets: Vec<(&str, Vec<JsInputs>)>, edges: &[(&str, &[&str])]) -> HashPlanner {
        let mut nodes: HashMap<String, Project> = HashMap::new();
        for name in ["e2e", "e2e-plain", "app", "feature", "feature2"] {
            nodes.insert(
                name.into(),
                Project {
                    root: format!("libs/{name}"),
                    ..Default::default()
                },
            );
        }
        for (id, inputs) in targets {
            let (project, target) = id.split_once(':').unwrap();
            nodes.get_mut(project).unwrap().targets.insert(
                target.into(),
                Target {
                    inputs: Some(inputs),
                    ..Default::default()
                },
            );
        }
        let mut dependencies: HashMap<String, Vec<String>> =
            nodes.keys().map(|name| (name.clone(), vec![])).collect();
        for (project, deps) in edges {
            dependencies
                .get_mut(*project)
                .unwrap()
                .extend(deps.iter().map(|d| d.to_string()));
        }
        HashPlanner::new(
            NxJson { named_inputs: None },
            &External::new(Arc::new(ProjectGraph {
                nodes,
                dependencies,
                external_nodes: HashMap::new(),
            })),
        )
    }

    /// The fileset a recording that read only `e2e`'s spec adds to a plan.
    fn recorded_spec_read(instruction: &HashInstruction) -> bool {
        matches!(instruction, HashInstruction::ProjectFileSet(project, globs)
            if project == "e2e" && globs == &["libs/e2e/src/app.spec.ts".to_string()])
    }

    /// The projects whose declared files each task's plan hashes, with the
    /// e2e tasks hashed from a recording that read only their own spec.
    fn hashed_projects(
        planner: &HashPlanner,
        task_ids: &[&str],
        with_configurations: bool,
    ) -> anyhow::Result<HashMap<String, Vec<String>>> {
        let ids: Vec<(&str, &[&str])> = task_ids.iter().map(|id| (*id, &[][..])).collect();
        let graph = task_graph(&ids, &[]);
        let (_dir, configurations) = ultracache_configurations(
            &task_ids
                .iter()
                .map(|id| (*id, &["libs/e2e/src/app.spec.ts"][..]))
                .collect::<Vec<_>>(),
        );
        let plans = planner.get_plans_internal(
            task_ids.to_vec(),
            graph,
            with_configurations.then_some(&configurations),
            &[],
        )?;
        Ok(plans
            .plans
            .iter()
            .map(|(task, ids)| {
                let mut projects: Vec<String> = ids
                    .ids()
                    .iter()
                    .filter_map(|id| match plans.pool.get(*id).value() {
                        instruction if recorded_spec_read(instruction) => None,
                        HashInstruction::ProjectFileSet(project, _) => Some(project.clone()),
                        _ => None,
                    })
                    .collect();
                projects.sort();
                projects.dedup();
                (task.clone(), projects)
            })
            .collect())
    }

    fn e2e_projects(planner: HashPlanner, with_configurations: bool) -> Vec<String> {
        hashed_projects(&planner, &["e2e:e2e"], with_configurations).unwrap()["e2e:e2e"].clone()
    }

    /// `e2e:e2e`'s plan, hashed from a recording that read only its spec,
    /// without the fileset for that read.
    fn recorded_e2e_plan(planner: &HashPlanner) -> Vec<HashInstruction> {
        recorded_e2e_plan_reading(planner, &["libs/e2e/src/app.spec.ts"])
            .into_iter()
            .filter(|instruction| !recorded_spec_read(instruction))
            .collect()
    }

    fn recorded_e2e_plan_reading(planner: &HashPlanner, reads: &[&str]) -> Vec<HashInstruction> {
        recorded_e2e_plan_in(planner, reads, task_graph(&[("e2e:e2e", &[])], &[]))
    }

    fn recorded_e2e_plan_in(
        planner: &HashPlanner,
        reads: &[&str],
        graph: TaskGraph,
    ) -> Vec<HashInstruction> {
        let (_dir, configurations) = ultracache_configurations(&[("e2e:e2e", reads)]);
        let plans = planner
            .get_plans_internal(vec!["e2e:e2e"], graph, Some(&configurations), &[])
            .unwrap();
        plans.plans["e2e:e2e"]
            .ids()
            .iter()
            .map(|id| plans.pool.get(*id).value().clone())
            .collect()
    }

    #[test]
    fn a_recording_replaces_declared_project_selections_unless_always() {
        let plan = |always| {
            e2e_projects(
                planner(vec![("e2e:e2e", vec![selected(&["feature"], always)])], &[]),
                true,
            )
        };
        assert_eq!(plan(false), Vec::<String>::new());
        assert_eq!(plan(true), vec!["feature".to_string()]);
    }

    #[test]
    fn always_does_not_change_a_plan_hashed_without_a_recording() {
        let plan = |always| {
            let planner = planner(
                vec![(
                    "e2e:e2e",
                    vec![
                        fileset("{projectRoot}/**/*", always),
                        named("default", true, always),
                        selected(&["feature2"], always),
                        ignored_fileset("{projectRoot}/dist/**", false, false),
                        ignored_fileset("!{projectRoot}/dist/**/*.map", false, always),
                    ],
                )],
                &[("e2e", &["feature"])],
            );
            let graph = task_graph(&[("e2e:e2e", &[])], &[]);
            let plans = planner
                .get_plans_internal(vec!["e2e:e2e"], graph, None, &[])
                .unwrap();
            let mut keys: Vec<String> = plans.plans["e2e:e2e"]
                .ids()
                .iter()
                .map(|id| plans.pool.get(*id).to_string())
                .collect();
            keys.sort();
            keys
        };
        assert_eq!(plan(true), plan(false));
    }

    #[test]
    fn keeps_an_always_dependency_input_and_its_closure() {
        let plan = |always| {
            e2e_projects(
                planner(
                    vec![("e2e:e2e", vec![named("default", true, always)])],
                    &[("e2e", &["app"]), ("app", &["feature"])],
                ),
                true,
            )
        };
        assert_eq!(plan(false), Vec::<String>::new());
        assert_eq!(plan(true), vec!["app".to_string(), "feature".to_string()]);
    }

    #[test]
    fn keeps_the_tasks_own_always_fileset() {
        let plan = |always| {
            e2e_projects(
                planner(
                    vec![(
                        "e2e:e2e",
                        vec![
                            fileset("{projectRoot}/**/*", false),
                            fileset("{projectRoot}/fixtures/**", always),
                        ],
                    )],
                    &[],
                ),
                true,
            )
        };
        assert_eq!(plan(false), Vec::<String>::new());
        assert_eq!(plan(true), vec!["e2e".to_string()]);
    }

    #[test]
    fn keeps_the_negations_that_trim_an_always_fileset() {
        let planner = planner(
            vec![(
                "e2e:e2e",
                vec![
                    fileset("{projectRoot}/**/*", false),
                    fileset("{projectRoot}/fixtures/**", true),
                    fileset("!{projectRoot}/fixtures/large/**", false),
                    fileset("!{workspaceRoot}/docs/**", false),
                ],
            )],
            &[],
        );
        let declared: Vec<HashInstruction> = recorded_e2e_plan(&planner)
            .into_iter()
            .filter(|instruction| {
                matches!(instruction, HashInstruction::ProjectFileSet(..))
                    || matches!(instruction, HashInstruction::WorkspaceFileSet(globs)
                        if globs.iter().any(|glob| glob.contains("docs")))
            })
            .collect();
        assert_eq!(
            declared,
            vec![HashInstruction::ProjectFileSet(
                "e2e".into(),
                vec![
                    "libs/e2e/fixtures/**".into(),
                    "!libs/e2e/fixtures/large/**".into()
                ]
            )]
        );
    }

    #[test]
    fn keeps_a_marked_negation_only_where_it_selects_files() {
        let declared = |inputs: Vec<JsInputs>| -> Vec<HashInstruction> {
            recorded_e2e_plan(&planner(vec![("e2e:e2e", inputs)], &[]))
                .into_iter()
                .filter(|instruction| matches!(instruction, HashInstruction::ProjectFileSet(..)))
                .collect()
        };
        // Next to a positive, a negation only trims it.
        assert_eq!(
            declared(vec![
                fileset("{projectRoot}/**/*", false),
                fileset("!{projectRoot}/**/*.map", true),
            ]),
            vec![]
        );
        // Without one, its store selects every other file.
        assert_eq!(
            declared(vec![
                fileset("!{projectRoot}/**/*.map", true),
                fileset("!{projectRoot}/tmp/**", false),
            ]),
            vec![HashInstruction::ProjectFileSet(
                "e2e".into(),
                vec!["!libs/e2e/**/*.map".into(), "!libs/e2e/tmp/**".into()]
            )]
        );
    }

    #[test]
    fn a_recorded_group_an_always_fileset_matches_is_planned_once() {
        let planner = planner(
            vec![(
                "e2e:e2e",
                vec![ignored_fileset(
                    "{projectRoot}/fixtures/a.json",
                    false,
                    true,
                )],
            )],
            &[],
        );
        let groups: Vec<bool> = recorded_e2e_plan_reading(&planner, &["libs/e2e/fixtures/a.json"])
            .into_iter()
            .filter_map(|instruction| match instruction {
                HashInstruction::IgnoredFileSet {
                    globs,
                    from_ultracache,
                    ..
                } if globs
                    .iter()
                    .any(|glob| &**glob == "libs/e2e/fixtures/a.json") =>
                {
                    Some(from_ultracache)
                }
                _ => None,
            })
            .collect();
        assert_eq!(groups, vec![false]);
    }

    #[test]
    fn a_recording_is_an_ordinary_fileset_when_the_target_excludes_unstable_files() {
        let planner = planner(
            vec![(
                "e2e:e2e",
                vec![ignored_fileset("{projectRoot}/generated/**", false, false)],
            )],
            &[],
        );
        let filesets = |graph: TaskGraph| -> Vec<HashInstruction> {
            recorded_e2e_plan_in(
                &planner,
                &["libs/e2e/src/app.spec.ts", "tools/setup.ts"],
                graph,
            )
            .into_iter()
            .filter(|instruction| {
                matches!(
                    instruction,
                    HashInstruction::IgnoredFileSet { .. } | HashInstruction::ProjectFileSet(..)
                ) || matches!(instruction, HashInstruction::WorkspaceFileSet(globs)
                    if globs.iter().any(|glob| glob.contains("tools")))
            })
            .collect()
        };
        let sorted = |mut instructions: Vec<HashInstruction>| {
            instructions.sort();
            instructions
        };
        let graph = || task_graph(&[("e2e:e2e", &[])], &[]);
        let disk = |glob: &str, from_ultracache: bool| HashInstruction::IgnoredFileSet {
            globs: vec![glob.into()].into(),
            project_roots: vec!["libs/e2e".into()],
            from_ultracache,
        };
        // A read no project owns is a workspace fileset. The declared
        // `includeIgnored` fileset stays: no read hashes an ignored file.
        assert_eq!(
            sorted(filesets(excluding_unstable_files(graph()))),
            sorted(vec![
                HashInstruction::WorkspaceFileSet(vec!["{workspaceRoot}/tools/setup.ts".into()]),
                HashInstruction::ProjectFileSet(
                    "e2e".into(),
                    vec!["libs/e2e/src/app.spec.ts".into()]
                ),
                disk("libs/e2e/generated/**", false),
            ])
        );
        let unstable = filesets(graph());
        assert!(unstable.iter().all(|instruction| matches!(
            instruction,
            HashInstruction::IgnoredFileSet {
                from_ultracache: true,
                ..
            }
        )));
        assert_eq!(unstable.len(), 1);
    }

    #[test]
    fn a_recorded_exclusion_stays_in_the_fileset_of_the_reads_it_trims() {
        let planner = planner(vec![("e2e:e2e", vec![])], &[]);
        let recorded: Vec<HashInstruction> = recorded_e2e_plan_in(
            &planner,
            &["libs/e2e/**/*.ts", "!libs/e2e/src/**/*.ts"],
            excluding_unstable_files(task_graph(&[("e2e:e2e", &[])], &[])),
        )
        .into_iter()
        .filter(|instruction| matches!(instruction, HashInstruction::ProjectFileSet(..)))
        .collect();
        assert_eq!(
            recorded,
            vec![HashInstruction::ProjectFileSet(
                "e2e".into(),
                vec!["libs/e2e/**/*.ts".into(), "!libs/e2e/src/**/*.ts".into()]
            )]
        );
    }

    #[test]
    fn a_recorded_read_of_an_upstream_output_does_not_defer_the_task() {
        let planner = planner(vec![("e2e:e2e", vec![])], &[("e2e", &["app"])]);
        // `app:build` declares a committed file as its output.
        let graph = excluding_unstable_files(task_graph(
            &[
                ("e2e:e2e", &[]),
                ("app:build", &["libs/app/src/generated.d.ts"]),
            ],
            &[("e2e:e2e", &["app:build"])],
        ));
        let (_dir, configurations) =
            ultracache_configurations(&[("e2e:e2e", &["libs/app/src/generated.d.ts"])]);
        let plans = planner
            .get_plans_internal(vec!["e2e:e2e"], graph, Some(&configurations), &[])
            .unwrap();
        // Hashed up front from the file map: only a declared
        // `dependentTasksOutputFiles` input waits for the producer.
        assert!(!plans.deferred.contains("e2e:e2e"));
        assert!(plans.plans["e2e:e2e"].ids().iter().any(|id| matches!(
            plans.pool.get(*id).value(),
            HashInstruction::ProjectFileSet(project, globs)
                if project == "app" && globs == &["libs/app/src/generated.d.ts".to_string()]
        )));
    }

    #[test]
    fn keeps_only_the_marked_part_of_a_dependency_include_ignored_group() {
        let retained = |fixtures: bool, exclusion: bool| -> Vec<HashInstruction> {
            let planner = planner(
                vec![(
                    "e2e:e2e",
                    vec![
                        ignored_fileset("{projectRoot}/fixtures/**", true, fixtures),
                        ignored_fileset("{projectRoot}/generated/**", true, false),
                        ignored_fileset("!{projectRoot}/fixtures/large/**", true, exclusion),
                    ],
                )],
                &[("e2e", &["app"])],
            );
            recorded_e2e_plan_in(
                &planner,
                &["libs/e2e/src/app.spec.ts"],
                including_unstable_files(task_graph(&[("e2e:e2e", &[])], &[])),
            )
            .into_iter()
            .filter(|instruction| {
                matches!(instruction, HashInstruction::IgnoredFileSet { globs, .. }
                    if globs.iter().any(|glob| glob.contains("libs/app/")))
            })
            .collect()
        };
        assert_eq!(
            retained(true, false),
            vec![HashInstruction::IgnoredFileSet {
                globs: vec![
                    "libs/app/fixtures/**".into(),
                    "!libs/app/fixtures/large/**".into()
                ]
                .into(),
                project_roots: vec!["libs/app".into()],
                from_ultracache: false,
            }]
        );
        assert_eq!(retained(false, true), vec![]);
    }

    #[test]
    fn the_recording_decides_the_tasks_own_tsconfig() {
        let planner = planner(
            vec![(
                "e2e:e2e",
                vec![
                    fileset("{projectRoot}/fixtures/**", true),
                    selected(&["feature"], true),
                ],
            )],
            &[],
        );
        let tsconfigs = |reads: &[&str]| -> Vec<HashInstruction> {
            let mut tsconfigs: Vec<HashInstruction> = recorded_e2e_plan_reading(&planner, reads)
                .into_iter()
                .filter(|instruction| matches!(instruction, HashInstruction::TsConfiguration(_)))
                .collect();
            tsconfigs.sort();
            tsconfigs
        };
        assert_eq!(
            tsconfigs(&["libs/e2e/src/app.spec.ts"]),
            vec![HashInstruction::TsConfiguration("feature".into())]
        );
        assert_eq!(
            tsconfigs(&["libs/e2e/src/app.spec.ts", "tsconfig.base.json"]),
            vec![
                HashInstruction::TsConfiguration("e2e".into()),
                HashInstruction::TsConfiguration("feature".into())
            ]
        );
    }

    /// The node_modules reads `e2e:e2e`'s plan hashes as files, and whether it
    /// is deferred.
    fn hashed_node_modules_reads(
        planner: &HashPlanner,
        graph: TaskGraph,
        reads: &[&str],
    ) -> (Vec<String>, bool) {
        let (_dir, configurations) = ultracache_configurations(&[("e2e:e2e", reads)]);
        let plans = planner
            .get_plans_internal(vec!["e2e:e2e"], graph, Some(&configurations), &[])
            .unwrap();
        let mut hashed: Vec<String> = plans.plans["e2e:e2e"]
            .ids()
            .iter()
            .filter_map(|id| match plans.pool.get(*id).value() {
                HashInstruction::IgnoredFileSet { globs, .. } => Some(globs.to_vec()),
                _ => None,
            })
            .flatten()
            .filter(|glob| glob.contains("node_modules"))
            .map(|glob| glob.to_string())
            .collect();
        hashed.sort();
        (hashed, plans.deferred.contains("e2e:e2e"))
    }

    #[test]
    fn hashes_a_node_modules_read_inside_an_upstream_output() {
        let planner = planner(vec![("e2e:e2e", vec![])], &[("e2e", &["app"])]);
        let graph = || {
            task_graph(
                &[("e2e:e2e", &[]), ("app:build", &["node_modules/.gen/app"])],
                &[("e2e:e2e", &["app:build"])],
            )
        };
        let reads = [
            "node_modules/.gen/app/index.js",
            "node_modules/foo/index.js",
            "dist/libs/app/node_modules/dep/index.js",
        ];
        assert_eq!(
            hashed_node_modules_reads(&planner, graph(), &reads),
            (vec!["node_modules/.gen/app/index.js".to_string()], true)
        );
        // Without unstable files nothing under node_modules is tracked.
        assert_eq!(
            hashed_node_modules_reads(&planner, excluding_unstable_files(graph()), &reads),
            (vec![], false)
        );
    }

    #[test]
    fn a_recording_keeps_dependent_tasks_output_files() {
        let planner = planner(
            vec![(
                "e2e:e2e",
                vec![Either9::G(DepsOutputsInput {
                    dependent_tasks_output_files: "**/*.d.ts".into(),
                    transitive: None,
                })],
            )],
            &[("e2e", &["app"])],
        );
        let graph = excluding_unstable_files(task_graph(
            &[("e2e:e2e", &[]), ("app:build", &["libs/app/dist"])],
            &[("e2e:e2e", &["app:build"])],
        ));
        let (_dir, configurations) =
            ultracache_configurations(&[("e2e:e2e", &["libs/e2e/src/app.spec.ts"])]);
        let plans = planner
            .get_plans_internal(vec!["e2e:e2e"], graph, Some(&configurations), &[])
            .unwrap();
        assert!(plans.plans["e2e:e2e"].ids().iter().any(|id| matches!(
            plans.pool.get(*id).value(),
            HashInstruction::TaskOutput(glob, outputs)
                if glob == "**/*.d.ts" && outputs == &["libs/app/dist"]
        )));
        assert!(
            plans.plans["e2e:e2e"]
                .ids()
                .iter()
                .any(|id| recorded_spec_read(plans.pool.get(*id).value()))
        );
    }

    #[test]
    fn hashes_a_node_modules_read_a_declared_include_ignored_fileset_names() {
        let reads = [
            "libs/e2e/node_modules/.gen/used.json",
            "libs/e2e/node_modules/foo/index.js",
            "libs/app/node_modules/.gen/used.json",
            "libs/app/node_modules/foo/index.js",
        ];
        let hashed = |inputs: Vec<JsInputs>| {
            hashed_node_modules_reads(
                &planner(vec![("e2e:e2e", inputs)], &[("e2e", &["app"])]),
                including_unstable_files(task_graph(&[("e2e:e2e", &[])], &[])),
                &reads,
            )
            .0
        };
        assert_eq!(hashed(vec![]), Vec::<String>::new());
        assert_eq!(
            hashed(vec![ignored_fileset(
                "{projectRoot}/node_modules/.gen/**",
                false,
                false
            )]),
            vec!["libs/e2e/node_modules/.gen/used.json".to_string()]
        );
        assert_eq!(
            hashed(vec![ignored_fileset(
                "{projectRoot}/node_modules/.gen/**",
                true,
                false
            )]),
            vec!["libs/app/node_modules/.gen/used.json".to_string()]
        );
        assert_eq!(
            hashed(vec![ignored_fileset(
                "{projectRoot}/generated/**",
                false,
                false
            )]),
            Vec::<String>::new()
        );
    }

    #[test]
    fn keeps_every_form_of_always_input() {
        let own_named = |always| named("default", false, always);
        let dependency_fileset = |always| {
            Either9::C(FileSetInput {
                fileset: "{projectRoot}/**/*".into(),
                dependencies: Some(true),
                include_ignored: None,
                always: Some(always),
            })
        };
        let json = |always| {
            Either9::I(JsonInput {
                json: "{projectRoot}/package.json".into(),
                fields: None,
                exclude_fields: None,
                always: Some(always),
            })
        };
        let cases: [(&dyn Fn(bool) -> JsInputs, fn(&HashInstruction) -> bool); 3] = [
            (
                &own_named,
                |instruction| matches!(instruction, HashInstruction::ProjectFileSet(project, _) if project == "e2e"),
            ),
            (
                &dependency_fileset,
                |instruction| matches!(instruction, HashInstruction::ProjectFileSet(project, _) if project == "app"),
            ),
            (&json, |instruction| {
                matches!(instruction, HashInstruction::JsonFileSet(_))
            }),
        ];
        for (input, kept) in cases {
            let plan = |always| {
                recorded_e2e_plan(&planner(
                    vec![("e2e:e2e", vec![input(always)])],
                    &[("e2e", &["app"])],
                ))
            };
            assert!(!plan(false).iter().any(kept));
            assert!(plan(true).iter().any(kept));
        }
    }

    /// The subtree memo is shared across tasks and keyed without `always`.
    #[test]
    fn tasks_sharing_a_dependency_subtree_keep_their_own_always() {
        for order in [["e2e:e2e", "e2e-plain:e2e"], ["e2e-plain:e2e", "e2e:e2e"]] {
            let planner = planner(
                vec![
                    ("e2e:e2e", vec![named("default", true, true)]),
                    ("e2e-plain:e2e", vec![named("default", true, false)]),
                ],
                &[
                    ("e2e", &["app"]),
                    ("e2e-plain", &["app"]),
                    ("app", &["feature"]),
                ],
            );
            for id in order {
                hashed_projects(&planner, &[id], true).unwrap();
            }
            let plans = hashed_projects(&planner, &order, true).unwrap();
            assert_eq!(plans["e2e:e2e"], vec!["app", "feature"]);
            assert!(plans["e2e-plain:e2e"].is_empty());
        }
    }

    #[test]
    fn an_always_project_selection_must_match_a_project() {
        let plan = |always| {
            hashed_projects(
                &planner(
                    vec![("e2e:e2e", vec![selected(&["feature", "featrue"], always)])],
                    &[],
                ),
                &["e2e:e2e"],
                false,
            )
        };
        assert!(plan(false).is_ok());
        let error = plan(true).unwrap_err().to_string();
        assert!(error.starts_with("Task \"e2e:e2e\":"), "{error}");
        assert!(error.contains("\"featrue\""), "{error}");
    }

    #[test]
    fn a_dependencies_selection_hashes_what_the_projects_own_dependency_input_does() {
        let planner = planner(
            vec![
                ("e2e:e2e", vec![selected_dependencies(&["app"], false)]),
                ("app:build", vec![Either9::B("^default".into())]),
            ],
            &[("app", &["feature"]), ("feature", &["feature2"])],
        );
        let plans = hashed_projects(&planner, &["e2e:e2e", "app:build"], false).unwrap();
        assert_eq!(plans["e2e:e2e"], vec!["feature", "feature2"]);
        assert_eq!(plans["e2e:e2e"], plans["app:build"]);
    }

    #[test]
    fn a_selection_and_its_dependencies_cover_the_projects_and_their_closure() {
        let projects = e2e_projects(
            planner(
                vec![(
                    "e2e:e2e",
                    vec![
                        selected(&["app"], false),
                        selected_dependencies(&["app"], false),
                    ],
                )],
                &[("app", &["feature"]), ("feature", &["feature2"])],
            ),
            false,
        );
        assert_eq!(projects, vec!["app", "feature", "feature2"]);
    }

    #[test]
    fn a_recording_replaces_a_dependencies_selection_unless_always() {
        let plan = |always| {
            e2e_projects(
                planner(
                    vec![("e2e:e2e", vec![selected_dependencies(&["app"], always)])],
                    &[("app", &["feature"]), ("feature", &["feature2"])],
                ),
                true,
            )
        };
        assert_eq!(plan(false), Vec::<String>::new());
        assert_eq!(plan(true), vec!["feature", "feature2"]);
    }

    /// The selection reuses the subtree memo another task fills without `always`.
    #[test]
    fn a_dependencies_selection_keeps_its_always_when_sharing_the_memo() {
        for order in [["e2e:e2e", "e2e-plain:e2e"], ["e2e-plain:e2e", "e2e:e2e"]] {
            let planner = planner(
                vec![
                    ("e2e:e2e", vec![selected_dependencies(&["app"], true)]),
                    ("e2e-plain:e2e", vec![named("default", true, false)]),
                ],
                &[
                    ("e2e-plain", &["feature"]),
                    ("app", &["feature"]),
                    ("feature", &["feature2"]),
                ],
            );
            for id in order {
                hashed_projects(&planner, &[id], true).unwrap();
            }
            let plans = hashed_projects(&planner, &order, true).unwrap();
            assert_eq!(plans["e2e:e2e"], vec!["feature", "feature2"]);
            assert!(plans["e2e-plain:e2e"].is_empty());
        }
    }

    /// A cycle takes the visited-set traversal, rooted at the selected project.
    #[test]
    fn a_dependencies_selection_in_a_cycle_leaves_out_the_selected_project() {
        let projects = e2e_projects(
            planner(
                vec![("e2e:e2e", vec![selected_dependencies(&["app"], false)])],
                &[("app", &["feature"]), ("feature", &["app", "feature2"])],
            ),
            false,
        );
        assert_eq!(projects, vec!["feature", "feature2"]);
    }

    #[test]
    fn an_always_dependencies_selection_must_match_a_project() {
        let error = hashed_projects(
            &planner(
                vec![("e2e:e2e", vec![selected_dependencies(&["app", "ap"], true)])],
                &[],
            ),
            &["e2e:e2e"],
            false,
        )
        .unwrap_err()
        .to_string();
        assert!(error.contains("\"ap\""), "{error}");
    }
}
