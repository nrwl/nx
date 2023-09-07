use std::collections::HashMap;

use napi::JsObject;

#[derive(Debug, Eq, PartialEq)]
pub enum FileLocation {
    Global,
    Project(String),
}

#[napi(object)]
pub struct ConfigurationParserResult {
    pub project_nodes: HashMap<String, JsObject>,
    pub external_nodes: HashMap<String, JsObject>,
}