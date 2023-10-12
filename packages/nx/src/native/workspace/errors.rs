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
    #[error("{0}")]
    ParseError(String),
    #[error("{0}")]
    Generic(String),
}

impl From<InternalWorkspaceErrors> for napi::Error<WorkspaceErrors> {
    fn from(value: InternalWorkspaceErrors) -> Self {
        match value {
            InternalWorkspaceErrors::ParseError(msg) => {
                Error::new(WorkspaceErrors::ParseError, msg)
            }
            InternalWorkspaceErrors::Generic(msg) => Error::new(WorkspaceErrors::Generic, msg),
        }
    }
}
