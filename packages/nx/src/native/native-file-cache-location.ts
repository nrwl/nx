import { dirname, join } from 'path';
import { mkdirSync } from 'fs';
import { NX_TMP_DIR } from '../utils/nx-tmp-dir';
import { nxVersion } from '../utils/versions';
import {
  ensureOwnedPrivateDir,
  isOwnedRealDirectory,
} from '../utils/owned-private-dir';

/**
 * Owner-only parent for the current user's native binary cache. The uid is in
 * `NX_TMP_DIR` itself so no administrator-created shared hierarchy is required.
 */
export const NATIVE_CACHE_ROOT = join(NX_TMP_DIR, 'native-cache');

export function getNativeFileCacheLocation() {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    return process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
  }

  // /tmp/.nx-<uid>/native-cache/<nxVersion>. The binary is identical per version
  // for a published Nx; source checkouts all report 0.0.1, so the loader also
  // keys each file by a hash of the binding path (see native/index.js).
  return join(NATIVE_CACHE_ROOT, nxVersion);
}

/**
 * The cache directory to delete on `nx reset`, or `null` if it is not safe to
 * delete through. The cache root is checked before deleting through it, just as
 * `ensureSecureNativeFileCacheLocation` checks it before loading a binding.
 */
export function getNativeFileCacheLocationToDelete(): string | null {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    return process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
  }
  return isOwnedRealDirectory(NX_TMP_DIR) &&
    isOwnedRealDirectory(NATIVE_CACHE_ROOT)
    ? join(NATIVE_CACHE_ROOT, nxVersion)
    : null;
}

/**
 * Create the native file cache dir, or return `null` if it cannot be created
 * *securely* — in which case the caller loads the binding in place.
 *
 * The uid-specific top-level root and every directory loaded through are
 * owner-only. `ensureOwnedPrivateDir` refuses a directory or symlink another
 * local user planted before us.
 */
export function ensureSecureNativeFileCacheLocation(
  // Test seam: lets a spec plant a hostile directory under a root it controls.
  cacheRoot: string = NATIVE_CACHE_ROOT
): string | null {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    // Caller-provided location; its safety is the caller's responsibility.
    const dir = process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
    try {
      mkdirSync(dir, { recursive: true });
      return dir;
    } catch (e: any) {
      // Never discard a configured directory silently — the socket directory
      // follows the same rule. A typo, EACCES or EROFS is otherwise
      // indistinguishable from a working cache.
      console.warn(
        `Nx could not use the configured native file cache directory ${dir} (${
          e?.code ?? e?.message ?? e
        }). Loading the native binding in place instead.`
      );
      return null;
    }
  }

  // Outermost first: a symlink at either root redirects the whole cache.
  // `/tmp` itself is root-owned + sticky, so once the uid-specific first level
  // is verified owner-only a peer cannot rename it aside.
  for (const root of [dirname(cacheRoot), cacheRoot]) {
    if (!ensureOwnedPrivateDir(root)) {
      return null;
    }
  }

  // Verified, not assumed: this is the directory we load a `.node` out of.
  const versionDir = join(cacheRoot, nxVersion);
  if (!ensureOwnedPrivateDir(versionDir)) {
    return null;
  }
  return versionDir;
}
