use crate::native::project_graph::types::{ExternalNode, Project, ProjectGraph, Target};
use crate::native::tasks::errors::{InternalTaskErrors, TaskErrors};
use crate::native::tasks::types::{Task, TaskGraph};
use crate::native::types::{Input, NxJson};
use rayon::prelude::*;
use std::collections::HashMap;

use crate::native::tasks::inputs::get_inputs;
use crate::native::tasks::utils;

#[napi]
pub struct HashPlanner {
    nx_json: NxJson,
    project_graph: ProjectGraph,
    task_graph: TaskGraph,
}

#[napi]
impl HashPlanner {
    #[napi(constructor)]
    pub fn new(nx_json: NxJson, project_graph: ProjectGraph, task_graph: TaskGraph) -> Self {
        Self {
            nx_json,
            project_graph,
            task_graph,
        }
    }

    #[napi]
    pub fn get_plans(&self, task_ids: Vec<&str>) -> anyhow::Result<()> {
        let external_deps_mapped = self.setup_external_deps();

        task_ids
            .par_iter()
            .map(|id| {
                let task = &self.task_graph.tasks[*id];
                let inputs = get_inputs(task, &self.project_graph, &self.nx_json)?;

                let target = self.target_input(
                    &task.target.project,
                    &task.target.target,
                    &inputs.self_inputs,
                    &external_deps_mapped,
                )?;

                // dbg!(&target);
                Ok(())
            })
            .collect()
    }

    fn target_input<'a>(
        &'a self,
        project_name: &str,
        target_name: &str,
        self_inputs: &'a [Input],
        external_deps_map: &HashMap<&str, Vec<&'a str>>,
    ) -> anyhow::Result<Option<Vec<&'a str>>> {
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
            Ok(Some(vec![existing_package]))
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
                Ok(Some(external_deps))
            } else {
                Ok(Some(vec!["AllExternalDependencies"]))
            }
        }
    }

    fn setup_external_deps(&self) -> HashMap<&str, Vec<&str>> {
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
}

fn find_external_dependency_node_name<'a>(
    package_name: &str,
    external_nodes: &[&'a str],
) -> Option<&'a str> {
    external_nodes.iter().find(|n| **n == package_name).copied()
}
