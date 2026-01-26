pub mod action;
pub mod app;
pub mod components;
pub mod config;
pub mod escape_sequences;
pub mod graph_utils;
pub mod inline_app;
pub mod lifecycle;
pub mod pty;
pub mod scroll_momentum;
pub mod status_icons;
pub mod theme;
#[allow(clippy::module_inception)]
pub mod tui;
pub mod tui_app;
pub mod tui_core;
pub mod tui_state;
pub mod utils;

pub use inline_app::InlineApp;
pub use lifecycle::BatchInfo;
pub use tui_app::TuiApp;
pub use tui_core::TuiCore;
pub use tui_state::TuiState;
