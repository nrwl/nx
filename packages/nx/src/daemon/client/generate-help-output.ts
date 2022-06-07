import { spawnSync } from 'child_process';
import { getDaemonProcessId } from '../cache';
import { DAEMON_OUTPUT_LOG_FILE } from '../tmp-dir';

export function generateDaemonHelpOutput(): string {
  /**
   * A workaround for cases such as yargs output where we need to synchronously
   * get the value of this async operation.
   */
  const res = spawnSync(process.execPath, ['./exec-is-server-available.js'], {
    cwd: __dirname,
  });

  const isServerAvailable = res?.stdout?.toString().trim() === 'true';
  if (!isServerAvailable) {
    return '';
  }

  const pid = getDaemonProcessId();
  return `Nx Daemon is currently running:
  - Logs: ${DAEMON_OUTPUT_LOG_FILE}${
    pid
      ? `
  - Process ID: ${pid}`
      : ''
  }`;
}
