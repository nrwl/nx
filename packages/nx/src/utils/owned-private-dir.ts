/**
 * Directory guards for Nx's runtime state: create a directory only when it is
 * ours and unreachable by other users on this machine.
 *
 * `native/utils/owned_dir.rs` implements the same rules and must change with
 * this file. That copy is the one everything else uses — this one exists
 * because the native binding loader has to place and lock down the `.node`
 * before Rust can be called, so it is the only caller that cannot reach the
 * native implementation. Node builtins only, for the same reason.
 */
import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  statSync,
  type Stats,
  realpathSync,
} from 'node:fs';
import { userInfo } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

// Phantom brands: each guard's success arm carries its own, so one guard's
// verdict cannot be passed where another's is expected.
//
// A refusal is an object, so it is **not** falsy: `if (!ensureOwnedPrivateDir(d))`
// is always false and would accept every refused directory. Test `.status`.
// `isOwnedRealDirectory` is the one guard returning `T | null`, and the only one
// a truthiness test is correct for.
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
/**
 * POSIX: created if absent, owned by us, and carrying no group or other bits —
 * re-locked first if it was looser. The mode is checked on whichever branch
 * produced it, so the brand does not depend on who created the directory.
 *
 * Windows: only *is a real directory*. `getuid` is unavailable there, so
 * neither ownership nor mode is checked; `%TMP%` is already per-account.
 */
export type OwnedPrivateDir = string & {
  readonly [ownedPrivateDirBrand]: true;
};

/** Why a guard refused a directory. Data, not a sentence. */
export type DirRefusal =
  | { kind: 'not-created'; dir: string; code?: string }
  | { kind: 'not-inspectable'; dir: string; code?: string }
  | { kind: 'not-a-directory'; dir: string; symlink?: true }
  // Separate kinds, not one with a flag: which advice is correct turns on which
  // directory was refused, so it has to be the discriminant `remedy_for` (now in
  // native/utils/owned_dir.rs) branches on. Root can take over the shared
  // container; it cannot help with a per-user directory.
  | { kind: 'foreign-owner'; dir: string; uid: number }
  | { kind: 'foreign-shared-container'; dir: string; uid: number }
  | { kind: 'not-tightenable'; dir: string; mode: number }
  | { kind: 'peer-writable-not-sticky'; dir: string; mode: number };

/** A guard's verdict. */
export type GuardResult<T> =
  | { status: 'ok'; path: T }
  | { status: 'refused'; refusal: DirRefusal };

// A string discriminant, not a boolean `ok`: this repo compiles with
// `strict: false`, where TypeScript does not narrow a union on a boolean literal.
const allow = <T>(path: T): GuardResult<T> => ({ status: 'ok', path });
const deny = <T>(refusal: DirRefusal): GuardResult<T> => ({
  status: 'refused',
  refusal,
});

const notADirectory = (dir: string, stats: Stats): DirRefusal =>
  stats.isSymbolicLink()
    ? { kind: 'not-a-directory', dir, symlink: true }
    : { kind: 'not-a-directory', dir };

// Four octal digits, so a sticky container reads `1777` and a plain directory
// `0755` — the notation `chmod` and `ls` use. Prefixing a literal `0` instead
// renders sticky modes as `01777`, which is not a form anyone writes.
const asMode = (mode: number): string =>
  (mode & 0o7777).toString(8).padStart(4, '0');

/** The user-facing sentence for a refusal. The only place wording is decided. */
export function describeRefusal(r: DirRefusal): string {
  switch (r.kind) {
    case 'not-created':
      return `${r.dir} could not be created${r.code ? ` (${r.code})` : ''}`;
    case 'not-inspectable':
      return `${r.dir} could not be inspected${r.code ? ` (${r.code})` : ''}`;
    case 'not-a-directory':
      return r.symlink
        ? `${r.dir} is a symlink, not a real directory — something replaced the path Nx expected to create`
        : `${r.dir} exists and is not a directory`;
    case 'foreign-owner':
      return `${r.dir} is owned by uid ${r.uid}, not by you`;
    case 'foreign-shared-container':
      return `${r.dir} belongs to another user (uid ${r.uid}) rather than to you or to root`;
    case 'not-tightenable':
      return `${r.dir} is reachable by other users (mode ${asMode(
        r.mode
      )}) and could not be tightened to 0700`;
    case 'peer-writable-not-sticky':
      return `${r.dir} is writable by other users but not sticky (mode ${asMode(
        r.mode
      )}), so a peer could replace directories inside it`;
    default: {
      // This repo sets `strict: false` and leaves `noImplicitReturns` unset, so
      // a new DirRefusal member would otherwise compile here and render as
      // `undefined` inside the aggregate message. Assignability to `never` still
      // holds under these settings, so this is a real compile-time guard.
      const unhandled: never = r;
      throw new Error(
        `Unhandled directory refusal: ${(unhandled as any).kind}`
      );
    }
  }
}

/** One refusal as an `Error`, so several can travel in an `AggregateError`. */
export class DirectoryRefusedError extends Error {
  constructor(readonly refusal: DirRefusal) {
    super(describeRefusal(refusal));
    this.name = 'DirectoryRefusedError';
  }
}

/**
 * chmod a path only if it is a real directory, never following a symlink at its
 * final component — `chmodSync` follows them, retargeting the mode change. The
 * directory check is on the descriptor, not the errno: a deny-list fails *open*
 * on codes it does not know. `O_NONBLOCK` stops a planted FIFO blocking `openSync`.
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
 * The spelling to compare a directory by. `resolve` does not dereference
 * symlinks, and on macOS `/tmp` is a symlink to `/private/tmp`, so an
 * exact-match list would wave through an alias of a root it means to refuse.
 *
 * Resolves the longest ancestor that exists and re-appends the rest: Nx's own
 * roots are absent before its first run, and canonicalizing whole paths only
 * would degrade this to a string match on exactly a fresh machine.
 *
 * Only `ENOENT` walks up — any other errno means the path exists and cannot be
 * read through, which `ensureOwnedPrivateDir` cannot establish either.
 */
export function canonicalDir(dir: string): string {
  const resolved = resolve(dir);
  const missing: string[] = [];
  let candidate = resolved;

  // Terminates at the filesystem root, where `dirname` is a fixed point.
  while (dirname(candidate) !== candidate) {
    try {
      return join(realpathSync(candidate), ...missing);
    } catch (e: any) {
      if (e?.code !== 'ENOENT') {
        return resolved;
      }
      missing.unshift(basename(candidate));
      candidate = dirname(candidate);
    }
  }

  // The root itself: resolve it directly rather than walking past it.
  try {
    return join(realpathSync(candidate), ...missing);
  } catch {
    return resolved;
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
 * On POSIX, a container writable by other users must be sticky, and it must be
 * owned by either root or the current user. Windows short-circuits after the
 * directory test — the OS temp root is already scoped to one account, so there
 * is no shared level whose ownership could matter.
 *
 * Sticky directories still let the directory's own owner rename entries, so a
 * container owned by another unprivileged user could replace a previously
 * verified private directory beneath it.
 */
export function isSafeSharedRoot(dir: string): GuardResult<SafeSharedRoot> {
  try {
    const stats = lstatSync(dir);
    if (!stats.isDirectory()) {
      return deny(notADirectory(dir, stats));
    }
    if (process.platform === 'win32') {
      // The OS temp root is already scoped to the current Windows user.
      return allow(dir as SafeSharedRoot);
    }
    if (
      typeof process.getuid === 'function' &&
      stats.uid !== process.getuid() &&
      stats.uid !== 0
    ) {
      return deny({ kind: 'foreign-shared-container', dir, uid: stats.uid });
    }
    return !(stats.mode & 0o022) || !!(stats.mode & S_ISVTX)
      ? allow(dir as SafeSharedRoot)
      : deny({ kind: 'peer-writable-not-sticky', dir, mode: stats.mode });
  } catch (e: any) {
    return deny({ kind: 'not-inspectable', dir, code: e?.code });
  }
}

/**
 * Create a shared container as sticky + world-writable if it does not exist,
 * and report whether the resulting path is safe for the current user.
 *
 * **A container that already exists is never modified — only judged.** Do not
 * chmod before deciding trust: `CAP_FOWNER` (root's default in Docker and most
 * CI images) can chmod a directory it does not own, so a peer-owned root would
 * be widened to `1777` and then refused, and an operator who deliberately
 * tightened this root would have it re-widened on every `nx` process.
 */
export function ensureSafeSharedRoot(
  dir: string
): GuardResult<EstablishedSharedRoot> {
  if (process.platform === 'win32') {
    try {
      mkdirSync(dir, { recursive: true });
      return allow(dir as EstablishedSharedRoot);
    } catch (e: any) {
      return deny({ kind: 'not-created', dir, code: e?.code });
    }
  }

  try {
    mkdirSync(dir, { mode: 0o1777 });
    // Ours, created a statement ago. Load-bearing on macOS: XNU strips S_ISVTX
    // at mkdir, so the sticky bit exists solely because of this call.
    chmodRealDirectory(dir, 0o1777);
  } catch (e: any) {
    if (e?.code !== 'EEXIST') {
      return deny({ kind: 'not-created', dir, code: e?.code });
    }
  }

  // One verdict for both branches: the chmod above can fail and leave a
  // peer-writable non-sticky container, which trusting the creation would brand
  // safe.
  const verdict = isSafeSharedRoot(dir);
  return verdict.status === 'ok'
    ? allow(dir as EstablishedSharedRoot)
    : deny(verdict.refusal);
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
 * re-locked rather than accepted. A `refused` status carries which check said
 * no — usually `foreign-owner` for a directory another user planted, but also
 * `not-created`/`not-inspectable` for a filesystem error, `not-a-directory`, or
 * `not-tightenable` when the re-lock did not land.
 *
 * Node builtins only: reached from the native binding loader.
 */
export function ensureOwnedPrivateDir(
  dir: string
): GuardResult<OwnedPrivateDir> {
  try {
    mkdirSync(dir, { mode: 0o700 });
  } catch (e: any) {
    if (e?.code !== 'EEXIST') {
      return deny({ kind: 'not-created', dir, code: e?.code });
    }
  }

  // One verdict for both branches, as in `ensureSafeSharedRoot`: mounts that
  // ignore the mode argument can land a directory Nx asked for at 0700 on 0777,
  // so the creation path is judged like any other.
  try {
    const stats = lstatSync(dir);
    // Before the Windows short-circuit: "is a real directory" holds on every
    // platform.
    if (!stats.isDirectory()) {
      return deny(notADirectory(dir, stats));
    }
    if (typeof process.getuid !== 'function') {
      // Windows: the roots there are per-user OS temp dirs, not a shared /tmp.
      return allow(dir as OwnedPrivateDir);
    }
    if (stats.uid !== process.getuid()) {
      return deny({ kind: 'foreign-owner', dir, uid: stats.uid });
    }
    if (stats.mode & 0o077) {
      if (!chmodRealDirectory(dir, 0o700)) {
        return deny({ kind: 'not-tightenable', dir, mode: stats.mode });
      }
      // Read the mode back rather than trusting the chmod's return: mounts that
      // ignore modes report success and change nothing.
      const after = lstatSync(dir);
      if (after.mode & 0o077) {
        return deny({ kind: 'not-tightenable', dir, mode: after.mode });
      }
    }
    return allow(dir as OwnedPrivateDir);
  } catch (e: any) {
    return deny({ kind: 'not-inspectable', dir, code: e?.code });
  }
}
