pub mod detection;
pub mod install;
#[cfg(not(target_arch = "wasm32"))]
pub mod nx_console;
mod preferences;
