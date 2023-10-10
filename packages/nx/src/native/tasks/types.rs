use std::collections::HashMap;

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
