use std::sync::Arc;

use napi::bindgen_prelude::Either8;
use napi::Either;

#[napi(object)]
pub struct InputsInput {
    pub input: String,
    pub dependencies: Option<bool>,
}

#[napi(object)]
pub struct FileSetInput {
    pub fileset: String,
}

#[napi(object)]
pub struct RuntimeInput {
    pub runtime: String,
}

#[napi(object)]
pub struct EnvironmentInput {
    pub env: String,
}

#[napi(object)]
pub struct ExternalDependenciesInput {
    pub external_dependencies: Vec<String>,
}

#[napi(object)]
pub struct DepsOutputsInput {
    pub dependent_tasks_output_files: String,
    pub transitive: Option<bool>,
}

#[napi(object)]
pub struct ProjectsInput {
    pub projects: Either<String, Vec<String>>,
}

pub(crate) type JsInputs = Either8<
    InputsInput,
    String,
    FileSetInput,
    RuntimeInput,
    EnvironmentInput,
    ExternalDependenciesInput,
    DepsOutputsInput,
    ProjectsInput,
>;

impl<'a> From<&'a JsInputs> for Input<'a> {
    fn from(value: &'a JsInputs) -> Self {
        match value {
            Either8::A(inputs) => Input::Inputs {
                dependencies: inputs.dependencies.unwrap_or(false),
                input: &inputs.input,
            },
            Either8::B(string) => {
                if string.starts_with("^") {
                    Input::Inputs {
                        input: &string[1..],
                        dependencies: true,
                    }
                } else {
                    Input::String(string)
                }
            }
            Either8::C(file_set) => Input::FileSet(&file_set.fileset),
            Either8::D(runtime) => Input::Runtime(&runtime.runtime),
            Either8::E(environment) => Input::Environment(&environment.env),
            Either8::F(external_dependencies) => {
                Input::ExternalDependency(&external_dependencies.external_dependencies)
            }
            Either8::G(deps_outputs) => Input::DepsOutputs {
                transitive: deps_outputs.transitive.unwrap_or(false),
                dependent_tasks_output_files: &deps_outputs.dependent_tasks_output_files,
            },
            Either8::H(projects) => Input::Projects(match &projects.projects {
                Either::A(string) => vec![string.as_ref()],
                Either::B(vec) => vec.iter().map(|v| v.as_ref()).collect(),
            }),
        }
    }
}

#[derive(Debug)]
pub(crate) enum Input<'a> {
    Inputs {
        input: &'a str,
        dependencies: bool,
    },
    String(&'a str),
    FileSet(&'a str),
    Runtime(&'a str),
    Environment(&'a str),
    ExternalDependency(&'a [String]),
    DepsOutputs {
        dependent_tasks_output_files: &'a str,
        transitive: bool,
    },
    Projects(Vec<&'a str>),
}
