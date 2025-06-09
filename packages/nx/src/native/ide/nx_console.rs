mod ipc_transport;
pub mod messaging;

// Re-export from ide/detection for backward compatibility
pub use crate::native::ide::detection::{SupportedEditor, get_current_editor};
