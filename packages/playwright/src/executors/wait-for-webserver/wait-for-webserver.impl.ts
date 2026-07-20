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

export async function waitForWebserverExecutor(
  options: Schema,
  _context: ExecutorContext
): Promise<{ success: boolean }> {
  const servers = options.servers ?? [];
  const invalidServer = servers.find(
    (server) => server.port == null && !server.url
  );
  if (invalidServer) {
    logger.error(
      '@nx/playwright:wait-for-webserver requires each server to define a "port" or a "url".'
    );
    return { success: false };
  }

  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  try {
    await Promise.all(servers.map((server) => waitForServer(server, timeout)));
    return { success: true };
  } catch (e) {
    logger.error(e instanceof Error ? e.message : String(e));
    return { success: false };
  }
}

export default waitForWebserverExecutor;

async function waitForServer(server: Server, timeout: number): Promise<void> {
  const label = server.url ?? `port ${server.port}`;
  const deadline = Date.now() + timeout;
  const schedule = [...RETRY_SCHEDULE];

  while (true) {
    if (await isServerReady(server, deadline)) {
      return;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out after ${timeout}ms waiting for the E2E web server at ${label} to be ready.`
      );
    }
    const delay = schedule.shift() ?? FALLBACK_RETRY_DELAY;
    await sleep(Math.min(delay, Math.max(0, deadline - Date.now())));
  }
}

// Match Playwright's own check so the gate only clears once Playwright would
// reuse the running server: connect to the port on both loopback addresses,
// or poll the URL for an HTTP status in the 200-403 range.
function isServerReady(server: Server, deadline: number): Promise<boolean> {
  return server.port != null
    ? isPortUsed(server.port)
    : isUrlAvailable(server.url, server.ignoreHTTPSErrors ?? false, deadline);
}

function isPortUsed(port: number): Promise<boolean> {
  const canConnect = (host: string) =>
    new Promise<boolean>((resolve) => {
      const socket = connect({ port, host });
      const settle = (result: boolean) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(FALLBACK_RETRY_DELAY);
      socket.once('connect', () => settle(true));
      socket.once('timeout', () => settle(false));
      socket.once('error', () => settle(false));
    });

  return new Promise<boolean>((resolve) => {
    let pending = 2;
    const onResult = (connected: boolean) => {
      if (connected) {
        resolve(true);
      } else if (--pending === 0) {
        resolve(false);
      }
    };
    void canConnect('127.0.0.1').then(onResult);
    void canConnect('::1').then(onResult);
  });
}

async function isUrlAvailable(
  url: string,
  ignoreHTTPSErrors: boolean,
  deadline: number
): Promise<boolean> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }

  let statusCode = await httpStatusCode(parsedUrl, ignoreHTTPSErrors, deadline);
  if (statusCode === 404 && parsedUrl.pathname === '/') {
    const indexUrl = new URL(parsedUrl);
    indexUrl.pathname = '/index.html';
    statusCode = await httpStatusCode(indexUrl, ignoreHTTPSErrors, deadline);
  }
  return statusCode >= 200 && statusCode < 404;
}

function httpStatusCode(
  url: URL,
  ignoreHTTPSErrors: boolean,
  deadline: number,
  redirectsRemaining = MAX_REDIRECTS
): Promise<number> {
  return new Promise((resolve) => {
    // Bound each request by the overall readiness deadline, not a fixed
    // interval, so an endpoint that legitimately responds slowly is not
    // aborted before Playwright itself would give up.
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      resolve(0);
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
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;
        response.resume();
        request.destroy();
        // Follow redirects like Playwright and evaluate the final
        // destination, so a redirect to an unavailable page is not read as
        // ready. Treat an exhausted or malformed chain as not ready.
        if (statusCode >= 300 && statusCode < 400 && location) {
          if (redirectsRemaining <= 0) {
            resolve(0);
            return;
          }
          let redirectUrl: URL;
          try {
            redirectUrl = new URL(location, url);
          } catch {
            resolve(0);
            return;
          }
          resolve(
            httpStatusCode(
              redirectUrl,
              ignoreHTTPSErrors,
              deadline,
              redirectsRemaining - 1
            )
          );
          return;
        }
        resolve(statusCode);
      }
    );
    request.once('timeout', () => {
      request.destroy();
      resolve(0);
    });
    request.once('error', () => {
      request.destroy();
      resolve(0);
    });
    request.end();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
