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
 * final component — `chmodSync` follows them, retargeting the mode change.
 *
 * The directory check is on the descriptor, not the errno: a deny-list fails open
 * on codes it does not know, and the code for a planted symlink varies by flag
 * combination and kernel. `O_NONBLOCK` stops a planted FIFO blocking openSync.
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
 * Sticky. Restricts rename and unlink in a writable directory to the owner of
 * each entry — plus the directory's own owner, which is why the ownership check
 * below is not redundant with this one.
 */
const S_ISVTX = 0o1000;

/**
 * Whether a shared root is safe to keep a private directory under. Two things
 * have to hold, because either alone still leaves a peer able to rename our
 * verified directory aside so the next open by path lands in theirs:
 *
 * - Owned by us or by root. Sticky permits rename and unlink by the *directory's*
 *   owner as well as by each entry's owner, so a root belonging to another
 *   unprivileged user is unsafe at any mode. This is the invariant `/tmp` itself
 *   rests on: root owns it.
 * - Sticky, if anyone beyond that owner can write to it — which is what stops
 *   everybody else renaming entries they do not own.
 *
 * Whoever runs Nx first on a shared machine owns these, so several users only
 * share one root when it was created by root: an image, an admin, or a
 * `RUN mkdir -m 1777 /tmp/.nx`. Otherwise the later users fall back, which is
 * safe but unshared.
 */
export function isSafeSharedRoot(dir: string): boolean {
  try {
    const stats = lstatSync(dir);
    if (!stats.isDirectory()) {
      return false;
    }
    if (
      typeof process.getuid === 'function' &&
      stats.uid !== process.getuid() &&
      stats.uid !== 0
    ) {
      return false;
    }
    return !(stats.mode & 0o022) || !!(stats.mode & S_ISVTX);
  } catch {
    return false;
  }
}

/**
 * Create a shared root as sticky + world-writable (like /tmp) so every user on
 * the machine can create their own private directory beneath it, and report
 * whether the result is safe to use.
 *
 * The chmod is best-effort — only the root's owner can, and on a shared machine
 * that is often someone else — so the verdict comes from `isSafeSharedRoot`
 * afterwards rather than from whether the chmod worked.
 *
 * Pass roots outermost first. Each level is created non-recursively so a symlink
 * at any of them is caught here rather than resolved through.
 */
export function ensureSafeSharedRoot(dir: string): boolean {
  if (process.platform === 'win32') {
    // A per-user OS temp dir, with no mode bits to reason about.
    try {
      mkdirSync(dir, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  try {
    mkdirSync(dir, { mode: 0o1777 });
  } catch (e: any) {
    if (e?.code !== 'EEXIST') {
      return false;
    }
  }
  chmodRealDirectory(dir, 0o1777);
  return isSafeSharedRoot(dir);
}

/**
 * Whether `dir` is an existing real directory owned by us. Unlike
 * `ensureOwnedPrivateDir` it creates nothing and repairs nothing — for callers
 * that only want to know whether a path is safe to act on, such as deleting.
 */
export function isOwnedRealDirectory(dir: string): boolean {
  try {
    const stats = lstatSync(dir);
    if (!stats.isDirectory()) {
      return false;
    }
    return (
      typeof process.getuid !== 'function' || stats.uid === process.getuid()
    );
  } catch {
    return false;
  }
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
 * Ensure `dir` exists, is a real directory owned by us, and carries no group or
 * other bits at all — read and search alone reach a socket inside it, so 0755 is
 * re-locked rather than accepted. False means it could not be established —
 * usually a directory another user planted, but also a plain filesystem error
 * or one we could not re-lock.
 *
 * Node builtins only: reached from the native binding loader.
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
