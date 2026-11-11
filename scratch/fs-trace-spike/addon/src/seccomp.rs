//! Linux backend: seccomp user notification. The child installs a BPF filter on itself
//! before exec (no privileges needed, only no_new_privs) and hands us the listener fd.
//! The kernel then parks every matching syscall in the tree until we acknowledge it, so
//! this sees static binaries and raw syscalls that an LD_PRELOAD shim cannot.

use libc::{c_int, c_long, c_void};
use std::collections::HashSet;
use std::io;
use std::os::unix::process::CommandExt;
use std::process::Command;
use std::sync::{Arc, Mutex};

const SECCOMP_SET_MODE_FILTER: c_long = 1;
const SECCOMP_FILTER_FLAG_NEW_LISTENER: c_long = 1 << 3;
const SECCOMP_RET_ALLOW: u32 = 0x7fff_0000;
const SECCOMP_RET_USER_NOTIF: u32 = 0x7fc0_0000;
const SECCOMP_RET_ERRNO: u32 = 0x0005_0000;
const SECCOMP_USER_NOTIF_FLAG_CONTINUE: u32 = 1;
// _IOWR('!', 0, struct seccomp_notif) / _IOWR('!', 1, struct seccomp_notif_resp)
const SECCOMP_IOCTL_NOTIF_RECV: libc::c_ulong = 0xc050_2100;
const SECCOMP_IOCTL_NOTIF_SEND: libc::c_ulong = 0xc018_2101;

#[cfg(target_arch = "x86_64")]
const AUDIT_ARCH: u32 = 0xc000_003e;
#[cfg(target_arch = "aarch64")]
const AUDIT_ARCH: u32 = 0xc000_00b7;

#[repr(C)]
#[derive(Default)]
struct SeccompData {
    nr: c_int,
    arch: u32,
    ip: u64,
    args: [u64; 6],
}
#[repr(C)]
#[derive(Default)]
struct SeccompNotif {
    id: u64,
    pid: u32,
    flags: u32,
    data: SeccompData,
}
#[repr(C)]
#[derive(Default)]
struct SeccompNotifResp {
    id: u64,
    val: i64,
    error: i32,
    flags: u32,
}

const LD_ABS: u16 = 0x20; // BPF_LD | BPF_W | BPF_ABS
const JEQ: u16 = 0x15; // BPF_JMP | BPF_JEQ | BPF_K
const AND: u16 = 0x54; // BPF_ALU | BPF_AND | BPF_K
const RET: u16 = 0x06; // BPF_RET | BPF_K
const OFF_NR: u32 = 0;
const OFF_ARCH: u32 = 4;
const fn off_arg(i: u32) -> u32 {
    16 + 8 * i
}

fn insn(code: u16, jt: u8, jf: u8, k: u32) -> libc::sock_filter {
    libc::sock_filter { code, jt, jf, k }
}

/// Keep in sync with shim/src/lib.rs.
const MAGIC: u64 = 0x6673_7472_6163_6521;
const JSET: u16 = 0x45; // BPF_JMP | BPF_JSET | BPF_K

/// Notify on read-capable file opens and execs; everything else runs at native speed.
/// Write-only and directory opens are dropped in-kernel and never reach the supervisor.
/// With `shim_bypass`, opens the preload shim already reported are dropped too.
fn filter(shim_bypass: bool) -> Vec<libc::sock_filter> {
    let mut f = vec![
        insn(LD_ABS, 0, 0, OFF_ARCH),
        insn(JEQ, 1, 0, AUDIT_ARCH),
        insn(RET, 0, 0, SECCOMP_RET_ALLOW),
        insn(LD_ABS, 0, 0, OFF_NR),
    ];
    let mut open_like = |nr: c_long, flags_arg: u32, bypass: bool| {
        let mut body = Vec::new();
        if bypass {
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
            insn(JSET, 3, 0, libc::O_DIRECTORY as u32),
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
    open_like(libc::SYS_openat, 2, shim_bypass);
    for nr in [libc::SYS_openat2, libc::SYS_execve, libc::SYS_execveat] {
        f.extend([insn(JEQ, 0, 1, nr as u32), insn(RET, 0, 0, SECCOMP_RET_USER_NOTIF)]);
    }
    // io_uring can open files without a syscall we would see; make callers fall back.
    f.extend([
        insn(JEQ, 0, 1, libc::SYS_io_uring_setup as u32),
        insn(RET, 0, 0, SECCOMP_RET_ERRNO | libc::ENOSYS as u32),
        insn(RET, 0, 0, SECCOMP_RET_ALLOW),
    ]);
    f
}

fn cvt(r: c_long) -> io::Result<c_long> {
    if r < 0 { Err(io::Error::last_os_error()) } else { Ok(r) }
}

unsafe fn send_fd(sock: c_int, fd: c_int) -> io::Result<()> {
    let mut byte = 0u8;
    let mut iov = libc::iovec { iov_base: (&mut byte as *mut u8).cast(), iov_len: 1 };
    let mut cbuf = [0u8; 32];
    let mut msg: libc::msghdr = std::mem::zeroed();
    msg.msg_iov = &mut iov;
    msg.msg_iovlen = 1;
    msg.msg_control = cbuf.as_mut_ptr().cast();
    msg.msg_controllen = libc::CMSG_SPACE(4) as _;
    let cmsg = libc::CMSG_FIRSTHDR(&msg);
    (*cmsg).cmsg_level = libc::SOL_SOCKET;
    (*cmsg).cmsg_type = libc::SCM_RIGHTS;
    (*cmsg).cmsg_len = libc::CMSG_LEN(4) as _;
    std::ptr::copy_nonoverlapping(&fd as *const c_int as *const u8, libc::CMSG_DATA(cmsg), 4);
    cvt(libc::sendmsg(sock, &msg, 0) as c_long).map(|_| ())
}

unsafe fn recv_fd(sock: c_int) -> Option<c_int> {
    let mut byte = 0u8;
    let mut iov = libc::iovec { iov_base: (&mut byte as *mut u8).cast(), iov_len: 1 };
    let mut cbuf = [0u8; 32];
    let mut msg: libc::msghdr = std::mem::zeroed();
    msg.msg_iov = &mut iov;
    msg.msg_iovlen = 1;
    msg.msg_control = cbuf.as_mut_ptr().cast();
    msg.msg_controllen = cbuf.len() as _;
    if libc::recvmsg(sock, &mut msg, libc::MSG_CMSG_CLOEXEC) <= 0 {
        return None;
    }
    let cmsg = libc::CMSG_FIRSTHDR(&msg);
    if cmsg.is_null() || (*cmsg).cmsg_type != libc::SCM_RIGHTS {
        return None;
    }
    let mut fd: c_int = -1;
    std::ptr::copy_nonoverlapping(libc::CMSG_DATA(cmsg), &mut fd as *mut c_int as *mut u8, 4);
    Some(fd)
}

/// Reads a NUL-terminated string out of the paused tracee. One syscall, no /proc fd.
unsafe fn read_cstr(pid: u32, addr: u64) -> Option<String> {
    let mut buf = [0u8; 4096];
    // Stop at the page end first: a path near an unmapped page would fail a full read.
    let first = (4096 - (addr as usize & 4095)).min(buf.len());
    let mut got = 0usize;
    for want in [first, buf.len() - first] {
        if want == 0 {
            break;
        }
        let local = libc::iovec { iov_base: buf.as_mut_ptr().add(got).cast(), iov_len: want };
        let remote = libc::iovec { iov_base: (addr as usize + got) as *mut c_void, iov_len: want };
        let n = libc::process_vm_readv(pid as i32, &local, 1, &remote, 1, 0);
        if n <= 0 {
            break;
        }
        got += n as usize;
        if buf[..got].contains(&0) {
            break;
        }
    }
    let end = buf[..got].iter().position(|b| *b == 0)?;
    Some(String::from_utf8_lossy(&buf[..end]).into_owned())
}

fn resolve(pid: u32, dirfd: i32, path: String) -> String {
    if path.starts_with('/') {
        return path;
    }
    let link = if dirfd == libc::AT_FDCWD {
        format!("/proc/{pid}/cwd")
    } else {
        format!("/proc/{pid}/fd/{dirfd}")
    };
    match std::fs::read_link(link) {
        Ok(base) => format!("{}/{}", base.display(), path),
        Err(_) => path,
    }
}

fn supervise(sock: c_int, seen: Arc<Mutex<(u32, HashSet<String>)>>) {
    let Some(listener) = (unsafe { recv_fd(sock) }) else {
        unsafe { libc::close(sock) };
        return;
    };
    unsafe { libc::close(sock) };
    loop {
        let mut pfd = libc::pollfd { fd: listener, events: libc::POLLIN, revents: 0 };
        if unsafe { libc::poll(&mut pfd, 1, -1) } < 0 {
            continue;
        }
        if pfd.revents & libc::POLLIN == 0 {
            break; // POLLHUP: every process carrying the filter has exited
        }
        let mut req = SeccompNotif::default();
        if unsafe { libc::ioctl(listener, SECCOMP_IOCTL_NOTIF_RECV, &mut req) } < 0 {
            continue;
        }
        let a = req.data.args;
        let nr = req.data.nr as c_long;
        let (dirfd, ptr) = if nr == libc::SYS_execve || is_plain_open(nr) {
            (libc::AT_FDCWD, a[0])
        } else {
            (a[0] as i32, a[1])
        };
        // The tracee's memory and /proc entries are only stable while it is parked.
        let resolved = unsafe { read_cstr(req.pid, ptr) }.map(|p| resolve(req.pid, dirfd, p));
        let resp = SeccompNotifResp { id: req.id, val: 0, error: 0, flags: SECCOMP_USER_NOTIF_FLAG_CONTINUE };
        unsafe { libc::ioctl(listener, SECCOMP_IOCTL_NOTIF_SEND, &resp) };
        if let Some(p) = resolved {
            let mut guard = seen.lock().unwrap();
            guard.0 += 1;
            guard.1.insert(p);
        }
    }
    unsafe { libc::close(listener) };
}

fn is_plain_open(_nr: c_long) -> bool {
    #[cfg(target_arch = "x86_64")]
    return _nr == libc::SYS_open;
    #[cfg(not(target_arch = "x86_64"))]
    false
}

pub fn run(mut command: Command, shim_bypass: bool) -> io::Result<(i32, u32, Vec<String>)> {
    let mut socks = [0 as c_int; 2];
    cvt(unsafe { libc::socketpair(libc::AF_UNIX, libc::SOCK_STREAM | libc::SOCK_CLOEXEC, 0, socks.as_mut_ptr()) } as c_long)?;
    let [parent_sock, child_sock] = socks;

    let seen = Arc::new(Mutex::new((0u32, HashSet::new())));
    let supervisor_seen = seen.clone();
    // Must be running before spawn(): the child's own execve is the first notification.
    // Detached on purpose: it has to outlive the direct child while any descendant
    // still carries the filter, or their opens would start failing with ENOSYS.
    std::thread::spawn(move || supervise(parent_sock, supervisor_seen));

    let prog = filter(shim_bypass);
    unsafe {
        command.pre_exec(move || {
            let fprog = libc::sock_fprog { len: prog.len() as u16, filter: prog.as_ptr() as *mut _ };
            cvt(libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) as c_long)?;
            let listener = cvt(libc::syscall(
                libc::SYS_seccomp,
                SECCOMP_SET_MODE_FILTER,
                SECCOMP_FILTER_FLAG_NEW_LISTENER,
                &fprog as *const libc::sock_fprog,
            ))? as c_int;
            send_fd(child_sock, listener)?;
            libc::close(listener);
            Ok(())
        });
    }
    let spawned = command.spawn();
    unsafe { libc::close(child_sock) };
    let status = spawned?.wait()?;
    let guard = seen.lock().unwrap();
    Ok((status.code().unwrap_or(-1), guard.0, guard.1.iter().cloned().collect()))
}
