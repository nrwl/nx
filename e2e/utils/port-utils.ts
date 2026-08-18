import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

/**
 * Reserves a port across parallel processes on the same host via an atomic
 * lock file. Avoids the TOCTOU race of probing port 0 and then binding it
 * seconds later — another parallel process could be handed the same port in
 * between.
 *
 * Starts at 6100 (outside the framework-default zone of 3000/4200/5173/8080/etc.)
 * so reserved ports never collide with parallel tests that generate apps
 * without explicitly pinning the dev-server port.
 *
 * Caveat: this reserves the port *number* against other `reservePort()`
 * callers; it does not hold the OS socket open. A consumer that binds the
 * port much later (e.g. after a long webpack compile) is still racing
 * anything that does not participate in this scheme.
 */
const LOCK_DIR = path.join(os.tmpdir(), 'nx-e2e-port-locks');
fs.mkdirSync(LOCK_DIR, { recursive: true });

const RANGE_FLOOR = 6100;
const RANGE_CEILING = 65000;
// Spread of the randomised scan origin (see reservePort). Wide enough that
// reservations scatter thinly across nearly the whole range, so a squatter
// (a leaked dev server, or anything binding a port mid-compile) is unlikely
// to land on the specific port a test reserved.
const SCAN_SPREAD = 55000;
// A lock older than this is treated as abandoned even when its PID still
// resolves (the PID may have been recycled). Comfortably above the longest
// e2e test timeout so a legitimately long-held port is never stolen.
const STALE_LOCK_MS = 60 * 60 * 1000;
// Whether to reclaim abandoned lock files. In CI each agent is an ephemeral
// container, so stale locks cannot carry across runs; combined with the wide
// scan spread, the few a timeout-killed task may leave are immaterial. An
// existing lock is simply treated as taken. Reclamation only earns its keep
// on a developer's machine, where /tmp persists across runs.
const RECLAIM_ABANDONED_LOCKS = !process.env.CI;

// Lock files held by THIS process. A single exit handler frees them all,
// rather than registering one listener per reservePort() call.
const heldLocks = new Set<string>();
process.once('exit', () => {
  for (const lock of heldLocks) {
    try {
      fs.unlinkSync(lock);
    } catch {}
  }
});

function lockPath(port: number): string {
  return path.join(LOCK_DIR, `${port}.lock`);
}

/**
 * A lock is abandoned if its owning process is gone, or it is older than
 * STALE_LOCK_MS. A SIGKILLed e2e process never runs its exit handler, so
 * without this its locks would block those ports for every later run.
 */
function isAbandonedLock(lock: string): boolean {
  let stat: fs.Stats;
  let pid: number;
  try {
    stat = fs.statSync(lock);
    pid = parseInt(fs.readFileSync(lock, 'utf8').trim(), 10);
  } catch {
    return true; // vanished between checks — treat as free
  }
  if (Date.now() - stat.mtimeMs > STALE_LOCK_MS) return true;
  if (!pid) return false;
  try {
    process.kill(pid, 0); // signal 0: existence check, does not kill
    return false; // owner still alive
  } catch (err) {
    // ESRCH: no such process → abandoned. EPERM: exists, not ours → alive.
    return (err as NodeJS.ErrnoException).code === 'ESRCH';
  }
}

/** Atomically claim the lock for `port`; returns true on success. */
function claimLock(port: number): boolean {
  const lock = lockPath(port);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
      heldLocks.add(lock);
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
    // Lock exists. Outside CI, reclaim it once if abandoned then retry the
    // claim; in CI an existing lock is simply treated as taken.
    if (!RECLAIM_ABANDONED_LOCKS || !isAbandonedLock(lock)) return false;
    try {
      fs.unlinkSync(lock);
    } catch {}
  }
  return false;
}

function releaseLock(port: number): void {
  const lock = lockPath(port);
  heldLocks.delete(lock);
  try {
    fs.unlinkSync(lock);
  } catch {}
}

export async function reservePort(start = RANGE_FLOOR): Promise<number> {
  // Randomise the scan origin so parallel e2e processes spread across the
  // range instead of all converging on — and fighting over — the low ports.
  // The scan wraps around so the whole [start, RANGE_CEILING) range is covered
  // even when the origin lands high; otherwise the ports below it are skipped
  // and we could throw spuriously while ports are still free.
  const span = RANGE_CEILING - start;
  const origin = Math.floor(Math.random() * Math.min(SCAN_SPREAD, span));
  for (let i = 0; i < span; i++) {
    const port = start + ((origin + i) % span);
    if (!claimLock(port)) continue;
    // Lock claimed; verify the OS port is actually free. Another e2e test on
    // the same agent may be using it via a generator default (i.e. without
    // participating in the lock scheme), so an exclusive lock is not enough.
    if (await isPortAvailable(port)) {
      return port;
    }
    releaseLock(port);
  }
  throw new Error('No available ports');
}

/**
 * Reserves `count` *consecutive* ports and returns them in ascending order.
 *
 * The contiguity matters: module federation e2e tests pass `ports[0]` as the
 * host's `--devServerPort`, and the generator then wires the host to its
 * remotes at `ports[0] + 1`, `+ 2`, ... — so the reserved ports must be a
 * contiguous run for the host and remotes to line up.
 */
export async function reservePorts(count: number): Promise<number[]> {
  if (count <= 1) {
    return count === 1 ? [await reservePort()] : [];
  }
  // Randomise the scan origin (same rationale as reservePort) and wrap around
  // so every valid window start is tried, then return the first window of
  // `count` consecutive ports that are all claimable and actually free.
  const lastStart = RANGE_CEILING - count;
  const numStarts = lastStart - RANGE_FLOOR + 1;
  const origin = Math.floor(Math.random() * Math.min(SCAN_SPREAD, numStarts));
  for (let i = 0; i < numStarts; i++) {
    const start = RANGE_FLOOR + ((origin + i) % numStarts);
    const claimed: number[] = [];
    for (let port = start; port < start + count; port++) {
      if (!claimLock(port)) break;
      if (!(await isPortAvailable(port))) {
        releaseLock(port);
        break;
      }
      claimed.push(port);
    }
    if (claimed.length === count) {
      return claimed;
    }
    // Window failed partway — release whatever we managed to claim in it.
    for (const port of claimed) {
      releaseLock(port);
    }
  }
  throw new Error(`No available run of ${count} consecutive ports`);
}

/**
 * @deprecated Use {@link reservePort} — probing the OS for port 0 opens a
 * TOCTOU race across parallel e2e processes. Kept for backwards compatibility.
 */
export async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);

    server.listen(0, () => {
      const addressInfo = server.address();
      if (!addressInfo || typeof addressInfo === 'string') {
        reject(new Error('Failed to get server address'));
        return;
      }
      const port = addressInfo.port;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

/**
 * @deprecated Use {@link reservePorts}.
 */
export async function getAvailablePorts(count: number): Promise<number[]> {
  const ports: number[] = [];
  for (let i = 0; i < count; i++) {
    const port = await getAvailablePort();
    ports.push(port);
  }
  return ports;
}

/**
 * Checks if a specific port is available
 *
 * @param port - Port number to check
 * @returns Promise<boolean> - True if port is available, false otherwise
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
}
