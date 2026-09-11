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
    /// graph and nx_json. Only consulted for acyclic dependency closures — see
    /// `dependency_memo_enabled`.
    subtree_memo: OnceCache<SubtreeResult>,
    /// Own-project instructions can be reused even when a cyclic closure must
    /// still be traversed for each task. Initialized only on that fallback.
    local_inputs_memo: OnceLock<OnceCache<LocalDependencyInputs>>,
    acyclic_dependency_projects: OnceLock<hashbrown::HashSet<String>>,
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

struct LocalDependencyInputs {
    ids: Vec<u32>,
    needs_legacy: bool,
}

/// A temporary union of dense pool ids. Merge dependency closures without
/// copying their repeated ids into a large Vec and sorting all occurrences.
/// The bitset is discarded once the exact-sized, sorted result is produced.
#[derive(Default)]
struct InstructionIdSet {
    words: Vec<u64>,
}

impl Extend<u32> for InstructionIdSet {
    fn extend<T: IntoIterator<Item = u32>>(&mut self, values: T) {
        for id in values {
            let word = id as usize / 64;
            if word >= self.words.len() {
                self.words.resize(word + 1, 0);
            }
            self.words[word] |= 1u64 << (id % 64);
        }
    }
}

impl FromIterator<u32> for InstructionIdSet {
    fn from_iter<T: IntoIterator<Item = u32>>(values: T) -> Self {
        let mut result = Self::default();
        result.extend(values);
        result
    }
}

impl InstructionIdSet {
    fn into_sorted_vec(self) -> Vec<u32> {
        let count = self
            .words
            .iter()
            .map(|word| word.count_ones() as usize)
            .sum();
        let mut result = Vec::with_capacity(count);
        for (word_index, mut word) in self.words.into_iter().enumerate() {
            while word != 0 {
                result.push(word_index as u32 * 64 + word.trailing_zeros());
                word &= word - 1;
            }
        }
        result
    }
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
        Self {
            nx_json,
            project_graph: Arc::clone(project_graph),
            external_deps_mapped: OnceLock::new(),
            subtree_memo: OnceCache::new(),
            local_inputs_memo: OnceLock::new(),
            acyclic_dependency_projects: OnceLock::new(),
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
            let mut external_deps = hashbrown::HashSet::new();
            trace!(
                "Add External Instruction for executor {existing_package}: {}",
                target.executor.as_ref().unwrap()
            );
            trace!(
                "Add External Instructions for dependencies of executor {existing_package}: {:?}",
                &external_deps_map[existing_package]
            );
            external_deps.insert(existing_package);
            external_deps.extend(&external_deps_map[existing_package]);
            Ok(Some(
                external_deps
                    .iter()
                    .map(|s| HashInstruction::External(s.to_string()))
                    .collect(),
            ))
        } else {
            let mut external_deps = hashbrown::HashSet::new();
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
                            external_deps.insert(external_node_name);
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

    /// A closure is safe to memoize only if no project in it reaches a cycle.
    /// This also prevents recursive OnceCell waits. Other projects retain the
    /// visited-scoped traversal even when they share acyclic dependencies.
    fn dependency_memo_enabled(&self, project: &str) -> bool {
        self.acyclic_dependency_projects
            .get_or_init(|| self.find_acyclic_dependency_projects())
            .contains(project)
    }

    fn find_acyclic_dependency_projects(&self) -> hashbrown::HashSet<String> {
        // Remove sinks and then their parents (reverse topological order).
        // Exactly the nodes that cannot reach a project cycle are removed.
        // Count repeated edges consistently and ignore external-node cycles.
        let mut remaining = hashbrown::HashMap::new();
        let mut parents: hashbrown::HashMap<&str, Vec<&str>> = hashbrown::HashMap::new();
        let mut ready = Vec::new();
        for project in self.project_graph.nodes.keys() {
            let mut count = 0;
            if let Some(deps) = self.project_graph.dependencies.get(project) {
                for dep in deps {
                    if self.project_graph.nodes.contains_key(dep) {
                        count += 1;
                        parents
                            .entry(dep.as_str())
                            .or_default()
                            .push(project.as_str());
                    }
                }
            }
            remaining.insert(project.as_str(), count);
            if count == 0 {
                ready.push(project.as_str());
            }
        }
        let mut acyclic = hashbrown::HashSet::new();
        while let Some(project) = ready.pop() {
            acyclic.insert(project.to_string());
            if let Some(dependents) = parents.get(project) {
                for parent in dependents {
                    let count = remaining.get_mut(parent).unwrap();
                    *count -= 1;
                    if *count == 0 {
                        ready.push(parent);
                    }
                }
            }
        }
        acyclic
    }

    fn memoized_dep_subtree(
        &self,
        dep: &str,
        input: &Input,
        external_deps_mapped: &HashMap<String, Vec<String>>,
    ) -> anyhow::Result<Arc<SubtreeResult>> {
        let cache_key = match input {
            Input::Inputs { input, .. } => prefixed_cache_key(dep, 'i', input),
            // Only `dependencies: true` filesets reach here, since that is what
            // get_inputs_for_dependency puts in deps_inputs.
            Input::FileSet { fileset, .. } => prefixed_cache_key(dep, 'f', fileset),
            // Other input kinds never reach dependencies (get_inputs_for_dependency
            // returns None for them), so they share one empty entry per project.
            _ => prefixed_cache_key(dep, 'n', ""),
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
        let mut ids: InstructionIdSet = self
            .gather_self_inputs(dep, &dep_inputs.self_inputs)
            .into_iter()
            .map(|instruction| pool.intern(instruction))
            .collect();

        // Deduplicate borrowed names before allocating or interning instructions.
        // Keep each memo entry self-contained so cache hits retain its externals.
        let mut external_inputs = hashbrown::HashSet::new();
        if let Some(child_input) = dep_inputs.deps_inputs.first() {
            for child in &self.project_graph.dependencies[dep] {
                if self.project_graph.nodes.contains_key(child) {
                    let sub =
                        self.memoized_dep_subtree(child, child_input, external_deps_mapped)?;
                    needs_legacy |= sub.needs_legacy;
                    ids.extend(sub.ids.iter().copied());
                } else if let Some(external_deps) = external_deps_mapped.get(child) {
                    external_inputs.insert(child);
                    external_inputs.extend(external_deps);
                }
            }
        }

        ids.extend(
            external_inputs
                .into_iter()
                .map(|s| pool.intern(HashInstruction::External(s.to_string()))),
        );
        let ids = ids.into_sorted_vec();

        Ok(SubtreeResult { ids, needs_legacy })
    }

    fn local_dependency_inputs(
        &self,
        dep: &str,
        input: &Input,
    ) -> anyhow::Result<Option<Arc<LocalDependencyInputs>>> {
        let Some(key) = local_input_cache_key(dep, input) else {
            return Ok(None);
        };
        self.local_inputs_memo
            .get_or_init(OnceCache::new)
            .get_or_try_init(key, || {
                let Some(inputs) = get_inputs_for_dependency(
                    &self.project_graph.nodes[dep],
                    &self.nx_json,
                    input,
                )?
                else {
                    return Ok(LocalDependencyInputs {
                        ids: vec![],
                        needs_legacy: true,
                    });
                };
                // Only cache canonical, task-independent expansion. Root-task
                // output resolution and unexpected propagation shapes keep their
                // original path. The initializer never follows project edges,
                // so cyclic graphs cannot introduce recursive cache waits.
                let same_propagation = match (input, inputs.deps_inputs.as_slice()) {
                    (
                        Input::Inputs { input: before, .. },
                        [
                            Input::Inputs {
                                input: after,
                                dependencies: true,
                            },
                        ],
                    ) => before == after,
                    (
                        Input::FileSet {
                            fileset: before,
                            dependencies: true,
                        },
                        [
                            Input::FileSet {
                                fileset: after,
                                dependencies: true,
                            },
                        ],
                    ) => before == after,
                    _ => false,
                };
                let needs_legacy = !same_propagation
                    || !inputs.deps_outputs.is_empty()
                    || !inputs.project_inputs.is_empty();
                let ids = if needs_legacy {
                    vec![]
                } else {
                    self.gather_self_inputs(dep, &inputs.self_inputs)
                        .into_iter()
                        .map(|instruction| self.instruction_pool.intern(instruction))
                        .collect()
                };
                Ok(LocalDependencyInputs { ids, needs_legacy })
            })
            .map(Some)
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

        let mut deps_inputs = InstructionIdSet::default();

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

        Ok(deps_inputs.into_sorted_vec())
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
        let mut deps_inputs = InstructionIdSet::default();
        // External membership is separate from project cycle detection, whose
        // scopes must still be rolled back independently for sibling inputs.
        let mut external_inputs = hashbrown::HashSet::new();

        // Keep one accumulator for this propagated input. Returning a vector
        // from every intermediate project repeatedly copies the same closure.
        // Saving parent iterators preserves depth-first visitation and errors;
        // the stack stays unallocated when subtree memoization answers directly.
        let mut children = project_deps.iter();
        let mut parents = Vec::new();
        loop {
            let Some(dep) = children.next() else {
                if let Some(parent) = parents.pop() {
                    children = parent;
                    continue;
                }
                break;
            };
            if !visited.insert(dep.as_str()) {
                continue;
            }

            if self.project_graph.nodes.contains_key(dep) {
                if self.dependency_memo_enabled(dep) {
                    let sub = self.memoized_dep_subtree(dep, input, external_deps_mapped)?;
                    if !sub.needs_legacy {
                        // Shared closures are unioned by id before allocation,
                        // without changing the per-input visitation rules.
                        deps_inputs.extend(sub.ids.iter().copied());
                        continue;
                    }
                }
                if let Some(local) = self.local_dependency_inputs(dep, input)? {
                    if !local.needs_legacy {
                        deps_inputs.extend(local.ids.iter().copied());
                        parents.push(children);
                        children = self.project_graph.dependencies[dep].iter();
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
                    external_inputs.insert(dep);
                    external_inputs.extend(external_deps);
                }
            }
        }

        deps_inputs.extend(
            external_inputs
                .into_iter()
                .map(|s| pool.intern(HashInstruction::External(s.to_string()))),
        );
        Ok(deps_inputs.into_sorted_vec())
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
                    [Input::Inputs {
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

/// Length-prefixing the project keeps arbitrary project and input strings
/// unambiguous, including ones containing the kind character.
fn prefixed_cache_key(dep: &str, kind: char, rest: &str) -> String {
    format!("{}:{dep}{kind}{rest}", dep.len())
}

/// Unsupported kinds are uncached.
fn local_input_cache_key(dep: &str, input: &Input) -> Option<String> {
    match input {
        Input::Inputs { input, .. } => Some(prefixed_cache_key(dep, 'i', input)),
        Input::FileSet {
            fileset,
            dependencies: true,
        } => Some(prefixed_cache_key(dep, 'f', fileset)),
        _ => None,
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
    // Most patterns have no project-name token. Keep the first allocation in
    // that case, preserving sequential substitution when the root adds a token.
    if resolved.contains("{projectName}") {
        resolved.replace("{projectName}", project_name)
    } else {
        resolved
    }
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
    use super::*;
    use crate::native::project_graph::types::{ExternalNode, Project, Target};

    fn mixed_cycle_planner(with_outputs: bool) -> HashPlanner {
        use crate::native::types::{DepsOutputsInput, JsInputs};
        use napi::bindgen_prelude::Either9;
        let edges = [
            ("app", vec!["cycle-a", "branch", "leaf"]),
            ("cycle-a", vec!["cycle-b", "branch"]),
            ("cycle-b", vec!["cycle-a", "leaf"]),
            ("branch", vec!["leaf", "leaf"]),
            ("leaf", vec!["npm:external"]),
            ("self-cycle", vec!["self-cycle"]),
            ("isolated", vec![]),
        ];
        let nodes = edges
            .iter()
            .map(|(name, _)| {
                let mut prod: Vec<JsInputs> = vec![Either9::B("{projectRoot}/prod".into())];
                if with_outputs && *name == "leaf" {
                    prod.push(Either9::G(DepsOutputsInput {
                        dependent_tasks_output_files: "**/*.js".into(),
                        transitive: Some(true),
                    }));
                }
                (
                    name.to_string(),
                    Project {
                        root: name.to_string(),
                        named_inputs: Some(HashMap::from([
                            ("prod".into(), prod),
                            ("spec".into(), vec![Either9::B("{projectRoot}/spec".into())]),
                        ])),
                        targets: HashMap::from([(
                            "build".into(),
                            Target {
                                inputs: Some(vec![
                                    Either9::B("default".into()),
                                    Either9::B("^prod".into()),
                                    Either9::B("^spec".into()),
                                ]),
                                ..Default::default()
                            },
                        )]),
                        ..Default::default()
                    },
                )
            })
            .collect();
        let mut dependencies: HashMap<String, Vec<String>> = edges
            .into_iter()
            .map(|(name, deps)| {
                (
                    name.to_string(),
                    deps.into_iter().map(str::to_string).collect(),
                )
            })
            .collect();
        dependencies.insert("npm:external".into(), vec!["npm:external".into()]);
        HashPlanner::new(
            NxJson { named_inputs: None },
            &External::new(Arc::new(ProjectGraph {
                nodes,
                dependencies,
                external_nodes: HashMap::from([(
                    "npm:external".into(),
                    ExternalNode {
                        package_name: Some("external".into()),
                        version: "1".into(),
                        hash: None,
                    },
                )]),
            })),
        )
    }

    #[test]
    fn only_project_closures_without_cycles_are_memoized() {
        let planner = mixed_cycle_planner(false);
        let safe = planner.find_acyclic_dependency_projects();
        assert_eq!(
            safe,
            hashbrown::HashSet::from(["branch".into(), "leaf".into(), "isolated".into()])
        );
        for name in planner.project_graph.nodes.keys() {
            assert_eq!(planner.dependency_memo_enabled(name), safe.contains(name));
        }
    }

    #[test]
    fn mixed_cycles_match_visited_traversal_with_multiple_inputs_and_output_fallback() {
        for with_outputs in [false, true] {
            let cached = mixed_cycle_planner(with_outputs);
            let legacy = mixed_cycle_planner(with_outputs);
            legacy
                .acyclic_dependency_projects
                .set(hashbrown::HashSet::new())
                .unwrap();
            // Force both optimizations off in the reference planner, retaining
            // the original visited traversal rather than comparing two cache paths.
            let local_cache = legacy.local_inputs_memo.get_or_init(OnceCache::new);
            for name in legacy.project_graph.nodes.keys() {
                for input in ["prod", "spec"] {
                    let input = Input::Inputs {
                        input,
                        dependencies: true,
                    };
                    local_cache
                        .get_or_try_init(local_input_cache_key(name, &input).unwrap(), || {
                            Ok::<_, ()>(LocalDependencyInputs {
                                ids: vec![],
                                needs_legacy: true,
                            })
                        })
                        .unwrap();
                }
            }
            let tasks = || {
                let tasks: HashMap<_, _> = cached
                    .project_graph
                    .nodes
                    .keys()
                    .map(|name| {
                        let task =
                            Task::new(name, "build").with_outputs(vec![format!("{name}/out.js")]);
                        (task.id.clone(), task)
                    })
                    .collect();
                TaskGraph {
                    roots: tasks.keys().cloned().collect(),
                    dependencies: tasks
                        .keys()
                        .map(|id| {
                            (
                                id.clone(),
                                if id == "app:build" {
                                    vec!["leaf:build".to_string()]
                                } else {
                                    vec![]
                                },
                            )
                        })
                        .collect(),
                    continuous_dependencies: HashMap::new(),
                    tasks,
                }
            };
            let mut ids: Vec<_> = tasks().tasks.keys().cloned().collect();
            let expected = legacy
                .get_plans_materialized(ids.iter().map(String::as_str).collect(), tasks())
                .unwrap();
            for _ in 0..3 {
                ids.reverse();
                assert_eq!(
                    cached
                        .get_plans_materialized(ids.iter().map(String::as_str).collect(), tasks())
                        .unwrap(),
                    expected
                );
            }
            for id in &ids {
                assert_eq!(
                    cached.get_plans_materialized(vec![id], tasks()).unwrap()[id],
                    expected[id]
                );
            }
        }
    }

    #[test]
    fn local_input_cache_is_non_recursive_and_retains_output_fallback() {
        let planner = mixed_cycle_planner(true);
        let input = Input::Inputs {
            input: "prod",
            dependencies: true,
        };
        let first = planner
            .local_dependency_inputs("cycle-a", &input)
            .unwrap()
            .unwrap();
        let second = planner
            .local_dependency_inputs("cycle-a", &input)
            .unwrap()
            .unwrap();
        assert!(Arc::ptr_eq(&first, &second));
        assert!(!first.needs_legacy);
        assert_eq!(first.ids.len(), 3);
        for id in &first.ids {
            match planner.instruction_pool.get(*id).value() {
                HashInstruction::ProjectConfiguration(name)
                | HashInstruction::TsConfiguration(name)
                | HashInstruction::ProjectFileSet(name, _) => assert_eq!(name, "cycle-a"),
                other => panic!("Unexpected local instruction: {other:?}"),
            }
        }
        assert_eq!(planner.local_inputs_memo.get().unwrap().len(), 1);
        assert_eq!(planner.subtree_memo.len(), 0);
        let output = planner
            .local_dependency_inputs("leaf", &input)
            .unwrap()
            .unwrap();
        assert!(output.needs_legacy);
        assert!(output.ids.is_empty());
    }

    #[test]
    fn local_input_keys_preserve_boundaries_and_input_kinds() {
        let named = |input| Input::Inputs {
            input,
            dependencies: true,
        };
        assert_ne!(
            local_input_cache_key("a", &named("b\0i\0c")),
            local_input_cache_key("a\0i\0b", &named("c"))
        );
        assert_ne!(
            local_input_cache_key("a", &named("{projectRoot}/file")),
            local_input_cache_key(
                "a",
                &Input::FileSet {
                    fileset: "{projectRoot}/file",
                    dependencies: true
                }
            )
        );
        assert!(
            local_input_cache_key(
                "a",
                &Input::FileSet {
                    fileset: "{projectRoot}/file",
                    dependencies: false
                }
            )
            .is_none()
        );
        assert!(local_input_cache_key("a", &Input::String("default")).is_none());
    }

    #[test]
    fn token_resolution_preserves_root_and_sequential_substitution() {
        for (pattern, root, name) in [
            ("!{projectRoot}/**/*", ".", "app"),
            ("{projectRoot}", ".", "app"),
            ("{workspaceRoot}/file", "libs/app", "app"),
            (
                "{projectRoot}/{projectName}/{projectRoot}",
                "libs/{projectName}",
                "app",
            ),
            ("{projectRoot}/{projectName}", "libs/app", "{projectRoot}"),
        ] {
            let old = if root == "." {
                pattern.replace("{projectRoot}/", "")
            } else {
                pattern.replace("{projectRoot}", root)
            }
            .replace("{projectName}", name);
            assert_eq!(resolve_tokens(pattern, root, name), old);
        }
    }

    #[test]
    fn instruction_union_preserves_ids_across_word_boundaries() {
        let values = vec![1024, 0, 63, 64, 65, 127, 128, 63, 1024, 1, 0];
        let mut expected = values.clone();
        expected.sort_unstable();
        expected.dedup();
        let mut set: InstructionIdSet = values.into_iter().collect();
        set.extend([128, 65, 0]);
        assert_eq!(set.into_sorted_vec(), expected);
        assert!(InstructionIdSet::default().into_sorted_vec().is_empty());
    }

    #[test]
    fn overlapping_project_closures_retain_only_unique_instruction_capacity() {
        let branches: Vec<String> = (0..20).map(|i| format!("branch-{i}")).collect();
        let leaves: Vec<String> = (0..30).map(|i| format!("leaf-{i}")).collect();
        let names: Vec<String> = std::iter::once("app".to_string())
            .chain(branches.iter().cloned())
            .chain(leaves.iter().cloned())
            .collect();
        let mut dependencies = HashMap::from([("app".to_string(), branches.clone())]);
        for branch in &branches {
            dependencies.insert(branch.clone(), leaves.clone());
        }
        for leaf in &leaves {
            dependencies.insert(leaf.clone(), vec![]);
        }
        let graph = ProjectGraph {
            nodes: names
                .iter()
                .map(|name| {
                    (
                        name.clone(),
                        Project {
                            root: name.clone(),
                            targets: HashMap::from([("build".to_string(), Target::default())]),
                            ..Default::default()
                        },
                    )
                })
                .collect(),
            dependencies,
            external_nodes: HashMap::new(),
        };
        let planner = HashPlanner::new(
            NxJson { named_inputs: None },
            &External::new(Arc::new(graph)),
        );
        let subtree = planner
            .memoized_dep_subtree(
                "app",
                &Input::Inputs {
                    input: "default",
                    dependencies: true,
                },
                &HashMap::new(),
            )
            .unwrap();
        assert!(!subtree.needs_legacy);
        let projects = subtree
            .ids
            .iter()
            .filter(|id| {
                matches!(
                    planner.instruction_pool.get(**id).value(),
                    HashInstruction::ProjectConfiguration(_)
                )
            })
            .count();
        assert_eq!(projects, names.len());
        assert!(subtree.ids.windows(2).all(|ids| ids[0] < ids[1]));
        assert!(
            subtree.ids.capacity() <= subtree.ids.len() * 2,
            "{} unique instructions retained {} slots",
            subtree.ids.len(),
            subtree.ids.capacity()
        );
    }

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

    #[test]
    fn overlapping_external_closures_retain_capacity_proportional_to_unique_inputs() {
        let direct_count = 50;
        let shared_count = 100;
        let direct: Vec<String> = (0..direct_count)
            .map(|i| format!("npm:direct-{i}"))
            .collect();
        let shared: Vec<String> = (0..shared_count)
            .map(|i| format!("npm:shared-{i}"))
            .collect();
        let mut dependencies = HashMap::from([("app".to_string(), direct.clone())]);
        for dep in &direct {
            dependencies.insert(dep.clone(), shared.clone());
        }
        let graph = ProjectGraph {
            nodes: HashMap::from([(
                "app".to_string(),
                Project {
                    root: "app".to_string(),
                    targets: HashMap::from([("build".to_string(), Target::default())]),
                    ..Default::default()
                },
            )]),
            dependencies,
            external_nodes: direct
                .into_iter()
                .chain(shared)
                .map(|name| {
                    (
                        name,
                        ExternalNode {
                            package_name: None,
                            version: "1.0.0".to_string(),
                            hash: None,
                        },
                    )
                })
                .collect(),
        };
        let planner = HashPlanner::new(
            NxJson { named_inputs: None },
            &External::new(Arc::new(graph)),
        );
        let task = Task::new("app", "build");
        let task_graph = TaskGraph {
            roots: vec![task.id.clone()],
            tasks: HashMap::from([(task.id.clone(), task)]),
            dependencies: HashMap::new(),
            continuous_dependencies: HashMap::new(),
        };
        let plans = planner
            .get_plans_internal(vec!["app:build"], task_graph)
            .unwrap();
        let plan = &plans.plans["app:build"];
        assert_eq!(
            plan.iter()
                .filter(|id| matches!(plans.pool.get(**id).value(), HashInstruction::External(_)))
                .count(),
            direct_count + shared_count
        );
        // Vec::dedup alone leaves storage for all 5,050 external occurrences.
        // Bound retained storage without depending on exact allocator growth.
        assert!(
            plan.capacity() <= plan.len() * 2,
            "{} unique instructions retained {} slots",
            plan.len(),
            plan.capacity()
        );
    }
}
