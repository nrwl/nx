import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
} from 'node:fs';
import { userInfo } from 'node:os';

/**
 * chmod a path only if it is a real directory, never following a symlink at its
 * final component. `chmodSync` follows symlinks, so on a path another user
 * pre-created as a link it would retarget the mode change at whatever the link
 * points at.
 *
 * The directory check is on the descriptor rather than the errno: an errno
 * deny-list fails open on codes it does not recognise, and the code for a
 * planted symlink varies by flag combination and kernel. `O_NONBLOCK` stops a
 * planted FIFO blocking `openSync` forever.
 */
function chmodRealDirectory(path: string, mode: number): boolean {
  let fd: number;
  try {
    fd = openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
    );
  } catch {
    return false;
  }
  try {
    if (!fstatSync(fd).isDirectory()) {
      return false;
    }
    fchmodSync(fd, mode);
    return true;
  } catch {
    return false;
  } finally {
    closeSync(fd);
  }
}

/**
 * Whether a path is safe to create things underneath: absent, or a real
 * directory. Checks neither ownership nor mode, so it is only sufficient for the
 * shared roots, which are world-writable by design.
 */
export function isRealDirectoryOrAbsent(dir: string): boolean {
  try {
    return lstatSync(dir).isDirectory();
  } catch (e: any) {
    return e?.code === 'ENOENT';
  }
}

/**
 * Relax a shared root to sticky + world-writable (like /tmp) so every user on
 * the machine can create their own private directory beneath it. Best-effort:
 * chmod only succeeds for whoever created the root, and they have already set
 * the mode.
 */
export function relaxSharedRootToSticky(dir: string): void {
  if (process.platform === 'win32') {
    return;
  }
  chmodRealDirectory(dir, 0o1777);
}

/** The path segment separating one user's Nx runtime state from another's. */
export function getUserSegment(): string {
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

/**
 * Ensure `dir` exists, is a real directory, is owned by us, and carries no group
 * or other bits at all — read and search are enough to reach a socket inside it,
 * so a `0755` directory is re-locked rather than accepted. Returns false if it
 * fails a check that cannot be repaired, meaning another user planted it.
 *
 * Node builtins only: reached from the native binding loader, which runs before
 * anything else in Nx.
 */
export function ensureOwnedPrivateDir(dir: string): boolean {
  try {
    mkdirSync(dir, { mode: 0o700 });
    return true;
  } catch (e: any) {
    if (e?.code !== 'EEXIST') {
      return false;
    }
  }

  try {
    const stats = lstatSync(dir);
    // Before the Windows short-circuit: "is a real directory" holds on every
    // platform.
    if (!stats.isDirectory()) {
      return false;
    }
    if (typeof process.getuid !== 'function') {
      // Windows: the roots there are per-user OS temp dirs, not a shared /tmp.
      return true;
    }
    if (stats.uid !== process.getuid()) {
      return false;
    }
    if (stats.mode & 0o077) {
      if (!chmodRealDirectory(dir, 0o700)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
