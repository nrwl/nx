use crate::native::tasks::types::HashInstruction;
use crate::native::{
    project_graph::types::ProjectGraph,
    tasks::types::{Task, TaskGraph},
};

pub(super) fn get_dep_output(
    workspace_root: &str,
    task: &Task,
    task_graph: &TaskGraph,
    project_graph: &ProjectGraph,
    dependent_tasks_output_files: &str,
    transitive: bool,
) -> anyhow::Result<Vec<HashInstruction>> {
    if !task_graph.dependencies.contains_key(task.id.as_str()) {
        return Ok(vec![]);
    }

    let mut inputs: Vec<HashInstruction> = vec![];
    for task_dep in &task_graph.dependencies[task.id.as_str()] {
        let child_task = &task_graph.tasks[task_dep.as_str()];

        if !child_task.outputs.is_empty() {
            inputs.push(HashInstruction::TaskOutput(
                dependent_tasks_output_files.to_string(),
                child_task.outputs.clone(),
            ));
        }

        if transitive {
            inputs.extend(get_dep_output(
                workspace_root,
                child_task,
                task_graph,
                project_graph,
                dependent_tasks_output_files,
                transitive,
            )?);
        }
    }

    Ok(inputs)
}
