use crate::native::tasks::types::TaskGraph;
use crate::native::types::{Input, NxJson};
use crate::native::{
    project_graph::types::ProjectGraph,
    tasks::{inputs::SplitInputs, types::Task},
};
use rayon::prelude::*;
use std::collections::HashMap;

use crate::native::tasks::inputs::{get_inputs, get_inputs_for_dependency};
use crate::native::tasks::utils;

#[napi]
pub struct HashPlanner {
    nx_json: NxJson,
    project_graph: ProjectGraph,
    task_inputs: HashMap<&'static str, Vec<String>>,
}

#[napi]
impl HashPlanner {
    #[napi(constructor)]
    pub fn new(nx_json: NxJson, project_graph: ProjectGraph) -> Self {
        Self {
            nx_json,
            project_graph,
            task_inputs: HashMap::new(),
        }
    }

    #[napi]
    pub fn get_plans(
        &self,
        task_ids: Vec<&str>,
        task_graph: TaskGraph,
    ) -> anyhow::Result<HashMap<String, Vec<String>>> {
        let external_deps_mapped = self.setup_external_deps();
        task_ids
            .par_iter()
            .map(|id| {
                let task = &task_graph.tasks[*id];
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
                    hashbrown::HashSet::new(),
                )?;

                let inputs: Vec<String> = target
                    .unwrap_or(vec![])
                    .into_iter()
                    .chain(self_inputs.into_iter())
                    .collect();

                Ok((id.to_string(), inputs))
            })
            .collect()
    }

    fn target_input<'a>(
        &'a self,
        project_name: &str,
        target_name: &str,
        self_inputs: &[Input],
        external_deps_map: &hashbrown::HashMap<&str, Vec<&'a str>>,
    ) -> anyhow::Result<Option<Vec<String>>> {
        let project = &self.project_graph.nodes[project_name];
        let Some(target) = project.targets.get(target_name) else {
            return Ok(None)
        };

        let external_nodes_keys: Vec<&str> = self
            .project_graph
            .external_nodes
            .keys()
            .map(|s| s.as_str())
            .collect();

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
            let existing_package =
                find_external_dependency_node_name(executor_package, &external_nodes_keys)
                    .expect("Executor package should be in the external nodes");
            Ok(Some(vec![existing_package.to_string()]))
        } else {
            let mut external_deps: Vec<&str> = vec![];
            for input in self_inputs {
                match input {
                    Input::ExternalDependency(deps) => {
                        for dep in deps.iter() {
                            let external_node_name: Option<&str> =
                                find_external_dependency_node_name(dep, &external_nodes_keys);
                            let Some(external_node_name) = external_node_name else {
                                anyhow::bail!("The externalDependency '{dep}' for '{project_name}:{target_name}' could not be found")
                            };

                            external_deps.push(external_node_name);
                            external_deps.extend(&external_deps_map[external_node_name]);
                        }
                    }
                    _ => continue,
                }
            }
            if !external_deps.is_empty() {
                Ok(Some(external_deps.iter().map(|s| s.to_string()).collect()))
            } else {
                Ok(Some(vec!["AllExternalDependencies".to_string()]))
            }
        }
    }

    fn self_and_deps_inputs(
        &self,
        project_name: &str,
        task: &Task,
        inputs: &SplitInputs,
        task_graph: &TaskGraph,
        external_deps_mapped: &hashbrown::HashMap<&str, Vec<&str>>,
        visited: hashbrown::HashSet<&str>,
    ) -> anyhow::Result<Vec<String>> {
        if self.task_inputs.contains_key(task.id.as_str()) {
            return Ok(self.task_inputs[task.id.as_str()].clone());
        }

        let self_inputs = gather_self_inputs(project_name, &inputs.self_inputs);
        let deps_inputs = self.gather_dependency_inputs(
            task,
            &inputs.deps_inputs,
            task_graph,
            external_deps_mapped,
            visited,
        )?;

        Ok(self_inputs
            .into_iter()
            .chain(deps_inputs.into_iter())
            .collect())
    }

    fn setup_external_deps(&self) -> hashbrown::HashMap<&str, Vec<&str>> {
        self.project_graph
            .external_nodes
            .keys()
            .collect::<Vec<_>>()
            .par_iter()
            .map(|external_node| {
                (
                    external_node.as_str(),
                    utils::find_all_project_node_dependencies(
                        external_node,
                        &self.project_graph,
                        false,
                    ),
                )
            })
            .collect()
    }

    fn gather_dependency_inputs<'a>(
        &'a self,
        task: &Task,
        inputs: &[Input],
        task_graph: &TaskGraph,
        external_deps_mapped: &hashbrown::HashMap<&str, Vec<&'a str>>,
        mut visited: hashbrown::HashSet<&'a str>,
    ) -> anyhow::Result<Vec<String>> {
        let mut deps_inputs: Vec<String> = vec![];
        let project_deps = self.project_graph.dependencies.get(&task.target.project);
        if let Some(deps) = project_deps {
            for input in inputs {
                for dep in deps {
                    if visited.contains(dep.as_str()) {
                        continue;
                    }
                    visited.insert(dep.as_str());

                    if self.project_graph.nodes.contains_key(dep.as_str()) {
                        let Some(dep_inputs) = get_inputs_for_dependency(
                            &self.project_graph.nodes[&task.target.project],
                            &self.nx_json,
                            input,
                        )? else {
                            continue;
                        };
                        deps_inputs.extend(self.self_and_deps_inputs(
                            dep,
                            task,
                            &dep_inputs,
                            task_graph,
                            external_deps_mapped,
                            visited.clone(),
                        )?);
                    } else {
                        // todo(jcammisuli): add a check to skip this when the new task hasher is ready, and when `AllExternalDependencies` is used
                        if let Some(external_deps) = external_deps_mapped.get(dep.as_str()) {
                            deps_inputs.extend(external_deps.iter().map(|s| s.to_string()));
                        }
                    }
                }
            }
        }

        Ok(deps_inputs)
    }
}

fn find_external_dependency_node_name<'a>(
    package_name: &str,
    external_nodes: &[&'a str],
) -> Option<&'a str> {
    external_nodes
        .iter()
        .find(|n| **n == package_name || n.ends_with(package_name))
        .copied()
}

fn gather_self_inputs(project_name: &str, self_inputs: &[Input]) -> Vec<String> {
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
        Input::Runtime(runtime) => Some(format!("runtime:{runtime}")),
        Input::Environment(env) => Some(format!("env:{env}")),
        _ => None,
    });

    project_file_set_inputs
        .into_iter()
        .chain(workspace_file_set_inputs)
        .chain(runtime_and_env_inputs)
        .collect()
}

fn project_file_set_inputs(project_name: &str, file_sets: Vec<&str>) -> Vec<String> {
    // let file_set_patterns = file_sets.join(",");
    let project_input = format!("{}:{}", project_name, file_sets.join(","));
    vec![
        project_input,
        "ProjectConfiguration".to_owned(),
        "TsConfig".to_owned(),
    ]
}

fn workspace_file_set_inputs(mut file_sets: Vec<&str>) -> Vec<String> {
    file_sets.extend(vec![
        "{workspaceRoot}/nx.json",
        "{workspaceRoot}/.gitignore",
        "{workspaceRoot}/.nxignore",
    ]);

    file_sets.into_iter().map(|s| s.to_string()).collect()
}
