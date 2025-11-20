#![deny(unsafe_code)]

mod client;
mod socket;
mod messenger;
mod queue;
mod reconnect;
mod watchers;
mod types;
mod error;

pub use client::DaemonClient;
pub use error::{DaemonClientError, Result};
pub use types::*;

use napi_derive::napi;
use std::sync::OnceLock;

static DAEMON_CLIENT: OnceLock<DaemonClient> = OnceLock::new();

/// Get or initialize the daemon client singleton
fn get_daemon_client() -> &'static DaemonClient {
    DAEMON_CLIENT.get_or_init(DaemonClient::new)
}

#[napi]
pub struct DaemonClientBinding {
    // Empty struct, actual state is in singleton
}

#[napi]
impl DaemonClientBinding {
    #[napi(constructor)]
    pub fn new() -> Self {
        // Initialize singleton
        let _ = get_daemon_client();
        DaemonClientBinding {}
    }

    #[napi]
    pub fn enabled(&self) -> bool {
        get_daemon_client().enabled()
    }

    #[napi]
    pub async fn get_project_graph(&self) -> napi::Result<String> {
        let graph = get_daemon_client().get_project_graph().await
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;
        serde_json::to_string(&graph)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }

    #[napi]
    pub async fn reset(&self) -> napi::Result<()> {
        get_daemon_client().reset().await;
        Ok(())
    }
}
