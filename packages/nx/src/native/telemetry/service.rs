use crossbeam_channel::{self, Receiver, Sender};
use napi::bindgen_prelude::*;
use parking_lot::Mutex;
use reqwest::{Client, ClientBuilder};
use std::collections::HashMap;
use std::time::Duration;

use super::constants::*;

pub type ParameterMap = HashMap<String, String>;

/// Event data to be tracked
#[derive(Debug, Clone)]
pub(crate) struct EventData {
    pub name: String,
    pub parameters: ParameterMap,
}

/// Page view data to be tracked
#[derive(Debug, Clone)]
pub(crate) struct PageViewData {
    pub title: String,
    pub location: Option<String>,
    pub parameters: ParameterMap,
}

/// Configuration for initializing the telemetry service.
pub(crate) struct TelemetryOptions {
    pub session_id: String,
    pub workspace_id: String,
    pub user_id: String,
    pub nx_version: String,
    pub package_manager_name: String,
    pub package_manager_version: Option<String>,
    pub node_version: String,
    pub os_arch: String,
    pub os_platform: String,
    pub os_release: String,
    pub is_ci: bool,
    pub is_nx_cloud: bool,
    pub db_connection: Option<DbConnection>,
}

/// Type alias for the DB connection shared between modules.
pub(crate) type DbConnection =
    std::sync::Arc<std::sync::Mutex<crate::native::db::connection::NxDbConnection>>;

/// Internal telemetry service - not exposed to JavaScript
pub struct TelemetryService {
    event_tx: Mutex<Option<Sender<EventData>>>,
    page_view_tx: Mutex<Option<Sender<PageViewData>>>,
    flush_tx: Sender<Sender<Result<()>>>,
    /// Receives new session IDs from the background thread when it
    /// refreshes a stale session. The main thread drains this and
    /// persists to the DB.
    session_refresh_rx: Receiver<String>,
    /// Optional DB connection for persisting session refreshes.
    /// Only set by CLI/daemon, not by plugin workers.
    db_connection: Option<DbConnection>,
}

impl TelemetryService {
    pub fn new(opts: TelemetryOptions) -> Result<Self> {
        let client = ClientBuilder::new()
            .build()
            .map_err(|e| Error::from_reason(format!("Failed to create HTTP client: {}", e)))?;

        // Detect AI agent from environment variables
        let is_ai_agent = crate::native::utils::ai::is_ai_agent();

        let mut common_request_parameters = HashMap::new();
        common_request_parameters
            .insert(request_param::PROTOCOL_VERSION.to_string(), "2".to_string());
        common_request_parameters.insert(
            request_param::CLIENT_ID.to_string(),
            opts.workspace_id.clone(),
        );
        common_request_parameters.insert(request_param::USER_ID.to_string(), opts.user_id.clone());
        common_request_parameters.insert(
            request_param::TRACKING_ID.to_string(),
            TRACKING_ID_PROD.to_string(),
        );
        common_request_parameters.insert(
            request_param::USER_AGENT_ARCHITECTURE.to_string(),
            opts.os_arch.clone(),
        );
        common_request_parameters.insert(
            request_param::USER_AGENT_PLATFORM.to_string(),
            opts.os_platform,
        );
        common_request_parameters.insert(
            request_param::USER_AGENT_PLATFORM_VERSION.to_string(),
            opts.os_release,
        );
        common_request_parameters.insert(
            request_param::USER_AGENT_MOBILE.to_string(),
            "0".to_string(),
        );
        common_request_parameters
            .insert(request_param::SESSION_ENGAGED.to_string(), "1".to_string());
        common_request_parameters.insert(
            request_param::USER_AGENT_FULL_VERSION_LIST.to_string(),
            "Google%20Chrome;111.0.5563.64|Not(A%3ABrand;8.0.0.0|Chromium;111.0.5563.64"
                .to_string(),
        );
        if std::env::var("NX_DEBUG_TELEMETRY").unwrap_or_default() == "true" {
            common_request_parameters
                .insert(request_param::DEBUG_VIEW.to_string(), "1".to_string());
        }

        let mut user_parameters = HashMap::new();
        user_parameters.insert(user_dimension::OS_ARCHITECTURE.to_string(), opts.os_arch);
        user_parameters.insert(user_dimension::USER_ID.to_string(), opts.user_id);
        user_parameters.insert(user_dimension::NODE_VERSION.to_string(), opts.node_version);
        user_parameters.insert(
            user_dimension::PACKAGE_MANAGER.to_string(),
            opts.package_manager_name,
        );
        if let Some(version) = opts.package_manager_version {
            user_parameters.insert(user_dimension::PACKAGE_MANAGER_VERSION.to_string(), version);
        }
        user_parameters.insert(
            user_dimension::NX_VERSION.to_string(),
            opts.nx_version.clone(),
        );
        user_parameters.insert(event_dimension::NX_VERSION.to_string(), opts.nx_version);
        user_parameters.insert(
            event_dimension::IS_AI_AGENT.to_string(),
            is_ai_agent.to_string(),
        );
        user_parameters.insert(user_dimension::IS_CI.to_string(), opts.is_ci.to_string());
        user_parameters.insert(
            user_dimension::NX_CLOUD_ENABLED.to_string(),
            opts.is_nx_cloud.to_string(),
        );

        // Create channels
        let (event_tx, event_rx) = crossbeam_channel::unbounded();
        let (page_view_tx, page_view_rx) = crossbeam_channel::unbounded();
        let (flush_tx, flush_rx) = crossbeam_channel::unbounded();
        let (session_refresh_tx, session_refresh_rx) = crossbeam_channel::unbounded();

        // Spawn background sender thread
        let common_params = common_request_parameters.clone();
        let user_params = user_parameters.clone();
        std::thread::spawn(move || {
            background_sender(
                client,
                common_params,
                user_params,
                opts.session_id,
                event_rx,
                page_view_rx,
                flush_rx,
                session_refresh_tx,
            )
        });

        Ok(TelemetryService {
            event_tx: Mutex::new(Some(event_tx)),
            page_view_tx: Mutex::new(Some(page_view_tx)),
            flush_tx,
            session_refresh_rx,
            db_connection: opts.db_connection,
        })
    }

    /// Drain any session refreshes from the background thread, persist
    /// the latest one to the DB (if a connection is available), and
    /// update the env var so child processes inherit the new session.
    pub fn persist_session_refreshes(&self) {
        let mut latest = None;
        while let Ok(session_id) = self.session_refresh_rx.try_recv() {
            latest = Some(session_id);
        }
        if let Some(ref new_session_id) = latest {
            // SAFETY: Called from Node's main JS thread during flush.
            // No concurrent env access — Node is single-threaded for JS
            // and our Rust background thread doesn't read env vars.
            unsafe {
                std::env::set_var("NX_ANALYTICS_SESSION_ID", new_session_id);
            }

            if let Some(conn) = &self.db_connection {
                if let Ok(mut conn) = conn.lock() {
                    persist_session_to_db(&mut conn, new_session_id);
                }
            }
        }
    }

    pub fn track_event_impl(
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

    pub fn track_page_view_impl(
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

    pub fn flush(&self) -> Result<()> {
        // 1. Send flush request FIRST (before closing channels, to avoid race
        //    where the background thread sees closed channels and exits before
        //    processing the flush).
        let (tx, rx) = crossbeam_channel::bounded(0); // Rendezvous channel
        self.flush_tx
            .send(tx)
            .map_err(|_| Error::from_reason("Telemetry channel closed"))?;

        // 2. Close event channels (stop accepting new events)
        self.event_tx.lock().take();
        self.page_view_tx.lock().take();

        // 3. Wait for flush to complete (synchronously)
        match rx.recv() {
            Ok(result) => result,
            Err(_) => Err(Error::from_reason("Flush reply channel closed")),
        }
    }
}

// =============================================================================
// Background sender and helpers
// =============================================================================

/// Convert an EventData into sanitized params and push onto the queue
fn enqueue_event(
    event: EventData,
    user_params: &ParameterMap,
    current_page_title: Option<&str>,
    queue: &mut Vec<ParameterMap>,
) {
    let mut params = user_params.clone();
    params.extend(event.parameters);
    params.insert(
        event_param::EVENT_NAME.to_string(),
        truncate_string(&event.name, MAX_EVENT_NAME_LENGTH),
    );
    if let Some(title) = current_page_title {
        params
            .entry(event_param::DOCUMENT_TITLE.to_string())
            .or_insert_with(|| title.to_string());
    }
    queue.push(sanitize_params(params));
}

/// Convert a PageViewData into sanitized params and push onto the queue
fn enqueue_page_view(
    page_view: PageViewData,
    user_params: &ParameterMap,
    queue: &mut Vec<ParameterMap>,
) {
    let mut params = user_params.clone();
    params.extend(page_view.parameters);
    params.insert(event_param::EVENT_NAME.to_string(), "page_view".to_string());
    params.insert(
        event_param::DOCUMENT_TITLE.to_string(),
        truncate_string(&page_view.title, MAX_PARAM_VALUE_LENGTH),
    );
    params.insert(
        event_param::DOCUMENT_LOCATION.to_string(),
        truncate_string(
            &page_view.location.unwrap_or(page_view.title),
            MAX_URL_PARAM_VALUE_LENGTH,
        ),
    );
    queue.push(sanitize_params(params));
}

/// Drain all pending events and page views from channels into queues
fn drain_channels(
    event_rx: &Receiver<EventData>,
    page_view_rx: &Receiver<PageViewData>,
    user_params: &ParameterMap,
    current_page_title: &mut Option<String>,
    event_queue: &mut Vec<ParameterMap>,
    page_view_queue: &mut Vec<ParameterMap>,
) {
    while let Ok(event) = event_rx.try_recv() {
        enqueue_event(event, user_params, current_page_title.as_deref(), event_queue);
    }
    while let Ok(page_view) = page_view_rx.try_recv() {
        *current_page_title = Some(page_view.title.clone());
        enqueue_page_view(page_view, user_params, page_view_queue);
    }
}

/// Background thread that receives events and sends them in batches
fn background_sender(
    client: Client,
    common_params: ParameterMap,
    user_params: ParameterMap,
    initial_session_id: String,
    event_rx: Receiver<EventData>,
    page_view_rx: Receiver<PageViewData>,
    flush_rx: Receiver<Sender<Result<()>>>,
    session_refresh_tx: Sender<String>,
) {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("Failed to create tokio runtime for telemetry");

    let mut common_params = common_params;
    // Insert initial session ID into common params. SessionState.touch()
    // will update it in-place only when the session actually refreshes.
    common_params.insert(
        request_param::SESSION_ID.to_string(),
        initial_session_id.clone(),
    );
    let mut session = SessionState::new(initial_session_id, session_refresh_tx);
    let mut current_page_title: Option<String> = None;
    let mut event_queue = Vec::new();
    let mut page_view_queue = Vec::new();
    let mut last_send = std::time::Instant::now();

    loop {
        let should_send = last_send.elapsed() >= Duration::from_millis(BATCH_INTERVAL_MS);

        if should_send && (!event_queue.is_empty() || !page_view_queue.is_empty()) {
            let _ = rt.block_on(send_batches(
                &client,
                &common_params,
                &mut event_queue,
                &mut page_view_queue,
            ));
            last_send = std::time::Instant::now();
        }

        let timeout = Duration::from_millis(BATCH_INTERVAL_MS);

        crossbeam_channel::select! {
            recv(page_view_rx) -> msg => {
                match msg {
                    Ok(page_view) => {
                        session.touch(&mut common_params);
                        tracing::trace!("Queuing page view: {}", page_view.title);
                        current_page_title = Some(page_view.title.clone());
                        enqueue_page_view(page_view, &user_params, &mut page_view_queue);
                    }
                    Err(_) => break,
                }
            }
            recv(event_rx) -> msg => {
                match msg {
                    Ok(event) => {
                        session.touch(&mut common_params);
                        tracing::trace!("Queuing event: {}", event.name);
                        enqueue_event(event, &user_params, current_page_title.as_deref(), &mut event_queue);
                    }
                    Err(_) => break,
                }
            }
            recv(flush_rx) -> msg => {
                match msg {
                    Ok(reply) => {
                        drain_channels(&event_rx, &page_view_rx, &user_params, &mut current_page_title, &mut event_queue, &mut page_view_queue);
                        let result = rt.block_on(send_batches(
                            &client,
                            &common_params,
                            &mut event_queue,
                            &mut page_view_queue,
                        ));
                        let _ = reply.send(result);
                        last_send = std::time::Instant::now();
                    }
                    Err(_) => break,
                }
            }
            default(timeout) => {
                drain_channels(&event_rx, &page_view_rx, &user_params, &mut current_page_title, &mut event_queue, &mut page_view_queue);
                let _ = rt.block_on(send_batches(
                    &client,
                    &common_params,
                    &mut event_queue,
                    &mut page_view_queue,
                ));
            }
        }
    }

    // Final flush before exit
    let _ = rt.block_on(send_batches(
        &client,
        &common_params,
        &mut event_queue,
        &mut page_view_queue,
    ));
}

/// Write a session ID and activity timestamp to the metadata table
/// inside a single transaction.
pub(crate) fn persist_session_to_db(
    conn: &mut crate::native::db::connection::NxDbConnection,
    session_id: &str,
) {
    let sid = session_id.to_string();
    let _ = conn.transaction(move |tx| {
        tx.execute(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES ('SESSION_ID', ?1)",
            [&sid],
        )?;
        tx.execute(
            "INSERT OR REPLACE INTO metadata (key, value) \
             VALUES ('SESSION_LAST_ACTIVITY', datetime('now'))",
            [],
        )?;
        Ok(())
    });
}

/// Tracks the current session ID and refreshes it after inactivity.
/// When a refresh happens, the new session ID is sent to the main thread
/// via a channel so it can be persisted to the DB.
struct SessionState {
    session_id: String,
    last_activity: std::time::Instant,
    refresh_tx: Sender<String>,
}

impl SessionState {
    fn new(session_id: String, refresh_tx: Sender<String>) -> Self {
        Self {
            session_id,
            last_activity: std::time::Instant::now(),
            refresh_tx,
        }
    }

    /// Called when a new event or page view is received.
    /// If the session has been idle for longer than the timeout,
    /// generates a new session ID, updates common_params in-place,
    /// and notifies the main thread so it can persist to the DB.
    fn touch(&mut self, common_params: &mut ParameterMap) {
        if self.last_activity.elapsed() >= Duration::from_secs(SESSION_TIMEOUT_SECS) {
            self.session_id = uuid::Uuid::new_v4().to_string();
            let id = self.session_id.clone();
            common_params.insert(request_param::SESSION_ID.to_string(), id.clone());
            let _ = self.refresh_tx.send(id);
            tracing::debug!(
                "Session idle for >30 min, starting new session: {}",
                self.session_id
            );
        }
        self.last_activity = std::time::Instant::now();
    }
}

fn log_page_view(level: &str, prefix: &str, title: &Option<String>, location: &Option<String>) {
    if let Some(t) = title {
        if let Some(l) = location {
            if t != l {
                match level {
                    "trace" => tracing::trace!("{} page view: {} (location: {})", prefix, t, l),
                    "debug" => tracing::debug!("{} page view: {} (location: {})", prefix, t, l),
                    _ => {}
                }
            } else {
                match level {
                    "trace" => tracing::trace!("{} page view: {}", prefix, t),
                    "debug" => tracing::debug!("{} page view: {}", prefix, t),
                    _ => {}
                }
            }
        } else {
            match level {
                "trace" => tracing::trace!("{} page view: {}", prefix, t),
                "debug" => tracing::debug!("{} page view: {}", prefix, t),
                _ => {}
            }
        }
    }
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

    if !event_queue.is_empty() {
        for chunk in event_queue.chunks(MAX_EVENTS_PER_BATCH) {
            let event_names: Vec<String> = chunk
                .iter()
                .filter_map(|params| params.get(event_param::EVENT_NAME).cloned())
                .collect();
            tracing::trace!(
                "Sending {} events: [{}]",
                chunk.len(),
                event_names.join(", ")
            );
            match send_request(client, common_params, chunk.to_vec()).await {
                Ok(_) => {
                    tracing::debug!("Sent {} events: [{}]", chunk.len(), event_names.join(", "));
                }
                Err(e) => {
                    tracing::trace!("Telemetry Send Error: {}", e);
                }
            }
        }
        event_queue.clear();
    }

    for page_view in page_view_queue.drain(..) {
        let title = page_view.get(event_param::DOCUMENT_TITLE).cloned();
        let location = page_view.get(event_param::DOCUMENT_LOCATION).cloned();

        log_page_view("trace", "Sending", &title, &location);

        let mut request_params = common_params.clone();
        if let Some(ref t) = title {
            request_params.insert(event_param::DOCUMENT_TITLE.to_string(), t.clone());
        }
        if let Some(ref l) = location {
            request_params.insert(event_param::DOCUMENT_LOCATION.to_string(), l.clone());
        }

        match send_request(client, &request_params, vec![page_view]).await {
            Ok(_) => {
                log_page_view("debug", "Sent", &title, &location);
            }
            Err(e) => {
                tracing::trace!("Telemetry Send Error: {}", e);
            }
        }
    }

    Ok(())
}

async fn send_request(
    client: &Client,
    parameters: &ParameterMap,
    data: Vec<ParameterMap>,
) -> Result<()> {
    let query_string = build_query_string(parameters);
    let url = format!("{}?{}", GA_ENDPOINT, query_string);

    let body = data
        .iter()
        .map(|params| build_query_string(params))
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

// =============================================================================
// Sanitization helpers
// =============================================================================

/// Truncate a string to a maximum byte length, ensuring we don't split UTF-8 characters
fn truncate_string(s: &str, max_bytes: usize) -> String {
    if s.len() <= max_bytes {
        return s.to_string();
    }

    let mut end = max_bytes;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    s[..end].to_string()
}

/// Truncate parameter value based on whether it's a URL parameter
fn truncate_param_value(key: &str, value: &str) -> String {
    let max_len = if key == event_param::DOCUMENT_LOCATION || key == "dr" {
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
        let truncated_key = truncate_string(&key, MAX_PARAM_NAME_LENGTH);
        let truncated_value = truncate_param_value(&truncated_key, &value);

        let is_custom = truncated_key.starts_with("ep.")
            || truncated_key.starts_with("up.")
            || (!truncated_key.starts_with("_") && truncated_key.len() <= 3);

        if is_custom {
            custom_param_count += 1;
            if custom_param_count > MAX_CUSTOM_PARAMS {
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
