use std::{error::Error, fmt::Write, future::Future, pin::Pin};

use napi::Status;
use reqwest::Response;
use thiserror::Error;

#[derive(Debug, Error, Clone, Eq, PartialEq)]
pub enum HttpRemoteCacheErrors {
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    #[error("Misconfigured remote cache endpoint: {0}")]
    Misconfigured(String),
    #[error("Failed to send request: {0}")]
    RequestError(String),
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
            // _ => "Error",
        }
    }
}

impl From<HttpRemoteCacheErrors> for napi::Error<HttpRemoteCacheErrors> {
    fn from(err: HttpRemoteCacheErrors) -> Self {
        napi::Error::new(err.clone(), err.to_string())
    }
}

// we need to implement this conversion to Status because napi::Error only accepts Status
// waiting for this to close https://github.com/napi-rs/napi-rs/issues/2178#issuecomment-2401184010
impl From<HttpRemoteCacheErrors> for napi::Error {
    fn from(err: HttpRemoteCacheErrors) -> Self {
        let status = match err {
            HttpRemoteCacheErrors::Unauthorized(_) => Status::GenericFailure,
            HttpRemoteCacheErrors::Misconfigured(_) => Status::InvalidArg,
            _ => Status::GenericFailure,
        };
        napi::Error::new(status, err.to_string())
    }
}
