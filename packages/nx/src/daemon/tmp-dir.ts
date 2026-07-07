/**
 * Per workspace (to avoid subtle differences and issues), we want to have a deterministic
 * location within the OS's tmp directory where we write log files for background processes
 * and where we create the actual unix socket/named pipe for the daemon.
 */
import { chmodSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'path';
import { workspaceDataDirectory } from '../utils/cache-directory';
import { createHash } from 'crypto';
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

export function markDaemonAsDisabled(reason: string) {
  writeFileSync(join(DAEMON_DIR_FOR_CURRENT_WORKSPACE, 'disabled'), reason);
}

export function isDaemonDisabled() {
  try {
    statSync(join(DAEMON_DIR_FOR_CURRENT_WORKSPACE, 'disabled'));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Parent directory of the socket root. Sandbox configurations should grant
 * read/write access to this directory. A fixed /tmp path is used instead of
 * os.tmpdir() because tmpdir() honors $TMPDIR, which is per-user on macOS and
 * rewritten per-session by sandboxes — a literal path stays identical across
 * machines and contexts, so it can live in committed, shared config files.
 */
export const NX_SOCKET_DIR_PARENT_POSIX = '/tmp/.nx';

/**
 * All Nx sockets (daemon, forked processes, plugin workers) live under this
 * single stable root so that sandboxed environments (e.g. AI agent sandboxes)
 * can allow unix socket access with one predictable rule. Windows named pipes
 * are not subject to filesystem sandboxing, so the OS temp dir is fine there.
 */
export const NX_SOCKET_ROOT_POSIX = join(NX_SOCKET_DIR_PARENT_POSIX, 'sockets');

export const NX_SOCKET_ROOT =
  platform() === 'win32'
    ? join(tmpdir(), '.nx', 'sockets')
    : NX_SOCKET_ROOT_POSIX;

export function getNxSocketRoot(): string {
  return (
    process.env.NX_SOCKET_DIR ??
    process.env.NX_DAEMON_SOCKET_DIR ??
    NX_SOCKET_ROOT
  );
}

function socketDirName() {
  const hasher = createHash('sha256');
  hasher.update(workspaceRoot.toLowerCase());
  hasher.update(String(process.pid));
  const unique = hasher.digest('hex').substring(0, 20);
  return join(getNxSocketRoot(), unique);
}

/**
 * We try to create a socket file under the common socket root, but if it
 * doesn't work because for instance we don't have permissions, we create it
 * in DAEMON_DIR_FOR_CURRENT_WORKSPACE
 */
export function getSocketDir(alreadyUnique = false) {
  try {
    const dir =
      process.env.NX_SOCKET_DIR ??
      process.env.NX_DAEMON_SOCKET_DIR ??
      (alreadyUnique ? getNxSocketRoot() : socketDirName());
    mkdirSync(dir, { recursive: true });
    if (
      !process.env.NX_SOCKET_DIR &&
      !process.env.NX_DAEMON_SOCKET_DIR &&
      platform() !== 'win32'
    ) {
      // /tmp is shared between all users on the machine, so the socket root
      // and its parent need to be sticky + world-writable (like /tmp itself)
      // for other users to be able to create their own socket dirs under
      // them. chmod only succeeds for the user that created the dirs, hence
      // best-effort.
      try {
        chmodSync(NX_SOCKET_DIR_PARENT_POSIX, 0o1777);
        chmodSync(NX_SOCKET_ROOT_POSIX, 0o1777);
      } catch {}
    }

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
