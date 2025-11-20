use crate::types::{FileWatcherChange, FileWatcherConfig};
use async_trait::async_trait;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::broadcast;

/// Callback type for file watcher notifications
#[async_trait]
pub trait FileWatcherCallback: Send + Sync {
    async fn on_change(&self, changes: FileWatcherChange);
    async fn on_error(&self, error: String);
    async fn on_reconnecting(&self);
    async fn on_reconnected(&self);
    async fn on_closed(&self);
}

/// Registry for file watcher callbacks
pub struct FileWatcherRegistry {
    callbacks: DashMap<String, Arc<dyn FileWatcherCallback>>,
    configs: DashMap<String, FileWatcherConfig>,
    broadcast_tx: broadcast::Sender<FileWatcherChange>,
}

impl FileWatcherRegistry {
    pub fn new(broadcast_capacity: usize) -> Self {
        let (broadcast_tx, _) = broadcast::channel(broadcast_capacity);
        FileWatcherRegistry {
            callbacks: DashMap::new(),
            configs: DashMap::new(),
            broadcast_tx,
        }
    }

    /// Register a file watcher callback
    pub fn register(
        &self,
        id: String,
        callback: Arc<dyn FileWatcherCallback>,
        config: FileWatcherConfig,
    ) {
        self.callbacks.insert(id.clone(), callback);
        self.configs.insert(id, config);
    }

    /// Unregister a file watcher callback
    pub fn unregister(&self, id: &str) {
        self.callbacks.remove(id);
        self.configs.remove(id);
    }

    /// Broadcast changes to all watchers
    pub async fn broadcast(&self, changes: FileWatcherChange) {
        // Send to broadcast channel (for new subscribers)
        let _ = self.broadcast_tx.send(changes.clone());

        // Send to registered callbacks
        for entry in self.callbacks.iter() {
            entry.value().on_change(changes.clone()).await;
        }
    }

    /// Notify all watchers of error
    pub async fn broadcast_error(&self, error: String) {
        for entry in self.callbacks.iter() {
            entry.value().on_error(error.clone()).await;
        }
    }

    /// Notify all watchers of reconnection
    pub async fn broadcast_reconnecting(&self) {
        for entry in self.callbacks.iter() {
            entry.value().on_reconnecting().await;
        }
    }

    /// Notify all watchers of reconnection success
    pub async fn broadcast_reconnected(&self) {
        for entry in self.callbacks.iter() {
            entry.value().on_reconnected().await;
        }
    }

    /// Notify all watchers of closure
    pub async fn broadcast_closed(&self) {
        for entry in self.callbacks.iter() {
            entry.value().on_closed().await;
        }
    }

    /// Get number of registered watchers
    pub fn count(&self) -> usize {
        self.callbacks.len()
    }

    /// Get broadcast receiver for new subscribers
    pub fn subscribe(&self) -> broadcast::Receiver<FileWatcherChange> {
        self.broadcast_tx.subscribe()
    }
}

impl Clone for FileWatcherRegistry {
    fn clone(&self) -> Self {
        FileWatcherRegistry {
            callbacks: self.callbacks.clone(),
            configs: self.configs.clone(),
            broadcast_tx: self.broadcast_tx.clone(),
        }
    }
}

/// Registry for project graph listener callbacks
pub struct ProjectGraphListenerRegistry {
    callbacks: DashMap<String, Arc<dyn FileWatcherCallback>>,
    broadcast_tx: broadcast::Sender<serde_json::Value>,
}

impl ProjectGraphListenerRegistry {
    pub fn new(broadcast_capacity: usize) -> Self {
        let (broadcast_tx, _) = broadcast::channel(broadcast_capacity);
        ProjectGraphListenerRegistry {
            callbacks: DashMap::new(),
            broadcast_tx,
        }
    }

    /// Register a project graph listener callback
    pub fn register(&self, id: String, callback: Arc<dyn FileWatcherCallback>) {
        self.callbacks.insert(id, callback);
    }

    /// Unregister a project graph listener callback
    pub fn unregister(&self, id: &str) {
        self.callbacks.remove(id);
    }

    /// Broadcast project graph to all listeners
    pub async fn broadcast(&self, graph: serde_json::Value) {
        let _ = self.broadcast_tx.send(graph);

        // Note: In real implementation, would call callbacks with the new graph
    }

    /// Get number of registered listeners
    pub fn count(&self) -> usize {
        self.callbacks.len()
    }
}

impl Clone for ProjectGraphListenerRegistry {
    fn clone(&self) -> Self {
        ProjectGraphListenerRegistry {
            callbacks: self.callbacks.clone(),
            broadcast_tx: self.broadcast_tx.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestCallback;

    #[async_trait]
    impl FileWatcherCallback for TestCallback {
        async fn on_change(&self, _: FileWatcherChange) {}
        async fn on_error(&self, _: String) {}
        async fn on_reconnecting(&self) {}
        async fn on_reconnected(&self) {}
        async fn on_closed(&self) {}
    }

    #[test]
    fn test_register_watcher() {
        let registry = FileWatcherRegistry::new(100);
        let callback = Arc::new(TestCallback);

        registry.register(
            "watcher-1".to_string(),
            callback,
            FileWatcherConfig {
                watch_projects: crate::types::WatchProjectsConfig::All("all".to_string()),
                include_global_workspace_files: Some(true),
                include_dependent_projects: Some(false),
                allow_partial_graph: Some(false),
            },
        );

        assert_eq!(registry.count(), 1);
    }

    #[test]
    fn test_unregister_watcher() {
        let registry = FileWatcherRegistry::new(100);
        let callback = Arc::new(TestCallback);

        registry.register(
            "watcher-1".to_string(),
            callback,
            FileWatcherConfig {
                watch_projects: crate::types::WatchProjectsConfig::All("all".to_string()),
                include_global_workspace_files: None,
                include_dependent_projects: None,
                allow_partial_graph: None,
            },
        );

        assert_eq!(registry.count(), 1);

        registry.unregister("watcher-1");
        assert_eq!(registry.count(), 0);
    }
}
