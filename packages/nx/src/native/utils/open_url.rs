//! Open a URL in the user's default browser from native code.
//!
//! Replaces the JS `open` npm package (NXC-3940). Best-effort by contract: a
//! missing or unreachable opener never panics, it just returns `false` so the
//! caller can fall back to printing the URL.

#[cfg(not(target_arch = "wasm32"))]
use std::process::{Command, Stdio};
#[cfg(not(target_arch = "wasm32"))]
use std::sync::OnceLock;

/// Open `url` in the user's default browser. Returns `true` if an opener
/// process was spawned, `false` if it couldn't be (e.g. no `xdg-open`), so the
/// caller can tell the user instead of failing silently. Never throws.
#[cfg(not(target_arch = "wasm32"))]
#[napi]
pub fn open_url(url: String) -> bool {
    open_url_native(&url)
}

/// Rust-facing entry point (the napi wrapper just forwards a `String`). Callers
/// inside the native crate — e.g. the TUI — use this directly.
#[cfg(not(target_arch = "wasm32"))]
pub fn open_url_native(url: &str) -> bool {
    build_open_command(url)
        .stdin(Stdio::null())
        // Detach stdio to null so a launched opener can't corrupt a terminal
        // we may be drawing to (the TUI).
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .is_ok()
}

#[cfg(all(not(target_arch = "wasm32"), target_os = "macos"))]
fn build_open_command(url: &str) -> Command {
    let mut c = Command::new("open");
    c.arg(url);
    c
}

#[cfg(all(not(target_arch = "wasm32"), target_os = "windows"))]
fn build_open_command(url: &str) -> Command {
    let mut c = Command::new("cmd");
    // The empty "" is the window-title argument `start` expects first.
    c.args(["/C", "start", "", url]);
    c
}

#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
fn build_open_command(url: &str) -> Command {
    // On a non-container WSL2 host the Linux `xdg-open` usually can't reach a
    // browser, so hand the URL to the *Windows* host browser. Inside a
    // Docker/Podman container the Windows interop path is absent and spawning
    // it is exactly the crash this replaces (`open@8` misdetected Podman as
    // bare WSL) — so containers must stay on `xdg-open`.
    if is_wsl2() && !is_in_container() {
        windows_browser_command(url)
    } else {
        let mut c = Command::new("xdg-open");
        c.arg(url);
        c
    }
}

/// WSL2 has "WSL2" in `/proc/version`; WSL1's interop differs and is not
/// targeted (its `xdg-open` path is left as the default fallback).
#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
fn is_wsl2() -> bool {
    static IS_WSL2: OnceLock<bool> = OnceLock::new();
    *IS_WSL2.get_or_init(|| {
        std::fs::read_to_string("/proc/version")
            .map(|contents| contents.contains("WSL2"))
            .unwrap_or(false)
    })
}

/// Detects an OCI container (Docker `/​.dockerenv`, or Podman
/// `/run/.containerenv`). This is the marker `open@8`'s `is-docker` missed for
/// Podman, causing the original crash.
#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
fn is_in_container() -> bool {
    static IN_CONTAINER: OnceLock<bool> = OnceLock::new();
    *IN_CONTAINER.get_or_init(|| {
        std::path::Path::new("/.dockerenv").exists()
            || std::path::Path::new("/run/.containerenv").exists()
    })
}

/// Launch the Windows browser from WSL via the host PowerShell. The URL is
/// handed over as a base64 UTF-16LE `-EncodedCommand` (the same mechanism the
/// `open` package used) so shell metacharacters — notably `&` in a query
/// string, a `cmd.exe` separator — can neither break the command line nor
/// inject anything: the URL never appears on a command line as text.
#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
fn windows_browser_command(url: &str) -> Command {
    // Single-quoted PowerShell literal; the only in-literal escape is a single
    // quote, doubled.
    let script = format!("Start-Process '{}'", url.replace('\'', "''"));
    let utf16le: Vec<u8> = script
        .encode_utf16()
        .flat_map(|unit| unit.to_le_bytes())
        .collect();
    let mut c = Command::new("powershell.exe");
    c.args([
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        &base64_encode(&utf16le),
    ]);
    c
}

/// Minimal standard-alphabet base64 encoder (padded). Kept local to avoid a new
/// crate dependency for the single WSL `-EncodedCommand` call site.
#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
fn base64_encode(input: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(input.len().div_ceil(3) * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((n >> 18) & 63) as usize] as char);
        out.push(TABLE[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 {
            TABLE[((n >> 6) & 63) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            TABLE[(n & 63) as usize] as char
        } else {
            '='
        });
    }
    out
}

#[cfg(all(
    test,
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
mod tests {
    use super::*;

    #[test]
    fn base64_matches_known_vectors() {
        assert_eq!(base64_encode(b""), "");
        assert_eq!(base64_encode(b"f"), "Zg==");
        assert_eq!(base64_encode(b"fo"), "Zm8=");
        assert_eq!(base64_encode(b"foo"), "Zm9v");
        assert_eq!(base64_encode(b"foob"), "Zm9vYg==");
        assert_eq!(base64_encode(b"fooba"), "Zm9vYmE=");
        assert_eq!(base64_encode(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn wsl_command_encodes_url_without_leaking_metacharacters() {
        // A URL with `&` (cmd separator) and a single quote must round-trip
        // through the encoded command untouched — the raw URL must never appear
        // as a plain argument.
        let url = "https://cloud.nx.app/connect?a=1&b=2&x='y";
        let cmd = windows_browser_command(url);
        let args: Vec<String> = cmd
            .get_args()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        assert_eq!(cmd.get_program(), "powershell.exe");
        assert!(args.iter().any(|a| a == "-EncodedCommand"));
        // No argument carries the raw URL or a bare `&`.
        assert!(!args.iter().any(|a| a.contains("://")));
        assert!(!args.iter().any(|a| a.contains('&')));

        // The encoded payload decodes back to a single-quoted Start-Process
        // with the quote doubled.
        let encoded = args.last().unwrap();
        let bytes = decode_base64(encoded);
        let utf16: Vec<u16> = bytes
            .chunks(2)
            .map(|p| u16::from_le_bytes([p[0], p[1]]))
            .collect();
        let script = String::from_utf16(&utf16).unwrap();
        assert_eq!(
            script,
            "Start-Process 'https://cloud.nx.app/connect?a=1&b=2&x=''y'"
        );
    }

    // Test-only decoder to verify the encoder.
    #[cfg(test)]
    fn decode_base64(s: &str) -> Vec<u8> {
        fn val(c: u8) -> Option<u32> {
            match c {
                b'A'..=b'Z' => Some((c - b'A') as u32),
                b'a'..=b'z' => Some((c - b'a' + 26) as u32),
                b'0'..=b'9' => Some((c - b'0' + 52) as u32),
                b'+' => Some(62),
                b'/' => Some(63),
                _ => None,
            }
        }
        let bytes: Vec<u8> = s.bytes().filter(|&c| c != b'=').collect();
        let mut out = Vec::new();
        for chunk in bytes.chunks(4) {
            let mut n = 0u32;
            let mut count = 0;
            for &c in chunk {
                n = (n << 6) | val(c).unwrap();
                count += 1;
            }
            n <<= 6 * (4 - count);
            if count >= 2 {
                out.push((n >> 16) as u8);
            }
            if count >= 3 {
                out.push((n >> 8) as u8);
            }
            if count >= 4 {
                out.push(n as u8);
            }
        }
        out
    }
}
