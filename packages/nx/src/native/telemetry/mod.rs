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
use std::sync::Arc;

use constants::event_dimension;
use service::TelemetryService;

// Global telemetry instance for Rust code to use directly
static GLOBAL_TELEMETRY: OnceCell<Arc<TelemetryService>> = OnceCell::new();

// =============================================================================
// Public NAPI API
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
    is_ci: bool,
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
        is_ci,
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
