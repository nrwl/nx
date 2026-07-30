//! Lightweight timing collection for native code paths.
//!
//! When `NX_NATIVE_PROFILE=1` is set, key operations record their wall-clock
//! duration into a global list. The JS layer retrieves the list via
//! `getNativeTimings()` and includes it in the combined profile report.
//!
//! Design goals:
//!   - Zero overhead when disabled: call-sites open spans with `start()`, which
//!     performs a single relaxed atomic load and only reads the clock when
//!     profiling is on
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
///
/// The variable is a boolean: only `1` and `true` enable profiling. Presence
/// alone is not enough, so `NX_NATIVE_PROFILE=0` and `=false` turn it off as a
/// user would expect.
pub fn init() {
    if std::env::var("NX_NATIVE_PROFILE").is_ok_and(|v| v == "1" || v == "true") {
        ENABLED.store(true, Ordering::Relaxed);
    }
}

/// Returns `true` if profiling is active. Used by call-sites to skip work.
#[inline]
pub fn enabled() -> bool {
    ENABLED.load(Ordering::Relaxed)
}

/// Opens a span. Returns `Some(Instant::now())` only when profiling is active,
/// so a disabled profiler costs one relaxed atomic load and never reads the
/// clock. Pair with [`record`].
#[inline]
pub fn start() -> Option<Instant> {
    enabled().then(Instant::now)
}

/// Record a span opened with [`start`]. No-op if profiling is disabled — in
/// that case `start` returned `None` and no elapsed time is ever computed.
pub fn record(name: &str, start: Option<Instant>) {
    if let Some(start) = start {
        record_ms(name, start.elapsed().as_secs_f64() * 1000.0);
    }
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
/// Draining: the returned spans are removed from the store, so a second call
/// reports only what was recorded since the first. This keeps a long-lived
/// process (e.g. the daemon) from growing the list without bound and stops
/// repeat calls from double-reporting the same span.
///
/// ```js
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
    // A poisoned lock means some thread panicked while pushing a span; the Vec
    // itself is still intact. Recover it rather than returning `None`, which the
    // caller cannot tell apart from "profiling was off".
    let mut guard = EVENTS.lock().unwrap_or_else(|e| e.into_inner());
    let events = std::mem::take(&mut *guard);
    drop(guard);
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
