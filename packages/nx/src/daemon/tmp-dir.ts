/**
 * Where the daemon, forked task processes, plugin workers and Nx Console put
 * their sockets.
 *
 * Resolution itself lives in the native crate, in `native/utils/socket_path.rs`.
 * It has to: the root is picked at runtime from an ordered chain that can
 * demote, so a second derivation cannot track it, and Nx Console binds the
 * socket Nx dials. What stays here is the wording and the once-per-process
 * latches, because the logger is here.
 *
 * Daemon logs are not here — they live in the workspace data dir alongside the
 * `disabled` marker, which is why that path survives a socket-root change.
 */
import { rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'path';
import { workspaceDataDirectory } from '../utils/cache-directory';
import {
  resolveDaemonSocketPath,
  resolveForkedProcessSocketPath,
  resolveNxConsoleSocketPath,
  resolvePluginSocketPath,
  type SocketDirDetails,
} from '../native';
import { NX_HOME_TMP_DIR, NX_TMP_DIR } from '../utils/nx-tmp-dir';
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
            // /tmp/.nx and this one is the OS temp dir — which is exactly when
            // the two differ.
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

export function writeDaemonLogs(error?: string) {
  const file = join(DAEMON_DIR_FOR_CURRENT_WORKSPACE, 'daemon-error.log');
  writeFileSync(file, error);
  return file;
}

export function markDaemonAsDisabled(reason: string) {
  writeFileSync(join(DAEMON_DIR_FOR_CURRENT_WORKSPACE, 'disabled'), reason);
}

let disabledForThisProcess: string | undefined;

/**
 * Turns the daemon off for this process only, leaving no marker behind.
 *
 * For a cause that belongs to the environment rather than to the workspace: a
 * sandbox refusing the socket says nothing about the next run from an ordinary
 * terminal, and the marker `markDaemonAsDisabled` writes would follow the
 * checkout there. It would also survive the user doing exactly what Nx told
 * them to do, since nothing clears it but `nx reset`.
 */
export function disableDaemonForThisProcess(reason: string) {
  disabledForThisProcess = reason;
}

export function isDaemonDisabled() {
  if (disabledForThisProcess !== undefined) {
    return true;
  }
  try {
    statSync(join(DAEMON_DIR_FOR_CURRENT_WORKSPACE, 'disabled'));
    return true;
  } catch (e) {
    return false;
  }
}

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

/**
 * Required lazily, and only where something is being reported. A static import
 * closes a cycle — utils/logger reads `serverLogger` from daemon/logger while it
 * is still evaluating, and daemon/logger imports this module — which throws
 * whenever `isOnDaemon()` is true as this module loads. Production escapes it
 * only because server.ts sets `global.NX_DAEMON` after its imports, so daemon
 * boot rests on import order.
 */
function lazyLogger() {
  return (require('../utils/logger') as typeof import('../utils/logger'))
    .logger;
}

/**
 * Report one resolution and hand back its path — a directory for the daemon and
 * plugin sockets, the socket file itself for Nx Console. The native side decides
 * where it is and why; every sentence about it is written here.
 */
function adopt(details: SocketDirDetails): string {
  if (details.invalidReason) {
    throw new InvalidSocketDirConfigured(
      details.path,
      details.invalidReason as SocketDirRefusal
    );
  }

  if (details.refusedConfiguredDir !== undefined) {
    // Never swap out a configured directory silently — the substitute is longer
    // and would resurface as a length complaint about a path the user never set.
    // Latched: a task-per-PseudoTerminal command resolves this once per task.
    if (!warnedAboutConfiguredSocketDir) {
      warnedAboutConfiguredSocketDir = true;
      console.warn(
        `Nx could not use the configured socket directory ${details.refusedConfiguredDir}: ${details.refusalError}\nFalling back to ${details.path}.`
      );
    }
    return assertWithinBudget(details);
  }

  if (details.usedWorkspaceFallback) {
    const logger = lazyLogger();
    logger.verbose(
      `Nx could not use the default socket ${
        details.attemptedDir
          ? `directory ${details.attemptedDir}`
          : 'directories'
      }. Falling back to ${details.path}.`,
      fallbackCause(details)
    );
    // Warned rather than verbose: the workspace path grows with checkout depth,
    // so this is where the 95-character budget is most likely to trip, and an
    // allowlist scoped to Nx's usual roots no longer covers it.
    //
    // Latched once per process — neither socket-dir accessor is memoized and one
    // CLI process resolves several, so without it a single command repeats this
    // many times.
    if (!warnedAboutWorkspaceFallback) {
      warnedAboutWorkspaceFallback = true;
      logger.warn(
        [
          `Nx could not use any of its usual socket directories and fell back to ${details.path}.`,
          ...details.remedies,
          isSandbox()
            ? // NX_HOME_TMP_DIR is undefined when there is no home directory,
              // which is itself one reason this fallback is reached.
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
    return assertWithinBudget(details);
  }

  if (details.demotedFrom !== undefined) {
    // Verbose, not warn: nothing failed.
    lazyLogger().verbose(
      `Nx could not use the default socket directory ${details.demotedFrom}. Using ${details.path} instead.` +
        (details.refusalDetails ? ` ${details.refusalDetails}.` : '')
    );
  }

  return assertWithinBudget(details);
}

/**
 * Why this is not the preferred location, or `undefined` when it is. Kept as
 * the error's `cause` so `--verbose` can show what the sentence summarizes.
 */
function fallbackCause(details: SocketDirDetails): Error | undefined {
  if (details.refusalError !== undefined) {
    return new Error(details.refusalError);
  }
  if (details.usedWorkspaceFallback) {
    return new Error(
      `Nx could not establish any of its default socket directories${
        details.refusalDetails ? `: ${details.refusalDetails}` : ''
      }.`
    );
  }
  if (details.demotedFrom !== undefined) {
    return new Error(
      `Nx could not establish its preferred socket root ${details.demotedFrom}, so it used ${details.dir}.`
    );
  }
  return undefined;
}

/**
 * The native side measures; the sentence is decided here, from the same
 * resolution that produced the path. Which advice is correct turns on *why*
 * the path is long: a user who already set `NX_SOCKET_DIR` and had it refused
 * for an unrelated reason is not helped by being told to set a shorter one.
 */
function assertWithinBudget(details: SocketDirDetails): string {
  if (!details.tooLong) {
    return details.path;
  }
  const cause = fallbackCause(details);
  throw new Error(
    [
      'Attempted to open socket that exceeds the maximum socket length.',
      ...(details.usedWorkspaceFallback || details.demotedFrom !== undefined
        ? [
            `Nx fell back to ${details.dir} because the default socket directory could not be used.`,
            'Run the command with --verbose to see why the default directory was rejected.',
          ]
        : []),
      '',
      details.refusedConfiguredDir === undefined
        ? `Set NX_SOCKET_DIR to a shorter path (e.g. ${
            process.platform === 'win32' ? '%TMP%/nx-tmp' : '/tmp/nx-tmp'
          }) to avoid this issue.`
        : // Saying "set a shorter path" here would be advice they already
          // followed: they set one, and it was refused for another reason.
          `The directory set in NX_SOCKET_DIR (${details.refusedConfiguredDir}) could not be used — see the warning above — so Nx fell back to a longer path.\nPoint NX_SOCKET_DIR at a short directory your user owns.`,
    ].join('\n'),
    cause === undefined ? undefined : { cause }
  );
}

/** The daemon's own socket. */
export function getDaemonSocketPath(): string {
  return adopt(resolveDaemonSocketPath(workspaceRoot));
}

/** A forked task process's socket, in the daemon's per-run directory. */
export function getForkedProcessSocketPath(id: string): string {
  return adopt(resolveForkedProcessSocketPath(workspaceRoot, id));
}

/**
 * Plugin worker sockets get their own workspace-scoped directory rather than
 * sitting in the shared system temp dir, which cannot be locked down.
 */
export function getPluginSocketPath(id: string): string {
  return adopt(resolvePluginSocketPath(workspaceRoot, id));
}

/**
 * Where the Nx Console socket lives, for whoever binds or connects to it.
 *
 * Nx Console is the server here and Nx the client, so the extension listens
 * where this says and Nx dials it.
 *
 * @param workspaceRootOverride the workspace to resolve for, when the caller is
 * not itself running inside it (Nx Console runs in the editor's extension host)
 * @param env the environment to read `NX_SOCKET_DIR` from, for callers that
 * load a workspace `.env` into a copy rather than into `process.env`
 */
export function getNxConsoleSocketPath(
  workspaceRootOverride?: string,
  env?: Record<string, string>
): string {
  return adopt(
    resolveNxConsoleSocketPath(workspaceRootOverride ?? workspaceRoot, env)
  );
}

export function removeSocketDir() {
  try {
    // The directory, not the socket: the daemon's whole per-run directory goes.
    rmSync(resolveDaemonSocketPath(workspaceRoot).dir, {
      recursive: true,
      force: true,
    });
  } catch (e) {}
}
