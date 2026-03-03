import { spawn, execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs';
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
  it('should kill a simple process', (done) => {
    const child = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
    child.unref();
    const pid = child.pid!;
    expect(isAlive(pid)).toBe(true);

    killProcessTree(pid, 'SIGKILL');

    // Give it a moment to actually die
    setTimeout(() => {
      expect(isAlive(pid)).toBe(false);
      done();
    }, 500);
  });

  it('should kill a process tree (parent + children)', (done) => {
    // Spawn a shell that itself spawns a child
    const marker = tmpFile('tree');
    const child = spawn(
      'sh',
      ['-c', `sleep 30 & CHILD=$!; echo $CHILD > ${marker}; wait`],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();
    const parentPid = child.pid!;

    setTimeout(() => {
      // Read the grandchild PID
      const grandchildPid = existsSync(marker)
        ? parseInt(readFileSync(marker, 'utf-8').trim(), 10)
        : NaN;

      expect(isAlive(parentPid)).toBe(true);
      if (!isNaN(grandchildPid)) {
        expect(isAlive(grandchildPid)).toBe(true);
      }

      killProcessTree(parentPid, 'SIGKILL');

      setTimeout(() => {
        expect(isAlive(parentPid)).toBe(false);
        if (!isNaN(grandchildPid)) {
          expect(isAlive(grandchildPid)).toBe(false);
        }
        try {
          unlinkSync(marker);
        } catch {}
        done();
      }, 500);
    }, 500);
  });
});

describeUnix('killProcessTreeGraceful', () => {
  it('should send SIGTERM and wait for process to exit', async () => {
    // Spawn a process that handles SIGTERM and exits cleanly
    const marker = tmpFile('graceful');
    const child = spawn(
      'sh',
      ['-c', `trap "echo cleanup > ${marker}; exit 0" TERM; sleep 30`],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();
    const pid = child.pid!;

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

    await new Promise((r) => setTimeout(r, 300));
    expect(isAlive(pid)).toBe(true);

    const start = Date.now();
    await killProcessTreeGraceful(pid, 'SIGTERM', 5000);
    const elapsed = Date.now() - start;

    expect(isAlive(pid)).toBe(false);
    // Should have waited for the process to finish cleanup (~500ms)
    // but NOT the full grace period (5000ms)
    expect(elapsed).toBeGreaterThanOrEqual(400);
    expect(elapsed).toBeLessThan(3000);

    // Cleanup handler should have run
    await new Promise((r) => setTimeout(r, 100));
    expect(existsSync(marker)).toBe(true);
    try {
      unlinkSync(marker);
    } catch {}
  }, 10000);

  it('should kill entire process tree gracefully', async () => {
    // Create a 3-level process tree:
    //   sh (root) → sh (mid) → sleep (leaf)
    // All should be killed.
    const pidFile = tmpFile('tree-pids');
    const cleanupMarker = tmpFile('tree-cleanup');

    const child = spawn(
      'sh',
      [
        '-c',
        // Root spawns a middle process, which spawns a leaf
        `trap "echo root-cleanup > ${cleanupMarker}; exit 0" TERM; ` +
          `sh -c 'sleep 30 & echo \$\$ > ${pidFile}; wait' & ` +
          `MIDPID=$!; ` +
          `wait`,
      ],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();
    const rootPid = child.pid!;

    // Wait for tree to establish
    await new Promise((r) => setTimeout(r, 500));
    expect(isAlive(rootPid)).toBe(true);

    await killProcessTreeGraceful(rootPid, 'SIGTERM');

    // Root should be dead
    expect(isAlive(rootPid)).toBe(false);

    // Cleanup handler should have run
    await new Promise((r) => setTimeout(r, 200));
    if (existsSync(cleanupMarker)) {
      expect(readFileSync(cleanupMarker, 'utf-8').trim()).toBe('root-cleanup');
    }

    // Clean up temp files
    for (const f of [pidFile, cleanupMarker]) {
      try {
        unlinkSync(f);
      } catch {}
    }
  }, 10000);

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
