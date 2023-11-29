use crate::native::types::JsInputs;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

#[napi(object)]
/// Stripped version of the NxJson interface for use in rust
pub struct NxJsonNapi {
    pub named_inputs: Option<HashMap<String, Vec<JsInputs>>>,
}

#[derive(Deserialize)]
pub struct NxJson {
    pub cache_directory: Option<String>,
    pub task_runner_options: Option<Value>,
}
