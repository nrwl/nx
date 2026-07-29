import { dirname, join } from 'path';
import { mkdirSync } from 'fs';
import { NX_TMP_DIR } from '../utils/nx-tmp-dir';
import { nxVersion } from '../utils/versions';
import {
  ensureOwnedPrivateDir,
  getUserSegment,
  isOwnedRealDirectory,
  isRealDirectoryOrAbsent,
  relaxSharedRootToSticky,
} from '../utils/owned-private-dir';

/**
 * Shared parent for every user's native binary cache: sticky + world-writable so
 * each user can create their own per-uid subdirectory. Nothing is loaded from
 * here directly, only from the owner-locked per-uid dir beneath it.
 */
const NATIVE_CACHE_ROOT = join(NX_TMP_DIR, 'native-cache');

export function getNativeFileCacheLocation() {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    return process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
  }

  // /tmp/.nx/native-cache/<uid>/<nxVersion>. The binary is identical per version
  // for a published Nx; source checkouts all report 0.0.1, so the loader also
  // keys each file by a hash of the binding path (see native/index.js).
  return join(NATIVE_CACHE_ROOT, getUserSegment(), nxVersion);
}

/**
 * The cache directory to delete on `nx reset`, or `null` if it is not safe to
 * delete through. The per-uid component sits under a world-writable root, so
 * another user can plant a symlink there and have the delete follow it into a
 * directory of their choosing — the same component `ensureSecureNativeFileCacheLocation`
 * refuses to load from.
 */
export function getNativeFileCacheLocationToDelete(): string | null {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    return process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
  }
  const userDir = join(NATIVE_CACHE_ROOT, getUserSegment());
  return isOwnedRealDirectory(userDir) ? join(userDir, nxVersion) : null;
}

/**
 * Create the native file cache dir, or return `null` if it cannot be created
 * *securely* — in which case the caller loads the binding in place.
 *
 * The roots are world-writable so users on a shared machine can each cache,
 * which means another local user could pre-create our per-uid directory and
 * plant a `.node` we would load and execute. `ensureOwnedPrivateDir` is what
 * refuses that.
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
    } catch {
      return null;
    }
  }

  const userDir = join(cacheRoot, getUserSegment());

  try {
    // Before creating anything beneath them: a symlink planted at either root
    // redirects the whole cache, including the dir we load a `.node` from.
    if (
      !isRealDirectoryOrAbsent(dirname(cacheRoot)) ||
      !isRealDirectoryOrAbsent(cacheRoot)
    ) {
      return null;
    }
    mkdirSync(cacheRoot, { recursive: true });
    if (canCheckOwnership()) {
      // Independently: a failure on one must not skip the other, or the first
      // user here locks everyone else out of the cache.
      relaxSharedRootToSticky(dirname(cacheRoot));
      relaxSharedRootToSticky(cacheRoot);
    }
  } catch {
    return null;
  }

  if (!ensureOwnedPrivateDir(userDir)) {
    return null;
  }

  // Verified, not assumed: this is the directory we load a `.node` out of.
  const versionDir = join(userDir, nxVersion);
  if (!ensureOwnedPrivateDir(versionDir)) {
    return null;
  }
  return versionDir;
}

function canCheckOwnership(): boolean {
  return typeof process.getuid === 'function';
}
