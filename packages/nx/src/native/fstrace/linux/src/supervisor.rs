//! The child installs a seccomp filter on itself, hands the listener fd to this process,
//! and execs the program. The kernel then parks each matching syscall anywhere in the tree
//! until this process has logged it and let it continue. Logging comes first, so a read
//! always lands in the log before the plugin call that made it writes its end marker.
//!
//! Needs Linux 5.8: 5.5 added SECCOMP_USER_NOTIF_FLAG_CONTINUE, and 5.8 made the listener
//! report POLLHUP once no process uses the filter. Elsewhere the program runs with only the
//! shim, and the log says it is untraced.

use crate::magic::MAGIC;
use libc::{c_int, c_long, c_void, sock_filter};
use std::ffi::{CString, OsString};
use std::mem::{size_of, zeroed};
use std::os::unix::ffi::{OsStrExt, OsStringExt};
use std::sync::atomic::{AtomicBool, Ordering};

const SECCOMP_SET_MODE_FILTER: c_long = 1;
const SECCOMP_FILTER_FLAG_NEW_LISTENER: c_long = 1 << 3;
const SECCOMP_RET_ALLOW: u32 = 0x7fff_0000;
const SECCOMP_RET_USER_NOTIF: u32 = 0x7fc0_0000;
const SECCOMP_RET_ERRNO: u32 = 0x0005_0000;
const SECCOMP_USER_NOTIF_FLAG_CONTINUE: u32 = 1;
// _IOWR('!', 0, struct seccomp_notif), _IOWR('!', 1, struct seccomp_notif_resp), and
// _IOR('!', 2, __u64), the ID_VALID number every kernel since 5.0 accepts.
const SECCOMP_IOCTL_NOTIF_RECV: libc::c_ulong = 0xc050_2100;
const SECCOMP_IOCTL_NOTIF_SEND: libc::c_ulong = 0xc018_2101;
const SECCOMP_IOCTL_NOTIF_ID_VALID: libc::c_ulong = 0x8008_2102;
// _IOW('!', 4, __u64), from Linux 6.6. Older kernels reject it and wake up as before.
const SECCOMP_IOCTL_NOTIF_SET_FLAGS: libc::c_ulong = 0x4008_2104;
const SECCOMP_USER_NOTIF_FD_SYNC_WAKE_UP: libc::c_ulong = 1;

const FORWARDED: [c_int; 6] = [
    libc::SIGTERM,
    libc::SIGINT,
    libc::SIGHUP,
    libc::SIGQUIT,
    libc::SIGUSR1,
    libc::SIGUSR2,
];

#[repr(C)]
struct SeccompData {
    nr: c_int,
    arch: u32,
    ip: u64,
    args: [u64; 6],
}

#[repr(C)]
struct SeccompNotif {
    id: u64,
    pid: u32,
    flags: u32,
    data: SeccompData,
}

#[repr(C)]
struct SeccompNotifResp {
    id: u64,
    val: i64,
    error: i32,
    flags: u32,
}

pub fn main() {
    let args: Vec<OsString> = std::env::args_os().collect();
    if args.len() < 4 || args[1] != "trace" {
        eprintln!("usage: fstrace-linux trace <log> <program> [args...]");
        std::process::exit(2);
    }
    let log = open_log(&args[2]);
    let argv: Vec<CString> = args[3..]
        .iter()
        .map(|a| CString::new(a.as_bytes()).expect("argument contains NUL"))
        .collect();
    match filter() {
        Some(program) if kernel_at_least(5, 8) => unsafe { supervise(log, &argv, program) },
        Some(_) => {
            untraced(log, b"seccomp tracing needs Linux 5.8 or later");
            exec(&argv)
        }
        None => {
            untraced(
                log,
                b"seccomp tracing is not supported on this architecture",
            );
            exec(&argv)
        }
    }
}

fn open_log(path: &OsString) -> c_int {
    let c = CString::new(path.clone().into_vec()).expect("log path contains NUL");
    unsafe {
        libc::open(
            c.as_ptr(),
            libc::O_WRONLY | libc::O_APPEND | libc::O_CLOEXEC,
        )
    }
}

/// One write(2) per line, so lines from concurrent writers never interleave.
fn write_line(log: c_int, prefix: &[u8], body: &[u8]) {
    if log < 0 {
        return;
    }
    let mut line = Vec::with_capacity(prefix.len() + body.len() + 1);
    line.extend_from_slice(prefix);
    line.extend_from_slice(body);
    line.push(b'\n');
    unsafe { libc::write(log, line.as_ptr().cast(), line.len()) };
}

fn untraced(log: c_int, reason: &[u8]) {
    write_line(log, b"!untraced ", reason);
}

fn exec(argv: &[CString]) -> ! {
    let mut ptrs: Vec<*const libc::c_char> = argv.iter().map(|a| a.as_ptr()).collect();
    ptrs.push(std::ptr::null());
    unsafe {
        libc::execvp(ptrs[0], ptrs.as_ptr());
        libc::_exit(127)
    }
}

fn kernel_at_least(major: u32, minor: u32) -> bool {
    let mut uts: libc::utsname = unsafe { zeroed() };
    if unsafe { libc::uname(&mut uts) } != 0 {
        return false;
    }
    let release = unsafe { std::ffi::CStr::from_ptr(uts.release.as_ptr()) }.to_bytes();
    let mut parts = release
        .split(|b| !b.is_ascii_digit())
        .filter(|p| !p.is_empty())
        .map(|p| {
            std::str::from_utf8(p)
                .ok()
                .and_then(|s| s.parse::<u32>().ok())
                .unwrap_or(0)
        });
    let found = (parts.next().unwrap_or(0), parts.next().unwrap_or(0));
    found >= (major, minor)
}

// ---------------------------------------------------------------------------------------
// The filter

const LD_ABS: u16 = 0x20; // BPF_LD | BPF_W | BPF_ABS
const JEQ: u16 = 0x15; // BPF_JMP | BPF_JEQ | BPF_K
const JSET: u16 = 0x45; // BPF_JMP | BPF_JSET | BPF_K
const AND: u16 = 0x54; // BPF_ALU | BPF_AND | BPF_K
const RET: u16 = 0x06; // BPF_RET | BPF_K
const OFF_NR: u32 = 0;
const OFF_ARCH: u32 = 4;

const fn off_arg(i: u32) -> u32 {
    16 + 8 * i
}

fn insn(code: u16, jt: u8, jf: u8, k: u32) -> sock_filter {
    sock_filter { code, jt, jf, k }
}

#[cfg(target_arch = "x86_64")]
const AUDIT_ARCH: u32 = 0xc000_003e;
#[cfg(target_arch = "aarch64")]
const AUDIT_ARCH: u32 = 0xc000_00b7;

#[cfg(target_arch = "x86_64")]
const X32_SYSCALL_BIT: u32 = 0x4000_0000;

/// Notifies on read-capable opens, execs and directory rewinds, and on every syscall from an
/// ABI the supervisor cannot decode (32-bit and x32). Write-only and O_PATH opens are allowed
/// in-kernel, and so are opens the shim marked as already logged.
///
/// Listing a directory needs a readable fd to it, so a listing is logged when the directory
/// is opened, once, rather than on each getdents64 call. `lseek(fd, 0, SEEK_SET)` is how a
/// directory is listed again from the same fd.
#[cfg(any(target_arch = "x86_64", target_arch = "aarch64"))]
fn filter() -> Option<Vec<sock_filter>> {
    let mut f = vec![
        insn(LD_ABS, 0, 0, OFF_ARCH),
        insn(JEQ, 1, 0, AUDIT_ARCH),
        insn(RET, 0, 0, SECCOMP_RET_USER_NOTIF),
        insn(LD_ABS, 0, 0, OFF_NR),
    ];
    #[cfg(target_arch = "x86_64")]
    f.extend([
        insn(JSET, 0, 1, X32_SYSCALL_BIT),
        insn(RET, 0, 0, SECCOMP_RET_USER_NOTIF),
    ]);
    let mut open_like = |nr: c_long, flags_arg: u32, marked_by_shim: bool| {
        let mut body = Vec::new();
        if marked_by_shim {
            body.extend([
                insn(LD_ABS, 0, 0, off_arg(5)),
                insn(JEQ, 0, 3, MAGIC as u32),
                insn(LD_ABS, 0, 0, off_arg(5) + 4),
                insn(JEQ, 0, 1, (MAGIC >> 32) as u32),
                insn(RET, 0, 0, SECCOMP_RET_ALLOW),
            ]);
        }
        body.extend([
            insn(LD_ABS, 0, 0, off_arg(flags_arg)),
            insn(JSET, 3, 0, libc::O_PATH as u32),
            insn(AND, 0, 0, libc::O_ACCMODE as u32),
            insn(JEQ, 1, 0, libc::O_WRONLY as u32),
            insn(RET, 0, 0, SECCOMP_RET_USER_NOTIF),
            insn(RET, 0, 0, SECCOMP_RET_ALLOW),
        ]);
        f.push(insn(JEQ, 0, body.len() as u8, nr as u32));
        f.extend(body);
    };
    #[cfg(target_arch = "x86_64")]
    open_like(libc::SYS_open, 1, false);
    open_like(libc::SYS_openat, 2, true);

    for nr in [libc::SYS_openat2, libc::SYS_execve, libc::SYS_execveat] {
        f.extend([
            insn(JEQ, 0, 1, nr as u32),
            insn(RET, 0, 0, SECCOMP_RET_USER_NOTIF),
        ]);
    }
    let rewind = [
        insn(LD_ABS, 0, 0, off_arg(1)),
        insn(JEQ, 0, 5, 0),
        insn(LD_ABS, 0, 0, off_arg(1) + 4),
        insn(JEQ, 0, 3, 0),
        insn(LD_ABS, 0, 0, off_arg(2)),
        insn(JEQ, 0, 1, libc::SEEK_SET as u32),
        insn(RET, 0, 0, SECCOMP_RET_USER_NOTIF),
        insn(RET, 0, 0, SECCOMP_RET_ALLOW),
    ];
    f.push(insn(JEQ, 0, rewind.len() as u8, libc::SYS_lseek as u32));
    f.extend(rewind);
    // io_uring and file handles open files without a syscall the filter sees, so callers
    // fall back.
    for nr in [libc::SYS_io_uring_setup, libc::SYS_open_by_handle_at] {
        f.extend([
            insn(JEQ, 0, 1, nr as u32),
            insn(RET, 0, 0, SECCOMP_RET_ERRNO | libc::ENOSYS as u32),
        ]);
    }
    f.push(insn(RET, 0, 0, SECCOMP_RET_ALLOW));
    Some(f)
}

#[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
fn filter() -> Option<Vec<sock_filter>> {
    None
}

#[cfg(target_arch = "x86_64")]
fn native_abi(data: &SeccompData) -> bool {
    data.arch == AUDIT_ARCH && data.nr as u32 & X32_SYSCALL_BIT == 0
}

#[cfg(target_arch = "aarch64")]
fn native_abi(data: &SeccompData) -> bool {
    data.arch == AUDIT_ARCH
}

unsafe fn install_filter(program: &[sock_filter]) -> Option<c_int> {
    let fprog = libc::sock_fprog {
        len: program.len() as u16,
        filter: program.as_ptr() as *mut _,
    };
    if libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0 {
        return None;
    }
    let fd = libc::syscall(
        libc::SYS_seccomp,
        SECCOMP_SET_MODE_FILTER,
        SECCOMP_FILTER_FLAG_NEW_LISTENER,
        &fprog as *const libc::sock_fprog,
    );
    (fd >= 0).then_some(fd as c_int)
}

// ---------------------------------------------------------------------------------------
// Process lifecycle

unsafe fn supervise(log: c_int, argv: &[CString], program: Vec<sock_filter>) -> ! {
    let mut mask: libc::sigset_t = zeroed();
    libc::sigemptyset(&mut mask);
    libc::sigaddset(&mut mask, libc::SIGCHLD);
    for sig in FORWARDED {
        libc::sigaddset(&mut mask, sig);
    }
    let mut old: libc::sigset_t = zeroed();
    libc::sigprocmask(libc::SIG_BLOCK, &mask, &mut old);
    let give_up = |reason: &[u8]| -> ! {
        libc::sigprocmask(libc::SIG_SETMASK, &old, std::ptr::null_mut());
        untraced(log, reason);
        exec(argv)
    };

    let sfd = libc::signalfd(-1, &mask, libc::SFD_CLOEXEC);
    if sfd < 0 {
        give_up(b"could not create the supervisor signalfd");
    }
    let mut socks = [0 as c_int; 2];
    if libc::socketpair(
        libc::AF_UNIX,
        libc::SOCK_STREAM | libc::SOCK_CLOEXEC,
        0,
        socks.as_mut_ptr(),
    ) != 0
    {
        libc::close(sfd);
        give_up(b"could not create the supervisor socket");
    }
    let [parent_sock, child_sock] = socks;
    // Orphans the program leaves behind become this process's children, so they stay its
    // descendants and their memory stays readable under Yama ptrace_scope 1.
    libc::prctl(libc::PR_SET_CHILD_SUBREAPER, 1);

    let pid = libc::fork();
    if pid == 0 {
        libc::sigprocmask(libc::SIG_SETMASK, &old, std::ptr::null_mut());
        libc::close(parent_sock);
        // nx holds this process's pid, so the program must not outlive it.
        libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL);
        match install_filter(&program) {
            Some(listener) => {
                // Without a listener every notified syscall fails, exec included.
                if !send_fd(child_sock, listener) {
                    libc::_exit(127);
                }
                libc::close(listener);
            }
            None => {
                libc::write(child_sock, b"x".as_ptr().cast(), 1);
            }
        }
        libc::close(child_sock);
        exec(argv);
    }
    libc::close(child_sock);
    if pid < 0 {
        libc::close(parent_sock);
        libc::close(sfd);
        give_up(b"could not fork the supervisor");
    }

    let handoff = recv_fd(parent_sock);
    libc::close(parent_sock);
    let listener = match handoff {
        Handoff::Listener(fd) => {
            // A parked syscall waits only on this process's reply, so the kernel can switch
            // straight between the two instead of waking each through the scheduler.
            libc::ioctl(
                fd,
                SECCOMP_IOCTL_NOTIF_SET_FLAGS,
                SECCOMP_USER_NOTIF_FD_SYNC_WAKE_UP,
            );
            Some(fd)
        }
        Handoff::Unfiltered => {
            untraced(log, b"the seccomp filter could not be installed");
            None
        }
        Handoff::Failed => {
            let mut status = 0;
            libc::waitpid(pid, &mut status, 0);
            libc::close(sfd);
            give_up(b"the seccomp listener could not be handed over");
        }
    };
    let (status, listener) = run(log, sfd, pid, listener);
    if let Some(l) = listener {
        release_survivors(l, &old);
    }
    exit_like(status)
}

/// Serves notifications and forwards signals until the program exits. Returns its wait
/// status, and the listener if processes may still be using the filter.
unsafe fn run(
    log: c_int,
    sfd: c_int,
    pid: libc::pid_t,
    mut listener: Option<c_int>,
) -> (c_int, Option<c_int>) {
    loop {
        let mut fds = [
            libc::pollfd {
                fd: sfd,
                events: libc::POLLIN,
                revents: 0,
            },
            libc::pollfd {
                fd: listener.unwrap_or(-1),
                events: libc::POLLIN,
                revents: 0,
            },
        ];
        if libc::poll(fds.as_mut_ptr(), 2, -1) < 0 {
            continue;
        }
        if let Some(l) = listener {
            if fds[1].revents & libc::POLLIN != 0 {
                serve(l, log);
            } else if fds[1].revents != 0 {
                libc::close(l);
                listener = None;
            }
        }
        if fds[0].revents & libc::POLLIN != 0 {
            let mut info: libc::signalfd_siginfo = zeroed();
            libc::read(
                sfd,
                (&mut info as *mut libc::signalfd_siginfo).cast(),
                size_of::<libc::signalfd_siginfo>(),
            );
            if info.ssi_signo as c_int == libc::SIGCHLD {
                // SIGCHLDs coalesce, and adopted orphans are reaped here too.
                loop {
                    let mut status = 0;
                    match libc::waitpid(-1, &mut status, libc::WNOHANG) {
                        p if p == pid => return (status, listener),
                        p if p > 0 => continue,
                        _ => break,
                    }
                }
            } else {
                libc::kill(pid, info.ssi_signo as c_int);
            }
        }
    }
}

/// Processes the program left behind, such as a build tool's daemon, still carry the
/// filter. Their syscalls would fail with ENOSYS once the listener closes, so a detached
/// process keeps letting them through, without logging, until the last one exits.
unsafe fn release_survivors(listener: c_int, mask: &libc::sigset_t) {
    let mut pfd = libc::pollfd {
        fd: listener,
        events: libc::POLLIN,
        revents: 0,
    };
    if libc::poll(&mut pfd, 1, 0) == 1 && pfd.revents & libc::POLLHUP != 0 {
        return;
    }
    if libc::fork() != 0 {
        libc::close(listener);
        return;
    }
    libc::setsid();
    libc::sigprocmask(libc::SIG_SETMASK, mask, std::ptr::null_mut());
    // Holding the program's stdio open would keep its parent waiting for EOF.
    let null = libc::open(c"/dev/null".as_ptr(), libc::O_RDWR);
    for fd in 0..3 {
        libc::dup2(null, fd);
    }
    loop {
        pfd.revents = 0;
        if libc::poll(&mut pfd, 1, -1) < 0 {
            continue;
        }
        if pfd.revents & libc::POLLIN == 0 {
            libc::_exit(0);
        }
        let mut req: SeccompNotif = zeroed();
        if libc::ioctl(listener, SECCOMP_IOCTL_NOTIF_RECV, &mut req) == 0 {
            proceed(listener, req.id);
        }
    }
}

unsafe fn exit_like(status: c_int) -> ! {
    if libc::WIFSIGNALED(status) {
        let sig = libc::WTERMSIG(status);
        libc::signal(sig, libc::SIG_DFL);
        let mut set: libc::sigset_t = zeroed();
        libc::sigemptyset(&mut set);
        libc::sigaddset(&mut set, sig);
        libc::sigprocmask(libc::SIG_UNBLOCK, &set, std::ptr::null_mut());
        libc::kill(libc::getpid(), sig);
        libc::_exit(128 + sig);
    }
    libc::_exit(libc::WEXITSTATUS(status))
}

// ---------------------------------------------------------------------------------------
// Notifications

enum Event {
    Read(Vec<u8>),
    Listed(Vec<u8>),
    Unreadable,
    ForeignAbi,
}

static REPORTED_FOREIGN_ABI: AtomicBool = AtomicBool::new(false);

unsafe fn serve(listener: c_int, log: c_int) {
    let mut req: SeccompNotif = zeroed();
    if libc::ioctl(listener, SECCOMP_IOCTL_NOTIF_RECV, &mut req) != 0 {
        return;
    }
    let event = if native_abi(&req.data) {
        event(req.pid, req.data.nr as c_long, &req.data.args)
    } else {
        Some(Event::ForeignAbi)
    };
    // A process that died mid-notification may have had its pid reused, so what was read
    // from /proc only counts if the notification is still live.
    if libc::ioctl(listener, SECCOMP_IOCTL_NOTIF_ID_VALID, &req.id) == 0 {
        match event {
            Some(Event::Read(path)) => write_line(log, b"", &path),
            Some(Event::Listed(dir)) => write_line(log, b"!list ", &dir),
            Some(Event::Unreadable) => {
                let pid = req.pid.to_string();
                write_line(
                    log,
                    b"!untraced cannot read the memory of pid ",
                    pid.as_bytes(),
                )
            }
            Some(Event::ForeignAbi) if !REPORTED_FOREIGN_ABI.swap(true, Ordering::Relaxed) => {
                untraced(log, b"a process used a 32-bit or x32 syscall ABI")
            }
            Some(Event::ForeignAbi) | None => {}
        }
    }
    proceed(listener, req.id);
}

unsafe fn proceed(listener: c_int, id: u64) {
    let resp = SeccompNotifResp {
        id,
        val: 0,
        error: 0,
        flags: SECCOMP_USER_NOTIF_FLAG_CONTINUE,
    };
    libc::ioctl(listener, SECCOMP_IOCTL_NOTIF_SEND, &resp);
}

unsafe fn event(pid: u32, nr: c_long, a: &[u64; 6]) -> Option<Event> {
    #[cfg(target_arch = "x86_64")]
    if nr == libc::SYS_open {
        return open_event(pid, libc::AT_FDCWD, a[0], a[1] as c_int);
    }
    if nr == libc::SYS_openat {
        return open_event(pid, a[0] as c_int, a[1], a[2] as c_int);
    }
    if nr == libc::SYS_execveat {
        return path_event(pid, a[0] as c_int, a[1]);
    }
    if nr == libc::SYS_execve {
        return path_event(pid, libc::AT_FDCWD, a[0]);
    }
    if nr == libc::SYS_lseek {
        let path = fd_path(pid, a[0] as c_int)?;
        return is_dir(&path).then_some(Event::Listed(path));
    }
    if nr == libc::SYS_openat2 {
        // struct open_how starts with the u64 flags.
        let mut flags = [0u8; 8];
        match read_remote(pid, a[2], &mut flags) {
            Ok(8) => {}
            Err(e) if denied(e) => return Some(Event::Unreadable),
            _ => return None,
        }
        let flags = u64::from_ne_bytes(flags) as c_int;
        if flags & libc::O_PATH != 0 || flags & libc::O_ACCMODE == libc::O_WRONLY {
            return None;
        }
        return open_event(pid, a[0] as c_int, a[1], flags);
    }
    None
}

fn denied(errno: c_int) -> bool {
    errno == libc::EPERM || errno == libc::EACCES
}

/// Opening a directory readably is what listing it starts with.
unsafe fn open_event(pid: u32, dirfd: c_int, addr: u64, flags: c_int) -> Option<Event> {
    Some(match path_event(pid, dirfd, addr)? {
        Event::Read(path) if flags & libc::O_DIRECTORY != 0 || is_dir(&path) => Event::Listed(path),
        e => e,
    })
}

unsafe fn path_event(pid: u32, dirfd: c_int, addr: u64) -> Option<Event> {
    match read_cstr(pid, addr) {
        Ok(path) => resolve(pid, dirfd, path).map(Event::Read),
        Err(e) if denied(e) => Some(Event::Unreadable),
        Err(_) => None,
    }
}

fn is_dir(path: &[u8]) -> bool {
    std::fs::metadata(std::ffi::OsStr::from_bytes(path)).is_ok_and(|m| m.is_dir())
}

/// Makes `path` absolute against the tracee's cwd or `dirfd`. An empty path is `dirfd`
/// itself, as with AT_EMPTY_PATH.
fn resolve(pid: u32, dirfd: c_int, path: Vec<u8>) -> Option<Vec<u8>> {
    if path.first() == Some(&b'/') {
        return Some(path);
    }
    let mut base = if dirfd == libc::AT_FDCWD {
        std::fs::read_link(format!("/proc/{pid}/cwd"))
            .ok()?
            .into_os_string()
            .into_vec()
    } else {
        fd_path(pid, dirfd)?
    };
    if !path.is_empty() {
        base.push(b'/');
        base.extend_from_slice(&path);
    }
    Some(base)
}

fn fd_path(pid: u32, fd: c_int) -> Option<Vec<u8>> {
    let link = std::fs::read_link(format!("/proc/{pid}/fd/{fd}")).ok()?;
    let bytes = link.into_os_string().into_vec();
    (bytes.first() == Some(&b'/')).then_some(bytes)
}

unsafe fn read_remote(pid: u32, addr: u64, buf: &mut [u8]) -> Result<usize, c_int> {
    let local = libc::iovec {
        iov_base: buf.as_mut_ptr().cast(),
        iov_len: buf.len(),
    };
    let remote = libc::iovec {
        iov_base: addr as usize as *mut c_void,
        iov_len: buf.len(),
    };
    let n = libc::process_vm_readv(pid as libc::pid_t, &local, 1, &remote, 1, 0);
    if n < 0 {
        Err(*libc::__errno_location())
    } else {
        Ok(n as usize)
    }
}

/// Reads a NUL-terminated string from the parked tracee, a page at a time so a path that
/// ends just before an unmapped page still reads.
unsafe fn read_cstr(pid: u32, addr: u64) -> Result<Vec<u8>, c_int> {
    let mut buf = vec![0u8; libc::PATH_MAX as usize];
    let mut got = 0usize;
    while got < buf.len() {
        let page_left = 4096 - ((addr as usize + got) & 4095);
        let want = page_left.min(buf.len() - got);
        let n = read_remote(pid, addr + got as u64, &mut buf[got..got + want])?;
        if n == 0 {
            break;
        }
        if let Some(end) = buf[got..got + n].iter().position(|b| *b == 0) {
            buf.truncate(got + end);
            return Ok(buf);
        }
        got += n;
    }
    Err(libc::ENAMETOOLONG)
}

// ---------------------------------------------------------------------------------------
// Passing the listener fd

unsafe fn send_fd(sock: c_int, fd: c_int) -> bool {
    let mut byte = 0u8;
    let mut iov = libc::iovec {
        iov_base: (&mut byte as *mut u8).cast(),
        iov_len: 1,
    };
    let mut cbuf = [0u8; 32];
    let mut msg: libc::msghdr = zeroed();
    msg.msg_iov = &mut iov;
    msg.msg_iovlen = 1;
    msg.msg_control = cbuf.as_mut_ptr().cast();
    msg.msg_controllen = libc::CMSG_SPACE(size_of::<c_int>() as u32) as _;
    let cmsg = libc::CMSG_FIRSTHDR(&msg);
    (*cmsg).cmsg_level = libc::SOL_SOCKET;
    (*cmsg).cmsg_type = libc::SCM_RIGHTS;
    (*cmsg).cmsg_len = libc::CMSG_LEN(size_of::<c_int>() as u32) as _;
    std::ptr::copy_nonoverlapping(
        (&fd as *const c_int).cast::<u8>(),
        libc::CMSG_DATA(cmsg),
        size_of::<c_int>(),
    );
    libc::sendmsg(sock, &msg, 0) == 1
}

enum Handoff {
    Listener(c_int),
    /// The child could not install the filter and runs the program without it.
    Unfiltered,
    /// The child exited without running the program.
    Failed,
}

unsafe fn recv_fd(sock: c_int) -> Handoff {
    let mut byte = 0u8;
    let mut iov = libc::iovec {
        iov_base: (&mut byte as *mut u8).cast(),
        iov_len: 1,
    };
    let mut cbuf = [0u8; 32];
    let mut msg: libc::msghdr = zeroed();
    msg.msg_iov = &mut iov;
    msg.msg_iovlen = 1;
    msg.msg_control = cbuf.as_mut_ptr().cast();
    msg.msg_controllen = cbuf.len() as _;
    if libc::recvmsg(sock, &mut msg, libc::MSG_CMSG_CLOEXEC) <= 0 {
        return Handoff::Failed;
    }
    let cmsg = libc::CMSG_FIRSTHDR(&msg);
    if cmsg.is_null() || (*cmsg).cmsg_type != libc::SCM_RIGHTS {
        return Handoff::Unfiltered;
    }
    let mut fd: c_int = -1;
    std::ptr::copy_nonoverlapping(
        libc::CMSG_DATA(cmsg),
        (&mut fd as *mut c_int).cast::<u8>(),
        size_of::<c_int>(),
    );
    Handoff::Listener(fd)
}
