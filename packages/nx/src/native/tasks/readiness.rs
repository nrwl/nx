use once_cell::sync::OnceCell;
use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
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

const DEFAULT_INTERVAL: Duration = Duration::from_millis(250);
// A killed shell exits at once; past this the wait would only hang
const REAP_MS: u64 = 1000;

/// Exactly one of `url`, `port` or `command` is set.
#[napi(object)]
pub struct ReadinessProbeConfig {
    pub url: Option<String>,
    pub port: Option<u32>,
    pub host: Option<String>,
    pub command: Option<String>,
    /// The whole environment of `command`. Without it the command inherits this process's.
    pub env: Option<HashMap<String, String>>,
    pub timeout: u32,
    pub interval: Option<u32>,
}

enum Probe {
    Url {
        url: Url,
        // Chosen on the first attempt, within the probe's deadline
        client: OnceCell<Client>,
    },
    Port {
        port: u16,
        host: PortHost,
    },
    Command {
        command: String,
        cwd: String,
        env: Option<HashMap<String, String>>,
    },
}

enum PortHost {
    Loopback,
    Ip(IpAddr),
    // Resolved in-process: getaddrinfo reads the environment while JS may write it
    Name(String, Box<TokioResolver>),
}

impl PortHost {
    fn parse(host: Option<&str>) -> anyhow::Result<Self> {
        Ok(match host {
            None => Self::Loopback,
            Some(host) => match unbracketed(host).parse::<IpAddr>() {
                Ok(ip) => Self::Ip(ip),
                Err(_) => Self::Name(host.to_string(), Box::new(system_resolver()?)),
            },
        })
    }
}

fn system_resolver() -> anyhow::Result<TokioResolver> {
    let mut builder = TokioResolver::builder_tokio()?;
    builder.options_mut().ip_strategy = LookupIpStrategy::Ipv4AndIpv6;
    Ok(builder.build())
}

impl Probe {
    fn from_config(config: &ReadinessProbeConfig, cwd: String) -> anyhow::Result<Self> {
        match (&config.url, config.port, &config.command) {
            (Some(url), None, None) => Ok(Self::Url {
                url: connect_url(url)?,
                client: OnceCell::new(),
            }),
            (None, Some(port), None) => Ok(Self::Port {
                port: u16::try_from(port)?,
                host: PortHost::parse(config.host.as_deref())?,
            }),
            (None, None, Some(command)) => Ok(Self::Command {
                command: command.clone(),
                cwd,
                env: config.env.clone(),
            }),
            _ => anyhow::bail!("A readiness probe needs exactly one of url, port or command"),
        }
    }

    // Each probe owns its cancellation: a dropped command probe would leave
    // its process tree running
    async fn run(&self, deadline: Instant, token: &CancellationToken) -> anyhow::Result<bool> {
        Ok(match self {
            Self::Url { url, client } => token
                .run_until_cancelled(async {
                    let client = match client.get() {
                        Some(client) => client,
                        None => {
                            let built = http_client(url, deadline).await?;
                            client.get_or_init(|| built)
                        }
                    };
                    anyhow::Ok(probe_url(client, url, deadline).await)
                })
                .await
                .transpose()?
                .unwrap_or(false),
            Self::Port { port, host } => token
                .run_until_cancelled(probe_port(*port, host, deadline))
                .await
                .unwrap_or(false),
            Self::Command { command, cwd, env } => {
                probe_command(command, cwd, env.as_ref(), deadline, token).await
            }
        })
    }
}

// The verifying client is built once per process: loading the system
// certificate store takes about 100 ms. A loopback client never verifies, so
// it loads no store and is built per probe, pinned to the checked addresses
// so the request cannot go where a later resolution points. It skips proxies
// too, so the request cannot leave the machine
async fn http_client(url: &Url, deadline: Instant) -> anyhow::Result<Client> {
    static VERIFYING: OnceCell<Client> = OnceCell::new();
    Ok(match loopback_addrs(url, deadline).await {
        Some(addrs) => build_http_client(Some((url.host_str().unwrap_or_default(), &addrs)))?,
        None => VERIFYING
            .get_or_try_init(|| build_http_client(None))?
            .clone(),
    })
}

// An IP literal is loopback by its value. Only `localhost` and `*.localhost`
// names are resolved, in-process and without a DNS query (RFC 6761), and count
// when every address is loopback: a hosts file can point such a name
// anywhere. Any other name gets the verifying client without a lookup or a
// resolver, so a proxied request never waits on local DNS and a literal needs
// no DNS configuration at all.
async fn loopback_addrs(url: &Url, deadline: Instant) -> Option<Vec<IpAddr>> {
    let host = unbracketed(url.host_str()?);
    if let Ok(ip) = host.parse::<IpAddr>() {
        return ip_is_loopback(ip).then(|| vec![ip]);
    }
    let name = host.trim_end_matches('.');
    if name != "localhost" && !name.ends_with(".localhost") {
        return None;
    }
    let resolver = system_resolver().ok()?;
    let lookup = tokio::time::timeout_at(deadline.into(), resolver.lookup_ip(host))
        .await
        .ok()?
        .ok()?;
    let addrs: Vec<IpAddr> = lookup.iter().collect();
    (!addrs.is_empty() && addrs.iter().all(|ip| ip_is_loopback(*ip))).then_some(addrs)
}

fn ip_is_loopback(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => ip.is_loopback(),
        IpAddr::V6(ip) => {
            ip.is_loopback() || ip.to_ipv4_mapped().is_some_and(|v4| v4.is_loopback())
        }
    }
}

#[cfg(test)]
static SETUP_DELAY_MS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

fn build_http_client(loopback: Option<(&str, &[IpAddr])>) -> reqwest::Result<Client> {
    #[cfg(test)]
    std::thread::sleep(Duration::from_millis(
        SETUP_DELAY_MS.load(std::sync::atomic::Ordering::Relaxed),
    ));
    let builder = Client::builder()
        // A redirect already proves the server is up, and following it would
        // let the server pick the next request's destination
        .redirect(reqwest::redirect::Policy::none());
    match loopback {
        Some((host, addrs)) => {
            // Port 0: the url's own port applies
            let pinned: Vec<SocketAddr> = addrs.iter().map(|ip| SocketAddr::new(*ip, 0)).collect();
            builder
                .danger_accept_invalid_certs(true)
                .tls_built_in_root_certs(false)
                .no_proxy()
                .resolve_to_addrs(host, &pinned)
        }
        None => builder,
    }
    .build()
}

/// Retries a probe until it passes, the timeout elapses or `cancel` is called.
/// A failing attempt is never an error.
#[napi]
pub struct ReadinessProbe {
    probe: Probe,
    timeout: Duration,
    interval: Duration,
    token: CancellationToken,
}

#[napi]
impl ReadinessProbe {
    #[napi(constructor)]
    pub fn new(config: ReadinessProbeConfig, cwd: String) -> anyhow::Result<Self> {
        Ok(Self {
            probe: Probe::from_config(&config, cwd)?,
            timeout: Duration::from_millis(config.timeout.into()),
            interval: config
                .interval
                .map_or(DEFAULT_INTERVAL, |ms| Duration::from_millis(ms.into())),
            token: CancellationToken::new(),
        })
    }

    /// False once the timeout elapses or `cancel` is called.
    #[napi]
    pub async fn wait(&self) -> anyhow::Result<bool> {
        let deadline = Instant::now() + self.timeout;
        while !self.token.is_cancelled() && Instant::now() < deadline {
            if self.probe.run(deadline, &self.token).await? {
                return Ok(true);
            }
            tokio::select! {
                _ = self.token.cancelled() => break,
                _ = tokio::time::sleep(self.interval.min(deadline.saturating_duration_since(Instant::now()))) => {}
            }
        }
        Ok(false)
    }

    #[napi]
    pub fn cancel(&self) {
        self.token.cancel();
    }
}

// Ready on a final status from 200 to 403: an auth challenge or a forbidden
// root still means the server is up. A static server may only answer at /index.html.
async fn probe_url(client: &Client, url: &Url, deadline: Instant) -> bool {
    let Some(status) = request(client, url.clone(), deadline).await else {
        return false;
    };
    if status == 404 && url.path() == "/" {
        let mut index = url.clone();
        index.set_path("/index.html");
        return request(client, index, deadline)
            .await
            .is_some_and(ready_status);
    }
    ready_status(status)
}

fn ready_status(status: u16) -> bool {
    (200..=403).contains(&status)
}

async fn request(client: &Client, url: Url, deadline: Instant) -> Option<u16> {
    client
        .get(url)
        .timeout(deadline.saturating_duration_since(Instant::now()))
        .send()
        .await
        .ok()
        .map(|response| response.status().as_u16())
}

// Without a host, whichever loopback address accepts first wins: a server
// bound to only one of them is still ready.
async fn probe_port(port: u16, host: &PortHost, deadline: Instant) -> bool {
    match host {
        PortHost::Loopback => {
            let v4 = connects(Ipv4Addr::LOCALHOST.into(), port, deadline);
            let v6 = connects(Ipv6Addr::LOCALHOST.into(), port, deadline);
            tokio::pin!(v4, v6);
            tokio::select! {
                ok = &mut v4 => ok || v6.await,
                ok = &mut v6 => ok || v4.await,
            }
        }
        PortHost::Ip(ip) => connects(*ip, port, deadline).await,
        PortHost::Name(name, resolver) => {
            let Ok(Ok(lookup)) =
                tokio::time::timeout_at(deadline.into(), resolver.lookup_ip(name.as_str())).await
            else {
                return false;
            };
            for ip in lookup {
                if connects(ip, port, deadline).await {
                    return true;
                }
            }
            false
        }
    }
}

async fn connects(ip: IpAddr, port: u16, deadline: Instant) -> bool {
    tokio::time::timeout_at(
        deadline.into(),
        TcpStream::connect((connect_destination(ip), port)),
    )
    .await
    .is_ok_and(|result| result.is_ok())
}

// A wildcard means loopback of its own family, as on Linux and macOS and in
// Node on Windows. Windows itself rejects it as a destination.
fn connect_destination(ip: IpAddr) -> IpAddr {
    match ip.to_canonical() {
        IpAddr::V4(v4) if v4.is_unspecified() => Ipv4Addr::LOCALHOST.into(),
        IpAddr::V6(v6) if v6.is_unspecified() => Ipv6Addr::LOCALHOST.into(),
        _ => ip,
    }
}

// Rewriting the host, not only the connection, gives a wildcard url the
// loopback client
fn connect_url(url: &str) -> anyhow::Result<Url> {
    let mut url = Url::parse(url)?;
    if let Some(Ok(ip)) = url
        .host_str()
        .map(|host| unbracketed(host).parse::<IpAddr>())
    {
        url.set_ip_host(connect_destination(ip))
            .map_err(|()| anyhow::anyhow!("Cannot set the host of {url}"))?;
    }
    Ok(url)
}

fn unbracketed(host: &str) -> &str {
    host.trim_start_matches('[').trim_end_matches(']')
}

// On overrun or cancel the whole tree is killed: the shell's own kill leaves
// what it spawned running.
async fn probe_command(
    command: &str,
    cwd: &str,
    env: Option<&HashMap<String, String>>,
    deadline: Instant,
    token: &CancellationToken,
) -> bool {
    let mut cmd = if cfg!(windows) {
        let mut cmd = Command::new("cmd.exe");
        cmd.args(["/d", "/s", "/c"]);
        // Appended as written, the way Node's `shell: true` does: `/s` strips
        // the outer quotes, and regular arg quoting would escape every inner
        // `"` as `\"`, which cmd.exe hands on to the program
        #[cfg(windows)]
        cmd.raw_arg(format!("\"{command}\""));
        cmd
    } else {
        let mut cmd = Command::new("sh");
        cmd.args(["-c", command]);
        cmd
    };
    if let Some(env) = env {
        cmd.env_clear().envs(env);
    }
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
        _ = tokio::time::sleep_until(deadline.into()) => None,
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

/// Done once every pattern has appeared in the fed output, in any order, even
/// split across chunks or interleaved with terminal control sequences.
#[napi]
pub struct LogMatcher {
    pending: Vec<String>,
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
            parser: Parser::new(),
            visible: Visible::default(),
        }
    }

    #[napi]
    pub fn feed(&mut self, chunk: String) -> bool {
        self.parser.advance(&mut self.visible, chunk.as_bytes());
        let tail = &mut self.visible.0;
        self.pending
            .retain(|pattern| !tail.contains(pattern.as_str()));
        let keep = self
            .pending
            .iter()
            .map(|pattern| pattern.len().saturating_sub(1))
            .max()
            .unwrap_or(0);
        let start = tail.ceil_char_boundary(tail.len().saturating_sub(keep));
        tail.drain(..start);
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
        assert!(!matcher.feed("éééa".into()));
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
            env: None,
            interval: None,
        }
    }

    #[tokio::test]
    async fn only_loopback_literals_and_localhost_names_on_loopback_are_loopback() {
        let deadline = Instant::now() + Duration::from_secs(10);
        for url in [
            "https://localhost:4200/",
            "https://localhost./",
            "https://app.localhost/",
            "https://127.0.0.1:4200/",
            "https://127.1.2.3/",
            "https://[::1]:4200/",
            "https://[::ffff:127.0.0.1]/",
        ] {
            let found = loopback_addrs(&Url::parse(url).unwrap(), deadline).await;
            assert!(
                found
                    .as_ref()
                    .is_some_and(|a| !a.is_empty() && a.iter().all(|ip| ip_is_loopback(*ip))),
                "{url}: {found:?}"
            );
        }
        for url in [
            "https://health.example.com/status",
            "https://app.localhost.invalid/",
            "https://127.0.0.1.nip.io/",
            "https://10.0.0.1/",
            "https://[::ffff:10.0.0.1]/",
        ] {
            assert!(
                loopback_addrs(&Url::parse(url).unwrap(), deadline)
                    .await
                    .is_none(),
                "{url}"
            );
        }
    }

    #[tokio::test]
    async fn url_localhost_name_connects_to_the_pinned_loopback_address() {
        // Nothing resolves `app.localhost` for the connection: the client is
        // pinned to the checked loopback address under the url's own port
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for mut stream in listener.incoming().flatten() {
                // Read the request head before answering
                let mut request = Vec::new();
                let mut byte = [0u8; 1];
                while std::io::Read::read(&mut stream, &mut byte).is_ok_and(|n| n == 1) {
                    request.push(byte[0]);
                    if request.ends_with(b"\r\n\r\n") {
                        break;
                    }
                }
                let _ = std::io::Write::write_all(
                    &mut stream,
                    b"HTTP/1.1 200 OK\r\ncontent-length: 0\r\n\r\n",
                );
            }
        });
        let config = ReadinessProbeConfig {
            url: Some(format!("http://app.localhost:{port}/")),
            port: None,
            host: None,
            command: None,
            timeout: 2000,
            env: None,
            interval: None,
        };
        let started = Instant::now();
        assert!(probe(config).wait().await.unwrap());
        assert!(
            started.elapsed() < Duration::from_millis(1500),
            "{:?}",
            started.elapsed()
        );
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
        assert!(probe(port_config(port, None, 2000)).wait().await.unwrap());
        assert!(
            !probe(port_config(port, Some("127.0.0.1"), 300))
                .wait()
                .await
                .unwrap()
        );
        assert!(
            !probe(port_config(port, Some("0.0.0.0"), 300))
                .wait()
                .await
                .unwrap()
        );
    }

    #[tokio::test]
    async fn port_resolves_a_host_name() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        assert!(
            probe(port_config(port, Some("localhost"), 2000))
                .wait()
                .await
                .unwrap()
        );
    }

    #[test]
    fn a_wildcard_connects_to_loopback_of_the_same_family() {
        // Linux and macOS remap a wildcard destination themselves, so only
        // the mapping shows the Windows behavior
        for (host, destination) in [
            ("0.0.0.0", "127.0.0.1"),
            ("::", "::1"),
            ("::ffff:0.0.0.0", "127.0.0.1"),
            ("::ffff:127.0.0.1", "::ffff:127.0.0.1"),
            ("10.0.0.1", "10.0.0.1"),
            ("fd00::1", "fd00::1"),
        ] {
            assert_eq!(
                connect_destination(host.parse().unwrap()),
                destination.parse::<IpAddr>().unwrap(),
                "{host}"
            );
        }
        for (url, requested) in [
            ("https://0.0.0.0:4200/a?b", "https://127.0.0.1:4200/a?b"),
            ("http://[::]:4200/", "http://[::1]:4200/"),
            (
                "http://[::ffff:7f00:1]:4200/",
                "http://[::ffff:7f00:1]:4200/",
            ),
            ("http://localhost:4200/", "http://localhost:4200/"),
        ] {
            let config = ReadinessProbeConfig {
                url: Some(url.into()),
                port: None,
                host: None,
                command: None,
                timeout: 1,
                env: None,
                interval: None,
            };
            let Probe::Url { url: built, .. } = Probe::from_config(&config, String::new()).unwrap()
            else {
                panic!("{url}");
            };
            assert_eq!(built.as_str(), requested);
        }
    }

    #[test]
    fn port_host_may_be_a_bracketed_ipv6_address() {
        let config = port_config(4200, Some("[::1]"), 1);
        assert!(matches!(
            Probe::from_config(&config, String::new()).unwrap(),
            Probe::Port { host: PortHost::Ip(ip), .. } if ip == Ipv6Addr::LOCALHOST
        ));
    }

    #[cfg(not(windows))]
    #[tokio::test]
    async fn command_attempt_may_use_the_whole_remaining_timeout() {
        let config = ReadinessProbeConfig {
            url: None,
            port: None,
            host: None,
            command: Some("sleep 1.2".into()),
            timeout: 3000,
            env: None,
            interval: Some(50),
        };
        assert!(probe(config).wait().await.unwrap());
    }

    #[cfg(not(windows))]
    #[tokio::test]
    async fn command_runs_with_only_the_given_env() {
        let config = ReadinessProbeConfig {
            url: None,
            port: None,
            host: None,
            command: Some(r#"test "$NX_READINESS_GIVEN" = yes && test -z "$HOME""#.into()),
            timeout: 2000,
            env: Some(HashMap::from([
                ("NX_READINESS_GIVEN".into(), "yes".into()),
                ("PATH".into(), std::env::var("PATH").unwrap()),
            ])),
            interval: Some(50),
        };
        assert!(probe(config).wait().await.unwrap());
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
            env: None,
            interval: None,
        };
        let probe = ReadinessProbe::new(config, dir.path().to_string_lossy().to_string()).unwrap();
        let token = probe.token.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(100)).await;
            token.cancel();
        });
        assert!(!probe.wait().await.unwrap());
        tokio::time::sleep(Duration::from_millis(800)).await;
        assert!(!marker.exists());
    }

    #[test]
    fn log_matcher_keeps_only_what_a_split_pattern_needs() {
        let mut matcher = LogMatcher::new(vec!["ready".into(), "listening".into()]);
        assert!(!matcher.feed("x".repeat(10_000)));
        assert!(matcher.visible.0.len() < "listening".len());
    }

    #[tokio::test]
    async fn cancel_interrupts_an_attempt_that_never_answers() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let (received, request_in) = tokio::sync::oneshot::channel();
        let (release, hold) = std::sync::mpsc::channel::<()>();
        // Reads the whole request and never answers, holding the attempt open
        std::thread::spawn(move || {
            use std::io::Read;
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = Vec::new();
            let mut buf = [0u8; 1024];
            while !request.windows(4).any(|w| w == b"\r\n\r\n") {
                let n = stream.read(&mut buf).unwrap();
                assert!(n > 0, "connection closed before the request arrived");
                request.extend_from_slice(&buf[..n]);
            }
            let _ = received.send(());
            let _ = hold.recv();
        });
        let probe = probe(ReadinessProbeConfig {
            url: Some(format!("http://127.0.0.1:{port}/")),
            port: None,
            host: None,
            command: None,
            timeout: 5_000,
            env: None,
            interval: None,
        });
        let token = probe.token.clone();
        let cancelled = tokio::spawn(async move {
            request_in.await.unwrap();
            token.cancel();
            Instant::now()
        });
        assert!(!probe.wait().await.unwrap());
        let cancelled_at = cancelled.await.unwrap();
        assert!(cancelled_at.elapsed() < Duration::from_millis(2000));
        drop(release);
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
            timeout: 500,
            env: None,
            interval: None,
        };
        SETUP_DELAY_MS.store(600, std::sync::atomic::Ordering::Relaxed);
        let started = Instant::now();
        assert!(!probe(config).wait().await.unwrap());
        let waited = started.elapsed();
        // Setup overlaps the timeout instead of adding to it: 600 ms plus the
        // client build here, 500 ms more if the budget were taken first
        assert!(
            waited < Duration::from_millis(1100),
            "waited {waited:?} with a 600 ms client setup"
        );
    }
}
