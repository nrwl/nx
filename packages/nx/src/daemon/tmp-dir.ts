/**
 * Per workspace (to avoid subtle differences and issues), we want to have a deterministic
 * location within the OS's tmp directory where we write log files for background processes
 * and where we create the actual unix socket/named pipe for the daemon.
 */
import { statSync, writeFileSync } from 'fs';
import { ensureDirSync, rmdirSync } from 'fs-extra';
import { join } from 'path';
import { projectGraphCacheDirectory } from '../utils/cache-directory';
import { createHash } from 'crypto';
import { tmpdir } from 'tmp';
import { workspaceRoot } from '../utils/workspace-root';

export const DAEMON_DIR_FOR_CURRENT_WORKSPACE = join(
  projectGraphCacheDirectory,
  'd'
);

export const DAEMON_OUTPUT_LOG_FILE = join(
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  'daemon.log'
);

const socketDir = createSocketDir();

export const DAEMON_SOCKET_PATH = join(
  socketDir,
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
function createSocketDir() {
  try {
    const dir = socketDirName();
    ensureDirSync(dir);
    return dir;
  } catch (e) {
    return DAEMON_DIR_FOR_CURRENT_WORKSPACE;
  }
}

export function removeSocketDir() {
  try {
    rmdirSync(socketDir);
  } catch (e) {}
}
