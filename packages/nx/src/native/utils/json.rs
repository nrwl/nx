use serde::de::DeserializeOwned;
use std::fs;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum JsonError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON parse error: {0}")]
    Parse(#[from] serde_json::Error),
}

pub type JsonResult<T> = Result<T, JsonError>;

/// Efficiently reads and parses a JSON file using buffered I/O
pub fn read_json_file<T: DeserializeOwned>(path: &Path) -> JsonResult<T> {
    let file = fs::File::open(path)?;
    let reader = std::io::BufReader::new(file);
    let data = serde_json::from_reader(reader)?;
    Ok(data)
}
