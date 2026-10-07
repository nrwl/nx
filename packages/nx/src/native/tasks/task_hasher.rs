use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

use hashbrown::HashSet;

use crate::native::glob::{normalize_glob, partition_glob};
use crate::native::{
    hasher::hash,
    project_graph::{types::ProjectGraph, utils::create_project_root_mappings},
    tasks::types::{HashInstruction, HashPlans, InstructionPool},
    types::{NapiDashMap, SharedStr, SharedStrMap},
};
use crate::native::{
    project_graph::utils::ProjectRootMappings,
    tasks::hashers::{hash_cwd, hash_env, hash_runtime},
};
use crate::native::{
    tasks::hashers::{
        FilesExpansionCache, JsonHashResult, ProjectFileIndicesCache, ProjectFileSetCache, Source,
        WorkspaceFileIndex, WorkspaceFileIndicesCache, WorkspaceFileSetCache,
        collect_project_file_paths_cached, collect_workspace_file_paths_cached, expand_cached,
        expand_globs, hash_all_externals, hash_external, hash_files, hash_json_files,
        hash_project_config, hash_project_files_cached, hash_task_output,
        hash_tsconfig_selectively, hash_workspace_files_cached, output_prefixes,
    },
    types::FileData,
    walker::PathPredicate,
    workspace::ignored_index::{IgnoredIndexReader, RunStage},
    workspace::types::ProjectFiles,
};
use dashmap::DashMap;
use napi::bindgen_prelude::*;
use once_cell::sync::OnceCell;
use rayon::prelude::*;
use tracing::{debug, trace, trace_span};

/// NAPI-compatible struct for returning hash inputs to JavaScript
#[napi(object)]
#[derive(Debug, Default, Clone)]
pub struct HashInputs {
    /// Expanded file paths that were used as inputs
    pub files: Vec<String>,
    /// Runtime commands
    pub runtime: Vec<String>,
    /// Environment variable names
    pub environment: Vec<String>,
    /// Dependent task outputs
    pub dep_outputs: Vec<String>,
    /// External dependencies
    pub external: Vec<String>,
}

/// Internal builder that uses HashSet for O(1) deduplication during accumulation.
/// Convert to HashInputs via `into()` when ready to return via NAPI.
#[derive(Debug, Default, Clone)]
pub(crate) struct HashInputsBuilder {
    pub(crate) files: HashSet<String>,
    pub(crate) runtime: HashSet<String>,
    pub(crate) environment: HashSet<String>,
    pub(crate) dep_outputs: HashSet<String>,
    pub(crate) external: HashSet<String>,
}

impl HashInputsBuilder {
    /// Extends this builder with all values from another builder
    pub(crate) fn extend(&mut self, other: HashInputsBuilder) {
        self.files.extend(other.files);
        self.runtime.extend(other.runtime);
        self.environment.extend(other.environment);
        self.dep_outputs.extend(other.dep_outputs);
        self.external.extend(other.external);
    }
}

/// Converts context-free `HashInstruction` variants into their `HashInputsBuilder`.
///
/// # Panics
/// Panics for context-dependent variants (WorkspaceFileSet, ProjectFileSet,
/// TaskOutput, TsConfiguration) that require workspace files, project graph,
/// or filesystem access. Callers must handle those variants before calling `.into()`.
impl From<&HashInstruction> for HashInputsBuilder {
    fn from(instruction: &HashInstruction) -> Self {
        match instruction {
            HashInstruction::Runtime(runtime) => HashInputsBuilder {
                runtime: HashSet::from([runtime.clone()]),
                ..Default::default()
            },
            HashInstruction::Environment(env) => HashInputsBuilder {
                environment: HashSet::from([env.clone()]),
                ..Default::default()
            },
            HashInstruction::External(external) => HashInputsBuilder {
                external: HashSet::from([external.clone()]),
                ..Default::default()
            },
            HashInstruction::AllExternalDependencies => HashInputsBuilder {
                external: HashSet::from(["AllExternalDependencies".to_string()]),
                ..Default::default()
            },
            HashInstruction::UltracacheConfiguration(_)
            | HashInstruction::ProjectConfiguration(_)
            | HashInstruction::Cwd(_) => HashInputsBuilder::default(),
            // These variants require external context — callers must match on them
            // explicitly before falling through to `.into()`.
            other => unreachable!(
                "{:?} requires context (workspace files, project graph, etc.) \
                 and cannot be converted to HashInputsBuilder via From",
                other
            ),
        }
    }
}

impl From<HashInputsBuilder> for HashInputs {
    fn from(builder: HashInputsBuilder) -> Self {
        // Convert HashSets to sorted Vecs for deterministic output
        fn to_sorted_vec(set: HashSet<String>) -> Vec<String> {
            let mut vec: Vec<String> = set.into_iter().collect();
            vec.sort();
            vec
        }

        HashInputs {
            files: to_sorted_vec(builder.files),
            runtime: to_sorted_vec(builder.runtime),
            environment: to_sorted_vec(builder.environment),
            dep_outputs: to_sorted_vec(builder.dep_outputs),
            external: to_sorted_vec(builder.external),
        }
    }
}

#[napi(object)]
#[derive(Debug)]
pub struct HashDetails {
    pub value: String,
    // Keys are indices into a shared table; values are shared Arcs. The same
    // input appears in many tasks, so retain the compact assembly entries
    // until conversion instead of materializing per-task key/value pairs.
    #[napi(ts_type = "Record<string, string>")]
    pub details: SharedStrMap,
    /// Structured inputs used for hashing (file patterns, env vars, etc.)
    pub inputs: HashInputs,
}

#[napi(object)]
pub struct HasherOptions {
    pub selectively_hash_ts_config: bool,
}

/// Return type of `hash_plans`. Shares JS strings for pooled detail keys and
/// values across tasks during a single conversion. The cache owns its Arcs
/// and is cleared before the native call's handle scope ends.
pub struct TaskHashes(pub NapiDashMap<String, HashDetails>);

impl ToNapiValue for TaskHashes {
    unsafe fn to_napi_value(env: sys::napi_env, val: Self) -> napi::Result<sys::napi_value> {
        let _guard = SharedStr::install_handle_cache();
        unsafe { NapiDashMap::to_napi_value(env, val.0) }
    }
}

/// How a pool's instructions are ordered in a hash and named in its details.
struct InstructionKeys {
    /// Each id's label, then a `digest`-suffixed one for each id whose label
    /// another id shares.
    labels: Arc<[SharedStr]>,
    /// Each id's position in hash order: by label in UTF-8 order, then by value,
    /// so distinct instructions never tie.
    ranks: Vec<u32>,
    /// Where in `labels` each shared-label id's suffixed label sits.
    suffixed: HashMap<u32, u32>,
}

impl InstructionKeys {
    fn of(pool: &InstructionPool) -> Self {
        let count = pool.len() as u32;
        let mut labels: Vec<SharedStr> = (0..count)
            .map(|id| SharedStr::from(pool.label(id)))
            .collect();
        let mut ids: Vec<u32> = (0..count).collect();
        ids.sort_unstable_by(|&left, &right| {
            labels[left as usize]
                .cmp(&labels[right as usize])
                .then_with(|| {
                    let left = pool.get(left).value().clone();
                    left.cmp(pool.get(right).value())
                })
        });
        let mut ranks = vec![0; ids.len()];
        for (rank, &id) in ids.iter().enumerate() {
            ranks[id as usize] = rank as u32;
        }
        let mut suffixed = HashMap::new();
        let mut suffixed_labels = Vec::new();
        for run in ids.chunk_by(|&left, &right| labels[left as usize] == labels[right as usize]) {
            if run.len() < 2 {
                continue;
            }
            for &id in run {
                suffixed.insert(id, (labels.len() + suffixed_labels.len()) as u32);
                let label = format!("{} #{}", &*labels[id as usize], pool.get(id).digest());
                suffixed_labels.push(SharedStr::from(label));
            }
        }
        labels.extend(suffixed_labels);
        Self {
            labels: labels.into(),
            ranks,
            suffixed,
        }
    }

    /// Points the entries whose label another of the task's entries shares at
    /// their suffixed label. `entries` must be in rank order.
    fn name_shared_labels_apart(&self, entries: &mut [(u32, SharedStr)]) {
        let shared: Vec<bool> = (0..entries.len())
            .map(|index| {
                let id = entries[index].0;
                let shares_with = |other: Option<&(u32, SharedStr)>| {
                    other.is_some_and(|(other, _)| {
                        self.labels[*other as usize] == self.labels[id as usize]
                    })
                };
                self.suffixed.contains_key(&id)
                    && (shares_with(index.checked_sub(1).map(|i| &entries[i]))
                        || shares_with(entries.get(index + 1)))
            })
            .collect();
        for (entry, shared) in entries.iter_mut().zip(shared) {
            if shared {
                entry.0 = self.suffixed[&entry.0];
            }
        }
    }

    /// Names `entries` by their labels. When labels still clash, as when a
    /// suffixed label equals another entry's label or two digests match, each
    /// later holder takes the lowest ` #N` that no entry's label uses.
    /// `entries` must be in rank order.
    fn name_details(&self, entries: Vec<(u32, SharedStr)>) -> SharedStrMap {
        let label = |id: u32| &self.labels[id as usize];
        let labels: HashSet<&str> = entries.iter().map(|(id, _)| &**label(*id)).collect();
        if labels.len() == entries.len() {
            return SharedStrMap::from_indexed_entries(Arc::clone(&self.labels), entries);
        }
        let mut named: HashSet<String> = HashSet::with_capacity(entries.len());
        let entries = entries
            .into_iter()
            .map(|(id, value)| {
                let base = label(id);
                if named.insert(base.to_string()) {
                    return (base.clone(), value);
                }
                let name = (2..)
                    .map(|n| format!("{} #{n}", &**base))
                    .find(|name| !labels.contains(name.as_str()) && !named.contains(name))
                    .expect("a free name");
                named.insert(name.clone());
                (SharedStr::from(name), value)
            })
            .collect();
        SharedStrMap::from_entries(entries)
    }
}

fn assemble_ranked_hash(
    mut entries: Vec<(u32, SharedStr)>,
    keys: &InstructionKeys,
    inputs: HashInputsBuilder,
) -> HashDetails {
    entries.sort_unstable_by_key(|(id, _)| keys.ranks[*id as usize]);
    let mut hasher = xxhash_rust::xxh3::Xxh3::new();
    for (id, value) in &entries {
        trace!("Adding {} ({}) to hash", value, keys.labels[*id as usize]);
        hasher.update(value.as_bytes());
    }
    let details = match keys.suffixed.is_empty() {
        true => SharedStrMap::from_indexed_entries(Arc::clone(&keys.labels), entries),
        false => {
            keys.name_shared_labels_apart(&mut entries);
            keys.name_details(entries)
        }
    };
    HashDetails {
        value: hasher.digest().to_string(),
        details,
        inputs: inputs.into(),
    }
}

/// Returns the shared Arc for `value`, allocating it on first sight. Only
/// Environment and Runtime values flow through here: they depend on the
/// task's env, so they cannot live in the shared per-id slots, but tasks
/// whose envs agree still produce identical strings; interning keeps one
/// allocation per unique value.
fn intern_value(interner: &DashMap<String, Arc<str>>, value: String) -> Arc<str> {
    if let Some(existing) = interner.get(&value) {
        return existing.clone();
    }
    match interner.entry(value) {
        dashmap::mapref::entry::Entry::Occupied(existing) => existing.get().clone(),
        dashmap::mapref::entry::Entry::Vacant(vacant) => {
            let shared: Arc<str> = Arc::from(vacant.key().as_str());
            vacant.insert(shared.clone());
            shared
        }
    }
}

#[napi]
pub struct TaskHasher {
    /// The context\'s index of the directories hashed from disk, see
    /// `register_prefixes`.
    ignored_index: Arc<IgnoredIndexReader>,
    workspace_root: String,
    project_graph: Arc<ProjectGraph>,
    project_file_map: Arc<HashMap<String, Vec<FileData>>>,
    all_workspace_files: Arc<Vec<FileData>>,
    ts_config: Vec<u8>,
    ts_config_paths: HashMap<String, Vec<String>>,
    root_tsconfig_path: Option<String>,
    options: Option<HasherOptions>,
    external_cache: Arc<DashMap<String, String>>,
    // Persisted across hash_plans() calls: they only fold the immutable FileData
    // snapshot, so they never go stale. The set caches are hash-only; the indices
    // caches hold the matched files' positions in that snapshot (4 bytes each, not
    // the path strings) and are only populated when inputs are collected. Paths are
    // expanded from the indices per call. (Live-disk/exec caches stay per-call, see
    // below.)
    workspace_file_set_cache: WorkspaceFileSetCache,
    project_file_set_cache: ProjectFileSetCache,
    workspace_file_indices_cache: WorkspaceFileIndicesCache,
    project_file_indices_cache: ProjectFileIndicesCache,
    // Fold over all externals; identical for every task, so computed once.
    all_externals_hash: OnceCell<String>,
    // A path index over the workspace files, built on first use. Workspace
    // filesets are expanded from it; disk-backed filesets (`includeIgnored`
    // and Ultracache reads) ask it which files skip the disk, their content
    // living in the context's IgnoredIndex.
    workspace_file_index: WorkspaceFileIndex,
}
#[napi]
impl TaskHasher {
    #[napi(constructor)]
    pub fn new(
        workspace_root: String,
        #[napi(ts_arg_type = "ExternalObject<ProjectGraph>")] project_graph: &External<
            Arc<ProjectGraph>,
        >,
        #[napi(ts_arg_type = "ExternalObject<Record<string, Array<FileData>>>")]
        project_file_map: &External<Arc<ProjectFiles>>,
        #[napi(ts_arg_type = "ExternalObject<Array<FileData>>")] all_workspace_files: &External<
            Arc<Vec<FileData>>,
        >,
        ts_config: Buffer,
        ts_config_paths: HashMap<String, Vec<String>>,
        root_tsconfig_path: Option<String>,
        options: Option<HasherOptions>,
        #[napi(ts_arg_type = "ExternalObject<IgnoredIndexReader>")] ignored_index: &External<
            Arc<IgnoredIndexReader>,
        >,
    ) -> Self {
        Self {
            ignored_index: Arc::clone(ignored_index),
            workspace_root,
            project_graph: Arc::clone(project_graph),
            project_file_map: Arc::clone(project_file_map),
            all_workspace_files: Arc::clone(all_workspace_files),
            ts_config: ts_config.to_vec(),
            ts_config_paths,
            root_tsconfig_path,
            options,
            external_cache: Arc::new(DashMap::new()),
            workspace_file_set_cache: WorkspaceFileSetCache::new(),
            project_file_set_cache: ProjectFileSetCache::new(),
            workspace_file_indices_cache: WorkspaceFileIndicesCache::new(),
            project_file_indices_cache: ProjectFileIndicesCache::new(),
            all_externals_hash: OnceCell::new(),
            workspace_file_index: WorkspaceFileIndex::new(Arc::clone(&all_workspace_files)),
        }
    }

    /// Hands the index the directories the plans read from disk: the literal
    /// prefix of every disk-backed glob, and every declared output root.
    /// The index remembers hashes under all of them and lists the ones
    /// something asks to list, which is the filesets and not the outputs.
    /// Anything it refuses is read from disk instead.
    fn register_prefixes(&self, hash_plans: &HashPlans) {
        let pool = &hash_plans.pool;
        let mut prefixes: Vec<String> = Vec::new();
        let mut output_roots: Vec<String> = Vec::new();
        for id in 0..pool.len() as u32 {
            match pool.get(id).value() {
                HashInstruction::IgnoredFileSet(globs) => prefixes.extend(
                    globs
                        .iter()
                        .filter(|g| !g.starts_with('!'))
                        .filter_map(|g| {
                            let glob = normalize_glob(g);
                            Some(partition_glob(&glob).0)
                        }),
                ),
                HashInstruction::TaskOutput(_, outputs) => {
                    output_roots.extend(output_prefixes(outputs))
                }
                _ => {}
            }
        }
        // Widest first, so a directory inside another is absorbed by it.
        prefixes.extend(output_roots);
        prefixes.sort();
        prefixes.dedup();
        prefixes.sort_by_key(|p| p.len());
        let workspace_root = Path::new(&self.workspace_root);
        for dir in prefixes {
            self.ignored_index.track(workspace_root, &dir);
        }
    }

    fn workspace_tracks_file(&self, path: &str) -> bool {
        self.workspace_file_index.tracks(path)
    }

    fn workspace_file_hash(&self, path: &str) -> Option<String> {
        self.workspace_file_index.hash_of(path)
    }

    /// Hash each task's instructions using the env map keyed by `task.id`.
    /// Every task in `hash_plans` must have an entry in `per_task_envs` —
    /// a missing id surfaces as an error rather than silently hashing
    /// against an empty env. Callers that want to hash all tasks against
    /// the same env should build `per_task_envs` by keying that env under
    /// every task id.
    #[napi(ts_return_type = "Record<string, HashDetails>")]
    pub fn hash_plans(
        &self,
        #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
        hash_plans: &External<HashPlans>,
        per_task_envs: HashMap<String, HashMap<String, String>>,
        cwd: String,
        collect_task_inputs: Option<bool>,
    ) -> anyhow::Result<TaskHashes> {
        for task_id in hash_plans.plans.keys() {
            if !per_task_envs.contains_key(task_id) {
                anyhow::bail!("hash_plans: missing env entry for task {}", task_id);
            }
        }
        self.hash_plans_impl(
            hash_plans,
            cwd,
            collect_task_inputs,
            RunStage::ATaskMayHaveWritten,
            |task_id| {
                per_task_envs
                    .get(task_id)
                    .expect("per-task env presence verified above")
            },
        )
    }

    /// Like `hash_plans`, but only for the plans the planner did not defer
    /// (`HashPlans::deferred`: a task that reads another task's outputs, or a
    /// disk-backed fileset whose directory contains, or sits inside, an
    /// upstream task's output). The rest are left out and hash once those
    /// tasks have run; their ids are absent from the result and need no entry
    /// in `per_task_envs`.
    #[napi(ts_return_type = "Record<string, HashDetails>")]
    pub fn hash_plans_upfront(
        &self,
        #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
        hash_plans: &External<HashPlans>,
        per_task_envs: HashMap<String, HashMap<String, String>>,
        cwd: String,
        collect_task_inputs: Option<bool>,
    ) -> anyhow::Result<TaskHashes> {
        let function_start = std::time::Instant::now();
        let pool = &hash_plans.pool;
        let plans: HashMap<String, Vec<u32>> = hash_plans
            .plans
            .iter()
            .filter(|(task_id, _)| !hash_plans.deferred.contains(task_id.as_str()))
            .map(|(task_id, ids)| (task_id.clone(), ids.clone()))
            .collect();
        let partition_duration = function_start.elapsed();
        let (upfront_count, total_count) = (plans.len(), hash_plans.plans.len());
        trace!(
            "hash_plans_upfront: {} of {} plans hash up front, {} wait for other tasks' outputs (partition: {:?})",
            upfront_count,
            total_count,
            total_count - upfront_count,
            partition_duration
        );
        for task_id in plans.keys() {
            if !per_task_envs.contains_key(task_id) {
                anyhow::bail!("hash_plans_upfront: missing env entry for task {}", task_id);
            }
        }
        let upfront = HashPlans {
            pool: pool.clone(),
            plans,
            deferred: std::collections::HashSet::new(),
        };
        // Once per run, before any hashing: the directories this run reads
        // from disk are the index's to keep from here on.
        self.register_prefixes(hash_plans);
        let hashes = self.hash_plans_impl(
            &upfront,
            cwd,
            collect_task_inputs,
            RunStage::NothingRan,
            |task_id| {
                per_task_envs
                    .get(task_id)
                    .expect("per-task env presence verified above")
            },
        )?;
        debug!(
            "hash_plans_upfront COMPLETED in {:?} - hashed {} of {} plans up front, {} deferred (partition: {:?}, hashing: {:?})",
            function_start.elapsed(),
            upfront_count,
            total_count,
            total_count - upfront_count,
            partition_duration,
            function_start.elapsed() - partition_duration
        );
        Ok(hashes)
    }

    /// Hashes `task_ids` from plans built earlier, so a task the up-front batch
    /// deferred needs no second planning pass. Ids without a plan are absent
    /// from the result.
    #[napi(ts_return_type = "Record<string, HashDetails>")]
    pub fn hash_plans_for(
        &self,
        #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
        hash_plans: &External<HashPlans>,
        task_ids: Vec<String>,
        per_task_envs: HashMap<String, HashMap<String, String>>,
        cwd: String,
        collect_task_inputs: Option<bool>,
    ) -> anyhow::Result<TaskHashes> {
        let plans: HashMap<String, Vec<u32>> = task_ids
            .into_iter()
            .filter_map(|task_id| {
                let ids = hash_plans.plans.get(&task_id)?.clone();
                Some((task_id, ids))
            })
            .collect();
        for task_id in plans.keys() {
            if !per_task_envs.contains_key(task_id) {
                anyhow::bail!("hash_plans_for: missing env entry for task {}", task_id);
            }
        }
        let subset = HashPlans {
            pool: hash_plans.pool.clone(),
            plans,
            deferred: std::collections::HashSet::new(),
        };
        self.hash_plans_impl(
            &subset,
            cwd,
            collect_task_inputs,
            RunStage::ATaskMayHaveWritten,
            |task_id| {
                per_task_envs
                    .get(task_id)
                    .expect("per-task env presence verified above")
            },
        )
    }

    /// `run_stage` says whether anything has executed yet, which is what
    /// decides whether the file map and the index may be taken at their word.
    fn hash_plans_impl<'a, F>(
        &self,
        hash_plans: &HashPlans,
        cwd: String,
        collect_task_inputs: Option<bool>,
        run_stage: RunStage,
        resolve_env: F,
    ) -> anyhow::Result<TaskHashes>
    where
        F: Fn(&str) -> &'a HashMap<String, String> + Sync,
    {
        // Per-invocation: these read live disk/exec state (task outputs, shell commands,
        // json file contents) that can change mid-run, so they must not persist.
        let runtime_cache: DashMap<String, String> = DashMap::new();
        let json_file_set_cache: DashMap<String, JsonHashResult> = DashMap::new();
        let files_expansion_cache = FilesExpansionCache::new();
        // Deduplicates env-dependent hash values (Environment, Runtime)
        // across tasks; see intern_value. Other instruction types share
        // values through per-id slots instead.
        let value_interner: DashMap<String, Arc<str>> = DashMap::new();
        let should_collect_inputs = collect_task_inputs.unwrap_or(false);

        let function_start = std::time::Instant::now();

        trace!("Starting hash_plans with {} plans", hash_plans.plans.len());
        trace!("all workspace files: {}", self.all_workspace_files.len());
        trace!("project_file_map: {}", self.project_file_map.len());

        let ts_config_hash = hash(&self.ts_config);
        let project_root_mappings = create_project_root_mappings(&self.project_graph.nodes);

        let mut sorted_externals = self.project_graph.external_nodes.keys().collect::<Vec<_>>();
        sorted_externals.par_sort();

        let selectively_hash_tsconfig = self
            .options
            .as_ref()
            .map(|o| o.selectively_hash_ts_config)
            .unwrap_or(false);

        let setup_duration = function_start.elapsed();
        trace!("Setup phase completed in {:?}", setup_duration);

        let hash_time = std::time::Instant::now();

        let hashes: NapiDashMap<String, HashDetails> = NapiDashMap::new();
        let cwd_path = std::path::Path::new(&cwd);

        let pool = &hash_plans.pool;
        // Id-indexed snapshots so the hot loop reads a plain Vec instead of
        // taking a DashMap shard lock per (task, instruction) entry. Every
        // instruction except Environment and Runtime (whose values depend on
        // the task's env) hashes to the same value for every task within an
        // invocation, so its value lives in a per-id slot: a filled OnceCell
        // is an atomic load, and it lets the loop skip hash_instruction
        // entirely when inputs are not collected.
        let instruction_keys = InstructionKeys::of(pool);
        // Classify once per instruction, so cache hits do not need the pool's
        // shard lock. The exhaustive match keeps env-dependent inputs out of
        // the shared slots even when new instruction variants are introduced.
        let value_slots: Vec<Option<OnceCell<SharedStr>>> = (0..pool.len() as u32)
            .map(|id| match pool.get(id).value() {
                HashInstruction::Environment(_) | HashInstruction::Runtime(_) => None,
                HashInstruction::WorkspaceFileSet(_)
                | HashInstruction::Cwd(_)
                | HashInstruction::ProjectFileSet(_, _)
                | HashInstruction::IgnoredFileSet(_)
                | HashInstruction::ProjectConfiguration(_)
                | HashInstruction::TsConfiguration(_)
                | HashInstruction::TaskOutput(_, _)
                | HashInstruction::External(_)
                | HashInstruction::AllExternalDependencies
                | HashInstruction::JsonFileSet(_)
                | HashInstruction::UltracacheConfiguration(_) => Some(OnceCell::new()),
            })
            .collect();
        hash_plans.plans.par_iter().try_for_each(|(task_id, ids)| {
            if ids.is_empty() {
                return Ok(());
            }
            let js_env = resolve_env(task_id);
            // Workers accumulate locally, then publish one result per task.
            // The inner parallel iterator also preserves concurrency when
            // a single task has several expensive runtime/file inputs.
            // Most instructions are already shared cache hits after the first
            // few tasks. Copy those locally; only work that may need computing
            // goes through the inner parallel iterator.
            let mut entries = Vec::with_capacity(ids.len());
            let mut pending = Vec::new();
            for &id in ids {
                let cached = if should_collect_inputs {
                    None
                } else {
                    value_slots[id as usize].as_ref().and_then(OnceCell::get)
                };
                if let Some(value) = cached {
                    entries.push((id, value.clone()));
                } else {
                    pending.push(id);
                }
            }
            let (computed, inputs) = pending
                .par_iter()
                .try_fold(
                    || (Vec::new(), HashInputsBuilder::default()),
                    |(mut entries, mut task_inputs), &id| {
                        let slot = value_slots[id as usize].as_ref();

                        // Re-check rather than trusting the scan that put this
                        // id in `pending`: another task's worker may have filled
                        // the slot since. Missing that costs a whole
                        // hash_instruction, which can hash a file set or shell
                        // out for a runtime input.
                        let cached = if should_collect_inputs {
                            // Inputs are per task, so every entry must run
                            // hash_instruction to produce them.
                            None
                        } else {
                            slot.and_then(|s| s.get()).cloned()
                        };
                        let value = match cached {
                            Some(value) => value,
                            None => {
                                let instruction_ref = pool.get(id);
                                let (hash_value, inputs) = self.hash_instruction(
                                    task_id,
                                    instruction_ref.value(),
                                    HashInstructionArgs {
                                        id,
                                        js_env,
                                        ts_config_hash: &ts_config_hash,
                                        project_root_mappings: &project_root_mappings,
                                        sorted_externals: &sorted_externals,
                                        selectively_hash_tsconfig,
                                        runtime_cache: &runtime_cache,
                                        project_file_set_cache: &self.project_file_set_cache,
                                        workspace_file_set_cache: &self.workspace_file_set_cache,
                                        json_file_set_cache: &json_file_set_cache,
                                        files_expansion_cache: &files_expansion_cache,
                                        run_stage,
                                        cwd: cwd_path,
                                        collect_inputs: should_collect_inputs,
                                    },
                                )?;

                                if should_collect_inputs {
                                    task_inputs.extend(inputs);
                                }

                                match slot {
                                    Some(slot) => {
                                        slot.get_or_init(|| SharedStr::from(hash_value)).clone()
                                    }
                                    None => intern_value(&value_interner, hash_value).into(),
                                }
                            }
                        };

                        entries.push((id, value));
                        Ok::<_, anyhow::Error>((entries, task_inputs))
                    },
                )
                .try_reduce(
                    || (Vec::new(), HashInputsBuilder::default()),
                    |(mut entries, mut inputs), (mut other_entries, other_inputs)| {
                        entries.append(&mut other_entries);
                        inputs.extend(other_inputs);
                        Ok((entries, inputs))
                    },
                )?;
            entries.extend(computed);
            hashes.insert(
                task_id.clone(),
                trace_span!("Assembling hash", hash_id = task_id)
                    .in_scope(|| assemble_ranked_hash(entries, &instruction_keys, inputs)),
            );
            Ok::<_, anyhow::Error>(())
        })?;

        let hash_duration = hash_time.elapsed();
        let total_duration = function_start.elapsed();

        debug!(
            "hash_plans COMPLETED in {:?} - processed {} plans (setup: {:?}, hashing: {:?})",
            total_duration,
            hash_plans.plans.len(),
            setup_duration,
            hash_duration
        );

        Ok(TaskHashes(hashes))
    }

    fn hash_instruction(
        &self,
        task_id: &str,
        instruction: &HashInstruction,
        HashInstructionArgs {
            id,
            js_env,
            ts_config_hash,
            project_root_mappings,
            sorted_externals,
            selectively_hash_tsconfig,
            runtime_cache,
            project_file_set_cache,
            workspace_file_set_cache,
            json_file_set_cache,
            files_expansion_cache,
            run_stage,
            cwd,
            collect_inputs,
        }: HashInstructionArgs,
    ) -> anyhow::Result<(String, HashInputsBuilder)> {
        let now = std::time::Instant::now();
        let span = trace_span!("hashing", task_id).entered();
        let empty = HashInputsBuilder::default();
        let (hash, inputs) = match instruction {
            HashInstruction::WorkspaceFileSet(workspace_file_set) => {
                let hashed = hash_workspace_files_cached(
                    workspace_file_set,
                    &self.workspace_file_index,
                    workspace_file_set_cache,
                )?;
                trace!(parent: &span, "hash_workspace_files: {:?}", now.elapsed());
                let inputs = if collect_inputs {
                    let files = collect_workspace_file_paths_cached(
                        workspace_file_set,
                        &self.workspace_file_index,
                        &self.workspace_file_indices_cache,
                    )?;
                    HashInputsBuilder {
                        files: files.into_iter().collect(),
                        ..Default::default()
                    }
                } else {
                    empty
                };
                ((*hashed).clone(), inputs)
            }
            HashInstruction::Runtime(runtime) => {
                let hashed_runtime =
                    hash_runtime(&self.workspace_root, runtime, js_env, runtime_cache)?;
                trace!(parent: &span, "hash_runtime: {:?}", now.elapsed());
                let inputs = if collect_inputs {
                    instruction.into()
                } else {
                    empty
                };
                (hashed_runtime, inputs)
            }
            HashInstruction::Environment(env) => {
                let hashed_env = hash_env(env, js_env);
                trace!(parent: &span, "hash_env: {:?}", now.elapsed());
                let inputs = if collect_inputs {
                    instruction.into()
                } else {
                    empty
                };
                (hashed_env, inputs)
            }
            HashInstruction::Cwd(mode) => {
                let workspace_root = std::path::Path::new(&self.workspace_root);
                let hashed_cwd = hash_cwd(workspace_root, cwd, mode.clone());
                trace!(parent: &span, "hash_cwd: {:?}", now.elapsed());
                (hashed_cwd, empty)
            }
            HashInstruction::IgnoredFileSet(globs) => {
                let workspace_root = Path::new(&self.workspace_root);
                // The index answers from a listing it keeps only while
                // nothing has run, like the file map; afterwards it reads the
                // disk for us.
                let list_directory = |dir: &str, accept: PathPredicate| {
                    self.ignored_index.files_under(
                        workspace_root,
                        dir,
                        run_stage.nothing_ran(),
                        accept,
                    )
                };
                let key = format!("files#{id}");
                let expansion = expand_cached(&key, files_expansion_cache, || {
                    expand_globs(
                        globs,
                        &Source::fileset(
                            workspace_root,
                            &|path| run_stage.nothing_ran() && self.workspace_tracks_file(path),
                            &list_directory,
                        ),
                    )
                })?;
                let hashed = hash_files(
                    workspace_root,
                    &expansion,
                    |path| {
                        if run_stage.nothing_ran() {
                            self.workspace_file_hash(path)
                        } else {
                            None
                        }
                    },
                    self.ignored_index.index(),
                    run_stage,
                );
                trace!(parent: &span, "hash_files: {:?}", now.elapsed());
                let inputs = if collect_inputs {
                    HashInputsBuilder {
                        files: expansion.files.iter().cloned().collect(),
                        ..Default::default()
                    }
                } else {
                    empty
                };
                (hashed, inputs)
            }
            HashInstruction::ProjectFileSet(project_name, file_sets) => {
                let hashed = hash_project_files_cached(
                    project_name,
                    file_sets,
                    &self.project_file_map,
                    project_file_set_cache,
                )?;
                trace!(parent: &span, "hash_project_files: {:?}", now.elapsed());
                let inputs = if collect_inputs {
                    let files = collect_project_file_paths_cached(
                        project_name,
                        file_sets,
                        &self.project_file_map,
                        &self.project_file_indices_cache,
                    )?;
                    HashInputsBuilder {
                        files: files.into_iter().collect(),
                        ..Default::default()
                    }
                } else {
                    empty
                };
                ((*hashed).clone(), inputs)
            }
            HashInstruction::ProjectConfiguration(project_name) => {
                let hashed_project_config =
                    hash_project_config(project_name, &self.project_graph.nodes)?;
                trace!(parent: &span, "hash_project_config: {:?}", now.elapsed());
                (hashed_project_config, empty)
            }
            HashInstruction::TsConfiguration(project_name) => {
                let ts_config_hash = if !selectively_hash_tsconfig {
                    ts_config_hash.to_string()
                } else {
                    hash_tsconfig_selectively(
                        project_name,
                        &self.ts_config,
                        &self.ts_config_paths,
                        project_root_mappings,
                    )?
                };

                let ts_hash = self
                    .project_graph
                    .external_nodes
                    .get("typescript")
                    .and_then(|pkg| pkg.hash.as_deref())
                    .map(|pkg_hash| {
                        hash(&[pkg_hash.as_bytes(), ts_config_hash.as_bytes()].concat())
                    })
                    // the unwrap_or is for the case where typescript is not installed
                    .unwrap_or(ts_config_hash);

                let inputs = if collect_inputs {
                    let relative_ts_path = if let Some(root_path) = &self.root_tsconfig_path {
                        Some(
                            Path::new(root_path)
                                .strip_prefix(&self.workspace_root)
                                .unwrap_or(Path::new(root_path))
                                .to_string_lossy()
                                .to_string(),
                        )
                    } else {
                        None
                    };

                    let files = if let Some(rel_path) = relative_ts_path {
                        HashSet::from([rel_path])
                    } else {
                        HashSet::new()
                    };

                    HashInputsBuilder {
                        files,
                        ..Default::default()
                    }
                } else {
                    empty
                };

                trace!(parent: &span, "hash_tsconfig: {:?}", now.elapsed());
                (ts_hash, inputs)
            }
            HashInstruction::TaskOutput(glob, outputs) => {
                let result = hash_task_output(
                    Path::new(&self.workspace_root),
                    glob,
                    outputs,
                    files_expansion_cache,
                    self.ignored_index.index(),
                )?;
                trace!(parent: &span, "hash_task_output: {:?}", now.elapsed());
                let inputs = if collect_inputs {
                    HashInputsBuilder {
                        dep_outputs: result.files.into_iter().collect(),
                        ..Default::default()
                    }
                } else {
                    drop(result.files);
                    empty
                };
                (result.hash, inputs)
            }
            HashInstruction::External(external) => {
                let hashed_external = hash_external(
                    external,
                    &self.project_graph.external_nodes,
                    Arc::clone(&self.external_cache),
                )?;
                trace!(parent: &span, "hash_external: {:?}", now.elapsed());
                let inputs = if collect_inputs {
                    instruction.into()
                } else {
                    empty
                };
                (hashed_external, inputs)
            }
            HashInstruction::UltracacheConfiguration(_) => {
                let inputs = if collect_inputs {
                    instruction.into()
                } else {
                    empty
                };
                // The rendered text, so the prefix lives in one place.
                (hash(instruction.to_string().as_bytes()), inputs)
            }
            HashInstruction::AllExternalDependencies => {
                // Identical for every task, so fold once and reuse (individual externals
                // are already cached in external_cache).
                let hashed_all_externals = self
                    .all_externals_hash
                    .get_or_try_init(|| {
                        hash_all_externals(
                            sorted_externals,
                            &self.project_graph.external_nodes,
                            Arc::clone(&self.external_cache),
                        )
                    })?
                    .clone();
                trace!(parent: &span, "hash_all_externals: {:?}", now.elapsed());
                let inputs = if collect_inputs {
                    instruction.into()
                } else {
                    empty
                };
                (hashed_all_externals, inputs)
            }
            HashInstruction::JsonFileSet(json) => {
                // Cache is keyed on the full instruction string so
                // different fields/excludeFields against the same file
                // remain distinct. `instruction.to_string()` already
                // encodes (project_name, json_path, fields, exclude_fields)
                // via the Display impl — see types.rs.
                let cache_key = instruction.to_string();
                // Clone the cached entry and drop the Ref before any
                // subsequent insert to avoid deadlocking DashMap.
                let cached_entry = if let Some(entry) = json_file_set_cache.get(&cache_key) {
                    entry.clone()
                } else {
                    let result = hash_json_files(
                        &self.workspace_root,
                        &json.json_path,
                        json.project_name.as_deref(),
                        json.fields.as_deref(),
                        json.exclude_fields.as_deref(),
                        &self.project_file_map,
                        &self.all_workspace_files,
                    )?;
                    json_file_set_cache.insert(cache_key, result.clone());
                    result
                };
                trace!(parent: &span, "hash_json: {:?}", now.elapsed());
                let inputs = if collect_inputs {
                    HashInputsBuilder {
                        files: cached_entry.files.into_iter().collect(),
                        ..Default::default()
                    }
                } else {
                    empty
                };
                (cached_entry.hash, inputs)
            }
        };
        Ok((hash, inputs))
    }
}

struct HashInstructionArgs<'a> {
    /// The instruction's pool id: the key a disk-backed group's expansion is
    /// shared under within one call. Labels can repeat across tasks.
    id: u32,
    js_env: &'a HashMap<String, String>,
    ts_config_hash: &'a str,
    project_root_mappings: &'a ProjectRootMappings,
    sorted_externals: &'a [&'a String],
    selectively_hash_tsconfig: bool,
    runtime_cache: &'a DashMap<String, String>,
    project_file_set_cache: &'a ProjectFileSetCache,
    workspace_file_set_cache: &'a WorkspaceFileSetCache,
    json_file_set_cache: &'a DashMap<String, JsonHashResult>,
    files_expansion_cache: &'a FilesExpansionCache,
    run_stage: RunStage,
    cwd: &'a std::path::Path,
    collect_inputs: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::test_utils::{hash_plans, strings};

    fn entries(ids: &[u32]) -> Vec<(u32, SharedStr)> {
        ids.iter()
            .map(|id| (*id, format!("value-{id}").into()))
            .collect()
    }

    #[test]
    fn ranked_assembly_hashes_in_label_order_whatever_the_entry_order() {
        let pool = InstructionPool::new();
        let names = ["z", "a", "\u{e000}", "🤖"];
        for name in names {
            pool.intern(HashInstruction::External(name.into()));
        }
        let keys = InstructionKeys::of(&pool);
        let mut sorted: Vec<u32> = (0..names.len() as u32).collect();
        sorted.sort_by_key(|id| names[*id as usize]);
        let mut expected = xxhash_rust::xxh3::Xxh3::new();
        for (_, value) in entries(&sorted) {
            expected.update(value.as_bytes());
        }
        let expected = expected.digest().to_string();
        for offset in 0..names.len() {
            for reverse in [false, true] {
                let mut ids: Vec<u32> = (0..names.len() as u32).collect();
                ids.rotate_left(offset);
                if reverse {
                    ids.reverse();
                }
                let actual =
                    assemble_ranked_hash(entries(&ids), &keys, HashInputsBuilder::default());
                assert_eq!(actual.value, expected);
                assert_eq!(actual.details.keys(), ["a", "z", "\u{e000}", "🤖"]);
            }
        }
        let empty = assemble_ranked_hash(
            vec![],
            &InstructionKeys::of(&InstructionPool::new()),
            HashInputsBuilder::default(),
        );
        assert_eq!(empty.value, hash(b""));
    }

    #[test]
    fn instructions_sharing_a_label_are_both_hashed_and_named_apart_only_together() {
        let pool = InstructionPool::new();
        let left = HashInstruction::IgnoredFileSet(strings(&["a,b", "c"]));
        let right = HashInstruction::IgnoredFileSet(strings(&["a", "b,c"]));
        let left_id = pool.intern(left.clone());
        let right_id = pool.intern(right.clone());
        let keys = InstructionKeys::of(&pool);

        let both = assemble_ranked_hash(
            entries(&[left_id, right_id]),
            &keys,
            HashInputsBuilder::default(),
        );
        let mut names = both.details.keys();
        names.sort();
        let mut expected = vec![
            format!("files:[a,b,c] #{}", left.digest()),
            format!("files:[a,b,c] #{}", right.digest()),
        ];
        expected.sort();
        assert_eq!(names, expected);
        let reversed = assemble_ranked_hash(
            entries(&[right_id, left_id]),
            &keys,
            HashInputsBuilder::default(),
        );
        assert_eq!(reversed.value, both.value);
        let one = assemble_ranked_hash(entries(&[left_id]), &keys, HashInputsBuilder::default());
        assert_ne!(one.value, both.value);
        assert_eq!(one.details.keys(), ["files:[a,b,c]"]);
    }

    #[test]
    fn a_suffixed_label_never_takes_another_instructions_label() {
        let project_files =
            |globs: &[&str]| HashInstruction::ProjectFileSet("p".into(), strings(globs));
        let left = project_files(&["a,b", "c"]);
        let right = project_files(&["a", "b,c"]);
        let taken = format!("a,b,c #{}", left.digest());
        let lookalike = project_files(&[&taken]);
        let next = project_files(&[&format!("{taken} #2")]);
        let pool = InstructionPool::new();
        let ids: Vec<u32> = [left, right, lookalike, next]
            .into_iter()
            .map(|instruction| pool.intern(instruction))
            .collect();
        let keys = InstructionKeys::of(&pool);

        for task in [&ids[..3], &ids[..]] {
            let hashed = assemble_ranked_hash(entries(task), &keys, HashInputsBuilder::default());
            let names = hashed.details.keys();
            let distinct: HashSet<&String> = names.iter().collect();
            assert_eq!(names.len(), task.len());
            assert_eq!(distinct.len(), task.len(), "{names:?}");
            assert!(names.contains(&format!("p:{taken}")));
            assert!(names.contains(&format!("p:{taken} #2")));
        }
        let mut reversed = ids.clone();
        reversed.reverse();
        assert_eq!(
            assemble_ranked_hash(entries(&reversed), &keys, HashInputsBuilder::default())
                .details
                .keys(),
            assemble_ranked_hash(entries(&ids), &keys, HashInputsBuilder::default())
                .details
                .keys(),
        );
    }

    #[test]
    fn a_task_hashes_every_file_of_two_groups_whose_labels_collide() {
        let workspace = tempfile::tempdir().unwrap();
        let write = |name: &str, content: &str| {
            std::fs::write(workspace.path().join(name), content).unwrap();
        };
        for name in ["a,b", "c", "a", "b,c"] {
            write(name, name);
        }
        let plans = hash_plans(&[(
            "p:build",
            vec![
                HashInstruction::IgnoredFileSet(strings(&["a,b", "c"])),
                HashInstruction::IgnoredFileSet(strings(&["a", "b,c"])),
            ],
        )]);
        // Built field by field: `new` takes a napi Buffer, which needs a JS runtime.
        let all_workspace_files = Arc::new(Vec::new());
        let hasher = TaskHasher {
            ignored_index: Arc::new(IgnoredIndexReader::unwatched()),
            workspace_root: workspace.path().to_string_lossy().into_owned(),
            project_graph: Arc::new(ProjectGraph {
                nodes: HashMap::new(),
                dependencies: HashMap::new(),
                external_nodes: HashMap::new(),
            }),
            project_file_map: Arc::new(HashMap::new()),
            all_workspace_files: Arc::clone(&all_workspace_files),
            ts_config: Vec::new(),
            ts_config_paths: HashMap::new(),
            root_tsconfig_path: None,
            options: None,
            external_cache: Arc::new(DashMap::new()),
            workspace_file_set_cache: WorkspaceFileSetCache::new(),
            project_file_set_cache: ProjectFileSetCache::new(),
            workspace_file_indices_cache: WorkspaceFileIndicesCache::new(),
            project_file_indices_cache: ProjectFileIndicesCache::new(),
            all_externals_hash: OnceCell::new(),
            workspace_file_index: WorkspaceFileIndex::new(all_workspace_files),
        };
        let env = HashMap::new();
        let hash = || {
            let hashes = hasher
                .hash_plans_impl(
                    &plans,
                    workspace.path().to_string_lossy().into_owned(),
                    None,
                    RunStage::ATaskMayHaveWritten,
                    |_| &env,
                )
                .unwrap();
            let details = hashes.0.get("p:build").unwrap();
            (details.value.clone(), details.details.keys().len())
        };

        let (original, detail_count) = hash();
        assert_eq!(detail_count, 2);
        write("a,b", "changed");
        let (left_changed, _) = hash();
        assert_ne!(left_changed, original);
        write("a", "changed");
        assert_ne!(hash().0, left_changed);
    }

    #[test]
    fn intern_value_shares_one_allocation_per_unique_value() {
        let interner: DashMap<String, Arc<str>> = DashMap::new();

        let first = intern_value(&interner, "12345".to_string());
        let second = intern_value(&interner, "12345".to_string());
        let other = intern_value(&interner, "67890".to_string());

        assert_eq!(&*first, "12345");
        assert!(Arc::ptr_eq(&first, &second));
        assert!(!Arc::ptr_eq(&first, &other));
        assert_eq!(interner.len(), 2);
    }
}
