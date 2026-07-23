use crate::native::logger::enable_logger;
use crate::native::tasks::{
    dep_outputs::get_dep_output,
    types::{CwdMode, HashInstruction, HashPlans, InstructionPool, JsonFileSetInput, TaskGraph},
};
use crate::native::types::{Input, NxJson};
use crate::native::{
    project_graph::types::ProjectGraph,
    tasks::{inputs::SplitInputs, types::Task},
};
use napi::bindgen_prelude::External;
use rayon::prelude::*;
use std::collections::HashMap;
use tracing::trace;

use crate::native::tasks::hashers::OnceCache;
use crate::native::tasks::inputs::{
    expand_single_project_inputs, get_inputs, get_inputs_for_dependency, get_named_inputs,
};
use crate::native::tasks::utils;
use crate::native::utils::find_matching_projects;
use std::sync::{Arc, OnceLock};

#[napi]
pub struct HashPlanner {
    nx_json: NxJson,
    project_graph: Arc<ProjectGraph>,
    /// Each external node mapped to its transitive project-node deps, memoized per instance.
    external_deps_mapped: OnceLock<HashMap<String, Vec<String>>>,
    /// Memoized instruction ids contributed by (dependency project, propagated
    /// input), including its whole transitive closure. Shared across all tasks
    /// in all get_plans calls: values derive only from the immutable project
    /// graph and nx_json. Only consulted on acyclic graphs — see
    /// `dependency_memo_enabled`.
    subtree_memo: OnceCache<SubtreeResult>,
    is_acyclic: OnceLock<bool>,
    /// Interner backing every plan this planner produces.
    instruction_pool: Arc<InstructionPool>,
}

/// Instruction ids contributed by one (project, propagated input) dependency subtree.
struct SubtreeResult {
    ids: Vec<u32>,
    /// True when the subtree cannot be spliced from the memo: it contains
    /// deps-outputs inputs (whose resolution depends on the root task) or an
    /// unexpected propagation shape. Callers must use the per-task traversal.
    needs_legacy: bool,
}

/// Cycle-detection set with an undo log. Each dependency input needs its own
/// visitation scope (see `gather_dependency_inputs`); rolling insertions back
/// keeps that scoping without cloning the whole set per input.
struct VisitedTracker<'a> {
    set: hashbrown::HashSet<&'a str>,
    log: Vec<&'a str>,
}

impl<'a> VisitedTracker<'a> {
    /// The root project starts out visited, so a task never traverses
    /// itself as its own dependency.
    fn new(root_project: &'a str) -> Self {
        Self {
            set: hashbrown::HashSet::from([root_project]),
            log: Vec::new(),
        }
    }

    /// Same contract as `HashSet::insert`: returns whether the project was
    /// newly inserted. New insertions are logged so `rollback_to` can undo them.
    fn insert(&mut self, project: &'a str) -> bool {
        let inserted = self.set.insert(project);
        if inserted {
            self.log.push(project);
        }
        inserted
    }

    fn scope_start(&self) -> usize {
        self.log.len()
    }

    /// Un-visits everything recorded since `scope_start`.
    fn rollback_to(&mut self, scope_start: usize) {
        for project in self.log.drain(scope_start..) {
            self.set.remove(project);
        }
    }
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
        enable_logger();
        Self {
            nx_json,
            project_graph: Arc::clone(project_graph),
            external_deps_mapped: OnceLock::new(),
            subtree_memo: OnceCache::new(),
            is_acyclic: OnceLock::new(),
            instruction_pool: Arc::new(InstructionPool::new()),
        }
    }

    pub fn get_plans_internal(
        &self,
        task_ids: Vec<&str>,
        task_graph: TaskGraph,
    ) -> anyhow::Result<HashPlans> {
        let function_start = std::time::Instant::now();

        trace!("Starting get_plans_internal for {} tasks", task_ids.len());

        let external_deps_mapped = self
            .external_deps_mapped
            .get_or_init(|| self.compute_external_deps());
        let setup_duration = function_start.elapsed();

        trace!("External deps setup completed in {:?}", setup_duration);

        let pool = &self.instruction_pool;
        let parallel_start = std::time::Instant::now();
        let result: anyhow::Result<HashMap<String, Vec<u32>>> = task_ids
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

                // Task-scoped instructions are built as values and interned;
                // the O(tasks x closure) dependency portion inside
                // self_and_deps_inputs is spliced from the subtree memo as ids
                // without materialization.
                let mut ids: Vec<u32> = target
                    .unwrap_or(vec![])
                    .into_iter()
                    .chain(vec![
                        HashInstruction::Environment("NX_CLOUD_ENCRYPTION_KEY".into()),
                        HashInstruction::WorkspaceFileSet(vec![
                            "{workspaceRoot}/nx.json".to_string(),
                            "{workspaceRoot}/.gitignore".to_string(),
                            "{workspaceRoot}/.nxignore".to_string(),
                        ]),
                    ])
                    .map(|instruction| pool.intern(instruction))
                    .collect();

                ids.extend(self.self_and_deps_inputs(
                    &task.target.project,
                    task,
                    &inputs,
                    &task_graph,
                    external_deps_mapped,
                    &mut VisitedTracker::new(task.target.project.as_str()),
                )?);

                ids.sort_unstable();
                ids.dedup();

                Ok((id.to_string(), ids))
            })
            .collect();

        let parallel_duration = parallel_start.elapsed();
        let total_duration = function_start.elapsed();

        if result.is_ok() {
            tracing::debug!(
                "get_plans_internal COMPLETED in {:?} - processed {} tasks (setup: {:?}, parallel_planning: {:?}, pool: {} unique instructions)",
                total_duration,
                task_ids.len(),
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

        crate::native::profiler::record_ms(
            "hash_planner::setup_external_deps",
            setup_duration.as_secs_f64() * 1000.0,
        );
        crate::native::profiler::record_ms(
            "hash_planner::parallel_planning",
            parallel_duration.as_secs_f64() * 1000.0,
        );
        crate::native::profiler::record_ms(
            "hash_planner::total",
            total_duration.as_secs_f64() * 1000.0,
        );

        result.map(|plans| HashPlans {
            pool: Arc::clone(&self.instruction_pool),
            plans,
        })
    }

    /// Materialized, Ord-sorted plans for the string-returning JS API; the
    /// hashing path uses `get_plans_reference` and never materializes.
    pub fn get_plans_materialized(
        &self,
        task_ids: Vec<&str>,
        task_graph: TaskGraph,
    ) -> anyhow::Result<HashMap<String, Vec<HashInstruction>>> {
        let hash_plans = self.get_plans_internal(task_ids, task_graph)?;
        Ok(hash_plans
            .plans
            .into_iter()
            .map(|(task_id, ids)| {
                let mut instructions: Vec<HashInstruction> = ids
                    .into_iter()
                    .map(|id| hash_plans.pool.get(id).value().clone())
                    .collect();
                instructions.par_sort();
                (task_id, instructions)
            })
            .collect())
    }

    #[napi(ts_return_type = "Record<string, string[]>")]
    pub fn get_plans(
        &self,
        task_ids: Vec<String>,
        task_graph: TaskGraph,
    ) -> anyhow::Result<HashMap<String, Vec<HashInstruction>>> {
        let task_ids: Vec<&str> = task_ids.iter().map(|s| s.as_str()).collect();
        self.get_plans_materialized(task_ids, task_graph)
    }

    #[napi(ts_return_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
    pub fn get_plans_reference(
        &self,
        task_ids: Vec<String>,
        task_graph: TaskGraph,
    ) -> anyhow::Result<External<HashPlans>> {
        let task_ids: Vec<&str> = task_ids.iter().map(|s| s.as_str()).collect();
        let plans = self.get_plans_internal(task_ids, task_graph)?;
        Ok(External::new(plans))
    }

    fn target_input<'a>(
        &'a self,
        project_name: &str,
        target_name: &str,
        self_inputs: &[Input],
        external_deps_map: &'a HashMap<String, Vec<String>>,
    ) -> anyhow::Result<Option<Vec<HashInstruction>>> {
        let project = &self.project_graph.nodes[project_name];
        let Some(target) = project.targets.get(target_name) else {
            return Ok(None);
        };

        // we can only vouch for @nx packages's executor dependencies
        // if it's "run commands" or third-party we skip traversing since we have no info what this command depends on
        if target
            .executor
            .as_ref()
            .is_some_and(|e| e.starts_with("@nrwl/") || e.starts_with("@nx/"))
        {
            let executor_package = target
                .executor
                .as_ref()
                .unwrap()
                .split(':')
                .next()
                .expect("Executors should always have a ':'");
            let Some(existing_package) =
                find_external_dependency_node_name(executor_package, &self.project_graph)
            else {
                // this usually happens because the executor was a local plugin.
                // todo)) @Cammisuli: we need to gather the project's inputs and its dep inputs similar to how we do it in `self_and_deps_inputs`
                return Ok(None);
            };
            let mut external_deps: Vec<&'a String> = vec![];
            trace!(
                "Add External Instruction for executor {existing_package}: {}",
                target.executor.as_ref().unwrap()
            );
            trace!(
                "Add External Instructions for dependencies of executor {existing_package}: {:?}",
                &external_deps_map[existing_package]
            );
            external_deps.push(existing_package);
            external_deps.extend(&external_deps_map[existing_package]);
            Ok(Some(
                external_deps
                    .iter()
                    .map(|s| HashInstruction::External(s.to_string()))
                    .collect(),
            ))
        } else {
            let mut external_deps: Vec<&'a String> = vec![];
            let mut has_external_deps = false;
            for input in self_inputs {
                match input {
                    Input::ExternalDependency(deps) => {
                        has_external_deps = true;
                        for dep in deps.iter() {
                            let external_node_name =
                                find_external_dependency_node_name(dep, &self.project_graph);
                            let Some(external_node_name) = external_node_name else {
                                if self.project_graph.nodes.contains_key(dep) {
                                    let deps = self.project_graph.dependencies.get(project_name);
                                    if deps.is_some_and(|deps| deps.contains(dep)) {
                                        anyhow::bail!(
                                            "The externalDependency '{dep}' for '{project_name}:{target_name}' is not an external node and is already a dependency. Please remove it from the externalDependency inputs."
                                        )
                                    } else {
                                        anyhow::bail!(
                                            "The externalDependency '{dep}' for '{project_name}:{target_name}' is not an external node. If you believe this is a dependency, add an implicitDependency to '{project_name}'"
                                        )
                                    }
                                } else {
                                    anyhow::bail!(
                                        "The externalDependency '{dep}' for '{project_name}:{target_name}' could not be found"
                                    )
                                }
                            };
                            trace!(
                                "Add External Instruction for External Input {external_node_name}: {}",
                                target.executor.as_ref().unwrap()
                            );
                            trace!(
                                "Add External Instructions for dependencies of External Input {external_node_name}: {:?}",
                                &external_deps_map[external_node_name]
                            );
                            external_deps.push(external_node_name);
                            external_deps.extend(&external_deps_map[external_node_name]);
                        }
                    }
                    _ => continue,
                }
            }
            if !external_deps.is_empty() {
                Ok(Some(
                    external_deps
                        .iter()
                        .map(|s| HashInstruction::External(s.to_string()))
                        .collect(),
                ))
            } else if !has_external_deps {
                Ok(Some(vec![HashInstruction::AllExternalDependencies]))
            } else {
                Ok(None)
            }
        }
    }

    fn self_and_deps_inputs<'a>(
        &'a self,
        project_name: &str,
        task: &Task,
        inputs: &SplitInputs,
        task_graph: &TaskGraph,
        external_deps_mapped: &'a HashMap<String, Vec<String>>,
        visited: &mut VisitedTracker<'a>,
    ) -> anyhow::Result<Vec<u32>> {
        let pool = &self.instruction_pool;
        let project_deps = &self.project_graph.dependencies[project_name];

        let mut ids: Vec<u32> = self
            .gather_self_inputs(project_name, &inputs.self_inputs)
            .into_iter()
            .chain(self.gather_dependency_outputs(task, task_graph, &inputs.deps_outputs)?)
            .chain(self.gather_project_inputs(&inputs.project_inputs)?)
            .map(|instruction| pool.intern(instruction))
            .collect();

        ids.extend(self.gather_dependency_inputs(
            task,
            &inputs.deps_inputs,
            task_graph,
            project_deps,
            external_deps_mapped,
            visited,
        )?);

        Ok(ids)
    }

    fn compute_external_deps(&self) -> HashMap<String, Vec<String>> {
        self.project_graph
            .external_nodes
            .keys()
            .map(|external_node| {
                (
                    external_node.clone(),
                    utils::find_all_project_node_dependencies(
                        external_node,
                        &self.project_graph,
                        false,
                    )
                    .into_iter()
                    .cloned()
                    .collect(),
                )
            })
            .collect()
    }

    /// The subtree memo composes child results without per-path cycle checks,
    /// so it is only sound on acyclic graphs (also avoids OnceCell deadlock on
    /// a dependency cycle). Cyclic graphs use the visited-scoped traversal.
    fn dependency_memo_enabled(&self) -> bool {
        *self
            .is_acyclic
            .get_or_init(|| self.project_graph_is_acyclic())
    }

    fn project_graph_is_acyclic(&self) -> bool {
        const WHITE: u8 = 0;
        const GRAY: u8 = 1;
        const BLACK: u8 = 2;
        let deps = &self.project_graph.dependencies;
        let mut color: hashbrown::HashMap<&str, u8> = hashbrown::HashMap::new();

        for start in deps.keys() {
            if color.get(start.as_str()).copied().unwrap_or(WHITE) != WHITE {
                continue;
            }
            let mut stack: Vec<(&str, usize)> = vec![(start.as_str(), 0)];
            color.insert(start.as_str(), GRAY);
            while let Some((node, edge_idx)) = stack.last_mut() {
                let children = deps.get(*node).map(|c| c.as_slice()).unwrap_or(&[]);
                if let Some(child) = children.get(*edge_idx) {
                    *edge_idx += 1;
                    if !self.project_graph.nodes.contains_key(child) {
                        continue;
                    }
                    match color.get(child.as_str()).copied().unwrap_or(WHITE) {
                        GRAY => return false,
                        WHITE => {
                            color.insert(child.as_str(), GRAY);
                            stack.push((child.as_str(), 0));
                        }
                        _ => {}
                    }
                } else {
                    color.insert(node, BLACK);
                    stack.pop();
                }
            }
        }
        true
    }

    fn memoized_dep_subtree(
        &self,
        dep: &str,
        input: &Input,
        external_deps_mapped: &HashMap<String, Vec<String>>,
    ) -> anyhow::Result<Arc<SubtreeResult>> {
        let cache_key = match input {
            Input::Inputs { input, .. } => format!("{dep}\0i\0{input}"),
            Input::FileSet { fileset, .. } => format!("{dep}\0f\0{fileset}"),
            // Other input kinds never reach dependencies (get_inputs_for_dependency
            // returns None for them), so they share one empty entry per project.
            _ => format!("{dep}\0none"),
        };
        self.subtree_memo.get_or_try_init(cache_key, || {
            self.compute_dep_subtree(dep, input, external_deps_mapped)
        })
    }

    fn compute_dep_subtree(
        &self,
        dep: &str,
        input: &Input,
        external_deps_mapped: &HashMap<String, Vec<String>>,
    ) -> anyhow::Result<SubtreeResult> {
        let Some(dep_inputs) =
            get_inputs_for_dependency(&self.project_graph.nodes[dep], &self.nx_json, input)?
        else {
            return Ok(SubtreeResult {
                ids: vec![],
                needs_legacy: false,
            });
        };

        // Deps-outputs resolution depends on the root task; a propagation shape
        // other than the canonical single input is unexpected — both fall back.
        let mut needs_legacy =
            !dep_inputs.deps_outputs.is_empty() || dep_inputs.deps_inputs.len() != 1;
        let pool = &self.instruction_pool;
        let mut ids: Vec<u32> = self
            .gather_self_inputs(dep, &dep_inputs.self_inputs)
            .into_iter()
            .map(|instruction| pool.intern(instruction))
            .collect();

        if let Some(child_input) = dep_inputs.deps_inputs.first() {
            for child in &self.project_graph.dependencies[dep] {
                if self.project_graph.nodes.contains_key(child) {
                    let sub =
                        self.memoized_dep_subtree(child, child_input, external_deps_mapped)?;
                    needs_legacy |= sub.needs_legacy;
                    ids.extend_from_slice(&sub.ids);
                } else if let Some(external_deps) = external_deps_mapped.get(child) {
                    ids.push(pool.intern(HashInstruction::External(child.to_string())));
                    ids.extend(
                        external_deps
                            .iter()
                            .map(|s| pool.intern(HashInstruction::External(s.to_string()))),
                    );
                }
            }
        }

        ids.sort_unstable();
        ids.dedup();

        Ok(SubtreeResult { ids, needs_legacy })
    }

    // todo(jcammisuli): parallelize this more. This function takes the longest time to run
    fn gather_dependency_inputs<'a>(
        &'a self,
        task: &Task,
        inputs: &[Input],
        task_graph: &TaskGraph,
        project_deps: &'a [String],
        external_deps_mapped: &'a HashMap<String, Vec<String>>,
        visited: &mut VisitedTracker<'a>,
    ) -> anyhow::Result<Vec<u32>> {
        if inputs.len() == 1 {
            return self.gather_dependency_input(
                task,
                &inputs[0],
                task_graph,
                project_deps,
                external_deps_mapped,
                visited,
            );
        }

        let mut deps_inputs: Vec<u32> = Vec::with_capacity(inputs.len() * project_deps.len());

        for input in inputs {
            // Dependency inputs are independent. Scope cycle detection to each
            // input so sibling inputs all apply to the same dependency, rolling
            // this input's visits back instead of cloning the set.
            let scope = visited.scope_start();
            deps_inputs.extend(self.gather_dependency_input(
                task,
                input,
                task_graph,
                project_deps,
                external_deps_mapped,
                visited,
            )?);
            visited.rollback_to(scope);
        }

        Ok(deps_inputs)
    }

    fn gather_dependency_input<'a>(
        &'a self,
        task: &Task,
        input: &Input,
        task_graph: &TaskGraph,
        project_deps: &'a [String],
        external_deps_mapped: &'a HashMap<String, Vec<String>>,
        visited: &mut VisitedTracker<'a>,
    ) -> anyhow::Result<Vec<u32>> {
        let pool = &self.instruction_pool;
        let memo_enabled = self.dependency_memo_enabled();
        let mut deps_inputs: Vec<u32> = Vec::with_capacity(project_deps.len());

        for dep in project_deps {
            if !visited.insert(dep.as_str()) {
                continue;
            }

            if self.project_graph.nodes.contains_key(dep) {
                if memo_enabled {
                    let sub = self.memoized_dep_subtree(dep, input, external_deps_mapped)?;
                    if !sub.needs_legacy {
                        // Spliced subtrees skip per-node visited marking, so
                        // sibling deps with shared closures emit duplicates;
                        // the plan-level sort + dedup collapses them.
                        deps_inputs.extend_from_slice(&sub.ids);
                        continue;
                    }
                }
                let Some(dep_inputs) = get_inputs_for_dependency(
                    &self.project_graph.nodes[dep],
                    &self.nx_json,
                    input,
                )?
                else {
                    continue;
                };
                deps_inputs.extend(self.self_and_deps_inputs(
                    dep,
                    task,
                    &dep_inputs,
                    task_graph,
                    external_deps_mapped,
                    visited,
                )?);
            } else {
                // todo(jcammisuli): add a check to skip this when the new task hasher is ready, and when `AllExternalDependencies` is used
                if let Some(external_deps) = external_deps_mapped.get(dep) {
                    deps_inputs.push(pool.intern(HashInstruction::External(dep.to_string())));
                    deps_inputs.extend(
                        external_deps
                            .iter()
                            .map(|s| pool.intern(HashInstruction::External(s.to_string()))),
                    );
                }
            }
        }

        Ok(deps_inputs)
    }

    fn gather_self_inputs(
        &self,
        project_name: &str,
        self_inputs: &[Input],
    ) -> Vec<HashInstruction> {
        let (project_file_sets, workspace_file_sets): (Vec<&str>, Vec<&str>) = self_inputs
            .iter()
            .filter_map(|input| match input {
                Input::FileSet { fileset, .. } => Some(*fileset),
                _ => None,
            })
            .partition(|file_set| {
                file_set.starts_with("{projectRoot}/") || file_set.starts_with("!{projectRoot}/")
            });

        let project_root = &self.project_graph.nodes[project_name].root;

        let project_inputs = if project_file_sets.is_empty() {
            vec![
                HashInstruction::ProjectConfiguration(project_name.to_string()),
                HashInstruction::TsConfiguration(project_name.to_string()),
            ]
        } else {
            vec![
                HashInstruction::ProjectFileSet(
                    project_name.to_string(),
                    project_file_sets
                        .iter()
                        .map(|f| resolve_tokens(f, project_root, project_name))
                        .collect(),
                ),
                HashInstruction::ProjectConfiguration(project_name.to_string()),
                HashInstruction::TsConfiguration(project_name.to_string()),
            ]
        };

        let workspace_file_set_inputs = if workspace_file_sets.is_empty() {
            vec![]
        } else {
            vec![HashInstruction::WorkspaceFileSet(
                workspace_file_sets
                    .iter()
                    .map(|f| resolve_tokens(f, project_root, project_name))
                    .collect(),
            )]
        };
        let runtime_and_env_inputs = self_inputs.iter().filter_map(|i| match i {
            Input::Runtime(runtime) => Some(HashInstruction::Runtime(runtime.to_string())),
            Input::Environment(env) => Some(HashInstruction::Environment(env.to_string())),
            Input::WorkingDirectory(mode) => {
                let cwd_mode = match mode.to_lowercase().as_str() {
                    "absolute" => CwdMode::Absolute,
                    _ => CwdMode::Relative,
                };
                Some(HashInstruction::Cwd(cwd_mode))
            }
            Input::Json {
                json,
                fields,
                exclude_fields,
            } => {
                let proj_name = if json.starts_with("{projectRoot}") {
                    Some(project_name.to_string())
                } else {
                    None
                };
                Some(HashInstruction::JsonFileSet(Box::new(JsonFileSetInput {
                    project_name: proj_name,
                    json_path: resolve_tokens(json, project_root, project_name),
                    fields: fields.map(|f| f.to_vec()),
                    exclude_fields: exclude_fields.map(|f| f.to_vec()),
                })))
            }
            _ => None,
        });

        project_inputs
            .into_iter()
            .chain(workspace_file_set_inputs)
            .chain(runtime_and_env_inputs)
            .collect()
    }

    fn gather_dependency_outputs(
        &self,
        task: &Task,
        task_graph: &TaskGraph,
        deps_outputs: &[Input],
    ) -> anyhow::Result<Vec<HashInstruction>> {
        if deps_outputs.is_empty() {
            return Ok(vec![]);
        }

        let mut result: Vec<HashInstruction> = vec![];

        for dep in deps_outputs {
            let Input::DepsOutputs {
                dependent_tasks_output_files,
                transitive,
            } = dep
            else {
                continue;
            };
            result.extend(get_dep_output(
                task,
                task_graph,
                dependent_tasks_output_files,
                *transitive,
            )?);
        }

        Ok(result)
    }

    fn gather_project_inputs(
        &self,
        project_inputs: &[Input],
    ) -> anyhow::Result<Vec<HashInstruction>> {
        let mut result: Vec<HashInstruction> = vec![];
        for project in project_inputs {
            let Input::Projects { input, projects } = project else {
                continue;
            };
            let projects = find_matching_projects(projects, &self.project_graph)?;
            for project in projects {
                let named_inputs =
                    get_named_inputs(&self.nx_json, &self.project_graph.nodes[project]);
                let expanded_input = expand_single_project_inputs(
                    &vec![Input::Inputs {
                        input,
                        dependencies: false,
                    }],
                    &named_inputs,
                )?;
                result.extend(self.gather_self_inputs(project, &expanded_input))
            }
        }
        Ok(result)
    }
}

/// Resolves `{projectRoot}` and `{projectName}` tokens in a fileset pattern.
/// For root-level projects (project_root == "."), strips `{projectRoot}/` instead of
/// replacing with "." to avoid producing invalid paths like `./**/*`.
fn resolve_tokens(fileset: &str, project_root: &str, project_name: &str) -> String {
    let resolved = if project_root == "." {
        fileset.replace("{projectRoot}/", "")
    } else {
        fileset.replace("{projectRoot}", project_root)
    };
    resolved.replace("{projectName}", project_name)
}

fn find_external_dependency_node_name<'a>(
    package_name: &str,
    project_graph: &'a ProjectGraph,
) -> Option<&'a String> {
    let npm_name = format!("npm:{}", &package_name);
    if let Some((key, _)) = project_graph.external_nodes.get_key_value(package_name) {
        Some(key)
    } else if let Some((key, _)) = project_graph.external_nodes.get_key_value(&npm_name) {
        Some(key)
    } else {
        for (node_name, node) in project_graph.external_nodes.iter() {
            if let Some(pkg_name) = &node.package_name {
                if pkg_name.as_str() == package_name {
                    return Some(node_name);
                }
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::VisitedTracker;

    #[test]
    fn insert_reports_first_insertion_only() {
        let mut visited = VisitedTracker::new("seed");
        assert!(!visited.insert("seed"));
        assert!(visited.insert("a"));
        assert!(!visited.insert("a"));
    }

    #[test]
    fn rollback_unvisits_only_the_scope() {
        let mut visited = VisitedTracker::new("seed");
        assert!(visited.insert("outer"));

        let scope = visited.scope_start();
        assert!(visited.insert("inner1"));
        assert!(visited.insert("inner2"));
        visited.rollback_to(scope);

        // Scoped visits are undone; earlier ones are not.
        assert!(visited.insert("inner1"));
        assert!(!visited.insert("outer"));
        assert!(!visited.insert("seed"));
    }
}
