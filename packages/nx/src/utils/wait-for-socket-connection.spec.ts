import { chmodSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Socket } from 'node:net';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitForSocketConnection } from './wait-for-socket-connection';

// A refused connect has to reach the caller. The daemon client classifies
// EACCES/EPERM into a permission-specific error with its own remedy, and both
// scenarios that error documents arrive through this poll rather than through
// an established connection — so an errno dropped here is one nothing
// downstream can report.
const posixOnly = platform() === 'win32' ? it.skip : it;

describe('waitForSocketConnection', () => {
  let base: string;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'nx-wait-socket-'));
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  // The suite was otherwise entirely negative-path, so the function's whole
  // reason for existing — hand back a live socket and stop — was unasserted.
  posixOnly('should return the connected socket and stop polling', async () => {
    const sockPath = join(base, 'live.sock');
    const server = createServer();
    // `server.close` does not call back while any connection is open, so every
    // one has to be destroyed or a failing assertion hangs the worker forever
    // instead of failing it. The returned socket is not enough: a regression
    // that connects but never hands the socket back leaves the poll's own
    // attempts open, and this test would otherwise have no handle on them.
    // (`closeAllConnections` is http.Server only, not net.Server.)
    const accepted = new Set<Socket>();
    server.on('connection', (c) => {
      accepted.add(c);
      c.on('close', () => accepted.delete(c));
    });
    let socket: Socket | null = null;
    let attempts = 0;

    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(sockPath, resolve);
      });

      socket = await waitForSocketConnection(sockPath, {
        maxAttempts: 5,
        delayMs: 1,
        onConnectError: () => {
          attempts++;
        },
      });

      expect(socket).not.toBeNull();
      expect(socket!.destroyed).toBe(false);
      expect(attempts).toEqual(0);
    } finally {
      socket?.destroy();
      for (const c of accepted) {
        c.destroy();
      }
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('should report the errno of a failed attempt', async () => {
    const missing = join(base, 'not-there.sock');
    const seen: string[] = [];

    const socket = await waitForSocketConnection(missing, {
      maxAttempts: 2,
      delayMs: 1,
      onConnectError: (error) => {
        seen.push(error.code);
      },
    });

    expect(socket).toBeNull();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]).toEqual('ENOENT');
  });

  it('should tell the handler which path the attempt was made against', async () => {
    // The caller reports the refusal after the daemon has given up, by which
    // point it may have unlinked the process json its socket path comes from —
    // so the path has to travel with the errno rather than be looked up again.
    const missing = join(base, 'not-there.sock');
    const seen: string[] = [];

    await waitForSocketConnection(() => missing, {
      maxAttempts: 1,
      delayMs: 1,
      onConnectError: (_error, socketPath) => {
        seen.push(socketPath);
      },
    });

    expect(seen).toEqual([missing]);
  });

  it('should stop polling when the handler says the errno will not heal', async () => {
    const missing = join(base, 'not-there.sock');
    let attempts = 0;

    const socket = await waitForSocketConnection(missing, {
      maxAttempts: 50,
      delayMs: 1,
      onConnectError: () => {
        attempts++;
        return true;
      },
    });

    expect(socket).toBeNull();
    // Without the early exit this waits out the full budget and then reports a
    // generic startup failure, which is the outcome the permission error exists
    // to replace.
    expect(attempts).toEqual(1);
  });

  it('should keep polling while the handler declines to stop', async () => {
    const missing = join(base, 'not-there.sock');
    let attempts = 0;

    await waitForSocketConnection(missing, {
      maxAttempts: 3,
      delayMs: 1,
      onConnectError: () => {
        attempts++;
      },
    });

    expect(attempts).toEqual(3);
  });

  posixOnly(
    'should surface EACCES rather than treating it as an absent socket',
    async () => {
      // A directory the current user cannot search is the portable way to make
      // connect() fail with EACCES rather than ENOENT — the distinction the
      // permission error is built on.
      const locked = join(base, 'locked');
      mkdirSync(locked);
      chmodSync(locked, 0o000);
      const seen: string[] = [];

      try {
        await waitForSocketConnection(join(locked, 'd.sock'), {
          maxAttempts: 1,
          delayMs: 1,
          onConnectError: (error) => {
            seen.push(error.code);
          },
        });
      } finally {
        chmodSync(locked, 0o700);
      }

      // Running as root defeats the permission check entirely, so only assert
      // the distinction where it can exist.
      if (process.getuid?.() !== 0) {
        expect(seen).toContain('EACCES');
      }
    }
  );
});
