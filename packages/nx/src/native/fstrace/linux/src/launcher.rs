//! `fstrace-linux trace <log> <program> [args...]`
//!
//! Runs the program under a seccomp filter and supervises it. The LD_PRELOAD shim logs what
//! goes through libc. The filter catches what does not: static binaries, raw syscalls (Go,
//! Bun), the dynamic loader's opens, and directory listings.

#[cfg(target_os = "linux")]
mod magic;
#[cfg(target_os = "linux")]
mod supervisor;

#[cfg(target_os = "linux")]
fn main() {
    supervisor::main()
}

#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("fstrace-linux only runs on Linux");
    std::process::exit(2);
}
