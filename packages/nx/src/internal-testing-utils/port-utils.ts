import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

/**
 * Reserves a port across parallel processes on the same host via an atomic
 * lock file. Avoids the TOCTOU race of probing port 0 and then binding it
 * seconds later — another parallel process could be handed the same port in
 * between.
 *
 * NX_E2E_PORT_POOL selects an inclusive CI range, validated against the OS
 * automatic ranges. Configured claims are not released on process exit.
 * Without a configured pool, the range is 10000-64999 with exit cleanup.
 *
 * Caveat: this reserves the port *number* against other `reservePort()`
 * callers; it does not hold the OS socket open. A consumer that binds the
 * port much later (e.g. after a long webpack compile) is still racing
 * anything that does not participate in this scheme.
 */
const LOCK_DIR = path.join(os.tmpdir(), 'nx-e2e-port-locks');
fs.mkdirSync(LOCK_DIR, { recursive: true });

const configuredPool = process.env.NX_E2E_PORT_POOL;
const [RANGE_FLOOR, RANGE_CEILING] = getPortRange();
let poolValidated = false;

function getPortRange(): [number, number] {
  if (!configuredPool) return [10000, 65000];
  const match = /^(\d+)-(\d+)$/.exec(configuredPool);
  const first = Number(match?.[1]);
  const last = Number(match?.[2]);
  if (!match || first < 10000 || last >= 65000 || first > last) {
    throw new Error(
      'NX_E2E_PORT_POOL must specify an inclusive range within 10000-64999'
    );
  }
  return [first, last + 1];
}

function validatePortPool(): void {
  if (!configuredPool || poolValidated) return;
  let values: number[];
  try {
    if (process.platform === 'linux') {
      values = fs
        .readFileSync('/proc/sys/net/ipv4/ip_local_port_range', 'utf8')
        .trim()
        .split(/\s+/)
        .map(Number);
      if (values.length !== 2) throw new Error('Expected two range endpoints');
    } else if (process.platform === 'darwin') {
      const keys = [
        'first',
        'last',
        'hifirst',
        'hilast',
        'lowfirst',
        'lowlast',
      ];
      values = execFileSync(
        '/usr/sbin/sysctl',
        ['-n', ...keys.map((key) => `net.inet.ip.portrange.${key}`)],
        {
          encoding: 'utf8',
          timeout: 5000,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        }
      )
        .trim()
        .split(/\s+/)
        .map(Number);
      if (values.length !== 6) throw new Error('Expected six range endpoints');
    } else {
      throw new Error(`Unsupported platform: ${process.platform}`);
    }
    if (
      values.some(
        (value) => !Number.isInteger(value) || value < 1 || value > 65535
      )
    ) {
      throw new Error('Invalid automatic port range');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot validate NX_E2E_PORT_POOL=${configuredPool}: ${message}`
    );
  }
  for (let i = 0; i < values.length; i += 2) {
    const first = Math.min(values[i], values[i + 1]);
    const last = Math.max(values[i], values[i + 1]);
    if (RANGE_FLOOR <= last && RANGE_CEILING > first) {
      throw new Error(
        `NX_E2E_PORT_POOL=${configuredPool} overlaps automatic port range ${first}-${last}`
      );
    }
  }
  poolValidated = true;
}
// Spread of the randomised scan origin (see reservePort). Wide enough that
// reservations scatter thinly across nearly the whole range, so a squatter
// (a leaked dev server, or anything binding a port mid-compile) is unlikely
// to land on the specific port a test reserved.
const SCAN_SPREAD = 55000;
// A lock older than this is treated as abandoned even when its PID still
// resolves (the PID may have been recycled). Comfortably above the longest
// e2e test timeout so a legitimately long-held port is never stolen.
const STALE_LOCK_MS = 60 * 60 * 1000;
// A CI server can outlive the process that claimed its port. Only local runs
// reclaim claims from earlier processes in their persistent temp directory.
const RECLAIM_ABANDONED_LOCKS = !configuredPool && !process.env.CI;

const heldLocks = new Set<string>();
if (!configuredPool) {
  process.once('exit', () => {
    for (const lock of heldLocks) {
      try {
        fs.unlinkSync(lock);
      } catch {}
    }
  });
}

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
  validatePortPool();
  if (configuredPool && (start < RANGE_FLOOR || start >= RANGE_CEILING)) {
    throw new Error(
      `Port scan start ${start} is outside NX_E2E_PORT_POOL=${configuredPool}`
    );
  }
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
  validatePortPool();
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
 * @deprecated Use {@link reservePort}. Without `NX_E2E_PORT_POOL`, this probes
 * port 0 and closes before returning, leaving a TOCTOU race.
 */
export async function getAvailablePort(): Promise<number> {
  if (configuredPool) {
    return reservePort();
  }
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
