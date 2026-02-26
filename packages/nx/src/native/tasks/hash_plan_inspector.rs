use crate::native::project_graph::types::ProjectGraph;
use crate::native::tasks::hashers::{
    hash_project_files_with_inputs, hash_workspace_files_with_inputs, resolve_task_output_files,
};
use crate::native::tasks::task_hasher::{HashInputs, HashInputsBuilder};
use crate::native::tasks::types::HashInstruction;
use crate::native::types::FileData;
use hashbrown::HashSet;
use napi::bindgen_prelude::External;
use napi::bindgen_prelude::*;
use rayon::prelude::*;
use std::collections::HashMap;
use std::sync::Arc;

#[napi]
pub struct HashPlanInspector {
    all_workspace_files: Arc<Vec<FileData>>,
    project_graph: Arc<ProjectGraph>,
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
        #[napi(ts_arg_type = "ExternalObject<ProjectGraph>")] project_graph: &External<
            Arc<ProjectGraph>,
        >,
        #[napi(ts_arg_type = "ExternalObject<Record<string, Array<FileData>>>")]
        project_file_map: &External<Arc<HashMap<String, Vec<FileData>>>>,
        workspace_root: String,
    ) -> Self {
        Self {
            all_workspace_files: Arc::clone(all_workspace_files),
            project_graph: Arc::clone(project_graph),
            project_file_map: Arc::clone(project_file_map),
            workspace_root,
        }
    }

    /// @deprecated Use `inspectInputs()` instead for structured output.
    #[napi(ts_return_type = "Record<string, string[]>")]
    pub fn inspect(
        &self,
        hash_plans: &External<HashMap<String, Vec<HashInstruction>>>,
    ) -> anyhow::Result<HashMap<String, Vec<String>>> {
        let results: Vec<(&String, Vec<String>)> = hash_plans
            .iter()
            .flat_map(|(task_id, instructions)| {
                instructions
                    .iter()
                    .map(move |instruction| (task_id, instruction))
            })
            .par_bridge()
            .map(|(task_id, instruction)| {
                let strings = match instruction {
                    // File-set instructions: resolve to actual file paths
                    HashInstruction::WorkspaceFileSet(_)
                    | HashInstruction::ProjectFileSet(_, _) => {
                        let builder = self.resolve_instruction_inputs(instruction)?;
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

    /// Like `inspect()` but returns structured `HashInputs` objects instead of flat strings.
    /// Each `HashInstruction` is categorized into the appropriate bucket (files, runtime,
    /// environment, depOutputs, external). TsConfiguration is resolved to the root tsconfig
    /// file path. ProjectConfiguration is skipped for now. Cwd is skipped as it's ambient.
    #[napi(ts_return_type = "Record<string, HashInputs>")]
    pub fn inspect_inputs(
        &self,
        hash_plans: &External<HashMap<String, Vec<HashInstruction>>>,
    ) -> anyhow::Result<HashMap<String, HashInputs>> {
        let results: Vec<(&String, HashInputsBuilder)> = hash_plans
            .iter()
            .flat_map(|(task_id, instructions)| {
                instructions
                    .iter()
                    .map(move |instruction| (task_id, instruction))
            })
            .par_bridge()
            .map(|(task_id, instruction)| {
                let builder = self.resolve_instruction_inputs(instruction)?;
                Ok::<_, anyhow::Error>((task_id, builder))
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
    ) -> anyhow::Result<HashInputsBuilder> {
        match instruction {
            HashInstruction::WorkspaceFileSet(workspace_file_set) => {
                let result = hash_workspace_files_with_inputs(
                    workspace_file_set,
                    &self.all_workspace_files,
                )?;
                Ok(HashInputsBuilder {
                    files: result.files.into_iter().collect(),
                    ..Default::default()
                })
            }
            HashInstruction::ProjectFileSet(project_name, file_sets) => {
                let project = self
                    .project_graph
                    .nodes
                    .get(project_name)
                    .ok_or_else(|| anyhow::anyhow!("project {} not found", project_name))?;
                let result = hash_project_files_with_inputs(
                    project_name,
                    &project.root,
                    file_sets,
                    &self.project_file_map,
                )?;
                Ok(HashInputsBuilder {
                    files: result.files.into_iter().collect(),
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
