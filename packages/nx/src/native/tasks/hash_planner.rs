use crate::native::project_graph::types::{ExternalNode, Project, ProjectGraph, Target};
use crate::native::tasks::errors::{InternalTaskErrors, TaskErrors};
use crate::native::tasks::types::{Task, TaskGraph};
use crate::native::types::{Input, NxJson};
use itertools::Itertools;
use rayon::prelude::*;
use std::collections::HashMap;
use std::convert::Infallible;
use std::ops::Deref;

use crate::native::tasks::inputs::get_inputs;

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
        task_ids
            .par_iter()
            .map(|id| {
                let task = &self.task_graph.tasks[*id];
                let inputs = get_inputs(task, &self.project_graph, &self.nx_json)?;

                let target = self.target_input(
                    &task.target.project,
                    &task.target.target,
                    &inputs.self_inputs,
                );

                Ok(())
            })
            .collect()
    }

    fn target_input(
        &self,
        project_name: &str,
        target_name: &str,
        self_inputs: &[Input],
    ) -> anyhow::Result<Option<Vec<&str>>> {
        let project = &self.project_graph.nodes[project_name];
        let Some(target) = project.targets.get(target_name) else {
            return Ok(None)
        };

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
        } else {
            todo!()
        }

        todo!()
    }
}

fn find_external_dependency_node_name<'a>(
    package_name: &'a str,
    external_nodes: &'a [&str],
) -> &'a str {
    external_nodes
        .iter()
        .find_position(|n| *n.deref() == package_name.deref())
        .map(|(i, _)| i)
        .map(|i| external_nodes[i])
        .unwrap_or(package_name)
}
