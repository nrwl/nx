use crate::native::utils::glob::build_glob_set;
use crate::native::{cache::expand_outputs::get_files_for_outputs, tasks::types::HashInstruction};
use crate::native::{
    project_graph::types::ProjectGraph,
    tasks::types::{Task, TaskGraph},
};
use tracing::trace;

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

        let now = std::time::Instant::now();
        let outputs = child_task.outputs.clone();
        let output_files = get_files_for_outputs(workspace_root.to_string(), outputs)?;
        trace!(
            "get_outputs_for_target_and_configuration took {:?}",
            now.elapsed()
        );
        let glob = build_glob_set(&[dependent_tasks_output_files])?;
        inputs.extend(
            output_files
                .into_iter()
                .filter(|f| f == dependent_tasks_output_files || glob.is_match(f))
                .map(|f| HashInstruction::TaskOutput(f))
                .collect::<Vec<_>>(),
        );

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
