#[cfg(not(target_arch = "wasm32"))]
mod ipc_transport;
#[cfg(not(target_arch = "wasm32"))]
pub mod messaging;

// Re-export from ide/detection for backward compatibility
pub use crate::native::ide::detection::{SupportedEditor, get_current_editor};
