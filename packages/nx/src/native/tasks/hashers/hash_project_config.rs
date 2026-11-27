use std::collections::HashMap;

use anyhow::*;
use itertools::Itertools;

use crate::native::hasher::hash;
use crate::native::project_graph::types::Project;
use crate::native::types::Input;

/// The configuration a task's key holds of one project: its root, tags and
/// named inputs, and, for the task's own project, the task's own target. A
/// sibling target's configuration is not an input of the task, and a project
/// reached through `^` inputs contributes no target at all.
pub fn hash_project_config(
    project_name: &str,
    target: Option<&str>,
    projects: &HashMap<String, Project>,
) -> Result<String> {
    let project = projects
        .get(project_name)
        .ok_or_else(|| anyhow!("Could not find project '{}'", project_name))?;
    let targets = target
        .map(|name| {
            let v = project.targets.get(name).ok_or_else(|| {
                anyhow!(
                    "Could not find target '{}' of project '{}'",
                    name,
                    project_name
                )
            })?;
            Ok(format!(
                "{}{}{}{}{}{}",
                name,
                v.executor.as_deref().unwrap_or_default(),
                v.outputs.as_deref().unwrap_or_default().concat(),
                v.options.as_deref().unwrap_or_default(),
                v.configurations.as_deref().unwrap_or_default(),
                v.parallelism.unwrap_or_default()
            ))
        })
        .transpose()?
        .unwrap_or_default();

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
        let mut projects = HashMap::from([
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

        let nx_project_hash = hash_project_config("nx", None, &projects);
        assert_eq!(nx_project_hash.unwrap(), "3244421341483603138");

        let js_build_hash = hash_project_config("js", Some("build"), &projects).unwrap();
        assert_eq!(js_build_hash, "7021766974267464062");

        let js_unsorted = hash_project_config("js-unsorted", Some("build"), &projects);
        assert_eq!(js_unsorted.unwrap(), js_build_hash);

        // The task's own target keys it; a sibling target does not.
        let js_dependency_hash = hash_project_config("js", None, &projects).unwrap();
        let js_test_hash = hash_project_config("js", Some("test"), &projects).unwrap();
        assert_ne!(js_test_hash, js_build_hash);
        projects
            .get_mut("js")
            .unwrap()
            .targets
            .get_mut("test")
            .unwrap()
            .options = Some("{\"watch\":true}".into());
        assert_eq!(
            hash_project_config("js", Some("build"), &projects).unwrap(),
            js_build_hash
        );
        assert_ne!(
            hash_project_config("js", Some("test"), &projects).unwrap(),
            js_test_hash
        );

        // A project reached through `^` inputs keys no target.
        assert_eq!(
            hash_project_config("js", None, &projects).unwrap(),
            js_dependency_hash
        );
        assert!(hash_project_config("js", Some("lint"), &projects).is_err());
    }

    #[test]
    fn test_hash_project_config_with_no_project() {
        let projects = HashMap::<String, Project>::new();

        let result = hash_project_config("nx", None, &projects);

        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err().to_string(),
            "Could not find project 'nx'"
        );
    }
}
