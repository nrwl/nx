use thiserror::Error;

pub type Result<T> = std::result::Result<T, DaemonClientError>;

#[derive(Error, Debug)]
pub enum DaemonClientError {
    #[error("Failed to connect to daemon: {0}")]
    ConnectionError(String),

    #[error("Daemon connection closed")]
    ConnectionClosed,

    #[error("Failed to serialize message: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("Failed to deserialize message: {0}")]
    DeserializationError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Daemon version mismatch")]
    VersionMismatch,

    #[error("Daemon not available")]
    DaemonNotAvailable,

    #[error("Request timeout")]
    RequestTimeout,

    #[error("Invalid daemon response")]
    InvalidResponse,

    #[error("Daemon error: {0}")]
    DaemonError(String),

    #[error("Message queue error")]
    QueueError,

    #[error("Reconnection failed after {0} attempts")]
    ReconnectionFailed(usize),

    #[error("General error: {0}")]
    Other(String),
}

impl From<anyhow::Error> for DaemonClientError {
    fn from(err: anyhow::Error) -> Self {
        DaemonClientError::Other(err.to_string())
    }
}
