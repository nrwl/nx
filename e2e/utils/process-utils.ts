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

async function isPortInUse(port: number): Promise<boolean> {
  try {
    return await portCheck(port);
  } catch {
    // tcp-port-used's check() rejects on any connect error other than
    // ECONNREFUSED. A port whose process was just killed can reset the probe
    // (ECONNRESET) instead of cleanly refusing it; treat "can't probe" as
    // freed rather than letting it throw and fail the caller's teardown.
    return false;
  }
}

async function waitForPortToClose(port: number): Promise<boolean> {
  const deadline = Date.now() + KILL_PORT_TIMEOUT;
  while (await isPortInUse(port)) {
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
  if (!(await isPortInUse(port))) {
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
