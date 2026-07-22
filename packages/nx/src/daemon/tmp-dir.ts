/**
 * Per workspace (to avoid subtle differences and issues), we want to have a deterministic
 * location within the OS's tmp directory where we write log files for background processes
 * and where we create the actual unix socket/named pipe for the daemon.
 */
import { chmodSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'path';
import { workspaceDataDirectory } from '../utils/cache-directory';
import { createHash } from 'crypto';
// The shared OS temp dir. Only used to *reject* it as a socket location (see
// InvalidSocketDirConfigured); the sockets themselves live under NX_SOCKET_ROOT.
import { tmpdir as systemTmpDir } from 'tmp';
import { NX_TMP_DIR, NX_TMP_DIR_POSIX } from '../utils/nx-tmp-dir';
import { workspaceRoot } from '../utils/workspace-root';

/**
 * Thrown when the resolved Nx socket directory points at the shared system temp
 * directory. That location is accessible to every user on the machine, so the
 * daemon and plugin worker sockets placed inside it could be reached by another
 * local user and used to execute code. This is invalid configuration and must
 * fail loudly rather than silently substituting a default.
 */
export class InvalidSocketDirConfigured extends Error {
  constructor(public readonly dir: string) {
    super(
      `The configured Nx socket directory ${dir} cannot be the shared system temp directory. Pointing the Nx socket directory there is unsafe as another local user could connect to the daemon or plugin worker sockets and execute code in them. Set NX_SOCKET_DIR to a directory that only your user can access.`
    );
    this.name = 'InvalidSocketDirConfigured';
  }
}

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
 * All Nx sockets (daemon, forked processes, plugin workers) live under this
 * single stable root so that sandboxed environments (e.g. AI agent sandboxes)
 * can allow unix socket access with one predictable rule. See NX_TMP_DIR for
 * why a fixed /tmp path is used on POSIX. Windows named pipes are not subject
 * to filesystem sandboxing, so the OS temp dir is fine there.
 */
export const NX_SOCKET_ROOT_POSIX = join(NX_TMP_DIR_POSIX, 'sockets');

export const NX_SOCKET_ROOT = join(NX_TMP_DIR, 'sockets');

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

function pluginSocketDirName() {
  // Kept intentionally short (see notes above on socket path length limits) so
  // that the workspace-scoped plugin socket directory still leaves room for the
  // socket file name within the OS limit. Lives under the same stable socket
  // root as the daemon socket so a single sandbox allowlist entry covers both.
  const hash = createHash('sha256')
    .update(workspaceRoot.toLowerCase())
    .digest('hex')
    .substring(0, 8);
  return join(getNxSocketRoot(), `nx-${hash}`);
}

/**
 * We try to create a socket dir under the common socket root, but if it doesn't
 * work because for instance we don't have permissions, we create it in
 * DAEMON_DIR_FOR_CURRENT_WORKSPACE. Either way the directory is locked down to
 * the current user so that only they can reach the sockets inside it.
 */
export function getSocketDir() {
  const configuredDir =
    process.env.NX_SOCKET_DIR ?? process.env.NX_DAEMON_SOCKET_DIR;
  return createOwnerOnlySocketDir(
    configuredDir ?? socketDirName(),
    configuredDir === undefined
  );
}

/**
 * Plugin worker sockets get their own workspace-scoped directory under the
 * common socket root. They previously sat directly in the shared system temp
 * dir (which we cannot lock down); giving them an owner-only directory prevents
 * other local users from connecting to a plugin worker and executing code in it.
 */
export function getPluginSocketDir() {
  const configuredDir =
    process.env.NX_SOCKET_DIR ?? process.env.NX_DAEMON_SOCKET_DIR;
  return createOwnerOnlySocketDir(
    configuredDir ?? pluginSocketDirName(),
    configuredDir === undefined
  );
}

/**
 * @param dir the resolved socket directory to create and lock down.
 * @param usingDefaultRoot whether `dir` sits under the default stable socket
 *        root (i.e. NX_SOCKET_DIR / NX_DAEMON_SOCKET_DIR are unset). When true
 *        the shared root is made sticky + world-writable so other users on the
 *        machine can create their own owner-only socket dirs alongside this one.
 */
function createOwnerOnlySocketDir(
  dir: string,
  usingDefaultRoot: boolean
): string {
  // The system temp dir is usable by every account on the machine (it is
  // typically world-writable), so we can never lock it down to the current
  // user. Pointing the Nx socket dir there is invalid configuration, not a
  // recoverable failure: another local user could connect to the sockets
  // inside it and execute code in the daemon or a plugin worker. Fail loudly
  // instead of silently substituting a default. This check sits outside the
  // try below so the error propagates rather than being swallowed by the
  // permission-failure fallback.
  //
  // This compares against the *bare* system temp dir only. The default stable
  // socket root (NX_SOCKET_ROOT, e.g. /tmp/.nx/sockets) is a dedicated
  // subdirectory of it, not equal to it, so the default location never trips
  // this guard; and each socket dir is a further hashed subdirectory again, so
  // the sockets never sit directly in a world-shared location either.
  if (resolve(dir) === resolve(systemTmpDir)) {
    throw new InvalidSocketDirConfigured(dir);
  }

  try {
    // `mode` only applies to directories mkdirSync actually creates; a
    // pre-existing directory keeps its current permissions, so we still chmod
    // it below to guarantee the sockets inside are reachable only by their
    // owner.
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (usingDefaultRoot) {
      restrictSharedRootToSticky();
    }
    restrictToOwner(dir);
    return dir;
  } catch (e) {
    // A genuine fs failure (e.g. we lack permission to create the configured
    // dir) is recoverable: fall back to the owner-controlled workspace data dir
    // rather than a shared location, and lock it down as well. The lockdown is
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

/**
 * Make the shared socket root sticky + world-writable (0o1777, like /tmp
 * itself) so that other users on the machine can create their *own* owner-only
 * socket dirs beneath it. This only relaxes the shared *root*; each individual
 * socket dir underneath is still locked to its owner by restrictToOwner, so no
 * user can reach another user's sockets. Best-effort: chmod only succeeds for
 * the user that created the dir, and a failure must never stop us from
 * obtaining a socket dir. Windows named pipes are not filesystem-gated, so this
 * is a POSIX-only concern.
 */
function restrictSharedRootToSticky() {
  if (process.platform === 'win32') {
    return;
  }
  try {
    chmodSync(NX_TMP_DIR_POSIX, 0o1777);
    chmodSync(NX_SOCKET_ROOT_POSIX, 0o1777);
  } catch {}
}

export function removeSocketDir() {
  try {
    rmSync(getSocketDir(), { recursive: true, force: true });
  } catch (e) {}
}
