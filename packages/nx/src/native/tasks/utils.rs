use crate::native::project_graph::types::ProjectGraph;
use hashbrown::HashSet;
use once_cell::sync::Lazy;
use regex::Regex;
use serde::Serialize;
use serde_json::Value;

pub(super) fn find_all_project_node_dependencies<'a>(
    parent_node_name: &str,
    project_graph: &'a ProjectGraph,
    exclude_external_dependencies: bool,
) -> Vec<&'a str> {
    let mut dependent_node_names = HashSet::new();
    collect_dependent_project_node_names(
        project_graph,
        parent_node_name,
        &mut dependent_node_names,
        exclude_external_dependencies,
    );
    dependent_node_names.into_iter().collect()
}

fn collect_dependent_project_node_names<'a>(
    project_graph: &'a ProjectGraph,
    parent_node_name: &str,
    dependent_node_names: &mut HashSet<&'a str>,
    exclude_external_dependencies: bool,
) {
    let Some( dependencies ) = project_graph.dependencies.get(parent_node_name) else {
        return;
    };

    for dependency in dependencies {
        let dep = dependency.as_str();
        // skip dependencies already added (avoid circular dependencies)
        if dependent_node_names.contains(dep) {
            continue;
        }

        if exclude_external_dependencies && project_graph.external_nodes.contains_key(dep) {
            continue;
        }

        dependent_node_names.insert(dep);
        collect_dependent_project_node_names(
            project_graph,
            dependency.as_str(),
            dependent_node_names,
            exclude_external_dependencies,
        );
    }
}

pub fn interpolate_outputs(template: &str, data: &InterpolateOptions) -> anyhow::Result<String> {
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

static VALIDATE_INTERPOLATE_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^\{([\s\S]+)}").unwrap());
static INTERPOLATE_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"\{([\s\S]+)}").unwrap());

pub fn validate_outputs(options: &Vec<String>) -> anyhow::Result<()> {
    let invalid_outputs: Vec<String> = options
        .iter()
        .map(|o| o.to_string())
        .filter(|o| !VALIDATE_INTERPOLATE_REGEX.is_match(o))
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
pub struct InterpolateOptions<'a> {
    pub project_root: &'a str,
    pub project_name: &'a str,
    pub options: &'a Value,
}
