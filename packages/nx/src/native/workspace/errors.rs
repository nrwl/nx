use std::path::PathBuf;

use napi::bindgen_prelude::*;
use thiserror::Error;

/// Public NAPI error codes that are for Node
#[napi(string_enum)]
#[derive(Debug)]
pub enum WorkspaceErrors {
    ParseError,
    Generic,
}

impl AsRef<str> for WorkspaceErrors {
    fn as_ref(&self) -> &str {
        match self {
            WorkspaceErrors::ParseError => "ParseError",
            WorkspaceErrors::Generic => "Generic",
        }
    }
}

#[derive(Debug, Error)]
#[non_exhaustive]
pub enum InternalWorkspaceErrors {
    #[error("{file}")]
    ParseError { file: PathBuf },
    #[error("{msg}")]
    Generic { msg: String },
}

impl From<InternalWorkspaceErrors> for napi::Error<WorkspaceErrors> {
    fn from(value: InternalWorkspaceErrors) -> Self {
        match value {
            InternalWorkspaceErrors::ParseError { file } => {
                Error::new(WorkspaceErrors::ParseError, file.display().to_string())
            }
            InternalWorkspaceErrors::Generic { msg } => Error::new(WorkspaceErrors::Generic, msg),
        }
    }
}
