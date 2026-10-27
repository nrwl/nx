import { homedir, platform, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { canonicalDir, getUserSegment } from './owned-private-dir';

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

/**
 * Whether the home directory lies outside the shared temp dir.
 *
 * `homedir()` honours `$HOME`, so `HOME=/tmp` or `HOME=/tmp/foo` puts `~/.nx`
 * at or under a directory every user can write to (`1777`). Peers can plant
 * files in its ancestors and, at `HOME=/tmp`, own the `.nx` container itself.
 * Nothing that Nx later executes, installs into, or replays into the workspace
 * can live there.
 *
 * `native/utils/socket_path.rs` makes only the same-path check, for sockets.
 */
export function homeDirIsDistinctFromSharedTmp(): boolean {
  if (!NX_HOME_TMP_DIR) {
    return false;
  }
  const home = canonicalDir(dirname(NX_HOME_TMP_DIR));
  const fromSharedTmp = relative(canonicalDir(dirname(NX_TMP_DIR)), home);
  const atOrUnderSharedTmp =
    fromSharedTmp === '' ||
    (fromSharedTmp !== '..' &&
      !fromSharedTmp.startsWith('..' + sep) &&
      !isAbsolute(fromSharedTmp));
  return !atOrUnderSharedTmp;
}
