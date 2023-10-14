use std::collections::HashMap;
use std::sync::Arc;

use anyhow::anyhow;
use dashmap::DashMap;
use napi::bindgen_prelude::External;
use rayon::prelude::*;
use tracing::{trace, trace_span};

use crate::native::hasher::hash;
use crate::native::project_graph::types::ProjectGraph;
use crate::native::project_graph::utils::create_project_root_mappings;
use crate::native::tasks::hashers::{
    hash_all_externals, hash_env, hash_external, hash_project_config, hash_project_files,
    hash_runtime, hash_task_output, hash_tsconfig_selectively, hash_workspace_files,
};
use crate::native::tasks::types::HashInstruction;
use crate::native::types::FileData;
use crate::native::utils::tsconfig::{parse_ts_config, read_ts_config};
use crate::native::workspace::types::ProjectFiles;

#[napi(object)]
#[derive(Debug)]
pub struct HashDetails {
    pub value: String,
    pub details: HashMap<String, String>,
}

#[napi(object)]
pub struct HasherOptions {
    pub selectively_hash_ts_config: bool,
}

#[napi]
pub struct TaskHasher {
    workspace_root: String,
    project_graph: External<ProjectGraph>,
    project_file_map: External<HashMap<String, Vec<FileData>>>,
    all_workspace_files: External<Vec<FileData>>,
    options: Option<HasherOptions>,
    workspace_files_cache: Arc<DashMap<String, String>>,
    external_cache: Arc<DashMap<String, String>>,
    runtime_cache: Arc<DashMap<String, String>>,
}
#[napi]
impl TaskHasher {
    #[napi(constructor)]
    pub fn new(
        workspace_root: String,
        project_graph: External<ProjectGraph>,
        project_file_map: External<ProjectFiles>,
        all_workspace_files: External<Vec<FileData>>,
        options: Option<HasherOptions>,
    ) -> Self {
        Self {
            workspace_root,
            project_graph,
            project_file_map,
            all_workspace_files,
            options,
            workspace_files_cache: Arc::new(DashMap::new()),
            external_cache: Arc::new(DashMap::new()),
            runtime_cache: Arc::new(DashMap::new()),
        }
    }

    #[napi]
    pub fn hash_plans(
        &self,
        hash_plans: External<HashMap<String, Vec<HashInstruction>>>,
        js_env: HashMap<String, String>,
    ) -> anyhow::Result<HashMap<String, HashDetails>> {
        trace!("hash_plans: {}", hash_plans.len());
        trace!("all workspace files: {}", self.all_workspace_files.len());
        trace!("project_file_map: {}", self.project_file_map.len());

        let hash_time = std::time::Instant::now();
        let ts_config_str = read_ts_config(&self.workspace_root);
        let ts_config_hash = hash(ts_config_str.as_deref().unwrap_or_default().as_bytes());
        let ts_config = parse_ts_config(ts_config_str.as_deref())?;
        let project_root_mappings = create_project_root_mappings(&self.project_graph.nodes);
        trace!("ts_config: {:?}", ts_config);
        trace!("ts_config parse time: {:?}", hash_time.elapsed());

        let mut sorted_externals = self.project_graph.external_nodes.keys().collect::<Vec<_>>();
        sorted_externals.par_sort();

        let selectively_hash_tsconfig = self
            .options
            .as_ref()
            .map(|o| o.selectively_hash_ts_config)
            .unwrap_or(false);

        let hashes = hash_plans
            .iter()
            .map(|(task_id, plans)| {
                let span = trace_span!("hashing", task_id).entered();
                let now = std::time::Instant::now();
                let collected_plans = plans
                    .par_iter()
                    .map(|plan| {
                        let now = std::time::Instant::now();
                        match plan {
                            HashInstruction::WorkspaceFileSet(workspace_file_set) => {
                                let hashed_workspace_files = hash_workspace_files(
                                    workspace_file_set,
                                    &self.all_workspace_files,
                                    Arc::clone(&self.workspace_files_cache),
                                );
                                trace!(parent: &span, "hash_workspace_files: {:?}", now.elapsed());
                                Ok((plan.to_string(), hashed_workspace_files?))
                            }
                            HashInstruction::Runtime(runtime) => {
                                let hashed_runtime = hash_runtime(
                                    &self.workspace_root,
                                    runtime,
                                    &js_env,
                                    Arc::clone(&self.runtime_cache),
                                )?;
                                trace!(parent: &span, "hash_runtime: {:?}", now.elapsed());
                                Ok((plan.to_string(), hashed_runtime))
                            }
                            HashInstruction::Environment(env) => {
                                let hashed_env = hash_env(env, &js_env)?;
                                trace!(parent: &span, "hash_env: {:?}", now.elapsed());
                                Ok((plan.to_string(), hashed_env))
                            }
                            HashInstruction::ProjectFileSet(project_name, file_set) => {
                                let project =
                                    self.project_graph.nodes.get(project_name).ok_or_else(
                                        || anyhow!("project {} not found", project_name),
                                    )?;
                                let hashed_project_files = hash_project_files(
                                    project_name,
                                    &project.root,
                                    file_set,
                                    &self.project_file_map,
                                )?;
                                trace!(parent: &span, "hash_project_files: {:?}", now.elapsed());
                                Ok((plan.to_string(), hashed_project_files))
                            }
                            HashInstruction::ProjectConfiguration(project_name) => {
                                let hashed_project_config =
                                    hash_project_config(project_name, &self.project_graph.nodes)?;
                                trace!(parent: &span, "hash_project_config: {:?}", now.elapsed());
                                Ok((plan.to_string(), hashed_project_config))
                            }
                            HashInstruction::TsConfiguration(project_name) => {
                                let ts_config_hash = if !selectively_hash_tsconfig {
                                    ts_config_hash.to_string()
                                } else {
                                    hash_tsconfig_selectively(
                                        project_name,
                                        &ts_config,
                                        &project_root_mappings,
                                    )?
                                };
                                trace!(parent: &span, "hash_tsconfig: {:?}", now.elapsed());
                                Ok((plan.to_string(), ts_config_hash))
                            }
                            HashInstruction::TaskOutput(glob, outputs) => {
                                let hashed_task_output =
                                    hash_task_output(&self.workspace_root, glob, outputs)?;
                                trace!(parent: &span, "hash_task_output: {:?}", now.elapsed());
                                Ok((plan.to_string(), hashed_task_output))
                            }
                            HashInstruction::External(external) => {
                                let hashed_external = hash_external(
                                    external,
                                    &self.project_graph.external_nodes,
                                    Arc::clone(&self.external_cache),
                                )?;
                                trace!(parent: &span, "hash_external: {:?}", now.elapsed());
                                Ok((plan.to_string(), hashed_external))
                            }
                            HashInstruction::AllExternalDependencies => {
                                let hashed_all_externals = hash_all_externals(
                                    &sorted_externals,
                                    &self.project_graph.external_nodes,
                                    Arc::clone(&self.external_cache),
                                )?;
                                trace!(parent: &span, "hash_all_externals: {:?}", now.elapsed());
                                Ok((plan.to_string(), hashed_all_externals))
                            }
                        }
                    })
                    .collect::<anyhow::Result<Vec<_>>>()?;

                let all_hashes = hash(
                    &collected_plans
                        .iter()
                        .map(|(_, hash)| hash.as_bytes())
                        .collect::<Vec<_>>()
                        .concat(),
                );

                let collected_plans = collected_plans
                    .into_iter()
                    .map(|(plan, hash)| (plan, hash))
                    .collect::<HashMap<String, String>>();
                trace!("total hash time {:?}", now.elapsed());
                Ok((
                    task_id.to_string(),
                    HashDetails {
                        value: all_hashes,
                        details: collected_plans,
                    },
                ))
            })
            .collect();

        trace!("hashing took {:?}", hash_time.elapsed());
        trace!(?hashes);
        hashes
    }
}
