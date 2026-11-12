//! Injected into traced processes (LD_PRELOAD on Linux, DYLD_INSERT_LIBRARIES on macOS).
//! Wraps libc's open family and appends one line per successful read-open to $FSTRACE_OUT.
//! Children inherit the env vars, so the whole process tree reports into the same file.
#![cfg(unix)]

use libc::{c_char, c_int, c_void};
use std::sync::atomic::{AtomicI32, Ordering};

const BUF: usize = 4096 * 2 + 2;
const UNINIT: i32 = -1;
const DISABLED: i32 = -2;
static LOG_FD: AtomicI32 = AtomicI32::new(UNINIT);

unsafe fn log_fd() -> c_int {
    let fd = LOG_FD.load(Ordering::Relaxed);
    if fd != UNINIT {
        return fd;
    }
    let out = libc::getenv(c"FSTRACE_OUT".as_ptr());
    let mut new = DISABLED;
    if !out.is_null() {
        let raw = real::open(out, libc::O_WRONLY | libc::O_APPEND | libc::O_CLOEXEC, 0);
        if raw >= 0 {
            // Park it high so programs that juggle low fds are unlikely to stomp on it.
            let high = libc::fcntl(raw, libc::F_DUPFD_CLOEXEC, 1000);
            if high >= 0 {
                libc::close(raw);
                new = high;
            } else {
                new = raw;
            }
        }
    }
    match LOG_FD.compare_exchange(UNINIT, new, Ordering::Relaxed, Ordering::Relaxed) {
        Ok(_) => new,
        Err(winner) => {
            if new >= 0 {
                libc::close(new);
            }
            winner
        }
    }
}

#[cfg(target_os = "linux")]
unsafe fn dir_of_fd(fd: c_int, buf: &mut [u8]) -> usize {
    let mut link = [0u8; 40];
    libc::snprintf(
        link.as_mut_ptr().cast(),
        link.len(),
        c"/proc/self/fd/%d".as_ptr(),
        fd,
    );
    let n = libc::readlink(link.as_ptr().cast(), buf.as_mut_ptr().cast(), 4096);
    if n > 0 {
        n as usize
    } else {
        0
    }
}

#[cfg(target_os = "macos")]
unsafe fn dir_of_fd(fd: c_int, buf: &mut [u8]) -> usize {
    if libc::fcntl(fd, libc::F_GETPATH, buf.as_mut_ptr()) == 0 {
        libc::strlen(buf.as_ptr().cast())
    } else {
        0
    }
}

/// One write(2) per event: O_APPEND keeps concurrent writers from interleaving.
unsafe fn record(dirfd: c_int, path: *const c_char) {
    let fd = log_fd();
    if fd < 0 || path.is_null() {
        return;
    }
    let saved_errno = *errno_location();
    let mut buf = [0u8; BUF];
    let mut len = 0usize;
    if *path as u8 != b'/' {
        len = if dirfd == libc::AT_FDCWD {
            if libc::getcwd(buf.as_mut_ptr().cast(), 4096).is_null() {
                0
            } else {
                libc::strlen(buf.as_ptr().cast())
            }
        } else {
            dir_of_fd(dirfd, &mut buf)
        };
        buf[len] = b'/';
        len += 1;
    }
    let plen = libc::strlen(path).min(4096);
    std::ptr::copy_nonoverlapping(path.cast::<u8>(), buf.as_mut_ptr().add(len), plen);
    len += plen;
    buf[len] = b'\n';
    libc::write(fd, buf.as_ptr() as *const c_void, len + 1);
    *errno_location() = saved_errno;
}

#[cfg(target_os = "linux")]
unsafe fn errno_location() -> *mut c_int {
    libc::__errno_location()
}
#[cfg(target_os = "macos")]
unsafe fn errno_location() -> *mut c_int {
    libc::__error()
}

/// Directory opens (readdir) are not file reads.
fn reads(flags: c_int) -> bool {
    flags & libc::O_ACCMODE != libc::O_WRONLY && flags & libc::O_DIRECTORY == 0
}

unsafe fn fopen_reads(mode: *const c_char) -> bool {
    !mode.is_null() && (*mode as u8 == b'r' || !libc::strchr(mode, b'+' as c_int).is_null())
}

unsafe fn record_exe() {
    let mut buf = [0u8; 4097];
    #[cfg(target_os = "linux")]
    let ok = libc::readlink(c"/proc/self/exe".as_ptr(), buf.as_mut_ptr().cast(), 4096) > 0;
    #[cfg(target_os = "macos")]
    let ok = {
        let mut size = 4096u32;
        libc::_NSGetExecutablePath(buf.as_mut_ptr().cast(), &mut size) == 0
    };
    if ok {
        record(libc::AT_FDCWD, buf.as_ptr().cast());
    }
}

extern "C" fn init() {
    unsafe { record_exe() }
}

#[used]
#[cfg_attr(target_os = "linux", link_section = ".init_array")]
#[cfg_attr(target_os = "macos", link_section = "__DATA,__mod_init_func")]
static INIT: extern "C" fn() = init;

/// Linux: opens go straight to the kernel with a marker in an unused argument slot.
/// The seccomp backend's filter lets marked opens through without a notification, so in
/// hybrid mode anything this shim already reported costs no supervisor round trip.
#[cfg(target_os = "linux")]
mod real {
    use libc::{c_char, c_int, c_uint, FILE};
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// Keep in sync with addon/src/seccomp.rs.
    const MAGIC: u64 = 0x6673_7472_6163_6521;

    pub unsafe fn open(path: *const c_char, flags: c_int, mode: c_uint) -> c_int {
        openat(libc::AT_FDCWD, path, flags, mode)
    }
    pub unsafe fn openat(dirfd: c_int, path: *const c_char, flags: c_int, mode: c_uint) -> c_int {
        libc::syscall(libc::SYS_openat, dirfd, path, flags, mode, 0usize, MAGIC) as c_int
    }
    pub unsafe fn fopen(path: *const c_char, mode: *const c_char) -> *mut FILE {
        type FopenFn = unsafe extern "C" fn(*const c_char, *const c_char) -> *mut FILE;
        static REAL: AtomicUsize = AtomicUsize::new(0);
        let mut p = REAL.load(Ordering::Relaxed);
        if p == 0 {
            p = libc::dlsym(libc::RTLD_NEXT, c"fopen64".as_ptr()) as usize;
            REAL.store(p, Ordering::Relaxed);
        }
        std::mem::transmute::<usize, FopenFn>(p)(path, mode)
    }
}

/// macOS: dyld interposing only rewrites calls from *other* images, so calling libc
/// from here reaches the real implementation.
#[cfg(target_os = "macos")]
mod real {
    use libc::{c_char, c_int, c_uint, FILE};
    pub unsafe fn open(path: *const c_char, flags: c_int, mode: c_uint) -> c_int {
        libc::open(path, flags, mode)
    }
    pub unsafe fn openat(dirfd: c_int, path: *const c_char, flags: c_int, mode: c_uint) -> c_int {
        libc::openat(dirfd, path, flags, mode)
    }
    pub unsafe fn fopen(path: *const c_char, mode: *const c_char) -> *mut FILE {
        libc::fopen(path, mode)
    }
}

unsafe fn traced_open(path: *const c_char, flags: c_int, mode: libc::c_uint) -> c_int {
    let fd = real::open(path, flags, mode);
    if fd >= 0 && reads(flags) {
        record(libc::AT_FDCWD, path);
    }
    fd
}

unsafe fn traced_openat(
    dirfd: c_int,
    path: *const c_char,
    flags: c_int,
    mode: libc::c_uint,
) -> c_int {
    let fd = real::openat(dirfd, path, flags, mode);
    if fd >= 0 && reads(flags) {
        record(dirfd, path);
    }
    fd
}

unsafe fn traced_fopen(path: *const c_char, mode: *const c_char) -> *mut libc::FILE {
    let f = real::fopen(path, mode);
    if !f.is_null() && fopen_reads(mode) {
        record(libc::AT_FDCWD, path);
    }
    f
}

/// Stable Rust cannot define C-variadic functions. On Linux x86_64/aarch64 variadic
/// integer args travel in the same registers as fixed ones, so a fixed `mode` works.
#[cfg(target_os = "linux")]
mod exports {
    use super::*;
    use libc::c_uint;

    #[no_mangle]
    pub unsafe extern "C" fn open(path: *const c_char, flags: c_int, mode: c_uint) -> c_int {
        traced_open(path, flags, mode)
    }
    #[no_mangle]
    pub unsafe extern "C" fn open64(path: *const c_char, flags: c_int, mode: c_uint) -> c_int {
        traced_open(path, flags, mode)
    }
    #[no_mangle]
    pub unsafe extern "C" fn __open_2(path: *const c_char, flags: c_int) -> c_int {
        traced_open(path, flags, 0)
    }
    #[no_mangle]
    pub unsafe extern "C" fn __open64_2(path: *const c_char, flags: c_int) -> c_int {
        traced_open(path, flags, 0)
    }
    #[no_mangle]
    pub unsafe extern "C" fn openat(
        d: c_int,
        path: *const c_char,
        flags: c_int,
        mode: c_uint,
    ) -> c_int {
        traced_openat(d, path, flags, mode)
    }
    #[no_mangle]
    pub unsafe extern "C" fn openat64(
        d: c_int,
        path: *const c_char,
        flags: c_int,
        mode: c_uint,
    ) -> c_int {
        traced_openat(d, path, flags, mode)
    }
    #[no_mangle]
    pub unsafe extern "C" fn __openat_2(d: c_int, path: *const c_char, flags: c_int) -> c_int {
        traced_openat(d, path, flags, 0)
    }
    #[no_mangle]
    pub unsafe extern "C" fn __openat64_2(d: c_int, path: *const c_char, flags: c_int) -> c_int {
        traced_openat(d, path, flags, 0)
    }
    #[no_mangle]
    pub unsafe extern "C" fn fopen(path: *const c_char, mode: *const c_char) -> *mut libc::FILE {
        traced_fopen(path, mode)
    }
    #[no_mangle]
    pub unsafe extern "C" fn fopen64(path: *const c_char, mode: *const c_char) -> *mut libc::FILE {
        traced_fopen(path, mode)
    }
}

/// UNTESTED (written on Linux, only type-checked for darwin).
#[cfg(target_os = "macos")]
mod exports {
    use super::*;
    use libc::c_uint;

    // Apple arm64 passes variadic args on the stack. Six padding params fill x2..x7 so
    // `mode` is read from the first stack slot, where the caller's variadic arg lives.
    #[cfg(target_arch = "aarch64")]
    unsafe extern "C" fn hook_open(
        path: *const c_char,
        flags: c_int,
        _2: usize,
        _3: usize,
        _4: usize,
        _5: usize,
        _6: usize,
        _7: usize,
        mode: c_uint,
    ) -> c_int {
        traced_open(
            path,
            flags,
            if flags & libc::O_CREAT != 0 { mode } else { 0 },
        )
    }
    #[cfg(target_arch = "aarch64")]
    unsafe extern "C" fn hook_openat(
        d: c_int,
        path: *const c_char,
        flags: c_int,
        _3: usize,
        _4: usize,
        _5: usize,
        _6: usize,
        _7: usize,
        mode: c_uint,
    ) -> c_int {
        traced_openat(
            d,
            path,
            flags,
            if flags & libc::O_CREAT != 0 { mode } else { 0 },
        )
    }
    #[cfg(target_arch = "x86_64")]
    unsafe extern "C" fn hook_open(path: *const c_char, flags: c_int, mode: c_uint) -> c_int {
        traced_open(path, flags, mode)
    }
    #[cfg(target_arch = "x86_64")]
    unsafe extern "C" fn hook_openat(
        d: c_int,
        path: *const c_char,
        flags: c_int,
        mode: c_uint,
    ) -> c_int {
        traced_openat(d, path, flags, mode)
    }
    unsafe extern "C" fn hook_fopen(path: *const c_char, mode: *const c_char) -> *mut libc::FILE {
        traced_fopen(path, mode)
    }

    #[repr(C)]
    struct Interpose {
        replacement: *const (),
        original: *const (),
    }
    unsafe impl Sync for Interpose {}

    #[used]
    #[link_section = "__DATA,__interpose"]
    static INTERPOSE: [Interpose; 3] = [
        Interpose {
            replacement: hook_open as *const (),
            original: libc::open as *const (),
        },
        Interpose {
            replacement: hook_openat as *const (),
            original: libc::openat as *const (),
        },
        Interpose {
            replacement: hook_fopen as *const (),
            original: libc::fopen as *const (),
        },
    ];
}
