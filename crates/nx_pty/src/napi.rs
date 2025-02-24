#[cfg_attr(target_os = "macos", path = "napi/pseudo_terminal/mac.rs")]
#[cfg_attr(not(target_os = "macos"), path = "napi/pseudo_terminal/non_mac.rs")]
pub mod rust_pseudo_terminal;
