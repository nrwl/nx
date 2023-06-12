use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub(crate) struct ProjectConfiguration {
    pub name: Option<String>,
}

#[derive(Debug, Eq, PartialEq)]
pub enum FileLocation {
    Global,
    Project(String),
}
