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
 *
 * `O_DIRECTORY` is not redundant: without it a regular file planted at the path
 * would be opened and chmod-ed, and a FIFO would block `openSync` forever
 * waiting for a writer — a hang no `catch` can recover from. It also only
 * guards the *final* component; an earlier component is still resolved
 * normally, which is why callers must verify the shared root separately
 * (`isSafeSharedRoot`). A trailing slash likewise defeats `O_NOFOLLOW`, so
 * every path passed here is built with `join`, which never leaves one.
 */
function chmodNoFollow(path: string, mode: number): void {
  const fd = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY
  );
  try {
    fchmodSync(fd, mode);
  } finally {
    closeSync(fd);
  }
}

/**
 * Whether a shared root is safe to create paths underneath: either absent (we
 * will create it) or a real directory. A symlink, a regular file, or anything
 * else means another local user planted it.
 *
 * `chmodNoFollow` protects the component it is handed, but `mkdirSync(...,
 * { recursive: true })` and every path built under the root still resolve the
 * root itself, so an unvalidated root tunnels straight through to whatever the
 * attacker aimed it at. Callers check this *before* creating anything.
 */
export function isSafeSharedRoot(dir: string): boolean {
  try {
    return lstatSync(dir).isDirectory();
  } catch (e: any) {
    // Absent is fine — we create it ourselves. Anything else is not.
    return e?.code === 'ENOENT';
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
 *
 * Returns false only when the root is *hostile* — ELOOP (a planted symlink) or
 * ENOTDIR (a planted file). The caller must not go on to relax a root nested
 * under it, since that inner path resolves through this one. An EPERM, by
 * contrast, just means another user legitimately owns the root, which is the
 * normal shared-machine case and must not stop anything.
 */
export function relaxSharedRootToSticky(dir: string): boolean {
  if (process.platform === 'win32') {
    return true;
  }
  try {
    chmodNoFollow(dir, 0o1777);
    return true;
  } catch (e: any) {
    return e?.code !== 'ELOOP' && e?.code !== 'ENOTDIR';
  }
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
