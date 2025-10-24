use std::time::{SystemTime, SystemTimeError, UNIX_EPOCH};

/// Returns the current time in milliseconds since Unix epoch
pub fn current_timestamp_millis() -> Result<i64, SystemTimeError> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
}
