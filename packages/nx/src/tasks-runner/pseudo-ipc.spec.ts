import { PseudoIPCServer } from './pseudo-ipc';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('PseudoIPCServer', () => {
  const testSocketDir = join(tmpdir(), 'nx-pseudo-ipc-test');
  let socketPath: string;

  beforeAll(() => {
    try {
      mkdirSync(testSocketDir, { recursive: true });
    } catch {}
  });

  beforeEach(() => {
    socketPath = join(testSocketDir, `test-${process.pid}-${Date.now()}.sock`);
  });

  afterEach(() => {
    try {
      unlinkSync(socketPath);
    } catch {}
  });

  it('should clean up stale socket file before listening', async () => {
    // Create a fake stale socket file
    writeFileSync(socketPath, '');
    expect(existsSync(socketPath)).toBe(true);

    const server = new PseudoIPCServer(socketPath);
    await server.init();

    // Should have successfully listened (stale file was cleaned up)
    // The socket file should exist again (created by the server)
    expect(existsSync(socketPath)).toBe(true);

    server.close();
  });

  it('should work when no stale socket file exists', async () => {
    // Ensure no file exists
    try {
      unlinkSync(socketPath);
    } catch {}
    expect(existsSync(socketPath)).toBe(false);

    const server = new PseudoIPCServer(socketPath);
    await server.init();

    // Should have successfully listened
    expect(existsSync(socketPath)).toBe(true);

    server.close();
  });
});
