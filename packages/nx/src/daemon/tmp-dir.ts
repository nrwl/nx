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
import {
  NX_HOME_TMP_DIR,
  NX_TMP_DIR,
  NX_USER_TMP_DIR,
} from '../utils/nx-tmp-dir';
import { workspaceRoot } from '../utils/workspace-root';

/**
 * Why a directory was refused. Named rather than a boolean so a table entry
 * reads as its own reason: picking the wrong one tells a user their private
 * directory is a code-execution risk, which is the one claim here that most
 * needs to be true.
 */
export type SocketDirRefusal = 'shared-with-other-users' | 'nx-managed';

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
    public readonly reason: SocketDirRefusal
  ) {
    super(
      reason === 'shared-with-other-users'
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

function homeSocketRoot(): string | undefined {
  return NX_HOME_TMP_DIR ? join(NX_HOME_TMP_DIR, 'sockets') : undefined;
}

/**
 * Socket roots to try, best first. Each entry establishes its own containment
 * before it can be used; the first that succeeds wins, and the workspace data
 * dir is the last resort when none does.
 *
 * `/tmp` first because it is the shortest path — the socket path budget is 95
 * characters — and is cleared on reboot. Home second because it needs no
 * administrator: a peer who created `/tmp/.nx` first locks everyone else out of
 * the shared container, and before this chain that dropped straight to the
 * workspace, whose path grows with checkout depth.
 *
 * Windows has one tier. Named pipes are not filesystem objects, so there is no
 * containment to establish and nothing a second location would buy.
 */
function socketRootTiers(): { root: string; establish: () => boolean }[] {
  if (process.platform === 'win32') {
    return [{ root: systemTmpDir, establish: () => true }];
  }
  return [
    {
      root: defaultSocketRoot(),
      establish: () =>
        ensureSafeSharedRoot(NX_TMP_DIR) &&
        // Arrow rather than a bare reference: `every` passes the index too, and
        // these guards take only a path.
        [NX_USER_TMP_DIR, defaultSocketRoot()].every((d) =>
          ensureOwnedPrivateDir(d)
        ),
    },
    // Omitted entirely when there is no home directory to use, rather than
    // offered and then failing its guards.
    ...(NX_HOME_TMP_DIR && homeSocketRoot()
      ? [
          {
            root: homeSocketRoot(),
            // No shared level to verify: the home directory is the user's own,
            // so there is no container another user could have created first.
            establish: () =>
              [NX_HOME_TMP_DIR, homeSocketRoot()].every((d) =>
                ensureOwnedPrivateDir(d)
              ),
          },
        ]
      : []),
  ];
}

/**
 * The first socket root whose containment could be established, or `undefined`
 * when none could and the caller should fall back to the workspace.
 */
function establishSocketRoot(): string | undefined {
  for (const tier of socketRootTiers()) {
    if (tier.establish()) {
      return tier.root;
    }
  }
  return undefined;
}

/**
 * Directories that may not *be* the socket directory, and why. The system temp
 * directory and the stable container are reachable by other users; the rest are
 * the current user's own, refused because Nx manages their contents. Nx's actual
 * socket directories live under these roots.
 */
function dirsUnusableAsSocketDir(): {
  dir: string;
  reason: SocketDirRefusal;
}[] {
  // Both of the top two are per-user on Windows — `%TMP%` is per-account and
  // NX_TMP_DIR sits inside it — so the shared-directory warning would be false
  // there. They are still refused, just for the other reason.
  const outermost: SocketDirRefusal =
    process.platform === 'win32' ? 'nx-managed' : 'shared-with-other-users';
  return [
    { dir: systemTmpDir, reason: outermost },
    { dir: NX_TMP_DIR, reason: outermost },
    { dir: NX_USER_TMP_DIR, reason: 'nx-managed' },
    { dir: defaultSocketRoot(), reason: 'nx-managed' },
    ...(NX_HOME_TMP_DIR
      ? [
          { dir: NX_HOME_TMP_DIR, reason: 'nx-managed' as const },
          { dir: homeSocketRoot(), reason: 'nx-managed' as const },
        ]
      : []),
    { dir: NATIVE_CACHE_ROOT, reason: 'nx-managed' },
  ];
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

function socketDirName(root: string) {
  const hasher = createHash('sha256');
  hasher.update(workspaceRoot.toLowerCase());
  hasher.update(String(process.pid));
  const unique = hasher.digest('hex').substring(0, 20);
  return join(root, unique);
}

function pluginSocketDirName(root: string) {
  // Short so the socket file name still fits under assertValidSocketPath's limit.
  const hash = createHash('sha256')
    .update(workspaceRoot.toLowerCase())
    .digest('hex')
    .substring(0, 8);
  return join(root, hash);
}

/**
 * A socket dir under the first usable root, falling back to the workspace data
 * dir when no root can be established. Either way it is locked to the current
 * user.
 */
function socketDirUnderFirstUsableRoot(
  leafFor: (root: string) => string
): string {
  const configuredDir = configuredSocketDir();
  if (configuredDir !== undefined) {
    return createOwnerOnlySocketDir(configuredDir, false);
  }

  const root = establishSocketRoot();
  if (root === undefined) {
    return fallBackToWorkspaceSocketDir(
      new Error(
        [
          `Nx could not establish any of its default socket directories (${socketRootTiers()
            .map((t) => t.root)
            .join(', ')}).`,
          sharedRootRemedy(NX_TMP_DIR),
        ]
          .filter(Boolean)
          .join(' ')
      )
    );
  }
  return createOwnerOnlySocketDir(leafFor(root), true);
}

export function getSocketDir() {
  return socketDirUnderFirstUsableRoot(socketDirName);
}

/**
 * Plugin worker sockets get their own workspace-scoped directory rather than
 * sitting in the shared system temp dir, which cannot be locked down.
 */
export function getPluginSocketDir() {
  return socketDirUnderFirstUsableRoot(pluginSocketDirName);
}

let socketDirFallbackCause: unknown;
let refusedConfiguredSocketDir: string | undefined;

export function getSocketDirFallbackCause(): unknown {
  return socketDirFallbackCause;
}

/** The NX_SOCKET_DIR that was refused, if that is why we are in the fallback. */
export function getRefusedConfiguredSocketDir(): string | undefined {
  return refusedConfiguredSocketDir;
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
  refusedConfiguredSocketDir = undefined;

  // Outside the try so it is not swallowed by the fallback. Exact matches only,
  // so the per-user directories under those roots never trip it.
  const unusable = dirsUnusableAsSocketDir().find(
    (d) => resolve(dir) === resolve(d.dir)
  );
  if (unusable) {
    throw new InvalidSocketDirConfigured(dir, unusable.reason);
  }

  try {
    // A default root has already had its containment established by the tier it
    // came from; a configured one is the user's to create.
    if (!usingDefaultRoot) {
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
      return fallBackToWorkspaceSocketDir(e, dir);
    }
    // Never swap out a configured directory silently — the substitute is longer and
    // would resurface as assertValidSocketPath complaining about a path the user
    // never set.
    console.warn(
      `Nx could not use the configured socket directory ${dir}: ${
        e instanceof Error ? e.message : e
      }\nFalling back to ${DAEMON_DIR_FOR_CURRENT_WORKSPACE}.`
    );
    // Tracked separately from socketDirFallbackCause: this is not a default-root
    // fallback, and describing it as one would be false. It exists so the length
    // error can stop telling someone to set a shorter NX_SOCKET_DIR when the one
    // they set was refused for a reason that has nothing to do with length.
    refusedConfiguredSocketDir = dir;
    return establishWorkspaceSocketDir(e);
  }
}

/**
 * The last resort once no default root could be used. Retains the cause so
 * `assertValidSocketPath` can explain a length failure the user did not cause.
 */
function fallBackToWorkspaceSocketDir(cause: unknown, attempted?: string) {
  socketDirFallbackCause = cause;
  // Required lazily, and only on a path that is already failing. A static
  // import closes a cycle — utils/logger reads `serverLogger` from
  // daemon/logger while it is still evaluating, and daemon/logger imports this
  // module — which throws whenever `isOnDaemon()` is true as this module loads.
  // Production escapes it only because server.ts sets `global.NX_DAEMON` after
  // its imports, so daemon boot rests on import order. Keeps this module to Node
  // builtins, as owned-private-dir.ts and nx-tmp-dir.ts deliberately are.
  const { logger } =
    require('../utils/logger') as typeof import('../utils/logger');
  logger.verbose(
    `Nx could not use the default socket ${
      attempted ? `directory ${attempted}` : 'directories'
    }. Falling back to ${DAEMON_DIR_FOR_CURRENT_WORKSPACE}.`,
    cause
  );
  return establishWorkspaceSocketDir(cause);
}

function establishWorkspaceSocketDir(cause: unknown): string {
  mkdirSync(dirname(DAEMON_DIR_FOR_CURRENT_WORKSPACE), { recursive: true });
  // The fallback is only safe if it passes the same checks the primary did.
  if (!ensureOwnedPrivateDir(DAEMON_DIR_FOR_CURRENT_WORKSPACE)) {
    throw new Error(
      `Nx could not establish the fallback socket directory ${DAEMON_DIR_FOR_CURRENT_WORKSPACE} as a private directory owned by the current user.`,
      { cause }
    );
  }
  return DAEMON_DIR_FOR_CURRENT_WORKSPACE;
}

export function removeSocketDir() {
  try {
    rmSync(getSocketDir(), { recursive: true, force: true });
  } catch (e) {}
}
