use crate::native::project_graph::types::ProjectGraph;
use crate::native::tasks::dep_outputs::collect_continuous_dependencies;
use crate::native::tasks::hashers::OnceCache;
use crate::native::tasks::inputs::get_inputs;
use crate::native::tasks::plan_memo::PlanMemo;
use crate::native::tasks::types::{
    ALWAYS_ON_WORKSPACE_FILES, HashInstruction, HashPlans, InstructionPool, TaskGraph,
};
use crate::native::tasks::ultracache_eligibility::{
    self, EligibilityInputs, UltracacheEligibilityOptions,
};
use crate::native::types::NxJson;
use crate::native::ultracache::UltracacheConfigurations;
use napi::bindgen_prelude::{ClassInstance, External};
use rayon::prelude::*;
use std::collections::{BTreeSet, HashMap};
use std::sync::{Arc, OnceLock};
use tracing::trace;

use super::plan::{Plan, PlanBuilder};
use super::recorded_globs::RecordedGlobs;

mod cycle_groups;
mod deferral;
mod dependencies;
mod inputs;
mod ultracache;

use cycle_groups::CycleGroupsSlot;
use deferral::deferred_tasks;
pub(super) use deferral::overlaps_any;
pub(crate) use deferral::walk_root;
use dependencies::{LocalDependencyInputs, SubtreeResult, VisitedTracker};
use ultracache::{AlwaysIds, UltracacheContext, drop_ultracache_duplicates};

pub(super) const ROOT_TSCONFIG_FILES: [&str; 2] = ["tsconfig.base.json", "tsconfig.json"];
/// Hashed by the always-on workspace fileset every plan carries.
pub(super) const ALWAYS_ON_FILES: [&str; 3] = ["nx.json", ".gitignore", ".nxignore"];

#[napi]
pub struct HashPlanner {
    nx_json: NxJson,
    project_graph: Arc<ProjectGraph>,
    /// Each external node mapped to its transitive project-node deps, memoized per instance.
    external_deps_mapped: OnceLock<HashMap<String, Vec<String>>>,
    external_node_names: OnceLock<OnceCache<Vec<String>>>,
    /// Memoized instruction ids contributed by (dependency project, propagated
    /// input), including its whole transitive closure. Shared across all tasks
    /// in all get_plans calls: values derive only from the immutable project
    /// graph and nx_json. Only consulted for acyclic dependency closures — see
    /// `dependency_memo_enabled`.
    subtree_memo: dashmap::DashMap<String, SubtreeResult>,
    /// Own-project instructions can be reused even when a cyclic closure must
    /// still be traversed for each task. Initialized only on that fallback.
    local_inputs_memo: OnceLock<OnceCache<LocalDependencyInputs>>,
    acyclic_dependency_projects: OnceLock<hashbrown::HashSet<String>>,
    /// Per propagated input, the dependency graph's cycles condensed into
    /// shared plans (see `cycle_rooted_inputs`).
    cycle_groups: dashmap::DashMap<String, Arc<CycleGroupsSlot>>,
    /// Project name by root, for attributing observed reads to their owner.
    workspace_root_project: OnceLock<Option<String>>,
    project_by_root: OnceLock<HashMap<String, String>>,
    /// `project_by_root`'s keys, sorted.
    project_roots: OnceLock<BTreeSet<String>>,
    /// Interner backing every plan this planner produces.
    instruction_pool: Arc<InstructionPool>,
    /// Whole-task plans from earlier calls, reused while the task graph
    /// around them and the Ultracache configurations are unchanged.
    plan_memo: PlanMemo,
}

#[napi]
impl HashPlanner {
    #[napi(constructor)]
    pub fn new(
        nx_json: NxJson,
        #[napi(ts_arg_type = "ExternalObject<ProjectGraph>")] project_graph: &External<
            Arc<ProjectGraph>,
        >,
    ) -> Self {
        Self {
            nx_json,
            project_graph: Arc::clone(project_graph),
            external_deps_mapped: OnceLock::new(),
            external_node_names: OnceLock::new(),
            subtree_memo: Default::default(),
            local_inputs_memo: OnceLock::new(),
            acyclic_dependency_projects: OnceLock::new(),
            cycle_groups: Default::default(),
            workspace_root_project: OnceLock::new(),
            project_by_root: OnceLock::new(),
            project_roots: OnceLock::new(),
            instruction_pool: Arc::new(InstructionPool::new()),
            plan_memo: PlanMemo::default(),
        }
    }

    fn project_by_root(&self) -> &HashMap<String, String> {
        self.project_by_root.get_or_init(|| {
            self.project_graph
                .nodes
                .iter()
                .filter(|(_, project)| project.root != ".")
                .map(|(name, project)| {
                    (project.root.trim_end_matches('/').to_string(), name.clone())
                })
                .collect()
        })
    }

    /// Every project root except the workspace root's own, sorted.
    fn project_roots(&self) -> &BTreeSet<String> {
        self.project_roots
            .get_or_init(|| self.project_by_root().keys().cloned().collect())
    }

    pub fn get_plans_internal(
        &self,
        task_ids: Vec<&str>,
        task_graph: TaskGraph,
        configurations: Option<&UltracacheConfigurations>,
        custom_hasher_task_ids: &[String],
    ) -> anyhow::Result<HashPlans> {
        let function_start = std::time::Instant::now();
        let memo = self.plan_memo.begin(
            &task_graph,
            configurations.map(|configurations| {
                let resolution = configurations.resolution_ref();
                (resolution.requested_commit.clone(), resolution.fetched_at)
            }),
            custom_hasher_task_ids,
        );
        let to_plan = memo.missing(&task_ids);
        let ultracache_tasks = configurations.map(|configurations| {
            ultracache_eligibility::resolve(
                configurations,
                to_plan
                    .iter()
                    .filter_map(|id| task_graph.tasks.get_key_value(*id))
                    .map(|(id, task)| (id.as_str(), task.ultracache.as_ref())),
                &EligibilityInputs {
                    custom_hasher: custom_hasher_task_ids.iter().cloned().collect(),
                    continuous: to_plan
                        .iter()
                        .filter(|id| {
                            task_graph
                                .tasks
                                .get(**id)
                                .is_some_and(|task| task.continuous == Some(true))
                        })
                        .map(|id| id.to_string())
                        .collect(),
                },
            )
            .tasks
        });

        let globs = ultracache_tasks
            .as_ref()
            .and_then(|tasks| tasks.values().next())
            .map(|t| {
                RecordedGlobs::new(&t.dictionary, self.project_by_root(), self.project_roots())
            });

        trace!("Starting get_plans_internal for {} tasks", task_ids.len());

        let external_deps_mapped = self
            .external_deps_mapped
            .get_or_init(|| self.compute_external_deps());
        let setup_duration = function_start.elapsed();

        trace!("External deps setup completed in {:?}", setup_duration);

        let pool = &self.instruction_pool;
        let parallel_start = std::time::Instant::now();
        let result: anyhow::Result<HashMap<String, Plan>> = to_plan
            .par_iter()
            .map(|id| {
                let task = &task_graph
                    .tasks
                    .get(*id)
                    .ok_or_else(|| anyhow::anyhow!("Task with id '{id}' not found"))?;
                let inputs = get_inputs(task, &self.project_graph, &self.nx_json)?;

                let target = self.target_input(
                    &task.target.project,
                    &task.target.target,
                    &inputs.self_inputs,
                    external_deps_mapped,
                )?;

                let always_on_id = pool.intern(HashInstruction::WorkspaceFileSet(
                    ALWAYS_ON_WORKSPACE_FILES
                        .iter()
                        .map(|f| f.to_string())
                        .collect(),
                ));
                let mut builder = PlanBuilder::default();
                builder.ids(
                    target
                        .unwrap_or(vec![])
                        .into_iter()
                        .chain(vec![HashInstruction::Environment(
                            "NX_CLOUD_ENCRYPTION_KEY".into(),
                        )])
                        .map(|instruction| pool.intern(instruction))
                        .chain([always_on_id]),
                );

                let context = ultracache_tasks
                    .as_ref()
                    .and_then(|tasks| tasks.get(*id))
                    .map(UltracacheContext::new);
                let mut always = AlwaysIds::collecting(context.is_some());
                builder.include(self.self_and_deps_inputs(
                    &task.target.project,
                    task,
                    &inputs,
                    &task_graph,
                    external_deps_mapped,
                    &mut VisitedTracker::new(task.target.project.as_str()),
                    context.as_ref(),
                    &mut always,
                )?);

                if let Some(context) = &context {
                    builder = self.replace_with_configuration(
                        task,
                        &task_graph,
                        context,
                        globs.as_ref().unwrap(),
                        builder.finish(pool),
                        always_on_id,
                        always,
                    );
                }

                // A continuous dependency serves this task from its own process, so
                // its declared inputs and externals are hashed here, and its own
                // servers' in turn, unless the edge has `inputs: false`.
                // Continuous tasks never hash from a configuration:
                // what they read depends on which clients they served. When it reads
                // its builds' outputs, those land in this plan too, which holds the
                // task back from the up-front batch.
                for dep_task in collect_continuous_dependencies(&task_graph, id) {
                    let dep_inputs = get_inputs(dep_task, &self.project_graph, &self.nx_json)?;
                    builder.ids(
                        self.target_input(
                            &dep_task.target.project,
                            &dep_task.target.target,
                            &dep_inputs.self_inputs,
                            external_deps_mapped,
                        )?
                        .unwrap_or_default()
                        .into_iter()
                        .map(|instruction| pool.intern(instruction)),
                    );
                    builder.include(self.self_and_deps_inputs(
                        &dep_task.target.project,
                        dep_task,
                        &dep_inputs,
                        &task_graph,
                        external_deps_mapped,
                        &mut VisitedTracker::new(dep_task.target.project.as_str()),
                        None,
                        &mut AlwaysIds::collecting(false),
                    )?);
                }

                let mut plan = builder.finish(pool);
                if context.is_some() {
                    plan = drop_ultracache_duplicates(pool, plan);
                }
                Ok((id.to_string(), plan))
            })
            .collect();

        let parallel_duration = parallel_start.elapsed();
        let total_duration = function_start.elapsed();

        if result.is_ok() {
            tracing::debug!(
                "get_plans_internal COMPLETED in {:?} - processed {} tasks, {} reused (setup: {:?}, parallel_planning: {:?}, pool: {} unique instructions)",
                total_duration,
                task_ids.len(),
                task_ids.len() - to_plan.len(),
                setup_duration,
                parallel_duration,
                self.instruction_pool.len()
            );
        } else {
            tracing::debug!(
                "get_plans_internal FAILED in {:?} for {} tasks",
                total_duration,
                task_ids.len()
            );
        }

        let result = result.map(|planned| memo.finish(planned, &task_ids));
        result.map(|plans| {
            let deferred = deferred_tasks(&plans, pool, &task_graph);
            HashPlans {
                pool: Arc::clone(&self.instruction_pool),
                plans,
                deferred,
            }
        })
    }

    /// Materialized, Ord-sorted plans for the string-returning JS API; the
    /// hashing path uses `get_plans_reference` and never materializes.
    pub fn get_plans_materialized(
        &self,
        task_ids: Vec<&str>,
        task_graph: TaskGraph,
        configurations: Option<&UltracacheConfigurations>,
        custom_hasher_task_ids: &[String],
    ) -> anyhow::Result<HashMap<String, Vec<HashInstruction>>> {
        let hash_plans =
            self.get_plans_internal(task_ids, task_graph, configurations, custom_hasher_task_ids)?;
        Ok(hash_plans
            .plans
            .into_iter()
            .map(|(task_id, ids)| {
                let mut instructions: Vec<HashInstruction> = ids
                    .ids()
                    .iter()
                    .map(|&id| hash_plans.pool.get(id).value().clone())
                    .collect();
                instructions.par_sort();
                (task_id, instructions)
            })
            .collect())
    }

    /// `configurations` is this run's Ultracache configurations; a task with an
    /// eligible entry hashes its observed reads instead of its declared
    /// filesets, except `always` ones.
    /// `options` carries the task ids decided in JS, where executors and
    /// target configuration are resolved.
    #[napi(ts_return_type = "Record<string, string[]>")]
    pub fn get_plans(
        &self,
        task_ids: Vec<String>,
        task_graph: TaskGraph,
        configurations: Option<ClassInstance<'_, UltracacheConfigurations>>,
        options: Option<UltracacheEligibilityOptions>,
    ) -> anyhow::Result<HashMap<String, Vec<HashInstruction>>> {
        let task_ids: Vec<&str> = task_ids.iter().map(|s| s.as_str()).collect();
        let options = options.unwrap_or_default();
        self.get_plans_materialized(
            task_ids,
            task_graph,
            configurations.as_deref(),
            options.custom_hasher_task_ids.as_deref().unwrap_or(&[]),
        )
    }

    #[napi(ts_return_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
    pub fn get_plans_reference(
        &self,
        task_ids: Vec<String>,
        task_graph: TaskGraph,
        configurations: Option<ClassInstance<'_, UltracacheConfigurations>>,
        options: Option<UltracacheEligibilityOptions>,
    ) -> anyhow::Result<External<HashPlans>> {
        let task_ids: Vec<&str> = task_ids.iter().map(|s| s.as_str()).collect();
        let options = options.unwrap_or_default();
        let plans = self.get_plans_internal(
            task_ids,
            task_graph,
            configurations.as_deref(),
            options.custom_hasher_task_ids.as_deref().unwrap_or(&[]),
        )?;
        Ok(External::new(plans))
    }
}

#[cfg(test)]
mod plan_memo_tests {
    use super::*;
    use crate::native::project_graph::types::{Project, Target};
    use crate::native::test_utils::task_graph;
    use crate::native::types::DepsOutputsInput;
    use napi::bindgen_prelude::Either9;

    /// `app:build` reads `lib:build`'s outputs, so its plan embeds them.
    fn planner() -> HashPlanner {
        let project = |root: &str, inputs| Project {
            root: root.into(),
            targets: HashMap::from([(
                "build".into(),
                Target {
                    inputs: Some(inputs),
                    ..Default::default()
                },
            )]),
            ..Default::default()
        };
        let graph = ProjectGraph {
            nodes: HashMap::from([
                (
                    "lib".into(),
                    project("libs/lib", vec![Either9::B("{projectRoot}/**/*".into())]),
                ),
                (
                    "app".into(),
                    project(
                        "apps/app",
                        vec![
                            Either9::B("{projectRoot}/**/*".into()),
                            Either9::G(DepsOutputsInput {
                                dependent_tasks_output_files: "**/*.js".into(),
                                transitive: None,
                            }),
                        ],
                    ),
                ),
            ]),
            dependencies: HashMap::from([
                ("app".into(), vec!["lib".into()]),
                ("lib".into(), vec![]),
            ]),
            external_nodes: HashMap::new(),
        };
        HashPlanner::new(
            NxJson { named_inputs: None },
            &External::new(Arc::new(graph)),
        )
    }

    fn graph(lib_outputs: &[&str]) -> TaskGraph {
        task_graph(
            &[("lib:build", lib_outputs), ("app:build", &[])],
            &[("app:build", &["lib:build"])],
        )
    }

    fn plans(
        planner: &HashPlanner,
        ids: &[&str],
        graph: TaskGraph,
    ) -> HashMap<String, Vec<HashInstruction>> {
        planner
            .get_plans_materialized(ids.to_vec(), graph, None, &[])
            .unwrap()
    }

    /// What selection then the run do: plan every task, then some of them again.
    #[test]
    fn a_second_call_answers_as_a_fresh_planner_would() {
        let reused = planner();
        plans(&reused, &["lib:build", "app:build"], graph(&["dist/lib"]));
        assert_eq!(
            plans(&reused, &["app:build"], graph(&["dist/lib"])),
            plans(&planner(), &["app:build"], graph(&["dist/lib"]))
        );
        assert!(
            reused
                .plan_memo
                .begin(&graph(&["dist/lib"]), None, &[])
                .missing(&["app:build"])
                .is_empty()
        );
    }

    /// The consumer's plan embeds the producer's outputs, so it is planned again.
    #[test]
    fn a_changed_producer_output_is_planned_again() {
        let reused = planner();
        plans(&reused, &["lib:build", "app:build"], graph(&["dist/lib"]));
        let replanned = plans(&reused, &["app:build"], graph(&["dist/lib-v2"]));
        assert_eq!(
            replanned,
            plans(&planner(), &["app:build"], graph(&["dist/lib-v2"]))
        );
        assert!(replanned["app:build"].iter().any(|instruction| matches!(
            instruction,
            HashInstruction::TaskOutput(_, outputs) if outputs == &["dist/lib-v2"]
        )));
    }
}

#[cfg(test)]
mod continuous_inputs_tests {
    use super::*;
    use crate::native::project_graph::types::{Project, Target};
    use crate::native::test_utils::{edges_to, task_graph};
    use crate::native::types::DepsOutputsInput;
    use napi::bindgen_prelude::Either9;

    fn planner() -> HashPlanner {
        let project = |root: &str, target: &str, inputs| Project {
            root: root.into(),
            targets: HashMap::from([(
                target.into(),
                Target {
                    inputs: Some(inputs),
                    ..Default::default()
                },
            )]),
            ..Default::default()
        };
        let files = || Either9::B("{projectRoot}/**/*".into());
        let graph = ProjectGraph {
            nodes: HashMap::from([
                ("e2e".into(), project("apps/e2e", "e2e", vec![files()])),
                (
                    "app".into(),
                    project(
                        "apps/app",
                        "serve",
                        vec![
                            files(),
                            Either9::G(DepsOutputsInput {
                                dependent_tasks_output_files: "**/*.js".into(),
                                transitive: None,
                            }),
                        ],
                    ),
                ),
                ("api".into(), project("apps/api", "serve", vec![files()])),
                ("lib".into(), project("libs/lib", "build", vec![files()])),
            ]),
            dependencies: ["e2e", "app", "api", "lib"]
                .into_iter()
                .map(|project| (project.into(), vec![]))
                .collect(),
            external_nodes: HashMap::new(),
        };
        HashPlanner::new(
            NxJson { named_inputs: None },
            &External::new(Arc::new(graph)),
        )
    }

    fn graph(continuous: &[(&str, &[&str])], without_inputs: &[(&str, &[&str])]) -> TaskGraph {
        let mut graph = task_graph(
            &[
                ("e2e:e2e", &[]),
                ("app:serve", &[]),
                ("api:serve", &[]),
                ("lib:build", &["dist/libs/lib"]),
            ],
            &[("app:serve", &["lib:build"])],
        );
        graph.continuous_dependencies = continuous
            .iter()
            .map(|(id, deps)| (id.to_string(), edges_to(deps)))
            .collect();
        for (id, deps) in without_inputs {
            for edge in graph.continuous_dependencies.get_mut(*id).unwrap() {
                if deps.contains(&edge.id.as_str()) {
                    edge.inputs = Some(false);
                }
            }
        }
        graph
    }

    /// The projects whose files `e2e:e2e` hashes, and whether it is deferred.
    fn hashed(graph: TaskGraph) -> (Vec<String>, bool) {
        let plans = planner()
            .get_plans_internal(vec!["e2e:e2e"], graph, None, &[])
            .unwrap();
        let mut projects: Vec<String> = plans.plans["e2e:e2e"]
            .ids()
            .iter()
            .filter_map(|id| match plans.pool.get(*id).value() {
                HashInstruction::ProjectFileSet(project, _) => Some(project.clone()),
                _ => None,
            })
            .collect();
        projects.sort();
        projects.dedup();
        (projects, plans.deferred.contains("e2e:e2e"))
    }

    #[test]
    fn a_continuous_dependency_contributes_its_inputs_and_its_servers() {
        assert_eq!(
            hashed(graph(
                &[("e2e:e2e", &["app:serve"]), ("app:serve", &["api:serve"])],
                &[],
            )),
            (vec!["api".into(), "app".into(), "e2e".into()], true)
        );
    }

    #[test]
    fn an_edge_without_inputs_contributes_nothing_through_it() {
        assert_eq!(
            hashed(graph(
                &[("e2e:e2e", &["app:serve"]), ("app:serve", &["api:serve"])],
                &[("e2e:e2e", &["app:serve"])],
            )),
            (vec!["e2e".into()], false)
        );
    }

    #[test]
    fn a_server_also_reached_with_inputs_still_contributes() {
        assert_eq!(
            hashed(graph(
                &[
                    ("e2e:e2e", &["app:serve", "api:serve"]),
                    ("app:serve", &["api:serve"]),
                ],
                &[("e2e:e2e", &["app:serve"])],
            )),
            (vec!["api".into(), "e2e".into()], false)
        );
    }

    #[test]
    fn a_server_can_opt_out_of_its_own_server() {
        assert_eq!(
            hashed(graph(
                &[("e2e:e2e", &["app:serve"]), ("app:serve", &["api:serve"])],
                &[("app:serve", &["api:serve"])],
            )),
            (vec!["app".into(), "e2e".into()], true)
        );
    }
}
