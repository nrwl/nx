import * as net from 'net';

/**
 * Check if a port is already in use by attempting to bind to it.
 *
 * Binding is a local operation, so this resolves immediately: if the port is
 * already taken the OS rejects the bind with `EADDRINUSE` and we return `true`;
 * otherwise the bind succeeds, we release the port, and return `false`.
 *
 * Unlike a connection-based check this performs no network round-trip, so it
 * cannot stall on the OS-level TCP connect timeout when `localhost` resolves to
 * an unreachable address (e.g. the IPv6 loopback `::1`, where a dropped SYN
 * yields a slow `ETIMEDOUT`). That stall was the cause of the multi-minute
 * `nx serve` hang for module federation hosts. It also tests the exact
 * operation the caller is about to perform — binding the proxy to the port —
 * so it is a precise predictor of whether starting the proxy would `EADDRINUSE`.
 */
export function isPortInUse(
  port: number,
  host: string = 'localhost'
): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      // The port is already taken. Any other error means we could not bind for
      // an unrelated reason; treat the port as free so the caller still attempts
      // to start its proxy and surfaces the real error there.
      resolve(err.code === 'EADDRINUSE');
    });
    server.once('listening', () => {
      // We bound successfully, so nothing else holds the port. Release it so the
      // caller can start its proxy on the same port.
      server.close(() => resolve(false));
    });
    server.listen(port, host);
  });
}
