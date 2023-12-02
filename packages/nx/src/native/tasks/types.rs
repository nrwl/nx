use std::fmt::Formatter;
use std::{collections::HashMap, fmt, ptr};

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

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum HashInstruction {
    WorkspaceFileSet(String),
    Runtime(String),
    Environment(String),
    ProjectFileSet(String, Vec<String>),
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

        let val = val.to_string();

        check_status!(
            unsafe {
                sys::napi_create_string_utf8(env, val.as_ptr() as *const _, val.len(), &mut ptr)
            },
            "Failed to convert rust `String` into napi `string`"
        )?;

        Ok(ptr)
    }
}

impl fmt::Display for HashInstruction {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}",
            match self {
                HashInstruction::AllExternalDependencies => "AllExternalDependencies".to_string(),
                HashInstruction::ProjectFileSet(project_name, file_set) => {
                    format!("{project_name}:{}", file_set.join(","))
                }
                HashInstruction::WorkspaceFileSet(file_set) => file_set.to_string(),
                HashInstruction::Runtime(runtime) => format!("runtime:{}", runtime),
                HashInstruction::Environment(env) => format!("env:{}", env),
                HashInstruction::TaskOutput(task_output, dep_outputs) => {
                    let dep_outputs = dep_outputs.join(",");
                    format!("{task_output}:{dep_outputs}")
                }
                HashInstruction::External(external) => external.to_string(),
                HashInstruction::ProjectConfiguration(project_name) => {
                    format!("{project_name}:ProjectConfiguration")
                }
                HashInstruction::TsConfiguration(project_name) => {
                    format!("{project_name}:TsConfig")
                }
            }
        )
    }
}
