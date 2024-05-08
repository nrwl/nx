use std::io::{Stdin, Write};
use std::os::windows::ffi::OsStrExt;
use std::{ffi::OsString, os::windows::ffi::OsStringExt};

use winapi::um::fileapi::GetShortPathNameW;

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

pub fn write_to_pty(stdin: &mut Stdin, writer: &mut impl Write) -> anyhow::Result<()> {
    std::io::copy(stdin, writer)
        .map_err(|e| anyhow::anyhow!(e))
        .map(|_| ())
}
