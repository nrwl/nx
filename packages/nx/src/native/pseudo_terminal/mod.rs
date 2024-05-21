#[cfg_attr(windows, path = "command/windows.rs")]
#[cfg_attr(not(windows), path = "command/unix.rs")]
mod os;

#[allow(clippy::module_inception)]
mod pseudo_terminal;

pub mod child_process;

#[cfg_attr(target_os = "macos", path = "mac.rs")]
#[cfg_attr(not(target_os = "macos"), path = "non_mac.rs")]
pub mod rust_pseudo_terminal;
