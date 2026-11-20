#![deny(clippy::disallowed_types)]
#![deny(clippy::disallowed_methods)]
#![cfg_attr(target_os = "wasi", feature(wasi_ext))]
// add all the napi macros globally
#[macro_use]
extern crate napi_derive;

// Windows excluded: tikv-jemalloc-sys fails to build with MSVC.
// Track https://github.com/tikv/jemallocator/pull/99
#[cfg(any(target_os = "linux", target_os = "macos"))]
#[global_allocator]
static GLOBAL: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;

// On macOS, jemalloc skips pthread_atfork and relies on its malloc zone to lock it around fork,
// but tikv-jemalloc-sys only links the zone with a feature we don't enable. portable-pty
// allocates between fork and exec.
#[cfg(target_os = "macos")]
#[module_init]
fn register_jemalloc_fork_handlers() {
    use std::io::Write;

    unsafe extern "C" {
        #[link_name = "_rjem_je_jemalloc_prefork"]
        fn jemalloc_prefork();
        #[link_name = "_rjem_je_jemalloc_postfork_parent"]
        fn jemalloc_postfork_parent();
        #[link_name = "_rjem_je_jemalloc_postfork_child"]
        fn jemalloc_postfork_child();
    }

    // The prefork handler requires an initialized jemalloc, which the first allocation sets up.
    std::hint::black_box(Box::new(0u8));
    let result = unsafe {
        nix::libc::pthread_atfork(
            Some(jemalloc_prefork),
            Some(jemalloc_postfork_parent),
            Some(jemalloc_postfork_child),
        )
    };
    if result != 0 {
        // eprintln! panics when the write fails, which aborts inside a ctor.
        let _ = writeln!(
            std::io::stderr(),
            "nx: could not register jemalloc fork handlers (pthread_atfork error {result}). A task can fail to start with no output; rerun it."
        );
    }
}

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
