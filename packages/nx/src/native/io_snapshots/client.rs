use std::collections::BTreeMap;
use std::env;
use std::time::Duration;

use reqwest::{ClientBuilder, StatusCode, header};
use serde::{Deserialize, Serialize};

use super::FetchFailure;
use super::bundle::TaskIoSnapshot;

#[derive(Deserialize)]
struct ReadResponse {
    snapshots: BTreeMap<String, TaskIoSnapshot>,
}

#[derive(Serialize)]
struct ReadRequest<'a> {
    commits: &'a [String],
}

pub struct Credentials {
    pub access_token: Option<String>,
    pub nx_cloud_id: Option<String>,
    pub personal_access_token: Option<String>,
    pub client_version: String,
}

impl Credentials {
    pub fn is_empty(&self) -> bool {
        self.access_token.is_none()
            && self.nx_cloud_id.is_none()
            && self.personal_access_token.is_none()
    }
}

fn header_value(name: &str, value: &str) -> Result<header::HeaderValue, FetchFailure> {
    header::HeaderValue::from_str(value).map_err(|_| {
        FetchFailure::new(
            "invalid-credentials",
            format!("{name} is not a valid header value"),
        )
    })
}

pub async fn read_snapshots(
    api_url: &str,
    commits: &[String],
    credentials: &Credentials,
    timeout: Duration,
) -> Result<BTreeMap<String, TaskIoSnapshot>, FetchFailure> {
    // Credentials never travel in the clear; a local dev server is the exception.
    let insecure = api_url.starts_with("http://")
        && !["http://localhost", "http://127.0.0.1", "http://[::1]"]
            .iter()
            .any(|local| api_url.starts_with(local));
    if insecure {
        return Err(FetchFailure::new(
            "insecure-api-url",
            format!("Refusing to send Nx Cloud credentials to {api_url} over plain HTTP"),
        ));
    }
    let mut headers = header::HeaderMap::new();
    if let Some(token) = &credentials.access_token {
        headers.insert(header::AUTHORIZATION, header_value("accessToken", token)?);
    }
    if let Some(id) = &credentials.nx_cloud_id {
        headers.insert("Nx-Cloud-Id", header_value("nxCloudId", id)?);
    }
    if let Some(pat) = &credentials.personal_access_token {
        headers.insert(
            "Nx-Cloud-Personal-Access-Token",
            header_value("personalAccessToken", pat)?,
        );
    }
    headers.insert(
        "Nx-Cloud-Client-Version",
        header_value("clientVersion", &credentials.client_version)?,
    );

    // User-supplied host: keep the system resolver (see http_remote_cache.rs).
    let mut builder = ClientBuilder::new()
        .no_hickory_dns()
        .default_headers(headers)
        .timeout(timeout);
    if env::var("NODE_TLS_REJECT_UNAUTHORIZED").as_deref() == Ok("0") {
        builder = builder.danger_accept_invalid_certs(true);
    }
    let client = builder
        .build()
        .map_err(|e| FetchFailure::new("client-error", e.to_string()))?;

    let url = format!(
        "{}/nx-cloud/io-snapshots/v1/read",
        api_url.trim_end_matches('/')
    );
    let body = serde_json::to_vec(&ReadRequest { commits })
        .map_err(|e| FetchFailure::new("client-error", e.to_string()))?;
    let response = client
        .post(&url)
        .header(header::CONTENT_TYPE, "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| {
            let reason = if e.is_timeout() {
                "timeout"
            } else if e.is_connect() || e.is_request() {
                "offline"
            } else {
                "request-error"
            };
            FetchFailure::new(reason, e.to_string())
        })?;

    match response.status() {
        StatusCode::OK => {
            let bytes = response
                .bytes()
                .await
                .map_err(|e| FetchFailure::new("invalid-response", e.to_string()))?;
            serde_json::from_slice::<ReadResponse>(&bytes)
                .map(|body| body.snapshots)
                .map_err(|e| FetchFailure::new("invalid-response", e.to_string()))
        }
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => Err(FetchFailure::new(
            "unauthorized",
            response
                .text()
                .await
                .unwrap_or_else(|_| "Nx Cloud rejected the credentials".to_string()),
        )),
        StatusCode::NOT_FOUND => Err(FetchFailure::new(
            "unsupported-server",
            format!("{url} does not exist on this Nx Cloud instance"),
        )),
        status => Err(FetchFailure::new(
            "server-error",
            format!("Nx Cloud responded with {status}"),
        )),
    }
}
