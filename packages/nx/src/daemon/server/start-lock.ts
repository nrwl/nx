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
 * Serialises the claim on a workspace during daemon startup. Held until the
 * server is listening, so "held" means "a daemon is booting or serving".
 */

export const DAEMON_START_LOCK_FILE = join(
  DAEMON_DIR_FOR_CURRENT_WORKSPACE,
  'daemon-start.lock'
);

// Outlasts a cold start on a large workspace: the lock is held until listen().
export const DAEMON_START_LOCK_TIMEOUT_MS = 60_000;
// For a lock whose holder pid cannot be read; a readable pid is settled by liveness.
export const DAEMON_START_LOCK_MAX_AGE_MS = 5 * 60_000;
// For a live holder: the lock file survives a reboot, after which an unrelated
// process can own the pid in it. Decides only whether the file is ever removed.
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
    // finish() can run twice (connect and timeout); both calls in it are idempotent.
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
 * The pid of the daemon that owns this workspace, or null if this process should
 * take over. Without the lock somebody is mid-claim, so a live registered pid is
 * trusted without probing its socket.
 */
export async function findHealthyDaemonOwner(
  lockHeld: boolean
): Promise<number | null> {
  const registration = readDaemonRegistrationSync();
  const ownerPid = registration?.processId;
  if (!ownerPid || ownerPid === process.pid || !isProcessAlive(ownerPid)) {
    return null;
  }

  // Another nx version is never an owner: an outdated daemon retires itself, so
  // this is one that cannot, and standing down for it strands a client that may
  // not read its socket (VersionMismatchError).
  if (registration.nxVersion !== nxVersion) {
    return null;
  }

  if (!lockHeld) {
    return ownerPid;
  }

  // From the registration: the socket directory name hashes the creator's pid,
  // so a path derived here would never be the owner's.
  if (!registration.socketPath) {
    return null;
  }
  return (await daemonSocketAccepts(registration.socketPath)) ? ownerPid : null;
}

/** Infinity when the file cannot be stat'd, so an unreadable lock counts as expired. */
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
        // Not held by anybody (a read-only directory, say): waiting will not fix it.
        return false;
      }
    }
    // Only the create is in that try: a write failing after it would leave a
    // lock file with no pid, which liveness cannot settle.
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
      // The file can be found empty: Number('') is 0, and signal 0 to pid 0
      // succeeds, hence the `> 0`.
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
      // Two starters can judge the same lock abandoned, and the slower one then
      // removes the lock the faster just created. A path-addressed file cannot
      // close that window; the worst outcome is two daemons, after a mid-claim death.
      try {
        unlinkSync(lockFile);
        removed = true;
      } catch (err) {
        // ENOENT: somebody removed it first, which is all this wanted.
        removed = (err as NodeJS.ErrnoException)?.code === 'ENOENT';
      }
    }

    // Checked before the sleep so a lapsed deadline is not paid for twice.
    if (Date.now() > deadline) {
      return false;
    }
    // Yield whenever the file was left in place, takeover included: gated on
    // `abandoned`, a removal that keeps failing spins a full core until the deadline.
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
