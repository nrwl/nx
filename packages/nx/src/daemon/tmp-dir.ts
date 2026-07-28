/**
 * Per workspace (to avoid subtle differences and issues), we want to have a deterministic
 * location within the OS's tmp directory where we write log files for background processes
 * and where we create the actual unix socket/named pipe for the daemon.
 */
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'path';
import { workspaceDataDirectory } from '../utils/cache-directory';
import {
  ensureOwnedPrivateDir,
  getUserSegment,
  isRealDirectoryOrAbsent,
  relaxSharedRootToSticky,
} from '../utils/owned-private-dir';
import { createHash } from 'crypto';
// The shared OS temp dir. Only used to *reject* it as a socket location (see
// InvalidSocketDirConfigured); the sockets themselves live under NX_SOCKET_ROOT.
import { tmpdir as systemTmpDir } from 'tmp';
import { NX_TMP_DIR } from '../utils/nx-tmp-dir';
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
    // Kept intentionally short to stay under the socket/named pipe path length
    // limit enforced by `assertValidSocketPath` in socket-utils.ts.
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
export const NX_SOCKET_ROOT = join(NX_TMP_DIR, 'sockets');

export function getNxSocketRoot(): string {
  return (
    process.env.NX_SOCKET_DIR ??
    process.env.NX_DAEMON_SOCKET_DIR ??
    NX_SOCKET_ROOT
  );
}

/**
 * The per-user directory beneath the shared socket root, and the level that
 * actually contains one user from another.
 *
 * The shared roots above it are world-writable by design, so whoever runs Nx
 * first on a machine creates them — without this level that user would own the
 * *parent* of every other user's socket directory, and could rename it aside
 * and substitute their own. Owning this level ourselves means a squatter is
 * caught by `ensureOwnedPrivateDir`'s uid check and we fail closed instead of
 * nesting silently inside a directory someone else controls.
 *
 * It also removes a collision that needs no attacker at all: the plugin socket
 * directory is named from the workspace root alone, so two users with the same
 * checkout path (`/workspace` in containers is the common case) previously
 * landed on the same directory and the second one was locked out.
 *
 * Not applied to an explicitly configured NX_SOCKET_DIR: that variable names the
 * socket directory itself, the user chose it, and it is often set precisely to
 * escape a too-long default path.
 */
function userSocketRoot() {
  return join(getNxSocketRoot(), getUserSegment());
}

function socketDirName() {
  const hasher = createHash('sha256');
  hasher.update(workspaceRoot.toLowerCase());
  hasher.update(String(process.pid));
  const unique = hasher.digest('hex').substring(0, 20);
  return join(userSocketRoot(), unique);
}

function pluginSocketDirName() {
  // Kept intentionally short (the limit is enforced by `assertValidSocketPath`
  // in socket-utils.ts) so that the workspace-scoped plugin socket directory
  // still leaves room for the socket file name. Lives under the same stable socket
  // root as the daemon socket so a single sandbox allowlist entry covers both.
  const hash = createHash('sha256')
    .update(workspaceRoot.toLowerCase())
    .digest('hex')
    .substring(0, 8);
  return join(userSocketRoot(), `nx-${hash}`);
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
    if (usingDefaultRoot) {
      // Verify *every* shared root before creating anything beneath it.
      // O_NOFOLLOW only protects the component it is handed; the mkdirSync
      // below, and every path built under these roots, resolve them normally —
      // so a symlink planted at either level tunnels our sockets into a
      // directory the attacker chose. Checking only the outer level would leave
      // the inner one, which is the level that does not exist yet on a fresh
      // machine and is therefore the easy one to plant.
      for (const root of [NX_TMP_DIR, NX_SOCKET_ROOT]) {
        if (!isRealDirectoryOrAbsent(root)) {
          throw new Error(
            `The Nx socket root ${root} exists but is not a real directory.`
          );
        }
      }
      // Deliberately world-writable, so that every user logged in to the
      // machine can create their own per-uid directory beneath them.
      mkdirSync(NX_SOCKET_ROOT, { recursive: true });
      relaxSharedRootToSticky(NX_TMP_DIR);
      relaxSharedRootToSticky(NX_SOCKET_ROOT);
      // The containment level. Owned by us and 0700, so no other user owns the
      // parent of our socket directories — and a squatter is refused here
      // rather than silently becoming that parent.
      if (!ensureOwnedPrivateDir(userSocketRoot())) {
        throw new Error(
          `The Nx socket directory ${userSocketRoot()} is not a directory owned solely by the current user.`
        );
      }
    } else {
      mkdirSync(dirname(dir), { recursive: true });
    }
    // The leaf is created and verified separately rather than by a recursive
    // mkdir: `mkdirSync` does not throw on a pre-planted symlink, so creating
    // and locking down in one step would adopt it.
    if (!ensureOwnedPrivateDir(dir)) {
      throw new Error(
        `The Nx socket directory ${dir} is not a directory owned solely by the current user.`
      );
    }
    return dir;
  } catch (e) {
    // A genuine fs failure (e.g. we lack permission to create the configured
    // dir), or a leaf we refused above, is recoverable: fall back to the
    // owner-controlled workspace data dir rather than a shared location.
    if (!usingDefaultRoot) {
      // Never substitute an explicitly configured directory in silence. The
      // docs point users at NX_SOCKET_DIR to escape a too-long default path,
      // and the substitute is longer — so a quiet swap surfaces later as
      // assertValidSocketPath complaining about a path the user never set.
      console.warn(
        `Nx could not use the configured socket directory ${dir}: ${
          e instanceof Error ? e.message : e
        }\nFalling back to ${DAEMON_DIR_FOR_CURRENT_WORKSPACE}.`
      );
    }
    mkdirSync(dirname(DAEMON_DIR_FOR_CURRENT_WORKSPACE), { recursive: true });
    // Honour the verdict rather than adopting a directory we just refused —
    // the fallback is only safe if it passes the same checks the primary did.
    if (!ensureOwnedPrivateDir(DAEMON_DIR_FOR_CURRENT_WORKSPACE)) {
      throw new Error(
        `The Nx socket directory fallback ${DAEMON_DIR_FOR_CURRENT_WORKSPACE} is not a directory owned solely by the current user.`,
        { cause: e }
      );
    }
    return DAEMON_DIR_FOR_CURRENT_WORKSPACE;
  }
}

export function removeSocketDir() {
  try {
    rmSync(getSocketDir(), { recursive: true, force: true });
  } catch (e) {}
}
