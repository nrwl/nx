import { homedir, platform, tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { getUserSegment } from './owned-private-dir';

/**
 * Stable root for Nx runtime artifacts that need an OS tmp location. On POSIX a
 * literal `/tmp`, not `os.tmpdir()`, which honours `$TMPDIR` — per-user on
 * macOS, rewritten by sandboxes, stripped from the daemon env, so client and
 * daemon would disagree. Windows has no `/tmp`, and `%TMP%` is already per-user
 * and stable, so it keeps `os.tmpdir()`.
 *
 * Consumed by the native binding loader, so keep this file limited to local
 * helpers that themselves use Node builtins only.
 */
export const NX_TMP_DIR_POSIX = '/tmp/.nx';

/**
 * Windows has no /tmp, named pipes are not subject to filesystem sandboxing,
 * and per-user temp dirs are stable there, so the OS temp dir is fine.
 */
export const NX_TMP_DIR =
  platform() === 'win32' ? join(tmpdir(), '.nx') : NX_TMP_DIR_POSIX;

/**
 * Owner-only runtime root for the current user. No user segment on Windows —
 * `%TMP%` is already per-account, and the segment would only cost path length.
 */
export const NX_USER_TMP_DIR =
  platform() === 'win32' ? NX_TMP_DIR : join(NX_TMP_DIR, getUserSegment());

/** Runtime root under the user's home, used when the shared container cannot be established. */
export const NX_HOME_TMP_DIR = resolveHomeTmpDir();

/**
 * The runtime roots as they belong in a *committed* sandbox allowlist.
 *
 * Deliberately literal rather than the resolved constants above. `NX_TMP_DIR`
 * is a machine's own temp path on Windows and `NX_HOME_TMP_DIR` is an expanded
 * absolute home — either would pin a shared config file to whoever ran the
 * generator. These two spellings are identical on every machine and are
 * expanded by the sandbox per user, which is the property that makes the entry
 * worth committing at all.
 *
 * Both are listed because socket resolution walks a chain: `/tmp/.nx` first,
 * `~/.nx` when a peer already owns the shared container. Allowing only the
 * first leaves every user on a machine where someone else got there first
 * silently uncovered.
 */
export const NX_ALLOWLIST_ROOTS = ['/tmp/.nx', '~/.nx'] as const;

/**
 * Absolute, not merely non-empty: a relative `$HOME` would make `join` return
 * `.nx`, putting sockets under the cwd and aiming `removeSocketDir`'s recursive
 * delete at it. A rootless container has no `$HOME` and no passwd entry, so
 * `homedir()` throws or returns empty — caught here because this runs at module
 * scope and the native binding loader imports this file.
 */
function resolveHomeTmpDir(): string | undefined {
  try {
    const home = homedir();
    return home && isAbsolute(home) ? join(home, '.nx') : undefined;
  } catch {
    return undefined;
  }
}
