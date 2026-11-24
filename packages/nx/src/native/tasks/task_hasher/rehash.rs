use super::*;
use crate::native::tasks::hashers::{
    RehashReadBudget, SettledGroups, collect_project_file_indices_cached,
    collect_workspace_file_indices_cached,
};
use crate::native::tasks::id_set::IdSet;
use crate::native::tasks::rehash_evidence::{EMPTY, EvidenceId, RehashEvidence};
use crate::native::types::FileData;
use parking_lot::Mutex;

#[napi(object, object_from_js = false)]
pub struct RehashResult<'env> {
    pub value: String,
    #[napi(ts_type = "string[]")]
    pub mutable_inputs: Array<'env>,
}

struct InstructionValue {
    hash: SharedStr,
    // Only files absent from the commit, plus every selected dependency output.
    evidence: EvidenceId,
}

#[napi]
impl TaskHasher {
    /// Hash a workspace after restores and execution have finished. All disk
    /// state is local to this call; a later batch inventories and reads again.
    #[napi]
    pub fn hash_plans_for_rehash<'env>(
        &self,
        env: &'env Env,
        #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
        plans: &External<HashPlans>,
        task_ids: Vec<String>,
        #[napi(ts_arg_type = "Record<string, Record<string, string>>")] per_task_envs: Object<'_>,
        cwd: String,
        #[napi(ts_arg_type = "ReadonlyArray<string> | Buffer")] tracked_files: Either<
            BufferSlice<'_>,
            Vec<String>,
        >,
        file_map_matches_tracked_files: Option<bool>,
        max_live_read_bytes: Option<f64>,
        max_result_bytes: Option<f64>,
    ) -> anyhow::Result<Vec<RehashResult<'env>>> {
        let mut evidence = RehashEvidence::new(max_result_bytes, task_ids.len())?;
        // A process environment can be large. Copy only the variables the
        // plan reads, or the entire environment for a shell command.
        let mut envs = HashMap::with_capacity(task_ids.len());
        for task in &task_ids {
            let ids = plans
                .plans
                .get(task)
                .ok_or_else(|| anyhow::anyhow!("Missing hash plan for task {task}"))?;
            let env: Object = per_task_envs
                .get(task)?
                .ok_or_else(|| anyhow::anyhow!("Missing env entry for task {task}"))?;
            let mut selected = HashMap::new();
            for &id in ids {
                match &*plans.pool.get(id) {
                    HashInstruction::Runtime(_) => {
                        for key in Object::keys(&env)? {
                            if let Some(value) = env.get::<String>(&key)? {
                                selected.insert(key, value);
                            }
                        }
                        break;
                    }
                    HashInstruction::Environment(key) if env.has_own_property(key)? => {
                        if let Some(value) = env.get::<String>(key)? {
                            selected.insert(key.clone(), value);
                        }
                    }
                    _ => {}
                }
            }
            envs.insert(task.clone(), selected);
        }
        // The packed form borrows Git's NUL-delimited bytes during this call.
        // Only the path index is allocated, even in a very large checkout.
        let mut tracked: Vec<&str> = match &tracked_files {
            Either::A(buffer) => {
                let paths = std::str::from_utf8(buffer.as_ref())?;
                anyhow::ensure!(
                    paths.is_empty() || paths.ends_with('\0'),
                    "Expected NUL-terminated tracked paths"
                );
                let count = paths.as_bytes().iter().filter(|&&b| b == 0).count();
                let mut index = Vec::with_capacity(count);
                for path in paths.split_terminator('\0') {
                    anyhow::ensure!(!path.is_empty(), "Expected a nonempty tracked path");
                    index.push(path);
                }
                index
            }
            Either::B(paths) => paths.iter().map(String::as_str).collect(),
        };
        if !tracked.is_sorted() {
            tracked.sort_unstable();
        }
        let budget = RehashReadBudget::new(max_live_read_bytes)?;
        budget.release_unused_pages();
        let results = self.rehash(
            plans,
            &task_ids,
            &envs,
            &cwd,
            &tracked,
            file_map_matches_tracked_files.unwrap_or(false),
            &budget,
            &mut evidence,
        );
        budget.release_unused_pages();
        let results = results?;
        let arrays = evidence.into_arrays(env, results.iter().map(|(_, set)| *set))?;
        Ok(results
            .into_iter()
            .map(|(value, set)| RehashResult {
                value,
                mutable_inputs: arrays[set].expect("every returned set was materialized"),
            })
            .collect())
    }
}

impl TaskHasher {
    fn rehash(
        &self,
        plans: &HashPlans,
        task_ids: &[String],
        per_task_envs: &HashMap<String, HashMap<String, String>>,
        cwd: &str,
        tracked: &[&str],
        file_map_matches_tracked_files: bool,
        budget: &RehashReadBudget,
        evidence: &mut RehashEvidence,
    ) -> anyhow::Result<Vec<(String, EvidenceId)>> {
        let pool = &plans.pool;
        let is_tracked = |path: &str| tracked.binary_search(&path).is_ok();
        let mut used = vec![false; pool.len()];
        for id in task_ids {
            for &instruction in &plans.plans[id] {
                used[instruction as usize] = true;
            }
        }
        let workspace_root = Path::new(&self.workspace_root);
        let json = crate::native::tasks::hashers::hash_settled_json(
            workspace_root,
            used.iter().enumerate().filter_map(|(i, &needed)| {
                if needed && let HashInstruction::JsonFileSet(input) = &*pool.get(i as u32) {
                    Some((i as u32, (**input).clone()))
                } else {
                    None
                }
            }),
            &self.project_file_map,
            &self.all_workspace_files,
            is_tracked,
            budget,
            evidence,
        )?;
        let proof = self
            .ignored_index
            .rehash_snapshot
            .as_ref()
            .filter(|_| file_map_matches_tracked_files)
            .and_then(|snapshot| snapshot.proof_for(&self.all_workspace_files));
        let verified_files = proof
            .into_iter()
            .flat_map(|_| self.all_workspace_files.iter().enumerate())
            .filter(|(_, file)| is_tracked(&file.file));
        let settled = SettledGroups::new(
            workspace_root,
            plans,
            &used,
            &json.raw_hashes,
            tracked,
            verified_files,
            proof,
            budget,
            evidence,
        )?;
        drop(json.raw_hashes);
        let keys: Vec<SharedStr> = (0..pool.len() as u32)
            .map(|id| pool.label(id).into())
            .collect();
        let ranks = instruction_key_ranks(&keys);
        let kinds: Vec<_> = (0..pool.len() as u32)
            .map(|id| FoldKind::of(&pool.get(id)))
            .collect();

        let ts_config_hash = hash(&self.ts_config);
        let project_root_mappings = create_project_root_mappings(&self.project_graph.nodes);
        let mut sorted_externals = self.project_graph.external_nodes.keys().collect::<Vec<_>>();
        sorted_externals.sort_unstable();
        let runtime_cache = DashMap::new();
        let json_file_set_cache = DashMap::new();
        let files_expansion_cache = FilesExpansionCache::new();
        let ordinary = |task_id: &str,
                        id,
                        instruction: &HashInstruction,
                        env: &HashMap<String, String>,
                        collect_inputs| {
            self.hash_instruction(
                task_id,
                instruction,
                HashInstructionArgs {
                    id,
                    js_env: env,
                    ts_config_hash: &ts_config_hash,
                    project_root_mappings: &project_root_mappings,
                    sorted_externals: &sorted_externals,
                    selectively_hash_tsconfig: self
                        .options
                        .as_ref()
                        .is_some_and(|o| o.selectively_hash_ts_config),
                    runtime_cache: &runtime_cache,
                    project_file_set_cache: &self.project_file_set_cache,
                    workspace_file_set_cache: &self.workspace_file_set_cache,
                    json_file_set_cache: &json_file_set_cache,
                    files_expansion_cache: &files_expansion_cache,
                    run_stage: RunStage::ATaskMayHaveWritten,
                    cwd: Path::new(cwd),
                    collect_inputs,
                },
            )
        };

        // Disk groups and non-env instructions are independent of the task.
        // Keep their values once, and only the IO evidence the caller needs.
        let empty_env = HashMap::new();
        // Only one worker assembles an evidence union at a time. Hashing and
        // per-task folds still run in parallel, independently of the JS handles.
        let evidence = Mutex::new(evidence);
        let mutable_paths = |indices: &[u32], files: &[FileData]| {
            evidence.lock().from_paths(
                indices
                    .iter()
                    .map(|&i| files[i as usize].file.as_str())
                    .filter(|path| !is_tracked(path)),
            )
        };
        let values = used
            .par_iter()
            .enumerate()
            .map(|(index, used)| {
                if !used {
                    return Ok(None);
                }
                let id = index as u32;
                let instruction = pool.get(id);
                let (hash, evidence_id) = match &*instruction {
                    HashInstruction::Environment(_) | HashInstruction::Runtime(_) => {
                        return Ok(None);
                    }
                    HashInstruction::IgnoredFileSet { .. } | HashInstruction::TaskOutput(..) => {
                        let files = settled.groups[index].as_deref().unwrap();
                        (settled.files.fold(files), settled.evidence[index])
                    }
                    HashInstruction::JsonFileSet(_) => json.values[&id].clone(),
                    _ => {
                        let collect = matches!(&*instruction, HashInstruction::TsConfiguration(_));
                        let (hash, inputs) = ordinary("", id, &instruction, &empty_env, collect)?;
                        // Matched indices point into the immutable file map. Copy only
                        // the paths needed for evidence, even for workspace-wide inputs.
                        let evidence_id = match &*instruction {
                            HashInstruction::WorkspaceFileSet(globs) => {
                                let indices = collect_workspace_file_indices_cached(
                                    globs,
                                    &self.all_workspace_files,
                                    &self.workspace_file_indices_cache,
                                )?;
                                mutable_paths(&indices, &self.all_workspace_files)?
                            }
                            HashInstruction::ProjectFileSet(project, globs) => {
                                let indices = collect_project_file_indices_cached(
                                    project,
                                    globs,
                                    &self.project_file_map,
                                    &self.project_file_indices_cache,
                                )?;
                                mutable_paths(&indices, &self.project_file_map[project])?
                            }
                            _ if inputs.files.is_empty() => EMPTY,
                            _ => evidence.lock().from_paths(
                                inputs
                                    .files
                                    .iter()
                                    .map(String::as_str)
                                    .filter(|p| !is_tracked(p)),
                            )?,
                        };
                        (hash, evidence_id)
                    }
                };
                Ok(Some(InstructionValue {
                    hash: hash.into(),
                    evidence: evidence_id,
                }))
            })
            .collect::<anyhow::Result<Vec<_>>>()?;

        task_ids
            .par_iter()
            .map(|task_id| {
                let ids = &plans.plans[task_id];
                let env = &per_task_envs[task_id];
                let folds = FoldKind::folds_recorded(ids, &kinds);
                let mut entries = Vec::with_capacity(ids.len());
                let mut recorded_evidence = EMPTY;
                let mut reads = IdSet::default();
                let mut covered = IdSet::default();
                for &id in ids {
                    let index = id as usize;
                    if folds {
                        match kinds[index] {
                            FoldKind::UltracacheGroup => {
                                reads.extend(
                                    settled.groups[index].as_ref().unwrap().iter().copied(),
                                );
                                continue;
                            }
                            FoldKind::CoversReads => covered
                                .extend(settled.groups[index].as_ref().unwrap().iter().copied()),
                            _ => {}
                        }
                    }
                    let value = if let Some(value) = &values[index] {
                        value.hash.clone()
                    } else {
                        ordinary(task_id, id, &pool.get(id), env, false)?.0.into()
                    };
                    entries.push((id, value));
                }
                if folds {
                    let mut reads = reads.into_sorted_vec();
                    reads.retain(|id| !covered.contains(*id) && settled.files.was_read(*id));
                    recorded_evidence = evidence.lock().from_paths(
                        reads
                            .iter()
                            .map(|&id| settled.files.path(id))
                            .filter(|&path| !is_tracked(path)),
                    )?;
                    let recorded = settled.files.fold(&reads);
                    if let Some((_, config)) = entries
                        .iter_mut()
                        .find(|(id, _)| kinds[*id as usize] == FoldKind::UltracacheConfiguration)
                    {
                        *config = fold_configuration(config, &recorded);
                    }
                }
                let groups = ids
                    .iter()
                    .filter_map(|&id| {
                        let i = id as usize;
                        if folds && kinds[i] == FoldKind::UltracacheGroup {
                            return None;
                        }
                        values[i].as_ref().map(|v| v.evidence)
                    })
                    .chain(std::iter::once(recorded_evidence));
                let set = evidence.lock().union(groups)?;
                Ok((fold_ranked_hash(&mut entries, &keys, &ranks), set))
            })
            .collect()
    }
}
