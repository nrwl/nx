use std::{error::Error, fmt::Write, future::Future, pin::Pin};

use napi::Status;
use reqwest::Response;
use thiserror::Error;

/// Errors surfaced from the self-hosted HTTP remote cache.
///
/// Each variant is either *fatal* or *recoverable*, and that classification is
/// the contract `cache.ts` depends on — see `From<HttpRemoteCacheErrors> for
/// napi::Error` below for how it crosses into JS.
///
/// Recoverable means the run can continue by recomputing the task: the remote
/// cache is unreachable, slow, or serving damaged data. Fatal means the run
/// should stop: the server is misconfigured, rejected our credentials, or
/// served an artifact that tried to write outside the cache directory.
#[derive(Debug, Error, Clone, Eq, PartialEq)]
pub enum HttpRemoteCacheErrors {
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    #[error("Misconfigured remote cache endpoint: {0}")]
    Misconfigured(String),
    #[error("Failed to send request: {0}")]
    RequestError(String),
    #[error(
        "Timed out downloading from the remote cache: {0}\n\n\
         The cache server accepted the connection but stopped sending data. The task will be \
         rebuilt locally instead.\n\
         To resolve this:\n  \
         - Check whether the cache server is healthy and not overloaded.\n  \
         - Set NX_SELF_HOSTED_REMOTE_CACHE_NO_TIMEOUTS=true to wait indefinitely instead (a stalled \
         server will then hang the run with no output)."
    )]
    DownloadTimeout(String),
    #[error(
        "Timed out uploading to the remote cache: {0}\n\n\
         The cache server accepted the connection but did not acknowledge the upload in time. The \
         task stays cached locally, but other machines will not get a cache hit for it.\n\
         To resolve this:\n  \
         - Reduce the size of this task's outputs so there is less to upload.\n  \
         - Check whether the cache server, or a reverse proxy in front of it, buffers the entire \
         request body before responding.\n  \
         - Set NX_SELF_HOSTED_REMOTE_CACHE_NO_TIMEOUTS=true to wait indefinitely instead (a stalled \
         server will then hang the run after all tasks have finished)."
    )]
    UploadTimeout(String),
    #[error(
        "Damaged artifact in the remote cache: {0}\n\n\
         The cache server responded, but the archive it returned could not be read. This usually \
         means a previous upload was cut short and the server stored a partial artifact. The task \
         will be rebuilt locally instead.\n\
         To resolve this:\n  \
         - Evict this entry from the cache server; note that Nx cannot repair it, because the \
         server answers later uploads of the same hash with 409 Conflict.\n  \
         - Verify the server rejects uploads whose body is shorter than Content-Length. See \
         https://nx.dev/docs/kb/self-hosted-caching#handling-incomplete-uploads"
    )]
    CorruptArtifact(String),
    #[error(
        "Unsafe artifact in the remote cache: {0}\n\n\
         The archive tried to write outside the cache directory. Nx refused to extract it. This is \
         not a transient failure and the run has been stopped deliberately.\n\
         To resolve this:\n  \
         - Confirm NX_SELF_HOSTED_REMOTE_CACHE_SERVER points at the server you expect.\n  \
         - Treat the cache contents as untrusted until you know how the entry was written."
    )]
    UnsafeArtifact(String),
    #[error(
        "Could not write to the local cache directory: {0}\n\n\
         This is a problem with the local machine rather than the cache server, so Nx cannot fall \
         back to rebuilding the task.\n\
         To resolve this:\n  \
         - Check the permissions and free space on the Nx cache directory."
    )]
    LocalCacheError(String),
}

impl HttpRemoteCacheErrors {
    /// Whether the run must stop, rather than degrading to a cache miss.
    pub fn is_fatal(&self) -> bool {
        match self {
            HttpRemoteCacheErrors::Unauthorized(_)
            | HttpRemoteCacheErrors::Misconfigured(_)
            | HttpRemoteCacheErrors::UnsafeArtifact(_)
            | HttpRemoteCacheErrors::LocalCacheError(_) => true,
            HttpRemoteCacheErrors::RequestError(_)
            | HttpRemoteCacheErrors::DownloadTimeout(_)
            | HttpRemoteCacheErrors::UploadTimeout(_)
            | HttpRemoteCacheErrors::CorruptArtifact(_) => false,
        }
    }
}

pub type AsyncHttpRemoteCacheErrors = Pin<Box<dyn Future<Output = HttpRemoteCacheErrors>>>;

pub fn report_request_error(mut err: &dyn Error) -> String {
    let mut s = format!("{}", err);
    while let Some(src) = err.source() {
        let _ = write!(s, "\n\nCaused by: {}", src);
        err = src;
    }
    s
}

pub async fn convert_response_to_error(response: Response) -> HttpRemoteCacheErrors {
    match response.status() {
        reqwest::StatusCode::UNAUTHORIZED => {
            if response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .map(|v| v == "text/plain")
                .unwrap_or(false)
            {
                HttpRemoteCacheErrors::Unauthorized(
                    response
                        .text()
                        .await
                        .unwrap_or_else(|_| "Unauthorized".to_string()),
                )
            } else {
                HttpRemoteCacheErrors::Misconfigured(
                    "Requests should respond with text/plain on 401s".to_string(),
                )
            }
        }
        _ => HttpRemoteCacheErrors::Misconfigured(format!(
            "Unexpected response status: {}",
            response.status()
        )),
    }
}

impl AsRef<str> for HttpRemoteCacheErrors {
    fn as_ref(&self) -> &str {
        match self {
            HttpRemoteCacheErrors::Unauthorized(_) => "Unauthorized",
            HttpRemoteCacheErrors::Misconfigured(_) => "Misconfigured",
            HttpRemoteCacheErrors::RequestError(_) => "RequestError",
            HttpRemoteCacheErrors::DownloadTimeout(_) => "DownloadTimeout",
            HttpRemoteCacheErrors::UploadTimeout(_) => "UploadTimeout",
            HttpRemoteCacheErrors::CorruptArtifact(_) => "CorruptArtifact",
            HttpRemoteCacheErrors::UnsafeArtifact(_) => "UnsafeArtifact",
            HttpRemoteCacheErrors::LocalCacheError(_) => "LocalCacheError",
        }
    }
}

/// Classify a failed `reqwest` call, so a stalled server degrades to a cache
/// miss with actionable output instead of reading as a generic send failure.
pub fn convert_request_error(err: &reqwest::Error, uploading: bool) -> HttpRemoteCacheErrors {
    let message = report_request_error(err);
    if err.is_timeout() {
        if uploading {
            HttpRemoteCacheErrors::UploadTimeout(message)
        } else {
            HttpRemoteCacheErrors::DownloadTimeout(message)
        }
    } else {
        HttpRemoteCacheErrors::RequestError(message)
    }
}

impl From<HttpRemoteCacheErrors> for napi::Error<HttpRemoteCacheErrors> {
    fn from(err: HttpRemoteCacheErrors) -> Self {
        napi::Error::new(err.clone(), err.to_string())
    }
}

// we need to implement this conversion to Status because napi::Error only accepts Status
// waiting for this to close https://github.com/napi-rs/napi-rs/issues/2178#issuecomment-2401184010
//
// `Status` is a closed enum, so it is also the only channel we have for telling
// JS whether a failure is fatal. It arrives as `error.code`, and `cache.ts`
// reads it through `isFatalRemoteCacheError`. Keep the two in sync: a fatal
// variant must map to `InvalidArg`, a recoverable one to `GenericFailure`.
impl From<HttpRemoteCacheErrors> for napi::Error {
    fn from(err: HttpRemoteCacheErrors) -> Self {
        let status = if err.is_fatal() {
            Status::InvalidArg
        } else {
            Status::GenericFailure
        };
        napi::Error::new(status, err.to_string())
    }
}
