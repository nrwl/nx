import { ChildProcess, spawn } from 'child_process';
import { connect, createServer, Server, Socket } from 'net';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { cleanupStaleSocketFile } from '../../../daemon/socket-utils';

/**
 * Helper: waits for a server to become connectable on the given socket path.
 * Polls every `intervalMs` for up to `timeoutMs`. Resolves with the connected
 * socket on success, or rejects on timeout.
 */
function waitForServer(
  socketPath: string,
  timeoutMs = 10_000,
  intervalMs = 50
): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      if (Date.now() > deadline) {
        reject(
          new Error(
            `Server not available on ${socketPath} within ${timeoutMs}ms`
          )
        );
        return;
      }
      try {
        const socket = connect(socketPath, () => {
          resolve(socket);
        });
        socket.once('error', () => {
          socket.destroy();
          setTimeout(attempt, intervalMs);
        });
      } catch {
        setTimeout(attempt, intervalMs);
      }
    };
    attempt();
  });
}

describe('plugin worker lifecycle', () => {
  describe('stale socket cleanup before listen', () => {
    let socketPath: string;
    let server: Server;

    beforeEach(() => {
      socketPath = join(
        tmpdir(),
        `nx-lifecycle-test-${process.pid}-${Date.now()}.sock`
      );
    });

    afterEach((done) => {
      if (server) {
        server.close(() => {
          try {
            unlinkSync(socketPath);
          } catch {}
          done();
        });
      } else {
        try {
          unlinkSync(socketPath);
        } catch {}
        done();
      }
    });

    it('should allow a new server to listen after cleaning up a stale socket file', (done) => {
      // Simulate a stale socket file left behind by a crashed worker
      writeFileSync(socketPath, '');
      expect(existsSync(socketPath)).toBe(true);

      // Clean it up (as the fixed plugin-worker.ts now does)
      cleanupStaleSocketFile(socketPath);
      expect(existsSync(socketPath)).toBe(false);

      // A new server should be able to listen successfully
      server = createServer(() => {});
      server.listen(socketPath, () => {
        expect(server.listening).toBe(true);
        done();
      });
      server.on('error', (err) => {
        done.fail(
          `Server failed to listen after stale socket cleanup: ${err.message}`
        );
      });
    });

    it('should fail with EADDRINUSE if a stale socket file is NOT cleaned up', (done) => {
      // First server listens normally
      server = createServer(() => {});
      server.listen(socketPath, () => {
        // Second server tries to listen on the same path without cleanup
        const server2 = createServer(() => {});
        server2.on('error', (err: NodeJS.ErrnoException) => {
          expect(err.code).toBe('EADDRINUSE');
          server2.close();
          done();
        });
        server2.listen(socketPath);
      });
    });
  });

  describe('server listen callback timing', () => {
    let socketPath: string;
    let server: Server;

    beforeEach(() => {
      socketPath = join(
        tmpdir(),
        `nx-timing-test-${process.pid}-${Date.now()}.sock`
      );
    });

    afterEach((done) => {
      if (server) {
        server.close(() => {
          try {
            unlinkSync(socketPath);
          } catch {}
          done();
        });
      } else {
        try {
          unlinkSync(socketPath);
        } catch {}
        done();
      }
    });

    it('should only be connectable AFTER the listen callback fires', async () => {
      let listenCallbackFired = false;

      server = createServer(() => {});

      // Start listening — the callback fires when the server is ready
      server.listen(socketPath, () => {
        listenCallbackFired = true;
      });

      // Wait for the server to become connectable
      const socket = await waitForServer(socketPath, 5_000);

      // The listen callback must have fired before we could connect
      expect(listenCallbackFired).toBe(true);

      socket.destroy();
    });
  });

  describe('host-side early exit detection', () => {
    it('should detect when a worker process exits before accepting connections', async () => {
      const socketPath = join(
        tmpdir(),
        `nx-earlyexit-test-${process.pid}-${Date.now()}.sock`
      );

      // Spawn a worker that immediately exits (simulating a crash)
      const worker = spawn(process.execPath, ['-e', 'process.exit(1)'], {
        stdio: 'ignore',
      });

      // Simulate the host-side polling logic with exit detection
      // (mirrors the fix in plugin-pool.ts)
      let workerExited = false;
      let workerExitCode: number | null = null;
      const earlyExitHandler = (code: number | null) => {
        workerExited = true;
        workerExitCode = code;
      };
      worker.once('exit', earlyExitHandler);

      const result = await new Promise<{
        detected: boolean;
        exitCode: number | null;
      }>((resolve) => {
        // Safety timeout so the test doesn't hang
        const safetyTimeout = setTimeout(() => {
          clearInterval(id);
          worker.off('exit', earlyExitHandler);
          resolve({ detected: false, exitCode: null });
        }, 5_000);
        safetyTimeout.unref();

        const id = setInterval(() => {
          if (workerExited) {
            clearInterval(id);
            clearTimeout(safetyTimeout);
            worker.off('exit', earlyExitHandler);
            resolve({ detected: true, exitCode: workerExitCode });
            return;
          }
        }, 10);
      });

      expect(result.detected).toBe(true);
      expect(result.exitCode).toBe(1);

      // Clean up
      try {
        unlinkSync(socketPath);
      } catch {}
    });

    it('should connect successfully when the worker starts a server normally', async () => {
      const socketPath = join(
        tmpdir(),
        `nx-goodworker-test-${process.pid}-${Date.now()}.sock`
      );

      // Spawn a worker that creates a server and listens
      const workerScript = `
        const { createServer } = require('net');
        const server = createServer((socket) => {
          socket.on('data', () => {});
          socket.on('end', () => {
            socket.destroy();
            server.close(() => process.exit(0));
          });
        });
        server.listen(${JSON.stringify(socketPath)}, () => {
          // Signal readiness via stdout
          process.stdout.write('READY');
        });
      `;

      const worker = spawn(process.execPath, ['-e', workerScript], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let workerExited = false;
      const earlyExitHandler = () => {
        workerExited = true;
      };
      worker.once('exit', earlyExitHandler);

      try {
        // Poll for connection (mirrors plugin-pool.ts logic)
        const socket = await waitForServer(socketPath, 10_000);

        expect(workerExited).toBe(false);
        expect(socket).toBeTruthy();

        // Clean up: close the socket which triggers the worker to shut down
        socket.end();
        worker.off('exit', earlyExitHandler);

        await new Promise<void>((resolve) => {
          worker.once('exit', () => resolve());
          // Safety timeout
          setTimeout(() => {
            worker.kill();
            resolve();
          }, 5_000);
        });
      } finally {
        try {
          unlinkSync(socketPath);
        } catch {}
      }
    });
  });
});
