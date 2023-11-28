use crate::native::types::JsInputs;
use std::collections::HashMap;

#[napi(object)]
pub struct ExternalNodeData {
    pub version: String,
    pub hash: Option<String>,
}

#[napi(object)]
pub struct ExternalNode {
    pub version: String,
    pub hash: Option<String>,
}

#[napi(object)]
#[derive(Default)]
pub struct Target {
    pub executor: Option<String>,
    pub inputs: Option<Vec<JsInputs>>,
    pub outputs: Option<Vec<String>>,
    pub options: Option<String>,
    pub configurations: Option<String>,
}

#[napi(object)]
#[derive(Default)]
pub struct Project {
    pub root: String,
    pub named_inputs: Option<HashMap<String, Vec<JsInputs>>>,
    pub tags: Option<Vec<String>>,
    pub targets: HashMap<String, Target>,
}

#[napi(object)]
pub struct ProjectGraph {
    pub nodes: HashMap<String, Project>,
    pub dependencies: HashMap<String, Vec<String>>,
    pub external_nodes: HashMap<String, ExternalNode>,
}
