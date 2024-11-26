use crate::native::project_graph::types::{Project, ProjectGraph};
use crate::native::tasks::types::Task;
use crate::native::types::{Input, NxJson};
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
    let Input::Inputs { input, .. } = named_input else {
        return Ok(None);
    };

    let inputs = get_named_inputs(nx_json, project);
    let (self_inputs, deps_outputs): (Vec<Input>, Vec<Input>) = expand_named_input(input, &inputs)?
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

fn split_inputs_into_self_and_deps<'a>(
    inputs: Option<Vec<Input<'a>>>,
    named_inputs: HashMap<&str, Vec<Input<'a>>>,
) -> anyhow::Result<SplitInputs<'a>> {
    let inputs = inputs.unwrap_or_else(|| {
        vec![
            Input::FileSet("{projectRoot}/**/*"),
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
                Input::Inputs {
                    dependencies: false,
                    ..
                }
                | Input::String(_)
                | Input::FileSet(_)
                | Input::Runtime(_)
                | Input::Environment(_)
                | Input::DepsOutputs { .. }
                | Input::ExternalDependency(_) => {
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
    named_inputs: &HashMap<&str, Vec<Input<'a>>>,
) -> anyhow::Result<Vec<Input<'a>>> {
    let mut expanded = vec![];

    for i in inputs {
        match i {
            Input::String(s) => {
                if s.starts_with('^') {
                    anyhow::bail!("namedInputs definitions cannot start with ^");
                }

                if named_inputs.get(s).is_some() {
                    expanded.extend(expand_named_input(s, named_inputs)?);
                } else {
                    validate_file_set(s)?;
                    expanded.push(Input::FileSet(s));
                }
            }
            Input::Inputs {
                input,
                dependencies: false,
            } => expanded.extend(expand_named_input(input, named_inputs)?),
            Input::FileSet(fileset) => {
                validate_file_set(fileset)?;
                expanded.push(Input::FileSet(fileset));
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
            Input::Projects { .. }
            | Input::Inputs {
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
    named_inputs: &HashMap<&str, Vec<Input<'a>>>,
) -> anyhow::Result<Vec<Input<'a>>> {
    if named_inputs.get(input).is_none() {
        anyhow::bail!("Input '{}' is not defined", input)
    } else {
        expand_single_project_inputs(&named_inputs[input], named_inputs)
    }
}

pub(super) fn get_named_inputs<'a>(
    nx_json: &'a NxJson,
    project: &'a Project,
) -> HashMap<&'a str, Vec<Input<'a>>> {
    let mut collected_named_inputs: HashMap<&str, Vec<Input>> = HashMap::new();

    collected_named_inputs.insert("default", vec![Input::FileSet("{projectRoot}/**/*")]);

    let iterable_structs = [&nx_json.named_inputs, &project.named_inputs];
    for named_inputs in iterable_structs.into_iter().flatten() {
        for (key, val) in named_inputs.iter() {
            collected_named_inputs.insert(key.as_ref(), val.iter().map(|v| v.into()).collect());
        }
    }

    collected_named_inputs
}
