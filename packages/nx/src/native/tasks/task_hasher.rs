use super::plan::{Plan, kind};
use std::collections::{BTreeMap, HashMap};
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
        FilesExpansion, FilesExpansionCache, JsonHashResult, ProjectFileIndicesCache,
        ProjectFileSetCache, SettledFiles, Source, TrackedBatch, WorkspaceFileIndex,
        WorkspaceFileIndicesCache, WorkspaceFileSetCache, collect_project_file_paths_cached,
        collect_project_files, collect_workspace_file_paths_cached, expand_cached, expand_globs,
        expand_task_outputs, file_hashes, fold_file_hashes, hash_all_externals, hash_external,
        hash_files, hash_json_files, hash_project_config, hash_project_files_cached,
        hash_task_output, hash_tsconfig_selectively, hash_workspace_files_cached, output_prefixes,
    },
    types::FileData,
    walker::{PathPredicate, is_normalized_disk_root},
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

/// Folds each run of equal-ranked entries into one entry whose value hashes
/// every value in the run. Different instructions can share a label, and a
/// task's details keep one value per label, so none of them may be dropped.
fn fold_equal_ranks(entries: &mut Vec<(u32, SharedStr)>, ranks: &KeyRanks) {
    // Values order each run, so the folded value does not depend on the
    // order the entries were computed in.
    entries.sort_unstable_by(|(left_id, left), (right_id, right)| {
        ranks
            .of(*left_id)
            .cmp(&ranks.of(*right_id))
            .then_with(|| left.cmp(right))
    });
    let mut kept = 0;
    let mut start = 0;
    while start < entries.len() {
        let rank = ranks.of(entries[start].0);
        let end = start + entries[start..].partition_point(|(id, _)| ranks.of(*id) == rank);
        if end - start > 1 {
            let mut hasher = xxhash_rust::xxh3::Xxh3::new();
            for (index, (_, value)) in entries[start..end].iter().enumerate() {
                if index > 0 {
                    hasher.update(b"\0");
                }
                hasher.update(value.as_bytes());
            }
            entries[start].1 = hasher.digest().to_string().into();
        }
        entries.swap(kept, start);
        kept += 1;
        start = end;
    }
    if kept < entries.len() {
        entries.truncate(kept);
        // The result keeps this buffer, so release the folded entries' slots.
        entries.shrink_to_fit();
    }
}

fn assemble_ranked_hash(
    mut entries: Vec<(u32, SharedStr)>,
    keys: &Arc<[SharedStr]>,
    ranks: &KeyRanks,
    inputs: HashInputsBuilder,
) -> HashDetails {
    if ranks.has_duplicate_keys {
        fold_equal_ranks(&mut entries, ranks);
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
        let mut seen_globs = hashbrown::HashSet::<Arc<str>>::new();
        let mut prefixes: Vec<String> = Vec::new();
        let mut output_roots: Vec<String> = Vec::new();
        for id in 0..pool.len() as u32 {
            match pool.get(id).value() {
                HashInstruction::IgnoredFileSet { globs, .. } => {
                    prefixes.extend(globs.iter().filter_map(|g| {
                        if g.starts_with('!') || seen_globs.contains(g.as_ref()) {
                            return None;
                        }
                        seen_globs.insert(g.clone());
                        let glob = normalize_glob(g);
                        Some(partition_glob(&glob).0)
                    }))
                }
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

    /// The file map's hash for `path`, trusted only while nothing has run.
    fn known_file_hash(&self, path: &str, run_stage: RunStage) -> Option<String> {
        if run_stage.nothing_ran() {
            self.workspace_file_hash(path)
        } else {
            None
        }
    }

    /// The files a disk-backed group matches, shared under its pool id.
    fn expand_ignored_files(
        &self,
        id: u32,
        globs: &[Arc<str>],
        project_roots: &[String],
        files_expansion_cache: &FilesExpansionCache,
        run_stage: RunStage,
    ) -> anyhow::Result<Arc<FilesExpansion>> {
        let workspace_root = Path::new(&self.workspace_root);
        // The index answers from a listing it keeps only while nothing has
        // run, like the file map; afterwards it reads the disk for us.
        let list_directory = |dir: &str, accept: PathPredicate, skip: &[String]| {
            self.ignored_index.index().files_under(
                workspace_root,
                dir,
                // An unwatched index would rewalk the entire prefix to list it.
                // Use the pruned walker when skips can avoid that work.
                run_stage.nothing_ran()
                    && is_normalized_disk_root(dir)
                    && (skip.is_empty() || self.ignored_index.index().has_watch()),
                accept,
                skip,
            )
        };
        expand_cached(&format!("files#{id}"), files_expansion_cache, || {
            expand_globs(
                globs,
                project_roots,
                &Source::fileset(
                    workspace_root,
                    &|path| run_stage.nothing_ran() && self.workspace_tracks_file(path),
                    list_directory,
                ),
            )
        })
    }

    /// A recorded plan's group and tracked fileset files, `(path, hash)` each,
    /// and the files its `TaskOutput`s and declared groups hash, for
    /// `fold_recorded_files`.
    fn recorded_file_lists(
        &self,
        ids: &[u32],
        pool: &InstructionPool,
        caches: &RecordedCaches,
        batch: &FileSetBatch,
        files_expansion_cache: &FilesExpansionCache,
        run_stage: RunStage,
    ) -> anyhow::Result<RecordedFileLists> {
        let workspace_root = Path::new(&self.workspace_root);
        let tracked = |p: &str| run_stage.nothing_ran() && self.workspace_tracks_file(p);
        let read = |p: &str| self.disk_file_hash(p, run_stage);
        let mut groups = ids
            .par_iter()
            .filter_map(|&id| match pool.get(id).value() {
                group @ (HashInstruction::IgnoredFileSet {
                    from_ultracache: true,
                    ..
                }
                | HashInstruction::ProjectFileSet(..)
                | HashInstruction::WorkspaceFileSet(_)) => {
                    Some((id, matches!(group, HashInstruction::IgnoredFileSet { .. })))
                }
                _ => None,
            })
            .map(|(id, reads_disk)| {
                if let Some(cached) = caches.group_files.get(&id) {
                    return Ok((reads_disk, Arc::clone(&cached)));
                }
                let hashed = Arc::new(match pool.get(id).value().clone() {
                    HashInstruction::ProjectFileSet(project, file_sets) => {
                        let files = match batch.select_tracked(Some(&project), &file_sets)? {
                            Some(files) => files,
                            None => {
                                collect_project_files(&project, &file_sets, &self.project_file_map)?
                            }
                        };
                        files
                            .into_iter()
                            .map(|file| (file.file.clone(), file.hash.clone()))
                            .collect()
                    }
                    HashInstruction::WorkspaceFileSet(file_sets) => {
                        if let Some(files) = batch.select_tracked(None, &file_sets)? {
                            files
                                .into_iter()
                                .map(|f| (f.file.clone(), f.hash.clone()))
                                .collect()
                        } else {
                            collect_workspace_file_paths_cached(
                                &file_sets,
                                &self.workspace_file_index,
                                &self.workspace_file_indices_cache,
                            )?
                            .into_iter()
                            .map(|file| match self.workspace_file_hash(&file) {
                                Some(hash) => Ok((file, hash)),
                                None => {
                                    Err(anyhow::anyhow!("{file} is not in the workspace file map"))
                                }
                            })
                            .collect::<anyhow::Result<_>>()?
                        }
                    }
                    HashInstruction::IgnoredFileSet {
                        globs,
                        project_roots,
                        ..
                    } => {
                        if let Some(disk) = batch.disk_for_group(id) {
                            disk.file_hashes(&globs, &project_roots, &tracked, read)?
                        } else {
                            file_hashes(
                                workspace_root,
                                &*self.expand_ignored_files(
                                    id,
                                    &globs,
                                    &project_roots,
                                    files_expansion_cache,
                                    run_stage,
                                )?,
                                |path| self.known_file_hash(path, run_stage),
                                self.ignored_index.index(),
                                run_stage,
                            )
                        }
                    }
                    _ => unreachable!("filtered to the plan's groups"),
                });
                caches.group_files.insert(id, Arc::clone(&hashed));
                Ok((reads_disk, hashed))
            })
            .collect::<anyhow::Result<Vec<_>>>()?;
        // Disk-backed groups last: for a path in both, the fold keeps the
        // disk's hash, which is current after a task rewrote the file.
        groups.sort_by_key(|(reads_disk, _)| *reads_disk);
        let groups = groups.into_iter().map(|(_, files)| files).collect();
        let covered = ids
            .par_iter()
            .filter(|&&id| {
                matches!(
                    pool.get(id).value(),
                    HashInstruction::TaskOutput(..)
                        | HashInstruction::IgnoredFileSet {
                            from_ultracache: false,
                            ..
                        }
                )
            })
            .map(|&id| {
                if let Some(cached) = caches.covered_files.get(&id) {
                    return Ok(Arc::clone(&cached));
                }
                let expansion = match pool.get(id).value().clone() {
                    HashInstruction::TaskOutput(glob, outputs) => Arc::new(expand_task_outputs(
                        workspace_root,
                        &glob,
                        &outputs,
                        files_expansion_cache,
                    )?),
                    HashInstruction::IgnoredFileSet {
                        globs,
                        project_roots,
                        ..
                    } => {
                        if let Some(disk) = batch.disk_for_group(id) {
                            Arc::new(disk.paths(&globs, &project_roots, &tracked)?)
                        } else {
                            self.expand_ignored_files(
                                id,
                                &globs,
                                &project_roots,
                                files_expansion_cache,
                                run_stage,
                            )?
                        }
                    }
                    _ => unreachable!("filtered to covering instructions"),
                };
                let files: Arc<HashSet<String>> =
                    Arc::new(expansion.files.iter().cloned().collect());
                caches.covered_files.insert(id, Arc::clone(&files));
                Ok(files)
            })
            .collect::<anyhow::Result<Vec<_>>>()?;
        Ok((groups, covered))
    }

    fn disk_file_hash(&self, path: &str, stage: RunStage) -> Option<String> {
        self.known_file_hash(path, stage).or_else(|| {
            self.ignored_index
                .index()
                .hash_file(Path::new(&self.workspace_root), path, None, stage)
        })
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
    /// upstream task's output, or one that hashes its absolute cwd). The rest
    /// are left out and hash where they run; their ids are absent from the
    /// result and need no entry in `per_task_envs`.
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
        let plans: HashMap<String, Plan> = hash_plans
            .plans
            .iter()
            .filter(|(task_id, _)| !hash_plans.deferred.contains(task_id.as_str()))
            .map(|(task_id, ids)| (task_id.clone(), ids.clone()))
            .collect();
        let partition_duration = function_start.elapsed();
        let (upfront_count, total_count) = (plans.len(), hash_plans.plans.len());
        trace!(
            "hash_plans_upfront: {} of {} plans hash up front, {} deferred (partition: {:?})",
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
        let plans: HashMap<String, Plan> = task_ids
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
        let json_file_set_cache: DashMap<u32, JsonHashResult> = DashMap::new();
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
        // Catching up locks the files and may hash on the rayon pool, so it
        // runs once here: a pool job doing it could end up waiting on itself.
        if hash_plans.plans.values().any(|plan| plan.has(kind::DISK)) {
            self.ignored_index.catch_up();
        }
        let batch = FileSetBatch {
            tracked: TrackedBatch::for_plans(
                hash_plans,
                &self.project_file_map,
                &self.all_workspace_files,
            ),
            // Up-front daemon reads can seed or reuse watch-maintained
            // listings. After tasks run, expansion must observe the disk.
            disk: if run_stage.nothing_ran() && self.ignored_index.index().has_watch() {
                None
            } else {
                SettledFiles::for_plans(Path::new(&self.workspace_root), hash_plans, &|p| {
                    run_stage.nothing_ran() && self.workspace_tracks_file(p)
                })?
            },
        };
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
                | HashInstruction::ProjectFileSet(_, _)
                | HashInstruction::IgnoredFileSet { .. }
                | HashInstruction::ProjectConfiguration(_)
                | HashInstruction::TsConfiguration(_)
                | HashInstruction::TaskOutput(_, _)
                | HashInstruction::External(_)
                | HashInstruction::AllExternalDependencies
                | HashInstruction::JsonFileSet(_)
                | HashInstruction::UltracacheConfiguration(_) => Some(OnceCell::new()),
            })
            .collect();
        // Also classified once, for the same reason as `value_slots`.
        let fold_kinds: Vec<FoldKind> = (0..pool.len() as u32)
            .map(|id| match pool.get(id).value() {
                HashInstruction::UltracacheConfiguration(_) => FoldKind::UltracacheConfiguration,
                HashInstruction::IgnoredFileSet {
                    from_ultracache: true,
                    ..
                } => FoldKind::UltracacheGroup,
                HashInstruction::ProjectFileSet(..) | HashInstruction::WorkspaceFileSet(_) => {
                    FoldKind::TrackedFiles
                }
                HashInstruction::TaskOutput(..) | HashInstruction::IgnoredFileSet { .. } => {
                    FoldKind::CoversReads
                }
                _ => FoldKind::Other,
            })
            .collect();
        let is = |id: u32, kind: FoldKind| fold_kinds[id as usize] == kind;
        let recorded_caches = RecordedCaches::default();
        hash_plans
            .plans
            .par_iter()
            .try_for_each(|(task_id, plan)| {
                let ids = plan.ids();
                if ids.is_empty() {
                    return Ok(());
                }
                // A recorded plan with something that could cover its reads folds
                // them into its configuration entry, see `fold_recorded_files`.
                let folds_recorded = ids
                    .iter()
                    .any(|&id| is(id, FoldKind::UltracacheConfiguration))
                    && ids.iter().any(|&id| is(id, FoldKind::CoversReads));
                let js_env = resolve_env(task_id);
                // Workers accumulate locally, then publish one result per task.
                // The inner parallel iterator also preserves concurrency when
                // a single task has several expensive runtime/file inputs.
                // Most instructions are already shared cache hits after the first
                // few tasks. Copy those locally; only work that may need computing
                // goes through the inner parallel iterator.
                let mut entries = Vec::with_capacity(ids.len());
                let mut pending = Vec::new();
                for &id in ids.iter() {
                    if folds_recorded
                        && (is(id, FoldKind::UltracacheGroup) || is(id, FoldKind::TrackedFiles))
                    {
                        continue;
                    }
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
                let hash_pending = || {
                    pending
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
                                                project_file_set_cache: &self
                                                    .project_file_set_cache,
                                                workspace_file_set_cache: &self
                                                    .workspace_file_set_cache,
                                                json_file_set_cache: &json_file_set_cache,
                                                files_expansion_cache: &files_expansion_cache,
                                                batch: &batch,
                                                run_stage,
                                                cwd: cwd_path,
                                                collect_inputs: should_collect_inputs,
                                            },
                                        )?;

                                        if should_collect_inputs {
                                            task_inputs.extend(inputs);
                                        }

                                        match slot {
                                            Some(slot) => slot
                                                .get_or_init(|| SharedStr::from(hash_value))
                                                .clone(),
                                            None => {
                                                intern_value(&value_interner, hash_value).into()
                                            }
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
                        )
                };
                let ((computed, mut inputs), recorded_lists) = if folds_recorded {
                    let (hashed, lists) = rayon::join(hash_pending, || {
                        self.recorded_file_lists(
                            &ids,
                            pool,
                            &recorded_caches,
                            &batch,
                            &files_expansion_cache,
                            run_stage,
                        )
                    });
                    (hashed?, Some(lists?))
                } else {
                    (hash_pending()?, None)
                };
                entries.extend(computed);
                if let Some(lists) = recorded_lists {
                    let (recorded, files) = fold_recorded_files(&lists, should_collect_inputs);
                    if let Some((_, value)) = entries
                        .iter_mut()
                        .find(|(id, _)| is(*id, FoldKind::UltracacheConfiguration))
                    {
                        *value = SharedStr::from(hash(format!("{value}{recorded}").as_bytes()));
                    }
                    if should_collect_inputs {
                        inputs.files.extend(files);
                    }
                }
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
            batch,
            run_stage,
            cwd,
            collect_inputs,
        }: HashInstructionArgs,
    ) -> anyhow::Result<(String, HashInputsBuilder)> {
        let now = std::time::Instant::now();
        let span = trace_span!("hashing", task_id).entered();
        let empty = HashInputsBuilder::default();
        if let Some(batch) = &batch.tracked {
            let group = match instruction {
                HashInstruction::ProjectFileSet(p, globs) => Some((Some(p.as_str()), globs)),
                HashInstruction::WorkspaceFileSet(globs) => Some((None, globs)),
                _ => None,
            };
            if let Some((project, globs)) = group
                && let Some(files) = batch.select(project, globs)?
            {
                let value = super::hashers::fold_files(files.iter().copied());
                let mut inputs = HashInputsBuilder::default();
                if collect_inputs {
                    inputs
                        .files
                        .extend(files.into_iter().map(|f| f.file.clone()));
                }
                return Ok((value, inputs));
            }
        }
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
            HashInstruction::IgnoredFileSet {
                globs,
                project_roots,
                ..
            } => {
                if let Some(inventory) = batch.disk_for_group(id) {
                    let (hash, files) = inventory.hash(
                        globs,
                        project_roots,
                        &|p| run_stage.nothing_ran() && self.workspace_tracks_file(p),
                        |p| self.disk_file_hash(p, run_stage),
                        collect_inputs,
                    )?;
                    return Ok((
                        hash,
                        HashInputsBuilder {
                            files: files.into_iter().collect(),
                            ..empty
                        },
                    ));
                }
                let expansion = self.expand_ignored_files(
                    id,
                    globs,
                    project_roots,
                    files_expansion_cache,
                    run_stage,
                )?;
                let hashed = hash_files(
                    Path::new(&self.workspace_root),
                    &expansion,
                    |path| self.known_file_hash(path, run_stage),
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
                // Keyed by pool id: Display renders fields `["a,b"]` and `["a", "b"]` alike.
                // Clone the cached entry and drop the Ref before any
                // subsequent insert to avoid deadlocking DashMap.
                let cached_entry = if let Some(entry) = json_file_set_cache.get(&id) {
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
                    json_file_set_cache.insert(id, result.clone());
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

/// What an instruction is to the fold of a plan's Ultracache reads.
#[derive(Clone, Copy, PartialEq, Eq)]
enum FoldKind {
    UltracacheConfiguration,
    UltracacheGroup,
    /// A fileset of tracked files. In a plan that folds, the recording's
    /// reads are these, so they fold with the groups.
    TrackedFiles,
    /// Hashes files on its own, so Ultracache reads of them need not count.
    CoversReads,
    Other,
}

type RecordedFileLists = (Vec<Arc<Vec<(String, String)>>>, Vec<Arc<HashSet<String>>>);

/// One value for a recorded plan's group files: every file, by path, minus
/// those its `TaskOutput`s and declared groups hash. A path listed twice
/// takes the hash of the later group. So whether a recording
/// read a file those already hash, and how the reads were grouped, leaves the
/// hash alone. Also returns the paths kept when `collect_inputs`.
fn fold_recorded_files(
    (groups, covered): &RecordedFileLists,
    collect_inputs: bool,
) -> (String, Vec<String>) {
    let kept: BTreeMap<&String, &String> = groups
        .iter()
        .flat_map(|group| group.iter())
        .filter(|(file, _)| !covered.iter().any(|files| files.contains(file)))
        .map(|(file, hash)| (file, hash))
        .collect();
    let folded = fold_file_hashes(kept.iter().map(|(file, hash)| (*file, *hash)));
    let paths = if collect_inputs {
        kept.into_keys().cloned().collect()
    } else {
        Vec::new()
    };
    (folded, paths)
}

/// Per-id results `recorded_file_lists` shares across tasks in one call.
#[derive(Default)]
struct RecordedCaches {
    group_files: DashMap<u32, Arc<Vec<(String, String)>>>,
    covered_files: DashMap<u32, Arc<HashSet<String>>>,
}

struct FileSetBatch<'snapshot> {
    disk: Option<SettledFiles>,
    tracked: Option<TrackedBatch<'snapshot>>,
}

impl<'a> FileSetBatch<'a> {
    fn disk_for_group(&self, id: u32) -> Option<&SettledFiles> {
        self.disk.as_ref()?.for_group(id)
    }

    fn select_tracked(
        &self,
        project: Option<&str>,
        globs: &[String],
    ) -> anyhow::Result<Option<Vec<&'a FileData>>> {
        match &self.tracked {
            Some(batch) => batch.select(project, globs),
            None => Ok(None),
        }
    }
}

struct HashInstructionArgs<'a, 'snapshot> {
    /// The instruction's pool id: the key disk-backed group expansions and
    /// JSON results are shared under within one call. Labels can repeat.
    id: u32,
    js_env: &'a HashMap<String, String>,
    ts_config_hash: &'a str,
    project_root_mappings: &'a ProjectRootMappings,
    sorted_externals: &'a [&'a String],
    selectively_hash_tsconfig: bool,
    runtime_cache: &'a DashMap<String, String>,
    project_file_set_cache: &'a ProjectFileSetCache,
    workspace_file_set_cache: &'a WorkspaceFileSetCache,
    json_file_set_cache: &'a DashMap<u32, JsonHashResult>,
    files_expansion_cache: &'a FilesExpansionCache,
    batch: &'a FileSetBatch<'snapshot>,
    run_stage: RunStage,
    cwd: &'a std::path::Path,
    collect_inputs: bool,
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;
    use std::sync::atomic::{AtomicUsize, Ordering};

    use super::*;
    use crate::native::workspace::ignored_index::IgnoredIndex;

    fn hasher(workspace_root: &Path, ignored_index: IgnoredIndexReader) -> TaskHasher {
        hasher_tracking(workspace_root, ignored_index, &[])
    }

    /// A hasher whose file map holds `tracked`, each under the project named
    /// by its second path segment.
    fn hasher_tracking(
        workspace_root: &Path,
        ignored_index: IgnoredIndexReader,
        tracked: &[(&str, &str)],
    ) -> TaskHasher {
        let files = |keep: &dyn Fn(&str) -> bool| -> Vec<FileData> {
            tracked
                .iter()
                .filter(|(file, _)| keep(file))
                .map(|(file, hash)| FileData {
                    file: (*file).into(),
                    hash: (*hash).into(),
                })
                .collect()
        };
        let all_workspace_files: Arc<Vec<FileData>> = Arc::new(files(&|_| true));
        let projects: std::collections::BTreeSet<&str> = tracked
            .iter()
            .filter_map(|(file, _)| file.split('/').nth(1))
            .collect();
        let project_file_map: HashMap<String, Vec<FileData>> = projects
            .into_iter()
            .map(|project| {
                let root = format!("libs/{project}/");
                (project.to_string(), files(&|file| file.starts_with(&root)))
            })
            .collect();
        TaskHasher {
            ignored_index: Arc::new(ignored_index),
            workspace_root: workspace_root.to_string_lossy().to_string(),
            project_graph: Arc::new(ProjectGraph {
                nodes: HashMap::new(),
                dependencies: HashMap::new(),
                external_nodes: HashMap::new(),
            }),
            project_file_map: Arc::new(project_file_map),
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
        }
    }

    /// Returns how many times hashing caught the index up, and how many of
    /// those ran on a pool thread. The pool also holds a fileset no plan reads.
    fn catch_ups(instruction: impl Fn(usize) -> HashInstruction) -> (usize, usize) {
        let temp = assert_fs::TempDir::new().unwrap();
        for dir in 0..8 {
            std::fs::create_dir_all(temp.path().join(format!("dist/t{dir}"))).unwrap();
            std::fs::write(temp.path().join(format!("dist/t{dir}/a.js")), "a").unwrap();
        }
        let calls = Arc::new(AtomicUsize::new(0));
        let from_pool = Arc::new(AtomicUsize::new(0));
        let reader = IgnoredIndexReader::new(Arc::new(IgnoredIndex::new(None)), {
            let (calls, from_pool) = (Arc::clone(&calls), Arc::clone(&from_pool));
            Arc::new(move || {
                calls.fetch_add(1, Ordering::SeqCst);
                if rayon::current_thread_index().is_some() {
                    from_pool.fetch_add(1, Ordering::SeqCst);
                }
            })
        });
        let hasher = hasher(temp.path(), reader);
        let entries: Vec<(String, Vec<HashInstruction>)> = (0..64)
            .map(|task| (format!("p{task}:build"), vec![instruction(task)]))
            .collect();
        let entries: Vec<(&str, Vec<HashInstruction>)> = entries
            .iter()
            .map(|(task, instructions)| (task.as_str(), instructions.clone()))
            .collect();
        let plans = crate::native::test_utils::hash_plans(&entries);
        plans.pool.intern(HashInstruction::ignored_files(vec![
            "dist/unread/**".to_string(),
        ]));
        let env = HashMap::new();

        let hashes = hasher
            .hash_plans_impl(
                &plans,
                temp.path().to_string_lossy().to_string(),
                None,
                RunStage::ATaskMayHaveWritten,
                |_| &env,
            )
            .unwrap();

        assert_eq!(hashes.0.len(), 64);
        (
            calls.load(Ordering::SeqCst),
            from_pool.load(Ordering::SeqCst),
        )
    }

    #[test]
    fn the_index_is_caught_up_once_outside_the_pool_only_when_a_plan_reads_it() {
        // A distinct fileset per task, so each one is listed.
        let fileset = |task: usize| {
            let dir = format!("dist/t{}", task % 8);
            HashInstruction::ignored_files(vec![format!("{dir}/**"), format!("!{dir}/x{task}.js")])
        };
        assert_eq!(catch_ups(fileset), (1, 0));
        assert_eq!(
            catch_ups(|_| HashInstruction::Environment("NX_TEST".to_string())),
            (0, 0)
        );
    }

    /// Hashes each `(task, instructions)` plan over a workspace holding
    /// `files`, after nothing has run.
    fn hash_recorded(
        files: &[(&str, &str)],
        plans: &[(&str, Vec<HashInstruction>)],
    ) -> HashMap<String, String> {
        hash_recorded_details(files, plans, false)
            .into_iter()
            .map(|(task, (value, _))| (task, value))
            .collect()
    }

    fn hash_recorded_details(
        files: &[(&str, &str)],
        plans: &[(&str, Vec<HashInstruction>)],
        collect_inputs: bool,
    ) -> HashMap<String, (String, HashInputs)> {
        let temp = assert_fs::TempDir::new().unwrap();
        for (path, content) in files {
            let path = temp.path().join(path);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, content).unwrap();
        }
        let reader = IgnoredIndexReader::new(Arc::new(IgnoredIndex::new(None)), Arc::new(|| {}));
        let hasher = hasher(temp.path(), reader);
        let plans = crate::native::test_utils::hash_plans(plans);
        let env = HashMap::new();
        let hashes = hasher
            .hash_plans_impl(
                &plans,
                temp.path().to_string_lossy().to_string(),
                Some(collect_inputs),
                RunStage::ATaskMayHaveWritten,
                |_| &env,
            )
            .unwrap();
        hashes
            .0
            .iter()
            .map(|entry| {
                let details = entry.value();
                (
                    entry.key().clone(),
                    (details.value.clone(), details.inputs.clone()),
                )
            })
            .collect()
    }

    #[test]
    fn batched_disk_hashing_preserves_noncanonical_root_spelling() -> anyhow::Result<()> {
        use crate::native::tasks::hashers::MIN_BATCH_GROUPS;
        use crate::native::test_utils::hash_plans;

        let temp = assert_fs::TempDir::new()?;
        let root = temp.path();
        std::fs::create_dir(root.join("dist"))?;
        std::fs::write(root.join("root.js"), "root")?;
        std::fs::write(root.join("dist/index.js"), "dist")?;
        // Exercise the evaluator directly with resolved instructions.
        let cases = [
            ("workspace-dot", ".", &[][..]),
            ("dist-dot", "dist/.", &["dist/./index.js"][..]),
            ("dist", "dist", &["dist/index.js"][..]),
        ];
        let names: Vec<_> = (0..MIN_BATCH_GROUPS).map(|i| format!("task-{i}")).collect();
        let mut tasks: Vec<_> = names
            .iter()
            .map(|name| {
                (
                    name.as_str(),
                    vec![HashInstruction::ignored_files(vec![format!("out/{name}")])],
                )
            })
            .collect();
        for (task, glob, _) in cases {
            tasks.push((
                task,
                vec![HashInstruction::ignored_files(vec![glob.into()])],
            ));
        }
        let plans = hash_plans(&tasks);
        let hasher = hasher(root, IgnoredIndexReader::unwatched());
        hasher.register_prefixes(&plans);
        let env = HashMap::new();
        let run = |plans: &HashPlans, stage| {
            hasher.hash_plans_impl(
                plans,
                root.to_string_lossy().into_owned(),
                Some(true),
                stage,
                |_| &env,
            )
        };
        let source = Source::fileset_from_disk(root);
        let ordinary_paths = cases
            .iter()
            .map(|(_, glob, expected)| {
                let ordinary = expand_globs(&[glob], &[], &source)?;
                assert_eq!(ordinary.files, *expected, "{glob}");
                Ok(ordinary.files)
            })
            .collect::<anyhow::Result<Vec<_>>>()?;
        for stage in [RunStage::ATaskMayHaveWritten, RunStage::NothingRan] {
            let batch = run(&plans, stage)?;
            let batch_paths: Vec<_> = cases
                .iter()
                .map(|(task, _, _)| batch.0.get(*task).unwrap().inputs.files.clone())
                .collect();
            assert_eq!(batch_paths, ordinary_paths);
            for (task, glob, _) in cases {
                let actual = batch.0.get(task).unwrap();
                let small = run(
                    &hash_plans(&[(
                        task,
                        vec![HashInstruction::ignored_files(vec![glob.into()])],
                    )]),
                    stage,
                )?;
                let expected = small.0.get(task).unwrap();
                assert_eq!(actual.value, expected.value, "{glob}");
            }
        }
        Ok(())
    }

    #[test]
    fn watched_batches_reuse_listings_up_front_and_read_live_disk_after_tasks() -> anyhow::Result<()>
    {
        use crate::native::tasks::hashers::MIN_BATCH_GROUPS;
        use crate::native::test_utils::hash_plans;
        use crate::native::workspace::ignored_index::Watch;

        let temp = assert_fs::TempDir::new()?;
        let root = temp.path();
        std::fs::create_dir_all(root.join("pkg"))?;
        std::fs::write(root.join("pkg/first.js"), "first")?;
        let index = Arc::new(IgnoredIndex::new(Some(Watch {
            delivers_under: Arc::new(|_| true),
        })));
        let reader = IgnoredIndexReader::new(Arc::clone(&index), Arc::new(|| {}));
        let hasher = hasher(root, reader);
        let names: Vec<_> = (0..MIN_BATCH_GROUPS).map(|i| format!("task-{i}")).collect();
        let tasks: Vec<_> = names
            .iter()
            .map(|name| {
                (
                    name.as_str(),
                    vec![HashInstruction::ignored_files(vec![
                        "pkg/**/*.js".into(),
                        format!("!pkg/{name}.js"),
                    ])],
                )
            })
            .collect();
        let plans = hash_plans(&tasks);
        hasher.register_prefixes(&plans);
        let env = HashMap::new();
        let paths = |stage| {
            let hashes = hasher.hash_plans_impl(
                &plans,
                root.to_string_lossy().into_owned(),
                Some(true),
                stage,
                |_| &env,
            )?;
            let files = hashes.0.get(&names[0]).unwrap().inputs.files.clone();
            Ok::<_, anyhow::Error>(files)
        };
        assert_eq!(paths(RunStage::NothingRan)?, ["pkg/first.js"]);
        assert!(index.is_listed("pkg"));
        #[cfg(unix)]
        {
            let raw = r"pkg/a\b.js";
            std::fs::write(root.join(raw), "raw filename")?;
            index.note_written(root, raw);
        }
        std::fs::write(root.join("pkg/later.js"), "later")?;
        // No watch event yet. A warm up-front listing performs no walk,
        // whereas a late hash reads the output even with the watch behind.
        assert_eq!(paths(RunStage::NothingRan)?, ["pkg/first.js"]);
        assert_eq!(
            paths(RunStage::ATaskMayHaveWritten)?,
            ["pkg/first.js", "pkg/later.js"]
        );
        index.note_written(root, "pkg/later.js");
        assert_eq!(
            paths(RunStage::NothingRan)?,
            ["pkg/first.js", "pkg/later.js"]
        );
        Ok(())
    }

    #[test]
    fn batched_hashes_and_inputs_observe_each_runs_file_policy() -> anyhow::Result<()> {
        use crate::native::test_utils::hash_plans;
        let temp = assert_fs::TempDir::new()?;
        let root = temp.path();
        let tracked = [
            ("libs/app/z.ts", "snapshot-z"),
            ("libs/app/a.ts", "snapshot-a"),
        ];
        std::fs::create_dir_all(root.join("libs/app"))?;
        for (file, _) in tracked {
            std::fs::write(root.join(file), "on disk")?;
        }
        let ignored = root.join("libs/app/generated.ts");
        std::fs::write(&ignored, "before")?;
        let index = IgnoredIndexReader::new(Arc::new(IgnoredIndex::new(None)), Arc::new(|| {}));
        let hasher = hasher_tracking(root, index, &tracked);
        let names: Vec<_> = (0..132).map(|i| format!("task-{i}")).collect();
        let env = HashMap::new();
        let run = |entries: &[(&str, Vec<HashInstruction>)], stage| {
            hasher.hash_plans_impl(
                &hash_plans(entries),
                root.to_string_lossy().into_owned(),
                Some(true),
                stage,
                |_| &env,
            )
        };
        // Every policy has >128 different groups sharing the same real inputs.
        // Some tasks also fold reads covered by declared files or task outputs.
        for disk in [false, true] {
            let entries: Vec<_> = names
                .iter()
                .enumerate()
                .map(|(i, name)| {
                    let globs = vec![
                        "libs/app/**/*.ts".to_owned(),
                        format!("!libs/app/absent-{i}.ts"),
                    ];
                    let read = if disk {
                        HashInstruction::IgnoredFileSet {
                            globs: globs.into_iter().map(Arc::from).collect(),
                            project_roots: vec!["libs/app".into()],
                            from_ultracache: true,
                        }
                    } else if i % 2 == 0 {
                        HashInstruction::ProjectFileSet("app".into(), globs)
                    } else {
                        HashInstruction::WorkspaceFileSet(vec![
                            "{workspaceRoot}/libs/app/**/*.ts".into(),
                            format!("!{{workspaceRoot}}/libs/app/absent-{i}.ts"),
                        ])
                    };
                    let mut plan = vec![
                        read,
                        HashInstruction::UltracacheConfiguration("recording".into()),
                    ];
                    if i % 3 == 0 {
                        plan.push(HashInstruction::ignored_files(vec!["libs/app/a.ts".into()]));
                        plan.push(HashInstruction::TaskOutput(
                            "**/a.ts".into(),
                            vec!["libs/app/a.ts".into()],
                        ));
                    }
                    (name.as_str(), plan)
                })
                .collect();
            let mut previous = None;
            for (stage, mutation) in [
                (RunStage::NothingRan, 0),
                (RunStage::ATaskMayHaveWritten, 1),
                (RunStage::ATaskMayHaveWritten, 2),
            ] {
                match mutation {
                    0 => std::fs::write(&ignored, "before")?,
                    1 => std::fs::write(&ignored, "producer has changed this file")?,
                    _ => std::fs::remove_file(&ignored)?,
                }
                let hashed = run(&entries, stage)?;
                for i in 0..6 {
                    let small = run(&entries[i..i + 1], stage)?;
                    let task = entries[i].0;
                    let got = hashed.0.get(task).unwrap();
                    let reference = small.0.get(task).unwrap();
                    assert_eq!(got.value, reference.value, "{disk} {mutation} {task}");
                    assert_eq!(
                        got.inputs.files, reference.inputs.files,
                        "{disk} {mutation} {task}"
                    );
                }
                let regular = hashed.0.get(entries[1].0).unwrap();
                assert_eq!(
                    regular
                        .inputs
                        .files
                        .iter()
                        .any(|p| p == "libs/app/generated.ts"),
                    disk && mutation != 2
                );
                if let Some(old) = previous {
                    assert_eq!(old != regular.value, disk);
                }
                previous = Some(regular.value.clone());
            }
        }
        Ok(())
    }

    const DIST_FILES: [(&str, &str); 6] = [
        ("libs/e2e/src/app.spec.ts", "spec"),
        ("libs/app/package.json", "{}"),
        ("libs/app/dist/index.d.ts", "export {};"),
        ("libs/app/dist/lib/util.d.ts", "export {};"),
        ("libs/app/dist/index.js", "export {};"),
        ("libs/app/dist/node_modules/pkg/types.d.ts", "export {};"),
    ];

    fn recorded_files(globs: &[&str]) -> HashInstruction {
        HashInstruction::IgnoredFileSet {
            globs: globs.iter().map(|glob| Arc::from(*glob)).collect(),
            project_roots: Vec::new(),
            from_ultracache: true,
        }
    }

    /// The inferred typecheck's shape: dependency declarations through a glob
    /// output, and a recording whose reads are grouped as `groups`.
    fn typecheck_plan(groups: &[&[&str]]) -> Vec<HashInstruction> {
        let mut plan = vec![
            HashInstruction::UltracacheConfiguration("digest".into()),
            HashInstruction::TaskOutput(
                "**/*.{d.ts,d.cts,d.mts}".into(),
                vec!["libs/app/dist/**/*.{d.ts,d.cts,d.mts}".into()],
            ),
        ];
        plan.extend(groups.iter().map(|globs| recorded_files(globs)));
        plan
    }

    fn typecheck_hash(files: &[(&str, &str)], groups: &[&[&str]]) -> String {
        hash_recorded(files, &[("e2e:typecheck", typecheck_plan(groups))])["e2e:typecheck"].clone()
    }

    #[test]
    fn a_read_dependency_output_files_hash_leaves_the_hash_alone() {
        let base: &[&str] = &["libs/e2e/src/app.spec.ts", "libs/app/package.json"];
        let unread = typecheck_hash(&DIST_FILES, &[base]);
        for groups in [
            &[&[
                "libs/e2e/src/app.spec.ts",
                "libs/app/package.json",
                "libs/app/dist/index.d.ts",
            ][..]][..],
            &[base, &["libs/app/dist/**/*.d.ts"]],
            &[
                &["libs/e2e/src/app.spec.ts"],
                &["libs/app/package.json", "libs/app/dist/lib/util.d.ts"],
            ],
        ] {
            assert_eq!(typecheck_hash(&DIST_FILES, groups), unread, "{groups:?}");
        }
    }

    #[test]
    fn a_read_dependency_outputs_do_not_hash_still_counts() {
        let base: &[&str] = &["libs/e2e/src/app.spec.ts", "libs/app/package.json"];
        let unread = typecheck_hash(&DIST_FILES, &[base]);
        for read in [
            "libs/app/dist/index.js",
            "libs/app/dist/node_modules/pkg/types.d.ts",
        ] {
            let with_read = |files: &[(&str, &str)]| typecheck_hash(files, &[base, &[read]]);
            assert_ne!(with_read(&DIST_FILES), unread, "{read}");
            let mut changed = DIST_FILES.to_vec();
            changed
                .iter_mut()
                .find(|(path, _)| *path == read)
                .unwrap()
                .1 = "changed";
            assert_ne!(with_read(&changed), with_read(&DIST_FILES), "{read}");
        }
    }

    #[test]
    fn an_unread_dependency_declaration_still_counts() {
        let groups: &[&[&str]] = &[&["libs/e2e/src/app.spec.ts"]];
        let mut changed = DIST_FILES.to_vec();
        changed[3].1 = "export const changed = 1;";
        assert_ne!(
            typecheck_hash(&changed, groups),
            typecheck_hash(&DIST_FILES, groups)
        );
    }

    #[test]
    fn a_declared_group_in_a_recorded_plan_keeps_its_own_entry() {
        let groups: &[&[&str]] = &[&["libs/e2e/src/app.spec.ts"]];
        let mut plan = typecheck_plan(groups);
        plan.push(HashInstruction::ignored_files(vec![
            "libs/app/dist/index.d.ts".into(),
        ]));
        // Declared, so not subtracted: it moves the hash although TaskOutput covers it.
        assert_ne!(
            hash_recorded(&DIST_FILES, &[("e2e:typecheck", plan)])["e2e:typecheck"],
            typecheck_hash(&DIST_FILES, groups)
        );
    }

    #[test]
    fn a_read_a_declared_group_hashes_leaves_the_hash_alone() {
        let mut files = DIST_FILES.to_vec();
        files.push(("libs/e2e/generated/api.json", "{}"));
        let hash = |reads: &[&str]| {
            let mut plan = typecheck_plan(&[reads]);
            plan.push(HashInstruction::ignored_files(vec![
                "libs/e2e/generated/**".into(),
            ]));
            hash_recorded(&files, &[("e2e:typecheck", plan)])["e2e:typecheck"].clone()
        };
        assert_eq!(
            hash(&["libs/e2e/src/app.spec.ts", "libs/e2e/generated/api.json"]),
            hash(&["libs/e2e/src/app.spec.ts"])
        );
    }

    #[test]
    fn a_read_a_declared_group_hashes_leaves_the_hash_alone_without_dependency_outputs() {
        let files = [
            ("libs/e2e/src/app.spec.ts", "spec"),
            ("libs/e2e/generated/api.json", "{}"),
        ];
        let hash = |reads: &[&str]| {
            let plan = vec![
                HashInstruction::UltracacheConfiguration("digest".into()),
                recorded_files(reads),
                HashInstruction::ignored_files(vec!["libs/e2e/generated/**".into()]),
            ];
            hash_recorded(&files, &[("e2e:test", plan)])["e2e:test"].clone()
        };
        assert_eq!(
            hash(&["libs/e2e/src/app.spec.ts", "libs/e2e/generated/api.json"]),
            hash(&["libs/e2e/src/app.spec.ts"])
        );
    }

    /// Hashes `plan` over tracked `files`, with `libs/app/generated` on disk
    /// for a declared `includeIgnored` group to hash.
    fn tracked_hash(files: &[(&str, &str)], plan: Vec<HashInstruction>) -> String {
        let temp = assert_fs::TempDir::new().unwrap();
        for (path, content) in files
            .iter()
            .chain(&[("libs/app/generated/api.ts", "generated")])
        {
            let path = temp.path().join(path);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, content).unwrap();
        }
        let reader = IgnoredIndexReader::new(Arc::new(IgnoredIndex::new(None)), Arc::new(|| {}));
        let hasher = hasher_tracking(temp.path(), reader, files);
        let plans = crate::native::test_utils::hash_plans(&[("e2e:typecheck", plan)]);
        let env = HashMap::new();
        let hashes = hasher
            .hash_plans_impl(
                &plans,
                temp.path().to_string_lossy().to_string(),
                None,
                RunStage::ATaskMayHaveWritten,
                |_| &env,
            )
            .unwrap();
        hashes.0.get("e2e:typecheck").unwrap().value.clone()
    }

    #[test]
    fn filesets_of_tracked_reads_fold_like_disk_backed_groups() {
        let files = [
            ("libs/app/src/a.ts", "a"),
            ("libs/app/src/b.ts", "b"),
            ("libs/e2e/src/app.spec.ts", "spec"),
        ];
        let plan = |filesets: Vec<HashInstruction>| {
            let mut plan = vec![
                HashInstruction::UltracacheConfiguration("digest".into()),
                HashInstruction::ignored_files(vec!["libs/app/generated".to_string()]),
            ];
            plan.extend(filesets);
            plan
        };
        let project = |name: &str, globs: &[&str]| {
            HashInstruction::ProjectFileSet(
                name.into(),
                globs.iter().map(|glob| glob.to_string()).collect(),
            )
        };
        let workspace = |globs: &[&str]| {
            HashInstruction::WorkspaceFileSet(
                globs
                    .iter()
                    .map(|glob| format!("{{workspaceRoot}}/{glob}"))
                    .collect(),
            )
        };
        let reads = tracked_hash(
            &files,
            plan(vec![project(
                "app",
                &["libs/app/src/a.ts", "libs/app/src/b.ts"],
            )]),
        );
        // The same files however the reads are spelled or grouped.
        assert_eq!(
            reads,
            tracked_hash(
                &files,
                plan(vec![project("app", &["libs/app/src/**/*.ts"])])
            )
        );
        assert_eq!(
            reads,
            tracked_hash(&files, plan(vec![workspace(&["libs/app/src/*.ts"])]))
        );
        // A read the declared group already hashes adds nothing.
        assert_eq!(
            reads,
            tracked_hash(
                &files,
                plan(vec![project(
                    "app",
                    &["libs/app/src/**/*.ts", "libs/app/generated/api.ts"]
                )])
            )
        );
        // Another file read still counts.
        assert_ne!(
            reads,
            tracked_hash(
                &files,
                plan(vec![
                    project("app", &["libs/app/src/**/*.ts"]),
                    project("e2e", &["libs/e2e/src/app.spec.ts"])
                ])
            )
        );
    }

    #[test]
    fn a_file_read_from_disk_and_listed_in_the_file_map_takes_the_disk_hash() {
        // The file map's hash is stale: a task rewrote the file since.
        let files = [("libs/app/src/a.ts", "rewritten")];
        let plan = |fileset: Option<HashInstruction>| {
            let mut plan = vec![
                HashInstruction::UltracacheConfiguration("digest".into()),
                HashInstruction::ignored_files(vec!["libs/app/generated".to_string()]),
                recorded_files(&["libs/app/src/a.ts"]),
            ];
            // Interned last, so it would win if the fold took the last hash.
            plan.extend(fileset);
            plan
        };
        let always = HashInstruction::ProjectFileSet("app".into(), vec!["libs/app/src".into()]);
        assert_eq!(
            tracked_hash(&files, plan(Some(always))),
            tracked_hash(&files, plan(None))
        );
    }

    #[test]
    fn a_plan_with_nothing_covering_its_reads_hashes_each_group() {
        let plan = |groups: &[&[&str]]| {
            let mut plan = vec![HashInstruction::UltracacheConfiguration("digest".into())];
            plan.extend(groups.iter().map(|reads| recorded_files(reads)));
            plan
        };
        let hashes = hash_recorded(
            &DIST_FILES,
            &[
                (
                    "one:typecheck",
                    plan(&[&["libs/e2e/src/app.spec.ts", "libs/app/package.json"]]),
                ),
                (
                    "two:typecheck",
                    plan(&[&["libs/e2e/src/app.spec.ts"], &["libs/app/package.json"]]),
                ),
            ],
        );
        // Not folded, so how the reads are grouped still counts.
        assert_ne!(hashes["one:typecheck"], hashes["two:typecheck"]);
    }

    #[test]
    fn collected_inputs_list_kept_reads_and_leave_covered_ones_to_their_entry() {
        let groups: &[&[&str]] = &[&["libs/e2e/src/app.spec.ts", "libs/app/dist/index.d.ts"]];
        let details = hash_recorded_details(
            &DIST_FILES,
            &[("e2e:typecheck", typecheck_plan(groups))],
            true,
        );
        let (_, inputs) = &details["e2e:typecheck"];
        assert!(
            inputs
                .files
                .contains(&"libs/e2e/src/app.spec.ts".to_string())
        );
        assert!(
            !inputs
                .files
                .contains(&"libs/app/dist/index.d.ts".to_string())
        );
        assert!(
            inputs
                .dep_outputs
                .contains(&"libs/app/dist/index.d.ts".to_string())
        );
    }

    #[test]
    fn ranked_assembly_hashes_values_in_key_order_and_folds_shared_keys() {
        let names = ["z", "a", "\u{e000}", "🤖", "a", "z", "a"];
        // (pool size, task size): the middle case shares keys in the pool but
        // not in the task.
        for (pool_size, task_size) in [(4, 4), (7, 4), (7, 7)] {
            let keys: Arc<[SharedStr]> = names[..pool_size]
                .iter()
                .map(|s| s.to_string().into())
                .collect();
            let ranks = instruction_key_ranks(&keys);
            let mut values_by_key: BTreeMap<&SharedStr, Vec<String>> = BTreeMap::new();
            for id in 0..task_size {
                values_by_key
                    .entry(&keys[id])
                    .or_default()
                    .push(format!("value-{id}"));
            }
            let mut expected = xxhash_rust::xxh3::Xxh3::new();
            for values in values_by_key.values_mut() {
                values.sort();
                let value = match values.as_slice() {
                    [value] => value.clone(),
                    _ => hash(values.join("\0").as_bytes()),
                };
                expected.update(value.as_bytes());
            }
            let expected = expected.digest().to_string();
            for offset in 0..task_size {
                for reverse in [false, true] {
                    let mut entries: Vec<(u32, SharedStr)> = (0..task_size)
                        .map(|id| (id as u32, format!("value-{id}").into()))
                        .collect();
                    entries.rotate_left(offset);
                    if reverse {
                        entries.reverse();
                    }
                    let actual =
                        assemble_ranked_hash(entries, &keys, &ranks, HashInputsBuilder::default());
                    assert_eq!(actual.value, expected);
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
        let folded = hash(vec![&*value; keys.len()].join("\0").as_bytes());
        assert_eq!(result.value, hash(folded.as_bytes()));
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
