use crate::native::logger::enable_logger;
use tracing::{error, info};

#[napi]
pub fn log_info(message: String) {
    enable_logger();
    info!(message);
}

#[napi]
pub fn log_error(message: String) {
    enable_logger();
    error!(message);
}
