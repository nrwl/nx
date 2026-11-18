use tracing::debug;

#[napi]
pub fn log_debug(message: String) {
    debug!(message);
}
