pub mod path;

#[cfg_attr(not(target_arch = "wasm32"), path = "atomics/default.rs")]
#[cfg_attr(target_arch = "wasm32", path = "atomics/wasm.rs")]
pub mod atomics;
pub mod file_lock;

pub use atomics::*;
