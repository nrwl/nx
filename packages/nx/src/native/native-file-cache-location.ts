import { userInfo } from 'os';
import { join } from 'path';
import { chmodSync, lstatSync, mkdirSync } from 'fs';
import { NX_TMP_DIR } from '../utils/nx-tmp-dir';
import { nxVersion } from '../utils/versions';

/**
 * Shared parent for every user's native binary cache. Like NX_TMP_DIR and the
 * socket root it is sticky + world-writable so each user can create their own
 * per-uid subdirectory under it — but nothing is ever loaded directly from
 * here, only from the owner-locked per-uid dir below.
 */
const NATIVE_BINARIES_ROOT = join(NX_TMP_DIR, 'native-binaries');

export function getNativeFileCacheLocation() {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    return process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
  }

  // /tmp/.nx/native-binaries/<uid>/<nxVersion>. The binary is identical for a
  // given Nx version regardless of workspace, so the version is the only key
  // needed under the per-user dir.
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
export function ensureSecureNativeFileCacheLocation(): string | null {
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

  const userDir = join(NATIVE_BINARIES_ROOT, getUserSegment());

  try {
    // Create the shared root world-writable + sticky, like /tmp itself, so
    // peers can make their own per-uid dirs. chmod only succeeds for the
    // creating user, hence best-effort.
    mkdirSync(NATIVE_BINARIES_ROOT, { recursive: true });
    if (canCheckOwnership()) {
      try {
        chmodSync(NX_TMP_DIR, 0o1777);
        chmodSync(NATIVE_BINARIES_ROOT, 0o1777);
      } catch {}
    }
  } catch {
    return null;
  }

  if (!ensureOwnedPrivateDir(userDir)) {
    return null;
  }

  const versionDir = join(userDir, nxVersion);
  try {
    mkdirSync(versionDir, { recursive: true });
  } catch {
    return null;
  }
  return versionDir;
}

/**
 * Ensure `dir` exists, is owned by the current user, is a real directory (not a
 * symlink), and is not writable by group or other (mode 0700). Returns false if
 * it exists but fails any of those checks — i.e. it may have been planted by
 * another user through the world-writable parent.
 */
function ensureOwnedPrivateDir(dir: string): boolean {
  try {
    mkdirSync(dir, { mode: 0o700 });
    // We just created it, so it is ours and private.
    return true;
  } catch (e: any) {
    if (e?.code !== 'EEXIST') {
      return false;
    }
  }

  // The dir already existed — verify it is safe to use.
  if (typeof process.getuid !== 'function') {
    // No POSIX ownership model (Windows). NX_TMP_DIR there is the per-user OS
    // temp dir, not a shared /tmp, so cross-user planting is not a concern.
    return true;
  }
  const myUid = process.getuid();

  try {
    const stats = lstatSync(dir);
    if (!stats.isDirectory()) {
      return false;
    }
    if (stats.uid !== myUid) {
      return false;
    }
    // No write bits for group (0o020) or other (0o002).
    if (stats.mode & 0o022) {
      // Try to lock it down; if we can't, refuse.
      try {
        chmodSync(dir, 0o700);
      } catch {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
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
