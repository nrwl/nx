import type { PlaywrightTestConfig } from '@playwright/test';
import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import { join } from 'node:path';

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
  }));
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
  const candidate = message as { type?: unknown; webServers?: unknown };
  return (
    candidate.type === 'webserver-config-error' ||
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
    const child = fork(workerScriptPath, [configFilePath, workspaceRoot], {
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
