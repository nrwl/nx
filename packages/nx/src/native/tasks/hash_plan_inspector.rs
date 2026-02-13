use crate::native::project_graph::types::ProjectGraph;
use crate::native::tasks::hashers::{collect_project_files, get_workspace_files};
use crate::native::tasks::task_hasher::{HashInputs, HashInputsBuilder};
use crate::native::tasks::types::HashInstruction;
use crate::native::types::FileData;
use anyhow::anyhow;
use hashbrown::HashSet;
use napi::bindgen_prelude::*;
use rayon::prelude::*;
use std::collections::HashMap;

#[napi]
pub struct HashPlanInspector {
    all_workspace_files: External<Vec<FileData>>,
    project_graph: External<ProjectGraph>,
    project_file_map: External<HashMap<String, Vec<FileData>>>,
}

#[napi]
impl HashPlanInspector {
    #[napi(constructor)]
    pub fn new(
        all_workspace_files: External<Vec<FileData>>,
        project_graph: External<ProjectGraph>,
        project_file_map: External<HashMap<String, Vec<FileData>>>,
    ) -> Self {
        Self {
            all_workspace_files,
            project_graph,
            project_file_map,
        }
    }

    #[napi(ts_return_type = "Record<string, string[]>")]
    pub fn inspect(
        &self,
        hash_plans: External<HashMap<String, Vec<HashInstruction>>>,
    ) -> anyhow::Result<HashMap<String, Vec<String>>> {
        let a: Vec<(&String, Vec<String>)> = hash_plans
            .iter()
            .flat_map(|(task_id, instructions)| {
                instructions
                    .iter()
                    .map(move |instruction| (task_id, instruction))
            })
            .par_bridge()
            .map(|(task_id, instruction)| match instruction {
                HashInstruction::WorkspaceFileSet(workspace_file_set) => {
                    let files = get_workspace_files(workspace_file_set, &self.all_workspace_files)?
                        .map(|x| format!("file:{}", x.file))
                        .collect();

                    Ok::<_, anyhow::Error>((task_id, files))
                }
                HashInstruction::ProjectFileSet(project_name, file_sets) => {
                    let project = self
                        .project_graph
                        .nodes
                        .get(project_name)
                        .ok_or_else(|| anyhow!("project {} not found", project_name))?;

                    let files = collect_project_files(
                        project_name,
                        &project.root,
                        file_sets,
                        &self.project_file_map,
                    )?
                    .iter()
                    .map(|x| format!("file:{}", x.file))
                    .collect();
                    Ok::<_, anyhow::Error>((task_id, files))
                }
                _ => Ok::<_, anyhow::Error>((task_id, vec![instruction.to_string()])),
            })
            .collect::<anyhow::Result<_>>()?;

        Ok(a.into_iter()
            .fold(HashMap::new(), |mut acc, (task_id, files)| {
                acc.entry(task_id.clone()).or_default().extend(files);
                acc
            }))
    }

    /// Like `inspect()` but returns structured `HashInputs` objects instead of flat strings.
    /// Each `HashInstruction` is categorized into the appropriate bucket (files, runtime,
    /// environment, depOutputs, external). TsConfiguration and ProjectConfiguration are
    /// resolved to their respective file paths. Cwd is skipped as it's ambient.
    #[napi(ts_return_type = "Record<string, HashInputs>")]
    pub fn inspect_inputs(
        &self,
        hash_plans: External<HashMap<String, Vec<HashInstruction>>>,
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
                let builder = match instruction {
                    HashInstruction::WorkspaceFileSet(workspace_file_set) => {
                        let files: HashSet<String> =
                            get_workspace_files(workspace_file_set, &self.all_workspace_files)?
                                .map(|x| x.file.clone())
                                .collect();
                        HashInputsBuilder {
                            files,
                            ..Default::default()
                        }
                    }
                    HashInstruction::ProjectFileSet(project_name, file_sets) => {
                        let project = self
                            .project_graph
                            .nodes
                            .get(project_name)
                            .ok_or_else(|| anyhow!("project {} not found", project_name))?;
                        let files: HashSet<String> = collect_project_files(
                            project_name,
                            &project.root,
                            file_sets,
                            &self.project_file_map,
                        )?
                        .iter()
                        .map(|x| x.file.clone())
                        .collect();
                        HashInputsBuilder {
                            files,
                            ..Default::default()
                        }
                    }
                    HashInstruction::Runtime(runtime) => HashInputsBuilder {
                        runtime: HashSet::from([runtime.clone()]),
                        ..Default::default()
                    },
                    HashInstruction::Environment(env) => HashInputsBuilder {
                        environment: HashSet::from([env.clone()]),
                        ..Default::default()
                    },
                    HashInstruction::TaskOutput(_glob, dep_outputs) => HashInputsBuilder {
                        dep_outputs: dep_outputs.iter().cloned().collect(),
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
                    HashInstruction::TsConfiguration(_project_name) => {
                        // Find root-level tsconfig files that affect the hash
                        let files: HashSet<String> = self
                            .all_workspace_files
                            .iter()
                            .filter(|f| {
                                !f.file.contains('/')
                                    && f.file.starts_with("tsconfig")
                                    && f.file.ends_with(".json")
                            })
                            .map(|f| f.file.clone())
                            .collect();
                        HashInputsBuilder {
                            files,
                            ..Default::default()
                        }
                    }
                    HashInstruction::ProjectConfiguration(project_name) => {
                        // Resolve the project's configuration file
                        let mut files = HashSet::new();
                        if let Some(project) = self.project_graph.nodes.get(project_name) {
                            let project_json = format!("{}/project.json", project.root);
                            let package_json = format!("{}/package.json", project.root);
                            if self
                                .all_workspace_files
                                .iter()
                                .any(|f| f.file == project_json)
                            {
                                files.insert(project_json);
                            } else if self
                                .all_workspace_files
                                .iter()
                                .any(|f| f.file == package_json)
                            {
                                files.insert(package_json);
                            }
                        }
                        HashInputsBuilder {
                            files,
                            ..Default::default()
                        }
                    }
                    // Cwd is ambient — skip
                    HashInstruction::Cwd(_) => HashInputsBuilder::default(),
                };
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
}
