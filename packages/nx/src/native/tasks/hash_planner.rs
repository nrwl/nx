use crate::native::tasks::{
    dep_outputs::{collect_continuous_dependencies, get_dep_output},
    types::{
        ALWAYS_ON_WORKSPACE_FILES, CwdMode, HashInstruction, HashPlans, InstructionPool,
        JsonFileSetInput, TaskGraph,
    },
};
use crate::native::types::{Input, NxJson};
use crate::native::{
    project_graph::types::ProjectGraph,
    tasks::{inputs::SplitInputs, types::Task},
};
use itertools::Itertools;
use napi::bindgen_prelude::{ClassInstance, External};
use rayon::prelude::*;
use std::collections::{BTreeMap, HashMap, HashSet};
use tracing::trace;

use crate::native::glob::{
    NxGlobSet, NxGlobSetBuilder, expand_literal_braces, normalize_glob, partition_glob,
};
use crate::native::io_snapshots::IoSnapshots;
use crate::native::tasks::hashers::{OnceCache, validate_files_globs};
use crate::native::tasks::inputs::{
    expand_single_project_inputs, get_inputs, get_inputs_for_dependency_group, get_named_inputs,
};
use crate::native::tasks::snapshot_eligibility::{
    self, EligibilityInputs, IoSnapshotEligibilityOptions, SnapshotTask,
};
use crate::native::tasks::utils;
use crate::native::utils::find_matching_projects;
use std::sync::{Arc, OnceLock};

fn io_snapshot_digest_input(digest: &str) -> HashInstruction {
    HashInstruction::IoSnapshot(digest.to_string())
}

/// (project, workspace-relative negated pattern) pairs declared by the
/// projects a task's plan visits. Snapshot globs are filtered by them at hash
/// time, so removing a negation re-admits the observed reads it excluded.
type Negations = Vec<(String, String)>;

const ROOT_TSCONFIG_FILES: [&str; 2] = ["tsconfig.base.json", "tsconfig.json"];
/// Hashed by the always-on workspace fileset every plan carries.
const ALWAYS_ON_FILES: [&str; 3] = ["nx.json", ".gitignore", ".nxignore"];
const LOCKFILES: [&str; 6] = [
    "package-lock.json",
    "npm-shrinkwrap.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lock",
    "bun.lockb",
];

/// A task's snapshot plus a matcher over its observed reads, used to decide
/// whether a class-mapped file (root tsconfig, a declared `{json}` file) was
/// actually read. An unparsable glob keeps the native instruction (conservative).
struct SnapshotContext<'a> {
    io: &'a SnapshotTask,
    /// Observed reads that name one path outright, answered without a matcher.
    literal: HashSet<&'a str>,
    /// Matcher over the observed reads that are real globs; `None` when there are none.
    observed: Option<NxGlobSet>,
    /// A glob failed to parse: treat every class-mapped file as read so the
    /// native instruction is kept.
    unparsable: bool,
}

impl<'a> SnapshotContext<'a> {
    fn new(io: &'a SnapshotTask) -> Self {
        let mut literal = HashSet::new();
        let mut patterns: Vec<&str> = Vec::new();
        for glob in io.files.iter().map(String::as_str) {
            if glob.starts_with('!') {
                continue;
            }
            if snapshot_eligibility::is_literal_path(glob) {
                literal.insert(glob);
            } else {
                patterns.push(glob);
            }
        }
        if patterns.is_empty() {
            return Self {
                io,
                literal,
                observed: None,
                unparsable: false,
            };
        }
        match NxGlobSetBuilder::new(&patterns).and_then(|b| b.build()) {
            Ok(set) => Self {
                io,
                literal,
                observed: Some(set),
                unparsable: false,
            },
            Err(_) => Self {
                io,
                literal,
                observed: None,
                unparsable: true,
            },
        }
    }

    fn read(&self, path: &str) -> bool {
        self.literal.contains(path)
            || match &self.observed {
                Some(set) => set.is_match(path),
                None => self.unparsable,
            }
    }

    fn root_tsconfig_read(&self) -> bool {
        ROOT_TSCONFIG_FILES.iter().any(|f| self.read(f))
    }
}

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
    /// Project name by root, for attributing observed reads to their owner.
    project_by_root: OnceLock<HashMap<String, String>>,
    /// Interner backing every plan this planner produces.
    instruction_pool: Arc<InstructionPool>,
}

/// Instruction ids contributed by one (project, propagated input) dependency subtree.
struct SubtreeResult {
    ids: Vec<u32>,
    negations: Negations,
    /// True when the subtree cannot be spliced from the memo: it contains
    /// deps-outputs inputs (whose resolution depends on the root task) or an
    /// unexpected propagation shape. Callers must use the per-task traversal.
    needs_legacy: bool,
}

struct LocalDependencyInputs {
    ids: Vec<u32>,
    negations: Negations,
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
            project_by_root: OnceLock::new(),
            instruction_pool: Arc::new(InstructionPool::new()),
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

    pub fn get_plans_internal(
        &self,
        task_ids: Vec<&str>,
        task_graph: TaskGraph,
        snapshots: Option<&IoSnapshots>,
        custom_hasher_task_ids: &[String],
        opted_out_task_ids: &[String],
    ) -> anyhow::Result<HashPlans> {
        let function_start = std::time::Instant::now();
        let snapshot_tasks = snapshots.map(|snapshots| {
            snapshot_eligibility::resolve_scoped(
                snapshots,
                &task_graph,
                &self.eligibility_inputs(
                    &task_graph,
                    custom_hasher_task_ids,
                    opted_out_task_ids,
                    Some(&task_ids),
                ),
                Some(&task_ids),
            )
            .tasks
        });

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
                let always_on_id = pool.intern(HashInstruction::WorkspaceFileSet(
                    ALWAYS_ON_WORKSPACE_FILES
                        .iter()
                        .map(|f| f.to_string())
                        .collect(),
                ));
                let mut ids: Vec<u32> = target
                    .unwrap_or(vec![])
                    .into_iter()
                    .chain(vec![HashInstruction::Environment(
                        "NX_CLOUD_ENCRYPTION_KEY".into(),
                    )])
                    .map(|instruction| pool.intern(instruction))
                    .chain([always_on_id])
                    .collect();

                let snapshot = snapshot_tasks
                    .as_ref()
                    .and_then(|tasks| tasks.get(*id))
                    .map(SnapshotContext::new);
                let mut negations: Negations = Vec::new();
                ids.extend(self.self_and_deps_inputs(
                    &task.target.project,
                    task,
                    &inputs,
                    &task_graph,
                    external_deps_mapped,
                    &mut VisitedTracker::new(task.target.project.as_str()),
                    snapshot.as_ref(),
                    snapshot.as_ref().map(|_| &mut negations),
                )?);

                if let Some(snapshot) = &snapshot {
                    // Declared filesets anywhere in the plan (self, deps,
                    // {input, projects}) are replaced by the observed reads;
                    // TsConfiguration survives only if the root tsconfig was read.
                    let keep_tsconfig = snapshot.root_tsconfig_read();
                    let own: hashbrown::HashSet<u32> = self
                        .snapshot_file_instructions(task, snapshot, &negations)
                        .into_iter()
                        .map(|instruction| pool.intern(instruction))
                        .collect();
                    ids.retain(|id| {
                        *id == always_on_id
                            || own.contains(id)
                            || !pool.replaced_by_snapshot(*id, keep_tsconfig)
                    });
                    ids.extend(own);
                }

                // A continuous dependency serves this task from its own process, so
                // its declared inputs and externals are hashed here, and its own
                // servers' in turn. When it reads its builds' outputs, those land in
                // this plan too, which holds the task back from the up-front batch.
                for dep_task in collect_continuous_dependencies(&task_graph, id) {
                    let dep_inputs = get_inputs(dep_task, &self.project_graph, &self.nx_json)?;
                    ids.extend(
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
                    ids.extend(self.self_and_deps_inputs(
                        &dep_task.target.project,
                        dep_task,
                        &dep_inputs,
                        &task_graph,
                        external_deps_mapped,
                        &mut VisitedTracker::new(dep_task.target.project.as_str()),
                        None,
                        None,
                    )?);
                }

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
        snapshots: Option<&IoSnapshots>,
        custom_hasher_task_ids: &[String],
        opted_out_task_ids: &[String],
    ) -> anyhow::Result<HashMap<String, Vec<HashInstruction>>> {
        let hash_plans = self.get_plans_internal(
            task_ids,
            task_graph,
            snapshots,
            custom_hasher_task_ids,
            opted_out_task_ids,
        )?;
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

    /// `snapshots` is this run's I/O snapshot bundle; a task with an eligible
    /// entry hashes its observed reads instead of its declared filesets.
    /// `options` carries the task ids decided in JS, where executors and
    /// target configuration are resolved.
    #[napi(ts_return_type = "Record<string, string[]>")]
    pub fn get_plans(
        &self,
        task_ids: Vec<String>,
        task_graph: TaskGraph,
        snapshots: Option<ClassInstance<'_, IoSnapshots>>,
        options: Option<IoSnapshotEligibilityOptions>,
    ) -> anyhow::Result<HashMap<String, Vec<HashInstruction>>> {
        let task_ids: Vec<&str> = task_ids.iter().map(|s| s.as_str()).collect();
        let options = options.unwrap_or_default();
        self.get_plans_materialized(
            task_ids,
            task_graph,
            snapshots.as_deref(),
            options.custom_hasher_task_ids.as_deref().unwrap_or(&[]),
            options.opted_out_task_ids.as_deref().unwrap_or(&[]),
        )
    }

    #[napi(ts_return_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
    pub fn get_plans_reference(
        &self,
        task_ids: Vec<String>,
        task_graph: TaskGraph,
        snapshots: Option<ClassInstance<'_, IoSnapshots>>,
        options: Option<IoSnapshotEligibilityOptions>,
    ) -> anyhow::Result<External<HashPlans>> {
        let task_ids: Vec<&str> = task_ids.iter().map(|s| s.as_str()).collect();
        let options = options.unwrap_or_default();
        let plans = self.get_plans_internal(
            task_ids,
            task_graph,
            snapshots.as_deref(),
            options.custom_hasher_task_ids.as_deref().unwrap_or(&[]),
            options.opted_out_task_ids.as_deref().unwrap_or(&[]),
        )?;
        Ok(External::new(plans))
    }

    /// What the eligibility walk needs from this planner's graph and nx.json.
    /// `scope` limits the declared-glob validation to those tasks; eligibility
    /// is per task, so a call planning one task pays for one.
    fn eligibility_inputs(
        &self,
        task_graph: &TaskGraph,
        custom_hasher_task_ids: &[String],
        opted_out_task_ids: &[String],
        scope: Option<&[&str]>,
    ) -> EligibilityInputs {
        let mut inputs = EligibilityInputs {
            custom_hasher: custom_hasher_task_ids.iter().cloned().collect(),
            opted_out: opted_out_task_ids.iter().cloned().collect(),
            ..Default::default()
        };
        let scoped: Vec<(&String, &Task)> = match scope {
            Some(ids) => ids
                .iter()
                .filter_map(|id| task_graph.tasks.get_key_value(*id))
                .collect(),
            None => task_graph.tasks.iter().collect(),
        };
        for (task_id, task) in scoped {
            if !inputs.opted_out.contains(task_id) && self.declared_files_invalid(task) {
                inputs.invalid_files_input.insert(task_id.clone());
            }
        }
        inputs
    }

    /// A declared `includeIgnored` group the hasher would reject is a native
    /// error; a snapshot must not turn it into a plan with a hole. The plain
    /// planner is the judge, so its group rules apply here unchanged.
    fn declared_files_invalid(&self, task: &Task) -> bool {
        let Ok(inputs) = get_inputs(task, &self.project_graph, &self.nx_json) else {
            return false;
        };
        // Only an includeIgnored group can fail there, so the rest skip it.
        let declares_ignored = inputs.self_inputs.iter().any(|input| {
            matches!(
                input,
                Input::FileSet {
                    include_ignored: true,
                    ..
                }
            )
        });
        declares_ignored
            && self
                .gather_self_inputs(&task.target.project, &inputs.self_inputs, None)
                .is_err()
    }

    /// Observed reads minus natively covered files, one disk-backed group per
    /// owning project (else the `.` project, else the task's), each with only
    /// that project's declared negations; plus the entry digest.
    fn snapshot_file_instructions(
        &self,
        task: &Task,
        snapshot: &SnapshotContext,
        negations: &Negations,
    ) -> Vec<HashInstruction> {
        let io = snapshot.io;
        let self_project = task.target.project.as_str();

        // The deepest ancestor directory that is a project root wins. A project
        // rooted at "." cannot be prefix-matched, so it is the fallback owner.
        let project_by_root = self.project_by_root();
        let unowned = self
            .project_graph
            .nodes
            .iter()
            .find(|(_, project)| project.root == ".")
            .map(|(name, _)| name.as_str())
            .unwrap_or(self_project);
        let owner = |glob: &str| -> &str {
            let mut dir = glob.strip_prefix('!').unwrap_or(glob);
            while let Some(cut) = dir.rfind('/') {
                dir = &dir[..cut];
                if let Some(name) = project_by_root.get(dir) {
                    return name.as_str();
                }
            }
            unowned
        };

        // Bundles collapse sibling files into brace groups; class mapping needs
        // the individual names, so observed groups of literals are expanded.
        let mut buckets: BTreeMap<&str, Vec<String>> = BTreeMap::new();
        for glob in io
            .files
            .iter()
            .flat_map(|glob| expand_literal_braces(glob))
            .filter(|glob| !covered_by_native_instruction(glob))
        {
            buckets.entry(owner(&glob)).or_default().push(glob);
        }

        let mut instructions = Vec::new();
        for (project, mut group) in buckets {
            group.sort();
            group.dedup();
            let mut declared_negations: Vec<String> = negations
                .iter()
                .filter(|(p, _)| p == project)
                .map(|(_, pattern)| pattern.clone())
                .collect();
            declared_negations.sort();
            declared_negations.dedup();
            group.extend(declared_negations);
            instructions.push(HashInstruction::IgnoredFileSet(group));
        }
        instructions.push(io_snapshot_digest_input(&io.digest));
        instructions
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
        snapshot: Option<&SnapshotContext>,
        mut negations: Option<&mut Negations>,
    ) -> anyhow::Result<Vec<u32>> {
        let pool = &self.instruction_pool;
        let project_deps = &self.project_graph.dependencies[project_name];

        if let Some(negations) = negations.as_deref_mut() {
            collect_negations(
                project_name,
                &self.project_graph,
                &inputs.self_inputs,
                negations,
            );
        }

        let mut ids: Vec<u32> = self
            .gather_self_inputs(project_name, &inputs.self_inputs, snapshot)?
            .into_iter()
            .map(|instruction| pool.intern(instruction))
            .collect();
        if snapshot.is_none() {
            // Both are file inputs; with a snapshot, reads of other tasks'
            // outputs are observed reads and {input, projects} filesets are
            // part of the replaced set.
            ids.extend(
                self.gather_dependency_outputs(task, task_graph, &inputs.deps_outputs)?
                    .into_iter()
                    .chain(self.gather_project_inputs(&inputs.project_inputs)?)
                    .map(|instruction| pool.intern(instruction)),
            );
        }

        ids.extend(self.gather_dependency_inputs(
            task,
            &inputs.deps_inputs,
            task_graph,
            project_deps,
            external_deps_mapped,
            visited,
            negations,
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
        inputs: &[Input],
        external_deps_mapped: &HashMap<String, Vec<String>>,
    ) -> anyhow::Result<Arc<SubtreeResult>> {
        let cache_key = group_cache_key(dep, inputs);
        self.subtree_memo.get_or_try_init(cache_key, || {
            self.compute_dep_subtree(dep, inputs, external_deps_mapped)
        })
    }

    fn compute_dep_subtree(
        &self,
        dep: &str,
        inputs: &[Input],
        external_deps_mapped: &HashMap<String, Vec<String>>,
    ) -> anyhow::Result<SubtreeResult> {
        let Some(dep_inputs) =
            get_inputs_for_dependency_group(&self.project_graph.nodes[dep], &self.nx_json, inputs)?
        else {
            return Ok(SubtreeResult {
                ids: vec![],
                negations: vec![],
                needs_legacy: false,
            });
        };

        // Deps-outputs resolution depends on the root task; a propagation that
        // does not carry the group forward is unexpected — both fall back.
        let mut needs_legacy =
            !dep_inputs.deps_outputs.is_empty() || dep_inputs.deps_inputs.len() != inputs.len();
        let pool = &self.instruction_pool;
        let mut negations: Negations = Vec::new();
        collect_negations(
            dep,
            &self.project_graph,
            &dep_inputs.self_inputs,
            &mut negations,
        );
        let mut ids: InstructionIdSet = self
            .gather_self_inputs(dep, &dep_inputs.self_inputs, None)?
            .into_iter()
            .map(|instruction| pool.intern(instruction))
            .collect();

        // Deduplicate borrowed names before allocating or interning instructions.
        // Keep each memo entry self-contained so cache hits retain its externals.
        let mut external_inputs = hashbrown::HashSet::new();
        if !dep_inputs.deps_inputs.is_empty() {
            for child in &self.project_graph.dependencies[dep] {
                if self.project_graph.nodes.contains_key(child) {
                    let sub = self.memoized_dep_subtree(
                        child,
                        &dep_inputs.deps_inputs,
                        external_deps_mapped,
                    )?;
                    needs_legacy |= sub.needs_legacy;
                    ids.extend(sub.ids.iter().copied());
                    negations.extend_from_slice(&sub.negations);
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
        negations.sort();
        negations.dedup();

        Ok(SubtreeResult {
            ids,
            negations,
            needs_legacy,
        })
    }

    fn local_dependency_inputs(
        &self,
        dep: &str,
        group: &[Input],
    ) -> anyhow::Result<Option<Arc<LocalDependencyInputs>>> {
        let Some(key) = local_input_cache_key(dep, group) else {
            return Ok(None);
        };
        self.local_inputs_memo
            .get_or_init(OnceCache::new)
            .get_or_try_init(key, || {
                let Some(inputs) = get_inputs_for_dependency_group(
                    &self.project_graph.nodes[dep],
                    &self.nx_json,
                    group,
                )?
                else {
                    return Ok(LocalDependencyInputs {
                        ids: vec![],
                        negations: vec![],
                        needs_legacy: true,
                    });
                };
                // Only cache canonical, task-independent expansion. Root-task
                // output resolution and unexpected propagation shapes keep their
                // original path. The initializer never follows project edges,
                // so cyclic graphs cannot introduce recursive cache waits.
                let same_propagation = group.len() == inputs.deps_inputs.len()
                    && group
                        .iter()
                        .zip(inputs.deps_inputs.iter())
                        .all(|(before, after)| propagates_unchanged(before, after));
                let needs_legacy = !same_propagation
                    || !inputs.deps_outputs.is_empty()
                    || !inputs.project_inputs.is_empty();
                let mut negations: Negations = Vec::new();
                let ids = if needs_legacy {
                    vec![]
                } else {
                    collect_negations(
                        dep,
                        &self.project_graph,
                        &inputs.self_inputs,
                        &mut negations,
                    );
                    self.gather_self_inputs(dep, &inputs.self_inputs, None)?
                        .into_iter()
                        .map(|instruction| self.instruction_pool.intern(instruction))
                        .collect()
                };
                Ok(LocalDependencyInputs {
                    ids,
                    negations,
                    needs_legacy,
                })
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
        mut negations: Option<&mut Negations>,
    ) -> anyhow::Result<Vec<u32>> {
        if inputs.len() == 1 {
            return self.gather_dependency_input(
                task,
                inputs,
                task_graph,
                project_deps,
                external_deps_mapped,
                visited,
                negations,
            );
        }

        let mut deps_inputs = InstructionIdSet::default();

        // Scope cycle detection to each propagated unit so siblings all apply to
        // the same dependency, rolling its visits back instead of cloning the
        // set. The `includeIgnored` filesets are one unit: they resolve together
        // against each dependency, so a negation filters that group's positives.
        let ignored_group = ignored_dep_fileset_group(inputs);
        let group_first = ignored_group.len() > 1;
        if group_first {
            let scope = visited.scope_start();
            deps_inputs.extend(self.gather_dependency_input(
                task,
                &ignored_group,
                task_graph,
                project_deps,
                external_deps_mapped,
                visited,
                negations.as_deref_mut(),
            )?);
            visited.rollback_to(scope);
        }

        for input in inputs {
            if group_first && is_ignored_dep_fileset(input) {
                continue;
            }
            let scope = visited.scope_start();
            deps_inputs.extend(self.gather_dependency_input(
                task,
                std::slice::from_ref(input),
                task_graph,
                project_deps,
                external_deps_mapped,
                visited,
                negations.as_deref_mut(),
            )?);
            visited.rollback_to(scope);
        }

        Ok(deps_inputs.into_sorted_vec())
    }

    fn gather_dependency_input<'a>(
        &'a self,
        task: &Task,
        inputs: &[Input],
        task_graph: &TaskGraph,
        project_deps: &'a [String],
        external_deps_mapped: &'a HashMap<String, Vec<String>>,
        visited: &mut VisitedTracker<'a>,
        mut negations: Option<&mut Negations>,
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
                    let sub = self.memoized_dep_subtree(dep, inputs, external_deps_mapped)?;
                    if !sub.needs_legacy {
                        // Shared closures are unioned by id before allocation,
                        // without changing the per-input visitation rules.
                        deps_inputs.extend(sub.ids.iter().copied());
                        if let Some(negations) = negations.as_deref_mut() {
                            negations.extend_from_slice(&sub.negations);
                        }
                        continue;
                    }
                }
                if let Some(local) = self.local_dependency_inputs(dep, inputs)? {
                    if !local.needs_legacy {
                        deps_inputs.extend(local.ids.iter().copied());
                        if let Some(negations) = negations.as_deref_mut() {
                            negations.extend_from_slice(&local.negations);
                        }
                        parents.push(children);
                        children = self.project_graph.dependencies[dep].iter();
                        continue;
                    }
                }
                let Some(dep_inputs) = get_inputs_for_dependency_group(
                    &self.project_graph.nodes[dep],
                    &self.nx_json,
                    inputs,
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
                    None,
                    negations.as_deref_mut(),
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
        snapshot: Option<&SnapshotContext>,
    ) -> anyhow::Result<Vec<HashInstruction>> {
        if let Some(snapshot) = snapshot {
            return Ok(self.gather_self_inputs_from_snapshot(project_name, self_inputs, snapshot));
        }
        // `includeIgnored` filesets hash from disk as one aggregated group, so
        // a negation filters across entries; the rest read the file map.
        let mut file_sets = self_inputs
            .iter()
            .filter_map(|input| match input {
                Input::FileSet {
                    fileset,
                    include_ignored,
                    ..
                } => Some((FileSetStore::of(fileset, *include_ignored), *fileset)),
                _ => None,
            })
            .into_group_map();
        let ignored_file_sets = file_sets.remove(&FileSetStore::Disk).unwrap_or_default();
        let project_file_sets = file_sets.remove(&FileSetStore::Project).unwrap_or_default();
        let workspace_file_sets = file_sets
            .remove(&FileSetStore::Workspace)
            .unwrap_or_default();

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
        let disk_backed_inputs = if ignored_file_sets.is_empty() {
            vec![]
        } else {
            let resolved: Vec<String> = ignored_file_sets
                .iter()
                .map(|f| resolve_files_glob(f, project_root, project_name))
                .collect();
            validate_files_globs(project_name, &resolved)?;
            vec![HashInstruction::IgnoredFileSet(resolved)]
        };
        let runtime_and_env_inputs =
            self.runtime_env_cwd_json_inputs(project_name, self_inputs, None);

        Ok(project_inputs
            .into_iter()
            .chain(workspace_file_set_inputs)
            .chain(disk_backed_inputs)
            .chain(runtime_and_env_inputs)
            .collect())
    }

    /// The self inputs of a snapshot-hashed project: the trace replaces its
    /// declared filesets, so only the configuration, tsconfig, disk-backed
    /// groups (which hash from disk regardless of the trace) and the
    /// non-file inputs remain. Whether TsConfiguration stays is decided by the
    /// caller's replacement pass.
    fn gather_self_inputs_from_snapshot(
        &self,
        project_name: &str,
        self_inputs: &[Input],
        snapshot: &SnapshotContext,
    ) -> Vec<HashInstruction> {
        let project_root = &self.project_graph.nodes[project_name].root;
        let mut instructions = vec![
            HashInstruction::ProjectConfiguration(project_name.to_string()),
            HashInstruction::TsConfiguration(project_name.to_string()),
        ];
        let ignored: Vec<String> = self_inputs
            .iter()
            .filter_map(|input| match input {
                Input::FileSet {
                    fileset,
                    include_ignored: true,
                    ..
                } => Some(resolve_files_glob(fileset, project_root, project_name)),
                _ => None,
            })
            .collect();
        if !ignored.is_empty() {
            instructions.push(HashInstruction::IgnoredFileSet(ignored));
        }
        instructions.extend(self.runtime_env_cwd_json_inputs(
            project_name,
            self_inputs,
            Some(snapshot),
        ));
        instructions
    }

    /// With a snapshot, a declared `{json}` file counts only if the trace
    /// read it: the observed reads are the file inputs now.
    fn runtime_env_cwd_json_inputs(
        &self,
        project_name: &str,
        self_inputs: &[Input],
        snapshot: Option<&SnapshotContext>,
    ) -> Vec<HashInstruction> {
        let project_root = &self.project_graph.nodes[project_name].root;
        self_inputs
            .iter()
            .filter_map(|i| match i {
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
                    let json_path = resolve_tokens(json, project_root, project_name);
                    if snapshot.is_some_and(|snapshot| !snapshot.read(&json_path)) {
                        return None;
                    }
                    let proj_name = if json.starts_with("{projectRoot}") {
                        Some(project_name.to_string())
                    } else {
                        None
                    };
                    Some(HashInstruction::JsonFileSet(Box::new(JsonFileSetInput {
                        project_name: proj_name,
                        json_path,
                        fields: fields.map(|f| f.to_vec()),
                        exclude_fields: exclude_fields.map(|f| f.to_vec()),
                    })))
                }
                _ => None,
            })
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
                result.extend(self.gather_self_inputs(project, &expanded_input, None)?)
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

/// Tasks the up-front batch must leave out because they read what a task
/// they depend on, directly or through the chain, writes: any task with a
/// `dependentTasksOutputFiles` instruction, and any task with a disk-backed
/// fileset that reads from a directory containing, or sitting inside, an
/// output an upstream task declares. Any other disk-backed fileset hashes up
/// front like a tracked one.
fn deferred_tasks(
    plans: &HashMap<String, Vec<u32>>,
    pool: &InstructionPool,
    task_graph: &TaskGraph,
) -> HashSet<String> {
    plans
        .par_iter()
        .filter(|(task_id, ids)| {
            let mut disk_roots: Vec<String> = Vec::new();
            for id in ids.iter() {
                match &*pool.get(*id) {
                    HashInstruction::TaskOutput(_, _) => return true,
                    HashInstruction::IgnoredFileSet(globs) => disk_roots.extend(
                        globs
                            .iter()
                            .filter(|glob| !glob.starts_with('!'))
                            .map(|glob| walk_root(glob)),
                    ),
                    _ => {}
                }
            }
            if disk_roots.is_empty() {
                return false;
            }
            let output_roots = upstream_output_roots(task_graph, task_id);
            disk_roots.iter().any(|disk| {
                output_roots
                    .iter()
                    .any(|output| paths_overlap(disk, output))
            })
        })
        .map(|(task_id, _)| task_id.clone())
        .collect()
}

/// The directory a glob reads from, spelled the way expansion reads it. A
/// glob with no literal prefix, or one that climbs out of the workspace,
/// reads as the workspace root, so a doubtful case errs toward deferring.
pub(crate) fn walk_root(glob: &str) -> String {
    // Legacy default outputs are spelled `./dist` and `dist/.`.
    let glob = glob.strip_prefix("./").unwrap_or(glob);
    let glob = glob.strip_suffix("/.").unwrap_or(glob);
    let glob = normalize_glob(glob);
    if glob.split('/').any(|segment| segment == "..") {
        return String::new();
    }
    partition_glob(&glob).0
}

/// Walk roots of every output declared by the tasks `task_id` depends on,
/// directly or through the chain, continuous dependencies included.
fn upstream_output_roots(task_graph: &TaskGraph, task_id: &str) -> Vec<String> {
    let dependencies_of = |id: &str| {
        [
            task_graph.dependencies.get(id),
            task_graph.continuous_dependencies.get(id),
        ]
        .into_iter()
        .flatten()
        .flat_map(|deps| deps.iter().map(String::as_str))
        .collect::<Vec<&str>>()
    };
    let mut roots = Vec::new();
    let mut visited: HashSet<&str> = HashSet::new();
    let mut stack = dependencies_of(task_id);
    while let Some(id) = stack.pop() {
        if !visited.insert(id) {
            continue;
        }
        if let Some(task) = task_graph.tasks.get(id) {
            roots.extend(
                task.outputs
                    .iter()
                    .filter(|output| !output.starts_with('!'))
                    .map(|output| walk_root(output)),
            );
        }
        stack.extend(dependencies_of(id));
    }
    roots
}

/// Whether one path is the other or lies inside it. The workspace root, the
/// empty string, holds everything.
fn paths_overlap(a: &str, b: &str) -> bool {
    a.is_empty()
        || b.is_empty()
        || a == b
        || a.strip_prefix(b).is_some_and(|rest| rest.starts_with('/'))
        || b.strip_prefix(a).is_some_and(|rest| rest.starts_with('/'))
}

/// Where a fileset's files come from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum FileSetStore {
    /// Read from disk (`includeIgnored`).
    Disk,
    /// Filtered from the project's tracked files.
    Project,
    /// Filtered from the workspace's tracked files.
    Workspace,
}

impl FileSetStore {
    fn of(fileset: &str, include_ignored: bool) -> Self {
        if include_ignored {
            FileSetStore::Disk
        } else if fileset.starts_with("{projectRoot}/") || fileset.starts_with("!{projectRoot}/") {
            FileSetStore::Project
        } else {
            FileSetStore::Workspace
        }
    }
}

/// The cache-key character for a fileset: `f` reads the file map, `d` reads
/// the disk (`includeIgnored`).
fn fileset_kind(include_ignored: bool) -> char {
    if include_ignored { 'd' } else { 'f' }
}

/// Unsupported kinds are uncached.
fn local_input_cache_key(dep: &str, group: &[Input]) -> Option<String> {
    match group {
        [Input::Inputs { input, .. }] => Some(prefixed_cache_key(dep, 'i', input)),
        [
            Input::FileSet {
                fileset,
                dependencies: true,
                include_ignored,
            },
        ] => Some(prefixed_cache_key(
            dep,
            fileset_kind(*include_ignored),
            fileset,
        )),
        [_] | [] => None,
        _ => {
            debug_assert!(
                group.iter().all(is_ignored_dep_fileset),
                "a group reaching the key holds only includeIgnored dependency filesets"
            );
            Some(grouped_cache_key(dep, group))
        }
    }
}

/// One key per propagated group. A group holds more than one input, so its
/// kind never collides with a single input's key.
fn group_cache_key(dep: &str, inputs: &[Input]) -> String {
    match inputs {
        // Only `dependencies: true` filesets reach here, since that is what
        // get_inputs_for_dependency puts in deps_inputs. The kind keeps the
        // two backing stores apart: the same glob is a different subtree.
        [Input::Inputs { input, .. }] => prefixed_cache_key(dep, 'i', input),
        [
            Input::FileSet {
                fileset,
                include_ignored,
                ..
            },
        ] => prefixed_cache_key(dep, fileset_kind(*include_ignored), fileset),
        // Other input kinds never reach dependencies (get_inputs_for_dependency
        // returns None for them), so they share one empty entry per project.
        [_] | [] => prefixed_cache_key(dep, 'n', ""),
        _ => {
            debug_assert!(
                inputs.iter().all(is_ignored_dep_fileset),
                "a group reaching the key holds only includeIgnored dependency filesets"
            );
            grouped_cache_key(dep, inputs)
        }
    }
}

/// Group order is part of the key: it is the order the globs are hashed in.
/// So is each member's kind, so two groups naming the same filesets cannot
/// share a memo entry. No caller builds a mixed group today — each arm that
/// reaches here debug-asserts it — but the kind is in the key regardless,
/// since a debug assert is compiled out of the binary that ships.
fn grouped_cache_key(dep: &str, group: &[Input]) -> String {
    let globs = group
        .iter()
        .map(|input| match input {
            Input::FileSet {
                fileset,
                include_ignored,
                ..
            } => format!("{}{fileset}", fileset_kind(*include_ignored)),
            _ => String::new(),
        })
        .collect::<Vec<_>>()
        .join("\0");
    prefixed_cache_key(dep, 'g', &globs)
}

fn is_ignored_dep_fileset(input: &Input) -> bool {
    matches!(
        input,
        Input::FileSet {
            dependencies: true,
            include_ignored: true,
            ..
        }
    )
}

/// The `includeIgnored` filesets a project propagates to its dependencies.
/// Every member carries both flags, which is what lets `grouped_cache_key`
/// key a group on its globs and kinds without two groups colliding.
fn ignored_dep_fileset_group<'a>(inputs: &[Input<'a>]) -> Vec<Input<'a>> {
    inputs
        .iter()
        .filter_map(|input| match input {
            Input::FileSet {
                fileset,
                dependencies: true,
                include_ignored: true,
            } => Some(Input::FileSet {
                fileset: *fileset,
                dependencies: true,
                include_ignored: true,
            }),
            _ => None,
        })
        .collect()
}

/// Whether an input reaches the dependency unchanged, so its expansion is
/// task-independent and cacheable.
fn propagates_unchanged(before: &Input, after: &Input) -> bool {
    match (before, after) {
        (
            Input::Inputs { input: before, .. },
            Input::Inputs {
                input: after,
                dependencies: true,
            },
        ) => before == after,
        (
            Input::FileSet {
                fileset: before,
                dependencies: true,
                include_ignored: before_ignored,
            },
            Input::FileSet {
                fileset: after,
                dependencies: true,
                include_ignored: after_ignored,
            },
        ) => before == after && before_ignored == after_ignored,
        _ => false,
    }
}

fn collect_negations(
    project_name: &str,
    project_graph: &ProjectGraph,
    self_inputs: &[Input],
    negations: &mut Negations,
) {
    let project_root = &project_graph.nodes[project_name].root;
    for input in self_inputs {
        if let Input::FileSet {
            fileset,
            include_ignored: false,
            ..
        } = input
            && fileset.starts_with('!')
        {
            negations.push((
                project_name.to_string(),
                resolve_files_glob(fileset, project_root, project_name),
            ));
        }
    }
}

/// Reads a native instruction already hashes whole: node_modules and lockfiles
/// (externals), nx.json/.gitignore/.nxignore (always-on). The root package.json,
/// `{json}` inputs and root tsconfig stay: those instructions hash only part.
fn covered_by_native_instruction(glob: &str) -> bool {
    let path = glob.strip_prefix('!').unwrap_or(glob);
    path.starts_with("node_modules/")
        || path.contains("/node_modules/")
        || LOCKFILES.contains(&path)
        || ALWAYS_ON_FILES.contains(&path)
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

/// Disk-backed globs are workspace-relative once resolved: `{workspaceRoot}/`
/// is a no-op prefix here, unlike map-backed filesets where the hasher strips it.
fn resolve_files_glob(glob: &str, project_root: &str, project_name: &str) -> String {
    let resolved = resolve_tokens(glob, project_root, project_name);
    match resolved.strip_prefix("!{workspaceRoot}/") {
        Some(rest) => format!("!{rest}"),
        None => resolved
            .strip_prefix("{workspaceRoot}/")
            .map(str::to_string)
            .unwrap_or(resolved),
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

    fn include_ignored_planner(filesets: &[&str]) -> (HashPlanner, TaskGraph) {
        use crate::native::types::{FileSetInput, JsInputs};
        use napi::bindgen_prelude::Either9;
        let inputs: Vec<JsInputs> = filesets
            .iter()
            .map(|fileset| {
                Either9::C(FileSetInput {
                    fileset: fileset.to_string(),
                    dependencies: None,
                    include_ignored: Some(true),
                })
            })
            .collect();
        let project = Project {
            root: "libs/parent".into(),
            targets: HashMap::from([(
                "build".into(),
                Target {
                    inputs: Some(inputs),
                    ..Default::default()
                },
            )]),
            ..Default::default()
        };
        let planner = HashPlanner::new(
            NxJson { named_inputs: None },
            &External::new(Arc::new(ProjectGraph {
                nodes: HashMap::from([("parent".into(), project)]),
                dependencies: HashMap::from([("parent".into(), vec![])]),
                external_nodes: HashMap::new(),
            })),
        );
        let task = Task::new("parent", "build");
        let task_graph = TaskGraph {
            roots: vec![task.id.clone()],
            dependencies: HashMap::from([(task.id.clone(), vec![])]),
            continuous_dependencies: HashMap::new(),
            tasks: HashMap::from([(task.id.clone(), task)]),
        };
        (planner, task_graph)
    }

    // A group the native hasher rejects must withhold the snapshot, so the
    // native error still fires instead of a plan with a hole.
    #[test]
    fn eligibility_withholds_a_task_whose_include_ignored_group_is_invalid() {
        let (planner, task_graph) = include_ignored_planner(&["!{projectRoot}/dist/**/*.map"]);
        let inputs = planner.eligibility_inputs(&task_graph, &[], &[], None);
        assert!(inputs.invalid_files_input.contains("parent:build"));

        let opted_out =
            planner.eligibility_inputs(&task_graph, &[], &["parent:build".into()], None);
        assert!(opted_out.invalid_files_input.is_empty());

        let (planner, task_graph) =
            include_ignored_planner(&["{projectRoot}/dist/**", "!{projectRoot}/dist/**/*.map"]);
        let inputs = planner.eligibility_inputs(&task_graph, &[], &[], None);
        assert!(inputs.invalid_files_input.is_empty());
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
                        .get_or_try_init(
                            local_input_cache_key(name, std::slice::from_ref(&input)).unwrap(),
                            || {
                                Ok::<_, ()>(LocalDependencyInputs {
                                    negations: vec![],
                                    ids: vec![],
                                    needs_legacy: true,
                                })
                            },
                        )
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
                .get_plans_materialized(
                    ids.iter().map(String::as_str).collect(),
                    tasks(),
                    None,
                    &[],
                    &[],
                )
                .unwrap();
            for _ in 0..3 {
                ids.reverse();
                assert_eq!(
                    cached
                        .get_plans_materialized(
                            ids.iter().map(String::as_str).collect(),
                            tasks(),
                            None,
                            &[],
                            &[]
                        )
                        .unwrap(),
                    expected
                );
            }
            for id in &ids {
                assert_eq!(
                    cached
                        .get_plans_materialized(vec![id], tasks(), None, &[], &[])
                        .unwrap()[id],
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
            .local_dependency_inputs("cycle-a", std::slice::from_ref(&input))
            .unwrap()
            .unwrap();
        let second = planner
            .local_dependency_inputs("cycle-a", std::slice::from_ref(&input))
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
            .local_dependency_inputs("leaf", std::slice::from_ref(&input))
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
            local_input_cache_key("a", &[named("b\0i\0c")]),
            local_input_cache_key("a\0i\0b", &[named("c")])
        );
        assert_ne!(
            local_input_cache_key("a", &[named("{projectRoot}/file")]),
            local_input_cache_key(
                "a",
                &[Input::FileSet {
                    fileset: "{projectRoot}/file",
                    dependencies: true,
                    include_ignored: false,
                }]
            )
        );
        // The two backing stores are different subtrees for the same glob.
        assert_ne!(
            local_input_cache_key(
                "a",
                &[Input::FileSet {
                    fileset: "{projectRoot}/file",
                    dependencies: true,
                    include_ignored: false,
                }]
            ),
            local_input_cache_key(
                "a",
                &[Input::FileSet {
                    fileset: "{projectRoot}/file",
                    dependencies: true,
                    include_ignored: true,
                }]
            )
        );
        assert!(
            local_input_cache_key(
                "a",
                &[Input::FileSet {
                    fileset: "{projectRoot}/file",
                    dependencies: false,
                    include_ignored: false,
                }]
            )
            .is_none()
        );
        assert!(local_input_cache_key("a", &[Input::String("default")]).is_none());
    }

    /// The key carries each member's kind, not only its globs, so two groups
    /// naming the same filesets cannot share a memo entry. Callers do not
    /// build a mixed group — the arms into the key debug-assert it — and this
    /// pins the key itself, which is what still stands in a release binary.
    #[test]
    fn a_group_key_separates_members_by_kind() {
        let fs = |fileset, include_ignored| Input::FileSet {
            fileset,
            dependencies: true,
            include_ignored,
        };
        assert_ne!(
            grouped_cache_key("p", &[fs("x", true), fs("y", false)]),
            grouped_cache_key("p", &[fs("x", false), fs("y", true)])
        );
        assert_ne!(
            grouped_cache_key("p", &[fs("x", true), fs("y", true)]),
            grouped_cache_key("p", &[fs("x", false), fs("y", false)])
        );
    }

    #[test]
    fn group_keys_are_distinct_from_each_other_and_from_single_inputs() {
        let ignored = |fileset| Input::FileSet {
            fileset,
            dependencies: true,
            include_ignored: true,
        };
        let group = |globs: &[&'static str]| {
            let group: Vec<_> = globs.iter().map(|glob| ignored(glob)).collect();
            (
                group_cache_key("a", &group),
                local_input_cache_key("a", &group),
            )
        };
        assert_ne!(group(&["x", "!y"]), group(&["x", "!z"]));
        // Order is part of the key: it is the order the globs are hashed in.
        assert_ne!(group(&["x", "!y"]), group(&["!y", "x"]));
        // A joined group cannot be read as one glob holding the separator.
        assert_ne!(group(&["x", "!y"]), group(&["x\0!y", "x"]));
        assert_ne!(
            group(&["x", "!y"]).0,
            group_cache_key("a", &[ignored("x\0!y")])
        );
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
                &[Input::Inputs {
                    input: "default",
                    dependencies: true,
                }],
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
            .get_plans_internal(vec!["app:build"], task_graph, None, &[], &[])
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

    #[test]
    fn defers_a_task_that_reads_an_upstream_output() {
        let pool = InstructionPool::new();
        let disk = |_project: &str, glob: &str| {
            pool.intern(HashInstruction::IgnoredFileSet(vec![glob.into()]))
        };
        let tracked = pool.intern(HashInstruction::ProjectFileSet(
            "lib".into(),
            vec!["libs/lib/src/**".into()],
        ));
        let group = |_project: &str, globs: &[&str]| {
            pool.intern(HashInstruction::IgnoredFileSet(
                globs.iter().map(|g| g.to_string()).collect(),
            ))
        };
        let plans: HashMap<String, Vec<u32>> = [
            ("web:build", vec![disk("web", "apps/web/generated/**/*.ts")]),
            ("web:lint", vec![disk("web", "apps/web/.env.generated")]),
            ("web:test", vec![disk("web", "dist/**")]),
            ("web:bracket", vec![disk("web", "apps/web/[dir]/**")]),
            ("web:slashes", vec![disk("web", "apps/web//generated/**")]),
            (
                "web:negated",
                vec![group("web", &["apps/web/.env.generated", "!dist/**"])],
            ),
            ("web:dot", vec![disk("web", "apps/web/.env.generated")]),
            ("web:dotdist", vec![disk("web", "dist/legacy/**")]),
            ("web:outside", vec![disk("web", "apps/web/.env.generated")]),
            ("web:outslash", vec![disk("web", "dist/apps/web/**")]),
            ("lib:build", vec![tracked]),
            (
                "web:e2e",
                vec![pool.intern(HashInstruction::TaskOutput(
                    "**/*.js".into(),
                    vec!["apps/web/dist".into()],
                ))],
            ),
        ]
        .into_iter()
        .map(|(id, ids)| (id.to_string(), ids))
        .collect();
        let strings = |list: &[&str]| list.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        let tasks: HashMap<String, Task> = [
            ("web:build", vec![]),
            ("web:lint", vec![]),
            ("web:test", vec![]),
            ("web:bracket", vec![]),
            ("web:slashes", vec![]),
            ("web:negated", vec![]),
            ("web:dot", vec![]),
            ("web:dotdist", vec![]),
            ("web:outside", vec![]),
            ("web:outslash", vec![]),
            ("web:e2e", vec![]),
            ("web:codegen", vec!["apps/web/generated"]),
            ("web:serve", vec!["apps/web/d"]),
            (
                "lib:build",
                vec!["dist/libs/lib", "!apps/web/.env.generated"],
            ),
            ("lib:dot", vec!["./dist"]),
            ("lib:outside", vec!["../outside"]),
            ("lib:outslash", vec!["dist//apps/web"]),
        ]
        .into_iter()
        .map(|(id, outputs)| {
            let (project, target) = id.split_once(':').unwrap();
            (
                id.to_string(),
                Task::new(project, target).with_outputs(strings(&outputs)),
            )
        })
        .collect();
        let edges = |list: &[(&str, &[&str])]| {
            list.iter()
                .map(|(id, deps)| (id.to_string(), strings(deps)))
                .collect::<HashMap<String, Vec<String>>>()
        };
        let task_graph = TaskGraph {
            roots: vec![],
            tasks,
            dependencies: edges(&[
                ("web:build", &["web:codegen", "lib:build"]),
                ("web:lint", &["lib:build"]),
                ("web:test", &["web:build"]),
                ("web:slashes", &["web:codegen"]),
                ("web:negated", &["lib:build"]),
                ("web:dot", &["lib:dot"]),
                ("web:dotdist", &["lib:dot"]),
                ("web:outside", &["lib:outside"]),
                ("web:outslash", &["lib:outslash"]),
            ]),
            continuous_dependencies: edges(&[("web:bracket", &["web:serve"])]),
        };

        let mut deferred: Vec<String> = deferred_tasks(&plans, &pool, &task_graph)
            .into_iter()
            .collect();
        deferred.sort();
        // web:build reads its codegen's output; web:test's `dist/**` holds
        // lib:build's `dist/libs/lib` two steps up; web:bracket's `[dir]`
        // counts as a wildcard, so `apps/web` meets the served `apps/web/d`;
        // `//` on either side reads as one slash; a legacy `./dist` output
        // is `dist`, so it holds `dist/legacy` but not `apps/web`; an output
        // the parser rejects (`../outside`) counts as the workspace root.
        // web:lint reads a file no upstream task writes, and a `!` entry on
        // either side is neither a read nor a write. web:e2e reads dependent
        // task outputs, which always wait.
        assert_eq!(
            deferred,
            vec![
                "web:bracket",
                "web:build",
                "web:dotdist",
                "web:e2e",
                "web:outside",
                "web:outslash",
                "web:slashes",
                "web:test"
            ]
        );
    }

    #[test]
    fn paths_overlap_when_one_holds_the_other() {
        assert!(paths_overlap("dist", "dist/libs/lib"));
        assert!(paths_overlap("dist/libs/lib", "dist"));
        assert!(paths_overlap("dist", "dist"));
        assert!(paths_overlap("", "anything"));
        assert!(!paths_overlap("dist", "distribution"));
        assert!(!paths_overlap("apps/web/dist", "apps/webapp"));
    }
}
