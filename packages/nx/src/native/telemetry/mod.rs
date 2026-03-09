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
use constants::event_dimension;
use service::TelemetryService;

/// Session timeout in seconds (30 minutes)
const SESSION_TIMEOUT_SECS: i64 = 30 * 60;

// Global telemetry instance for Rust code to use directly
static GLOBAL_TELEMETRY: OnceCell<Arc<TelemetryService>> = OnceCell::new();

// =============================================================================
// Public NAPI API
// =============================================================================

/// Initialize the global telemetry service.
/// Reads or creates a session ID from the database so that multiple CLI
/// invocations within 30 minutes share the same GA4 session.
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
) -> Result<()> {
    tracing::trace!(
        "Initializing telemetry service for workspace: {}",
        workspace_id
    );

    let session_id = get_or_create_session_id(connection)?;

    let service = TelemetryService::new(
        workspace_id,
        user_id,
        session_id,
        nx_version,
        package_manager_name,
        package_manager_version,
        node_version,
        os_arch,
        os_platform,
        os_release,
        is_ci,
        is_nx_cloud,
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

/// Canonical event dimension and metric names for GA4.
/// TypeScript imports these from the native module instead of redefining the strings.
#[napi(object)]
pub struct EventDimensions {
    pub command: String,
    pub generator_name: String,
    pub package_name: String,
    pub package_version: String,
    pub create_project_graph: String,
    pub duration: String,
}

/// Returns the canonical event dimension names.
#[napi]
pub fn get_event_dimensions() -> EventDimensions {
    EventDimensions {
        command: event_dimension::COMMAND.to_string(),
        generator_name: event_dimension::GENERATOR_NAME.to_string(),
        package_name: event_dimension::PACKAGE_NAME.to_string(),
        package_version: event_dimension::PACKAGE_VERSION.to_string(),
        create_project_graph: event_dimension::CREATE_PROJECT_GRAPH.to_string(),
        duration: event_dimension::DURATION.to_string(),
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
    let conn = connection
        .lock()
        .map_err(|e| Error::from_reason(format!("Failed to lock database connection: {}", e)))?;

    // Try to get existing session
    let existing = conn
        .query_row(
            "SELECT m1.value, m2.value FROM metadata m1, metadata m2 \
             WHERE m1.key = 'SESSION_ID' AND m2.key = 'SESSION_LAST_ACTIVITY'",
            [],
            |row| {
                let session_id: String = row.get(0)?;
                let last_activity: String = row.get(1)?;
                Ok((session_id, last_activity))
            },
        )
        .map_err(|e| Error::from_reason(format!("Failed to query session: {}", e)))?;

    if let Some((session_id, last_activity)) = existing {
        // Check if session is still active (within timeout)
        let is_active = conn
            .query_row(
                &format!(
                    "SELECT (strftime('%s', 'now') - strftime('%s', '{}')) < {}",
                    last_activity, SESSION_TIMEOUT_SECS
                ),
                [],
                |row| {
                    let active: bool = row.get(0)?;
                    Ok(active)
                },
            )
            .map_err(|e| Error::from_reason(format!("Failed to check session timeout: {}", e)))?
            .unwrap_or(false);

        if is_active {
            // Update last activity and reuse session
            conn.execute(
                "INSERT OR REPLACE INTO metadata (key, value) VALUES ('SESSION_LAST_ACTIVITY', datetime('now'))",
                [],
            )
            .map_err(|e| {
                Error::from_reason(format!("Failed to update session activity: {}", e))
            })?;

            tracing::trace!("Reusing existing analytics session: {}", session_id);
            return Ok(session_id);
        }
    }

    // Create new session
    let session_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT OR REPLACE INTO metadata (key, value) VALUES ('SESSION_ID', ?1)",
        [&session_id],
    )
    .map_err(|e| Error::from_reason(format!("Failed to save session ID: {}", e)))?;

    conn.execute(
        "INSERT OR REPLACE INTO metadata (key, value) VALUES ('SESSION_LAST_ACTIVITY', datetime('now'))",
        [],
    )
    .map_err(|e| {
        Error::from_reason(format!("Failed to save session activity: {}", e))
    })?;

    tracing::trace!("Created new analytics session: {}", session_id);
    Ok(session_id)
}
