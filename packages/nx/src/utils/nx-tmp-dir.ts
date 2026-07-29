import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Fixed root for Nx runtime artifacts that need a machine-wide tmp location.
 * A literal /tmp rather than os.tmpdir(), which honors $TMPDIR — per-user on
 * macOS, rewritten by sandboxes, stripped from the daemon env. A literal path
 * is identical everywhere, so a sandbox allowlist entry can be committed.
 *
 * Windows has no /tmp, named pipes are not subject to filesystem sandboxing,
 * and per-user temp dirs are stable there, so the OS temp dir is fine.
 *
 * Dependency-free (node builtins only): consumed by the native binding loader.
 */
export const NX_TMP_DIR =
  platform() === 'win32' ? join(tmpdir(), '.nx') : '/tmp/.nx';
