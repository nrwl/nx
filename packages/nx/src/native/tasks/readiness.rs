use once_cell::sync::OnceCell;
use std::future::Future;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::process::Stdio;
use std::time::{Duration, Instant};

use hickory_resolver::TokioResolver;
use hickory_resolver::config::LookupIpStrategy;
use reqwest::{Client, Url};
use tokio::net::TcpStream;
use tokio::process::Command;
use tokio_util::sync::CancellationToken;
use vte::{Parser, Perform};

use crate::native::pseudo_terminal::process_killer::kill_process_tree_internal;

// Attempt cadence without a configured interval, the last entry repeating
const BACKOFF_MS: [u64; 4] = [100, 250, 500, 1000];
// A killed shell exits at once; past this the wait would only hang
const REAP_MS: u64 = 1000;

/// One of `url`, `port` or `command` is set. `interval` absent means backoff.
#[napi(object)]
#[derive(Clone, Debug)]
pub struct ReadinessProbeConfig {
    pub url: Option<String>,
    pub port: Option<u32>,
    pub host: Option<String>,
    pub command: Option<String>,
    pub timeout: u32,
    pub interval: Option<u32>,
}

#[napi(string_enum)]
#[derive(Debug, PartialEq, Eq)]
pub enum ProbeOutcome {
    Ready,
    TimedOut,
    Cancelled,
}

enum Probe {
    Url(Url),
    Port { port: u16, host: PortHost },
    Command { command: String, cwd: String },
}

enum PortHost {
    Loopback,
    Ip(IpAddr),
    // Resolved in-process for the same reason the url probe keeps hickory
    Name(String, Box<TokioResolver>),
}

impl PortHost {
    fn parse(host: Option<&str>) -> anyhow::Result<Self> {
        Ok(match host {
            None => Self::Loopback,
            Some(host) => match host.parse::<IpAddr>() {
                Ok(ip) => Self::Ip(ip),
                Err(_) => {
                    let mut builder = TokioResolver::builder_tokio()?;
                    builder.options_mut().ip_strategy = LookupIpStrategy::Ipv4AndIpv6;
                    Self::Name(host.to_string(), Box::new(builder.build()))
                }
            },
        })
    }
}

impl Probe {
    fn from_config(config: &ReadinessProbeConfig, cwd: String) -> anyhow::Result<Self> {
        match (&config.url, config.port, &config.command) {
            (Some(url), None, None) => Ok(Self::Url(Url::parse(url)?)),
            (None, Some(port), None) => Ok(Self::Port {
                port: u16::try_from(port)?,
                host: PortHost::parse(config.host.as_deref())?,
            }),
            (None, None, Some(command)) => Ok(Self::Command {
                command: command.clone(),
                cwd,
            }),
            _ => anyhow::bail!("A readiness probe needs exactly one of url, port or command"),
        }
    }

    // Each probe owns its cancellation: a dropped command probe would leave
    // its process tree running
    async fn run(&self, deadline: Instant, token: &CancellationToken) -> anyhow::Result<bool> {
        let budget = || deadline.saturating_duration_since(Instant::now());
        Ok(match self {
            Self::Url(url) => {
                // Building the client can take 100 ms cold; the budget is
                // taken after it
                let client = http_client()?;
                unless_cancelled(token, probe_url(client, url, budget())).await
            }
            Self::Port { port, host } => {
                unless_cancelled(token, probe_port(*port, host, budget())).await
            }
            Self::Command { command, cwd } => probe_command(command, cwd, budget(), token).await,
        })
    }
}

// Built once per process: loading the system certificate store takes about
// 100 ms. The crate-wide hickory resolver stays on: the system one reads the
// environment while JS may be writing it, see telemetry/service.rs
fn http_client() -> anyhow::Result<&'static Client> {
    static CLIENT: OnceCell<Client> = OnceCell::new();
    Ok(CLIENT.get_or_try_init(build_http_client)?)
}

fn build_http_client() -> reqwest::Result<Client> {
    Client::builder()
        // A dev server's self-signed certificate must not keep it from
        // counting as ready
        .danger_accept_invalid_certs(true)
        // A redirect already proves the server is up, and following it would
        // let the server pick the next request's destination
        .redirect(reqwest::redirect::Policy::none())
        .build()
}

async fn unless_cancelled(token: &CancellationToken, probe: impl Future<Output = bool>) -> bool {
    tokio::select! {
        _ = token.cancelled() => false,
        ready = probe => ready,
    }
}

/// Retries a probe until it passes, the timeout elapses or `cancel` is called.
/// A failing attempt is never an error.
#[napi]
pub struct ReadinessProbe {
    probe: Probe,
    timeout: Duration,
    interval: Option<Duration>,
    token: CancellationToken,
}

#[napi]
impl ReadinessProbe {
    #[napi(constructor)]
    pub fn new(config: ReadinessProbeConfig, cwd: String) -> anyhow::Result<Self> {
        Ok(Self {
            probe: Probe::from_config(&config, cwd)?,
            timeout: Duration::from_millis(config.timeout.into()),
            interval: config.interval.map(|ms| Duration::from_millis(ms.into())),
            token: CancellationToken::new(),
        })
    }

    #[napi]
    pub async fn wait(&self) -> anyhow::Result<ProbeOutcome> {
        let deadline = Instant::now() + self.timeout;
        let mut attempt = 0usize;
        loop {
            let now = Instant::now();
            if self.token.is_cancelled() {
                return Ok(ProbeOutcome::Cancelled);
            }
            if now >= deadline {
                return Ok(ProbeOutcome::TimedOut);
            }
            if self.probe.run(deadline, &self.token).await? {
                return Ok(ProbeOutcome::Ready);
            }
            if self.token.is_cancelled() {
                return Ok(ProbeOutcome::Cancelled);
            }
            let delay = self.interval.unwrap_or_else(|| {
                Duration::from_millis(BACKOFF_MS[attempt.min(BACKOFF_MS.len() - 1)])
            });
            attempt += 1;
            tokio::select! {
                _ = self.token.cancelled() => return Ok(ProbeOutcome::Cancelled),
                _ = tokio::time::sleep(delay.min(deadline.saturating_duration_since(Instant::now()))) => {}
            }
        }
    }

    #[napi]
    pub fn cancel(&self) {
        self.token.cancel();
    }
}

// Ready on a final status from 200 to 403: an auth challenge or a forbidden
// root still means the server is up. A 404 at the root is retried at
// /index.html, where a static server may only answer.
async fn probe_url(client: &Client, url: &Url, budget: Duration) -> bool {
    let deadline = Instant::now() + budget;
    let Some(status) = request(client, url.clone(), budget).await else {
        return false;
    };
    if status == 404 && url.path() == "/" {
        let mut index = url.clone();
        index.set_path("/index.html");
        return request(
            client,
            index,
            deadline.saturating_duration_since(Instant::now()),
        )
        .await
        .is_some_and(ready_status);
    }
    ready_status(status)
}

fn ready_status(status: u16) -> bool {
    (200..=403).contains(&status)
}

async fn request(client: &Client, url: Url, budget: Duration) -> Option<u16> {
    client
        .get(url)
        .timeout(budget)
        .send()
        .await
        .ok()
        .map(|response| response.status().as_u16())
}

// Without a host, whichever loopback address accepts first wins: a server
// bound to only one of them is still ready.
async fn probe_port(port: u16, host: &PortHost, budget: Duration) -> bool {
    match host {
        PortHost::Loopback => {
            let v4 = connects(Ipv4Addr::LOCALHOST.into(), port, budget);
            let v6 = connects(Ipv6Addr::LOCALHOST.into(), port, budget);
            tokio::pin!(v4, v6);
            tokio::select! {
                ok = &mut v4 => ok || v6.await,
                ok = &mut v6 => ok || v4.await,
            }
        }
        PortHost::Ip(ip) => connects(*ip, port, budget).await,
        PortHost::Name(name, resolver) => {
            let deadline = Instant::now() + budget;
            let Ok(Ok(lookup)) =
                tokio::time::timeout(budget, resolver.lookup_ip(name.as_str())).await
            else {
                return false;
            };
            for ip in lookup {
                if connects(ip, port, deadline.saturating_duration_since(Instant::now())).await {
                    return true;
                }
            }
            false
        }
    }
}

async fn connects(ip: IpAddr, port: u16, budget: Duration) -> bool {
    tokio::time::timeout(budget, TcpStream::connect((ip, port)))
        .await
        .is_ok_and(|result| result.is_ok())
}

// Runs through the shell at cwd with this process's env. On overrun or cancel
// the whole tree is killed, since the shell's own kill leaves what it spawned
// running.
async fn probe_command(
    command: &str,
    cwd: &str,
    budget: Duration,
    token: &CancellationToken,
) -> bool {
    let mut cmd = if cfg!(windows) {
        let mut cmd = Command::new("cmd.exe");
        cmd.args(["/d", "/s", "/c", command]);
        cmd
    } else {
        let mut cmd = Command::new("sh");
        cmd.args(["-c", command]);
        cmd
    };
    cmd.current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    let Ok(mut child) = cmd.spawn() else {
        return false;
    };
    let exited = tokio::select! {
        status = child.wait() => Some(status.is_ok_and(|status| status.success())),
        _ = tokio::time::sleep(budget) => None,
        _ = token.cancelled() => None,
    };
    if let Some(ready) = exited {
        return ready;
    }
    if let Some(pid) = child.id() {
        // Enumerating processes blocks; keep the shell alive until its tree
        // has been walked
        let _ = tokio::task::spawn_blocking(move || {
            kill_process_tree_internal(pid as i32, Some("SIGKILL"))
        })
        .await;
    }
    // The walk reports nothing when it cannot see the tree; the shell itself
    // must still die or the wait below never returns
    let _ = child.start_kill();
    let _ = tokio::time::timeout(Duration::from_millis(REAP_MS), child.wait()).await;
    false
}

/// Done once every pattern has appeared in the fed output, in any order.
/// Keeps the tail of the previous chunk so a match split across two chunks
/// is still found. Terminal control sequences are ignored, even when a chunk
/// boundary falls inside one.
#[napi]
pub struct LogMatcher {
    pending: Vec<String>,
    tail: String,
    parser: Parser,
    visible: Visible,
}

// What a terminal would show: printable characters and C0 controls. Escape
// sequences of every family reach the other callbacks and are dropped.
#[derive(Default)]
struct Visible(String);

impl Perform for Visible {
    fn print(&mut self, c: char) {
        self.0.push(c);
    }

    fn execute(&mut self, byte: u8) {
        self.0.push(byte as char);
    }
}

#[napi]
impl LogMatcher {
    #[napi(constructor)]
    pub fn new(patterns: Vec<String>) -> Self {
        Self {
            pending: patterns,
            tail: String::new(),
            parser: Parser::new(),
            visible: Visible::default(),
        }
    }

    #[napi]
    pub fn feed(&mut self, chunk: String) -> bool {
        self.parser.advance(&mut self.visible, chunk.as_bytes());
        self.tail.push_str(&std::mem::take(&mut self.visible.0));
        let text = &self.tail;
        self.pending
            .retain(|pattern| !text.contains(pattern.as_str()));
        let keep = self
            .pending
            .iter()
            .map(|pattern| pattern.len().saturating_sub(1))
            .max()
            .unwrap_or(0);
        let mut start = self.tail.len().saturating_sub(keep);
        while !self.tail.is_char_boundary(start) {
            start += 1;
        }
        self.tail.drain(..start);
        self.pending.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;

    #[test]
    fn log_matcher_needs_every_pattern_in_any_order() {
        let mut matcher = LogMatcher::new(vec!["ready".into(), "listening".into()]);
        assert!(!matcher.feed("starting...".into()));
        assert!(!matcher.feed("server listening on 3000".into()));
        assert!(matcher.feed("ready".into()));
    }

    #[test]
    fn log_matcher_joins_two_chunks() {
        let mut matcher = LogMatcher::new(vec!["ready on".into()]);
        assert!(!matcher.feed("...rea".into()));
        assert!(matcher.feed("dy on http://localhost".into()));
        let mut matcher = LogMatcher::new(vec!["abc".into()]);
        assert!(!matcher.feed("a".into()));
        assert!(!matcher.feed("x".into()));
        assert!(!matcher.feed("bc".into()));
    }

    #[test]
    fn log_matcher_ignores_control_sequences_and_keeps_char_boundaries() {
        let mut matcher = LogMatcher::new(vec!["ready".into()]);
        assert!(matcher.feed("\x1b[32mrea\x1b[0mdy".into()));
        let mut matcher = LogMatcher::new(vec!["ready".into()]);
        assert!(!matcher.feed("rea\x1b[".into()));
        assert!(matcher.feed("32mdy".into()));
        let mut matcher = LogMatcher::new(vec!["ready".into()]);
        assert!(!matcher.feed("rea\x1b".into()));
        assert!(matcher.feed("[0mdy".into()));
        let mut matcher = LogMatcher::new(vec!["éready".into()]);
        assert!(!matcher.feed("ééé".into()));
        assert!(matcher.feed("éready".into()));
    }

    #[test]
    fn log_matcher_ignores_control_strings() {
        // A title or hyperlink payload is not visible text
        let mut matcher = LogMatcher::new(vec!["ready".into()]);
        assert!(!matcher.feed("\x1b]0;ready\x07".into()));
        assert!(!matcher.feed("\x1b]8;;http://ready\x1b\\".into()));
        assert!(!matcher.feed("\x1bPready\x1b\\\x1b_ready\x1b\\".into()));
        assert!(matcher.feed("ready".into()));
        // A marker split by a control string is still one word
        let mut matcher = LogMatcher::new(vec!["ready".into()]);
        assert!(matcher.feed("rea\x1b]0;title\x07dy".into()));
        let mut matcher = LogMatcher::new(vec!["ready".into()]);
        assert!(matcher.feed("rea\x1b]8;;http://x\x1b\\dy".into()));
        // Split opener, split payload and a split ST terminator
        let mut matcher = LogMatcher::new(vec!["ready".into()]);
        assert!(!matcher.feed("rea\x1b".into()));
        assert!(!matcher.feed("]0;ti".into()));
        assert!(!matcher.feed("tle\x1b".into()));
        assert!(matcher.feed("\\dy".into()));
    }

    #[test]
    fn log_matcher_holds_a_bounded_payload_for_an_unterminated_control_string() {
        let mut matcher = LogMatcher::new(vec!["ready".into()]);
        assert!(!matcher.feed("rea\x1b]8;;".into()));
        for _ in 0..10 {
            assert!(!matcher.feed("x".repeat(1000)));
        }
        assert!(matcher.tail.len() < 10);
        assert!(matcher.feed("\x07dy".into()));
    }

    fn probe(config: ReadinessProbeConfig) -> ReadinessProbe {
        ReadinessProbe::new(config, std::env::temp_dir().to_string_lossy().to_string()).unwrap()
    }

    fn port_config(port: u16, host: Option<&str>, timeout: u32) -> ReadinessProbeConfig {
        ReadinessProbeConfig {
            url: None,
            port: Some(port.into()),
            host: host.map(String::from),
            command: None,
            timeout,
            interval: None,
        }
    }

    #[test]
    fn rejects_a_config_without_exactly_one_probe() {
        assert!(ReadinessProbe::new(port_config(1, None, 1), String::new()).is_ok());
        let mut both = port_config(1, None, 1);
        both.command = Some("true".into());
        assert!(ReadinessProbe::new(both, String::new()).is_err());
        let mut none = port_config(1, None, 1);
        none.port = None;
        assert!(ReadinessProbe::new(none, String::new()).is_err());
    }

    #[tokio::test]
    async fn port_without_host_accepts_either_loopback() {
        // Some CI kernels have no IPv6 loopback
        let listener = match TcpListener::bind("[::1]:0") {
            Ok(listener) => listener,
            Err(e) if e.kind() == std::io::ErrorKind::AddrNotAvailable => return,
            Err(e) => panic!("{e}"),
        };
        let port = listener.local_addr().unwrap().port();
        assert_eq!(
            probe(port_config(port, None, 2000)).wait().await.unwrap(),
            ProbeOutcome::Ready
        );
        assert_eq!(
            probe(port_config(port, Some("127.0.0.1"), 300))
                .wait()
                .await
                .unwrap(),
            ProbeOutcome::TimedOut
        );
    }

    #[tokio::test]
    async fn port_resolves_a_host_name_in_process() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        assert_eq!(
            probe(port_config(port, Some("localhost"), 2000))
                .wait()
                .await
                .unwrap(),
            ProbeOutcome::Ready
        );
    }

    #[tokio::test]
    async fn port_times_out_when_nothing_listens() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        let started = Instant::now();
        assert_eq!(
            probe(port_config(port, None, 300)).wait().await.unwrap(),
            ProbeOutcome::TimedOut
        );
        assert!(started.elapsed() < Duration::from_millis(1500));
    }

    #[tokio::test]
    async fn cancel_stops_the_wait() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        let probe = probe(port_config(port, None, 60_000));
        let cancelled = tokio::spawn({
            let token = probe.token.clone();
            async move {
                tokio::time::sleep(Duration::from_millis(50)).await;
                token.cancel();
            }
        });
        assert_eq!(probe.wait().await.unwrap(), ProbeOutcome::Cancelled);
        cancelled.await.unwrap();
    }

    #[cfg(not(windows))]
    #[tokio::test]
    async fn command_passes_on_exit_zero_and_is_killed_on_overrun() {
        let config = |command: &str, timeout: u32| ReadinessProbeConfig {
            url: None,
            port: None,
            host: None,
            command: Some(command.into()),
            timeout,
            interval: Some(50),
        };
        assert_eq!(
            probe(config("exit 0", 2000)).wait().await.unwrap(),
            ProbeOutcome::Ready
        );
        // An attempt may use the whole remaining timeout
        assert_eq!(
            probe(config("sleep 1.2", 3000)).wait().await.unwrap(),
            ProbeOutcome::Ready
        );
        assert_eq!(
            probe(config("exit 1", 200)).wait().await.unwrap(),
            ProbeOutcome::TimedOut
        );
        let started = Instant::now();
        assert_eq!(
            probe(config("sleep 30", 1500)).wait().await.unwrap(),
            ProbeOutcome::TimedOut
        );
        assert!(started.elapsed() < Duration::from_secs(5));
    }

    #[cfg(not(windows))]
    #[tokio::test]
    async fn command_tree_is_killed_on_cancel_even_when_it_ignores_sigterm() {
        let dir = tempfile::tempdir().unwrap();
        let marker = dir.path().join("marker");
        let config = ReadinessProbeConfig {
            url: None,
            port: None,
            host: None,
            command: Some(format!(
                "sh -c 'trap \"\" TERM; sleep 0.5; touch {}' & wait",
                marker.display()
            )),
            timeout: 10_000,
            interval: None,
        };
        let probe = ReadinessProbe::new(config, dir.path().to_string_lossy().to_string()).unwrap();
        let token = probe.token.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(100)).await;
            token.cancel();
        });
        assert_eq!(probe.wait().await.unwrap(), ProbeOutcome::Cancelled);
        tokio::time::sleep(Duration::from_millis(800)).await;
        assert!(!marker.exists());
    }

    #[tokio::test]
    async fn url_retries_the_root_at_index_html() {
        use std::io::{Read, Write};
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for stream in listener.incoming().take(2) {
                let mut stream = stream.unwrap();
                let mut buf = [0u8; 1024];
                let n = stream.read(&mut buf).unwrap();
                let request = String::from_utf8_lossy(&buf[..n]);
                let status = if request.starts_with("GET /index.html") {
                    "200 OK"
                } else {
                    "404 Not Found"
                };
                write!(
                    stream,
                    "HTTP/1.1 {status}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                )
                .unwrap();
            }
        });
        let config = ReadinessProbeConfig {
            url: Some(format!("http://127.0.0.1:{port}/")),
            port: None,
            host: None,
            command: None,
            timeout: 5000,
            interval: None,
        };
        assert_eq!(probe(config).wait().await.unwrap(), ProbeOutcome::Ready);
    }

    // Runs the ignored test in a fresh process so the shared client is still unbuilt
    #[test]
    fn url_cold_client_setup_counts_against_the_timeout() {
        let status = std::process::Command::new(std::env::current_exe().unwrap())
            .args([
                "--ignored",
                "--exact",
                "native::tasks::readiness::tests::cold_url_wait",
            ])
            .status()
            .unwrap();
        assert!(status.success());
    }

    #[tokio::test]
    #[ignore]
    async fn cold_url_wait() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let config = ReadinessProbeConfig {
            url: Some(format!("http://127.0.0.1:{port}/")),
            port: None,
            host: None,
            command: None,
            timeout: 200,
            interval: None,
        };
        let started = Instant::now();
        assert_eq!(probe(config).wait().await.unwrap(), ProbeOutcome::TimedOut);
        let waited = started.elapsed();
        let started = Instant::now();
        build_http_client().unwrap();
        let built = started.elapsed();
        // Setup overlaps the timeout instead of adding to it
        assert!(
            waited < built.max(Duration::from_millis(200)) + Duration::from_millis(100),
            "waited {waited:?} with a {built:?} client build"
        );
    }
}
