use serde::Deserialize;
use std::path::Path;

#[derive(Debug, Deserialize)]
pub(crate) struct ProjectConfiguration<'a> {
    pub name: Option<&'a str>,
    pub root: Option<&'a Path>,
}
