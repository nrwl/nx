#[napi]
#[cfg(target_arch = "wasm32")]
pub const IS_WASM: bool = true;

#[napi]
#[cfg(not(target_arch = "wasm32"))]
pub const IS_WASM: bool = false;

use std::env::consts;

#[napi]
pub fn get_binary_target() -> String {
    let arch = consts::ARCH;
    let os = consts::OS;

    let mut binary_target = String::new();

    if !arch.is_empty() {
        binary_target.push_str(&arch);
    }

    if !os.is_empty() {
        if !binary_target.is_empty() {
            binary_target.push('-');
        }
        binary_target.push_str(&os);
    }

    binary_target
}
