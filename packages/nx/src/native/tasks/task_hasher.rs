use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

use hashbrown::HashSet;

use crate::native::tasks::types::{ALWAYS_ON_WORKSPACE_FILES, IO_SNAPSHOT_MARKER_PREFIX};
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
        FilesExpansionCache, JsonHashResult, Members, ProjectFileIndicesCache, ProjectFileSetCache,
        WALK, WorkspaceFileIndicesCache, WorkspaceFileSetCache, collect_project_file_paths_cached,
        collect_workspace_file_paths_cached, expand_files_cached, hash_all_externals,
        hash_external, hash_files, hash_json_files, hash_project_config, hash_project_files_cached,
        hash_task_output, hash_tsconfig_selectively, hash_workspace_files_cached, index_file_map,
        literal_prefix, normalize_glob, output_prefixes,
    },
    types::FileData,
    workspace::context::IgnoredIndexReader,
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
    /// Provenance of every value above, keyed by the value itself.
    #[napi(ts_type = "Record<string, 'snapshot' | 'target' | 'dependency' | 'native'>")]
    pub sources: HashMap<String, String>,
    /// Domain markers in the plan, e.g. `io-snapshot:<digest>`.
    pub markers: Vec<String>,
}

/// Where an input value came from; see `input_source`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum InputSource {
    Snapshot,
    Target,
    Dependency,
    Native,
}

impl InputSource {
    fn as_str(self) -> &'static str {
        match self {
            InputSource::Snapshot => "snapshot",
            InputSource::Target => "target",
            InputSource::Dependency => "dependency",
            InputSource::Native => "native",
        }
    }
}

/// Classifies one instruction's inputs for `HashInputs::sources`. A plan that
/// carries an io-snapshot marker had its declared filesets replaced, so its
/// file-bearing instructions are snapshot-sourced; otherwise filesets are
/// `target` (own project) or `dependency`. Env/runtime/externals/config are
/// always native.
pub(crate) fn input_source(
    instruction: &HashInstruction,
    task_project: &str,
    snapshot_backed: bool,
) -> InputSource {
    match instruction {
        HashInstruction::ProjectFileSet(project, _, _) => {
            if snapshot_backed {
                InputSource::Snapshot
            } else if project == task_project {
                InputSource::Target
            } else {
                InputSource::Dependency
            }
        }
        HashInstruction::WorkspaceFileSet(file_sets) => {
            if file_sets.iter().eq(ALWAYS_ON_WORKSPACE_FILES.iter()) {
                InputSource::Native
            } else if snapshot_backed {
                InputSource::Snapshot
            } else {
                InputSource::Target
            }
        }
        HashInstruction::TaskOutput(_, _) => {
            if snapshot_backed {
                InputSource::Snapshot
            } else {
                InputSource::Dependency
            }
        }
        _ => InputSource::Native,
    }
}

/// True when the plan carries an io-snapshot marker.
pub(crate) fn is_snapshot_backed(pool: &InstructionPool, ids: &[u32]) -> bool {
    ids.iter().any(|id| {
        matches!(&*pool.get(*id), HashInstruction::Marker(m) if m.starts_with(IO_SNAPSHOT_MARKER_PREFIX))
    })
}

pub(crate) fn task_project(task_id: &str) -> &str {
    task_id.split(':').next().unwrap_or(task_id)
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
    pub(crate) sources: HashMap<String, &'static str>,
    pub(crate) markers: HashSet<String>,
}

impl HashInputsBuilder {
    /// Extends this builder with all values from another builder
    pub(crate) fn extend(&mut self, other: HashInputsBuilder) {
        self.files.extend(other.files);
        self.runtime.extend(other.runtime);
        self.environment.extend(other.environment);
        self.dep_outputs.extend(other.dep_outputs);
        self.external.extend(other.external);
        for (value, source) in other.sources {
            self.sources.entry(value).or_insert(source);
        }
        self.markers.extend(other.markers);
    }

    /// Records `source` for every value currently in the builder.
    pub(crate) fn tag(mut self, source: InputSource) -> Self {
        let label = source.as_str();
        for value in self
            .files
            .iter()
            .chain(self.runtime.iter())
            .chain(self.environment.iter())
            .chain(self.dep_outputs.iter())
            .chain(self.external.iter())
        {
            self.sources.entry(value.clone()).or_insert(label);
        }
        self
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
            HashInstruction::Marker(marker) => HashInputsBuilder {
                markers: HashSet::from([marker.clone()]),
                ..Default::default()
            },
            HashInstruction::ProjectConfiguration(_) | HashInstruction::Cwd(_) => {
                HashInputsBuilder::default()
            }
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
            sources: builder
                .sources
                .into_iter()
                .map(|(k, v)| (k, v.to_string()))
                .collect(),
            markers: to_sorted_vec(builder.markers),
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

/// Each pooled key's position in the existing UTF-8 hash order, so per-task
/// ordering compares integers instead of strings. Equal display keys share a
/// rank, even when their instruction ids differ.
struct KeyRanks {
    by_id: Vec<u32>,
    has_duplicate_keys: bool,
}

impl KeyRanks {
    fn of(&self, id: u32) -> u32 {
        self.by_id[id as usize]
    }
}

fn instruction_key_ranks(keys: &[SharedStr]) -> KeyRanks {
    let mut ids: Vec<u32> = (0..keys.len() as u32).collect();
    ids.sort_unstable_by(|&left, &right| keys[left as usize].cmp(&keys[right as usize]));
    let mut by_id = vec![0; keys.len()];
    let mut has_duplicate_keys = false;
    let mut rank = 0;
    for (index, &id) in ids.iter().enumerate() {
        if index > 0 {
            if keys[id as usize] == keys[ids[index - 1] as usize] {
                has_duplicate_keys = true;
            } else {
                rank += 1;
            }
        }
        by_id[id as usize] = rank;
    }
    KeyRanks {
        by_id,
        has_duplicate_keys,
    }
}

/// Collapses equal-ranked entries onto the LAST of each run, matching the
/// last-value-wins behavior of the HashMap insertion this replaced. `dedup_by`
/// drops the first argument and keeps the second, so the later value is moved
/// backwards into the entry that survives.
fn keep_last_per_rank(entries: &mut Vec<(u32, SharedStr)>, ranks: &KeyRanks) {
    // Stable, so equal display keys keep their incoming order before deduping.
    entries.sort_by_key(|(id, _)| ranks.of(*id));
    entries.dedup_by(|later, earlier| {
        if ranks.of(later.0) == ranks.of(earlier.0) {
            std::mem::swap(&mut later.1, &mut earlier.1);
            true
        } else {
            false
        }
    });
}

fn assemble_ranked_hash(
    mut entries: Vec<(u32, SharedStr)>,
    keys: &Arc<[SharedStr]>,
    ranks: &KeyRanks,
    inputs: HashInputsBuilder,
) -> HashDetails {
    if ranks.has_duplicate_keys {
        keep_last_per_rank(&mut entries, ranks);
        // The result now keeps this buffer. Do not retain slots discarded by
        // duplicate display-key resolution (the old materialization shrank it).
        entries.shrink_to_fit();
    } else {
        entries.sort_unstable_by_key(|(id, _)| ranks.of(*id));
    }
    let mut hasher = xxhash_rust::xxh3::Xxh3::new();
    for (id, value) in &entries {
        trace!("Adding {} ({}) to hash", value, keys[*id as usize]);
        hasher.update(value.as_bytes());
    }
    HashDetails {
        value: hasher.digest().to_string(),
        details: SharedStrMap::from_indexed_entries(Arc::clone(keys), entries),
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
    // `includeIgnored` filesets: a path index over the file map so tracked
    // files skip the disk, built only once a plan carries a disk-backed
    // group. Their content lives in the context's IgnoredIndex.
    workspace_file_index: OnceCell<HashMap<String, u32>>,
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
            workspace_file_index: OnceCell::new(),
        }
    }

    /// Hands the index every directory the plans read from disk: each
    /// includeIgnored glob's literal prefix and each declared output's. The
    /// index lists a registered directory to the up-front batch and keeps the
    /// hashes of what is under it; unregistered ones are walked.
    fn register_prefixes(&self, hash_plans: &HashPlans) {
        let pool = &hash_plans.pool;
        let mut prefixes: Vec<String> = Vec::new();
        for id in 0..pool.len() as u32 {
            match pool.get(id).value() {
                HashInstruction::ProjectFileSet(_, globs, true) => prefixes.extend(
                    globs
                        .iter()
                        .filter(|g| !g.starts_with('!'))
                        .filter_map(|g| {
                            let glob = normalize_glob(g);
                            literal_prefix(&glob).ok().map(|(root, _)| root)
                        }),
                ),
                HashInstruction::TaskOutput(_, outputs) => {
                    prefixes.extend(output_prefixes(outputs))
                }
                _ => {}
            }
        }
        // Widest first, so a directory inside another registers as a no-op.
        prefixes.sort();
        prefixes.dedup();
        prefixes.sort_by_key(|p| p.len());
        let workspace_root = Path::new(&self.workspace_root);
        for prefix in prefixes {
            self.ignored_index.register(workspace_root, &prefix);
        }
    }

    fn workspace_file_known(&self, path: &str) -> bool {
        self.workspace_file_index
            .get_or_init(|| index_file_map(&self.all_workspace_files))
            .contains_key(path)
    }

    fn workspace_file_hash(&self, path: &str) -> Option<String> {
        self.workspace_file_index
            .get_or_init(|| index_file_map(&self.all_workspace_files))
            .get(path)
            .map(|&i| self.all_workspace_files[i as usize].hash.clone())
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
        self.hash_plans_impl(hash_plans, cwd, collect_task_inputs, false, |task_id| {
            per_task_envs
                .get(task_id)
                .expect("per-task env presence verified above")
        })
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
        let hashes = self.hash_plans_impl(&upfront, cwd, collect_task_inputs, true, |task_id| {
            per_task_envs
                .get(task_id)
                .expect("per-task env presence verified above")
        })?;
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
        self.hash_plans_impl(&subset, cwd, collect_task_inputs, false, |task_id| {
            per_task_envs
                .get(task_id)
                .expect("per-task env presence verified above")
        })
    }

    /// `trust_file_map` lets a disk-backed fileset take the file map's word
    /// for tracked files. That holds before any task runs; once one has,
    /// a tracked file it rewrote is stale in the map, so everything reads
    /// from disk.
    fn hash_plans_impl<'a, F>(
        &self,
        hash_plans: &HashPlans,
        cwd: String,
        collect_task_inputs: Option<bool>,
        trust_file_map: bool,
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
        let instruction_keys: Arc<[SharedStr]> = (0..pool.len() as u32)
            .map(|id| SharedStr::from(pool.label(id)))
            .collect();
        let key_ranks = instruction_key_ranks(&instruction_keys);
        // Classify once per instruction, so cache hits do not need the pool's
        // shard lock. The exhaustive match keeps env-dependent inputs out of
        // the shared slots even when new instruction variants are introduced.
        let value_slots: Vec<Option<OnceCell<SharedStr>>> = (0..pool.len() as u32)
            .map(|id| match pool.get(id).value() {
                HashInstruction::Environment(_) | HashInstruction::Runtime(_) => None,
                HashInstruction::WorkspaceFileSet(_)
                | HashInstruction::Cwd(_)
                | HashInstruction::ProjectFileSet(_, _, _)
                | HashInstruction::ProjectConfiguration(_)
                | HashInstruction::TsConfiguration(_)
                | HashInstruction::TaskOutput(_, _)
                | HashInstruction::External(_)
                | HashInstruction::AllExternalDependencies
                | HashInstruction::JsonFileSet(_)
                | HashInstruction::Marker(_) => Some(OnceCell::new()),
            })
            .collect();
        hash_plans.plans.par_iter().try_for_each(|(task_id, ids)| {
            if ids.is_empty() {
                return Ok(());
            }
            let js_env = resolve_env(task_id);
            let snapshot_backed = should_collect_inputs && is_snapshot_backed(pool, ids);
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
                                let label = pool.label(id);
                                let (hash_value, inputs) = self.hash_instruction(
                                    task_id,
                                    instruction_ref.value(),
                                    HashInstructionArgs {
                                        label: &label,
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
                                        trust_file_map,
                                        cwd: cwd_path,
                                        collect_inputs: should_collect_inputs,
                                    },
                                )?;

                                if should_collect_inputs {
                                    task_inputs.extend(inputs.tag(input_source(
                                        instruction_ref.value(),
                                        task_project(task_id),
                                        snapshot_backed,
                                    )));
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
                trace_span!("Assembling hash", hash_id = task_id).in_scope(|| {
                    assemble_ranked_hash(entries, &instruction_keys, &key_ranks, inputs)
                }),
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
            label,
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
            trust_file_map,
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
                    &self.all_workspace_files,
                    workspace_file_set_cache,
                )?;
                trace!(parent: &span, "hash_workspace_files: {:?}", now.elapsed());
                let inputs = if collect_inputs {
                    let files = collect_workspace_file_paths_cached(
                        workspace_file_set,
                        &self.all_workspace_files,
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
            HashInstruction::ProjectFileSet(_, globs, true) => {
                let workspace_root = Path::new(&self.workspace_root);
                // The index lists a directory only while nothing has run,
                // like the file map; afterwards the disk is walked.
                let listed = |dir: &str| self.ignored_index.list(dir);
                let members: Members = if trust_file_map { &listed } else { WALK };
                let expansion = expand_files_cached(
                    workspace_root,
                    label,
                    globs,
                    files_expansion_cache,
                    &|path| trust_file_map && self.workspace_file_known(path),
                    members,
                )?;
                let hashed = hash_files(
                    workspace_root,
                    &expansion,
                    |path| {
                        if trust_file_map {
                            self.workspace_file_hash(path)
                        } else {
                            None
                        }
                    },
                    self.ignored_index.index(),
                    trust_file_map,
                );
                trace!(parent: &span, "hash_files: {:?}", now.elapsed());
                let inputs = if collect_inputs {
                    HashInputsBuilder {
                        files: expansion
                            .files
                            .iter()
                            .chain(expansion.missing.iter())
                            .cloned()
                            .collect(),
                        ..Default::default()
                    }
                } else {
                    empty
                };
                (hashed, inputs)
            }
            HashInstruction::ProjectFileSet(project_name, file_sets, false) => {
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
            HashInstruction::Marker(marker) => {
                let inputs = if collect_inputs {
                    instruction.into()
                } else {
                    empty
                };
                (hash(marker.as_bytes()), inputs)
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
    /// `InstructionPool::label` of the instruction: the details key, and the
    /// key a disk-backed group's expansion is shared under within one call.
    label: &'a str,
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
    trust_file_map: bool,
    cwd: &'a std::path::Path,
    collect_inputs: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ranked_assembly_matches_map_order_and_duplicate_resolution() {
        for names in [
            vec!["z", "a", "\u{e000}", "🤖"],
            vec!["z", "a", "\u{e000}", "🤖", "a", "z"],
        ] {
            let keys: Arc<[SharedStr]> = names.into_iter().map(|s| s.to_string().into()).collect();
            let ranks = instruction_key_ranks(&keys);
            for offset in 0..keys.len() {
                for reverse in [false, true] {
                    let mut entries: Vec<(u32, SharedStr)> = (0..keys.len())
                        .map(|id| (id as u32, format!("value-{id}").into()))
                        .collect();
                    entries.rotate_left(offset);
                    if reverse {
                        entries.reverse();
                    }
                    let expected: HashMap<SharedStr, SharedStr> = entries
                        .iter()
                        .map(|(id, value)| (keys[*id as usize].clone(), value.clone()))
                        .collect();
                    let mut expected_entries: Vec<_> = expected.iter().collect();
                    expected_entries.sort_unstable_by(|(left, _), (right, _)| left.cmp(right));
                    let mut expected_hash = xxhash_rust::xxh3::Xxh3::new();
                    for (_, value) in expected_entries {
                        expected_hash.update(value.as_bytes());
                    }
                    let actual =
                        assemble_ranked_hash(entries, &keys, &ranks, HashInputsBuilder::default());
                    assert_eq!(actual.value, expected_hash.digest().to_string());
                }
            }
        }
        let empty = assemble_ranked_hash(
            vec![],
            &Arc::from([]),
            &instruction_key_ranks(&[]),
            HashInputsBuilder::default(),
        );
        assert_eq!(empty.value, hash(b""));
    }

    #[test]
    fn duplicate_detail_keys_do_not_retain_discarded_entry_capacity() {
        let key: SharedStr = "duplicate".to_string().into();
        let value: SharedStr = "shared-value".to_string().into();
        let keys: Arc<[SharedStr]> = vec![key; 10_000].into();
        let ranks = instruction_key_ranks(&keys);
        let entries = (0..keys.len() as u32)
            .map(|id| (id, value.clone()))
            .collect();
        let result = assemble_ranked_hash(entries, &keys, &ranks, HashInputsBuilder::default());
        assert_eq!(result.value, hash(value.as_bytes()));
        assert!(
            result.details.entry_capacity() <= 2,
            "One detail retained {} entry slots",
            result.details.entry_capacity()
        );
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
