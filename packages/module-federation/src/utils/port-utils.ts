import * as net from 'net';

/**
 * Check if a port is already in use by attempting to connect to it.
 *
 * Resolves `true` only when a TCP connection can be established (i.e. something
 * is already listening on the port). A bounded connection timeout ensures the
 * check fails fast and reports the port as free when the address is unreachable
 * rather than blocking on the OS-level TCP connect timeout (which can be minutes
 * on some Linux setups). This matters because callers pass `host: 'localhost'`,
 * which can resolve to the IPv6 loopback `::1`; when nothing accepts the
 * connection there the SYN may be dropped, yielding a slow `ETIMEDOUT` instead
 * of an immediate `ECONNREFUSED`. Without this bound `nx serve` for a module
 * federation host stalls for minutes while probing each remote's proxy port.
 */
export function isPortInUse(
  port: number,
  host: string = 'localhost',
  timeout: number = 1000
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (inUse: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    // Unreachable/slow host or nothing listening -> the port is not serving, so
    // treat it as free and let the caller start its own proxy.
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect({ port, host });
  });
}
