import { dirname, join } from 'path';
import { mkdirSync } from 'fs';
import { NX_TMP_DIR } from '../utils/nx-tmp-dir';
import { nxVersion } from '../utils/versions';
import {
  ensureOwnedPrivateDir,
  getUserSegment,
  isRealDirectoryOrAbsent,
  relaxSharedRootToSticky,
} from '../utils/owned-private-dir';

/**
 * Shared parent for every user's native binary cache. Like NX_TMP_DIR and the
 * socket root it is sticky + world-writable so each user can create their own
 * per-uid subdirectory under it — but nothing is ever loaded directly from
 * here, only from the owner-locked per-uid dir below.
 */
const NATIVE_CACHE_ROOT = join(NX_TMP_DIR, 'native-cache');

export function getNativeFileCacheLocation() {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    return process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
  }

  // /tmp/.nx/native-cache/<uid>/<nxVersion>. For a published Nx the binary
  // is identical for a given version regardless of workspace, so the version
  // is enough to key the directory. That does NOT hold in a source checkout,
  // where nxVersion is the placeholder 0.0.1 for every worktree — the loader
  // additionally keys each cached file by a hash of the resolved binding path
  // (see native/index.js) so checkouts cannot collide here.
  return join(NATIVE_CACHE_ROOT, getUserSegment(), nxVersion);
}

/**
 * Best-effort create the native file cache dir and return it, or `null` if it
 * could not be created *securely* (in which case the caller must load the
 * binding in place from node_modules rather than from a cache it cannot trust).
 *
 * Security: NX_TMP_DIR and NATIVE_CACHE_ROOT are world-writable so that
 * multiple users on a shared machine (the /tmp case) can each cache. That means
 * another local user could pre-create our per-uid directory and plant a
 * malicious `.node` that we would otherwise load and *execute*. To prevent
 * that, the per-uid dir must be owned by us, be a real directory (not a
 * symlink), and carry no group or other bits at all — read and search are
 * enough to reach what is inside, so a `0755` directory is re-locked to `0700`
 * rather than accepted. If a check fails and cannot be repaired we refuse the
 * cache and fall back to loading in place.
 */
export function ensureSecureNativeFileCacheLocation(
  // Internal seam: production always uses NATIVE_CACHE_ROOT. Tests override
  // it so they can plant a hostile directory under a root they control, since
  // the real one lives in /tmp and may be unwritable (sandboxes) or shared with
  // a concurrently running Nx.
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
    // Verify the shared roots before creating anything beneath them. The
    // O_NOFOLLOW inside relaxSharedRootToSticky only guards the component it is
    // handed; every path built under a root still resolves that root, so a
    // symlink planted one level up redirects the entire cache — including the
    // directory we go on to load a `.node` out of.
    if (
      !isRealDirectoryOrAbsent(dirname(cacheRoot)) ||
      !isRealDirectoryOrAbsent(cacheRoot)
    ) {
      return null;
    }
    // Create the shared root world-writable + sticky, like /tmp itself, so
    // peers can make their own per-uid dirs. chmod only succeeds for the
    // creating user, hence best-effort.
    mkdirSync(cacheRoot, { recursive: true });
    if (canCheckOwnership()) {
      // Relaxed independently: a failure on one root must not skip the other,
      // or the first user to get here locks everyone else out of the cache.
      // Both are known to be real directories at this point — the guard above
      // is what rules out a planted root, so these calls do not need to.
      relaxSharedRootToSticky(dirname(cacheRoot));
      relaxSharedRootToSticky(cacheRoot);
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
