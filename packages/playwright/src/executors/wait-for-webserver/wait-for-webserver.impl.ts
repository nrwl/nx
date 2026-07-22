import { logger, type ExecutorContext } from '@nx/devkit';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as http from 'node:http';
import * as https from 'node:https';
import { connect } from 'node:net';
import { resolveProxyForUrl, type ProxyResolution } from './proxy';
import type { Schema } from './schema';

const DEFAULT_TIMEOUT = 60_000;
// Retry cadence mirrors Playwright's web server readiness loop: a short ramp
// up front, then a steady interval.
const RETRY_SCHEDULE = [100, 250, 500];
const FALLBACK_RETRY_DELAY = 1_000;

type Server = Schema['servers'][number];
// A probe resolves to `null` when the server is ready, or to a short
// description of why it is not, which is surfaced when the wait times out.
type ProbeFailure = string | null;
// A probe the deadline cut short before it could learn anything observed
// nothing, so it must not replace what the previous probe saw.
const NO_OBSERVATION = 'the deadline passed before the server responded';

export async function waitForWebserverExecutor(
  options: Schema,
  _context: ExecutorContext
): Promise<{ success: boolean }> {
  const servers = options.servers ?? [];
  if (servers.length === 0) {
    logger.error(
      '@nx/playwright:wait-for-webserver requires at least one server to wait for.'
    );
    return { success: false };
  }
  const problem = servers.map(findServerProblem).find(Boolean);
  if (problem) {
    logger.error(`@nx/playwright:wait-for-webserver ${problem}`);
    return { success: false };
  }

  try {
    await Promise.all(
      servers.map((server) =>
        // A zero timeout means "unset" rather than "give up immediately", which
        // is how Playwright reads it (`this._options.timeout || 60 * 1e3`).
        waitForServer(
          server,
          options.timeout || server.timeout || DEFAULT_TIMEOUT
        )
      )
    );
    return { success: true };
  } catch (e) {
    logger.error(e instanceof Error ? e.message : String(e));
    return { success: false };
  }
}

export default waitForWebserverExecutor;

// A malformed URL, an out-of-range port and a proxy that cannot be used are all
// inputs that can never become valid, so they are rejected up front instead of
// being retried until the timeout and reported as a slow server. An unusable
// port is also the only input that makes `connect` throw synchronously, which
// no probe could turn into a failure.
function findServerProblem(server: Server): string | undefined {
  if (server.port == null && !server.url) {
    return 'requires each server to define a "port" or a "url".';
  }
  if (server.port != null && !isValidPort(server.port)) {
    return `received an invalid "port": ${server.port}.`;
  }
  if (server.url) {
    let url: URL;
    try {
      url = new URL(server.url);
    } catch {
      return `received an invalid "url": ${server.url}.`;
    }
    // Only the address the wait starts from is checked here. A redirect can
    // cross to a protocol with its own proxy variable, which the probe reports
    // when it gets there.
    const resolution = resolveProxyForUrl(url);
    if (resolution.kind === 'unusable') {
      return `${unusableProxyProblem(resolution)}.`;
    }
  }
}

// Left unpunctuated because a probe failure is also quoted mid-sentence when
// the wait times out.
function unusableProxyProblem(
  resolution: Extract<ProxyResolution, { kind: 'unusable' }>
): string {
  return `cannot use the proxy configured in ${resolution.variable}: ${resolution.value} ${resolution.reason}`;
}

// 0 is not a connectable port, so it is rejected rather than probed.
function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

async function waitForServer(server: Server, timeout: number): Promise<void> {
  const label = server.url ?? `port ${server.port}`;
  const deadline = Date.now() + timeout;
  const schedule = [...RETRY_SCHEDULE];
  let lastObserved: string | undefined;

  while (true) {
    const failure = await probeServer(server, deadline);
    if (failure === null) {
      return;
    }
    if (failure !== NO_OBSERVATION) {
      lastObserved = failure;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out after ${timeout}ms waiting for the E2E web server at ${label} to be ready. Last observation: ${
          lastObserved ?? failure
        }.`
      );
    }
    const delay = schedule.shift() ?? FALLBACK_RETRY_DELAY;
    await sleep(Math.min(delay, Math.max(0, deadline - Date.now())));
  }
}

// Probe the way Playwright does: connect to the port on both loopback
// addresses, or poll the URL for a status from 200 to 403, through whatever
// proxy the environment configures for it. A port is always probed directly,
// because Playwright checks one with a raw socket too.
function probeServer(server: Server, deadline: number): Promise<ProbeFailure> {
  return server.port != null
    ? probePort(server.port)
    : probeUrl(server.url, server.ignoreHTTPSErrors ?? false, deadline);
}

function probePort(port: number): Promise<ProbeFailure> {
  const canConnect = (host: string) =>
    new Promise<ProbeFailure>((resolve) => {
      const address = host.includes(':')
        ? `[${host}]:${port}`
        : `${host}:${port}`;
      const socket = connect({ port, host });
      const settle = (failure: ProbeFailure) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(failure);
      };
      socket.setTimeout(FALLBACK_RETRY_DELAY);
      socket.once('connect', () => settle(null));
      socket.once('timeout', () => settle(`${address} timed out`));
      socket.once('error', (error: NodeJS.ErrnoException) =>
        settle(`${address} ${error.code ?? error.message}`)
      );
    });

  return new Promise<ProbeFailure>((resolve) => {
    const failures: string[] = [];
    let pending = 2;
    const onResult = (failure: ProbeFailure) => {
      if (failure === null) {
        resolve(null);
      } else {
        failures.push(failure);
        if (--pending === 0) {
          resolve(failures.join('; '));
        }
      }
    };
    void canConnect('127.0.0.1').then(onResult);
    void canConnect('::1').then(onResult);
  });
}

async function probeUrl(
  url: string,
  ignoreHTTPSErrors: boolean,
  deadline: number
): Promise<ProbeFailure> {
  // Validated before any server is probed, so this cannot throw.
  const parsedUrl = new URL(url);

  let response = await requestStatus(parsedUrl, ignoreHTTPSErrors, deadline);
  if (response.status === 404 && parsedUrl.pathname === '/') {
    const indexUrl = new URL(parsedUrl);
    indexUrl.pathname = '/index.html';
    response = await requestStatus(indexUrl, ignoreHTTPSErrors, deadline);
  }
  if (response.status >= 200 && response.status < 404) {
    return null;
  }
  return (
    response.failure ??
    `${response.href} responded with status ${response.status}${viaProxy(
      response.via
    )}`
  );
}

// The one place the phrase is written, so a failure the probe words and one the
// request words cannot drift apart.
function viaProxy(via: string | undefined): string {
  return via ? ` via the proxy at ${via}` : '';
}

interface UrlResponse {
  // The URL that produced the response, which is the redirect destination when
  // the chain was followed.
  href: string;
  status: number;
  failure?: string;
  // The proxy the status came back through, if any. A proxy that answers in the
  // server's place produces one that reads as the server's own until the
  // message says otherwise.
  via?: string;
}

function requestStatus(
  url: URL,
  ignoreHTTPSErrors: boolean,
  deadline: number,
  redirects = 0
): Promise<UrlResponse> {
  // A chain that ran out of budget still told us the server is answering, so it
  // is a real observation rather than silence, whether the budget ran out
  // between hops or inside the last one.
  const redirectFailure =
    redirects > 0
      ? `${url.href} redirected ${redirects} times without resolving`
      : undefined;
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    return Promise.resolve({
      href: url.href,
      status: 0,
      failure: redirectFailure ?? NO_OBSERVATION,
    });
  }

  // Resolved per URL rather than once per probe so a redirect that changes
  // protocol re-selects the way Playwright's own recursion does.
  const resolution = resolveProxyForUrl(url);
  if (resolution.kind === 'unusable') {
    return Promise.resolve({
      href: url.href,
      status: 0,
      failure: `${url.href} ${unusableProxyProblem(resolution)}`,
    });
  }

  const via = resolution.kind === 'proxy' ? resolution.proxy.host : undefined;
  const describe = (detail: string) => `${url.href} ${detail}${viaProxy(via)}`;

  return new Promise((resolve) => {
    const requestOptions: https.RequestOptions = {
      method: 'GET',
      headers: { Accept: '*/*' },
      rejectUnauthorized: !ignoreHTTPSErrors,
    };

    let request: http.ClientRequest | undefined;
    let settled = false;
    // Until the agent finishes `CONNECT` the request holds no socket, so
    // destroying it cannot reach the connection to the proxy. Aborting is what
    // closes that leg; without it a proxy that never answers leaves a live
    // socket nothing else can reach.
    const connecting = new AbortController();
    // Declared ahead of the settle it is cleared by, which the timer's own
    // callback in turn calls.
    let budget: NodeJS.Timeout;
    const settle = (response: UrlResponse | Promise<UrlResponse>) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(budget);
      request?.destroy();
      connecting.abort();
      resolve(response);
    };

    // The rest of the readiness budget bounds the request in wall-clock time. A
    // request arms its own idle timeout only once it holds a socket, and one
    // waiting on a proxy that accepted the connection but never answered
    // `CONNECT` never gets that far. Unreferenced because it is a bound rather
    // than work of its own: it still fires while a request is in flight, and
    // cannot hold the process open once nothing else does.
    budget = setTimeout(() => {
      // Staying silent for the window the port probe allows is something the
      // server did. Going quiet with a sliver of budget left is not: that is
      // the deadline arriving mid-request, and it says nothing about a server
      // an earlier probe may have already reached.
      settle({
        href: url.href,
        status: 0,
        failure:
          redirectFailure ??
          (remaining >= FALLBACK_RETRY_DELAY
            ? describe('did not respond')
            : NO_OBSERVATION),
      });
    }, remaining).unref();

    const onResponse = (response: http.IncomingMessage) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      response.resume();
      // Follow redirects like Playwright and evaluate the final
      // destination, so a redirect to an unavailable page is not read as
      // ready. The readiness deadline bounds the chain instead of a hop
      // count, which would fail a long chain Playwright follows to a
      // ready server. Treat a malformed chain as not ready.
      if (status >= 300 && status < 400 && location) {
        let redirectUrl: URL;
        try {
          redirectUrl = new URL(location, url);
        } catch {
          settle({
            href: url.href,
            status: 0,
            // Node's header parser passes tab and the C1 controls through, and
            // the value reaches a terminal from here.
            failure: describe(
              `redirected to an invalid location "${location.replace(
                /[\x00-\x1f\x7f-\x9f]/g,
                ''
              )}"`
            ),
          });
          return;
        }
        settle(
          requestStatus(redirectUrl, ignoreHTTPSErrors, deadline, redirects + 1)
        );
        return;
      }
      settle({ href: url.href, via, status });
    };

    switch (resolution.kind) {
      case 'direct':
        request = (url.protocol === 'https:' ? https : http).request(
          url,
          requestOptions,
          onResponse
        );
        break;
      case 'proxy':
        request = proxiedRequest(
          url,
          resolution.proxy,
          requestOptions,
          connecting.signal,
          onResponse
        );
        break;
      default: {
        // Both kinds that reach here route the request somewhere; a new one has
        // to say where.
        const unhandled: never = resolution;
        throw new Error(
          `Unhandled proxy resolution ${JSON.stringify(unhandled)}`
        );
      }
    }

    // Not `once`: aborting the connection raises a second error on a request
    // that has already been settled, and an emitter left without a listener
    // would throw it at the process.
    request.on('error', (error: NodeJS.ErrnoException) => {
      const detail = error.code ?? error.message;
      settle({
        href: url.href,
        status: 0,
        failure: describe(
          redirects > 0 ? `${detail} after ${redirects} redirects` : detail
        ),
      });
    });
    request.end();
  });
}

// An http target is named in the request line and the request itself goes to
// the proxy, which is what Playwright does. An https target cannot be named
// that way, so the agent opens a tunnel with `CONNECT` and TLS runs over it.
// Proxy credentials travel differently on the two routes, on the URL for the
// first and as `Proxy-Authorization` for the second, and both match Playwright.
function proxiedRequest(
  url: URL,
  proxy: URL,
  options: https.RequestOptions,
  signal: AbortSignal,
  onResponse: (response: http.IncomingMessage) => void
): http.ClientRequest {
  if (url.protocol === 'https:') {
    const agent = new HttpsProxyAgent(proxy);
    // The agent dials the proxy itself, so this is the only handle on that
    // connection. A signal in the request options does not reach it.
    agent.connectOpts.signal = signal;
    return https.request(url, { ...options, agent }, onResponse);
  }
  return (proxy.protocol === 'https:' ? https : http).request(
    proxy,
    { ...options, path: url.href },
    onResponse
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
