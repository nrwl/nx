#![deny(clippy::disallowed_types)]
#![cfg_attr(target_os = "wasi", feature(wasi_ext))]
// add all the napi macros globally
#[macro_use]
extern crate napi_derive;

// Windows excluded: tikv-jemalloc-sys fails to build with MSVC.
// Track https://github.com/tikv/jemallocator/pull/99
#[cfg(any(target_os = "linux", target_os = "macos"))]
#[global_allocator]
static GLOBAL: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;

pub mod native;

// Provide stub implementations of napi C API symbols required by napi-rs v3's
// Error::drop (which uses napi_ref internally). These symbols are normally
// provided by Node.js at runtime, but aren't available in standalone test binaries.
#[cfg(test)]
mod napi_test_stubs {
    use std::ffi::c_void;

    #[unsafe(no_mangle)]
    pub unsafe extern "C" fn napi_delete_reference(_env: *mut c_void, _ref: *mut c_void) -> i32 {
        0 // napi_ok
    }

    #[unsafe(no_mangle)]
    pub unsafe extern "C" fn napi_reference_unref(
        _env: *mut c_void,
        _ref: *mut c_void,
        _result: *mut u32,
    ) -> i32 {
        0 // napi_ok
    }
}
