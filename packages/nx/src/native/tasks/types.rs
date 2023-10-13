use std::{collections::HashMap, ptr};

use napi::{
    bindgen_prelude::{check_status, ToNapiValue},
    sys,
};

#[napi(object)]
#[derive(Default, Clone)]
pub struct Task {
    pub id: String,
    pub target: TaskTarget,
    pub outputs: Vec<String>,
    pub project_root: Option<String>,
}

#[napi(object)]
#[derive(Default, Clone)]
pub struct TaskTarget {
    pub project: String,
    pub target: String,
    pub configuration: Option<String>,
}

#[napi(object)]
pub struct TaskGraph {
    pub roots: Vec<String>,
    pub tasks: HashMap<String, Task>,
    pub dependencies: HashMap<String, Vec<String>>,
}

#[derive(PartialEq, Eq, PartialOrd, Ord)]
pub enum HashInstruction {
    WorkspaceFileSet(String),
    Runtime(String),
    Environment(String),
    ProjectFileSet(String, String),
    ProjectConfiguration(String),
    TsConfiguration(String),
    TaskOutput(String, Vec<String>),
    External(String),
    AllExternalDependencies,
}

impl ToNapiValue for HashInstruction {
    unsafe fn to_napi_value(
        env: napi::sys::napi_env,
        val: Self,
    ) -> napi::Result<napi::sys::napi_value> {
        let mut ptr = ptr::null_mut();

        let val: String = val.into();

        check_status!(
            unsafe {
                sys::napi_create_string_utf8(env, val.as_ptr() as *const _, val.len(), &mut ptr)
            },
            "Failed to convert rust `String` into napi `string`"
        )?;

        Ok(ptr)
    }
}

impl From<HashInstruction> for String {
    fn from(instruction: HashInstruction) -> Self {
        match instruction {
            HashInstruction::AllExternalDependencies => "AllExternalDependencies".to_string(),
            HashInstruction::ProjectFileSet(project_name, file_set) => {
                format!("{project_name}:{file_set}")
            }
            HashInstruction::WorkspaceFileSet(file_set) => file_set,
            HashInstruction::Runtime(runtime) => format!("runtime:{}", runtime),
            HashInstruction::Environment(env) => format!("env:{}", env),
            HashInstruction::TaskOutput(task_output, dep_outputs) => {
                let dep_outputs = dep_outputs.join(",");
                format!("{task_output}:{dep_outputs}")
            },
            HashInstruction::External(external) => external,
            HashInstruction::ProjectConfiguration(project_name) => {
                format!("{project_name}:ProjectConfiguration")
            }
            HashInstruction::TsConfiguration(project_name) => {
                format!("{project_name}:TsConfig")
            }
        }
    }
}
