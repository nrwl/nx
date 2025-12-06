use std::{collections::HashMap, sync::Arc, time::Duration};

use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tokio::time::Instant;
use tracing::{debug, trace};

use jsonrpsee::{
    async_client::{Client, ClientBuilder},
    proc_macros::rpc,
};

use crate::native::{
    ide::nx_console::ipc_transport::IpcTransport,
    tui::{
        components::tasks_list::{TaskItem, TaskStatus},
        pty::PtyInstance,
    },
    utils::socket_path::get_full_nx_console_socket_path,
};

#[derive(Serialize, Deserialize)]
pub struct UpdatedRunningTask {
    pub name: String,
    pub status: TaskStatus,
    pub output: String,
    pub continuous: bool,
}

#[rpc(client, namespace = "nx", namespace_separator = "/")]
pub trait ConsoleRpc {
    #[method(name = "terminalMessage")]
    fn terminal_message(&self, text: String);

    #[method(name = "updateRunningTasks")]
    fn update_running_tasks(&self, process_id: u32, updates: Vec<UpdatedRunningTask>);
    #[method(name = "startedRunningTasks")]
    fn start_running_tasks(&self, process_id: u32);
    #[method(name = "endedRunningTasks")]
    fn end_running_tasks(&self, process_id: u32);
}

pub struct NxConsoleMessageConnection {
    client: Option<Arc<Client>>,
}

static LAST_UPDATES: Lazy<Mutex<HashMap<&'static str, Instant>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
const THROTTLE_DURATION: Duration = Duration::from_secs(2);

/// Utility function to check if an operation should be throttled.
/// Returns true if the operation should be throttled (skipped), false if it should proceed.
fn throttled(operation_key: &'static str, throttle_duration: Duration) -> bool {
    let mut last_updates = LAST_UPDATES.lock();
    let now = Instant::now();

    match last_updates.get(operation_key) {
        Some(last) if now.duration_since(*last) < throttle_duration => true, // Should throttle
        _ => {
            // Update the last update time
            last_updates.insert(operation_key, now);
            false // Should NOT throttle, operation should proceed
        }
    }
}

impl NxConsoleMessageConnection {
    pub async fn new(workspace_root: &str) -> Self {
        let socket_path = get_full_nx_console_socket_path(workspace_root);
        debug!(
            "🔌 Attempting to connect to Nx Console at: {}",
            socket_path.display()
        );
        let client = IpcTransport::new(&socket_path)
            .await
            .map(|transport| {
                debug!("✅ Successfully connected to Nx Console IPC transport");
                ClientBuilder::new().build_with_tokio(transport.writer, transport.reader)
            })
            .inspect_err(|e| {
                debug!("❌ Could not connect to Nx Console: {}", e);
                trace!(?socket_path, "Could not connect to Nx Console: {}", e);
            })
            .ok()
            .map(Arc::new);

        let is_connected = client.is_some();
        debug!(
            "🏁 NxConsoleMessageConnection created: is_connected={}",
            is_connected
        );
        Self { client }
    }

    pub fn is_connected(&self) -> bool {
        self.client.is_some()
    }

    pub fn send_terminal_string(&self, message: impl Into<String>) -> Option<()> {
        self.client.as_ref().map(|client| {
            let message = message.into();
            let client = client.clone();
            tokio::spawn(async move {
                if let Err(e) = client.terminal_message(message).await {
                    trace!("Failed to send terminal message: {}", e);
                }
            });
        })
    }

    pub fn update_running_tasks(
        &self,
        task_statuses: &[TaskItem],
        ptys: &HashMap<String, Arc<PtyInstance>>,
    ) -> Option<()> {
        if throttled("update_running_tasks", THROTTLE_DURATION) {
            return None;
        }

        self.client.as_ref().map(|client| {
            let client = client.clone();

            let task_statuses: Vec<UpdatedRunningTask> = task_statuses
                .iter()
                .map(|task| {
                    let output = ptys
                        .get(&task.name)
                        .and_then(|pty| pty.get_screen())
                        .map(|screen| screen.all_contents())
                        .unwrap_or_default();
                    UpdatedRunningTask {
                        name: task.name.clone(),
                        status: task.status,
                        output,
                        continuous: task.continuous,
                    }
                })
                .collect();

            tokio::spawn(async move {
                if let Err(e) = client
                    .update_running_tasks(std::process::id(), task_statuses)
                    .await
                {
                    trace!("Failed to send task statuses: {}", e);
                }
            });
        })
    }

    pub fn start_running_tasks(&self) -> Option<()> {
        self.client.as_ref().map(|client| {
            let client = client.clone();
            let process_id = std::process::id();
            tokio::spawn(async move {
                if let Err(e) = client.start_running_tasks(process_id).await {
                    trace!("Failed to send start running tasks: {}", e);
                }
            });
        })
    }

    pub fn end_running_tasks(&self) -> Option<()> {
        self.client.as_ref().map(|client| {
            let client = client.clone();
            let process_id = std::process::id();
            tokio::spawn(async move {
                if let Err(e) = client.end_running_tasks(process_id).await {
                    trace!("Failed to send end running tasks: {}", e);
                }
            });
        })
    }
}
