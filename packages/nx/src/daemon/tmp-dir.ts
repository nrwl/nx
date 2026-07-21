/**
 * Per workspace (to avoid subtle differences and issues), we want to have a deterministic
 * location within the OS's tmp directory where we write log files for background processes
 * and where we create the actual unix socket/named pipe for the daemon.
 */
import { chmodSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'path';
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

function socketDirName() {
  const hasher = createHash('sha256');
  hasher.update(workspaceRoot.toLowerCase());
  hasher.update(String(process.pid));
  const unique = hasher.digest('hex').substring(0, 20);
  return join(tmpdir, unique);
}

function pluginSocketDirName() {
  // Kept intentionally short (see notes above on socket path length limits) so
  // that the workspace-scoped plugin socket directory still leaves room for the
  // socket file name within the OS limit.
  const hash = createHash('sha256')
    .update(workspaceRoot.toLowerCase())
    .digest('hex')
    .substring(0, 8);
  return join(tmpdir, `nx-${hash}`);
}

/**
 * We try to create a socket file in a tmp dir, but if it doesn't work because
 * for instance we don't have permissions, we create it in DAEMON_DIR_FOR_CURRENT_WORKSPACE
 */
export function getSocketDir() {
  return createOwnerOnlySocketDir(
    process.env.NX_SOCKET_DIR ??
      process.env.NX_DAEMON_SOCKET_DIR ??
      socketDirName()
  );
}

/**
 * Plugin worker sockets get their own workspace-scoped directory under the OS
 * temp dir. They previously sat directly in the shared system temp dir (which
 * we cannot lock down); giving them an owner-only directory prevents other
 * local users from connecting to a plugin worker and executing code in it.
 */
export function getPluginSocketDir() {
  return createOwnerOnlySocketDir(
    process.env.NX_SOCKET_DIR ??
      process.env.NX_DAEMON_SOCKET_DIR ??
      pluginSocketDirName()
  );
}

function createOwnerOnlySocketDir(dir: string): string {
  try {
    // The system temp dir is usable by every account on the machine (it is
    // typically world-writable), so we can never lock it down to the current
    // user. Refuse to place sockets directly in it - another local user could
    // connect and execute code in the daemon or a plugin worker. Fall through
    // to the owner-controlled workspace data dir instead of silently trusting
    // a shared root.
    if (resolve(dir) === resolve(tmpdir)) {
      throw new Error(
        `Refusing to place Nx sockets directly in the shared system temp directory ('${tmpdir}') because it is accessible to every user on the machine. Set NX_SOCKET_DIR to a directory that only your user can access.`
      );
    }

    // `mode` only applies to directories mkdirSync actually creates; a
    // pre-existing directory keeps its current permissions, so we still chmod
    // it below to guarantee the sockets inside are reachable only by their
    // owner.
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    restrictToOwner(dir);
    return dir;
  } catch (e) {
    // Fail closed: fall back to the owner-controlled workspace data dir rather
    // than a shared location, and lock it down as well. The lockdown is
    // best-effort so a chmod failure here never prevents the daemon from
    // obtaining a socket directory.
    try {
      mkdirSync(DAEMON_DIR_FOR_CURRENT_WORKSPACE, {
        recursive: true,
        mode: 0o700,
      });
      restrictToOwner(DAEMON_DIR_FOR_CURRENT_WORKSPACE);
    } catch {}
    return DAEMON_DIR_FOR_CURRENT_WORKSPACE;
  }
}

/**
 * chmod a path to `0700` (owner-only) on POSIX. On Windows this is a no-op:
 * named pipes are secured via their default DACL, which does not grant write
 * access to other users, and Node exposes no API to adjust it.
 */
function restrictToOwner(path: string) {
  if (process.platform === 'win32') {
    return;
  }
  chmodSync(path, 0o700);
}

export function removeSocketDir() {
  try {
    rmSync(getSocketDir(), { recursive: true, force: true });
  } catch (e) {}
}
