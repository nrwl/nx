pub mod napi;

#[cfg(not(target_arch = "wasm32"))]
pub mod pseudo_terminal;
