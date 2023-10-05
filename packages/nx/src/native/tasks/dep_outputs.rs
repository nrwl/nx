use crate::native::cache::expand_outputs::get_files_for_outputs;
use crate::native::utils::glob::build_glob_set;
use crate::native::{
    project_graph::types::{Project, ProjectGraph},
    tasks::types::{Task, TaskGraph},
};
use json_value_merge::Merge;
use once_cell::sync::Lazy;
use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;

pub(super) fn get_dep_output(
    workspace_root: &str,
    task: &Task,
    task_graph: &TaskGraph,
    project_graph: &ProjectGraph,
    dependent_tasks_output_files: &str,
    transitive: bool,
) -> anyhow::Result<Vec<String>> {
    if !task_graph.dependencies.contains_key(task.id.as_str()) {
        return Ok(vec![]);
    }

    let mut inputs: Vec<String> = vec![];
    for task_dep in &task_graph.dependencies[task.id.as_str()] {
        let child_task = &task_graph.tasks[task_dep.as_str()];

        let now = std::time::Instant::now();
        let outputs = get_outputs_for_target_and_configuration(
            child_task,
            &project_graph.nodes[&child_task.target.project],
        )?;
        let output_files = get_files_for_outputs(workspace_root.to_string(), outputs)?;
        println!(
            "get_outputs_for_target_and_configuration took {:?}",
            now.elapsed()
        );
        let glob = build_glob_set(&[dependent_tasks_output_files])?;
        inputs.extend(
            output_files
                .into_iter()
                .filter(|f| f == dependent_tasks_output_files || glob.is_match(f))
                .collect::<Vec<_>>(),
        );

        if (transitive) {
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

// todo(jcammisuli): migrate the tests for this function
fn get_outputs_for_target_and_configuration(
    task: &Task,
    node: &Project,
) -> anyhow::Result<Vec<String>> {
    let Some(target) = node.targets.get(&task.target.target) else {
        return Ok(vec![]);
    };

    let target_options: Value = target
        .options
        .as_ref()
        .and_then(|o| serde_json::from_str(o).ok())
        .unwrap_or_default();

    if let Some(target_outputs) = &target.outputs {
        validate_outputs(target_outputs)?;
        return target_outputs
            .iter()
            .map(|o| {
                interpolate_outputs(
                    o,
                    &InterpolateOptions {
                        project_root: &node.root,
                        project_name: &task.target.project,
                        options: &target_options,
                    },
                )
            })
            .collect();
    }

    let mut configurations: HashMap<String, Value> = target
        .configurations
        .as_ref()
        .and_then(|c| serde_json::from_str(c).ok())
        .unwrap_or_default();
    let configuration_options = task
        .target
        .configuration
        .as_ref()
        .and_then(|c| configurations.remove(c))
        .unwrap_or_default();
    let task_overrides: Value = serde_json::from_str(&task.overrides).unwrap_or_default();

    let mut combined_options = target_options;
    combined_options.merge(&configuration_options);
    combined_options.merge(&task_overrides);

    //keep backwards compatibility incase `outputs` doesn't exist
    if let Some(outputPath) = combined_options.get("outputPath") {
        if outputPath.is_array() {
            return Ok(outputPath
                .as_array()
                .unwrap()
                .iter()
                .map(|o| o.as_str().unwrap().to_string())
                .collect());
        } else if outputPath.is_string() {
            return Ok(vec![outputPath.as_str().unwrap().to_string()]);
        }
    }

    if task.target.target == "build" || task.target.target == "prepare" {
        return Ok(vec![
            format!("dist/{}", &node.root),
            format!("{}/dist", &node.root),
            format!("{}/build", &node.root),
            format!("{}/public", &node.root),
        ]);
    }

    Ok(vec![])
}

static INTERPOLATE_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"^\{([\s\S]+)}").unwrap());
fn validate_outputs(options: &Vec<String>) -> anyhow::Result<()> {
    let invalid_outputs: Vec<String> = options
        .iter()
        .map(|o| o.to_string())
        .filter(|o| !INTERPOLATE_REGEX.is_match(o))
        .collect();
    if !invalid_outputs.is_empty() {
        let invalid_outputs_str = invalid_outputs.join("\n - ");
        anyhow::bail!(
            "The following outputs are invalid:\n - {}",
            invalid_outputs_str
        );
    }

    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all(serialize = "camelCase"))]
struct InterpolateOptions<'a> {
    project_root: &'a str,
    project_name: &'a str,
    options: &'a Value,
}

fn interpolate_outputs(template: &str, data: &InterpolateOptions) -> anyhow::Result<String> {
    if template[1..].contains("{workspaceRoot}") {
        anyhow::bail!(
            "Output {template} is invalid. {} can only be used at the beginning of the expression.",
            "{workspaceRoot}"
        );
    }

    if data.project_root == "." && template[1..].contains("{projectRoot}") {
        anyhow::bail!(
            "Output {template} is invalid. When {} is '.', it can only be used at the beginning of the expression.",
            "{projectRoot}"
        );
    }

    let mut res = template.replace("{workspaceRoot}/", "");
    if data.project_root == "." {
        res = res.replace("{projectRoot}/", "");
    }

    let value = serde_json::to_value(data)?;
    Ok(INTERPOLATE_REGEX
        .replace(&res, |caps: &regex::Captures| {
            let path = caps
                .get(1)
                .unwrap()
                .as_str()
                .trim()
                .split('.')
                .collect::<Vec<_>>();
            let mut current_value = &value;

            // Traverse the path
            for key in path.iter() {
                current_value = match current_value.get(*key) {
                    Some(val) => val,
                    None => return caps.get(0).unwrap().as_str().to_string(), // If path does not exist
                };
            }

            if current_value.is_string() {
                return current_value.as_str().unwrap().to_string();
            } else {
                current_value.to_string()
            }
        })
        .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::project_graph::types::Target;
    use crate::native::tasks::types::TaskTarget;
    use std::time::{Duration, Instant};

    fn get_node(target: Target) -> Project {
        Project {
            root: "myapp".to_string(),
            named_inputs: None,
            targets: [("build".to_string(), target)].into(),
        }
    }

    #[test]
    fn should_interpolate_workspace_root_project_root_and_project_name() {
        let outputs = get_outputs_for_target_and_configuration(
            &Task {
                project_root: None,
                id: "".into(),
                target: TaskTarget {
                    project: "myapp".into(),
                    target: "build".into(),
                    configuration: Some("production".into()),
                },
                ..Default::default()
            },
            &get_node(Target {
                outputs: Some(vec![
                    "{workspaceRoot}/one".into(),
                    "{projectRoot}/two".into(),
                    "{projectName}/three".into(),
                ]),
                ..Default::default()
            }),
        )
        .unwrap();

        assert_eq!(outputs, vec!["one", "myapp/two", "myapp/three"]);
    }
}
