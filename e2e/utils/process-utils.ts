import { promisify } from 'util';
import * as treeKill from 'tree-kill';
import { logError, logInfo, logSuccess } from './log-utils';
import { check as portCheck } from 'tcp-port-used';

export const kill = require('kill-port');
const KILL_PORT_DELAY = 5000;

export const promisifiedTreeKill: (
  pid: number,
  signal: string
) => Promise<void> = promisify(treeKill);

export async function killPort(port: number): Promise<boolean> {
  if (await portCheck(port)) {
    let killPortResult;
    try {
      logInfo(`Attempting to close port ${port}`);
      killPortResult = await kill(port);
      await new Promise<void>((resolve) =>
        setTimeout(() => resolve(), KILL_PORT_DELAY)
      );
      if (await portCheck(port)) {
        logError(`Port ${port} still open`, JSON.stringify(killPortResult));
      } else {
        logSuccess(`Port ${port} successfully closed`);
        return true;
      }
    } catch {
      logError(`Port ${port} closing failed`);
    }
    return false;
  } else {
    return true;
  }
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

/**
 * Generates a random port number between 1024 and 9999.
 * Ports below 1024 are reserved for system services.
 */
export function getRandomPort() {
  return Math.floor(1024 + Math.random() * 8976);
}
