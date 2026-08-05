/**
 * Where the daemon, forked task processes and plugin workers put their sockets.
 *
 * Not `os.tmpdir()`, and not one location: the root is a literal `/tmp/.nx` so a
 * sandbox can allowlist it once, and resolution walks an ordered chain —
 * `$NX_SOCKET_DIR`, then `/tmp/.nx/<uid>/sockets`, then `~/.nx/sockets`, then the
 * workspace data dir. The socket directory beneath the winning root is per-run,
 * since its name hashes the pid; clients read the daemon's path back out of the
 * process cache rather than deriving it.
 *
 * Daemon logs are not here — they live in the workspace data dir alongside the
 * `disabled` marker, which is why that path survives a socket-root change.
 */
import {
  mkdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'path';
import { workspaceDataDirectory } from '../utils/cache-directory';
import {
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
  isPeerWritable,
  sharedRootRemedy,
} from '../utils/owned-private-dir';
import { createHash } from 'crypto';
// Refused as a socket *directory* (see InvalidSocketDirConfigured), and also
// the socket root itself on Windows, where named pipes are not filesystem
// objects and there is nothing to lock down beneath it.
import { tmpdir as systemTmpDir } from 'tmp';
import { NATIVE_CACHE_ROOT } from '../native/native-file-cache-location';
import {
  NX_HOME_TMP_DIR,
  NX_TMP_DIR,
  NX_USER_TMP_DIR,
} from '../utils/nx-tmp-dir';
import { isSandbox } from '../utils/is-sandbox';
import { workspaceRoot } from '../utils/workspace-root';

/**
 * Why a directory was refused. Named rather than a boolean so a table entry
 * reads as its own reason: picking the wrong one tells a user their private
 * directory is a code-execution risk, which is the one claim here that most
 * needs to be true.
 */
export type SocketDirRefusal =
  | 'shared-with-other-users'
  | 'nx-managed'
  | 'os-temp-root';

/**
 * Thrown when the socket dir resolves to a directory Nx will not accept.
 * Invalid configuration, not a recoverable failure.
 *
 * Three reasons, and they are not interchangeable. A directory other users can
 * reach is a security problem; the OS temp root is the user's own but holds
 * everything else that uses it, and Nx deletes the socket directory
 * recursively; an Nx container or cache root is refused because Nx manages what
 * lives there. Telling someone their own `0700` directory lets a local attacker
 * execute code would be false, which is why the reason is derived from the
 * directory rather than the platform.
 */
export class InvalidSocketDirConfigured extends Error {
  constructor(
    public readonly dir: string,
    public readonly reason: SocketDirRefusal
  ) {
    super(
      reason === 'shared-with-other-users'
        ? `The configured Nx socket directory ${dir} is shared with the other users on this machine. Nx locks the socket directory to a single user, so pointing it at a shared one both shuts every other user out of it and — until it does — lets another local user connect to the daemon or plugin worker sockets and execute code in them. Set NX_SOCKET_DIR to a directory that only your user can access.`
        : reason === 'os-temp-root'
          ? // Two claims deliberately absent. "the temp files of everything else
            // on the machine" is false here: this reason is chosen when the
            // root is *not* peer-writable, so what it holds is this account's
            // own. And "Nx already puts its sockets in a subdirectory of this
            // root" is false on POSIX, where the default root is a literal
            // /tmp/.nx and this one is os.tmpdir() — which is exactly when the
            // two differ.
            `The configured Nx socket directory ${dir} is the operating system temp directory. Nx deletes the socket directory and everything in it when the daemon stops, which here would take everything else using this temp directory with it. Point NX_SOCKET_DIR at a directory of your own instead — one nested beneath this root is fine.`
          : `The configured Nx socket directory ${dir} is a directory Nx keeps its own runtime state in, and Nx creates and removes socket directories beneath it. Point NX_SOCKET_DIR at a directory of your own instead — one nested beneath this root is fine.`
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
 * The spelling to compare a directory by. `resolve` alone normalizes `..` and
 * trailing slashes but does not dereference symlinks, and on macOS `/tmp` *is* a
 * symlink to `/private/tmp` — so `/private/tmp/.nx` is the same directory as
 * `/tmp/.nx` under a spelling an exact-match list would wave through, after
 * which `ensureOwnedPrivateDir` re-locks the shared container to `0700` and
 * `removeSocketDir` aims a recursive delete at it.
 *
 * Resolves the longest ancestor that exists and re-appends the rest, because
 * both sides of the comparison go through here and **Nx's own roots are absent
 * before its first run** — the system temp dir always exists, but `/tmp/.nx`,
 * `~/.nx` and the cache roots do not. Canonicalizing only whole existing paths
 * would leave the check degraded to the exact string match it replaced on
 * precisely a fresh machine, where `/tmp/.nx` does not exist yet but `/tmp`
 * already resolves to `/private/tmp`.
 *
 * Only `ENOENT` walks up. `ELOOP`, `ENOTDIR` and `EACCES` mean the path exists
 * and cannot be read through, and inventing a spelling for it would be a guess;
 * the normalized form is returned as a best effort. That is a soft edge, and it
 * is tolerable only because this decides a refusal *message*, never containment
 * — which `lstat` and `O_NOFOLLOW` re-establish downstream regardless.
 */
function canonicalDir(dir: string): string {
  const resolved = resolve(dir);
  const missing: string[] = [];
  let candidate = resolved;

  for (;;) {
    try {
      return join(realpathSync(candidate), ...missing);
    } catch (e: any) {
      if (e?.code !== 'ENOENT') {
        return resolved;
      }
      const parent = dirname(candidate);
      if (parent === candidate) {
        return resolved;
      }
      missing.unshift(basename(candidate));
      candidate = parent;
    }
  }
}

/**
 * Whether `~/.nx` is somewhere other than the shared container.
 *
 * With `HOME=/tmp` they are the same path, and offering it as a second tier
 * would point `ensureOwnedPrivateDir` at `/tmp/.nx` itself the moment tier 1
 * fails. That only rewrites the container when the directory is already ours —
 * against a root-owned one it means Nx is running as root — but there it takes
 * a `1777` container to `0700`, silently undoing the documented provisioning,
 * dropping every other user's native cache, and breaking a sandbox allowlist
 * scoped to that path. Nothing puts it back.
 *
 * Other users are not stopped by `isSafeSharedRoot`: it exempts uid 0, and
 * `0700` carries no group or other write, so a root-owned container passes both
 * clauses. They get as far as creating their own directory beneath it and fail
 * there with EACCES.
 *
 * It is also the path `InvalidSocketDirConfigured` refuses when set explicitly,
 * so auto-selecting it would contradict a rule Nx enforces one function away.
 */
function homeTierIsDistinct(): boolean {
  if (!NX_HOME_TMP_DIR) {
    return false;
  }
  return ![
    systemTmpDir,
    NX_TMP_DIR,
    NX_USER_TMP_DIR,
    defaultSocketRoot(),
    NATIVE_CACHE_ROOT,
  ].some((shared) => canonicalDir(shared) === canonicalDir(NX_HOME_TMP_DIR));
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
    // Omitted entirely when there is no home directory to use, or when it is
    // the shared container under another name, rather than offered and then
    // damaging what it lands on.
    ...(homeTierIsDistinct() && homeSocketRoot()
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
function establishSocketRoot():
  | { root: string; preferred?: string }
  | undefined {
  const tiers = socketRootTiers();
  for (const [index, tier] of tiers.entries()) {
    if (tier.establish()) {
      // `preferred` is set only on a demotion, and names the tier that was
      // skipped — the caller records it so a later length failure can say the
      // path was not the one Nx wanted.
      return index === 0
        ? { root: tier.root }
        : { root: tier.root, preferred: tiers[0].root };
    }
  }
  return undefined;
}

/**
 * Directories that may not *be* the socket directory, and why. Every one is
 * either a root Nx manages the contents of or the OS temp root itself; whether
 * other users can also reach one is a separate question, answered per directory
 * because the answer differs by platform. Nx's actual socket directories live
 * under these roots.
 */
function dirsUnusableAsSocketDir(): {
  dir: string;
  reason: SocketDirRefusal;
}[] {
  const onWindows = process.platform === 'win32';
  return [
    // Keyed on the directory, not the platform. `os.tmpdir()` is a
    // world-writable `/tmp` on Linux, but a private `0700` `/var/folders/…` on
    // macOS and a per-account path on Windows — so a platform test tells most
    // macOS users their own private directory lets a local attacker execute
    // code in their daemon. It is still refused when it is nobody else's:
    // a configured directory becomes the socket directory itself rather than
    // getting a subdirectory, and `removeSocketDir` deletes that recursively
    // when the daemon stops — here, the user's whole temp directory.
    {
      dir: systemTmpDir,
      reason: isPeerWritable(systemTmpDir)
        ? 'shared-with-other-users'
        : 'os-temp-root',
    },
    // Same test, different fallback: this root is Nx's own, so when peers
    // cannot reach it the honest reason is that Nx manages it.
    {
      dir: NX_TMP_DIR,
      reason: isPeerWritable(NX_TMP_DIR)
        ? 'shared-with-other-users'
        : 'nx-managed',
    },
    { dir: NX_USER_TMP_DIR, reason: 'nx-managed' },
    { dir: defaultSocketRoot(), reason: 'nx-managed' },
    // Skipped on Windows, where `socketRootTiers()` offers a single tier and
    // the home location is never reached, so refusing it explains a rule that
    // does not apply there.
    ...(!onWindows && NX_HOME_TMP_DIR
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

  // Cleared here as well as in createOwnerOnlySocketDir: the no-tier exit below
  // returns without ever entering it, and a value left from an earlier
  // resolution would have assertValidSocketPath blame an NX_SOCKET_DIR the user
  // no longer has set while suppressing the advice that is correct there.
  socketDirFallbackCause = undefined;
  refusedConfiguredSocketDir = undefined;

  const established = establishSocketRoot();
  if (established === undefined) {
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
  const dir = createOwnerOnlySocketDir(leafFor(established.root), true);
  // Only when the directory we actually got is the demoted tier: if
  // createOwnerOnlySocketDir fell back to the workspace, it recorded its own,
  // more specific cause and that one should survive.
  if (
    established.preferred !== undefined &&
    socketDirFallbackCause === undefined
  ) {
    noteSocketRootDemotion(established.preferred, established.root);
  }
  return dir;
}

/**
 * Record a successful demotion to a later tier.
 *
 * Silence is the right default for a demotion that works — nothing failed from
 * the user's point of view. The one cost is that `assertValidSocketPath` keys
 * its "Nx fell back to … run with --verbose" block off this cause, so without
 * it a socket-length failure on a later tier is explained as though the user
 * had chosen the path. They have not — this function only runs when
 * `configuredSocketDir()` returned undefined — so what the generic advice omits
 * is the demotion itself, which is the part they would need to know to act.
 * Recording it also gives `--verbose` something to print, which that message
 * promises.
 */
function noteSocketRootDemotion(preferred: string, used: string) {
  socketDirFallbackCause = new Error(
    `Nx could not establish its preferred socket root ${preferred}, so it used ${used}.`
  );
  // Lazily required for the import-cycle reason spelled out in
  // fallBackToWorkspaceSocketDir below.
  const { logger } =
    require('../utils/logger') as typeof import('../utils/logger');
  logger.verbose(
    `Nx could not use the default socket directory ${preferred}. Using ${used} instead.`
  );
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
let warnedAboutWorkspaceFallback = false;
let warnedAboutConfiguredSocketDir = false;

/**
 * Exported for tests: both fallback warnings fire once per process, so a suite
 * that stages either fallback more than once has to clear the latches between
 * cases.
 */
export function resetSocketDirWarningsForTesting() {
  warnedAboutWorkspaceFallback = false;
  warnedAboutConfiguredSocketDir = false;
}

export function getSocketDirFallbackCause(): unknown {
  return socketDirFallbackCause;
}

/**
 * The NX_SOCKET_DIR that was refused, if that is why we are in the fallback.
 * Reflects the most recent resolution only — both accessors are cleared at the
 * top of every `createOwnerOnlySocketDir` call, and the daemon and plugin socket
 * paths each drive one. Read it immediately after the call that produced the
 * path, which is what `assertValidSocketPath` does.
 */
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
  const canonical = canonicalDir(dir);
  const unusable = dirsUnusableAsSocketDir().find(
    (d) => canonical === canonicalDir(d.dir)
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
    // Latched like the workspace-fallback warning below, and for the same
    // reason: a task-per-PseudoTerminal command resolves this once per task.
    if (!warnedAboutConfiguredSocketDir) {
      warnedAboutConfiguredSocketDir = true;
      console.warn(
        `Nx could not use the configured socket directory ${dir}: ${
          e instanceof Error ? e.message : e
        }\nFalling back to ${DAEMON_DIR_FOR_CURRENT_WORKSPACE}.`
      );
    }
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
  // its imports, so daemon boot rests on import order.
  const { logger } =
    require('../utils/logger') as typeof import('../utils/logger');
  logger.verbose(
    `Nx could not use the default socket ${
      attempted ? `directory ${attempted}` : 'directories'
    }. Falling back to ${DAEMON_DIR_FOR_CURRENT_WORKSPACE}.`,
    cause
  );
  // Warned, not just logged verbosely. A demotion between the default roots is
  // silent on purpose — nothing is broken. Landing in the workspace is
  // different in kind: the path grows with checkout depth, so this is where the
  // 95-character socket budget is most likely to trip, and anything that
  // allowed Nx's usual roots by path no longer covers where the sockets went.
  //
  // Once per process. Neither socket-dir accessor is memoized, and one CLI
  // process resolves several — the daemon socket, one per spawned plugin
  // worker, one per `PseudoTerminal` — so without the latch a single command
  // repeats an identical three-sentence warning many times over. (Workers are
  // separate processes with their own module instance and their own latch; the
  // repetition this removes is the within-process one.) The verbose line above
  // can repeat because it is a no-op by default; this cannot.
  //
  // The allowlist line is gated on `isSandbox()`. This path is reached far more
  // often for ordinary reasons — a peer owning the shared container, a
  // read-only home — and naming a sandbox unprompted is what the socket
  // guidance was corrected for once already. Gated, it reaches the people it
  // describes and nobody else.
  if (!warnedAboutWorkspaceFallback) {
    warnedAboutWorkspaceFallback = true;
    logger.warn(
      [
        `Nx could not use any of its usual socket directories and fell back to ${DAEMON_DIR_FOR_CURRENT_WORKSPACE}.`,
        sharedRootRemedy(NX_TMP_DIR),
        isSandbox()
          ? // Built from the roots that exist: NX_HOME_TMP_DIR is undefined
            // when there is no home directory, which is itself one of the
            // reasons this fallback is reached.
            `A sandbox allowlist covering only ${[NX_TMP_DIR, NX_HOME_TMP_DIR]
              .filter(Boolean)
              .join(' or ')} does not cover this path.`
          : undefined,
        'Run with --verbose to see why the others were rejected.',
      ]
        .filter(Boolean)
        .join(' ')
    );
  }
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
