import { randomBytes } from 'crypto';
import { createServer, Server } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { DaemonClient } from './client';

describe('watcher channels under a repeating framing failure', () => {
  let server: Server;
  let connections = 0;

  afterEach(() => {
    server?.close();
    delete process.env.NX_DAEMON;
  });

  // A peer that answers every connection with an unframed message reproduces
  // the deterministic case: a payload over NX_MAX_MESSAGE_SIZE fails the same
  // way on every redial, so reconnecting can never clear it.
  const startHostileDaemon = async () => {
    const path = join(
      tmpdir(),
      `nx-framing-${randomBytes(6).toString('hex')}.sock`
    );
    connections = 0;
    await new Promise<void>((res) => {
      server = createServer((socket) => {
        connections++;
        socket.write(Buffer.from('NOT A FRAMED MESSAGE', 'utf8'));
      });
      server.listen(path, res);
    });
    return path;
  };

  it('stops redialing instead of looping forever', async () => {
    const socketPath = await startHostileDaemon();
    const client = new DaemonClient();
    (client as any).getSocketPath = () => socketPath;
    (client as any).waitForServerToBeAvailable = async () => ({
      available: true,
    });

    const states: any[] = [];
    (client as any).fileWatcherCallbacks.set('cb', (err: any) =>
      states.push(err)
    );

    (client as any).reconnectFileWatcher();
    await new Promise((r) => setTimeout(r, 1500));

    // Bounded: a handful of redials, not tens of thousands.
    expect(connections).toBeLessThanOrEqual(6);
    expect(states).toContain('closed');
  }, 20000);
});
