use std::fmt::Formatter;
use std::{collections::HashMap, fmt, ptr};

use napi::{
    bindgen_prelude::{ToNapiValue, check_status},
    sys,
};

#[napi(object)]
#[derive(Default, Clone, Debug, PartialEq, Eq)]
pub struct Task {
    pub id: String,
    pub target: TaskTarget,
    pub outputs: Vec<String>,
    pub project_root: Option<String>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub continuous: Option<bool>,
}

#[napi(object)]
#[derive(Default, Clone, Debug, PartialEq, Eq)]
pub struct TaskTarget {
    pub project: String,
    pub target: String,
    pub configuration: Option<String>,
}

#[napi(object)]
#[derive(Default, Clone, Debug, PartialEq, Eq)]
pub struct TaskResult {
    pub task: Task,
    pub status: String,
    pub code: i32,
    pub terminal_output: Option<String>,
}

#[napi(object)]
pub struct TaskGraph {
    pub roots: Vec<String>,
    pub tasks: HashMap<String, Task>,
    pub dependencies: HashMap<String, Vec<String>>,
    pub continuous_dependencies: HashMap<String, Vec<String>>,
}

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Clone)]
pub enum HashInstruction {
    WorkspaceFileSet(Vec<String>),
    Runtime(String, String), // (project_name, runtime)
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
                HashInstruction::WorkspaceFileSet(file_set) =>
                    format!("workspace:[{}]", file_set.join(",")),
                HashInstruction::Runtime(project_name, runtime) =>
                    format!("{}:runtime:{}", project_name, runtime),
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
