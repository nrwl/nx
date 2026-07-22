// Playwright routes its readiness poll through a proxy configured in the
// environment, so a gate that always connected directly would be answering a
// different question than the check it exists to satisfy. Selection mirrors the
// `proxy-from-env` copy Playwright bundles (`getProxyForUrl`) together with its
// own `normalizeProxyURL`, checked against playwright-core 1.60.0. The
// transport is left to `https-proxy-agent`, the agent Playwright itself hands
// to `https.request` for a proxied https target.

const DEFAULT_PORTS: Record<string, number> = {
  ftp: 21,
  gopher: 70,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443,
};

export type ProxyResolution =
  | { kind: 'direct' }
  | { kind: 'proxy'; proxy: URL }
  | { kind: 'unusable'; variable: string; value: string; reason: string };

export function resolveProxyForUrl(url: URL): ProxyResolution {
  const protocol = url.protocol.split(':')[0];
  // Matched on the host with any port stripped, which keeps the brackets on an
  // IPv6 literal.
  const hostname = url.host.replace(/:\d*$/, '');
  if (!hostname || !protocol) {
    return { kind: 'direct' };
  }

  const port = parseInt(url.port) || DEFAULT_PORTS[protocol] || 0;
  if (!shouldProxy(hostname, port)) {
    return { kind: 'direct' };
  }

  let source = readEnv(`${protocol}_proxy`);
  if (!source.value) {
    source = readEnv('all_proxy');
  }
  if (!source.value) {
    return { kind: 'direct' };
  }

  // A value with no scheme takes the target's protocol, which is where this
  // differs from `normalizeProxyURL` alone: that only defaults to http.
  const scheme = source.value.includes('://') ? '' : `${protocol}://`;
  const normalized = `${scheme}${source.value}`.trim();
  // Playwright's own probe errors out on a proxy URL it cannot use instead of
  // falling back to a direct request, so the gate must not clear here. Each
  // cause is named, because the value alone often does not show it: redacting
  // the credentials takes the offending character with them.
  const unusable = (reason: string): ProxyResolution => ({
    kind: 'unusable',
    variable: source.variable,
    value: withoutCredentials(source.value),
    reason,
  });

  let proxy: URL;
  try {
    proxy = new URL(
      /^\w+:\/\//.test(normalized) ? normalized : `http://${normalized}`
    );
  } catch {
    return unusable('is not a valid url');
  }
  // Anything else parses but cannot be dialled: an http target throws out of
  // `http.request`, and an https one gets `CONNECT` spoken at a port that is
  // not answering HTTP, which surfaces much later as a refused server.
  if (proxy.protocol !== 'http:' && proxy.protocol !== 'https:') {
    return unusable('is not an http or https url');
  }
  // Credentials are percent-decoded when the request is built, far from the
  // configuration that produced them, so a value that cannot be decoded is
  // rejected here where the failure can still name where it came from.
  try {
    decodeURIComponent(proxy.username);
    decodeURIComponent(proxy.password);
  } catch {
    return unusable('has credentials that are not valid percent-encoding');
  }
  return { kind: 'proxy', proxy };
}

// Probing both routes and taking whichever answers would avoid porting this,
// but `no_proxy` is a directive about where traffic may go, not a hint: sending
// the target URL to an excluded proxy would disclose it even when the direct
// probe is the one that succeeds.
function shouldProxy(hostname: string, port: number): boolean {
  const noProxy = readEnv('no_proxy').value.toLowerCase();
  if (!noProxy) {
    return true;
  }
  if (noProxy === '*') {
    return false;
  }

  return noProxy.split(/[,\s]/).every((entry) => {
    if (!entry) {
      return true;
    }
    const withPort = entry.match(/^(.+):(\d+)$/);
    let host = withPort ? withPort[1] : entry;
    const entryPort = withPort ? parseInt(withPort[2]) : 0;
    if (entryPort && entryPort !== port) {
      return true;
    }
    if (!/^[.*]/.test(host)) {
      return hostname !== host;
    }
    if (host.charAt(0) === '*') {
      host = host.slice(1);
    }
    return !hostname.endsWith(host);
  });
}

// The executor runs in its own process, so a proxy variable the Playwright
// config sets while loading (through `dotenv`, say) reaches Playwright's probe
// and not this one. The name that was read is reported alongside the value so a
// bad one can be found among the eight this looks at.
function readEnv(name: string): { variable: string; value: string } {
  const lower = name.toLowerCase();
  if (process.env[lower]) {
    return { variable: lower, value: process.env[lower] };
  }
  const upper = name.toUpperCase();
  return { variable: upper, value: process.env[upper] || '' };
}

// A rejected value is echoed back so it can be recognized in the environment,
// and it reaches the task log, so the credentials come off first.
function withoutCredentials(value: string): string {
  const at = value.lastIndexOf('@');
  return at === -1 ? value : `***@${value.slice(at + 1)}`;
}
