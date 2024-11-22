/**
 * Per workspace (to avoid subtle differences and issues), we want to have a deterministic
 * location within the OS's tmp directory where we write log files for background processes
 * and where we create the actual unix socket/named pipe for the daemon.
 */
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'path';
import { workspaceDataDirectory } from '../utils/cache-directory';
import { createHash } from 'crypto';
import { tmpdir } from 'tmp';
import { workspaceRoot } from '../utils/workspace-root';

export const DAEMON_DIR_FOR_CURRENT_WORKSPACE = join(
  workspaceDataDirectory,
  'd'
);

export const DAEMON_OUTPUT_LOG_FILE = join(
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  'daemon.log'
);

export const getDaemonSocketDir = () =>
  join(
    getSocketDir(),
    // As per notes above on socket/named pipe length limitations, we keep this intentionally short
    'd.sock'
  );

export function writeDaemonLogs(error?: string) {
  const file = join(DAEMON_DIR_FOR_CURRENT_WORKSPACE, 'daemon-error.log');
  writeFileSync(file, error);
  return file;
}

export function markDaemonAsDisabled() {
  writeFileSync(join(DAEMON_DIR_FOR_CURRENT_WORKSPACE, 'disabled'), 'true');
}

export function isDaemonDisabled() {
  try {
    statSync(join(DAEMON_DIR_FOR_CURRENT_WORKSPACE, 'disabled'));
    return true;
  } catch (e) {
    return false;
  }
}

function socketDirName() {
  const hasher = createHash('sha256');
  hasher.update(workspaceRoot.toLowerCase());
  const unique = hasher.digest('hex').substring(0, 20);
  return join(tmpdir, unique);
}

/**
 * We try to create a socket file in a tmp dir, but if it doesn't work because
 * for instance we don't have permissions, we create it in DAEMON_DIR_FOR_CURRENT_WORKSPACE
 */
export function getSocketDir(alreadyUnique = false) {
  try {
    const dir =
      process.env.NX_SOCKET_DIR ??
      process.env.NX_DAEMON_SOCKET_DIR ??
      (alreadyUnique ? tmpdir : socketDirName());
    mkdirSync(dir, { recursive: true });

    return dir;
  } catch (e) {
    return DAEMON_DIR_FOR_CURRENT_WORKSPACE;
  }
}

export function removeSocketDir() {
  try {
    rmSync(getSocketDir(), { recursive: true, force: true });
  } catch (e) {}
}
