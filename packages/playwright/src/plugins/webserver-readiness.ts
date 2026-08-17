import type { PlaywrightTestConfig } from '@playwright/test';
import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import {
  noProxyEntries,
  resolveProxyForProtocol,
} from '../executors/wait-for-webserver/proxy';

/**
 * The serializable subset of a Playwright `webServer` entry that the readiness
 * gate needs. Passed back from the config-eval child over IPC.
 */
export interface ResolvedWebServer {
  command: string;
  url?: string;
  port?: number;
  reuseExistingServer?: boolean;
  ignoreHTTPSErrors?: boolean;
  timeout?: number;
  // `wait.stdout`/`wait.stderr` presence projected to a boolean: the RegExp
  // values do not survive the JSON IPC channel.
  waitsForOutput?: boolean;
  // Non-empty `env` presence. Only Playwright can launch such a command with
  // its environment, so the values themselves are not needed.
  hasEnv?: boolean;
}

export function normalizeWebServers(
  webServer: PlaywrightTestConfig['webServer']
): ResolvedWebServer[] {
  if (!webServer) {
    return [];
  }
  const servers = Array.isArray(webServer) ? webServer : [webServer];
  return servers.map((server) => ({
    command: server.command,
    url: server.url,
    port: server.port,
    reuseExistingServer: server.reuseExistingServer,
    ignoreHTTPSErrors: server.ignoreHTTPSErrors,
    timeout: server.timeout,
    waitsForOutput:
      server.wait?.stdout || server.wait?.stderr ? true : undefined,
    hasEnv: server.env && Object.keys(server.env).length > 0 ? true : undefined,
  }));
}

// The TLS material Node reads when a probe verifies an https certificate.
const TLS_PROBE_VARS = ['NODE_EXTRA_CA_CERTS', 'NODE_TLS_REJECT_UNAUTHORIZED'];

/**
 * The routes a probe under `env` can take, read as the executor's proxy
 * resolution reads them: the proxy for each protocol a redirect can reach
 * (`<protocol>_proxy`, falling back to `all_proxy`, normalized as it would be
 * dialled) and the `no_proxy` filter as its set of entries. A `no_proxy` that
 * excludes every host, or no proxy at all, sends every hop direct, so both
 * collapse to empty routes and a masked variable never counts as a difference.
 */
function proxyRoutes(env: NodeJS.ProcessEnv): {
  http: string;
  https: string;
  no_proxy: string;
} {
  const route = (protocol: string) => {
    const resolution = resolveProxyForProtocol(protocol, env);
    switch (resolution.kind) {
      case 'direct':
        return '';
      case 'proxy':
        return resolution.proxy.href;
      case 'unusable':
        return `unusable ${resolution.value}`;
      default: {
        const unhandled: never = resolution;
        throw new Error(`Unhandled resolution ${JSON.stringify(unhandled)}`);
      }
    }
  };
  const http = route('http');
  const https = route('https');
  // Entries exclude hosts independently, so a differing order or separator is
  // not a difference. `*.host` and `.host` are the same suffix match, whereas
  // `*host` (any suffix) and `host` (exact) are not. A bare `*` excludes every
  // host.
  const entries = [
    ...new Set(noProxyEntries(env).map((entry) => entry.replace(/^\*\./, '.'))),
  ].sort();
  if (entries.includes('*') || !(http || https)) {
    return { http: '', https: '', no_proxy: '' };
  }
  return { http, https, no_proxy: entries.join(',') };
}

/**
 * The env var names whose task-env values would make the readiness gate probe
 * `servers` differently than the consuming task's own Playwright probe. The
 * gate runs as its own target, so it loads its own dotenv files, not the
 * consumer's: a task-scoped proxy exclusion or CA bundle never reaches it, and
 * a gate probing through the wrong route can fail where Playwright would pass.
 * A non-empty result means the gate cannot reproduce the task's probe and must
 * not be inferred.
 *
 * Both probes follow redirects, so as soon as one server probes a url the
 * routes for every protocol and host are compared, not only the route the
 * configured url takes: an `https_proxy` for an http url or a `no_proxy` entry
 * for another host can still decide how a redirect target is reached. TLS env
 * is compared unless every url server sets `ignoreHTTPSErrors`, which turns
 * verification off on both sides for every hop, except that the tunnel to an
 * https proxy is verified with the process defaults either way.
 */
export function getProbeEnvDivergence(
  servers: Array<{ url?: string; ignoreHTTPSErrors?: boolean }>,
  taskEnv: NodeJS.ProcessEnv,
  ambientEnv: NodeJS.ProcessEnv = process.env
): string[] {
  // A port is probed with a raw TCP connect, and the executor rejects a
  // malformed url up front; env plays no part in either.
  const urlServers = servers.filter(
    (server) => server.url && URL.canParse(server.url)
  );
  if (urlServers.length === 0) {
    return [];
  }
  const diverging = new Set<string>();
  const taskRoutes = proxyRoutes(taskEnv);
  const ambientRoutes = proxyRoutes(ambientEnv);
  // Name the raw variables behind a differing route. A proxy route is decided
  // by every proxy variable (`no_proxy` can mask them all); the filter only by
  // `no_proxy`.
  const routeVars =
    taskRoutes.http !== ambientRoutes.http ||
    taskRoutes.https !== ambientRoutes.https
      ? ['http_proxy', 'https_proxy', 'all_proxy', 'no_proxy']
      : taskRoutes.no_proxy !== ambientRoutes.no_proxy
        ? ['no_proxy']
        : [];
  for (const name of routeVars) {
    for (const variable of [name, name.toUpperCase()]) {
      if (taskEnv[variable] !== ambientEnv[variable]) {
        diverging.add(variable);
      }
    }
  }
  // `ignoreHTTPSErrors` reaches the target's certificate only. An https target
  // is tunnelled through an https proxy over a TLS connection the proxy agent
  // opens with the process defaults, on both sides, so that certificate is
  // verified regardless.
  const tunnelsThroughTlsProxy = [taskRoutes.https, ambientRoutes.https].some(
    (route) => route.startsWith('https:')
  );
  if (
    tunnelsThroughTlsProxy ||
    urlServers.some((server) => !server.ignoreHTTPSErrors)
  ) {
    for (const variable of TLS_PROBE_VARS) {
      if (taskEnv[variable] !== ambientEnv[variable]) {
        diverging.add(variable);
      }
    }
  }
  return [...diverging].sort();
}

/**
 * Whether the task env a chain would run with differs from the graph-time
 * ambient env. Only a difference can change how the config resolves, so an
 * identical env skips the (expensive) child evaluation entirely.
 */
export function taskEnvDivergesFromAmbient(
  taskEnv: NodeJS.ProcessEnv
): boolean {
  const keys = new Set([...Object.keys(process.env), ...Object.keys(taskEnv)]);
  for (const key of keys) {
    if (process.env[key] !== taskEnv[key]) {
      return true;
    }
  }
  return false;
}

/**
 * The messages the config-eval worker sends over IPC. Tagged so the parent can
 * tell them apart from anything else on the channel: the user's config module
 * runs in the child and can itself call `process.send` during evaluation, and
 * such a message must not settle the resolution.
 */
export type WebserverConfigWorkerMessage =
  | { type: 'webserver-config-result'; webServers: ResolvedWebServer[] }
  | { type: 'webserver-config-error'; error: string };

type ChildEval = (
  configFilePath: string,
  workspaceRoot: string,
  env: NodeJS.ProcessEnv
) => Promise<ResolvedWebServer[]>;

// A forked config evaluation holds a full config module graph in memory, so cap
// how many run at once.
const MAX_CONCURRENT_EVALS = Math.max(1, Math.min(cpus().length, 8));
const CHILD_EVAL_TIMEOUT = 30_000;
// Cap the worker stderr buffered to fold into a failure message.
const MAX_STDERR = 8192;

let activeEvals = 0;
const evalQueue: Array<() => void> = [];
let childEval: ChildEval = forkChildEval;
let workerScriptPath = join(__dirname, 'webserver-config-worker.js');

/**
 * Evaluates `configFilePath`'s `webServer` addresses under `taskEnv`, bounded by
 * the concurrency cap. Used only when the env diverges from ambient.
 */
export async function resolveWebServersUnderEnv(
  configFilePath: string,
  workspaceRoot: string,
  taskEnv: NodeJS.ProcessEnv
): Promise<ResolvedWebServer[]> {
  // `while` rather than `if`: a caller arriving between a slot's release and
  // the woken waiter's resume can claim the slot first, so the waiter must
  // re-check before taking it.
  while (activeEvals >= MAX_CONCURRENT_EVALS) {
    await new Promise<void>((resolve) => evalQueue.push(resolve));
  }
  activeEvals++;
  try {
    return await childEval(configFilePath, workspaceRoot, taskEnv);
  } finally {
    activeEvals--;
    evalQueue.shift()?.();
  }
}

function isWorkerMessage(
  message: unknown
): message is WebserverConfigWorkerMessage {
  if (typeof message !== 'object' || message === null) {
    return false;
  }
  const candidate = message as {
    type?: unknown;
    error?: unknown;
    webServers?: unknown;
  };
  return (
    (candidate.type === 'webserver-config-error' &&
      typeof candidate.error === 'string') ||
    (candidate.type === 'webserver-config-result' &&
      Array.isArray(candidate.webServers))
  );
}

function forkChildEval(
  configFilePath: string,
  workspaceRoot: string,
  env: NodeJS.ProcessEnv
): Promise<ResolvedWebServer[]> {
  return new Promise((resolve, reject) => {
    // Startup env and project-root cwd mirror the inferred task, which runs
    // `playwright test` from the project root: a NODE_OPTIONS loader runs at
    // process start and resolves a relative path from there, whichever
    // directory nx was invoked from.
    const child = fork(workerScriptPath, [configFilePath, workspaceRoot], {
      cwd: join(workspaceRoot, dirname(configFilePath)),
      env,
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX_STDERR) {
        stderr += chunk.toString().slice(0, MAX_STDERR - stderr.length);
      }
    });
    // Fold the worker's stderr into a failure so a crash before it can report
    // over IPC (a missing module, a syntax error, a signal kill) is not
    // surfaced as a bare exit code.
    const withStderr = (message: string) => {
      const tail = stderr.trim();
      return tail ? `${message}\n${tail}` : message;
    };
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      child.removeAllListeners();
      if (child.connected) {
        child.disconnect();
      }
      fn();
    };
    const timer = setTimeout(() => {
      // SIGKILL: the eval child holds no state that needs graceful teardown,
      // and a config stuck in a busy loop would ignore SIGTERM anyway.
      child.kill('SIGKILL');
      finish(() =>
        reject(
          new Error(withStderr('Timed out evaluating the Playwright config'))
        )
      );
    }, CHILD_EVAL_TIMEOUT);

    child.on('message', (message: unknown) => {
      // Anything that fails the guard came from the evaluated config itself;
      // ignore it.
      if (!isWorkerMessage(message)) {
        return;
      }
      switch (message.type) {
        case 'webserver-config-error':
          finish(() => reject(new Error(withStderr(message.error))));
          break;
        case 'webserver-config-result':
          finish(() => resolve(message.webServers));
          break;
        default: {
          // A new message variant has to say how it settles the resolution.
          const unhandled: never = message;
          throw new Error(
            `Unhandled worker message ${JSON.stringify(unhandled)}`
          );
        }
      }
    });
    child.on('error', (error) => finish(() => reject(error)));
    // `close` rather than `exit` so the stderr the failure folds in has fully
    // flushed before the message is built. A worker that closes before sending a
    // result (even with code 0, e.g. an IPC delivery failure) rejects here
    // rather than hanging to the timeout; finish() no-ops once a result settled.
    child.on('close', (code) => {
      finish(() =>
        reject(
          new Error(
            withStderr(
              code
                ? `Config evaluation worker exited with code ${code}`
                : 'Config evaluation worker exited without resolving the web server address'
            )
          )
        )
      );
    });
  });
}

// Test seam: plugin unit tests replace the fork with an in-process evaluation
// (the compiled worker only exists in dist) and concurrency tests use it to
// control completion order. The fork itself is exercised against fixture
// workers via _setWorkerScriptPath below.
export function _setChildEval(impl: ChildEval | null): void {
  childEval = impl ?? forkChildEval;
}

// Test seam: point the fork at a fixture worker so forkChildEval's own timeout,
// exit and stderr handling can be exercised without the compiled worker.
export function _setWorkerScriptPath(path: string | null): void {
  workerScriptPath = path ?? join(__dirname, 'webserver-config-worker.js');
}
