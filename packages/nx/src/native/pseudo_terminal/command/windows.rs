use std::io::{Read, Stdin, Write};
use std::os::windows::ffi::OsStrExt;
use std::{ffi::OsString, os::windows::ffi::OsStringExt};
use winapi::um::fileapi::GetShortPathNameW;

use super::pseudo_terminal::LiveWriter;

pub fn handle_path_space(path: String) -> String {
    let wide: Vec<u16> = std::path::PathBuf::from(&path)
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let mut buffer: Vec<u16> = vec![0; wide.len() * 2];
    let result =
        unsafe { GetShortPathNameW(wide.as_ptr(), buffer.as_mut_ptr(), buffer.len() as u32) };
    if result == 0 {
        path
    } else {
        let len = buffer.iter().position(|&x| x == 0).unwrap();
        let short_path: String = OsString::from_wide(&buffer[..len])
            .to_string_lossy()
            .into_owned();
        short_path
    }
}

pub fn write_to_pty(stdin: &mut Stdin, live_writer: LiveWriter) -> anyhow::Result<()> {
    let mut buffer = [0; 1024];
    loop {
        let n = match stdin.read(&mut buffer) {
            Ok(0) => return Ok(()),
            Ok(n) => n,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(e.into()),
        };
        // Lock only around the write. Holding it across the blocking read
        // deadlocks a thread that needs the same lock to close the fd.
        let Some(writer) = live_writer.read().clone() else {
            continue;
        };
        let mut writer = writer.lock();
        writer.write_all(&buffer[..n])?;
        writer.flush()?;
    }
}
