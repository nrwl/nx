use std::collections::HashMap;

use napi::JsObject;
use serde_json::Value;

#[derive(Debug, Eq, PartialEq)]
pub enum FileLocation {
    Global,
    Project(String),
}

#[napi(object)]
pub struct ConfigurationParserResult {
    pub project_nodes: HashMap<String, Value>,
    pub external_nodes: HashMap<String, Value>,
}
