import { spawn } from 'child_process';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { killProcessTree, killProcessTreeGraceful } from '../index';

function tmpFile(prefix: string): string {
  return join(tmpdir(), `nx-test-${prefix}-${randomBytes(4).toString('hex')}`);
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function cleanupPid(pid: number) {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {}
}

// These tests exercise the native killProcessTree / killProcessTreeGraceful
// functions that walk the OS process tree and send signals to all descendants.
// They require spawning real processes (not mocks) since the Rust code uses
// sysinfo to enumerate the process table.
//
// Skip on Windows: Unix signals don't exist there; Windows uses TerminateProcess.
const describeUnix = process.platform === 'win32' ? describe.skip : describe;

describeUnix('killProcessTree', () => {
  const spawnedPids: number[] = [];

  afterEach(() => {
    for (const pid of spawnedPids) {
      cleanupPid(pid);
    }
    spawnedPids.length = 0;
  });

  it('should kill a simple process', (done) => {
    const child = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
    child.unref();
    const pid = child.pid!;
    spawnedPids.push(pid);
    expect(isAlive(pid)).toBe(true);

    killProcessTree(pid, 'SIGKILL');

    // Give it a moment to actually die
    setTimeout(() => {
      expect(isAlive(pid)).toBe(false);
      done();
    }, 500);
  });

  it('should kill a process tree (parent + children)', async () => {
    // Spawn a shell that backgrounds a sleep, writes its PID, then waits
    const marker = tmpFile('tree');
    const child = spawn('sh', ['-c', `sleep 30 & echo $! > ${marker}; wait`], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    const parentPid = child.pid!;
    spawnedPids.push(parentPid);

    // Poll for marker file so the grandchild PID is always verified
    let grandchildPid = NaN;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (existsSync(marker)) {
        grandchildPid = parseInt(readFileSync(marker, 'utf-8').trim(), 10);
        break;
      }
    }
    expect(grandchildPid).not.toBeNaN();
    spawnedPids.push(grandchildPid);

    expect(isAlive(parentPid)).toBe(true);
    expect(isAlive(grandchildPid)).toBe(true);

    killProcessTree(parentPid, 'SIGKILL');

    await new Promise((r) => setTimeout(r, 500));
    expect(isAlive(parentPid)).toBe(false);
    expect(isAlive(grandchildPid)).toBe(false);
    try {
      unlinkSync(marker);
    } catch {}
  }, 10000);
});

describeUnix('killProcessTreeGraceful', () => {
  const spawnedPids: number[] = [];

  afterEach(() => {
    for (const pid of spawnedPids) {
      cleanupPid(pid);
    }
    spawnedPids.length = 0;
  });

  it('should send SIGTERM and wait for process to exit', async () => {
    // Use a single node process (no children) so the bottom-up approach
    // delivers SIGTERM directly and the handler can write the marker.
    const marker = tmpFile('graceful');
    const child = spawn(
      'node',
      [
        '-e',
        `
        const fs = require('fs');
        process.on('SIGTERM', () => {
          fs.writeFileSync('${marker}', 'cleanup');
          process.exit(0);
        });
        setInterval(() => {}, 1000);
        `,
      ],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();
    const pid = child.pid!;
    spawnedPids.push(pid);

    // Wait for process to be running
    await new Promise((r) => setTimeout(r, 300));
    expect(isAlive(pid)).toBe(true);

    await killProcessTreeGraceful(pid, 'SIGTERM');

    // Process should be dead
    expect(isAlive(pid)).toBe(false);

    // Cleanup handler should have run (wrote marker file)
    await new Promise((r) => setTimeout(r, 200));
    expect(existsSync(marker)).toBe(true);
    expect(readFileSync(marker, 'utf-8').trim()).toBe('cleanup');
    try {
      unlinkSync(marker);
    } catch {}
  }, 10000);

  it('should wait for grace period when process is slow to exit', async () => {
    // Spawn a node process that handles SIGTERM but takes time to clean up
    const marker = tmpFile('slow-cleanup');
    const child = spawn(
      'node',
      [
        '-e',
        `
        process.on('SIGTERM', () => {
          // Simulate slow cleanup (500ms)
          setTimeout(() => {
            require('fs').writeFileSync('${marker}', 'done');
            process.exit(0);
          }, 500);
        });
        setInterval(() => {}, 1000);
        `,
      ],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();
    const pid = child.pid!;
    spawnedPids.push(pid);

    await new Promise((r) => setTimeout(r, 300));
    expect(isAlive(pid)).toBe(true);

    const start = Date.now();
    await killProcessTreeGraceful(pid, 'SIGTERM', 5000);
    const elapsed = Date.now() - start;

    expect(isAlive(pid)).toBe(false);
    // Must not have waited the full grace period (5s). The process
    // cleans up in ~500ms, so elapsed should be well under 5s even
    // on a slow CI machine.
    expect(elapsed).toBeLessThan(4500);

    // Cleanup handler should have run
    await new Promise((r) => setTimeout(r, 100));
    expect(existsSync(marker)).toBe(true);
    try {
      unlinkSync(marker);
    } catch {}
  }, 10000);

  it('should SIGKILL a process that ignores SIGTERM after grace period', async () => {
    // Spawn a process that traps (ignores) SIGTERM
    const child = spawn('sh', ['-c', 'trap "" TERM; sleep 30'], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    const pid = child.pid!;
    spawnedPids.push(pid);

    await new Promise((r) => setTimeout(r, 300));
    expect(isAlive(pid)).toBe(true);

    await killProcessTreeGraceful(pid, 'SIGTERM', 1000);

    // SIGKILL is sent but the OS may not reap immediately
    await new Promise((r) => setTimeout(r, 500));
    expect(isAlive(pid)).toBe(false);
  }, 15000);

  it('should resolve quickly when process is already dead', async () => {
    const child = spawn('echo', ['hello'], { stdio: 'ignore' });
    const pid = child.pid!;

    // Wait for it to finish naturally
    await new Promise((r) => child.on('exit', r));
    expect(isAlive(pid)).toBe(false);

    const start = Date.now();
    await killProcessTreeGraceful(pid, 'SIGTERM');
    const elapsed = Date.now() - start;

    // Should return nearly immediately (no grace period needed)
    expect(elapsed).toBeLessThan(1000);
  });
});
