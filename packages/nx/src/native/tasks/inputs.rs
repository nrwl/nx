use crate::native::project_graph::types::{Project, ProjectGraph};
use crate::native::tasks::types::Task;
use crate::native::types::{Input, JsInputs, NxJson};
use std::collections::HashMap;

#[derive(Debug)]
pub(super) struct SplitInputs<'a> {
    pub deps_inputs: Vec<Input<'a>>,
    pub project_inputs: Vec<Input<'a>>,
    pub self_inputs: Vec<Input<'a>>,
    pub deps_outputs: Vec<Input<'a>>,
}

pub(super) fn get_inputs<'a>(
    task: &'a Task,
    project_graph: &'a ProjectGraph,
    nx_json: &'a NxJson,
) -> anyhow::Result<SplitInputs<'a>> {
    let project_node = project_graph
        .nodes
        .get(&task.target.project)
        .ok_or(anyhow::format_err!(
            "Project {} not found in the project graph",
            task.target.project
        ))?;

    let target_data = project_node
        .targets
        .get(&task.target.target)
        .ok_or(anyhow::format_err!(
            "Project \"{}\" does not have a target \"{}\"",
            task.target.project,
            task.target.target
        ))?;

    let named_inputs = get_named_inputs(nx_json, project_node);
    let inputs: Option<Vec<Input>> = target_data
        .inputs
        .as_ref()
        .map(|i| i.iter().map(|v| v.into()).collect());

    split_inputs_into_self_and_deps(inputs, named_inputs)
}

pub(super) fn get_inputs_for_dependency<'a>(
    project: &'a Project,
    nx_json: &'a NxJson,
    named_input: &'a Input,
) -> anyhow::Result<Option<SplitInputs<'a>>> {
    match named_input {
        Input::Inputs { input, .. } => {
            let inputs = get_named_inputs(nx_json, project);
            let (self_inputs, deps_outputs): (Vec<Input>, Vec<Input>) =
                expand_named_input(input, &inputs)?
                    .into_iter()
                    .partition(|i| !(matches!(i, Input::DepsOutputs { .. })));
            let deps_inputs = vec![Input::Inputs {
                input,
                dependencies: true,
            }];

            Ok(Some(SplitInputs {
                deps_outputs,
                deps_inputs,
                self_inputs,
                project_inputs: vec![],
            }))
        }
        Input::FileSet {
            fileset,
            dependencies: true,
        } => {
            // For dependency filesets, we apply the same fileset to the dependency
            // and continue recursively with the same pattern
            let self_inputs = vec![Input::FileSet {
                fileset,
                dependencies: false,
            }];
            let deps_inputs = vec![Input::FileSet {
                fileset,
                dependencies: true,
            }];

            Ok(Some(SplitInputs {
                deps_outputs: vec![],
                deps_inputs,
                self_inputs,
                project_inputs: vec![],
            }))
        }
        _ => Ok(None),
    }
}

fn split_inputs_into_self_and_deps<'a>(
    inputs: Option<Vec<Input<'a>>>,
    named_inputs: NamedInputs<'a>,
) -> anyhow::Result<SplitInputs<'a>> {
    let inputs = inputs.unwrap_or_else(|| {
        vec![
            Input::FileSet {
                fileset: "{projectRoot}/**/*",
                dependencies: false,
            },
            Input::Inputs {
                input: "default",
                dependencies: true,
            },
        ]
    });

    let (deps_inputs, self_inputs, project_inputs) = inputs.into_iter().fold(
        (
            // deps_inputs
            Vec::new(),
            // self_inputs,
            Vec::new(),
            // project_inputs
            Vec::new(),
        ),
        |mut acc, input| {
            match input {
                Input::Inputs {
                    dependencies: true, ..
                } => acc.0.push(input),
                Input::FileSet {
                    dependencies: true, ..
                } => acc.0.push(input),
                Input::Inputs {
                    dependencies: false,
                    ..
                }
                | Input::String(_)
                | Input::FileSet {
                    dependencies: false,
                    ..
                }
                | Input::Runtime(_)
                | Input::Environment(_)
                | Input::DepsOutputs { .. }
                | Input::ExternalDependency(_)
                | Input::WorkingDirectory(_)
                | Input::Json { .. } => {
                    acc.1.push(input);
                }
                Input::Projects { .. } => {
                    acc.2.push(input);
                }
            }

            acc
        },
    );

    let expanded_inputs = expand_single_project_inputs(&self_inputs, &named_inputs)?;

    let (self_inputs, deps_outputs): (Vec<_>, Vec<_>) = expanded_inputs
        .into_iter()
        .partition(|i| !(matches!(i, Input::DepsOutputs { .. })));

    Ok(SplitInputs {
        deps_inputs,
        project_inputs,
        self_inputs,
        deps_outputs,
    })
}

pub(super) fn expand_single_project_inputs<'a>(
    inputs: &Vec<Input<'a>>,
    named_inputs: &NamedInputs<'a>,
) -> anyhow::Result<Vec<Input<'a>>> {
    let mut expanded = vec![];

    for i in inputs {
        match i {
            Input::String(s) => {
                if s.starts_with('^') {
                    anyhow::bail!("namedInputs definitions cannot start with ^");
                }

                if named_inputs.contains(s) {
                    expanded.extend(expand_named_input(s, named_inputs)?);
                } else {
                    validate_file_set(s)?;
                    expanded.push(Input::FileSet {
                        fileset: s,
                        dependencies: false,
                    });
                }
            }
            Input::Inputs {
                input,
                dependencies: false,
            } => expanded.extend(expand_named_input(input, named_inputs)?),
            Input::FileSet {
                fileset,
                dependencies: false,
            } => {
                validate_file_set(fileset)?;
                expanded.push(Input::FileSet {
                    fileset,
                    dependencies: false,
                });
            }
            Input::Runtime(runtime) => expanded.push(Input::Runtime(runtime)),
            Input::Environment(env) => expanded.push(Input::Environment(env)),
            Input::ExternalDependency(external) => {
                expanded.push(Input::ExternalDependency(external))
            }
            Input::DepsOutputs {
                transitive,
                dependent_tasks_output_files,
            } => expanded.push(Input::DepsOutputs {
                transitive: *transitive,
                dependent_tasks_output_files,
            }),
            Input::WorkingDirectory(mode) => expanded.push(Input::WorkingDirectory(mode)),
            Input::Json {
                json,
                fields,
                exclude_fields,
            } => {
                validate_file_set(json)?;
                expanded.push(Input::Json {
                    json,
                    fields: *fields,
                    exclude_fields: *exclude_fields,
                });
            }
            Input::Projects { .. }
            | Input::Inputs {
                dependencies: true, ..
            }
            | Input::FileSet {
                dependencies: true, ..
            } => {
                anyhow::bail!(
                    "namedInputs definitions can only refer to other namedInputs definitions within the same project."
                );
            }
        }
    }

    Ok(expanded)
}

fn validate_file_set(s: &str) -> anyhow::Result<()> {
    if !s.starts_with("{projectRoot}")
        && !s.starts_with("!{projectRoot}")
        && !s.starts_with("{workspaceRoot}")
        && !s.starts_with("!{workspaceRoot}")
    {
        anyhow::bail!(
            r#""{file_set}" is an invalid fileset.
All filesets have to start with either {workspaceRoot} or {projectRoot}.
For instance: "!{projectRoot}/**/*.spec.ts" or "{workspaceRoot}/package.json".
If "{file_set}" is a named input, make sure it is defined in nx.json.
"#,
            file_set = s,
            projectRoot = "{projectRoot}",
            workspaceRoot = "{workspaceRoot}",
        );
    } else {
        Ok(())
    }
}

pub(super) fn expand_named_input<'a>(
    input: &str,
    named_inputs: &NamedInputs<'a>,
) -> anyhow::Result<Vec<Input<'a>>> {
    if let Some(inputs) = named_inputs.get(input) {
        let inputs = inputs.iter().map(Input::from).collect();
        expand_single_project_inputs(&inputs, named_inputs)
    } else if input == "default" {
        Ok(vec![Input::FileSet {
            fileset: "{projectRoot}/**/*",
            dependencies: false,
        }])
    } else {
        anyhow::bail!("Input '{}' is not defined", input)
    }
}

/// Look up only the requested definition, borrowing the immutable maps instead
/// of rebuilding and parsing every named input on each dependency visit.
/// An explicitly empty definition overrides both workspace and built-in values.
pub(super) struct NamedInputs<'a> {
    workspace: Option<&'a HashMap<String, Vec<JsInputs>>>,
    project: Option<&'a HashMap<String, Vec<JsInputs>>>,
}

impl<'a> NamedInputs<'a> {
    fn get(&self, name: &str) -> Option<&'a Vec<JsInputs>> {
        self.project
            .and_then(|inputs| inputs.get(name))
            .or_else(|| self.workspace.and_then(|inputs| inputs.get(name)))
    }

    fn contains(&self, name: &str) -> bool {
        name == "default" || self.get(name).is_some()
    }
}

pub(super) fn get_named_inputs<'a>(nx_json: &'a NxJson, project: &'a Project) -> NamedInputs<'a> {
    NamedInputs {
        workspace: nx_json.named_inputs.as_ref(),
        project: project.named_inputs.as_ref(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use napi::bindgen_prelude::Either9;

    fn strings(values: &[&str]) -> Vec<JsInputs> {
        values.iter().map(|v| Either9::B(v.to_string())).collect()
    }

    #[test]
    fn nested_definitions_use_project_overrides_and_keep_order() {
        let nx_json = NxJson {
            named_inputs: Some(HashMap::from([
                (
                    "default".into(),
                    strings(&["shared", "{workspaceRoot}/nx.json"]),
                ),
                ("shared".into(), strings(&["{projectRoot}/workspace.ts"])),
                ("unused".into(), strings(&["^invalid"])),
            ])),
        };
        let project = Project {
            named_inputs: Some(HashMap::from([(
                "shared".into(),
                strings(&["{projectRoot}/project.ts", "!{projectRoot}/spec.ts"]),
            )])),
            ..Default::default()
        };
        let inputs = expand_named_input("default", &get_named_inputs(&nx_json, &project)).unwrap();
        let files: Vec<_> = inputs
            .iter()
            .map(|input| match input {
                Input::FileSet {
                    fileset,
                    dependencies: false,
                } => *fileset,
                other => panic!("Unexpected input {other:?}"),
            })
            .collect();
        assert_eq!(
            files,
            [
                "{projectRoot}/project.ts",
                "!{projectRoot}/spec.ts",
                "{workspaceRoot}/nx.json"
            ]
        );
    }

    #[test]
    fn default_fallback_and_explicit_empty_overrides_are_distinct() {
        let mut nx_json = NxJson { named_inputs: None };
        let mut project = Project::default();
        assert!(matches!(
            expand_named_input("default", &get_named_inputs(&nx_json, &project))
                .unwrap()
                .as_slice(),
            [Input::FileSet {
                fileset: "{projectRoot}/**/*",
                dependencies: false
            }]
        ));
        nx_json.named_inputs = Some(HashMap::from([("default".into(), vec![])]));
        assert!(
            expand_named_input("default", &get_named_inputs(&nx_json, &project))
                .unwrap()
                .is_empty()
        );
        nx_json.named_inputs = Some(HashMap::from([(
            "default".into(),
            strings(&["{workspaceRoot}/file"]),
        )]));
        project.named_inputs = Some(HashMap::from([("default".into(), vec![])]));
        assert!(
            expand_named_input("default", &get_named_inputs(&nx_json, &project))
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn missing_and_invalid_definitions_keep_their_errors() {
        let nx_json = NxJson {
            named_inputs: Some(HashMap::from([
                ("dependency".into(), strings(&["^default"])),
                ("bad-file".into(), strings(&["src/file.ts"])),
            ])),
        };
        let project = Project::default();
        let named = get_named_inputs(&nx_json, &project);
        assert_eq!(
            expand_named_input("missing", &named)
                .unwrap_err()
                .to_string(),
            "Input 'missing' is not defined"
        );
        assert_eq!(
            expand_named_input("dependency", &named)
                .unwrap_err()
                .to_string(),
            "namedInputs definitions can only refer to other namedInputs definitions within the same project."
        );
        assert!(
            expand_named_input("bad-file", &named)
                .unwrap_err()
                .to_string()
                .starts_with("\"src/file.ts\" is an invalid fileset.")
        );
    }
}
