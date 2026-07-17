use std::fmt::Formatter;
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, Ordering};
use std::{collections::HashMap, fmt, ptr};

use dashmap::DashMap;
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
    pub cache: bool,
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

/// Payload of `HashInstruction::JsonFileSet`. Boxed in the enum: inlined, its
/// four fields would nearly double the size of every HashInstruction in every
/// task's plan, whether or not json inputs are used.
#[derive(Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Clone)]
pub struct JsonFileSetInput {
    pub project_name: Option<String>,
    pub json_path: String,
    pub fields: Option<Vec<String>>,
    pub exclude_fields: Option<Vec<String>>,
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
    JsonFileSet(Box<JsonFileSetInput>),
}

/// Append-only interner for hash instructions. Plans store `u32` ids into the
/// pool, so each unique instruction is materialized once per planner instance
/// instead of once per task that references it.
#[derive(Default)]
pub struct InstructionPool {
    ids: DashMap<HashInstruction, u32>,
    items: DashMap<u32, HashInstruction>,
    // Display strings, rendered once per unique instruction at intern time so
    // hashing can hand out shared keys instead of re-rendering per task.
    keys: DashMap<u32, Arc<str>>,
    next_id: AtomicU32,
}

impl InstructionPool {
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns the id for the instruction, allocating one on first sight.
    /// Value-equal instructions always intern to the same id, so sorting a
    /// plan's ids and deduping is equivalent to value-level dedup.
    pub fn intern(&self, instruction: HashInstruction) -> u32 {
        if let Some(id) = self.ids.get(&instruction) {
            return *id;
        }
        match self.ids.entry(instruction) {
            dashmap::mapref::entry::Entry::Occupied(existing) => *existing.get(),
            dashmap::mapref::entry::Entry::Vacant(vacant) => {
                let id = self.next_id.fetch_add(1, Ordering::Relaxed);
                self.items.insert(id, vacant.key().clone());
                self.keys.insert(id, Arc::from(vacant.key().to_string()));
                vacant.insert(id);
                id
            }
        }
    }

    pub fn get(&self, id: u32) -> dashmap::mapref::one::Ref<'_, u32, HashInstruction> {
        self.items
            .get(&id)
            .expect("instruction ids are only handed out by intern()")
    }

    /// The instruction's Display string, shared across all tasks that
    /// reference the instruction.
    pub fn key(&self, id: u32) -> Arc<str> {
        self.keys
            .get(&id)
            .expect("instruction ids are only handed out by intern()")
            .clone()
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }
}

/// Hash plans as pool-interned instruction ids, plus the pool that resolves
/// them. This is what crosses from the HashPlanner to the TaskHasher.
pub struct HashPlans {
    pub pool: Arc<InstructionPool>,
    pub plans: HashMap<String, Vec<u32>>,
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
                HashInstruction::JsonFileSet(json) => {
                    let prefix = json
                        .project_name
                        .as_deref()
                        .map(|p| format!("{p}:"))
                        .unwrap_or_default();
                    let fields_str = json
                        .fields
                        .as_ref()
                        .map(|f| format!("[{}]", f.join(",")))
                        .unwrap_or_default();
                    let exclude_str = json
                        .exclude_fields
                        .as_ref()
                        .map(|f| format!("![{}]", f.join(",")))
                        .unwrap_or_default();
                    format!("{prefix}json:{}{fields_str}{exclude_str}", json.json_path)
                }
            }
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pool_key_matches_display_and_is_shared() {
        let pool = InstructionPool::new();
        let instruction = HashInstruction::ProjectConfiguration("proj".to_string());
        let id = pool.intern(instruction.clone());

        let key = pool.key(id);
        assert_eq!(&*key, instruction.to_string());
        // Every call hands out the same allocation, not a fresh string.
        assert!(Arc::ptr_eq(&key, &pool.key(id)));
    }

    #[test]
    fn hash_instruction_stays_small() {
        // Plans hold one HashInstruction per (task x transitive-dep input) —
        // millions on large workspaces — and the enum sizes to its largest
        // variant. Box large payloads instead of growing this (NXC-4604).
        assert!(std::mem::size_of::<HashInstruction>() <= 56);
    }
}
