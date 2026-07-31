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
 * Whether a shared container is safe to keep an owner-only directory under.
 *
 * A container writable by other users must be sticky, and it must be owned by
 * either root or the current user. Sticky directories still let the directory
 * owner rename entries, so accepting a container owned by another unprivileged
 * user would let that user replace a previously verified private directory.
 *
 * A current-user-owned container is safe for that user but is deliberately
 * refused by other users. For cross-user use, an administrator only needs to
 * create the single top-level container as root-owned mode 1777; every user can
 * create their own private subtree directly beneath it.
 */
export function isSafeSharedRoot(dir: string): boolean {
  try {
    const stats = lstatSync(dir);
    if (!stats.isDirectory()) {
      return false;
    }
    if (process.platform === 'win32') {
      // The OS temp root is already scoped to the current Windows user.
      return true;
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
 * The remedy for a container `isSafeSharedRoot` refused, or `undefined` when
 * there is nothing the user can do about it. Only a container owned by another
 * unprivileged user has an actionable fix, and it is to hand it to root: Nx
 * cannot chown it, and refusing it is what keeps that user from renaming our
 * directory aside. Returns the message rather than a boolean so it cannot be
 * swapped with the guards above.
 */
export function sharedRootRemedy(dir: string): string | undefined {
  try {
    const stats = lstatSync(dir);
    if (
      !stats.isDirectory() ||
      typeof process.getuid !== 'function' ||
      stats.uid === process.getuid() ||
      stats.uid === 0
    ) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return `${dir} belongs to another user on this machine, so Nx cannot keep a private directory beneath it. Ask an administrator to hand it to root with \`sudo chown root ${dir} && sudo chmod 1777 ${dir}\`; every user can then keep their own directory under it.`;
}

/**
 * Create a shared container as sticky + world-writable, without following a
 * symlink at its final component, and report whether the resulting path is safe
 * for the current user.
 *
 * The chmod is best-effort: a later user cannot change a container owned by
 * root or by the first user, so the verdict always comes from
 * `isSafeSharedRoot`.
 */
export function ensureSafeSharedRoot(dir: string): boolean {
  if (process.platform === 'win32') {
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
