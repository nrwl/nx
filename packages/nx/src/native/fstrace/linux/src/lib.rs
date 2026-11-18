//! Injected into traced processes through LD_PRELOAD. Wraps libc's open family, `opendir`
//! and `scandir`, and appends one line per successful read-open or directory open to
//! $FSTRACE_OUT. Children inherit the env vars, so the
//! whole process tree reports into the same file. `fstrace-linux` (src/launcher.rs) runs the
//! tree under a seccomp filter that catches what bypasses libc. macOS uses `../macos.c`.
#![cfg(target_os = "linux")]

mod magic;

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

const LISTED: &[u8] = b"!list ";
const WRITTEN: &[u8] = b"!write ";

/// One write(2) per event: O_APPEND keeps concurrent writers from interleaving.
unsafe fn record(prefix: &[u8], dirfd: c_int, path: *const c_char) {
    let fd = log_fd();
    if fd < 0 || path.is_null() {
        return;
    }
    let saved_errno = *errno_location();
    let mut buf = [0u8; BUF + LISTED.len()];
    buf[..prefix.len()].copy_from_slice(prefix);
    let mut len = prefix.len();
    if *path.cast::<u8>() != b'/' {
        let base = &mut buf[len..];
        len += if dirfd == libc::AT_FDCWD {
            if libc::getcwd(base.as_mut_ptr().cast(), 4096).is_null() {
                0
            } else {
                libc::strlen(base.as_ptr().cast())
            }
        } else {
            dir_of_fd(dirfd, base)
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

unsafe fn errno_location() -> *mut c_int {
    libc::__errno_location()
}

/// Logs a successful readable open as a read, or as a listing when it opened a directory,
/// since that is where listing one starts. Files the traced tree wrote are its own output,
/// and one it wrote and then removed was a temporary file, not an input that went missing.
unsafe fn record_open(fd: c_int, dirfd: c_int, path: *const c_char, flags: c_int) {
    if fd < 0 || flags & libc::O_PATH != 0 {
        return;
    }
    if flags & libc::O_ACCMODE != libc::O_RDONLY {
        record(WRITTEN, dirfd, path);
    }
    if flags & libc::O_ACCMODE == libc::O_WRONLY {
        return;
    }
    let listed = flags & libc::O_DIRECTORY != 0 || is_dir(fd);
    record(if listed { LISTED } else { b"" }, dirfd, path);
}

unsafe fn is_dir(fd: c_int) -> bool {
    let mut st: libc::stat = std::mem::zeroed();
    libc::fstat(fd, &mut st) == 0 && st.st_mode & libc::S_IFMT == libc::S_IFDIR
}

unsafe fn fopen_reads(mode: *const c_char) -> bool {
    !mode.is_null() && (*mode.cast::<u8>() == b'r' || !libc::strchr(mode, b'+' as c_int).is_null())
}

unsafe fn fopen_writes(mode: *const c_char) -> bool {
    !mode.is_null() && (*mode.cast::<u8>() != b'r' || !libc::strchr(mode, b'+' as c_int).is_null())
}

unsafe fn record_exe() {
    let mut buf = [0u8; 4097];
    let ok = libc::readlink(c"/proc/self/exe".as_ptr(), buf.as_mut_ptr().cast(), 4096) > 0;
    if ok {
        record(b"", libc::AT_FDCWD, buf.as_ptr().cast());
    }
}

extern "C" fn init() {
    unsafe { record_exe() }
}

#[used]
#[link_section = ".init_array"]
static INIT: extern "C" fn() = init;

/// Opens go straight to the kernel with a marker in an unused argument slot. The launcher's
/// seccomp filter lets marked opens through without a notification, so anything this shim
/// already reported costs no supervisor round trip.
mod real {
    use crate::magic::MAGIC;
    use libc::{c_char, c_int, c_uint, FILE};
    use std::sync::atomic::{AtomicUsize, Ordering};

    pub unsafe fn open(path: *const c_char, flags: c_int, mode: c_uint) -> c_int {
        openat(libc::AT_FDCWD, path, flags, mode)
    }
    pub unsafe fn openat(dirfd: c_int, path: *const c_char, flags: c_int, mode: c_uint) -> c_int {
        // Truncated on 32-bit targets, where the launcher installs no filter.
        libc::syscall(
            libc::SYS_openat,
            dirfd,
            path,
            flags,
            mode,
            0 as libc::c_long,
            MAGIC as libc::c_long,
        ) as c_int
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

unsafe fn traced_open(path: *const c_char, flags: c_int, mode: libc::c_uint) -> c_int {
    let fd = real::open(path, flags, mode);
    record_open(fd, libc::AT_FDCWD, path, flags);
    fd
}

unsafe fn traced_openat(
    dirfd: c_int,
    path: *const c_char,
    flags: c_int,
    mode: libc::c_uint,
) -> c_int {
    let fd = real::openat(dirfd, path, flags, mode);
    record_open(fd, dirfd, path, flags);
    fd
}

unsafe fn traced_fopen(path: *const c_char, mode: *const c_char) -> *mut libc::FILE {
    let f = real::fopen(path, mode);
    if !f.is_null() && fopen_writes(mode) {
        record(WRITTEN, libc::AT_FDCWD, path);
    }
    if !f.is_null() && fopen_reads(mode) {
        record(b"", libc::AT_FDCWD, path);
    }
    f
}

/// libc's own opendir opens the directory without going through `openat` above, which would
/// cost a supervisor round trip for every directory listed.
unsafe fn traced_opendir(path: *const c_char) -> *mut libc::DIR {
    let flags = libc::O_RDONLY | libc::O_NONBLOCK | libc::O_DIRECTORY | libc::O_CLOEXEC;
    let fd = real::open(path, flags, 0);
    if fd < 0 {
        return std::ptr::null_mut();
    }
    record(LISTED, libc::AT_FDCWD, path);
    let dir = libc::fdopendir(fd);
    if dir.is_null() {
        let errno = *errno_location();
        libc::close(fd);
        *errno_location() = errno;
    }
    dir
}

type ScandirFilter = Option<unsafe extern "C" fn(*const libc::dirent) -> c_int>;
type ScandirCompare =
    Option<unsafe extern "C" fn(*mut *const libc::dirent, *mut *const libc::dirent) -> c_int>;

/// glibc's scandir, over `traced_opendir`. Each entry and the array are malloc'd, because
/// callers free them.
#[cfg(target_pointer_width = "64")]
unsafe fn traced_scandir(
    path: *const c_char,
    namelist: *mut *mut *mut libc::dirent,
    filter: ScandirFilter,
    compare: ScandirCompare,
) -> c_int {
    let dir = traced_opendir(path);
    if dir.is_null() {
        return -1;
    }
    let saved_errno = *errno_location();
    let mut entries: Vec<*mut libc::dirent> = Vec::new();
    let error = loop {
        *errno_location() = 0;
        let entry = libc::readdir(dir);
        if entry.is_null() {
            break *errno_location();
        }
        if filter.is_some_and(|keep| keep(entry) == 0) {
            continue;
        }
        let len = (*entry).d_reclen as usize;
        let copy = libc::malloc(len).cast::<libc::dirent>();
        if copy.is_null() {
            break libc::ENOMEM;
        }
        std::ptr::copy_nonoverlapping(entry.cast::<u8>(), copy.cast::<u8>(), len);
        entries.push(copy);
    };
    libc::closedir(dir);
    let size = std::mem::size_of::<*mut libc::dirent>();
    let list = if error == 0 {
        libc::malloc(entries.len().max(1) * size).cast::<*mut libc::dirent>()
    } else {
        std::ptr::null_mut()
    };
    if list.is_null() {
        for entry in entries {
            libc::free(entry.cast());
        }
        *errno_location() = if error == 0 { libc::ENOMEM } else { error };
        return -1;
    }
    if let Some(compare) = compare {
        libc::qsort(
            entries.as_mut_ptr().cast(),
            entries.len(),
            size,
            Some(std::mem::transmute::<
                unsafe extern "C" fn(*mut *const libc::dirent, *mut *const libc::dirent) -> c_int,
                unsafe extern "C" fn(*const c_void, *const c_void) -> c_int,
            >(compare)),
        );
    }
    std::ptr::copy_nonoverlapping(entries.as_ptr(), list, entries.len());
    *namelist = list;
    *errno_location() = saved_errno;
    entries.len() as c_int
}

/// Stable Rust cannot define C-variadic functions. On the Linux targets Nx ships (x86_64,
/// aarch64, armv7), variadic integer args travel exactly like fixed ones, so a fixed `mode`
/// matches what callers pass. Newer rustc denies redefining these with a fixed signature.
#[allow(unknown_lints, invalid_runtime_symbol_definitions)]
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
    #[no_mangle]
    pub unsafe extern "C" fn opendir(path: *const c_char) -> *mut libc::DIR {
        traced_opendir(path)
    }
    #[cfg(target_pointer_width = "64")]
    #[no_mangle]
    pub unsafe extern "C" fn scandir(
        path: *const c_char,
        namelist: *mut *mut *mut libc::dirent,
        filter: ScandirFilter,
        compare: ScandirCompare,
    ) -> c_int {
        traced_scandir(path, namelist, filter, compare)
    }
    #[cfg(target_pointer_width = "64")]
    #[no_mangle]
    pub unsafe extern "C" fn scandir64(
        path: *const c_char,
        namelist: *mut *mut *mut libc::dirent,
        filter: ScandirFilter,
        compare: ScandirCompare,
    ) -> c_int {
        traced_scandir(path, namelist, filter, compare)
    }
}
