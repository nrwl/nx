use std::time::{SystemTime, UNIX_EPOCH};

/// Returns the current time in milliseconds since Unix epoch
pub fn current_timestamp_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
