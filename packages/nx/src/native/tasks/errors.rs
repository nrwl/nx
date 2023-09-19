use napi::bindgen_prelude::*;
use thiserror::Error;

#[napi(string_enum)]
pub enum TaskErrors {
    InputError,
    MissingExternalDependency,
}

impl AsRef<str> for TaskErrors {
    fn as_ref(&self) -> &str {
        match self {
            TaskErrors::InputError => "InputError",
            TaskErrors::MissingExternalDependency => "MissingExternalDependency",
        }
    }
}

#[derive(Debug, Error)]
#[non_exhaustive]
pub(super) enum InternalTaskErrors {
    #[error("{0}")]
    InputError(String),
    #[error("{0}")]
    MissingExternalDependency(String),
}

impl From<InternalTaskErrors> for napi::Error<TaskErrors> {
    fn from(value: InternalTaskErrors) -> Self {
        match value {
            InternalTaskErrors::InputError(msg) => Error::new(TaskErrors::InputError, msg),
            InternalTaskErrors::MissingExternalDependency(msg) => {
                Error::new(TaskErrors::MissingExternalDependency, msg)
            }
        }
    }
}
