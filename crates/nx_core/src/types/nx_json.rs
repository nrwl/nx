use std::collections::HashMap;
use napi_derive::napi;
use crate::types::inputs::JsInputs;

#[napi(object)]
/// Stripped version of the NxJson interface for use in rust
pub struct NxJson {
    pub named_inputs: Option<HashMap<String, Vec<JsInputs>>>,
}
