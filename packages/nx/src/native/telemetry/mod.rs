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

use crossbeam_channel::{self, Receiver, Sender};
use napi::bindgen_prelude::*;
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use reqwest::{Client, ClientBuilder};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

const TRACKING_ID_PROD: &str = "G-83SJXKY605";
const GA_ENDPOINT: &str = "https://www.google-analytics.com/g/collect";
const BATCH_INTERVAL_MS: u64 = 50;

// Google Analytics Measurement Protocol limits
const MAX_EVENT_NAME_LENGTH: usize = 40;
const MAX_PARAM_NAME_LENGTH: usize = 40;
const MAX_PARAM_VALUE_LENGTH: usize = 100;
const MAX_URL_PARAM_VALUE_LENGTH: usize = 500;
const MAX_EVENTS_PER_BATCH: usize = 25;
const MAX_CUSTOM_PARAMS: usize = 25;

type ParameterMap = HashMap<String, String>;

// =============================================================================
// Public API
// =============================================================================

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
    tracing::trace!(
        "Initializing telemetry service for workspace: {}",
        workspace_id
    );

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

    tracing::debug!("Telemetry service initialized successfully");
    Ok(())
}

/// Track an event using the global telemetry instance
#[napi]
pub fn track_event(event_name: String, parameters: Option<HashMap<String, String>>) -> Result<()> {
    tracing::trace!("Tracking event: {}", event_name);
    if let Some(telemetry) = GLOBAL_TELEMETRY.get() {
        telemetry.track_event_impl(event_name, parameters)?;
    } else {
        tracing::trace!("Telemetry not initialized, skipping event");
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
    tracing::trace!(
        "Tracking page view: {} (location: {:?})",
        page_title,
        page_location
    );
    if let Some(telemetry) = GLOBAL_TELEMETRY.get() {
        telemetry.track_page_view_impl(page_title, page_location, parameters)?;
    } else {
        tracing::trace!("Telemetry not initialized, skipping page view");
    }
    Ok(())
}

/// Flush all pending telemetry data
/// This should be called before process exit
#[napi]
pub fn flush_telemetry() -> Result<()> {
    if let Some(telemetry) = GLOBAL_TELEMETRY.get() {
        telemetry.flush()?;
    }
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

// =============================================================================
// Helper functions
// =============================================================================

/// Truncate a string to a maximum byte length, ensuring we don't split UTF-8 characters
fn truncate_string(s: &str, max_bytes: usize) -> String {
    if s.len() <= max_bytes {
        return s.to_string();
    }

    // Find the last valid UTF-8 character boundary within the limit
    let mut end = max_bytes;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    s[..end].to_string()
}

/// Truncate parameter value based on whether it's a URL parameter
fn truncate_param_value(key: &str, value: &str) -> String {
    let max_len = if key == "dl" || key == "dr" {
        // URL parameters (document location, referrer) get more space
        MAX_URL_PARAM_VALUE_LENGTH
    } else {
        MAX_PARAM_VALUE_LENGTH
    };
    truncate_string(value, max_len)
}

/// Sanitize and truncate parameters, ensuring they meet GA limits
fn sanitize_params(mut params: ParameterMap) -> ParameterMap {
    let mut sanitized = HashMap::new();
    let mut custom_param_count = 0;

    for (key, value) in params.drain() {
        // Truncate key
        let truncated_key = truncate_string(&key, MAX_PARAM_NAME_LENGTH);

        // Truncate value based on parameter type
        let truncated_value = truncate_param_value(&truncated_key, &value);

        // Count custom parameters (those starting with ep., up., or without prefix)
        let is_custom = truncated_key.starts_with("ep.")
            || truncated_key.starts_with("up.")
            || (!truncated_key.starts_with("_") && truncated_key.len() <= 3);

        if is_custom {
            custom_param_count += 1;
            if custom_param_count > MAX_CUSTOM_PARAMS {
                // Skip this parameter if we've exceeded the limit
                tracing::trace!(
                    "Telemetry: Skipping parameter '{}' - exceeded max custom params",
                    truncated_key
                );
                continue;
            }
        }

        sanitized.insert(truncated_key, truncated_value);
    }

    sanitized
}

// =============================================================================
// Internal implementation
// =============================================================================

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
    event_tx: Mutex<Option<Sender<EventData>>>,
    page_view_tx: Mutex<Option<Sender<PageViewData>>>,
    flush_tx: Sender<Sender<Result<()>>>,
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
        let (event_tx, event_rx) = crossbeam_channel::unbounded();
        let (page_view_tx, page_view_rx) = crossbeam_channel::unbounded();
        let (flush_tx, flush_rx) = crossbeam_channel::unbounded();

        // Spawn background sender thread
        let common_params = common_request_parameters.clone();
        let user_params = user_parameters.clone();
        std::thread::spawn(move || {
            Self::background_sender(
                client,
                common_params,
                user_params,
                event_rx,
                page_view_rx,
                flush_rx,
            )
        });

        Ok(TelemetryService {
            event_tx: Mutex::new(Some(event_tx)),
            page_view_tx: Mutex::new(Some(page_view_tx)),
            flush_tx,
        })
    }

    /// Background thread that receives events and sends them in batches
    fn background_sender(
        client: Client,
        common_params: ParameterMap,
        user_params: ParameterMap,
        event_rx: Receiver<EventData>,
        page_view_rx: Receiver<PageViewData>,
        flush_rx: Receiver<Sender<Result<()>>>,
    ) {
        // Create a tokio runtime for async HTTP requests
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("Failed to create tokio runtime for telemetry");

        let mut event_queue = Vec::new();
        let mut page_view_queue = Vec::new();
        let mut last_send = std::time::Instant::now();

        loop {
            // Check if we should send batches periodically
            let should_send = last_send.elapsed() >= Duration::from_millis(BATCH_INTERVAL_MS);

            if should_send && (!event_queue.is_empty() || !page_view_queue.is_empty()) {
                let _ = rt.block_on(Self::send_batches(
                    &client,
                    &common_params,
                    &mut event_queue,
                    &mut page_view_queue,
                ));
                last_send = std::time::Instant::now();
            }

            // Try to receive with timeout to implement periodic flushing
            let timeout = Duration::from_millis(BATCH_INTERVAL_MS);

            crossbeam_channel::select! {
                recv(page_view_rx) -> msg => {
                    match msg {
                        Ok(page_view) => {
                            tracing::debug!("Queuing page view: {}", page_view.title);
                            let mut params = user_params.clone();
                            params.extend(page_view.parameters);
                            params.insert("en".to_string(), "page_view".to_string());
                            params.insert("dt".to_string(), truncate_string(&page_view.title, MAX_PARAM_VALUE_LENGTH));
                            params.insert("dl".to_string(), truncate_string(&page_view.location.unwrap_or(page_view.title), MAX_URL_PARAM_VALUE_LENGTH));
                            page_view_queue.push(sanitize_params(params));
                        }
                        Err(_) => break, // Channel closed
                    }
                }
                recv(event_rx) -> msg => {
                    match msg {
                        Ok(event) => {
                            tracing::debug!("Queuing event: {}", event.name);
                            let mut params = user_params.clone();
                            params.extend(event.parameters);
                            params.insert("en".to_string(), truncate_string(&event.name, MAX_EVENT_NAME_LENGTH));
                            event_queue.push(sanitize_params(params));
                        }
                        Err(_) => break, // Channel closed
                    }
                }
                recv(flush_rx) -> msg => {
                    match msg {
                        Ok(reply) => {
                            // Drain any remaining events
                            while let Ok(event) = event_rx.try_recv() {
                                let mut params = user_params.clone();
                                params.extend(event.parameters);
                                params.insert("en".to_string(), truncate_string(&event.name, MAX_EVENT_NAME_LENGTH));
                                event_queue.push(sanitize_params(params));
                            }

                            while let Ok(page_view) = page_view_rx.try_recv() {
                                let mut params = user_params.clone();
                                params.extend(page_view.parameters);
                                params.insert("en".to_string(), "page_view".to_string());
                                params.insert("dt".to_string(), truncate_string(&page_view.title, MAX_PARAM_VALUE_LENGTH));
                                params.insert("dl".to_string(), truncate_string(&page_view.location.unwrap_or(page_view.title), MAX_URL_PARAM_VALUE_LENGTH));
                                page_view_queue.push(sanitize_params(params));
                            }

                            // Send final batch
                            let result = rt.block_on(Self::send_batches(
                                &client,
                                &common_params,
                                &mut event_queue,
                                &mut page_view_queue,
                            ));
                            let _ = reply.send(result);
                            last_send = std::time::Instant::now();
                        }
                        Err(_) => break, // Channel closed
                    }
                }
                default(timeout) => {
                    // Timeout - just continue to check if we should send
                    continue;
                }
            }
        }

        // Final flush before exit
        let _ = rt.block_on(Self::send_batches(
            &client,
            &common_params,
            &mut event_queue,
            &mut page_view_queue,
        ));
    }

    async fn send_batches(
        client: &Client,
        common_params: &ParameterMap,
        event_queue: &mut Vec<ParameterMap>,
        page_view_queue: &mut Vec<ParameterMap>,
    ) -> Result<()> {
        if event_queue.is_empty() && page_view_queue.is_empty() {
            return Ok(());
        }

        // Send events in chunks of MAX_EVENTS_PER_BATCH
        if !event_queue.is_empty() {
            for chunk in event_queue.chunks(MAX_EVENTS_PER_BATCH) {
                tracing::debug!("Sending {} events", chunk.len());
                if let Err(e) = Self::send_request(client, common_params, chunk.to_vec()).await {
                    tracing::trace!("Telemetry Send Error: {}", e);
                }
            }
            event_queue.clear();
        }

        // Send page views (one per request)
        for page_view in page_view_queue.drain(..) {
            if let Some(title) = page_view.get("dt") {
                tracing::debug!("Sending page view: {}", title);
            }

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

    fn flush(&self) -> Result<()> {
        // 1. Close event channels (stop accepting new events)
        self.event_tx.lock().take();
        self.page_view_tx.lock().take();

        // 2. Send flush request and wait for background thread to drain everything
        let (tx, rx) = crossbeam_channel::bounded(0); // Rendezvous channel
        self.flush_tx
            .send(tx)
            .map_err(|_| Error::from_reason("Telemetry channel closed"))?;

        // 3. Wait for flush to complete (synchronously)
        match rx.recv() {
            Ok(result) => result,
            Err(_) => Err(Error::from_reason("Flush reply channel closed")),
        }
    }
}
