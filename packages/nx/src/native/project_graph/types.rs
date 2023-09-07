use napi::bindgen_prelude::Either8;
use napi::Either;
use std::collections::HashMap;

#[napi(object)]
pub struct ExternalNodeData {
    pub version: String,
    pub hash: String,
}

#[napi(object)]
pub struct ExternalNode {
    pub version: String,
    pub hash: String,
}

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

#[napi(object)]
pub struct Target {
    pub executor: String,
    pub inputs: Option<
        Vec<
            Either8<
                InputsInput,
                String,
                FileSetInput,
                RuntimeInput,
                EnvironmentInput,
                ExternalDependenciesInput,
                DepsOutputsInput,
                ProjectsInput,
            >,
        >,
    >,
    pub outputs: Option<Vec<String>>,
}

#[napi(object)]
pub struct Project {
    pub root: String,
    pub named_inputs: Option<
        HashMap<
            String,
            Vec<
                Either8<
                    InputsInput,
                    String,
                    FileSetInput,
                    RuntimeInput,
                    EnvironmentInput,
                    ExternalDependenciesInput,
                    DepsOutputsInput,
                    ProjectsInput,
                >,
            >,
        >,
    >,
    pub targets: HashMap<String, Target>,
}

#[napi(object)]
pub struct ProjectGraph {
    pub nodes: HashMap<String, Project>,
    pub dependencies: HashMap<String, Vec<String>>,
    pub external_nodes: HashMap<String, ExternalNode>,
}
