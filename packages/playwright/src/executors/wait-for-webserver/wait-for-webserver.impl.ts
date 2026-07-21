import { logger, type ExecutorContext } from '@nx/devkit';
import * as http from 'node:http';
import * as https from 'node:https';
import { connect } from 'node:net';
import type { Schema } from './schema';

const DEFAULT_TIMEOUT = 60_000;
// Retry cadence mirrors Playwright's web server readiness loop: a short ramp
// up front, then a steady interval.
const RETRY_SCHEDULE = [100, 250, 500];
const FALLBACK_RETRY_DELAY = 1_000;
const MAX_REDIRECTS = 10;

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

// Neither a malformed URL nor an out-of-range port can become valid, so they
// are rejected up front instead of being retried until the timeout and
// reported as a slow server. An unusable port is also the only input that makes
// `connect` throw synchronously, which no probe could turn into a failure.
function findServerProblem(server: Server): string | undefined {
  if (server.port == null && !server.url) {
    return 'requires each server to define a "port" or a "url".';
  }
  if (server.port != null && !isValidPort(server.port)) {
    return `received an invalid "port": ${server.port}.`;
  }
  if (server.url && !canParseUrl(server.url)) {
    return `received an invalid "url": ${server.url}.`;
  }
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

// Mirror Playwright's own readiness check: connect to the port on both
// loopback addresses, or poll the URL for an HTTP status below 404.
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
    `${response.href} responded with status ${response.status}`
  );
}

interface UrlResponse {
  // The URL that produced the response, which is the redirect destination when
  // the chain was followed.
  href: string;
  status: number;
  failure?: string;
}

function requestStatus(
  url: URL,
  ignoreHTTPSErrors: boolean,
  deadline: number,
  redirectsRemaining = MAX_REDIRECTS
): Promise<UrlResponse> {
  return new Promise((resolve) => {
    // Give each request the rest of the readiness budget as its idle timeout,
    // rather than a fixed interval, so an endpoint that legitimately responds
    // slowly is not aborted before Playwright itself would give up.
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      resolve({ href: url.href, status: 0, failure: NO_OBSERVATION });
      return;
    }
    const isHttps = url.protocol === 'https:';
    const requestOptions: https.RequestOptions = {
      method: 'GET',
      headers: { Accept: '*/*' },
      timeout: remaining,
    };
    if (isHttps) {
      requestOptions.rejectUnauthorized = !ignoreHTTPSErrors;
    }

    const request = (isHttps ? https.request : http.request)(
      url,
      requestOptions,
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        response.resume();
        request.destroy();
        // Follow redirects like Playwright and evaluate the final
        // destination, so a redirect to an unavailable page is not read as
        // ready. Treat an exhausted or malformed chain as not ready.
        if (status >= 300 && status < 400 && location) {
          if (redirectsRemaining <= 0) {
            resolve({
              href: url.href,
              status: 0,
              failure: `${url.href} redirected more than ${MAX_REDIRECTS} times`,
            });
            return;
          }
          let redirectUrl: URL;
          try {
            redirectUrl = new URL(location, url);
          } catch {
            resolve({
              href: url.href,
              status: 0,
              failure: `${url.href} redirected to an invalid location "${location}"`,
            });
            return;
          }
          resolve(
            requestStatus(
              redirectUrl,
              ignoreHTTPSErrors,
              deadline,
              redirectsRemaining - 1
            )
          );
          return;
        }
        resolve({ href: url.href, status });
      }
    );
    request.once('timeout', () => {
      request.destroy();
      // Staying silent for the window the port probe allows is something the
      // server did. Going quiet with a sliver of budget left is not: that is
      // the deadline arriving mid-request, and it says nothing about a server
      // an earlier probe may have already reached.
      resolve({
        href: url.href,
        status: 0,
        failure:
          remaining >= FALLBACK_RETRY_DELAY
            ? `${url.href} did not respond`
            : NO_OBSERVATION,
      });
    });
    request.once('error', (error: NodeJS.ErrnoException) => {
      request.destroy();
      resolve({
        href: url.href,
        status: 0,
        failure: `${url.href} ${error.code ?? error.message}`,
      });
    });
    request.end();
  });
}

function canParseUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
