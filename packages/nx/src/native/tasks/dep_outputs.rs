use crate::native::tasks::types::HashInstruction;
use crate::native::tasks::types::{Task, TaskGraph};

pub(super) fn get_dep_output(
    task: &Task,
    task_graph: &TaskGraph,
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
                child_task,
                task_graph,
                dependent_tasks_output_files,
                transitive,
            )?);
        }
    }

    Ok(inputs)
}
