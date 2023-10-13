use crate::native::project_graph::types::Target;
use crate::native::types::JsInputs;
use std::collections::HashMap;

#[napi(object)]
/// Stripped version of the NxJson interface for use in rust
pub struct NxJson {
    pub named_inputs: Option<HashMap<String, Vec<JsInputs>>>,
    pub target_defaults: Option<HashMap<String, Target>>,
}
