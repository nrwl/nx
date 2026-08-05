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
} from 'node:fs';
import { userInfo } from 'node:os';

/**
 * Each guard's success arm carries its own branded path, so one guard's result
 * cannot be stored in, or passed where the code expects, another's.
 *
 * The failure value is **not** falsy. Three of these guards return
 * `GuardResult<T>`, and a refusal is an object, so `if (!ensureOwnedPrivateDir(d))`
 * is always false and would accept every refused directory — on the path this
 * module exists to secure. Test `.status`, never truthiness. `isOwnedRealDirectory`
 * is the one guard still returning `T | null`, and it is the only one a
 * truthiness test is correct for.
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
/**
 * POSIX: created if absent, owned by us, and carrying no group or other bits —
 * re-locked first if it was looser. The mode is checked on whichever branch
 * produced it, so the brand does not depend on who created the directory. It
 * cannot promise a filesystem that accepts `chmod` and ignores it.
 *
 * Windows: only *is a real directory*. `getuid` is unavailable there, so
 * neither ownership nor mode is checked; `%TMP%` is already per-account.
 */
export type OwnedPrivateDir = string & {
  readonly [ownedPrivateDirBrand]: true;
};

/**
 * Why a guard refused a directory. Data rather than a sentence: the wording is
 * built at the point of display, so a caller can also *decide* on a refusal —
 * which is what lets the "hand it to root" advice attach to the one refusal it
 * applies to instead of being re-derived from a second `lstat`.
 *
 * Every member carries its directory, so a caller aggregating several does not
 * have to track which guard produced which.
 */
export type DirRefusal =
  | { kind: 'not-created'; dir: string; code?: string }
  | { kind: 'not-inspectable'; dir: string; code?: string }
  // `symlink` separates the attack this module exists to detect — a peer
  // planting a link where Nx expects to create a directory — from a stray file
  // or fifo in the way. Both are refused, but only one is worth alarming about,
  // and `ls -ld` on a planted link shows a directory, so "is not a directory"
  // reads as simply wrong there.
  | { kind: 'not-a-directory'; dir: string; symlink?: true }
  // Two members rather than one with a flag. Which advice is correct turns on
  // *which* directory was refused — root can usefully take over the one shared
  // container, and cannot help with a per-user directory — so it is the
  // discriminant `remedyFor` branches on, and `describeRefusal`'s `never` arm
  // forces both wordings to exist. As a flag this was enforced only by comment:
  // adding it to `ensureOwnedPrivateDir`'s deny compiled clean and would have
  // told a user to `chmod 1777` their own home.
  | { kind: 'foreign-owner'; dir: string; uid: number }
  | { kind: 'foreign-shared-container'; dir: string; uid: number }
  | { kind: 'not-tightenable'; dir: string; mode: number }
  | { kind: 'peer-writable-not-sticky'; dir: string; mode: number };

/**
 * A guard's verdict. The branded path moves inside the success arm rather than
 * being the return value, which keeps each guard's type distinct from its
 * siblings' — the only thing the brands were ever doing here, since no caller
 * consumes the path itself.
 */
export type GuardResult<T> =
  | { status: 'ok'; path: T }
  | { status: 'refused'; refusal: DirRefusal };

// Discriminated on a string, not a boolean `ok`. This repo compiles with
// `strict: false`, and under that setting TypeScript does not narrow a union on
// a boolean literal discriminant — `r.ok ? … : r.refusal` fails to compile,
// while `r.status === 'ok'` narrows correctly. Verified against tsc 6.0.3 both
// ways before choosing this shape.
const allow = <T>(path: T): GuardResult<T> => ({ status: 'ok', path });
const deny = <T>(refusal: DirRefusal): GuardResult<T> => ({
  status: 'refused',
  refusal,
});

// Four octal digits, so a sticky container reads `1777` and a plain directory
// `0755` — the notation `chmod` and `ls` use. Prefixing a literal `0` instead
// renders sticky modes as `01777`, which is not a form anyone writes.
/**
 * `lstat` already knows whether the thing in the way is a link, and both guards
 * hold that result — so the distinction costs nothing to carry and is the one
 * the user most needs.
 */
const notADirectory = (dir: string, stats: Stats): DirRefusal =>
  stats.isSymbolicLink()
    ? { kind: 'not-a-directory', dir, symlink: true }
    : { kind: 'not-a-directory', dir };

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

/** Single-quoted for a shell, so a path with a space or quote survives a paste. */
const shellQuote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * What the user can do about a refusal, or `undefined` when there is nothing.
 *
 * Only a shared container held by another unprivileged user has the "hand it to
 * root" fix, which is what `shared` identifies.
 *
 * Who can clear a per-user directory depends on who owns its *parent*, and
 * whether `rm` could work depends on its mode — the refusal carries neither, so
 * the sentence names the condition rather than guessing.
 */
export function remedyFor(r: DirRefusal): string | undefined {
  if (r.kind === 'not-a-directory' && r.symlink) {
    return `${r.dir} is a symlink where Nx expects a directory. If you did not create it, treat it as hostile: remove the link itself (not what it points at) and run the command again.`;
  }
  if (r.kind === 'foreign-owner') {
    return `${r.dir} belongs to another user on this machine, so Nx cannot keep its own directory there. Set NX_SOCKET_DIR to a short directory your user owns, or move it aside — which you can do yourself if you own the directory it sits in, and otherwise needs an administrator.`;
  }
  if (r.kind !== 'foreign-shared-container') {
    return undefined;
  }
  // Unreachable today: `isSafeSharedRoot` denies with this kind only when
  // `stats.uid !== 0`, so a root-owned container never reaches here.
  if (r.uid === 0) {
    return undefined;
  }
  const q = shellQuote(r.dir);
  return `${r.dir} belongs to another user on this machine, so Nx cannot keep a private directory beneath it. Ask an administrator to hand it to root with \`sudo chown root ${q} && sudo chmod 1777 ${q}\`; every user can then keep their own directory under it.`;
}

/**
 * One refusal, as an `Error`, so several can travel in an `AggregateError` and
 * through `cause` chains. Constructed only where a refusal is reported — the
 * guards deal in `DirRefusal` and allocate nothing.
 */
export class DirectoryRefusedError extends Error {
  constructor(readonly refusal: DirRefusal) {
    super(describeRefusal(refusal));
    this.name = 'DirectoryRefusedError';
  }
}

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
 * On POSIX, a container writable by other users must be sticky, and it must be
 * owned by either root or the current user. Windows short-circuits after the
 * directory test — the OS temp root is already scoped to one account, so there
 * is no shared level whose ownership could matter.
 *
 * Sticky directories still let the directory's own owner rename entries, so
 * accepting a container owned by another unprivileged user would let that user
 * replace a previously verified private directory.
 *
 * A current-user-owned container is safe for that user but is deliberately
 * refused by other users. For cross-user use, an administrator only needs to
 * create the single top-level container as root-owned mode 1777; every user can
 * create their own private subtree directly beneath it.
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
      // The shared container: the only directory root can usefully take over,
      // which is why it gets its own kind rather than a flag on the per-user one.
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
 * Whether other users on this machine can write into `dir`.
 *
 * This, and not `process.platform`, is what decides whether refusing a
 * directory may cite other users. `os.tmpdir()` is a world-writable `/tmp` on
 * Linux but a private `0700` `/var/folders/…` on macOS and a per-account path
 * on Windows, so keying that message on the platform tells most macOS users
 * that their own private directory lets a local attacker execute code in their
 * daemon — the exact claim `SocketDirRefusal` exists to keep true.
 *
 * Windows has no answer to give. libuv synthesizes `st_mode` there from the
 * READONLY attribute and copies the owner bits into group and other, so an
 * ordinary per-account directory reports `0666` and the mode test would call
 * every path on the machine peer-writable — the same false claim on a second
 * platform. `false` is the honest answer: `%TMP%` is already scoped to one
 * account.
 *
 * A path that cannot be inspected is reported as *not* peer-writable: this
 * gates the alarming message, so it should be made only when it can be shown.
 *
 * `statSync`, not `lstatSync`: the question is about the directory that will be
 * used, not about the link pointing at it. The error a link introduced ran
 * *both* ways and neither was the safe one — Linux creates symlinks `0777`, so
 * `lstat` reported a private target as peer-writable; macOS applies the umask
 * to `symlink()`, so the usual `0755` reported a world-writable target as
 * private. Nothing here decides whether a path is accepted, so following the
 * link costs nothing the guards above do not already re-check.
 */
export function isPeerWritable(dir: string): boolean {
  if (process.platform === 'win32') {
    return false;
  }
  try {
    return !!(statSync(dir).mode & 0o022);
  } catch {
    return false;
  }
}

/**
 * Create a shared container as sticky + world-writable if it does not exist,
 * and report whether the resulting path is safe for the current user.
 *
 * **A container that already exists is never modified — only judged.** Two
 * things go wrong if the mode is applied first and trust decided after. A
 * process holding `CAP_FOWNER`, which is root's default in Docker and most CI
 * images, can chmod a directory it does not own: a peer-owned `0700` root is
 * taken to `1777` and *then* refused, so Nx widens a directory it has just
 * decided not to trust. And an operator who deliberately tightened this root
 * has it re-widened on every run — measured at `0700`, `0755`, `1700` and
 * `0750`, all already safe, all taken to `1777` with no privilege needed. This
 * function is reached from `getSocketDir`, `getPluginSocketDir` and the native
 * binding loader, so "every run" is close to every `nx` process.
 *
 * The chmod on the creation path touches only a directory we made a line
 * earlier, which is why it stays — and on macOS it is load-bearing rather than
 * cosmetic, since `mkdir` there never keeps the sticky bit. Its result is not
 * trusted either: both branches end at the same verdict, so a creation whose
 * chmod did not land is refused on its mode like any other. The cost of not
 * repairing a pre-existing root is that a container which is safe but not
 * world-writable keeps peers out of it; they fall to their own home tier rather
 * than having someone else's directory rewritten underneath them.
 *
 * Windows has no shared level to verify — the OS temp root is already
 * per-account — so creation alone is the verdict there.
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
    // Ours, created a statement ago. Not only a umask repair: XNU strips
    // S_ISVTX at mkdir, so on macOS the sticky bit exists solely because of
    // this call.
    chmodRealDirectory(dir, 0o1777);
  } catch (e: any) {
    if (e?.code !== 'EEXIST') {
      return deny({ kind: 'not-created', dir, code: e?.code });
    }
  }

  // One verdict for both branches. Pre-existing: decide, do not touch. Just
  // created: the chmod above can fail — a sandbox denying it, a mount with no
  // POSIX modes — and what it leaves behind is a peer-writable non-sticky
  // container, which is exactly the mode this predicate refuses. Trusting the
  // creation alone would brand it safe and skip the fall to the home tier.
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

  // One verdict for both branches, as in `ensureSafeSharedRoot`. `mkdir` masks
  // its mode argument with the umask, so on a POSIX-conformant filesystem the
  // result can only be tighter than 0700 and this costs one lstat. It earns its
  // keep on mounts that ignore the mode entirely — WSL2 `drvfs` without
  // metadata, CIFS with `dir_mode`, FAT — where a directory Nx asked for at
  // 0700 can land 0777.
  //
  // Not a new failure mode for those mounts: the directory exists from the
  // second run onward, so they already reach this check on every run but the
  // first. Branding only the creation path meant the same directory in the same
  // environment got a different verdict depending on who made it.
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
      // Re-read rather than trust the chmod's return, matching the sibling
      // guard. A mount that ignores the mode argument — WSL2 `drvfs` without
      // metadata, CIFS with `dir_mode`, FAT — accepts `fchmod` and reports
      // success while leaving the directory `0777`. Detecting that and then
      // branding it anyway is the reported bug still present, on the guard that
      // stands in front of the socket directory and the directory a `.node` is
      // loaded from. One extra stat, and only on the already-loose path.
      if (!chmodRealDirectory(dir, 0o700)) {
        return deny({ kind: 'not-tightenable', dir, mode: stats.mode });
      }
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
