#![cfg_attr(target_os = "wasi", feature(wasi_ext))]
// add all the napi macros globally
#[macro_use]
extern crate napi_derive;

pub mod native;
