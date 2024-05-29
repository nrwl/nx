use crate::native::logger::enable_logger;
use crate::native::tasks::{
    dep_outputs::get_dep_output,
    types::{HashInstruction, TaskGraph},
};
use crate::native::types::{Input, NxJson};
use crate::native::{
    project_graph::types::ProjectGraph,
    tasks::{inputs::SplitInputs, types::Task},
};
use napi::bindgen_prelude::External;
use napi::{Env, JsExternal};
use rayon::prelude::*;
use std::collections::HashMap;
use tracing::trace;

use crate::native::tasks::inputs::{
    expand_single_project_inputs, get_inputs, get_inputs_for_dependency, get_named_inputs,
};
use crate::native::tasks::utils;
use crate::native::utils::find_matching_projects;

#[napi]
pub struct HashPlanner {
    nx_json: NxJson,
    project_graph: External<ProjectGraph>,
}

#[napi]
impl HashPlanner {
    #[napi(constructor)]
    pub fn new(nx_json: NxJson, project_graph: External<ProjectGraph>) -> Self {
        enable_logger();
        Self {
            nx_json,
            project_graph,
        }
    }

    pub fn get_plans_internal(
        &self,
        task_ids: Vec<&str>,
        task_graph: TaskGraph,
    ) -> anyhow::Result<HashMap<String, Vec<HashInstruction>>> {
        let external_deps_mapped = self.setup_external_deps();
        task_ids
            .par_iter()
            .map(|id| {
                let task = &task_graph
                    .tasks
                    .get(*id)
                    .ok_or_else(|| anyhow::anyhow!("Task with id '{id}' not found"))?;
                let inputs = get_inputs(task, &self.project_graph, &self.nx_json)?;

                let target = self.target_input(
                    &task.target.project,
                    &task.target.target,
                    &inputs.self_inputs,
                    &external_deps_mapped,
                )?;

                let self_inputs = self.self_and_deps_inputs(
                    &task.target.project,
                    task,
                    &inputs,
                    &task_graph,
                    &external_deps_mapped,
                    &mut Box::new(hashbrown::HashSet::from([task.target.project.to_string()])),
                )?;

                let mut inputs: Vec<HashInstruction> = target
                    .unwrap_or(vec![])
                    .into_iter()
                    .chain(vec![
                        HashInstruction::WorkspaceFileSet("{workspaceRoot}/nx.json".to_string()),
                        HashInstruction::WorkspaceFileSet("{workspaceRoot}/.gitignore".to_string()),
                        HashInstruction::WorkspaceFileSet("{workspaceRoot}/.nxignore".to_string()),
                    ])
                    .chain(self_inputs)
                    .collect();

                inputs.par_sort();
                inputs.dedup();

                Ok((id.to_string(), inputs))
            })
            .collect()
    }

    #[napi(ts_return_type = "Record<string, string[]>")]
    pub fn get_plans(
        &self,
        task_ids: Vec<&str>,
        task_graph: TaskGraph,
    ) -> anyhow::Result<HashMap<String, Vec<HashInstruction>>> {
        self.get_plans_internal(task_ids, task_graph)
    }

    #[napi]
    pub fn get_plans_reference(
        &self,
        env: Env,
        task_ids: Vec<&str>,
        task_graph: TaskGraph,
    ) -> anyhow::Result<JsExternal> {
        let plans = self.get_plans_internal(task_ids, task_graph)?;
        env.create_external(plans, None)
            .map_err(anyhow::Error::from)
    }

    fn target_input<'a>(
        &'a self,
        project_name: &str,
        target_name: &str,
        self_inputs: &[Input],
        external_deps_map: &hashbrown::HashMap<&String, Vec<&'a String>>,
    ) -> anyhow::Result<Option<Vec<HashInstruction>>> {
        let project = &self.project_graph.nodes[project_name];
        let Some(target) = project.targets.get(target_name) else {
            return Ok(None);
        };

        // we can only vouch for @nx packages's executor dependencies
        // if it's "run commands" or third-party we skip traversing since we have no info what this command depends on
        if target
            .executor
            .as_ref()
            .is_some_and(|e| e.starts_with("@nrwl/") || e.starts_with("@nx/"))
        {
            let executor_package = target
                .executor
                .as_ref()
                .unwrap()
                .split(':')
                .next()
                .expect("Executors should always have a ':'");
            let Some(existing_package) =
                find_external_dependency_node_name(executor_package, &self.project_graph)
            else {
                // this usually happens because the executor was a local plugin.
                // todo)) @Cammisuli: we need to gather the project's inputs and its dep inputs similar to how we do it in `self_and_deps_inputs`
                return Ok(None);
            };
            let mut external_deps: Vec<&'a String> = vec![];
            trace!(
                "Add External Instruction for executor {existing_package}: {}",
                target.executor.as_ref().unwrap()
            );
            trace!(
                "Add External Instructions for dependencies of executor {existing_package}: {:?}",
                &external_deps_map[&existing_package]
            );
            external_deps.push(existing_package);
            external_deps.extend(&external_deps_map[&existing_package]);
            Ok(Some(
                external_deps
                    .iter()
                    .map(|s| HashInstruction::External(s.to_string()))
                    .collect(),
            ))
        } else {
            let mut external_deps: Vec<&'a String> = vec![];
            for input in self_inputs {
                match input {
                    Input::ExternalDependency(deps) => {
                        for dep in deps.iter() {
                            let external_node_name =
                                find_external_dependency_node_name(dep, &self.project_graph);
                            let Some(external_node_name) = external_node_name else {
                                anyhow::bail!("The externalDependency '{dep}' for '{project_name}:{target_name}' could not be found")
                            };
                            trace!(
                                "Add External Instruction for External Input {external_node_name}: {}",
                                target.executor.as_ref().unwrap()
                            );
                            trace!(
                                "Add External Instructions for dependencies of External Input {external_node_name}: {:?}",
                                &external_deps_map[&external_node_name]
                            );
                            external_deps.push(external_node_name);
                            external_deps.extend(&external_deps_map[&external_node_name]);
                        }
                    }
                    _ => continue,
                }
            }
            if !external_deps.is_empty() {
                Ok(Some(
                    external_deps
                        .iter()
                        .map(|s| HashInstruction::External(s.to_string()))
                        .collect(),
                ))
            } else {
                Ok(Some(vec![HashInstruction::AllExternalDependencies]))
            }
        }
    }

    fn self_and_deps_inputs(
        &self,
        project_name: &str,
        task: &Task,
        inputs: &SplitInputs,
        task_graph: &TaskGraph,
        external_deps_mapped: &hashbrown::HashMap<&String, Vec<&String>>,
        visited: &mut Box<hashbrown::HashSet<String>>,
    ) -> anyhow::Result<Vec<HashInstruction>> {
        let project_deps = &self.project_graph.dependencies[project_name]
            .iter()
            .collect::<Vec<_>>();
        let self_inputs = self.gather_self_inputs(project_name, &inputs.self_inputs);
        let deps_inputs = self.gather_dependency_inputs(
            task,
            &inputs.deps_inputs,
            task_graph,
            project_deps,
            external_deps_mapped,
            visited,
        )?;

        let deps_outputs =
            self.gather_dependency_outputs(task, task_graph, &inputs.deps_outputs)?;
        let projects = self.gather_project_inputs(&inputs.project_inputs)?;

        Ok(self_inputs
            .into_iter()
            .chain(deps_inputs)
            .chain(deps_outputs)
            .chain(projects)
            .collect())
    }

    fn setup_external_deps(&self) -> hashbrown::HashMap<&String, Vec<&String>> {
        self.project_graph
            .external_nodes
            .keys()
            .map(|external_node| {
                (
                    external_node,
                    utils::find_all_project_node_dependencies(
                        external_node,
                        &self.project_graph,
                        false,
                    ),
                )
            })
            .collect()
    }

    // todo(jcammisuli): parallelize this more. This function takes the longest time to run
    fn gather_dependency_inputs<'a>(
        &'a self,
        task: &Task,
        inputs: &[Input],
        task_graph: &TaskGraph,
        project_deps: &[&'a String],
        external_deps_mapped: &hashbrown::HashMap<&String, Vec<&'a String>>,
        visited: &mut Box<hashbrown::HashSet<String>>,
    ) -> anyhow::Result<Vec<HashInstruction>> {
        let mut deps_inputs: Vec<HashInstruction> = vec![];

        for input in inputs {
            for dep in project_deps {
                if visited.contains(*dep) {
                    continue;
                }
                visited.insert(dep.to_string());

                if self.project_graph.nodes.contains_key(*dep) {
                    let Some(dep_inputs) = get_inputs_for_dependency(
                        &self.project_graph.nodes[*dep],
                        &self.nx_json,
                        input,
                    )?
                    else {
                        continue;
                    };
                    deps_inputs.extend(self.self_and_deps_inputs(
                        dep,
                        task,
                        &dep_inputs,
                        task_graph,
                        external_deps_mapped,
                        visited,
                    )?);
                } else {
                    // todo(jcammisuli): add a check to skip this when the new task hasher is ready, and when `AllExternalDependencies` is used
                    if let Some(external_deps) = external_deps_mapped.get(dep) {
                        deps_inputs.push(HashInstruction::External(dep.to_string()));
                        deps_inputs.extend(
                            external_deps
                                .iter()
                                .map(|s| HashInstruction::External(s.to_string())),
                        );
                    }
                }
            }
        }

        Ok(deps_inputs)
    }

    fn gather_self_inputs(
        &self,
        project_name: &str,
        self_inputs: &[Input],
    ) -> Vec<HashInstruction> {
        let (project_file_sets, workspace_file_sets): (Vec<&str>, Vec<&str>) = self_inputs
            .iter()
            .filter_map(|input| match input {
                Input::FileSet(file_set) => Some(file_set),
                _ => None,
            })
            .partition(|file_set| {
                file_set.starts_with("{projectRoot}/") || file_set.starts_with("!{projectRoot}/")
            });

        let project_file_set_inputs = project_file_set_inputs(project_name, project_file_sets);
        let workspace_file_set_inputs = workspace_file_set_inputs(workspace_file_sets);
        let runtime_and_env_inputs = self_inputs.iter().filter_map(|i| match i {
            Input::Runtime(runtime) => Some(HashInstruction::Runtime(runtime.to_string())),
            Input::Environment(env) => Some(HashInstruction::Environment(env.to_string())),
            _ => None,
        });

        project_file_set_inputs
            .into_iter()
            .chain(workspace_file_set_inputs)
            .chain(runtime_and_env_inputs)
            .collect()
    }

    fn gather_dependency_outputs(
        &self,
        task: &Task,
        task_graph: &TaskGraph,
        deps_outputs: &[Input],
    ) -> anyhow::Result<Vec<HashInstruction>> {
        if deps_outputs.is_empty() {
            return Ok(vec![]);
        }

        let mut result: Vec<HashInstruction> = vec![];

        for dep in deps_outputs {
            let Input::DepsOutputs {
                dependent_tasks_output_files,
                transitive,
            } = dep
            else {
                continue;
            };
            result.extend(get_dep_output(
                task,
                task_graph,
                dependent_tasks_output_files,
                *transitive,
            )?);
        }

        Ok(result)
    }

    fn gather_project_inputs(
        &self,
        project_inputs: &[Input],
    ) -> anyhow::Result<Vec<HashInstruction>> {
        let mut result: Vec<HashInstruction> = vec![];
        for project in project_inputs {
            let Input::Projects { input, projects } = project else {
                continue;
            };
            let projects = find_matching_projects(projects, &self.project_graph)?;
            for project in projects {
                let named_inputs =
                    get_named_inputs(&self.nx_json, &self.project_graph.nodes[project]);
                let expanded_input = expand_single_project_inputs(
                    &vec![Input::Inputs {
                        input,
                        dependencies: false,
                    }],
                    &named_inputs,
                )?;
                result.extend(self.gather_self_inputs(project, &expanded_input))
            }
        }
        Ok(result)
    }
}

fn find_external_dependency_node_name<'a>(
    package_name: &str,
    project_graph: &'a ProjectGraph,
) -> Option<&'a String> {
    let npm_name = format!("npm:{}", &package_name);
    if let Some((key, _)) = project_graph.external_nodes.get_key_value(package_name) {
        Some(key)
    } else if let Some((key, _)) = project_graph.external_nodes.get_key_value(&npm_name) {
        Some(key)
    } else {
        for (node_name, node) in project_graph.external_nodes.iter() {
            if let Some(pkg_name) = &node.package_name {
                if pkg_name.as_str() == package_name {
                    return Some(node_name);
                }
            }
        }
        None
    }
}

fn project_file_set_inputs(project_name: &str, file_sets: Vec<&str>) -> Vec<HashInstruction> {
    vec![
        HashInstruction::ProjectFileSet(
            project_name.to_string(),
            file_sets.iter().map(|f| f.to_string()).collect(),
        ),
        HashInstruction::ProjectConfiguration(project_name.to_string()),
        HashInstruction::TsConfiguration(project_name.to_string()),
    ]
}

fn workspace_file_set_inputs(file_sets: Vec<&str>) -> Vec<HashInstruction> {
    file_sets
        .into_iter()
        .map(|s| HashInstruction::WorkspaceFileSet(s.to_string()))
        .collect()
}
