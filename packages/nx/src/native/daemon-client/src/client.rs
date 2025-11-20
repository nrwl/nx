use crate::error::Result;
use crate::messenger::DaemonMessenger;
use crate::queue::RequestQueue;
use crate::reconnect::{retry_with_backoff, ReconnectConfig};
use crate::socket::{self, DaemonSocket};
use crate::types::*;
use crate::watchers::{FileWatcherRegistry, ProjectGraphListenerRegistry};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use tokio::sync::Mutex;
use tokio::sync::RwLock;
use tracing::{debug, info};

/// Main daemon client singleton
pub struct DaemonClient {
    workspace_root: String,
    enabled: AtomicBool,
    status: RwLock<DaemonStatus>,
    socket: tokio::sync::Mutex<Option<DaemonSocket>>,
    messenger: DaemonMessenger,
    queue: RequestQueue,
    request_id: AtomicU64,
    file_watcher_registry: FileWatcherRegistry,
    project_graph_listener_registry: ProjectGraphListenerRegistry,
    reconnect_config: ReconnectConfig,
}

impl DaemonClient {
    /// Create new daemon client
    pub fn new() -> Self {
        let workspace_root = std::env::var("NX_WORKSPACE_ROOT")
            .unwrap_or_else(|_| std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default());

        DaemonClient {
            workspace_root,
            enabled: AtomicBool::new(true),
            status: RwLock::new(DaemonStatus::Disconnected),
            socket: Mutex::new(None),
            messenger: DaemonMessenger::new(),
            queue: RequestQueue::new(1000),
            request_id: AtomicU64::new(1),
            file_watcher_registry: FileWatcherRegistry::new(100),
            project_graph_listener_registry: ProjectGraphListenerRegistry::new(100),
            reconnect_config: ReconnectConfig::default(),
        }
    }

    /// Check if daemon is enabled
    pub fn enabled(&self) -> bool {
        self.enabled.load(Ordering::Relaxed)
    }

    /// Set whether daemon is enabled
    pub fn set_enabled(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::Relaxed);
    }

    /// Get current daemon status
    pub async fn status(&self) -> DaemonStatus {
        *self.status.read().await
    }

    /// Connect to daemon server
    pub async fn connect(&self) -> Result<()> {
        if !self.enabled() {
            debug!("Daemon is disabled");
            return Err(crate::error::DaemonClientError::DaemonNotAvailable);
        }

        let socket_path = socket::get_socket_path(&self.workspace_root);
        debug!("Connecting to daemon at: {}", socket_path);

        let socket = retry_with_backoff(
            || async {
                DaemonSocket::connect(&socket_path).await
            },
            &self.reconnect_config,
        )
        .await?;

        *self.socket.lock().await = Some(socket);
        *self.status.write().await = DaemonStatus::Connected;
        info!("Connected to daemon");

        Ok(())
    }

    /// Disconnect from daemon
    pub async fn disconnect(&self) -> Result<()> {
        let mut socket_guard = self.socket.lock().await;
        if let Some(mut s) = socket_guard.take() {
            s.close().await?;
        }
        drop(socket_guard);
        *self.status.write().await = DaemonStatus::Disconnected;
        info!("Disconnected from daemon");
        Ok(())
    }

    /// Reset client state
    pub async fn reset(&self) {
        let _ = self.disconnect().await;
        self.request_id.store(1, Ordering::Relaxed);
    }

    /// Get next request ID
    fn next_request_id(&self) -> u64 {
        self.request_id.fetch_add(1, Ordering::Relaxed)
    }

    /// Get project graph from daemon
    pub async fn get_project_graph(&self) -> Result<ProjectGraphResponse> {
        debug!("Requesting project graph from daemon");

        self.connect().await?;

        let msg = DaemonMessenger::create_request("REQUEST_PROJECT_GRAPH", None);
        let response = self.send_request(&msg).await?;

        let graph = ProjectGraphResponse {
            project_graph: response.get("projectGraph").cloned().unwrap_or_default(),
            source_maps: response.get("sourceMaps").cloned().unwrap_or_default(),
        };

        Ok(graph)
    }

    /// Get all file data from daemon
    pub async fn get_all_file_data(&self) -> Result<Vec<serde_json::Value>> {
        debug!("Requesting file data from daemon");

        self.connect().await?;

        let msg = DaemonMessenger::create_request("REQUEST_FILE_DATA", None);
        let response = self.send_request(&msg).await?;

        Ok(response.as_array().cloned().unwrap_or_default())
    }

    /// Send a request and wait for response
    async fn send_request(&self, request: &serde_json::Value) -> Result<serde_json::Value> {
        let mut socket_guard = self.socket.lock().await;
        if socket_guard.is_none() {
            return Err(crate::error::DaemonClientError::DaemonNotAvailable);
        }

        let serialized = self.messenger.serialize_message(request)?;

        if let Some(socket) = socket_guard.as_mut() {
            socket.send(&serialized).await?;
            // TODO: Receive response
        }

        Err(crate::error::DaemonClientError::InvalidResponse)
    }

    /// Get file watcher registry
    pub fn file_watcher_registry(&self) -> &FileWatcherRegistry {
        &self.file_watcher_registry
    }

    /// Get project graph listener registry
    pub fn project_graph_listener_registry(&self) -> &ProjectGraphListenerRegistry {
        &self.project_graph_listener_registry
    }
}

impl Default for DaemonClient {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = DaemonClient::new();
        assert!(client.enabled());
    }

    #[test]
    fn test_request_id_increment() {
        let client = DaemonClient::new();
        let id1 = client.next_request_id();
        let id2 = client.next_request_id();
        assert_eq!(id2, id1 + 1);
    }

    #[tokio::test]
    async fn test_enabled_flag() {
        let client = DaemonClient::new();
        assert!(client.enabled());

        client.set_enabled(false);
        assert!(!client.enabled());

        client.set_enabled(true);
        assert!(client.enabled());
    }

    #[tokio::test]
    async fn test_status_tracking() {
        let client = DaemonClient::new();
        assert_eq!(client.status().await, DaemonStatus::Disconnected);
    }
}
