use crate::native::project_graph::types::ProjectGraph;
use crate::native::tasks::hashers::{collect_project_files, get_workspace_files};
use crate::native::tasks::types::HashInstruction;
use crate::native::types::FileData;
use anyhow::anyhow;
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
        project_file_map: External<HashMap<String, Vec<FileData>>>) -> Self {
        Self {
            all_workspace_files,
            project_graph,
            project_file_map,
        }
    }

    #[napi(ts_return_type = "Record<string, string[]>")]
    pub fn inspect(&self, hash_plans: External<HashMap<String, Vec<HashInstruction>>>) -> anyhow::Result<HashMap<String, Vec<String>>> {
        let a: Vec<(&String, Vec<String>)> = hash_plans
            .iter()
            .flat_map(|(task_id, instructions)| {
                instructions
                    .iter()
                    .map(move |instruction| (task_id, instruction))
            })
            .par_bridge()
            .map(|(task_id, instruction)| {
                match instruction {
                    HashInstruction::WorkspaceFileSet(workspace_file_set) => {
                        let files = get_workspace_files(workspace_file_set, &self.all_workspace_files)?
                            .map(|x| x.file.clone())
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
                            &project.root, file_sets, &self.project_file_map)?.iter().map(|x| x.file.clone()).collect();
                        Ok::<_, anyhow::Error>((task_id, files))
                    }
                    _ => {
                        Ok::<_, anyhow::Error>((task_id, vec![instruction.to_string()]))
                    }
                }
            })
            .collect::<anyhow::Result<_>>()?;

        Ok(a.into_iter().fold(HashMap::new(), |mut acc, (task_id, files)| {
            acc.entry(task_id.clone()).or_default().extend(files);
            acc
        }))
    }
}
