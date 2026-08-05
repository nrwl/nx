import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  statSync,
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
 * Where a guard says *why* it refused, when the caller intends to explain
 * itself. Optional, so the guards keep their branded return types: a `Result`
 * wrapper would rewrite every `if (!guard(dir))` call site for a string only
 * the two message-building callers read.
 *
 * The reason names its own directory, so a caller collecting several does not
 * have to track which guard produced which line.
 */
export type RefusalSink = (reason: string) => void;

/** Report and refuse in one expression, so each guard clause stays one line. */
function refuse(why: RefusalSink | undefined, reason: string): null {
  why?.(reason);
  return null;
}

/** `0700`-style rendering, since modes are what these messages are about. */
function asMode(mode: number): string {
  return `0${(mode & 0o7777).toString(8)}`;
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
export function isSafeSharedRoot(
  dir: string,
  why?: RefusalSink
): SafeSharedRoot | null {
  try {
    const stats = lstatSync(dir);
    if (!stats.isDirectory()) {
      return refuse(why, `${dir} is not a directory`);
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
      return refuse(
        why,
        `${dir} belongs to another user (uid ${stats.uid}) rather than to you or to root`
      );
    }
    return !(stats.mode & 0o022) || !!(stats.mode & S_ISVTX)
      ? (dir as SafeSharedRoot)
      : refuse(
          why,
          `${dir} is writable by other users but not sticky (mode ${asMode(
            stats.mode
          )}), so a peer could replace directories inside it`
        );
  } catch (e: any) {
    return refuse(why, `${dir} could not be inspected (${e?.code ?? e})`);
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
 * The remedy for a container `isSafeSharedRoot` refused, or `undefined` when
 * there is nothing the user can do about it. Only a container owned by another
 * unprivileged user has an actionable fix, and it is to hand it to root: Nx
 * cannot chown it, and refusing it is what keeps that user from renaming our
 * directory aside. Returns the message rather than a boolean because the caller
 * needs the text.
 *
 * Unlike the guards above this is an unbranded `string | undefined`. A branded
 * *parameter* would reject it, but no parameter in this module is annotated —
 * every consumer takes a plain `string` — so in a file whose convention is
 * "truthy string = verified path", a truthy English sentence is the one value
 * here that nothing would catch.
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
  dir: string,
  why?: RefusalSink
): EstablishedSharedRoot | null {
  if (process.platform === 'win32') {
    try {
      mkdirSync(dir, { recursive: true });
      return dir as EstablishedSharedRoot;
    } catch (e: any) {
      return refuse(why, `${dir} could not be created (${e?.code ?? e})`);
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
      return refuse(why, `${dir} could not be created (${e?.code ?? e})`);
    }
  }

  // One verdict for both branches. Pre-existing: decide, do not touch. Just
  // created: the chmod above can fail — a sandbox denying it, a mount with no
  // POSIX modes — and what it leaves behind is a peer-writable non-sticky
  // container, which is exactly the mode this predicate refuses. Trusting the
  // creation alone would brand it safe and skip the fall to the home tier.
  return isSafeSharedRoot(dir, why) === null
    ? null
    : (dir as EstablishedSharedRoot);
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
export function ensureOwnedPrivateDir(
  dir: string,
  why?: RefusalSink
): OwnedPrivateDir | null {
  try {
    mkdirSync(dir, { mode: 0o700 });
  } catch (e: any) {
    if (e?.code !== 'EEXIST') {
      return refuse(why, `${dir} could not be created (${e?.code ?? e})`);
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
      return refuse(why, `${dir} is not a directory`);
    }
    if (typeof process.getuid !== 'function') {
      // Windows: the roots there are per-user OS temp dirs, not a shared /tmp.
      return dir as OwnedPrivateDir;
    }
    if (stats.uid !== process.getuid()) {
      return refuse(why, `${dir} is owned by uid ${stats.uid}, not by you`);
    }
    if (stats.mode & 0o077) {
      if (!chmodRealDirectory(dir, 0o700)) {
        return refuse(
          why,
          `${dir} is reachable by other users (mode ${asMode(
            stats.mode
          )}) and could not be tightened to 0700`
        );
      }
    }
    return dir as OwnedPrivateDir;
  } catch (e: any) {
    return refuse(why, `${dir} could not be inspected (${e?.code ?? e})`);
  }
}
