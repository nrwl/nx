use std::collections::HashMap;
use std::sync::Arc;

use crate::native::{
    hasher::hash,
    project_graph::{types::ProjectGraph, utils::create_project_root_mappings},
    tasks::types::HashInstruction,
    types::NapiDashMap,
};
use crate::native::{
    project_graph::utils::ProjectRootMappings,
    tasks::hashers::{hash_env, hash_runtime, hash_workspace_files},
};
use crate::native::{
    tasks::hashers::{
        hash_all_externals, hash_external, hash_project_config, hash_project_files,
        hash_task_output, hash_tsconfig_selectively,
    },
    types::FileData,
    workspace::types::ProjectFiles,
};
use anyhow::anyhow;
use dashmap::DashMap;
use napi::bindgen_prelude::{Buffer, External};
use rayon::prelude::*;
use tracing::{debug, trace, trace_span};

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
    ts_config: Vec<u8>,
    ts_config_paths: HashMap<String, Vec<String>>,
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
        ts_config: Buffer,
        ts_config_paths: HashMap<String, Vec<String>>,
        options: Option<HasherOptions>,
    ) -> Self {
        Self {
            workspace_root,
            project_graph,
            project_file_map,
            all_workspace_files,
            ts_config: ts_config.to_vec(),
            ts_config_paths,
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
    ) -> anyhow::Result<NapiDashMap<String, HashDetails>> {
        debug!("hashing plans {:?}", hash_plans.as_ref());
        trace!("plan length: {}", hash_plans.len());
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

        let hash_time = std::time::Instant::now();

        let hashes: NapiDashMap<String, HashDetails> = NapiDashMap::new();

        hash_plans
            .iter()
            .flat_map(|(task_id, instructions)| {
                instructions
                    .iter()
                    .map(move |instruction| (task_id, instruction))
            })
            .par_bridge()
            .try_for_each(|(task_id, instruction)| {
                let hash_detail = self.hash_instruction(
                    task_id,
                    instruction,
                    HashInstructionArgs {
                        js_env: &js_env,
                        ts_config_hash: &ts_config_hash,
                        project_root_mappings: &project_root_mappings,
                        sorted_externals: &sorted_externals,
                        selectively_hash_tsconfig,
                    },
                )?;

                let mut entry = hashes
                    .entry(task_id.to_string())
                    .or_insert_with(|| HashDetails {
                        value: String::new(),
                        details: HashMap::new(),
                    });

                entry.details.insert(hash_detail.0, hash_detail.1);
                Ok::<(), anyhow::Error>(())
            })?;

        hashes.iter_mut().for_each(|mut h| {
            let hash_details = h.value_mut();
            let mut keys = hash_details.details.keys().collect::<Vec<_>>();
            keys.par_sort();
            let mut hasher = xxhash_rust::xxh3::Xxh3::new();
            for key in keys {
                hasher.update(hash_details.details[key].as_bytes());
            }
            hash_details.value = hasher.digest().to_string();
        });

        trace!("hashing took {:?}", hash_time.elapsed());
        debug!(?hashes);
        Ok(hashes)
    }

    fn hash_instruction(
        &self,
        task_id: &str,
        instruction: &HashInstruction,
        HashInstructionArgs {
            js_env,
            ts_config_hash,
            project_root_mappings,
            sorted_externals,
            selectively_hash_tsconfig,
        }: HashInstructionArgs,
    ) -> anyhow::Result<(String, String)> {
        let now = std::time::Instant::now();
        let span = trace_span!("hashing", task_id).entered();
        let hash = match instruction {
            HashInstruction::WorkspaceFileSet(workspace_file_set) => {
                let hashed_workspace_files = hash_workspace_files(
                    workspace_file_set,
                    &self.all_workspace_files,
                    Arc::clone(&self.workspace_files_cache),
                );
                trace!(parent: &span, "hash_workspace_files: {:?}", now.elapsed());
                hashed_workspace_files?
            }
            HashInstruction::Runtime(runtime) => {
                let hashed_runtime = hash_runtime(
                    &self.workspace_root,
                    runtime,
                    js_env,
                    Arc::clone(&self.runtime_cache),
                )?;
                trace!(parent: &span, "hash_runtime: {:?}", now.elapsed());
                hashed_runtime
            }
            HashInstruction::Environment(env) => {
                let hashed_env = hash_env(env, js_env)?;
                trace!(parent: &span, "hash_env: {:?}", now.elapsed());
                hashed_env
            }
            HashInstruction::ProjectFileSet(project_name, file_sets) => {
                let project = self
                    .project_graph
                    .nodes
                    .get(project_name)
                    .ok_or_else(|| anyhow!("project {} not found", project_name))?;
                let hashed_project_files = hash_project_files(
                    project_name,
                    &project.root,
                    file_sets,
                    &self.project_file_map,
                )?;
                trace!(parent: &span, "hash_project_files: {:?}", now.elapsed());
                hashed_project_files
            }
            HashInstruction::ProjectConfiguration(project_name) => {
                let hashed_project_config =
                    hash_project_config(project_name, &self.project_graph.nodes)?;
                trace!(parent: &span, "hash_project_config: {:?}", now.elapsed());
                hashed_project_config
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

                trace!(parent: &span, "hash_tsconfig: {:?}", now.elapsed());
                ts_hash
            }
            HashInstruction::TaskOutput(glob, outputs) => {
                let hashed_task_output = hash_task_output(&self.workspace_root, glob, outputs)?;
                trace!(parent: &span, "hash_task_output: {:?}", now.elapsed());
                hashed_task_output
            }
            HashInstruction::External(external) => {
                let hashed_external = hash_external(
                    external,
                    &self.project_graph.external_nodes,
                    Arc::clone(&self.external_cache),
                )?;
                trace!(parent: &span, "hash_external: {:?}", now.elapsed());
                hashed_external
            }
            HashInstruction::AllExternalDependencies => {
                let hashed_all_externals = hash_all_externals(
                    sorted_externals,
                    &self.project_graph.external_nodes,
                    Arc::clone(&self.external_cache),
                )?;
                trace!(parent: &span, "hash_all_externals: {:?}", now.elapsed());
                hashed_all_externals
            }
        };
        Ok((instruction.to_string(), hash))
    }
}

struct HashInstructionArgs<'a> {
    js_env: &'a HashMap<String, String>,
    ts_config_hash: &'a str,
    project_root_mappings: &'a ProjectRootMappings,
    sorted_externals: &'a [&'a String],
    selectively_hash_tsconfig: bool,
}
