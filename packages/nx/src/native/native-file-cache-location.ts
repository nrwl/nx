import { userInfo } from 'os';
import { join } from 'path';
import { chmodSync, mkdirSync } from 'fs';
import { NX_TMP_DIR } from '../utils/nx-tmp-dir';
import { nxVersion } from '../utils/versions';
import { ensureOwnedPrivateDir } from '../utils/owned-private-dir';

/**
 * Shared parent for every user's native binary cache. Like NX_TMP_DIR and the
 * socket root it is sticky + world-writable so each user can create their own
 * per-uid subdirectory under it — but nothing is ever loaded directly from
 * here, only from the owner-locked per-uid dir below.
 */
const NATIVE_BINARIES_ROOT = join(NX_TMP_DIR, 'native-binaries');

export { ensureOwnedPrivateDir };

export function getNativeFileCacheLocation() {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    return process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
  }

  // /tmp/.nx/native-binaries/<uid>/<nxVersion>. For a published Nx the binary
  // is identical for a given version regardless of workspace, so the version
  // is enough to key the directory. That does NOT hold in a source checkout,
  // where nxVersion is the placeholder 0.0.1 for every worktree — the loader
  // additionally keys each cached file by a hash of the resolved binding path
  // (see native/index.js) so checkouts cannot collide here.
  return join(NATIVE_BINARIES_ROOT, getUserSegment(), nxVersion);
}

/**
 * Best-effort create the native file cache dir and return it, or `null` if it
 * could not be created *securely* (in which case the caller must load the
 * binding in place from node_modules rather than from a cache it cannot trust).
 *
 * Security: NX_TMP_DIR and NATIVE_BINARIES_ROOT are world-writable so that
 * multiple users on a shared machine (the /tmp case) can each cache. That means
 * another local user could pre-create our per-uid directory and plant a
 * malicious `.node` that we would otherwise load and *execute*. To prevent
 * that, the per-uid dir must be owned by us, be a real directory (not a
 * symlink), and not be writable by group or other. If any of those fail we
 * refuse the cache and fall back to loading in place.
 */
export function ensureSecureNativeFileCacheLocation(
  // Internal seam: production always uses NATIVE_BINARIES_ROOT. Tests override
  // it so they can plant a hostile directory under a root they control, since
  // the real one lives in /tmp and may be unwritable (sandboxes) or shared with
  // a concurrently running Nx.
  binariesRoot: string = NATIVE_BINARIES_ROOT
): string | null {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    // Caller-provided location; its safety is the caller's responsibility.
    const dir = process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
    try {
      mkdirSync(dir, { recursive: true });
      return dir;
    } catch {
      return null;
    }
  }

  const userDir = join(binariesRoot, getUserSegment());

  try {
    // Create the shared root world-writable + sticky, like /tmp itself, so
    // peers can make their own per-uid dirs. chmod only succeeds for the
    // creating user, hence best-effort.
    mkdirSync(binariesRoot, { recursive: true });
    if (canCheckOwnership()) {
      try {
        chmodSync(NX_TMP_DIR, 0o1777);
        chmodSync(binariesRoot, 0o1777);
      } catch {}
    }
  } catch {
    return null;
  }

  if (!ensureOwnedPrivateDir(userDir)) {
    return null;
  }

  // Verified rather than assumed: `mkdirSync(..., { recursive: true })`
  // silently succeeds on a pre-planted symlink, and this is the directory we
  // load a `.node` out of.
  const versionDir = join(userDir, nxVersion);
  if (!ensureOwnedPrivateDir(versionDir)) {
    return null;
  }
  return versionDir;
}

function canCheckOwnership(): boolean {
  return typeof process.getuid === 'function';
}

function getUserSegment(): string {
  try {
    if (typeof process.getuid === 'function') {
      return String(process.getuid());
    }
  } catch {}
  try {
    const { username } = userInfo();
    if (username) {
      return username;
    }
  } catch {}
  return 'unknown';
}
