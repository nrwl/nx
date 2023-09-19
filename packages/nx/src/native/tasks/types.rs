use std::collections::HashMap;

#[napi(object)]
pub struct Task {
    pub id: String,
    pub target: TaskTarget,
    // pub overrides: HashMap<String, String>,
    pub project_root: Option<String>,
    // pub hash: Option<String>,
    // pub hash_details: Option<HashDetails>,
    // pub start_time: Option<i32>,
    // pub end_time: Option<i32>,
}

#[napi(object)]
pub struct TaskTarget {
    pub project: String,
    pub target: String,
    pub configuration: Option<String>,
}

// pub struct HashDetails {
//     pub command: String,
//     pub nodes: HashMap<String, String>,
//     pub implicit_deps: Option<HashMap<String, String>>,
//     pub runtime: Option<HashMap<String, String>>,
// }

#[napi(object)]
pub struct TaskGraph {
    pub roots: Vec<String>,
    pub tasks: HashMap<String, Task>,
    pub dependencies: HashMap<String, Vec<String>>,
}
