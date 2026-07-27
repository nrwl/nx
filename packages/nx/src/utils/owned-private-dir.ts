import { chmodSync, lstatSync, mkdirSync } from 'node:fs';

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
