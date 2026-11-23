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
    use std::time::UNIX_EPOCH;
    metadata
        .modified()
        .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
        .unwrap_or(0)
}

/// What an archived hash is keyed on, read from the stat the walk already did.
/// `get_mod_time` cannot separate two writes that land in one timestamp tick,
/// so the fields that move independently of the mtime are folded in with it.
#[cfg(unix)]
pub fn get_metadata_key(metadata: &Metadata) -> u64 {
    use std::os::unix::fs::MetadataExt;
    hash_fields(&[
        metadata.size(),
        metadata.ino(),
        metadata.mtime() as u64,
        metadata.mtime_nsec() as u64,
        metadata.ctime() as u64,
        metadata.ctime_nsec() as u64,
    ])
}

/// Windows adds only size and creation time, because a walk's metadata carries
/// no change time and `Metadata::change_time` is unstable. A same-size rewrite
/// inside one last-write tick therefore still reads as unchanged.
#[cfg(windows)]
pub fn get_metadata_key(metadata: &Metadata) -> u64 {
    use std::os::windows::fs::MetadataExt;
    hash_fields(&[
        metadata.file_size(),
        metadata.last_write_time(),
        metadata.creation_time(),
    ])
}

#[cfg(not(any(unix, windows)))]
pub fn get_metadata_key(metadata: &Metadata) -> u64 {
    hash_fields(&[metadata.len(), get_mod_time(metadata) as u64])
}

/// Each field is hashed at its full width, so no two sets of fields can pack
/// into the same bytes.
fn hash_fields(fields: &[u64]) -> u64 {
    const MAX_FIELDS: usize = 6;
    debug_assert!(fields.len() <= MAX_FIELDS);
    let mut bytes = [0u8; MAX_FIELDS * 8];
    for (slot, field) in bytes.chunks_exact_mut(8).zip(fields) {
        slot.copy_from_slice(&field.to_le_bytes());
    }
    xxhash_rust::xxh3::xxh3_64(&bytes[..fields.len() * 8])
}

/// "Now", in the same units and resolution `get_mod_time` reports on this
/// platform. Stamped into the files archive so a later selective hash can tell
/// which entries were read while the workspace could still be changing under it.
///
/// FILETIME ticks, matching `last_write_time`. 100ns is FILETIME's
/// representation, not its resolution: Windows stamps last-write from the
/// system clock, whose granularity is the timer interval (~15.6ms, 1ms if a
/// process raised it), and exFAT/SMB volumes are coarser still at 2s. Two
/// writes inside one tick therefore do share a timestamp, so the guard is
/// needed here exactly as it is elsewhere.
#[cfg(target_os = "windows")]
pub fn gather_stamp() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    /// 100ns ticks between the FILETIME epoch (1601-01-01) and the Unix epoch.
    const FILETIME_TICKS_AT_UNIX_EPOCH: i64 = 116_444_736_000_000_000;
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| (d.as_nanos() / 100) as i64 + FILETIME_TICKS_AT_UNIX_EPOCH)
        .unwrap_or(0)
}

/// Whole seconds, matching `st_mtime`/`mtime()`. Falls back to 0 — which makes
/// every archived entry ambiguous, costing a full re-hash rather than trusting
/// a stale one — if the clock is unreadable.
#[cfg(not(target_os = "windows"))]
pub fn gather_stamp() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
