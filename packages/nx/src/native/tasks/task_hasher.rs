use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

use hashbrown::HashSet;

use crate::native::{
    hasher::{hash, hash_array},
    project_graph::{types::ProjectGraph, utils::create_project_root_mappings},
    tasks::types::HashInstruction,
    types::NapiDashMap,
};
use crate::native::{
    project_graph::utils::ProjectRootMappings,
    tasks::hashers::{hash_cwd, hash_env, hash_runtime},
};
use crate::native::{
    tasks::hashers::{
        CachedTaskOutput, hash_all_externals, hash_external, hash_project_config,
        hash_project_files_with_inputs, hash_task_output, hash_tsconfig_selectively,
        hash_workspace_files_with_inputs,
    },
    types::FileData,
    workspace::types::ProjectFiles,
};
use anyhow::anyhow;
use dashmap::DashMap;
use napi::bindgen_prelude::*;
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
struct HashInputsBuilder {
    files: HashSet<String>,
    runtime: HashSet<String>,
    environment: HashSet<String>,
    dep_outputs: HashSet<String>,
    external: HashSet<String>,
}

impl HashInputsBuilder {
    /// Extends this builder with all values from another builder
    fn extend(&mut self, other: HashInputsBuilder) {
        self.files.extend(other.files);
        self.runtime.extend(other.runtime);
        self.environment.extend(other.environment);
        self.dep_outputs.extend(other.dep_outputs);
        self.external.extend(other.external);
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
    pub details: HashMap<String, String>,
    /// Structured inputs used for hashing (file patterns, env vars, etc.)
    pub inputs: HashInputs,
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
    root_tsconfig_path: Option<String>,
    options: Option<HasherOptions>,
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
        root_tsconfig_path: Option<String>,
        options: Option<HasherOptions>,
    ) -> Self {
        Self {
            workspace_root,
            project_graph,
            project_file_map,
            all_workspace_files,
            ts_config: ts_config.to_vec(),
            ts_config_paths,
            root_tsconfig_path,
            options,
            external_cache: Arc::new(DashMap::new()),
            runtime_cache: Arc::new(DashMap::new()),
        }
    }

    #[napi]
    pub fn hash_plans(
        &self,
        hash_plans: External<HashMap<String, Vec<HashInstruction>>>,
        js_env: HashMap<String, String>,
        cwd: String,
    ) -> anyhow::Result<NapiDashMap<String, HashDetails>> {
        // Create a fresh task output cache for this invocation
        // This ensures no stale caches across multiple CLI commands when the daemon holds
        // the TaskHasher instance
        let task_output_cache = DashMap::new();

        let function_start = std::time::Instant::now();

        trace!("hashing plans {:?}", hash_plans.as_ref());
        trace!("Starting hash_plans with {} plans", hash_plans.len());
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

        // Use separate maps: one for hash details, one for input accumulation with HashSet
        let hashes: NapiDashMap<String, HashDetails> = NapiDashMap::new();
        let inputs_accum: DashMap<String, HashInputsBuilder> = DashMap::new();
        let cwd_path = std::path::Path::new(&cwd);

        hash_plans
            .iter()
            .flat_map(|(task_id, instructions)| {
                instructions
                    .iter()
                    .map(move |instruction| (task_id, instruction))
            })
            .par_bridge()
            .try_for_each(|(task_id, instruction)| {
                let (instruction_key, hash_value, inputs) = self.hash_instruction(
                    task_id,
                    instruction,
                    HashInstructionArgs {
                        js_env: &js_env,
                        ts_config_hash: &ts_config_hash,
                        project_root_mappings: &project_root_mappings,
                        sorted_externals: &sorted_externals,
                        selectively_hash_tsconfig,
                        task_output_cache: &task_output_cache,
                        cwd: cwd_path,
                    },
                )?;

                // Accumulate hash details
                let mut entry = hashes
                    .entry(task_id.to_string())
                    .or_insert_with(|| HashDetails {
                        value: String::new(),
                        details: HashMap::new(),
                        inputs: HashInputs::default(),
                    });
                entry.details.insert(instruction_key, hash_value);

                // Accumulate inputs using HashSet for O(1) deduplication
                inputs_accum
                    .entry(task_id.to_string())
                    .or_default()
                    .extend(inputs);

                Ok::<(), anyhow::Error>(())
            })?;

        let assemble_start = std::time::Instant::now();

        hashes.iter_mut().for_each(|mut h| {
            let (hash_id, hash_details) = h.pair_mut();
            let mut keys = hash_details.details.keys().collect::<Vec<_>>();
            keys.par_sort();
            let mut hasher = xxhash_rust::xxh3::Xxh3::new();
            trace_span!("Assembling hash", hash_id).in_scope(|| {
                for key in keys {
                    trace!("Adding {} ({}) to hash", hash_details.details[key], key);
                    hasher.update(hash_details.details[key].as_bytes());
                }
                let hash = hasher.digest().to_string();
                trace!("Hash Value: {}", hash);
                hash_details.value = hash;
            });
            // Convert accumulated HashInputsBuilder to HashInputs (sorted Vecs)
            if let Some((_, builder)) = inputs_accum.remove(hash_id) {
                hash_details.inputs = builder.into();
            }
        });

        let assemble_duration = assemble_start.elapsed();
        let hash_duration = hash_time.elapsed();
        let total_duration = function_start.elapsed();

        debug!(
            "hash_plans COMPLETED in {:?} - processed {} plans (setup: {:?}, hashing: {:?}, assembly: {:?})",
            total_duration,
            hash_plans.len(),
            setup_duration,
            hash_duration,
            assemble_duration
        );

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
            task_output_cache,
            cwd,
        }: HashInstructionArgs,
    ) -> anyhow::Result<(String, String, HashInputsBuilder)> {
        let now = std::time::Instant::now();
        let span = trace_span!("hashing", task_id).entered();
        let (hash, inputs) = match instruction {
            HashInstruction::WorkspaceFileSet(workspace_file_set) => {
                let result = hash_workspace_files_with_inputs(
                    workspace_file_set,
                    &self.all_workspace_files,
                )?;
                trace!(parent: &span, "hash_workspace_files: {:?}", now.elapsed());
                (
                    result.hash,
                    HashInputsBuilder {
                        files: result.files.into_iter().collect(),
                        ..Default::default()
                    },
                )
            }
            HashInstruction::Runtime(runtime) => {
                let hashed_runtime = hash_runtime(
                    &self.workspace_root,
                    runtime,
                    js_env,
                    Arc::clone(&self.runtime_cache),
                )?;
                trace!(parent: &span, "hash_runtime: {:?}", now.elapsed());
                (
                    hashed_runtime,
                    HashInputsBuilder {
                        runtime: HashSet::from([runtime.clone()]),
                        ..Default::default()
                    },
                )
            }
            HashInstruction::Environment(env) => {
                let hashed_env = hash_env(env, js_env);
                trace!(parent: &span, "hash_env: {:?}", now.elapsed());
                (
                    hashed_env,
                    HashInputsBuilder {
                        environment: HashSet::from([env.clone()]),
                        ..Default::default()
                    },
                )
            }
            HashInstruction::Cwd(mode) => {
                let workspace_root = std::path::Path::new(&self.workspace_root);
                let hashed_cwd = hash_cwd(workspace_root, cwd, mode.clone());
                trace!(parent: &span, "hash_cwd: {:?}", now.elapsed());
                (hashed_cwd, HashInputsBuilder::default())
            }
            HashInstruction::ProjectFileSet(project_name, file_sets) => {
                let project = self
                    .project_graph
                    .nodes
                    .get(project_name)
                    .ok_or_else(|| anyhow!("project {} not found", project_name))?;
                let result = hash_project_files_with_inputs(
                    project_name,
                    &project.root,
                    file_sets,
                    &self.project_file_map,
                )?;
                trace!(parent: &span, "hash_project_files: {:?}", now.elapsed());
                (
                    result.hash,
                    HashInputsBuilder {
                        files: result.files.into_iter().collect(),
                        ..Default::default()
                    },
                )
            }
            HashInstruction::ProjectConfiguration(project_name) => {
                let hashed_project_config =
                    hash_project_config(project_name, &self.project_graph.nodes)?;
                trace!(parent: &span, "hash_project_config: {:?}", now.elapsed());
                (hashed_project_config, HashInputsBuilder::default())
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

                // Convert absolute tsconfig path to relative path
                let files = if let Some(rel_path) = relative_ts_path {
                    HashSet::from([rel_path])
                } else {
                    HashSet::new()
                };

                trace!(parent: &span, "hash_tsconfig: {:?}", now.elapsed());
                (
                    ts_hash,
                    HashInputsBuilder {
                        files,
                        ..Default::default()
                    },
                )
            }
            HashInstruction::TaskOutput(glob, outputs) => {
                let result =
                    hash_task_output(&self.workspace_root, glob, outputs, task_output_cache)?;
                trace!(parent: &span, "hash_task_output: {:?}", now.elapsed());
                (
                    result.hash,
                    HashInputsBuilder {
                        dep_outputs: result.files.into_iter().collect(),
                        ..Default::default()
                    },
                )
            }
            HashInstruction::TaskHash(task_id, task_hash) => {
                let combined = hash_array(vec![task_hash.clone(), task_id.clone()]);
                trace!(parent: &span, "hash_task_hash: {:?}", now.elapsed());
                (combined, HashInputsBuilder::default())
            }
            HashInstruction::External(external) => {
                let hashed_external = hash_external(
                    external,
                    &self.project_graph.external_nodes,
                    Arc::clone(&self.external_cache),
                )?;
                trace!(parent: &span, "hash_external: {:?}", now.elapsed());
                (
                    hashed_external,
                    HashInputsBuilder {
                        external: HashSet::from([external.clone()]),
                        ..Default::default()
                    },
                )
            }
            HashInstruction::AllExternalDependencies => {
                let hashed_all_externals = hash_all_externals(
                    sorted_externals,
                    &self.project_graph.external_nodes,
                    Arc::clone(&self.external_cache),
                )?;
                trace!(parent: &span, "hash_all_externals: {:?}", now.elapsed());
                (
                    hashed_all_externals,
                    HashInputsBuilder {
                        external: HashSet::from(["AllExternalDependencies".to_string()]),
                        ..Default::default()
                    },
                )
            }
        };
        Ok((instruction.to_string(), hash, inputs))
    }
}

struct HashInstructionArgs<'a> {
    js_env: &'a HashMap<String, String>,
    ts_config_hash: &'a str,
    project_root_mappings: &'a ProjectRootMappings,
    sorted_externals: &'a [&'a String],
    selectively_hash_tsconfig: bool,
    task_output_cache: &'a DashMap<String, CachedTaskOutput>,
    cwd: &'a std::path::Path,
}
