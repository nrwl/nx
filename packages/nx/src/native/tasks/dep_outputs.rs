use crate::native::tasks::utils;
use crate::native::tasks::utils::InterpolateOptions;
use crate::native::utils::glob::build_glob_set;
use crate::native::{cache::expand_outputs::get_files_for_outputs, tasks::types::HashInstruction};
use crate::native::{
    project_graph::types::{Project, ProjectGraph},
    tasks::types::{Task, TaskGraph},
};
use json_value_merge::Merge;
use once_cell::sync::Lazy;
use serde_json::Value;
use std::collections::HashMap;
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
        let outputs = get_outputs_for_target_and_configuration(
            child_task,
            &project_graph.nodes[&child_task.target.project],
        )?;
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

static OUTPUTS_REGEX: once_cell::sync::Lazy<regex::Regex> =
    Lazy::new(|| regex::Regex::new(r"\{(projectRoot|workspaceRoot|(options.*))}").unwrap());
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
    if !configuration_options.is_null() {
        combined_options.merge(&configuration_options);
    }
    if !task_overrides.is_null() {
        combined_options.merge(&task_overrides);
    }

    if let Some(target_outputs) = &target.outputs {
        utils::validate_outputs(target_outputs)?;
        return target_outputs
            .iter()
            .map(|o| {
                utils::interpolate_outputs(
                    o,
                    &InterpolateOptions {
                        project_root: &node.root,
                        project_name: &task.target.project,
                        options: &combined_options,
                    },
                )
            })
            .filter(|o| {
                o.as_ref()
                    .is_ok_and(|output| !OUTPUTS_REGEX.is_match(output))
            })
            .collect();
    }

    //keep backwards compatibility incase `outputs` doesn't exist
    if let Some(output_path) = combined_options.get("outputPath") {
        if output_path.is_array() {
            return Ok(output_path
                .as_array()
                .unwrap()
                .iter()
                .map(|o| o.as_str().unwrap().to_string())
                .collect());
        } else if output_path.is_string() {
            return Ok(vec![output_path.as_str().unwrap().to_string()]);
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

#[cfg(test)]
mod get_output_for_target_and_configuration_tests {
    use crate::native::project_graph::types::{Project, Target};
    use crate::native::tasks::dep_outputs::get_outputs_for_target_and_configuration;
    use crate::native::tasks::types::{Task, TaskTarget};
    use once_cell::sync::Lazy;

    fn get_node(target: Target) -> Project {
        Project {
            root: "myapp".to_string(),
            named_inputs: None,
            tags: None,
            targets: [("build".to_string(), target)].into(),
        }
    }

    static TASK: Lazy<Task> = Lazy::new(|| Task {
        project_root: None,
        id: "".into(),
        target: TaskTarget {
            project: "myapp".into(),
            target: "build".into(),
            configuration: Some("production".into()),
        },
        ..Default::default()
    });

    #[test]
    fn should_return_empty_arrays() {
        let outputs = get_outputs_for_target_and_configuration(
            &TASK,
            &get_node(Target {
                outputs: Some(vec![]),
                ..Default::default()
            }),
        )
        .unwrap();
        assert_eq!(outputs, Vec::new() as Vec<String>);
    }

    #[test]
    fn should_interpolate_workspace_root_project_root_and_project_name() {
        let outputs = get_outputs_for_target_and_configuration(
            &TASK,
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

    #[test]
    fn should_interpolate_project_root_when_it_is_not_at_the_beginning() {
        let outputs = get_outputs_for_target_and_configuration(
            &TASK,
            &get_node(Target {
                outputs: Some(vec!["{workspaceRoot}/dist/{projectRoot}".into()]),
                ..Default::default()
            }),
        )
        .unwrap();

        assert_eq!(outputs, vec!["dist/myapp"]);
    }

    #[test]
    fn should_throw_when_workspace_root_is_not_used_at_the_beginning() {
        let outputs = get_outputs_for_target_and_configuration(
            &TASK,
            &get_node(Target {
                outputs: Some(vec!["test/{workspaceRoot}/dist".into()]),
                ..Default::default()
            }),
        );

        assert!(outputs.is_err());
    }

    #[test]
    fn should_interpolate_project_root_equals_dot_by_removing_the_slash_after_it() {
        let outputs = get_outputs_for_target_and_configuration(
            &TASK,
            &Project {
                root: ".".to_string(),
                named_inputs: None,
                tags: None,
                targets: [(
                    "build".to_string(),
                    Target {
                        outputs: Some(vec!["{projectRoot}/dist".into()]),
                        ..Default::default()
                    },
                )]
                .into(),
            },
        )
        .unwrap();

        assert_eq!(outputs, vec!["dist"]);
    }

    #[test]
    fn should_interpolate_workspace_root_when_project_root_equals_dot_by_removing_the_slash_after_it(
    ) {
        let outputs = get_outputs_for_target_and_configuration(
            &TASK,
            &Project {
                root: ".".to_string(),
                named_inputs: None,
                tags: None,
                targets: [(
                    "build".to_string(),
                    Target {
                        outputs: Some(vec!["{workspaceRoot}/dist".into()]),
                        ..Default::default()
                    },
                )]
                .into(),
            },
        )
        .unwrap();

        assert_eq!(outputs, vec!["dist"]);
    }

    #[test]
    fn should_err_when_project_root_is_not_used_at_the_beginning_and_the_root_is_dot() {
        let outputs = get_outputs_for_target_and_configuration(
            &TASK,
            &Project {
                root: ".".to_string(),
                named_inputs: None,
                tags: None,
                targets: [(
                    "build".to_string(),
                    Target {
                        outputs: Some(vec!["test/{projectRoot}".into()]),
                        ..Default::default()
                    },
                )]
                .into(),
            },
        );

        assert!(outputs.is_err());
    }

    #[test]
    fn should_support_options() {
        let outputs = get_outputs_for_target_and_configuration(
            &TASK,
            &get_node(Target {
                outputs: Some(vec!["{options.nested.myVar}".into()]),
                options: Some(r#"{"nested": {"myVar": "value"}}"#.into()),
                ..Default::default()
            }),
        )
        .unwrap();

        assert_eq!(outputs, vec!["value"]);
    }

    #[test]
    fn should_support_non_existing_options() {
        let outputs = get_outputs_for_target_and_configuration(
            &TASK,
            &get_node(Target {
                outputs: Some(vec!["{options.outputFile}".into()]),
                options: Some(r#"{}"#.into()),
                ..Default::default()
            }),
        )
        .unwrap();

        assert_eq!(outputs, vec![] as Vec<String>);
    }

    #[test]
    fn should_support_interpolation_based_on_configuration_specific_options() {
        let outputs = get_outputs_for_target_and_configuration(
            &TASK,
            &get_node(Target {
                outputs: Some(vec!["{options.myVar}".into()]),
                options: Some(r#"{"myVar": "value"}"#.into()),
                configurations: Some(r#"{"production": { "myVar": "value/production" } }"#.into()),
                ..Default::default()
            }),
        )
        .unwrap();

        assert_eq!(outputs, vec!["value/production"]);
    }

    #[test]
    fn should_support_interpolation_outputs_from_overrides() {
        let mut task = TASK.clone();
        task.overrides = r#"{"myVar": "value/override"}"#.into();
        let outputs = get_outputs_for_target_and_configuration(
            &task,
            &get_node(Target {
                outputs: Some(vec!["{options.myVar}".into()]),
                options: Some(r#"{"myVar": "value"}"#.into()),
                configurations: Some(r#"{"production": { "myVar": "value/production" } }"#.into()),
                ..Default::default()
            }),
        )
        .unwrap();

        assert_eq!(outputs, vec!["value/override"]);
    }

    #[cfg(test)]
    mod missing_outputs_backwards_compatibility {

        #[test]
        fn should_return_the_output_path_option() {
            let outputs = super::get_outputs_for_target_and_configuration(
                &super::TASK,
                &super::get_node(super::Target {
                    options: Some(r#"{"outputPath": "dist"}"#.into()),
                    ..Default::default()
                }),
            )
            .unwrap();

            assert_eq!(outputs, vec!["dist"]);
        }

        #[test]
        fn should_handle_output_path_overrides() {
            let mut task = super::TASK.clone();
            task.overrides = r#"{"outputPath": "overrideOutputPath"}"#.into();
            let outputs = super::get_outputs_for_target_and_configuration(
                &task,
                &super::get_node(super::Target {
                    options: Some(r#"{"outputPath": "one"}"#.into()),
                    ..Default::default()
                }),
            )
            .unwrap();

            assert_eq!(outputs, vec!["overrideOutputPath"]);
        }

        #[test]
        fn should_return_configuration_specific_output_path_when_defined() {
            let outputs = super::get_outputs_for_target_and_configuration(
                &super::TASK,
                &super::get_node(super::Target {
                    options: Some(r#"{"outputPath": "value"}"#.into()),
                    configurations: Some(
                        r#"{"production":{"outputPath":"value/production"}}"#.into(),
                    ),
                    ..Default::default()
                }),
            )
            .unwrap();

            assert_eq!(outputs, vec!["value/production"]);
        }

        #[test]
        fn should_return_configuration_independent_output_path_when_defined() {
            let outputs = super::get_outputs_for_target_and_configuration(
                &super::TASK,
                &super::get_node(super::Target {
                    options: Some(r#"{"outputPath": "value"}"#.into()),
                    configurations: Some(r#"{"production":{}"#.into()),
                    ..Default::default()
                }),
            )
            .unwrap();

            assert_eq!(outputs, vec!["value"]);
        }

        #[test]
        fn should_return_default_output_paths_when_nothing_else_is_defined() {
            let outputs = super::get_outputs_for_target_and_configuration(
                &super::TASK,
                &super::get_node(super::Target {
                    ..Default::default()
                }),
            )
            .unwrap();

            assert_eq!(
                outputs,
                vec!["dist/myapp", "myapp/dist", "myapp/build", "myapp/public"]
            );
        }
    }
}
