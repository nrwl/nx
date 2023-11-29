use std::fs::Metadata;

#[cfg(target_os = "macos")]
pub fn get_mod_time(metadata: &Metadata) -> i64 {
    use std::os::macos::fs::MetadataExt;
    metadata.st_mtime()
}

#[cfg(target_os = "windows")]
pub fn get_mod_time(metadata: &Metadata) -> i64 {
    use std::os::windows::fs::MetadataExt;
    metadata.last_write_time()
}

#[cfg(target_os = "linux")]
pub fn get_mod_time(metadata: &Metadata) -> i64 {
    use std::os::linux::fs::MetadataExt;
    metadata.mtime()
}
