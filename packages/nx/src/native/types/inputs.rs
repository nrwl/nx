use napi::Either;
use napi::bindgen_prelude::Either9;

#[napi(object)]
pub struct InputsInput {
    pub input: String,
    pub dependencies: Option<bool>,
    pub projects: Option<Either<String, Vec<String>>>,
}

#[napi(object)]
pub struct FileSetInput {
    pub fileset: String,
    pub dependencies: Option<bool>,
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

#[napi(object)]
pub struct JsonInput {
    pub json: String,
    pub fields: Option<Vec<String>>,
    pub exclude_fields: Option<Vec<String>>,
}

pub(crate) type JsInputs = Either9<
    InputsInput,
    String,
    FileSetInput,
    RuntimeInput,
    EnvironmentInput,
    ExternalDependenciesInput,
    DepsOutputsInput,
    WorkingDirectoryInput,
    JsonInput,
>;

impl<'a> From<&'a JsInputs> for Input<'a> {
    fn from(value: &'a JsInputs) -> Self {
        match value {
            Either9::A(inputs) => {
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
            Either9::B(string) => {
                if let Some(rest) = string.strip_prefix('^') {
                    // Check if this is a dependency fileset (starts with {projectRoot} or {workspaceRoot})
                    if rest.starts_with("{projectRoot}") || rest.starts_with("{workspaceRoot}") {
                        Input::FileSet {
                            fileset: rest,
                            dependencies: true,
                        }
                    } else {
                        // This is a named input reference (existing behavior)
                        Input::Inputs {
                            input: rest,
                            dependencies: true,
                        }
                    }
                } else {
                    Input::String(string)
                }
            }
            Either9::C(file_set) => Input::FileSet {
                fileset: &file_set.fileset,
                dependencies: file_set.dependencies.unwrap_or(false),
            },
            Either9::D(runtime) => Input::Runtime(&runtime.runtime),
            Either9::E(environment) => Input::Environment(&environment.env),
            Either9::F(external_dependencies) => {
                Input::ExternalDependency(&external_dependencies.external_dependencies)
            }
            Either9::G(deps_outputs) => Input::DepsOutputs {
                transitive: deps_outputs.transitive.unwrap_or(false),
                dependent_tasks_output_files: &deps_outputs.dependent_tasks_output_files,
            },
            Either9::H(working_directory) => {
                Input::WorkingDirectory(&working_directory.working_directory)
            }
            Either9::I(json_input) => Input::Json {
                json: &json_input.json,
                fields: json_input.fields.as_deref(),
                exclude_fields: json_input.exclude_fields.as_deref(),
            },
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
    FileSet {
        fileset: &'a str,
        dependencies: bool,
    },
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
    Json {
        json: &'a str,
        fields: Option<&'a [String]>,
        exclude_fields: Option<&'a [String]>,
    },
}
