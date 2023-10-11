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
    pub overrides: String,
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

#[derive(PartialEq, PartialOrd, Eq)]
pub enum HashInstruction {
    AllExternalDependencies,
    ProjectFileSet(String, String),
    WorkspaceFileSet(String),
    Runtime(String),
    Environment(String),
    TaskOutput(String),
    External(String),
    ProjectConfiguration(String),
    TsConfiguration(String),
}

impl Ord for HashInstruction {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        match (self, other) {
            (
                HashInstruction::AllExternalDependencies,
                HashInstruction::AllExternalDependencies,
            ) => std::cmp::Ordering::Equal,
            (HashInstruction::AllExternalDependencies, _) => std::cmp::Ordering::Less,
            (HashInstruction::ProjectFileSet(a, _), HashInstruction::ProjectFileSet(b, _)) => {
                a.cmp(b)
            }
            (HashInstruction::ProjectFileSet(_, _), _) => std::cmp::Ordering::Greater,
            (_, HashInstruction::ProjectFileSet(_, _)) => std::cmp::Ordering::Less,
            (HashInstruction::WorkspaceFileSet(a), HashInstruction::WorkspaceFileSet(b)) => {
                a.cmp(b)
            }
            (HashInstruction::WorkspaceFileSet(_), _) => std::cmp::Ordering::Greater,
            (_, HashInstruction::WorkspaceFileSet(_)) => std::cmp::Ordering::Less,
            (HashInstruction::Runtime(a), HashInstruction::Runtime(b)) => a.cmp(b),
            (HashInstruction::Runtime(_), _) => std::cmp::Ordering::Less,
            (_, HashInstruction::Runtime(_)) => std::cmp::Ordering::Less,
            (HashInstruction::Environment(a), HashInstruction::Environment(b)) => a.cmp(b),
            (HashInstruction::Environment(_), _) => std::cmp::Ordering::Less,
            (_, HashInstruction::Environment(_)) => std::cmp::Ordering::Less,
            (HashInstruction::TaskOutput(a), HashInstruction::TaskOutput(b)) => a.cmp(b),
            (HashInstruction::TaskOutput(_), _) => std::cmp::Ordering::Less,
            (_, HashInstruction::TaskOutput(_)) => std::cmp::Ordering::Less,
            (HashInstruction::External(a), HashInstruction::External(b)) => a.cmp(b),
            (HashInstruction::External(_), _) => std::cmp::Ordering::Less,
            (_, HashInstruction::External(_)) => std::cmp::Ordering::Less,
            (
                HashInstruction::ProjectConfiguration(a),
                HashInstruction::ProjectConfiguration(b),
            ) => a.cmp(b),
            (HashInstruction::ProjectConfiguration(_), _) => std::cmp::Ordering::Greater,
            (HashInstruction::TsConfiguration(a), HashInstruction::TsConfiguration(b)) => a.cmp(b),
            (HashInstruction::TsConfiguration(_), _) => std::cmp::Ordering::Greater,
        }
    }
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
            HashInstruction::TaskOutput(task_output) => task_output,
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
