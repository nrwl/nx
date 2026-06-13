import * as net from 'net';
import { isPortInUse } from './port-utils';

describe('isPortInUse', () => {
  function listenOnFreePort(): Promise<{ port: number; server: net.Server }> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(0, '127.0.0.1', () => {
        resolve({ port: (server.address() as net.AddressInfo).port, server });
      });
    });
  }

  function closeServer(server: net.Server): Promise<void> {
    return new Promise((resolve) => server.close(() => resolve()));
  }

  it('returns true when a server is listening on the port', async () => {
    const { port, server } = await listenOnFreePort();
    try {
      await expect(isPortInUse(port, '127.0.0.1')).resolves.toBe(true);
    } finally {
      await closeServer(server);
    }
  });

  it('returns false when nothing is listening on the port', async () => {
    // Reserve a port, then release it so we have a port we know is free.
    const { port, server } = await listenOnFreePort();
    await closeServer(server);

    await expect(isPortInUse(port, '127.0.0.1')).resolves.toBe(false);
  });

  it('returns false quickly when the host is unreachable instead of blocking', async () => {
    // 192.0.2.1 (RFC 5737 TEST-NET-1) is a reserved address that blackholes
    // packets. This mirrors the bug in #33909: on some Linux setups connecting
    // to an unreachable loopback (IPv6 `::1`) yields a slow ETIMEDOUT, and
    // without a bounded timeout the check would hang for minutes. The timeout
    // must cap it and report the port as free.
    const start = Date.now();
    const result = await isPortInUse(80, '192.0.2.1', 200);
    const elapsed = Date.now() - start;

    expect(result).toBe(false);
    expect(elapsed).toBeLessThan(5000);
  });
});
