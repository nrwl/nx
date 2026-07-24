import { homedir, platform, tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { getUserSegment } from './owned-private-dir';

/**
 * Stable root for Nx runtime artifacts that need an OS tmp location.
 * A literal /tmp rather than os.tmpdir(), which honors $TMPDIR — per-user on
 * macOS, rewritten by sandboxes, stripped from the daemon env. A literal path
 * is stable between the client and daemon and can be allowlisted once by
 * agentic coding sandboxes.
 *
 * On POSIX, each user's owner-only runtime root sits directly beneath this
 * container. A root-owned, sticky `/tmp/.nx` therefore supports every user
 * without an administrator also provisioning sockets and native-cache roots.
 *
 * Consumed by the native binding loader, so keep this limited to local helpers
 * that themselves use Node builtins only.
 */
export const NX_TMP_DIR_POSIX = '/tmp/.nx';

/**
 * Windows has no /tmp, named pipes are not subject to filesystem sandboxing,
 * and per-user temp dirs are stable there, so the OS temp dir is fine.
 */
export const NX_TMP_DIR =
  platform() === 'win32' ? join(tmpdir(), '.nx') : NX_TMP_DIR_POSIX;

/**
 * Owner-only runtime root for the current user. The Windows temp directory is
 * already per-user, so an extra user segment there would only consume path
 * length.
 */
export const NX_USER_TMP_DIR =
  platform() === 'win32' ? NX_TMP_DIR : join(NX_TMP_DIR, getUserSegment());

/**
 * Runtime root inside the user's home directory, used when the shared container
 * cannot be established — most often because a peer created `/tmp/.nx` first.
 *
 * No level of it is shared, so it needs no administrator and no ownership
 * derivation: the home directory belongs to the user by construction, and a peer
 * who cannot write there cannot substitute anything beneath it. `~` is also a
 * single literal in an agentic sandbox allowlist that expands per user, which a
 * uid-bearing path is not.
 *
 * Longer than the `/tmp` root and not cleared on reboot, so it is the second
 * choice rather than the first.
 */
export const NX_HOME_TMP_DIR = resolveHomeTmpDir();

/**
 * `undefined` when there is no home directory to use, in which case callers skip
 * this location entirely.
 *
 * A rootless container running as an arbitrary uid has neither `$HOME` nor a
 * passwd entry, and `homedir()` then either throws or yields an empty string. A
 * `$HOME` that is set but relative reaches the same place, which is why absolute
 * is checked rather than merely non-empty: `join` would build the *relative*
 * path `.nx`, putting sockets under whatever the working directory happens to be
 * and pointing `removeSocketDir`'s recursive delete into it. Evaluated at module scope, so the throw has to be
 * caught here: the native binding loader imports this file.
 */
function resolveHomeTmpDir(): string | undefined {
  try {
    const home = homedir();
    return home && isAbsolute(home) ? join(home, '.nx') : undefined;
  } catch {
    return undefined;
  }
}
