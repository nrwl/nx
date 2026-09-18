mod js;

#[cfg(not(target_arch = "wasm32"))]
pub mod capabilities;

#[cfg(not(target_arch = "wasm32"))]
pub mod graph_capabilities;
