#![cfg_attr(target_os = "wasi", feature(wasi_ext))]
// add all the napi macros globally
#[macro_use]
extern crate napi_derive;

pub mod native;


#[cfg(not(target_arch = "wasm32"))]
pub use nx_pty::napi::*;
#[cfg(not(target_arch = "wasm32"))]
pub use nx_db::napi::*;
