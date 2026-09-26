import { promisify } from 'util';
import treeKill = require('tree-kill');
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

export async function killPorts(port?: number): Promise<boolean> {
  return port
    ? await killPort(port)
    : (await killPort(3333)) && (await killPort(4200));
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
