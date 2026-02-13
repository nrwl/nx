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
