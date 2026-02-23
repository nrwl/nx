//! Telemetry service for tracking analytics events
//!
//! This module provides both a NAPI-exposed TelemetryService for TypeScript
//! and a global instance that Rust code can use directly.
//!
//! The service uses an unbounded channel architecture with a background task
//! that batches events and sends them every 50ms. Page view events are
//! prioritized over regular events.
//!
//! # Example usage from Rust code:
//! ```rust
//! use crate::native::telemetry::track_rust_event;
//! use std::collections::HashMap;
//!
//! let mut params = HashMap::new();
//! params.insert("project_count".to_string(), "42".to_string());
//! track_rust_event("workspace_analyzed", params);
//! ```

use napi::bindgen_prelude::*;
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use reqwest::{Client, ClientBuilder};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, oneshot};

const TRACKING_ID_PROD: &str = "G-83SJXKY605";
const GA_ENDPOINT: &str = "https://www.google-analytics.com/g/collect";
const BATCH_INTERVAL_MS: u64 = 50;

type ParameterMap = HashMap<String, String>;

// Global telemetry instance for Rust code to use directly
static GLOBAL_TELEMETRY: OnceCell<Arc<TelemetryService>> = OnceCell::new();

/// Event data to be tracked
#[derive(Debug, Clone)]
struct EventData {
    name: String,
    parameters: ParameterMap,
}

/// Page view data to be tracked
#[derive(Debug, Clone)]
struct PageViewData {
    title: String,
    location: Option<String>,
    parameters: ParameterMap,
}

/// Internal telemetry service - not exposed to JavaScript
pub struct TelemetryService {
    event_tx: Mutex<Option<mpsc::UnboundedSender<EventData>>>,
    page_view_tx: Mutex<Option<mpsc::UnboundedSender<PageViewData>>>,
    flush_tx: mpsc::UnboundedSender<oneshot::Sender<Result<()>>>,
    common_request_parameters: ParameterMap,
    user_parameters: ParameterMap,
}

impl TelemetryService {
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
    ) -> Result<Self> {
        let client = ClientBuilder::new()
            .build()
            .map_err(|e| Error::from_reason(format!("Failed to create HTTP client: {}", e)))?;

        // Detect AI agent from environment variables
        let is_ai_agent = crate::native::utils::ai::is_ai_agent();

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

        // Create channels
        let (event_tx, event_rx) = mpsc::unbounded_channel();
        let (page_view_tx, page_view_rx) = mpsc::unbounded_channel();
        let (flush_tx, flush_rx) = mpsc::unbounded_channel();

        // Spawn background sender task
        let common_params = common_request_parameters.clone();
        let user_params = user_parameters.clone();
        tokio::spawn(Self::background_sender(
            client,
            common_params,
            user_params,
            event_rx,
            page_view_rx,
            flush_rx,
        ));

        Ok(TelemetryService {
            event_tx: Mutex::new(Some(event_tx)),
            page_view_tx: Mutex::new(Some(page_view_tx)),
            flush_tx,
            common_request_parameters,
            user_parameters,
        })
    }

    /// Background task that receives events and sends them in batches
    async fn background_sender(
        client: Client,
        common_params: ParameterMap,
        user_params: ParameterMap,
        mut event_rx: mpsc::UnboundedReceiver<EventData>,
        mut page_view_rx: mpsc::UnboundedReceiver<PageViewData>,
        mut flush_rx: mpsc::UnboundedReceiver<oneshot::Sender<Result<()>>>,
    ) {
        let mut event_batch = Vec::new();
        let mut page_view_batch = Vec::new();
        let mut interval = tokio::time::interval(Duration::from_millis(BATCH_INTERVAL_MS));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                // biased = check in order (page views first!)
                biased;

                // Priority 1: Page views (most important)
                Some(page_view) = page_view_rx.recv() => {
                    let mut params = user_params.clone();
                    params.extend(page_view.parameters);
                    params.insert("en".to_string(), "page_view".to_string());
                    params.insert("dt".to_string(), page_view.title.clone());
                    params.insert("dl".to_string(), page_view.location.unwrap_or(page_view.title));
                    page_view_batch.push(params);
                }

                // Priority 2: Regular events
                Some(event) = event_rx.recv() => {
                    let mut params = user_params.clone();
                    params.extend(event.parameters);
                    params.insert("en".to_string(), event.name);
                    event_batch.push(params);
                }

                // Priority 3: Flush requests
                Some(reply) = flush_rx.recv() => {
                    // Drain any remaining events from closed channels
                    while let Ok(event) = event_rx.try_recv() {
                        let mut params = user_params.clone();
                        params.extend(event.parameters);
                        params.insert("en".to_string(), event.name);
                        event_batch.push(params);
                    }

                    while let Ok(page_view) = page_view_rx.try_recv() {
                        let mut params = user_params.clone();
                        params.extend(page_view.parameters);
                        params.insert("en".to_string(), "page_view".to_string());
                        params.insert("dt".to_string(), page_view.title.clone());
                        params.insert("dl".to_string(), page_view.location.unwrap_or(page_view.title));
                        page_view_batch.push(params);
                    }

                    // Send final batch
                    let result = Self::send_batches(
                        &client,
                        &common_params,
                        &mut event_batch,
                        &mut page_view_batch,
                    ).await;
                    let _ = reply.send(result);
                }

                // Priority 4: Periodic flush
                _ = interval.tick() => {
                    let _ = Self::send_batches(
                        &client,
                        &common_params,
                        &mut event_batch,
                        &mut page_view_batch,
                    ).await;
                }

                // All channels closed - exit
                else => break,
            }
        }

        // Final flush before exit
        let _ = Self::send_batches(
            &client,
            &common_params,
            &mut event_batch,
            &mut page_view_batch,
        )
        .await;
    }

    async fn send_batches(
        client: &Client,
        common_params: &ParameterMap,
        event_batch: &mut Vec<ParameterMap>,
        page_view_batch: &mut Vec<ParameterMap>,
    ) -> Result<()> {
        if event_batch.is_empty() && page_view_batch.is_empty() {
            return Ok(());
        }

        tracing::trace!(
            "Telemetry: Sending {} events, {} page views",
            event_batch.len(),
            page_view_batch.len()
        );

        // Send events batch
        if !event_batch.is_empty() {
            if let Err(e) = Self::send_request(client, common_params, event_batch.clone()).await {
                tracing::trace!("Telemetry Send Error: {}", e);
            }
            event_batch.clear();
        }

        // Send page views (one per request)
        for page_view in page_view_batch.drain(..) {
            let mut request_params = common_params.clone();
            if let Some(title) = page_view.get("dt") {
                request_params.insert("dt".to_string(), title.clone());
            }
            if let Some(location) = page_view.get("dl") {
                request_params.insert("dl".to_string(), location.clone());
            }

            if let Err(e) = Self::send_request(client, &request_params, vec![page_view]).await {
                tracing::trace!("Telemetry Send Error: {}", e);
            }
        }

        Ok(())
    }

    async fn send_request(
        client: &Client,
        parameters: &ParameterMap,
        data: Vec<ParameterMap>,
    ) -> Result<()> {
        let query_string = Self::build_query_string(parameters);
        let url = format!("{}?{}", GA_ENDPOINT, query_string);

        let body = data
            .iter()
            .map(|params| Self::build_query_string(params))
            .collect::<Vec<_>>()
            .join("\n");

        let response = client
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

    fn track_event_impl(
        &self,
        event_name: String,
        parameters: Option<HashMap<String, String>>,
    ) -> Result<()> {
        let event = EventData {
            name: event_name,
            parameters: parameters.unwrap_or_default(),
        };

        if let Some(tx) = self.event_tx.lock().as_ref() {
            tx.send(event)
                .map_err(|_| Error::from_reason("Telemetry channel closed"))?;
        }

        Ok(())
    }

    fn track_page_view_impl(
        &self,
        page_title: String,
        page_location: Option<String>,
        parameters: Option<HashMap<String, String>>,
    ) -> Result<()> {
        let page_view = PageViewData {
            title: page_title,
            location: page_location,
            parameters: parameters.unwrap_or_default(),
        };

        if let Some(tx) = self.page_view_tx.lock().as_ref() {
            tx.send(page_view)
                .map_err(|_| Error::from_reason("Telemetry channel closed"))?;
        }

        Ok(())
    }

    async fn flush(&self) -> Result<()> {
        // 1. Close event channels (stop accepting new events)
        self.event_tx.lock().take();
        self.page_view_tx.lock().take();

        // 2. Send flush request and wait for background task to drain everything
        let (tx, rx) = oneshot::channel();
        self.flush_tx
            .send(tx)
            .map_err(|_| Error::from_reason("Telemetry channel closed"))?;

        // 3. Wait for flush to complete
        rx.await
            .map_err(|_| Error::from_reason("Flush reply channel closed"))?
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
    )?;

    GLOBAL_TELEMETRY
        .set(Arc::new(service))
        .map_err(|_| Error::from_reason("Telemetry already initialized"))?;

    Ok(())
}

/// Track an event from Rust code
/// This is a fire-and-forget operation - errors are logged but not returned
pub fn track_rust_event(event_name: impl Into<String>, parameters: HashMap<String, String>) {
    if let Some(telemetry) = GLOBAL_TELEMETRY.get() {
        if let Err(e) = telemetry.track_event_impl(event_name.into(), Some(parameters)) {
            tracing::trace!("Failed to track event: {}", e);
        }
    }
}

/// Track an event using the global telemetry instance
#[napi]
pub fn track_event(event_name: String, parameters: Option<HashMap<String, String>>) -> Result<()> {
    if let Some(telemetry) = GLOBAL_TELEMETRY.get() {
        telemetry.track_event_impl(event_name, parameters)?;
    }
    Ok(())
}

/// Track a page view using the global telemetry instance
#[napi]
pub fn track_page_view(
    page_title: String,
    page_location: Option<String>,
    parameters: Option<HashMap<String, String>>,
) -> Result<()> {
    if let Some(telemetry) = GLOBAL_TELEMETRY.get() {
        telemetry.track_page_view_impl(page_title, page_location, parameters)?;
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
