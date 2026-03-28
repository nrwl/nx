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
//! ```rust,no_run
//! use nx::native::telemetry::track_rust_event;
//! use std::collections::HashMap;
//!
//! let mut params = HashMap::new();
//! params.insert("project_count".to_string(), "42".to_string());
//! track_rust_event("workspace_analyzed", params);
//! ```

pub mod constants;
mod service;

use napi::bindgen_prelude::*;
use once_cell::sync::OnceCell;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::native::db::connection::NxDbConnection;
use constants::SESSION_TIMEOUT_SECS;
use constants::event_dimension;
use service::{TelemetryOptions, TelemetryService, persist_session_to_db};

// Global telemetry instance for Rust code to use directly
static GLOBAL_TELEMETRY: OnceCell<Arc<TelemetryService>> = OnceCell::new();

// =============================================================================
// Public NAPI API
// =============================================================================

/// Track an event using the global telemetry instance
#[napi]
pub fn track_event(event_name: String, parameters: Option<HashMap<String, String>>) -> Result<()> {
    tracing::trace!("Tracking event: {}", event_name);
    if let Some(telemetry) = GLOBAL_TELEMETRY.get() {
        telemetry.persist_session_refreshes();
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
        telemetry.persist_session_refreshes();
        telemetry.track_page_view_impl(page_title, page_location, parameters)?;
    } else {
        tracing::trace!("Telemetry not initialized, skipping page view");
    }
    Ok(())
}

/// Initialize telemetry using a DB connection.
/// Gets/creates the session ID from the DB, stores the connection
/// for persisting session refreshes on flush, and returns the session ID
/// so the caller can set it as an env var for child processes.
/// Used by CLI and daemon.
#[napi]
pub fn initialize_telemetry(
    #[napi(ts_arg_type = "ExternalObject<NxDbConnection>")] connection: &External<
        Arc<Mutex<NxDbConnection>>,
    >,
    workspace_id: String,
    user_id: String,
    nx_version: String,
    package_manager_name: String,
    package_manager_version: Option<String>,
    node_version: String,
    os_arch: String,
    os_platform: String,
    os_release: String,
    is_ci: bool,
    is_nx_cloud: bool,
) -> Result<String> {
    tracing::trace!(
        "Initializing telemetry service for workspace: {}",
        workspace_id
    );

    let session_id = get_or_create_session_id(connection)?;

    init_service(TelemetryOptions {
        session_id: session_id.clone(),
        db_connection: Some((**connection).clone()),
        workspace_id,
        user_id,
        nx_version,
        package_manager_name,
        package_manager_version,
        node_version,
        os_arch,
        os_platform,
        os_release,
        is_ci,
        is_nx_cloud,
    })?;

    Ok(session_id)
}

/// Initialize telemetry with a pre-fetched session ID.
/// No DB connection — used by plugin workers that inherit the
/// session ID from their parent process via env var.
#[napi]
pub fn initialize_telemetry_with_session_id(
    session_id: String,
    workspace_id: String,
    user_id: String,
    nx_version: String,
    package_manager_name: String,
    package_manager_version: Option<String>,
    node_version: String,
    os_arch: String,
    os_platform: String,
    os_release: String,
    is_ci: bool,
    is_nx_cloud: bool,
) -> Result<()> {
    tracing::trace!(
        "Initializing telemetry service (session from env) for workspace: {}",
        workspace_id
    );

    init_service(TelemetryOptions {
        session_id,
        workspace_id,
        user_id,
        nx_version,
        package_manager_name,
        package_manager_version,
        node_version,
        os_arch,
        os_platform,
        os_release,
        is_ci,
        is_nx_cloud,
        db_connection: None,
    })
}

fn init_service(opts: TelemetryOptions) -> Result<()> {
    let service = TelemetryService::new(opts)?;

    GLOBAL_TELEMETRY
        .set(Arc::new(service))
        .map_err(|_| Error::from_reason("Telemetry already initialized"))?;

    tracing::debug!("Telemetry service initialized successfully");
    Ok(())
}

/// Flush all pending telemetry data
/// This should be called before process exit
#[napi]
pub fn flush_telemetry() -> Result<()> {
    if let Some(telemetry) = GLOBAL_TELEMETRY.get() {
        telemetry.persist_session_refreshes();
        telemetry.flush()?;
    }
    Ok(())
}

/// Canonical event dimension and metric names for GA4.
/// TypeScript imports these from the native module instead of redefining the strings.
#[napi(object)]
pub struct EventDimensions {
    pub command: String,
    pub generator_name: String,
    pub package_name: String,
    pub package_version: String,
    pub duration: String,
    pub task_count: String,
    pub project_count: String,
    pub cached_task_count: String,
}

/// Returns the canonical event dimension names.
#[napi]
pub fn get_event_dimensions() -> EventDimensions {
    EventDimensions {
        command: event_dimension::COMMAND.to_string(),
        generator_name: event_dimension::GENERATOR_NAME.to_string(),
        package_name: event_dimension::PACKAGE_NAME.to_string(),
        package_version: event_dimension::PACKAGE_VERSION.to_string(),
        duration: event_dimension::DURATION.to_string(),
        task_count: event_dimension::TASK_COUNT.to_string(),
        project_count: event_dimension::PROJECT_COUNT.to_string(),
        cached_task_count: event_dimension::CACHED_TASK_COUNT.to_string(),
    }
}

// =============================================================================
// Rust-only API
// =============================================================================

/// Track an event from Rust code
/// This is a fire-and-forget operation - errors are logged but not returned
pub fn track_rust_event(event_name: impl Into<String>, parameters: HashMap<String, String>) {
    if let Some(telemetry) = GLOBAL_TELEMETRY.get() {
        if let Err(e) = telemetry.track_event_impl(event_name.into(), Some(parameters)) {
            tracing::trace!("Failed to track event: {}", e);
        }
    }
}

/// Get or create an analytics session ID from the database.
/// Reuses an existing session if the last activity was within 30 minutes,
/// otherwise creates a new session.
fn get_or_create_session_id(connection: &External<Arc<Mutex<NxDbConnection>>>) -> Result<String> {
    let mut conn = connection
        .lock()
        .map_err(|e| Error::from_reason(format!("Failed to lock database connection: {}", e)))?;

    // Return session ID only if it exists and last activity was within 30 minutes
    let active_session = conn
        .query_row(
            &format!(
                "SELECT m1.value FROM metadata m1, metadata m2 \
                 WHERE m1.key = 'SESSION_ID' AND m2.key = 'SESSION_LAST_ACTIVITY' \
                 AND (strftime('%s', 'now') - strftime('%s', m2.value)) < {}",
                SESSION_TIMEOUT_SECS as i64
            ),
            [],
            |row| row.get::<_, String>(0),
        )
        .map_err(|e| Error::from_reason(format!("Failed to query session: {}", e)))?;

    let session_id = if let Some(id) = active_session {
        tracing::trace!("Reusing existing analytics session: {}", id);
        id
    } else {
        let id = uuid::Uuid::new_v4().to_string();
        tracing::trace!("Created new analytics session: {}", id);
        id
    };

    // Persist session ID and update activity timestamp
    persist_session_to_db(&mut conn, &session_id);

    Ok(session_id)
}
