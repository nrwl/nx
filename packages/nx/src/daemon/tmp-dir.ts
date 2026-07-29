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
  ensureSafeSharedRoot,
  getUserSegment,
} from '../utils/owned-private-dir';
import { createHash } from 'crypto';
// Only used to *reject* it as a socket location; see InvalidSocketDirConfigured.
import { tmpdir as systemTmpDir } from 'tmp';
import { NATIVE_CACHE_ROOT } from '../native/native-file-cache-location';
import { NX_TMP_DIR } from '../utils/nx-tmp-dir';
import { workspaceRoot } from '../utils/workspace-root';

/**
 * Thrown when the socket dir resolves to a directory shared with other users on
 * the machine. Invalid configuration, not a recoverable failure.
 */
export class InvalidSocketDirConfigured extends Error {
  constructor(public readonly dir: string) {
    super(
      `The configured Nx socket directory ${dir} is shared with the other users on this machine. Nx locks the socket directory to a single user, so pointing it at a shared one both shuts every other user out of it and — until it does — lets another local user connect to the daemon or plugin worker sockets and execute code in them. Set NX_SOCKET_DIR to a directory that only your user can access.`
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
 * One stable root so a sandbox can allow unix socket access with a single rule.
 * Windows named pipes are not filesystem-gated, so the OS temp dir is fine.
 */
export const NX_SOCKET_ROOT = join(NX_TMP_DIR, 'sockets');

/**
 * Directories that may not *be* the socket directory. Every user can reach these,
 * and Nx locks the socket directory to one user — so naming one here would strip
 * a shared root of the world-writable, sticky mode the other users depend on.
 * Nx's own per-user directories live *under* them, which is the intended layout.
 */
const DIRS_TOO_SHARED_FOR_SOCKETS = [
  systemTmpDir,
  NX_TMP_DIR,
  NX_SOCKET_ROOT,
  NATIVE_CACHE_ROOT,
];

export function getNxSocketRoot(): string {
  return configuredSocketDir() ?? NX_SOCKET_ROOT;
}

/**
 * The configured socket dir, normalized. `resolve` strips a trailing slash,
 * which would otherwise defeat the `O_NOFOLLOW` guard downstream — this is the
 * one socket path built from user input rather than by `join`.
 *
 * `||` rather than `??`: an empty value means unset. An empty string survives
 * `??`, and `resolve('')` is the working directory — which `removeSocketDir`
 * then deletes recursively. `NX_SOCKET_DIR=` with no value is ordinary in a
 * .env file or a compose environment list.
 */
function configuredSocketDir(): string | undefined {
  const dir = process.env.NX_SOCKET_DIR || process.env.NX_DAEMON_SOCKET_DIR;
  return dir ? resolve(dir) : undefined;
}

/**
 * The per-user directory beneath the shared socket root — the level everything
 * else hangs off. Whoever runs Nx first on the machine owns the root above it,
 * but that root is verified sticky, so they cannot rename this directory aside
 * and substitute their own; and it is re-verified on every resolve, so one that
 * did get replaced is refused rather than nested into. It also stops two users
 * with the same checkout path colliding, and covers all of a user's workspaces
 * at once.
 *
 * Skipped on Windows, where it would cost without buying anything: there are no
 * mode bits for `ensureOwnedPrivateDir` to check, the OS temp dir is already
 * per-user, and the username appears in it — so repeating it overruns the socket
 * path length guard for ordinary account names.
 *
 * Not applied to an explicit NX_SOCKET_DIR, which names the socket directory
 * itself and is often set to escape a too-long default path.
 */
function userSocketRoot() {
  return process.platform === 'win32'
    ? getNxSocketRoot()
    : join(getNxSocketRoot(), getUserSegment());
}

function socketDirName() {
  const hasher = createHash('sha256');
  hasher.update(workspaceRoot.toLowerCase());
  hasher.update(String(process.pid));
  const unique = hasher.digest('hex').substring(0, 20);
  return join(userSocketRoot(), unique);
}

function pluginSocketDirName() {
  // Short so the socket file name still fits under assertValidSocketPath's limit.
  const hash = createHash('sha256')
    .update(workspaceRoot.toLowerCase())
    .digest('hex')
    .substring(0, 8);
  return join(userSocketRoot(), hash);
}

/**
 * A socket dir under the common root, falling back to the workspace data dir.
 * Either way it is locked to the current user.
 */
export function getSocketDir() {
  const configuredDir = configuredSocketDir();
  return createOwnerOnlySocketDir(
    configuredDir ?? socketDirName(),
    configuredDir === undefined
  );
}

/**
 * Plugin worker sockets get their own workspace-scoped directory rather than
 * sitting in the shared system temp dir, which cannot be locked down.
 */
export function getPluginSocketDir() {
  const configuredDir = configuredSocketDir();
  return createOwnerOnlySocketDir(
    configuredDir ?? pluginSocketDirName(),
    configuredDir === undefined
  );
}

/**
 * @param dir the resolved socket directory to create and lock down.
 * @param usingDefaultRoot whether `dir` sits under the default root, in which
 *        case the shared roots are relaxed so other users can coexist there.
 */
function createOwnerOnlySocketDir(
  dir: string,
  usingDefaultRoot: boolean
): string {
  // Outside the try so it is not swallowed by the fallback. Exact matches only,
  // so the per-user directories under those roots never trip it.
  if (DIRS_TOO_SHARED_FOR_SOCKETS.some((d) => resolve(dir) === resolve(d))) {
    throw new InvalidSocketDirConfigured(dir);
  }

  try {
    if (usingDefaultRoot) {
      // Outermost first, each on its own: paths under a root resolve every
      // level, so a symlink — or a world-writable root without the sticky bit
      // that stops a peer renaming entries out of it — compromises everything
      // below. The inner root is absent on a fresh machine.
      for (const root of [NX_TMP_DIR, NX_SOCKET_ROOT]) {
        if (!ensureSafeSharedRoot(root)) {
          throw new Error(
            `The Nx socket root ${root} is not a directory Nx can safely keep a private directory under.`
          );
        }
      }
      // The containment level: 0700 and ours, so a squatter is refused here
      // rather than becoming the parent of our socket directories.
      if (!ensureOwnedPrivateDir(userSocketRoot())) {
        throw new Error(
          `Nx could not establish ${userSocketRoot()} as a private directory owned by the current user.`
        );
      }
    } else {
      mkdirSync(dirname(dir), { recursive: true });
    }
    // Separately from its parents: mkdirSync does not throw on a pre-planted
    // symlink, so creating and locking down in one step would adopt it.
    if (!ensureOwnedPrivateDir(dir)) {
      throw new Error(
        `Nx could not establish ${dir} as a private directory owned by the current user.`
      );
    }
    return dir;
  } catch (e) {
    // Recoverable: fall back to the owner-controlled workspace data dir.
    if (!usingDefaultRoot) {
      // Never swap out a configured directory silently — the substitute is longer and
      // would resurface as assertValidSocketPath complaining about a path the user
      // never set.
      console.warn(
        `Nx could not use the configured socket directory ${dir}: ${
          e instanceof Error ? e.message : e
        }\nFalling back to ${DAEMON_DIR_FOR_CURRENT_WORKSPACE}.`
      );
    }
    mkdirSync(dirname(DAEMON_DIR_FOR_CURRENT_WORKSPACE), { recursive: true });
    // The fallback is only safe if it passes the same checks the primary did.
    if (!ensureOwnedPrivateDir(DAEMON_DIR_FOR_CURRENT_WORKSPACE)) {
      throw new Error(
        `Nx could not establish the fallback socket directory ${DAEMON_DIR_FOR_CURRENT_WORKSPACE} as a private directory owned by the current user.`,
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
