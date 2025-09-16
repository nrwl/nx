use crate::native::logger::enable_logger;
use tracing::debug;

#[napi]
pub fn log_debug(message: String) {
    enable_logger();
    debug!(message);
}
