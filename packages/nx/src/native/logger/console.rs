use crate::native::logger::enable_logger;
use tracing::{debug, error};

#[napi]
pub fn log_debug(message: String) {
    enable_logger();
    debug!(message);
}

#[napi]
pub fn log_error(message: String) {
    enable_logger();
    error!(message);
}
