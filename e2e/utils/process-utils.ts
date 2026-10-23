import { execFileSync } from 'child_process';
import { realpathSync } from 'fs';
import { isAbsolute, relative } from 'path';
import { promisify } from 'util';
import treeKill = require('tree-kill');
import { e2eRoot } from './get-env-info';
import { logError, logInfo, logSuccess, secondsSince } from './log-utils';
import { check as portCheck } from 'tcp-port-used';

export const kill = require('kill-port');
const KILL_PORT_TIMEOUT = 5000;
const KILL_PORT_POLL_INTERVAL = 100;

export const promisifiedTreeKill: (
  pid: number,
  signal: string
) => Promise<void> = promisify(treeKill);

/**
 * `unknown` is not `free`: tcp-port-used's check() rejects on any connect error
 * other than ECONNREFUSED, so a probe that resets (ECONNRESET) tells us nothing
 * about whether the port is still bound.
 */
type PortState = 'in-use' | 'free' | 'unknown';

async function probePort(port: number): Promise<PortState> {
  try {
    return (await portCheck(port)) ? 'in-use' : 'free';
  } catch {
    return 'unknown';
  }
}

async function waitForPortToClose(port: number): Promise<boolean> {
  const deadline = Date.now() + KILL_PORT_TIMEOUT;
  // Only a `free` probe confirms closure. An `unknown` one is retried, since a
  // port that resets the probe now usually refuses it a moment later.
  while ((await probePort(port)) !== 'free') {
    if (Date.now() >= deadline) {
      return false;
    }
    await new Promise<void>((resolve) =>
      setTimeout(resolve, KILL_PORT_POLL_INTERVAL)
    );
  }
  return true;
}

export async function killPort(port: number): Promise<boolean> {
  // An unprobeable port is left alone, as on master: running kill-port against
  // a port nothing is listening on fails the teardown it is meant to clean up.
  if ((await probePort(port)) !== 'in-use') {
    return true;
  }
  const startTime = performance.now();
  let killPortResult;
  try {
    logInfo(`Attempting to close port ${port}`);
    killPortResult = await kill(port);
  } catch {
    logError(`Port ${port} closing failed (${secondsSince(startTime)}s)`);
    return false;
  }
  if (await waitForPortToClose(port)) {
    logSuccess(
      `Port ${port} successfully closed (${secondsSince(startTime)}s)`
    );
    return true;
  }
  logError(
    `Port ${port} still open (${secondsSince(startTime)}s)`,
    JSON.stringify(killPortResult)
  );
  return false;
}

/**
 * PIDs listening on `port`, or `null` where they cannot be listed (Windows, or
 * no `lsof`), in which case callers fall back to killing whatever listens.
 */
function listenerPids(port: number): number[] | null {
  if (process.platform === 'win32') {
    return null;
  }
  try {
    return execFileSync(
      'lsof',
      ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    )
      .split('\n')
      .filter(Boolean)
      .map(Number);
  } catch (err) {
    // lsof exits 1 when nothing listens; any other failure means no lsof.
    return (err as { status?: number }).status === 1 ? [] : null;
  }
}

/**
 * Working directory of `pid`, or `null` if it cannot be read. lsof rather than
 * /proc, so Linux and macOS take the same path: kill-port already needs lsof.
 */
function processCwd(pid: number): string | null {
  try {
    const out = execFileSync(
      'lsof',
      ['-a', '-p', `${pid}`, '-d', 'cwd', '-Fn'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    );
    const line = out.split('\n').find((l) => l.startsWith('n'));
    return line ? line.slice(1) : null;
  } catch {
    return null;
  }
}

function isInside(dir: string, root: string): boolean {
  let realRoot = root;
  try {
    realRoot = realpathSync(root);
  } catch {}
  const rel = relative(realRoot, dir);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * Kills `port` only if this suite owns its listener. Every process a suite
 * starts, including one it leaked, runs from inside its own `e2eRoot`, which is
 * unique per e2e process in CI. A listener running from anywhere else belongs
 * to a parallel suite on the same agent and is left alone.
 */
async function killOwnedPort(port: number): Promise<boolean> {
  const pids = listenerPids(port);
  if (pids === null) {
    return killPort(port);
  }
  const foreign = pids.filter((pid) => {
    const cwd = processCwd(pid);
    return cwd === null || !isInside(cwd, e2eRoot);
  });
  if (foreign.length) {
    logInfo(
      `Port ${port} is held by a process outside this suite (pid ${foreign.join(', ')}); leaving it open`
    );
    return true;
  }
  return killPort(port);
}

/**
 * With a port, kills that port. Without one, cleans up the framework defaults
 * (3333 and 4200) that a suite may have served on without reserving a port, but
 * only where this suite owns the listener: parallel e2e-ci tasks on one agent
 * share those ports.
 */
export async function killPorts(port?: number): Promise<boolean> {
  return port
    ? await killPort(port)
    : (await killOwnedPort(3333)) && (await killOwnedPort(4200));
}

export async function killProcessAndPorts(
  pid: number | undefined,
  ...ports: number[]
): Promise<void> {
  try {
    if (pid) {
      await promisifiedTreeKill(pid, 'SIGKILL');
    }
    for (const port of ports) {
      await killPort(port);
    }
  } catch (err) {
    expect(err).toBeFalsy();
  }
}
