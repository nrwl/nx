use std::fs::Metadata;

#[cfg(target_os = "macos")]
pub fn get_mod_time(metadata: &Metadata) -> i64 {
    use std::os::macos::fs::MetadataExt;
    metadata.st_mtime()
}

#[cfg(target_os = "windows")]
pub fn get_mod_time(metadata: &Metadata) -> i64 {
    use std::os::windows::fs::MetadataExt;
    metadata.last_write_time() as i64
}

#[cfg(any(target_os = "linux", target_os = "freebsd"))]
pub fn get_mod_time(metadata: &Metadata) -> i64 {
    use std::os::unix::fs::MetadataExt;
    metadata.mtime()
}

#[cfg(target_os = "wasi")]
pub fn get_mod_time(metadata: &Metadata) -> i64 {
    use std::os::wasi::fs::MetadataExt;
    metadata.mtim() as i64
}
