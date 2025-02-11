#[derive(Clone)]
pub struct TaskTarget {
    pub project: String,
    pub target: String,
    pub configuration: Option<String>,
}

#[derive(Clone)]
pub struct TaskOverrides {}

#[derive(Clone)]
pub struct Task {
    pub id: String,
    pub target: TaskTarget,
    pub overrides: TaskOverrides,
    pub outputs: Vec<String>,
    pub project_root: Option<String>,
    pub hash: Option<String>,
    pub start_time: Option<f64>,
    pub end_time: Option<f64>,
    pub cache: Option<bool>,
    pub parallelism: bool,
    pub continuous: Option<bool>,
}

#[derive(Clone)]
pub struct TaskResult {
    pub task: Task,
    pub status: String,
    pub code: i32,
    pub terminal_output: Option<String>,
}
