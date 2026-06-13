import * as net from 'net';
import { isPortInUse } from './port-utils';

describe('isPortInUse', () => {
  function listen(port: number, host = '127.0.0.1'): Promise<net.Server> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', reject);
      server.listen(port, host, () => resolve(server));
    });
  }

  function closeServer(server: net.Server): Promise<void> {
    return new Promise((resolve) => server.close(() => resolve()));
  }

  // Find a port that is currently free by binding to an ephemeral port and
  // immediately releasing it.
  function getFreePort(): Promise<number> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address() as net.AddressInfo;
        server.close(() => resolve(port));
      });
    });
  }

  it('returns true when the port is already taken', async () => {
    const port = await getFreePort();
    const server = await listen(port);
    try {
      await expect(isPortInUse(port, '127.0.0.1')).resolves.toBe(true);
    } finally {
      await closeServer(server);
    }
  });

  it('returns false when the port is free', async () => {
    const port = await getFreePort();

    await expect(isPortInUse(port, '127.0.0.1')).resolves.toBe(false);
  });

  it('releases the port it probed so the caller can bind it afterwards', async () => {
    const port = await getFreePort();

    expect(await isPortInUse(port, '127.0.0.1')).toBe(false);

    // If the check had leaked its probe listener, binding here would throw
    // EADDRINUSE -- which is exactly the crash the check exists to prevent.
    const server = await listen(port);
    await closeServer(server);
  });
});
