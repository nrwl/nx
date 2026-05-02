use std::fmt::Formatter;
use std::{collections::HashMap, fmt, ptr};

use napi::{
    bindgen_prelude::{ToNapiValue, check_status},
    sys,
};

/// A representation of the invocation of an Executor
#[napi(object)]
#[derive(Default, Clone, Debug, PartialEq)]
pub struct Task {
    /// Unique ID
    pub id: String,
    /// Details about which project, target, and configuration to run.
    pub target: TaskTarget,
    /// Overrides for the configured options of the target
    #[napi(ts_type = "Record<string, unknown>")]
    pub overrides: serde_json::Value,
    /// The outputs the task may produce
    pub outputs: Vec<String>,
    /// Root of the project the task belongs to
    pub project_root: Option<String>,
    /// Hash of the task which is used for caching.
    pub hash: Option<String>,
    /// Details about the composition of the hash
    pub hash_details: Option<TaskHashDetails>,
    /// Unix timestamp of when a Batch Task starts
    pub start_time: Option<i64>,
    /// Unix timestamp of when a Batch Task ends
    pub end_time: Option<i64>,
    /// Determines if a given task should be cacheable.
    pub cache: Option<bool>,
    /// Determines if a given task should be parallelizable.
    pub parallelism: Option<bool>,
    /// This denotes if the task runs continuously
    pub continuous: Option<bool>,
}

impl Task {
    /// Build a Task for the given project + target. The id is derived as
    /// `{project}:{target}`, matching the formula used by the TS task graph
    /// builder in `tasks-runner/create-task-graph.ts`.
    pub fn new(project: impl Into<String>, target: impl Into<String>) -> Self {
        let project = project.into();
        let target = target.into();
        let id = format!("{project}:{target}");
        Task {
            id,
            target: TaskTarget {
                project,
                target,
                configuration: None,
            },
            ..Default::default()
        }
    }

    pub fn with_project_root(mut self, project_root: impl Into<String>) -> Self {
        self.project_root = Some(project_root.into());
        self
    }

    pub fn with_outputs(mut self, outputs: Vec<String>) -> Self {
        self.outputs = outputs;
        self
    }

    pub fn with_continuous(mut self, continuous: bool) -> Self {
        self.continuous = Some(continuous);
        self
    }

    /// Whether this task may run in parallel with others. Defaults to `true`
    /// when unset, matching `create-task-graph.ts` (`parallelism ?? true`).
    pub fn is_parallelizable(&self) -> bool {
        self.parallelism.unwrap_or(true)
    }
}

/// Details about the composition of a task's hash
#[napi(object)]
#[derive(Default, Clone, Debug, PartialEq, Eq)]
pub struct TaskHashDetails {
    /// Command of the task
    pub command: String,
    /// Hashes of inputs used in the hash
    pub nodes: HashMap<String, String>,
    /// Hashes of implicit dependencies which are included in the hash
    pub implicit_deps: Option<HashMap<String, String>>,
    /// Hash of the runtime environment which the task was executed
    pub runtime: Option<HashMap<String, String>>,
}

#[napi(object)]
#[derive(Default, Clone, Debug, PartialEq, Eq)]
pub struct TaskTarget {
    /// The project for which the task belongs to
    pub project: String,
    /// The target name which the task should invoke
    pub target: String,
    /// The configuration of the target which the task invokes
    pub configuration: Option<String>,
}

/// The result of a completed Task.
///
/// Task timing information (start and end timestamps) is available
/// on the Task object itself via `Task.startTime` and `Task.endTime`.
#[napi(object)]
#[derive(Default, Clone, Debug, PartialEq)]
pub struct TaskResult {
    pub task: Task,
    #[napi(
        ts_type = "'success' | 'failure' | 'skipped' | 'stopped' | 'local-cache-kept-existing' | 'local-cache' | 'remote-cache'"
    )]
    pub status: String,
    pub code: i32,
    pub terminal_output: Option<String>,
}

/// Graph of Tasks to be executed
#[napi(object)]
pub struct TaskGraph {
    /// IDs of Tasks which do not have any dependencies and are thus ready to execute immediately
    pub roots: Vec<String>,
    /// Map of Task IDs to Tasks
    pub tasks: HashMap<String, Task>,
    /// Map of Task IDs to IDs of tasks which the task depends on
    pub dependencies: HashMap<String, Vec<String>>,
    pub continuous_dependencies: HashMap<String, Vec<String>>,
}

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Clone)]
pub enum CwdMode {
    Absolute,
    Relative,
}

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Clone)]
pub enum HashInstruction {
    WorkspaceFileSet(Vec<String>),
    Runtime(String),
    Environment(String),
    Cwd(CwdMode),
    ProjectFileSet(String, Vec<String>),
    ProjectConfiguration(String),
    TsConfiguration(String),
    TaskOutput(String, Vec<String>),
    External(String),
    AllExternalDependencies,
    JsonFileSet {
        project_name: Option<String>,
        json_path: String,
        fields: Option<Vec<String>>,
        exclude_fields: Option<Vec<String>>,
    },
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
                sys::napi_create_string_utf8(
                    env,
                    val.as_ptr() as *const _,
                    val.len() as isize,
                    &mut ptr,
                )
            },
            "Failed to convert rust `String` into napi `string`"
        )?;

        Ok(ptr)
    }
}

impl fmt::Display for CwdMode {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            CwdMode::Absolute => write!(f, "absolute"),
            CwdMode::Relative => write!(f, "relative"),
        }
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
                HashInstruction::Runtime(runtime) => format!("runtime:{}", runtime),
                HashInstruction::Environment(env) => format!("env:{}", env),
                HashInstruction::Cwd(mode) => format!("cwd:{}", mode),
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
                HashInstruction::JsonFileSet {
                    project_name,
                    json_path,
                    fields,
                    exclude_fields,
                } => {
                    let prefix = project_name
                        .as_deref()
                        .map(|p| format!("{p}:"))
                        .unwrap_or_default();
                    let fields_str = fields
                        .as_ref()
                        .map(|f| format!("[{}]", f.join(",")))
                        .unwrap_or_default();
                    let exclude_str = exclude_fields
                        .as_ref()
                        .map(|f| format!("![{}]", f.join(",")))
                        .unwrap_or_default();
                    format!("{prefix}json:{json_path}{fields_str}{exclude_str}")
                }
            }
        )
    }
}
