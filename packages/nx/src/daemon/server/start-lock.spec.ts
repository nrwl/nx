import { spawnSync } from 'child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'fs';
import { createServer, Server } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';

const h = vi.hoisted(() => {
  const { mkdtempSync } = require('fs');
  const { tmpdir } = require('os');
  const { join } = require('path');
  return {
    daemonDir: mkdtempSync(join(tmpdir(), 'nx-start-lock-daemon-dir-')),
    registration: {
      value: null as {
        processId?: number;
        socketPath?: string;
        nxVersion?: string;
      } | null,
    },
  };
});

vi.mock('../cache', () => ({
  readDaemonRegistrationSync: () => h.registration.value,
}));
vi.mock('../tmp-dir', () => ({
  DAEMON_DIR_FOR_CURRENT_WORKSPACE: h.daemonDir,
}));

import {
  acquireDaemonStartLock,
  daemonSocketAccepts,
  findHealthyDaemonOwner,
  isProcessAlive,
  releaseDaemonStartLock,
} from './start-lock';
import { nxVersion } from '../../utils/versions';

/**
 * A pid that is genuinely gone, rather than one assumed to be free: spawn a
 * process that does nothing and wait for it to exit.
 */
function deadPid(): number {
  const { pid } = spawnSync(process.execPath, ['-e', '']);
  return pid;
}

function age(path: string, msAgo: number): void {
  const when = new Date(Date.now() - msAgo);
  utimesSync(path, when, when);
}

describe('daemon start lock', () => {
  let dir: string;
  let lockFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-start-lock-'));
    lockFile = join(dir, 'daemon-start.lock');
    h.registration.value = null;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates the lock and writes the holder pid', async () => {
    expect(await acquireDaemonStartLock(lockFile)).toBe(true);
    expect(readFileSync(lockFile, 'utf8')).toEqual(String(process.pid));
  });

  // Both tests below arrange their failure by taking write permission off a
  // directory. Windows does not honour the mode bits that way, and root ignores
  // them outright, so on either the arrangement quietly succeeds instead.
  const asUser = it.skipIf(
    process.platform === 'win32' || process.getuid?.() === 0
  );

  asUser(
    'gives up at once when the lock cannot be created at all',
    async () => {
      // EEXIST is the only error waiting can resolve. Anything else - here a
      // directory this process may not write - must come back as a refusal
      // rather than a throw, and must not spend the deadline first.
      chmodSync(dir, 0o500);
      try {
        const startedAt = Date.now();
        expect(await acquireDaemonStartLock(lockFile, 5_000)).toBe(false);
        expect(Date.now() - startedAt).toBeLessThan(1_000);
        expect(existsSync(lockFile)).toBe(false);
      } finally {
        chmodSync(dir, 0o700);
      }
    }
  );

  asUser(
    'gives up at the deadline when an abandoned lock cannot be removed, without spinning',
    async () => {
      // A takeover that keeps failing is the one path through the loop with no
      // held lock to wait on, so nothing yields except the loop's own sleep.
      // Wall time cannot see whether it does: the deadline bounds it either
      // way. CPU can - a sleeping loop spends single-digit milliseconds of it
      // over this budget, a spinning one spends the budget.
      writeFileSync(lockFile, '');
      age(lockFile, 10 * 60_000);
      chmodSync(dir, 0o500);
      try {
        const startedAt = Date.now();
        const cpuBefore = process.cpuUsage();
        expect(await acquireDaemonStartLock(lockFile, 200, 60_000)).toBe(false);
        const cpu = process.cpuUsage(cpuBefore);
        expect(Date.now() - startedAt).toBeLessThan(3_000);
        expect((cpu.user + cpu.system) / 1_000).toBeLessThan(100);
      } finally {
        chmodSync(dir, 0o700);
      }
    }
  );

  it('refuses to take a lock held by a live process, and gives up at the deadline', async () => {
    writeFileSync(lockFile, String(process.pid));

    const startedAt = Date.now();
    expect(await acquireDaemonStartLock(lockFile, 200)).toBe(false);
    // It waited rather than failing on the first EEXIST.
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(100);
    // And left the holder's lock alone.
    expect(existsSync(lockFile)).toBe(true);
  });

  it('does not take an old lock away from a live holder', async () => {
    // The lock now spans a whole boot, so age alone must not evict a holder
    // that is simply slow: a large workspace legitimately takes minutes.
    writeFileSync(lockFile, String(process.pid));
    age(lockFile, 10 * 60_000);

    expect(await acquireDaemonStartLock(lockFile, 200, 60_000)).toBe(false);
    expect(readFileSync(lockFile, 'utf8')).toEqual(String(process.pid));
  });

  it('takes over a lock a live holder has held far past any real boot', async () => {
    // Liveness cannot separate the original holder from a process that
    // inherited its pid, and the lock file lives long enough for that to
    // happen: it survives a reboot, after which pids restart from 1. Without
    // an upper bound such a file is never removed, and every later start pays
    // the full acquire budget before booting unserialised.
    writeFileSync(lockFile, String(process.ppid));
    age(lockFile, 40 * 60_000);

    expect(await acquireDaemonStartLock(lockFile, 200, 60_000)).toBe(true);
    expect(readFileSync(lockFile, 'utf8')).toEqual(String(process.pid));
  });

  it('takes over a lock whose holder is gone', async () => {
    writeFileSync(lockFile, String(deadPid()));

    expect(await acquireDaemonStartLock(lockFile, 200)).toBe(true);
    expect(readFileSync(lockFile, 'utf8')).toEqual(String(process.pid));
  });

  it('takes over an old lock whose holder cannot be identified', async () => {
    // openSync publishes the file before writeSync fills it, so an empty lock
    // file is a real state; there is no pid to ask about, only age.
    writeFileSync(lockFile, '');
    age(lockFile, 10 * 60_000);

    expect(await acquireDaemonStartLock(lockFile, 200, 60_000)).toBe(true);
    expect(readFileSync(lockFile, 'utf8')).toEqual(String(process.pid));
  });

  it('waits on an unidentified lock that is still young', async () => {
    writeFileSync(lockFile, '');

    expect(await acquireDaemonStartLock(lockFile, 200, 60_000)).toBe(false);
    expect(readFileSync(lockFile, 'utf8')).toEqual('');
  });

  it('releases only a lock this process holds', () => {
    writeFileSync(lockFile, String(deadPid()));
    releaseDaemonStartLock(true, lockFile);
    expect(existsSync(lockFile)).toBe(true);

    writeFileSync(lockFile, String(process.pid));
    releaseDaemonStartLock(true, lockFile);
    expect(existsSync(lockFile)).toBe(false);
  });

  it('does not release a lock it never took', () => {
    writeFileSync(lockFile, String(process.pid));
    releaseDaemonStartLock(false, lockFile);
    expect(existsSync(lockFile)).toBe(true);
  });
});

describe('isProcessAlive', () => {
  it('is true for this process and false for one that has exited', () => {
    expect(isProcessAlive(process.pid)).toBe(true);
    expect(isProcessAlive(deadPid())).toBe(false);
  });
});

describe('findHealthyDaemonOwner', () => {
  let dir: string;
  let socketPath: string;
  let server: Server | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-owner-'));
    socketPath = join(dir, 's');
    h.registration.value = null;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((res) => server!.close(() => res()));
      server = undefined;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  const listen = () =>
    new Promise<void>((res) => {
      server = createServer();
      server.listen(socketPath, () => res());
    });

  /**
   * A registration for a daemon of this same nx version - the ordinary case.
   * Spelled out rather than left undefined so the mismatch tests below have a
   * matching case to differ from: with the field absent, every test here would
   * silently take the mismatch branch and none could catch a regression on the
   * other one.
   */
  const registered = (over: {
    processId?: number;
    socketPath?: string;
    nxVersion?: string;
  }) => ({ nxVersion, ...over });

  it('reports no owner when nothing is registered', async () => {
    expect(await findHealthyDaemonOwner(true)).toBeNull();
  });

  it('reports no owner when the registered pid is gone', async () => {
    h.registration.value = registered({ processId: deadPid(), socketPath });
    expect(await findHealthyDaemonOwner(true)).toBeNull();
  });

  it('reports no owner when the registration names this process', async () => {
    h.registration.value = registered({ processId: process.pid, socketPath });
    expect(await findHealthyDaemonOwner(true)).toBeNull();
  });

  it('stands down for a registration whose own socket answers', async () => {
    await listen();
    h.registration.value = registered({ processId: process.ppid, socketPath });
    expect(await findHealthyDaemonOwner(true)).toEqual(process.ppid);
  });

  it('claims the workspace when the registered daemon does not answer', async () => {
    h.registration.value = registered({ processId: process.ppid, socketPath });
    expect(await findHealthyDaemonOwner(true)).toBeNull();
  });

  it('probes the socket named by the registration, not one derived here', async () => {
    // The daemon's socket directory hashes the pid of whichever process created
    // it, so a path derived in this process names a socket nobody ever listened
    // on. Registering the live socket under a DIFFERENT path is what separates
    // reading the registration from deriving a path.
    await listen();
    h.registration.value = registered({
      processId: process.ppid,
      socketPath: join(dir, 'not-the-live-one'),
    });
    expect(await findHealthyDaemonOwner(true)).toBeNull();

    h.registration.value = registered({ processId: process.ppid, socketPath });
    expect(await findHealthyDaemonOwner(true)).toEqual(process.ppid);
  });

  it('reports no owner when the registration carries no socket path', async () => {
    h.registration.value = registered({ processId: process.ppid });
    expect(await findHealthyDaemonOwner(true)).toBeNull();
  });

  it('stands down for a live registration without probing when the lock was not taken', async () => {
    // Nothing is listening, so a probe would report the owner unhealthy. Not
    // holding the lock means somebody else is mid-claim: a live registered pid
    // is a daemon still booting, and taking over would recreate the herd.
    h.registration.value = registered({ processId: process.ppid, socketPath });
    expect(await findHealthyDaemonOwner(false)).toEqual(process.ppid);
  });

  it('claims the workspace when the lock was not taken and the registration is dead', async () => {
    h.registration.value = registered({ processId: deadPid(), socketPath });
    expect(await findHealthyDaemonOwner(false)).toBeNull();
  });

  it('claims the workspace from a live answering daemon on another nx version', async () => {
    // The client spawns a starter on a version mismatch and never kills the
    // incumbent, so treating a responsive old daemon as the owner strands the
    // client: its poll resolves the socket through the version check and gets
    // nothing, every attempt, until the budget runs out.
    await listen();
    h.registration.value = registered({
      processId: process.ppid,
      socketPath,
      nxVersion: `${nxVersion}-not`,
    });
    expect(await findHealthyDaemonOwner(true)).toBeNull();
  });

  it('claims the workspace from another nx version even without the lock', async () => {
    // The mid-boot courtesy the lockless branch extends to a live registration
    // does not apply: waiting for a daemon of the wrong version to finish
    // booting waits for something that can never serve this client.
    h.registration.value = registered({
      processId: process.ppid,
      socketPath,
      nxVersion: `${nxVersion}-not`,
    });
    expect(await findHealthyDaemonOwner(false)).toBeNull();
  });
});

describe('daemonSocketAccepts', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-sock-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('is false when nothing is listening', async () => {
    expect(await daemonSocketAccepts(join(dir, 's'), 200)).toBe(false);
  });

  it('is true when a server answers', async () => {
    const socketPath = join(dir, 's');
    const server = createServer();
    await new Promise<void>((res) => server.listen(socketPath, () => res()));
    try {
      expect(await daemonSocketAccepts(socketPath, 200)).toBe(true);
    } finally {
      await new Promise<void>((res) => server.close(() => res()));
    }
  });
});
