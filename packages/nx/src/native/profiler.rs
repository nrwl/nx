//! Lightweight timing collection for native code paths.
//!
//! When `NX_NATIVE_PROFILE=1` is set, key operations record their wall-clock
//! duration into a global list. The JS layer retrieves the list via
//! `getNativeTimings()` and includes it in the combined profile report.
//!
//! Design goals:
//!   - Zero overhead when disabled (single atomic load per call-site)
//!   - No allocation on the hot path beyond the String key
//!   - Callable from any thread without blocking

use once_cell::sync::Lazy;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

static ENABLED: AtomicBool = AtomicBool::new(false);

struct Event {
    name: String,
    duration_ms: f64,
}

static EVENTS: Lazy<Mutex<Vec<Event>>> = Lazy::new(|| Mutex::new(Vec::new()));

/// Call once at process start (or first use). Reads `NX_NATIVE_PROFILE` env var.
pub fn init() {
    if std::env::var("NX_NATIVE_PROFILE").is_ok() {
        ENABLED.store(true, Ordering::Relaxed);
    }
}

/// Returns `true` if profiling is active. Used by call-sites to skip work.
#[inline]
pub fn enabled() -> bool {
    ENABLED.load(Ordering::Relaxed)
}

/// Record a span that just completed. `start` is the `Instant` captured at entry.
/// No-op if profiling is disabled.
pub fn record(name: &str, start: Instant) {
    record_ms(name, start.elapsed().as_secs_f64() * 1000.0);
}

/// Record a span using a pre-computed duration (useful when a `Duration` is already
/// in scope, e.g. to avoid double-measuring by calling `elapsed()` again).
pub fn record_ms(name: &str, duration_ms: f64) {
    if !ENABLED.load(Ordering::Relaxed) {
        return;
    }
    if let Ok(mut events) = EVENTS.lock() {
        events.push(Event {
            name: name.to_string(),
            duration_ms,
        });
    }
}

/// Returns a JSON array of `{ name, durationMs }` objects, or `null` if
/// profiling was not enabled. Called from the JS layer on process exit.
///
/// ```
/// // TypeScript
/// import { getNativeTimings } from './native';
/// const raw = getNativeTimings();
/// const entries = raw ? JSON.parse(raw) : [];
/// ```
#[napi]
pub fn get_native_timings() -> Option<String> {
    if !ENABLED.load(Ordering::Relaxed) {
        return None;
    }
    let events = EVENTS.lock().ok()?;
    // Manually build JSON to avoid requiring serde derive feature
    let mut buf = String::with_capacity(events.len() * 64);
    buf.push('[');
    for (i, e) in events.iter().enumerate() {
        if i > 0 {
            buf.push(',');
        }
        buf.push_str(
            &serde_json::json!({
                "name": e.name,
                "durationMs": e.duration_ms,
            })
            .to_string(),
        );
    }
    buf.push(']');
    Some(buf)
}
