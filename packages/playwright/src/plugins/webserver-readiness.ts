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

type ChildEval = (
  configFilePath: string,
  workspaceRoot: string,
  env: NodeJS.ProcessEnv
) => Promise<ResolvedWebServer[]>;

// A forked config evaluation holds a full config module graph in memory
// (hundreds of MB for a large config), so cap how many run at once.
const MAX_CONCURRENT_EVALS = Math.max(1, Math.min(cpus().length, 8));
const CHILD_EVAL_TIMEOUT = 30_000;

let activeEvals = 0;
const evalQueue: Array<() => void> = [];
let childEval: ChildEval = forkChildEval;

/**
 * Evaluates `configFilePath`'s `webServer` addresses under `taskEnv`, bounded by
 * the concurrency cap. Used only when the env diverges from ambient.
 */
export async function resolveWebServersUnderEnv(
  configFilePath: string,
  workspaceRoot: string,
  taskEnv: NodeJS.ProcessEnv
): Promise<ResolvedWebServer[]> {
  if (activeEvals >= MAX_CONCURRENT_EVALS) {
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

function forkChildEval(
  configFilePath: string,
  workspaceRoot: string,
  env: NodeJS.ProcessEnv
): Promise<ResolvedWebServer[]> {
  return new Promise((resolve, reject) => {
    const child = fork(
      join(__dirname, 'webserver-config-worker.js'),
      [configFilePath, workspaceRoot],
      { env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }
    );
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
      child.kill();
      finish(() =>
        reject(new Error('Timed out evaluating the Playwright config'))
      );
    }, CHILD_EVAL_TIMEOUT);

    child.on('message', (message: ResolvedWebServer[] | { error: string }) => {
      if (!Array.isArray(message) && message?.error) {
        finish(() => reject(new Error(message.error)));
      } else {
        finish(() => resolve(message as ResolvedWebServer[]));
      }
    });
    child.on('error', (error) => finish(() => reject(error)));
    child.on('exit', (code) => {
      if (code !== 0) {
        finish(() =>
          reject(new Error(`Config evaluation worker exited with code ${code}`))
        );
      }
    });
  });
}

// Test seam: the fork cannot run inside the unit test harness (the worker is
// only compiled in dist). Tests replace it with an in-process evaluation, which
// is safe there because the harness evaluates a single config at a time.
export function _setChildEval(impl: ChildEval | null): void {
  childEval = impl ?? forkChildEval;
}
