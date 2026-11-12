//! Starts the root of a traced tree through the shim's `fstrace_spawn`, so the exec
//! rewrite also applies to a restricted root that `Command` would start directly.

use std::ffi::{c_char, c_int, CString, OsString};
use std::io;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::process::ExitStatusExt;
use std::process::{Command, ExitStatus};
use std::ptr::null;

type SpawnFn = unsafe extern "C" fn(
    *mut libc::pid_t,
    *const c_char,
    *const c_char,
    *const *const c_char,
    *const *const c_char,
) -> c_int;

fn cstring(bytes: &[u8]) -> io::Result<CString> {
    CString::new(bytes).map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))
}

fn null_terminated(strings: &[CString]) -> Vec<*const c_char> {
    strings
        .iter()
        .map(|s| s.as_ptr())
        .chain(std::iter::once(null()))
        .collect()
}

/// Runs `command` (program, args, cwd and env overrides) through the shim at `shim`.
pub fn spawn(shim: &str, command: &Command) -> io::Result<ExitStatus> {
    let shim = cstring(shim.as_bytes())?;
    // The shim stays loaded for the life of the process; dlopen returns the same handle.
    let handle = unsafe { libc::dlopen(shim.as_ptr(), libc::RTLD_NOW | libc::RTLD_LOCAL) };
    let sym = if handle.is_null() {
        null()
    } else {
        unsafe { libc::dlsym(handle, c"fstrace_spawn".as_ptr()) }
    };
    if sym.is_null() {
        return Err(io::Error::other("the shim does not export fstrace_spawn"));
    }
    let fstrace_spawn: SpawnFn = unsafe { std::mem::transmute(sym) };

    let program = cstring(command.get_program().as_bytes())?;
    let argv = std::iter::once(command.get_program())
        .chain(command.get_args())
        .map(|a| cstring(a.as_bytes()))
        .collect::<io::Result<Vec<_>>>()?;

    let mut env: std::collections::BTreeMap<OsString, OsString> = std::env::vars_os().collect();
    for (key, value) in command.get_envs() {
        match value {
            Some(v) => env.insert(key.to_owned(), v.to_owned()),
            None => env.remove(key),
        };
    }
    let envp = env
        .iter()
        .map(|(k, v)| cstring(&[k.as_bytes(), b"=", v.as_bytes()].concat()))
        .collect::<io::Result<Vec<_>>>()?;
    let cwd = command
        .get_current_dir()
        .map(|d| cstring(d.as_os_str().as_bytes()))
        .transpose()?;

    let mut pid: libc::pid_t = 0;
    let r = unsafe {
        fstrace_spawn(
            &mut pid,
            program.as_ptr(),
            cwd.as_ref().map_or(null(), |c| c.as_ptr()),
            null_terminated(&argv).as_ptr(),
            null_terminated(&envp).as_ptr(),
        )
    };
    if r != 0 {
        return Err(io::Error::from_raw_os_error(r));
    }
    let mut status: c_int = 0;
    while unsafe { libc::waitpid(pid, &mut status, 0) } < 0 {
        let err = io::Error::last_os_error();
        if err.kind() != io::ErrorKind::Interrupted {
            return Err(err);
        }
    }
    Ok(ExitStatus::from_raw(status))
}
