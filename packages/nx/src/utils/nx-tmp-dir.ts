import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { getUserSegment } from './owned-private-dir';

/**
 * Short root for Nx runtime artifacts that need an OS tmp location.
 * A literal /tmp rather than os.tmpdir(), which honors $TMPDIR — per-user on
 * macOS, rewritten by sandboxes, stripped from the daemon env. A literal path
 * is stable between the client and daemon.
 *
 * The user segment belongs at the top level. `/tmp` is root-owned and sticky,
 * so another local user cannot replace this owner-only directory after Nx
 * creates it. A shared `/tmp/.nx` would instead belong to whichever user ran Nx
 * first; sticky does not stop that directory's owner replacing entries beneath
 * it, and making the whole hierarchy shareable would require administrator
 * provisioning.
 *
 * Windows has no /tmp, named pipes are not subject to filesystem sandboxing,
 * and per-user temp dirs are stable there, so the OS temp dir is fine.
 *
 * Consumed by the native binding loader, so keep this limited to local helpers
 * that themselves use Node builtins only.
 */
export const NX_TMP_DIR =
  platform() === 'win32'
    ? join(tmpdir(), '.nx')
    : `/tmp/.nx-${getUserSegment()}`;
