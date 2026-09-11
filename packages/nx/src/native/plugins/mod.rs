mod js;

#[cfg(not(target_arch = "wasm32"))]
pub mod capabilities;
