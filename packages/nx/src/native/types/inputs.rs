use napi::Either;
use napi::bindgen_prelude::Either8;

#[napi(object)]
pub struct InputsInput {
    pub input: String,
    pub dependencies: Option<bool>,
    pub projects: Option<Either<String, Vec<String>>>,
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
pub struct WorkingDirectoryInput {
    pub working_directory: String,
}

pub(crate) type JsInputs = Either8<
    InputsInput,
    String,
    FileSetInput,
    RuntimeInput,
    EnvironmentInput,
    ExternalDependenciesInput,
    DepsOutputsInput,
    WorkingDirectoryInput,
>;

impl<'a> From<&'a JsInputs> for Input<'a> {
    fn from(value: &'a JsInputs) -> Self {
        match value {
            Either8::A(inputs) => {
                if let Some(projects) = &inputs.projects {
                    Input::Projects {
                        input: &inputs.input,
                        projects: match &projects {
                            Either::A(string) => vec![string.as_ref()],
                            Either::B(vec) => vec.iter().map(|v| v.as_ref()).collect(),
                        },
                    }
                } else {
                    Input::Inputs {
                        input: &inputs.input,
                        dependencies: inputs.dependencies.unwrap_or(false),
                    }
                }
            }
            Either8::B(string) => {
                if let Some(input) = string.strip_prefix('^') {
                    Input::Inputs {
                        input,
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
            Either8::H(working_directory) => {
                Input::WorkingDirectory(&working_directory.working_directory)
            }
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
    Projects {
        projects: Vec<&'a str>,
        input: &'a str,
    },
    WorkingDirectory(&'a str),
}
