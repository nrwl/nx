import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'fs';
import { connect } from 'net';
import { dirname, join } from 'path';
import { readDaemonRegistrationSync } from '../cache';
import { DAEMON_DIR_FOR_CURRENT_WORKSPACE } from '../tmp-dir';
import { nxVersion } from '../../utils/versions';

/**
 * Serialises the "claim this workspace" step of daemon startup.
 *
 * Writing the daemon registration is a read-then-write over a file that every
 * starter races for. Unserialised, every daemon spawned inside one start window
 * passes the check and writes the registration; the outdated-check interval
 * then kills all but one - after each has already subscribed a recursive
 * watcher over the workspace and set up its workspace context.
 *
 * The lock is held for the whole boot rather than just the write, so that "the
 * start lock is held" means "a daemon is booting or serving". A starter that
 * arrives mid-boot then waits and finds a daemon that answers, instead of
 * reading an as-yet-silent socket as a vacant workspace.
 */

export const DAEMON_START_LOCK_FILE = join(
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  'daemon-start.lock'
);

// The lock spans the whole boot - claim to server.listen() - so this budget has
// to outlast a cold start on a large workspace, not just the few syscalls the
// claim itself costs. A starter that gives up here still stands down for a live
// registration (see findHealthyDaemonOwner); it only loses the socket probe.
export const DAEMON_START_LOCK_TIMEOUT_MS = 60_000;
// Backstop for a lock file whose holder cannot be identified at all. A readable
// pid is settled by liveness first; without one there is nothing else to go on.
export const DAEMON_START_LOCK_MAX_AGE_MS = 5 * 60_000;
// Upper bound for a lock whose holder pid is readable AND alive. Liveness on
// its own cannot tell the original holder from an unrelated process that
// inherited its pid, and the lock file lives in the workspace data directory:
// it survives a reboot, after which pids restart from 1. Without this bound a
// reused pid pins the lock permanently and every later start burns the whole
// acquire budget before booting unserialised. Far above any real boot, because
// it is not deciding how long to wait for a slow holder - the acquire timeout
// already does that - only whether the file is ever cleaned up at all.
export const DAEMON_START_LOCK_MAX_HOLD_MS = 30 * 60_000;

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists, it just belongs to another user.
    return (err as NodeJS.ErrnoException)?.code === 'EPERM';
  }
}

export function daemonSocketAccepts(
  socketPath: string,
  timeoutMs = 1_000
): Promise<boolean> {
  return new Promise((resolve) => {
    // finish() is reachable more than once - a connect and the timeout can both
    // fire - and both calls it makes are idempotent: resolve() is first-call-
    // wins, and destroy() on an already-destroyed socket is a documented no-op.
    const finish = (accepted: boolean) => {
      socket.destroy();
      resolve(accepted);
    };
    const socket = connect(socketPath);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    setTimeout(() => finish(false), timeoutMs).unref();
  });
}

/**
 * The pid of a daemon that already owns this workspace, or null if this process
 * should become the daemon.
 *
 * How much the registration is worth depends on whether this process holds the
 * start lock. Holding it means nobody else is mid-claim, so a registered daemon
 * that does not answer on its socket is broken and this process should take
 * over. Without it the wait lapsed, somebody is claiming right now, and a live
 * registered pid is far likelier to be a daemon still booting than a dead one -
 * standing down keeps a slow boot from producing the very herd this exists to
 * prevent.
 */
export async function findHealthyDaemonOwner(
  lockHeld: boolean
): Promise<number | null> {
  const registration = readDaemonRegistrationSync();
  const ownerPid = registration?.processId;
  if (!ownerPid || ownerPid === process.pid || !isProcessAlive(ownerPid)) {
    return null;
  }

  // A daemon on another nx version is never an owner, however alive and
  // responsive it is. An incumbent that is merely outdated retires itself: its
  // own 20ms outdated-check interval reaches getInstalledNxVersion(), which
  // re-reads the workspace's nx/package.json on every call, so it notices the
  // upgrade within a tick and shuts down without restarting. What reaches this
  // branch is the incumbent that cannot - one wedged mid-boot or mid-tick, or
  // caught inside that 20ms window. Standing down for it would leave the
  // client polling a socket path it is never allowed to read:
  // readDaemonProcessJsonCache() raises VersionMismatchError on every attempt,
  // which the poll swallows, until the whole budget is spent. Displacing the
  // incumbent is the only outcome that lets the client make progress.
  if (registration.nxVersion !== nxVersion) {
    return null;
  }

  if (!lockHeld) {
    return ownerPid;
  }

  // The socket path has to come from the owner's own registration: it cannot be
  // derived here, because the socket directory name hashes the pid of whichever
  // process created it (see daemon/tmp-dir.ts). Deriving it would probe a path
  // belonging to this process, on which nothing has ever listened.
  if (!registration.socketPath) {
    return null;
  }
  return (await daemonSocketAccepts(registration.socketPath)) ? ownerPid : null;
}

/**
 * Age of the lock file, or Infinity when it cannot be stat'd - a lock nothing
 * can be learned about is treated as expired, exactly like an old one.
 */
function lockFileAgeMs(lockFile: string): number {
  try {
    return Date.now() - statSync(lockFile).mtimeMs;
  } catch {
    return Infinity;
  }
}

export async function acquireDaemonStartLock(
  lockFile: string = DAEMON_START_LOCK_FILE,
  timeoutMs: number = DAEMON_START_LOCK_TIMEOUT_MS,
  maxAgeMs: number = DAEMON_START_LOCK_MAX_AGE_MS
): Promise<boolean> {
  mkdirSync(dirname(lockFile), { recursive: true });
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    let fd: number | undefined;
    try {
      fd = openSync(lockFile, 'wx');
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== 'EEXIST') {
        // Anything other than "somebody holds it" - a read-only directory,
        // say - is not something waiting will fix.
        return false;
      }
    }
    // Only the create belongs in that try. A write that fails after it leaves
    // a lock file nobody can be read out of, and an unidentified holder is the
    // one case with no liveness to settle it: every later starter would wait
    // out the full age backstop for a lock this process never took.
    if (fd !== undefined) {
      try {
        writeSync(fd, String(process.pid));
        return true;
      } catch {
        try {
          unlinkSync(lockFile);
        } catch {}
        return false;
      } finally {
        closeSync(fd);
      }
    }

    let holderPid: number | null = null;
    try {
      // openSync publishes the file before writeSync fills it, so a reader can
      // legitimately find it empty. Number('') is 0, and signal 0 sent to pid 0
      // targets this process group and succeeds - hence the explicit `> 0`,
      // without which an empty lock file reads as held by a live process.
      const pid = Number(readFileSync(lockFile, 'utf8').trim());
      if (Number.isInteger(pid) && pid > 0) {
        holderPid = pid;
      }
    } catch {}

    const abandoned =
      holderPid !== null
        ? !isProcessAlive(holderPid) ||
          lockFileAgeMs(lockFile) > DAEMON_START_LOCK_MAX_HOLD_MS
        : lockFileAgeMs(lockFile) > maxAgeMs;

    let removed = false;
    if (abandoned) {
      // Two starters can both judge the same lock abandoned, and the slower one
      // can then remove a lock the faster one has already created in its place.
      // The lock is addressed by path throughout, so this window cannot be
      // closed here. What bounds it is that both then reach the ownership check
      // together and, with no registration to find, both boot: two daemons
      // racing the outdated-check interval is the worst it degrades to, and it
      // takes a daemon dying mid-claim to get there.
      try {
        unlinkSync(lockFile);
        removed = true;
      } catch (err) {
        // ENOENT is somebody else having removed it first - the file is gone
        // either way, which is all this branch wanted.
        removed = (err as NodeJS.ErrnoException)?.code === 'ENOENT';
      }
    }

    // Checked before the sleep so a lapsed deadline is not paid for twice.
    if (Date.now() > deadline) {
      return false;
    }
    // Every iteration that left the lock file in place yields, the takeover
    // branch included - so the gate is the removal, not the verdict that
    // preceded it. Gated on `abandoned` alone, a removal that keeps failing (an
    // unwritable directory) retries openSync/readFileSync/statSync/unlinkSync
    // with nothing awaited until the deadline: a full core for the whole
    // budget, 60s of it in production.
    if (!removed) {
      await new Promise((res) => setTimeout(res, 25));
    }
  }
}

export function releaseDaemonStartLock(
  held: boolean,
  lockFile: string = DAEMON_START_LOCK_FILE
): void {
  if (!held) {
    return;
  }
  try {
    if (Number(readFileSync(lockFile, 'utf8').trim()) === process.pid) {
      unlinkSync(lockFile);
    }
  } catch {}
}
