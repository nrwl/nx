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
 * chmod a path, but only if it is a real directory, and without ever following
 * a symlink at its final component.
 *
 * A plain `chmodSync` resolves symlinks, so calling it on a path another local
 * user pre-created as a link retargets the mode change onto whatever the link
 * points at. `O_NOFOLLOW` makes the kernel refuse to open a symlink, and the
 * mode is applied to the descriptor rather than the path, so nothing can be
 * swapped between the check and the change.
 *
 * Hostility is decided *positively*, by `fstat`-ing the descriptor we are about
 * to chmod, rather than by classifying errnos. An errno deny-list fails open on
 * every code it does not recognise, and the code for a planted symlink is not
 * even stable: it differs between `O_NOFOLLOW` alone and
 * `O_NOFOLLOW|O_DIRECTORY`, and between kernels. `O_NONBLOCK` is what stops a
 * planted FIFO blocking `openSync` forever waiting for a writer — a hang no
 * `catch` can recover from.
 *
 * `O_NOFOLLOW` guards only the *final* component; earlier ones resolve
 * normally, which is why callers verify every shared root with
 * `isRealDirectoryOrAbsent` before creating anything beneath it.
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
 * Whether a path is safe to create things underneath: either absent (we create
 * it ourselves) or a real directory. A symlink, a regular file or anything else
 * means another local user planted it.
 *
 * Named for exactly what it checks. It does **not** check ownership or mode — a
 * world-writable directory belonging to another uid returns `true` — so it is
 * only ever sufficient for the *shared* roots, which are world-writable by
 * design. The per-uid level beneath them is what `ensureOwnedPrivateDir`
 * verifies, and that is what stops another user owning the parent of your
 * sockets.
 */
export function isRealDirectoryOrAbsent(dir: string): boolean {
  try {
    return lstatSync(dir).isDirectory();
  } catch (e: any) {
    return e?.code === 'ENOENT';
  }
}

/**
 * Best-effort relax a *shared* root to sticky + world-writable (0o1777, like
 * /tmp itself) so every user logged in to the machine can create their own
 * private directory beneath it. Only the shared roots are relaxed; the per-uid
 * directory under each one is locked to 0700 by `ensureOwnedPrivateDir`.
 *
 * Failure is expected and ignored: chmod only succeeds for the user that created
 * the root, and whoever got there first has already set the mode. Each root is
 * relaxed independently so one failing does not skip the others — a root left
 * un-relaxed locks every other user out of it.
 */
export function relaxSharedRootToSticky(dir: string): void {
  if (process.platform === 'win32') {
    return;
  }
  chmodRealDirectory(dir, 0o1777);
}

/**
 * The path segment that separates one user's Nx runtime state from another's
 * beneath the shared roots. Shared by the socket tree and the native binary
 * cache so both get the same containment.
 */
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
 * Ensure `dir` exists, is a real directory (not a symlink), is owned by the
 * current user, and carries no group or other bits at all — not merely no write
 * bits. A `0755` directory is *not* group/other-writable yet is still re-locked
 * to `0700`, because read and search permission are enough to reach a socket
 * inside it. Returns false if it exists and fails any check that cannot be
 * repaired — i.e. it may have been planted by another user through a
 * world-writable parent.
 *
 * Both callers create directories under a shared, world-writable root (the Nx
 * socket root and the native binary cache root), which is exactly where another
 * local user can pre-create a path we are about to use. `mkdirSync` succeeds on
 * a pre-planted symlink and `chmodSync` follows it, so creating and locking
 * down in one step would let an attacker redirect where we put our files and
 * silently retarget the chmod at a directory they chose. The `lstat` below is
 * what makes that impossible: it inspects the link itself rather than its
 * target, so a symlink fails `isDirectory()` and is refused.
 *
 * Lives in its own dependency-free module (node builtins only) because it is
 * reached from the native binding loader, which runs before anything else
 * in Nx.
 */
export function ensureOwnedPrivateDir(dir: string): boolean {
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
  try {
    const stats = lstatSync(dir);
    // Checked before the Windows short-circuit below: "is a real directory" is
    // part of the contract on every platform, and the `mkdirSync(recursive)`
    // this replaced used to enforce it for free by throwing EEXIST on a
    // regular file.
    if (!stats.isDirectory()) {
      return false;
    }
    if (typeof process.getuid !== 'function') {
      // No POSIX ownership model (Windows). The roots there are per-user OS
      // temp dirs, not a shared /tmp, so cross-user planting is not a concern.
      return true;
    }
    if (stats.uid !== process.getuid()) {
      return false;
    }
    // Any group or other bit at all, not just write. Read and execute matter
    // too: a plugin worker socket gets no mode of its own, so the directory is
    // the only thing stopping another local user from reaching it, and search
    // permission on the directory is all they need. The workspace-local
    // fallback dir is created by a bare mkdirSync elsewhere in the daemon, so
    // it is routinely 0755 and would otherwise be accepted as-is.
    if (stats.mode & 0o077) {
      // Try to lock it down; if we can't, refuse.
      if (!chmodRealDirectory(dir, 0o700)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
