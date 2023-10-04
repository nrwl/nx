use crate::native::{
    project_graph::types::{Project, ProjectGraph},
    tasks::types::{Task, TaskGraph},
};
use anyhow::anyhow;
use itertools::{merge, Itertools};
use json_value_merge::Merge;
use once_cell::sync::Lazy;
use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;

pub(super) fn get_dep_output(
    task: &Task,
    task_graph: &TaskGraph,
    project_graph: &ProjectGraph,
    dependent_tasks_output_files: &str,
    transitive: bool,
) -> Vec<String> {
    if !task_graph.dependencies.contains_key(task.id.as_str()) {
        return vec![];
    }

    let inputs: Vec<String> = vec![];
    for task_dep in &task_graph.dependencies[task.id.as_str()] {}

    todo!()
}

// todo(jcammisuli): write tests for this function
fn get_outputs_for_target_and_configuration(
    task: &Task,
    node: &Project,
) -> anyhow::Result<Vec<String>> {
    let Some(taget) = node.targets.get(&task.target.target) else {
        return Ok(vec![]);
    };

    let target_options: Value = taget
        .options
        .as_ref()
        .and_then(|o| serde_json::from_str(o).ok())
        .unwrap_or_default();
    let mut configurations: HashMap<String, Value> = taget
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

    let target_outputs = target_options.get("outputs");
    if target_outputs.is_some() {
        validate_outputs(target_outputs.expect("target outputs should always be something"))?;
        // Ok(vec![])
    }

    let mut combined_options = target_options.clone();
    combined_options.merge(&configuration_options);
    combined_options.merge(&task_overrides);

    Ok(vec![])
}

static INTERPOLATE_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"^\{([\s\S]+)}").unwrap());
fn validate_outputs(options: &Value) -> anyhow::Result<()> {
    if options.is_array() {
        let invalid_outputs: Vec<String> = options
            .as_array()
            .expect("options should always be an array")
            .iter()
            .filter_map(|o| if o.is_string() { o.as_str() } else { None })
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
    } else {
        anyhow::bail!("Outputs must be an array");
    }
}

#[derive(Serialize)]
struct InterpolateOptions<'a> {
    project_root: &'a str,
    project_name: &'a str,
    options: &'a Value,
}

fn interpolate_outputs(template: &str, data: &InterpolateOptions) -> anyhow::Result<String> {
    if !template.starts_with("{workspaceRoot}") {
        anyhow::bail!(
            "Output {template} is invalid. {} can only be used at the beginning of the expression.",
            "{workspaceRoot}"
        );
    }

    if data.project_root == "." && !template.starts_with("{projectRoot}") {
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

            current_value.to_string()
        })
        .to_string())
}
