use crate::native::tasks::hashers::{
    ProjectFileIndicesCache, collect_json_input_files, collect_project_file_paths_cached,
    collect_workspace_file_paths, expand_files, resolve_task_output_files,
};
use crate::native::tasks::task_hasher::{
    HashInputs, HashInputsBuilder, input_source, is_snapshot_backed, task_project,
};
use crate::native::tasks::types::{HashInstruction, HashPlans};
use crate::native::types::FileData;
use hashbrown::HashSet;
use napi::bindgen_prelude::External;
use rayon::prelude::*;
use std::collections::HashMap;
use std::sync::Arc;

/// One file-input group of a task's hash plan, as globs rather than resolved
/// paths. `project` is `None` for workspace-level groups.
#[napi(object)]
#[derive(Clone, Debug)]
pub struct EffectiveInputGroup {
    pub project: Option<String>,
    pub globs: Vec<String>,
    /// Disk-backed: an I/O snapshot's observed reads, or a declared
    /// `includeIgnored` fileset. Gitignored and generated files count.
    pub include_ignored: bool,
    /// True when this task hashes from an I/O snapshot, so the groups are the
    /// observed reads rather than the declared filesets.
    pub from_snapshot: bool,
}

#[napi]
pub struct HashPlanInspector {
    all_workspace_files: Arc<Vec<FileData>>,
    project_file_map: Arc<HashMap<String, Vec<FileData>>>,
    workspace_root: String,
}

#[napi]
impl HashPlanInspector {
    #[napi(constructor)]
    pub fn new(
        #[napi(ts_arg_type = "ExternalObject<Array<FileData>>")] all_workspace_files: &External<
            Arc<Vec<FileData>>,
        >,
        #[napi(ts_arg_type = "ExternalObject<Record<string, Array<FileData>>>")]
        project_file_map: &External<Arc<HashMap<String, Vec<FileData>>>>,
        workspace_root: String,
    ) -> Self {
        Self {
            all_workspace_files: Arc::clone(all_workspace_files),
            project_file_map: Arc::clone(project_file_map),
            workspace_root,
        }
    }

    /// @deprecated Use `inspectInputs()` instead for structured output.
    #[napi(ts_return_type = "Record<string, string[]>")]
    pub fn inspect(
        &self,
        #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
        hash_plans: &External<HashPlans>,
    ) -> anyhow::Result<HashMap<String, Vec<String>>> {
        let project_file_indices_cache = ProjectFileIndicesCache::new();
        let pool = &hash_plans.pool;
        let results: Vec<(&String, Vec<String>)> = hash_plans
            .plans
            .iter()
            .flat_map(|(task_id, ids)| ids.iter().map(move |id| (task_id, *id)))
            .par_bridge()
            .map(|(task_id, id)| {
                let instruction_ref = pool.get(id);
                let instruction = instruction_ref.value();
                let strings = match instruction {
                    // File-set instructions: resolve to actual file paths
                    HashInstruction::WorkspaceFileSet(_)
                    | HashInstruction::ProjectFileSet(_, _, _) => {
                        let builder = self
                            .resolve_instruction_inputs(instruction, &project_file_indices_cache)?;
                        builder
                            .files
                            .into_iter()
                            .map(|f| format!("file:{}", f))
                            .collect()
                    }
                    // All other instructions: use the Display format for legacy compatibility
                    _ => vec![instruction.to_string()],
                };
                Ok::<_, anyhow::Error>((task_id, strings))
            })
            .collect::<anyhow::Result<_>>()?;

        Ok(results
            .into_iter()
            .fold(HashMap::new(), |mut acc, (task_id, strings)| {
                acc.entry(task_id.clone()).or_default().extend(strings);
                acc
            }))
    }

    /// The file-input groups of each task's plan, as globs. Unlike `inspect`
    /// and `inspect_inputs` this does not touch the disk or the file map, so
    /// it stays cheap on plans whose globs expand to thousands of files.
    #[napi]
    pub fn inspect_input_globs(
        &self,
        #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
        hash_plans: &External<HashPlans>,
    ) -> HashMap<String, Vec<EffectiveInputGroup>> {
        let pool = &hash_plans.pool;
        hash_plans
            .plans
            .iter()
            .map(|(task_id, ids)| {
                let from_snapshot = is_snapshot_backed(pool, ids);
                let groups = ids
                    .iter()
                    .filter_map(|id| match &*pool.get(*id) {
                        HashInstruction::ProjectFileSet(project, globs, include_ignored) => {
                            Some(EffectiveInputGroup {
                                project: Some(project.clone()),
                                globs: globs.clone(),
                                include_ignored: *include_ignored,
                                from_snapshot,
                            })
                        }
                        HashInstruction::WorkspaceFileSet(globs) => Some(EffectiveInputGroup {
                            project: None,
                            globs: globs.clone(),
                            include_ignored: false,
                            from_snapshot,
                        }),
                        _ => None,
                    })
                    .collect();
                (task_id.clone(), groups)
            })
            .collect()
    }

    /// Like `inspect()` but returns structured `HashInputs` objects instead of flat strings.
    /// Each `HashInstruction` is categorized into the appropriate bucket (files, runtime,
    /// environment, depOutputs, external). TsConfiguration is resolved to the root tsconfig
    /// file path. JsonFileSet is resolved to the matched JSON file paths (field/excludeField
    /// filters only affect hashing, not which files are reported as inputs).
    /// ProjectConfiguration is skipped for now. Cwd is skipped as it's ambient.
    #[napi(ts_return_type = "Record<string, HashInputs>")]
    pub fn inspect_inputs(
        &self,
        #[napi(ts_arg_type = "ExternalObject<Record<string, Array<HashInstruction>>>")]
        hash_plans: &External<HashPlans>,
    ) -> anyhow::Result<HashMap<String, HashInputs>> {
        let project_file_indices_cache = ProjectFileIndicesCache::new();
        let pool = &hash_plans.pool;
        let results: Vec<(&String, HashInputsBuilder)> = hash_plans
            .plans
            .iter()
            .flat_map(|(task_id, ids)| {
                let snapshot_backed = is_snapshot_backed(pool, ids);
                ids.iter().map(move |id| (task_id, *id, snapshot_backed))
            })
            .par_bridge()
            .map(|(task_id, id, snapshot_backed)| {
                let instruction_ref = pool.get(id);
                let builder = self.resolve_instruction_inputs(
                    instruction_ref.value(),
                    &project_file_indices_cache,
                )?;
                let source = input_source(
                    instruction_ref.value(),
                    task_project(task_id),
                    snapshot_backed,
                );
                Ok::<_, anyhow::Error>((task_id, builder.tag(source)))
            })
            .collect::<anyhow::Result<_>>()?;

        Ok(results
            .into_iter()
            .fold(HashMap::new(), |mut acc, (task_id, builder)| {
                acc.entry(task_id.clone())
                    .or_insert_with(HashInputsBuilder::default)
                    .extend(builder);
                acc
            })
            .into_iter()
            .map(|(k, v)| (k, v.into()))
            .collect())
    }

    /// Resolves a single `HashInstruction` into its structured inputs without hashing.
    /// Context-dependent variants are handled explicitly with access to workspace files,
    /// project graph, etc. Context-free variants fall through to `instruction.into()`.
    fn resolve_instruction_inputs(
        &self,
        instruction: &HashInstruction,
        project_file_indices_cache: &ProjectFileIndicesCache,
    ) -> anyhow::Result<HashInputsBuilder> {
        match instruction {
            HashInstruction::WorkspaceFileSet(workspace_file_set) => {
                let files =
                    collect_workspace_file_paths(workspace_file_set, &self.all_workspace_files)?;
                Ok(HashInputsBuilder {
                    files: files.into_iter().collect(),
                    ..Default::default()
                })
            }
            HashInstruction::ProjectFileSet(project_name, file_sets, false) => {
                let files = collect_project_file_paths_cached(
                    project_name,
                    file_sets,
                    &self.project_file_map,
                    project_file_indices_cache,
                )?;
                Ok(HashInputsBuilder {
                    files: files.into_iter().collect(),
                    ..Default::default()
                })
            }
            HashInstruction::ProjectFileSet(_, globs, true) => {
                let expansion = expand_files(std::path::Path::new(&self.workspace_root), globs)?;
                // `missing` paths are hashed as a sentinel, so they are real
                // inputs; report them alongside existing files (e.g. a read of
                // a dependency's output before the producer has run).
                Ok(HashInputsBuilder {
                    files: expansion
                        .files
                        .into_iter()
                        .chain(expansion.missing)
                        .collect(),
                    ..Default::default()
                })
            }
            HashInstruction::TaskOutput(glob, dep_outputs) => {
                let dep_output_files: HashSet<String> =
                    resolve_task_output_files(&self.workspace_root, glob, dep_outputs)
                        .map(|files| files.into_iter().collect())
                        .unwrap_or_else(|_| dep_outputs.iter().cloned().collect());
                Ok(HashInputsBuilder {
                    dep_outputs: dep_output_files,
                    ..Default::default()
                })
            }
            HashInstruction::JsonFileSet(json) => {
                // Resolve the file paths the JsonFileSet would hash, without
                // reading or parsing any JSON. Field/excludeField filters are
                // irrelevant here — the reported inputs are still the files.
                let matched = collect_json_input_files(
                    &json.json_path,
                    json.project_name.as_deref(),
                    &self.project_file_map,
                    &self.all_workspace_files,
                )?;
                let files: HashSet<String> = matched.into_iter().map(String::from).collect();
                Ok(HashInputsBuilder {
                    files,
                    ..Default::default()
                })
            }
            HashInstruction::TsConfiguration(_project_name) => {
                // Match the hasher behavior: check tsconfig.base.json first, then tsconfig.json
                let tsconfig_file = self
                    .all_workspace_files
                    .iter()
                    .find(|f| f.file == "tsconfig.base.json")
                    .or_else(|| {
                        self.all_workspace_files
                            .iter()
                            .find(|f| f.file == "tsconfig.json")
                    });
                let files: HashSet<String> = tsconfig_file
                    .map(|f| HashSet::from([f.file.clone()]))
                    .unwrap_or_default();
                Ok(HashInputsBuilder {
                    files,
                    ..Default::default()
                })
            }
            // Context-free variants: delegate to From<&HashInstruction>
            other => Ok(other.into()),
        }
    }
}
