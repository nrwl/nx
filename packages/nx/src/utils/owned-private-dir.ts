import {
  closeSync,
  constants,
  fchmodSync,
  lstatSync,
  mkdirSync,
  openSync,
} from 'node:fs';

/**
 * chmod a path without ever following a symlink at its final component.
 *
 * A plain `chmodSync` resolves symlinks, so calling it on a path another local
 * user pre-created as a link retargets the mode change onto whatever the link
 * points at. `O_NOFOLLOW` makes the kernel refuse to open a symlink at all
 * (ELOOP), and the mode is then applied to the descriptor rather than the path,
 * so there is no window in which the path could be swapped between the check
 * and the change.
 */
function chmodNoFollow(path: string, mode: number): void {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    fchmodSync(fd, mode);
  } finally {
    closeSync(fd);
  }
}

/**
 * Best-effort relax a *shared* root to sticky + world-writable (0o1777, like
 * /tmp) so that every user on the machine can create their own private
 * directory beneath it. Only the shared root is relaxed; the per-user
 * directories underneath are locked down by `ensureOwnedPrivateDir`.
 *
 * Failure is expected and ignored: chmod only succeeds for the user that
 * created the root, and whoever got there first has already set the mode. Each
 * root is handled independently so one failing does not skip the others — a
 * root left un-relaxed locks every other user out of it.
 */
export function relaxSharedRootToSticky(dir: string): void {
  if (process.platform === 'win32') {
    return;
  }
  try {
    chmodNoFollow(dir, 0o1777);
  } catch {}
}

/**
 * Ensure `dir` exists, is owned by the current user, is a real directory (not a
 * symlink), and is not writable by group or other (mode 0700). Returns false if
 * it exists but fails any of those checks — i.e. it may have been planted by
 * another user through a world-writable parent.
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
  if (typeof process.getuid !== 'function') {
    // No POSIX ownership model (Windows). The roots there are per-user OS temp
    // dirs, not a shared /tmp, so cross-user planting is not a concern.
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
    // Any group or other bit at all, not just write. Read and execute matter
    // too: a plugin worker socket gets no mode of its own, so the directory is
    // the only thing stopping another local user from reaching it, and search
    // permission on the directory is all they need. The workspace-local
    // fallback dir is created by a bare mkdirSync elsewhere in the daemon, so
    // it is routinely 0755 and would otherwise be accepted as-is.
    if (stats.mode & 0o077) {
      // Try to lock it down; if we can't, refuse.
      try {
        chmodNoFollow(dir, 0o700);
      } catch {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
