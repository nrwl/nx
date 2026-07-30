import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
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
 * Windows has no /tmp, named pipes are not subject to filesystem sandboxing,
 * and per-user temp dirs are stable there, so the OS temp dir is fine.
 *
 * Consumed by the native binding loader, so keep this limited to local helpers
 * that themselves use Node builtins only.
 */
export const NX_TMP_DIR =
  platform() === 'win32' ? join(tmpdir(), '.nx') : '/tmp/.nx';

/**
 * Owner-only runtime root for the current user. The Windows temp directory is
 * already per-user, so an extra user segment there would only consume path
 * length.
 */
export const NX_USER_TMP_DIR =
  platform() === 'win32' ? NX_TMP_DIR : join(NX_TMP_DIR, getUserSegment());
