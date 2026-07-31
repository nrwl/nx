import { dirname, join } from 'path';
import { mkdirSync } from 'fs';
import { NX_TMP_DIR, NX_USER_TMP_DIR } from '../utils/nx-tmp-dir';
import { nxVersion } from '../utils/versions';
import {
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
  isOwnedRealDirectory,
  isSafeSharedRoot,
} from '../utils/owned-private-dir';

/**
 * Owner-only parent for the current user's native binary cache.
 */
export const NATIVE_CACHE_ROOT = join(NX_USER_TMP_DIR, 'native-cache');

/**
 * The cache directory to delete on `nx reset`, or `null` if it is not safe to
 * delete through. The cache root is checked before deleting through it, just as
 * `ensureSecureNativeFileCacheLocation` checks it before loading a binding.
 */
export function getNativeFileCacheLocationToDelete(): string | null {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    // Checked before it is handed to a recursive delete, for the same reason
    // the default location is: being configured does not make it ours.
    return isOwnedRealDirectory(process.env.NX_NATIVE_FILE_CACHE_DIRECTORY)
      ? process.env.NX_NATIVE_FILE_CACHE_DIRECTORY
      : null;
  }
  return isSafeSharedRoot(NX_TMP_DIR) &&
    isOwnedRealDirectory(NX_USER_TMP_DIR) &&
    isOwnedRealDirectory(NATIVE_CACHE_ROOT)
    ? join(NATIVE_CACHE_ROOT, nxVersion)
    : null;
}

/**
 * Create the native file cache dir, or return `null` if it cannot be created
 * *securely* — in which case the caller loads the binding in place.
 *
 * The stable top-level container is verified as safe for private children. The
 * uid directory and every directory loaded through are owner-only.
 * `ensureOwnedPrivateDir` refuses a directory or symlink another local user
 * planted before us.
 */
export function ensureSecureNativeFileCacheLocation(
  // Test seam: lets a spec plant a hostile directory under a root it controls.
  cacheRoot: string = NATIVE_CACHE_ROOT
): string | null {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    const dir = process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
    try {
      // Held to the same bar as the default location rather than trusted for
      // being configured: a `.node` is loaded out of here, so a directory
      // another user can write to is the vulnerability this module exists to
      // close. NX_SOCKET_DIR is validated and refused the same way.
      mkdirSync(dirname(dir), { recursive: true });
      if (!ensureOwnedPrivateDir(dir)) {
        throw new Error(
          'it is not a directory owned by the current user with no group or other access'
        );
      }
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

  const userRoot = dirname(cacheRoot);
  const sharedRoot = dirname(userRoot);

  // Outermost first: the stable shared container must either belong to root or
  // to us, and must be sticky if peers can write there. The uid directory then
  // becomes the owner-only boundary for sockets and native-cache alike.
  if (!ensureSafeSharedRoot(sharedRoot)) {
    return null;
  }
  for (const root of [userRoot, cacheRoot]) {
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
