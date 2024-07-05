#[napi]
#[cfg(target_arch = "wasm32")]
pub const IS_WASM: bool = true;

#[napi]
#[cfg(not(target_arch = "wasm32"))]
pub const IS_WASM: bool = false;
