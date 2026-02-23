//! Telemetry service for tracking analytics events
//!
//! This module provides both a NAPI-exposed TelemetryService for TypeScript
//! and a global instance that Rust code can use directly.
//!
//! # Example usage from Rust code:
//! ```rust
//! use crate::native::telemetry::{track_event, track_event_sync};
//! use std::collections::HashMap;
//!
//! // From async context:
//! let mut params = HashMap::new();
//! params.insert("project_count".to_string(), "42".to_string());
//! track_event("workspace_analyzed", params);
//!
//! // From sync context:
//! let mut params = HashMap::new();
//! params.insert("error_type".to_string(), "parse_error".to_string());
//! track_event_sync("native_error", params);
//! ```

use napi::bindgen_prelude::*;
use once_cell::sync::OnceCell;
use reqwest::{Client, ClientBuilder};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

const TRACKING_ID_PROD: &str = "G-83SJXKY605";
const GA_ENDPOINT: &str = "https://www.google-analytics.com/g/collect";

type ParameterMap = HashMap<String, String>;

// Global telemetry instance for Rust code to use directly
static GLOBAL_TELEMETRY: OnceCell<Arc<TelemetryService>> = OnceCell::new();

#[napi]
pub struct TelemetryService {
    events_queue: Arc<Mutex<Vec<ParameterMap>>>,
    page_view_queue: Arc<Mutex<Vec<ParameterMap>>>,
    common_request_parameters: ParameterMap,
    user_parameters: ParameterMap,
    client: Client,
}

#[napi]
impl TelemetryService {
    #[napi(constructor)]
    pub fn new(
        workspace_id: String,
        user_id: String,
        nx_version: String,
        package_manager_name: String,
        package_manager_version: Option<String>,
        node_version: String,
        os_arch: String,
        os_platform: String,
        os_release: String,
        is_ai_agent: bool,
    ) -> Result<Self> {
        let client = ClientBuilder::new()
            .build()
            .map_err(|e| Error::from_reason(format!("Failed to create HTTP client: {}", e)))?;

        // Session ID - generate a unique ID for this session
        let session_id = uuid::Uuid::new_v4().to_string();

        let mut common_request_parameters = HashMap::new();
        common_request_parameters.insert("v".to_string(), "2".to_string()); // ProtocolVersion
        common_request_parameters.insert("cid".to_string(), workspace_id.clone()); // ClientId
        common_request_parameters.insert("uid".to_string(), user_id.clone()); // UserId
        common_request_parameters.insert("tid".to_string(), TRACKING_ID_PROD.to_string()); // TrackingId
        common_request_parameters.insert("sid".to_string(), session_id); // SessionId
        common_request_parameters.insert("uaa".to_string(), os_arch.clone()); // UserAgentArchitecture
        common_request_parameters.insert("uap".to_string(), os_platform); // UserAgentPlatform
        common_request_parameters.insert("uapv".to_string(), os_release); // UserAgentPlatformVersion
        common_request_parameters.insert("uamb".to_string(), "0".to_string()); // UserAgentMobile
        common_request_parameters.insert("seg".to_string(), "1".to_string()); // SessionEngaged
        common_request_parameters.insert(
            "uafvl".to_string(),
            "Google%20Chrome;111.0.5563.64|Not(A%3ABrand;8.0.0.0|Chromium;111.0.5563.64"
                .to_string(),
        ); // UserAgentFullVersionList
        common_request_parameters.insert("_dbg".to_string(), "1".to_string()); // DebugView

        let mut user_parameters = HashMap::new();
        user_parameters.insert("up.os_architecture".to_string(), os_arch); // OsArchitecture
        user_parameters.insert("up.user_id".to_string(), user_id); // UserId
        user_parameters.insert("up.node_version".to_string(), node_version); // NodeVersion
        user_parameters.insert("up.package_manager".to_string(), package_manager_name); // PackageManager
        if let Some(version) = package_manager_version {
            user_parameters.insert("up.pkg_manager_version".to_string(), version); // PackageManagerVersion
        }
        user_parameters.insert("up.nx_version".to_string(), nx_version); // NxVersion
        user_parameters.insert("ep.is_ai_agent".to_string(), is_ai_agent.to_string()); // IsAgent

        Ok(TelemetryService {
            events_queue: Arc::new(Mutex::new(Vec::new())),
            page_view_queue: Arc::new(Mutex::new(Vec::new())),
            common_request_parameters,
            user_parameters,
            client,
        })
    }

    #[napi]
    pub async fn event(
        &self,
        event_name: String,
        parameters: Option<HashMap<String, String>>,
        is_page_view: Option<bool>,
        page_location: Option<String>,
    ) -> Result<()> {
        let is_page_view = is_page_view.unwrap_or(false);
        let mut event_data = self.user_parameters.clone();

        if let Some(params) = parameters {
            event_data.extend(params);
        }

        if is_page_view {
            event_data.insert("en".to_string(), "page_view".to_string());
            let location = page_location.as_ref().unwrap_or(&event_name);
            event_data.insert("dl".to_string(), location.clone()); // PageLocation
            event_data.insert("dt".to_string(), event_name); // PageTitle

            let mut page_view_queue = self.page_view_queue.lock().await;
            page_view_queue.push(event_data);
        } else {
            event_data.insert("en".to_string(), event_name);

            let mut events_queue = self.events_queue.lock().await;
            events_queue.push(event_data);
        }

        Ok(())
    }

    #[napi]
    pub async fn flush(&self) -> Result<()> {
        let events = {
            let mut queue = self.events_queue.lock().await;
            std::mem::take(&mut *queue)
        };

        let page_views = {
            let mut queue = self.page_view_queue.lock().await;
            std::mem::take(&mut *queue)
        };

        let pending_count = events.len() + page_views.len();
        tracing::trace!("Telemetry Flush: {} events", pending_count);

        if pending_count == 0 {
            return Ok(());
        }

        // Send events
        if !events.is_empty() {
            if let Err(e) = self
                .send_request(self.common_request_parameters.clone(), events)
                .await
            {
                tracing::trace!("Telemetry Send Error: {}", e);
            }
        }

        // Send page views
        for page_view in page_views {
            let mut request_params = self.common_request_parameters.clone();
            if let Some(title) = page_view.get("dt") {
                request_params.insert("dt".to_string(), title.clone());
            }
            if let Some(location) = page_view.get("dl") {
                request_params.insert("dl".to_string(), location.clone());
            }

            if let Err(e) = self.send_request(request_params, vec![page_view]).await {
                tracing::trace!("Telemetry Send Error: {}", e);
            }
        }

        Ok(())
    }

    async fn send_request(&self, parameters: ParameterMap, data: Vec<ParameterMap>) -> Result<()> {
        let query_string = Self::build_query_string(&parameters);
        let url = format!("{}?{}", GA_ENDPOINT, query_string);

        let body = data
            .iter()
            .map(|params| Self::build_query_string(params))
            .collect::<Vec<_>>()
            .join("\n");

        let response = self
            .client
            .post(&url)
            .header(
                "user-agent",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36",
            )
            .body(body)
            .send()
            .await
            .map_err(|e| Error::from_reason(format!("Request error: {}", e)))?;

        let status = response.status();
        if !status.is_success() && status.as_u16() != 204 {
            return Err(Error::from_reason(format!(
                "Analytics reporting failed with status: {}",
                status
            )));
        }

        Ok(())
    }

    fn build_query_string(params: &ParameterMap) -> String {
        params
            .iter()
            .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
            .collect::<Vec<_>>()
            .join("&")
    }
}

// Global telemetry initialization and helper functions for Rust code

/// Initialize the global telemetry service
/// This should be called once at startup from TypeScript
#[napi]
pub fn initialize_telemetry(
    workspace_id: String,
    user_id: String,
    nx_version: String,
    package_manager_name: String,
    package_manager_version: Option<String>,
    node_version: String,
    os_arch: String,
    os_platform: String,
    os_release: String,
    is_ai_agent: bool,
) -> Result<()> {
    let service = TelemetryService::new(
        workspace_id,
        user_id,
        nx_version,
        package_manager_name,
        package_manager_version,
        node_version,
        os_arch,
        os_platform,
        os_release,
        is_ai_agent,
    )?;

    GLOBAL_TELEMETRY
        .set(Arc::new(service))
        .map_err(|_| Error::from_reason("Telemetry already initialized"))?;

    Ok(())
}

/// Track an event from Rust code (non-blocking)
/// This is a fire-and-forget operation - errors are logged but not returned
pub fn track_event(event_name: impl Into<String>, parameters: HashMap<String, String>) {
    if let Some(telemetry) = GLOBAL_TELEMETRY.get() {
        let event_name = event_name.into();
        let telemetry = Arc::clone(telemetry);

        // Spawn a task to avoid blocking the caller
        tokio::spawn(async move {
            if let Err(e) = telemetry
                .event(event_name, Some(parameters), None, None)
                .await
            {
                tracing::trace!("Failed to track event: {}", e);
            }
        });
    }
}

/// Track an event from Rust code synchronously (for use in non-async contexts)
/// This queues the event but doesn't wait for it to be sent
pub fn track_event_sync(event_name: impl Into<String>, parameters: HashMap<String, String>) {
    if let Some(telemetry) = GLOBAL_TELEMETRY.get() {
        let event_name = event_name.into();
        let parameters = Some(parameters);
        let telemetry = Arc::clone(telemetry);

        // Spawn on the tokio runtime without waiting
        let _ = tokio::runtime::Handle::try_current().map(|handle| {
            handle.spawn(async move {
                if let Err(e) = telemetry.event(event_name, parameters, None, None).await {
                    tracing::trace!("Failed to track event: {}", e);
                }
            });
        });
    }
}

/// Track an event from JavaScript/TypeScript code using the global instance
/// This is a wrapper for the global instance's event method
#[napi]
pub async fn track_event_from_js(
    event_name: String,
    parameters: Option<HashMap<String, String>>,
    is_page_view: Option<bool>,
    page_location: Option<String>,
) -> Result<()> {
    if let Some(telemetry) = GLOBAL_TELEMETRY.get() {
        telemetry
            .event(event_name, parameters, is_page_view, page_location)
            .await?;
    }
    Ok(())
}

/// Flush all pending telemetry data
/// This should be called before process exit
#[napi]
pub async fn flush_telemetry() -> Result<()> {
    if let Some(telemetry) = GLOBAL_TELEMETRY.get() {
        telemetry.flush().await?;
    }
    Ok(())
}
