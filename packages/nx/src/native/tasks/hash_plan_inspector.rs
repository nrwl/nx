use crate::native::glob::build_glob_set;
use crate::native::tasks::hashers::{
    ProjectFileSetCache, collect_json_input_files, filter_output_files_by_glob,
    hash_project_files_with_inputs_cached, hash_workspace_files_with_inputs,
    resolve_task_output_files,
};
use crate::native::tasks::task_hasher::{HashInputs, HashInputsBuilder};
use crate::native::tasks::types::HashInstruction;
use crate::native::types::FileData;
use hashbrown::HashSet;
use napi::bindgen_prelude::External;
use rayon::prelude::*;
use std::collections::HashMap;
use std::sync::Arc;

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
        hash_plans: &External<HashMap<String, Vec<HashInstruction>>>,
    ) -> anyhow::Result<HashMap<String, Vec<String>>> {
        let project_file_set_cache = ProjectFileSetCache::new();
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
                        let builder =
                            self.resolve_instruction_inputs(instruction, &project_file_set_cache)?;
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
    /// file path. JsonFileSet is resolved to the matched JSON file paths (field/excludeField
    /// filters only affect hashing, not which files are reported as inputs).
    /// ProjectConfiguration is skipped for now. Cwd is skipped as it's ambient.
    #[napi(ts_return_type = "Record<string, HashInputs>")]
    pub fn inspect_inputs(
        &self,
        hash_plans: &External<HashMap<String, Vec<HashInstruction>>>,
    ) -> anyhow::Result<HashMap<String, HashInputs>> {
        let project_file_set_cache = ProjectFileSetCache::new();
        let results: Vec<(&String, HashInputsBuilder)> = hash_plans
            .iter()
            .flat_map(|(task_id, instructions)| {
                instructions
                    .iter()
                    .map(move |instruction| (task_id, instruction))
            })
            .par_bridge()
            .map(|(task_id, instruction)| {
                let builder =
                    self.resolve_instruction_inputs(instruction, &project_file_set_cache)?;
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

    /// Statically determines which of `files` are covered by each task's
    /// `dependentTasksOutputFiles` inputs. A file is covered when it matches the
    /// `dependentTasksOutputFiles` glob AND lies within one of the upstream
    /// task's declared outputs (exact/glob match or directory containment).
    ///
    /// Unlike `inspect_inputs`, this is pure pattern matching with no disk
    /// access, so it reports a match even when the upstream tasks have not yet
    /// produced their outputs. The dependency-graph walk (including transitive
    /// and diamond deduplication) was already performed by the planner when it
    /// emitted the `TaskOutput` instructions consumed here.
    #[napi(ts_return_type = "Record<string, string[]>")]
    pub fn check_dependent_task_output_files(
        &self,
        hash_plans: &External<HashMap<String, Vec<HashInstruction>>>,
        files: Vec<String>,
    ) -> anyhow::Result<HashMap<String, Vec<String>>> {
        match_dependent_task_output_files(hash_plans, &files)
    }

    /// Resolves a single `HashInstruction` into its structured inputs without hashing.
    /// Context-dependent variants are handled explicitly with access to workspace files,
    /// project graph, etc. Context-free variants fall through to `instruction.into()`.
    fn resolve_instruction_inputs(
        &self,
        instruction: &HashInstruction,
        project_file_set_cache: &ProjectFileSetCache,
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
                let result = hash_project_files_with_inputs_cached(
                    project_name,
                    file_sets,
                    &self.project_file_map,
                    project_file_set_cache,
                )?;
                Ok(HashInputsBuilder {
                    files: result.files.iter().cloned().collect(),
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
            HashInstruction::JsonFileSet {
                project_name,
                json_path,
                ..
            } => {
                // Resolve the file paths the JsonFileSet would hash, without
                // reading or parsing any JSON. Field/excludeField filters are
                // irrelevant here — the reported inputs are still the files.
                let matched = collect_json_input_files(
                    json_path,
                    project_name.as_deref(),
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

/// Returns, per task, which of `files` are covered by that task's
/// `dependentTasksOutputFiles` inputs. Extracted as a free function so the
/// matching logic can be unit-tested without constructing a NAPI `External`.
fn match_dependent_task_output_files(
    hash_plans: &HashMap<String, Vec<HashInstruction>>,
    files: &[String],
) -> anyhow::Result<HashMap<String, Vec<String>>> {
    let mut result: HashMap<String, Vec<String>> = HashMap::new();

    for (task_id, instructions) in hash_plans.iter() {
        let mut matched: HashSet<String> = HashSet::new();

        for instruction in instructions {
            let HashInstruction::TaskOutput(glob, outputs) = instruction else {
                continue;
            };

            // Apply the `dependentTasksOutputFiles` glob to the candidate paths —
            // the same selection `resolve_task_output_files` applies to a
            // dependency's on-disk output files, shared via
            // `filter_output_files_by_glob`.
            let glob_matched = filter_output_files_by_glob(glob, files.iter().cloned())?;
            if glob_matched.is_empty() {
                continue;
            }

            // Statically confirm each selected path lies within an upstream
            // output (glob match or directory containment) — the disk-free
            // counterpart to enumerating the outputs' files on disk.
            let output_glob = build_glob_set(outputs)?;
            for file in glob_matched {
                let within_outputs = output_glob.is_match(&file)
                    || outputs
                        .iter()
                        .any(|output| file.starts_with(&format!("{output}/")));
                if within_outputs {
                    matched.insert(file);
                }
            }
        }

        if !matched.is_empty() {
            let mut files: Vec<String> = matched.into_iter().collect();
            files.sort();
            result.insert(task_id.clone(), files);
        }
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn plan_with_task_output(
        task_id: &str,
        glob: &str,
        outputs: &[&str],
    ) -> HashMap<String, Vec<HashInstruction>> {
        let mut plans = HashMap::new();
        plans.insert(
            task_id.to_string(),
            vec![HashInstruction::TaskOutput(
                glob.to_string(),
                outputs.iter().map(|o| o.to_string()).collect(),
            )],
        );
        plans
    }

    #[test]
    fn matches_when_glob_and_upstream_output_both_cover_the_file() {
        let plans = plan_with_task_output("myproj:build", "**/*.d.ts", &["libs/dep/dist"]);
        let files = vec!["libs/dep/dist/index.d.ts".to_string()];

        let result = match_dependent_task_output_files(&plans, &files).unwrap();

        assert_eq!(
            result.get("myproj:build"),
            Some(&vec!["libs/dep/dist/index.d.ts".to_string()])
        );
    }

    #[test]
    fn does_not_match_when_path_matches_glob_but_no_upstream_output_covers_it() {
        let plans = plan_with_task_output("myproj:build", "**/*.d.ts", &["libs/dep/dist"]);
        let files = vec!["libs/somewhere-else/index.d.ts".to_string()];

        let result = match_dependent_task_output_files(&plans, &files).unwrap();

        assert!(result.is_empty());
    }

    #[test]
    fn does_not_match_when_path_is_inside_output_but_does_not_match_glob() {
        let plans = plan_with_task_output("myproj:build", "**/*.d.ts", &["libs/dep/dist"]);
        // .js is inside the output dir but does not match the **/*.d.ts glob.
        let files = vec!["libs/dep/dist/index.js".to_string()];

        let result = match_dependent_task_output_files(&plans, &files).unwrap();

        assert!(result.is_empty());
    }

    #[test]
    fn matches_via_directory_containment() {
        let plans = plan_with_task_output("myproj:build", "**/*", &["dist/libs/myproj"]);
        let files = vec!["dist/libs/myproj/deep/file.js".to_string()];

        let result = match_dependent_task_output_files(&plans, &files).unwrap();

        assert_eq!(
            result.get("myproj:build"),
            Some(&vec!["dist/libs/myproj/deep/file.js".to_string()])
        );
    }

    #[test]
    fn unions_matches_across_multiple_upstream_task_outputs() {
        // The planner emits one TaskOutput instruction per upstream task that has
        // outputs; a file matches if it is covered by ANY of them.
        let mut plans = HashMap::new();
        plans.insert(
            "myproj:build".to_string(),
            vec![
                HashInstruction::TaskOutput(
                    "**/*.d.ts".to_string(),
                    vec!["libs/dep/dist".to_string()],
                ),
                HashInstruction::TaskOutput(
                    "**/*.d.ts".to_string(),
                    vec!["libs/other/dist".to_string()],
                ),
            ],
        );
        let files = vec![
            "libs/dep/dist/a.d.ts".to_string(),
            "libs/other/dist/b.d.ts".to_string(),
            "libs/unrelated/c.d.ts".to_string(),
        ];

        let result = match_dependent_task_output_files(&plans, &files).unwrap();

        assert_eq!(
            result.get("myproj:build"),
            Some(&vec![
                "libs/dep/dist/a.d.ts".to_string(),
                "libs/other/dist/b.d.ts".to_string(),
            ])
        );
    }

    #[test]
    fn ignores_non_task_output_instructions() {
        let mut plans = HashMap::new();
        plans.insert(
            "myproj:build".to_string(),
            vec![HashInstruction::WorkspaceFileSet(vec!["**/*".to_string()])],
        );
        let files = vec!["libs/dep/dist/index.d.ts".to_string()];

        let result = match_dependent_task_output_files(&plans, &files).unwrap();

        assert!(result.is_empty());
    }
}
