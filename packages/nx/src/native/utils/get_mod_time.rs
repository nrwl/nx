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
