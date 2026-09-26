import { dirname, join, resolve } from 'path';
import { mkdirSync } from 'fs';
import { NX_TMP_DIR, NX_USER_TMP_DIR } from '../utils/nx-tmp-dir';
import { nxVersion } from '../utils/versions';
import {
  DirectoryRefusedError,
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
  isOwnedRealDirectory,
  isSafeSharedRoot,
} from '../utils/owned-private-dir';

/**
 * Path of the current user's native binary cache. Nothing about the constant is
 * owner-only — `ensureSecureNativeFileCacheLocation` is what establishes that,
 * and on Windows nothing does, since the OS temp dir is already per-account.
 */
export const NATIVE_CACHE_ROOT = join(NX_USER_TMP_DIR, 'native-cache');

/**
 * The configured cache dir, normalized. `resolve` strips a trailing slash, which
 * would otherwise defeat the guards downstream: `lstat` on a path ending in `/`
 * resolves a symlink rather than reporting it, and `O_NOFOLLOW` then opens the
 * target. `NX_SOCKET_DIR` is normalized for the same reason.
 */
function configuredCacheDir(): string | undefined {
  const dir = process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
  return dir ? resolve(dir) : undefined;
}

export function getNativeFileCacheLocationToDelete(): string | null {
  const configured = configuredCacheDir();
  if (configured !== undefined) {
    // Checked for ownership before it is handed to a recursive delete: being
    // configured does not make it ours. Weaker than the load path below, which
    // also enforces mode and validates the version directory.
    return isOwnedRealDirectory(configured) ? configured : null;
  }
  return isSafeSharedRoot(NX_TMP_DIR).status === 'ok' &&
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
  const configured = configuredCacheDir();
  if (configured !== undefined) {
    const dir = configured;
    try {
      // Held to the same 0700 bar as the default location: a `.node` is loaded
      // out of here. Unlike NX_SOCKET_DIR it is not additionally refused for
      // naming one of Nx's own roots, which is the only case that throws.
      mkdirSync(dirname(dir), { recursive: true });
      const established = ensureOwnedPrivateDir(dir);
      if (established.status !== 'ok') {
        // The guard's own reason rather than a fixed sentence: `not-created
        // (EACCES)` and `foreign-owner` are exactly what the catch below
        // promises to tell apart, and one string for all of them cannot.
        throw new DirectoryRefusedError(established.refusal);
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
  if (ensureSafeSharedRoot(sharedRoot).status !== 'ok') {
    return null;
  }
  for (const root of [userRoot, cacheRoot]) {
    if (ensureOwnedPrivateDir(root).status !== 'ok') {
      return null;
    }
  }

  // Verified, not assumed: this is the directory we load a `.node` out of.
  const versionDir = join(cacheRoot, nxVersion);
  if (ensureOwnedPrivateDir(versionDir).status !== 'ok') {
    return null;
  }
  return versionDir;
}
