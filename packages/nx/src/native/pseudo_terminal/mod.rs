#[cfg_attr(target_os = "macos", path = "mac.rs")]
#[cfg_attr(not(target_os = "macos"), path = "non_mac.rs")]
pub mod rust_pseudo_terminal;
