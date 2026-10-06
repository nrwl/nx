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
