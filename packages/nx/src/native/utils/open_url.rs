//! Open a URL in the user's default browser from native code.
//!
//! Replaces the JS `open` npm package (NXC-3940). Best-effort by contract: a
//! missing or unreachable opener never panics, it just returns `false` so the
//! caller can fall back to printing the URL.

#[cfg(not(target_arch = "wasm32"))]
use crate::native::utils::command::create_command;
#[cfg(not(target_arch = "wasm32"))]
use std::process::{Command, Stdio};
#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
use std::sync::OnceLock;

/// Open `url` in the user's default browser. Returns `true` if an opener
/// process was spawned, `false` if none could be (e.g. no `xdg-open`) or `url`
/// isn't `http(s)`, so the caller can tell the user instead of failing
/// silently. Never throws.
#[cfg(not(target_arch = "wasm32"))]
#[napi]
pub fn open_url(url: String) -> bool {
    open_url_native(&url)
}

/// wasm can't spawn a child process, so opening a browser is a no-op there. This
/// stub keeps `openUrl` exported on the wasm binding, so JS callers get the
/// documented `false` ("couldn't open") instead of a `TypeError` from calling a
/// missing export.
#[cfg(target_arch = "wasm32")]
#[napi]
pub fn open_url(_url: String) -> bool {
    false
}

/// Rust-facing entry point (the napi wrapper just forwards a `String`). Callers
/// inside the native crate — e.g. the TUI — use this directly.
#[cfg(not(target_arch = "wasm32"))]
pub fn open_url_native(url: &str) -> bool {
    if !is_http_url(url) {
        return false;
    }
    open_candidates(url).into_iter().any(spawn_detached)
}

/// Openers take whatever string they're handed and will launch a local program
/// as readily as a browser, so anything that isn't `http(s)` is refused here.
/// URLs reach this from remote responses (Nx Cloud, GitHub/GitLab hosts) and
/// from task output the TUI turns into clickable links.
#[cfg(not(target_arch = "wasm32"))]
fn is_http_url(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    lower.starts_with("http://") || lower.starts_with("https://")
}

/// A spawn succeeds when the opener *binary* exists; we deliberately don't wait
/// on it, since an opener that hands off to a browser may not exit until the
/// browser does.
#[cfg(not(target_arch = "wasm32"))]
fn spawn_detached(mut command: Command) -> bool {
    command
        .stdin(Stdio::null())
        // Detach stdio to null so a launched opener can't corrupt a terminal
        // we may be drawing to (the TUI).
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .is_ok()
}

#[cfg(all(not(target_arch = "wasm32"), target_os = "macos"))]
fn open_candidates(url: &str) -> Vec<Command> {
    let mut c = create_command("open");
    c.arg(url);
    vec![c]
}

#[cfg(all(not(target_arch = "wasm32"), target_os = "windows"))]
fn open_candidates(url: &str) -> Vec<Command> {
    // PowerShell rather than `cmd /C start "" <url>`: std leaves a URL unquoted
    // (it only quotes args with whitespace or quotes) and `cmd` reads the `&` in
    // a query string as a command separator.
    vec![powershell_start_process(url)]
}

#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
fn open_candidates(url: &str) -> Vec<Command> {
    candidates_for(
        use_windows_bridge(is_wsl(), is_in_container()),
        &std::env::var("BROWSER").unwrap_or_default(),
        url,
    )
}

/// #34502 was this predicate getting the container case wrong, so it is a named
/// function rather than an inline `&&` — otherwise nothing can assert it.
#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
fn use_windows_bridge(is_wsl: bool, in_container: bool) -> bool {
    is_wsl && !in_container
}

/// Split from `open_candidates` so the two probes it can't fake — the WSL gate
/// and `$BROWSER` — become test inputs.
#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
fn candidates_for(use_windows_bridge: bool, browser: &str, url: &str) -> Vec<Command> {
    let mut candidates = Vec::new();
    // On a non-container WSL host the Linux openers can't reach a browser, so
    // try the Windows host's browser first. Inside a Docker/Podman container the
    // interop path is absent and spawning it is exactly the crash this replaces
    // (`open@8` misdetected Podman as bare WSL) — containers stay on the Linux
    // openers below.
    if use_windows_bridge {
        candidates.push(powershell_start_process(url));
        // `[interop] appendWindowsPath=false` takes powershell.exe off PATH while
        // leaving interop working, and a stock WSL distro has no browser of its
        // own to fall through to. `/mnt/` is the default `[automount] root`; a
        // custom one isn't worth parsing wsl.conf for, since the candidate simply
        // fails to spawn when the path is wrong.
        candidates.push(powershell_start_process_at(
            "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
            url,
        ));
    }
    // Always fall through to the Linux openers: WSL interop can be off, and a
    // browser installed inside the distro still works.
    candidates.extend(linux_open_candidates(browser, url));
    candidates
}

/// Both WSL1 and WSL2 register a `WSLInterop` binfmt entry, so `powershell.exe`
/// is launchable from either — hence no WSL1/WSL2 distinction here. Matches the
/// `is-wsl` package (which the replaced `open` used) so no WSL flavour loses the
/// Windows bridge.
#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
fn is_wsl() -> bool {
    static IS_WSL: OnceLock<bool> = OnceLock::new();
    *IS_WSL.get_or_init(|| {
        std::fs::read_to_string("/proc/version")
            .map(|contents| proc_version_is_wsl(&contents))
            .unwrap_or(false)
    })
}

#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
fn proc_version_is_wsl(proc_version: &str) -> bool {
    proc_version.to_lowercase().contains("microsoft")
}

/// `/run/.containerenv` is the Podman marker that let #34502 take the WSL bridge
/// and crash. `open@8` did probe for it, but destructured `fs` from
/// `require('fs').promises` and then called `fs.statSync`, so the probe threw
/// into its own empty catch and only `is-docker`'s `/.dockerenv` ever counted.
/// A const so a test can assert both without a container to run in.
#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
const CONTAINER_MARKERS: &[&str] = &["/.dockerenv", "/run/.containerenv"];

#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
fn is_in_container() -> bool {
    static IN_CONTAINER: OnceLock<bool> = OnceLock::new();
    *IN_CONTAINER.get_or_init(|| any_marker_exists(CONTAINER_MARKERS))
}

#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
fn any_marker_exists(markers: &[&str]) -> bool {
    markers.iter().any(|m| std::path::Path::new(m).exists())
}

/// `xdg-open` leads: it is the standard entry point, and on a host with no
/// desktop detected it consults `$BROWSER` itself. Our own `$BROWSER` rung is
/// what covers the case where `xdg-open` is absent entirely. Trying it first
/// instead would let `BROWSER=echo` (a common way to suppress auto-open) spawn
/// happily and report a browser that never appeared.
///
/// Deliberately no rungs below these two. A candidate only loses its turn by
/// failing to spawn, so anything that spawns and then declines to open — a
/// desktop dispatcher with no handler, a terminal browser against the null stdio
/// `spawn_detached` sets — buys a false `true` rather than a browser. `$BROWSER`
/// is exempt because it is the user saying which program they meant.
///
/// The cost: a host with a browser but without `xdg-utils` used to be covered by
/// the `open` package, which shipped its own copy of the freedesktop script
/// rather than relying on the system one. That host now gets the printed URL.
#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
fn linux_open_candidates(browser: &str, url: &str) -> Vec<Command> {
    let mut xdg = create_command("xdg-open");
    xdg.arg(url);
    let mut candidates = vec![xdg];
    candidates.extend(browser_env_candidates(browser, url));
    candidates
}

/// `$BROWSER` is a colon-separated list of commands, each either a plain program
/// or a template where `%s` stands in for the URL — the contract the freedesktop
/// `xdg-open` script implements.
#[cfg(all(
    not(target_arch = "wasm32"),
    not(target_os = "macos"),
    not(target_os = "windows")
))]
fn browser_env_candidates(browser: &str, url: &str) -> Vec<Command> {
    browser
        .split(':')
        .filter_map(|entry| {
            let mut tokens = entry.split_whitespace();
            let program = tokens.next()?;
            let mut c = create_command(program);
            let mut substituted = false;
            for token in tokens {
                if token.contains("%s") {
                    substituted = true;
                    c.arg(token.replace("%s", url));
                } else {
                    c.arg(token);
                }
            }
            if !substituted {
                c.arg(url);
            }
            Some(c)
        })
        .collect()
}

/// Launch the default browser through the Windows host's PowerShell — used on
/// native Windows and, over WSL interop, on non-container WSL.
///
/// The URL rides *inside* the script as base64, never in a quoted literal:
/// PowerShell takes five code points as single-quote delimiters (`U+0027`,
/// `U+2018`–`U+201B`) and lets any close a literal any other opened, so doubling
/// the ASCII quote is not enough. Base64's alphabet can't express one at all.
///
/// Keep the inner payload UTF-8. The script is base64'd again for
/// `-EncodedCommand`, so UTF-16LE here would cost 7.1 command-line bytes per URL
/// byte against `CreateProcessW`'s 32767 cap — halving the openable URL.
#[cfg(all(not(target_arch = "wasm32"), not(target_os = "macos")))]
fn powershell_start_process(url: &str) -> Command {
    powershell_start_process_at("powershell.exe", url)
}

/// As above, but naming the interpreter — WSL needs an absolute path when
/// `appendWindowsPath` is off.
#[cfg(all(not(target_arch = "wasm32"), not(target_os = "macos")))]
fn powershell_start_process_at(program: &str, url: &str) -> Command {
    let script = format!(
        "Start-Process ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{}')))",
        base64_encode(url.as_bytes())
    );
    let mut c = create_command(program);
    c.args([
        "-NoProfile",
        "-NonInteractive",
        // `open` set this too — a GPO-locked host otherwise refuses the command.
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        &base64_encode(&utf16le(&script)),
    ]);
    c
}

/// `-EncodedCommand` expects base64 of UTF-16LE.
#[cfg(all(not(target_arch = "wasm32"), not(target_os = "macos")))]
fn utf16le(s: &str) -> Vec<u8> {
    s.encode_utf16()
        .flat_map(|unit| unit.to_le_bytes())
        .collect()
}

/// Minimal standard-alphabet base64 encoder (padded). Kept local to avoid a new
/// crate dependency for the `-EncodedCommand` call site.
#[cfg(all(not(target_arch = "wasm32"), not(target_os = "macos")))]
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

    fn args_of(cmd: &Command) -> Vec<String> {
        cmd.get_args()
            .map(|a| a.to_string_lossy().into_owned())
            .collect()
    }

    fn programs_of(cmds: &[Command]) -> Vec<String> {
        cmds.iter()
            .map(|c| c.get_program().to_string_lossy().into_owned())
            .collect()
    }

    fn decode_powershell_script(cmd: &Command) -> String {
        let args = args_of(cmd);
        let bytes = decode_base64(args.last().unwrap());
        let utf16: Vec<u16> = bytes
            .chunks(2)
            .map(|p| u16::from_le_bytes([p[0], p[1]]))
            .collect();
        String::from_utf16(&utf16).unwrap()
    }

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
    fn detects_both_wsl1_and_wsl2_but_not_plain_linux() {
        // WSL1 and WSL2 both support Windows interop, so both must take the
        // bridge. Real /proc/version strings: WSL1 capitalizes "Microsoft",
        // WSL2 is lowercase in "microsoft-standard-WSL2".
        let wsl1 = "Linux version 4.4.0-19041-Microsoft (Microsoft@Microsoft.com) \
                    (gcc version 5.4.0 (GCC) ) #1237-Microsoft Sat Sep 11 14:32:00 PST 2021";
        let wsl2 = "Linux version 5.15.90.1-microsoft-standard-WSL2 (oe-user@oe-host) \
                    (gcc (GCC) 9.3.0) #1 SMP Fri Jan 27 02:56:13 UTC 2023";
        let plain = "Linux version 6.1.0-18-amd64 (debian-kernel@lists.debian.org) \
                     (gcc-12 (Debian 12.2.0-14) 12.2.0) #1 SMP PREEMPT_DYNAMIC Debian";

        assert!(proc_version_is_wsl(wsl1));
        assert!(proc_version_is_wsl(wsl2));
        assert!(!proc_version_is_wsl(plain));
    }

    #[test]
    fn only_http_urls_reach_an_opener() {
        assert!(is_http_url("http://localhost:4211/projects"));
        assert!(is_http_url("HTTPS://cloud.nx.app/connect/abc"));
        // `Start-Process`/`xdg-open` would launch these as programs or files.
        assert!(!is_http_url("calc.exe"));
        assert!(!is_http_url("file:///etc/passwd"));
        assert!(!is_http_url("javascript:alert(1)"));
        assert!(!is_http_url(" http://leading-space.example"));
        // Prefix, not substring — the scheme has to be exactly http(s).
        assert!(!is_http_url("httpx://evil.example"));
        assert!(!open_url_native("calc.exe"));
    }

    #[test]
    fn powershell_carries_the_url_as_base64_not_as_a_quoted_literal() {
        // Every character PowerShell accepts as a single-quote delimiter, plus a
        // `&` (cmd separator). None may reach the command line or the script.
        // The astral char rides the UTF-8 payload; `utf16le` never sees it, since
        // the script is ASCII by the time it is encoded (asserted separately).
        let url =
            "https://cloud.nx.app/connect?a=1&b=2&q='\u{2018}\u{2019}\u{201A}\u{201B}\u{1F680}";
        let cmd = powershell_start_process(url);
        let args = args_of(&cmd);

        assert_eq!(cmd.get_program(), "powershell.exe");
        assert!(args.iter().any(|a| a == "-EncodedCommand"));
        assert!(!args.iter().any(|a| a.contains("://")));
        assert!(!args.iter().any(|a| a.contains('&')));

        // The script embeds the URL as base64, so no quote can escape it.
        let script = decode_powershell_script(&cmd);
        let payload = script
            .strip_prefix(
                "Start-Process ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('",
            )
            .and_then(|s| s.strip_suffix("')))"))
            .expect("script shape");
        assert!(!payload.contains(['\'', '\u{2018}', '\u{2019}', '\u{201A}', '\u{201B}']));

        // ...and decodes back to exactly the URL we were handed.
        assert_eq!(String::from_utf8(decode_base64(payload)).unwrap(), url);
    }

    #[test]
    fn command_line_stays_under_the_windows_cap_for_a_changelog_sized_url() {
        // `nx release` without a token opens a GitHub "new release" URL with the
        // whole percent-encoded changelog in the query string. Two base64 layers
        // multiply that against CreateProcessW's 32767-char limit.
        let url = format!(
            "https://github.com/nrwl/nx/releases/new?body={}",
            "a".repeat(8000)
        );
        let cmd = powershell_start_process(&url);
        let line: usize =
            cmd.get_program().len() + args_of(&cmd).iter().map(|a| a.len() + 1).sum::<usize>();
        assert!(line < 32767, "command line was {line} chars");
    }

    #[test]
    fn utf16le_emits_surrogate_pairs_for_astral_chars() {
        // `-EncodedCommand` is UTF-16LE, so a `char as u16` encoder would silently
        // truncate anything outside the BMP. ASCII today, but the outer layer is
        // the only place a non-ASCII script could ever reach.
        assert_eq!(utf16le("\u{1F680}"), vec![0x3D, 0xD8, 0x80, 0xDE]);
        assert_eq!(utf16le("ab"), vec![0x61, 0x00, 0x62, 0x00]);
    }

    #[test]
    fn execution_policy_is_bypassed_for_gpo_locked_hosts() {
        let cmd = powershell_start_process("https://nx.dev");
        let args = args_of(&cmd);
        let idx = args.iter().position(|a| a == "-ExecutionPolicy").unwrap();
        assert_eq!(args[idx + 1], "Bypass");
    }

    #[test]
    fn linux_tries_xdg_open_then_the_browser_override() {
        // `$BROWSER` is passed in, never read from the environment, so this holds
        // on a machine that has one set (Codespaces and VS Code Remote do).
        let cmds = linux_open_candidates("", "https://nx.dev");
        assert_eq!(programs_of(&cmds), ["xdg-open"]);
        assert_eq!(args_of(&cmds[0]), vec!["https://nx.dev"]);

        // With one set, it follows `xdg-open` rather than leading — and nothing
        // else joins the chain.
        let cmds = linux_open_candidates("firefox", "https://nx.dev");
        assert_eq!(programs_of(&cmds), ["xdg-open", "firefox"]);
    }

    #[test]
    fn podman_and_docker_markers_are_both_probed() {
        // #34502: only /.dockerenv was effectively checked, so Podman took the
        // WSL bridge and crashed. A test process can't fake either marker, so
        // assert the list and the probe that walks it separately.
        assert!(CONTAINER_MARKERS.contains(&"/run/.containerenv"));
        assert!(CONTAINER_MARKERS.contains(&"/.dockerenv"));
        // `/` always exists, so a probe that stops at the first entry fails here.
        assert!(any_marker_exists(&["/nx-no-such-marker", "/"]));
        assert!(!any_marker_exists(&["/nx-no-such-marker"]));
    }

    #[test]
    fn the_windows_bridge_is_gated_on_wsl_outside_a_container() {
        // The whole of #34502 is this predicate: Podman-on-WSL is both, and must
        // not take the bridge.
        assert!(use_windows_bridge(true, false));
        assert!(!use_windows_bridge(true, true));
        assert!(!use_windows_bridge(false, false));
        assert!(!use_windows_bridge(false, true));
    }

    #[test]
    fn browser_env_entries_sit_behind_xdg_open_and_honor_the_s_placeholder() {
        let cmds = browser_env_candidates("firefox:my-opener --url=%s", "https://nx.dev");
        assert_eq!(programs_of(&cmds), vec!["firefox", "my-opener"]);
        // No placeholder: the URL is appended. With one: it's substituted.
        assert_eq!(args_of(&cmds[0]), vec!["https://nx.dev"]);
        assert_eq!(args_of(&cmds[1]), vec!["--url=https://nx.dev"]);
        assert!(browser_env_candidates("", "https://nx.dev").is_empty());

        // `xdg-open` dispatches to the desktop's own handler, so it outranks
        // `$BROWSER`; otherwise `BROWSER=echo` would "succeed" with no browser.
        let chain = programs_of(&linux_open_candidates("echo", "https://nx.dev"));
        assert_eq!(chain[0], "xdg-open");
        assert_eq!(chain[1], "echo");
    }

    #[test]
    fn the_windows_bridge_is_skipped_inside_a_container() {
        // The #34502 crash was spawning powershell.exe from a Podman-on-WSL
        // container, so the container arm must offer no PowerShell candidate.
        let in_container = programs_of(&candidates_for(false, "", "https://nx.dev"));
        assert!(!in_container.iter().any(|p| p.contains("powershell")));
        assert_eq!(in_container[0], "xdg-open");

        // On a real WSL host the bridge leads — bare name first, then the default
        // automount path for hosts that keep powershell.exe off PATH. The `.exe`
        // is load-bearing: binfmt interop only resolves Windows binaries with it.
        let on_wsl = programs_of(&candidates_for(true, "", "https://nx.dev"));
        assert_eq!(on_wsl[0], "powershell.exe");
        assert_eq!(
            on_wsl[1],
            "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
        );
        // The Linux openers still follow — interop can be off, and that must not
        // dead-end.
        assert!(on_wsl.iter().any(|p| p == "xdg-open"));
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
