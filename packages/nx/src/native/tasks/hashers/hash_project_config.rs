use std::collections::HashMap;

use anyhow::*;
use itertools::Itertools;

use crate::native::hasher::hash;
use crate::native::project_graph::types::Project;
use crate::native::types::Input;

pub fn hash_project_config(
    project_name: &str,
    projects: &HashMap<String, Project>,
) -> Result<String> {
    let project = projects
        .get(project_name)
        .ok_or_else(|| anyhow!("Could not find project '{}'", project_name))?;
    let targets = project
        .targets
        .iter()
        .map(|(k, v)| (k, v))
        .sorted_by(|a, b| a.0.cmp(b.0))
        .map(|(k, v)| {
            format!(
                "{}{}{}{}{}{}",
                k,
                v.executor.as_deref().unwrap_or_default(),
                v.outputs.as_deref().unwrap_or_default().concat(),
                v.options.as_deref().unwrap_or_default(),
                v.configurations.as_deref().unwrap_or_default(),
                v.parallelism.unwrap_or_default()
            )
        })
        .collect::<Vec<_>>()
        .concat();

    let tags = project.tags.as_deref().unwrap_or_default().concat();
    let inputs = project
        .named_inputs
        .as_ref()
        .map(|inputs| {
            inputs
                .iter()
                .map(|(k, v)| (k, v))
                .sorted_by(|a, b| a.0.cmp(b.0))
                .map(|(_, v)| {
                    v.iter()
                        .map(Input::from)
                        .map(|i| format!("{:?}", i))
                        .collect::<Vec<_>>()
                        .concat()
                })
                .collect::<Vec<_>>()
                .concat()
        })
        .unwrap_or_default();

    Ok(hash(
        &[
            project.root.as_bytes(),
            tags.as_bytes(),
            targets.as_bytes(),
            inputs.as_bytes(),
        ]
        .concat(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native::project_graph::types::Target;
    use std::collections::HashMap;

    #[test]
    fn test_hash_project_config_with_data() {
        let projects = HashMap::from([
            (
                "nx".into(),
                Project {
                    root: "".into(),
                    named_inputs: None,
                    tags: None,
                    targets: Default::default(),
                },
            ),
            (
                "js".into(),
                Project {
                    root: "libs/js".into(),
                    named_inputs: None,
                    tags: Some(vec!["type:lib".into(), "scope:js".into()]),
                    targets: HashMap::from([
                        (
                            "build".into(),
                            Target {
                                executor: Some("@nx/node:build".into()),
                                options: Some("{}".into()),
                                configurations: Some("{\"production\":{}}".into()),
                                ..Default::default()
                            },
                        ),
                        (
                            "test".into(),
                            Target {
                                executor: Some("@nx/node:test".into()),
                                options: Some("{}".into()),
                                configurations: Some("{\"production\":{}}".into()),
                                ..Default::default()
                            },
                        ),
                    ]),
                },
            ),
            (
                "js-unsorted".into(),
                Project {
                    root: "libs/js".into(),
                    named_inputs: None,
                    tags: Some(vec!["type:lib".into(), "scope:js".into()]),
                    targets: HashMap::from([
                        (
                            "test".into(),
                            Target {
                                executor: Some("@nx/node:test".into()),
                                options: Some("{}".into()),
                                configurations: Some("{\"production\":{}}".into()),
                                ..Default::default()
                            },
                        ),
                        (
                            "build".into(),
                            Target {
                                executor: Some("@nx/node:build".into()),
                                options: Some("{}".into()),
                                configurations: Some("{\"production\":{}}".into()),
                                ..Default::default()
                            },
                        ),
                    ]),
                },
            ),
        ]);

        let nx_project_hash = hash_project_config("nx", &projects);
        assert_eq!(nx_project_hash.unwrap(), "3244421341483603138");

        let js_project_hash = hash_project_config("js", &projects).unwrap();
        assert_eq!(js_project_hash, "13565578942842640362");

        let js_unsorted = hash_project_config("js-unsorted", &projects);
        assert_eq!(js_unsorted.unwrap(), js_project_hash);
    }

    #[test]
    fn test_hash_project_config_with_no_project() {
        let projects = HashMap::<String, Project>::new();

        let result = hash_project_config("nx", &projects);

        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err().to_string(),
            "Could not find project 'nx'"
        );
    }
}
