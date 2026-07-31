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
  sharedRootRemedy,
} from '../utils/owned-private-dir';
import { createHash } from 'crypto';
// Only used to *reject* it as a socket location; see InvalidSocketDirConfigured.
import { tmpdir as systemTmpDir } from 'tmp';
import { NATIVE_CACHE_ROOT } from '../native/native-file-cache-location';
import { NX_TMP_DIR, NX_USER_TMP_DIR } from '../utils/nx-tmp-dir';
import { workspaceRoot } from '../utils/workspace-root';

/**
 * Thrown when the socket dir resolves to a directory Nx will not accept.
 * Invalid configuration, not a recoverable failure.
 *
 * Two reasons, and they are not interchangeable: a directory other users can
 * reach is a security problem, while an Nx container or cache root is the user's
 * own and is refused because Nx manages what lives there. Telling someone their
 * own `0700` directory lets a local attacker execute code would be false.
 */
export class InvalidSocketDirConfigured extends Error {
  constructor(
    public readonly dir: string,
    sharedWithOtherUsers: boolean
  ) {
    super(
      sharedWithOtherUsers
        ? `The configured Nx socket directory ${dir} is shared with the other users on this machine. Nx locks the socket directory to a single user, so pointing it at a shared one both shuts every other user out of it and — until it does — lets another local user connect to the daemon or plugin worker sockets and execute code in them. Set NX_SOCKET_DIR to a directory that only your user can access.`
        : `The configured Nx socket directory ${dir} is a directory Nx manages for its own runtime state, and it locks down and cleans up everything beneath it. Point NX_SOCKET_DIR at a directory of your own instead — one nested beneath this root is fine.`
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
 * One short root beneath the current user's owner-only runtime directory. The
 * stable `/tmp/.nx` ancestor lets a POSIX sandbox allow unix socket access with
 * one team-wide rule, while the uid boundary keeps peers out.
 *
 * Neither reason applies on Windows: named pipes are not filesystem objects, so
 * there is nothing to allowlist or to lock down, and the OS temp dir is already
 * per-user. The extra `\.nx\sockets` would only spend 12 characters of the
 * 95-char budget `assertValidSocketPath` enforces — which it does on Windows too
 * — and the temp dir already contains the username, so long account names would
 * newly overrun it. Sockets go straight in the OS temp dir there, as before.
 */
function defaultSocketRoot(): string {
  return process.platform === 'win32'
    ? systemTmpDir
    : join(NX_USER_TMP_DIR, 'sockets');
}

/**
 * Directories that may not *be* the socket directory, and why. The system temp
 * directory and the stable container are reachable by other users; the rest are
 * the current user's own, refused because Nx manages their contents. Nx's actual
 * socket directories live under these roots.
 */
function dirsUnusableAsSocketDir(): { dir: string; shared: boolean }[] {
  return [
    { dir: systemTmpDir, shared: true },
    { dir: NX_TMP_DIR, shared: true },
    { dir: NX_USER_TMP_DIR, shared: false },
    { dir: defaultSocketRoot(), shared: false },
    { dir: NATIVE_CACHE_ROOT, shared: false },
  ];
}

export function getNxSocketRoot(): string {
  return configuredSocketDir() ?? defaultSocketRoot();
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

function socketDirName() {
  const hasher = createHash('sha256');
  hasher.update(workspaceRoot.toLowerCase());
  hasher.update(String(process.pid));
  const unique = hasher.digest('hex').substring(0, 20);
  return join(getNxSocketRoot(), unique);
}

function pluginSocketDirName() {
  // Short so the socket file name still fits under assertValidSocketPath's limit.
  const hash = createHash('sha256')
    .update(workspaceRoot.toLowerCase())
    .digest('hex')
    .substring(0, 8);
  return join(getNxSocketRoot(), hash);
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

let socketDirFallbackCause: unknown;

export function getSocketDirFallbackCause(): unknown {
  return socketDirFallbackCause;
}

/**
 * @param dir the resolved socket directory to create and lock down.
 * @param usingDefaultRoot whether `dir` sits under the default root, in which
 *        case Nx verifies the stable shared container and establishes the
 *        current user's owner-only roots first.
 */
function createOwnerOnlySocketDir(
  dir: string,
  usingDefaultRoot: boolean
): string {
  socketDirFallbackCause = undefined;

  // Outside the try so it is not swallowed by the fallback. Exact matches only,
  // so the per-user directories under those roots never trip it.
  const unusable = dirsUnusableAsSocketDir().find(
    (d) => resolve(dir) === resolve(d.dir)
  );
  if (unusable) {
    throw new InvalidSocketDirConfigured(dir, unusable.shared);
  }

  try {
    if (usingDefaultRoot) {
      if (process.platform !== 'win32') {
        // `/tmp/.nx` is the only shared level. A root-owned sticky instance lets
        // every user create their uid directory directly beneath it; if the first
        // user created it instead, it remains safe for that user and later users
        // refuse it rather than trusting a peer-owned parent.
        if (!ensureSafeSharedRoot(NX_TMP_DIR)) {
          throw new Error(
            [
              `The Nx temp root ${NX_TMP_DIR} is not a directory Nx can safely keep a private directory under.`,
              sharedRootRemedy(NX_TMP_DIR),
            ]
              .filter(Boolean)
              .join(' ')
          );
        }
        for (const root of [NX_USER_TMP_DIR, defaultSocketRoot()]) {
          if (!ensureOwnedPrivateDir(root)) {
            throw new Error(
              `Nx could not establish ${root} as a private directory owned by the current user.`
            );
          }
        }
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
    if (usingDefaultRoot) {
      socketDirFallbackCause = e;
      // Required lazily, and only on a path that is already failing. A static
      // import closes a cycle — utils/logger reads `serverLogger` from
      // daemon/logger while it is still evaluating, and daemon/logger imports
      // this module — which throws whenever `isOnDaemon()` is true as this
      // module loads. Production escapes it only because server.ts sets
      // `global.NX_DAEMON` after its imports, so daemon boot rests on import
      // order. Keeps this module to Node builtins, as owned-private-dir.ts and
      // nx-tmp-dir.ts deliberately are.
      const { logger } =
        require('../utils/logger') as typeof import('../utils/logger');
      logger.verbose(
        `Nx could not use the default socket directory ${dir}. Falling back to ${DAEMON_DIR_FOR_CURRENT_WORKSPACE}.`,
        e
      );
    } else {
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
