pub mod action;
pub mod app;
pub mod components;
pub mod config;
pub mod graph_utils;
pub mod lifecycle;
pub mod pty;
pub mod scroll_momentum;
pub mod status_icons;
pub mod theme;
#[allow(clippy::module_inception)]
pub mod tui;
pub mod tui_app;
pub mod tui_state;
pub mod utils;

pub use tui_app::TuiApp;
pub use tui_state::TuiState;
