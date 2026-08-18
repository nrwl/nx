import { createServer } from 'net';

/**
 * Check if a port is in use by attempting to bind to it. Binding is local and
 * resolves immediately, so unlike a connection-based check it never stalls on
 * the OS TCP connect timeout when `localhost` resolves to an unreachable address
 * (e.g. IPv6 `::1`) -- the cause of the `nx serve` hang in #33909.
 */
export function isPortInUse(
  port: number,
  host: string = 'localhost'
): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      resolve(err.code === 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, host);
  });
}
