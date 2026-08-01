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
 * Each guard returns its own branded path rather than a bare boolean, so one
 * guard's result cannot be stored in, or passed where the code expects,
 * another's. Note the limit: every call site today tests truthiness, and a
 * boolean context accepts any brand, so this catches a future edit rather than
 * a wrong call in an `if`. `null` is the single failure value throughout, so
 * those truthiness callers are unaffected.
 */
declare const safeSharedRootBrand: unique symbol;
declare const sharedRootEstablishedBrand: unique symbol;
declare const ownedRealDirBrand: unique symbol;
declare const ownedPrivateDirBrand: unique symbol;

/** Verified safe to keep an owner-only directory under. Not created. */
export type SafeSharedRoot = string & {
  readonly [safeSharedRootBrand]: true;
};
/** Created if absent, then verified safe as above. */
export type EstablishedSharedRoot = string & {
  readonly [sharedRootEstablishedBrand]: true;
};
/** An existing real directory owned by us. Mode is *not* checked. */
export type OwnedRealDir = string & { readonly [ownedRealDirBrand]: true };
/** Created if absent, owned by us, and re-locked to `0700`. */
export type OwnedPrivateDir = string & {
  readonly [ownedPrivateDirBrand]: true;
};

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
export function isSafeSharedRoot(dir: string): SafeSharedRoot | null {
  try {
    const stats = lstatSync(dir);
    if (!stats.isDirectory()) {
      return null;
    }
    if (process.platform === 'win32') {
      // The OS temp root is already scoped to the current Windows user.
      return dir as SafeSharedRoot;
    }
    if (
      typeof process.getuid === 'function' &&
      stats.uid !== process.getuid() &&
      stats.uid !== 0
    ) {
      return null;
    }
    return !(stats.mode & 0o022) || !!(stats.mode & S_ISVTX)
      ? (dir as SafeSharedRoot)
      : null;
  } catch {
    return null;
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
 * root or by the first user, so on POSIX the verdict comes from
 * `isSafeSharedRoot` rather than from whether the chmod worked. Windows has no
 * shared level to verify — the OS temp root is already per-account — so
 * creation alone is the verdict there.
 */
export function ensureSafeSharedRoot(
  dir: string
): EstablishedSharedRoot | null {
  if (process.platform === 'win32') {
    try {
      mkdirSync(dir, { recursive: true });
      return dir as EstablishedSharedRoot;
    } catch {
      return null;
    }
  }

  try {
    mkdirSync(dir, { mode: 0o1777 });
  } catch (e: any) {
    if (e?.code !== 'EEXIST') {
      return null;
    }
  }
  chmodRealDirectory(dir, 0o1777);
  return isSafeSharedRoot(dir) === null ? null : (dir as EstablishedSharedRoot);
}

/**
 * Whether `dir` is an existing real directory owned by us. Unlike
 * `ensureOwnedPrivateDir` it creates nothing and repairs nothing — for callers
 * that only want to know whether a path is safe to act on, such as deleting.
 */
export function isOwnedRealDirectory(dir: string): OwnedRealDir | null {
  try {
    const stats = lstatSync(dir);
    if (!stats.isDirectory()) {
      return null;
    }
    return typeof process.getuid !== 'function' ||
      stats.uid === process.getuid()
      ? (dir as OwnedRealDir)
      : null;
  } catch {
    return null;
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
 * re-locked rather than accepted. `null` means it could not be established —
 * usually a directory another user planted, but also a plain filesystem error
 * or one we could not re-lock.
 *
 * Node builtins only: reached from the native binding loader.
 */
export function ensureOwnedPrivateDir(dir: string): OwnedPrivateDir | null {
  try {
    mkdirSync(dir, { mode: 0o700 });
    return dir as OwnedPrivateDir;
  } catch (e: any) {
    if (e?.code !== 'EEXIST') {
      return null;
    }
  }

  try {
    const stats = lstatSync(dir);
    // Before the Windows short-circuit: "is a real directory" holds on every
    // platform.
    if (!stats.isDirectory()) {
      return null;
    }
    if (typeof process.getuid !== 'function') {
      // Windows: the roots there are per-user OS temp dirs, not a shared /tmp.
      return dir as OwnedPrivateDir;
    }
    if (stats.uid !== process.getuid()) {
      return null;
    }
    if (stats.mode & 0o077) {
      if (!chmodRealDirectory(dir, 0o700)) {
        return null;
      }
    }
    return dir as OwnedPrivateDir;
  } catch {
    return null;
  }
}
